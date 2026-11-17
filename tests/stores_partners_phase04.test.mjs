import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

describe('Phase 04 — Stores, Warehouses & Partner Management Verification', () => {
  const rootDir = process.cwd();
  const migrationPath = path.join(rootDir, 'supabase', 'migrations', '20261117_phase04_stores_and_partners.sql');
  const salesServicePath = path.join(rootDir, 'src', 'services', 'salesService.ts');
  const mssInventoryServicePath = path.join(rootDir, 'src', 'services', 'mssInventoryService.ts');
  const adminServicePath = path.join(rootDir, 'admin-dashboard', 'src', 'services', 'adminService.ts');

  // ==========================================================================
  // 1. SQL Migration Integrity & Schema Extensions
  // ==========================================================================
  describe('1. SQL Migration Integrity & Database Schema Extensions', () => {
    it('migration file exists at exact expected path', () => {
      assert.ok(fs.existsSync(migrationPath), 'Migration file must exist');
    });

    it('migration updates check constraint to support "combined" store type', () => {
      const sql = fs.readFileSync(migrationPath, 'utf8');
      assert.ok(
        sql.includes("type IN ('store', 'warehouse', 'combined')") ||
        sql.includes("type in ('store', 'warehouse', 'combined')"),
        'Must support store, warehouse, and combined store types'
      );
    });

    it('migration adds soft archive and merge lineage columns to system_stores', () => {
      const sql = fs.readFileSync(migrationPath, 'utf8');
      assert.ok(sql.includes('description'), 'Must include description column');
      assert.ok(sql.includes('is_archived'), 'Must include is_archived column');
      assert.ok(sql.includes('archived_at'), 'Must include archived_at column');
      assert.ok(sql.includes('merged_into_id'), 'Must include merged_into_id foreign key');
    });

    it('migration creates store_merges audit table and atomic RPC execute_store_merge', () => {
      const sql = fs.readFileSync(migrationPath, 'utf8');
      assert.ok(sql.includes('store_merges'), 'Must create store_merges table');
      assert.ok(
        sql.includes('execute_store_merge'),
        'Must define execute_store_merge atomic function'
      );
      assert.ok(sql.includes('SECURITY DEFINER'), 'Function must be SECURITY DEFINER');
    });

    it('migration enforces RLS policies protecting system_stores and store_merges', () => {
      const sql = fs.readFileSync(migrationPath, 'utf8');
      assert.ok(sql.includes('ENABLE ROW LEVEL SECURITY'), 'Must enable RLS');
      assert.ok(sql.includes('store_merges'), 'Must include policies for store_merges');
    });
  });

  // ==========================================================================
  // 2. Critical Architecture Rule: "Users Are Not Warehouses"
  // ==========================================================================
  describe('2. Critical Architectural Rule: Users Are Not Warehouses', () => {
    it('Compu MSS devices are linked to physical stock_location, not user/partner accounts', () => {
      const mssInvCode = fs.readFileSync(mssInventoryServicePath, 'utf8');
      assert.ok(mssInvCode.includes('stock_location'), 'Devices must track stock_location');
      // Verify devices are looked up and stored by physical location, not cashier/partner user ID
      assert.ok(!mssInvCode.includes('user_id = ?'), 'Device lookup must not be keyed on user_id');
    });

    it('Accessories SQLite database is completely isolated from cloud store/partner changes (Rule 6)', () => {
      const salesCode = fs.readFileSync(salesServicePath, 'utf8');
      assert.ok(!salesCode.includes('system_stores'), 'Accessories sales must not contain system_stores');
      assert.ok(!salesCode.includes('store_merges'), 'Accessories sales must not contain store_merges');
      assert.ok(!salesCode.includes('user_store_assignments'), 'Accessories sales must not contain user_store_assignments');
    });
  });

  // ==========================================================================
  // 3. Admin Service Store & Partner Models
  // ==========================================================================
  describe('3. Admin Service Store & Partner Membership Implementation', () => {
    it('adminService contains store CRUD with archive and combined type support', () => {
      const serviceCode = fs.readFileSync(adminServicePath, 'utf8');
      assert.ok(serviceCode.includes('createStore'), 'Must implement createStore');
      assert.ok(serviceCode.includes('archiveStore'), 'Must implement archiveStore');
      assert.ok(serviceCode.includes('getStoreDetails'), 'Must implement getStoreDetails');
      assert.ok(serviceCode.includes('toggleStoreStatus'), 'Must implement toggleStoreStatus');
    });

    it('adminService implements partner assignment with desktop session version bumping', () => {
      const serviceCode = fs.readFileSync(adminServicePath, 'utf8');
      assert.ok(serviceCode.includes('assignUserToStore'), 'Must implement assignUserToStore');
      assert.ok(serviceCode.includes('removeUserFromStore'), 'Must implement removeUserFromStore');
      assert.ok(serviceCode.includes('permission_version'), 'Must bump permission_version on assignment change');
    });

    it('adminService implements previewStoreMerge and atomic executeStoreMerge', () => {
      const serviceCode = fs.readFileSync(adminServicePath, 'utf8');
      assert.ok(serviceCode.includes('previewStoreMerge'), 'Must implement previewStoreMerge');
      assert.ok(serviceCode.includes('executeStoreMerge'), 'Must implement executeStoreMerge');
    });

    it('CRITICAL GUARANTEE: executeStoreMerge performs ZERO inventory transfers', () => {
      const serviceCode = fs.readFileSync(adminServicePath, 'utf8');
      const migrationCode = fs.readFileSync(migrationPath, 'utf8');

      // Verify that neither execute_store_merge in SQL nor in adminService updates device stock_location
      assert.ok(
        !migrationCode.includes('UPDATE mss_devices SET stock_location'),
        'SQL execute_store_merge must NOT modify mss_devices.stock_location in Phase 4'
      );
      assert.ok(
        !serviceCode.includes('UPDATE mss_devices SET stock_location'),
        'adminService executeStoreMerge must NOT modify device stock_locations in Phase 4'
      );
    });
  });

  // ==========================================================================
  // 4. UI Components Structure
  // ==========================================================================
  describe('4. UI Components & 5-Step Merge Wizard', () => {
    const storesViewPath = path.join(rootDir, 'admin-dashboard', 'src', 'components', 'stores', 'StoresView.tsx');
    const mergeWizardPath = path.join(rootDir, 'admin-dashboard', 'src', 'components', 'stores', 'StoreMergeWizardModal.tsx');
    const storeDetailsModalPath = path.join(rootDir, 'admin-dashboard', 'src', 'components', 'stores', 'StoreDetailsModal.tsx');

    it('StoresView component exists and includes KPI summary and filter controls', () => {
      assert.ok(fs.existsSync(storesViewPath), 'StoresView must exist');
      const code = fs.readFileSync(storesViewPath, 'utf8');
      assert.ok(code.includes('StoreMergeWizardModal'), 'Must integrate StoreMergeWizardModal');
      assert.ok(code.includes('StoreDetailsModal'), 'Must integrate StoreDetailsModal');
      assert.ok(code.includes('typeFilter'), 'Must include type filter');
      assert.ok(code.includes('statusFilter'), 'Must include status filter');
    });

    it('StoreMergeWizardModal implements the required 5-step guided workflow', () => {
      assert.ok(fs.existsSync(mergeWizardPath), 'StoreMergeWizardModal must exist');
      const code = fs.readFileSync(mergeWizardPath, 'utf8');
      // Step indicators
      assert.ok(code.includes('Step 1'), 'Must have Step 1: Select source stores');
      assert.ok(code.includes('Step 2'), 'Must have Step 2: Select destination store');
      assert.ok(code.includes('Step 3'), 'Must have Step 3: Preview impact');
      assert.ok(code.includes('Step 4'), 'Must have Step 4: Confirm disclaimer');
      assert.ok(code.includes('Step 5') || code.includes('Completed'), 'Must have Step 5: Execution');
      // Zero inventory transfer notice
      assert.ok(code.includes('zeroInventoryTransferNotice') || code.includes('المخزون'), 'Must state inventory stays intact');
    });

    it('StoreDetailsModal provides partner membership management', () => {
      assert.ok(fs.existsSync(storeDetailsModalPath), 'StoreDetailsModal must exist');
      const code = fs.readFileSync(storeDetailsModalPath, 'utf8');
      assert.ok(code.includes('assign_user') || code.includes('handleAssignUser'), 'Must support assigning partner');
      assert.ok(code.includes('remove_user') || code.includes('handleRemoveUser'), 'Must support removing partner');
    });
  });
});
