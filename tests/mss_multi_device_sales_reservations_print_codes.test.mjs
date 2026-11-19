// Comprehensive Automated Verification Suite for:
// 1. Multi-Device Sales in a Single Invoice
// 2. Customer and Store Signatures on A4 Invoice
// 3. Multiple Invoice Output Formats (A4, Thermal, PDF)
// 4. Non-Serialized Bulk Inventory Default & Creation
// 5. Multi-Device Reservations & Fulfill/Cancel
// 6. Unique Branch/Warehouse Codes (PREFIX-001)

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

// Import services and helpers dynamically
const { mssCommerceService } = await import('../src/services/mssCommerceService.ts');
const { mssInventoryService } = await import('../src/services/mssInventoryService.ts');
const { mssCatalogService } = await import('../src/services/mssCatalogService.ts');
const { mssOperationalService } = await import('../src/services/mssOperationalService.ts');
const { extractBranchCodePrefix, generateBranchCode } = await import('../src/lib/branchCodeGenerator.ts');

describe('COMPU MSS — Multi-Device Sales, Reservations, Print & Inventory Suite', () => {
  let testModel;

  beforeEach(async () => {
    const models = await mssCatalogService.getModels();
    testModel = models[0] || (await mssCatalogService.createModel({
      brand: 'Dell',
      model_name: 'Latitude 5520',
      category: 'Laptop',
      processor: 'Core i7-1185G7',
      gpu: 'Intel Iris Xe',
      ram: '16GB DDR4',
      storage: '512GB NVMe SSD',
      screen_size: '15.6 Inch FHD',
    }));
  });

  // ============================================================================
  // REQUIREMENT 1: MULTI-DEVICE SALES IN A SINGLE INVOICE
  // ============================================================================
  describe('1. Multi-Device Sales in a Single Invoice', () => {
    test('1.1 Single serialized device sale retains backward compatibility and records snapshots', async () => {
      const serial = 'SN-SALE-SNGL-' + Date.now().toString(36).toUpperCase();
      const dev = await mssInventoryService.createDevice({
        serial_number: serial,
        model_id: testModel.id,
        purchase_cost: 8000,
        list_price: 11000,
        stock_location: 'محل 1',
        status: 'AVAILABLE',
        physical_condition: 'ممتاز',
      });

      const invoice = await mssCommerceService.confirmSale({
        device_id: dev.id,
        selling_branch: 'محل 1',
        actual_sale_price: 10500,
        discount_amount: 500,
        customer_name: 'عميل فردي',
        customer_phone: '01000000001',
      });

      assert.ok(invoice.id);
      assert.strictEqual(invoice.actual_sale_price, 10500);
      assert.strictEqual(invoice.discount_amount, 500);
      assert.strictEqual(invoice.list_price_snapshot, 11000);
      assert.strictEqual(invoice.cost_snapshot, 8000);
      assert.strictEqual(invoice.gross_profit, 2500);
      assert.strictEqual(invoice.serial_number, serial);
      assert.strictEqual(invoice.items?.length, 1);
      assert.strictEqual(invoice.items[0].serial_number, serial);

      // Verify stock status updated to SOLD
      const reloadedDev = await mssInventoryService.getDeviceById(dev.id);
      assert.strictEqual(reloadedDev.status, 'SOLD');
    });

    test('1.2 Multiple serialized devices in one single sales invoice with individual details and totals', async () => {
      const s1 = 'SN-SALE-MULTI-1-' + Date.now().toString(36).toUpperCase();
      const s2 = 'SN-SALE-MULTI-2-' + Date.now().toString(36).toUpperCase();

      const dev1 = await mssInventoryService.createDevice({
        serial_number: s1,
        model_id: testModel.id,
        purchase_cost: 7000,
        list_price: 9500,
        stock_location: 'محل 1',
        status: 'AVAILABLE',
      });

      const dev2 = await mssInventoryService.createDevice({
        serial_number: s2,
        model_id: testModel.id,
        purchase_cost: 10000,
        list_price: 14000,
        stock_location: 'محل 2',
        status: 'AVAILABLE',
      });

      const invoice = await mssCommerceService.confirmSale({
        selling_branch: 'محل 1',
        actual_sale_price: 22500,
        discount_amount: 1000,
        customer_name: 'شركة التقنية المتطورة',
        customer_phone: '01011112222',
        items: [
          {
            device_id: dev1.id,
            quantity: 1,
            unit_price: 9000,
            discount_amount: 500,
            actual_sale_price: 9000,
            source_branch: 'محل 1',
          },
          {
            device_id: dev2.id,
            quantity: 1,
            unit_price: 13500,
            discount_amount: 500,
            actual_sale_price: 13500,
            source_branch: 'محل 2',
          },
        ],
      });

      assert.ok(invoice.id);
      assert.strictEqual(invoice.items?.length, 2, 'Must contain 2 line items');
      assert.strictEqual(invoice.items_count, 2);
      assert.strictEqual(invoice.actual_sale_price, 22500);
      assert.strictEqual(invoice.cost_snapshot, 17000, 'Total cost must equal 7000 + 10000');
      assert.strictEqual(invoice.gross_profit, 5500, 'Gross profit must equal 22500 - 17000');
      assert.strictEqual(invoice.subtotal, 23500, 'Subtotal before discount must equal 9500 + 14000');

      // Verify each device retains individual identity & serial
      const item1 = invoice.items.find(i => i.serial_number === s1);
      const item2 = invoice.items.find(i => i.serial_number === s2);
      assert.ok(item1 && item2);
      assert.strictEqual(item1.cost_snapshot, 7000);
      assert.strictEqual(item2.cost_snapshot, 10000);
      assert.strictEqual(item1.source_branch, 'محل 1');
      assert.strictEqual(item2.source_branch, 'محل 2');

      // Both devices must now be SOLD
      const reDev1 = await mssInventoryService.getDeviceById(dev1.id);
      const reDev2 = await mssInventoryService.getDeviceById(dev2.id);
      assert.strictEqual(reDev1.status, 'SOLD');
      assert.strictEqual(reDev2.status, 'SOLD');
    });

    test('1.3 Non-serialized bulk stock sale with quantity decrements stock accurately', async () => {
      const bulkDev = await mssInventoryService.createDevice({
        is_serialized: false,
        model_id: testModel.id,
        quantity: 10,
        purchase_cost: 2000,
        list_price: 3000,
        stock_location: 'محل 1',
        status: 'AVAILABLE',
      });

      const invoice = await mssCommerceService.confirmSale({
        selling_branch: 'محل 1',
        actual_sale_price: 12000,
        items: [
          {
            device_id: bulkDev.id,
            quantity: 4,
            unit_price: 3000,
            actual_sale_price: 12000,
            source_branch: 'محل 1',
          },
        ],
      });

      assert.strictEqual(invoice.items?.length, 1);
      assert.strictEqual(invoice.items[0].quantity, 4);
      assert.strictEqual(invoice.items[0].is_serialized, false);

      // Remaining stock should be 10 - 4 = 6
      const reloaded = await mssInventoryService.getDeviceById(bulkDev.id);
      assert.strictEqual(reloaded.quantity, 6);
      assert.strictEqual(reloaded.status, 'AVAILABLE');
    });

    test('1.4 Mixed invoice combining serialized device and bulk stock in one sale', async () => {
      const serial = 'SN-MIXED-' + Date.now().toString(36).toUpperCase();
      const sDev = await mssInventoryService.createDevice({
        serial_number: serial,
        model_id: testModel.id,
        purchase_cost: 6000,
        list_price: 8000,
        stock_location: 'محل 1',
        status: 'AVAILABLE',
      });

      const bDev = await mssInventoryService.createDevice({
        is_serialized: false,
        model_id: testModel.id,
        quantity: 5,
        purchase_cost: 1500,
        list_price: 2500,
        stock_location: 'محل 2',
        status: 'AVAILABLE',
      });

      const invoice = await mssCommerceService.confirmSale({
        selling_branch: 'محل 1',
        actual_sale_price: 12500, // 7500 (serialized) + 5000 (2 bulk @ 2500)
        items: [
          {
            device_id: sDev.id,
            quantity: 1,
            unit_price: 7500,
            discount_amount: 500,
            actual_sale_price: 7500,
            source_branch: 'محل 1',
          },
          {
            device_id: bDev.id,
            quantity: 2,
            unit_price: 2500,
            actual_sale_price: 5000,
            source_branch: 'محل 2',
          },
        ],
      });

      assert.strictEqual(invoice.items?.length, 2);
      assert.strictEqual(invoice.items_count, 3, 'Total units count must be 1 serialized + 2 bulk = 3');

      // Check stock updates
      const reSDev = await mssInventoryService.getDeviceById(sDev.id);
      const reBDev = await mssInventoryService.getDeviceById(bDev.id);
      assert.strictEqual(reSDev.status, 'SOLD');
      assert.strictEqual(reBDev.quantity, 3);
    });

    test('1.5 Prevents duplicate selection of the same serialized device', async () => {
      const serial = 'SN-DUP-CHECK-' + Date.now().toString(36).toUpperCase();
      const dev = await mssInventoryService.createDevice({
        serial_number: serial,
        model_id: testModel.id,
        purchase_cost: 5000,
        list_price: 7000,
        stock_location: 'محل 1',
        status: 'AVAILABLE',
      });

      await assert.rejects(
        async () => {
          await mssCommerceService.confirmSale({
            selling_branch: 'محل 1',
            actual_sale_price: 14000,
            items: [
              { device_id: dev.id, quantity: 1, unit_price: 7000 },
              { device_id: dev.id, quantity: 1, unit_price: 7000 },
            ],
          });
        },
        /تكرار اختيار نفس الجهاز/
      );
    });

    test('1.6 Prevents overselling more bulk units than available stock', async () => {
      const bDev = await mssInventoryService.createDevice({
        is_serialized: false,
        model_id: testModel.id,
        quantity: 3,
        purchase_cost: 1000,
        list_price: 2000,
        stock_location: 'محل 1',
        status: 'AVAILABLE',
      });

      await assert.rejects(
        async () => {
          await mssCommerceService.confirmSale({
            selling_branch: 'محل 1',
            actual_sale_price: 10000,
            items: [{ device_id: bDev.id, quantity: 5, unit_price: 2000 }],
          });
        },
        /أكبر من المخزون المتاح/
      );
    });
  });

  // ============================================================================
  // REQUIREMENT 2 & 3: INVOICE PRINTING, OUTPUT FORMATS & SIGNATURES
  // ============================================================================
  describe('2 & 3. Multiple Invoice Output Formats & Signatures on A4 Invoice', () => {
    test('2.1 MSSPrintableInvoice component source contains Customer and Store signatures for A4', () => {
      const printComponentPath = path.join(process.cwd(), 'src/components/placeholders/mss/MSSPrintableInvoice.tsx');
      assert.ok(fs.existsSync(printComponentPath), 'MSSPrintableInvoice.tsx must exist');

      const content = fs.readFileSync(printComponentPath, 'utf8');
      assert.ok(content.includes('توقيع العميل'), 'Must have Customer Signature heading');
      assert.ok(content.includes('توقيع وختم المحل') || content.includes('الإدارة'), 'Must have Store / Management Signature heading');
      assert.ok(content.includes('border-dashed'), 'Must contain clean blank signature lines/boxes for handwritten signing');
      assert.ok(!content.includes('data:image/svg+xml') && !content.includes('fake_signature'), 'Must NOT contain fake digital signatures');
    });

    test('3.1 Supports all three formats: A4, Thermal receipt (POS 80mm), and PDF Export', () => {
      const printComponentPath = path.join(process.cwd(), 'src/components/placeholders/mss/MSSPrintableInvoice.tsx');
      const content = fs.readFileSync(printComponentPath, 'utf8');

      // Check format toggle and layouts
      assert.ok(content.includes('format === \'a4\''), 'Must support A4 layout');
      assert.ok(content.includes('format === \'thermal\''), 'Must support Thermal receipt layout');
      assert.ok(content.includes('documentPrintService.printElement'), 'Must integrate documentPrintService for printing');
      assert.ok(content.includes('documentPrintService.exportToPdf'), 'Must integrate documentPrintService for PDF export');
      assert.ok(content.includes('80mm') || content.includes('w-[302px]'), 'Thermal receipt must use POS 80mm width standard');
    });

    test('3.2 Thermal receipt and A4 display all line items in multi-device invoices', () => {
      const printComponentPath = path.join(process.cwd(), 'src/components/placeholders/mss/MSSPrintableInvoice.tsx');
      const content = fs.readFileSync(printComponentPath, 'utf8');

      // Both A4 and thermal iterate through items
      assert.ok(content.includes('items.map'), 'Must render each item dynamically in invoice');
      assert.ok(content.includes('item.serial_number'), 'Must display individual serial numbers when present');
      assert.ok(content.includes('item.quantity'), 'Must display non-serialized quantities');
    });

    test('3.3 MSSSalesView and MSSInvoicesView integrate MSSPrintableInvoice', () => {
      const salesViewPath = path.join(process.cwd(), 'src/components/placeholders/mss/MSSSalesView.tsx');
      const invoicesViewPath = path.join(process.cwd(), 'src/components/placeholders/mss/MSSInvoicesView.tsx');

      const salesContent = fs.readFileSync(salesViewPath, 'utf8');
      const invoicesContent = fs.readFileSync(invoicesViewPath, 'utf8');

      assert.ok(salesContent.includes('MSSPrintableInvoice'), 'MSSSalesView must import and render MSSPrintableInvoice');
      assert.ok(invoicesContent.includes('MSSPrintableInvoice'), 'MSSInvoicesView must import and render MSSPrintableInvoice');
    });
  });

  // ============================================================================
  // REQUIREMENT 4: NON-SERIALIZED BULK INVENTORY CREATION ERROR FIX
  // ============================================================================
  describe('4. Fix Non-Serialized Bulk Inventory Creation Error & Default Selection', () => {
    test('4.1 MSSDeviceCreationModal defaults to BULK mode and has stable initialMode', () => {
      const modalPath = path.join(process.cwd(), 'src/components/placeholders/mss/MSSDeviceCreationModal.tsx');
      assert.ok(fs.existsSync(modalPath));
      const content = fs.readFileSync(modalPath, 'utf8');

      assert.ok(content.includes("initialMode = 'BULK'"), 'Default mode must be BULK');
      assert.ok(content.includes('DEFAULT_LOCATIONS'), 'Must have stabilized locationOptions reference');
      assert.ok(content.includes('prevIsOpenRef'), 'Must use prevIsOpenRef to prevent form state resets on state changes');
    });

    test('4.2 Creating non-serialized bulk stock works without requiring fake serial numbers', async () => {
      const bulkItem = await mssInventoryService.createDevice({
        is_serialized: false,
        model_id: testModel.id,
        quantity: 15,
        purchase_cost: 3200,
        list_price: 4500,
        stock_location: 'محل 1',
        status: 'AVAILABLE',
      });

      assert.ok(bulkItem.id);
      assert.strictEqual(bulkItem.is_serialized, false);
      assert.strictEqual(bulkItem.quantity, 15);
      assert.strictEqual(bulkItem.serial_number, null, 'Must not generate fake serial number');
      assert.strictEqual(bulkItem.purchase_cost, 3200);
      assert.strictEqual(bulkItem.list_price, 4500);
    });
  });

  // ============================================================================
  // REQUIREMENT 5: MULTI-DEVICE RESERVATIONS
  // ============================================================================
  describe('5. Multi-Device Reservations', () => {
    test('5.1 Multi-device reservation reserves multiple serialized devices simultaneously', async () => {
      const s1 = 'SN-RES-MULTI-1-' + Date.now().toString(36).toUpperCase();
      const s2 = 'SN-RES-MULTI-2-' + Date.now().toString(36).toUpperCase();

      const dev1 = await mssInventoryService.createDevice({
        serial_number: s1,
        model_id: testModel.id,
        purchase_cost: 9000,
        list_price: 13000,
        stock_location: 'محل 1',
        status: 'AVAILABLE',
      });

      const dev2 = await mssInventoryService.createDevice({
        serial_number: s2,
        model_id: testModel.id,
        purchase_cost: 11000,
        list_price: 16000,
        stock_location: 'محل 2',
        status: 'AVAILABLE',
      });

      const res = await mssCommerceService.createReservation({
        branch: 'محل 1',
        customer_name: 'المهندس طارق',
        customer_phone: '01022334455',
        deposit_amount: 2000,
        agreed_price: 28000,
        expiry_date: new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0],
        items: [
          { device_id: dev1.id, agreed_price: 12500, source_branch: 'محل 1' },
          { device_id: dev2.id, agreed_price: 15500, source_branch: 'محل 2' },
        ],
      });

      assert.ok(res.id);
      assert.strictEqual(res.items?.length, 2);
      assert.strictEqual(res.agreed_price, 28000);
      assert.strictEqual(res.deposit_amount, 2000);
      assert.strictEqual(res.status, 'ACTIVE');

      // Both devices must be RESERVED
      const reDev1 = await mssInventoryService.getDeviceById(dev1.id);
      const reDev2 = await mssInventoryService.getDeviceById(dev2.id);
      assert.strictEqual(reDev1.status, 'RESERVED');
      assert.strictEqual(reDev2.status, 'RESERVED');
    });

    test('5.2 Reserving non-serialized bulk stock decrements available quantity during reservation', async () => {
      const bulkDev = await mssInventoryService.createDevice({
        is_serialized: false,
        model_id: testModel.id,
        quantity: 8,
        purchase_cost: 1800,
        list_price: 2600,
        stock_location: 'محل 1',
        status: 'AVAILABLE',
      });

      const res = await mssCommerceService.createReservation({
        branch: 'محل 1',
        customer_name: 'شركة النور',
        customer_phone: '01234567890',
        deposit_amount: 1000,
        agreed_price: 7500,
        items: [
          { device_id: bulkDev.id, quantity: 3, agreed_price: 7500, source_branch: 'محل 1' },
        ],
      });

      assert.strictEqual(res.items?.length, 1);
      assert.strictEqual(res.items[0].quantity, 3);

      // Available quantity must be 8 - 3 = 5
      const reloaded = await mssInventoryService.getDeviceById(bulkDev.id);
      assert.strictEqual(reloaded.quantity, 5);
    });

    test('5.3 Cancelling a multi-device reservation restores stock for all items', async () => {
      const s = 'SN-RES-CANCEL-' + Date.now().toString(36).toUpperCase();
      const dev = await mssInventoryService.createDevice({
        serial_number: s,
        model_id: testModel.id,
        purchase_cost: 6000,
        list_price: 9000,
        stock_location: 'محل 1',
        status: 'AVAILABLE',
      });

      const bDev = await mssInventoryService.createDevice({
        is_serialized: false,
        model_id: testModel.id,
        quantity: 6,
        purchase_cost: 1500,
        list_price: 2200,
        stock_location: 'محل 2',
        status: 'AVAILABLE',
      });

      const res = await mssCommerceService.createReservation({
        branch: 'محل 1',
        customer_name: 'عميل إلغاء',
        customer_phone: '01000000002',
        deposit_amount: 500,
        agreed_price: 13000,
        items: [
          { device_id: dev.id, agreed_price: 8800, source_branch: 'محل 1' },
          { device_id: bDev.id, quantity: 2, agreed_price: 4200, source_branch: 'محل 2' },
        ],
      });

      // Verify stock was allocated
      let dCheck = await mssInventoryService.getDeviceById(dev.id);
      let bCheck = await mssInventoryService.getDeviceById(bDev.id);
      assert.strictEqual(dCheck.status, 'RESERVED');
      assert.strictEqual(bCheck.quantity, 4);

      // Cancel the reservation
      await mssCommerceService.cancelReservation(res.id, 'إلغاء لطلب العميل');

      // Check stock restored
      dCheck = await mssInventoryService.getDeviceById(dev.id);
      bCheck = await mssInventoryService.getDeviceById(bDev.id);
      assert.strictEqual(dCheck.status, 'AVAILABLE', 'Serialized device must be restored to AVAILABLE');
      assert.strictEqual(bCheck.quantity, 6, 'Bulk quantity must be restored back to 6');
    });

    test('5.4 Fulfilling multi-device reservation converts all reserved items into a sales invoice', async () => {
      const s = 'SN-RES-FULFILL-' + Date.now().toString(36).toUpperCase();
      const dev = await mssInventoryService.createDevice({
        serial_number: s,
        model_id: testModel.id,
        purchase_cost: 5000,
        list_price: 7500,
        stock_location: 'محل 1',
        status: 'AVAILABLE',
      });

      const res = await mssCommerceService.createReservation({
        branch: 'محل 1',
        customer_name: 'أحمد إتمام الحجز',
        customer_phone: '01033334444',
        deposit_amount: 1000,
        agreed_price: 7200,
        items: [{ device_id: dev.id, agreed_price: 7200, source_branch: 'محل 1' }],
      });

      const invoice = await mssCommerceService.confirmSale({
        device_id: dev.id,
        selling_branch: res.branch,
        actual_sale_price: res.agreed_price,
        customer_name: res.customer_name,
        customer_phone: res.customer_phone,
        reservation_id: res.id,
        items: [{ device_id: dev.id, quantity: 1, unit_price: 7200, actual_sale_price: 7200, source_branch: 'محل 1' }],
      });

      assert.ok(invoice.id);
      assert.strictEqual(invoice.actual_sale_price, 7200);

      // Verify reservation is FULFILLED and device is SOLD
      const reRes = (await mssCommerceService.getReservations()).find(r => r.id === res.id);
      assert.strictEqual(reRes.status, 'FULFILLED');

      const reDev = await mssInventoryService.getDeviceById(dev.id);
      assert.strictEqual(reDev.status, 'SOLD');
    });
  });

  // ============================================================================
  // REQUIREMENT 6: UNIQUE BRANCH/WAREHOUSE CODES (PREFIX-001)
  // ============================================================================
  describe('6. Unique Branch/Warehouse Codes (PREFIX-001)', () => {
    test('6.1 Prefix generation rules: 1 word, 2 words, 3 words, and > 3 words in English & Arabic', () => {
      // 1 word -> first two letters
      assert.strictEqual(extractBranchCodePrefix('Cairo'), 'CA');
      assert.strictEqual(extractBranchCodePrefix('Alexandria'), 'AL');

      // 2 words -> first letter of each
      assert.strictEqual(extractBranchCodePrefix('Nasr City'), 'NC');
      assert.strictEqual(extractBranchCodePrefix('New Cairo'), 'NC');

      // 3 words -> first letter of each
      assert.strictEqual(extractBranchCodePrefix('Tanta Free Area'), 'TFA');
      assert.strictEqual(extractBranchCodePrefix('Al Rehab Mall'), 'ARM');

      // > 3 words -> first letter of first 3 words only
      assert.strictEqual(extractBranchCodePrefix('Mall of Egypt Giza City'), 'MOE');

      // Arabic names transliteration
      assert.strictEqual(extractBranchCodePrefix('فرع مدينة نصر'), 'FMN');
      assert.strictEqual(extractBranchCodePrefix('مخزن رئيسي'), 'MR');
      assert.strictEqual(extractBranchCodePrefix('القاهرة'), 'QA');
    });

    test('6.2 Generates PREFIX-001 format with sequential 3-digit numbering', () => {
      const code1 = generateBranchCode('Tanta Free Area', []);
      assert.strictEqual(code1, 'TFA-001');

      const code2 = generateBranchCode('Nasr City', ['NC-001']);
      assert.strictEqual(code2, 'NC-002');

      const code3 = generateBranchCode('Cairo', ['CA-001', 'CA-002']);
      assert.strictEqual(code3, 'CA-003');
    });

    test('6.3 Safely resolves collisions across branches with same prefix', () => {
      // Two branches with prefix NC (e.g. Nasr City and New Cairo)
      const existing = ['NC-001', 'NC-002', 'NC-005'];
      // Next available number should safely be NC-003 (filling gaps sequentially without collisions)
      const nextCode = generateBranchCode('New Cairo', existing);
      assert.strictEqual(nextCode, 'NC-003');
    });

    test('6.4 Validates uniqueness in mssOperationalService when updating store code', async () => {
      // Create a store
      const store1 = await mssOperationalService.createStore({
        name: 'فرع الجيزة الدولي',
        type: 'BRANCH',
        code: 'FJD-001',
      });

      assert.ok(store1.id);
      assert.strictEqual(store1.code, 'FJD-001');

      // Attempting to update another store to the same code FJD-001 must throw
      const store2 = await mssOperationalService.createStore({
        name: 'فرع المعادي الجديد',
        type: 'BRANCH',
        code: 'FMJ-001',
      });

      await assert.rejects(
        async () => {
          await mssOperationalService.updateStore({
            id: store2.id,
            code: 'FJD-001',
          });
        },
        /مسجل مسبقاً/
      );
    });
  });

  // ============================================================================
  // REQUIREMENT 7: MIGRATION FILE EXISTENCE & SAFETY
  // ============================================================================
  describe('7. Migration File Verification', () => {
    test('7.1 Consolidated migration file exists and is marked NOT EXECUTED', () => {
      const migrationPath = path.join(
        process.cwd(),
        'supabase/migrations/20261119_phase_mss_multi_device_sales_reservations_and_codes.sql'
      );
      assert.ok(fs.existsSync(migrationPath), 'Migration file must exist');

      const sql = fs.readFileSync(migrationPath, 'utf8');
      assert.ok(sql.includes('STATUS: NOT EXECUTED'), 'Must state STATUS: NOT EXECUTED in header');
      assert.ok(sql.includes('mss_invoice_items'), 'Must define mss_invoice_items table');
      assert.ok(sql.includes('mss_reservation_items'), 'Must define mss_reservation_items table');
      assert.ok(sql.includes('subtotal'), 'Must alter mss_invoices with subtotal');
      assert.ok(sql.includes('items_count'), 'Must alter mss_invoices with items_count');
      assert.ok(sql.includes('ENABLE ROW LEVEL SECURITY'), 'Must enable RLS');
    });
  });
});
