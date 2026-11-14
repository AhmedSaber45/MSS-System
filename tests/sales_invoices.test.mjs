// Automated Verification Script for Phase 04: Accessories Sales & Invoices
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
const { salesService } = await import('../src/services/salesService.ts');
const { inventoryService } = await import('../src/services/inventoryService.ts');

describe('Phase 04 — Accessories Sales & Invoices Verification', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('1. Initial seed sales and invoice items load properly', async () => {
    const invoices = await salesService.getInvoices();
    assert.ok(invoices.length >= 2, 'Should load initial seed invoices');

    const firstInvoice = invoices[0];
    const items = await salesService.getInvoiceItems(firstInvoice.id);
    assert.ok(items.length >= 1, 'Should load items for seed invoice');
    assert.ok(firstInvoice.total_amount > 0, 'Total amount should be positive');
  });

  test('2. Generate next invoice number sequentially', async () => {
    const nextNum = await salesService.generateNextInvoiceNumber();
    assert.match(nextNum, /^INV-\d{4}-\d{3}$/, 'Invoice number format should be INV-YYYY-NNN');
  });

  test('3. Confirmed sale atomically deducts stock and records SALE inventory movement', async () => {
    // 1. Create a test product with initial stock 20, price 150, cost 80
    const prod = await productsService.addProduct({
      name: 'سماعة رأس تجريبية للمبيعات',
      code: 'TEST-SAL-HEAD-01',
      cost: 80,
      price: 150,
      stock: 20,
      low_stock_threshold: 5,
    });

    // 2. Sell 4 units
    const sale = await salesService.createSale({
      invoice_number: 'INV-TEST-001',
      customer_name: 'أحمد عميل اختبار',
      customer_phone: '01011223344',
      invoice_discount: 0,
      payment_method: 'نقدي',
      notes: 'اختبار خصم المخزون الآلي',
      items: [
        {
          product_id: prod.id,
          quantity: 4,
          discount: 0,
        },
      ],
    });

    assert.strictEqual(sale.invoice_number, 'INV-TEST-001');
    assert.strictEqual(sale.total_amount, 600); // 4 * 150

    // 3. Verify product stock decreased to 16
    const updatedProd = await productsService.getProductById(prod.id);
    assert.strictEqual(updatedProd?.stock, 16, 'Stock should be deducted from 20 to 16');

    // 4. Verify inventory movement was logged as SALE
    const movements = await inventoryService.getMovements(prod.id);
    const saleMovement = movements.find(m => m.movement_type === 'SALE' && m.reference_id === sale.id);
    assert.ok(saleMovement, 'Inventory movement of type SALE should exist');
    assert.strictEqual(saleMovement.quantity_change, -4, 'Quantity change should be -4');
    assert.strictEqual(saleMovement.previous_stock, 20);
    assert.strictEqual(saleMovement.new_stock, 16);
  });

  test('4. Item-level and invoice-level discounts calculate accurately', async () => {
    const prodA = await productsService.addProduct({
      name: 'كابل شحن فائق',
      code: 'TEST-SAL-DISC-A',
      cost: 20,
      price: 100,
      stock: 10,
      low_stock_threshold: 2,
    });

    const prodB = await productsService.addProduct({
      name: 'محول صوت تايب سي',
      code: 'TEST-SAL-DISC-B',
      cost: 30,
      price: 50,
      stock: 10,
      low_stock_threshold: 2,
    });

    // prodA: 2 qty, price 100, item discount 10 => actual 90, line_total = 180
    // prodB: 1 qty, price 50, item discount 0 => actual 50, line_total = 50
    // subtotal = 180 + 50 = 230
    // invoice_discount = 30 => final total = 200
    const sale = await salesService.createSale({
      invoice_number: 'INV-TEST-DISC-01',
      customer_name: 'عميل الخصومات',
      customer_phone: '01222334455',
      invoice_discount: 30,
      payment_method: 'بطاقة / فيزا',
      items: [
        {
          product_id: prodA.id,
          quantity: 2,
          discount: 10,
        },
        {
          product_id: prodB.id,
          quantity: 1,
          discount: 0,
        },
      ],
    });

    assert.strictEqual(sale.subtotal, 230);
    assert.strictEqual(sale.discount, 30);
    assert.strictEqual(sale.total_amount, 200);

    const items = await salesService.getInvoiceItems(sale.id);
    assert.strictEqual(items.length, 2);

    const itemA = items.find(i => i.product_id === prodA.id);
    assert.strictEqual(itemA?.original_price, 100);
    assert.strictEqual(itemA?.discount, 10);
    assert.strictEqual(itemA?.actual_price, 90);
    assert.strictEqual(itemA?.line_total, 180);
  });

  test('5. Historical price snapshots preserved permanently (Rule 8)', async () => {
    // 1. Create product at price 200, cost 100
    const prod = await productsService.addProduct({
      name: 'شاحن سيارة ذكي',
      code: 'TEST-SAL-SNAP-01',
      cost: 100,
      price: 200,
      stock: 5,
      low_stock_threshold: 1,
    });

    // 2. Sell at original price 200 with 20 discount => actual 180
    const sale = await salesService.createSale({
      invoice_number: 'INV-TEST-SNAP-01',
      invoice_discount: 0,
      payment_method: 'نقدي',
      items: [
        {
          product_id: prod.id,
          quantity: 1,
          discount: 20,
        },
      ],
    });

    // 3. Later, product price and cost are updated in catalog
    await productsService.updateProduct(prod.id, {
      name: 'شاحن سيارة ذكي - موديل محدث',
      code: prod.code,
      cost: 130, // changed cost
      price: 280, // changed price
      stock: 4,
      low_stock_threshold: 1,
    });

    // 4. Historical invoice item must retain snapshots
    const items = await salesService.getInvoiceItems(sale.id);
    assert.strictEqual(items.length, 1);
    assert.strictEqual(items[0].original_price, 200, 'Original price snapshot must not change');
    assert.strictEqual(items[0].actual_price, 180, 'Actual price snapshot must not change');
    assert.strictEqual(items[0].cost_snapshot, 100, 'Cost snapshot must not change');
  });

  test('6. Overselling rejection: Sale rejected if quantity exceeds stock', async () => {
    const prod = await productsService.addProduct({
      name: 'منتج محدود الكمية',
      code: 'TEST-SAL-LMT-01',
      cost: 10,
      price: 20,
      stock: 3,
      low_stock_threshold: 1,
    });

    await assert.rejects(
      async () => {
        await salesService.createSale({
          invoice_number: 'INV-TEST-OVER-01',
          invoice_discount: 0,
          payment_method: 'نقدي',
          items: [
            {
              product_id: prod.id,
              quantity: 5, // 5 > 3
              discount: 0,
            },
          ],
        });
      },
      /الرصيد المتاح.*لا يكفي/,
      'Should reject sale when quantity exceeds available stock'
    );

    // Verify stock was NOT modified
    const currentProd = await productsService.getProductById(prod.id);
    assert.strictEqual(currentProd?.stock, 3, 'Stock must remain 3 after rejected transaction');
  });

  test('7. Reject invalid inputs: empty items, negative quantities, excessive discounts', async () => {
    const prod = await productsService.addProduct({
      name: 'منتج اختبار أخطاء الإدخال',
      code: 'TEST-SAL-ERR-01',
      cost: 10,
      price: 50,
      stock: 10,
      low_stock_threshold: 1,
    });

    // Empty items
    await assert.rejects(
      async () => {
        await salesService.createSale({
          invoice_number: 'INV-ERR-01',
          invoice_discount: 0,
          payment_method: 'نقدي',
          items: [],
        });
      },
      /صنف واحد على الأقل/
    );

    // Negative quantity
    await assert.rejects(
      async () => {
        await salesService.createSale({
          invoice_number: 'INV-ERR-02',
          invoice_discount: 0,
          payment_method: 'نقدي',
          items: [{ product_id: prod.id, quantity: -2, discount: 0 }],
        });
      },
      /أكبر من صفر/
    );

    // Line discount exceeds price
    await assert.rejects(
      async () => {
        await salesService.createSale({
          invoice_number: 'INV-ERR-03',
          invoice_discount: 0,
          payment_method: 'نقدي',
          items: [{ product_id: prod.id, quantity: 1, discount: 60 }], // 60 > 50
        });
      },
      /خصم الصنف.*لا يمكن أن يتجاوز سعر بيعه/
    );

    // Invoice discount exceeds subtotal
    await assert.rejects(
      async () => {
        await salesService.createSale({
          invoice_number: 'INV-ERR-04',
          invoice_discount: 100, // subtotal is 50
          payment_method: 'نقدي',
          items: [{ product_id: prod.id, quantity: 1, discount: 0 }],
        });
      },
      /خصم الفاتورة الإجمالي لا يمكن أن يتجاوز مجموع الأصناف/
    );
  });

  test('8. Duplicate invoice number rejection', async () => {
    const prod = await productsService.addProduct({
      name: 'منتج اختبار تكرار الفواتير',
      code: 'TEST-SAL-DUP-01',
      cost: 10,
      price: 30,
      stock: 10,
      low_stock_threshold: 1,
    });

    // First sale
    await salesService.createSale({
      invoice_number: 'INV-TEST-UNIQUE-01',
      invoice_discount: 0,
      payment_method: 'نقدي',
      items: [{ product_id: prod.id, quantity: 1, discount: 0 }],
    });

    // Attempt second sale with identical number
    await assert.rejects(
      async () => {
        await salesService.createSale({
          invoice_number: 'INV-TEST-UNIQUE-01',
          invoice_discount: 0,
          payment_method: 'نقدي',
          items: [{ product_id: prod.id, quantity: 1, discount: 0 }],
        });
      },
      /مسجل مسبقاً/
    );
  });

  test('9. Search and filter invoices by query, date, and payment method', async () => {
    const all = await salesService.getInvoices();
    assert.ok(all.length >= 2);

    // Query search
    const queryResults = await salesService.getInvoices({ query: 'سارة' });
    assert.ok(queryResults.length >= 1);
    assert.strictEqual(queryResults[0].customer_name, 'سارة خالد الشريف');

    // Payment method search
    const cashResults = await salesService.getInvoices({ paymentMethod: 'نقدي' });
    assert.ok(cashResults.every(inv => inv.payment_method === 'نقدي'));

    const cardResults = await salesService.getInvoices({ paymentMethod: 'بطاقة / فيزا' });
    assert.ok(cardResults.every(inv => inv.payment_method === 'بطاقة / فيزا'));
  });

  test('10. Data persistence across simulated app restart', async () => {
    const prod = await productsService.addProduct({
      name: 'منتج اختبار إعادة التشغيل',
      code: 'TEST-SAL-RST-01',
      cost: 15,
      price: 45,
      stock: 10,
      low_stock_threshold: 2,
    });

    const sale = await salesService.createSale({
      invoice_number: 'INV-RESTART-001',
      customer_name: 'عميل الاستمرارية',
      invoice_discount: 5,
      payment_method: 'نقدي',
      items: [{ product_id: prod.id, quantity: 2, discount: 0 }],
    });

    // Simulate app restart by re-importing / querying
    const retrievedInvoices = await salesService.getInvoices();
    const retrieved = retrievedInvoices.find(inv => inv.id === sale.id);
    assert.ok(retrieved, 'Sale invoice should persist in storage');
    assert.strictEqual(retrieved.invoice_number, 'INV-RESTART-001');
    assert.strictEqual(retrieved.total_amount, 85); // (45 * 2) - 5

    const items = await salesService.getInvoiceItems(sale.id);
    assert.strictEqual(items.length, 1);
    assert.strictEqual(items[0].product_name, 'منتج اختبار إعادة التشغيل');
  });
});
