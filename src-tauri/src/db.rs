use rusqlite::{params, Connection, Result};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Product {
    pub id: String,
    pub name: String,
    pub code: String,
    pub barcode: Option<String>,
    pub category: Option<String>,
    pub cost: f64,
    pub price: f64,
    pub stock: i64,
    pub low_stock_threshold: i64,
    pub description: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
pub struct NewProductInput {
    pub name: String,
    pub code: String,
    pub barcode: Option<String>,
    pub category: Option<String>,
    pub cost: f64,
    pub price: f64,
    pub stock: i64,
    pub low_stock_threshold: i64,
    pub description: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateProductInput {
    pub name: String,
    pub code: String,
    pub barcode: Option<String>,
    pub category: Option<String>,
    pub cost: f64,
    pub price: f64,
    pub stock: i64,
    pub low_stock_threshold: i64,
    pub description: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Purchase {
    pub id: String,
    pub purchase_number: String,
    pub purchase_date: String,
    pub supplier_name: Option<String>,
    pub supplier_phone: Option<String>,
    pub total_amount: f64,
    pub notes: Option<String>,
    pub items_count: i64,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PurchaseItem {
    pub id: String,
    pub purchase_id: String,
    pub product_id: String,
    pub product_name: String,
    pub product_code: String,
    pub quantity: i64,
    pub unit_cost: f64,
    pub total_cost: f64,
}

#[derive(Debug, Deserialize)]
pub struct NewPurchaseItemInput {
    pub product_id: String,
    pub quantity: i64,
    pub unit_cost: f64,
    pub update_product_cost: bool,
}

#[derive(Debug, Deserialize)]
pub struct NewPurchaseInput {
    pub purchase_number: String,
    pub purchase_date: String,
    pub supplier_name: Option<String>,
    pub supplier_phone: Option<String>,
    pub notes: Option<String>,
    pub items: Vec<NewPurchaseItemInput>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct InventoryMovement {
    pub id: String,
    pub product_id: String,
    pub product_name: String,
    pub product_code: String,
    pub movement_type: String, // 'PURCHASE', 'ADJUSTMENT_ADD', 'ADJUSTMENT_SUBTRACT', 'SALE', 'RETURN'
    pub quantity_change: i64,
    pub previous_stock: i64,
    pub new_stock: i64,
    pub reference_id: Option<String>,
    pub reason: String,
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
pub struct StockAdjustmentInput {
    pub product_id: String,
    pub adjustment_type: String, // 'ADD', 'SUBTRACT', 'SET'
    pub quantity: i64,
    pub reason: String,
    pub notes: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Invoice {
    pub id: String,
    pub invoice_number: String,
    pub invoice_date: String,
    pub customer_name: Option<String>,
    pub customer_phone: Option<String>,
    pub subtotal: f64,
    pub discount: f64,
    pub total_amount: f64,
    pub payment_method: String,
    pub notes: Option<String>,
    pub status: String,
    pub items_count: i64,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct InvoiceItem {
    pub id: String,
    pub invoice_id: String,
    pub product_id: String,
    pub product_name: String,
    pub product_code: String,
    pub barcode: Option<String>,
    pub quantity: i64,
    pub original_price: f64,
    pub discount: f64,
    pub actual_price: f64,
    pub cost_snapshot: f64,
    pub line_total: f64,
}

#[derive(Debug, Deserialize)]
pub struct NewSaleItemInput {
    pub product_id: String,
    pub quantity: i64,
    pub discount: f64,
}

#[derive(Debug, Deserialize)]
pub struct NewSaleInput {
    pub invoice_number: String,
    pub customer_name: Option<String>,
    pub customer_phone: Option<String>,
    pub invoice_discount: f64,
    pub payment_method: String,
    pub notes: Option<String>,
    pub items: Vec<NewSaleItemInput>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ReturnRecord {
    pub id: String,
    pub return_number: String,
    pub invoice_id: String,
    pub invoice_number: String,
    pub return_date: String,
    pub refund_amount: f64,
    pub refund_method: String,
    pub reason: String,
    pub notes: Option<String>,
    pub items_count: i64,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ReturnItemRecord {
    pub id: String,
    pub return_id: String,
    pub product_id: String,
    pub product_name: String,
    pub product_code: String,
    pub quantity_returned: i64,
    pub refund_unit_price: f64,
    pub line_refund_total: f64,
    pub restock_condition: String,
}

#[derive(Debug, Deserialize)]
pub struct NewReturnItemInput {
    pub product_id: String,
    pub quantity_returned: i64,
    pub refund_unit_price: f64,
    pub restock_condition: String,
}

#[derive(Debug, Deserialize)]
pub struct NewReturnInput {
    pub return_number: String,
    pub invoice_id: String,
    pub return_date: String,
    pub refund_amount: f64,
    pub refund_method: String,
    pub reason: String,
    pub notes: Option<String>,
    pub items: Vec<NewReturnItemInput>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BackupInfo {
    pub id: String,
    pub filename: String,
    pub filepath: String,
    pub size_bytes: u64,
    pub size_formatted: String,
    pub backup_type: String,
    pub date: String,
    pub status: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DestinationResult {
    pub path: String,
    pub status: String, // "success" or "failed"
    pub file_path: Option<String>,
    pub size_bytes: Option<u64>,
    pub size_formatted: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MultiBackupResult {
    pub id: String,
    pub filename: String,
    pub trigger_type: String, // "scheduled", "after_operation", "manual", "safeguard"
    pub date: String,
    pub overall_status: String, // "success", "partial", "failed"
    pub total_destinations: usize,
    pub successful_destinations: usize,
    pub failed_destinations: usize,
    pub destinations: Vec<DestinationResult>,
    pub size_bytes: u64,
    pub size_formatted: String,
    pub error_details: Option<String>,
}

pub struct DbState {
    pub conn: Mutex<Connection>,
}

pub fn get_db_path() -> PathBuf {
    let mut path = dirs::data_dir().unwrap_or_else(|| PathBuf::from("."));
    path.push("ShopManagementSystem");
    if !path.exists() {
        let _ = fs::create_dir_all(&path);
    }
    path.push("accessories.db");
    path
}

pub fn init_db() -> Result<Connection, rusqlite::Error> {
    let db_path = get_db_path();
    let conn = Connection::open(db_path)?;

    // Enable WAL mode for high concurrency and crash resilience
    conn.execute_batch("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;")?;

    // 1. Create accessories_products table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS accessories_products (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            code TEXT NOT NULL UNIQUE,
            barcode TEXT UNIQUE,
            category TEXT,
            cost REAL NOT NULL DEFAULT 0.0 CHECK (cost >= 0),
            price REAL NOT NULL DEFAULT 0.0 CHECK (price >= 0),
            stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
            low_stock_threshold INTEGER NOT NULL DEFAULT 5 CHECK (low_stock_threshold >= 0),
            description TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );",
        [],
    )?;

    // 2. Create accessories_purchases table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS accessories_purchases (
            id TEXT PRIMARY KEY,
            purchase_number TEXT NOT NULL UNIQUE,
            purchase_date TEXT NOT NULL,
            supplier_name TEXT,
            supplier_phone TEXT,
            total_amount REAL NOT NULL DEFAULT 0.0 CHECK (total_amount >= 0),
            notes TEXT,
            created_at TEXT NOT NULL
        );",
        [],
    )?;

    // 3. Create accessories_purchase_items table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS accessories_purchase_items (
            id TEXT PRIMARY KEY,
            purchase_id TEXT NOT NULL REFERENCES accessories_purchases(id) ON DELETE CASCADE,
            product_id TEXT NOT NULL REFERENCES accessories_products(id),
            quantity INTEGER NOT NULL CHECK (quantity > 0),
            unit_cost REAL NOT NULL CHECK (unit_cost >= 0),
            total_cost REAL NOT NULL CHECK (total_cost >= 0)
        );",
        [],
    )?;

    // 4. Create accessories_invoices table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS accessories_invoices (
            id TEXT PRIMARY KEY,
            invoice_number TEXT NOT NULL UNIQUE,
            invoice_date TEXT NOT NULL,
            customer_name TEXT,
            customer_phone TEXT,
            subtotal REAL NOT NULL CHECK (subtotal >= 0),
            discount REAL NOT NULL DEFAULT 0.0 CHECK (discount >= 0),
            total_amount REAL NOT NULL CHECK (total_amount >= 0),
            payment_method TEXT NOT NULL DEFAULT 'نقدي',
            notes TEXT,
            status TEXT NOT NULL DEFAULT 'COMPLETED',
            created_at TEXT NOT NULL
        );",
        [],
    )?;

    // 5. Create accessories_invoice_items table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS accessories_invoice_items (
            id TEXT PRIMARY KEY,
            invoice_id TEXT NOT NULL REFERENCES accessories_invoices(id) ON DELETE CASCADE,
            product_id TEXT NOT NULL REFERENCES accessories_products(id),
            product_name TEXT NOT NULL,
            product_code TEXT NOT NULL,
            barcode TEXT,
            quantity INTEGER NOT NULL CHECK (quantity > 0),
            original_price REAL NOT NULL CHECK (original_price >= 0),
            discount REAL NOT NULL DEFAULT 0.0 CHECK (discount >= 0),
            actual_price REAL NOT NULL CHECK (actual_price >= 0),
            cost_snapshot REAL NOT NULL CHECK (cost_snapshot >= 0),
            line_total REAL NOT NULL CHECK (line_total >= 0)
        );",
        [],
    )?;

    // 6. Create accessories_inventory_movements table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS accessories_inventory_movements (
            id TEXT PRIMARY KEY,
            product_id TEXT NOT NULL REFERENCES accessories_products(id),
            product_name TEXT NOT NULL,
            product_code TEXT NOT NULL,
            movement_type TEXT NOT NULL,
            quantity_change INTEGER NOT NULL,
            previous_stock INTEGER NOT NULL,
            new_stock INTEGER NOT NULL,
            reference_id TEXT,
            reason TEXT NOT NULL,
            created_at TEXT NOT NULL
        );",
        [],
    )?;

    // 7. Create accessories_returns table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS accessories_returns (
            id TEXT PRIMARY KEY,
            return_number TEXT NOT NULL UNIQUE,
            invoice_id TEXT NOT NULL REFERENCES accessories_invoices(id),
            invoice_number TEXT NOT NULL,
            return_date TEXT NOT NULL,
            refund_amount REAL NOT NULL CHECK (refund_amount >= 0),
            refund_method TEXT NOT NULL DEFAULT 'نقدي',
            reason TEXT NOT NULL,
            notes TEXT,
            created_at TEXT NOT NULL
        );",
        [],
    )?;

    // 8. Create accessories_return_items table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS accessories_return_items (
            id TEXT PRIMARY KEY,
            return_id TEXT NOT NULL REFERENCES accessories_returns(id) ON DELETE CASCADE,
            product_id TEXT NOT NULL REFERENCES accessories_products(id),
            product_name TEXT NOT NULL,
            product_code TEXT NOT NULL,
            quantity_returned INTEGER NOT NULL CHECK (quantity_returned > 0),
            refund_unit_price REAL NOT NULL CHECK (refund_unit_price >= 0),
            line_refund_total REAL NOT NULL CHECK (line_refund_total >= 0),
            restock_condition TEXT NOT NULL DEFAULT 'RESTOCKED'
        );",
        [],
    )?;

    // Indexes
    conn.execute("CREATE INDEX IF NOT EXISTS idx_accessories_products_code ON accessories_products(code);", [])?;
    conn.execute("CREATE INDEX IF NOT EXISTS idx_accessories_products_barcode ON accessories_products(barcode);", [])?;
    conn.execute("CREATE INDEX IF NOT EXISTS idx_accessories_products_name ON accessories_products(name);", [])?;
    conn.execute("CREATE INDEX IF NOT EXISTS idx_accessories_products_category ON accessories_products(category);", [])?;
    conn.execute("CREATE INDEX IF NOT EXISTS idx_purchases_number ON accessories_purchases(purchase_number);", [])?;
    conn.execute("CREATE INDEX IF NOT EXISTS idx_purchases_date ON accessories_purchases(purchase_date);", [])?;
    conn.execute("CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase ON accessories_purchase_items(purchase_id);", [])?;
    conn.execute("CREATE INDEX IF NOT EXISTS idx_purchase_items_product ON accessories_purchase_items(product_id);", [])?;
    conn.execute("CREATE INDEX IF NOT EXISTS idx_invoices_number ON accessories_invoices(invoice_number);", [])?;
    conn.execute("CREATE INDEX IF NOT EXISTS idx_invoices_date ON accessories_invoices(invoice_date);", [])?;
    conn.execute("CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON accessories_invoice_items(invoice_id);", [])?;
    conn.execute("CREATE INDEX IF NOT EXISTS idx_invoice_items_product ON accessories_invoice_items(product_id);", [])?;
    conn.execute("CREATE INDEX IF NOT EXISTS idx_returns_number ON accessories_returns(return_number);", [])?;
    conn.execute("CREATE INDEX IF NOT EXISTS idx_returns_invoice ON accessories_returns(invoice_id);", [])?;
    conn.execute("CREATE INDEX IF NOT EXISTS idx_returns_date ON accessories_returns(return_date);", [])?;
    conn.execute("CREATE INDEX IF NOT EXISTS idx_return_items_return ON accessories_return_items(return_id);", [])?;
    conn.execute("CREATE INDEX IF NOT EXISTS idx_return_items_product ON accessories_return_items(product_id);", [])?;
    conn.execute("CREATE INDEX IF NOT EXISTS idx_movements_product ON accessories_inventory_movements(product_id);", [])?;
    conn.execute("CREATE INDEX IF NOT EXISTS idx_movements_created ON accessories_inventory_movements(created_at);", [])?;

    Ok(conn)
}

// ---------------- PRODUCTS OPERATIONS ----------------

pub fn fetch_all_products(conn: &Connection) -> Result<Vec<Product>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, name, code, barcode, category, cost, price, stock, 
                    low_stock_threshold, description, created_at, updated_at 
             FROM accessories_products 
             ORDER BY updated_at DESC",
        )
        .map_err(|e| e.to_string())?;

    let product_iter = stmt
        .query_map([], |row| {
            Ok(Product {
                id: row.get(0)?,
                name: row.get(1)?,
                code: row.get(2)?,
                barcode: row.get(3)?,
                category: row.get(4)?,
                cost: row.get(5)?,
                price: row.get(6)?,
                stock: row.get(7)?,
                low_stock_threshold: row.get(8)?,
                description: row.get(9)?,
                created_at: row.get(10)?,
                updated_at: row.get(11)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut products = Vec::new();
    for p in product_iter {
        products.push(p.map_err(|e| e.to_string())?);
    }
    Ok(products)
}

pub fn fetch_product_by_id(conn: &Connection, id: &str) -> Result<Option<Product>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, name, code, barcode, category, cost, price, stock, 
                    low_stock_threshold, description, created_at, updated_at 
             FROM accessories_products 
             WHERE id = ?1",
        )
        .map_err(|e| e.to_string())?;

    let mut rows = stmt
        .query_map(params![id], |row| {
            Ok(Product {
                id: row.get(0)?,
                name: row.get(1)?,
                code: row.get(2)?,
                barcode: row.get(3)?,
                category: row.get(4)?,
                cost: row.get(5)?,
                price: row.get(6)?,
                stock: row.get(7)?,
                low_stock_threshold: row.get(8)?,
                description: row.get(9)?,
                created_at: row.get(10)?,
                updated_at: row.get(11)?,
            })
        })
        .map_err(|e| e.to_string())?;

    if let Some(result) = rows.next() {
        Ok(Some(result.map_err(|e| e.to_string())?))
    } else {
        Ok(None)
    }
}

pub fn insert_product(conn: &Connection, input: NewProductInput) -> Result<Product, String> {
    if input.name.trim().is_empty() {
        return Err("اسم المنتج مطلوب ولا يمكن أن يكون فارغاً".into());
    }
    if input.code.trim().is_empty() {
        return Err("كود الصنف مطلوب ولا يمكن أن يكون فارغاً".into());
    }
    if input.cost < 0.0 {
        return Err("سعر التكلفة لا يمكن أن يكون سالباً".into());
    }
    if input.price < 0.0 {
        return Err("سعر البيع لا يمكن أن يكون سالباً".into());
    }
    if input.stock < 0 {
        return Err("الكمية المتوفرة لا يمكن أن تكون سالبة".into());
    }
    if input.low_stock_threshold < 0 {
        return Err("حد التنبيه لا يمكن أن يكون سالباً".into());
    }

    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Local::now().to_rfc3339();

    let clean_barcode = input
        .barcode
        .map(|b| b.trim().to_string())
        .filter(|b| !b.is_empty());
    let clean_category = input
        .category
        .map(|c| c.trim().to_string())
        .filter(|c| !c.is_empty());
    let clean_desc = input
        .description
        .map(|d| d.trim().to_string())
        .filter(|d| !d.is_empty());

    conn.execute(
        "INSERT INTO accessories_products 
            (id, name, code, barcode, category, cost, price, stock, low_stock_threshold, description, created_at, updated_at) 
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
        params![
            id,
            input.name.trim(),
            input.code.trim(),
            clean_barcode,
            clean_category,
            input.cost,
            input.price,
            input.stock,
            input.low_stock_threshold,
            clean_desc,
            now,
            now,
        ],
    ).map_err(|e| {
        if e.to_string().contains("UNIQUE constraint failed: accessories_products.code") {
            "كود الصنف مسجل مسبقاً لصنف آخر. يرجى اختيار كود فريد.".to_string()
        } else if e.to_string().contains("UNIQUE constraint failed: accessories_products.barcode") {
            "الباركود مسجل مسبقاً لصنف آخر.".to_string()
        } else {
            e.to_string()
        }
    })?;

    Ok(Product {
        id,
        name: input.name.trim().to_string(),
        code: input.code.trim().to_string(),
        barcode: clean_barcode,
        category: clean_category,
        cost: input.cost,
        price: input.price,
        stock: input.stock,
        low_stock_threshold: input.low_stock_threshold,
        description: clean_desc,
        created_at: now.clone(),
        updated_at: now,
    })
}

pub fn update_product(
    conn: &Connection,
    id: &str,
    input: UpdateProductInput,
) -> Result<Product, String> {
    if input.name.trim().is_empty() {
        return Err("اسم المنتج مطلوب".into());
    }
    if input.code.trim().is_empty() {
        return Err("كود الصنف مطلوب".into());
    }
    if input.cost < 0.0 {
        return Err("سعر التكلفة لا يمكن أن يكون سالباً".into());
    }
    if input.price < 0.0 {
        return Err("سعر البيع لا يمكن أن يكون سالباً".into());
    }
    if input.stock < 0 {
        return Err("الكمية المتوفرة لا يمكن أن تكون سالبة".into());
    }
    if input.low_stock_threshold < 0 {
        return Err("حد التنبيه لا يمكن أن يكون سالباً".into());
    }

    let now = chrono::Local::now().to_rfc3339();
    let clean_barcode = input
        .barcode
        .map(|b| b.trim().to_string())
        .filter(|b| !b.is_empty());
    let clean_category = input
        .category
        .map(|c| c.trim().to_string())
        .filter(|c| !c.is_empty());
    let clean_desc = input
        .description
        .map(|d| d.trim().to_string())
        .filter(|d| !d.is_empty());

    let rows_affected = conn.execute(
        "UPDATE accessories_products 
         SET name = ?1, code = ?2, barcode = ?3, category = ?4, cost = ?5, 
             price = ?6, stock = ?7, low_stock_threshold = ?8, description = ?9, updated_at = ?10
         WHERE id = ?11",
        params![
            input.name.trim(),
            input.code.trim(),
            clean_barcode,
            clean_category,
            input.cost,
            input.price,
            input.stock,
            input.low_stock_threshold,
            clean_desc,
            now,
            id,
        ],
    ).map_err(|e| {
        if e.to_string().contains("UNIQUE constraint failed: accessories_products.code") {
            "كود الصنف مسجل مسبقاً لصنف آخر.".to_string()
        } else if e.to_string().contains("UNIQUE constraint failed: accessories_products.barcode") {
            "الباركود مسجل مسبقاً لصنف آخر.".to_string()
        } else {
            e.to_string()
        }
    })?;

    if rows_affected == 0 {
        return Err("لم يتم العثور على المنتج المطلوب لتعديله".into());
    }

    fetch_product_by_id(conn, id)?.ok_or_else(|| "فشل استرجاع الصنف بعد التعديل".into())
}

pub fn delete_product(conn: &Connection, id: &str) -> Result<(), String> {
    let rows_affected = conn
        .execute("DELETE FROM accessories_products WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;

    if rows_affected == 0 {
        return Err("لم يتم العثور على الصنف لحذفه".into());
    }
    Ok(())
}

pub fn search_products(conn: &Connection, query: &str) -> Result<Vec<Product>, String> {
    let trimmed = query.trim();
    if trimmed.is_empty() {
        return fetch_all_products(conn);
    }

    let pattern = format!("%{}%", trimmed);
    let mut stmt = conn
        .prepare(
            "SELECT id, name, code, barcode, category, cost, price, stock, 
                    low_stock_threshold, description, created_at, updated_at 
             FROM accessories_products 
             WHERE name LIKE ?1 OR code LIKE ?1 OR barcode LIKE ?1 OR category LIKE ?1
             ORDER BY updated_at DESC",
        )
        .map_err(|e| e.to_string())?;

    let product_iter = stmt
        .query_map(params![pattern], |row| {
            Ok(Product {
                id: row.get(0)?,
                name: row.get(1)?,
                code: row.get(2)?,
                barcode: row.get(3)?,
                category: row.get(4)?,
                cost: row.get(5)?,
                price: row.get(6)?,
                stock: row.get(7)?,
                low_stock_threshold: row.get(8)?,
                description: row.get(9)?,
                created_at: row.get(10)?,
                updated_at: row.get(11)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut products = Vec::new();
    for p in product_iter {
        products.push(p.map_err(|e| e.to_string())?);
    }
    Ok(products)
}

pub fn fetch_categories(conn: &Connection) -> Result<Vec<String>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT DISTINCT category 
             FROM accessories_products 
             WHERE category IS NOT NULL AND category != '' 
             ORDER BY category ASC",
        )
        .map_err(|e| e.to_string())?;

    let cat_iter = stmt
        .query_map([], |row| row.get::<_, String>(0))
        .map_err(|e| e.to_string())?;

    let mut categories = Vec::new();
    for c in cat_iter {
        categories.push(c.map_err(|e| e.to_string())?);
    }
    Ok(categories)
}

// ---------------- PURCHASES OPERATIONS ----------------

pub fn insert_purchase(conn: &mut Connection, input: NewPurchaseInput) -> Result<Purchase, String> {
    let purchase_num = input.purchase_number.trim();
    if purchase_num.is_empty() {
        return Err("رقم فاتورة الشراء مطلوب".into());
    }
    if input.items.is_empty() {
        return Err("يجب إضافة صنف واحد على الأقل في فاتورة الشراء".into());
    }

    let purchase_id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Local::now().to_rfc3339();

    let tx = conn.transaction().map_err(|e| e.to_string())?;
    let mut total_amount: f64 = 0.0;

    for item in &input.items {
        if item.quantity <= 0 {
            return Err("كمية الشراء يجب أن تكون أكبر من صفر".into());
        }
        if item.unit_cost < 0.0 {
            return Err("سعر تكلفة الشراء لا يمكن أن يكون سالباً".into());
        }
        total_amount += (item.quantity as f64) * item.unit_cost;
    }

    tx.execute(
        "INSERT INTO accessories_purchases 
            (id, purchase_number, purchase_date, supplier_name, supplier_phone, total_amount, notes, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![
            purchase_id,
            purchase_num,
            input.purchase_date.trim(),
            input.supplier_name.as_deref().map(|s| s.trim()).filter(|s| !s.is_empty()),
            input.supplier_phone.as_deref().map(|s| s.trim()).filter(|s| !s.is_empty()),
            total_amount,
            input.notes.as_deref().map(|s| s.trim()).filter(|s| !s.is_empty()),
            now,
        ],
    ).map_err(|e| {
        if e.to_string().contains("UNIQUE constraint failed: accessories_purchases.purchase_number") {
            "رقم فاتورة الشراء مسجل مسبقاً. يرجى اختيار رقم فاتورة فريد.".to_string()
        } else {
            e.to_string()
        }
    })?;

    for item in &input.items {
        let (name, code, previous_stock): (String, String, i64) = tx
            .query_row(
                "SELECT name, code, stock FROM accessories_products WHERE id = ?1",
                params![item.product_id],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
            )
            .map_err(|_| format!("الصنف بالمعرف '{}' غير موجود", item.product_id))?;

        let new_stock = previous_stock + item.quantity;
        let item_id = uuid::Uuid::new_v4().to_string();
        let movement_id = uuid::Uuid::new_v4().to_string();
        let line_total = (item.quantity as f64) * item.unit_cost;

        tx.execute(
            "INSERT INTO accessories_purchase_items 
                (id, purchase_id, product_id, quantity, unit_cost, total_cost)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![item_id, purchase_id, item.product_id, item.quantity, item.unit_cost, line_total],
        ).map_err(|e| e.to_string())?;

        if item.update_product_cost {
            tx.execute(
                "UPDATE accessories_products SET stock = ?1, cost = ?2, updated_at = ?3 WHERE id = ?4",
                params![new_stock, item.unit_cost, now, item.product_id],
            ).map_err(|e| e.to_string())?;
        } else {
            tx.execute(
                "UPDATE accessories_products SET stock = ?1, updated_at = ?2 WHERE id = ?3",
                params![new_stock, now, item.product_id],
            ).map_err(|e| e.to_string())?;
        }

        let reason_text = format!("وارد مشتريات فاتورة رقم {}", purchase_num);
        tx.execute(
            "INSERT INTO accessories_inventory_movements
                (id, product_id, product_name, product_code, movement_type, quantity_change, previous_stock, new_stock, reference_id, reason, created_at)
             VALUES (?1, ?2, ?3, ?4, 'PURCHASE', ?5, ?6, ?7, ?8, ?9, ?10)",
            params![
                movement_id,
                item.product_id,
                name,
                code,
                item.quantity,
                previous_stock,
                new_stock,
                purchase_id,
                reason_text,
                now,
            ],
        ).map_err(|e| e.to_string())?;
    }

    tx.commit().map_err(|e| e.to_string())?;

    Ok(Purchase {
        id: purchase_id,
        purchase_number: purchase_num.to_string(),
        purchase_date: input.purchase_date.trim().to_string(),
        supplier_name: input.supplier_name.map(|s| s.trim().to_string()).filter(|s| !s.is_empty()),
        supplier_phone: input.supplier_phone.map(|s| s.trim().to_string()).filter(|s| !s.is_empty()),
        total_amount,
        notes: input.notes.map(|s| s.trim().to_string()).filter(|s| !s.is_empty()),
        items_count: input.items.len() as i64,
        created_at: now,
    })
}

pub fn fetch_all_purchases(conn: &Connection) -> Result<Vec<Purchase>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT p.id, p.purchase_number, p.purchase_date, p.supplier_name, 
                    p.supplier_phone, p.total_amount, p.notes, COUNT(i.id), p.created_at
             FROM accessories_purchases p
             LEFT JOIN accessories_purchase_items i ON p.id = i.purchase_id
             GROUP BY p.id
             ORDER BY p.purchase_date DESC, p.created_at DESC",
        )
        .map_err(|e| e.to_string())?;

    let purchase_iter = stmt
        .query_map([], |row| {
            Ok(Purchase {
                id: row.get(0)?,
                purchase_number: row.get(1)?,
                purchase_date: row.get(2)?,
                supplier_name: row.get(3)?,
                supplier_phone: row.get(4)?,
                total_amount: row.get(5)?,
                notes: row.get(6)?,
                items_count: row.get(7)?,
                created_at: row.get(8)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut purchases = Vec::new();
    for p in purchase_iter {
        purchases.push(p.map_err(|e| e.to_string())?);
    }
    Ok(purchases)
}

pub fn fetch_purchase_items(conn: &Connection, purchase_id: &str) -> Result<Vec<PurchaseItem>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT i.id, i.purchase_id, i.product_id, pr.name, pr.code, 
                    i.quantity, i.unit_cost, i.total_cost
             FROM accessories_purchase_items i
             JOIN accessories_products pr ON i.product_id = pr.id
             WHERE i.purchase_id = ?1
             ORDER BY pr.name ASC",
        )
        .map_err(|e| e.to_string())?;

    let item_iter = stmt
        .query_map(params![purchase_id], |row| {
            Ok(PurchaseItem {
                id: row.get(0)?,
                purchase_id: row.get(1)?,
                product_id: row.get(2)?,
                product_name: row.get(3)?,
                product_code: row.get(4)?,
                quantity: row.get(5)?,
                unit_cost: row.get(6)?,
                total_cost: row.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut items = Vec::new();
    for i in item_iter {
        items.push(i.map_err(|e| e.to_string())?);
    }
    Ok(items)
}

// ---------------- SALES & INVOICES OPERATIONS ----------------

pub fn insert_sale(conn: &mut Connection, input: NewSaleInput) -> Result<Invoice, String> {
    let inv_num = input.invoice_number.trim();
    if inv_num.is_empty() {
        return Err("رقم فاتورة المبيعات مطلوب".into());
    }
    if input.items.is_empty() {
        return Err("سلة المبيعات فارغة، يرجى إضافة صنف واحد على الأقل".into());
    }

    let invoice_id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Local::now().to_rfc3339();
    let today_date = now.chars().take(10).collect::<String>();

    let tx = conn.transaction().map_err(|e| e.to_string())?;

    // Pre-validate stock and prices for all items
    let mut subtotal: f64 = 0.0;
    struct ProcessedSaleItem {
        product_id: String,
        name: String,
        code: String,
        barcode: Option<String>,
        quantity: i64,
        previous_stock: i64,
        new_stock: i64,
        original_price: f64,
        discount: f64,
        actual_price: f64,
        cost_snapshot: f64,
        line_total: f64,
    }

    let mut processed_items = Vec::new();

    for item in &input.items {
        if item.quantity <= 0 {
            return Err("كمية البيع يجب أن تكون أكبر من صفر".into());
        }

        let (name, code, barcode, stock, price, cost): (String, String, Option<String>, i64, f64, f64) = tx
            .query_row(
                "SELECT name, code, barcode, stock, price, cost FROM accessories_products WHERE id = ?1",
                params![item.product_id],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?, row.get(5)?)),
            )
            .map_err(|_| format!("الصنف بالمعرف '{}' غير موجود", item.product_id))?;

        if stock < item.quantity {
            return Err(format!(
                "رصيد الصنف '{}' غير كافٍ لإتمام البيع. المتوفر حالياً: {} قطعة، والمطلوب بيعه: {} قطعة",
                name, stock, item.quantity
            ));
        }

        if item.discount < 0.0 {
            return Err("خصم البند لا يمكن أن يكون سالباً".into());
        }
        if item.discount > price {
            return Err(format!("الخصم على صنف '{}' لا يمكن أن يتجاوز سعر بيعه", name));
        }

        let actual_price = price - item.discount;
        let line_total = (item.quantity as f64) * actual_price;
        subtotal += line_total;

        let new_stock = stock - item.quantity;

        processed_items.push(ProcessedSaleItem {
            product_id: item.product_id.clone(),
            name,
            code,
            barcode,
            quantity: item.quantity,
            previous_stock: stock,
            new_stock,
            original_price: price,
            discount: item.discount,
            actual_price,
            cost_snapshot: cost,
            line_total,
        });
    }

    if input.invoice_discount < 0.0 {
        return Err("خصم الفاتورة لا يمكن أن يكون سالباً".into());
    }
    if input.invoice_discount > subtotal {
        return Err("خصم الفاتورة الإجمالي لا يمكن أن يتجاوز مجموع الأصناف".into());
    }

    let final_total = subtotal - input.invoice_discount;

    // 1. Insert invoice record
    tx.execute(
        "INSERT INTO accessories_invoices 
            (id, invoice_number, invoice_date, customer_name, customer_phone, subtotal, discount, total_amount, payment_method, notes, status, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, 'COMPLETED', ?11)",
        params![
            invoice_id,
            inv_num,
            today_date,
            input.customer_name.as_deref().map(|s| s.trim()).filter(|s| !s.is_empty()),
            input.customer_phone.as_deref().map(|s| s.trim()).filter(|s| !s.is_empty()),
            subtotal,
            input.invoice_discount,
            final_total,
            input.payment_method.trim(),
            input.notes.as_deref().map(|s| s.trim()).filter(|s| !s.is_empty()),
            now,
        ],
    ).map_err(|e| {
        if e.to_string().contains("UNIQUE constraint failed: accessories_invoices.invoice_number") {
            "رقم فاتورة المبيعات مسجل مسبقاً. يرجى استخدام رقم فريد.".to_string()
        } else {
            e.to_string()
        }
    })?;

    // 2. Insert invoice items, deduct inventory, and record movement
    for p_item in processed_items {
        let item_id = uuid::Uuid::new_v4().to_string();
        let movement_id = uuid::Uuid::new_v4().to_string();

        tx.execute(
            "INSERT INTO accessories_invoice_items 
                (id, invoice_id, product_id, product_name, product_code, barcode, quantity, original_price, discount, actual_price, cost_snapshot, line_total)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
            params![
                item_id,
                invoice_id,
                p_item.product_id,
                p_item.name,
                p_item.code,
                p_item.barcode,
                p_item.quantity,
                p_item.original_price,
                p_item.discount,
                p_item.actual_price,
                p_item.cost_snapshot,
                p_item.line_total,
            ],
        ).map_err(|e| e.to_string())?;

        // Deduct product stock
        tx.execute(
            "UPDATE accessories_products SET stock = ?1, updated_at = ?2 WHERE id = ?3",
            params![p_item.new_stock, now, p_item.product_id],
        ).map_err(|e| e.to_string())?;

        // Record inventory movement
        let reason_text = format!("صرف مبيعات فاتورة رقم {}", inv_num);
        tx.execute(
            "INSERT INTO accessories_inventory_movements
                (id, product_id, product_name, product_code, movement_type, quantity_change, previous_stock, new_stock, reference_id, reason, created_at)
             VALUES (?1, ?2, ?3, ?4, 'SALE', ?5, ?6, ?7, ?8, ?9, ?10)",
            params![
                movement_id,
                p_item.product_id,
                p_item.name,
                p_item.code,
                -p_item.quantity,
                p_item.previous_stock,
                p_item.new_stock,
                invoice_id,
                reason_text,
                now,
            ],
        ).map_err(|e| e.to_string())?;
    }

    tx.commit().map_err(|e| e.to_string())?;

    Ok(Invoice {
        id: invoice_id,
        invoice_number: inv_num.to_string(),
        invoice_date: today_date,
        customer_name: input.customer_name.map(|s| s.trim().to_string()).filter(|s| !s.is_empty()),
        customer_phone: input.customer_phone.map(|s| s.trim().to_string()).filter(|s| !s.is_empty()),
        subtotal,
        discount: input.invoice_discount,
        total_amount: final_total,
        payment_method: input.payment_method.trim().to_string(),
        notes: input.notes.map(|s| s.trim().to_string()).filter(|s| !s.is_empty()),
        status: "COMPLETED".to_string(),
        items_count: input.items.len() as i64,
        created_at: now,
    })
}

pub fn fetch_all_invoices(conn: &Connection) -> Result<Vec<Invoice>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT inv.id, inv.invoice_number, inv.invoice_date, inv.customer_name, 
                    inv.customer_phone, inv.subtotal, inv.discount, inv.total_amount, 
                    inv.payment_method, inv.notes, inv.status, COUNT(i.id), inv.created_at
             FROM accessories_invoices inv
             LEFT JOIN accessories_invoice_items i ON inv.id = i.invoice_id
             GROUP BY inv.id
             ORDER BY inv.created_at DESC",
        )
        .map_err(|e| e.to_string())?;

    let invoice_iter = stmt
        .query_map([], |row| {
            Ok(Invoice {
                id: row.get(0)?,
                invoice_number: row.get(1)?,
                invoice_date: row.get(2)?,
                customer_name: row.get(3)?,
                customer_phone: row.get(4)?,
                subtotal: row.get(5)?,
                discount: row.get(6)?,
                total_amount: row.get(7)?,
                payment_method: row.get(8)?,
                notes: row.get(9)?,
                status: row.get(10)?,
                items_count: row.get(11)?,
                created_at: row.get(12)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut invoices = Vec::new();
    for inv in invoice_iter {
        invoices.push(inv.map_err(|e| e.to_string())?);
    }
    Ok(invoices)
}

pub fn fetch_invoice_items(conn: &Connection, invoice_id: &str) -> Result<Vec<InvoiceItem>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, invoice_id, product_id, product_name, product_code, barcode, 
                    quantity, original_price, discount, actual_price, cost_snapshot, line_total
             FROM accessories_invoice_items
             WHERE invoice_id = ?1
             ORDER BY product_name ASC",
        )
        .map_err(|e| e.to_string())?;

    let item_iter = stmt
        .query_map(params![invoice_id], |row| {
            Ok(InvoiceItem {
                id: row.get(0)?,
                invoice_id: row.get(1)?,
                product_id: row.get(2)?,
                product_name: row.get(3)?,
                product_code: row.get(4)?,
                barcode: row.get(5)?,
                quantity: row.get(6)?,
                original_price: row.get(7)?,
                discount: row.get(8)?,
                actual_price: row.get(9)?,
                cost_snapshot: row.get(10)?,
                line_total: row.get(11)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut items = Vec::new();
    for i in item_iter {
        items.push(i.map_err(|e| e.to_string())?);
    }
    Ok(items)
}

// ---------------- INVENTORY ADJUSTMENT & MOVEMENTS ----------------

pub fn execute_stock_adjustment(
    conn: &mut Connection,
    input: StockAdjustmentInput,
) -> Result<InventoryMovement, String> {
    let reason_clean = input.reason.trim();
    if reason_clean.is_empty() {
        return Err("سبب التسوية الجردية مطلوب وإلزامي".into());
    }

    let tx = conn.transaction().map_err(|e| e.to_string())?;

    let (name, code, previous_stock): (String, String, i64) = tx
        .query_row(
            "SELECT name, code, stock FROM accessories_products WHERE id = ?1",
            params![input.product_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .map_err(|_| "الصنف غير موجود".to_string())?;

    let (new_stock, quantity_change, movement_type) = match input.adjustment_type.as_str() {
        "ADD" => {
            if input.quantity <= 0 {
                return Err("كمية الزيادة يجب أن تكون أكبر من صفر".into());
            }
            (previous_stock + input.quantity, input.quantity, "ADJUSTMENT_ADD")
        }
        "SUBTRACT" => {
            if input.quantity <= 0 {
                return Err("كمية الخصم يجب أن تكون أكبر من صفر".into());
            }
            if previous_stock < input.quantity {
                return Err(format!(
                    "لا يمكن خصم {} قطع لأن الرصيد الحالي {} قطع فقط",
                    input.quantity, previous_stock
                ));
            }
            (previous_stock - input.quantity, -input.quantity, "ADJUSTMENT_SUBTRACT")
        }
        "SET" => {
            if input.quantity < 0 {
                return Err("الرصيد الفعلي لا يمكن أن يكون سالباً".into());
            }
            let change = input.quantity - previous_stock;
            let m_type = if change >= 0 { "ADJUSTMENT_ADD" } else { "ADJUSTMENT_SUBTRACT" };
            (input.quantity, change, m_type)
        }
        _ => return Err("نوع التسوية الجردية غير معروف".into()),
    };

    let now = chrono::Local::now().to_rfc3339();
    let movement_id = uuid::Uuid::new_v4().to_string();

    tx.execute(
        "UPDATE accessories_products SET stock = ?1, updated_at = ?2 WHERE id = ?3",
        params![new_stock, now, input.product_id],
    ).map_err(|e| e.to_string())?;

    let full_reason = match input.notes {
        Some(notes) if !notes.trim().is_empty() => format!("{} - {}", reason_clean, notes.trim()),
        _ => reason_clean.to_string(),
    };

    tx.execute(
        "INSERT INTO accessories_inventory_movements
            (id, product_id, product_name, product_code, movement_type, quantity_change, previous_stock, new_stock, reason, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        params![
            movement_id,
            input.product_id,
            name,
            code,
            movement_type,
            quantity_change,
            previous_stock,
            new_stock,
            full_reason,
            now,
        ],
    ).map_err(|e| e.to_string())?;

    tx.commit().map_err(|e| e.to_string())?;

    Ok(InventoryMovement {
        id: movement_id,
        product_id: input.product_id,
        product_name: name,
        product_code: code,
        movement_type: movement_type.to_string(),
        quantity_change,
        previous_stock,
        new_stock,
        reference_id: None,
        reason: full_reason,
        created_at: now,
    })
}

pub fn fetch_inventory_movements(
    conn: &Connection,
    product_id: Option<&str>,
    limit: i64,
) -> Result<Vec<InventoryMovement>, String> {
    let limit_safe = if limit <= 0 { 100 } else { limit };
    let mut movements = Vec::new();

    if let Some(pid) = product_id {
        let mut stmt = conn
            .prepare(
                "SELECT id, product_id, product_name, product_code, movement_type, 
                        quantity_change, previous_stock, new_stock, reference_id, reason, created_at
                 FROM accessories_inventory_movements
                 WHERE product_id = ?1
                 ORDER BY created_at DESC
                 LIMIT ?2",
            )
            .map_err(|e| e.to_string())?;

        let iter = stmt
            .query_map(params![pid, limit_safe], |row| {
                Ok(InventoryMovement {
                    id: row.get(0)?,
                    product_id: row.get(1)?,
                    product_name: row.get(2)?,
                    product_code: row.get(3)?,
                    movement_type: row.get(4)?,
                    quantity_change: row.get(5)?,
                    previous_stock: row.get(6)?,
                    new_stock: row.get(7)?,
                    reference_id: row.get(8)?,
                    reason: row.get(9)?,
                    created_at: row.get(10)?,
                })
            })
            .map_err(|e| e.to_string())?;

        for m in iter {
            movements.push(m.map_err(|e| e.to_string())?);
        }
    } else {
        let mut stmt = conn
            .prepare(
                "SELECT id, product_id, product_name, product_code, movement_type, 
                        quantity_change, previous_stock, new_stock, reference_id, reason, created_at
                 FROM accessories_inventory_movements
                 ORDER BY created_at DESC
                 LIMIT ?1",
            )
            .map_err(|e| e.to_string())?;

        let iter = stmt
            .query_map(params![limit_safe], |row| {
                Ok(InventoryMovement {
                    id: row.get(0)?,
                    product_id: row.get(1)?,
                    product_name: row.get(2)?,
                    product_code: row.get(3)?,
                    movement_type: row.get(4)?,
                    quantity_change: row.get(5)?,
                    previous_stock: row.get(6)?,
                    new_stock: row.get(7)?,
                    reference_id: row.get(8)?,
                    reason: row.get(9)?,
                    created_at: row.get(10)?,
                })
            })
            .map_err(|e| e.to_string())?;

        for m in iter {
            movements.push(m.map_err(|e| e.to_string())?);
        }
    }

    Ok(movements)
}

// ---------------- RETURNS & REFUNDS OPERATIONS ----------------

pub fn insert_return(conn: &mut Connection, input: NewReturnInput) -> Result<ReturnRecord, String> {
    let ret_num = input.return_number.trim();
    if ret_num.is_empty() {
        return Err("رقم حركة الإرجاع مطلوب".into());
    }
    let reason_clean = input.reason.trim();
    if reason_clean.is_empty() {
        return Err("سبب الإرجاع إلزامي لضمان تتبع الحركات المالية والمخزنية".into());
    }
    if input.items.is_empty() {
        return Err("يجب تحديد صنف واحد على الأقل للإرجاع".into());
    }

    // Check that invoice exists
    let invoice_res: Result<(String, f64, String), rusqlite::Error> = conn.query_row(
        "SELECT invoice_number, total_amount, status FROM accessories_invoices WHERE id = ?1",
        params![input.invoice_id],
        |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
    );

    let (invoice_number, invoice_total, current_status) = match invoice_res {
        Ok(data) => data,
        Err(_) => return Err("الفاتورة الأصلية غير موجودة".into()),
    };

    if current_status == "RETURNED_FULL" {
        return Err("تم استرجاع هذه الفاتورة بالكامل مسبقاً ولا يمكن إضافة مرتجع جديد لها".into());
    }

    let return_id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Local::now().to_rfc3339();
    let local_today = chrono::Local::now().format("%Y-%m-%d").to_string();
    let today_date = if input.return_date.trim().is_empty() {
        local_today.clone()
    } else {
        input.return_date.trim().to_string()
    };

    if today_date > local_today {
        return Err(format!("تاريخ الإرجاع ({}) لا يمكن أن يكون في المستقبل. أقصى تاريخ هو اليوم ({}).", today_date, local_today));
    }

    let tx = conn.transaction().map_err(|e| e.to_string())?;

    // Check return_number unique
    let dup_check: Result<i64, _> = tx.query_row(
        "SELECT COUNT(*) FROM accessories_returns WHERE return_number = ?1",
        params![ret_num],
        |row| row.get(0),
    );
    if let Ok(cnt) = dup_check {
        if cnt > 0 {
            return Err(format!("رقم حركة الإرجاع '{}' مسجل مسبقاً", ret_num));
        }
    }

    // Process return items
    struct ProcessedReturnItem {
        product_id: String,
        name: String,
        code: String,
        quantity_returned: i64,
        refund_unit_price: f64,
        line_refund_total: f64,
        restock_condition: String,
        current_stock: i64,
    }

    let mut processed_items = Vec::new();
    let mut calculated_refund_total = 0.0;

    for r_item in &input.items {
        if r_item.quantity_returned <= 0 {
            return Err("كمية الصنف المرتجع يجب أن تكون أكبر من صفر".into());
        }
        if r_item.refund_unit_price < 0.0 {
            return Err("سعر الوحدة المسترد لا يمكن أن يكون سالباً".into());
        }

        // Verify product exists
        let prod_res: Result<(String, String, i64), _> = tx.query_row(
            "SELECT name, code, stock FROM accessories_products WHERE id = ?1",
            params![r_item.product_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        );
        let (name, code, stock) = match prod_res {
            Ok(p) => p,
            Err(_) => return Err(format!("الصنف بالمعرف {} غير موجود", r_item.product_id)),
        };

        // Verify product was sold in this invoice and calculate remaining returnable quantity
        let sold_qty: i64 = match tx.query_row(
            "SELECT quantity FROM accessories_invoice_items WHERE invoice_id = ?1 AND product_id = ?2",
            params![input.invoice_id, r_item.product_id],
            |row| row.get(0),
        ) {
            Ok(q) => q,
            Err(_) => return Err(format!("الصنف '{}' لم يتم بيعه في الفاتورة المحددة", name)),
        };

        let prev_returned: i64 = tx.query_row(
            "SELECT COALESCE(SUM(ri.quantity_returned), 0)
             FROM accessories_return_items ri
             JOIN accessories_returns r ON ri.return_id = r.id
             WHERE r.invoice_id = ?1 AND ri.product_id = ?2",
            params![input.invoice_id, r_item.product_id],
            |row| row.get(0),
        ).unwrap_or(0);

        let remaining_returnable = (sold_qty - prev_returned).max(0);
        if r_item.quantity_returned > remaining_returnable {
            return Err(format!(
                "الكمية المطلوب إرجاعها ({}) للصنف '{}' تتجاوز الكمية المتبقية القابلة للإرجاع ({})",
                r_item.quantity_returned, name, remaining_returnable
            ));
        }

        let line_refund = r_item.refund_unit_price * (r_item.quantity_returned as f64);
        calculated_refund_total += line_refund;

        let condition = if r_item.restock_condition.trim().to_uppercase() == "DAMAGED" {
            "DAMAGED".to_string()
        } else {
            "RESTOCKED".to_string()
        };

        processed_items.push(ProcessedReturnItem {
            product_id: r_item.product_id.clone(),
            name,
            code,
            quantity_returned: r_item.quantity_returned,
            refund_unit_price: r_item.refund_unit_price,
            line_refund_total: line_refund,
            restock_condition: condition,
            current_stock: stock,
        });
    }

    let actual_refund_amount = if input.refund_amount > 0.0 {
        input.refund_amount
    } else {
        calculated_refund_total
    };

    // 1. Insert return record
    tx.execute(
        "INSERT INTO accessories_returns 
            (id, return_number, invoice_id, invoice_number, return_date, refund_amount, refund_method, reason, notes, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        params![
            return_id,
            ret_num,
            input.invoice_id,
            invoice_number,
            today_date,
            actual_refund_amount,
            input.refund_method.trim(),
            reason_clean,
            input.notes.as_deref().map(|s| s.trim()).filter(|s| !s.is_empty()),
            now,
        ],
    ).map_err(|e| e.to_string())?;

    // 2. Insert items and restock inventory if condition is RESTOCKED
    for p_item in &processed_items {
        let item_id = uuid::Uuid::new_v4().to_string();
        tx.execute(
            "INSERT INTO accessories_return_items 
                (id, return_id, product_id, product_name, product_code, quantity_returned, refund_unit_price, line_refund_total, restock_condition)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                item_id,
                return_id,
                p_item.product_id,
                p_item.name,
                p_item.code,
                p_item.quantity_returned,
                p_item.refund_unit_price,
                p_item.line_refund_total,
                p_item.restock_condition,
            ],
        ).map_err(|e| e.to_string())?;

        // Restock inventory if condition is RESTOCKED
        if p_item.restock_condition == "RESTOCKED" {
            let previous_stock = p_item.current_stock;
            let new_stock = previous_stock + p_item.quantity_returned;

            tx.execute(
                "UPDATE accessories_products SET stock = ?1, updated_at = ?2 WHERE id = ?3",
                params![new_stock, now, p_item.product_id],
            ).map_err(|e| e.to_string())?;

            let movement_id = uuid::Uuid::new_v4().to_string();
            let movement_reason = format!("مرتجع مبيعات فاتورة رقم {} - {}", invoice_number, reason_clean);

            tx.execute(
                "INSERT INTO accessories_inventory_movements
                    (id, product_id, product_name, product_code, movement_type, quantity_change, previous_stock, new_stock, reference_id, reason, created_at)
                 VALUES (?1, ?2, ?3, ?4, 'RETURN_RESTOCKED', ?5, ?6, ?7, ?8, ?9, ?10)",
                params![
                    movement_id,
                    p_item.product_id,
                    p_item.name,
                    p_item.code,
                    p_item.quantity_returned,
                    previous_stock,
                    new_stock,
                    return_id,
                    movement_reason,
                    now,
                ],
            ).map_err(|e| e.to_string())?;
        }
    }

    // 3. Update invoice status
    let total_refunded_res: Result<f64, _> = tx.query_row(
        "SELECT COALESCE(SUM(refund_amount), 0.0) FROM accessories_returns WHERE invoice_id = ?1",
        params![input.invoice_id],
        |row| row.get(0),
    );
    let total_refunded = total_refunded_res.unwrap_or(actual_refund_amount);

    let new_invoice_status = if total_refunded >= invoice_total {
        "RETURNED_FULL"
    } else {
        "RETURNED_PARTIAL"
    };

    tx.execute(
        "UPDATE accessories_invoices SET status = ?1 WHERE id = ?2",
        params![new_invoice_status, input.invoice_id],
    ).map_err(|e| e.to_string())?;

    tx.commit().map_err(|e| e.to_string())?;

    Ok(ReturnRecord {
        id: return_id,
        return_number: ret_num.to_string(),
        invoice_id: input.invoice_id,
        invoice_number,
        return_date: today_date,
        refund_amount: actual_refund_amount,
        refund_method: input.refund_method.trim().to_string(),
        reason: reason_clean.to_string(),
        notes: input.notes.map(|s| s.trim().to_string()).filter(|s| !s.is_empty()),
        items_count: processed_items.len() as i64,
        created_at: now,
    })
}

pub fn fetch_all_returns(conn: &Connection) -> Result<Vec<ReturnRecord>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT r.id, r.return_number, r.invoice_id, r.invoice_number, r.return_date, 
                    r.refund_amount, r.refund_method, r.reason, r.notes, COUNT(i.id), r.created_at
             FROM accessories_returns r
             LEFT JOIN accessories_return_items i ON r.id = i.return_id
             GROUP BY r.id
             ORDER BY r.created_at DESC",
        )
        .map_err(|e| e.to_string())?;

    let iter = stmt
        .query_map([], |row| {
            Ok(ReturnRecord {
                id: row.get(0)?,
                return_number: row.get(1)?,
                invoice_id: row.get(2)?,
                invoice_number: row.get(3)?,
                return_date: row.get(4)?,
                refund_amount: row.get(5)?,
                refund_method: row.get(6)?,
                reason: row.get(7)?,
                notes: row.get(8)?,
                items_count: row.get(9)?,
                created_at: row.get(10)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut returns = Vec::new();
    for r in iter {
        returns.push(r.map_err(|e| e.to_string())?);
    }
    Ok(returns)
}

pub fn fetch_return_items(conn: &Connection, return_id: &str) -> Result<Vec<ReturnItemRecord>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, return_id, product_id, product_name, product_code, 
                    quantity_returned, refund_unit_price, line_refund_total, restock_condition
             FROM accessories_return_items
             WHERE return_id = ?1
             ORDER BY product_name ASC",
        )
        .map_err(|e| e.to_string())?;

    let iter = stmt
        .query_map(params![return_id], |row| {
            Ok(ReturnItemRecord {
                id: row.get(0)?,
                return_id: row.get(1)?,
                product_id: row.get(2)?,
                product_name: row.get(3)?,
                product_code: row.get(4)?,
                quantity_returned: row.get(5)?,
                refund_unit_price: row.get(6)?,
                line_refund_total: row.get(7)?,
                restock_condition: row.get(8)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut items = Vec::new();
    for i in iter {
        items.push(i.map_err(|e| e.to_string())?);
    }
    Ok(items)
}

// ---------------- BACKUP & RESTORE OPERATIONS ----------------

pub fn get_backups_dir() -> PathBuf {
    let mut path = dirs::data_dir().unwrap_or_else(|| PathBuf::from("."));
    path.push("ShopManagementSystem");
    path.push("backups");
    if !path.exists() {
        let _ = fs::create_dir_all(&path);
    }
    path
}

pub fn validate_destination_path(path: &str) -> Result<bool, String> {
    let p = PathBuf::from(path.trim());
    if p.as_os_str().is_empty() {
        return Err("مسار الوجهة فارغ".into());
    }
    if !p.exists() {
        fs::create_dir_all(&p).map_err(|e| format!("تعذر إنشاء المجلد: {}", e))?;
    }
    // Test write permission by creating a temporary file
    let test_file = p.join(".mss_backup_test_write.tmp");
    fs::write(&test_file, b"test").map_err(|e| format!("المسار غير قابل للكتابة: {}", e))?;
    let _ = fs::remove_file(&test_file);
    Ok(true)
}

pub fn execute_multi_destination_backup(
    trigger_type: &str,
    destinations: &[String],
    custom_filename: Option<&str>,
    retention_count: usize,
) -> Result<MultiBackupResult, String> {
    let db_path = get_db_path();
    if !db_path.exists() {
        return Err("ملف قاعدة البيانات الحالي غير موجود لنسخه احتياطياً".into());
    }

    let default_backups_dir = get_backups_dir();
    let now = chrono::Local::now();
    let timestamp = now.format("%Y-%m-%d_%H-%M-%S").to_string();

    let trig = match trigger_type.trim().to_lowercase().as_str() {
        "scheduled" | "auto" => "scheduled",
        "after_operation" => "after_operation",
        "safeguard" => "safeguard",
        _ => "manual",
    };

    let filename = if let Some(cf) = custom_filename {
        let trimmed = cf.trim();
        if trimmed.is_empty() {
            format!("MSS_Backup_{}.db", timestamp)
        } else if trimmed.ends_with(".db") {
            trimmed.to_string()
        } else {
            format!("{}.db", trimmed)
        }
    } else {
        format!("MSS_Backup_{}.db", timestamp)
    };

    // Staging file in internal backups dir
    let staging_path = default_backups_dir.join(format!(".staging_{}", filename));

    // Create safe and consistent SQLite backup using VACUUM INTO, with copy fallback
    {
        let conn = init_db().map_err(|e| format!("فشل الاتصال بقاعدة البيانات: {}", e))?;
        let staging_str = staging_path.to_string_lossy().to_string();
        if let Err(vac_err) = conn.execute("VACUUM INTO ?1", [&staging_str]) {
            // Fallback to fs::copy if VACUUM INTO is unsupported or fails
            let _ = fs::copy(&db_path, &staging_path).map_err(|e| {
                format!("فشل عمل نسخة احتياطية آمنة لقاعدة البيانات (VACUUM: {}, Copy: {})", vac_err, e)
            })?;
        }
    }

    // Verify staging file
    let staging_meta = fs::metadata(&staging_path)
        .map_err(|e| format!("فشل التحقق من ملف النسخة الاحتياطية المؤقت: {}", e))?;
    let size_bytes = staging_meta.len();
    if size_bytes == 0 {
        let _ = fs::remove_file(&staging_path);
        return Err("ملف النسخة الاحتياطية فارغ (حجمه صفر بايت)".into());
    }

    let size_formatted = if size_bytes < 1024 {
        format!("{} B", size_bytes)
    } else if size_bytes < 1024 * 1024 {
        format!("{:.1} KB", (size_bytes as f64) / 1024.0)
    } else {
        format!("{:.2} MB", (size_bytes as f64) / (1024.0 * 1024.0))
    };

    // Always keep a primary copy in internal backups directory
    let internal_final = default_backups_dir.join(&filename);
    let _ = fs::copy(&staging_path, &internal_final);

    // List of destinations to write to
    let mut target_destinations: Vec<String> = destinations
        .iter()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect();

    // If no custom destination configured, use internal default backups dir
    if target_destinations.is_empty() {
        target_destinations.push(default_backups_dir.to_string_lossy().to_string());
    }

    let mut dest_results = Vec::new();
    let mut success_count = 0;
    let mut fail_count = 0;

    for dest in &target_destinations {
        let dest_buf = PathBuf::from(dest);
        if !dest_buf.exists() {
            if let Err(e) = fs::create_dir_all(&dest_buf) {
                dest_results.push(DestinationResult {
                    path: dest.clone(),
                    status: "failed".to_string(),
                    file_path: None,
                    size_bytes: None,
                    size_formatted: None,
                    error: Some(format!("تعذر إنشاء المجلد: {}", e)),
                });
                fail_count += 1;
                continue;
            }
        }

        let target_file = dest_buf.join(&filename);
        match fs::copy(&staging_path, &target_file) {
            Ok(_) => {
                if let Ok(meta) = fs::metadata(&target_file) {
                    if meta.len() > 0 {
                        dest_results.push(DestinationResult {
                            path: dest.clone(),
                            status: "success".to_string(),
                            file_path: Some(target_file.to_string_lossy().to_string()),
                            size_bytes: Some(meta.len()),
                            size_formatted: Some(size_formatted.clone()),
                            error: None,
                        });
                        success_count += 1;
                        continue;
                    }
                }
                dest_results.push(DestinationResult {
                    path: dest.clone(),
                    status: "failed".to_string(),
                    file_path: Some(target_file.to_string_lossy().to_string()),
                    size_bytes: Some(0),
                    size_formatted: None,
                    error: Some("الملف المنسوخ فارغ أو تالف".to_string()),
                });
                fail_count += 1;
            }
            Err(e) => {
                dest_results.push(DestinationResult {
                    path: dest.clone(),
                    status: "failed".to_string(),
                    file_path: None,
                    size_bytes: None,
                    size_formatted: None,
                    error: Some(format!("فشل نسخ الملف إلى الوجهة: {}", e)),
                });
                fail_count += 1;
            }
        }
    }

    // Clean up staging file
    let _ = fs::remove_file(&staging_path);

    // Apply auto retention pruning
    if trig == "scheduled" || trig == "after_operation" {
        let keep = if retention_count > 0 { retention_count } else { 10 };
        let _ = prune_backups(keep);
    }

    let overall_status = if fail_count == 0 {
        "success".to_string()
    } else if success_count > 0 {
        "partial".to_string()
    } else {
        "failed".to_string()
    };

    let error_details = if fail_count > 0 {
        let errs: Vec<String> = dest_results
            .iter()
            .filter(|d| d.status == "failed")
            .map(|d| format!("{}: {}", d.path, d.error.as_deref().unwrap_or("خطأ غير معروف")))
            .collect();
        Some(errs.join(" | "))
    } else {
        None
    };

    Ok(MultiBackupResult {
        id: filename.clone(),
        filename,
        trigger_type: trig.to_string(),
        date: now.format("%Y-%m-%d %H:%M:%S").to_string(),
        overall_status,
        total_destinations: target_destinations.len(),
        successful_destinations: success_count,
        failed_destinations: fail_count,
        destinations: dest_results,
        size_bytes,
        size_formatted,
        error_details,
    })
}

pub fn create_backup_file(
    backup_type: &str,
    destination_dir: Option<&str>,
    custom_filename: Option<&str>,
) -> Result<BackupInfo, String> {
    let dests: Vec<String> = destination_dir
        .map(|d| vec![d.to_string()])
        .unwrap_or_default();
    let res = execute_multi_destination_backup(backup_type, &dests, custom_filename, 10)?;

    let primary_path = res
        .destinations
        .iter()
        .find(|d| d.status == "success")
        .and_then(|d| d.file_path.clone())
        .unwrap_or_else(|| get_backups_dir().join(&res.filename).to_string_lossy().to_string());

    Ok(BackupInfo {
        id: res.id,
        filename: res.filename,
        filepath: primary_path,
        size_bytes: res.size_bytes,
        size_formatted: res.size_formatted,
        backup_type: backup_type.to_string(),
        date: res.date,
        status: if res.overall_status == "success" {
            "سليم ومتحقق منه".to_string()
        } else if res.overall_status == "partial" {
            "نجاح جزئي".to_string()
        } else {
            "فشل".to_string()
        },
    })
}

pub fn prune_backups(keep_count: usize) -> Result<(), String> {
    let backups_dir = get_backups_dir();
    let entries = fs::read_dir(&backups_dir).map_err(|e| e.to_string())?;

    let mut auto_files = Vec::new();
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_file() {
            let fname = path.file_name().unwrap_or_default().to_string_lossy().to_string();
            let is_auto = (fname.starts_with("accessories_backup_") && fname.contains("_auto.db"))
                || (fname.starts_with("MSS_Backup_") && !fname.contains("_manual"));
            if is_auto {
                if let Ok(meta) = entry.metadata() {
                    if let Ok(modified) = meta.modified() {
                        auto_files.push((path, modified));
                    }
                }
            }
        }
    }

    if auto_files.len() > keep_count {
        auto_files.sort_by(|a, b| b.1.cmp(&a.1));
        for (path, _) in &auto_files[keep_count..] {
            let _ = fs::remove_file(path);
        }
    }

    Ok(())
}

pub fn list_all_backups() -> Result<Vec<BackupInfo>, String> {
    let backups_dir = get_backups_dir();
    let entries = fs::read_dir(&backups_dir).map_err(|e| e.to_string())?;

    let mut backups = Vec::new();
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_file() {
            let fname = path.file_name().unwrap_or_default().to_string_lossy().to_string();
            let is_backup_file = (fname.starts_with("accessories_backup_") || fname.starts_with("MSS_Backup_"))
                && fname.ends_with(".db")
                && !fname.starts_with(".staging_");
            if is_backup_file {
                let meta = entry.metadata().map_err(|e| e.to_string())?;
                let size_bytes = meta.len();
                let size_formatted = if size_bytes < 1024 {
                    format!("{} B", size_bytes)
                } else if size_bytes < 1024 * 1024 {
                    format!("{:.1} KB", (size_bytes as f64) / 1024.0)
                } else {
                    format!("{:.2} MB", (size_bytes as f64) / (1024.0 * 1024.0))
                };

                let b_type = if fname.contains("_auto") || fname.contains("_scheduled") {
                    "auto"
                } else if fname.contains("_safeguard") {
                    "safeguard"
                } else {
                    "manual"
                };

                let date_str = if let Ok(modified) = meta.modified() {
                    let dt: chrono::DateTime<chrono::Local> = modified.into();
                    dt.format("%Y-%m-%d %H:%M:%S").to_string()
                } else {
                    chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string()
                };

                backups.push(BackupInfo {
                    id: fname.clone(),
                    filename: fname,
                    filepath: path.to_string_lossy().to_string(),
                    size_bytes,
                    size_formatted,
                    backup_type: b_type.to_string(),
                    date: date_str,
                    status: "سليم ومتحقق منه".to_string(),
                });
            }
        }
    }

    backups.sort_by(|a, b| b.date.cmp(&a.date));
    Ok(backups)
}

pub fn restore_db_from_backup(filename: &str) -> Result<(), String> {
    let clean_fname = filename.trim();
    if clean_fname.is_empty() {
        return Err("اسم ملف النسخة الاحتياطية مطلوب".into());
    }

    let mut source_path = get_backups_dir();
    source_path.push(clean_fname);

    if !source_path.exists() {
        return Err(format!("ملف النسخة الاحتياطية '{}' غير موجود", clean_fname));
    }

    // 1. Verify backup SQLite integrity
    let test_conn = Connection::open(&source_path)
        .map_err(|e| format!("فشل فتح ملف النسخة الاحتياطية: {}", e))?;
    let integrity: Result<String, _> = test_conn.query_row("PRAGMA integrity_check;", [], |row| row.get(0));
    match integrity {
        Ok(res) if res.to_lowercase() == "ok" => (),
        _ => return Err("ملف النسخة الاحتياطية تالف أو غير متوافق (فشل فحص السلامة PRAGMA integrity_check)".into()),
    }
    drop(test_conn);

    // 2. Create safeguard backup of current database first
    let _ = create_backup_file("safeguard", None, None);

    // 3. Replace current database with backup
    let db_path = get_db_path();
    fs::copy(&source_path, &db_path)
        .map_err(|e| format!("فشل استرجاع قاعدة البيانات: {}", e))?;

    Ok(())
}

pub fn export_backup_file(filename: &str, target_path: &str) -> Result<(), String> {
    let clean_fname = filename.trim();
    let mut source_path = get_backups_dir();
    source_path.push(clean_fname);

    if !source_path.exists() {
        return Err("الملف المصدري غير موجود".into());
    }

    let target = PathBuf::from(target_path.trim());
    let final_dest = if target.is_dir() {
        target.join(clean_fname)
    } else {
        target
    };

    fs::copy(&source_path, &final_dest)
        .map_err(|e| format!("فشل تصدير النسخة الاحتياطية إلى المسار المحدد: {}", e))?;

    Ok(())
}
