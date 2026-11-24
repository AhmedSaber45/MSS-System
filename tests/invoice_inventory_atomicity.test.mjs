import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

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

// Import services
const { salesService } = await import('../src/services/salesService.ts');
const { productsService } = await import('../src/services/productsService.ts');
const { inventoryService } = await import('../src/services/inventoryService.ts');
const { reportsService } = await import('../src/services/reportsService.ts');

test('Invoice & Inventory Atomicity, Consistency and Zero Fake Data Verification', async (t) => {
  // Clear localStorage before starting
  globalThis.localStorage.clear();

  await t.test('1. Baseline verification: Zero fake seed invoices or payments exist', async () => {
    const invoices = await salesService.getInvoices();
    assert.strictEqual(invoices.length, 0, 'No fake seed invoices should be present in fresh state');

    const dailySummaries = await reportsService.getDailySummaries(14);
    const activeDaily = dailySummaries.filter(d => d.invoicesCount > 0 || d.refunds > 0 || d.revenue > 0);
    assert.strictEqual(activeDaily.length, 0, 'Zero days should have activity on empty baseline');
  });

  await t.test('2. Sequential invoice number generation starts cleanly for current year', async () => {
    const nextNum = await salesService.generateNextInvoiceNumber();
    const currentYear = new Date().getFullYear();
    assert.strictEqual(nextNum, `INV-${currentYear}-001`, 'First invoice must start with 001 for current year');
  });

  await t.test('3. Atomic Sale Creation: Correct totals, stock deduction, and movement logging', async () => {
    // 1. Create a test product with stock 10
    const testProduct = await productsService.addProduct({
      name: 'كابل بيانات فائق السرعة',
      code: 'CBL-FAST-01',
      category: 'كابلات',
      cost: 50,
      price: 100,
      stock: 10,
      low_stock_threshold: 2,
    });

    assert.ok(testProduct.id, 'Product created successfully');
    assert.strictEqual(testProduct.stock, 10);

    // 2. Create sale for 3 items with 10 EGP discount per item, and 20 EGP overall invoice discount
    const currentYear = new Date().getFullYear();
    const invoiceNum = `INV-${currentYear}-001`;

    const sale = await salesService.createSale({
      invoice_number: invoiceNum,
      customer_name: 'أحمد محمود',
      customer_phone: '01012345678',
      invoice_discount: 20,
      payment_method: 'نقدي',
      payment_type: 'FULL',
      items: [
        {
          item_type: 'product',
          product_id: testProduct.id,
          quantity: 3,
          discount: 10, // 100 - 10 = 90 actual price per item; line total = 270
        },
      ],
    });

    // 3. Verify invoice math
    assert.strictEqual(sale.subtotal, 270, 'Subtotal should be 3 * 90 = 270');
    assert.strictEqual(sale.discount, 20, 'Invoice discount should be 20');
    assert.strictEqual(sale.total_amount, 250, 'Final total should be 270 - 20 = 250');
    assert.strictEqual(sale.paid_amount, 250, 'Paid amount should be 250 for FULL payment');
    assert.strictEqual(sale.remaining_balance, 0, 'Remaining balance should be 0');
    assert.strictEqual(sale.payment_status, 'PAID', 'Payment status should be PAID');

    // 4. Verify product stock was deducted in database
    const updatedProd = await productsService.getProductById(testProduct.id);
    assert.strictEqual(updatedProd.stock, 7, 'Product stock must be deducted from 10 to 7');

    // 5. Verify inventory movement was logged
    const movements = await inventoryService.getMovements(testProduct.id);
    assert.ok(movements.length > 0, 'Inventory movement must be recorded');
    const saleMovement = movements.find(m => m.movement_type === 'SALE');
    assert.ok(saleMovement, 'Movement of type SALE must exist');
    assert.strictEqual(saleMovement.quantity_change, -3, 'Quantity change must be -3');
    assert.strictEqual(saleMovement.previous_stock, 10);
    assert.strictEqual(saleMovement.new_stock, 7);

    // 6. Verify invoice appears in history
    const allInvoices = await salesService.getInvoices();
    assert.strictEqual(allInvoices.length, 1, 'Invoice must appear in invoices list');
    assert.strictEqual(allInvoices[0].invoice_number, invoiceNum);
    assert.strictEqual(allInvoices[0].total_amount, 250);
    assert.strictEqual(allInvoices[0].paid_amount, 250);
    assert.strictEqual(allInvoices[0].payment_status, 'PAID');

    // 7. Verify invoice items
    const items = await salesService.getInvoiceItems(sale.id);
    assert.strictEqual(items.length, 1);
    assert.strictEqual(items[0].product_id, testProduct.id);
    assert.strictEqual(items[0].quantity, 3);
    assert.strictEqual(items[0].original_price, 100);
    assert.strictEqual(items[0].discount, 10);
    assert.strictEqual(items[0].actual_price, 90);
    assert.strictEqual(items[0].line_total, 270);
  });

  await t.test('4. Atomicity Rollback: Insufficient stock prevents sale and preserves inventory', async () => {
    // Current stock is 7. Attempt to sell 15.
    const products = await productsService.getProducts();
    const prod = products[0];
    const initialStock = prod.stock;
    assert.strictEqual(initialStock, 7);

    const currentYear = new Date().getFullYear();
    const invoiceNum = `INV-${currentYear}-002`;

    await assert.rejects(
      async () => {
        await salesService.createSale({
          invoice_number: invoiceNum,
          customer_name: 'علي حسن',
          invoice_discount: 0,
          payment_method: 'نقدي',
          payment_type: 'FULL',
          items: [
            {
              item_type: 'product',
              product_id: prod.id,
              quantity: 15, // Insufficient stock!
              discount: 0,
            },
          ],
        });
      },
      /الرصيد المتاح.*لا يكفي/
    );

    // Verify stock is untouched
    const afterFailedProd = await productsService.getProductById(prod.id);
    assert.strictEqual(afterFailedProd.stock, 7, 'Stock must remain exactly 7 after rejected sale');

    // Verify invoice was NOT added
    const allInvoices = await salesService.getInvoices();
    assert.strictEqual(allInvoices.length, 1, 'Failed invoice must not be saved');
    assert.ok(!allInvoices.some(i => i.invoice_number === invoiceNum));
  });

  await t.test('5. Deferred & Installment Sales: Correct balance tracking and payment recording', async () => {
    const products = await productsService.getProducts();
    const prod = products[0];

    const currentYear = new Date().getFullYear();
    const invoiceNum = `INV-${currentYear}-002`;

    // Sell 2 items (price 100 each = 200), initial payment 50, remaining 150
    const deferredSale = await salesService.createSale({
      invoice_number: invoiceNum,
      customer_name: 'محمود سامي',
      customer_phone: '01123456789',
      invoice_discount: 0,
      payment_method: 'نقدي',
      payment_type: 'DEFERRED',
      initial_payment: 50,
      due_date: '2026-12-01',
      installments: [
        {
          installment_number: 1,
          due_date: '2026-12-01',
          expected_amount: 150,
          notes: 'قسط نهائي',
        },
      ],
      items: [
        {
          item_type: 'product',
          product_id: prod.id,
          quantity: 2,
          discount: 0,
        },
      ],
    });

    assert.strictEqual(deferredSale.total_amount, 200);
    assert.strictEqual(deferredSale.paid_amount, 50);
    assert.strictEqual(deferredSale.remaining_balance, 150);
    assert.strictEqual(deferredSale.payment_status, 'PARTIALLY_PAID');

    // Record installment payment of 150
    const { invoice: paidInvoice, payment } = await salesService.recordPayment(deferredSale.id, {
      invoice_id: deferredSale.id,
      amount: 150,
      payment_date: '2026-12-01',
      payment_method: 'نقدي',
      notes: 'سداد القسط الأخير بالكامل',
    });

    assert.strictEqual(paidInvoice.paid_amount, 200, 'Total paid should now be 200');
    assert.strictEqual(paidInvoice.remaining_balance, 0, 'Remaining balance should now be 0');
    assert.strictEqual(paidInvoice.payment_status, 'PAID', 'Status should now be PAID');
    assert.strictEqual(payment.amount, 150);
  });

  await t.test('6. Tauri Configuration: Window launched maximized with proper options', () => {
    const tauriConfPath = path.resolve(process.cwd(), 'src-tauri', 'tauri.conf.json');
    const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, 'utf8'));

    assert.strictEqual(tauriConf.version, '1.0.9', 'Tauri config version must be 1.0.9');
    const mainWindow = tauriConf.app?.windows?.[0];
    assert.ok(mainWindow, 'Main window must be configured');
    assert.strictEqual(mainWindow.maximized, true, 'Window must have maximized: true for full screen area startup');
    assert.strictEqual(mainWindow.fullscreen, false, 'Window must have fullscreen: false to keep native controls and taskbar visible');
    assert.strictEqual(mainWindow.resizable, true, 'Window must remain resizable');
  });
});
