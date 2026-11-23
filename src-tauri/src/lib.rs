pub mod db;

use db::{
    create_backup_file, execute_multi_destination_backup, execute_stock_adjustment,
    export_backup_file, fetch_all_invoices, fetch_all_products, fetch_all_purchases,
    fetch_all_returns, fetch_categories, fetch_inventory_movements, fetch_invoice_items,
    fetch_product_by_id, fetch_purchase_items, fetch_return_items, init_db, insert_product,
    insert_purchase, insert_return, insert_sale, list_all_backups, restore_db_from_backup,
    search_products, update_product, validate_destination_path, BackupInfo, DbState,
    DestinationResult, InventoryMovement, Invoice, InvoiceItem, MultiBackupResult,
    NewProductInput, NewPurchaseInput, NewReturnInput, NewSaleInput, Product, Purchase,
    PurchaseItem, ReturnItemRecord, ReturnRecord, StockAdjustmentInput, UpdateProductInput,
};
use std::sync::Mutex;
use tauri::State;

// Product Commands
#[tauri::command]
fn get_accessories_products(state: State<DbState>) -> Result<Vec<Product>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    fetch_all_products(&conn)
}

#[tauri::command]
fn get_accessories_product_by_id(state: State<DbState>, id: String) -> Result<Option<Product>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    fetch_product_by_id(&conn, &id)
}

#[tauri::command]
fn add_accessories_product(
    state: State<DbState>,
    input: NewProductInput,
) -> Result<Product, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    insert_product(&conn, input)
}

#[tauri::command]
fn update_accessories_product(
    state: State<DbState>,
    id: String,
    input: UpdateProductInput,
) -> Result<Product, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    update_product(&conn, &id, input)
}

#[tauri::command]
fn delete_accessories_product(state: State<DbState>, id: String) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    db::delete_product(&conn, &id)
}

#[tauri::command]
fn search_accessories_products(
    state: State<DbState>,
    query: String,
) -> Result<Vec<Product>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    search_products(&conn, &query)
}

#[tauri::command]
fn get_accessories_categories(state: State<DbState>) -> Result<Vec<String>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    fetch_categories(&conn)
}

// Purchase Commands
#[tauri::command]
fn create_accessories_purchase(
    state: State<DbState>,
    input: NewPurchaseInput,
) -> Result<Purchase, String> {
    let mut conn = state.conn.lock().map_err(|e| e.to_string())?;
    insert_purchase(&mut conn, input)
}

#[tauri::command]
fn get_accessories_purchases(state: State<DbState>) -> Result<Vec<Purchase>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    fetch_all_purchases(&conn)
}

#[tauri::command]
fn get_accessories_purchase_items(
    state: State<DbState>,
    purchase_id: String,
) -> Result<Vec<PurchaseItem>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    fetch_purchase_items(&conn, &purchase_id)
}

// Sales Commands
#[tauri::command]
fn create_accessories_sale(
    state: State<DbState>,
    input: NewSaleInput,
) -> Result<Invoice, String> {
    let mut conn = state.conn.lock().map_err(|e| e.to_string())?;
    insert_sale(&mut conn, input)
}

#[tauri::command]
fn get_accessories_invoices(state: State<DbState>) -> Result<Vec<Invoice>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    fetch_all_invoices(&conn)
}

#[tauri::command]
fn get_accessories_invoice_items(
    state: State<DbState>,
    invoice_id: String,
) -> Result<Vec<InvoiceItem>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    fetch_invoice_items(&conn, &invoice_id)
}

// Inventory & Movement Commands
#[tauri::command]
fn adjust_accessories_stock(
    state: State<DbState>,
    input: StockAdjustmentInput,
) -> Result<InventoryMovement, String> {
    let mut conn = state.conn.lock().map_err(|e| e.to_string())?;
    execute_stock_adjustment(&mut conn, input)
}

#[tauri::command]
fn get_accessories_inventory_movements(
    state: State<DbState>,
    product_id: Option<String>,
    limit: Option<i64>,
) -> Result<Vec<InventoryMovement>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    fetch_inventory_movements(&conn, product_id.as_deref(), limit.unwrap_or(100))
}

// Returns & Refunds Commands
#[tauri::command]
fn create_accessories_return(
    state: State<DbState>,
    input: NewReturnInput,
) -> Result<ReturnRecord, String> {
    let mut conn = state.conn.lock().map_err(|e| e.to_string())?;
    insert_return(&mut conn, input)
}

#[tauri::command]
fn get_accessories_returns(state: State<DbState>) -> Result<Vec<ReturnRecord>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    fetch_all_returns(&conn)
}

#[tauri::command]
fn get_accessories_return_items(
    state: State<DbState>,
    return_id: String,
) -> Result<Vec<ReturnItemRecord>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    fetch_return_items(&conn, &return_id)
}

// Backup & Restore Commands
#[tauri::command]
fn create_accessories_backup(
    backup_type: Option<String>,
    destination_dir: Option<String>,
    custom_filename: Option<String>,
) -> Result<BackupInfo, String> {
    create_backup_file(
        backup_type.as_deref().unwrap_or("manual"),
        destination_dir.as_deref(),
        custom_filename.as_deref(),
    )
}

#[tauri::command]
fn create_multi_destination_backup(
    trigger_type: String,
    destinations: Vec<String>,
    custom_filename: Option<String>,
    retention_count: Option<usize>,
) -> Result<MultiBackupResult, String> {
    execute_multi_destination_backup(
        &trigger_type,
        &destinations,
        custom_filename.as_deref(),
        retention_count.unwrap_or(10),
    )
}

#[tauri::command]
fn validate_backup_destination(path: String) -> Result<bool, String> {
    validate_destination_path(&path)
}

#[tauri::command]
fn select_backup_folder() -> Result<Option<String>, String> {
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        let script = r#"
            [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
            Add-Type -AssemblyName System.Windows.Forms
            $dialog = New-Object System.Windows.Forms.FolderBrowserDialog
            $dialog.AutoUpgradeEnabled = $true
            $dialog.Description = "Select Backup Destination Folder"
            $dialog.ShowNewFolderButton = $true
            if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
                Write-Output $dialog.SelectedPath
            }
        "#;
        let output = Command::new("powershell")
            .args(["-NoProfile", "-STA", "-WindowStyle", "Hidden", "-Command", script])
            .output()
            .map_err(|e| e.to_string())?;

        let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if path.is_empty() {
            Ok(None)
        } else {
            Ok(Some(path))
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        Ok(None)
    }
}

#[tauri::command]
fn select_save_backup_path(default_filename: Option<String>) -> Result<Option<String>, String> {
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        let default_name = default_filename.unwrap_or_else(|| "MSS-Backup.db".to_string());
        let script = format!(
            r#"
            [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
            Add-Type -AssemblyName System.Windows.Forms
            $dialog = New-Object System.Windows.Forms.SaveFileDialog
            $dialog.Title = "حفظ نسخة احتياطية من قاعدة البيانات"
            $dialog.Filter = "ملفات قاعدة البيانات (*.db)|*.db|جميع الملفات (*.*)|*.*"
            $dialog.FileName = "{}"
            if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {{
                Write-Output $dialog.FileName
            }}
            "#,
            default_name
        );
        let output = Command::new("powershell")
            .args(["-NoProfile", "-STA", "-WindowStyle", "Hidden", "-Command", &script])
            .output()
            .map_err(|e| e.to_string())?;

        let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if path.is_empty() {
            Ok(None)
        } else {
            Ok(Some(path))
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        Ok(None)
    }
}

#[tauri::command]
fn open_folder_in_explorer(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        let p = std::path::Path::new(&path);
        if !p.exists() {
            return Err("المسار غير موجود على القرص أو تم نقله".to_string());
        }
        if p.is_file() {
            Command::new("explorer")
                .arg(format!("/select,\"{}\"", path))
                .spawn()
                .map_err(|e| e.to_string())?;
        } else {
            Command::new("explorer")
                .arg(&path)
                .spawn()
                .map_err(|e| e.to_string())?;
        }
        Ok(())
    }
    #[cfg(not(target_os = "windows"))]
    {
        Ok(())
    }
}

// Windows Startup (Autostart) Commands
#[tauri::command]
fn get_windows_startup_status() -> Result<bool, String> {
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        let output = Command::new("reg")
            .args(["query", r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run", "/v", "MSS System"])
            .output()
            .map_err(|e| e.to_string())?;
        Ok(output.status.success())
    }
    #[cfg(not(target_os = "windows"))]
    {
        Ok(false)
    }
}

#[tauri::command]
fn set_windows_startup_status(enabled: bool) -> Result<bool, String> {
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        if enabled {
            let exe_path = std::env::current_exe().map_err(|e| e.to_string())?;
            let exe_str = exe_path.to_string_lossy().to_string();
            let quoted_exe = format!("\"{}\"", exe_str);
            let status = Command::new("reg")
                .args([
                    "add",
                    r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run",
                    "/v",
                    "MSS System",
                    "/t",
                    "REG_SZ",
                    "/d",
                    &quoted_exe,
                    "/f",
                ])
                .status()
                .map_err(|e| e.to_string())?;

            if !status.success() {
                return Err("فشل تسجيل البرنامج في قائمة بدء تشغيل Windows".to_string());
            }
            Ok(true)
        } else {
            let _ = Command::new("reg")
                .args([
                    "delete",
                    r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run",
                    "/v",
                    "MSS System",
                    "/f",
                ])
                .status();
            Ok(false)
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        Ok(false)
    }
}

#[tauri::command]
fn get_accessories_backups() -> Result<Vec<BackupInfo>, String> {
    list_all_backups()
}

#[tauri::command]
fn restore_accessories_backup(
    state: State<DbState>,
    filename: String,
) -> Result<(), String> {
    let mut conn = state.conn.lock().map_err(|e| e.to_string())?;
    restore_db_from_backup(&filename)?;
    let new_conn = init_db().map_err(|e| e.to_string())?;
    *conn = new_conn;
    Ok(())
}

#[tauri::command]
fn export_accessories_backup(filename: String, target_path: String) -> Result<(), String> {
    export_backup_file(&filename, &target_path)
}

#[tauri::command]
fn get_accessories_db_status() -> Result<String, String> {
    let path = db::get_db_path();
    Ok(format!("SQLite: {}", path.to_string_lossy()))
}

// Secure Session Storage Commands (Windows DPAPI / OS-Protected Storage)
#[cfg(target_os = "windows")]
mod dpapi {
    use std::ffi::c_void;
    use std::ptr;

    #[repr(C)]
    #[allow(non_snake_case)]
    struct DATA_BLOB {
        cbData: u32,
        pbData: *mut u8,
    }

    const CRYPTPROTECT_UI_FORBIDDEN: u32 = 0x1;

    #[link(name = "crypt32")]
    #[link(name = "kernel32")]
    extern "system" {
        fn CryptProtectData(
            pDataIn: *const DATA_BLOB,
            szDataDescr: *const u16,
            pOptionalEntropy: *const DATA_BLOB,
            pvReserved: *mut c_void,
            pPromptStruct: *mut c_void,
            dwFlags: u32,
            pDataOut: *mut DATA_BLOB,
        ) -> i32;

        fn CryptUnprotectData(
            pDataIn: *const DATA_BLOB,
            ppszDataDescr: *mut *mut u16,
            pOptionalEntropy: *const DATA_BLOB,
            pvReserved: *mut c_void,
            pPromptStruct: *mut c_void,
            dwFlags: u32,
            pDataOut: *mut DATA_BLOB,
        ) -> i32;

        fn LocalFree(hMem: *mut c_void) -> *mut c_void;
    }

    pub fn protect(data: &[u8]) -> Result<Vec<u8>, String> {
        let mut data_in = DATA_BLOB {
            cbData: data.len() as u32,
            pbData: data.as_ptr() as *mut u8,
        };
        let mut data_out = DATA_BLOB {
            cbData: 0,
            pbData: ptr::null_mut(),
        };

        let success = unsafe {
            CryptProtectData(
                &mut data_in,
                ptr::null(),
                ptr::null(),
                ptr::null_mut(),
                ptr::null_mut(),
                CRYPTPROTECT_UI_FORBIDDEN,
                &mut data_out,
            )
        };

        if success == 0 {
            return Err("CryptProtectData failed to encrypt session".to_string());
        }

        if data_out.pbData.is_null() {
            return Err("CryptProtectData returned null pointer".to_string());
        }

        let encrypted = unsafe {
            let slice = std::slice::from_raw_parts(data_out.pbData, data_out.cbData as usize);
            let bytes = slice.to_vec();
            LocalFree(data_out.pbData as *mut c_void);
            bytes
        };

        Ok(encrypted)
    }

    pub fn unprotect(data: &[u8]) -> Result<Vec<u8>, String> {
        let mut data_in = DATA_BLOB {
            cbData: data.len() as u32,
            pbData: data.as_ptr() as *mut u8,
        };
        let mut data_out = DATA_BLOB {
            cbData: 0,
            pbData: ptr::null_mut(),
        };

        let success = unsafe {
            CryptUnprotectData(
                &mut data_in,
                ptr::null_mut(),
                ptr::null(),
                ptr::null_mut(),
                ptr::null_mut(),
                CRYPTPROTECT_UI_FORBIDDEN,
                &mut data_out,
            )
        };

        if success == 0 {
            return Err("CryptUnprotectData failed: corrupted session or credentials changed".to_string());
        }

        if data_out.pbData.is_null() {
            return Err("CryptUnprotectData returned null pointer".to_string());
        }

        let decrypted = unsafe {
            let slice = std::slice::from_raw_parts(data_out.pbData, data_out.cbData as usize);
            let bytes = slice.to_vec();
            LocalFree(data_out.pbData as *mut c_void);
            bytes
        };

        Ok(decrypted)
    }
}

#[cfg(target_os = "windows")]
fn get_session_file_path() -> Result<std::path::PathBuf, String> {
    let base = std::env::var_os("LOCALAPPDATA")
        .map(std::path::PathBuf::from)
        .or_else(dirs::data_local_dir)
        .ok_or_else(|| "Could not determine LOCALAPPDATA directory".to_string())?;
    Ok(base.join("CompuMSS").join("session.dpapi"))
}

#[tauri::command]
fn save_secure_session(session_json: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let target = get_session_file_path()?;
        if let Some(parent) = target.parent() {
            std::fs::create_dir_all(parent).map_err(|e| format!("Failed to create CompuMSS folder: {}", e))?;
        }
        let encrypted = dpapi::protect(session_json.as_bytes())?;
        std::fs::write(&target, encrypted).map_err(|e| format!("Failed to write session file: {}", e))?;
        Ok(())
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = session_json;
        Ok(())
    }
}

#[tauri::command]
fn load_secure_session() -> Result<Option<String>, String> {
    #[cfg(target_os = "windows")]
    {
        let target = get_session_file_path()?;
        if !target.exists() {
            return Ok(None);
        }
        let bytes = match std::fs::read(&target) {
            Ok(b) => b,
            Err(e) => {
                return Err(format!("Failed to read session file: {}", e));
            }
        };
        if bytes.is_empty() {
            return Ok(None);
        }
        let decrypted = dpapi::unprotect(&bytes)?;
        let s = String::from_utf8(decrypted).map_err(|e| format!("Invalid UTF-8 in session: {}", e))?;
        let trimmed = s.trim();
        if trimmed.is_empty() {
            Ok(None)
        } else {
            Ok(Some(trimmed.to_string()))
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        Ok(None)
    }
}

#[tauri::command]
fn clear_secure_session() -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let target = get_session_file_path()?;
        if target.exists() {
            let _ = std::fs::remove_file(target);
        }
        Ok(())
    }
    #[cfg(not(target_os = "windows"))]
    {
        Ok(())
    }
}

fn decode_base64_internal(input: &str) -> Option<Vec<u8>> {
    let mut table = [255u8; 256];
    for (i, &b) in b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/".iter().enumerate() {
        table[b as usize] = i as u8;
    }
    let bytes = input.as_bytes();
    let mut out = Vec::with_capacity(bytes.len() * 3 / 4);
    let mut buf = 0u32;
    let mut bits = 0u32;
    for &b in bytes {
        if b == b'=' || b.is_ascii_whitespace() {
            continue;
        }
        let val = table[b as usize];
        if val == 255 {
            return None;
        }
        buf = (buf << 6) | (val as u32);
        bits += 6;
        if bits >= 8 {
            bits -= 8;
            out.push((buf >> bits) as u8);
        }
    }
    Some(out)
}

#[tauri::command]
fn save_exported_file_to_disk(file_path: String, data_base64: String) -> Result<(), String> {
    use std::fs;
    use std::path::Path;

    let path = Path::new(&file_path);
    if let Some(parent) = path.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent).map_err(|e| format!("تعذر إنشاء مجلد الوجهة: {}", e))?;
        }
    }

    let clean_b64 = if let Some(idx) = data_base64.find(',') {
        &data_base64[idx + 1..]
    } else {
        &data_base64
    };

    let bytes = match decode_base64_internal(clean_b64.trim()) {
        Some(b) => b,
        None => return Err("فشل فك ترميز بيانات الملف المصدّر (بيانات base64 غير صالحة)".into()),
    };

    fs::write(path, bytes).map_err(|e| format!("فشل كتابة الملف على القرص: {}", e))?;
    Ok(())
}

#[tauri::command]
fn check_path_exists(path: String) -> bool {
    std::path::Path::new(&path).exists()
}

#[tauri::command]
fn create_export_dir(path: String) -> Result<(), String> {
    let p = std::path::Path::new(&path);
    if !p.exists() {
        std::fs::create_dir_all(p).map_err(|e| format!("تعذر إنشاء المجلد: {}", e))?;
    }
    Ok(())
}

#[tauri::command]
fn save_export_storage_location(location: Option<String>) -> Result<(), String> {
    let mut dir = dirs::data_local_dir().unwrap_or_else(|| std::path::PathBuf::from("."));
    dir.push("CompuMSS");
    let _ = std::fs::create_dir_all(&dir);
    let config_file = dir.join("export_storage_config.json");
    if let Some(loc) = location {
        let json = serde_json::json!({
            "storageLocation": loc,
            "updatedAt": chrono::Utc::now().to_rfc3339(),
            "appName": "Compu MSS",
            "version": "1.0.5"
        });
        std::fs::write(&config_file, json.to_string()).map_err(|e| e.to_string())?;
    } else if config_file.exists() {
        let _ = std::fs::remove_file(&config_file);
    }
    Ok(())
}

#[tauri::command]
fn load_export_storage_location() -> Result<Option<String>, String> {
    let mut dir = dirs::data_local_dir().unwrap_or_else(|| std::path::PathBuf::from("."));
    dir.push("CompuMSS");
    let config_file = dir.join("export_storage_config.json");
    if config_file.exists() {
        let raw = std::fs::read_to_string(&config_file).map_err(|e| e.to_string())?;
        if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&raw) {
            if let Some(loc) = parsed.get("storageLocation").and_then(|v| v.as_str()) {
                if !loc.trim().is_empty() {
                    return Ok(Some(loc.trim().to_string()));
                }
            }
        }
    }
    Ok(None)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let conn = match init_db() {
        Ok(c) => c,
        Err(e) => {
            eprintln!("Failed to initialize accessories database: {}", e);
            panic!("Database initialization failed: {}", e);
        }
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(DbState {
            conn: Mutex::new(conn),
        })
        .invoke_handler(tauri::generate_handler![
            get_accessories_products,
            get_accessories_product_by_id,
            add_accessories_product,
            update_accessories_product,
            delete_accessories_product,
            search_accessories_products,
            get_accessories_categories,
            create_accessories_purchase,
            get_accessories_purchases,
            get_accessories_purchase_items,
            create_accessories_sale,
            get_accessories_invoices,
            get_accessories_invoice_items,
            create_accessories_return,
            get_accessories_returns,
            get_accessories_return_items,
            create_accessories_backup,
            create_multi_destination_backup,
            validate_backup_destination,
            get_accessories_backups,
            restore_accessories_backup,
            export_accessories_backup,
            select_backup_folder,
            select_save_backup_path,
            open_folder_in_explorer,
            get_windows_startup_status,
            set_windows_startup_status,
            adjust_accessories_stock,
            get_accessories_inventory_movements,
            get_accessories_db_status,
            save_secure_session,
            load_secure_session,
            clear_secure_session,
            save_exported_file_to_disk,
            check_path_exists,
            create_export_dir,
            save_export_storage_location,
            load_export_storage_location,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
