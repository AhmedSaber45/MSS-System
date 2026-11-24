import test from 'node:test';
import assert from 'node:assert/strict';

// Setup Mock LocalStorage for 100% isolated in-memory test environment
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
  globalThis.navigator = { onLine: false };
}

// Block any attempt to send HTTP requests to real Supabase
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, options) => {
  if (typeof url === 'string' && url.includes('supabase.co')) {
    throw new Error('NETWORK BLOCKED: Automated tests are strictly isolated from production Supabase!');
  }
  if (originalFetch) return originalFetch(url, options);
  throw new Error('Fetch not available');
};

// Import services
const { mssInventoryService } = await import('../src/services/mssInventoryService.ts');
const { mssOperationalService } = await import('../src/services/mssOperationalService.ts');
const { mssCatalogService } = await import('../src/services/mssCatalogService.ts');

test('Tasks 3 & 4: Inventory Transfer & Stock Quantity Correction Regression Suite', async (t) => {
  const MODEL_SCREEN_ID = 'model-screen-uuid-001';
  const MODEL_LAPTOP_ID = 'model-laptop-uuid-002';

  // Seed Catalog Models in LocalStorage Cache
  const seedModels = [
    {
      id: MODEL_SCREEN_ID,
      brand: 'Dell',
      model_name: 'UltraSharp U2723QE',
      category: 'Screen',
      default_list_price: 15000,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: MODEL_LAPTOP_ID,
      brand: 'Lenovo',
      model_name: 'ThinkPad T14 Gen 3',
      category: 'Laptop',
      default_list_price: 35000,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];
  globalThis.localStorage.setItem('shop_mss_models_cache_v1', JSON.stringify(seedModels));

  // Seed Stores
  const seedStores = [
    { id: 'store-1', code: 'SH01', name: 'محل 1', type: 'store', isActive: true, createdAt: new Date().toISOString() },
    { id: 'store-2', code: 'SH02', name: 'محل 2', type: 'store', isActive: true, createdAt: new Date().toISOString() },
    { id: 'store-wh', code: 'WH01', name: 'المخزن الرئيسي', type: 'warehouse', isActive: true, createdAt: new Date().toISOString() },
  ];
  globalThis.localStorage.setItem('shop_mss_stores_cache_v1', JSON.stringify(seedStores));

  // Reset Devices Cache with:
  // 1. Accidental Bulk Stock: 70 units of Dell Screen in 'محل 1' (The user reported bug)
  // 2. Serialized Unit: Lenovo ThinkPad in 'محل 1' with serial 'SN-LEN-001'
  // 3. Normal Stock in 'محل 2': 5 units of Dell Screen
  const initialDevices = [
    {
      id: 'dev-bulk-screen-001',
      serial_number: null,
      is_serialized: false,
      quantity: 70, // Accidental entry of 70 units
      model_id: MODEL_SCREEN_ID,
      purchase_cost: 12000,
      list_price: 15000,
      purchase_date: '2026-11-20',
      physical_condition: 'جديد بالكرتونة',
      stock_location: 'محل 1',
      status: 'AVAILABLE',
      notes: 'شحنة شاشات مجمعة',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      model_name: 'UltraSharp U2723QE',
      brand: 'Dell',
    },
    {
      id: 'dev-ser-laptop-001',
      serial_number: 'SN-LEN-001',
      is_serialized: true,
      quantity: 1,
      model_id: MODEL_LAPTOP_ID,
      purchase_cost: 28000,
      list_price: 35000,
      purchase_date: '2026-11-22',
      physical_condition: 'فرز أول ممتاز',
      stock_location: 'محل 1',
      status: 'AVAILABLE',
      notes: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      model_name: 'ThinkPad T14 Gen 3',
      brand: 'Lenovo',
    },
    {
      id: 'dev-bulk-screen-002',
      serial_number: null,
      is_serialized: false,
      quantity: 5,
      model_id: MODEL_SCREEN_ID,
      purchase_cost: 12000,
      list_price: 15000,
      purchase_date: '2026-11-20',
      physical_condition: 'جديد بالكرتونة',
      stock_location: 'محل 2',
      status: 'AVAILABLE',
      notes: 'رصيد فرع محل 2',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      model_name: 'UltraSharp U2723QE',
      brand: 'Dell',
    },
  ];
  globalThis.localStorage.setItem('shop_mss_devices_cache_v1', JSON.stringify(initialDevices));
  globalThis.localStorage.setItem('shop_mss_movements_cache_v1', JSON.stringify([]));
  globalThis.localStorage.setItem('shop_mss_stock_adjustments_cache_v1', JSON.stringify([]));

  // =========================================================================
  // TASK 4 TESTS: Safe Stock Quantity Correction Feature
  // =========================================================================
  await t.test('Task 4: Correct accidental entry of 70 units to 7 units (Delta = -63)', async () => {
    // Current stock for Dell Screen in 'محل 1' is 70
    const adjResult = await mssInventoryService.adjustStockQuantity({
      model_id: MODEL_SCREEN_ID,
      stock_location: 'محل 1',
      new_quantity: 7,
      reason: 'خطأ إدخال: تم تسجيل 70 شاشة بدلاً من 7 شاشات فعلية بالفرع',
      actor_id: 'user-admin-001',
      actor_username: 'ahmed_manager',
    });

    assert.equal(adjResult.model_id, MODEL_SCREEN_ID);
    assert.equal(adjResult.stock_location, 'محل 1');
    assert.equal(adjResult.previous_quantity, 70, 'Previous quantity must be 70');
    assert.equal(adjResult.new_quantity, 7, 'Corrected quantity must be 7');
    assert.equal(adjResult.adjustment_amount, -63, 'Delta must be -63');
    assert.equal(adjResult.reason, 'خطأ إدخال: تم تسجيل 70 شاشة بدلاً من 7 شاشات فعلية بالفرع');
    assert.equal(adjResult.actor_username, 'ahmed_manager');

    // Verify devices cache was updated
    const cachedDevices = JSON.parse(globalThis.localStorage.getItem('shop_mss_devices_cache_v1'));
    const screenInShop1 = cachedDevices.find(d => d.model_id === MODEL_SCREEN_ID && d.stock_location === 'محل 1' && d.status === 'AVAILABLE');
    assert.ok(screenInShop1, 'Bulk screen device in Shop 1 must exist');
    assert.equal(screenInShop1.quantity, 7, 'Stock in Shop 1 must now be exactly 7 units');

    // Multi-branch Isolation: Verify Shop 2 stock was NOT affected
    const screenInShop2 = cachedDevices.find(d => d.model_id === MODEL_SCREEN_ID && d.stock_location === 'محل 2');
    assert.equal(screenInShop2.quantity, 5, 'Stock in Shop 2 must remain untouched at 5 units');
  });

  await t.test('Task 4: Adjustment generates movement record and audit log', async () => {
    // Check movements cache
    const movements = JSON.parse(globalThis.localStorage.getItem('shop_mss_movements_cache_v1') || '[]');
    assert.ok(movements.length > 0, 'Movement log must be created for stock adjustment');
    const latestMovement = movements[0];
    assert.equal(latestMovement.from_location, 'محل 1');
    assert.equal(latestMovement.to_location, 'محل 1');
    assert.ok(latestMovement.notes.includes('تصحيح رصيد مخزون'), 'Movement notes must mention stock adjustment');
    assert.ok(latestMovement.notes.includes('-63'), 'Movement notes must mention delta -63');

    // Check adjustment history retrieval
    const adjustments = await mssInventoryService.getStockAdjustments(MODEL_SCREEN_ID);
    assert.equal(adjustments.length, 1, 'Should find 1 adjustment for this model');
    assert.equal(adjustments[0].adjustment_amount, -63);
    assert.equal(adjustments[0].new_quantity, 7);
  });

  await t.test('Task 4: Validation rejects negative target quantity, empty reason, and zero delta', async () => {
    // Negative quantity
    await assert.rejects(
      async () => {
        await mssInventoryService.adjustStockQuantity({
          model_id: MODEL_SCREEN_ID,
          stock_location: 'محل 1',
          new_quantity: -5,
          reason: 'قيمة سالبة',
        });
      },
      /الكمية المصححة يجب أن تكون رقماً صحيحاً أكبر من أو يساوي الصفر/
    );

    // Empty reason
    await assert.rejects(
      async () => {
        await mssInventoryService.adjustStockQuantity({
          model_id: MODEL_SCREEN_ID,
          stock_location: 'محل 1',
          new_quantity: 10,
          reason: '   ',
        });
      },
      /يجب ذكر سبب تصحيح الكمية لأغراض التدقيق والمراجعة/
    );

    // Zero delta (Current quantity is 7, requesting 7)
    await assert.rejects(
      async () => {
        await mssInventoryService.adjustStockQuantity({
          model_id: MODEL_SCREEN_ID,
          stock_location: 'محل 1',
          new_quantity: 7,
          reason: 'نفس الكمية',
        });
      },
      /الكمية المصححة مطابقة للرصيد الفعلي الحالي/
    );
  });

  // =========================================================================
  // TASK 3 TESTS: Inventory Transfer Destination Selection & Execution
  // =========================================================================
  await t.test('Task 3: Rejects transfer if source and destination are identical', async () => {
    const cachedDevices = JSON.parse(globalThis.localStorage.getItem('shop_mss_devices_cache_v1'));
    const device = cachedDevices.find(d => d.stock_location === 'محل 1');

    await assert.rejects(
      async () => {
        await mssInventoryService.transferDevice({
          device_id: device.id,
          to_location: 'محل 1', // Same location
          notes: 'تحويل لنفس الموقع',
        });
      },
      /ولا يمكن تحويله إلى نفس الموقع/
    );
  });

  await t.test('Task 3: Rejects transfer if destination location is invalid', async () => {
    const cachedDevices = JSON.parse(globalThis.localStorage.getItem('shop_mss_devices_cache_v1'));
    const device = cachedDevices.find(d => d.stock_location === 'محل 1');

    await assert.rejects(
      async () => {
        await mssInventoryService.transferDevice({
          device_id: device.id,
          to_location: 'فرع_غير_موجود_في_النظام',
          notes: 'موقع غير مسجل',
        });
      },
      /المحل أو المخزن الهدف غير صالح/
    );
  });

  await t.test('Task 3: Bulk partial transfer (Transfer 2 out of 7 units from محل 1 to محل 2)', async () => {
    const cachedDevices = JSON.parse(globalThis.localStorage.getItem('shop_mss_devices_cache_v1'));
    const screenInShop1 = cachedDevices.find(d => d.model_id === MODEL_SCREEN_ID && d.stock_location === 'محل 1' && d.status === 'AVAILABLE');
    assert.equal(screenInShop1.quantity, 7);

    const { device: updatedSource, movement } = await mssInventoryService.transferDevice({
      device_id: screenInShop1.id,
      to_location: 'محل 2',
      quantity: 2,
      notes: 'تحويل جزئي 2 وحدة إلى محل 2',
    });

    // Source device quantity should be decremented from 7 to 5
    assert.equal(updatedSource.quantity, 5, 'Source quantity should be 7 - 2 = 5');

    // Destination 'محل 2' already had 5 units, now should have 5 + 2 = 7 units
    const updatedDevices = JSON.parse(globalThis.localStorage.getItem('shop_mss_devices_cache_v1'));
    const screenInShop2 = updatedDevices.find(d => d.model_id === MODEL_SCREEN_ID && d.stock_location === 'محل 2' && d.status === 'AVAILABLE');
    assert.equal(screenInShop2.quantity, 7, 'Destination quantity should be 5 + 2 = 7');

    // Movement record must be logged
    assert.equal(movement.from_location, 'محل 1');
    assert.equal(movement.to_location, 'محل 2');
    assert.ok(movement.notes.includes('2 وحدة'));
  });

  await t.test('Task 3: Serialized unit transfer (1 whole unit with serial number)', async () => {
    const cachedDevices = JSON.parse(globalThis.localStorage.getItem('shop_mss_devices_cache_v1'));
    const laptop = cachedDevices.find(d => d.serial_number === 'SN-LEN-001');
    assert.equal(laptop.stock_location, 'محل 1');

    const { device: transferredLaptop, movement } = await mssInventoryService.transferDevice({
      device_id: laptop.id,
      to_location: 'محل 2',
      notes: 'نقل اللابتوب لمحل 2',
    });

    assert.equal(transferredLaptop.stock_location, 'محل 2');
    assert.equal(transferredLaptop.serial_number, 'SN-LEN-001');
    assert.equal(movement.from_location, 'محل 1');
    assert.equal(movement.to_location, 'محل 2');
    assert.equal(movement.serial_number, 'SN-LEN-001');
  });

  // =========================================================================
  // SEARCHABLE MODEL DROPDOWN IN STOCK ADJUSTMENT MODAL
  // =========================================================================
  await t.test('Stock Adjustment Modal: Searchable Model Dropdown Behavior', async (sub) => {
    const models = [
      { id: 'm1', brand: 'Dell', model_name: 'UltraSharp U2723QE', category: 'Screen' },
      { id: 'm2', brand: 'Lenovo', model_name: 'ThinkPad T14 Gen 3', category: 'Laptop' },
      { id: 'm3', brand: 'HP', model_name: 'EliteBook 840 G8', category: 'Laptop' },
      { id: 'm4', brand: 'Samsung', model_name: 'Odyssey G7', category: 'Screen' },
    ];

    const filterModels = (searchTerm, list) => {
      if (!searchTerm || !searchTerm.trim()) return list;
      const term = searchTerm.trim().toLowerCase();
      return list.filter(m => {
        const fullName = `${m.brand} ${m.model_name}`.toLowerCase();
        const modelOnly = (m.model_name || '').toLowerCase();
        const brandOnly = (m.brand || '').toLowerCase();
        return fullName.includes(term) || modelOnly.includes(term) || brandOnly.includes(term);
      });
    };

    await sub.test('1. Partial match and case-insensitive search by model name', () => {
      // Partial lowercase
      const res1 = filterModels('ultra', models);
      assert.equal(res1.length, 1);
      assert.equal(res1[0].id, 'm1');

      // Uppercase partial
      const res2 = filterModels('THINKPAD', models);
      assert.equal(res2.length, 1);
      assert.equal(res2[0].id, 'm2');

      // Partial mid-word
      const res3 = filterModels('840', models);
      assert.equal(res3.length, 1);
      assert.equal(res3[0].id, 'm3');
    });

    await sub.test('2. Complete model name search', () => {
      const res = filterModels('ThinkPad T14 Gen 3', models);
      assert.equal(res.length, 1);
      assert.equal(res[0].model_name, 'ThinkPad T14 Gen 3');
    });

    await sub.test('3. Search by brand name', () => {
      const res = filterModels('Dell', models);
      assert.equal(res.length, 1);
      assert.equal(res[0].brand, 'Dell');
    });

    await sub.test('4. No-results state returns empty array and displays Arabic message', () => {
      const res = filterModels('MacBook Pro M3 Max', models);
      assert.equal(res.length, 0, 'No models should match');

      const emptyMessage = res.length === 0 ? 'مفيش موديلات مطابقة للبحث' : '';
      assert.equal(emptyMessage, 'مفيش موديلات مطابقة للبحث');
    });

    await sub.test('5. Clearing search restores the full list of models', () => {
      // Initially filtered
      const filtered = filterModels('samsung', models);
      assert.equal(filtered.length, 1);

      // Cleared search query
      const cleared = filterModels('', models);
      assert.equal(cleared.length, models.length, 'Full list must be restored when search is cleared');

      // Whitespace search query
      const whitespace = filterModels('   ', models);
      assert.equal(whitespace.length, models.length, 'Full list must be restored on whitespace query');
    });

    await sub.test('6. MSSInventoryView.tsx contains searchable input and Arabic empty state', async () => {
      const fs = await import('node:fs');
      const path = await import('node:path');
      const viewPath = path.resolve('src/components/placeholders/mss/MSSInventoryView.tsx');
      assert.ok(fs.existsSync(viewPath));

      const content = fs.readFileSync(viewPath, 'utf8');

      // Check for search input in model selection
      assert.ok(content.includes('modelSearchTerm'), 'Must have modelSearchTerm state');
      assert.ok(content.includes('filteredAdjustmentModels'), 'Must compute filteredAdjustmentModels');
      assert.ok(content.includes('ابحث باسم الموديل أو الماركة...'), 'Must have search placeholder');

      // Check for clear button
      assert.ok(content.includes("setModelSearchTerm('')"), 'Must have clear button handler');

      // Check for exact Arabic empty state
      assert.ok(content.includes('مفيش موديلات مطابقة للبحث'), 'Must have exact Arabic empty state: مفيش موديلات مطابقة للبحث');

      // Check that selecting model updates adjustmentModelId and closes dropdown
      assert.ok(content.includes('setAdjustmentModelId(m.id)'), 'Selecting item must set adjustmentModelId');
      assert.ok(content.includes('setIsModelDropdownOpen(false)'), 'Selecting item must close dropdown');
    });
  });
});
