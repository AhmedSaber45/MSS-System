// Comprehensive Automated Test Suite for:
// Compu MSS — Multi-Select Devices & Bulk Quantity Support
//
// 1. Selecting one serialized device.
// 2. Selecting multiple serialized devices.
// 3. Selecting one bulk model with a quantity of 10.
// 4. Selecting multiple bulk models with different quantities.
// 5. Combining serialized devices and bulk quantities in one sales invoice.
// 6. Repeating all scenarios in Reservations.
// 7. Rejecting zero, negative, decimal, and invalid quantities.
// 8. Rejecting quantities exceeding available stock.
// 9. Removing one selected item without affecting others.
// 10. Duplicate device selection and double counting prevention.

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';

// Mock localStorage for Node.js test runner
if (!global.localStorage) {
  const storage = new Map();
  global.localStorage = {
    getItem: (key) => storage.get(key) || null,
    setItem: (key, val) => storage.set(key, String(val)),
    removeItem: (key) => storage.delete(key),
    clear: () => storage.clear(),
  };
}

// Import Compu MSS services
const { mssCommerceService } = await import('../src/services/mssCommerceService.ts');
const { mssInventoryService } = await import('../src/services/mssInventoryService.ts');
const { mssCatalogService } = await import('../src/services/mssCatalogService.ts');

describe('Compu MSS — Multi-Select Devices & Bulk Quantity Support', () => {
  let modelA, modelB, modelC, modelD;

  beforeEach(async () => {
    const models = await mssCatalogService.getModels();
    modelA = models[0] || (await mssCatalogService.createModel({
      brand: 'Dell',
      model_name: 'Latitude 7420',
      category: 'Laptop',
      processor: 'Core i7-1185G7',
      ram: '16GB',
      storage: '512GB SSD',
    }));

    modelB = models[1] || (await mssCatalogService.createModel({
      brand: 'Lenovo',
      model_name: 'ThinkPad T14 Gen 2',
      category: 'Laptop',
      processor: 'Ryzen 7 Pro 5850U',
      ram: '16GB',
      storage: '512GB SSD',
    }));

    modelC = models[2] || (await mssCatalogService.createModel({
      brand: 'HP',
      model_name: 'EliteBook 840 G8',
      category: 'Laptop',
      processor: 'Core i5-1145G7',
      ram: '8GB',
      storage: '256GB SSD',
    }));

    modelD = models[3] || (await mssCatalogService.createModel({
      brand: 'Apple',
      model_name: 'MacBook Air M2',
      category: 'Laptop',
      processor: 'M2 8-core',
      ram: '16GB',
      storage: '512GB SSD',
    }));
  });

  // ==========================================================================
  // SCENARIO 1: Selecting one serialized device
  // ==========================================================================
  test('Scenario 1: Selecting one serialized device records exact identity, serial and 1 unit', async () => {
    const serial = 'SN-S1-' + Date.now().toString(36).toUpperCase();
    const dev = await mssInventoryService.createDevice({
      serial_number: serial,
      model_id: modelA.id,
      purchase_cost: 10000,
      list_price: 13000,
      stock_location: 'محل 1',
      status: 'AVAILABLE',
      is_serialized: true,
      quantity: 1,
    });

    const invoice = await mssCommerceService.confirmSale({
      selling_branch: 'محل 1',
      customer_name: 'عميل فردي 1',
      items: [
        {
          device_id: dev.id,
          unit_price: 13000,
          discount_amount: 500,
          actual_sale_price: 12500,
          quantity: 1,
          source_branch: 'محل 1',
        },
      ],
    });

    assert.ok(invoice.id);
    assert.strictEqual(invoice.items.length, 1);
    assert.strictEqual(invoice.items[0].serial_number, serial);
    assert.strictEqual(invoice.items[0].quantity, 1);
    assert.strictEqual(invoice.items[0].actual_sale_price, 12500);

    const refreshed = await mssInventoryService.getDeviceById(dev.id);
    assert.strictEqual(refreshed.status, 'SOLD');
  });

  // ==========================================================================
  // SCENARIO 2: Selecting multiple serialized devices
  // ==========================================================================
  test('Scenario 2: Selecting multiple serialized devices in one sale preserves distinct identities', async () => {
    const s1 = 'SN-S2-A-' + Date.now().toString(36).toUpperCase();
    const s2 = 'SN-S2-B-' + Date.now().toString(36).toUpperCase();
    const s3 = 'SN-S2-C-' + Date.now().toString(36).toUpperCase();

    const d1 = await mssInventoryService.createDevice({
      serial_number: s1,
      model_id: modelA.id,
      purchase_cost: 9000,
      list_price: 12000,
      stock_location: 'محل 1',
      status: 'AVAILABLE',
      is_serialized: true,
      quantity: 1,
    });
    const d2 = await mssInventoryService.createDevice({
      serial_number: s2,
      model_id: modelA.id,
      purchase_cost: 9200,
      list_price: 12500,
      stock_location: 'محل 1',
      status: 'AVAILABLE',
      is_serialized: true,
      quantity: 1,
    });
    const d3 = await mssInventoryService.createDevice({
      serial_number: s3,
      model_id: modelB.id,
      purchase_cost: 11000,
      list_price: 15000,
      stock_location: 'محل 2',
      status: 'AVAILABLE',
      is_serialized: true,
      quantity: 1,
    });

    const invoice = await mssCommerceService.confirmSale({
      selling_branch: 'محل 1',
      customer_name: 'عميل أجهزة متعددة',
      items: [
        { device_id: d1.id, unit_price: 12000, actual_sale_price: 12000, quantity: 1, source_branch: 'محل 1' },
        { device_id: d2.id, unit_price: 12500, actual_sale_price: 12000, discount_amount: 500, quantity: 1, source_branch: 'محل 1' },
        { device_id: d3.id, unit_price: 15000, actual_sale_price: 14500, discount_amount: 500, quantity: 1, source_branch: 'محل 2' },
      ],
    });

    assert.strictEqual(invoice.items.length, 3);
    assert.strictEqual(invoice.items_count, 3);
    const invoiceSerials = invoice.items.map(it => it.serial_number);
    assert.ok(invoiceSerials.includes(s1));
    assert.ok(invoiceSerials.includes(s2));
    assert.ok(invoiceSerials.includes(s3));
    assert.strictEqual(invoice.actual_sale_price, 38500); // 12000 + 12000 + 14500
  });

  // ==========================================================================
  // SCENARIO 3: Selecting one bulk model with a quantity of 10
  // ==========================================================================
  test('Scenario 3: Selecting one bulk model with a quantity of 10 updates remaining stock correctly', async () => {
    const bulkDev = await mssInventoryService.createDevice({
      serial_number: null,
      is_serialized: false,
      model_id: modelB.id,
      purchase_cost: 7000,
      list_price: 9500,
      stock_location: 'محل 1',
      status: 'AVAILABLE',
      quantity: 25,
    });

    const invoice = await mssCommerceService.confirmSale({
      selling_branch: 'محل 1',
      customer_name: 'شركة التقنية (10 وحدات)',
      items: [
        {
          device_id: bulkDev.id,
          quantity: 10,
          unit_price: 9000,
          actual_sale_price: 90000,
          source_branch: 'محل 1',
        },
      ],
    });

    assert.strictEqual(invoice.items.length, 1);
    assert.strictEqual(invoice.items[0].quantity, 10);
    assert.strictEqual(invoice.items[0].actual_sale_price, 90000);
    assert.strictEqual(invoice.items[0].serial_number, null);

    const refreshed = await mssInventoryService.getDeviceById(bulkDev.id);
    assert.strictEqual(refreshed.quantity, 15); // 25 - 10
    assert.strictEqual(refreshed.status, 'AVAILABLE');
  });

  // ==========================================================================
  // SCENARIO 4: Selecting multiple bulk models with different quantities
  // ==========================================================================
  test('Scenario 4: Selecting multiple bulk models with independent quantities (10 units & 4 units)', async () => {
    const bulk1 = await mssInventoryService.createDevice({
      serial_number: null,
      is_serialized: false,
      model_id: modelA.id,
      purchase_cost: 6000,
      list_price: 8500,
      stock_location: 'محل 1',
      status: 'AVAILABLE',
      quantity: 20,
    });
    const bulk2 = await mssInventoryService.createDevice({
      serial_number: null,
      is_serialized: false,
      model_id: modelC.id,
      purchase_cost: 5000,
      list_price: 7200,
      stock_location: 'محل 2',
      status: 'AVAILABLE',
      quantity: 12,
    });

    const invoice = await mssCommerceService.confirmSale({
      selling_branch: 'محل 1',
      customer_name: 'مؤسسة النور التعليمية',
      items: [
        { device_id: bulk1.id, quantity: 10, unit_price: 8000, actual_sale_price: 80000, source_branch: 'محل 1' },
        { device_id: bulk2.id, quantity: 4, unit_price: 7000, actual_sale_price: 28000, source_branch: 'محل 2' },
      ],
    });

    assert.strictEqual(invoice.items.length, 2);
    assert.strictEqual(invoice.items[0].quantity, 10);
    assert.strictEqual(invoice.items[1].quantity, 4);
    assert.strictEqual(invoice.actual_sale_price, 108000);

    const ref1 = await mssInventoryService.getDeviceById(bulk1.id);
    const ref2 = await mssInventoryService.getDeviceById(bulk2.id);
    assert.strictEqual(ref1.quantity, 10); // 20 - 10
    assert.strictEqual(ref2.quantity, 8);  // 12 - 4
  });

  // ==========================================================================
  // SCENARIO 5: Combining serialized devices and bulk quantities in one sale
  // ==========================================================================
  test('Scenario 5: Mixed sale combining serialized devices and bulk models with independent quantities', async () => {
    // Model A: 1 serialized
    const snA = 'SN-MIX-A-' + Date.now().toString(36).toUpperCase();
    const devA = await mssInventoryService.createDevice({
      serial_number: snA,
      model_id: modelA.id,
      purchase_cost: 9500,
      list_price: 13000,
      stock_location: 'محل 1',
      status: 'AVAILABLE',
      is_serialized: true,
      quantity: 1,
    });

    // Model B: 10 bulk units
    const bulkB = await mssInventoryService.createDevice({
      serial_number: null,
      is_serialized: false,
      model_id: modelB.id,
      purchase_cost: 7500,
      list_price: 10000,
      stock_location: 'محل 1',
      status: 'AVAILABLE',
      quantity: 15,
    });

    // Model C: 3 bulk units
    const bulkC = await mssInventoryService.createDevice({
      serial_number: null,
      is_serialized: false,
      model_id: modelC.id,
      purchase_cost: 5500,
      list_price: 8000,
      stock_location: 'محل 2',
      status: 'AVAILABLE',
      quantity: 8,
    });

    // Model D: 2 separate serialized devices
    const snD1 = 'SN-MIX-D1-' + Date.now().toString(36).toUpperCase();
    const snD2 = 'SN-MIX-D2-' + Date.now().toString(36).toUpperCase();
    const devD1 = await mssInventoryService.createDevice({
      serial_number: snD1,
      model_id: modelD.id,
      purchase_cost: 20000,
      list_price: 26000,
      stock_location: 'محل 1',
      status: 'AVAILABLE',
      is_serialized: true,
      quantity: 1,
    });
    const devD2 = await mssInventoryService.createDevice({
      serial_number: snD2,
      model_id: modelD.id,
      purchase_cost: 20500,
      list_price: 26500,
      stock_location: 'محل 2',
      status: 'AVAILABLE',
      is_serialized: true,
      quantity: 1,
    });

    const invoice = await mssCommerceService.confirmSale({
      selling_branch: 'محل 1',
      customer_name: 'الشركة المتكاملة (فاتورة مختلطة)',
      items: [
        { device_id: devA.id, quantity: 1, unit_price: 13000, actual_sale_price: 13000, source_branch: 'محل 1' },
        { device_id: bulkB.id, quantity: 10, unit_price: 9500, actual_sale_price: 95000, source_branch: 'محل 1' },
        { device_id: bulkC.id, quantity: 3, unit_price: 7800, actual_sale_price: 23400, source_branch: 'محل 2' },
        { device_id: devD1.id, quantity: 1, unit_price: 25000, actual_sale_price: 25000, source_branch: 'محل 1' },
        { device_id: devD2.id, quantity: 1, unit_price: 25500, actual_sale_price: 25500, source_branch: 'محل 2' },
      ],
    });

    assert.strictEqual(invoice.items.length, 5);
    // Total units = 1 + 10 + 3 + 1 + 1 = 16 units
    const totalUnits = invoice.items.reduce((s, it) => s + it.quantity, 0);
    assert.strictEqual(totalUnits, 16);
    assert.strictEqual(invoice.actual_sale_price, 13000 + 95000 + 23400 + 25000 + 25500);

    // Verify stock deduction
    const refA = await mssInventoryService.getDeviceById(devA.id);
    const refB = await mssInventoryService.getDeviceById(bulkB.id);
    const refC = await mssInventoryService.getDeviceById(bulkC.id);
    const refD1 = await mssInventoryService.getDeviceById(devD1.id);
    const refD2 = await mssInventoryService.getDeviceById(devD2.id);

    assert.strictEqual(refA.status, 'SOLD');
    assert.strictEqual(refB.quantity, 5);  // 15 - 10
    assert.strictEqual(refC.quantity, 5);  // 8 - 3
    assert.strictEqual(refD1.status, 'SOLD');
    assert.strictEqual(refD2.status, 'SOLD');
  });

  // ==========================================================================
  // SCENARIO 6: Repeating all scenarios in Reservations
  // ==========================================================================
  describe('Scenario 6: Reservations with Multi-Select and Bulk Quantities', () => {
    test('6.1 Single serialized reservation', async () => {
      const sn = 'SN-RES-S1-' + Date.now().toString(36).toUpperCase();
      const dev = await mssInventoryService.createDevice({
        serial_number: sn,
        model_id: modelA.id,
        purchase_cost: 8500,
        list_price: 11500,
        stock_location: 'محل 1',
        status: 'AVAILABLE',
        is_serialized: true,
        quantity: 1,
      });

      const res = await mssCommerceService.createReservation({
        customer_name: 'حاجز فردي',
        customer_phone: '01011112222',
        deposit_amount: 1000,
        branch: 'محل 1',
        items: [
          { device_id: dev.id, quantity: 1, agreed_price: 11000, source_branch: 'محل 1' },
        ],
      });

      assert.ok(res.id);
      assert.strictEqual(res.items.length, 1);
      assert.strictEqual(res.items[0].serial_number, sn);
      assert.strictEqual(res.items[0].quantity, 1);

      const ref = await mssInventoryService.getDeviceById(dev.id);
      assert.strictEqual(ref.status, 'RESERVED');
    });

    test('6.2 Multiple serialized devices in one reservation', async () => {
      const s1 = 'SN-RES-M1-' + Date.now().toString(36).toUpperCase();
      const s2 = 'SN-RES-M2-' + Date.now().toString(36).toUpperCase();

      const d1 = await mssInventoryService.createDevice({
        serial_number: s1,
        model_id: modelA.id,
        purchase_cost: 9000,
        list_price: 12000,
        stock_location: 'محل 1',
        status: 'AVAILABLE',
        is_serialized: true,
        quantity: 1,
      });
      const d2 = await mssInventoryService.createDevice({
        serial_number: s2,
        model_id: modelB.id,
        purchase_cost: 10000,
        list_price: 13500,
        stock_location: 'محل 2',
        status: 'AVAILABLE',
        is_serialized: true,
        quantity: 1,
      });

      const res = await mssCommerceService.createReservation({
        customer_name: 'حاجز جهازين',
        customer_phone: '01022223333',
        deposit_amount: 2500,
        branch: 'محل 1',
        items: [
          { device_id: d1.id, quantity: 1, agreed_price: 11500, source_branch: 'محل 1' },
          { device_id: d2.id, quantity: 1, agreed_price: 13000, source_branch: 'محل 2' },
        ],
      });

      assert.strictEqual(res.items.length, 2);
      assert.strictEqual(res.agreed_price, 24500);
      const r1 = await mssInventoryService.getDeviceById(d1.id);
      const r2 = await mssInventoryService.getDeviceById(d2.id);
      assert.strictEqual(r1.status, 'RESERVED');
      assert.strictEqual(r2.status, 'RESERVED');
    });

    test('6.3 Bulk model reservation with quantity 10 holds stock and restores it on cancel', async () => {
      const bulkDev = await mssInventoryService.createDevice({
        serial_number: null,
        is_serialized: false,
        model_id: modelB.id,
        purchase_cost: 7000,
        list_price: 9800,
        stock_location: 'محل 1',
        status: 'AVAILABLE',
        quantity: 20,
      });

      const res = await mssCommerceService.createReservation({
        customer_name: 'حجز 10 وحدات جملة',
        customer_phone: '01033334444',
        deposit_amount: 5000,
        branch: 'محل 1',
        items: [
          { device_id: bulkDev.id, quantity: 10, agreed_price: 92000, source_branch: 'محل 1' },
        ],
      });

      assert.strictEqual(res.items.length, 1);
      assert.strictEqual(res.items[0].quantity, 10);

      // Business rule: Reserving 10 units holds them so they cannot be oversold (20 - 10 = 10)
      const ref = await mssInventoryService.getDeviceById(bulkDev.id);
      assert.strictEqual(ref.quantity, 10);

      // When reservation is cancelled, held stock is restored back (10 + 10 = 20)
      await mssCommerceService.cancelReservation(res.id, 'إلغاء تجريبي');
      const refAfterCancel = await mssInventoryService.getDeviceById(bulkDev.id);
      assert.strictEqual(refAfterCancel.quantity, 20);
    });

    test('6.4 Mixed reservation with serialized device and bulk quantities', async () => {
      const sn = 'SN-RES-MIX-' + Date.now().toString(36).toUpperCase();
      const dev = await mssInventoryService.createDevice({
        serial_number: sn,
        model_id: modelA.id,
        purchase_cost: 8000,
        list_price: 11000,
        stock_location: 'محل 1',
        status: 'AVAILABLE',
        is_serialized: true,
        quantity: 1,
      });
      const bulk = await mssInventoryService.createDevice({
        serial_number: null,
        is_serialized: false,
        model_id: modelC.id,
        purchase_cost: 5000,
        list_price: 7500,
        stock_location: 'محل 1',
        status: 'AVAILABLE',
        quantity: 15,
      });

      const res = await mssCommerceService.createReservation({
        customer_name: 'حجز مختلط',
        customer_phone: '01044445555',
        deposit_amount: 3000,
        branch: 'محل 1',
        items: [
          { device_id: dev.id, quantity: 1, agreed_price: 10500, source_branch: 'محل 1' },
          { device_id: bulk.id, quantity: 5, agreed_price: 35000, source_branch: 'محل 1' },
        ],
      });

      assert.strictEqual(res.items.length, 2);
      const totalUnits = res.items.reduce((s, it) => s + it.quantity, 0);
      assert.strictEqual(totalUnits, 6);
    });
  });

  // ==========================================================================
  // SCENARIO 7: Rejecting zero, negative, decimal, and invalid quantities
  // ==========================================================================
  describe('Scenario 7: Strict rejection of zero, negative, decimal, and invalid quantities', () => {
    test('7.1 Reject zero quantity in Sale', async () => {
      const bulk = await mssInventoryService.createDevice({
        serial_number: null,
        is_serialized: false,
        model_id: modelB.id,
        purchase_cost: 6000,
        list_price: 8500,
        stock_location: 'محل 1',
        status: 'AVAILABLE',
        quantity: 10,
      });

      await assert.rejects(
        () =>
          mssCommerceService.confirmSale({
            selling_branch: 'محل 1',
            customer_name: 'فحص كمية صفر',
            items: [{ device_id: bulk.id, quantity: 0, actual_sale_price: 0, source_branch: 'محل 1' }],
          }),
        /غير صالحة.*عدد صحيح موجب/
      );
    });

    test('7.2 Reject negative quantity in Sale', async () => {
      const bulk = await mssInventoryService.createDevice({
        serial_number: null,
        is_serialized: false,
        model_id: modelB.id,
        purchase_cost: 6000,
        list_price: 8500,
        stock_location: 'محل 1',
        status: 'AVAILABLE',
        quantity: 10,
      });

      await assert.rejects(
        () =>
          mssCommerceService.confirmSale({
            selling_branch: 'محل 1',
            customer_name: 'فحص كمية سالبة',
            items: [{ device_id: bulk.id, quantity: -3, actual_sale_price: 8500, source_branch: 'محل 1' }],
          }),
        /غير صالحة.*عدد صحيح موجب/
      );
    });

    test('7.3 Reject decimal quantity in Sale', async () => {
      const bulk = await mssInventoryService.createDevice({
        serial_number: null,
        is_serialized: false,
        model_id: modelB.id,
        purchase_cost: 6000,
        list_price: 8500,
        stock_location: 'محل 1',
        status: 'AVAILABLE',
        quantity: 10,
      });

      await assert.rejects(
        () =>
          mssCommerceService.confirmSale({
            selling_branch: 'محل 1',
            customer_name: 'فحص كمية عشرية',
            items: [{ device_id: bulk.id, quantity: 2.5, actual_sale_price: 21250, source_branch: 'محل 1' }],
          }),
        /غير صالحة.*بدون كسور/
      );
    });

    test('7.4 Reject invalid text quantity in Reservation', async () => {
      const bulk = await mssInventoryService.createDevice({
        serial_number: null,
        is_serialized: false,
        model_id: modelB.id,
        purchase_cost: 6000,
        list_price: 8500,
        stock_location: 'محل 1',
        status: 'AVAILABLE',
        quantity: 10,
      });

      await assert.rejects(
        () =>
          mssCommerceService.createReservation({
            customer_name: 'فحص كمية غير صالحة بالحجز',
            customer_phone: '01099998888',
            deposit_amount: 500,
            branch: 'محل 1',
            items: [{ device_id: bulk.id, quantity: 'abc', agreed_price: 8500, source_branch: 'محل 1' }],
          }),
        /غير صالحة.*عدد صحيح موجب/
      );
    });
  });

  // ==========================================================================
  // SCENARIO 8: Rejecting quantities exceeding available stock
  // ==========================================================================
  describe('Scenario 8: Rejecting quantities exceeding available stock', () => {
    test('8.1 Sale rejecting quantity greater than available stock', async () => {
      const bulk = await mssInventoryService.createDevice({
        serial_number: null,
        is_serialized: false,
        model_id: modelB.id,
        purchase_cost: 6000,
        list_price: 8500,
        stock_location: 'محل 1',
        status: 'AVAILABLE',
        quantity: 5,
      });

      await assert.rejects(
        () =>
          mssCommerceService.confirmSale({
            selling_branch: 'محل 1',
            customer_name: 'تجاوز المخزون بيع',
            items: [{ device_id: bulk.id, quantity: 6, actual_sale_price: 50000, source_branch: 'محل 1' }],
          }),
        /أكبر من المخزون المتاح/
      );
    });

    test('8.2 Reservation rejecting quantity greater than available stock', async () => {
      const bulk = await mssInventoryService.createDevice({
        serial_number: null,
        is_serialized: false,
        model_id: modelC.id,
        purchase_cost: 5000,
        list_price: 7000,
        stock_location: 'محل 1',
        status: 'AVAILABLE',
        quantity: 3,
      });

      await assert.rejects(
        () =>
          mssCommerceService.createReservation({
            customer_name: 'تجاوز المخزون حجز',
            customer_phone: '01088887777',
            deposit_amount: 1000,
            branch: 'محل 1',
            items: [{ device_id: bulk.id, quantity: 10, agreed_price: 70000, source_branch: 'محل 1' }],
          }),
        /أكبر من المخزون المتاح/
      );
    });
  });

  // ==========================================================================
  // SCENARIO 9: Removing one selected item without affecting others
  // ==========================================================================
  test('Scenario 9: Removing an item maintains other items independent prices and quantities', async () => {
    const s1 = 'SN-REM-1-' + Date.now().toString(36).toUpperCase();
    const s2 = 'SN-REM-2-' + Date.now().toString(36).toUpperCase();

    const d1 = await mssInventoryService.createDevice({
      serial_number: s1,
      model_id: modelA.id,
      purchase_cost: 8000,
      list_price: 11000,
      stock_location: 'محل 1',
      status: 'AVAILABLE',
      is_serialized: true,
      quantity: 1,
    });
    const d2 = await mssInventoryService.createDevice({
      serial_number: s2,
      model_id: modelA.id,
      purchase_cost: 8200,
      list_price: 11200,
      stock_location: 'محل 1',
      status: 'AVAILABLE',
      is_serialized: true,
      quantity: 1,
    });
    const bulk = await mssInventoryService.createDevice({
      serial_number: null,
      is_serialized: false,
      model_id: modelB.id,
      purchase_cost: 7000,
      list_price: 9500,
      stock_location: 'محل 1',
      status: 'AVAILABLE',
      quantity: 10,
    });

    // Simulating items selection: originally d1, d2, bulk
    // User removes d2 before confirming
    const finalItems = [
      { device_id: d1.id, quantity: 1, unit_price: 11000, actual_sale_price: 11000, source_branch: 'محل 1' },
      { device_id: bulk.id, quantity: 4, unit_price: 9500, actual_sale_price: 38000, source_branch: 'محل 1' },
    ];

    const invoice = await mssCommerceService.confirmSale({
      selling_branch: 'محل 1',
      customer_name: 'حذف عنصر قبل التأكيد',
      items: finalItems,
    });

    assert.strictEqual(invoice.items.length, 2);
    assert.strictEqual(invoice.items[0].serial_number, s1);
    assert.strictEqual(invoice.items[1].quantity, 4);

    // d2 should still be AVAILABLE because it was removed before sale
    const refD2 = await mssInventoryService.getDeviceById(d2.id);
    assert.strictEqual(refD2.status, 'AVAILABLE');

    // d1 sold, bulk deducted by 4
    const refD1 = await mssInventoryService.getDeviceById(d1.id);
    const refBulk = await mssInventoryService.getDeviceById(bulk.id);
    assert.strictEqual(refD1.status, 'SOLD');
    assert.strictEqual(refBulk.quantity, 6);
  });

  // ==========================================================================
  // SCENARIO 10: Preventing duplicate device selection and double counting
  // ==========================================================================
  test('Scenario 10: Preventing duplicate serialized device selection and double counting', async () => {
    const sn = 'SN-DUP-' + Date.now().toString(36).toUpperCase();
    const dev = await mssInventoryService.createDevice({
      serial_number: sn,
      model_id: modelA.id,
      purchase_cost: 9000,
      list_price: 12000,
      stock_location: 'محل 1',
      status: 'AVAILABLE',
      is_serialized: true,
      quantity: 1,
    });

    // Attempting to add the same serialized device twice in sales
    await assert.rejects(
      () =>
        mssCommerceService.confirmSale({
          selling_branch: 'محل 1',
          customer_name: 'تكرار جهاز في البيع',
          items: [
            { device_id: dev.id, serial_number: sn, quantity: 1, actual_sale_price: 12000, source_branch: 'محل 1' },
            { device_id: dev.id, serial_number: sn, quantity: 1, actual_sale_price: 12000, source_branch: 'محل 1' },
          ],
        }),
      /يمنع تكرار.*نفس الجهاز/
    );

    // Attempting to add the same serialized device twice in reservations
    await assert.rejects(
      () =>
        mssCommerceService.createReservation({
          customer_name: 'تكرار جهاز في الحجز',
          customer_phone: '01077776666',
          deposit_amount: 1000,
          branch: 'محل 1',
          items: [
            { device_id: dev.id, serial_number: sn, quantity: 1, agreed_price: 12000, source_branch: 'محل 1' },
            { device_id: dev.id, serial_number: sn, quantity: 1, agreed_price: 12000, source_branch: 'محل 1' },
          ],
        }),
      /يمنع تكرار.*نفس الجهاز/
    );
  });
});
