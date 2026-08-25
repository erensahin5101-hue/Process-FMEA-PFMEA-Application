use chrono::{SecondsFormat, Utc};
use rusqlite::{params, Connection, OptionalExtension, Transaction, TransactionBehavior};
use serde::Serialize;
use serde_json::{json, Map, Value};
use sha2::{Digest, Sha256};
use std::{
    collections::{HashMap, HashSet},
    fs::{self, OpenOptions},
    io::Write,
    path::{Path, PathBuf},
    sync::{Mutex, OnceLock},
    time::Duration,
};
use tauri::{
    ipc::{InvokeBody, Request},
    Manager,
};
use uuid::Uuid;

const MAIN_WINDOW: &str = "main";
const MAX_RECORD_BYTES: usize = 2 * 1024 * 1024;
const MAX_DRAWING_BYTES: usize = 32 * 1024 * 1024;
const MAX_BOM_COMPONENTS: usize = 5_000;
const FINISHED_GOOD_ID: &str = "FINISHED_GOOD";

static DATA_LOCK: OnceLock<Mutex<()>> = OnceLock::new();

const DATABASE_SCHEMA: &str = r#"
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA synchronous = FULL;
CREATE TABLE IF NOT EXISTS app_meta (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS processes (
  id TEXT PRIMARY KEY NOT NULL,
  code TEXT NOT NULL COLLATE NOCASE UNIQUE,
  name TEXT NOT NULL COLLATE NOCASE UNIQUE,
  family TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  version INTEGER NOT NULL DEFAULT 1,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS processes_family_idx ON processes (family);
CREATE INDEX IF NOT EXISTS processes_status_idx ON processes (status);
CREATE TABLE IF NOT EXISTS machines (
  machine_code TEXT PRIMARY KEY NOT NULL COLLATE NOCASE,
  machine_type TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS machines_type_idx ON machines (machine_type, active, machine_code);
CREATE TABLE IF NOT EXISTS operation_machine_eligibility (
  op_code TEXT NOT NULL COLLATE NOCASE,
  machine_code TEXT NOT NULL COLLATE NOCASE,
  source TEXT NOT NULL DEFAULT 'user-confirmed',
  updated_at TEXT NOT NULL,
  PRIMARY KEY (op_code, machine_code),
  FOREIGN KEY (machine_code) REFERENCES machines(machine_code) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS operation_machine_op_idx ON operation_machine_eligibility (op_code, machine_code);
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY NOT NULL,
  project_code TEXT NOT NULL,
  part_number TEXT NOT NULL,
  part_name TEXT NOT NULL,
  product_group TEXT NOT NULL,
  revision TEXT NOT NULL,
  phase TEXT NOT NULL,
  status TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS projects_updated_idx ON projects (updated_at DESC);
CREATE TABLE IF NOT EXISTS master_templates (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL COLLATE NOCASE,
  product_group TEXT NOT NULL,
  product_group_label TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  schema_version TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  version INTEGER NOT NULL DEFAULT 1,
  content_sha256 TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS master_templates_active_name_idx
  ON master_templates (product_group, name COLLATE NOCASE) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS master_templates_group_idx
  ON master_templates (product_group, status, updated_at DESC);
CREATE TABLE IF NOT EXISTS master_template_revisions (
  template_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  action TEXT NOT NULL,
  content_sha256 TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (template_id, version),
  FOREIGN KEY (template_id) REFERENCES master_templates(id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS master_template_revisions_created_idx
  ON master_template_revisions (template_id, created_at DESC);
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY NOT NULL,
  email TEXT NOT NULL COLLATE NOCASE UNIQUE,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL,
  status TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS users_status_idx ON users (status);
CREATE INDEX IF NOT EXISTS users_role_idx ON users (role);
CREATE TABLE IF NOT EXISTS drawing_assets (
  id TEXT PRIMARY KEY NOT NULL,
  sha256 TEXT NOT NULL UNIQUE,
  extension TEXT NOT NULL,
  bytes INTEGER NOT NULL,
  relative_path TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  actor TEXT NOT NULL,
  detail TEXT NOT NULL,
  previous_hash TEXT NOT NULL,
  event_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS audit_entity_idx ON audit_events (entity_type, entity_id, created_at);
INSERT OR IGNORE INTO app_meta (key, value) VALUES ('schema_version', '3');
UPDATE app_meta SET value='3' WHERE key='schema_version' AND value IN ('1','2');
"#;

#[derive(Debug, thiserror::Error)]
pub(crate) enum DataError {
    #[error("Bu pencereden yerel verilere erişmeye izin verilmiyor.")]
    WrongWindow,
    #[error("Kayıt doğrulanamadı: {0}")]
    Validation(String),
    #[error("Yerel veritabanı işlemi tamamlanamadı: {0}")]
    Database(String),
    #[error("Yerel dosya işlemi tamamlanamadı: {0}")]
    Io(String),
    #[error("Teknik resim içeriği veya özeti doğrulanamadı.")]
    InvalidDrawing,
    #[error("{0}")]
    License(#[from] crate::trial::TrialError),
}

impl Serialize for DataError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(self.to_string().as_ref())
    }
}

impl From<rusqlite::Error> for DataError {
    fn from(value: rusqlite::Error) -> Self {
        Self::Database(value.to_string())
    }
}

impl From<std::io::Error> for DataError {
    fn from(value: std::io::Error) -> Self {
        Self::Io(value.to_string())
    }
}

fn ensure_main_window(
    app: &tauri::AppHandle,
    window: &tauri::WebviewWindow,
) -> Result<(), DataError> {
    if window.label() != MAIN_WINDOW {
        return Err(DataError::WrongWindow);
    }
    crate::trial::ensure_active(app)?;
    Ok(())
}

fn data_lock() -> &'static Mutex<()> {
    DATA_LOCK.get_or_init(|| Mutex::new(()))
}

fn now() -> String {
    Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true)
}

fn app_data_root(app: &tauri::AppHandle) -> Result<PathBuf, DataError> {
    let root = app
        .path()
        .app_data_dir()
        .map_err(|error| DataError::Io(error.to_string()))?;
    fs::create_dir_all(&root)?;
    Ok(root)
}

fn open_database(app: &tauri::AppHandle) -> Result<Connection, DataError> {
    let path = app_data_root(app)?.join("tyana-qflow.sqlite3");
    let mut connection = Connection::open(path)?;
    connection.busy_timeout(Duration::from_secs(5))?;
    connection.execute_batch(DATABASE_SCHEMA)?;
    seed_database(&mut connection)?;
    Ok(connection)
}

pub(crate) fn initialize(app: &tauri::AppHandle) -> Result<(), DataError> {
    let _guard = data_lock()
        .lock()
        .map_err(|_| DataError::Database("veri kilidi kullanılamıyor".into()))?;
    let connection = open_database(app)?;
    connection
        .query_row("PRAGMA quick_check", [], |row| row.get::<_, String>(0))
        .map_err(|error| DataError::Database(error.to_string()))
        .and_then(|result| {
            if result == "ok" {
                Ok(())
            } else {
                Err(DataError::Database(result))
            }
        })
}

fn seed_database(connection: &mut Connection) -> Result<(), DataError> {
    let transaction = connection.transaction_with_behavior(TransactionBehavior::Immediate)?;
    let seed = crate::embedded_assets::value("seed-processes")
        .map_err(|error| DataError::Validation(format!("proses tohumu: {error}")))?;
    let processes = seed
        .as_array()
        .ok_or_else(|| DataError::Validation("proses tohumu dizi değil".into()))?;
    let seeded_at = now();
    for source in processes {
        let mut process = source.clone();
        let object = process
            .as_object_mut()
            .ok_or_else(|| DataError::Validation("proses kaydı nesne değil".into()))?;
        let id = value_string(object, "id", 120)?;
        let code = value_string(object, "code", 60)?.to_uppercase();
        let name = value_string(object, "name", 160)?;
        let family = value_string(object, "family", 100)?;
        object.insert("code".into(), Value::String(code.clone()));
        object
            .entry("status")
            .or_insert_with(|| Value::String("active".into()));
        object.entry("version").or_insert_with(|| Value::from(1));
        object
            .entry("createdAt")
            .or_insert_with(|| Value::String(seeded_at.clone()));
        object
            .entry("updatedAt")
            .or_insert_with(|| Value::String(seeded_at.clone()));
        transaction.execute(
            "INSERT OR IGNORE INTO processes (id, code, name, family, status, version, payload, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)",
            params![id, code, name, family, process["status"].as_str().unwrap_or("active"), process.to_string(), seeded_at, seeded_at],
        )?;
    }
    let machine_seed_version: Option<String> = transaction
        .query_row(
            "SELECT value FROM app_meta WHERE key='machine_seed_version'",
            [],
            |row| row.get(0),
        )
        .optional()?;
    if machine_seed_version.as_deref() != Some("1") {
        let machine_seed = crate::embedded_assets::value("machines-master")
            .map_err(|error| DataError::Validation(format!("makine tohumu: {error}")))?;
        let machines = machine_seed
            .get("machines")
            .and_then(Value::as_array)
            .ok_or_else(|| DataError::Validation("makine tohumu dizi değil".into()))?;
        let allowed_machine_types = [
            "cnc_tool",
            "die_fixture",
            "gauge_instrument",
            "assembly_station",
            "ndt_gauge",
        ];
        for machine in machines {
            let object = machine
                .as_object()
                .ok_or_else(|| DataError::Validation("makine tohumu nesne değil".into()))?;
            let machine_code = value_string(object, "machine_code", 40)?.to_uppercase();
            let machine_type = value_string(object, "machine_type", 40)?;
            if !allowed_machine_types.contains(&machine_type.as_str()) {
                return Err(DataError::Validation(format!(
                    "geçersiz makine türü: {machine_type}"
                )));
            }
            transaction.execute(
            "INSERT OR IGNORE INTO machines (machine_code,machine_type,description,active,version,created_at,updated_at) VALUES (?,?,'',1,1,?,?)",
            params![machine_code, machine_type, seeded_at, seeded_at],
        )?;
        }
        let eligibility_seed = [
            ("114", &["D24"][..]),
            ("200", &["I13", "I9"][..]),
            ("202", &["I50", "I20", "I30", "I61", "I60"][..]),
            (
                "355",
                &["T195", "T196", "T197", "T191", "T192", "T164", "T193"][..],
            ),
            (
                "356",
                &["T195", "T196", "T197", "T191", "T192", "T164", "T193"][..],
            ),
            ("429", &["M12"][..]),
            ("435", &["M18"][..]),
            ("519", &["KK25", "KK26", "KK27", "KK28"][..]),
        ];
        for (op_code, machine_codes) in eligibility_seed {
            for machine_code in machine_codes {
                transaction.execute(
                "INSERT OR IGNORE INTO operation_machine_eligibility (op_code,machine_code,source,updated_at) VALUES (?,?,'provided-prototype',?)",
                params![op_code, machine_code, seeded_at],
            )?;
            }
        }
        transaction.execute(
            "INSERT OR REPLACE INTO app_meta (key,value) VALUES ('machine_seed_version','1')",
            [],
        )?;
    }
    let eren = json!({
        "id": "user-eren", "email": "eren@tyana.local", "displayName": "Eren",
        "role": "admin", "status": "active", "plant": "Kullanıcı Tanımlı Tesis",
        "department": "Kalite", "version": 1, "createdAt": seeded_at, "updatedAt": seeded_at
    });
    transaction.execute(
        "INSERT OR IGNORE INTO users (id, email, display_name, role, status, version, payload, created_at, updated_at) VALUES ('user-eren', 'eren@tyana.local', 'Eren', 'admin', 'active', 1, ?, ?, ?)",
        params![eren.to_string(), seeded_at, seeded_at],
    )?;
    let existing_seed_user: Option<String> = transaction
        .query_row(
            "SELECT payload FROM users WHERE id='user-eren' AND email='eren@tyana.local' AND version=1",
            [],
            |row| row.get(0),
        )
        .optional()?;
    if let Some(text) = existing_seed_user {
        let mut user = parse_payload(text)?;
        let generic_plant = "Kullanıcı Tanımlı Tesis";
        if user.get("plant").and_then(Value::as_str) != Some(generic_plant) {
            let timestamp = now();
            user["plant"] = Value::String(generic_plant.into());
            user["updatedAt"] = Value::String(timestamp.clone());
            transaction.execute(
                "UPDATE users SET payload=?, updated_at=? WHERE id='user-eren' AND email='eren@tyana.local' AND version=1",
                params![user.to_string(), timestamp],
            )?;
        }
    }
    transaction.commit()?;
    Ok(())
}

fn value_string(object: &Map<String, Value>, key: &str, max: usize) -> Result<String, DataError> {
    let value = object
        .get(key)
        .and_then(Value::as_str)
        .unwrap_or_default()
        .trim();
    if value.is_empty() || value.len() > max || value.chars().any(|ch| ch.is_control()) {
        return Err(DataError::Validation(format!(
            "{key} alanı eksik veya geçersiz"
        )));
    }
    Ok(value.to_string())
}

fn validate_payload_size(value: &Value) -> Result<(), DataError> {
    if value.to_string().len() > MAX_RECORD_BYTES {
        Err(DataError::Validation("kayıt 2 MB sınırını aşıyor".into()))
    } else {
        Ok(())
    }
}

fn parse_payload(text: String) -> Result<Value, DataError> {
    serde_json::from_str(&text).map_err(|error| DataError::Database(error.to_string()))
}

fn last_hash(transaction: &Transaction<'_>) -> Result<String, DataError> {
    Ok(transaction
        .query_row(
            "SELECT event_hash FROM audit_events ORDER BY rowid DESC LIMIT 1",
            [],
            |row| row.get(0),
        )
        .optional()?
        .unwrap_or_else(|| "GENESIS".into()))
}

fn audit(
    transaction: &Transaction<'_>,
    entity_type: &str,
    entity_id: &str,
    action: &str,
    detail: Value,
) -> Result<(), DataError> {
    let created_at = now();
    let id = Uuid::new_v4().to_string();
    let previous_hash = last_hash(transaction)?;
    let detail_text = detail.to_string();
    let canonical = format!(
        "{previous_hash}|{id}|{entity_type}|{entity_id}|{action}|Eren|{detail_text}|{created_at}"
    );
    let event_hash = format!("{:x}", Sha256::digest(canonical.as_bytes()));
    transaction.execute(
        "INSERT INTO audit_events (id, entity_type, entity_id, action, actor, detail, previous_hash, event_hash, created_at) VALUES (?, ?, ?, ?, 'Eren', ?, ?, ?, ?)",
        params![id, entity_type, entity_id, action, detail_text, previous_hash, event_hash, created_at],
    )?;
    Ok(())
}

fn unique_conflict(error: &rusqlite::Error) -> bool {
    matches!(error, rusqlite::Error::SqliteFailure(code, _) if code.extended_code == 2067 || code.extended_code == 1555)
}

fn validate_project_status(status: &str) -> Result<(), DataError> {
    if [
        "Taslak",
        "İncelemede",
        "Düzeltme Gerekli",
        "Revizyon Gerekli",
        "Onay Bekliyor",
    ]
    .contains(&status)
    {
        Ok(())
    } else {
        Err(DataError::Validation(
            "kimlikli çift onay olmadan proje onaylı veya yayında kaydedilemez".into(),
        ))
    }
}

#[derive(Debug)]
struct RouteStepReference {
    index: usize,
    references: Vec<String>,
    component_ids: HashSet<String>,
    is_painting: bool,
}

#[derive(Debug)]
struct BomComponentValidation {
    index: usize,
    id: String,
    parent_id: String,
    position_key: String,
    critical: bool,
    alternative_group_id: String,
    alternative_selected: bool,
    installation_stage: String,
    prerequisite_process_id: String,
    next_process_id: String,
    produced_at_process_id: String,
    first_use_process_id: String,
    mounted_at_process_id: String,
    inspected_at_process_id: String,
    operation_link_status: String,
}

fn normalized_optional_text(
    object: &mut Map<String, Value>,
    key: &str,
    default: &str,
    max: usize,
) -> Result<String, DataError> {
    let value = match object.get(key) {
        None | Some(Value::Null) => default.to_string(),
        Some(Value::String(value)) => value.trim().to_string(),
        _ => {
            return Err(DataError::Validation(format!(
                "{key} alanı metin olmalıdır"
            )))
        }
    };
    if value.len() > max || value.chars().any(|character| character.is_control()) {
        return Err(DataError::Validation(format!("{key} alanı geçersiz")));
    }
    object.insert(key.into(), Value::String(value.clone()));
    Ok(value)
}

fn normalized_optional_text_alias(
    object: &mut Map<String, Value>,
    key: &str,
    aliases: &[&str],
    default: &str,
    max: usize,
) -> Result<String, DataError> {
    if !object.contains_key(key) {
        if let Some(value) = aliases.iter().find_map(|alias| object.get(*alias).cloned()) {
            object.insert(key.into(), value);
        }
    }
    normalized_optional_text(object, key, default, max)
}

fn normalized_optional_bool(
    object: &mut Map<String, Value>,
    key: &str,
    aliases: &[&str],
    default: bool,
) -> Result<bool, DataError> {
    if !object.contains_key(key) {
        if let Some(value) = aliases.iter().find_map(|alias| object.get(*alias).cloned()) {
            object.insert(key.into(), value);
        }
    }
    let value = match object.get(key) {
        None | Some(Value::Null) => default,
        Some(Value::Bool(value)) => *value,
        _ => {
            return Err(DataError::Validation(format!(
                "{key} alanı doğru/yanlış olmalıdır"
            )))
        }
    };
    object.insert(key.into(), Value::Bool(value));
    Ok(value)
}

fn normalized_positive_quantity(object: &mut Map<String, Value>) -> Result<f64, DataError> {
    let quantity = match object.get("quantity") {
        Some(Value::Number(value)) => value.as_f64(),
        Some(Value::String(value)) => value.trim().replace(',', ".").parse::<f64>().ok(),
        _ => None,
    }
    .filter(|value| value.is_finite() && *value > 0.0)
    .ok_or_else(|| DataError::Validation("BOM miktarı sıfırdan büyük olmalıdır".into()))?;
    let number = serde_json::Number::from_f64(quantity)
        .ok_or_else(|| DataError::Validation("BOM miktarı geçersiz".into()))?;
    object.insert("quantity".into(), Value::Number(number));
    Ok(quantity)
}

fn matching_text(value: &str) -> String {
    value
        .trim()
        .to_lowercase()
        .replace('ı', "i")
        .replace('ş', "s")
        .replace('ğ', "g")
        .replace('ü', "u")
        .replace('ö', "o")
        .replace('ç', "c")
        .replace([' ', '-'], "_")
}

fn meaningful_operation_reference(value: &str) -> bool {
    let normalized = matching_text(value);
    !normalized.is_empty()
        && !normalized.contains("atanmadi")
        && !normalized.contains("bekliyor")
        && normalized != "unassigned"
        && normalized != "none"
}

fn route_steps(snapshot: &mut Map<String, Value>) -> Result<Vec<RouteStepReference>, DataError> {
    snapshot
        .entry("route")
        .or_insert_with(|| Value::Array(Vec::new()));
    let route = snapshot
        .get("route")
        .and_then(Value::as_array)
        .ok_or_else(|| DataError::Validation("proses rotası dizi olmalıdır".into()))?;
    if route.len() > 2_000 {
        return Err(DataError::Validation(
            "proses rotası 2000 operasyon sınırını aşıyor".into(),
        ));
    }
    route
        .iter()
        .enumerate()
        .map(|(index, step)| {
            let object = step.as_object().ok_or_else(|| {
                DataError::Validation("proses rotası satırı nesne olmalıdır".into())
            })?;
            let references = ["routeKey", "processId", "operationNo"]
                .iter()
                .filter_map(|key| object.get(*key).and_then(Value::as_str))
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .map(ToOwned::to_owned)
                .collect::<Vec<_>>();
            let mut component_ids = HashSet::new();
            if let Some(input_ids) = object.get("inputComponentIds") {
                let input_ids = input_ids.as_array().ok_or_else(|| {
                    DataError::Validation(
                        "proses girdisi bileşen bağlantıları dizi olmalıdır".into(),
                    )
                })?;
                for input_id in input_ids {
                    let input_id = input_id
                        .as_str()
                        .map(str::trim)
                        .filter(|id| !id.is_empty())
                        .ok_or_else(|| {
                            DataError::Validation("proses girdisi bileşen kimliği geçersiz".into())
                        })?;
                    component_ids.insert(input_id.to_string());
                }
            }
            if let Some(output_id) = object
                .get("outputItemId")
                .and_then(Value::as_str)
                .map(str::trim)
                .filter(|id| !id.is_empty() && *id != FINISHED_GOOD_ID)
            {
                component_ids.insert(output_id.to_string());
            }
            let searchable = ["routeKey", "processId", "name", "family", "category"]
                .iter()
                .filter_map(|key| object.get(*key).and_then(Value::as_str))
                .map(matching_text)
                .collect::<Vec<_>>()
                .join("|");
            let is_painting = searchable.contains("painting")
                || searchable.contains("boya")
                || searchable.contains("kataforez");
            Ok(RouteStepReference {
                index,
                references,
                component_ids,
                is_painting,
            })
        })
        .collect()
}

fn route_indices_for_reference(route: &[RouteStepReference], reference: &str) -> Vec<usize> {
    if !meaningful_operation_reference(reference) {
        return Vec::new();
    }
    let normalized = matching_text(reference);
    route
        .iter()
        .filter(|step| {
            step.references
                .iter()
                .any(|candidate| matching_text(candidate) == normalized)
        })
        .map(|step| step.index)
        .collect()
}

fn component_route_indices(route: &[RouteStepReference], component_id: &str) -> Vec<usize> {
    route
        .iter()
        .filter(|step| step.component_ids.contains(component_id))
        .map(|step| step.index)
        .collect()
}

fn normalized_position_key(position: &str) -> String {
    let trimmed = position.trim();
    trimmed
        .parse::<u64>()
        .map(|number| format!("#{number}"))
        .unwrap_or_else(|_| matching_text(trimmed))
}

fn is_purchased_component(component_type: &str, make_buy: &str) -> bool {
    let value = format!(
        "{}|{}",
        matching_text(component_type),
        matching_text(make_buy)
    );
    value.contains("satin_al")
        || value.contains("purchased")
        || value.contains("fason")
        || value.contains("musteri_tedariki")
}

fn is_post_paint_stage(value: &str) -> bool {
    let normalized = matching_text(value);
    normalized == "post_paint"
        || normalized.contains("boya_sonrasi")
        || normalized.contains("after_paint")
}

fn operation_status_is_unassigned(value: &str) -> bool {
    let normalized = matching_text(value);
    normalized.is_empty()
        || normalized.contains("atanmadi")
        || normalized.contains("bekliyor")
        || normalized == "unassigned"
}

fn validate_parent_graph(components: &[BomComponentValidation]) -> Result<(), DataError> {
    let ids = components
        .iter()
        .map(|component| component.id.as_str())
        .collect::<HashSet<_>>();
    for component in components {
        if component.parent_id == component.id {
            return Err(DataError::Validation(format!(
                "{} bileşeni kendi üst bileşeni olamaz",
                component.id
            )));
        }
        if component.parent_id != FINISHED_GOOD_ID && !ids.contains(component.parent_id.as_str()) {
            return Err(DataError::Validation(format!(
                "{} bileşeninin üst bileşeni bulunamadı",
                component.id
            )));
        }
    }

    let parents = components
        .iter()
        .map(|component| (component.id.as_str(), component.parent_id.as_str()))
        .collect::<HashMap<_, _>>();
    for component in components {
        let mut visited = HashSet::from([component.id.as_str()]);
        let mut parent = component.parent_id.as_str();
        while parent != FINISHED_GOOD_ID {
            if !visited.insert(parent) {
                return Err(DataError::Validation(format!(
                    "{} bileşeninde döngüsel BOM bağlantısı bulundu",
                    component.id
                )));
            }
            parent = parents.get(parent).copied().ok_or_else(|| {
                DataError::Validation(format!(
                    "{} bileşeninin üst bileşeni bulunamadı",
                    component.id
                ))
            })?;
        }
    }
    Ok(())
}

fn validate_and_normalize_bom_snapshot(
    snapshot: &mut Map<String, Value>,
    project_status: &str,
) -> Result<(), DataError> {
    let route = route_steps(snapshot)?;
    snapshot
        .entry("components")
        .or_insert_with(|| Value::Array(Vec::new()));
    let component_values = snapshot
        .get_mut("components")
        .and_then(Value::as_array_mut)
        .ok_or_else(|| DataError::Validation("BOM bileşenleri dizi olmalıdır".into()))?;
    if component_values.len() > MAX_BOM_COMPONENTS {
        return Err(DataError::Validation(format!(
            "BOM {MAX_BOM_COMPONENTS} bileşen sınırını aşıyor"
        )));
    }

    let mut components = Vec::with_capacity(component_values.len());
    let mut ids = HashSet::with_capacity(component_values.len());
    for (index, component) in component_values.iter_mut().enumerate() {
        let object = component
            .as_object_mut()
            .ok_or_else(|| DataError::Validation("BOM bileşeni nesne olmalıdır".into()))?;
        let id = value_string(object, "id", 120)?;
        if id == FINISHED_GOOD_ID || !ids.insert(id.clone()) {
            return Err(DataError::Validation(format!(
                "BOM bileşen kimliği benzersiz değil: {id}"
            )));
        }
        object.insert("id".into(), Value::String(id.clone()));
        let parent_id = normalized_optional_text(object, "parentId", FINISHED_GOOD_ID, 120)?;
        let position = value_string(object, "position", 40)?;
        object.insert("position".into(), Value::String(position.clone()));
        let item_no = value_string(object, "itemNo", 120)?;
        object.insert("itemNo".into(), Value::String(item_no));
        let name = value_string(object, "name", 200)?;
        object.insert("name".into(), Value::String(name));
        normalized_positive_quantity(object)?;

        let component_type =
            normalized_optional_text(object, "componentType", "Üretilen bileşen", 100)?;
        let make_buy = normalized_optional_text(object, "makeBuy", "Üret", 80)?;
        let supplier = normalized_optional_text(object, "supplier", "", 240)?;
        if is_purchased_component(&component_type, &make_buy) && supplier.is_empty() {
            return Err(DataError::Validation(format!(
                "{id} satın alınan/fason bileşeninde tedarikçi eksik"
            )));
        }
        let critical = normalized_optional_bool(object, "critical", &[], false)?;
        let alternative_group_id = normalized_optional_text_alias(
            object,
            "alternativeGroupId",
            &["alternativeGroup", "selectionGroupId"],
            "",
            120,
        )?;
        let alternative_selected = normalized_optional_bool(
            object,
            "alternativeSelected",
            &["isAlternativeSelected", "selectedAlternative"],
            false,
        )?;
        let installation_stage = normalized_optional_text_alias(
            object,
            "installationStage",
            &["assemblyStage", "mountingStage"],
            "",
            100,
        )?;
        let prerequisite_process_id =
            normalized_optional_text(object, "prerequisiteProcessId", "", 120)?;
        let next_process_id = normalized_optional_text(object, "nextProcessId", "", 120)?;
        let produced_at_process_id =
            normalized_optional_text(object, "producedAtProcessId", "", 120)?;
        let first_use_process_id = normalized_optional_text(object, "firstUseProcessId", "", 120)?;
        let mounted_at_process_id =
            normalized_optional_text(object, "mountedAtProcessId", "", 120)?;
        let inspected_at_process_id =
            normalized_optional_text(object, "inspectedAtProcessId", "", 120)?;
        let operation_link_status =
            normalized_optional_text(object, "operationLinkStatus", "", 80)?;

        components.push(BomComponentValidation {
            index,
            id,
            parent_id,
            position_key: normalized_position_key(&position),
            critical,
            alternative_group_id,
            alternative_selected,
            installation_stage,
            prerequisite_process_id,
            next_process_id,
            produced_at_process_id,
            first_use_process_id,
            mounted_at_process_id,
            inspected_at_process_id,
            operation_link_status,
        });
    }

    validate_parent_graph(&components)?;

    let mut positions = HashSet::with_capacity(components.len());
    for component in &components {
        let key = (component.parent_id.clone(), component.position_key.clone());
        if !positions.insert(key) {
            return Err(DataError::Validation(format!(
                "{} üst bileşeninde yinelenen pozisyon numarası bulundu",
                component.parent_id
            )));
        }
    }

    let mut alternative_groups: HashMap<(String, String), (usize, usize)> = HashMap::new();
    for component in &components {
        if component.alternative_group_id.is_empty() {
            continue;
        }
        let entry = alternative_groups
            .entry((
                component.parent_id.clone(),
                component.alternative_group_id.clone(),
            ))
            .or_default();
        entry.0 += 1;
        if component.alternative_selected {
            entry.1 += 1;
        }
    }
    for ((parent_id, group_id), (_, selected)) in alternative_groups {
        if selected != 1 {
            return Err(DataError::Validation(format!(
                "{parent_id} altındaki {group_id} alternatif grubunda tam bir seçim yapılmalıdır"
            )));
        }
    }

    let release_checks = project_status == "Onay Bekliyor";
    for component in &components {
        let mut mapped_indices = component_route_indices(&route, &component.id);
        for reference in [
            &component.produced_at_process_id,
            &component.first_use_process_id,
            &component.mounted_at_process_id,
            &component.inspected_at_process_id,
        ] {
            if !meaningful_operation_reference(reference) {
                continue;
            }
            let indices = route_indices_for_reference(&route, reference);
            if !route.is_empty() && indices.is_empty() {
                return Err(DataError::Validation(format!(
                    "{} bileşeninin operasyon bağlantısı rotada bulunamadı: {}",
                    component.id, reference
                )));
            }
            mapped_indices.extend(indices);
        }
        mapped_indices.sort_unstable();
        mapped_indices.dedup();

        let link_status = if component.operation_link_status.is_empty() {
            if mapped_indices.is_empty() {
                "Henüz atanmadı"
            } else {
                "Atandı"
            }
        } else {
            component.operation_link_status.as_str()
        };
        component_values[component.index]
            .as_object_mut()
            .expect("validated BOM component")
            .insert(
                "operationLinkStatus".into(),
                Value::String(link_status.to_string()),
            );

        if release_checks
            && component.critical
            && (mapped_indices.is_empty() || operation_status_is_unassigned(link_status))
        {
            return Err(DataError::Validation(format!(
                "kritik bileşenin doğrulanabilir operasyon bağlantısı eksik: {}",
                component.id
            )));
        }

        if route.is_empty() {
            continue;
        }
        let post_paint = is_post_paint_stage(&component.installation_stage);
        let prerequisite_indices =
            if meaningful_operation_reference(&component.prerequisite_process_id) {
                let indices =
                    route_indices_for_reference(&route, &component.prerequisite_process_id);
                if indices.is_empty() {
                    return Err(DataError::Validation(format!(
                        "{} bileşeninin ön koşul prosesi rotada bulunamadı: {}",
                        component.id, component.prerequisite_process_id
                    )));
                }
                indices
            } else if post_paint {
                route
                    .iter()
                    .filter(|step| step.is_painting)
                    .map(|step| step.index)
                    .collect()
            } else {
                Vec::new()
            };
        if post_paint && prerequisite_indices.is_empty() {
            return Err(DataError::Validation(format!(
                "{} boya sonrası montaj gerektiriyor ancak rotada boya prosesi yok",
                component.id
            )));
        }
        if !prerequisite_indices.is_empty() {
            let use_indices = if meaningful_operation_reference(&component.mounted_at_process_id) {
                route_indices_for_reference(&route, &component.mounted_at_process_id)
            } else if meaningful_operation_reference(&component.first_use_process_id) {
                route_indices_for_reference(&route, &component.first_use_process_id)
            } else {
                mapped_indices.clone()
            };
            if use_indices.is_empty()
                || use_indices
                    .iter()
                    .any(|index| *index <= *prerequisite_indices.iter().max().unwrap())
            {
                return Err(DataError::Validation(format!(
                    "{} bileşeni ön koşul prosesi tamamlanmadan kullanılamaz/monte edilemez",
                    component.id
                )));
            }
            if meaningful_operation_reference(&component.next_process_id) {
                let next_indices = route_indices_for_reference(&route, &component.next_process_id);
                if next_indices.is_empty()
                    || next_indices
                        .iter()
                        .all(|index| *index <= *use_indices.iter().max().unwrap())
                {
                    return Err(DataError::Validation(format!(
                        "{} bileşeninin sonraki prosesi montaj/kullanım adımından sonra olmalıdır",
                        component.id
                    )));
                }
            }
        }
    }
    Ok(())
}

fn canonical_json(value: &Value) -> Result<String, DataError> {
    match value {
        Value::Null | Value::Bool(_) | Value::Number(_) | Value::String(_) => {
            serde_json::to_string(value).map_err(|error| DataError::Validation(error.to_string()))
        }
        Value::Array(values) => {
            let mut output = String::from("[");
            for (index, value) in values.iter().enumerate() {
                if index > 0 {
                    output.push(',');
                }
                output.push_str(&canonical_json(value)?);
            }
            output.push(']');
            Ok(output)
        }
        Value::Object(object) => {
            let mut keys = object.keys().collect::<Vec<_>>();
            keys.sort_unstable();
            let mut output = String::from("{");
            for (index, key) in keys.iter().enumerate() {
                if index > 0 {
                    output.push(',');
                }
                output.push_str(
                    &serde_json::to_string(key)
                        .map_err(|error| DataError::Validation(error.to_string()))?,
                );
                output.push(':');
                output.push_str(&canonical_json(&object[*key])?);
            }
            output.push('}');
            Ok(output)
        }
    }
}

fn canonical_snapshot_sha256(snapshot: &Map<String, Value>) -> Result<String, DataError> {
    let mut without_digest = snapshot.clone();
    without_digest.remove("sha256");
    let canonical = canonical_json(&Value::Object(without_digest))?;
    Ok(format!("{:x}", Sha256::digest(canonical.as_bytes())))
}

#[tauri::command]
pub(crate) fn process_list(
    app: tauri::AppHandle,
    window: tauri::WebviewWindow,
) -> Result<Value, DataError> {
    ensure_main_window(&app, &window)?;
    let _guard = data_lock()
        .lock()
        .map_err(|_| DataError::Database("veri kilidi kullanılamıyor".into()))?;
    let connection = open_database(&app)?;
    let mut statement = connection
        .prepare("SELECT payload FROM processes ORDER BY status ASC, family ASC, code ASC")?;
    let rows = statement.query_map([], |row| row.get::<_, String>(0))?;
    let mut processes = Vec::new();
    for row in rows {
        processes.push(parse_payload(row?)?);
    }
    Ok(json!({ "processes": processes }))
}

fn normalized_machine_code(value: &str) -> Result<String, DataError> {
    let code = value.trim().to_uppercase();
    if code.is_empty()
        || code.len() > 40
        || !code.chars().all(|character| {
            character.is_ascii_alphanumeric() || matches!(character, '-' | '_' | '.')
        })
    {
        return Err(DataError::Validation(
            "makine kodu yalnız harf, rakam, nokta, tire veya alt çizgi içerebilir".into(),
        ));
    }
    Ok(code)
}

fn validated_machine_type(value: &str) -> Result<String, DataError> {
    let machine_type = value.trim().to_ascii_lowercase();
    if [
        "cnc_tool",
        "die_fixture",
        "gauge_instrument",
        "assembly_station",
        "ndt_gauge",
    ]
    .contains(&machine_type.as_str())
    {
        Ok(machine_type)
    } else {
        Err(DataError::Validation("makine türü geçersiz".into()))
    }
}

#[tauri::command]
pub(crate) fn machine_library_get(
    app: tauri::AppHandle,
    window: tauri::WebviewWindow,
) -> Result<Value, DataError> {
    ensure_main_window(&app, &window)?;
    let _guard = data_lock()
        .lock()
        .map_err(|_| DataError::Database("veri kilidi kullanılamıyor".into()))?;
    let connection = open_database(&app)?;
    let mut machine_statement = connection.prepare(
        "SELECT machine_code,machine_type,description,active,version,created_at,updated_at FROM machines ORDER BY machine_type,machine_code",
    )?;
    let machine_rows = machine_statement.query_map([], |row| {
        Ok(json!({
            "machineCode": row.get::<_, String>(0)?,
            "machineType": row.get::<_, String>(1)?,
            "description": row.get::<_, String>(2)?,
            "active": row.get::<_, i64>(3)? != 0,
            "version": row.get::<_, i64>(4)?,
            "createdAt": row.get::<_, String>(5)?,
            "updatedAt": row.get::<_, String>(6)?
        }))
    })?;
    let mut machines = Vec::new();
    for row in machine_rows {
        machines.push(row?);
    }
    let mut eligibility_statement = connection.prepare(
        "SELECT op_code,machine_code,source,updated_at FROM operation_machine_eligibility ORDER BY op_code,machine_code",
    )?;
    let eligibility_rows = eligibility_statement.query_map([], |row| {
        Ok(json!({
            "opCode": row.get::<_, String>(0)?,
            "machineCode": row.get::<_, String>(1)?,
            "source": row.get::<_, String>(2)?,
            "updatedAt": row.get::<_, String>(3)?
        }))
    })?;
    let mut eligibility = Vec::new();
    for row in eligibility_rows {
        eligibility.push(row?);
    }
    Ok(json!({ "machines": machines, "eligibility": eligibility }))
}

#[tauri::command]
pub(crate) fn machine_save(
    app: tauri::AppHandle,
    window: tauri::WebviewWindow,
    original_code: Option<String>,
    payload: Value,
) -> Result<Value, DataError> {
    ensure_main_window(&app, &window)?;
    validate_payload_size(&payload)?;
    let object = payload
        .as_object()
        .ok_or_else(|| DataError::Validation("makine nesnesi gerekli".into()))?;
    let machine_code = normalized_machine_code(
        object
            .get("machineCode")
            .and_then(Value::as_str)
            .unwrap_or_default(),
    )?;
    let machine_type = validated_machine_type(
        object
            .get("machineType")
            .and_then(Value::as_str)
            .unwrap_or_default(),
    )?;
    let description = object
        .get("description")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .trim()
        .to_string();
    if description.len() > 500 || description.chars().any(char::is_control) {
        return Err(DataError::Validation("makine açıklaması geçersiz".into()));
    }
    let active = object
        .get("active")
        .and_then(Value::as_bool)
        .unwrap_or(true);
    let supplied_version = object
        .get("version")
        .and_then(Value::as_i64)
        .unwrap_or_default();
    let lookup_code = normalized_machine_code(original_code.as_deref().unwrap_or(&machine_code))?;
    let _guard = data_lock()
        .lock()
        .map_err(|_| DataError::Database("veri kilidi kullanılamıyor".into()))?;
    let mut connection = open_database(&app)?;
    let transaction = connection.transaction_with_behavior(TransactionBehavior::Immediate)?;
    let existing: Option<(i64, String)> = transaction
        .query_row(
            "SELECT version,created_at FROM machines WHERE machine_code=?",
            [&lookup_code],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .optional()?;
    if let Some((current, _)) = existing.as_ref() {
        if supplied_version != *current {
            return Err(DataError::Validation(format!(
                "makine kaydı başka bir oturumda değiştirildi; güncel sürüm v{current}"
            )));
        }
    }
    let timestamp = now();
    let version = existing.as_ref().map(|record| record.0 + 1).unwrap_or(1);
    let created_at = existing
        .as_ref()
        .map(|record| record.1.clone())
        .unwrap_or_else(|| timestamp.clone());
    let result = if existing.is_some() {
        transaction.execute(
            "UPDATE machines SET machine_code=?,machine_type=?,description=?,active=?,version=?,updated_at=? WHERE machine_code=? AND version=?",
            params![machine_code,machine_type,description,active as i64,version,timestamp,lookup_code,supplied_version],
        )
    } else {
        transaction.execute(
            "INSERT INTO machines (machine_code,machine_type,description,active,version,created_at,updated_at) VALUES (?,?,?,?,1,?,?)",
            params![machine_code,machine_type,description,active as i64,created_at,timestamp],
        )
    };
    if let Err(error) = result {
        return Err(if unique_conflict(&error) {
            DataError::Validation("makine kodu zaten kayıtlı".into())
        } else {
            error.into()
        });
    }
    audit(
        &transaction,
        "machine",
        &machine_code,
        if existing.is_some() {
            "updated"
        } else {
            "created"
        },
        json!({"machineType": machine_type, "active": active, "version": version}),
    )?;
    transaction.commit()?;
    Ok(
        json!({"machine": {"machineCode": machine_code,"machineType": machine_type,"description": description,"active": active,"version": version,"createdAt": created_at,"updatedAt": timestamp}}),
    )
}

#[tauri::command]
pub(crate) fn machine_delete(
    app: tauri::AppHandle,
    window: tauri::WebviewWindow,
    machine_code: String,
) -> Result<Value, DataError> {
    ensure_main_window(&app, &window)?;
    let machine_code = normalized_machine_code(&machine_code)?;
    let _guard = data_lock()
        .lock()
        .map_err(|_| DataError::Database("veri kilidi kullanılamıyor".into()))?;
    let mut connection = open_database(&app)?;
    let transaction = connection.transaction_with_behavior(TransactionBehavior::Immediate)?;
    let affected =
        transaction.execute("DELETE FROM machines WHERE machine_code=?", [&machine_code])?;
    if affected != 1 {
        return Err(DataError::Validation("makine kaydı bulunamadı".into()));
    }
    audit(&transaction, "machine", &machine_code, "deleted", json!({}))?;
    transaction.commit()?;
    Ok(json!({"ok": true}))
}

#[tauri::command]
pub(crate) fn operation_machine_eligibility_save(
    app: tauri::AppHandle,
    window: tauri::WebviewWindow,
    op_code: String,
    machine_codes: Vec<String>,
    source: Option<String>,
) -> Result<Value, DataError> {
    ensure_main_window(&app, &window)?;
    let op_code = op_code.trim().to_uppercase();
    if op_code.is_empty() || op_code.len() > 40 || op_code.chars().any(char::is_control) {
        return Err(DataError::Validation("operasyon kodu geçersiz".into()));
    }
    let mut normalized = machine_codes
        .iter()
        .map(|code| normalized_machine_code(code))
        .collect::<Result<Vec<_>, _>>()?;
    normalized.sort();
    normalized.dedup();
    let source = source.unwrap_or_else(|| "user-confirmed".into());
    if source.len() > 80 || source.chars().any(char::is_control) {
        return Err(DataError::Validation("uygunluk kaynağı geçersiz".into()));
    }
    let _guard = data_lock()
        .lock()
        .map_err(|_| DataError::Database("veri kilidi kullanılamıyor".into()))?;
    let mut connection = open_database(&app)?;
    let transaction = connection.transaction_with_behavior(TransactionBehavior::Immediate)?;
    for machine_code in &normalized {
        let active: Option<i64> = transaction
            .query_row(
                "SELECT active FROM machines WHERE machine_code=?",
                [machine_code],
                |row| row.get(0),
            )
            .optional()?;
        if active != Some(1) {
            return Err(DataError::Validation(format!(
                "{machine_code} etkin makine sicilinde bulunamadı"
            )));
        }
    }
    transaction.execute(
        "DELETE FROM operation_machine_eligibility WHERE op_code=?",
        [&op_code],
    )?;
    let timestamp = now();
    for machine_code in &normalized {
        transaction.execute(
            "INSERT INTO operation_machine_eligibility (op_code,machine_code,source,updated_at) VALUES (?,?,?,?)",
            params![op_code,machine_code,source,timestamp],
        )?;
    }
    audit(
        &transaction,
        "operation_machine_eligibility",
        &op_code,
        "replaced",
        json!({"machineCodes": normalized, "source": source}),
    )?;
    transaction.commit()?;
    Ok(
        json!({"opCode": op_code,"machineCodes": normalized,"source": source,"updatedAt": timestamp}),
    )
}

#[tauri::command]
pub(crate) fn process_save(
    app: tauri::AppHandle,
    window: tauri::WebviewWindow,
    id: Option<String>,
    payload: Value,
) -> Result<Value, DataError> {
    ensure_main_window(&app, &window)?;
    validate_payload_size(&payload)?;
    let mut process = payload
        .as_object()
        .cloned()
        .ok_or_else(|| DataError::Validation("proses nesnesi gerekli".into()))?;
    let code = value_string(&process, "code", 60)?.to_uppercase();
    let name = value_string(&process, "name", 160)?;
    let family = value_string(&process, "family", 100)?;
    for required in ["category", "equipment", "controlMethod"] {
        value_string(&process, required, 500)?;
    }
    process.insert("approvalStatus".into(), Value::String("draft".into()));
    let supplied_version = process
        .get("version")
        .and_then(Value::as_i64)
        .unwrap_or_default();
    let _guard = data_lock()
        .lock()
        .map_err(|_| DataError::Database("veri kilidi kullanılamıyor".into()))?;
    let mut connection = open_database(&app)?;
    let transaction = connection.transaction_with_behavior(TransactionBehavior::Immediate)?;
    let timestamp = now();
    let process_id = id.unwrap_or_else(|| Uuid::new_v4().to_string());
    let existing: Option<(i64, String)> = transaction
        .query_row(
            "SELECT version, created_at FROM processes WHERE id = ?",
            [&process_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .optional()?;
    if let Some((current, _)) = existing.as_ref() {
        if supplied_version != *current {
            return Err(DataError::Validation(format!(
                "proses başka bir oturumda değiştirildi; güncel sürüm v{current}"
            )));
        }
    }
    let version = existing.as_ref().map(|row| row.0 + 1).unwrap_or(1);
    let created_at = existing
        .as_ref()
        .map(|row| row.1.clone())
        .unwrap_or_else(|| timestamp.clone());
    process.insert("id".into(), Value::String(process_id.clone()));
    process.insert("code".into(), Value::String(code.clone()));
    process.insert("name".into(), Value::String(name.clone()));
    process.insert("family".into(), Value::String(family.clone()));
    process
        .entry("status")
        .or_insert_with(|| Value::String("active".into()));
    process.insert("version".into(), Value::from(version));
    process.insert("createdAt".into(), Value::String(created_at.clone()));
    process.insert("updatedAt".into(), Value::String(timestamp.clone()));
    let status = process
        .get("status")
        .and_then(Value::as_str)
        .unwrap_or("active")
        .to_string();
    let text = Value::Object(process.clone()).to_string();
    let result = if let Some((current, _)) = existing.as_ref() {
        transaction.execute("UPDATE processes SET code=?, name=?, family=?, status=?, version=?, payload=?, updated_at=? WHERE id=? AND version=?", params![code, name, family, status, version, text, timestamp, process_id, current])
    } else {
        transaction.execute("INSERT INTO processes (id, code, name, family, status, version, payload, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", params![process_id, code, name, family, status, version, text, created_at, timestamp])
    };
    let affected = match result {
        Ok(affected) => affected,
        Err(error) => {
            return Err(if unique_conflict(&error) {
                DataError::Validation("proses kodu veya adı zaten kayıtlı".into())
            } else {
                error.into()
            });
        }
    };
    if existing.is_some() && affected != 1 {
        return Err(DataError::Validation(
            "proses başka bir oturumda değiştirildi; kaydı yenileyin".into(),
        ));
    }
    audit(
        &transaction,
        "process",
        &process_id,
        if existing.is_some() {
            "updated"
        } else {
            "created"
        },
        json!({"version": version, "code": code}),
    )?;
    transaction.commit()?;
    Ok(json!({ "process": Value::Object(process) }))
}

#[tauri::command]
pub(crate) fn process_archive(
    app: tauri::AppHandle,
    window: tauri::WebviewWindow,
    id: String,
) -> Result<Value, DataError> {
    ensure_main_window(&app, &window)?;
    let _guard = data_lock()
        .lock()
        .map_err(|_| DataError::Database("veri kilidi kullanılamıyor".into()))?;
    let mut connection = open_database(&app)?;
    let transaction = connection.transaction_with_behavior(TransactionBehavior::Immediate)?;
    let existing: Option<(String, i64)> = transaction
        .query_row(
            "SELECT payload, version FROM processes WHERE id=?",
            [&id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .optional()?;
    let Some((text, current_version)) = existing else {
        return Err(DataError::Validation("proses bulunamadı".into()));
    };
    let mut payload = parse_payload(text)?;
    let next_version = current_version + 1;
    let timestamp = now();
    payload["status"] = Value::String("archived".into());
    payload["version"] = Value::from(next_version);
    payload["updatedAt"] = Value::String(timestamp.clone());
    let affected = transaction.execute(
        "UPDATE processes SET status='archived', version=?, payload=?, updated_at=? WHERE id=? AND version=?",
        params![next_version, payload.to_string(), timestamp, id, current_version],
    )?;
    if affected != 1 {
        return Err(DataError::Validation(
            "proses başka bir oturumda değiştirildi; kaydı yenileyin".into(),
        ));
    }
    audit(&transaction, "process", &id, "archived", json!({}))?;
    transaction.commit()?;
    Ok(json!({ "ok": true }))
}

fn project_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<Value> {
    let payload_text: String = row.get(9)?;
    let payload: Value = serde_json::from_str(&payload_text).map_err(|error| {
        rusqlite::Error::FromSqlConversionFailure(9, rusqlite::types::Type::Text, Box::new(error))
    })?;
    Ok(json!({
        "id": row.get::<_, String>(0)?, "projectCode": row.get::<_, String>(1)?,
        "partNumber": row.get::<_, String>(2)?, "partName": row.get::<_, String>(3)?,
        "productGroup": row.get::<_, String>(4)?, "revision": row.get::<_, String>(5)?,
        "phase": row.get::<_, String>(6)?, "status": row.get::<_, String>(7)?,
        "version": row.get::<_, i64>(8)?, "payload": payload,
        "createdAt": row.get::<_, String>(10)?, "updatedAt": row.get::<_, String>(11)?
    }))
}

#[tauri::command]
pub(crate) fn project_latest(
    app: tauri::AppHandle,
    window: tauri::WebviewWindow,
) -> Result<Value, DataError> {
    ensure_main_window(&app, &window)?;
    let _guard = data_lock()
        .lock()
        .map_err(|_| DataError::Database("veri kilidi kullanılamıyor".into()))?;
    let connection = open_database(&app)?;
    let project = connection.query_row("SELECT id,project_code,part_number,part_name,product_group,revision,phase,status,version,payload,created_at,updated_at FROM projects ORDER BY updated_at DESC LIMIT 1", [], project_from_row).optional()?;
    Ok(json!({ "project": project }))
}

#[tauri::command]
pub(crate) fn project_save(
    app: tauri::AppHandle,
    window: tauri::WebviewWindow,
    id: Option<String>,
    payload: Value,
) -> Result<Value, DataError> {
    ensure_main_window(&app, &window)?;
    validate_payload_size(&payload)?;
    let input = payload
        .as_object()
        .ok_or_else(|| DataError::Validation("proje nesnesi gerekli".into()))?;
    let project_code = value_string(input, "projectCode", 100)?;
    let part_number = value_string(input, "partNumber", 120)?;
    let part_name = value_string(input, "partName", 200)?;
    let product_group = value_string(input, "productGroup", 100)?;
    let revision = value_string(input, "revision", 20)?;
    let phase = value_string(input, "phase", 80)?;
    let status = input
        .get("status")
        .and_then(Value::as_str)
        .unwrap_or("Taslak")
        .to_string();
    validate_project_status(&status)?;
    let mut snapshot = input
        .get("payload")
        .and_then(Value::as_object)
        .cloned()
        .ok_or_else(|| DataError::Validation("proje snapshot verisi eksik".into()))?;
    let snapshot_status = snapshot
        .get("approval")
        .and_then(Value::as_object)
        .and_then(|approval| approval.get("status"))
        .and_then(Value::as_str)
        .unwrap_or("Taslak");
    if snapshot_status != status {
        return Err(DataError::Validation(
            "proje durumu ile snapshot onay durumu eşleşmiyor".into(),
        ));
    }
    let project_id = id.unwrap_or_else(|| Uuid::new_v4().to_string());
    snapshot.insert("projectId".into(), Value::String(project_id.clone()));
    validate_and_normalize_bom_snapshot(&mut snapshot, &status)?;
    let snapshot_sha256 = canonical_snapshot_sha256(&snapshot)?;
    snapshot.insert("sha256".into(), Value::String(snapshot_sha256.clone()));
    validate_payload_size(&Value::Object(snapshot.clone()))?;
    let _guard = data_lock()
        .lock()
        .map_err(|_| DataError::Database("veri kilidi kullanılamıyor".into()))?;
    let mut connection = open_database(&app)?;
    let transaction = connection.transaction_with_behavior(TransactionBehavior::Immediate)?;
    let timestamp = now();
    let existing: Option<(i64, String)> = transaction
        .query_row(
            "SELECT version,created_at FROM projects WHERE id=?",
            [&project_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .optional()?;
    if let Some((current, _)) = existing.as_ref() {
        let supplied = input
            .get("version")
            .and_then(Value::as_i64)
            .unwrap_or_default();
        if supplied != *current {
            return Err(DataError::Validation(format!(
                "kayıt başka bir oturumda değiştirildi; güncel sürüm v{current}"
            )));
        }
    }
    let version = existing.as_ref().map(|row| row.0 + 1).unwrap_or(1);
    let created_at = existing
        .as_ref()
        .map(|row| row.1.clone())
        .unwrap_or_else(|| timestamp.clone());
    let snapshot_text = Value::Object(snapshot.clone()).to_string();
    if let Some((current, _)) = existing.as_ref() {
        let affected = transaction.execute("UPDATE projects SET project_code=?,part_number=?,part_name=?,product_group=?,revision=?,phase=?,status=?,version=?,payload=?,updated_at=? WHERE id=? AND version=?", params![project_code,part_number,part_name,product_group,revision,phase,status,version,snapshot_text,timestamp,project_id,current])?;
        if affected != 1 {
            return Err(DataError::Validation(
                "kayıt başka bir oturumda değiştirildi; kaydı yenileyin".into(),
            ));
        }
    } else {
        transaction.execute("INSERT INTO projects (id,project_code,part_number,part_name,product_group,revision,phase,status,version,payload,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)", params![project_id,project_code,part_number,part_name,product_group,revision,phase,status,version,snapshot_text,created_at,timestamp])?;
    }
    audit(
        &transaction,
        "project",
        &project_id,
        if existing.is_some() {
            "updated"
        } else {
            "created"
        },
        json!({"version": version, "revision": revision, "snapshotSha256": snapshot_sha256}),
    )?;
    transaction.commit()?;
    Ok(
        json!({ "project": { "id": project_id, "projectCode": project_code, "partNumber": part_number, "partName": part_name, "productGroup": product_group, "revision": revision, "phase": phase, "status": status, "version": version, "payload": Value::Object(snapshot), "createdAt": created_at, "updatedAt": timestamp } }),
    )
}

const MASTER_TEMPLATE_SCHEMA_VERSION: &str = "1.0.0";
const MASTER_TEMPLATE_KIND: &str = "PRODUCT_GROUP_MASTER_TEMPLATE";
const MASTER_TEMPLATE_REQUIRED_IDENTITY: [&str; 9] = [
    "partName",
    "partNumber",
    "internalProductCode",
    "customer",
    "projectCode",
    "controlPlanNumber",
    "drawingNumber",
    "drawingRevision",
    "productionPhase",
];

#[derive(Debug)]
struct ValidatedMasterTemplate {
    name: String,
    product_group: String,
    product_group_label: String,
    description: String,
    template_payload: Map<String, Value>,
    content_sha256: String,
    supplied_version: i64,
}

fn optional_input_text(
    input: &Map<String, Value>,
    key: &str,
    max: usize,
) -> Result<String, DataError> {
    let value = input
        .get(key)
        .and_then(Value::as_str)
        .unwrap_or_default()
        .trim();
    if value.len() > max || value.chars().any(|character| character.is_control()) {
        return Err(DataError::Validation(format!("{key} alanı geçersiz")));
    }
    Ok(value.to_string())
}

fn master_template_payload(input: &Value) -> Result<ValidatedMasterTemplate, DataError> {
    validate_payload_size(input)?;
    let input = input
        .as_object()
        .ok_or_else(|| DataError::Validation("ana şablon kayıt nesnesi gerekli".into()))?;
    let name = value_string(input, "name", 160)?;
    let product_group = value_string(input, "productGroup", 100)?;
    let product_group_label = value_string(input, "productGroupLabel", 160)?;
    let description = optional_input_text(input, "description", 500)?;
    let schema_version = value_string(input, "schemaVersion", 30)?;
    if schema_version != MASTER_TEMPLATE_SCHEMA_VERSION {
        return Err(DataError::Validation(format!(
            "desteklenmeyen ana şablon şeması: {schema_version}"
        )));
    }
    let supplied_version = input
        .get("version")
        .and_then(Value::as_i64)
        .unwrap_or_default();
    let template_payload = input
        .get("templatePayload")
        .and_then(Value::as_object)
        .cloned()
        .ok_or_else(|| DataError::Validation("ana şablon snapshot omurgası eksik".into()))?;
    if template_payload
        .get("schemaVersion")
        .and_then(Value::as_str)
        != Some(MASTER_TEMPLATE_SCHEMA_VERSION)
        || template_payload.get("kind").and_then(Value::as_str) != Some(MASTER_TEMPLATE_KIND)
    {
        return Err(DataError::Validation(
            "ana şablon türü veya şema sürümü eşleşmiyor".into(),
        ));
    }
    if template_payload.get("name").and_then(Value::as_str) != Some(name.as_str())
        || template_payload.get("productGroup").and_then(Value::as_str)
            != Some(product_group.as_str())
        || template_payload
            .get("productGroupLabel")
            .and_then(Value::as_str)
            != Some(product_group_label.as_str())
    {
        return Err(DataError::Validation(
            "ana şablon üst bilgileri ile içerik eşleşmiyor".into(),
        ));
    }

    let snapshot = template_payload
        .get("snapshot")
        .and_then(Value::as_object)
        .ok_or_else(|| DataError::Validation("ana şablon snapshot verisi eksik".into()))?;
    for volatile in ["snapshotId", "generatedAt", "projectId", "sha256"] {
        if snapshot.contains_key(volatile) {
            return Err(DataError::Validation(format!(
                "ana şablon değişken proje alanı içeremez: {volatile}"
            )));
        }
    }
    let product = snapshot
        .get("product")
        .and_then(Value::as_object)
        .ok_or_else(|| DataError::Validation("şablon ürün sınıflandırması eksik".into()))?;
    if product.get("productGroup").and_then(Value::as_str) != Some(product_group.as_str()) {
        return Err(DataError::Validation(
            "şablon ürün grubu ile snapshot ürün grubu eşleşmiyor".into(),
        ));
    }
    for field in MASTER_TEMPLATE_REQUIRED_IDENTITY {
        if product
            .get(field)
            .and_then(Value::as_str)
            .unwrap_or_default()
            .trim()
            .is_empty()
        {
            continue;
        }
        return Err(DataError::Validation(format!(
            "ana şablonda yeni ürüne ait {field} alanı boş bırakılmalıdır"
        )));
    }
    let required_contract = template_payload
        .get("identityContract")
        .and_then(Value::as_object)
        .and_then(|contract| contract.get("requiredFields"))
        .and_then(Value::as_array)
        .ok_or_else(|| DataError::Validation("ana şablon kimlik sözleşmesi eksik".into()))?;
    let required_contract = required_contract
        .iter()
        .filter_map(Value::as_str)
        .collect::<HashSet<_>>();
    if MASTER_TEMPLATE_REQUIRED_IDENTITY
        .iter()
        .any(|field| !required_contract.contains(field))
    {
        return Err(DataError::Validation(
            "ana şablon kimlik sözleşmesi zorunlu alanları kapsamıyor".into(),
        ));
    }

    let route = snapshot
        .get("route")
        .and_then(Value::as_array)
        .ok_or_else(|| DataError::Validation("ana şablon proses rotası eksik".into()))?;
    if route.is_empty()
        || route.iter().any(|step| {
            step.get("operationCode")
                .and_then(Value::as_str)
                .unwrap_or_default()
                .trim()
                .is_empty()
        })
    {
        return Err(DataError::Validation(
            "ana şablondaki her proses adımı standart operasyon koduna bağlı olmalıdır".into(),
        ));
    }
    if snapshot
        .get("characteristics")
        .and_then(Value::as_array)
        .map(Vec::is_empty)
        .unwrap_or(true)
    {
        return Err(DataError::Validation(
            "ana şablon en az bir kontrol planı karakteristiği içermelidir".into(),
        ));
    }
    if snapshot
        .get("pfmea")
        .and_then(Value::as_array)
        .map(Vec::is_empty)
        .unwrap_or(true)
    {
        return Err(DataError::Validation(
            "ana şablon en az bir PFMEA risk satırı içermelidir".into(),
        ));
    }
    if snapshot
        .get("ppap")
        .and_then(Value::as_object)
        .and_then(|ppap| ppap.get("generatedDocuments"))
        .and_then(Value::as_array)
        .map(|documents| !documents.is_empty())
        .unwrap_or(false)
    {
        return Err(DataError::Validation(
            "üretilmiş doküman kayıtları ana şablona kopyalanamaz".into(),
        ));
    }

    let canonical = canonical_json(&Value::Object(template_payload.clone()))?;
    let content_sha256 = format!("{:x}", Sha256::digest(canonical.as_bytes()));
    Ok(ValidatedMasterTemplate {
        name,
        product_group,
        product_group_label,
        description,
        template_payload,
        content_sha256,
        supplied_version,
    })
}

fn master_template_record_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<Value> {
    let text: String = row.get(9)?;
    serde_json::from_str(&text).map_err(|error| {
        rusqlite::Error::FromSqlConversionFailure(9, rusqlite::types::Type::Text, Box::new(error))
    })
}

#[tauri::command]
pub(crate) fn master_template_list(
    app: tauri::AppHandle,
    window: tauri::WebviewWindow,
    product_group: Option<String>,
) -> Result<Value, DataError> {
    ensure_main_window(&app, &window)?;
    let product_group = product_group.unwrap_or_default().trim().to_string();
    if product_group.len() > 100
        || product_group
            .chars()
            .any(|character| character.is_control())
    {
        return Err(DataError::Validation("ürün grubu filtresi geçersiz".into()));
    }
    let _guard = data_lock()
        .lock()
        .map_err(|_| DataError::Database("veri kilidi kullanılamıyor".into()))?;
    let connection = open_database(&app)?;
    let query = if product_group.is_empty() {
        "SELECT id,name,product_group,product_group_label,description,schema_version,status,version,content_sha256,created_at,updated_at FROM master_templates WHERE status='active' ORDER BY product_group_label,name"
    } else {
        "SELECT id,name,product_group,product_group_label,description,schema_version,status,version,content_sha256,created_at,updated_at FROM master_templates WHERE status='active' AND product_group=? ORDER BY name"
    };
    let mut statement = connection.prepare(query)?;
    let mapper = |row: &rusqlite::Row<'_>| {
        Ok(json!({
            "id": row.get::<_, String>(0)?, "name": row.get::<_, String>(1)?,
            "productGroup": row.get::<_, String>(2)?, "productGroupLabel": row.get::<_, String>(3)?,
            "description": row.get::<_, String>(4)?, "schemaVersion": row.get::<_, String>(5)?,
            "status": row.get::<_, String>(6)?, "version": row.get::<_, i64>(7)?,
            "contentSha256": row.get::<_, String>(8)?, "createdAt": row.get::<_, String>(9)?,
            "updatedAt": row.get::<_, String>(10)?
        }))
    };
    let rows = if product_group.is_empty() {
        statement.query_map([], mapper)?
    } else {
        statement.query_map([product_group], mapper)?
    };
    let templates = rows.collect::<Result<Vec<_>, _>>()?;
    Ok(json!({ "templates": templates }))
}

#[tauri::command]
pub(crate) fn master_template_get(
    app: tauri::AppHandle,
    window: tauri::WebviewWindow,
    id: String,
) -> Result<Value, DataError> {
    ensure_main_window(&app, &window)?;
    if id.trim().is_empty() || id.len() > 120 || id.chars().any(|character| character.is_control())
    {
        return Err(DataError::Validation("ana şablon kimliği geçersiz".into()));
    }
    let _guard = data_lock()
        .lock()
        .map_err(|_| DataError::Database("veri kilidi kullanılamıyor".into()))?;
    let connection = open_database(&app)?;
    let template = connection
        .query_row(
            "SELECT id,name,product_group,product_group_label,description,schema_version,status,version,content_sha256,payload,created_at,updated_at FROM master_templates WHERE id=? AND status='active'",
            [id],
            master_template_record_from_row,
        )
        .optional()?;
    Ok(json!({ "template": template }))
}

#[tauri::command]
pub(crate) fn master_template_save(
    app: tauri::AppHandle,
    window: tauri::WebviewWindow,
    id: Option<String>,
    payload: Value,
) -> Result<Value, DataError> {
    ensure_main_window(&app, &window)?;
    let validated = master_template_payload(&payload)?;
    let _guard = data_lock()
        .lock()
        .map_err(|_| DataError::Database("veri kilidi kullanılamıyor".into()))?;
    let mut connection = open_database(&app)?;
    let transaction = connection.transaction_with_behavior(TransactionBehavior::Immediate)?;
    let template_id = id.unwrap_or_else(|| Uuid::new_v4().to_string());
    let existing: Option<(i64, String, String)> = transaction
        .query_row(
            "SELECT version,created_at,status FROM master_templates WHERE id=?",
            [&template_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .optional()?;
    if let Some((current, _, status)) = existing.as_ref() {
        if status != "active" {
            return Err(DataError::Validation(
                "arşivlenmiş ana şablon doğrudan değiştirilemez".into(),
            ));
        }
        if validated.supplied_version != *current {
            return Err(DataError::Validation(format!(
                "ana şablon başka bir oturumda değiştirildi; güncel sürüm v{current}"
            )));
        }
    }
    let version = existing.as_ref().map(|row| row.0 + 1).unwrap_or(1);
    let timestamp = now();
    let created_at = existing
        .as_ref()
        .map(|row| row.1.clone())
        .unwrap_or_else(|| timestamp.clone());
    let record = json!({
        "id": template_id, "name": validated.name, "productGroup": validated.product_group,
        "productGroupLabel": validated.product_group_label, "description": validated.description,
        "schemaVersion": MASTER_TEMPLATE_SCHEMA_VERSION, "status": "active", "version": version,
        "contentSha256": validated.content_sha256, "payload": Value::Object(validated.template_payload),
        "createdAt": created_at, "updatedAt": timestamp
    });
    let text = record.to_string();
    let result = if let Some((current, _, _)) = existing.as_ref() {
        transaction.execute(
            "UPDATE master_templates SET name=?,product_group=?,product_group_label=?,description=?,schema_version=?,status='active',version=?,content_sha256=?,payload=?,updated_at=? WHERE id=? AND version=?",
            params![record["name"].as_str(), record["productGroup"].as_str(), record["productGroupLabel"].as_str(), record["description"].as_str(), MASTER_TEMPLATE_SCHEMA_VERSION, version, record["contentSha256"].as_str(), text, timestamp, template_id, current],
        )
    } else {
        transaction.execute(
            "INSERT INTO master_templates (id,name,product_group,product_group_label,description,schema_version,status,version,content_sha256,payload,created_at,updated_at) VALUES (?,?,?,?,?,?,'active',?,?,?,?,?)",
            params![template_id, record["name"].as_str(), record["productGroup"].as_str(), record["productGroupLabel"].as_str(), record["description"].as_str(), MASTER_TEMPLATE_SCHEMA_VERSION, version, record["contentSha256"].as_str(), text, created_at, timestamp],
        )
    };
    let affected = match result {
        Ok(value) => value,
        Err(error) if unique_conflict(&error) => {
            return Err(DataError::Validation(
                "bu ürün grubunda aynı adlı etkin ana şablon zaten var".into(),
            ))
        }
        Err(error) => return Err(error.into()),
    };
    if existing.is_some() && affected != 1 {
        return Err(DataError::Validation(
            "ana şablon başka bir oturumda değiştirildi; listeyi yenileyin".into(),
        ));
    }
    transaction.execute(
        "INSERT INTO master_template_revisions (template_id,version,action,content_sha256,payload,created_at) VALUES (?,?,?,?,?,?)",
        params![template_id, version, if existing.is_some() { "updated" } else { "created" }, record["contentSha256"].as_str(), text, timestamp],
    )?;
    audit(
        &transaction,
        "master_template",
        &template_id,
        if existing.is_some() {
            "updated"
        } else {
            "created"
        },
        json!({ "version": version, "productGroup": record["productGroup"], "contentSha256": record["contentSha256"] }),
    )?;
    transaction.commit()?;
    Ok(json!({ "template": record }))
}

#[tauri::command]
pub(crate) fn master_template_archive(
    app: tauri::AppHandle,
    window: tauri::WebviewWindow,
    id: String,
    version: i64,
) -> Result<Value, DataError> {
    ensure_main_window(&app, &window)?;
    let _guard = data_lock()
        .lock()
        .map_err(|_| DataError::Database("veri kilidi kullanılamıyor".into()))?;
    let mut connection = open_database(&app)?;
    let transaction = connection.transaction_with_behavior(TransactionBehavior::Immediate)?;
    let existing: Option<(i64, String)> = transaction
        .query_row(
            "SELECT version,payload FROM master_templates WHERE id=? AND status='active'",
            [&id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .optional()?;
    let Some((current, text)) = existing else {
        return Err(DataError::Validation("etkin ana şablon bulunamadı".into()));
    };
    if version != current {
        return Err(DataError::Validation(format!(
            "ana şablon başka bir oturumda değiştirildi; güncel sürüm v{current}"
        )));
    }
    let mut record = parse_payload(text)?;
    let next_version = current + 1;
    let timestamp = now();
    record["status"] = Value::String("archived".into());
    record["version"] = Value::from(next_version);
    record["updatedAt"] = Value::String(timestamp.clone());
    let archived_text = record.to_string();
    let affected = transaction.execute(
        "UPDATE master_templates SET status='archived',version=?,payload=?,updated_at=? WHERE id=? AND version=? AND status='active'",
        params![next_version, archived_text, timestamp, id, current],
    )?;
    if affected != 1 {
        return Err(DataError::Validation(
            "ana şablon arşivlenemedi; listeyi yenileyin".into(),
        ));
    }
    transaction.execute(
        "INSERT INTO master_template_revisions (template_id,version,action,content_sha256,payload,created_at) VALUES (?,?,?,?,?,?)",
        params![id, next_version, "archived", record["contentSha256"].as_str().unwrap_or_default(), archived_text, timestamp],
    )?;
    audit(
        &transaction,
        "master_template",
        &id,
        "archived",
        json!({ "version": next_version }),
    )?;
    transaction.commit()?;
    Ok(json!({ "ok": true, "version": next_version }))
}

#[tauri::command]
pub(crate) fn user_me(
    app: tauri::AppHandle,
    window: tauri::WebviewWindow,
) -> Result<Value, DataError> {
    ensure_main_window(&app, &window)?;
    let _guard = data_lock()
        .lock()
        .map_err(|_| DataError::Database("veri kilidi kullanılamıyor".into()))?;
    let connection = open_database(&app)?;
    let text: String = connection
        .query_row(
            "SELECT payload FROM users WHERE id='user-eren'",
            [],
            |row| row.get(0),
        )
        .map_err(DataError::from)?;
    let user = parse_payload(text)?;
    Ok(json!({
        "identity": {
            "email": user.get("email").and_then(Value::as_str).unwrap_or("eren@tyana.local"),
            "displayName": user.get("displayName").and_then(Value::as_str).unwrap_or("Eren"),
            "source": "windows-profile-owner"
        },
        "user": user,
        "bootstrapProfile": false
    }))
}

#[tauri::command]
pub(crate) fn user_list(
    app: tauri::AppHandle,
    window: tauri::WebviewWindow,
) -> Result<Value, DataError> {
    ensure_main_window(&app, &window)?;
    let _guard = data_lock()
        .lock()
        .map_err(|_| DataError::Database("veri kilidi kullanılamıyor".into()))?;
    let connection = open_database(&app)?;
    let mut statement =
        connection.prepare("SELECT payload FROM users ORDER BY status ASC, display_name ASC")?;
    let rows = statement.query_map([], |row| row.get::<_, String>(0))?;
    let mut users = Vec::new();
    for row in rows {
        users.push(parse_payload(row?)?);
    }
    Ok(json!({ "users": users }))
}

fn validate_user(
    input: &Map<String, Value>,
) -> Result<(String, String, String, String), DataError> {
    let email = value_string(input, "email", 254)?.to_lowercase();
    if !email.contains('@') || email.starts_with('@') || email.ends_with('@') {
        return Err(DataError::Validation("geçerli e-posta gerekli".into()));
    }
    let display_name = value_string(input, "displayName", 100)?;
    let role = value_string(input, "role", 40)?;
    let status = value_string(input, "status", 20)?;
    if ![
        "admin",
        "quality_manager",
        "quality_engineer",
        "process_engineer",
        "approver",
        "operator",
        "viewer",
    ]
    .contains(&role.as_str())
    {
        return Err(DataError::Validation("rol geçersiz".into()));
    }
    if !["active", "inactive", "invited"].contains(&status.as_str()) {
        return Err(DataError::Validation("durum geçersiz".into()));
    }
    value_string(input, "plant", 120)?;
    value_string(input, "department", 120)?;
    Ok((email, display_name, role, status))
}

#[tauri::command]
pub(crate) fn user_save(
    app: tauri::AppHandle,
    window: tauri::WebviewWindow,
    id: Option<String>,
    payload: Value,
) -> Result<Value, DataError> {
    ensure_main_window(&app, &window)?;
    validate_payload_size(&payload)?;
    let mut user = payload
        .as_object()
        .cloned()
        .ok_or_else(|| DataError::Validation("kullanıcı nesnesi gerekli".into()))?;
    let (email, display_name, role, status) = validate_user(&user)?;
    let _guard = data_lock()
        .lock()
        .map_err(|_| DataError::Database("veri kilidi kullanılamıyor".into()))?;
    let mut connection = open_database(&app)?;
    let transaction = connection.transaction_with_behavior(TransactionBehavior::Immediate)?;
    let timestamp = now();
    let user_id = id.unwrap_or_else(|| Uuid::new_v4().to_string());
    if user_id == "user-eren" && (role != "admin" || status != "active") {
        return Err(DataError::Validation(
            "yerel kurulum sahibi Eren aktif yönetici olarak korunmalıdır".into(),
        ));
    }
    let existing: Option<(i64, String)> = transaction
        .query_row(
            "SELECT version,created_at FROM users WHERE id=?",
            [&user_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .optional()?;
    if let Some((current, _)) = existing.as_ref() {
        let supplied = user
            .get("version")
            .and_then(Value::as_i64)
            .unwrap_or_default();
        if supplied != *current {
            return Err(DataError::Validation(format!(
                "kullanıcı başka bir oturumda değiştirildi; güncel sürüm v{current}"
            )));
        }
    }
    let version = existing.as_ref().map(|row| row.0 + 1).unwrap_or(1);
    let created_at = existing
        .as_ref()
        .map(|row| row.1.clone())
        .unwrap_or_else(|| timestamp.clone());
    if existing.is_some() {
        let current: Option<(String, String)> = transaction
            .query_row(
                "SELECT role,status FROM users WHERE id=?",
                [&user_id],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .optional()?;
        if matches!(current.as_ref(), Some((current_role, current_status)) if current_role == "admin" && current_status == "active")
            && (role != "admin" || status != "active")
        {
            let active_admins: i64 = transaction.query_row(
                "SELECT COUNT(*) FROM users WHERE role='admin' AND status='active'",
                [],
                |row| row.get(0),
            )?;
            if active_admins <= 1 {
                return Err(DataError::Validation(
                    "son aktif yöneticinin rolü veya durumu değiştirilemez".into(),
                ));
            }
        }
    }
    user.insert("id".into(), Value::String(user_id.clone()));
    user.insert("email".into(), Value::String(email.clone()));
    user.insert("displayName".into(), Value::String(display_name.clone()));
    user.insert("role".into(), Value::String(role.clone()));
    user.insert("status".into(), Value::String(status.clone()));
    user.insert("version".into(), Value::from(version));
    user.insert("createdAt".into(), Value::String(created_at.clone()));
    user.insert("updatedAt".into(), Value::String(timestamp.clone()));
    let text = Value::Object(user.clone()).to_string();
    let result = if let Some((current, _)) = existing.as_ref() {
        transaction.execute("UPDATE users SET email=?,display_name=?,role=?,status=?,version=?,payload=?,updated_at=? WHERE id=? AND version=?", params![email,display_name,role,status,version,text,timestamp,user_id,current])
    } else {
        transaction.execute("INSERT INTO users (id,email,display_name,role,status,version,payload,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)", params![user_id,email,display_name,role,status,version,text,created_at,timestamp])
    };
    let affected = match result {
        Ok(affected) => affected,
        Err(error) => {
            return Err(if unique_conflict(&error) {
                DataError::Validation("e-posta zaten kayıtlı".into())
            } else {
                error.into()
            });
        }
    };
    if existing.is_some() && affected != 1 {
        return Err(DataError::Validation(
            "kullanıcı başka bir oturumda değiştirildi; kaydı yenileyin".into(),
        ));
    }
    audit(
        &transaction,
        "user",
        &user_id,
        if existing.is_some() {
            "updated"
        } else {
            "created"
        },
        json!({"version":version,"role":role}),
    )?;
    transaction.commit()?;
    Ok(json!({ "user": Value::Object(user) }))
}

#[tauri::command]
pub(crate) fn user_deactivate(
    app: tauri::AppHandle,
    window: tauri::WebviewWindow,
    id: String,
    version: i64,
) -> Result<Value, DataError> {
    ensure_main_window(&app, &window)?;
    if id == "user-eren" {
        return Err(DataError::Validation(
            "yerel kurulum sahibi Eren pasife alınamaz".into(),
        ));
    }
    let _guard = data_lock()
        .lock()
        .map_err(|_| DataError::Database("veri kilidi kullanılamıyor".into()))?;
    let mut connection = open_database(&app)?;
    let transaction = connection.transaction_with_behavior(TransactionBehavior::Immediate)?;
    let text: Option<String> = transaction
        .query_row(
            "SELECT payload FROM users WHERE id=? AND version=?",
            params![id, version],
            |row| row.get(0),
        )
        .optional()?;
    let Some(text) = text else {
        return Err(DataError::Validation(
            "kullanıcı sürümü güncel değil".into(),
        ));
    };
    let mut user = parse_payload(text)?;
    if user["role"] == "admin" && user["status"] == "active" {
        let count: i64 = transaction.query_row(
            "SELECT COUNT(*) FROM users WHERE role='admin' AND status='active'",
            [],
            |row| row.get(0),
        )?;
        if count <= 1 {
            return Err(DataError::Validation(
                "son aktif yönetici pasife alınamaz".into(),
            ));
        }
    }
    user["status"] = Value::String("inactive".into());
    user["version"] = Value::from(version + 1);
    let timestamp = now();
    user["updatedAt"] = Value::String(timestamp.clone());
    let affected = transaction.execute(
        "UPDATE users SET status='inactive',version=?,payload=?,updated_at=? WHERE id=? AND version=?",
        params![version + 1, user.to_string(), timestamp, id, version],
    )?;
    if affected != 1 {
        return Err(DataError::Validation(
            "kullanıcı başka bir oturumda değiştirildi; kaydı yenileyin".into(),
        ));
    }
    audit(
        &transaction,
        "user",
        &id,
        "deactivated",
        json!({"version":version+1}),
    )?;
    transaction.commit()?;
    Ok(json!({ "user": user }))
}

fn drawing_extension(value: &str) -> Option<&'static str> {
    match value.trim().to_ascii_lowercase().as_str() {
        "pdf" => Some("pdf"),
        "png" => Some("png"),
        "jpg" | "jpeg" => Some("jpg"),
        _ => None,
    }
}

fn valid_drawing(bytes: &[u8], extension: &str) -> bool {
    match extension {
        "pdf" => {
            bytes.starts_with(b"%PDF-")
                && bytes[bytes.len().saturating_sub(2048)..]
                    .windows(5)
                    .any(|window| window == b"%%EOF")
        }
        "png" => bytes.starts_with(b"\x89PNG\r\n\x1a\n"),
        "jpg" => bytes.starts_with(b"\xff\xd8\xff") && bytes.ends_with(b"\xff\xd9"),
        _ => false,
    }
}

fn stored_drawing_matches(
    stored: &[u8],
    expected_bytes: usize,
    expected_sha: &str,
    extension: &str,
) -> bool {
    stored.len() == expected_bytes
        && valid_drawing(stored, extension)
        && format!("{:x}", Sha256::digest(stored)) == expected_sha
}

fn atomic_write(path: &Path, bytes: &[u8]) -> Result<(), DataError> {
    let parent = path
        .parent()
        .ok_or_else(|| DataError::Io("hedef klasör yok".into()))?;
    fs::create_dir_all(parent)?;
    let temporary = parent.join(format!(".tyana-{}.tmp", Uuid::new_v4()));
    let result = (|| -> Result<(), std::io::Error> {
        let mut file = OpenOptions::new()
            .create_new(true)
            .write(true)
            .open(&temporary)?;
        file.write_all(bytes)?;
        file.flush()?;
        file.sync_all()?;
        if path.exists() {
            fs::remove_file(path)?;
        }
        fs::rename(&temporary, path)?;
        Ok(())
    })();
    if result.is_err() {
        let _ = fs::remove_file(&temporary);
    }
    result.map_err(DataError::from)
}

#[tauri::command]
pub(crate) fn drawing_store(
    app: tauri::AppHandle,
    window: tauri::WebviewWindow,
    request: Request<'_>,
) -> Result<Value, DataError> {
    ensure_main_window(&app, &window)?;
    let sha = request
        .headers()
        .get("x-tyana-sha256")
        .and_then(|v| v.to_str().ok())
        .filter(|v| v.len() == 64 && v.chars().all(|c| c.is_ascii_hexdigit()))
        .ok_or(DataError::InvalidDrawing)?
        .to_ascii_lowercase();
    let extension = request
        .headers()
        .get("x-tyana-extension")
        .and_then(|v| v.to_str().ok())
        .and_then(drawing_extension)
        .ok_or(DataError::InvalidDrawing)?;
    let InvokeBody::Raw(bytes) = request.body() else {
        return Err(DataError::InvalidDrawing);
    };
    if bytes.is_empty() || bytes.len() > MAX_DRAWING_BYTES || !valid_drawing(bytes, extension) {
        return Err(DataError::InvalidDrawing);
    }
    let calculated = format!("{:x}", Sha256::digest(bytes));
    if calculated != sha {
        return Err(DataError::InvalidDrawing);
    }
    let _guard = data_lock()
        .lock()
        .map_err(|_| DataError::Database("veri kilidi kullanılamıyor".into()))?;
    let root = app_data_root(&app)?;
    let relative = format!("drawings/{sha}.{extension}");
    let path = root.join(&relative);
    if path.exists() {
        let stored = fs::read(&path)?;
        if !stored_drawing_matches(&stored, bytes.len(), &sha, extension) {
            return Err(DataError::InvalidDrawing);
        }
    } else {
        atomic_write(&path, bytes)?;
    }
    let mut connection = open_database(&app)?;
    let transaction = connection.transaction_with_behavior(TransactionBehavior::Immediate)?;
    let asset_id = format!("drawing-{sha}");
    transaction.execute("INSERT OR IGNORE INTO drawing_assets (id,sha256,extension,bytes,relative_path,created_at) VALUES (?,?,?,?,?,?)", params![asset_id,sha,extension,bytes.len() as i64,relative,now()])?;
    audit(
        &transaction,
        "drawing",
        &asset_id,
        "stored",
        json!({"sha256":sha,"extension":extension,"bytes":bytes.len()}),
    )?;
    transaction.commit()?;
    Ok(
        json!({ "storageId": asset_id, "sha256": sha, "extension": extension, "bytesStored": bytes.len() }),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    fn component(id: &str, parent_id: &str, position: &str) -> Value {
        json!({
            "id": id,
            "parentId": parent_id,
            "position": position,
            "itemNo": format!("PN-{id}"),
            "name": format!("Bileşen {id}"),
            "quantity": 1
        })
    }

    fn snapshot_with(components: Vec<Value>, route: Vec<Value>) -> Map<String, Value> {
        json!({ "components": components, "route": route })
            .as_object()
            .cloned()
            .expect("snapshot object")
    }

    fn master_template_request() -> Value {
        let required = MASTER_TEMPLATE_REQUIRED_IDENTITY.to_vec();
        json!({
            "name": "Direksiyon Mamul Ana Omurgası",
            "description": "Kontrollü ürün grubu şablonu",
            "productGroup": "steering",
            "productGroupLabel": "Direksiyon Sistemleri",
            "schemaVersion": MASTER_TEMPLATE_SCHEMA_VERSION,
            "version": 0,
            "templatePayload": {
                "schemaVersion": MASTER_TEMPLATE_SCHEMA_VERSION,
                "kind": MASTER_TEMPLATE_KIND,
                "name": "Direksiyon Mamul Ana Omurgası",
                "description": "Kontrollü ürün grubu şablonu",
                "productGroup": "steering",
                "productGroupLabel": "Direksiyon Sistemleri",
                "identityContract": { "requiredFields": required },
                "snapshot": {
                    "schemaVersion": "4.0.0",
                    "product": {
                        "productGroup": "steering", "productGroupLabel": "Direksiyon Sistemleri",
                        "partName": "", "partNumber": "", "internalProductCode": "", "customer": "",
                        "projectCode": "", "controlPlanNumber": "", "drawingNumber": "",
                        "drawingRevision": "", "productionPhase": ""
                    },
                    "route": [{ "operationNo": "10", "operationCode": "0010", "processId": "incoming" }],
                    "characteristics": [{ "id": "CC-1", "name": "Çap" }],
                    "pfmea": [{ "id": "PF-1", "failureMode": "Ölçü dışı" }],
                    "ppap": { "generatedDocuments": [] }
                }
            }
        })
    }

    #[test]
    fn schema_seed_and_audit_chain_are_consistent() {
        let mut connection = Connection::open_in_memory().expect("in-memory database");
        connection
            .execute_batch(DATABASE_SCHEMA)
            .expect("schema must initialize");
        seed_database(&mut connection).expect("seed must load");

        let process_count: i64 = connection
            .query_row("SELECT COUNT(*) FROM processes", [], |row| row.get(0))
            .expect("seeded process count");
        let expected_process_count = crate::embedded_assets::value("seed-processes")
            .expect("embedded seed json")
            .as_array()
            .expect("embedded seed array")
            .len() as i64;
        assert_eq!(process_count, expected_process_count);
        let active_admins: i64 = connection
            .query_row(
                "SELECT COUNT(*) FROM users WHERE role='admin' AND status='active'",
                [],
                |row| row.get(0),
            )
            .expect("active admin count");
        assert_eq!(active_admins, 1);
        let master_template_tables: i64 = connection
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name IN ('master_templates','master_template_revisions')",
                [],
                |row| row.get(0),
            )
            .expect("master template tables");
        assert_eq!(master_template_tables, 2);
        let machine_count: i64 = connection
            .query_row("SELECT COUNT(*) FROM machines", [], |row| row.get(0))
            .expect("seeded machine count");
        assert_eq!(machine_count, 77);
        let machine_type_count: i64 = connection
            .query_row(
                "SELECT COUNT(DISTINCT machine_type) FROM machines",
                [],
                |row| row.get(0),
            )
            .expect("machine type count");
        assert_eq!(machine_type_count, 5);
        let eligibility_count: i64 = connection
            .query_row(
                "SELECT COUNT(*) FROM operation_machine_eligibility",
                [],
                |row| row.get(0),
            )
            .expect("seeded operation-machine eligibility count");
        assert!(eligibility_count > 0);
        connection
            .execute("DELETE FROM machines WHERE machine_code='T1'", [])
            .expect("delete seeded machine");
        seed_database(&mut connection).expect("repeat seed must preserve user deletion");
        let deleted_machine_count: i64 = connection
            .query_row(
                "SELECT COUNT(*) FROM machines WHERE machine_code='T1'",
                [],
                |row| row.get(0),
            )
            .expect("deleted machine count");
        assert_eq!(deleted_machine_count, 0);

        let transaction = connection
            .transaction_with_behavior(TransactionBehavior::Immediate)
            .expect("audit transaction");
        audit(&transaction, "test", "one", "created", json!({"v": 1})).expect("first audit event");
        audit(&transaction, "test", "two", "created", json!({"v": 2})).expect("second audit event");
        transaction.commit().expect("audit commit");
        let linked: i64 = connection
            .query_row(
                "SELECT COUNT(*) FROM audit_events newer JOIN audit_events older ON newer.previous_hash = older.event_hash",
                [],
                |row| row.get(0),
            )
            .expect("audit link count");
        assert_eq!(linked, 1);
        let quick_check: String = connection
            .query_row("PRAGMA quick_check", [], |row| row.get(0))
            .expect("quick check");
        assert_eq!(quick_check, "ok");
    }

    #[test]
    fn master_template_contract_accepts_sanitized_structure_and_hashes_content() {
        let validated = master_template_payload(&master_template_request()).unwrap();
        assert_eq!(validated.product_group, "steering");
        assert_eq!(validated.supplied_version, 0);
        assert_eq!(validated.content_sha256.len(), 64);
        assert_eq!(
            validated.template_payload["snapshot"]["route"][0]["operationCode"],
            "0010"
        );
    }

    #[test]
    fn master_template_contract_rejects_leaked_identity_and_generated_documents() {
        let mut identity = master_template_request();
        identity["templatePayload"]["snapshot"]["product"]["partNumber"] =
            Value::String("OEM-OLD".into());
        assert!(master_template_payload(&identity).is_err());

        let mut generated = master_template_request();
        generated["templatePayload"]["snapshot"]["ppap"]["generatedDocuments"] =
            json!([{ "name": "old-control-plan.pdf" }]);
        assert!(master_template_payload(&generated).is_err());

        let mut uncoded = master_template_request();
        uncoded["templatePayload"]["snapshot"]["route"][0]["operationCode"] =
            Value::String(String::new());
        assert!(master_template_payload(&uncoded).is_err());
    }

    #[test]
    fn project_status_requires_authenticated_approval_for_release() {
        assert!(validate_project_status("Taslak").is_ok());
        assert!(validate_project_status("İncelemede").is_ok());
        assert!(validate_project_status("Onay Bekliyor").is_ok());
        assert!(validate_project_status("Yürürlükte").is_err());
        assert!(validate_project_status("approved").is_err());
    }

    #[test]
    fn old_bom_snapshot_is_normalized_without_requiring_new_optional_fields() {
        let mut snapshot = json!({
            "components": [{
                "id": "LEGACY-10", "position": "10", "itemNo": "OLD-010",
                "name": "Eski kayıt bileşeni", "quantity": "1,5"
            }]
        })
        .as_object()
        .cloned()
        .unwrap();

        validate_and_normalize_bom_snapshot(&mut snapshot, "Taslak").unwrap();

        let item = snapshot["components"][0].as_object().unwrap();
        assert_eq!(item["parentId"], FINISHED_GOOD_ID);
        assert_eq!(item["quantity"], 1.5);
        assert_eq!(item["critical"], false);
        assert_eq!(item["alternativeGroupId"], "");
        assert_eq!(item["alternativeSelected"], false);
        assert_eq!(item["operationLinkStatus"], "Henüz atanmadı");
        assert_eq!(snapshot["route"], json!([]));
    }

    #[test]
    fn bom_rejects_duplicate_ids_missing_parents_self_links_and_cycles() {
        let mut duplicate = snapshot_with(
            vec![
                component("SAME", FINISHED_GOOD_ID, "10"),
                component("SAME", FINISHED_GOOD_ID, "20"),
            ],
            vec![],
        );
        assert!(validate_and_normalize_bom_snapshot(&mut duplicate, "Taslak").is_err());

        let mut missing_parent =
            snapshot_with(vec![component("CHILD", "DOES-NOT-EXIST", "10")], vec![]);
        assert!(validate_and_normalize_bom_snapshot(&mut missing_parent, "Taslak").is_err());

        let mut self_link = snapshot_with(vec![component("SELF", "SELF", "10")], vec![]);
        assert!(validate_and_normalize_bom_snapshot(&mut self_link, "Taslak").is_err());

        let mut cycle = snapshot_with(
            vec![component("A", "B", "10"), component("B", "A", "20")],
            vec![],
        );
        assert!(validate_and_normalize_bom_snapshot(&mut cycle, "Taslak").is_err());
    }

    #[test]
    fn bom_positions_are_unique_per_parent_not_globally() {
        let mut valid = snapshot_with(
            vec![
                component("ASM-A", FINISHED_GOOD_ID, "10"),
                component("ASM-B", FINISHED_GOOD_ID, "20"),
                component("A-CHILD", "ASM-A", "10"),
                component("B-CHILD", "ASM-B", "10"),
            ],
            vec![],
        );
        assert!(validate_and_normalize_bom_snapshot(&mut valid, "Taslak").is_ok());

        let mut duplicate_sibling = snapshot_with(
            vec![
                component("A", FINISHED_GOOD_ID, "010"),
                component("B", FINISHED_GOOD_ID, "10"),
            ],
            vec![],
        );
        assert!(validate_and_normalize_bom_snapshot(&mut duplicate_sibling, "Taslak").is_err());
    }

    #[test]
    fn bom_rejects_missing_identity_nonpositive_quantity_and_purchased_without_supplier() {
        let mut missing_code = snapshot_with(
            vec![json!({
                "id": "NO-CODE", "position": "10", "itemNo": "", "name": "Parça", "quantity": 1
            })],
            vec![],
        );
        assert!(validate_and_normalize_bom_snapshot(&mut missing_code, "Taslak").is_err());

        let mut zero = snapshot_with(
            vec![json!({
                "id": "ZERO", "position": "10", "itemNo": "P-0", "name": "Parça", "quantity": 0
            })],
            vec![],
        );
        assert!(validate_and_normalize_bom_snapshot(&mut zero, "Taslak").is_err());

        let mut purchased = snapshot_with(
            vec![json!({
                "id": "BUY", "position": "10", "itemNo": "P-BUY", "name": "Satın alınan parça",
                "quantity": 1, "componentType": "Satın alınan parça", "makeBuy": "Satın al"
            })],
            vec![],
        );
        assert!(validate_and_normalize_bom_snapshot(&mut purchased, "Taslak").is_err());
    }

    #[test]
    fn alternative_group_requires_exactly_one_selected_sibling() {
        let mut first = component("BEARING-A", FINISHED_GOOD_ID, "10");
        first["alternativeGroupId"] = Value::String("BEARING".into());
        first["alternativeSelected"] = Value::Bool(true);
        let mut second = component("BEARING-B", FINISHED_GOOD_ID, "20");
        second["alternativeGroupId"] = Value::String("BEARING".into());
        second["alternativeSelected"] = Value::Bool(false);
        let mut valid = snapshot_with(vec![first.clone(), second.clone()], vec![]);
        assert!(validate_and_normalize_bom_snapshot(&mut valid, "Taslak").is_ok());

        second["alternativeSelected"] = Value::Bool(true);
        let mut two_selected = snapshot_with(vec![first, second], vec![]);
        assert!(validate_and_normalize_bom_snapshot(&mut two_selected, "Taslak").is_err());
    }

    #[test]
    fn post_paint_component_must_be_mapped_after_painting_when_route_exists() {
        let mut boot = component("BOOT", FINISHED_GOOD_ID, "10");
        boot["installationStage"] = Value::String("Boya sonrası montaj".into());
        boot["prerequisiteProcessId"] = Value::String("painting".into());
        boot["mountedAtProcessId"] = Value::String("assembly".into());
        boot["nextProcessId"] = Value::String("final".into());
        let painting = json!({ "routeKey": "paint-1", "processId": "painting", "operationNo": "100", "inputComponentIds": [], "outputItemId": "FINISHED_GOOD" });
        let assembly = json!({ "routeKey": "assembly-1", "processId": "assembly", "operationNo": "110", "inputComponentIds": ["BOOT"], "outputItemId": "FINISHED_GOOD" });
        let final_control = json!({ "routeKey": "final-1", "processId": "final", "operationNo": "120", "inputComponentIds": [], "outputItemId": "FINISHED_GOOD" });
        let mut valid = snapshot_with(
            vec![boot.clone()],
            vec![painting.clone(), assembly.clone(), final_control.clone()],
        );
        assert!(validate_and_normalize_bom_snapshot(&mut valid, "Taslak").is_ok());

        let mut wrong_order = snapshot_with(vec![boot], vec![assembly, painting, final_control]);
        assert!(validate_and_normalize_bom_snapshot(&mut wrong_order, "Taslak").is_err());
    }

    #[test]
    fn critical_component_mapping_is_required_at_release_gate() {
        let mut critical = component("CRITICAL", FINISHED_GOOD_ID, "10");
        critical["critical"] = Value::Bool(true);
        let mut draft = snapshot_with(vec![critical.clone()], vec![]);
        assert!(validate_and_normalize_bom_snapshot(&mut draft, "Taslak").is_ok());

        let mut review = snapshot_with(vec![critical.clone()], vec![]);
        assert!(validate_and_normalize_bom_snapshot(&mut review, "İncelemede").is_ok());

        let mut release = snapshot_with(vec![critical.clone()], vec![]);
        assert!(validate_and_normalize_bom_snapshot(&mut release, "Onay Bekliyor").is_err());

        let route = vec![json!({
            "routeKey": "assembly-1", "processId": "assembly", "operationNo": "100",
            "inputComponentIds": ["CRITICAL"], "outputItemId": "FINISHED_GOOD"
        })];
        let mut mapped = snapshot_with(vec![critical], route);
        validate_and_normalize_bom_snapshot(&mut mapped, "Onay Bekliyor").unwrap();
        assert_eq!(mapped["components"][0]["operationLinkStatus"], "Atandı");
    }

    #[test]
    fn canonical_snapshot_hash_excludes_old_digest_and_includes_backend_project_id() {
        let mut snapshot = snapshot_with(vec![], vec![]);
        snapshot.insert("sha256".into(), Value::String("forged".into()));
        let before_project_id = canonical_snapshot_sha256(&snapshot).unwrap();
        snapshot.insert("projectId".into(), Value::String("PROJECT-1".into()));
        let with_project_id = canonical_snapshot_sha256(&snapshot).unwrap();
        assert_ne!(before_project_id, with_project_id);
        snapshot.insert("sha256".into(), Value::String(with_project_id.clone()));
        assert_eq!(
            canonical_snapshot_sha256(&snapshot).unwrap(),
            with_project_id
        );

        let reordered = json!({
            "projectId": "PROJECT-1", "route": [], "components": [], "sha256": "ignored"
        })
        .as_object()
        .cloned()
        .unwrap();
        assert_eq!(
            canonical_snapshot_sha256(&reordered).unwrap(),
            with_project_id
        );
    }

    #[test]
    fn drawing_types_require_matching_signatures() {
        assert_eq!(drawing_extension("JPEG"), Some("jpg"));
        assert!(valid_drawing(b"%PDF-1.7\n%%EOF", "pdf"));
        assert!(valid_drawing(b"\x89PNG\r\n\x1a\nrest", "png"));
        assert!(valid_drawing(b"\xff\xd8\xffpayload\xff\xd9", "jpg"));
        assert!(!valid_drawing(b"MZ executable", "pdf"));
        assert!(!valid_drawing(b"\xff\xd8\xfftruncated", "jpg"));
    }

    #[test]
    fn stored_drawing_requires_matching_length_hash_and_signature() {
        let drawing = b"%PDF-1.7\n%%EOF";
        let sha = format!("{:x}", Sha256::digest(drawing));

        assert!(stored_drawing_matches(drawing, drawing.len(), &sha, "pdf"));
        assert!(!stored_drawing_matches(
            drawing,
            drawing.len() + 1,
            &sha,
            "pdf"
        ));
        assert!(!stored_drawing_matches(
            b"%PDF-1.6\n%%EOF",
            drawing.len(),
            &sha,
            "pdf"
        ));
        assert!(!stored_drawing_matches(drawing, drawing.len(), &sha, "png"));
    }

    #[test]
    fn corrupt_project_payload_is_reported() {
        let connection = Connection::open_in_memory().expect("in-memory database");
        connection
            .execute_batch(DATABASE_SCHEMA)
            .expect("schema must initialize");
        connection
            .execute(
                "INSERT INTO projects (id,project_code,part_number,part_name,product_group,revision,phase,status,version,payload,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
                params!["project-corrupt", "CP-1", "PN-1", "Parca", "Test", "A", "Seri", "Taslak", 1, "{not-json", "2026-01-01T00:00:00Z", "2026-01-01T00:00:00Z"],
            )
            .expect("corrupt fixture must insert");

        let result = connection.query_row(
            "SELECT id,project_code,part_number,part_name,product_group,revision,phase,status,version,payload,created_at,updated_at FROM projects WHERE id='project-corrupt'",
            [],
            project_from_row,
        );
        assert!(matches!(
            result,
            Err(rusqlite::Error::FromSqlConversionFailure(
                9,
                rusqlite::types::Type::Text,
                _
            ))
        ));
    }

    #[test]
    fn schema_initialization_preserves_existing_version_marker() {
        let connection = Connection::open_in_memory().expect("in-memory database");
        connection
            .execute_batch(DATABASE_SCHEMA)
            .expect("schema must initialize");
        connection
            .execute(
                "UPDATE app_meta SET value='future-version' WHERE key='schema_version'",
                [],
            )
            .expect("version marker must update");
        connection
            .execute_batch(DATABASE_SCHEMA)
            .expect("schema must be idempotent");

        let version: String = connection
            .query_row(
                "SELECT value FROM app_meta WHERE key='schema_version'",
                [],
                |row| row.get(0),
            )
            .expect("version marker must exist");
        assert_eq!(version, "future-version");
    }

    #[test]
    fn required_text_rejects_controls_and_oversized_values() {
        let valid = Map::from_iter([("code".into(), Value::String("PR-010".into()))]);
        assert_eq!(value_string(&valid, "code", 20).unwrap(), "PR-010");

        let control = Map::from_iter([("code".into(), Value::String("PR\n010".into()))]);
        assert!(value_string(&control, "code", 20).is_err());
        assert!(value_string(&valid, "code", 3).is_err());
    }
}
