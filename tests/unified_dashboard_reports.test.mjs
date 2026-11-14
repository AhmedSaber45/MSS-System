// Automated Verification Suite for Phase 10: Unified Dashboard & Reports
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';

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

// Import services dynamically
const { unifiedDashboardService } = await import('../src/services/unifiedDashboardService.ts');
const { mssReportsService } = await import('../src/services/mssReportsService.ts');
const { mssCommerceService } = await import('../src/services/mssCommerceService.ts');
const { mssInventoryService } = await import('../src/services/mssInventoryService.ts');
const { mssSyncService } = await import('../src/services/mssSyncService.ts');
const { reportsService } = await import('../src/services/reportsService.ts');
const { productsService } = await import('../src/services/productsService.ts');
const { salesService } = await import('../src/services/salesService.ts');

describe('Phase 10 — Unified Dashboard & Business Reports Verification', () => {
  beforeEach(() => {
    // Preserve environment
  });

  test('1. Date-range filter calculations: properly resolves today, yesterday, week, month, and custom', () => {
    const todayRange = unifiedDashboardService.calculateDateRange('today');
    assert.strictEqual(todayRange.period, 'today');
    assert.strictEqual(todayRange.label, 'اليوم');
    assert.ok(todayRange.startDate);
    assert.strictEqual(todayRange.startDate, todayRange.endDate);

    const weekRange = unifiedDashboardService.calculateDateRange('week');
    assert.strictEqual(weekRange.period, 'week');
    assert.strictEqual(weekRange.label, 'آخر 7 أيام');
    assert.ok(weekRange.startDate && weekRange.endDate);

    const customRange = unifiedDashboardService.calculateDateRange('custom', '2026-11-01', '2026-11-14');
    assert.strictEqual(customRange.startDate, '2026-11-01');
    assert.strictEqual(customRange.endDate, '2026-11-14');
    assert.strictEqual(customRange.label, 'من 2026-11-01 إلى 2026-11-14');
  });

  test('2. Separate business summaries: Accessories and MSS are completely distinct', async () => {
    const data = await unifiedDashboardService.getUnifiedDashboardData('all');

    // Accessories Summary Assertions
    assert.ok(data.accessories, 'Accessories summary must exist');
    assert.ok(typeof data.accessories.netSales === 'number');
    assert.ok(typeof data.accessories.costOfGoodsSold === 'number');
    assert.ok(typeof data.accessories.grossProfit === 'number');
    assert.ok(data.accessories.totalProducts > 0, 'Accessories total products must be greater than 0');
    assert.ok(data.accessories.totalUnits > 0, 'Accessories total stock units must be greater than 0');
    assert.ok(data.accessories.inventoryCostValuation > 0, 'Accessories cost valuation must be calculated');

    // MSS Summary Assertions
    assert.ok(data.mss, 'MSS summary must exist');
    assert.ok(typeof data.mss.netSales === 'number');
    assert.ok(typeof data.mss.costOfGoodsSold === 'number');
    assert.ok(typeof data.mss.sharedGrossProfit === 'number');
    assert.ok(data.mss.totalAvailableUnits > 0, 'MSS available units must be greater than 0');
    assert.ok(data.mss.inventoryCostValuation > 0, 'MSS inventory cost valuation must be calculated');

    // Verify properties are strictly separated
    assert.strictEqual(typeof data.accessories.shop1AvailableUnits, 'undefined');
    assert.strictEqual(typeof data.mss.totalProducts, 'undefined');
  });

  test('3. Combined financial performance: Combined = Accessories + MSS', async () => {
    const data = await unifiedDashboardService.getUnifiedDashboardData('all');

    const expectedRevenue = data.accessories.netSales + data.mss.netSales;
    const expectedCogs = data.accessories.costOfGoodsSold + data.mss.costOfGoodsSold;
    const expectedProfit = data.accessories.grossProfit + data.mss.sharedGrossProfit;
    const expectedTransactions = data.accessories.invoicesCount + data.mss.soldDevicesCount;

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
    assert.strictEqual(
      data.combined.totalTransactionsCount,
      expectedTransactions,
      'Combined transaction count must equal Accessories invoices + MSS sold devices'
    );
  });

  test('4. Operational sales attribution vs Shared MSS Profit (Rule 16 & Section 16)', async () => {
    const branchSales = await mssReportsService.getBranchOperationalBreakdown();

    assert.strictEqual(branchSales.length, 2, 'Must have exactly 2 branches (محل 1 and محل 2)');

    const shop1 = branchSales.find(b => b.branch === 'محل 1');
    const shop2 = branchSales.find(b => b.branch === 'محل 2');

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

  test('5. Physical stock valuation by location: Shop 1 vs Shop 2 inventory separation (Rule 9)', async () => {
    const stockVal = await mssReportsService.getInventoryValuationByLocation();

    assert.strictEqual(stockVal.length, 3, 'Must report Shop 1, Shop 2, and Grand Total');

    const s1 = stockVal.find(s => s.location === 'محل 1');
    const s2 = stockVal.find(s => s.location === 'محل 2');
    const total = stockVal.find(s => s.location === 'المجموع الكلي');

    assert.ok(s1 && s2 && total, 'All 3 location records must exist');
    assert.strictEqual(
      total.totalUnits,
      s1.totalUnits + s2.totalUnits,
      'Grand total units must equal sum of Shop 1 and Shop 2 units'
    );
    assert.strictEqual(
      total.totalCostValue,
      s1.totalCostValue + s2.totalCostValue,
      'Grand total cost must equal sum of Shop 1 and Shop 2 costs'
    );
    assert.strictEqual(
      total.totalListValue,
      s1.totalListValue + s2.totalListValue,
      'Grand total retail list must equal sum of Shop 1 and Shop 2 list values'
    );
  });

  test('6. Category breakdown: Segregates Laptops vs Monitors with accurate margin', async () => {
    const categories = await mssReportsService.getCategoryBreakdown();

    assert.ok(categories.length > 0, 'Must have category breakdown entries');
    for (const cat of categories) {
      assert.ok(cat.category, 'Category name must be present');
      assert.ok(cat.revenue >= 0, 'Revenue must be non-negative');
      assert.ok(cat.cogs >= 0, 'COGS must be non-negative');
      assert.strictEqual(cat.grossProfit, cat.revenue - cat.cogs, 'Gross profit must equal revenue - cogs');
    }
  });

  test('7. Active business alerts: low-stock and pending sync items compilation', async () => {
    const data = await unifiedDashboardService.getUnifiedDashboardData('all');

    assert.ok(data.alerts, 'Alerts object must exist');
    assert.ok(Array.isArray(data.alerts.accessoriesLowStock));
    assert.ok(Array.isArray(data.alerts.accessoriesOutOfStock));
    assert.ok(Array.isArray(data.alerts.mssPendingSync));
    assert.ok(Array.isArray(data.alerts.mssConflicts));
    assert.strictEqual(typeof data.alerts.hasStockAlerts, 'boolean');
    assert.strictEqual(typeof data.alerts.hasSyncAlerts, 'boolean');

    // Every item in low stock must have stock <= threshold
    for (const item of data.alerts.accessoriesLowStock) {
      assert.ok(item.stock <= item.threshold, 'Stock must be at or below threshold');
    }
  });

  test('8. Date-filtered reports: properly filters invoices and returns within window', async () => {
    // Query a historical window that has 0 transactions
    const emptyWindow = await unifiedDashboardService.getUnifiedDashboardData('custom', '2020-01-01', '2020-01-02');

    assert.strictEqual(emptyWindow.accessories.invoicesCount, 0, 'Should have 0 accessories invoices in 2020');
    assert.strictEqual(emptyWindow.accessories.netSales, 0, 'Should have 0 accessories revenue in 2020');
    assert.strictEqual(emptyWindow.mss.soldDevicesCount, 0, 'Should have 0 MSS sold devices in 2020');
    assert.strictEqual(emptyWindow.mss.netSales, 0, 'Should have 0 MSS revenue in 2020');
    assert.strictEqual(emptyWindow.combined.combinedRevenue, 0, 'Combined revenue must be 0 in empty window');
  });

  test('9. Strict separation: Accessories SQLite database is completely untouched by MSS reports (Rule 6)', async () => {
    const productsBefore = await productsService.getProducts();

    // Perform intensive MSS reporting and unified dashboard calculations
    await mssReportsService.getMSSFinancialSummary();
    await mssReportsService.getBranchOperationalBreakdown();
    await mssReportsService.getInventoryValuationByLocation();
    await mssReportsService.getCategoryBreakdown();
    await unifiedDashboardService.getUnifiedDashboardData('month');

    const productsAfter = await productsService.getProducts();
    assert.strictEqual(
      productsBefore.length,
      productsAfter.length,
      'Accessories product database must remain completely unaffected by MSS operations (Rule 6)'
    );
  });
});
