pub mod db;

use db::{
    create_backup_file, execute_stock_adjustment, export_backup_file, fetch_all_invoices,
    fetch_all_products, fetch_all_purchases, fetch_all_returns, fetch_categories,
    fetch_inventory_movements, fetch_invoice_items, fetch_product_by_id, fetch_purchase_items,
    fetch_return_items, init_db, insert_product, insert_purchase, insert_return, insert_sale,
    list_all_backups, restore_db_from_backup, search_products, update_product, BackupInfo,
    DbState, InventoryMovement, Invoice, InvoiceItem, NewProductInput, NewPurchaseInput,
    NewReturnInput, NewSaleInput, Product, Purchase, PurchaseItem, ReturnItemRecord,
    ReturnRecord, StockAdjustmentInput, UpdateProductInput,
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
fn select_backup_folder() -> Result<Option<String>, String> {
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        let script = r#"
            Add-Type -AssemblyName System.Windows.Forms
            $dialog = New-Object System.Windows.Forms.FolderBrowserDialog
            $dialog.Description = "اختر مجلد حفظ النسخ الاحتياطية"
            $dialog.ShowNewFolderButton = $true
            if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
                Write-Output $dialog.SelectedPath
            }
        "#;
        let output = Command::new("powershell")
            .args(["-NoProfile", "-WindowStyle", "Hidden", "-Command", script])
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
            .args(["-NoProfile", "-WindowStyle", "Hidden", "-Command", &script])
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
            get_accessories_backups,
            restore_accessories_backup,
            export_accessories_backup,
            select_backup_folder,
            select_save_backup_path,
            adjust_accessories_stock,
            get_accessories_inventory_movements,
            get_accessories_db_status,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
