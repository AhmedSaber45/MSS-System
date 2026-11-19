import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

// Setup Mock localStorage for Node.js test environment
if (!global.localStorage) {
  const storage = new Map();
  global.localStorage = {
    getItem: (key) => storage.get(key) || null,
    setItem: (key, val) => storage.set(key, String(val)),
    removeItem: (key) => storage.delete(key),
    clear: () => storage.clear(),
  };
}

const { mssCommerceService } = await import('../src/services/mssCommerceService.ts');
const { mssInventoryService } = await import('../src/services/mssInventoryService.ts');
const { mssCatalogService } = await import('../src/services/mssCatalogService.ts');

describe('PHASE 1 — COMPU MSS INVOICE, RESERVATION & SERIALIZATION IMPROVEMENTS', () => {
  let testModel;

  beforeEach(async () => {
    const models = await mssCatalogService.getModels();
    testModel = models[0] || (await mssCatalogService.createModel({
      brand: 'Lenovo',
      model_name: 'ThinkPad T480',
      category: 'Laptop',
      processor: 'Intel Core i5-8350U',
      gpu: 'Intel UHD Graphics 620',
      ram: '16GB DDR4',
      storage: '256GB NVMe SSD',
      screen_size: '14.0 Inch FHD IPS',
    }));
  });

  // ============================================================================
  // REQUIREMENT 1: OPTIMIZE A4 INVOICE SPECIFICATIONS & FIX PREVIEW MODAL
  // ============================================================================
  describe('1. Optimize A4 Invoice Specifications & Fix Preview Modal', () => {
    test('1.1 Modal.tsx supports size="2xl" with max-w-5xl class', () => {
      const modalSrc = fs.readFileSync(path.resolve('src/components/common/Modal.tsx'), 'utf-8');
      assert.ok(modalSrc.includes("'2xl': 'max-w-5xl'"), 'Modal.tsx must contain 2xl size class max-w-5xl');
      assert.ok(modalSrc.includes("'2xl'"), 'ModalProps must accept 2xl');
    });

    test('1.2 MSSSalesView uses size="2xl" for sale completion modal to prevent horizontal cropping', () => {
      const salesSrc = fs.readFileSync(path.resolve('src/components/placeholders/mss/MSSSalesView.tsx'), 'utf-8');
      assert.ok(
        salesSrc.includes('size="2xl"'),
        'MSSSalesView completion modal must use size="2xl" to give full breathing room for A4'
      );
    });

    test('1.3 MSSInvoicesView uses size="2xl" for invoice preview modal', () => {
      const invoicesSrc = fs.readFileSync(path.resolve('src/components/placeholders/mss/MSSInvoicesView.tsx'), 'utf-8');
      assert.ok(
        invoicesSrc.includes('size="2xl"'),
        'MSSInvoicesView modal must use size="2xl" to display full invoice without horizontal cutoff'
      );
    });

    test('1.4 MSSPrintableInvoice implements compact specification tags with whitespace-nowrap', () => {
      const printSrc = fs.readFileSync(path.resolve('src/components/placeholders/mss/MSSPrintableInvoice.tsx'), 'utf-8');
      assert.ok(
        printSrc.includes('item.processor') &&
        printSrc.includes('item.gpu') &&
        printSrc.includes('item.ram') &&
        printSrc.includes('item.storage') &&
        printSrc.includes('item.screen_size'),
        'Must retain all laptop specifications (processor, gpu, ram, storage, screen_size)'
      );
      assert.ok(
        printSrc.includes('whitespace-nowrap') && printSrc.includes('rounded bg-slate-100'),
        'Specifications must be rendered in compact badges/tags with whitespace-nowrap to avoid vertical sprawl'
      );
    });

    test('1.5 MSSPrintableInvoice prevents serial number hyphen wrapping via whitespace-nowrap', () => {
      const printSrc = fs.readFileSync(path.resolve('src/components/placeholders/mss/MSSPrintableInvoice.tsx'), 'utf-8');
      assert.ok(
        printSrc.includes('whitespace-nowrap') && printSrc.includes('item.serial_number'),
        'Serial numbers must have whitespace-nowrap to keep hyphenated serials on a single crisp line'
      );
    });

    test('1.6 MSSPrintableInvoice includes preview zoom/scale controls (85% fit width, 100%, ZoomIn, ZoomOut)', () => {
      const printSrc = fs.readFileSync(path.resolve('src/components/placeholders/mss/MSSPrintableInvoice.tsx'), 'utf-8');
      assert.ok(printSrc.includes('zoomScale'), 'Must provide zoomScale state for preview inspection');
      assert.ok(printSrc.includes('ملائمة العرض (85%)'), 'Must provide Fit Width (85%) quick action');
      assert.ok(printSrc.includes('100%'), 'Must provide 100% full scale quick action');
      assert.ok(printSrc.includes('ZoomIn') && printSrc.includes('ZoomOut'), 'Must provide ZoomIn and ZoomOut buttons');
    });

    test('1.7 Customer and Store signatures are preserved neatly at the bottom of A4 invoice', () => {
      const printSrc = fs.readFileSync(path.resolve('src/components/placeholders/mss/MSSPrintableInvoice.tsx'), 'utf-8');
      assert.ok(printSrc.includes('توقيع العميل / المستلم'), 'Must have Customer Signature section');
      assert.ok(printSrc.includes('توقيع وختم المحل / الإدارة'), 'Must have Store / Management Signature section');
    });
  });

  // ============================================================================
  // REQUIREMENT 2: RESERVATION MODAL MUST START WITH AN EMPTY ITEMS LIST
  // ============================================================================
  describe('2. Reservation Modal Must Start With an Empty Items List', () => {
    test('2.1 ReservationsView handleOpenAdd initializes with empty items list and no pre-selected device', () => {
      const resSrc = fs.readFileSync(path.resolve('src/components/placeholders/mss/ReservationsView.tsx'), 'utf-8');
      assert.ok(
        resSrc.includes('setReservationItems([])'),
        'handleOpenAdd must reset reservationItems to empty array'
      );
      assert.ok(
        resSrc.includes('setPendingDevice(null)'),
        'handleOpenAdd must set pendingDevice to null (no auto-selected device)'
      );
      assert.ok(
        resSrc.includes('setPendingAgreedPrice(0)'),
        'handleOpenAdd must reset pendingAgreedPrice to 0'
      );
    });

    test('2.2 Empty reservation submission is blocked with validation error and button disabled', () => {
      const resSrc = fs.readFileSync(path.resolve('src/components/placeholders/mss/ReservationsView.tsx'), 'utf-8');
      assert.ok(
        resSrc.includes("if (reservationItems.length === 0)") &&
        resSrc.includes("setFormError('يرجى إضافة جهاز واحد على الأقل للحجز قبل التأكيد')"),
        'handleSaveAdd must reject submission when items count is zero'
      );
      assert.ok(
        resSrc.includes('disabled={isSubmitting || reservationItems.length === 0}'),
        'Submit button must be disabled when reservationItems.length === 0'
      );
    });

    test('2.3 Device pick requires explicit Add Item action which resets pendingDevice', () => {
      const resSrc = fs.readFileSync(path.resolve('src/components/placeholders/mss/ReservationsView.tsx'), 'utf-8');
      assert.ok(
        resSrc.includes('handleAddItemToReservation'),
        'Must require explicit click on Add Item'
      );
      assert.ok(
        resSrc.includes('setPendingDevice(null)') && resSrc.includes('setPendingQuantity(1)'),
        'handleAddItemToReservation must reset pendingDevice to null so user can easily choose the next item'
      );
    });

    test('2.4 Editing existing reservation cleanly loads actual saved items (updateReservation)', async () => {
      const serial = 'SN-RES-EDIT-' + Date.now().toString(36).toUpperCase();
      const dev = await mssInventoryService.createDevice({
        serial_number: serial,
        model_id: testModel.id,
        purchase_cost: 7000,
        list_price: 9500,
        stock_location: 'محل 1',
        status: 'AVAILABLE',
      });

      const res = await mssCommerceService.createReservation({
        device_id: dev.id,
        branch: 'محل 1',
        customer_name: 'أحمد محمود',
        customer_phone: '01122334455',
        deposit_amount: 500,
        agreed_price: 9500,
        expiry_date: '2026-12-01',
        items: [
          {
            device_id: dev.id,
            quantity: 1,
            agreed_price: 9500,
            source_branch: 'محل 1',
          },
        ],
      });

      assert.strictEqual(res.customer_name, 'أحمد محمود');
      assert.strictEqual(res.items?.length, 1);

      // Now update the existing reservation
      const updated = await mssCommerceService.updateReservation(res.id, {
        customer_name: 'أحمد محمود المعدل',
        deposit_amount: 1000,
        notes: 'تم تعديل العربون والبيانات بناء على طلب العميل',
      });

      assert.strictEqual(updated.customer_name, 'أحمد محمود المعدل');
      assert.strictEqual(updated.deposit_amount, 1000);
      assert.strictEqual(updated.items?.length, 1);
      assert.strictEqual(updated.status, 'ACTIVE');

      // Verify ReservationsView source provides edit action
      const resSrc = fs.readFileSync(path.resolve('src/components/placeholders/mss/ReservationsView.tsx'), 'utf-8');
      assert.ok(resSrc.includes('handleOpenEdit'), 'ReservationsView must provide handleOpenEdit');
      assert.ok(resSrc.includes('تعديل'), 'Must provide visible Edit button in actions');
    });
  });

  // ============================================================================
  // REQUIREMENT 3: ADD SERIAL NUMBERS LATER TO EXISTING NON-SERIALIZED STOCK
  // ============================================================================
  describe('3. Add Serial Numbers Later to Existing Non-Serialized Stock', () => {
    test('3.1 Workflow: 10 non-serialized units -> assign 4 serials -> 4 serialized + 6 remaining', async () => {
      // 1. Register 10 units without serial numbers
      const bulkStock = await mssInventoryService.createBulkStock({
        model_id: testModel.id,
        quantity: 10,
        stock_location: 'محل 1',
        purchase_cost: 6000,
        list_price: 8500,
        physical_condition: 'جديد بالكرتونة',
      });

      assert.strictEqual(bulkStock.quantity, 10);
      assert.strictEqual(bulkStock.is_serialized, false);
      assert.strictEqual(bulkStock.serial_number, null);

      // 2. Assign 4 serial numbers
      const baseSerial = 'SN-T480-' + Date.now().toString(36).toUpperCase() + '-';
      const serialsToAssign = [
        baseSerial + '01',
        baseSerial + '02',
        baseSerial + '03',
        baseSerial + '04',
      ];

      const result = await mssInventoryService.assignSerialsToBulkStock({
        stock_id: bulkStock.id,
        serial_numbers: serialsToAssign,
        notes: 'استلام الأرقام المسلسلة لـ 4 وحدات',
      });

      // 3. Verify exactly 4 individual serialized devices were created
      assert.strictEqual(result.convertedDevices.length, 4);
      for (const d of result.convertedDevices) {
        assert.ok(serialsToAssign.includes(d.serial_number));
        assert.strictEqual(d.is_serialized, true);
        assert.strictEqual(d.quantity, 1);
        assert.strictEqual(d.model_id, testModel.id);
        assert.strictEqual(d.purchase_cost, 6000);
        assert.strictEqual(d.list_price, 8500);
        assert.strictEqual(d.stock_location, 'محل 1');
        assert.strictEqual(d.status, 'AVAILABLE');
      }

      // 4. Verify exactly 6 units remain non-serialized
      assert.ok(result.remainingStock);
      assert.strictEqual(result.remainingStock.quantity, 6);
      assert.strictEqual(result.remainingStock.id, bulkStock.id);

      // 5. Total stock conservation check: 4 serialized + 6 bulk = 10 total
      const allDevices = await mssInventoryService.getDevices();
      const matchingBulk = allDevices.find(d => d.id === bulkStock.id);
      assert.strictEqual(matchingBulk.quantity, 6);

      const matchingSerialized = allDevices.filter(d => serialsToAssign.includes(d.serial_number));
      assert.strictEqual(matchingSerialized.length, 4);
    });

    test('3.2 Full conversion: assign serials to all remaining units deletes bulk row cleanly', async () => {
      const bulkStock = await mssInventoryService.createBulkStock({
        model_id: testModel.id,
        quantity: 2,
        stock_location: 'محل 2',
        purchase_cost: 6500,
        list_price: 9000,
      });

      const serials = [
        'SN-FULL-1-' + Date.now().toString(36).toUpperCase(),
        'SN-FULL-2-' + Date.now().toString(36).toUpperCase(),
      ];

      const result = await mssInventoryService.assignSerialsToBulkStock({
        stock_id: bulkStock.id,
        serial_numbers: serials,
      });

      assert.strictEqual(result.convertedDevices.length, 2);
      assert.strictEqual(result.remainingStock, null);

      const allDevices = await mssInventoryService.getDevices();
      const bulkExists = allDevices.some(d => d.id === bulkStock.id);
      assert.strictEqual(bulkExists, false, 'Fully converted bulk stock row must be removed');
    });

    test('3.3 Validation: rejects assigning more serials than available bulk quantity', async () => {
      const bulkStock = await mssInventoryService.createBulkStock({
        model_id: testModel.id,
        quantity: 2,
        stock_location: 'محل 1',
        purchase_cost: 5000,
        list_price: 7000,
      });

      await assert.rejects(
        async () => {
          await mssInventoryService.assignSerialsToBulkStock({
            stock_id: bulkStock.id,
            serial_numbers: ['SN-X1', 'SN-X2', 'SN-X3'],
          });
        },
        /يتجاوز الكمية المتاحة/
      );
    });

    test('3.4 Validation: rejects duplicate serial numbers within batch and against existing stock', async () => {
      const bulkStock = await mssInventoryService.createBulkStock({
        model_id: testModel.id,
        quantity: 5,
        stock_location: 'محل 1',
        purchase_cost: 5000,
        list_price: 7000,
      });

      // Internal batch duplicate
      await assert.rejects(
        async () => {
          await mssInventoryService.assignSerialsToBulkStock({
            stock_id: bulkStock.id,
            serial_numbers: ['SN-DUP-SAME', 'SN-DUP-SAME'],
          });
        },
        /تكرار في أرقام السيريال/
      );

      // Existing system serial duplicate
      const existingSerial = 'SN-EXISTING-' + Date.now().toString(36).toUpperCase();
      await mssInventoryService.createDevice({
        serial_number: existingSerial,
        model_id: testModel.id,
        purchase_cost: 5000,
        list_price: 7000,
        stock_location: 'محل 1',
        status: 'AVAILABLE',
      });

      await assert.rejects(
        async () => {
          await mssInventoryService.assignSerialsToBulkStock({
            stock_id: bulkStock.id,
            serial_numbers: [existingSerial],
          });
        },
        /مسجل مسبقاً في النظام/
      );
    });

    test('3.5 Records conversion in inventory history/movements audit trail', async () => {
      const bulkStock = await mssInventoryService.createBulkStock({
        model_id: testModel.id,
        quantity: 2,
        stock_location: 'محل 1',
        purchase_cost: 5500,
        list_price: 7500,
      });

      const serial = 'SN-AUDIT-MOV-' + Date.now().toString(36).toUpperCase();
      await mssInventoryService.assignSerialsToBulkStock({
        stock_id: bulkStock.id,
        serial_numbers: [serial],
      });

      const movements = await mssInventoryService.getMovements();
      const foundMovement = movements.find(m => m.serial_number === serial);
      assert.ok(foundMovement, 'Must record movement audit row for converted device');
      assert.strictEqual(foundMovement.from_location, 'محل 1');
      assert.strictEqual(foundMovement.to_location, 'محل 1');
      assert.ok(foundMovement.notes.includes('تحويل من مخزون'));
    });
  });
});
