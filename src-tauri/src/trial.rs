use chrono::{DateTime, SecondsFormat, Utc};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    fs::{self, OpenOptions},
    io::Write,
    path::{Path, PathBuf},
    sync::{Mutex, OnceLock},
};
use tauri::Manager;
use uuid::Uuid;

const TRIAL_SCHEMA: u8 = 2;
const LEGACY_TRIAL_SCHEMA: u8 = 1;
const TRIAL_DAYS: i64 = 30;
const TRIAL_SECONDS: i64 = TRIAL_DAYS * 24 * 60 * 60;
const CLOCK_ROLLBACK_TOLERANCE_SECONDS: i64 = 5 * 60;
const INTEGRITY_DOMAIN: &str = "TYANA-QFLOW::TRIAL::2026-07::DEVICE-BOUND::COMMERCIAL-PILOT::V1";
const REGISTRY_PATH: &str = r"Software\TYANA\QFlow";
const REGISTRY_VALUE: &str = "RuntimeEntitlement";
// Only the digest is shipped; the owner enters the activation phrase in Admin.
const PERMANENT_KEY_HASH: &str = "3b9cec43d8f4714fb4ce887c703d11e35db140cff4ce7244fb060c2b0ca76a44";

static TRIAL_LOCK: OnceLock<Mutex<()>> = OnceLock::new();

#[derive(Clone, Debug, Deserialize, Serialize)]
struct TrialRecord {
    schema: u8,
    device_hash: String,
    started_at: i64,
    last_seen_at: i64,
    integrity: String,
    #[serde(default)]
    entitlement: String,
    #[serde(default)]
    activation_id: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct LicenseStatus {
    pub active: bool,
    pub state: String,
    pub trial_days: i64,
    pub days_remaining: i64,
    pub hours_remaining: i64,
    pub started_at: String,
    pub expires_at: String,
    pub last_seen_at: String,
    pub device_id: String,
    pub full_featured: bool,
    pub message: String,
}

#[derive(Debug, thiserror::Error)]
pub(crate) enum TrialError {
    #[error("30 günlük TYANA Q-FLOW kullanım süresi doldu.")]
    Expired,
    #[error("Sistem saati geri alınmış veya deneme kaydı değiştirilmiş. Uygulama kilitlendi.")]
    Tampered,
    #[error("Deneme lisansı bu bilgisayara ait değil.")]
    DeviceMismatch,
    #[error("Deneme lisansı depolaması kullanılamıyor: {0}")]
    Storage(String),
    #[error("Kalıcı lisans anahtarı geçersiz.")]
    InvalidActivation,
}

impl Serialize for TrialError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(self.to_string().as_ref())
    }
}

fn trial_lock() -> &'static Mutex<()> {
    TRIAL_LOCK.get_or_init(|| Mutex::new(()))
}

fn timestamp(value: i64) -> String {
    DateTime::<Utc>::from_timestamp(value, 0)
        .unwrap_or(DateTime::<Utc>::UNIX_EPOCH)
        .to_rfc3339_opts(SecondsFormat::Secs, true)
}

fn integrity_for(record: &TrialRecord) -> String {
    if record.schema == LEGACY_TRIAL_SCHEMA {
        let source = format!(
            "{}|{}|{}|{}|{}|{}",
            INTEGRITY_DOMAIN,
            record.schema,
            record.device_hash,
            record.started_at,
            record.last_seen_at,
            INTEGRITY_DOMAIN
        );
        return format!("{:x}", Sha256::digest(source.as_bytes()));
    }
    let source = format!(
        "{}|{}|{}|{}|{}|{}|{}|{}",
        INTEGRITY_DOMAIN,
        record.schema,
        record.device_hash,
        record.started_at,
        record.last_seen_at,
        record.entitlement,
        record.activation_id,
        INTEGRITY_DOMAIN
    );
    format!("{:x}", Sha256::digest(source.as_bytes()))
}

fn signed_record(device_hash: String, started_at: i64, last_seen_at: i64) -> TrialRecord {
    let mut record = TrialRecord {
        schema: TRIAL_SCHEMA,
        device_hash,
        started_at,
        last_seen_at,
        integrity: String::new(),
        entitlement: "trial".into(),
        activation_id: String::new(),
    };
    record.integrity = integrity_for(&record);
    record
}

fn validate_record(record: TrialRecord) -> Result<TrialRecord, TrialError> {
    if (record.schema != TRIAL_SCHEMA && record.schema != LEGACY_TRIAL_SCHEMA)
        || record.device_hash.len() != 64
        || record.started_at <= 0
        || record.last_seen_at < record.started_at
        || record.integrity != integrity_for(&record)
    {
        return Err(TrialError::Tampered);
    }
    if record.schema == TRIAL_SCHEMA
        && !record.entitlement.is_empty()
        && record.entitlement != "trial"
        && record.entitlement != "permanent"
    {
        return Err(TrialError::Tampered);
    }
    Ok(record)
}

fn permanent_record(device_hash: String, now: i64) -> TrialRecord {
    let mut record = TrialRecord {
        schema: TRIAL_SCHEMA,
        device_hash,
        started_at: now,
        last_seen_at: now,
        integrity: String::new(),
        entitlement: "permanent".into(),
        activation_id: format!("PERM-{}", Uuid::new_v4()),
    };
    record.integrity = integrity_for(&record);
    record
}

fn activation_key_matches(key: &str) -> bool {
    let normalized = key.trim().to_ascii_uppercase();
    if normalized.is_empty() {
        return false;
    }
    format!("{:x}", Sha256::digest(normalized.as_bytes())) == PERMANENT_KEY_HASH
}

fn device_hash() -> Result<String, TrialError> {
    let identity = machine_identity()?;
    if identity.trim().is_empty() {
        return Err(TrialError::Storage(
            "Windows cihaz kimliği okunamadı".into(),
        ));
    }
    Ok(format!(
        "{:x}",
        Sha256::digest(
            format!(
                "TYANA-QFLOW|{}|{}|{}",
                identity.trim(),
                std::env::consts::ARCH,
                INTEGRITY_DOMAIN
            )
            .as_bytes()
        )
    ))
}

#[cfg(windows)]
fn machine_identity() -> Result<String, TrialError> {
    use winreg::{enums::HKEY_LOCAL_MACHINE, RegKey};
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    let key = hklm
        .open_subkey(r"SOFTWARE\Microsoft\Cryptography")
        .map_err(|error| TrialError::Storage(format!("MachineGuid: {error}")))?;
    key.get_value::<String, _>("MachineGuid")
        .map_err(|error| TrialError::Storage(format!("MachineGuid: {error}")))
}

#[cfg(not(windows))]
fn machine_identity() -> Result<String, TrialError> {
    Ok(format!(
        "{}|{}",
        std::env::var("HOSTNAME").unwrap_or_else(|_| "unknown-host".into()),
        std::env::var("USER").unwrap_or_else(|_| "unknown-user".into())
    ))
}

fn state_path(app: &tauri::AppHandle) -> Result<PathBuf, TrialError> {
    let root = app
        .path()
        .app_data_dir()
        .map_err(|error| TrialError::Storage(error.to_string()))?
        .join(".runtime");
    fs::create_dir_all(&root).map_err(|error| TrialError::Storage(error.to_string()))?;
    Ok(root.join("entitlement.dat"))
}

fn read_file_record(path: &Path) -> Result<Option<TrialRecord>, TrialError> {
    if !path.exists() {
        return Ok(None);
    }
    let contents =
        fs::read_to_string(path).map_err(|error| TrialError::Storage(error.to_string()))?;
    let record: TrialRecord = serde_json::from_str(&contents).map_err(|_| TrialError::Tampered)?;
    validate_record(record).map(Some)
}

fn write_file_record(path: &Path, record: &TrialRecord) -> Result<(), TrialError> {
    let parent = path
        .parent()
        .ok_or_else(|| TrialError::Storage("deneme kaydı yolu geçersiz".into()))?;
    fs::create_dir_all(parent).map_err(|error| TrialError::Storage(error.to_string()))?;
    let temporary = parent.join(format!(".entitlement-{}.tmp", Uuid::new_v4()));
    let encoded =
        serde_json::to_vec(record).map_err(|error| TrialError::Storage(error.to_string()))?;
    let result = (|| -> std::io::Result<()> {
        let mut file = OpenOptions::new()
            .create_new(true)
            .write(true)
            .open(&temporary)?;
        file.write_all(&encoded)?;
        file.flush()?;
        file.sync_all()?;
        drop(file);
        replace_state_file(&temporary, path)?;
        Ok(())
    })();
    if let Err(error) = result {
        let _ = fs::remove_file(&temporary);
        return Err(TrialError::Storage(error.to_string()));
    }
    set_hidden(path);
    Ok(())
}

#[cfg(windows)]
fn replace_state_file(source: &Path, destination: &Path) -> std::io::Result<()> {
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::Storage::FileSystem::{
        MoveFileExW, MOVEFILE_REPLACE_EXISTING, MOVEFILE_WRITE_THROUGH,
    };
    let source_wide: Vec<u16> = source.as_os_str().encode_wide().chain(Some(0)).collect();
    let destination_wide: Vec<u16> = destination
        .as_os_str()
        .encode_wide()
        .chain(Some(0))
        .collect();
    let result = unsafe {
        MoveFileExW(
            source_wide.as_ptr(),
            destination_wide.as_ptr(),
            MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH,
        )
    };
    if result == 0 {
        Err(std::io::Error::last_os_error())
    } else {
        Ok(())
    }
}

#[cfg(not(windows))]
fn replace_state_file(source: &Path, destination: &Path) -> std::io::Result<()> {
    fs::rename(source, destination)
}

#[cfg(windows)]
fn set_hidden(path: &Path) {
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::Storage::FileSystem::{
        SetFileAttributesW, FILE_ATTRIBUTE_HIDDEN, FILE_ATTRIBUTE_SYSTEM,
    };
    let path_wide: Vec<u16> = path.as_os_str().encode_wide().chain(Some(0)).collect();
    unsafe {
        SetFileAttributesW(
            path_wide.as_ptr(),
            FILE_ATTRIBUTE_HIDDEN | FILE_ATTRIBUTE_SYSTEM,
        );
    }
}

#[cfg(not(windows))]
fn set_hidden(_path: &Path) {}

#[cfg(windows)]
fn read_registry_record() -> Result<Option<TrialRecord>, TrialError> {
    use std::io::ErrorKind;
    use winreg::{enums::HKEY_CURRENT_USER, RegKey};
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let key = match hkcu.open_subkey(REGISTRY_PATH) {
        Ok(key) => key,
        Err(error) if error.kind() == ErrorKind::NotFound => return Ok(None),
        Err(error) => return Err(TrialError::Storage(error.to_string())),
    };
    let encoded: String = match key.get_value(REGISTRY_VALUE) {
        Ok(value) => value,
        Err(error) if error.kind() == ErrorKind::NotFound => return Ok(None),
        Err(error) => return Err(TrialError::Storage(error.to_string())),
    };
    let record: TrialRecord = serde_json::from_str(&encoded).map_err(|_| TrialError::Tampered)?;
    validate_record(record).map(Some)
}

#[cfg(not(windows))]
fn read_registry_record() -> Result<Option<TrialRecord>, TrialError> {
    Ok(None)
}

#[cfg(windows)]
fn write_registry_record(record: &TrialRecord) -> Result<(), TrialError> {
    use winreg::{enums::HKEY_CURRENT_USER, RegKey};
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let (key, _) = hkcu
        .create_subkey(REGISTRY_PATH)
        .map_err(|error| TrialError::Storage(error.to_string()))?;
    let encoded =
        serde_json::to_string(record).map_err(|error| TrialError::Storage(error.to_string()))?;
    key.set_value(REGISTRY_VALUE, &encoded)
        .map_err(|error| TrialError::Storage(error.to_string()))
}

#[cfg(not(windows))]
fn write_registry_record(_record: &TrialRecord) -> Result<(), TrialError> {
    Ok(())
}

fn reconcile_records(
    file: Option<TrialRecord>,
    registry: Option<TrialRecord>,
    device: &str,
    now: i64,
) -> Result<TrialRecord, TrialError> {
    let records: Vec<TrialRecord> = [file, registry].into_iter().flatten().collect();
    if records.is_empty() {
        return Ok(signed_record(device.to_string(), now, now));
    }
    if records.iter().any(|record| record.device_hash != device) {
        return Err(TrialError::DeviceMismatch);
    }
    let started_at = records
        .iter()
        .map(|record| record.started_at)
        .min()
        .unwrap_or(now);
    let last_seen_at = records
        .iter()
        .map(|record| record.last_seen_at)
        .max()
        .unwrap_or(now);
    if records
        .iter()
        .any(|record| (record.started_at - started_at).abs() > 60)
    {
        return Err(TrialError::Tampered);
    }
    if records.iter().any(|record| record.entitlement == "permanent") {
        let mut merged = permanent_record(device.to_string(), started_at);
        merged.last_seen_at = last_seen_at;
        merged.integrity = integrity_for(&merged);
        Ok(merged)
    } else {
        Ok(signed_record(device.to_string(), started_at, last_seen_at))
    }
}

fn status_from_record(record: &TrialRecord, now: i64) -> LicenseStatus {
    let expiry = record.started_at.saturating_add(TRIAL_SECONDS);
    let rollback = now.saturating_add(CLOCK_ROLLBACK_TOLERANCE_SECONDS) < record.last_seen_at;
    let expired = now >= expiry;
    let permanent = record.entitlement == "permanent";
    let remaining = (expiry - now).max(0);
    let state = if rollback {
        "clock-tamper"
    } else if permanent {
        "permanent"
    } else if expired {
        "expired"
    } else {
        "active"
    };
    let message = match state {
        "permanent" => "Kalıcı TYANA Q-FLOW lisansı etkin.",
        "active" => "30 günlük tam özellikli kullanım sürümü etkin.",
        "expired" => {
            "30 günlük kullanım süresi doldu. Uygulama veri ve çıktı işlemlerine kapatıldı."
        }
        _ => "Sistem saati geri alınmış görünüyor. Uygulama güvenlik nedeniyle kilitlendi.",
    };
    LicenseStatus {
        active: state == "active" || state == "permanent",
        state: state.into(),
        trial_days: TRIAL_DAYS,
        days_remaining: if permanent { -1 } else { (remaining + 86_399) / 86_400 },
        hours_remaining: if permanent { -1 } else { (remaining + 3_599) / 3_600 },
        started_at: timestamp(record.started_at),
        expires_at: if permanent { String::new() } else { timestamp(expiry) },
        last_seen_at: timestamp(record.last_seen_at),
        device_id: record.device_hash.chars().take(12).collect(),
        full_featured: state == "active" || state == "permanent",
        message: message.into(),
    }
}

fn current_status_at(app: &tauri::AppHandle, now: i64) -> Result<LicenseStatus, TrialError> {
    let _guard = trial_lock()
        .lock()
        .map_err(|_| TrialError::Storage("deneme kaydı kilidi kullanılamıyor".into()))?;
    let path = state_path(app)?;
    let device = device_hash()?;
    let file = read_file_record(&path)?;
    let registry = read_registry_record()?;
    let mut record = reconcile_records(file, registry, &device, now)?;
    let status = status_from_record(&record, now);
    if status.active {
        record.last_seen_at = record.last_seen_at.max(now);
        record.integrity = integrity_for(&record);
        write_file_record(&path, &record)?;
        write_registry_record(&record)?;
    }
    Ok(status)
}

pub(crate) fn initialize(app: &tauri::AppHandle) -> Result<LicenseStatus, TrialError> {
    current_status_at(app, Utc::now().timestamp())
}

pub(crate) fn status(app: &tauri::AppHandle) -> Result<LicenseStatus, TrialError> {
    current_status_at(app, Utc::now().timestamp())
}

pub(crate) fn activate_permanent(
    app: &tauri::AppHandle,
    key: &str,
) -> Result<LicenseStatus, TrialError> {
    if !activation_key_matches(key) {
        return Err(TrialError::InvalidActivation);
    }
    let _guard = trial_lock()
        .lock()
        .map_err(|_| TrialError::Storage("lisans kilidi kullanılamıyor".into()))?;
    let path = state_path(app)?;
    let device = device_hash()?;
    let now = Utc::now().timestamp();
    let record = permanent_record(device, now);
    write_file_record(&path, &record)?;
    write_registry_record(&record)?;
    Ok(status_from_record(&record, now))
}

pub(crate) fn ensure_active(app: &tauri::AppHandle) -> Result<(), TrialError> {
    let status = status(app)?;
    match status.state.as_str() {
        "active" | "permanent" => Ok(()),
        "expired" => Err(TrialError::Expired),
        "clock-tamper" => Err(TrialError::Tampered),
        _ => Err(TrialError::Tampered),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn signed_record_detects_content_change() {
        let mut record = signed_record("a".repeat(64), 1_700_000_000, 1_700_000_100);
        assert!(validate_record(record.clone()).is_ok());
        record.started_at -= 86_400;
        assert!(matches!(validate_record(record), Err(TrialError::Tampered)));
    }

    #[test]
    fn full_features_are_available_until_day_thirty() {
        let record = signed_record("b".repeat(64), 1_700_000_000, 1_700_000_000);
        let day_twenty_nine = status_from_record(&record, 1_700_000_000 + 29 * 86_400);
        assert!(day_twenty_nine.active);
        assert!(day_twenty_nine.full_featured);
        assert_eq!(day_twenty_nine.days_remaining, 1);
        let day_thirty = status_from_record(&record, 1_700_000_000 + 30 * 86_400);
        assert!(!day_thirty.active);
        assert_eq!(day_thirty.state, "expired");
    }

    #[test]
    fn clock_rollback_locks_the_trial() {
        let record = signed_record("c".repeat(64), 1_700_000_000, 1_700_100_000);
        let status = status_from_record(&record, 1_700_090_000);
        assert!(!status.active);
        assert_eq!(status.state, "clock-tamper");
    }

    #[test]
    fn device_mismatch_is_rejected() {
        let record = signed_record("d".repeat(64), 1_700_000_000, 1_700_000_000);
        assert!(matches!(
            reconcile_records(Some(record), None, &"e".repeat(64), 1_700_000_100),
            Err(TrialError::DeviceMismatch)
        ));
    }

    #[test]
    fn permanent_activation_phrase_is_digest_validated() {
        assert!(activation_key_matches("TYANA-QFLOW-PERM-2026-EREN-ADMIN"));
        assert!(activation_key_matches("  tyana-qflow-perm-2026-eren-admin  "));
        assert!(!activation_key_matches("TYANA-QFLOW-PERM-2026-EREN-ADM1N"));
    }

    #[test]
    fn permanent_status_never_expires() {
        let record = permanent_record("e".repeat(64), 1_700_000_000);
        let status = status_from_record(&record, 1_900_000_000);
        assert!(status.active);
        assert_eq!(status.state, "permanent");
        assert!(status.full_featured);
        assert_eq!(status.days_remaining, -1);
        assert!(status.expires_at.is_empty());
    }
}
