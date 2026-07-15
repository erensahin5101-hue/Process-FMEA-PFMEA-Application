use chrono::{SecondsFormat, Utc};
use rusqlite::{params, Connection, OptionalExtension, Transaction, TransactionBehavior};
use serde::Serialize;
use serde_json::{json, Map, Value};
use sha2::{Digest, Sha256};
use std::{
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
INSERT OR IGNORE INTO app_meta (key, value) VALUES ('schema_version', '1');
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

fn ensure_main_window(window: &tauri::WebviewWindow) -> Result<(), DataError> {
    if window.label() == MAIN_WINDOW {
        Ok(())
    } else {
        Err(DataError::WrongWindow)
    }
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
    let seed: Value = serde_json::from_str(include_str!("../../seed-processes.json"))
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
    let eren = json!({
        "id": "user-eren", "email": "eren@tyana.local", "displayName": "Eren",
        "role": "admin", "status": "active", "plant": "TYANA OTOMOTİV",
        "department": "Kalite", "version": 1, "createdAt": seeded_at, "updatedAt": seeded_at
    });
    transaction.execute(
        "INSERT OR IGNORE INTO users (id, email, display_name, role, status, version, payload, created_at, updated_at) VALUES ('user-eren', 'eren@tyana.local', 'Eren', 'admin', 'active', 1, ?, ?, ?)",
        params![eren.to_string(), seeded_at, seeded_at],
    )?;
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

#[tauri::command]
pub(crate) fn process_list(
    app: tauri::AppHandle,
    window: tauri::WebviewWindow,
) -> Result<Value, DataError> {
    ensure_main_window(&window)?;
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

#[tauri::command]
pub(crate) fn process_save(
    app: tauri::AppHandle,
    window: tauri::WebviewWindow,
    id: Option<String>,
    payload: Value,
) -> Result<Value, DataError> {
    ensure_main_window(&window)?;
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
    ensure_main_window(&window)?;
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
    ensure_main_window(&window)?;
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
    ensure_main_window(&window)?;
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
    let mut snapshot = input
        .get("payload")
        .and_then(Value::as_object)
        .cloned()
        .ok_or_else(|| DataError::Validation("proje snapshot verisi eksik".into()))?;
    let _guard = data_lock()
        .lock()
        .map_err(|_| DataError::Database("veri kilidi kullanılamıyor".into()))?;
    let mut connection = open_database(&app)?;
    let transaction = connection.transaction_with_behavior(TransactionBehavior::Immediate)?;
    let timestamp = now();
    let project_id = id.unwrap_or_else(|| Uuid::new_v4().to_string());
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
    snapshot.insert("projectId".into(), Value::String(project_id.clone()));
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
        json!({"version": version, "revision": revision}),
    )?;
    transaction.commit()?;
    Ok(
        json!({ "project": { "id": project_id, "projectCode": project_code, "partNumber": part_number, "partName": part_name, "productGroup": product_group, "revision": revision, "phase": phase, "status": status, "version": version, "payload": Value::Object(snapshot), "createdAt": created_at, "updatedAt": timestamp } }),
    )
}

#[tauri::command]
pub(crate) fn user_me(
    app: tauri::AppHandle,
    window: tauri::WebviewWindow,
) -> Result<Value, DataError> {
    ensure_main_window(&window)?;
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
    ensure_main_window(&window)?;
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
    ensure_main_window(&window)?;
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
    ensure_main_window(&window)?;
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
    ensure_main_window(&window)?;
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
        assert!(process_count > 0);
        let active_admins: i64 = connection
            .query_row(
                "SELECT COUNT(*) FROM users WHERE role='admin' AND status='active'",
                [],
                |row| row.get(0),
            )
            .expect("active admin count");
        assert_eq!(active_admins, 1);

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
