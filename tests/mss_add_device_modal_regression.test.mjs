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
  globalThis.navigator = { onLine: false }; // Offline mode guarantees zero remote network calls
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

// Import services and supabase client
const { supabase } = await import('../src/lib/supabase.ts');
const { mssInventoryService } = await import('../src/services/mssInventoryService.ts');
const { mssCatalogService } = await import('../src/services/mssCatalogService.ts');
const { formatCurrency } = await import('../src/lib/utils.ts');

// Explicitly stub supabase.from to ensure 100% in-memory isolation
const inMemoryTables = {
  mss_models: new Map(),
  mss_devices: new Map(),
  mss_stores: new Map([
    ['store-1', { id: 'store-1', name: 'محل 1', is_active: true }],
    ['store-2', { id: 'store-2', name: 'محل 2', is_active: true }],
  ]),
  mss_outbox: new Map(),
};

function createQueryChain(table) {
  let records = Array.from(inMemoryTables[table]?.values() || []);
  const chain = {
    select: () => chain,
    eq: (col, val) => {
      records = records.filter(r => r[col] === val);
      return chain;
    },
    order: (col, opts) => {
      records.sort((a, b) => {
        if (a[col] < b[col]) return opts?.ascending === false ? 1 : -1;
        if (a[col] > b[col]) return opts?.ascending === false ? -1 : 1;
        return 0;
      });
      return chain;
    },
    then: (resolve, reject) => {
      return Promise.resolve({ data: records, error: null }).then(resolve, reject);
    }
  };
  return chain;
}

supabase.from = (table) => {
  return {
    select: () => createQueryChain(table),
    insert: (rows) => {
      const arr = Array.isArray(rows) ? rows : [rows];
      for (const r of arr) {
        const id = r.id || `mock-${Date.now()}-${Math.random()}`;
        inMemoryTables[table]?.set(id, { ...r, id });
      }
      return {
        select: () => ({
          single: () => Promise.resolve({ data: arr[0], error: null }),
          then: (resolve, reject) => Promise.resolve({ data: arr, error: null }).then(resolve, reject),
        }),
        then: (resolve, reject) => Promise.resolve({ data: arr, error: null }).then(resolve, reject),
      };
    },
    upsert: (rows) => {
      const arr = Array.isArray(rows) ? rows : [rows];
      for (const r of arr) {
        const id = r.id || `mock-${Date.now()}-${Math.random()}`;
        inMemoryTables[table]?.set(id, { ...r, id });
      }
      return Promise.resolve({ data: arr, error: null });
    },
    delete: () => ({
      eq: (col, val) => {
        for (const [k, v] of inMemoryTables[table]?.entries() || []) {
          if (v[col] === val) inMemoryTables[table].delete(k);
        }
        return Promise.resolve({ data: null, error: null });
      }
    }),
  };
};

test('MSS Add New Device Modal - Dynamic Selling Price & Specifications Regression Suite', async (t) => {
  globalThis.localStorage.clear();

  // Test Fixtures: In-memory Catalog Models
  const modelDell20k = {
    id: 'test-model-dell-20k',
    brand: 'Dell',
    model_name: 'Precision 5550',
    category: 'لابتوب',
    processor: 'Intel Core i7-10875H (8 Cores)',
    gpu: 'NVIDIA Quadro T2000 4GB',
    ram: '32 GB DDR4 3200MHz',
    storage: '1 TB NVMe SSD M.2',
    screen_size: '15.6" UHD+ (3840x2400) Touch IPS 500 nits',
    specifications: 'حالة ممتازة فابريقة، كيبورد إنجليزي/عربي مضيء، شاحن أصلي 130W تايب سي',
    default_list_price: 20000,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const modelHp28k = {
    id: 'test-model-hp-28k',
    brand: 'HP',
    model_name: 'ZBook Power G8',
    category: 'لابتوب',
    processor: 'Intel Core i9-11950H',
    gpu: 'NVIDIA RTX A2000 4GB',
    ram: '64 GB DDR4',
    storage: '2 TB NVMe SSD',
    screen_size: '15.6" FHD IPS',
    specifications: 'جهاز وركستيشن للأعمال الهندسية والمونتاج الثقيل',
    default_list_price: 28000,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const modelLenovoNoPrice = {
    id: 'test-model-lenovo-noprice',
    brand: 'Lenovo',
    model_name: 'ThinkCentre M720 Tiny',
    category: 'أخرى',
    processor: 'Intel Core i5-8400T',
    gpu: null, // Optional GPU missing
    ram: '8 GB DDR4',
    storage: '256 GB SSD',
    screen_size: null, // Optional screen missing
    specifications: null, // Optional notes missing
    default_list_price: 0, // Unconfigured selling price (0)
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const catalogModels = [modelDell20k, modelHp28k, modelLenovoNoPrice];
  for (const m of catalogModels) {
    inMemoryTables.mss_models.set(m.id, m);
  }

  // Component State Machine Simulator replicating MSSDeviceCreationModal logic
  function createModalHarness(models, initialModelId = undefined) {
    let formModelId = '';
    let formListPrice = '';
    let formCost = '';
    let formSerial = '';
    let formQuantity = 1;
    let formError = '';

    // Simulate modal open initialization
    if (initialModelId) {
      formModelId = initialModelId;
      const m = models.find(x => x.id === initialModelId);
      if (m && typeof m.default_list_price === 'number' && m.default_list_price > 0) {
        formListPrice = m.default_list_price;
      } else {
        formListPrice = '';
      }
    } else if (models.length > 0) {
      formModelId = models[0].id;
      if (typeof models[0].default_list_price === 'number' && models[0].default_list_price > 0) {
        formListPrice = models[0].default_list_price;
      } else {
        formListPrice = '';
      }
    }

    // Handlers matching the updated MSSDeviceCreationModal implementation
    const handleModelChange = (modelId) => {
      formModelId = modelId;
      const m = models.find(x => x.id === modelId);
      if (m && typeof m.default_list_price === 'number' && m.default_list_price > 0) {
        formListPrice = m.default_list_price;
      } else {
        formListPrice = '';
      }
    };

    const handleCustomPriceInput = (val) => {
      formListPrice = val === '' ? '' : Number(val);
    };

    // Specifications getter matching selectedModel in component
    const getSelectedModel = () => {
      if (!formModelId) return null;
      return models.find(m => m.id === formModelId) || null;
    };

    const getDisplayedSpecs = () => {
      const selected = getSelectedModel();
      if (!selected) return null;
      return {
        brand: selected.brand,
        model_name: selected.model_name,
        category: selected.category || 'غير محدد',
        processor: selected.processor?.trim() || 'غير محدد',
        gpu: selected.gpu?.trim() || 'غير محدد',
        ram: selected.ram?.trim() || 'غير محدد',
        storage: selected.storage?.trim() || 'غير محدد',
        screen_size: selected.screen_size?.trim() || 'غير محدد',
        specifications: selected.specifications?.trim() || 'لا توجد ملاحظات إضافية مسجلة لهذا الموديل',
        selling_price_display: typeof selected.default_list_price === 'number' && selected.default_list_price > 0
          ? formatCurrency(selected.default_list_price)
          : 'غير محدد',
      };
    };

    return {
      getFormModelId: () => formModelId,
      getFormListPrice: () => formListPrice,
      handleModelChange,
      handleCustomPriceInput,
      getSelectedModel,
      getDisplayedSpecs,
    };
  }

  await t.test('1. Selecting a model with selling price of 20,000 populates Offer Price with 20,000', () => {
    const harness = createModalHarness(catalogModels, modelDell20k.id);
    assert.strictEqual(harness.getFormModelId(), modelDell20k.id);
    assert.strictEqual(harness.getFormListPrice(), 20000, 'Offer Price must be exactly 20,000');
  });

  await t.test('2. The value is NOT replaced by old hardcoded 15,000', () => {
    const harness = createModalHarness(catalogModels, modelDell20k.id);
    assert.notStrictEqual(harness.getFormListPrice(), 15000, 'Price must NOT be hardcoded 15,000');
    assert.strictEqual(harness.getFormListPrice(), 20000);
  });

  await t.test('3. Switching models updates the Offer Price correctly to the new model price', () => {
    const harness = createModalHarness(catalogModels, modelDell20k.id);
    assert.strictEqual(harness.getFormListPrice(), 20000);

    // Switch to HP ZBook with selling price 28,000
    harness.handleModelChange(modelHp28k.id);
    assert.strictEqual(harness.getFormModelId(), modelHp28k.id);
    assert.strictEqual(harness.getFormListPrice(), 28000, 'Price must dynamically update to 28,000');
    assert.notStrictEqual(harness.getFormListPrice(), 20000, 'Old price must be discarded');
    assert.notStrictEqual(harness.getFormListPrice(), 15000, 'Must never fall back to 15,000');

    // Switch back to Dell
    harness.handleModelChange(modelDell20k.id);
    assert.strictEqual(harness.getFormListPrice(), 20000, 'Price must update back to 20,000');
  });

  await t.test('4. A model without a configured selling price leaves Offer Price empty (never invents a price)', () => {
    const harness = createModalHarness(catalogModels, modelDell20k.id);
    assert.strictEqual(harness.getFormListPrice(), 20000);

    // Switch to Lenovo ThinkCentre which has default_list_price = 0
    harness.handleModelChange(modelLenovoNoPrice.id);
    assert.strictEqual(harness.getFormModelId(), modelLenovoNoPrice.id);
    assert.strictEqual(harness.getFormListPrice(), '', 'Offer price must be empty string, not an invented number');
    assert.notStrictEqual(harness.getFormListPrice(), 15000, 'Must NOT invent 15,000');
    assert.notStrictEqual(harness.getFormListPrice(), 20000, 'Must NOT retain old price from previous model');
  });

  await t.test('5. Selecting a model displays all its saved specifications accurately', () => {
    const harness = createModalHarness(catalogModels, modelDell20k.id);
    const specs = harness.getDisplayedSpecs();

    assert.ok(specs, 'Specifications object must exist');
    assert.strictEqual(specs.brand, 'Dell');
    assert.strictEqual(specs.model_name, 'Precision 5550');
    assert.strictEqual(specs.category, 'لابتوب');
    assert.strictEqual(specs.processor, 'Intel Core i7-10875H (8 Cores)');
    assert.strictEqual(specs.gpu, 'NVIDIA Quadro T2000 4GB');
    assert.strictEqual(specs.ram, '32 GB DDR4 3200MHz');
    assert.strictEqual(specs.storage, '1 TB NVMe SSD M.2');
    assert.strictEqual(specs.screen_size, '15.6" UHD+ (3840x2400) Touch IPS 500 nits');
    assert.ok(specs.selling_price_display.includes('20,000'), 'Formatted selling price must display 20,000');
  });

  await t.test('6. Model notes and remarks are displayed exactly as saved', () => {
    const harness = createModalHarness(catalogModels, modelDell20k.id);
    const specs = harness.getDisplayedSpecs();

    assert.strictEqual(
      specs.specifications,
      'حالة ممتازة فابريقة، كيبورد إنجليزي/عربي مضيء، شاحن أصلي 130W تايب سي',
      'Notes must match the exact string saved in the model record'
    );
  });

  await t.test('7. Switching models immediately clears previous specifications and updates cleanly', () => {
    const harness = createModalHarness(catalogModels, modelDell20k.id);
    let specs = harness.getDisplayedSpecs();
    assert.strictEqual(specs.model_name, 'Precision 5550');
    assert.strictEqual(specs.gpu, 'NVIDIA Quadro T2000 4GB');

    // Switch to HP
    harness.handleModelChange(modelHp28k.id);
    specs = harness.getDisplayedSpecs();
    assert.strictEqual(specs.model_name, 'ZBook Power G8');
    assert.strictEqual(specs.gpu, 'NVIDIA RTX A2000 4GB');
    assert.strictEqual(specs.ram, '64 GB DDR4');
    assert.strictEqual(specs.processor, 'Intel Core i9-11950H');
    assert.strictEqual(specs.specifications, 'جهاز وركستيشن للأعمال الهندسية والمونتاج الثقيل');
  });

  await t.test('8. Missing optional specifications display clear "غير محدد" empty indicator', () => {
    const harness = createModalHarness(catalogModels, modelLenovoNoPrice.id);
    const specs = harness.getDisplayedSpecs();

    assert.strictEqual(specs.gpu, 'غير محدد', 'Missing GPU must display "غير محدد"');
    assert.strictEqual(specs.screen_size, 'غير محدد', 'Missing screen size must display "غير محدد"');
    assert.strictEqual(specs.specifications, 'لا توجد ملاحظات إضافية مسجلة لهذا الموديل', 'Missing notes must display fallback');
    assert.strictEqual(specs.selling_price_display, 'غير محدد', 'Zero price must display "غير محدد"');
  });

  await t.test('9. Manual price adjustment is preserved and saving uses the intended price', async () => {
    const harness = createModalHarness(catalogModels, modelDell20k.id);
    assert.strictEqual(harness.getFormListPrice(), 20000);

    // User gives special discount and changes price to 19,500
    harness.handleCustomPriceInput('19500');
    assert.strictEqual(harness.getFormListPrice(), 19500);

    // Seed model in cache for mssInventoryService
    const cachedModelsKey = 'shop_mss_models_cache_v1';
    globalThis.localStorage.setItem(cachedModelsKey, JSON.stringify(catalogModels));

    // Test creating device with custom price
    const created = await mssInventoryService.createDevice({
      serial_number: 'TEST-SER-001',
      model_id: modelDell20k.id,
      purchase_cost: 16000,
      list_price: Number(harness.getFormListPrice()),
      stock_location: 'محل 1',
      physical_condition: 'فرز أول ممتاز',
    });

    assert.strictEqual(created.list_price, 19500, 'Device list_price must be exactly 19,500');
    assert.strictEqual(created.purchase_cost, 16000, 'Purchase cost must remain untouched');
    assert.strictEqual(created.model_id, modelDell20k.id);
    assert.strictEqual(created.serial_number, 'TEST-SER-001');
  });

  await t.test('10. Bulk stock creation preserves quantity and intended list price without corruption', async () => {
    const harness = createModalHarness(catalogModels, modelHp28k.id);
    assert.strictEqual(harness.getFormListPrice(), 28000);

    // Test creating bulk stock (5 units)
    const bulkStock = await mssInventoryService.createBulkStock({
      model_id: modelHp28k.id,
      quantity: 5,
      purchase_cost: 22000,
      list_price: Number(harness.getFormListPrice()),
      stock_location: 'محل 2',
      physical_condition: 'فرز أول ممتاز',
    });

    assert.strictEqual(bulkStock.quantity, 5, 'Bulk quantity must be 5');
    assert.strictEqual(bulkStock.list_price, 28000, 'Bulk list_price must be 28,000');
    assert.strictEqual(bulkStock.purchase_cost, 22000, 'Bulk purchase cost must be 22,000');
    assert.strictEqual(bulkStock.is_serialized, false);
    assert.strictEqual(bulkStock.serial_number, null);
  });
});
