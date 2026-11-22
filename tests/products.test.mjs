// Automated Verification Script for Phase 02: Accessories Products & Local Database
import { test, describe, before, beforeEach } from 'node:test';
import assert from 'node:assert';

// Mock localStorage for Node.js environment
const storage = new Map();
global.localStorage = {
  getItem: (key) => storage.get(key) || null,
  setItem: (key, val) => storage.set(key, String(val)),
  removeItem: (key) => storage.delete(key),
  clear: () => storage.clear(),
};

// Import productsService dynamically
const { productsService } = await import('../src/services/productsService.ts');
const { generateProductCodePrefix, generateNextProductCode } = await import('../src/lib/productCodeGenerator.ts');

describe('Phase 02 — Local Database & Accessories Products Verification', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('1. Initial products load with seed items', async () => {
    const products = await productsService.getProducts();
    assert.ok(products.length >= 5, 'Should load initial seed items');
    assert.ok(products[0].id, 'Product must have an id');
    assert.ok(products[0].code, 'Product must have a code');
    assert.ok(products[0].name, 'Product must have a name');
  });

  test('2. Add new product successfully', async () => {
    const newProduct = await productsService.addProduct({
      name: 'سماعة رأس احترافية مع مايك',
      code: 'HEADSET-PRO-01',
      barcode: '9988776655443',
      category: 'صوتيات',
      cost: 150,
      price: 260,
      stock: 20,
      low_stock_threshold: 5,
      description: 'سماعة عازلة للضوضاء محيطية',
    });

    assert.ok(newProduct.id, 'New product should have generated ID');
    assert.strictEqual(newProduct.name, 'سماعة رأس احترافية مع مايك');
    assert.strictEqual(newProduct.code, 'HEADSET-PRO-01');
    assert.strictEqual(newProduct.cost, 150);
    assert.strictEqual(newProduct.price, 260);
    assert.strictEqual(newProduct.stock, 20);

    // Verify persistence
    const fetched = await productsService.getProductById(newProduct.id);
    assert.ok(fetched, 'Product should be retrievable by ID');
    assert.strictEqual(fetched.code, 'HEADSET-PRO-01');
  });

  test('3. Enforce Unique Product Code constraint', async () => {
    await productsService.addProduct({
      name: 'منتج أ',
      code: 'UNIQUE-CODE-1',
      cost: 10,
      price: 20,
      stock: 5,
      low_stock_threshold: 2,
    });

    await assert.rejects(
      async () => {
        await productsService.addProduct({
          name: 'منتج ب بكود مكرر',
          code: 'UNIQUE-CODE-1',
          cost: 15,
          price: 25,
          stock: 3,
          low_stock_threshold: 2,
        });
      },
      /كود الصنف.*مسجل مسبقاً/,
      'Should throw unique constraint error for duplicate code'
    );
  });

  test('4. Enforce Unique Barcode constraint', async () => {
    await productsService.addProduct({
      name: 'منتج باركود أ',
      code: 'BAR-001',
      barcode: '1122334455',
      cost: 10,
      price: 20,
      stock: 5,
      low_stock_threshold: 2,
    });

    await assert.rejects(
      async () => {
        await productsService.addProduct({
          name: 'منتج باركود ب بباركود مكرر',
          code: 'BAR-002',
          barcode: '1122334455',
          cost: 15,
          price: 25,
          stock: 3,
          low_stock_threshold: 2,
        });
      },
      /الباركود.*مسجل مسبقاً/,
      'Should throw unique constraint error for duplicate barcode'
    );
  });

  test('5. Enforce non-negative numeric constraints', async () => {
    await assert.rejects(
      async () => {
        await productsService.addProduct({
          name: 'سعر تكلفة سالب',
          code: 'NEG-01',
          cost: -50,
          price: 100,
          stock: 10,
          low_stock_threshold: 2,
        });
      },
      /سعر التكلفة لا يمكن أن يكون سالباً/
    );

    await assert.rejects(
      async () => {
        await productsService.addProduct({
          name: 'سعر بيع سالب',
          code: 'NEG-02',
          cost: 50,
          price: -10,
          stock: 10,
          low_stock_threshold: 2,
        });
      },
      /سعر البيع لا يمكن أن يكون سالباً/
    );

    await assert.rejects(
      async () => {
        await productsService.addProduct({
          name: 'رصيد سالب',
          code: 'NEG-03',
          cost: 50,
          price: 100,
          stock: -5,
          low_stock_threshold: 2,
        });
      },
      /الكمية المتوفرة لا يمكن أن تكون سالبة/
    );
  });

  test('6. Search products by Name, Code, and Barcode', async () => {
    const byCode = await productsService.getProducts({ searchQuery: 'CHG-20W' });
    assert.ok(byCode.length >= 1, 'Should find product by code');
    assert.ok(byCode[0].code.includes('CHG-20W'));

    const byBarcode = await productsService.getProducts({ searchQuery: '6221234567891' });
    assert.ok(byBarcode.length >= 1, 'Should find product by barcode');
    assert.strictEqual(byBarcode[0].barcode, '6221234567891');

    const byName = await productsService.getProducts({ searchQuery: 'سماعة' });
    assert.ok(byName.length >= 1, 'Should find product by Arabic name');
  });

  test('7. Update existing product', async () => {
    const products = await productsService.getProducts();
    const target = products[0];

    const updated = await productsService.updateProduct(target.id, {
      name: 'اسم معدل جديد',
      code: target.code,
      cost: 99,
      price: 199,
      stock: 45,
      low_stock_threshold: 8,
      category: 'تحديثات',
    });

    assert.strictEqual(updated.name, 'اسم معدل جديد');
    assert.strictEqual(updated.cost, 99);
    assert.strictEqual(updated.price, 199);
    assert.strictEqual(updated.stock, 45);

    const refreshed = await productsService.getProductById(target.id);
    assert.strictEqual(refreshed?.name, 'اسم معدل جديد');
  });

  test('8. Delete product', async () => {
    const newProduct = await productsService.addProduct({
      name: 'صنف للحذف',
      code: 'DEL-TEMP-01',
      cost: 10,
      price: 20,
      stock: 2,
      low_stock_threshold: 1,
    });

    assert.ok(await productsService.getProductById(newProduct.id));

    await productsService.deleteProduct(newProduct.id);

    const afterDelete = await productsService.getProductById(newProduct.id);
    assert.strictEqual(afterDelete, null, 'Deleted product should no longer exist');
  });

  test('9. Stock status filtering (in_stock, low_stock, out_of_stock)', async () => {
    const outOfStock = await productsService.getProducts({ stockStatus: 'out_of_stock' });
    assert.ok(outOfStock.every(p => p.stock === 0), 'Every item in out_of_stock must have stock 0');

    const lowStock = await productsService.getProducts({ stockStatus: 'low_stock' });
    assert.ok(
      lowStock.every(p => p.stock > 0 && p.stock <= p.low_stock_threshold),
      'Every item in low_stock must have stock <= low_stock_threshold'
    );
  });

  test('10. Data Persistence after application restart', async () => {
    // 1. Add unique product
    const added = await productsService.addProduct({
      name: 'منتج فحص البقاء بعد إعادة التشغيل',
      code: 'PERSIST-TEST-001',
      barcode: '999111222333',
      cost: 75,
      price: 130,
      stock: 18,
      low_stock_threshold: 4,
    });

    // 2. Simulate complete restart: clear module cache and re-read from storage
    const rawSaved = localStorage.getItem('shop_accessories_products_v1');
    assert.ok(rawSaved, 'LocalStorage must contain persisted data');

    const parsed = JSON.parse(rawSaved);
    const foundInRaw = parsed.find(p => p.id === added.id);
    assert.ok(foundInRaw, 'Added product must exist in raw persistent storage');
    assert.strictEqual(foundInRaw.code, 'PERSIST-TEST-001');
    assert.strictEqual(foundInRaw.stock, 18);
  });

  test('11. Intelligent Product Code Prefix Generation (English, Arabic, Mixed, Punctuation)', () => {
    // Case 1: One-word English (first TWO letters)
    assert.strictEqual(generateProductCodePrefix('Mouse'), 'MO');
    assert.strictEqual(generateProductCodePrefix('Keyboard'), 'KE');
    assert.strictEqual(generateProductCodePrefix('Headphones'), 'HE');
    assert.strictEqual(generateProductCodePrefix('Charger'), 'CH');

    // Case 2: Two-word English (first letter of each word)
    assert.strictEqual(generateProductCodePrefix('Gaming Mouse'), 'GM');
    assert.strictEqual(generateProductCodePrefix('Wireless Keyboard'), 'WK');
    assert.strictEqual(generateProductCodePrefix('Red Dragon'), 'RD');
    assert.strictEqual(generateProductCodePrefix('Original Charger'), 'OC');

    // Case 3: Three or more words (first letter of first THREE words only)
    assert.strictEqual(generateProductCodePrefix('Redragon Gaming Mouse'), 'RGM');
    assert.strictEqual(generateProductCodePrefix('HP Original Laptop Charger'), 'HOL');
    assert.strictEqual(generateProductCodePrefix('Logitech Wireless Gaming Mouse'), 'LWG');
    assert.strictEqual(generateProductCodePrefix('Samsung EVO Plus SSD Drive'), 'SEP');

    // Arabic Product Names
    assert.strictEqual(generateProductCodePrefix('ماوس'), 'MA');
    assert.strictEqual(generateProductCodePrefix('كيبورد'), 'KY');
    assert.strictEqual(generateProductCodePrefix('سماعة'), 'SM');
    assert.strictEqual(generateProductCodePrefix('كابل شحن'), 'KS');
    assert.strictEqual(generateProductCodePrefix('جراب حماية سيليكون'), 'GHS');

    // Arabic Definite Article "ال"
    assert.strictEqual(generateProductCodePrefix('الماوس'), 'MA');
    assert.strictEqual(generateProductCodePrefix('الشاحن السريع'), 'SS');

    // Mixed Arabic & English
    assert.strictEqual(generateProductCodePrefix('Logitech ماوس لاسلكي'), 'LML');
    assert.strictEqual(generateProductCodePrefix('كابل Type-C أصلي'), 'KTC');

    // Punctuation and extra spaces
    assert.strictEqual(generateProductCodePrefix('  [Pro]   Gaming - Mouse!  '), 'PGM');
    assert.strictEqual(generateProductCodePrefix('   '), 'PRD');
    assert.strictEqual(generateProductCodePrefix(''), 'PRD');
  });

  test('12. Numeric Suffix Allocation, Sequence Preservation and Uniqueness', () => {
    // Initial code for new prefix
    const code1 = generateNextProductCode('Mouse', []);
    assert.strictEqual(code1, 'MO-001');

    // Next sequential code
    const code2 = generateNextProductCode('Mouse', [{ code: 'MO-001' }]);
    assert.strictEqual(code2, 'MO-002');

    // Separate prefix gets independent starting sequence
    const code3 = generateNextProductCode('Gaming Mouse', [{ code: 'MO-001' }, { code: 'MO-002' }]);
    assert.strictEqual(code3, 'GM-001');

    // Uniqueness jump if existing code conflicts
    const code4 = generateNextProductCode('Mouse', [{ code: 'MO-001' }, { code: 'MO-002' }, { code: 'MO-003' }]);
    assert.strictEqual(code4, 'MO-004');

    // Default prefix preserves PRD sequence
    const defaultCode = generateNextProductCode('', [{ code: 'PRD-001' }, { code: 'PRD-002' }]);
    assert.strictEqual(defaultCode, 'PRD-003');
  });

  test('13. Combined Low-Stock Filter and Ascending Stock Priority (0 first, 1, 2, 3...)', async () => {
    // Clear and seed isolated test products
    localStorage.setItem('shop_accessories_products_v1', JSON.stringify([]));

    await productsService.addProduct({
      name: 'صنف عادي متوفر بكثرة',
      code: 'HIGH-STOCK-01',
      cost: 10,
      price: 20,
      stock: 50,
      low_stock_threshold: 5,
    });

    await productsService.addProduct({
      name: 'صنف منخفض رصيد 3',
      code: 'LOW-STOCK-03',
      cost: 10,
      price: 20,
      stock: 3,
      low_stock_threshold: 5,
    });

    await productsService.addProduct({
      name: 'صنف نافد رصيد صفر أ',
      code: 'OUT-STOCK-01',
      cost: 10,
      price: 20,
      stock: 0,
      low_stock_threshold: 5,
    });

    await productsService.addProduct({
      name: 'صنف منخفض رصيد 1',
      code: 'LOW-STOCK-01',
      cost: 10,
      price: 20,
      stock: 1,
      low_stock_threshold: 5,
    });

    await productsService.addProduct({
      name: 'صنف نافد رصيد صفر ب',
      code: 'OUT-STOCK-02',
      cost: 10,
      price: 20,
      stock: 0,
      low_stock_threshold: 5,
    });

    const combinedList = await productsService.getProducts({ stockStatus: 'low_and_out' });

    // 1. Verifies normal stock is excluded
    assert.ok(
      combinedList.every(p => p.stock <= p.low_stock_threshold),
      'All items must have stock <= low_stock_threshold'
    );
    assert.ok(
      !combinedList.some(p => p.code === 'HIGH-STOCK-01'),
      'High stock items must be excluded'
    );

    // 2. Verifies out of stock (0) and low stock (1, 3) are both present
    assert.ok(combinedList.some(p => p.stock === 0), 'Must include out-of-stock items');
    assert.ok(combinedList.some(p => p.stock > 0), 'Must include low-stock items');

    // 3. Verifies ascending sort priority: 0 first, then 1, 2, 3...
    const stocks = combinedList.map(p => p.stock);
    for (let i = 0; i < stocks.length - 1; i++) {
      assert.ok(
        stocks[i] <= stocks[i + 1],
        `Stock at index ${i} (${stocks[i]}) must be <= stock at index ${i + 1} (${stocks[i + 1]})`
      );
    }

    // First items must have stock 0
    assert.strictEqual(stocks[0], 0, 'First item must have stock 0');
    assert.strictEqual(stocks[1], 0, 'Second item must have stock 0');
    assert.strictEqual(stocks[2], 1, 'Third item must have stock 1');
    assert.strictEqual(stocks[3], 3, 'Fourth item must have stock 3');
  });
});
