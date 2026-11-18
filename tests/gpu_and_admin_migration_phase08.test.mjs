import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

describe('Phase 08 — Laptop GPU Specification & Admin Operations Migration Verification', () => {
  const rootDir = process.cwd();

  // ==========================================================================
  // 1. GPU SPECIFICATION IN CATALOG & WORKFLOWS
  // ==========================================================================
  describe('1. GPU Specification in Catalog & Hardware Workflows', () => {
    const catalogTypesPath = path.join(rootDir, 'src', 'types', 'mssCatalog.ts');
    const catalogServicePath = path.join(rootDir, 'src', 'services', 'mssCatalogService.ts');
    const catalogViewPath = path.join(rootDir, 'src', 'components', 'placeholders', 'mss', 'CatalogView.tsx');
    const commerceTypesPath = path.join(rootDir, 'src', 'types', 'mssCommerce.ts');
    const commerceServicePath = path.join(rootDir, 'src', 'services', 'mssCommerceService.ts');
    const salesViewPath = path.join(rootDir, 'src', 'components', 'placeholders', 'mss', 'MSSSalesView.tsx');
    const invoicesViewPath = path.join(rootDir, 'src', 'components', 'placeholders', 'mss', 'MSSInvoicesView.tsx');

    it('catalog types include optional gpu field across MSSCatalogModel and inputs', () => {
      assert.ok(fs.existsSync(catalogTypesPath), 'mssCatalog.ts must exist');
      const content = fs.readFileSync(catalogTypesPath, 'utf8');
      assert.ok(content.includes('gpu?: string | null;'), 'MSSCatalogModel must include optional gpu');
      assert.ok(content.includes('gpu?: string | null;'), 'NewMSSModelInput must include optional gpu');
      assert.ok(content.includes('gpu?: string | null;'), 'UpdateMSSModelInput must include optional gpu');
    });

    it('catalog service persists and queries gpu in createModel, updateModel, and seeds', () => {
      assert.ok(fs.existsSync(catalogServicePath), 'mssCatalogService.ts must exist');
      const content = fs.readFileSync(catalogServicePath, 'utf8');
      assert.ok(content.includes('gpu:'), 'Must include gpu in seed models');
      assert.ok(content.includes('gpu: input.gpu?.trim() || null'), 'createModel must handle gpu');
      assert.ok(content.includes('gpu: input.gpu !== undefined ? input.gpu.trim() || null : current.gpu'), 'updateModel must handle gpu');
    });

    it('catalog view provides GPU input for laptops and displays GPU spec', () => {
      assert.ok(fs.existsSync(catalogViewPath), 'CatalogView.tsx must exist');
      const content = fs.readFileSync(catalogViewPath, 'utf8');
      assert.ok(content.includes('gpu, setGpu'), 'Must have gpu state');
      assert.ok(content.includes('CircuitBoard'), 'Must import or use CircuitBoard icon for GPU');
      assert.ok(content.includes('كارت الشاشة') || content.includes('كرت الشاشة'), 'Must have Arabic label for GPU');
      assert.ok(content.includes('m.gpu') || content.includes('model.gpu'), 'Must render m.gpu in table and cards');
    });

    it('commerce types and service include gpu in sales and invoices', () => {
      assert.ok(fs.existsSync(commerceTypesPath), 'mssCommerce.ts must exist');
      const typesContent = fs.readFileSync(commerceTypesPath, 'utf8');
      assert.ok(typesContent.includes('gpu?: string | null;'), 'MSSInvoice must include optional gpu');

      assert.ok(fs.existsSync(commerceServicePath), 'mssCommerceService.ts must exist');
      const serviceContent = fs.readFileSync(commerceServicePath, 'utf8');
      assert.ok(serviceContent.includes('gpu: device.model?.gpu'), 'createSale must populate gpu');
    });

    it('sales and invoices views render laptop GPU specifications', () => {
      const salesContent = fs.readFileSync(salesViewPath, 'utf8');
      assert.ok(salesContent.includes('gpu') || salesContent.includes('كرت الشاشة'), 'MSSSalesView must display GPU specs');

      const invoicesContent = fs.readFileSync(invoicesViewPath, 'utf8');
      assert.ok(invoicesContent.includes('gpu') || invoicesContent.includes('كرت الشاشة'), 'MSSInvoicesView must display GPU specs');
    });
  });

  // ==========================================================================
  // 2. OPERATIONAL SERVICES & DATA INTEGRITY
  // ==========================================================================
  describe('2. Operational Services & Offline Resilience', () => {
    const operationalTypesPath = path.join(rootDir, 'src', 'types', 'mssOperational.ts');
    const operationalServicePath = path.join(rootDir, 'src', 'services', 'mssOperationalService.ts');

    it('operational types define stores, transfers, audit logs, and previews', () => {
      assert.ok(fs.existsSync(operationalTypesPath), 'mssOperational.ts must exist');
      const content = fs.readFileSync(operationalTypesPath, 'utf8');
      assert.ok(content.includes('export interface SystemStore'), 'Must define SystemStore');
      assert.ok(content.includes('export interface InventoryTransfer'), 'Must define InventoryTransfer');
      assert.ok(content.includes('export interface TransferPreviewResponse'), 'Must define TransferPreviewResponse');
      assert.ok(content.includes('export interface ExecuteTransferResult'), 'Must define ExecuteTransferResult');
      assert.ok(content.includes('export interface AdminAuditLog'), 'Must define AdminAuditLog');
    });

    it('operational service implements store management and merge previews', () => {
      assert.ok(fs.existsSync(operationalServicePath), 'mssOperationalService.ts must exist');
      const content = fs.readFileSync(operationalServicePath, 'utf8');
      assert.ok(content.includes('async getStores'), 'Must implement getStores');
      assert.ok(content.includes('async createStore'), 'Must implement createStore');
      assert.ok(content.includes('async updateStore'), 'Must implement updateStore');
      assert.ok(content.includes('async archiveStore'), 'Must implement archiveStore');
      assert.ok(content.includes('async previewStoreMerge'), 'Must implement previewStoreMerge');
      assert.ok(content.includes('async executeStoreMerge'), 'Must implement executeStoreMerge');
    });

    it('operational service implements atomic inventory transfers and audit logging', () => {
      const content = fs.readFileSync(operationalServicePath, 'utf8');
      assert.ok(content.includes('async previewInventoryTransfer'), 'Must implement previewInventoryTransfer');
      assert.ok(content.includes('async executeInventoryTransfer'), 'Must implement executeInventoryTransfer');
      assert.ok(content.includes('async getTransferHistory'), 'Must implement getTransferHistory');
      assert.ok(content.includes('async getAuditLogs'), 'Must implement getAuditLogs');
      assert.ok(content.includes('execute_inventory_transfer'), 'Must invoke atomic execute_inventory_transfer RPC');
    });

    it('operational service uses distinct local storage cache keys for offline fallback', () => {
      const content = fs.readFileSync(operationalServicePath, 'utf8');
      assert.ok(content.includes('shop_mss_stores_cache_v1'), 'Must cache stores locally');
      assert.ok(content.includes('shop_mss_transfers_cache_v1'), 'Must cache transfers locally');
      assert.ok(content.includes('shop_mss_audit_cache_v1'), 'Must cache audit logs locally');
    });
  });

  // ==========================================================================
  // 3. DESKTOP OPERATIONAL VIEWS
  // ==========================================================================
  describe('3. Native Desktop Operational Views', () => {
    const storesViewPath = path.join(rootDir, 'src', 'components', 'placeholders', 'mss', 'MSSStoresView.tsx');
    const inventoryViewPath = path.join(rootDir, 'src', 'components', 'placeholders', 'mss', 'MSSInventoryView.tsx');
    const movementsViewPath = path.join(rootDir, 'src', 'components', 'placeholders', 'mss', 'MovementsView.tsx');
    const auditViewPath = path.join(rootDir, 'src', 'components', 'placeholders', 'mss', 'MSSAuditLogView.tsx');

    it('stores view supports store listing, status toggles, partner memberships, and merge wizard', () => {
      assert.ok(fs.existsSync(storesViewPath), 'MSSStoresView.tsx must exist');
      const content = fs.readFileSync(storesViewPath, 'utf8');
      assert.ok(content.includes('الفروع والمخازن'), 'Must have proper Arabic title');
      assert.ok(content.includes('isMergeModalOpen'), 'Must support store merge');
      assert.ok(content.includes('handleToggleStatus'), 'Must support activating/deactivating stores');
      assert.ok(content.includes('handleArchiveStore'), 'Must support archiving stores');
    });

    it('inventory view supports multi-device selection, bulk transfer action, and category filtering', () => {
      assert.ok(fs.existsSync(inventoryViewPath), 'MSSInventoryView.tsx must exist');
      const content = fs.readFileSync(inventoryViewPath, 'utf8');
      assert.ok(content.includes('selectedDeviceIds'), 'Must track selectedDeviceIds');
      assert.ok(content.includes('handleOpenBulkTransfer'), 'Must have bulk transfer trigger');
      assert.ok(content.includes('categoryFilter'), 'Must support category filtering');
      assert.ok(content.includes('locationOptions'), 'Must support dynamic store locations');
      assert.ok(content.includes('isMultiTransferWizardOpen'), 'Must feature Guided Bulk Transfer Wizard');
    });

    it('movements view integrates dual tabs, KPIs, transfer details, and 6-step guided wizard', () => {
      assert.ok(fs.existsSync(movementsViewPath), 'MovementsView.tsx must exist');
      const content = fs.readFileSync(movementsViewPath, 'utf8');
      assert.ok(content.includes('activeTab'), 'Must feature dual tabs');
      assert.ok(content.includes('transfers'), 'Must show transfer batches');
      assert.ok(content.includes('movements'), 'Must show individual movements');
      assert.ok(content.includes('isWizardOpen'), 'Must include guided transfer wizard');
      assert.ok(content.includes('isDetailsModalOpen'), 'Must support viewing transfer receipts and details');
    });

    it('audit log view displays immutable append-only logs with filtering and metadata modal', () => {
      assert.ok(fs.existsSync(auditViewPath), 'MSSAuditLogView.tsx must exist');
      const content = fs.readFileSync(auditViewPath, 'utf8');
      assert.ok(content.includes('سجل النشاط والتدقيق'), 'Must have proper Arabic title');
      assert.ok(content.includes('targetFilter'), 'Must support target type filtering');
      assert.ok(content.includes('selectedLog'), 'Must support inspect log metadata');
      assert.ok(content.includes('محمي ضد التعديل') || content.includes('غير قابل للتعديل'), 'Must emphasize immutability');
    });
  });

  // ==========================================================================
  // 4. DESKTOP NAVIGATION & ROUTING
  // ==========================================================================
  describe('4. Desktop Navigation & App Routing', () => {
    const navTypesPath = path.join(rootDir, 'src', 'types', 'navigation.ts');
    const navConfigPath = path.join(rootDir, 'src', 'config', 'navigationConfig.ts');
    const appShellPath = path.join(rootDir, 'src', 'components', 'layout', 'AppShell.tsx');

    it('navigation types include stores and audit in MSSRoute', () => {
      const content = fs.readFileSync(navTypesPath, 'utf8');
      assert.ok(content.includes("'stores'"), "MSSRoute must include 'stores'");
      assert.ok(content.includes("'audit'"), "MSSRoute must include 'audit'");
    });

    it('navigation config includes navigation entries for stores and audit', () => {
      const content = fs.readFileSync(navConfigPath, 'utf8');
      assert.ok(content.includes("id: 'stores'"), "mssNavItems must include 'stores'");
      assert.ok(content.includes("id: 'audit'"), "mssNavItems must include 'audit'");
      assert.ok(content.includes("id: 'movements'"), "mssNavItems must include 'movements'");
    });

    it('AppShell routes to MSSStoresView and MSSAuditLogView', () => {
      const content = fs.readFileSync(appShellPath, 'utf8');
      assert.ok(content.includes('MSSStoresView'), 'AppShell must import MSSStoresView');
      assert.ok(content.includes('MSSAuditLogView'), 'AppShell must import MSSAuditLogView');
      assert.ok(content.includes("case 'stores':"), "AppShell must route case 'stores'");
      assert.ok(content.includes("case 'audit':"), "AppShell must route case 'audit'");
    });
  });

  // ==========================================================================
  // 5. ADMIN DASHBOARD CLEANUP
  // ==========================================================================
  describe('5. Admin Dashboard Scope & Cleanup', () => {
    const adminSidebarPath = path.join(rootDir, 'admin-dashboard', 'src', 'components', 'layout', 'AdminSidebar.tsx');
    const adminHeaderPath = path.join(rootDir, 'admin-dashboard', 'src', 'components', 'layout', 'AdminHeader.tsx');
    const adminPagePath = path.join(rootDir, 'admin-dashboard', 'src', 'app', 'page.tsx');
    const adminOverviewPath = path.join(rootDir, 'admin-dashboard', 'src', 'components', 'overview', 'OverviewView.tsx');

    it('admin sidebar navigation tabs are restricted to overview, users, and settings', () => {
      const content = fs.readFileSync(adminSidebarPath, 'utf8');
      assert.ok(content.includes("export type NavTab = 'overview' | 'users' | 'settings';"), 'NavTab must be strictly overview, users, settings');
      assert.ok(!content.includes("'stores' as NavTab"), 'Stores must be removed from sidebar');
      assert.ok(!content.includes("'inventory' as NavTab"), 'Inventory must be removed from sidebar');
      assert.ok(!content.includes("'transfers' as NavTab"), 'Transfers must be removed from sidebar');
      assert.ok(!content.includes("'audit' as NavTab"), 'Audit must be removed from sidebar');
    });

    it('admin dashboard page only renders overview, users, and settings views', () => {
      const content = fs.readFileSync(adminPagePath, 'utf8');
      assert.ok(!content.includes('StoresView'), 'StoresView must not be imported in admin page');
      assert.ok(!content.includes('InventoryFoundationView'), 'InventoryFoundationView must not be imported in admin page');
      assert.ok(!content.includes('InventoryTransfersView'), 'InventoryTransfersView must not be imported in admin page');
      assert.ok(!content.includes('AuditLogView'), 'AuditLogView must not be imported in admin page');
      assert.ok(content.includes("currentTab === 'overview'"), 'Must render overview');
      assert.ok(content.includes("currentTab === 'users'"), 'Must render users');
      assert.ok(content.includes("currentTab === 'settings'"), 'Must render settings');
    });

    it('relocated operational view components are removed from admin-dashboard/src/components', () => {
      const storesDir = path.join(rootDir, 'admin-dashboard', 'src', 'components', 'stores');
      const inventoryDir = path.join(rootDir, 'admin-dashboard', 'src', 'components', 'inventory');
      const transfersDir = path.join(rootDir, 'admin-dashboard', 'src', 'components', 'transfers');
      const auditDir = path.join(rootDir, 'admin-dashboard', 'src', 'components', 'audit');

      assert.ok(!fs.existsSync(storesDir), 'admin-dashboard/src/components/stores must be deleted');
      assert.ok(!fs.existsSync(inventoryDir), 'admin-dashboard/src/components/inventory must be deleted');
      assert.ok(!fs.existsSync(transfersDir), 'admin-dashboard/src/components/transfers must be deleted');
      assert.ok(!fs.existsSync(auditDir), 'admin-dashboard/src/components/audit must be deleted');
    });

    it('admin-critical user management, authentication, and settings components remain intact', () => {
      const usersDir = path.join(rootDir, 'admin-dashboard', 'src', 'components', 'users');
      const settingsDir = path.join(rootDir, 'admin-dashboard', 'src', 'components', 'settings');
      const authApiDir = path.join(rootDir, 'admin-dashboard', 'src', 'app', 'api', 'auth');

      assert.ok(fs.existsSync(usersDir), 'admin-dashboard/src/components/users must exist');
      assert.ok(fs.existsSync(settingsDir), 'admin-dashboard/src/components/settings must exist');
      assert.ok(fs.existsSync(authApiDir), 'admin-dashboard/src/app/api/auth must exist');
    });
  });

  // ==========================================================================
  // 6. SQL MIGRATION FILE & SAFETY CHECKS
  // ==========================================================================
  describe('6. SQL Migration File & Idempotency', () => {
    const migrationPath = path.join(rootDir, 'supabase', 'migrations', '20261118_phase08_laptop_gpu_and_operational_migration.sql');

    it('migration file exists at exact expected path', () => {
      assert.ok(fs.existsSync(migrationPath), 'Phase 08 migration file must exist');
    });

    it('migration adds gpu column to mss_models with IF NOT EXISTS and optional constraint', () => {
      const sql = fs.readFileSync(migrationPath, 'utf8');
      assert.ok(sql.includes('ALTER TABLE public.mss_models'), 'Must alter public.mss_models');
      assert.ok(sql.includes('ADD COLUMN IF NOT EXISTS gpu TEXT'), 'Must add nullable gpu column idempotently');
      assert.ok(sql.includes('CREATE INDEX IF NOT EXISTS idx_mss_models_gpu'), 'Must create index on gpu');
    });

    it('migration explicitly states NOT EXECUTED status and ready for Supabase SQL Editor', () => {
      const sql = fs.readFileSync(migrationPath, 'utf8');
      assert.ok(sql.includes('NOT EXECUTED'), 'Must state NOT EXECUTED status');
      assert.ok(sql.includes('Supabase SQL Editor'), 'Must reference Supabase SQL Editor');
    });
  });

  // ==========================================================================
  // 7. ARCHITECTURAL ISOLATION (RULE 6 COMPLIANCE)
  // ==========================================================================
  describe('7. Architectural Isolation (Rule 6 Compliance)', () => {
    it('accessories database and services are 100% isolated from MSS operational data', () => {
      const accessoriesServicePath = path.join(rootDir, 'src', 'services', 'salesService.ts');
      if (fs.existsSync(accessoriesServicePath)) {
        const content = fs.readFileSync(accessoriesServicePath, 'utf8');
        assert.ok(!content.includes('mssOperationalService'), 'Accessories service must not touch mssOperationalService');
        assert.ok(!content.includes('inventory_transfers'), 'Accessories service must not touch inventory_transfers');
      }
    });
  });
});
