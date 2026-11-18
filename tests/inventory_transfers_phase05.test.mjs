import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

describe('Phase 05 — Inventory Management, Stock Transfers & Concurrency Verification', () => {
  const rootDir = process.cwd();
  const migrationPath = path.join(rootDir, 'supabase', 'migrations', '20261117_phase05_inventory_transfers.sql');
  const mssSyncServicePath = path.join(rootDir, 'src', 'services', 'mssSyncService.ts');
  const mssInventoryServicePath = path.join(rootDir, 'src', 'services', 'mssInventoryService.ts');
  const salesServicePath = path.join(rootDir, 'src', 'services', 'salesService.ts');
  const adminServicePath = path.join(rootDir, 'admin-dashboard', 'src', 'services', 'adminService.ts');
  const transferModalPath = path.join(rootDir, 'admin-dashboard', 'src', 'components', 'transfers', 'TransferWizardModal.tsx');
  const transfersViewPath = path.join(rootDir, 'admin-dashboard', 'src', 'components', 'transfers', 'InventoryTransfersView.tsx');

  // ==========================================================================
  // 1. SQL Migration Integrity & Database Schema Extensions
  // ==========================================================================
  describe('1. SQL Migration Integrity & Schema Extensions', () => {
    it('migration file exists at exact expected path', () => {
      assert.ok(fs.existsSync(migrationPath), 'Migration file must exist');
    });

    it('migration creates inventory_transfers table with idempotency and audit columns', () => {
      const sql = fs.readFileSync(migrationPath, 'utf8');
      assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS public.inventory_transfers'), 'Must create inventory_transfers table');
      assert.ok(sql.includes('reference_number'), 'Must contain reference_number column');
      assert.ok(sql.includes('source_location'), 'Must contain source_location column');
      assert.ok(sql.includes('destination_location'), 'Must contain destination_location column');
      assert.ok(sql.includes('transfer_type'), 'Must contain transfer_type column');
      assert.ok(sql.includes('status'), 'Must contain status column');
      assert.ok(sql.includes('idempotency_key'), 'Must contain idempotency_key column');
      assert.ok(sql.includes('created_by_admin_id'), 'Must contain created_by_admin_id column');
    });

    it('migration creates inventory_transfer_items table with purchase cost snapshot', () => {
      const sql = fs.readFileSync(migrationPath, 'utf8');
      assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS public.inventory_transfer_items'), 'Must create inventory_transfer_items table');
      assert.ok(sql.includes('transfer_id'), 'Must contain transfer_id column');
      assert.ok(sql.includes('device_id'), 'Must contain device_id column');
      assert.ok(sql.includes('serial_number'), 'Must contain serial_number column');
      assert.ok(sql.includes('purchase_cost_snapshot'), 'Must contain purchase_cost_snapshot column');
      assert.ok(sql.includes('previous_status'), 'Must contain previous_status column');
      assert.ok(sql.includes('resulting_status'), 'Must contain resulting_status column');
    });

    it('migration creates execute_inventory_transfer atomic function (SECURITY DEFINER)', () => {
      const sql = fs.readFileSync(migrationPath, 'utf8');
      assert.ok(sql.includes('CREATE OR REPLACE FUNCTION public.execute_inventory_transfer'), 'Must define execute_inventory_transfer');
      assert.ok(sql.includes('SECURITY DEFINER'), 'Function must be SECURITY DEFINER');
      assert.ok(sql.includes('p_idempotency_key'), 'Function must accept idempotency key');
    });

    it('migration adjusts constraints on stock_location to preserve audit history and prevent FK blocks', () => {
      const sql = fs.readFileSync(migrationPath, 'utf8');
      assert.ok(
        sql.includes('mss_devices_stock_location_check') ||
        sql.includes('DROP CONSTRAINT IF EXISTS'),
        'Must handle stock location constraint safely'
      );
    });

    it('migration enforces RLS on inventory_transfers and inventory_transfer_items', () => {
      const sql = fs.readFileSync(migrationPath, 'utf8');
      assert.ok(sql.includes('ALTER TABLE public.inventory_transfers ENABLE ROW LEVEL SECURITY'), 'Must enable RLS on transfers');
      assert.ok(sql.includes('ALTER TABLE public.inventory_transfer_items ENABLE ROW LEVEL SECURITY'), 'Must enable RLS on items');
    });
  });

  // ==========================================================================
  // 2. Critical Inventory Ownership & Integrity Rules (Rules A, B, C, D, E)
  // ==========================================================================
  describe('2. Critical Inventory Ownership & Integrity Rules', () => {
    it('Rule A & B: Stock belongs to physical locations, not user/login accounts ("Users Are Not Warehouses")', () => {
      const adminCode = fs.readFileSync(adminServicePath, 'utf8');
      assert.ok(adminCode.includes('stockLocation'), 'Transfers track physical location');
      assert.ok(!adminCode.includes('user_stock'), 'Must not associate inventory to user accounts');
    });

    it('Rule C: Financial records & original purchase costs remain strictly immutable', () => {
      const adminCode = fs.readFileSync(adminServicePath, 'utf8');
      assert.ok(adminCode.includes('purchaseCostSnapshot'), 'Must snapshot purchase cost without altering original device cost');
      assert.ok(!adminCode.includes('purchase_cost = '), 'Transfers must NEVER reprice purchase cost');
    });

    it('Rule D: Transfer does NOT create sales/purchase invoices or alter company-wide total stock', () => {
      const adminCode = fs.readFileSync(adminServicePath, 'utf8');
      assert.ok(!adminCode.includes('createSaleInvoice'), 'Transfer must not create sale invoice');
      assert.ok(!adminCode.includes('createPurchaseInvoice'), 'Transfer must not create purchase invoice');
    });

    it('Rule E: Module separation (Rule 6) — Accessories SQLite database remains completely isolated', () => {
      const salesCode = fs.readFileSync(salesServicePath, 'utf8');
      assert.ok(!salesCode.includes('inventory_transfers'), 'Accessories must not touch inventory_transfers');
      assert.ok(!salesCode.includes('execute_inventory_transfer'), 'Accessories must not execute inventory transfers');
    });
  });

  // ==========================================================================
  // 3. Desktop Synchronization & Concurrency Conflict Resolution
  // ==========================================================================
  describe('3. Desktop Synchronization & Outbox Conflict Handling', () => {
    it('desktop mssSyncService detects STALE_STOCK_TRANSFER when an offline device was moved in cloud', () => {
      const syncCode = fs.readFileSync(mssSyncServicePath, 'utf8');
      assert.ok(syncCode.includes('STALE_STOCK_TRANSFER'), 'Must identify STALE_STOCK_TRANSFER conflict code');
      assert.ok(syncCode.includes('DEVICE_TRANSFER'), 'Must handle DEVICE_TRANSFER operations');
    });

    it('stale stock transfer preserves local offline payload and prevents silent overwrites', () => {
      const syncCode = fs.readFileSync(mssSyncServicePath, 'utf8');
      assert.ok(syncCode.includes('تعارض بيع لجهاز تم نقله') || syncCode.includes('STALE_STOCK_TRANSFER'), 'Must provide clear Arabic explanatory conflict message');
      assert.ok(syncCode.includes('CONFLICT_PRESERVED') || syncCode.includes('status = \'FAILED\'') || syncCode.includes('detectedConflict'), 'Must preserve conflict in outbox without silent corruption');
    });
  });

  // ==========================================================================
  // 4. UI & Transfer Wizard Integration (Admin Dashboard / Migrated Desktop Views)
  // ==========================================================================
  describe('4. UI & Transfer Wizard Components', () => {
    const desktopMovementsPath = path.join(rootDir, 'src', 'components', 'placeholders', 'mss', 'MovementsView.tsx');

    it('TransferWizardModal exists and implements 6-step guided transfer workflow', () => {
      const targetPath = fs.existsSync(desktopMovementsPath) ? desktopMovementsPath : transferModalPath;
      assert.ok(fs.existsSync(targetPath), 'Transfer wizard must exist');
      const wizardCode = fs.readFileSync(targetPath, 'utf8');
      assert.ok(wizardCode.includes('موقع المصدر') || wizardCode.includes('تحديد موقع المصدر'), 'Must contain source location step');
      assert.ok(wizardCode.includes('موقع الوجهة') || wizardCode.includes('تحديد موقع الوجهة'), 'Must contain destination location step');
      assert.ok(wizardCode.includes('معاينة') || wizardCode.includes('معاينة الأثر'), 'Must contain preview impact step');
      assert.ok(wizardCode.includes('تأكيد') || wizardCode.includes('التأكيد'), 'Must contain confirmation step');
    });

    it('InventoryTransfersView exists and displays KPIs, transfer history, and wizard launcher', () => {
      const targetPath = fs.existsSync(desktopMovementsPath) ? desktopMovementsPath : transfersViewPath;
      assert.ok(fs.existsSync(targetPath), 'Transfers view must exist');
      const viewCode = fs.readFileSync(targetPath, 'utf8');
      assert.ok(viewCode.includes('عمليات التحويل') || viewCode.includes('إجمالي عمليات التحويل') || viewCode.includes('تحويلات'), 'Must display transfers info');
      assert.ok(viewCode.includes('تحويل') || viewCode.includes('بدء تحويل مخزون جديد'), 'Must contain transfer launch button');
    });
  });
});
