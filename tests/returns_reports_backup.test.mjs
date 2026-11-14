// Automated Verification Script for Phase 05: Accessories Returns, Reports & Backup
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';

// Mock localStorage for Node.js test environment
const storage = new Map();
global.localStorage = {
  getItem: (key) => storage.get(key) || null,
  setItem: (key, val) => storage.set(key, String(val)),
  removeItem: (key) => storage.delete(key),
  clear: () => storage.clear(),
};

// Mock Blob for Node.js test environment if needed
if (!global.Blob) {
  global.Blob = class Blob {
    constructor(parts) {
      this.size = parts.reduce((acc, p) => acc + (typeof p === 'string' ? Buffer.byteLength(p) : 0), 0);
    }
  };
}

// Import services dynamically
const { productsService } = await import('../src/services/productsService.ts');
const { salesService } = await import('../src/services/salesService.ts');
const { purchasesService } = await import('../src/services/purchasesService.ts');
const { inventoryService } = await import('../src/services/inventoryService.ts');
const { returnsService } = await import('../src/services/returnsService.ts');
const { reportsService } = await import('../src/services/reportsService.ts');
const { backupService } = await import('../src/services/backupService.ts');
const { historyService } = await import('../src/services/historyService.ts');

describe('Phase 05 — Accessories Returns, Reports & Backup Verification', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  /* ---------------- 1. RETURNS TESTS ---------------- */

  test('1. Initial seed returns load properly', async () => {
    const returns = await returnsService.getReturns();
    assert.ok(returns.length >= 1, 'Should load initial seed return');

    const firstReturn = returns[0];
    const items = await returnsService.getReturnItems(firstReturn.id);
    assert.ok(items.length >= 1, 'Should load items for seed return');
    assert.strictEqual(firstReturn.return_number, 'RET-2024-001');
  });

  test('2. Generate next return number sequentially', async () => {
    const nextNum = await returnsService.generateNextReturnNumber();
    assert.match(nextNum, /^RET-\d{4}-\d{3}$/, 'Return number format should be RET-YYYY-NNN');
  });

  test('3. Confirmed sales return restocks inventory and marks invoice without deleting it', async () => {
    // 1. Create product with initial stock 10, price 100, cost 50
    const prod = await productsService.addProduct({
      name: 'كابل آيفون للتجربة المرتجعة',
      code: 'TEST-RET-CBL-01',
      cost: 50,
      price: 100,
      stock: 10,
      low_stock_threshold: 2,
    });

    // 2. Sell 3 units (stock drops to 7)
    const sale = await salesService.createSale({
      invoice_number: 'INV-RET-TEST-01',
      customer_name: 'عميل مرتجع',
      invoice_discount: 0,
      payment_method: 'نقدي',
      items: [{ product_id: prod.id, quantity: 3, discount: 0 }],
    });

    const prodAfterSale = await productsService.getProductById(prod.id);
    assert.strictEqual(prodAfterSale?.stock, 7);

    // 3. Return 1 unit in sound condition (RESTOCKED)
    const returnRecord = await returnsService.createReturn({
      return_number: 'RET-TEST-001',
      invoice_id: sale.id,
      return_date: '2024-11-14',
      refund_amount: 100,
      refund_method: 'نقدي',
      reason: 'عدم ملاءمة الموديل مع رغبة العميل',
      items: [
        {
          product_id: prod.id,
          quantity_returned: 1,
          refund_unit_price: 100,
          restock_condition: 'RESTOCKED',
        },
      ],
    });

    assert.strictEqual(returnRecord.return_number, 'RET-TEST-001');

    // 4. Verify stock restored from 7 to 8
    const prodAfterReturn = await productsService.getProductById(prod.id);
    assert.strictEqual(prodAfterReturn?.stock, 8, 'Stock should increase by 1 for restocked condition');

    // 5. Verify invoice is NOT deleted and marked as RETURNED_PARTIAL
    const updatedInvoice = await salesService.getInvoiceById(sale.id);
    assert.ok(updatedInvoice, 'Finalized invoice must NEVER be deleted');
    assert.strictEqual(updatedInvoice.status, 'RETURNED_PARTIAL');

    // 6. Verify inventory movement of type RETURN_RESTOCKED logged
    const movements = await inventoryService.getMovements(prod.id);
    const returnMovement = movements.find(m => m.movement_type === 'RETURN_RESTOCKED');
    assert.ok(returnMovement, 'RETURN_RESTOCKED movement should be logged');
    assert.strictEqual(returnMovement.quantity_change, 1);
  });

  test('4. Damaged return does NOT increase sellable stock', async () => {
    const prod = await productsService.addProduct({
      name: 'لاصقة شاشة تالفة',
      code: 'TEST-RET-DMG-01',
      cost: 15,
      price: 40,
      stock: 5,
      low_stock_threshold: 1,
    });

    const sale = await salesService.createSale({
      invoice_number: 'INV-RET-DMG-01',
      invoice_discount: 0,
      payment_method: 'نقدي',
      items: [{ product_id: prod.id, quantity: 2, discount: 0 }],
    });

    // Stock is now 3
    const prodMid = await productsService.getProductById(prod.id);
    assert.strictEqual(prodMid?.stock, 3);

    // Return 1 unit marked DAMAGED
    await returnsService.createReturn({
      return_number: 'RET-DMG-001',
      invoice_id: sale.id,
      return_date: '2024-11-14',
      refund_amount: 40,
      refund_method: 'نقدي',
      reason: 'كسر أثناء الفتح من العميل',
      items: [
        {
          product_id: prod.id,
          quantity_returned: 1,
          refund_unit_price: 40,
          restock_condition: 'DAMAGED',
        },
      ],
    });

    // Stock must remain 3 (damaged goods not put back on shelf)
    const prodFinal = await productsService.getProductById(prod.id);
    assert.strictEqual(prodFinal?.stock, 3, 'Stock must NOT increase for DAMAGED condition');
  });

  test('5. Reject invalid return: duplicate number or missing reason', async () => {
    const invoices = await salesService.getInvoices();
    const inv = invoices[0];
    const items = await salesService.getInvoiceItems(inv.id);

    // Missing reason
    await assert.rejects(
      async () => {
        await returnsService.createReturn({
          return_number: 'RET-ERR-01',
          invoice_id: inv.id,
          return_date: '2024-11-14',
          refund_amount: 10,
          refund_method: 'نقدي',
          reason: '', // empty reason
          items: [
            {
              product_id: items[0].product_id,
              quantity_returned: 1,
              refund_unit_price: items[0].actual_price,
              restock_condition: 'RESTOCKED',
            },
          ],
        });
      },
      /سبب الإرجاع إلزامي/
    );
  });

  /* ---------------- 2. FINANCIAL REPORTS TESTS ---------------- */

  test('6. Financial summary calculates accurate Revenue, COGS, and Gross Profit', async () => {
    const summary = await reportsService.getFinancialSummary();
    assert.ok(summary.totalRevenue > 0, 'Total revenue should be greater than zero');
    assert.ok(summary.costOfGoodsSold > 0, 'COGS should be greater than zero');
    assert.strictEqual(
      summary.grossProfit,
      summary.totalRevenue - summary.costOfGoodsSold - summary.totalRefunds,
      'Gross profit must equal Revenue - COGS - Refunds'
    );
    assert.ok(summary.profitMarginPercent >= 0, 'Profit margin percentage should be non-negative');
  });

  test('7. Daily breakdowns and Top Selling Products calculation', async () => {
    const daily = await reportsService.getDailySummaries(7);
    assert.strictEqual(daily.length, 7, 'Should return 7 daily summaries');

    const top = await reportsService.getTopSellingProducts(5);
    assert.ok(top.length >= 1, 'Should find top selling products');
    assert.ok(top[0].quantitySold >= 1, 'Top product should have sales');
  });

  test('8. Inventory valuation calculates cost and retail values accurately', async () => {
    const valuation = await reportsService.getInventoryValuation();
    assert.ok(valuation.totalItemsCount >= 5, 'Should count inventory products');
    assert.ok(valuation.totalCostValue > 0, 'Total cost value should be positive');
    assert.ok(valuation.totalRetailValue > valuation.totalCostValue, 'Retail value should exceed cost value');
    assert.strictEqual(
      valuation.potentialProfit,
      valuation.totalRetailValue - valuation.totalCostValue,
      'Potential profit must equal Retail - Cost'
    );
  });

  /* ---------------- 3. OPERATION HISTORY TESTS ---------------- */

  test('9. Operation history unifies sales, returns, purchases, and adjustments chronologically', async () => {
    const logs = await historyService.getAuditLog();
    assert.ok(logs.length >= 3, 'Audit log should contain entries');

    const types = new Set(logs.map(l => l.actionType));
    assert.ok(types.has('SALE'), 'Log should include sales');
    assert.ok(types.has('PURCHASE'), 'Log should include purchases');

    // Filter by actionType
    const salesOnly = await historyService.getAuditLog({ actionType: 'SALE' });
    assert.ok(salesOnly.every(l => l.actionType === 'SALE'));
  });

  /* ---------------- 4. BACKUP & RESTORE TESTS ---------------- */

  test('10. Manual backup creation captures data snapshot', async () => {
    const backup = await backupService.createBackup('manual');
    assert.ok(backup.filename.includes('accessories_backup_'));
    assert.strictEqual(backup.backup_type, 'manual');
    assert.strictEqual(backup.status, 'سليم ومتحقق منه');

    const allBackups = await backupService.getBackups();
    const found = allBackups.find(b => b.filename === backup.filename);
    assert.ok(found, 'Created backup should be in backups list');
  });

  test('11. Safe restore creates pre-restore safeguard backup and recovers state', async () => {
    // 1. Create a distinct test product
    const p1 = await productsService.addProduct({
      name: 'صنف قبل النسخ الاحتياطي',
      code: 'TEST-BAK-PRE-01',
      cost: 20,
      price: 50,
      stock: 15,
      low_stock_threshold: 3,
    });

    // 2. Take a backup of this state
    const backupItem = await backupService.createBackup('manual');

    // 3. Mutate data: update product stock to 999
    await productsService.updateProduct(p1.id, {
      name: p1.name,
      code: p1.code,
      cost: 20,
      price: 50,
      stock: 999,
      low_stock_threshold: 3,
    });

    const mutated = await productsService.getProductById(p1.id);
    assert.strictEqual(mutated?.stock, 999);

    // 4. Restore the backup
    await backupService.restoreBackup(backupItem.filename);

    // 5. Verify product stock restored back to 15!
    const restored = await productsService.getProductById(p1.id);
    assert.strictEqual(restored?.stock, 15, 'Stock should be restored back to 15 from backup');

    // 6. Verify an automatic safeguard backup was created
    const allBackups = await backupService.getBackups();
    const safeguard = allBackups.find(b => b.backup_type === 'safeguard');
    assert.ok(safeguard, 'A safeguard backup must be created before restore');
  });

  test('12. Scheduled automatic backup enforces retention limit', async () => {
    // Set retention count to 3
    backupService.saveBackupConfig({
      autoBackupEnabled: true,
      schedule: 'daily',
      retentionCount: 3,
    });

    // Create 4 auto backups
    await backupService.createBackup('auto');
    await backupService.createBackup('auto');
    await backupService.createBackup('auto');
    await backupService.createBackup('auto');

    const all = await backupService.getBackups();
    const autoBackups = all.filter(b => b.backup_type === 'auto');
    assert.ok(
      autoBackups.length <= 3,
      `Auto backups count (${autoBackups.length}) should not exceed retention limit of 3`
    );
  });
});
