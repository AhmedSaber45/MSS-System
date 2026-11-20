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

const { unifiedDashboardService } = await import('../src/services/unifiedDashboardService.ts');
const { desktopAuthService } = await import('../src/services/desktopAuthService.ts');
const { reportsService } = await import('../src/services/reportsService.ts');
const { productsService } = await import('../src/services/productsService.ts');
const { mssReportsService } = await import('../src/services/mssReportsService.ts');
const { mssCommerceService } = await import('../src/services/mssCommerceService.ts');
const { mssSyncService } = await import('../src/services/mssSyncService.ts');

describe('Fix Overview Statistics Page — Strict Module-Based Permissions', () => {

  describe('1. Case A — Accessories Only (Strict Data & Backend Isolation)', () => {
    test('Queries SQLite only, never touches MSS, combined totals equal Accessories data exclusively', async () => {
      // Instrument MSS services to ensure they are NOT called
      let mssQueryCalled = false;
      const origGetMSSFin = mssReportsService.getMSSFinancialSummary;
      const origGetBranch = mssReportsService.getBranchOperationalBreakdown;
      const origGetStock = mssReportsService.getInventoryValuationByLocation;
      const origGetRes = mssCommerceService.getReservations;
      const origGetSync = mssSyncService.getPendingOperations;

      mssReportsService.getMSSFinancialSummary = async () => {
        mssQueryCalled = true;
        return origGetMSSFin.call(mssReportsService);
      };
      mssReportsService.getBranchOperationalBreakdown = async () => {
        mssQueryCalled = true;
        return origGetBranch.call(mssReportsService);
      };
      mssReportsService.getInventoryValuationByLocation = async () => {
        mssQueryCalled = true;
        return origGetStock.call(mssReportsService);
      };
      mssCommerceService.getReservations = async () => {
        mssQueryCalled = true;
        return origGetRes.call(mssCommerceService);
      };
      mssSyncService.getPendingOperations = async () => {
        mssQueryCalled = true;
        return origGetSync.call(mssSyncService);
      };

      try {
        const data = await unifiedDashboardService.getUnifiedDashboardData('all', undefined, undefined, 'accessories');

        // Backend isolation: MSS services must NOT be called
        assert.strictEqual(mssQueryCalled, false, 'Backend isolation failure: MSS services were called for accessories-only user');

        // Scope and summaries
        assert.strictEqual(data.moduleScope, 'accessories');
        assert.ok(data.accessories, 'Accessories summary must be populated');
        assert.strictEqual(data.mss, null, 'MSS summary must be null for accessories-only user');

        // Combined calculations MUST match Accessories data exclusively
        assert.strictEqual(
          data.combined.combinedRevenue,
          data.accessories.netSales,
          'Combined revenue must equal Accessories net sales exclusively'
        );
        assert.strictEqual(
          data.combined.combinedCogs,
          data.accessories.costOfGoodsSold,
          'Combined COGS must equal Accessories COGS exclusively'
        );
        assert.strictEqual(
          data.combined.combinedGrossProfit,
          data.accessories.grossProfit,
          'Combined gross profit must equal Accessories gross profit exclusively'
        );
        assert.strictEqual(
          data.combined.totalTransactionsCount,
          data.accessories.invoicesCount,
          'Combined transactions must equal Accessories invoices exclusively'
        );

        // Sections 3 & 4: MSS tables must be completely empty
        assert.strictEqual(data.branchOperationalSales.length, 0, 'Branch operational sales must be empty');
        assert.strictEqual(data.locationStockValuation.length, 0, 'Location stock valuation must be empty');

        // Alerts: No MSS sync alerts
        assert.strictEqual(data.alerts.hasSyncAlerts, false, 'MSS sync alerts must be false');
        assert.strictEqual(data.alerts.mssPendingSync.length, 0, 'MSS pending sync items must be empty');
        assert.strictEqual(data.alerts.mssConflicts.length, 0, 'MSS conflicts must be empty');
      } finally {
        mssReportsService.getMSSFinancialSummary = origGetMSSFin;
        mssReportsService.getBranchOperationalBreakdown = origGetBranch;
        mssReportsService.getInventoryValuationByLocation = origGetStock;
        mssCommerceService.getReservations = origGetRes;
        mssSyncService.getPendingOperations = origGetSync;
      }
    });
  });

  describe('2. Case B — Compu MSS Only (Strict Data & Backend Isolation)', () => {
    test('Queries MSS services only, never touches SQLite/Accessories, combined totals equal MSS data exclusively', async () => {
      // Instrument Accessories services to ensure they are NOT called
      let accQueryCalled = false;
      const origGetFin = reportsService.getFinancialSummary;
      const origGetMetrics = productsService.getMetrics;
      const origGetValuation = reportsService.getInventoryValuation;
      const origGetProducts = productsService.getProducts;

      reportsService.getFinancialSummary = async () => {
        accQueryCalled = true;
        return origGetFin.call(reportsService);
      };
      productsService.getMetrics = async () => {
        accQueryCalled = true;
        return origGetMetrics.call(productsService);
      };
      reportsService.getInventoryValuation = async () => {
        accQueryCalled = true;
        return origGetValuation.call(reportsService);
      };
      productsService.getProducts = async () => {
        accQueryCalled = true;
        return origGetProducts.call(productsService);
      };

      try {
        const data = await unifiedDashboardService.getUnifiedDashboardData('all', undefined, undefined, 'mss');

        // Backend isolation: Accessories SQLite services must NOT be called
        assert.strictEqual(accQueryCalled, false, 'Backend isolation failure: Accessories services were called for MSS-only user');

        // Scope and summaries
        assert.strictEqual(data.moduleScope, 'mss');
        assert.strictEqual(data.accessories, null, 'Accessories summary must be null for MSS-only user');
        assert.ok(data.mss, 'MSS summary must be populated');

        // Combined calculations MUST match MSS data exclusively
        assert.strictEqual(
          data.combined.combinedRevenue,
          data.mss.netSales,
          'Combined revenue must equal MSS net sales exclusively'
        );
        assert.strictEqual(
          data.combined.combinedCogs,
          data.mss.costOfGoodsSold,
          'Combined COGS must equal MSS COGS exclusively'
        );
        assert.strictEqual(
          data.combined.combinedGrossProfit,
          data.mss.sharedGrossProfit,
          'Combined gross profit must equal MSS shared gross profit exclusively'
        );
        assert.strictEqual(
          data.combined.totalTransactionsCount,
          data.mss.soldDevicesCount,
          'Combined transactions must equal MSS sold devices count exclusively'
        );

        // Sections 3 & 4: MSS tables must be populated
        assert.ok(data.branchOperationalSales.length > 0, 'Branch operational sales must be present for MSS user');
        assert.ok(data.locationStockValuation.length > 0, 'Location stock valuation must be present for MSS user');

        // Alerts: No Accessories low stock alerts
        assert.strictEqual(data.alerts.hasStockAlerts, false, 'Accessories stock alerts must be false');
        assert.strictEqual(data.alerts.accessoriesLowStock.length, 0, 'Accessories low stock must be empty');
        assert.strictEqual(data.alerts.accessoriesOutOfStock.length, 0, 'Accessories out of stock must be empty');
      } finally {
        reportsService.getFinancialSummary = origGetFin;
        productsService.getMetrics = origGetMetrics;
        reportsService.getInventoryValuation = origGetValuation;
        productsService.getProducts = origGetProducts;
      }
    });
  });

  describe('3. Case C — Users with Access to Both Modules', () => {
    test('Queries both modules, combines totals, displays full executive overview', async () => {
      const data = await unifiedDashboardService.getUnifiedDashboardData('all', undefined, undefined, 'both');

      assert.strictEqual(data.moduleScope, 'both');
      assert.ok(data.accessories, 'Accessories summary must be present');
      assert.ok(data.mss, 'MSS summary must be present');

      // Combined totals must equal sum of both
      const expectedRevenue = data.accessories.netSales + data.mss.netSales;
      const expectedCogs = data.accessories.costOfGoodsSold + data.mss.costOfGoodsSold;
      const expectedProfit = data.accessories.grossProfit + data.mss.sharedGrossProfit;
      const expectedTransactions = data.accessories.invoicesCount + data.mss.soldDevicesCount;

      assert.strictEqual(data.combined.combinedRevenue, expectedRevenue);
      assert.strictEqual(data.combined.combinedCogs, expectedCogs);
      assert.strictEqual(data.combined.combinedGrossProfit, expectedProfit);
      assert.strictEqual(data.combined.totalTransactionsCount, expectedTransactions);

      // Tables present
      assert.ok(data.branchOperationalSales.length > 0);
      assert.ok(data.locationStockValuation.length > 0);
    });
  });

  describe('4. Case D — Users with Access to Neither Module', () => {
    test('Zero queries, zero totals, all module metrics null', async () => {
      let anyCalled = false;
      const origGetFin = reportsService.getFinancialSummary;
      const origGetMSSFin = mssReportsService.getMSSFinancialSummary;

      reportsService.getFinancialSummary = async () => {
        anyCalled = true;
        return origGetFin.call(reportsService);
      };
      mssReportsService.getMSSFinancialSummary = async () => {
        anyCalled = true;
        return origGetMSSFin.call(mssReportsService);
      };

      try {
        const data = await unifiedDashboardService.getUnifiedDashboardData('all', undefined, undefined, 'none');

        assert.strictEqual(anyCalled, false, 'No database services should be queried when user has no permissions');
        assert.strictEqual(data.moduleScope, 'none');
        assert.strictEqual(data.combined.combinedRevenue, 0);
        assert.strictEqual(data.combined.combinedCogs, 0);
        assert.strictEqual(data.combined.combinedGrossProfit, 0);
        assert.strictEqual(data.combined.totalTransactionsCount, 0);
        assert.strictEqual(data.accessories, null);
        assert.strictEqual(data.mss, null);
        assert.strictEqual(data.branchOperationalSales.length, 0);
        assert.strictEqual(data.locationStockValuation.length, 0);
        assert.strictEqual(data.alerts.hasStockAlerts, false);
        assert.strictEqual(data.alerts.hasSyncAlerts, false);
      } finally {
        reportsService.getFinancialSummary = origGetFin;
        mssReportsService.getMSSFinancialSummary = origGetMSSFin;
      }
    });
  });

  describe('5. Session & Permission Dynamic Resolution', () => {
    test('Automatically resolves module scope from secure session if not explicitly passed', async () => {
      // 1. Simulate session with MSS only
      await desktopAuthService.saveSecureSession({
        sessionToken: 'test-token-mss',
        user: {
          id: 'user-mss-01',
          username: 'compu_mss',
          displayName: 'Compu MSS User',
          allowedModules: 'mss',
          assignedStoreIds: [],
          credentialVersion: 1,
          permissionVersion: 1,
        },
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        lastOnlineValidationAt: new Date().toISOString(),
        offlineMaxDays: 7,
      });

      const mssData = await unifiedDashboardService.getUnifiedDashboardData('all');
      assert.strictEqual(mssData.moduleScope, 'mss');
      assert.strictEqual(mssData.accessories, null);
      assert.ok(mssData.mss);

      // 2. Simulate permission change to Accessories only
      await desktopAuthService.saveSecureSession({
        sessionToken: 'test-token-acc',
        user: {
          id: 'user-acc-01',
          username: 'acc_staff',
          displayName: 'Accessories Staff',
          allowedModules: 'accessories',
          assignedStoreIds: [],
          credentialVersion: 1,
          permissionVersion: 2,
        },
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        lastOnlineValidationAt: new Date().toISOString(),
        offlineMaxDays: 7,
      });

      const accData = await unifiedDashboardService.getUnifiedDashboardData('all');
      assert.strictEqual(accData.moduleScope, 'accessories');
      assert.ok(accData.accessories);
      assert.strictEqual(accData.mss, null);

      // 3. Super Admin account preservation
      await desktopAuthService.saveSecureSession({
        sessionToken: 'test-token-admin',
        user: {
          id: 'admin-01',
          username: 'ahmed',
          displayName: 'أحمد صابر',
          allowedModules: 'both',
          assignedStoreIds: [],
          credentialVersion: 1,
          permissionVersion: 1,
        },
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        lastOnlineValidationAt: new Date().toISOString(),
        offlineMaxDays: 7,
      });

      const adminData = await unifiedDashboardService.getUnifiedDashboardData('all');
      assert.strictEqual(adminData.moduleScope, 'both');
      assert.ok(adminData.accessories);
      assert.ok(adminData.mss);
    });
  });

});
