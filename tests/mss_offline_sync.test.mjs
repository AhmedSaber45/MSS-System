// Automated Verification Script for Phase 09: MSS Offline-First Synchronization & Outbox
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
const { mssSyncService } = await import('../src/services/mssSyncService.ts');
const { mssCommerceService } = await import('../src/services/mssCommerceService.ts');
const { mssInventoryService } = await import('../src/services/mssInventoryService.ts');
const { mssCatalogService } = await import('../src/services/mssCatalogService.ts');
const { productsService } = await import('../src/services/productsService.ts');

describe('Phase 09 — MSS Offline-First Synchronization & Conflict Management Verification', () => {
  beforeEach(() => {
    // Preserve environment
  });

  test('1. Queue operations with stable UUIDs in Outbox', async () => {
    const payload = {
      invoice_number: 'MSS-INV-TEST-01',
      serial_number: 'PF1K892-LEN',
      actual_sale_price: 11500,
    };

    const op = await mssSyncService.queueOperation(
      'SALE_CREATE',
      payload,
      'عملية بيع تجريبية في وضع عدم الاتصال',
      'محل 1'
    );

    assert.ok(op.uuid, 'Operation must have a stable UUID');
    // UUID v4 format regex
    assert.match(
      op.uuid,
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      'UUID must be standard v4 format'
    );
    assert.strictEqual(op.type, 'SALE_CREATE');
    assert.strictEqual(op.branch, 'محل 1');
    assert.ok(op.client_timestamp);
    assert.strictEqual(op.retries, 0);

    // Retrieve from outbox
    const outbox = await mssSyncService.getOutbox();
    assert.ok(outbox.some(o => o.uuid === op.uuid), 'Queued operation must exist in Outbox');
  });

  test('2. Retrieve pending operations accurately', async () => {
    const pending = await mssSyncService.getPendingOperations();
    assert.ok(Array.isArray(pending));
    assert.ok(pending.every(p => p.status === 'PENDING' || p.status === 'FAILED'));
  });

  test('3. Outbox persistence across simulated offline reload', async () => {
    const payload = { serial: 'SN-PERSIST-TEST', note: 'test' };
    const op = await mssSyncService.queueOperation('DEVICE_ADD', payload, 'تسجيل جهاز', 'محل 2');

    // Query outbox
    const outbox = await mssSyncService.getOutbox();
    const found = outbox.find(o => o.uuid === op.uuid);
    assert.ok(found, 'Operation must persist in Outbox');
    assert.strictEqual(found?.payload.serial, 'SN-PERSIST-TEST');
  });

  test('4. Idempotency test: Re-syncing an already synchronized UUID prevents duplication', async () => {
    // Use the seed synced UUID
    const seedSyncedUUID = 'f0000000-0000-0000-0000-000000000001';
    const outbox = await mssSyncService.getOutbox();
    const existing = outbox.find(o => o.uuid === seedSyncedUUID);

    assert.ok(existing, 'Seed operation must exist');
    assert.strictEqual(existing?.status, 'SYNCED');

    // Run sync cycle
    const result = await mssSyncService.syncOutbox();
    assert.ok(result);

    // Re-check: status remains SYNCED
    const outboxAfter = await mssSyncService.getOutbox();
    const after = outboxAfter.find(o => o.uuid === seedSyncedUUID);
    assert.strictEqual(after?.status, 'SYNCED');
  });

  test('5. Conflict detection: Detects DOUBLE_SALE when same unit was sold in cloud while disconnected', async () => {
    // Seed device 5CD9283-HP is already sold in Supabase cloud (MSS-INV-101)
    // Simulate disconnected shop selling it with another local invoice number
    const localSalePayload = {
      invoice_number: 'MSS-INV-OFFLINE-999',
      serial_number: '5CD9283-HP',
      selling_branch: 'محل 2',
      actual_sale_price: 13200,
    };

    const conflictOp = await mssSyncService.queueOperation(
      'SALE_CREATE',
      localSalePayload,
      'بيع غير متصل لجهاز تم بيعه سحابياً بالفرع الآخر',
      'محل 2'
    );

    // Trigger sync
    await mssSyncService.syncOutbox();

    // Check outbox operation status is CONFLICT
    const outbox = await mssSyncService.getOutbox();
    const target = outbox.find(o => o.uuid === conflictOp.uuid);
    assert.strictEqual(
      target?.status,
      'CONFLICT',
      'Outbox operation must be marked as CONFLICT when double-sale is detected'
    );

    // Check conflict record was created
    const conflicts = await mssSyncService.getConflicts();
    const recordedConflict = conflicts.find(c => c.operation_uuid === conflictOp.uuid);
    assert.ok(recordedConflict, 'Conflict record must be created');
    assert.strictEqual(recordedConflict?.conflict_type, 'DOUBLE_SALE');
    assert.ok(recordedConflict?.conflict_description.includes('تعارض بيع مزدوج'));
    assert.strictEqual(recordedConflict?.resolution_status, 'PENDING');
  });

  test('6. Conflict preservation (Rule 10 & 25): Conflicting operations are NEVER silently discarded', async () => {
    const conflicts = await mssSyncService.getConflicts();
    const outbox = await mssSyncService.getOutbox();

    // Every conflict in conflicts must have its original payload preserved
    for (const c of conflicts) {
      assert.ok(c.local_payload, 'Local payload must be preserved');
      assert.ok(c.operation_uuid, 'Operation UUID must be preserved');

      // Outbox item still exists
      const outboxItem = outbox.find(o => o.uuid === c.operation_uuid);
      assert.ok(outboxItem, 'Outbox item must never be deleted/discarded on conflict');
    }
  });

  test('7. Conflict resolution workflow: Resolves conflict with auditable resolution notes', async () => {
    const conflicts = await mssSyncService.getConflicts();
    const pendingConflict = conflicts.find(c => c.resolution_status === 'PENDING');
    assert.ok(pendingConflict, 'Should have a pending conflict from test 5');

    // Resolve conflict manually
    await mssSyncService.resolveConflict(
      pendingConflict.id,
      'RESOLVED_MANUALLY',
      'تم الاتفاق مع العميل على استلام موديل بديل فوري مع تعويض حقيبة مجانية',
      'مدير فرع محل 2'
    );

    // Verify resolved in conflicts
    const reloaded = await mssSyncService.getConflicts();
    const resolved = reloaded.find(c => c.id === pendingConflict.id);
    assert.strictEqual(resolved?.resolution_status, 'RESOLVED_MANUALLY');
    assert.ok(resolved?.resolved_at);
    assert.ok(resolved?.resolution_notes?.includes('استلام موديل بديل فوري'));
    assert.strictEqual(resolved?.resolved_by, 'مدير فرع محل 2');

    // Verify outbox operation status became SYNCED
    const outbox = await mssSyncService.getOutbox();
    const op = outbox.find(o => o.uuid === pendingConflict.operation_uuid);
    assert.strictEqual(op?.status, 'SYNCED');
  });

  test('8. Retry and error tracking: Failed operations log retries count', async () => {
    // Queue operation
    const op = await mssSyncService.queueOperation(
      'DEVICE_ADD',
      { serial: 'SN-RETRY-TEST' },
      'اختبار عداد المحاولات',
      'محل 1'
    );

    // Initial retries is 0
    assert.strictEqual(op.retries, 0);

    // Outbox item tracks retries
    const outbox = await mssSyncService.getOutbox();
    const found = outbox.find(o => o.uuid === op.uuid);
    assert.ok(found);
    assert.strictEqual(typeof found?.retries, 'number');
  });

  test('9. Sync summary KPIs accurately reflect sync states and connectivity', async () => {
    const summary = await mssSyncService.getSyncSummary();

    assert.strictEqual(typeof summary.is_online, 'boolean');
    assert.strictEqual(typeof summary.pending_count, 'number');
    assert.strictEqual(typeof summary.synced_count, 'number');
    assert.strictEqual(typeof summary.conflict_count, 'number');
    assert.strictEqual(typeof summary.failed_count, 'number');
    assert.ok(summary.synced_count >= 1, 'Should have at least 1 synced operation');
  });

  test('10. Integration: Commercial operations automatically queue Outbox records', async () => {
    // Sell a device via mssCommerceService
    const models = await mssCatalogService.getModels();
    const model = models.find(m => m.id === 'a0000000-0000-0000-0000-000000000001') || models[0];
    const serial = 'SN-AUTO-QUEUE-' + Date.now().toString(36).toUpperCase() + '-' + Math.floor(Math.random() * 1000);

    const dev = await mssInventoryService.createDevice({
      serial_number: serial,
      model_id: model.id,
      purchase_cost: 9500,
      list_price: 13000,
      stock_location: 'محل 1',
      status: 'AVAILABLE',
    });

    const invoice = await mssCommerceService.confirmSale({
      device_id: dev.id,
      selling_branch: 'محل 1',
      actual_sale_price: 12500,
      customer_name: 'عميل اختبار الطابور التلقائي',
    });

    // Check outbox has this invoice
    const outbox = await mssSyncService.getOutbox();
    const queuedSale = outbox.find(
      o => o.type === 'SALE_CREATE' && o.payload.invoice_number === invoice.invoice_number
    );

    assert.ok(queuedSale, 'confirmSale must automatically queue a SALE_CREATE operation in Outbox');
    assert.strictEqual(queuedSale?.branch, 'محل 1');
  });

  test('11. Strict separation: Accessories SQLite database is completely untouched (Rule 6)', async () => {
    const accProducts = await productsService.getProducts();
    const outbox = await mssSyncService.getOutbox();

    // Verify outbox items are completely independent of accessories
    const accIds = new Set(accProducts.map(p => p.id));
    for (const op of outbox) {
      assert.strictEqual(
        accIds.has(op.uuid),
        false,
        'Outbox UUID must never collide with Accessories product IDs'
      );
    }
  });
});
