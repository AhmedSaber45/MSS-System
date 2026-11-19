// Automated Verification Script for Phase 07: MSS Individual Inventory & Serial Tracking & Transfers
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
const { mssInventoryService } = await import('../src/services/mssInventoryService.ts');
const { mssCatalogService } = await import('../src/services/mssCatalogService.ts');
const { productsService } = await import('../src/services/productsService.ts');

describe('Phase 07 — MSS Individual Inventory & Serial Numbers Verification', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('1. Initial seed devices load properly with serials, conditions, and locations', async () => {
    const devices = await mssInventoryService.getDevices();
    assert.ok(devices.length >= 6, 'Should load at least 6 initial seed device units');

    // Check specific unit with unique serial
    const dev1 = devices.find(d => d.serial_number === 'PF1K892-LEN');
    assert.ok(dev1, 'Device PF1K892-LEN should exist');
    assert.ok(['محل 1', 'محل 2'].includes(dev1.stock_location), 'Location should be valid shop');
    assert.strictEqual(dev1.status, 'AVAILABLE');
    assert.strictEqual(dev1.purchase_cost, 8500);
    assert.strictEqual(dev1.list_price, 11500);
    assert.ok(dev1.physical_condition.includes('فرز أول'));

    // Check model metadata enrichment
    assert.ok(dev1.model_name, 'Should enrich device with model_name');
    assert.ok(dev1.brand, 'Should enrich device with brand');
  });

  test('2. Register a new device with unique serial number and specifications', async () => {
    const models = await mssCatalogService.getModels();
    const model = models.find(m => m.id === 'a0000000-0000-0000-0000-000000000001') || models[models.length - 1];
    const uniqueSerial = 'SN-REG-' + Date.now().toString(36).toUpperCase() + '-' + Math.floor(Math.random() * 1000);

    const newDevice = await mssInventoryService.createDevice({
      serial_number: uniqueSerial,
      model_id: model.id,
      purchase_cost: 14000,
      list_price: 18500,
      purchase_date: '2024-11-14',
      physical_condition: 'كالجديد بكرتونته كاملة',
      stock_location: 'محل 1',
      status: 'AVAILABLE',
      notes: 'بطارية 100%، شاحن أصلي تايب سي 65W',
    });

    assert.ok(newDevice.id, 'New device should receive unique ID');
    assert.strictEqual(newDevice.serial_number, uniqueSerial);
    assert.strictEqual(newDevice.stock_location, 'محل 1');
    assert.strictEqual(newDevice.purchase_cost, 14000);
    assert.strictEqual(newDevice.list_price, 18500);

    // Verify lookup by serial
    const fetched = await mssInventoryService.getDeviceBySerial(uniqueSerial);
    assert.ok(fetched, 'Should find device by serial number');
    assert.strictEqual(fetched?.id, newDevice.id);
  });

  test('3. Enforce Unique Serial Number constraint: Reject duplicate serial number', async () => {
    const models = await mssCatalogService.getModels();
    const model = models.find(m => m.id === 'a0000000-0000-0000-0000-000000000001') || models[models.length - 1];

    // PF1K892-LEN is already registered in seed
    await assert.rejects(
      async () => {
        await mssInventoryService.createDevice({
          serial_number: 'PF1K892-LEN', // duplicate
          model_id: model.id,
          purchase_cost: 9000,
          list_price: 12000,
          stock_location: 'محل 1',
        });
      },
      /مسجل مسبقاً.*يمنع تكرار السيريالات/
    );

    // Case-insensitive duplicate check
    await assert.rejects(
      async () => {
        await mssInventoryService.createDevice({
          serial_number: 'pf1k892-len', // lowercase duplicate
          model_id: model.id,
          purchase_cost: 9000,
          list_price: 12000,
          stock_location: 'محل 2',
        });
      },
      /مسجل مسبقاً.*يمنع تكرار السيريالات/
    );
  });

  test('4. Input validation: allow optional serial, reject negative costs or invalid location', async () => {
    const models = await mssCatalogService.getModels();
    const model = models.find(m => m.id === 'a0000000-0000-0000-0000-000000000001') || models[models.length - 1];

    // Empty serial should succeed and be stored as non-serialized (Phase UX improvements)
    const nonSerDev = await mssInventoryService.createDevice({
      serial_number: '   ',
      model_id: model.id,
      purchase_cost: 5000,
      list_price: 8000,
      stock_location: 'محل 1',
    });
    assert.strictEqual(nonSerDev.serial_number, null, 'Empty serial should normalize to null');
    assert.strictEqual(nonSerDev.is_serialized, false, 'Should be marked as non-serialized');

    // Negative cost
    await assert.rejects(
      async () => {
        await mssInventoryService.createDevice({
          serial_number: 'SN-VALID-01',
          model_id: model.id,
          purchase_cost: -100,
          list_price: 8000,
          stock_location: 'محل 1',
        });
      },
      /سعر التكلفة لا يمكن أن يكون سالباً/
    );

    // Invalid location
    await assert.rejects(
      async () => {
        await mssInventoryService.createDevice({
          serial_number: 'SN-VALID-02',
          model_id: model.id,
          purchase_cost: 5000,
          list_price: 8000,
          // @ts-ignore
          stock_location: 'محل 3 غير موجود',
        });
      },
      /موقع التخزين غير صالح/
    );
  });

  test('5. Track unit statuses: AVAILABLE, RESERVED, SOLD, MAINTENANCE, RETURNED', async () => {
    const devices = await mssInventoryService.getDevices();

    const available = devices.filter(d => d.status === 'AVAILABLE');
    const reserved = devices.filter(d => d.status === 'RESERVED');
    const sold = devices.filter(d => d.status === 'SOLD');

    assert.ok(available.length > 0, 'Should have AVAILABLE units');
    assert.ok(reserved.length > 0, 'Should have RESERVED units');
    assert.ok(sold.length > 0, 'Should have SOLD units');

    // Register a unit under maintenance
    const models = await mssCatalogService.getModels();
    const model = models.find(m => m.id === 'a0000000-0000-0000-0000-000000000001') || models[models.length - 1];
    const maintSerial = 'SN-MNT-' + Date.now().toString(36).toUpperCase() + '-' + Math.floor(Math.random() * 1000);
    const maintUnit = await mssInventoryService.createDevice({
      serial_number: maintSerial,
      model_id: model.id,
      purchase_cost: 4000,
      list_price: 7000,
      stock_location: 'محل 1',
      status: 'MAINTENANCE',
      notes: 'تغيير مفصلات الشاشة وفحص بطارية',
    });

    assert.strictEqual(maintUnit.status, 'MAINTENANCE');

    // Register a returned unit
    const retSerial = 'SN-RET-' + Date.now().toString(36).toUpperCase() + '-' + Math.floor(Math.random() * 1000);
    const returnedUnit = await mssInventoryService.createDevice({
      serial_number: retSerial,
      model_id: model.id,
      purchase_cost: 8000,
      list_price: 11000,
      stock_location: 'محل 2',
      status: 'RETURNED',
      notes: 'مرتجع من عميل بسبب استبدال الموديل',
    });

    assert.strictEqual(returnedUnit.status, 'RETURNED');
  });

  test('6. Correct per-shop stock visibility: Shop 1 vs Shop 2 quantity (Rule 9)', async () => {
    const summary = await mssInventoryService.getInventorySummary();

    assert.ok(summary.total_units >= 6, 'Total units should be >= 6');
    assert.ok(summary.available_shop1 >= 2, 'Shop 1 should have at least 2 available units in seed');
    assert.ok(summary.available_shop2 >= 2, 'Shop 2 should have at least 2 available units in seed');
    assert.strictEqual(
      summary.available_total,
      summary.available_shop1 + summary.available_shop2,
      'Total available must equal sum of Shop 1 and Shop 2 available units'
    );
  });

  test('7. Search and filter physical devices by Serial, Model, and Location', async () => {
    // Filter by location
    const shop1Devices = await mssInventoryService.getDevices({ location: 'محل 1' });
    assert.ok(shop1Devices.every(d => d.stock_location === 'محل 1'));

    const shop2Devices = await mssInventoryService.getDevices({ location: 'محل 2' });
    assert.ok(shop2Devices.every(d => d.stock_location === 'محل 2'));

    // Search by serial query
    const bySerial = await mssInventoryService.getDevices({ query: 'CN49129' });
    assert.strictEqual(bySerial.length, 1);
    assert.strictEqual(bySerial[0].serial_number, 'CN49129-MON');

    // Filter by status
    const byStatus = await mssInventoryService.getDevices({ status: 'RESERVED' });
    assert.ok(byStatus.every(d => d.status === 'RESERVED'));
  });

  test('8. Update device attributes, condition, and prices safely', async () => {
    const devices = await mssInventoryService.getDevices();
    const target = devices.find(d => d.status === 'AVAILABLE');
    assert.ok(target, 'Should have an available device');

    const updated = await mssInventoryService.updateDevice(target.id, {
      list_price: 16200,
      physical_condition: 'فرز أول استيراد ممتاز مع حقيبة هدية',
      notes: 'تم فحص الشاحن والكيبورد بالكامل',
    });

    assert.strictEqual(updated.list_price, 16200);
    assert.strictEqual(updated.physical_condition, 'فرز أول استيراد ممتاز مع حقيبة هدية');

    const retrieved = await mssInventoryService.getDeviceById(target.id);
    assert.strictEqual(retrieved?.list_price, 16200);
  });

  test('9. Physical device transfer between shops (Shop 1 <-> Shop 2) logs movement & updates location', async () => {
    const devices = await mssInventoryService.getDevices();
    const dev = devices.find(d => d.serial_number === 'PF1K892-LEN') || devices[0];
    assert.ok(dev, 'Target device should exist');

    const fromLocation = dev.stock_location;
    const targetLocation = fromLocation === 'محل 1' ? 'محل 2' : 'محل 1';

    // Transfer to the other shop
    const { device: transferred, movement } = await mssInventoryService.transferDevice({
      device_id: dev.id,
      to_location: targetLocation,
      notes: 'نقل للعرض في واجهة ' + targetLocation,
    });

    // Check device location updated
    assert.strictEqual(transferred.stock_location, targetLocation);
    assert.strictEqual(transferred.id, dev.id);

    // Check movement record created
    assert.ok(movement.id);
    assert.strictEqual(movement.from_location, fromLocation);
    assert.strictEqual(movement.to_location, targetLocation);
    assert.strictEqual(movement.serial_number, dev.serial_number);

    // Verify device retrieved has new location
    const checkDev = await mssInventoryService.getDeviceById(dev.id);
    assert.strictEqual(checkDev?.stock_location, targetLocation);

    // Check device history includes this new movement
    const history = await mssInventoryService.getDeviceHistory(dev.id);
    assert.ok(history.some(m => m.id === movement.id));
  });

  test('10. Reject invalid transfer: transferring to the same shop must throw an error', async () => {
    const devices = await mssInventoryService.getDevices();
    const dev = devices.find(d => d.stock_location === 'محل 1');
    assert.ok(dev, 'Should have device at Shop 1');

    await assert.rejects(
      async () => {
        await mssInventoryService.transferDevice({
          device_id: dev.id,
          to_location: 'محل 1', // same location!
          notes: 'محاولة نقل خاطئة لنفس الفرع',
        });
      },
      /متواجد بالفعل في.*لا يمكن تحويله إلى نفس الموقع/
    );
  });

  test('11. Device unit details and full movement history retrieval', async () => {
    const movements = await mssInventoryService.getMovements();
    assert.ok(movements.length >= 2, 'Initial seed movements should exist');

    const first = movements[0];
    assert.ok(first.serial_number);
    assert.ok(first.from_location);
    assert.ok(first.to_location);
    assert.notStrictEqual(first.from_location, first.to_location);
  });

  test('12. Prevent deletion of a SOLD device to preserve historical financial records', async () => {
    const devices = await mssInventoryService.getDevices();
    const soldDevice = devices.find(d => d.status === 'SOLD');
    assert.ok(soldDevice, 'Should have a SOLD device in seed (5CD9283-HP)');

    await assert.rejects(
      async () => {
        await mssInventoryService.deleteDevice(soldDevice.id);
      },
      /لا يمكن حذف جهاز تم بيعه بالكامل لحفظ السجلات المالية/
    );
  });

  test('13. Data persistence across simulated offline reload', async () => {
    const models = await mssCatalogService.getModels();
    const model = models.find(m => m.id === 'a0000000-0000-0000-0000-000000000001') || models[models.length - 1];
    const serial = 'SN-RELOAD-' + Date.now().toString(36).toUpperCase() + '-' + Math.floor(Math.random() * 1000);

    await mssInventoryService.createDevice({
      serial_number: serial,
      model_id: model.id,
      purchase_cost: 12000,
      list_price: 15500,
      stock_location: 'محل 2',
      status: 'AVAILABLE',
      notes: 'اختبار الاستمرارية والتخزين المحلي',
    });

    // Re-instantiate query directly
    const reloaded = await mssInventoryService.getDeviceBySerial(serial);
    assert.ok(reloaded, 'Device must persist after simulated reload');
    assert.strictEqual(reloaded?.serial_number, serial);
    assert.strictEqual(reloaded?.stock_location, 'محل 2');
  });

  test('14. Strict separation: Accessories products are NEVER mixed with MSS physical devices (Rule 6)', async () => {
    const accProducts = await productsService.getProducts();
    const mssDevices = await mssInventoryService.getDevices();

    // Verify product IDs and device IDs have completely separate spaces
    const accIds = new Set(accProducts.map(p => p.id));
    const mssIds = new Set(mssDevices.map(d => d.id));

    for (const dId of mssIds) {
      assert.strictEqual(accIds.has(dId), false, `MSS Device ID ${dId} must not exist in Accessories`);
    }

    // Verify serial numbers are never in accessories barcodes
    const accBarcodes = new Set(accProducts.map(p => p.barcode).filter(Boolean));
    for (const d of mssDevices) {
      assert.strictEqual(
        accBarcodes.has(d.serial_number),
        false,
        `MSS serial ${d.serial_number} must not collide with Accessories barcodes`
      );
    }
  });
});
