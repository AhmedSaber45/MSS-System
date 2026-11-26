use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Component, Path, PathBuf};

pub const FULL_BACKUP_FORMAT: &str = "as-full-backup-v1";
pub const FULL_BACKUP_FORMAT_VERSION: u32 = 1;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FullBackupFileEntry {
    pub relative_path: String,
    pub root_category: String,
    pub size_bytes: u64,
    pub sha256: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FullBackupManifest {
    pub format: String,
    pub format_version: u32,
    pub backup_type: String,
    pub app_version: String,
    pub created_at: String,
    pub components: Vec<String>,
    pub sqlite_sha256: String,
    pub mss_state_sha256: String,
    pub settings_sha256: String,
    pub files: Vec<FullBackupFileEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FullBackupFrontendPayload {
    pub app_version: String,
    pub settings_json: String,
    pub mss_state_json: String,
    pub export_storage_location: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupInspectionResult {
    pub filename: String,
    pub filepath: String,
    pub backup_kind: String,
    pub manifest: Option<FullBackupManifest>,
    pub integrity_valid: bool,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FullBackupRestoreOutput {
    pub backup_kind: String,
    pub filename: String,
    pub restored_file_count: usize,
    pub unavailable_export_path: Option<String>,
    pub settings_json: Option<String>,
    pub mss_state_json: Option<String>,
    pub manifest: Option<FullBackupManifest>,
}

/// Pure-Rust FIPS 180-4 SHA-256 implementation returning lowercase hex.
pub fn sha256_hex(data: &[u8]) -> String {
    const K: [u32; 64] = [
        0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
        0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
        0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
        0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
        0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
        0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
        0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
        0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
    ];

    let mut h: [u32; 8] = [
        0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
        0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
    ];

    let bit_len = (data.len() as u64).wrapping_mul(8);
    let mut padded = data.to_vec();
    padded.push(0x80);
    while (padded.len() % 64) != 56 {
        padded.push(0x00);
    }
    padded.extend_from_slice(&bit_len.to_be_bytes());

    for chunk in padded.chunks_exact(64) {
        let mut w = [0u32; 64];
        for i in 0..16 {
            w[i] = u32::from_be_bytes([
                chunk[i * 4],
                chunk[i * 4 + 1],
                chunk[i * 4 + 2],
                chunk[i * 4 + 3],
            ]);
        }
        for i in 16..64 {
            let s0 = w[i - 15].rotate_right(7) ^ w[i - 15].rotate_right(18) ^ (w[i - 15] >> 3);
            let s1 = w[i - 2].rotate_right(17) ^ w[i - 2].rotate_right(19) ^ (w[i - 2] >> 10);
            w[i] = w[i - 16].wrapping_add(s0).wrapping_add(w[i - 7]).wrapping_add(s1);
        }

        let [mut a, mut b, mut c, mut d, mut e, mut f, mut g, mut hh] = h;
        for i in 0..64 {
            let s1 = e.rotate_right(6) ^ e.rotate_right(11) ^ e.rotate_right(25);
            let ch = (e & f) ^ ((!e) & g);
            let temp1 = hh.wrapping_add(s1).wrapping_add(ch).wrapping_add(K[i]).wrapping_add(w[i]);
            let s0 = a.rotate_right(2) ^ a.rotate_right(13) ^ a.rotate_right(22);
            let maj = (a & b) ^ (a & c) ^ (b & c);
            let temp2 = s0.wrapping_add(maj);

            hh = g;
            g = f;
            f = e;
            e = d.wrapping_add(temp1);
            d = c;
            c = b;
            b = a;
            a = temp1.wrapping_add(temp2);
        }

        h[0] = h[0].wrapping_add(a);
        h[1] = h[1].wrapping_add(b);
        h[2] = h[2].wrapping_add(c);
        h[3] = h[3].wrapping_add(d);
        h[4] = h[4].wrapping_add(e);
        h[5] = h[5].wrapping_add(f);
        h[6] = h[6].wrapping_add(g);
        h[7] = h[7].wrapping_add(hh);
    }

    let mut out = String::with_capacity(64);
    for word in h {
        out.push_str(&format!("{:08x}", word));
    }
    out
}

fn is_excluded_filename(name: &str) -> bool {
    let lower = name.to_lowercase();
    lower.starts_with(".staging_")
        || lower.starts_with("~$")
        || lower.ends_with(".tmp")
        || lower.ends_with(".temp")
        || lower == "thumbs.db"
        || lower == ".ds_store"
        || lower == "session.dpapi"
        || lower == "backups_manifest.json"
        || lower.starts_with("as system backup_")
        || lower.starts_with("full as system backup_")
        || lower.starts_with("mss_backup_")
        || lower.starts_with("accessories_backup_")
}

fn is_path_excluded(path: &Path, excluded_dirs: &[PathBuf]) -> bool {
    let canon_target = fs::canonicalize(path).unwrap_or_else(|_| path.to_path_buf());
    for ex in excluded_dirs {
        let canon_ex = fs::canonicalize(ex).unwrap_or_else(|_| ex.clone());
        if canon_target == canon_ex || canon_target.starts_with(&canon_ex) {
            return true;
        }
    }
    false
}

fn sanitize_relative_path(rel: &str) -> Result<PathBuf, String> {
    let mut out = PathBuf::new();
    for comp in Path::new(rel).components() {
        match comp {
            Component::Normal(part) => out.push(part),
            Component::CurDir => {}
            _ => {
                return Err(format!("مسار نسبي غير آمن داخل النسخة الاحتياطية: {}", rel));
            }
        }
    }
    if out.as_os_str().is_empty() {
        return Err("مسار ملف فارغ داخل النسخة الاحتياطية".into());
    }
    Ok(out)
}

fn collect_dir_files_recursive(
    root: &Path,
    current: &Path,
    root_category: &str,
    excluded_dirs: &[PathBuf],
    collected: &mut Vec<(FullBackupFileEntry, Vec<u8>)>,
) {
    if !current.exists() || !current.is_dir() || is_path_excluded(current, excluded_dirs) {
        return;
    }

    let Ok(entries) = fs::read_dir(current) else {
        return;
    };

    for entry in entries.flatten() {
        let path = entry.path();
        let fname = entry.file_name().to_string_lossy().to_string();
        if is_excluded_filename(&fname) {
            continue;
        }
        if is_path_excluded(&path, excluded_dirs) {
            continue;
        }
        if path.is_dir() {
            collect_dir_files_recursive(root, &path, root_category, excluded_dirs, collected);
        } else if path.is_file() {
            if let Ok(rel) = path.strip_prefix(root) {
                if let Ok(bytes) = fs::read(&path) {
                    let rel_str = rel.to_string_lossy().replace('\\', "/");
                    let sha = sha256_hex(&bytes);
                    let entry_meta = FullBackupFileEntry {
                        relative_path: rel_str,
                        root_category: root_category.to_string(),
                        size_bytes: bytes.len() as u64,
                        sha256: sha,
                    };
                    collected.push((entry_meta, bytes));
                }
            }
        }
    }
}

pub fn get_compu_mss_local_dir() -> PathBuf {
    let mut dir = dirs::data_local_dir().unwrap_or_else(|| PathBuf::from("."));
    dir.push("CompuMSS");
    dir
}

pub fn build_full_backup_container(
    snapshot_db_path: &Path,
    target_staging_path: &Path,
    payload: &FullBackupFrontendPayload,
    excluded_dirs: &[PathBuf],
) -> Result<FullBackupManifest, String> {
    let sqlite_bytes = fs::read(snapshot_db_path)
        .map_err(|e| format!("فشل قراءة نسخة قاعدة البيانات المؤقتة: {}", e))?;
    if sqlite_bytes.is_empty() {
        return Err("نسخة قاعدة البيانات المؤقتة فارغة".into());
    }
    let sqlite_sha256 = sha256_hex(&sqlite_bytes);
    let settings_sha256 = sha256_hex(payload.settings_json.as_bytes());
    let mss_state_sha256 = sha256_hex(payload.mss_state_json.as_bytes());

    let mut collected_files: Vec<(FullBackupFileEntry, Vec<u8>)> = Vec::new();

    // 1. Collect managed exported files (MSS System Files/* and Custom images/*)
    if let Some(ref export_loc) = payload.export_storage_location {
        let trimmed = export_loc.trim();
        if !trimmed.is_empty() {
            let export_root = PathBuf::from(trimmed);
            let mut seen_rel: std::collections::HashSet<String> = std::collections::HashSet::new();
            for folder_name in ["MSS System Files", "Custom images", "custom images"] {
                let candidate = export_root.join(folder_name);
                if candidate.exists() && candidate.is_dir() {
                    let mut batch: Vec<(FullBackupFileEntry, Vec<u8>)> = Vec::new();
                    collect_dir_files_recursive(
                        &export_root,
                        &candidate,
                        "export_root",
                        excluded_dirs,
                        &mut batch,
                    );
                    for (meta, bytes) in batch {
                        if seen_rel.insert(meta.relative_path.to_lowercase()) {
                            collected_files.push((meta, bytes));
                        }
                    }
                }
            }
        }
    }

    // 2. Collect safe CompuMSS app config files (explicitly excluding session.dpapi)
    let app_config_dir = get_compu_mss_local_dir();
    let export_cfg_file = app_config_dir.join("export_storage_config.json");
    if export_cfg_file.exists() && export_cfg_file.is_file() {
        if let Ok(bytes) = fs::read(&export_cfg_file) {
            let sha = sha256_hex(&bytes);
            collected_files.push((
                FullBackupFileEntry {
                    relative_path: "export_storage_config.json".to_string(),
                    root_category: "app_config".to_string(),
                    size_bytes: bytes.len() as u64,
                    sha256: sha,
                },
                bytes,
            ));
        }
    }

    let file_entries: Vec<FullBackupFileEntry> =
        collected_files.iter().map(|(meta, _)| meta.clone()).collect();

    let manifest = FullBackupManifest {
        format: FULL_BACKUP_FORMAT.to_string(),
        format_version: FULL_BACKUP_FORMAT_VERSION,
        backup_type: "full".to_string(),
        app_version: payload.app_version.clone(),
        created_at: chrono::Utc::now().to_rfc3339(),
        components: vec![
            "accessories_sqlite".to_string(),
            "mss_local_state".to_string(),
            "app_settings".to_string(),
            "managed_files".to_string(),
        ],
        sqlite_sha256: sqlite_sha256.clone(),
        mss_state_sha256: mss_state_sha256.clone(),
        settings_sha256: settings_sha256.clone(),
        files: file_entries,
    };

    let manifest_json = serde_json::to_string(&manifest)
        .map_err(|e| format!("فشل تسلسل بيان النسخة الاحتياطية الكاملة: {}", e))?;

    if target_staging_path.exists() {
        let _ = fs::remove_file(target_staging_path);
    }

    let conn = Connection::open(target_staging_path)
        .map_err(|e| format!("فشل إنشاء حاوية النسخة الاحتياطية الكاملة: {}", e))?;

    conn.execute_batch(
        "PRAGMA journal_mode = DELETE;
         CREATE TABLE __as_full_backup_manifest (id INTEGER PRIMARY KEY, json_data TEXT NOT NULL);
         CREATE TABLE __as_full_backup_sqlite (id INTEGER PRIMARY KEY, sha256 TEXT NOT NULL, data BLOB NOT NULL);
         CREATE TABLE __as_full_backup_settings (id INTEGER PRIMARY KEY, sha256 TEXT NOT NULL, json_data TEXT NOT NULL);
         CREATE TABLE __as_full_backup_mss_state (id INTEGER PRIMARY KEY, sha256 TEXT NOT NULL, json_data TEXT NOT NULL);
         CREATE TABLE __as_full_backup_files (
           id INTEGER PRIMARY KEY AUTOINCREMENT,
           relative_path TEXT NOT NULL,
           root_category TEXT NOT NULL,
           size_bytes INTEGER NOT NULL,
           sha256 TEXT NOT NULL,
           content BLOB NOT NULL
         );",
    )
    .map_err(|e| format!("فشل تهيئة جداول النسخة الاحتياطية الكاملة: {}", e))?;

    conn.execute(
        "INSERT INTO __as_full_backup_manifest (id, json_data) VALUES (1, ?1)",
        params![manifest_json],
    )
    .map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT INTO __as_full_backup_sqlite (id, sha256, data) VALUES (1, ?1, ?2)",
        params![sqlite_sha256, sqlite_bytes],
    )
    .map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT INTO __as_full_backup_settings (id, sha256, json_data) VALUES (1, ?1, ?2)",
        params![settings_sha256, payload.settings_json],
    )
    .map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT INTO __as_full_backup_mss_state (id, sha256, json_data) VALUES (1, ?1, ?2)",
        params![mss_state_sha256, payload.mss_state_json],
    )
    .map_err(|e| e.to_string())?;

    for (entry_meta, bytes) in &collected_files {
        conn.execute(
            "INSERT INTO __as_full_backup_files (relative_path, root_category, size_bytes, sha256, content) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![
                entry_meta.relative_path,
                entry_meta.root_category,
                entry_meta.size_bytes as i64,
                entry_meta.sha256,
                bytes
            ],
        )
        .map_err(|e| format!("فشل حفظ الملف '{}' في النسخة الاحتياطية: {}", entry_meta.relative_path, e))?;
    }

    let integrity: String = conn
        .query_row("PRAGMA integrity_check;", [], |row| row.get(0))
        .map_err(|e| format!("فشل فحص سلامة حاوية النسخة الكاملة: {}", e))?;
    if integrity.to_lowercase() != "ok" {
        return Err("فشل التحقق من سلامة حاوية النسخة الاحتياطية الكاملة".into());
    }

    Ok(manifest)
}

pub fn inspect_backup_file_path(source_path: &Path) -> Result<BackupInspectionResult, String> {
    if !source_path.exists() {
        return Err(format!("ملف النسخة الاحتياطية غير موجود: {}", source_path.display()));
    }

    let filename = source_path
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();
    let filepath = source_path.to_string_lossy().to_string();

    let conn = Connection::open(source_path)
        .map_err(|e| format!("فشل فتح ملف النسخة الاحتياطية: {}", e))?;

    let integrity: Result<String, _> = conn.query_row("PRAGMA integrity_check;", [], |row| row.get(0));
    match integrity {
        Ok(res) if res.to_lowercase() == "ok" => {}
        _ => {
            return Ok(BackupInspectionResult {
                filename,
                filepath,
                backup_kind: "standard".to_string(),
                manifest: None,
                integrity_valid: false,
                error: Some("ملف النسخة الاحتياطية تالف (فشل PRAGMA integrity_check)".to_string()),
            });
        }
    }

    let has_manifest: bool = conn
        .query_row(
            "SELECT COUNT(*) > 0 FROM sqlite_master WHERE type='table' AND name='__as_full_backup_manifest'",
            [],
            |row| row.get(0),
        )
        .unwrap_or(false);

    if !has_manifest {
        return Ok(BackupInspectionResult {
            filename,
            filepath,
            backup_kind: "standard".to_string(),
            manifest: None,
            integrity_valid: true,
            error: None,
        });
    }

    let manifest_raw: String = conn
        .query_row("SELECT json_data FROM __as_full_backup_manifest WHERE id = 1", [], |row| row.get(0))
        .map_err(|e| format!("بيان النسخة الاحتياطية الكاملة مفقود أو تالف: {}", e))?;

    let manifest: FullBackupManifest = serde_json::from_str(&manifest_raw)
        .map_err(|e| format!("تعذر قراءة بيان النسخة الاحتياطية الكاملة: {}", e))?;

    if manifest.format != FULL_BACKUP_FORMAT || manifest.format_version > FULL_BACKUP_FORMAT_VERSION {
        return Ok(BackupInspectionResult {
            filename,
            filepath,
            backup_kind: "full".to_string(),
            manifest: Some(manifest),
            integrity_valid: false,
            error: Some("إصدار تنسيق النسخة الاحتياطية الكاملة غير مدعوم في هذا الإصدار".to_string()),
        });
    }

    Ok(BackupInspectionResult {
        filename,
        filepath,
        backup_kind: "full".to_string(),
        manifest: Some(manifest),
        integrity_valid: true,
        error: None,
    })
}

pub fn restore_full_backup_from_path(
    source_path: &Path,
    db_path: &Path,
    backups_dir: &Path,
) -> Result<FullBackupRestoreOutput, String> {
    let inspection = inspect_backup_file_path(source_path)?;
    if !inspection.integrity_valid {
        return Err(inspection.error.unwrap_or_else(|| "النسخة الاحتياطية تالفة".to_string()));
    }
    if inspection.backup_kind != "full" {
        return Err("الملف المحدد ليس نسخة احتياطية كاملة".to_string());
    }
    let manifest = inspection
        .manifest
        .ok_or_else(|| "بيان النسخة الاحتياطية الكاملة مفقود".to_string())?;

    let conn = Connection::open(source_path)
        .map_err(|e| format!("فشل فتح النسخة الاحتياطية الكاملة: {}", e))?;

    // 1. Verify all component SHA-256 hashes BEFORE making any disk modifications
    let (sqlite_sha_stored, sqlite_bytes): (String, Vec<u8>) = conn
        .query_row("SELECT sha256, data FROM __as_full_backup_sqlite WHERE id = 1", [], |row| {
            Ok((row.get(0)?, row.get(1)?))
        })
        .map_err(|e| format!("بيانات قاعدة البيانات داخل النسخة الكاملة مفقودة: {}", e))?;

    if sha256_hex(&sqlite_bytes) != manifest.sqlite_sha256 || sqlite_sha_stored != manifest.sqlite_sha256 {
        return Err("فشل التحقق من سلامة قاعدة البيانات (عدم تطابق SHA-256)".into());
    }

    let (settings_sha_stored, settings_json): (String, String) = conn
        .query_row("SELECT sha256, json_data FROM __as_full_backup_settings WHERE id = 1", [], |row| {
            Ok((row.get(0)?, row.get(1)?))
        })
        .map_err(|e| format!("بيانات الإعدادات داخل النسخة الكاملة مفقودة: {}", e))?;

    if sha256_hex(settings_json.as_bytes()) != manifest.settings_sha256
        || settings_sha_stored != manifest.settings_sha256
    {
        return Err("فشل التحقق من سلامة إعدادات البرنامج (عدم تطابق SHA-256)".into());
    }

    let (mss_sha_stored, mss_state_json): (String, String) = conn
        .query_row("SELECT sha256, json_data FROM __as_full_backup_mss_state WHERE id = 1", [], |row| {
            Ok((row.get(0)?, row.get(1)?))
        })
        .map_err(|e| format!("بيانات MSS المحلية داخل النسخة الكاملة مفقودة: {}", e))?;

    if sha256_hex(mss_state_json.as_bytes()) != manifest.mss_state_sha256
        || mss_sha_stored != manifest.mss_state_sha256
    {
        return Err("فشل التحقق من سلامة بيانات MSS (عدم تطابق SHA-256)".into());
    }

    let mut stmt = conn
        .prepare("SELECT relative_path, root_category, sha256, content FROM __as_full_backup_files")
        .map_err(|e| format!("فشل قراءة قائمة الملفات المرفقة: {}", e))?;

    let file_rows = stmt
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, Vec<u8>>(3)?,
            ))
        })
        .map_err(|e| e.to_string())?;

    let mut verified_files: Vec<(PathBuf, String, Vec<u8>)> = Vec::new();
    for row_res in file_rows {
        let (rel_path, root_cat, stored_sha, bytes) = row_res.map_err(|e| e.to_string())?;
        let safe_rel = sanitize_relative_path(&rel_path)?;
        if sha256_hex(&bytes) != stored_sha {
            return Err(format!(
                "تلف في الملف المرفق '{}' (فشل التحقق من SHA-256)",
                rel_path
            ));
        }
        verified_files.push((safe_rel, root_cat, bytes));
    }

    if verified_files.len() != manifest.files.len() {
        return Err("عدد الملفات داخل النسخة الكاملة لا يطابق البيان (النسخة غير مكتملة)".into());
    }
    drop(stmt);
    drop(conn);

    // 2. Stage extracted SQLite DB and verify PRAGMA integrity_check before replacing live DB
    let _ = fs::create_dir_all(backups_dir);
    let staged_db_path = backups_dir.join(".staging_restore_accessories.db");
    fs::write(&staged_db_path, &sqlite_bytes)
        .map_err(|e| format!("فشل كتابة ملف قاعدة البيانات المؤقت للاستعادة: {}", e))?;

    {
        let staged_conn = Connection::open(&staged_db_path)
            .map_err(|e| format!("فشل فتح قاعدة البيانات المستخرجة: {}", e))?;
        let ok: Result<String, _> = staged_conn.query_row("PRAGMA integrity_check;", [], |r| r.get(0));
        match ok {
            Ok(s) if s.to_lowercase() == "ok" => {}
            _ => {
                let _ = fs::remove_file(&staged_db_path);
                return Err("قاعدة البيانات المستخرجة من النسخة الكاملة تالفة".into());
            }
        }
    }

    // 3. Safeguard current SQLite DB before overwriting
    let safeguard_path = backups_dir.join(format!(
        "safeguard_before_full_restore_{}.db",
        chrono::Local::now().format("%Y-%m-%d_%H-%M-%S")
    ));
    if db_path.exists() {
        let _ = fs::copy(db_path, &safeguard_path);
    }

    // Remove stale WAL/SHM files and atomically replace DB
    let wal_path = PathBuf::from(format!("{}-wal", db_path.to_string_lossy()));
    let shm_path = PathBuf::from(format!("{}-shm", db_path.to_string_lossy()));
    let _ = fs::remove_file(&wal_path);
    let _ = fs::remove_file(&shm_path);

    if let Some(parent) = db_path.parent() {
        let _ = fs::create_dir_all(parent);
    }

    if let Err(copy_err) = fs::copy(&staged_db_path, db_path) {
        if safeguard_path.exists() {
            let _ = fs::copy(&safeguard_path, db_path);
        }
        let _ = fs::remove_file(&staged_db_path);
        return Err(format!("فشل استعادة ملف قاعدة البيانات: {}", copy_err));
    }
    let _ = fs::remove_file(&staged_db_path);

    // 4. Restore app_config files + managed export_root files
    let parsed_settings: serde_json::Value =
        serde_json::from_str(&settings_json).unwrap_or(serde_json::Value::Null);
    let restored_export_loc = parsed_settings
        .get("exportStorageLocation")
        .and_then(|v| v.as_str())
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty());

    let mut unavailable_export_path: Option<String> = None;
    let export_root_writable = if let Some(ref exp_loc) = restored_export_loc {
        let p = PathBuf::from(exp_loc);
        if fs::create_dir_all(&p).is_ok() {
            let probe = p.join(".as_restore_probe.tmp");
            if fs::write(&probe, b"ok").is_ok() {
                let _ = fs::remove_file(&probe);
                true
            } else {
                unavailable_export_path = Some(exp_loc.clone());
                false
            }
        } else {
            unavailable_export_path = Some(exp_loc.clone());
            false
        }
    } else {
        false
    };

    let mut restored_file_count = 0usize;
    let app_config_dir = get_compu_mss_local_dir();

    for (safe_rel, root_cat, bytes) in verified_files {
        if root_cat == "app_config" {
            let _ = fs::create_dir_all(&app_config_dir);
            let target = app_config_dir.join(&safe_rel);
            if let Some(parent) = target.parent() {
                let _ = fs::create_dir_all(parent);
            }
            if fs::write(&target, &bytes).is_ok() {
                restored_file_count += 1;
            }
        } else if root_cat == "export_root" && export_root_writable {
            if let Some(ref exp_loc) = restored_export_loc {
                let target = PathBuf::from(exp_loc).join(&safe_rel);
                if let Some(parent) = target.parent() {
                    let _ = fs::create_dir_all(parent);
                }
                if fs::write(&target, &bytes).is_ok() {
                    restored_file_count += 1;
                }
            }
        }
    }

    Ok(FullBackupRestoreOutput {
        backup_kind: "full".to_string(),
        filename: inspection.filename,
        restored_file_count,
        unavailable_export_path,
        settings_json: Some(settings_json),
        mss_state_json: Some(mss_state_json),
        manifest: Some(manifest),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sha256_matches_nist_abc() {
        assert_eq!(
            sha256_hex(b"abc"),
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
        );
    }
}
