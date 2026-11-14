// Automated Verification Script for Phase 06: MSS Cloud Foundation & Shared Catalog
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';

// Mock localStorage for Node.js test environment
const storage = new Map();
global.localStorage = {
  getItem: (key) => storage.get(key) || null,
  setItem: (key, val) => storage.set(key, String(val)),
  removeItem: (key) => storage.delete(key),
  clear: () => storage.clear(),
};

// Import services dynamically
const { mssCatalogService } = await import('../src/services/mssCatalogService.ts');
const { productsService } = await import('../src/services/productsService.ts');

describe('Phase 06 — MSS Cloud Foundation & Shared Catalog Verification', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('1. Initial seed models load properly into shared catalog', async () => {
    const models = await mssCatalogService.getModels();
    assert.ok(models.length >= 4, 'Should load initial seed catalog models');

    const t480 = models.find(m => m.model_name.includes('T480'));
    assert.ok(t480, 'ThinkPad T480 should exist in catalog');
    assert.strictEqual(t480.brand, 'Lenovo');
    assert.strictEqual(t480.category, 'لابتوب');
    assert.strictEqual(t480.default_list_price, 11500);
    assert.ok(t480.processor?.includes('i5-8350U'));
  });

  test('2. Add new model to shared catalog with full specifications', async () => {
    const newModel = await mssCatalogService.createModel({
      brand: 'Asus',
      model_name: 'ZenBook 14 OLED',
      category: 'لابتوب',
      processor: 'Intel Core Ultra 7 155H',
      ram: '32 GB LPDDR5X',
      storage: '1 TB NVMe SSD',
      screen_size: '14" 2.8K OLED 120Hz',
      specifications: 'هيكل فائق النحافة، شاحن تايب سي 65W، بطارية 75Wh',
      default_list_price: 36000,
    });

    assert.ok(newModel.id, 'New model should have generated ID');
    assert.strictEqual(newModel.brand, 'Asus');
    assert.strictEqual(newModel.default_list_price, 36000);

    const retrieved = await mssCatalogService.getModelById(newModel.id);
    assert.ok(retrieved, 'Should retrieve model by ID');
    assert.strictEqual(retrieved?.model_name, 'ZenBook 14 OLED');
  });

  test('3. Enforce validation: Brand, Model Name required, non-negative price', async () => {
    // Missing brand
    await assert.rejects(
      async () => {
        await mssCatalogService.createModel({
          brand: '',
          model_name: 'Latitude 7420',
          category: 'لابتوب',
          default_list_price: 18000,
        });
      },
      /الماركة.*مطلوبة/
    );

    // Missing model name
    await assert.rejects(
      async () => {
        await mssCatalogService.createModel({
          brand: 'Dell',
          model_name: '',
          category: 'لابتوب',
          default_list_price: 18000,
        });
      },
      /اسم الموديل.*مطلوب/
    );

    // Negative price
    await assert.rejects(
      async () => {
        await mssCatalogService.createModel({
          brand: 'Dell',
          model_name: 'Latitude 7420',
          category: 'لابتوب',
          default_list_price: -500,
        });
      },
      /السعر الاسترشادي لا يمكن أن يكون سالباً/
    );
  });

  test('4. Update model specifications and price override', async () => {
    const models = await mssCatalogService.getModels();
    const target = models[0];

    const updated = await mssCatalogService.updateModel(target.id, {
      default_list_price: target.default_list_price + 1000,
      specifications: 'تعديل السعر الاسترشادي المعتمد للمحفظة التجارية',
    });

    assert.strictEqual(updated.default_list_price, target.default_list_price + 1000);
    assert.strictEqual(updated.specifications, 'تعديل السعر الاسترشادي المعتمد للمحفظة التجارية');

    const reloaded = await mssCatalogService.getModelById(target.id);
    assert.strictEqual(reloaded?.default_list_price, target.default_list_price + 1000);
  });

  test('5. Search models by brand, model name, or processor', async () => {
    // Search by brand
    const dells = await mssCatalogService.getModels('Dell');
    assert.ok(dells.length >= 2, 'Should find Dell models');
    assert.ok(dells.every(m => m.brand === 'Dell'));

    // Search by processor
    const i7Models = await mssCatalogService.getModels('i7');
    assert.ok(i7Models.length >= 1, 'Should find i7 model');
    assert.ok(i7Models.some(m => m.processor?.includes('i7')));
  });

  test('6. Filter models by category', async () => {
    const laptops = await mssCatalogService.getModels(undefined, 'لابتوب');
    assert.ok(laptops.length >= 3);
    assert.ok(laptops.every(m => m.category === 'لابتوب'));

    const monitors = await mssCatalogService.getModels(undefined, 'شاشة');
    assert.ok(monitors.length >= 1);
    assert.ok(monitors.every(m => m.category === 'شاشة'));
  });

  test('7. Model physical availability separates Shop 1 and Shop 2 stock accurately', async () => {
    const availabilityMap = await mssCatalogService.getAvailabilityMap();
    assert.ok(Object.keys(availabilityMap).length >= 1, 'Availability map should contain models');

    // Model T480 availability separates shops accurately
    const t480Avail = availabilityMap['a0000000-0000-0000-0000-000000000001'];
    if (t480Avail) {
      assert.ok(t480Avail.available_shop1 >= 0, 'Shop 1 quantity must be non-negative');
      assert.ok(t480Avail.available_shop2 >= 0, 'Shop 2 quantity must be non-negative');
      assert.strictEqual(
        t480Avail.total_available,
        t480Avail.available_shop1 + t480Avail.available_shop2,
        'Combined total must equal sum of both shops'
      );
    }

    // Model Latitude 5420 has units in Shop 1
    const dellAvail = availabilityMap['a0000000-0000-0000-0000-000000000002'];
    if (dellAvail) {
      assert.ok(dellAvail.available_shop1 >= 0);
      assert.strictEqual(
        dellAvail.total_available,
        dellAvail.available_shop1 + dellAvail.available_shop2,
        'Combined total must equal sum of both shops'
      );
    }
  });

  test('8. Delete model from catalog', async () => {
    const created = await mssCatalogService.createModel({
      brand: 'Acer',
      model_name: 'TravelMate P2',
      category: 'لابتوب',
      default_list_price: 9000,
    });

    await mssCatalogService.deleteModel(created.id);
    const afterDelete = await mssCatalogService.getModelById(created.id);
    assert.strictEqual(afterDelete, null, 'Deleted model should not exist');
  });

  test('9. Data persistence across simulated offline reload', async () => {
    const created = await mssCatalogService.createModel({
      brand: 'Apple',
      model_name: 'MacBook Air M2',
      category: 'لابتوب',
      processor: 'Apple M2 8-core',
      ram: '16 GB Unified',
      storage: '512 GB SSD',
      screen_size: '13.6" Liquid Retina',
      default_list_price: 45000,
    });

    // Simulate reload from cache
    const models = await mssCatalogService.getModels();
    const found = models.find(m => m.id === created.id);
    assert.ok(found, 'Created model should persist in local cache');
    assert.strictEqual(found?.default_list_price, 45000);
  });

  test('10. Strict separation: Accessories products are NEVER mixed with MSS models (Rule 6)', async () => {
    // 1. Fetch Accessories products
    const accessoriesProducts = await productsService.getProducts();

    // 2. Fetch MSS Catalog models
    const mssModels = await mssCatalogService.getModels();

    // 3. Verify IDs and namespaces are completely disjoint
    const accIds = new Set(accessoriesProducts.map(p => p.id));
    const mssIds = new Set(mssModels.map(m => m.id));

    for (const id of accIds) {
      assert.ok(!mssIds.has(id), `Accessories ID ${id} must never appear in MSS catalog`);
    }

    // 4. Verify storage keys are completely isolated
    assert.notStrictEqual(
      localStorage.getItem('shop_accessories_products_v1'),
      localStorage.getItem('shop_mss_models_cache_v1')
    );
  });
});
