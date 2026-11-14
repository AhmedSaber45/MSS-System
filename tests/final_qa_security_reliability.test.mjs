// Automated Verification Suite for Phase 12: Final QA, Security & Reliability
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

// Mock localStorage for Node.js test environment if not present
if (!global.localStorage) {
  const storage = new Map();
  global.localStorage = {
    getItem: (key) => storage.get(key) || null,
    setItem: (key, val) => storage.set(key, String(val)),
    removeItem: (key) => storage.delete(key),
    clear: () => storage.clear(),
  };
}

// Ensure navigator mock is flexible
if (!global.navigator) {
  global.navigator = { onLine: true };
} else {
  Object.defineProperty(global.navigator, 'onLine', {
    value: true,
    configurable: true,
    writable: true,
  });
}

// Dynamic imports of services
const { productsService } = await import('../src/services/productsService.ts');
const { purchasesService } = await import('../src/services/purchasesService.ts');
const { inventoryService } = await import('../src/services/inventoryService.ts');
const { salesService } = await import('../src/services/salesService.ts');
const { returnsService } = await import('../src/services/returnsService.ts');
const { backupService } = await import('../src/services/backupService.ts');
const { mssCatalogService } = await import('../src/services/mssCatalogService.ts');
const { mssInventoryService } = await import('../src/services/mssInventoryService.ts');
const { mssCommerceService } = await import('../src/services/mssCommerceService.ts');
const { mssSyncService } = await import('../src/services/mssSyncService.ts');
const { mssReportsService } = await import('../src/services/mssReportsService.ts');
const { unifiedDashboardService } = await import('../src/services/unifiedDashboardService.ts');
const { updaterService } = await import('../src/services/updaterService.ts');

describe('Phase 12 — Final QA, Security & Reliability Verification', () => {
  beforeEach(() => {
    Object.defineProperty(global.navigator, 'onLine', { value: true, configurable: true, writable: true });
    updaterService.resetState();
  });

  // 1. MAJOR WORKFLOW: Accessories Purchases, Stock Deduction, POS Discounted Sale & Return
  test('1. Accessories Major Workflow: Purchase, Stock Deduction, POS Discounted Sale & Return', async () => {
    // 1. Create product
    const code = `QA-ACC-${Date.now().toString().slice(-6)}`;
    const barcode = `628QA${Date.now().toString().slice(-6)}`;
    const prod = await productsService.addProduct({
      name: 'كابل شحن فائق السرعة QA',
      code,
      barcode,
      cost: 30,
      price: 60,
      stock: 10,
      low_stock_threshold: 3,
    });
    assert.ok(prod.id);
    assert.strictEqual(prod.stock, 10);

    // 2. Process purchase order to increase stock
    const poNumber = `PUR-QA-${Date.now().toString().slice(-4)}`;
    const purchase = await purchasesService.createPurchase({
      purchase_number: poNumber,
      purchase_date: '2026-11-14',
      supplier_name: 'مورد الجودة الشامل',
      supplier_phone: '01011223344',
      notes: 'شراء تدقيق الجودة',
      items: [
        {
          product_id: prod.id,
          quantity: 15,
          unit_cost: 32,
          update_product_cost: true,
        },
      ],
    });
    assert.ok(purchase.id);

    const restockedProduct = await productsService.getProductById(prod.id);
    assert.strictEqual(restockedProduct?.stock, 25, 'Stock should increase to 25');

    // 3. Process POS sale with item discount and invoice-level discount
    const saleInvoiceNumber = `INV-QA-${Date.now().toString().slice(-5)}`;
    const saleResult = await salesService.createSale({
      invoice_number: saleInvoiceNumber,
      customer_name: 'عميل الفحص النهائي',
      customer_phone: '01099887766',
      invoice_discount: 5, // invoice-level discount
      payment_method: 'نقدي',
      notes: 'فاتورة تدقيق نهائي',
      items: [
        {
          product_id: prod.id,
          quantity: 2,
          discount: 5, // item-level discount: 2 * (60 - 5) = 110
        },
      ],
    });

    assert.ok(saleResult.id);
    // Subtotal: 110, invoice discount: 5 -> total: 105
    assert.strictEqual(saleResult.total_amount, 105);

    const postSaleProduct = await productsService.getProductById(prod.id);
    assert.strictEqual(postSaleProduct?.stock, 23, 'Stock should decrement by 2');

    // 4. Process Sales Return
    const returnNumber = `RET-QA-${Date.now().toString().slice(-5)}`;
    const returnResult = await returnsService.createReturn({
      return_number: returnNumber,
      invoice_id: saleResult.id,
      return_date: '2026-11-14',
      refund_amount: 55,
      refund_method: 'نقدي',
      reason: 'فحص نهائي - مرتجع تجريبي سليم',
      items: [
        {
          product_id: prod.id,
          quantity_returned: 1,
          refund_unit_price: 55,
          restock_condition: 'RESTOCKED',
        },
      ],
    });

    assert.ok(returnResult.id);
    const postReturnProduct = await productsService.getProductById(prod.id);
    assert.strictEqual(postReturnProduct?.stock, 24, 'Sellable return should restock by 1');

    // Verify invoice was NOT deleted (Rule 7: Never permanently delete finalized invoices)
    const originalInvoice = await salesService.getInvoiceById(saleResult.id);
    assert.ok(originalInvoice, 'Finalized invoice must be preserved permanently');
    assert.strictEqual(originalInvoice.status, 'RETURNED_PARTIAL', 'Invoice status must reflect return');
  });

  // 2. MAJOR WORKFLOW: MSS Catalog, Serials, Cross-Shop Selling, Reservations & Returns
  test('2. MSS Major Workflow: Catalog Model, Serialized Device, Cross-Shop Sale, Reservation & Return', async () => {
    // 1. Create Model in shared catalog
    const model = await mssCatalogService.createModel({
      brand: 'Dell',
      model_name: `Latitude QA-${Date.now().toString().slice(-4)}`,
      category: 'لابتوب',
      processor: 'Core i7-1370P',
      ram: '32GB',
      storage: '1TB NVMe',
      screen_size: '14 inch',
      default_list_price: 18500,
      specifications: 'نسخة الفحص والاعتماد النهائي',
    });
    assert.ok(model.id);

    // 2. Register individual physical device stored at Shop 2
    const serialNumber = `QA-SN-${Date.now().toString().slice(-6)}`;
    const device = await mssInventoryService.createDevice({
      model_id: model.id,
      serial_number: serialNumber,
      purchase_cost: 14000,
      list_price: 18500,
      physical_condition: 'جديد بالكرتونة',
      stock_location: 'محل 2', // Stock source is Shop 2
      status: 'AVAILABLE',
      notes: 'جهاز تدقيق المحل 2',
    });
    assert.ok(device.id);
    assert.strictEqual(device.status, 'AVAILABLE');

    // 3. Cross-Shop Sale: Sold by Shop 1, Stock source is Shop 2 (Rule 9 & Section 16)
    const saleRecord = await mssCommerceService.confirmSale({
      device_id: device.id,
      selling_branch: 'محل 1', // Executing branch
      actual_sale_price: 18000,
      discount_amount: 500,
      customer_name: 'عميل الشبكة الموحدة',
      customer_phone: '01011223344',
      warranty_period: 'ضمان سنة كاملة',
      notes: 'بيع عبر الفروع مع تدقيق العائد المشترك',
    });

    assert.ok(saleRecord.id);
    assert.strictEqual(saleRecord.selling_branch, 'محل 1');
    assert.strictEqual(saleRecord.source_branch, 'محل 2');
    assert.strictEqual(saleRecord.actual_sale_price, 18000);
    assert.strictEqual(saleRecord.cost_snapshot, 14000);
    assert.strictEqual(saleRecord.gross_profit, 4000, 'Gross profit = 18000 - 14000 = 4000');

    // Device status should now be SOLD
    const updatedDevice = await mssInventoryService.getDeviceById(device.id);
    assert.strictEqual(updatedDevice?.status, 'SOLD');

    // 4. Return the MSS sale
    const returnRecord = await mssCommerceService.processReturn({
      invoice_id: saleRecord.id,
      return_reason: 'إرجاع تجريبي معتمد',
      restock_location: 'محل 2',
    });

    assert.ok(returnRecord.id);
    const restockedMssDevice = await mssInventoryService.getDeviceById(device.id);
    assert.strictEqual(restockedMssDevice?.status, 'AVAILABLE', 'Device should be restocked to AVAILABLE');

    // 5. Reservation Workflow: Reserve device at Shop 1
    const resv = await mssCommerceService.createReservation({
      device_id: device.id,
      branch: 'محل 1',
      customer_name: 'عميل الحجز التجريبي',
      customer_phone: '01223344556',
      notes: 'حجز مؤقت لمدة 24 ساعة',
    });
    assert.ok(resv.id);

    const reservedDevice = await mssInventoryService.getDeviceById(device.id);
    assert.strictEqual(reservedDevice?.status, 'RESERVED');

    // Attempting online sale of reserved unit must fail
    await assert.rejects(
      async () => {
        await mssCommerceService.confirmSale({
          device_id: device.id,
          selling_branch: 'محل 2',
          actual_sale_price: 18500,
          customer_name: 'محاولة غير مصرح بها',
        });
      },
      /محجوز|reserved/i,
      'Must reject sale of reserved device'
    );

    // Cancel reservation releases device
    await mssCommerceService.cancelReservation(resv.id, 'إلغاء حجز الفحص');
    const releasedDevice = await mssInventoryService.getDeviceById(device.id);
    assert.strictEqual(releasedDevice?.status, 'AVAILABLE');
  });

  // 3. DATA PERSISTENCE & APPLICATION RESTART SIMULATION
  test('3. Data Persistence & Integrity Across Simulated Restart', async () => {
    // Write product and device
    const testCode = `PERSIST-${Date.now().toString().slice(-6)}`;
    const p = await productsService.addProduct({
      code: testCode,
      name: 'منتج اختبار الاستمرارية',
      cost: 50,
      price: 90,
      stock: 12,
      low_stock_threshold: 2,
    });

    // Simulate restart by reading freshly from storage
    const reloaded = await productsService.getProductById(p.id);
    assert.ok(reloaded, 'Product must persist across service calls');
    assert.strictEqual(reloaded?.stock, 12);
    assert.strictEqual(reloaded?.code, testCode);
  });

  // 4. OFFLINE OPERATION & IDEMPOTENT OUTBOX SYNCHRONIZATION
  test('4. Offline Mode & Idempotent Sync: Outbox queues, syncs with stable UUIDs', async () => {
    // Settle any background sync
    await new Promise((r) => setTimeout(r, 150));

    // 1. Force offline
    Object.defineProperty(global.navigator, 'onLine', { value: false, configurable: true, writable: true });

    // 2. Queue offline operation with valid SyncOperationType
    const op = await mssSyncService.queueOperation(
      'DEVICE_ADD',
      { serial_number: `QA-OFFLINE-${Date.now().toString().slice(-6)}`, model_name: 'Latitude 7420' },
      'تسجيل جهاز دون اتصال',
      'محل 1'
    );
    assert.ok(op.uuid, 'Must generate stable UUID');

    const pending = await mssSyncService.getPendingOperations();
    assert.ok(pending.some((o) => o.uuid === op.uuid));

    // 3. Restore connectivity
    Object.defineProperty(global.navigator, 'onLine', { value: true, configurable: true, writable: true });

    // 4. Trigger sync
    const syncRes = await mssSyncService.syncOutbox();
    assert.ok(syncRes);

    const outbox = await mssSyncService.getOutbox();
    const syncedOp = outbox.find((o) => o.uuid === op.uuid);
    assert.ok(syncedOp, 'Queued operation must be preserved in Outbox');
    assert.strictEqual(syncedOp.status, 'SYNCED');

    // 5. Idempotency: re-running sync does not duplicate synced items
    const repeatSync = await mssSyncService.syncOutbox();
    assert.strictEqual(repeatSync.synced, 0, 'Already synced items must not be re-synced');
  });

  // 5. CONCURRENCY LIMITATION & CONFLICT PRESERVATION (Rules 10 & 25)
  test('5. Conflict Detection & Preservation: DOUBLE_SALE conflict is preserved, never silently discarded', async () => {
    // Settle any background sync
    await new Promise((r) => setTimeout(r, 150));

    // Seed device 5CD9283-HP is already sold in Supabase cloud (MSS-INV-101)
    const localSalePayload = {
      invoice_number: `INV-CONF-${Date.now().toString().slice(-4)}`,
      serial_number: '5CD9283-HP',
      actual_sale_price: 13500,
      selling_branch: 'محل 2',
    };

    const conflictOp = await mssSyncService.queueOperation(
      'SALE_CREATE',
      localSalePayload,
      'محاولة بيع جهاز تم بيعه بالفرع الآخر أثناء انقطاع الإنترنت',
      'محل 2'
    );

    // Trigger sync
    await mssSyncService.syncOutbox();

    // Verify outbox operation status is CONFLICT
    const outbox = await mssSyncService.getOutbox();
    const target = outbox.find((o) => o.uuid === conflictOp.uuid);
    assert.strictEqual(
      target?.status,
      'CONFLICT',
      'Outbox operation must be marked CONFLICT when double-sale is detected'
    );

    // Verify conflict record was created in conflicts log (Rule 10 & 25: Never silently discarded)
    const conflicts = await mssSyncService.getConflicts();
    const recordedConflict = conflicts.find((c) => c.operation_uuid === conflictOp.uuid);
    assert.ok(recordedConflict, 'Conflict must be preserved in mss_conflicts');
    assert.strictEqual(recordedConflict?.conflict_type, 'DOUBLE_SALE');
    assert.strictEqual(recordedConflict?.resolution_status, 'PENDING');

    // Resolve conflict manually
    await mssSyncService.resolveConflict(
      recordedConflict.id,
      'RESOLVED_MANUALLY',
      'تم اعتماد بيع المحل 1 وإلغاء بيع المحل 2 مع تسوية العميل',
      'مدير النظام'
    );

    const conflictsAfter = await mssSyncService.getConflicts();
    const resolvedConflict = conflictsAfter.find((c) => c.id === recordedConflict.id);
    assert.strictEqual(resolvedConflict?.resolution_status, 'RESOLVED_MANUALLY');
    assert.ok(resolvedConflict?.resolution_notes);
  });

  // 6. DUPLICATE SUBMISSIONS & RACE REJECTION
  test('6. Duplicate Submissions Rejection: Rejects duplicate barcodes, serials, and invoices', async () => {
    // 1. Duplicate accessory code
    const uniqueCode = `CODE-DUP-${Date.now().toString().slice(-6)}`;
    await productsService.addProduct({
      code: uniqueCode,
      name: 'منتج أصلي للتحقق',
      cost: 10,
      price: 20,
      stock: 5,
      low_stock_threshold: 1,
    });

    await assert.rejects(
      async () => {
        await productsService.addProduct({
          code: uniqueCode,
          name: 'منتج مكرر الكود',
          cost: 10,
          price: 20,
          stock: 5,
          low_stock_threshold: 1,
        });
      },
      /مسجل مسبقاً|موجود مسبقاً|duplicate|unique/i,
      'Must reject duplicate product code'
    );

    // 2. Duplicate MSS serial number
    const dupSerial = `SN-DUP-${Date.now().toString().slice(-6)}`;
    const models = await mssCatalogService.getModels();
    const testModelId = models[0]?.id;

    await mssInventoryService.createDevice({
      model_id: testModelId,
      serial_number: dupSerial,
      purchase_cost: 8000,
      list_price: 12000,
      physical_condition: 'مستعمل بحالة ممتازة',
      stock_location: 'محل 1',
      status: 'AVAILABLE',
    });

    await assert.rejects(
      async () => {
        await mssInventoryService.createDevice({
          model_id: testModelId,
          serial_number: dupSerial,
          purchase_cost: 8000,
          list_price: 12000,
          physical_condition: 'مستعمل بحالة ممتازة',
          stock_location: 'محل 2',
          status: 'AVAILABLE',
        });
      },
      /مسجل مسبقاً|موجود مسبقاً|unique|duplicate/i,
      'Must reject duplicate serial number across physical devices'
    );
  });

  // 7. FINANCIAL CALCULATIONS & MARGIN ACCURACY
  test('7. Financial Integrity: Accurate discount math, COGS, and gross profit snapshots', async () => {
    const data = await unifiedDashboardService.getUnifiedDashboardData('all');
    assert.ok(data.accessories);
    assert.ok(data.mss);
    assert.ok(data.combined);

    const expectedRevenue = data.accessories.netSales + data.mss.netSales;
    const expectedCogs = data.accessories.costOfGoodsSold + data.mss.costOfGoodsSold;
    const expectedProfit = data.accessories.grossProfit + data.mss.sharedGrossProfit;

    assert.strictEqual(
      data.combined.combinedRevenue,
      expectedRevenue,
      'Combined revenue must equal Accessories netSales + MSS netSales'
    );
    assert.strictEqual(
      data.combined.combinedCogs,
      expectedCogs,
      'Combined COGS must equal Accessories COGS + MSS COGS'
    );
    assert.strictEqual(
      data.combined.combinedGrossProfit,
      expectedProfit,
      'Combined gross profit must equal Accessories Profit + MSS Shared Profit'
    );
  });

  // 8. BACKUP, RETENTION & SAFEGUARD RESTORE
  test('8. Backup & Restore Integrity: Safeguard backup on restore & retention pruning', async () => {
    // 1. Manual backup
    const manualBackup = await backupService.createBackup('manual');
    assert.ok(manualBackup.filename);
    assert.strictEqual(manualBackup.backup_type, 'manual');

    // 2. Scheduled auto backups respecting retention
    backupService.saveBackupConfig({
      autoBackupEnabled: true,
      schedule: 'daily',
      retentionCount: 4,
    });

    for (let i = 0; i < 5; i++) {
      await backupService.createBackup('auto');
    }

    const backups = await backupService.getBackups();
    const autoBackups = backups.filter((b) => b.backup_type === 'auto');
    assert.ok(
      autoBackups.length <= 4,
      `Auto backups count (${autoBackups.length}) should not exceed retention limit (4)`
    );

    // 3. Safe restore creates safeguard backup first (Rule 23)
    await backupService.restoreBackup(manualBackup.filename);

    // Confirm pre-restore safeguard exists
    const updatedBackups = await backupService.getBackups();
    const safeguardBackup = updatedBackups.find((b) => b.backup_type === 'safeguard');
    assert.ok(safeguardBackup, 'A pre-restore safeguard backup must be created before applying restore');
  });

  // 9. SECURITY & RLS COMPLIANCE
  test('9. Supabase Security & RLS Compliance: No service_role key leak, explicit RLS policies', () => {
    // 1. Verify src code has NO service_role key or personal access tokens
    const srcFiles = fs.readdirSync(path.resolve('src'), { recursive: true });
    for (const file of srcFiles) {
      const fullPath = path.resolve('src', file);
      if (fs.statSync(fullPath).isFile() && (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js'))) {
        const content = fs.readFileSync(fullPath, 'utf8');
        assert.ok(!content.includes('service_role'), `File ${file} must NEVER contain service_role`);
        assert.ok(!content.includes('sbp_'), `File ${file} must NEVER contain personal access tokens`);
      }
    }

    // 2. Verify master migration has RLS enabled on all tables
    const masterSql = fs.readFileSync(path.resolve('supabase/migrations/master_consolidated_mss_schema.sql'), 'utf8');
    const requiredRlsTables = [
      'mss_models',
      'mss_devices',
      'mss_movements',
      'mss_invoices',
      'mss_reservations',
      'mss_returns',
      'mss_sync_log',
      'mss_conflicts',
    ];

    for (const table of requiredRlsTables) {
      assert.ok(
        masterSql.includes(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;`),
        `Table ${table} must have ENABLE ROW LEVEL SECURITY in migration`
      );
    }
  });

  // 10. UPDATER SAFEGUARD & DATA PRESERVATION (Rules 21, 22 & 23)
  test('10. Updater Security & Safeguard: Private key isolated, safeguard backup before update', async () => {
    // Verify private key is outside git
    const gitignore = fs.readFileSync(path.resolve('.gitignore'), 'utf8');
    assert.ok(gitignore.includes('*.key'));
    assert.ok(gitignore.includes('.tauri/'));

    // Stage update
    updaterService.simulateUpdateAvailable('1.2.0', 'تحديث فحص نهائي');
    const backupsBefore = await backupService.getBackups();

    // Trigger download and install update which automatically triggers safeguard backup
    const installResult = await updaterService.downloadAndInstallUpdate();
    assert.strictEqual(installResult.success, true);
    assert.strictEqual(installResult.backupCreated, true);
    assert.ok(installResult.backupFilename);

    const backupsAfter = await backupService.getBackups();
    assert.strictEqual(backupsAfter.length, backupsBefore.length + 1);
    const latest = backupsAfter[0];
    assert.strictEqual(latest.backup_type, 'safeguard');

    // Verify database path uses %APPDATA% independent of app installation dir
    const tauriConfig = JSON.parse(fs.readFileSync(path.resolve('src-tauri/tauri.conf.json'), 'utf8'));
    assert.strictEqual(tauriConfig.bundle.windows.nsis.installMode, 'currentUser');
  });

  // 11. RULE 16 STRICT COMPLIANCE: MSS Shared Business Profit vs Branch Attribution
  test('11. Rule 16 Compliance: MSS Profit is shared at whole-business level, never assigned individually to selling branch', async () => {
    const branchSales = await mssReportsService.getBranchOperationalBreakdown();
    assert.strictEqual(branchSales.length, 2, 'Must have exactly 2 branches (محل 1 and محل 2)');

    const shop1 = branchSales.find((b) => b.branch === 'محل 1');
    const shop2 = branchSales.find((b) => b.branch === 'محل 2');

    assert.ok(shop1, 'Shop 1 operational breakdown must exist');
    assert.ok(shop2, 'Shop 2 operational breakdown must exist');

    // Attributes operational sales execution
    assert.ok(typeof shop1.salesCount === 'number');
    assert.ok(typeof shop1.revenue === 'number');
    assert.ok(typeof shop1.discounts === 'number');
    assert.ok(typeof shop1.crossBranchSalesCount === 'number');

    // Rule 16 Enforcement: individual branch gross profit is NOT attributed to branches
    assert.strictEqual(
      shop1.grossProfit,
      undefined,
      'Rule 16: Individual branch gross profit must NEVER be attributed to the executing branch'
    );
    assert.strictEqual(
      shop2.grossProfit,
      undefined,
      'Rule 16: Individual branch gross profit must NEVER be attributed to the executing branch'
    );
  });

  // 12. PHYSICAL & LOGICAL DATABASE ISOLATION (Rule 6)
  test('12. Rule 6 Compliance: Accessories SQLite database and MSS Supabase database are strictly isolated', async () => {
    // Accessories products must have no MSS fields
    const accProducts = await productsService.getProducts();
    for (const p of accProducts) {
      assert.strictEqual(p.serial_number, undefined, 'Accessory product must not have serial_number');
      assert.strictEqual(p.selling_branch, undefined, 'Accessory product must not have selling_branch');
      assert.strictEqual(p.processor, undefined, 'Accessory product must not have processor');
    }

    // MSS models and devices must have no Accessories fields
    const mssModels = await mssCatalogService.getModels();
    for (const m of mssModels) {
      assert.strictEqual(m.barcode, undefined, 'MSS model must not have barcode');
      assert.strictEqual(m.stock_quantity, undefined, 'MSS model must not have aggregate stock_quantity');
    }
  });
});
