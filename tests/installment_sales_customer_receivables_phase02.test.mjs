// Comprehensive Test Suite for Phase 2: Installment Sales & Customer Receivables
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';

// Ensure localStorage mock is present in Node.js test environment
if (!global.localStorage) {
  const storage = new Map();
  global.localStorage = {
    getItem: (key) => (storage.has(key) ? storage.get(key) : null),
    setItem: (key, val) => storage.set(key, String(val)),
    removeItem: (key) => storage.delete(key),
    clear: () => storage.clear(),
  };
}

if (!global.navigator) {
  global.navigator = { onLine: true };
} else {
  Object.defineProperty(global.navigator, 'onLine', {
    value: true,
    configurable: true,
    writable: true,
  });
}

// Import services
const { salesService } = await import('../src/services/salesService.ts');
const { productsService } = await import('../src/services/productsService.ts');
const { reportsService } = await import('../src/services/reportsService.ts');
const { mssCatalogService } = await import('../src/services/mssCatalogService.ts');
const { mssInventoryService } = await import('../src/services/mssInventoryService.ts');
const { mssCommerceService } = await import('../src/services/mssCommerceService.ts');
const { mssReportsService } = await import('../src/services/mssReportsService.ts');
const { mssSyncService } = await import('../src/services/mssSyncService.ts');

describe('Phase 2: Installment Sales & Customer Receivables Suite', () => {

  // =========================================================================
  // 1. ACCESSORIES: Full-Payment Sales Invoice
  // =========================================================================
  test('1. Accessories: Full-payment sale generates paid invoice with 0 remaining balance', async () => {
    const prod = await productsService.addProduct({
      name: `شاحن سريع Phase2 Full ${Date.now()}`,
      code: `P2-CHG-${Date.now().toString().slice(-5)}`,
      cost: 100,
      price: 250,
      stock: 10,
    });

    const nextNum = await salesService.generateNextInvoiceNumber();
    const invoice = await salesService.createSale({
      invoice_number: nextNum,
      customer_name: 'أحمد علي - كاش',
      customer_phone: '01011112222',
      payment_method: 'نقدي',
      payment_type: 'FULL',
      items: [{ item_type: 'product', product_id: prod.id, quantity: 2, discount: 0 }],
    });

    assert.strictEqual(invoice.total_amount, 500);
    assert.strictEqual(invoice.payment_type, 'FULL');
    assert.strictEqual(invoice.payment_status, 'PAID');
    assert.strictEqual(invoice.paid_amount, 500);
    assert.strictEqual(invoice.remaining_balance, 0);

    const payments = await salesService.getPayments(invoice.id);
    assert.strictEqual(payments.length, 1);
    assert.strictEqual(payments[0].amount, 500);
    assert.strictEqual(payments[0].payment_method, 'نقدي');
  });

  // =========================================================================
  // 2. ACCESSORIES: Deferred Invoice with Initial Payment & Schedule
  // =========================================================================
  test('2. Accessories: Deferred sale records initial payment, remaining balance, and schedule', async () => {
    const prod = await productsService.addProduct({
      name: `سماعة رأس فاخرة Phase2 ${Date.now()}`,
      code: `P2-HPH-${Date.now().toString().slice(-5)}`,
      cost: 400,
      price: 1200,
      stock: 5,
    });

    const nextNum = await salesService.generateNextInvoiceNumber();
    const futureDate = '2026-12-15';
    const invoice = await salesService.createSale({
      invoice_number: nextNum,
      customer_name: 'محمود حسن - أقساط',
      customer_phone: '01033334444',
      payment_method: 'نقدي',
      payment_type: 'DEFERRED',
      initial_payment: 400,
      due_date: futureDate,
      installments: [
        { installment_number: 1, expected_amount: 400, due_date: '2026-12-15', notes: 'قسط 1' },
        { installment_number: 2, expected_amount: 400, due_date: '2027-01-15', notes: 'قسط 2' },
      ],
      items: [{ item_type: 'product', product_id: prod.id, quantity: 1, discount: 0 }],
    });

    assert.strictEqual(invoice.total_amount, 1200);
    assert.strictEqual(invoice.payment_type, 'DEFERRED');
    assert.strictEqual(invoice.payment_status, 'PARTIALLY_PAID');
    assert.strictEqual(invoice.paid_amount, 400);
    assert.strictEqual(invoice.remaining_balance, 800);
    assert.strictEqual(invoice.due_date, futureDate);

    // Verify payment history has the initial payment
    const payments = await salesService.getPayments(invoice.id);
    assert.strictEqual(payments.length, 1);
    assert.strictEqual(payments[0].amount, 400);
    assert.ok(payments[0].notes.includes('دفعة'));

    // Verify schedule items
    const schedule = await salesService.getInstallmentSchedule(invoice.id);
    assert.strictEqual(schedule.length, 2);
    assert.strictEqual(schedule[0].expected_amount, 400);
    assert.strictEqual(schedule[1].expected_amount, 400);
  });

  // =========================================================================
  // 3. ACCESSORIES: Deferred Invoice with Zero Initial Payment
  // =========================================================================
  test('3. Accessories: Zero initial payment creates UNPAID invoice with full remaining balance', async () => {
    const prod = await productsService.addProduct({
      name: `باور بنك Phase2 ${Date.now()}`,
      code: `P2-PBK-${Date.now().toString().slice(-5)}`,
      cost: 200,
      price: 600,
      stock: 5,
    });

    const nextNum = await salesService.generateNextInvoiceNumber();
    const invoice = await salesService.createSale({
      invoice_number: nextNum,
      customer_name: 'سامح كامل - بدون مقدم',
      customer_phone: '01055556666',
      payment_type: 'DEFERRED',
      initial_payment: 0,
      due_date: '2026-12-01',
      items: [{ item_type: 'product', product_id: prod.id, quantity: 1, discount: 0 }],
    });

    assert.strictEqual(invoice.total_amount, 600);
    assert.strictEqual(invoice.paid_amount, 0);
    assert.strictEqual(invoice.remaining_balance, 600);
    assert.strictEqual(invoice.payment_status, 'UNPAID');

    // No payments recorded initially
    const payments = await salesService.getPayments(invoice.id);
    assert.strictEqual(payments.length, 0);
  });

  // =========================================================================
  // 4. ACCESSORIES: Multiple Partial Payments & Settlement
  // =========================================================================
  test('4. Accessories: Sequential partial payments recalculate remaining balance to full settlement', async () => {
    const prod = await productsService.addProduct({
      name: `ساعة ذكية Phase2 ${Date.now()}`,
      code: `P2-WCH-${Date.now().toString().slice(-5)}`,
      cost: 500,
      price: 1500,
      stock: 5,
    });

    const nextNum = await salesService.generateNextInvoiceNumber();
    const invoice = await salesService.createSale({
      invoice_number: nextNum,
      customer_name: 'ياسر ممدوح',
      customer_phone: '01077778888',
      payment_type: 'DEFERRED',
      initial_payment: 500,
      items: [{ item_type: 'product', product_id: prod.id, quantity: 1, discount: 0 }],
    });

    assert.strictEqual(invoice.remaining_balance, 1000);

    // Pay 400 EGP (partial)
    const step1 = await salesService.recordPayment(invoice.id, {
      amount: 400,
      payment_date: '2026-11-25',
      payment_method: 'نقدي',
      notes: 'سداد دفعة أولى',
    });
    assert.strictEqual(step1.invoice.paid_amount, 900);
    assert.strictEqual(step1.invoice.remaining_balance, 600);
    assert.strictEqual(step1.invoice.payment_status, 'PARTIALLY_PAID');

    // Pay remaining 600 EGP (settlement)
    const step2 = await salesService.recordPayment(invoice.id, {
      amount: 600,
      payment_date: '2026-12-05',
      payment_method: 'فيزا',
      notes: 'تسوية كامل الرصيد المتبقي',
    });
    assert.strictEqual(step2.invoice.paid_amount, 1500);
    assert.strictEqual(step2.invoice.remaining_balance, 0);
    assert.strictEqual(step2.invoice.payment_status, 'PAID');

    const allPayments = await salesService.getPayments(invoice.id);
    assert.strictEqual(allPayments.length, 3); // initial (500) + pay1 (400) + pay2 (600)
  });

  // =========================================================================
  // 5. ACCESSORIES: Financial Integrity & Overpayment Rejection
  // =========================================================================
  test('5. Accessories: Financial integrity rejects overpayment, negative, or zero payment', async () => {
    const prod = await productsService.addProduct({
      name: `جراب وميدالية Phase2 ${Date.now()}`,
      code: `P2-CASE-${Date.now().toString().slice(-5)}`,
      cost: 30,
      price: 100,
      stock: 10,
    });

    const nextNum = await salesService.generateNextInvoiceNumber();
    const invoice = await salesService.createSale({
      invoice_number: nextNum,
      customer_name: 'طارق عبد الله',
      payment_type: 'DEFERRED',
      initial_payment: 30,
      items: [{ item_type: 'product', product_id: prod.id, quantity: 1, discount: 0 }],
    });

    assert.strictEqual(invoice.remaining_balance, 70);

    // Reject > remaining balance
    await assert.rejects(
      async () => {
        await salesService.recordPayment(invoice.id, {
          amount: 80,
          payment_date: '2026-11-20',
          payment_method: 'نقدي',
        });
      },
      /لا يمكن أن تتجاوز الرصيد المتبقي/
    );

    // Reject <= 0
    await assert.rejects(
      async () => {
        await salesService.recordPayment(invoice.id, {
          amount: 0,
          payment_date: '2026-11-20',
          payment_method: 'نقدي',
        });
      },
      /أكبر من صفر/
    );

    await assert.rejects(
      async () => {
        await salesService.recordPayment(invoice.id, {
          amount: -50,
          payment_date: '2026-11-20',
          payment_method: 'نقدي',
        });
      },
      /أكبر من صفر/
    );

    // Reject initial payment > invoice total
    await assert.rejects(
      async () => {
        const nextNum2 = await salesService.generateNextInvoiceNumber();
        await salesService.createSale({
          invoice_number: nextNum2,
          payment_type: 'DEFERRED',
          initial_payment: 200,
          items: [{ item_type: 'product', product_id: prod.id, quantity: 1, discount: 0 }],
        });
      },
      /لا يمكن أن تتجاوز إجمالي الفاتورة/
    );
  });

  // =========================================================================
  // 6. ACCESSORIES: Safe Correction / Reversal Workflow
  // =========================================================================
  test('6. Accessories: Reversal preserves ledger history with append-only negative transaction', async () => {
    const prod = await productsService.addProduct({
      name: `شاشة حماية Phase2 ${Date.now()}`,
      code: `P2-SCR-${Date.now().toString().slice(-5)}`,
      cost: 40,
      price: 150,
      stock: 10,
    });

    const nextNum = await salesService.generateNextInvoiceNumber();
    const invoice = await salesService.createSale({
      invoice_number: nextNum,
      customer_name: 'كريم هاني',
      payment_type: 'DEFERRED',
      initial_payment: 50,
      items: [{ item_type: 'product', product_id: prod.id, quantity: 1, discount: 0 }],
    });

    // Customer makes payment of 50 EGP
    const { payment } = await salesService.recordPayment(invoice.id, {
      amount: 50,
      payment_date: '2026-11-20',
      payment_method: 'نقدي',
      notes: 'دفعة نقدية سريعة',
    });

    const invAfterPayment = (await salesService.getInvoices({})).find(i => i.id === invoice.id);
    assert.strictEqual(invAfterPayment.paid_amount, 100);
    assert.strictEqual(invAfterPayment.remaining_balance, 50);

    // Reversal of the payment (e.g., entered by mistake)
    const { reversalPayment, invoice: invAfterReversal } = await salesService.reversePayment(
      payment.id,
      'تسجيل خاطئ لمبلغ الدفعة'
    );

    assert.strictEqual(reversalPayment.is_reversal, true);
    assert.strictEqual(reversalPayment.amount, -50);
    assert.strictEqual(reversalPayment.reversal_of_id, payment.id);
    assert.strictEqual(reversalPayment.reversal_reason, 'تسجيل خاطئ لمبلغ الدفعة');

    // Balance restored
    assert.strictEqual(invAfterReversal.paid_amount, 50);
    assert.strictEqual(invAfterReversal.remaining_balance, 100);
    assert.strictEqual(invAfterReversal.payment_status, 'PARTIALLY_PAID');

    // Check payment history has all transactions: initial (50), payment (50), reversal (-50)
    const payments = await salesService.getPayments(invoice.id);
    assert.strictEqual(payments.length, 3);
  });

  // =========================================================================
  // 7. ACCESSORIES: Editing Future Installment Schedule
  // =========================================================================
  test('7. Accessories: Editing schedule updates installments without touching payment records', async () => {
    const prod = await productsService.addProduct({
      name: `ماوس لاسلكي Phase2 ${Date.now()}`,
      code: `P2-MSE-${Date.now().toString().slice(-5)}`,
      cost: 80,
      price: 300,
      stock: 10,
    });

    const nextNum = await salesService.generateNextInvoiceNumber();
    const invoice = await salesService.createSale({
      invoice_number: nextNum,
      customer_name: 'عادل إمام',
      payment_type: 'DEFERRED',
      initial_payment: 100,
      due_date: '2026-12-01',
      installments: [
        { installment_number: 1, expected_amount: 100, due_date: '2026-12-01' },
        { installment_number: 2, expected_amount: 100, due_date: '2027-01-01' },
      ],
      items: [{ item_type: 'product', product_id: prod.id, quantity: 1, discount: 0 }],
    });

    const paymentsBefore = await salesService.getPayments(invoice.id);
    assert.strictEqual(paymentsBefore.length, 1);

    // Restructure schedule to 4 smaller installments of 50 EGP each
    const newSchedule = [
      { installment_number: 1, expected_amount: 50, due_date: '2026-12-01', notes: 'تعديل 1' },
      { installment_number: 2, expected_amount: 50, due_date: '2026-12-15', notes: 'تعديل 2' },
      { installment_number: 3, expected_amount: 50, due_date: '2027-01-01', notes: 'تعديل 3' },
      { installment_number: 4, expected_amount: 50, due_date: '2027-01-15', notes: 'تعديل 4' },
    ];
    await salesService.updateInstallmentSchedule(invoice.id, newSchedule);

    const updatedSchedule = await salesService.getInstallmentSchedule(invoice.id);
    assert.strictEqual(updatedSchedule.length, 4);
    assert.strictEqual(updatedSchedule[0].expected_amount, 50);

    // Verify payment history remained completely intact!
    const paymentsAfter = await salesService.getPayments(invoice.id);
    assert.strictEqual(paymentsAfter.length, 1);
    assert.strictEqual(paymentsAfter[0].amount, 100);
  });

  // =========================================================================
  // 8. ACCESSORIES: Overdue Status Detection & Receivables Summary
  // =========================================================================
  test('8. Accessories: Overdue detection when due_date < today, and receivables report accuracy', async () => {
    const prod = await productsService.addProduct({
      name: `كابل شاحن متأخر Phase2 ${Date.now()}`,
      code: `P2-OVD-${Date.now().toString().slice(-5)}`,
      cost: 50,
      price: 200,
      stock: 10,
    });

    const nextNum = await salesService.generateNextInvoiceNumber();
    // Due date in 2024 (strictly in past)
    const overdueInv = await salesService.createSale({
      invoice_number: nextNum,
      customer_name: 'عميل متأخر السداد',
      customer_phone: '01099990000',
      payment_type: 'DEFERRED',
      initial_payment: 50,
      due_date: '2024-01-01',
      items: [{ item_type: 'product', product_id: prod.id, quantity: 1, discount: 0 }],
    });

    assert.strictEqual(overdueInv.payment_status, 'OVERDUE');
    assert.strictEqual(overdueInv.remaining_balance, 150);

    // Check receivables report
    const report = await reportsService.getReceivablesReport();
    assert.ok(report.totalReceivables >= 150);
    assert.ok(report.overdueCount >= 1);

    const debtor = report.debtors.find(d => d.invoiceId === overdueInv.id);
    assert.ok(debtor, 'Overdue debtor must be included in receivables report');
    assert.strictEqual(debtor.remainingBalance, 150);
    assert.strictEqual(debtor.isOverdue, true);
    assert.strictEqual(debtor.paymentStatus, 'OVERDUE');
  });

  // =========================================================================
  // 9. COMPU MSS: Full-Payment Device Sale
  // =========================================================================
  test('9. Compu MSS: Full-payment device sale records paid status and zero balance', async () => {
    const model = await mssCatalogService.createModel({
      brand: 'Dell',
      model_name: `Latitude P2 Full ${Date.now()}`,
      category: 'BUSINESS',
      processor: 'Intel Core i5-1145G7',
      ram: '16GB',
      storage: '512GB NVMe',
      gpu: 'Intel Iris Xe',
      screen_size: '14.0"',
    });

    const dev = await mssInventoryService.createDevice({
      model_id: model.id,
      serial_number: `DL-P2-F-${Date.now()}`,
      purchase_cost: 12000,
      list_price: 16000,
      stock_location: 'محل 1',
    });

    const invoice = await mssCommerceService.confirmSale({
      device_id: dev.id,
      selling_branch: 'محل 1',
      actual_sale_price: 15500,
      discount_amount: 500,
      customer_name: 'شريف النجار - كاش',
      payment_type: 'FULL',
    });

    assert.strictEqual(invoice.actual_sale_price, 15500);
    assert.strictEqual(invoice.payment_type, 'FULL');
    assert.strictEqual(invoice.payment_status, 'PAID');
    assert.strictEqual(invoice.paid_amount, 15500);
    assert.strictEqual(invoice.remaining_balance, 0);

    const payments = await mssCommerceService.getPayments(invoice.id);
    assert.strictEqual(payments.length, 1);
    assert.strictEqual(payments[0].amount, 15500);
  });

  // =========================================================================
  // 10. COMPU MSS: Deferred Device Sale with Initial Payment & Schedule
  // =========================================================================
  test('10. Compu MSS: Deferred laptop sale records initial payment, remaining balance, and schedule', async () => {
    const model = await mssCatalogService.createModel({
      brand: 'Lenovo',
      model_name: `ThinkPad P2 Def ${Date.now()}`,
      category: 'BUSINESS',
      processor: 'AMD Ryzen 7 PRO',
      ram: '32GB',
      storage: '1TB NVMe',
      gpu: 'AMD Radeon Graphics',
      screen_size: '15.6"',
    });

    const dev = await mssInventoryService.createDevice({
      model_id: model.id,
      serial_number: `LN-P2-D-${Date.now()}`,
      purchase_cost: 20000,
      list_price: 27000,
      stock_location: 'محل 1',
    });

    const invoice = await mssCommerceService.confirmSale({
      device_id: dev.id,
      selling_branch: 'محل 1',
      actual_sale_price: 26000,
      discount_amount: 1000,
      customer_name: 'م. حازم إبراهيم - تقسيط',
      customer_phone: '01066667777',
      payment_type: 'DEFERRED',
      initial_payment: 10000,
      due_date: '2026-12-20',
      installments: [
        { installment_number: 1, expected_amount: 8000, due_date: '2026-12-20', notes: 'قسط 1' },
        { installment_number: 2, expected_amount: 8000, due_date: '2027-01-20', notes: 'قسط 2' },
      ],
    });

    assert.strictEqual(invoice.actual_sale_price, 26000);
    assert.strictEqual(invoice.payment_type, 'DEFERRED');
    assert.strictEqual(invoice.paid_amount, 10000);
    assert.strictEqual(invoice.remaining_balance, 16000);
    assert.strictEqual(invoice.payment_status, 'PARTIALLY_PAID');

    const payments = await mssCommerceService.getPayments(invoice.id);
    assert.strictEqual(payments.length, 1);
    assert.strictEqual(payments[0].amount, 10000);

    const schedule = await mssCommerceService.getInstallmentSchedule(invoice.id);
    assert.strictEqual(schedule.length, 2);
    assert.strictEqual(schedule[0].expected_amount, 8000);
    assert.strictEqual(schedule[1].expected_amount, 8000);
  });

  // =========================================================================
  // 11. COMPU MSS: Sequential Payments, Settlement & Overpayment Protection
  // =========================================================================
  test('11. Compu MSS: Sequential collections, balance settlement, and overpayment guard', async () => {
    const model = await mssCatalogService.createModel({
      brand: 'HP',
      model_name: `EliteBook P2 Pay ${Date.now()}`,
      category: 'BUSINESS',
      processor: 'Intel Core i7-1265U',
      ram: '16GB',
      storage: '512GB NVMe',
      gpu: 'Intel Iris Xe',
      screen_size: '14.0"',
    });

    const dev = await mssInventoryService.createDevice({
      model_id: model.id,
      serial_number: `HP-P2-P-${Date.now()}`,
      purchase_cost: 15000,
      list_price: 21000,
      stock_location: 'محل 2',
    });

    const invoice = await mssCommerceService.confirmSale({
      device_id: dev.id,
      selling_branch: 'محل 2',
      actual_sale_price: 20000,
      payment_type: 'DEFERRED',
      initial_payment: 5000,
      due_date: '2026-12-10',
    });

    assert.strictEqual(invoice.remaining_balance, 15000);

    // Attempt overpayment
    await assert.rejects(
      async () => {
        await mssCommerceService.recordPayment(invoice.id, {
          amount: 16000,
          payment_date: '2026-11-20',
          payment_method: 'تحويل بنكي',
        });
      },
      /لا يمكن أن تتجاوز الرصيد المتبقي/
    );

    // Valid partial payment 7,000 EGP
    const step1 = await mssCommerceService.recordPayment(invoice.id, {
      amount: 7000,
      payment_date: '2026-11-25',
      payment_method: 'تحويل بنكي',
      notes: 'تحويل بنكي قسط 1',
    });
    assert.strictEqual(step1.invoice.paid_amount, 12000);
    assert.strictEqual(step1.invoice.remaining_balance, 8000);
    assert.strictEqual(step1.invoice.payment_status, 'PARTIALLY_PAID');

    // Pay remaining 8,000 EGP (Full settlement)
    const step2 = await mssCommerceService.recordPayment(invoice.id, {
      amount: 8000,
      payment_date: '2026-12-05',
      payment_method: 'نقدي',
      notes: 'سداد نقدي للرصيد المتبقي كاملاً',
    });
    assert.strictEqual(step2.invoice.paid_amount, 20000);
    assert.strictEqual(step2.invoice.remaining_balance, 0);
    assert.strictEqual(step2.invoice.payment_status, 'PAID');
  });

  // =========================================================================
  // 12. COMPU MSS: Safe Reversal / Correction Workflow
  // =========================================================================
  test('12. Compu MSS: Safe reversal records audit reversal row and restores invoice balance', async () => {
    const model = await mssCatalogService.createModel({
      brand: 'Apple',
      model_name: `MacBook Pro P2 Rev ${Date.now()}`,
      category: 'WORKSTATION',
      processor: 'Apple M2 Pro',
      ram: '16GB',
      storage: '512GB SSD',
      gpu: '16-core GPU',
      screen_size: '14.2"',
    });

    const dev = await mssInventoryService.createDevice({
      model_id: model.id,
      serial_number: `AP-P2-R-${Date.now()}`,
      purchase_cost: 35000,
      list_price: 45000,
      stock_location: 'محل 1',
    });

    const invoice = await mssCommerceService.confirmSale({
      device_id: dev.id,
      selling_branch: 'محل 1',
      actual_sale_price: 44000,
      payment_type: 'DEFERRED',
      initial_payment: 20000,
    });

    const { payment } = await mssCommerceService.recordPayment(invoice.id, {
      amount: 10000,
      payment_date: '2026-11-20',
      payment_method: 'تحويل بنكي',
    });

    // Reversal
    const { reversalPayment, invoice: invAfterReversal } = await mssCommerceService.reversePayment(
      payment.id,
      'تم إلغاء التحويل البنكي لعدم اكتماله'
    );

    assert.strictEqual(reversalPayment.is_reversal, true);
    assert.strictEqual(reversalPayment.amount, -10000);
    assert.strictEqual(reversalPayment.reversal_of_id, payment.id);

    assert.strictEqual(invAfterReversal.paid_amount, 20000);
    assert.strictEqual(invAfterReversal.remaining_balance, 24000);
    assert.strictEqual(invAfterReversal.payment_status, 'PARTIALLY_PAID');
  });

  // =========================================================================
  // 13. COMPU MSS: Outbox Synchronization Verification
  // =========================================================================
  test('13. Compu MSS: Sync Outbox properly enqueues PAYMENT_RECORD, PAYMENT_REVERSE, and INSTALLMENT_SCHEDULE_UPDATE', async () => {
    const model = await mssCatalogService.createModel({
      brand: 'Dell',
      model_name: `XPS 13 P2 Sync ${Date.now()}`,
      category: 'BUSINESS',
      processor: 'Intel Core i7-1360P',
      ram: '16GB',
      storage: '1TB NVMe',
      gpu: 'Intel Iris Xe',
      screen_size: '13.4"',
    });

    const dev = await mssInventoryService.createDevice({
      model_id: model.id,
      serial_number: `DL-P2-S-${Date.now()}`,
      purchase_cost: 25000,
      list_price: 32000,
      stock_location: 'محل 1',
    });

    const invoice = await mssCommerceService.confirmSale({
      device_id: dev.id,
      selling_branch: 'محل 1',
      actual_sale_price: 30000,
      payment_type: 'DEFERRED',
      initial_payment: 10000,
    });

    // Record payment
    const { payment } = await mssCommerceService.recordPayment(invoice.id, {
      amount: 5000,
      payment_date: '2026-11-20',
      payment_method: 'نقدي',
    });

    // Reverse payment
    await mssCommerceService.reversePayment(payment.id, 'تصحيح محاسبي');

    // Update schedule
    await mssCommerceService.updateInstallmentSchedule(invoice.id, [
      { installment_number: 1, expected_amount: 10000, due_date: '2026-12-15' },
      { installment_number: 2, expected_amount: 10000, due_date: '2027-01-15' },
    ]);

    // Check Outbox
    const allOps = await mssSyncService.getOutbox();
    const hasRecordOp = allOps.some(o => o.type === 'PAYMENT_RECORD');
    const hasReverseOp = allOps.some(o => o.type === 'PAYMENT_REVERSE');
    const hasScheduleOp = allOps.some(o => o.type === 'INSTALLMENT_SCHEDULE_UPDATE');

    assert.ok(hasRecordOp, 'Sync outbox must contain PAYMENT_RECORD operation');
    assert.ok(hasReverseOp, 'Sync outbox must contain PAYMENT_REVERSE operation');
    assert.ok(hasScheduleOp, 'Sync outbox must contain INSTALLMENT_SCHEDULE_UPDATE operation');
  });

  // =========================================================================
  // 14. COMPU MSS: Receivables Report & Overdue Detection
  // =========================================================================
  test('14. Compu MSS: Receivables report calculates outstanding debt and debtors accurately', async () => {
    const model = await mssCatalogService.createModel({
      brand: 'Asus',
      model_name: `ZenBook P2 Rec ${Date.now()}`,
      category: 'ULTRABOOK',
      processor: 'Intel Core i7-1260P',
      ram: '16GB',
      storage: '512GB NVMe',
      gpu: 'Intel Iris Xe',
      screen_size: '14.0"',
    });

    const dev = await mssInventoryService.createDevice({
      model_id: model.id,
      serial_number: `AS-P2-RC-${Date.now()}`,
      purchase_cost: 18000,
      list_price: 24000,
      stock_location: 'محل 2',
    });

    const overdueInv = await mssCommerceService.confirmSale({
      device_id: dev.id,
      selling_branch: 'محل 2',
      actual_sale_price: 22000,
      payment_type: 'DEFERRED',
      initial_payment: 7000,
      due_date: '2024-05-01', // Strictly in past
      customer_name: 'طارق الدسوقي - متأخر',
      customer_phone: '01088889999',
    });

    assert.strictEqual(overdueInv.payment_status, 'OVERDUE');
    assert.strictEqual(overdueInv.remaining_balance, 15000);

    const report = await mssReportsService.getMSSReceivablesReport();
    assert.ok(report.totalReceivables >= 15000);
    assert.ok(report.overdueCount >= 1);

    const debtor = report.debtors.find(d => d.invoiceId === overdueInv.id);
    assert.ok(debtor, 'MSS debtor must appear in receivables report');
    assert.strictEqual(debtor.remainingBalance, 15000);
    assert.strictEqual(debtor.isOverdue, true);
    assert.strictEqual(debtor.paymentStatus, 'OVERDUE');
  });

  // =========================================================================
  // 15. STRICT SEPARATION: Accessories vs Compu MSS
  // =========================================================================
  test('15. Strict Separation: Accessories and Compu MSS financial records and receivables do not mix', async () => {
    const accInvoices = await salesService.getInvoices({});
    const mssInvoices = await mssCommerceService.getInvoices({});

    // Verify invoice ID sets are mutually exclusive
    const accIds = new Set(accInvoices.map(i => i.id));
    const mssIds = new Set(mssInvoices.map(i => i.id));

    for (const id of accIds) {
      assert.strictEqual(mssIds.has(id), false, `Accessories invoice ${id} must never exist in MSS`);
    }

    // Verify payments are strictly partitioned
    for (const inv of accInvoices.slice(0, 5)) {
      const mssPaymentsForAccInv = await mssCommerceService.getPayments(inv.id);
      assert.strictEqual(mssPaymentsForAccInv.length, 0, 'MSS must not return payments for Accessories invoice');
    }

    for (const inv of mssInvoices.slice(0, 5)) {
      const accPaymentsForMssInv = await salesService.getPayments(inv.id);
      assert.strictEqual(accPaymentsForMssInv.length, 0, 'Accessories must not return payments for MSS invoice');
    }

    // Verify reports are partitioned
    const accRecReport = await reportsService.getReceivablesReport();
    const mssRecReport = await mssReportsService.getMSSReceivablesReport();

    const accDebtorIds = new Set(accRecReport.debtors.map(d => d.invoiceId));
    const mssDebtorIds = new Set(mssRecReport.debtors.map(d => d.invoiceId));

    for (const id of accDebtorIds) {
      assert.strictEqual(mssDebtorIds.has(id), false, `Debtor ${id} must not cross from Accessories to MSS`);
    }
  });

});
