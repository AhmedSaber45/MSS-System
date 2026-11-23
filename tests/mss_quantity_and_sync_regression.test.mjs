import test from 'node:test';
import assert from 'node:assert/strict';

// Setup Mock LocalStorage for Node.js test environment
class MockLocalStorage {
  constructor() {
    this.store = new Map();
  }
  getItem(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }
  setItem(key, value) {
    this.store.set(key, String(value));
  }
  removeItem(key) {
    this.store.delete(key);
  }
  clear() {
    this.store.clear();
  }
}

globalThis.localStorage = new MockLocalStorage();
if (typeof globalThis.window === 'undefined') {
  globalThis.window = { localStorage: globalThis.localStorage };
}
if (typeof globalThis.navigator === 'undefined') {
  globalThis.navigator = { onLine: true };
}

// Import services
const { mssCatalogService } = await import('../src/services/mssCatalogService.ts');
const { mssInventoryService } = await import('../src/services/mssInventoryService.ts');
const { mssCommerceService } = await import('../src/services/mssCommerceService.ts');
const { mssSyncService } = await import('../src/services/mssSyncService.ts');
const { desktopAuthService } = await import('../src/services/desktopAuthService.ts');

test('Compu MSS Quantity Persistence and Cloud Synchronization Regression Suite', async (t) => {
  // Clear state before testing
  globalThis.localStorage.clear();

  // Create a base model in catalog
  const testModel = await mssCatalogService.createModel({
    brand: 'HP',
    model_name: `Z Book Fury G8 Regression ${Date.now()}`,
    category: 'لابتوب',
    processor: 'Core i7 11th Gen',
    ram: '32 GB',
    storage: '512 GB SSD',
    default_list_price: 35000,
  });

  const validLocation = 'محمود مسعود';

  await t.test('1. Assembled / Bulk Model Creation with Quantities (1, 2, and 20)', async () => {
    // 1.1 Create bulk stock with quantity = 1
    const stock1 = await mssInventoryService.createBulkStock({
      model_id: testModel.id,
      quantity: 1,
      purchase_cost: 25000,
      list_price: 35000,
      stock_location: validLocation,
      physical_condition: 'فرز أول ممتاز',
    });
    assert.strictEqual(stock1.quantity, 1, 'Quantity must be exactly 1');
    assert.strictEqual(stock1.is_serialized, false, 'Assembled/bulk stock must not be serialized');
    assert.strictEqual(stock1.serial_number, null, 'Serial number must be null for non-serialized stock');

    // 1.2 Create bulk stock with quantity = 2
    const stock2 = await mssInventoryService.createBulkStock({
      model_id: testModel.id,
      quantity: 2,
      purchase_cost: 25000,
      list_price: 35000,
      stock_location: validLocation,
      physical_condition: 'فرز أول ممتاز',
    });
    assert.strictEqual(stock2.quantity, 2, 'Quantity must be exactly 2');
    assert.strictEqual(stock2.is_serialized, false, 'Assembled/bulk stock must not be serialized');

    // 1.3 Create bulk stock with quantity = 20 (Issue 1 core test)
    const stock20 = await mssInventoryService.createBulkStock({
      model_id: testModel.id,
      quantity: 20,
      purchase_cost: 25000,
      list_price: 35000,
      stock_location: validLocation,
      physical_condition: 'فرز أول ممتاز',
    });
    assert.strictEqual(stock20.quantity, 20, 'Quantity must be exactly 20 (not 1)');
    assert.strictEqual(stock20.is_serialized, false, 'Assembled/bulk stock must not be serialized');

    // 1.4 Verify aggregated inventory metrics reflect full quantity (1 + 2 + 20 = 23)
    const metrics = await mssInventoryService.getInventorySummary();
    assert.ok(
      metrics.available_non_serialized_total >= 23,
      'Available non-serialized stock metric must include sum of all bulk quantities'
    );

    // 1.5 Verify grouped devices display 23 units for this model
    const groups = await mssInventoryService.getModelInventorySummary();
    const targetGroup = groups.find(g => g.model_id === testModel.id);
    assert.ok(targetGroup, 'Target model group must be found');
    assert.strictEqual(
      targetGroup.total_available,
      23,
      'Grouped model available units must equal 23 units'
    );
    assert.strictEqual(
      targetGroup.available_non_serialized,
      23,
      'Grouped model non-serialized count must equal 23 units'
    );
  });

  await t.test('2. Insufficient Stock Validation and Atomicity Rollback', async () => {
    // 2.1 Attempt to create bulk stock with 0 or negative quantity
    await assert.rejects(
      async () => {
        await mssInventoryService.createBulkStock({
          model_id: testModel.id,
          quantity: 0,
          purchase_cost: 25000,
          list_price: 35000,
          stock_location: validLocation,
        });
      },
      /كمية المخزون غير المسلسل يجب أن تكون عدداً صحيحاً أكبر من صفر/,
      'Zero quantity must be rejected'
    );

    await assert.rejects(
      async () => {
        await mssInventoryService.createBulkStock({
          model_id: testModel.id,
          quantity: -5,
          purchase_cost: 25000,
          list_price: 35000,
          stock_location: validLocation,
        });
      },
      /كمية المخزون غير المسلسل يجب أن تكون عدداً صحيحاً أكبر من صفر/,
      'Negative quantity must be rejected'
    );

    // 2.2 Attempt to sell more units than available in a bulk stock batch
    const devices = await mssInventoryService.getDevices();
    const stock20 = devices.find(d => d.quantity === 20 && !d.is_serialized);
    assert.ok(stock20, 'Stock batch of 20 units must exist');

    await assert.rejects(
      async () => {
        await mssCommerceService.confirmSale({
          selling_branch: validLocation,
          source_branch: validLocation,
          customer_name: 'عميل اختبار تجربة',
          payment_type: 'FULL',
          items: [
            {
              device_id: stock20.id,
              model_id: testModel.id,
              quantity: 25, // Exceeds available 20 units!
              actual_sale_price: 35000 * 25,
            },
          ],
        });
      },
      /أكبر من المخزون المتاح/,
      'Sale must be rejected when requested quantity exceeds available stock'
    );

    // Verify stock remains untouched at 20 units (rollback / no partial deduction)
    const devicesAfter = await mssInventoryService.getDevices();
    const stockAfter = devicesAfter.find(d => d.id === stock20.id);
    assert.strictEqual(
      stockAfter.quantity,
      20,
      'Stock quantity must remain strictly unchanged at 20 units after rejected sale'
    );

    // 2.3 Attempt to convert more serials than available stock
    await assert.rejects(
      async () => {
        await mssInventoryService.assignSerialsToBulkStock({
          stock_id: stock20.id,
          serial_numbers: Array.from({ length: 25 }, (_, i) => `SN-EXCEED-${Date.now()}-${i}`),
        });
      },
      /يتجاوز الكمية المتاحة في هذه الدفعة/,
      'Conversion must be blocked when serial count exceeds batch quantity'
    );

    const devicesAfterConvert = await mssInventoryService.getDevices();
    const stockAfterConvert = devicesAfterConvert.find(d => d.id === stock20.id);
    assert.strictEqual(
      stockAfterConvert.quantity,
      20,
      'Stock quantity must remain unchanged after rejected conversion'
    );
  });

  await t.test('3. Pending Sale Operation Synchronization & Valid Schema Mapping', async () => {
    // Create a serialized device for the sale test
    const serializedDevice = await mssInventoryService.createDevice({
      model_id: testModel.id,
      serial_number: `REG-SN-${Date.now()}`,
      purchase_cost: 25000,
      list_price: 35000,
      stock_location: validLocation,
    });

    // Make an offline-ready sale
    const invoice = await mssCommerceService.confirmSale({
      selling_branch: validLocation,
      source_branch: validLocation,
      customer_name: 'عميل مزامنة تجريبي',
      customer_phone: '01012345678',
      warranty_period: 'ضمان سنة كاملة',
      payment_type: 'FULL',
      items: [
        {
          device_id: serializedDevice.id,
          model_id: testModel.id,
          serial_number: serializedDevice.serial_number,
          quantity: 1,
          actual_sale_price: 35000,
        },
      ],
    });

    assert.ok(invoice.id, 'Invoice must be created');
    assert.ok(invoice.invoice_number, 'Invoice number must be generated');

    // Verify the operation was queued in the outbox
    const outbox = await mssSyncService.getOutbox();
    const saleOp = outbox.find(op => op.type === 'SALE_CREATE' && op.payload?.invoice_number === invoice.invoice_number);
    assert.ok(saleOp, 'SALE_CREATE operation must exist in outbox');

    // Run manual sync
    const syncResult = await mssSyncService.syncOutbox();
    assert.ok(syncResult.synced >= 1, 'At least 1 operation must be synchronized');
    assert.strictEqual(syncResult.conflicts, 0, 'Zero conflicts expected');

    // Verify the operation in outbox transitioned to SYNCED with null last_error
    const outboxAfter = await mssSyncService.getOutbox();
    const syncedOp = outboxAfter.find(op => op.uuid === saleOp.uuid);
    assert.strictEqual(syncedOp.status, 'SYNCED', 'Operation status must transition to SYNCED');
    assert.strictEqual(syncedOp.last_error, null, 'Last error must be cleared to null upon successful sync');
  });

  await t.test('4. Idempotent Synchronization (No Duplicate Sales or Deductions)', async () => {
    // 4.1 Running syncOutbox again should detect 0 pending operations
    const secondSyncResult = await mssSyncService.syncOutbox();
    assert.strictEqual(
      secondSyncResult.status,
      'NO_PENDING',
      'Subsequent sync with clean outbox must report NO_PENDING'
    );
    assert.strictEqual(secondSyncResult.synced, 0, 'Zero operations re-synced');

    // 4.2 Replaying an already-synced operation must be completely idempotent
    const outbox = await mssSyncService.getOutbox();
    const lastOp = outbox[0];
    assert.ok(lastOp, 'Outbox operation exists');

    // Artificially reset its status to PENDING to simulate replay
    lastOp.status = 'PENDING';
    localStorage.setItem('shop_mss_outbox_queue_v1', JSON.stringify(outbox));

    const replayResult = await mssSyncService.syncOutbox();
    assert.ok(replayResult.synced >= 1, 'Replay handled gracefully');

    // Status is restored to SYNCED without duplicate records or errors
    const outboxPostReplay = await mssSyncService.getOutbox();
    const replayedOp = outboxPostReplay.find(op => op.uuid === lastOp.uuid);
    assert.strictEqual(replayedOp.status, 'SYNCED', 'Replayed operation remains SYNCED');
    assert.strictEqual(replayedOp.last_error, null, 'No error on idempotent replay');
  });

  await t.test('5. Network/Server Failure Preserves Pending State Without Data Loss', async () => {
    const originalCheck = mssSyncService.checkConnectivity;
    try {
      // Create a pending item directly in outbox without background trigger
      const outbox = await mssSyncService.getOutbox();
      const testUuid = `test-preserve-${Date.now()}`;
      outbox.unshift({
        uuid: testUuid,
        type: 'DEVICE_ADD',
        branch: validLocation,
        payload: {
          id: testUuid,
          model_id: testModel.id,
          quantity: 5,
          is_serialized: false,
          purchase_cost: 1000,
          list_price: 2000,
          stock_location: validLocation,
        },
        description: 'اختبار عملية بدون اتصال',
        client_timestamp: new Date().toISOString(),
        status: 'PENDING',
        retries: 0,
        last_error: null,
      });
      localStorage.setItem('shop_mss_outbox_queue_v1', JSON.stringify(outbox));

      // Mock offline
      mssSyncService.checkConnectivity = async () => false;

      const offlineResult = await mssSyncService.syncOutbox();
      assert.strictEqual(offlineResult.status, 'OFFLINE', 'Status must be OFFLINE when disconnected');
      assert.strictEqual(offlineResult.synced, 0, 'No operations should be synced when offline');

      // Verify operation is preserved in PENDING state
      const outboxAfter = await mssSyncService.getOutbox();
      const preservedOp = outboxAfter.find(op => op.uuid === testUuid);
      assert.ok(preservedOp, 'Operation must NOT be deleted or discarded');
      assert.strictEqual(preservedOp.status, 'PENDING', 'Operation must remain in PENDING status');
    } finally {
      mssSyncService.checkConnectivity = originalCheck;
    }
  });

  await t.test('6. Manual Sync Reporting Distinguishes All Operational Outcomes', async () => {
    // 6.1 Clean state -> NO_PENDING
    const cleanOutbox = (await mssSyncService.getOutbox()).filter(op => op.status === 'SYNCED');
    localStorage.setItem('shop_mss_outbox_queue_v1', JSON.stringify(cleanOutbox));

    const noPendingRes = await mssSyncService.syncOutbox();
    assert.strictEqual(noPendingRes.status, 'NO_PENDING', 'Reports NO_PENDING when no items need sync');
    assert.ok(noPendingRes.message.includes('لا توجد عمليات معلقة'), 'Message explains no pending work');

    // 6.2 Auth Guard -> AUTH_BLOCKED
    const originalLoadSession = desktopAuthService.loadSecureSession;
    try {
      desktopAuthService.loadSecureSession = async () => ({
        user: {
          id: 'user-accessories-only',
          allowedModules: 'accessories', // NOT authorized for MSS!
        },
      });

      const authBlockedRes = await mssSyncService.syncOutbox();
      assert.strictEqual(authBlockedRes.status, 'AUTH_BLOCKED', 'Reports AUTH_BLOCKED when user lacks MSS module');
      assert.ok(authBlockedRes.message.includes('صلاحية الوصول'), 'Message explains permission boundary');
    } finally {
      desktopAuthService.loadSecureSession = originalLoadSession;
    }
  });
});
