// Automated Verification Script for Phase 03: Accessories Purchases & Inventory
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
const { productsService } = await import('../src/services/productsService.ts');
const { purchasesService } = await import('../src/services/purchasesService.ts');
const { inventoryService } = await import('../src/services/inventoryService.ts');

describe('Phase 03 — Accessories Purchases & Inventory Verification', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('1. Initial purchases and movements load properly', async () => {
    const purchases = await purchasesService.getPurchases();
    assert.ok(purchases.length >= 2, 'Should load initial seed purchases');

    const movements = await inventoryService.getMovements();
    assert.ok(movements.length >= 4, 'Should load initial seed movements');
  });

  test('2. Generate next purchase number sequentially', async () => {
    const nextNum = await purchasesService.generateNextPurchaseNumber();
    assert.match(nextNum, /^PUR-\d{4}-\d{3}$/, 'Purchase number format should be PUR-YYYY-NNN');
  });

  test('3. Confirmed purchase safely increases stock and updates cost', async () => {
    // 1. Create a test product with initial stock 10, cost 50
    const prod = await productsService.addProduct({
      name: 'كابل شحن اختبار وارد',
      code: 'TEST-PUR-CBL-01',
      cost: 50,
      price: 100,
      stock: 10,
      low_stock_threshold: 5,
    });

    // 2. Create purchase of 25 items at new cost 55
    const purchase = await purchasesService.createPurchase({
      purchase_number: 'PUR-TEST-001',
      purchase_date: '2024-11-14',
      supplier_name: 'مورد اختبار',
      supplier_phone: '01000000000',
      notes: 'فاتورة تجريبية لاختبار زيادة المخزون',
      items: [
        {
          product_id: prod.id,
          quantity: 25,
          unit_cost: 55,
          update_product_cost: true,
        },
      ],
    });

    assert.ok(purchase.id, 'Purchase ID must be generated');
    assert.strictEqual(purchase.total_amount, 25 * 55);

    // 3. Verify stock increased from 10 to 35
    const updatedProd = await productsService.getProductById(prod.id);
    assert.strictEqual(updatedProd?.stock, 35, 'Stock must increase from 10 to 35');
    assert.strictEqual(updatedProd?.cost, 55, 'Cost must be updated to 55');

    // 4. Verify inventory movement was logged automatically
    const movements = await inventoryService.getMovements(prod.id);
    assert.ok(movements.length > 0, 'Movement must be logged for product');
    const lastMovement = movements[0];
    assert.strictEqual(lastMovement.movement_type, 'PURCHASE');
    assert.strictEqual(lastMovement.quantity_change, 25);
    assert.strictEqual(lastMovement.previous_stock, 10);
    assert.strictEqual(lastMovement.new_stock, 35);
  });

  test('4. Prevent duplicate purchase invoice number', async () => {
    const prod = await productsService.addProduct({
      name: 'صنف فحص تكرار الفاتورة',
      code: 'TEST-DUP-PUR-01',
      cost: 10,
      price: 20,
      stock: 5,
      low_stock_threshold: 2,
    });

    await purchasesService.createPurchase({
      purchase_number: 'PUR-DUP-999',
      purchase_date: '2024-11-14',
      items: [{ product_id: prod.id, quantity: 5, unit_cost: 10, update_product_cost: false }],
    });

    // Attempt second purchase with exact same purchase number
    await assert.rejects(
      async () => {
        await purchasesService.createPurchase({
          purchase_number: 'PUR-DUP-999',
          purchase_date: '2024-11-14',
          items: [{ product_id: prod.id, quantity: 2, unit_cost: 10, update_product_cost: false }],
        });
      },
      /رقم الفاتورة.*مسجل مسبقاً/,
      'Must reject duplicate purchase number'
    );
  });

  test('5. Reject purchase with invalid items or quantities', async () => {
    await assert.rejects(
      async () => {
        await purchasesService.createPurchase({
          purchase_number: 'PUR-EMPTY-01',
          purchase_date: '2024-11-14',
          items: [],
        });
      },
      /يجب اختيار صنف واحد على الأقل/
    );

    const prod = await productsService.addProduct({
      name: 'صنف فحص الكمية السالبة',
      code: 'TEST-NEG-PUR',
      cost: 10,
      price: 20,
      stock: 5,
      low_stock_threshold: 2,
    });

    await assert.rejects(
      async () => {
        await purchasesService.createPurchase({
          purchase_number: 'PUR-NEG-01',
          purchase_date: '2024-11-14',
          items: [{ product_id: prod.id, quantity: 0, unit_cost: 10, update_product_cost: false }],
        });
      },
      /كمية الصنف يجب أن تكون أكبر من صفر/
    );
  });

  test('6. Stock Adjustment (ADD) updates stock and logs movement', async () => {
    const prod = await productsService.addProduct({
      name: 'صنف تسوية زيادة',
      code: 'ADJ-ADD-01',
      cost: 20,
      price: 40,
      stock: 12,
      low_stock_threshold: 5,
    });

    const mov = await inventoryService.adjustStock({
      product_id: prod.id,
      adjustment_type: 'ADD',
      quantity: 8,
      reason: 'زيادة غير مسجلة تم العثور عليها',
    });

    assert.strictEqual(mov.movement_type, 'ADJUSTMENT_ADD');
    assert.strictEqual(mov.quantity_change, 8);
    assert.strictEqual(mov.previous_stock, 12);
    assert.strictEqual(mov.new_stock, 20);

    const refreshed = await productsService.getProductById(prod.id);
    assert.strictEqual(refreshed?.stock, 20);
  });

  test('7. Stock Adjustment (SUBTRACT) updates stock and logs movement', async () => {
    const prod = await productsService.addProduct({
      name: 'صنف تسوية خصم',
      code: 'ADJ-SUB-01',
      cost: 20,
      price: 40,
      stock: 15,
      low_stock_threshold: 5,
    });

    const mov = await inventoryService.adjustStock({
      product_id: prod.id,
      adjustment_type: 'SUBTRACT',
      quantity: 5,
      reason: 'تلف صنف أثناء التخزين',
    });

    assert.strictEqual(mov.movement_type, 'ADJUSTMENT_SUBTRACT');
    assert.strictEqual(mov.quantity_change, -5);
    assert.strictEqual(mov.previous_stock, 15);
    assert.strictEqual(mov.new_stock, 10);

    const refreshed = await productsService.getProductById(prod.id);
    assert.strictEqual(refreshed?.stock, 10);
  });

  test('8. Stock Adjustment (SET) sets exact audited count', async () => {
    const prod = await productsService.addProduct({
      name: 'صنف جرد دوري',
      code: 'ADJ-SET-01',
      cost: 20,
      price: 40,
      stock: 14,
      low_stock_threshold: 5,
    });

    const mov = await inventoryService.adjustStock({
      product_id: prod.id,
      adjustment_type: 'SET',
      quantity: 22,
      reason: 'جرد دوري ومطابقة فعلية',
    });

    assert.strictEqual(mov.new_stock, 22);
    assert.strictEqual(mov.quantity_change, 8);

    const refreshed = await productsService.getProductById(prod.id);
    assert.strictEqual(refreshed?.stock, 22);
  });

  test('9. Prevent stock deduction below zero (Enforce Non-Negative Quantities)', async () => {
    const prod = await productsService.addProduct({
      name: 'صنف فحص منع الرصيد السالب',
      code: 'NO-NEG-01',
      cost: 20,
      price: 40,
      stock: 3,
      low_stock_threshold: 5,
    });

    await assert.rejects(
      async () => {
        await inventoryService.adjustStock({
          product_id: prod.id,
          adjustment_type: 'SUBTRACT',
          quantity: 10,
          reason: 'عجز جرد',
        });
      },
      /لا يمكن خصم.*لأن الرصيد المتوفر حالياً.*هو 3 فقط/,
      'Must strictly reject stock deduction that causes negative stock'
    );

    // Verify stock remains untouched at 3
    const refreshed = await productsService.getProductById(prod.id);
    assert.strictEqual(refreshed?.stock, 3);
  });

  test('10. Enforce mandatory reason for stock adjustments', async () => {
    const prod = await productsService.addProduct({
      name: 'صنف فحص إلزامية السبب',
      code: 'REASON-REQ-01',
      cost: 10,
      price: 20,
      stock: 5,
      low_stock_threshold: 2,
    });

    await assert.rejects(
      async () => {
        await inventoryService.adjustStock({
          product_id: prod.id,
          adjustment_type: 'ADD',
          quantity: 2,
          reason: '   ', // empty reason
        });
      },
      /سبب التسوية الجردية إلزامي/,
      'Must require non-empty reason for audit compliance'
    );
  });

  test('11. Stock Alerts accurately detect low stock and out of stock', async () => {
    await productsService.addProduct({
      name: 'صنف منعدم تجريبي',
      code: 'OUT-OF-STOCK-01',
      cost: 10,
      price: 20,
      stock: 0,
      low_stock_threshold: 5,
    });

    await productsService.addProduct({
      name: 'صنف منخفض تجريبي',
      code: 'LOW-STOCK-01',
      cost: 10,
      price: 20,
      stock: 2,
      low_stock_threshold: 5,
    });

    const alerts = await inventoryService.getStockAlerts();
    assert.ok(alerts.outOfStock.some(p => p.code === 'OUT-OF-STOCK-01'));
    assert.ok(alerts.lowStock.some(p => p.code === 'LOW-STOCK-01'));
  });

  test('12. Verify full persistence across simulated restarts', async () => {
    const prod = await productsService.addProduct({
      name: 'صنف فحص بقاء الحركات',
      code: 'PERSIST-MOV-01',
      cost: 30,
      price: 60,
      stock: 5,
      low_stock_threshold: 2,
    });

    await inventoryService.adjustStock({
      product_id: prod.id,
      adjustment_type: 'ADD',
      quantity: 15,
      reason: 'فحص بقاء البيانات في التخزين الدائم',
    });

    // Check raw storage
    const rawMovements = localStorage.getItem('shop_accessories_movements_v1');
    assert.ok(rawMovements, 'Movements must be stored in persistent storage');
    const parsed = JSON.parse(rawMovements);
    assert.ok(
      parsed.some(m => m.product_code === 'PERSIST-MOV-01' && m.new_stock === 20),
      'Persisted movement must match expected transition'
    );
  });
});
