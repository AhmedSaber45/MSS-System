// Automated Verification Script for Phase 08: MSS Sales, Reservations & Returns
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
const { mssCommerceService } = await import('../src/services/mssCommerceService.ts');
const { mssInventoryService } = await import('../src/services/mssInventoryService.ts');
const { mssCatalogService } = await import('../src/services/mssCatalogService.ts');
const { productsService } = await import('../src/services/productsService.ts');

describe('Phase 08 — MSS Commercial Operations (Sales, Reservations & Returns) Verification', () => {
  beforeEach(() => {
    // Keep local storage clean
  });

  test('1. Complete sales workflow: records original list price, discount, actual price, and cost snapshot', async () => {
    // 1. Create a fresh available test device
    const models = await mssCatalogService.getModels();
    const model = models.find(m => m.id === 'a0000000-0000-0000-0000-000000000001') || models[0];
    const serial = 'SN-COMM-SALE-' + Date.now().toString(36).toUpperCase() + '-' + Math.floor(Math.random() * 1000);

    const device = await mssInventoryService.createDevice({
      serial_number: serial,
      model_id: model.id,
      purchase_cost: 9000,
      list_price: 12500,
      stock_location: 'محل 2',
      status: 'AVAILABLE',
      physical_condition: 'فرز أول ممتاز',
    });

    // 2. Execute sale
    const invoice = await mssCommerceService.confirmSale({
      device_id: device.id,
      selling_branch: 'محل 1',
      actual_sale_price: 12000,
      discount_amount: 500,
      customer_name: 'أحمد سعيد عبد الله',
      customer_phone: '01011223344',
      warranty_period: 'ضمان شهر كامل مع شاحن أصلي',
      notes: 'تم البيع وتجربة الجهاز بالكامل',
    });

    assert.ok(invoice.id, 'Invoice must have generated ID');
    assert.ok(invoice.invoice_number.startsWith('MSS-INV-'), 'Invoice number format must match MSS-INV-');
    assert.strictEqual(invoice.serial_number, serial);
    assert.strictEqual(invoice.selling_branch, 'محل 1');
    assert.strictEqual(invoice.source_branch, 'محل 2');
    assert.strictEqual(invoice.list_price_snapshot, 12500, 'Original list price must be permanently snapshotted');
    assert.strictEqual(invoice.cost_snapshot, 9000, 'Purchase cost snapshot must be permanently preserved');
    assert.strictEqual(invoice.discount_amount, 500);
    assert.strictEqual(invoice.actual_sale_price, 12000);
    assert.strictEqual(invoice.is_returned, false);
  });

  test('2. Gross profit calculation: accurately equals (actual_sale_price - cost_snapshot)', async () => {
    const invoices = await mssCommerceService.getInvoices();
    assert.ok(invoices.length > 0, 'Should have at least one invoice');

    for (const inv of invoices) {
      const expectedProfit = inv.actual_sale_price - inv.cost_snapshot;
      assert.strictEqual(
        inv.gross_profit,
        expectedProfit,
        `Gross profit ${inv.gross_profit} must equal actual_sale_price - cost_snapshot (${expectedProfit})`
      );
    }
  });

  test('3. Inter-branch sale attribution (Rule 9 & Section 16): Shop 1 sells device stored at Shop 2', async () => {
    const models = await mssCatalogService.getModels();
    const model = models[0];
    const serial = 'SN-CROSS-BRANCH-' + Date.now().toString(36).toUpperCase() + '-' + Math.floor(Math.random() * 1000);

    // Device stored physically at Shop 2
    const device = await mssInventoryService.createDevice({
      serial_number: serial,
      model_id: model.id,
      purchase_cost: 8000,
      list_price: 11000,
      stock_location: 'محل 2',
      status: 'AVAILABLE',
    });

    // Sale executed by Shop 1
    const invoice = await mssCommerceService.confirmSale({
      device_id: device.id,
      selling_branch: 'محل 1',
      actual_sale_price: 10800,
      customer_name: 'عميل محل 1',
    });

    // Verify dual branch recording
    assert.strictEqual(invoice.selling_branch, 'محل 1', 'Sale must be attributed to selling branch');
    assert.strictEqual(invoice.source_branch, 'محل 2', 'Stock source must reflect actual physical storage location');

    // Verify device status became SOLD
    const updatedDev = await mssInventoryService.getDeviceById(device.id);
    assert.strictEqual(updatedDev?.status, 'SOLD', 'Sold device status must become SOLD');
  });

  test('4. Overselling / double selling prevention: Rejects sale of an already sold unit', async () => {
    const devices = await mssInventoryService.getDevices();
    const soldDevice = devices.find(d => d.status === 'SOLD');
    assert.ok(soldDevice, 'Should find a sold device');

    await assert.rejects(
      async () => {
        await mssCommerceService.confirmSale({
          device_id: soldDevice.id,
          selling_branch: 'محل 1',
          actual_sale_price: 14000,
        });
      },
      /مباع مسبقاً ولا يمكن بيعه مجدداً/
    );
  });

  test('5. Input validation: Rejects negative sale price or invalid branch', async () => {
    const devices = await mssInventoryService.getDevices();
    const avail = devices.find(d => d.status === 'AVAILABLE');
    assert.ok(avail, 'Should find available device');

    // Negative price
    await assert.rejects(
      async () => {
        await mssCommerceService.confirmSale({
          device_id: avail.id,
          selling_branch: 'محل 1',
          actual_sale_price: -100,
        });
      },
      /سعر البيع الفعلي لا يمكن أن يكون سالباً/
    );

    // Invalid branch
    await assert.rejects(
      async () => {
        await mssCommerceService.confirmSale({
          device_id: avail.id,
          // @ts-ignore
          selling_branch: 'محل 99 غير موجود',
          actual_sale_price: 10000,
        });
      },
      /فرع البيع غير صالح/
    );
  });

  test('6. Reservation workflow: Creates reservation and marks device as RESERVED', async () => {
    const models = await mssCatalogService.getModels();
    const model = models[0];
    const serial = 'SN-RES-TEST-' + Date.now().toString(36).toUpperCase() + '-' + Math.floor(Math.random() * 1000);

    const device = await mssInventoryService.createDevice({
      serial_number: serial,
      model_id: model.id,
      purchase_cost: 11000,
      list_price: 15000,
      stock_location: 'محل 1',
      status: 'AVAILABLE',
    });

    const res = await mssCommerceService.createReservation({
      device_id: device.id,
      branch: 'محل 1',
      customer_name: 'طارق حسني',
      customer_phone: '01198765432',
      deposit_amount: 1500,
      agreed_price: 14700,
      expiry_date: '2026-11-25',
      notes: 'حجز مؤكد مع عربون 1500 ج.م',
    });

    assert.ok(res.id);
    assert.strictEqual(res.status, 'ACTIVE');
    assert.strictEqual(res.deposit_amount, 1500);
    assert.strictEqual(res.agreed_price, 14700);

    // Verify device became RESERVED
    const checkDev = await mssInventoryService.getDeviceById(device.id);
    assert.strictEqual(checkDev?.status, 'RESERVED');
  });

  test('7. Prevents normal online sale of a reserved unit to another customer', async () => {
    const reservations = await mssCommerceService.getReservations({ status: 'ACTIVE' });
    assert.ok(reservations.length > 0, 'Should have an active reservation');
    const res = reservations[0];

    // Attempting normal sale to another person
    await assert.rejects(
      async () => {
        await mssCommerceService.confirmSale({
          device_id: res.device_id,
          selling_branch: 'محل 2',
          actual_sale_price: 14000,
          customer_name: 'شخص غريب آخر تماماً',
        });
      },
      /الجهاز محجوز حالياً للعميل.*يجب إتمام البيع عبر الحجز أو إلغاء الحجز أولاً/
    );
  });

  test('8. Cancelling a reservation releases the device back to AVAILABLE', async () => {
    const models = await mssCatalogService.getModels();
    const model = models[0];
    const serial = 'SN-CANCEL-RES-' + Date.now().toString(36).toUpperCase() + '-' + Math.floor(Math.random() * 1000);

    const device = await mssInventoryService.createDevice({
      serial_number: serial,
      model_id: model.id,
      purchase_cost: 7000,
      list_price: 9500,
      stock_location: 'محل 2',
      status: 'AVAILABLE',
    });

    const res = await mssCommerceService.createReservation({
      device_id: device.id,
      branch: 'محل 2',
      customer_name: 'مروان خليل',
      customer_phone: '01200001111',
      deposit_amount: 500,
      agreed_price: 9200,
      expiry_date: new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0],
    });

    // Cancel the reservation
    await mssCommerceService.cancelReservation(res.id, 'عدم حضور العميل في الموعد المحدد');

    // Verify reservation status is CANCELLED
    const allRes = await mssCommerceService.getReservations();
    const targetRes = allRes.find(r => r.id === res.id);
    assert.strictEqual(targetRes?.status, 'CANCELLED');

    // Verify device is restored to AVAILABLE
    const restoredDev = await mssInventoryService.getDeviceById(device.id);
    assert.strictEqual(restoredDev?.status, 'AVAILABLE');
  });

  test('9. Sales return workflow: Reverses sale, marks invoice as returned & safely restocks device', async () => {
    // 1. Create and sell a device
    const models = await mssCatalogService.getModels();
    const model = models[0];
    const serial = 'SN-RET-FLOW-' + Date.now().toString(36).toUpperCase() + '-' + Math.floor(Math.random() * 1000);

    const device = await mssInventoryService.createDevice({
      serial_number: serial,
      model_id: model.id,
      purchase_cost: 10000,
      list_price: 13500,
      stock_location: 'محل 1',
      status: 'AVAILABLE',
    });

    const invoice = await mssCommerceService.confirmSale({
      device_id: device.id,
      selling_branch: 'محل 1',
      actual_sale_price: 13000,
      customer_name: 'كريم عبد العزيز',
    });

    assert.strictEqual(invoice.is_returned, false);

    // 2. Process return
    const returnRecord = await mssCommerceService.processReturn({
      invoice_id: invoice.id,
      refund_amount: 13000,
      return_reason: 'طلب العميل شاشة أكبر واستبدال الجهاز',
      restock_location: 'محل 2', // Returned to Shop 2
      new_condition: 'فرز أول نظيف جداً',
      new_status: 'AVAILABLE',
      notes: 'تم فحص الشاحن والبطارية بحالة سليمة تماماً',
    });

    assert.ok(returnRecord.id);
    assert.ok(returnRecord.return_number.startsWith('MSS-RET-'));
    assert.strictEqual(returnRecord.refund_amount, 13000);
    assert.strictEqual(returnRecord.restock_location, 'محل 2');

    // 3. Verify original invoice is marked returned
    const checkInv = await mssCommerceService.getInvoiceById(invoice.id);
    assert.strictEqual(checkInv?.is_returned, true);

    // 4. Verify device is restocked at Shop 2 with status AVAILABLE
    const checkDev = await mssInventoryService.getDeviceById(device.id);
    assert.strictEqual(checkDev?.status, 'AVAILABLE');
    assert.strictEqual(checkDev?.stock_location, 'محل 2');
    assert.strictEqual(checkDev?.physical_condition, 'فرز أول نظيف جداً');
  });

  test('10. Prevents duplicate return of the same invoice', async () => {
    const invoices = await mssCommerceService.getInvoices();
    const returnedInv = invoices.find(i => i.is_returned);
    assert.ok(returnedInv, 'Should find an already returned invoice');

    await assert.rejects(
      async () => {
        await mssCommerceService.processReturn({
          invoice_id: returnedInv.id,
          refund_amount: returnedInv.actual_sale_price,
          return_reason: 'محاولة إرجاع مكررة لنفس الفاتورة',
          restock_location: 'محل 1',
        });
      },
      /تم إرجاع الفاتورة.*مسبقاً.*يمنع تكرار الإرجاع/
    );
  });

  test('11. Shared business level profit: Preserves total revenue and profit across branches', async () => {
    const invoices = await mssCommerceService.getInvoices();
    const active = invoices.filter(i => !i.is_returned);

    const totalRevenue = active.reduce((acc, i) => acc + i.actual_sale_price, 0);
    const totalProfit = active.reduce((acc, i) => acc + i.gross_profit, 0);
    const totalCost = active.reduce((acc, i) => acc + i.cost_snapshot, 0);

    assert.strictEqual(
      totalProfit,
      totalRevenue - totalCost,
      'Total gross profit must equal total revenue minus total acquisition cost'
    );
  });

  test('12. Strict separation: Accessories products & invoices are completely independent (Rule 6)', async () => {
    const accProducts = await productsService.getProducts();
    const mssInvoices = await mssCommerceService.getInvoices();

    const accIds = new Set(accProducts.map(p => p.id));
    for (const inv of mssInvoices) {
      assert.strictEqual(
        accIds.has(inv.device_id),
        false,
        'MSS invoice device_id must never exist in Accessories products'
      );
    }
  });
});
