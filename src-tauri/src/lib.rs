mod data;

use data::*;
use serde::Serialize;
use std::{
    collections::HashMap,
    fs::{self, OpenOptions},
    io::Write,
    path::PathBuf,
    sync::{Mutex, OnceLock},
    time::{Duration, Instant},
};
use tauri::ipc::{InvokeBody, Request};
use tauri_plugin_dialog::DialogExt;
use uuid::Uuid;

const MAIN_WINDOW: &str = "main";
const MAX_EXPORT_BYTES: usize = 64 * 1024 * 1024;
const TICKET_TTL: Duration = Duration::from_secs(120);
const MAX_PENDING_EXPORTS: usize = 8;

static PENDING_EXPORTS: OnceLock<Mutex<HashMap<String, PendingExport>>> = OnceLock::new();

#[derive(Clone, Copy, Debug)]
enum ExportKind {
    Pdf,
    Xlsx,
    Dxf,
}

impl ExportKind {
    fn parse(value: &str) -> Result<Self, ExportError> {
        match value.trim().to_ascii_lowercase().as_str() {
            "pdf" => Ok(Self::Pdf),
            "xlsx" => Ok(Self::Xlsx),
            "dxf" => Ok(Self::Dxf),
            _ => Err(ExportError::UnsupportedType),
        }
    }

    fn extension(self) -> &'static str {
        match self {
            Self::Pdf => "pdf",
            Self::Xlsx => "xlsx",
            Self::Dxf => "dxf",
        }
    }

    fn label(self) -> &'static str {
        match self {
            Self::Pdf => "PDF dokumani",
            Self::Xlsx => "Excel calisma kitabi",
            Self::Dxf => "DXF teknik cizimi",
        }
    }

    fn validate(self, bytes: &[u8]) -> bool {
        match self {
            Self::Pdf => {
                bytes.starts_with(b"%PDF-")
                    && bytes[bytes.len().saturating_sub(2048)..]
                        .windows(5)
                        .any(|window| window == b"%%EOF")
            }
            Self::Xlsx => {
                bytes.starts_with(b"PK\x03\x04")
                    && contains_bytes(bytes, b"[Content_Types].xml")
                    && contains_bytes(bytes, b"xl/workbook.xml")
            }
            Self::Dxf => {
                if bytes.iter().any(|byte| *byte == 0 || !byte.is_ascii()) {
                    return false;
                }
                let Ok(text) = std::str::from_utf8(bytes) else {
                    return false;
                };
                let normalized = text.replace("\r\n", "\n");
                normalized.trim_start().starts_with("0\nSECTION")
                    && normalized.trim_end().ends_with("EOF")
            }
        }
    }
}

#[derive(Debug)]
struct PendingExport {
    path: PathBuf,
    kind: ExportKind,
    expires_at: Instant,
}

#[derive(Debug, thiserror::Error)]
enum ExportError {
    #[error("Bu pencereden dosya kaydetmeye izin verilmiyor.")]
    WrongWindow,
    #[error("Yalnizca PDF, XLSX ve DXF ciktilari kaydedilebilir.")]
    UnsupportedType,
    #[error("Dosya adi gecersiz.")]
    InvalidFileName,
    #[error("Kaydetme oturumu gecersiz veya suresi dolmus.")]
    InvalidTicket,
    #[error("Cikti govdesi ham bayt biciminde olmali.")]
    RawBodyRequired,
    #[error("Bos bir cikti kaydedilemez.")]
    EmptyExport,
    #[error("Tek cikti boyutu 64 MB sinirini asiyor.")]
    ExportTooLarge,
    #[error("Cikti icerigi secilen dosya turuyle uyusmuyor.")]
    InvalidSignature,
    #[error("Yerel kaydetme durumu kullanilamiyor.")]
    StateUnavailable,
    #[error("Secilen dosya yolu kullanilamiyor.")]
    InvalidPath,
    #[error("Dosya yazilamadi: {0}")]
    Io(String),
}

impl Serialize for ExportError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(self.to_string().as_ref())
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SaveResult {
    file_name: String,
    export_type: String,
    bytes_written: usize,
}

fn pending_exports() -> &'static Mutex<HashMap<String, PendingExport>> {
    PENDING_EXPORTS.get_or_init(|| Mutex::new(HashMap::new()))
}

fn contains_bytes(haystack: &[u8], needle: &[u8]) -> bool {
    !needle.is_empty()
        && haystack
            .windows(needle.len())
            .any(|window| window == needle)
}

#[cfg(windows)]
fn replace_file(source: &std::path::Path, destination: &std::path::Path) -> std::io::Result<()> {
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
fn replace_file(source: &std::path::Path, destination: &std::path::Path) -> std::io::Result<()> {
    fs::rename(source, destination)
}

fn safe_file_name(input: &str, kind: ExportKind) -> Result<String, ExportError> {
    let extension = kind.extension();
    let lower = input.to_ascii_lowercase();
    let without_extension = lower
        .strip_suffix(&format!(".{extension}"))
        .map(|_| &input[..input.len() - extension.len() - 1])
        .unwrap_or(input);

    let mut stem: String = without_extension
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() || matches!(character, '.' | '_' | '-') {
                character
            } else {
                '_'
            }
        })
        .take(100)
        .collect();
    stem = stem
        .trim_matches(|character: char| character == '.' || character == ' ' || character == '_')
        .to_string();
    if stem.is_empty() {
        return Err(ExportError::InvalidFileName);
    }

    let reserved = stem.to_ascii_uppercase();
    let reserved = reserved.split('.').next().unwrap_or_default();
    if matches!(reserved, "CON" | "PRN" | "AUX" | "NUL")
        || (reserved.len() == 4
            && (reserved.starts_with("COM") || reserved.starts_with("LPT"))
            && reserved.as_bytes()[3].is_ascii_digit()
            && reserved.as_bytes()[3] != b'0')
    {
        stem = format!("TYANA_{stem}");
    }
    Ok(format!("{stem}.{extension}"))
}

fn ensure_main_window(window: &tauri::WebviewWindow) -> Result<(), ExportError> {
    if window.label() == MAIN_WINDOW {
        Ok(())
    } else {
        Err(ExportError::WrongWindow)
    }
}

fn purge_expired(entries: &mut HashMap<String, PendingExport>) {
    let now = Instant::now();
    entries.retain(|_, export| export.expires_at > now);
}

#[tauri::command]
async fn prepare_export(
    app: tauri::AppHandle,
    window: tauri::WebviewWindow,
    suggested_name: String,
    export_type: String,
) -> Result<Option<String>, ExportError> {
    ensure_main_window(&window)?;
    let kind = ExportKind::parse(&export_type)?;
    let file_name = safe_file_name(&suggested_name, kind)?;

    let selected = app
        .dialog()
        .file()
        .set_title("TYANA OTOMOTİV - Kontrollü çıktıyı kaydet")
        .set_file_name(&file_name)
        .add_filter(kind.label(), &[kind.extension()])
        .blocking_save_file();
    let Some(selected) = selected else {
        return Ok(None);
    };
    let mut path = selected.into_path().map_err(|_| ExportError::InvalidPath)?;
    if path
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| !value.eq_ignore_ascii_case(kind.extension()))
        .unwrap_or(true)
    {
        path.set_extension(kind.extension());
    }
    if path.file_name().is_none() || path.parent().is_none() {
        return Err(ExportError::InvalidPath);
    }

    let ticket = Uuid::new_v4().as_simple().to_string();
    let mut entries = pending_exports()
        .lock()
        .map_err(|_| ExportError::StateUnavailable)?;
    purge_expired(&mut entries);
    if entries.len() >= MAX_PENDING_EXPORTS {
        return Err(ExportError::StateUnavailable);
    }
    entries.insert(
        ticket.clone(),
        PendingExport {
            path,
            kind,
            expires_at: Instant::now() + TICKET_TTL,
        },
    );
    Ok(Some(ticket))
}

#[tauri::command]
fn write_export(
    window: tauri::WebviewWindow,
    request: Request<'_>,
) -> Result<SaveResult, ExportError> {
    ensure_main_window(&window)?;
    let ticket = request
        .headers()
        .get("x-tyana-export-ticket")
        .and_then(|value| value.to_str().ok())
        .filter(|value| {
            value.len() == 32 && value.chars().all(|character| character.is_ascii_hexdigit())
        })
        .ok_or(ExportError::InvalidTicket)?;
    let InvokeBody::Raw(bytes) = request.body() else {
        return Err(ExportError::RawBodyRequired);
    };
    if bytes.is_empty() {
        return Err(ExportError::EmptyExport);
    }
    if bytes.len() > MAX_EXPORT_BYTES {
        return Err(ExportError::ExportTooLarge);
    }

    let pending = {
        let mut entries = pending_exports()
            .lock()
            .map_err(|_| ExportError::StateUnavailable)?;
        purge_expired(&mut entries);
        entries.remove(ticket).ok_or(ExportError::InvalidTicket)?
    };
    if !pending.kind.validate(bytes) {
        return Err(ExportError::InvalidSignature);
    }

    let parent = pending.path.parent().ok_or(ExportError::InvalidPath)?;
    let temporary = parent.join(format!(".tyana-export-{}.tmp", Uuid::new_v4()));
    let write_result = (|| -> std::io::Result<()> {
        let mut file = OpenOptions::new()
            .create_new(true)
            .write(true)
            .open(&temporary)?;
        file.write_all(bytes)?;
        file.flush()?;
        file.sync_all()?;
        drop(file);
        replace_file(&temporary, &pending.path)
    })();
    if let Err(error) = write_result {
        let _ = fs::remove_file(&temporary);
        return Err(ExportError::Io(error.to_string()));
    }

    let file_name = pending
        .path
        .file_name()
        .and_then(|value| value.to_str())
        .ok_or(ExportError::InvalidPath)?
        .to_string();
    Ok(SaveResult {
        file_name,
        export_type: pending.kind.extension().to_string(),
        bytes_written: bytes.len(),
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            data::initialize(app.handle())?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            prepare_export,
            write_export,
            process_list,
            process_save,
            process_archive,
            project_latest,
            project_save,
            user_me,
            user_list,
            user_save,
            user_deactivate,
            drawing_store
        ])
        .run(tauri::generate_context!())
        .expect("TYANA OTOMOTİV masaüstü uygulaması başlatılamadı");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn file_names_are_limited_and_windows_reserved_names_are_prefixed() {
        assert_eq!(
            safe_file_name("CON.pdf", ExportKind::Pdf).unwrap(),
            "TYANA_CON.pdf"
        );
        assert_eq!(
            safe_file_name("CP-5101 Rev C.xlsx", ExportKind::Xlsx).unwrap(),
            "CP-5101_Rev_C.xlsx"
        );
    }

    #[test]
    fn export_signatures_accept_expected_document_shapes() {
        assert!(ExportKind::Pdf.validate(b"%PDF-1.7\n1 0 obj\n%%EOF\n"));
        assert!(ExportKind::Xlsx.validate(b"PK\x03\x04[Content_Types].xml xl/workbook.xml"));
        assert!(ExportKind::Dxf.validate(b"0\r\nSECTION\r\n0\r\nEOF\r\n"));
    }

    #[test]
    fn export_signatures_reject_mismatched_content() {
        assert!(!ExportKind::Pdf.validate(b"not a pdf"));
        assert!(!ExportKind::Xlsx.validate(b"PK\x03\x04generic zip"));
        assert!(!ExportKind::Dxf.validate(b"MZ\0binary"));
    }
}
