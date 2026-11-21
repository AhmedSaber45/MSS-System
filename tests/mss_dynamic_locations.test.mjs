import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

describe('Compu MSS — Fully Dynamic Branches, Stores, and Warehouses Verification', () => {
  const rootDir = process.cwd();
  const migrationPath = path.join(
    rootDir,
    'supabase',
    'migrations',
    '20261121_make_branches_and_locations_fully_dynamic.sql'
  );
  const hookPath = path.join(rootDir, 'src', 'hooks', 'useMSSLocations.ts');
  const operationalServicePath = path.join(rootDir, 'src', 'services', 'mssOperationalService.ts');
  const inventoryServicePath = path.join(rootDir, 'src', 'services', 'mssInventoryService.ts');
  const commerceServicePath = path.join(rootDir, 'src', 'services', 'mssCommerceService.ts');
  const reportsServicePath = path.join(rootDir, 'src', 'services', 'mssReportsService.ts');
  const catalogServicePath = path.join(rootDir, 'src', 'services', 'mssCatalogService.ts');
  const promotionalServicePath = path.join(rootDir, 'src', 'services', 'mssPromotionalService.ts');
  const salesViewPath = path.join(rootDir, 'src', 'components', 'placeholders', 'mss', 'MSSSalesView.tsx');
  const reservationsViewPath = path.join(rootDir, 'src', 'components', 'placeholders', 'mss', 'ReservationsView.tsx');
  const returnsViewPath = path.join(rootDir, 'src', 'components', 'placeholders', 'mss', 'MSSReturnsView.tsx');
  const invoicesViewPath = path.join(rootDir, 'src', 'components', 'placeholders', 'mss', 'MSSInvoicesView.tsx');
  const deviceReportsViewPath = path.join(rootDir, 'src', 'components', 'placeholders', 'mss', 'MSSDeviceReportsView.tsx');
  const inventoryViewPath = path.join(rootDir, 'src', 'components', 'placeholders', 'mss', 'MSSInventoryView.tsx');
  const dashboardViewPath = path.join(rootDir, 'src', 'components', 'placeholders', 'mss', 'MSSDashboardView.tsx');
  const catalogViewPath = path.join(rootDir, 'src', 'components', 'placeholders', 'mss', 'CatalogView.tsx');
  const promotionalGeneratorPath = path.join(rootDir, 'src', 'components', 'placeholders', 'mss', 'MSSPromotionalGenerator.tsx');

  // ==========================================================================
  // 1. Dynamic Source of Truth & Hook
  // ==========================================================================
  describe('1. Dynamic Source of Truth & useMSSLocations Hook', () => {
    it('useMSSLocations hook file exists and provides reactive locations and stores', () => {
      assert.ok(fs.existsSync(hookPath), 'Hook file src/hooks/useMSSLocations.ts must exist');
      const hookCode = fs.readFileSync(hookPath, 'utf8');
      assert.ok(hookCode.includes('export function useMSSLocations'), 'Must export useMSSLocations hook');
      assert.ok(hookCode.includes('mssOperationalService.getActiveLocationNamesSync'), 'Must read dynamic sync names');
      assert.ok(hookCode.includes('mssOperationalService.getActiveStores'), 'Must fetch active stores');
      assert.ok(hookCode.includes('mss-stores-changed'), 'Must listen to store change events');
    });

    it('mssOperationalService provides dynamic helpers and change notification', () => {
      const opCode = fs.readFileSync(operationalServicePath, 'utf8');
      assert.ok(opCode.includes('notifyStoresChanged()'), 'Must have notifyStoresChanged');
      assert.ok(opCode.includes('getActiveStoresSync()'), 'Must have getActiveStoresSync');
      assert.ok(opCode.includes('getActiveStores()'), 'Must have getActiveStores');
      assert.ok(opCode.includes('getActiveLocationNamesSync()'), 'Must have getActiveLocationNamesSync');
      assert.ok(opCode.includes('getActiveLocationNames()'), 'Must have getActiveLocationNames');
    });

    it('mssOperationalService dispatches mss-stores-changed on mutations', () => {
      const opCode = fs.readFileSync(operationalServicePath, 'utf8');
      assert.ok(opCode.includes("window.dispatchEvent(new CustomEvent('mss-stores-changed'))"), 'Must dispatch mss-stores-changed event');
    });
  });

  // ==========================================================================
  // 2. Removal of Fictional / Sample Warehouses
  // ==========================================================================
  describe('2. Removal of Fictional and Sample Locations', () => {
    it('DEFAULT_SEED_STORES seeds only the real locations (محل 1, محل 2) and no fictional WH01/المخزن المركزي', () => {
      const opCode = fs.readFileSync(operationalServicePath, 'utf8');
      assert.ok(opCode.includes("name: 'محل 1'"), 'Must seed محل 1');
      assert.ok(opCode.includes("name: 'محل 2'"), 'Must seed محل 2');
      assert.ok(!opCode.includes("code: 'WH01'"), 'Must NOT seed WH01');
      assert.ok(!opCode.includes("name: 'المخزن المركزي'"), 'Must NOT seed المخزن المركزي');
    });

    it('getCachedStores filters out fictional codes and names from local cache', () => {
      const opCode = fs.readFileSync(operationalServicePath, 'utf8');
      assert.ok(opCode.includes('sanitizeStoresList'), 'Must sanitize cached store list');
      assert.ok(opCode.includes('FICTIONAL_STORE_CODES'), 'Must define fictional store codes to prune');
    });
  });

  // ==========================================================================
  // 3. Dynamic Service-Level Validation & Preservation of History
  // ==========================================================================
  describe('3. Dynamic Service Validation & Historical Data Integrity', () => {
    it('mssInventoryService validates locations dynamically against active locations', () => {
      const invCode = fs.readFileSync(inventoryServicePath, 'utf8');
      assert.ok(
        !invCode.includes("!['محل 1', 'محل 2'].includes(input.stock_location)"),
        'Must not have hardcoded stock_location check in input'
      );
      assert.ok(
        !invCode.includes("!['محل 1', 'محل 2'].includes(toLocation)"),
        'Must not have hardcoded toLocation check in transfers'
      );
      assert.ok(
        invCode.includes('mssOperationalService.getActiveLocationNames()'),
        'Must query dynamic active location names'
      );
    });

    it('mssCommerceService validates sale branch and returns restock location dynamically', () => {
      const comCode = fs.readFileSync(commerceServicePath, 'utf8');
      assert.ok(
        !comCode.includes("!['محل 1', 'محل 2'].includes(input.selling_branch)"),
        'Must not have hardcoded selling_branch check'
      );
      assert.ok(
        !comCode.includes("!['محل 1', 'محل 2'].includes(input.restock_location)"),
        'Must not have hardcoded restock_location check'
      );
      assert.ok(
        comCode.includes('mssOperationalService.getActiveLocationNames()'),
        'Must query dynamic active location names'
      );
    });

    it('mssReportsService derives branch breakdown dynamically and preserves historical transactions', () => {
      const repCode = fs.readFileSync(reportsServicePath, 'utf8');
      assert.ok(
        !repCode.includes("const branches: MSSStockLocation[] = ['محل 1', 'محل 2']"),
        'Must not hardcode branches array in reports'
      );
      assert.ok(
        repCode.includes('mssOperationalService.getActiveLocationNames()'),
        'Must get dynamic active location names'
      );
      assert.ok(
        repCode.includes('historicalBranches'),
        'Must preserve historical branches from transaction records'
      );
    });

    it('mssPromotionalService and Generator display dynamic branch names in footer', () => {
      const promoServCode = fs.readFileSync(promotionalServicePath, 'utf8');
      const promoGenCode = fs.readFileSync(promotionalGeneratorPath, 'utf8');
      assert.ok(
        promoServCode.includes('mssOperationalService.getActiveLocationNamesSync()'),
        'Promotional canvas footer must render dynamic active locations'
      );
      assert.ok(
        promoGenCode.includes('useMSSLocations'),
        'Promotional poster preview component must use dynamic useMSSLocations'
      );
    });
  });

  // ==========================================================================
  // 4. UI Components Render Locations Dynamically
  // ==========================================================================
  describe('4. UI Components Use Dynamic Locations', () => {
    it('MSSSalesView populates branch options from useMSSLocations', () => {
      const code = fs.readFileSync(salesViewPath, 'utf8');
      assert.ok(code.includes('useMSSLocations'), 'Must use useMSSLocations');
      assert.ok(!code.includes("{ value: 'محل 1', label: 'محل 1 (الفرع الأول)' }"), 'Must not have hardcoded branch options');
    });

    it('ReservationsView populates branch filters and modal options dynamically', () => {
      const code = fs.readFileSync(reservationsViewPath, 'utf8');
      assert.ok(code.includes('useMSSLocations'), 'Must use useMSSLocations');
      assert.ok(code.includes('locations.map'), 'Must map over dynamic locations');
    });

    it('MSSReturnsView populates restock location options dynamically', () => {
      const code = fs.readFileSync(returnsViewPath, 'utf8');
      assert.ok(code.includes('useMSSLocations'), 'Must use useMSSLocations');
      assert.ok(code.includes('locations.map'), 'Must map over dynamic locations');
    });

    it('MSSInvoicesView populates selling branch filter dynamically', () => {
      const code = fs.readFileSync(invoicesViewPath, 'utf8');
      assert.ok(code.includes('useMSSLocations'), 'Must use useMSSLocations');
      assert.ok(code.includes('locations.map'), 'Must map over dynamic locations');
    });

    it('MSSDeviceReportsView dynamically renders wholesale options, model breakdown, and sold devices report', () => {
      const code = fs.readFileSync(deviceReportsViewPath, 'utf8');
      assert.ok(code.includes('useMSSLocations'), 'Must use useMSSLocations');
      assert.ok(!code.includes('<option value="محل 1">محل 1 فقط</option>'), 'Wholesale select must not hardcode محل 1');
      assert.ok(code.includes("['ALL', ...locations]"), 'Sold report tabs must map over dynamic locations');
    });

    it('MSSInventoryView cross-warehouse table renders dynamic columns and KPI cards', () => {
      const code = fs.readFileSync(inventoryViewPath, 'utf8');
      assert.ok(code.includes('locationOptions.map'), 'Must map columns over dynamic locationOptions');
      assert.ok(!code.includes('<p className="text-xs text-slate-600 font-bold mb-1">متوفر بمحل 1</p>'), 'KPI cards must not be hardcoded');
    });

    it('MSSDashboardView renders dynamic KPI cards and model availability table per branch', () => {
      const code = fs.readFileSync(dashboardViewPath, 'utf8');
      assert.ok(code.includes('useMSSLocations'), 'Must use useMSSLocations');
      assert.ok(code.includes('locations.map'), 'Must map KPI cards and table columns over dynamic locations');
      assert.ok(!code.includes('title="مخزون محل 1 "'), 'Must not hardcode stock card for محل 1');
    });

    it('CatalogView renders dynamic branch availability badges', () => {
      const code = fs.readFileSync(catalogViewPath, 'utf8');
      assert.ok(code.includes('useMSSLocations'), 'Must use useMSSLocations');
      assert.ok(code.includes('locations.map'), 'Must map dynamic badges');
      assert.ok(!code.includes('title="المتاح في محل 1"'), 'Must not hardcode badge for محل 1');
    });
  });

  // ==========================================================================
  // 5. Consolidated SQL Migration File Verification
  // ==========================================================================
  describe('5. Consolidated SQL Migration File Verification', () => {
    it('migration file exists at exact expected path', () => {
      assert.ok(fs.existsSync(migrationPath), 'SQL migration file must exist');
    });

    it('migration safely drops hardcoded branch check constraints across tables', () => {
      const sql = fs.readFileSync(migrationPath, 'utf8');
      assert.ok(sql.includes('mss_devices_stock_location_check'), 'Must drop mss_devices check');
      assert.ok(sql.includes('mss_invoices_selling_branch_check'), 'Must drop selling_branch check');
      assert.ok(sql.includes('mss_invoices_source_branch_check'), 'Must drop source_branch check');
      assert.ok(sql.includes('mss_invoice_items_source_branch_check'), 'Must drop invoice_items check');
      assert.ok(sql.includes('mss_reservations_branch_check'), 'Must drop reservations check');
      assert.ok(sql.includes('mss_reservation_items_source_branch_check'), 'Must drop reservation_items check');
      assert.ok(sql.includes('mss_returns_restock_location_check'), 'Must drop restock_location check');
      assert.ok(sql.includes('pg_constraint'), 'Must dynamically scan for any unnamed check constraints');
    });

    it('migration ensures system_stores contains محل 1 and محل 2 as active stores', () => {
      const sql = fs.readFileSync(migrationPath, 'utf8');
      assert.ok(sql.includes("'محل 1'"), 'Must insert/update محل 1');
      assert.ok(sql.includes("'محل 2'"), 'Must insert/update محل 2');
      assert.ok(sql.includes("'SH01'"), 'Must assign code SH01');
      assert.ok(sql.includes("'SH02'"), 'Must assign code SH02');
    });

    it('migration soft-archives fictional stores (WH01, WH_MAIN, المخزن المركزي)', () => {
      const sql = fs.readFileSync(migrationPath, 'utf8');
      assert.ok(sql.includes('WH01'), 'Must archive WH01');
      assert.ok(sql.includes('WH_MAIN'), 'Must archive WH_MAIN');
      assert.ok(sql.includes('المخزن المركزي'), 'Must archive المخزن المركزي');
      assert.ok(sql.includes('is_archived = true'), 'Must set is_archived = true');
      assert.ok(sql.includes('is_active = false'), 'Must set is_active = false');
    });
  });
});
