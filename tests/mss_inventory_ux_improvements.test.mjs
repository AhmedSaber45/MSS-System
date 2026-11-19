// Automated Verification Test Suite for Phase: Compu MSS Inventory & UX Improvements
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

// Import services and helpers dynamically
const { mssInventoryService } = await import('../src/services/mssInventoryService.ts');
const { mssCatalogService } = await import('../src/services/mssCatalogService.ts');
const { mssCommerceService } = await import('../src/services/mssCommerceService.ts');
const { mssOperationalService } = await import('../src/services/mssOperationalService.ts');
const { generateBranchCode } = await import('../src/lib/branchCodeGenerator.ts');

describe('Compu MSS Inventory & UX Improvements Verification', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // ==============================================================================
  // 1. MAKE LAPTOP SERIAL NUMBERS OPTIONAL
  // ==============================================================================
  describe('1. Optional Device Serial Numbers', () => {
    test('1.1 Allows adding and storing a device with no serial number (null / empty)', async () => {
      const models = await mssCatalogService.getModels();
      const model = models[0];

      // Add device with omitted serial_number
      const devNoSerial = await mssInventoryService.createDevice({
        model_id: model.id,
        purchase_cost: 6000,
        list_price: 8500,
        stock_location: 'محل 1',
        physical_condition: 'فرز أول كسر زيرو',
      });

      assert.ok(devNoSerial.id);
      assert.strictEqual(devNoSerial.serial_number, null, 'Omitted serial should be stored as null');
      assert.strictEqual(devNoSerial.is_serialized, false, 'Should be flagged as is_serialized: false');
      assert.strictEqual(devNoSerial.status, 'AVAILABLE');

      // Verify it can be retrieved by ID
      const fetched = await mssInventoryService.getDeviceById(devNoSerial.id);
      assert.ok(fetched);
      assert.strictEqual(fetched.serial_number, null);
    });

    test('1.2 Empty whitespace serial string normalizes to null without creating fake serials', async () => {
      const models = await mssCatalogService.getModels();
      const model = models[0];

      const devWhitespace = await mssInventoryService.createDevice({
        serial_number: '    ',
        model_id: model.id,
        purchase_cost: 7200,
        list_price: 9500,
        stock_location: 'محل 2',
      });

      assert.strictEqual(devWhitespace.serial_number, null, 'Whitespace serial must normalize to null');
      assert.strictEqual(devWhitespace.is_serialized, false);
    });

    test('1.3 Serialized devices continue to enforce uppercase formatting and uniqueness', async () => {
      const models = await mssCatalogService.getModels();
      const model = models[0];
      const uniqueSerial = 'SN-OPT-' + Date.now().toString(36).toUpperCase() + '-A';

      const devWithSerial = await mssInventoryService.createDevice({
        serial_number: uniqueSerial.toLowerCase(),
        model_id: model.id,
        purchase_cost: 8000,
        list_price: 11000,
        stock_location: 'محل 1',
      });

      assert.strictEqual(devWithSerial.serial_number, uniqueSerial.toUpperCase());
      assert.strictEqual(devWithSerial.is_serialized, true);

      // Re-registering the same serial must fail
      await assert.rejects(
        async () => {
          await mssInventoryService.createDevice({
            serial_number: uniqueSerial,
            model_id: model.id,
            purchase_cost: 8000,
            list_price: 11000,
            stock_location: 'محل 1',
          });
        },
        /مسجل مسبقاً|يمنع تكرار السيريالات/i
      );
    });

    test('1.4 Non-serialized devices can be updated and optionally assigned a serial later', async () => {
      const models = await mssCatalogService.getModels();
      const model = models[0];

      const dev = await mssInventoryService.createDevice({
        model_id: model.id,
        purchase_cost: 5500,
        list_price: 7800,
        stock_location: 'محل 1',
      });
      assert.strictEqual(dev.serial_number, null);

      const assignedSerial = 'SN-LATER-' + Date.now().toString(36).toUpperCase();
      const updated = await mssInventoryService.updateDevice(dev.id, {
        serial_number: assignedSerial,
        list_price: 8200,
      });

      assert.strictEqual(updated.serial_number, assignedSerial);
      assert.strictEqual(updated.is_serialized, true);
      assert.strictEqual(updated.list_price, 8200);
    });
  });

  // ==============================================================================
  // 2. SEARCH IN LARGE ITEM-SELECTION LISTS
  // ==============================================================================
  describe('2. Real-Time Search in Selection Modals', () => {
    test('2.1 Multi-field text matching filters devices across brand, model, specs, and serial', async () => {
      const devices = await mssInventoryService.getDevices();

      // Simulate the SearchableItemSelect filter function
      const searchFn = (query) => {
        const q = query.trim().toLowerCase();
        return devices.filter(d => {
          const text = `${d.serial_number || ''} ${d.brand || ''} ${d.model_name || ''} ${d.stock_location} ${d.model?.processor || ''} ${d.model?.gpu || ''}`.toLowerCase();
          return text.includes(q);
        });
      };

      // Search by brand
      const dellResults = searchFn('Dell');
      assert.ok(dellResults.length > 0);
      assert.ok(dellResults.every(d => d.brand?.toLowerCase().includes('dell')));

      // Search by location
      const shop1Results = searchFn('محل 1');
      assert.ok(shop1Results.length > 0);
      assert.ok(shop1Results.every(d => d.stock_location === 'محل 1'));

      // Search by existing serial
      const serialResults = searchFn('PF1K892-LEN');
      assert.strictEqual(serialResults.length, 1);
      assert.strictEqual(serialResults[0].serial_number, 'PF1K892-LEN');
    });

    test('2.2 Selection retention: selected item remains selected even when query filters it out of view', () => {
      const items = [
        { id: '1', name: 'Dell XPS 15', serial: 'SN-001' },
        { id: '2', name: 'Lenovo ThinkPad T480', serial: 'SN-002' },
        { id: '3', name: 'HP EliteBook 840', serial: 'SN-003' },
      ];

      let selectedId = '2'; // Lenovo selected

      // User searches for "Dell"
      const query = 'Dell';
      const visibleFiltered = items.filter(i => i.name.toLowerCase().includes(query.toLowerCase()));

      assert.strictEqual(visibleFiltered.length, 1);
      assert.strictEqual(visibleFiltered[0].id, '1');

      // The selected ID is still '2' (preserved)
      assert.strictEqual(selectedId, '2');

      // User clears search
      const resetFiltered = items.filter(i => i.name.toLowerCase().includes(''));
      assert.strictEqual(resetFiltered.length, 3);
      assert.strictEqual(selectedId, '2');
    });
  });

  // ==============================================================================
  // 3. AUTOMATIC BRANCH / WAREHOUSE CODE GENERATION
  // ==============================================================================
  describe('3. Automatic Branch/Warehouse Code Generation Rules (PREFIX-001 format)', () => {
    test('3.1 Rule: 1 word -> first two letters with 3-digit suffix', () => {
      assert.strictEqual(generateBranchCode('Cairo'), 'CA-001');
      assert.strictEqual(generateBranchCode('Alexandria'), 'AL-001');
      assert.strictEqual(generateBranchCode('Giza'), 'GI-001');
      assert.strictEqual(generateBranchCode('القاهرة'), 'QA-001');
    });

    test('3.2 Rule: 2 words -> first letter of each word with 3-digit suffix', () => {
      assert.strictEqual(generateBranchCode('Nasr City'), 'NC-001');
      assert.strictEqual(generateBranchCode('New Cairo'), 'NC-001');
      assert.strictEqual(generateBranchCode('مدينة نصر'), 'MN-001');
      assert.strictEqual(generateBranchCode('محل رئيسي'), 'MR-001');
    });

    test('3.3 Rule: 3 words -> first letter of each word with 3-digit suffix', () => {
      assert.strictEqual(generateBranchCode('The First Agency'), 'TFA-001');
      assert.strictEqual(generateBranchCode('New Cairo Branch'), 'NCB-001');
      assert.strictEqual(generateBranchCode('فرع مدينة نصر'), 'FMN-001');
      assert.strictEqual(generateBranchCode('Main Warehouse Alex'), 'MWA-001');
    });

    test('3.4 Rule: >3 words -> first letter of first 3 words only with 3-digit suffix', () => {
      assert.strictEqual(generateBranchCode('New Cairo Fifth Settlement'), 'NCF-001');
      assert.strictEqual(generateBranchCode('New Cairo Fifth Settlement District'), 'NCF-001');
      assert.strictEqual(generateBranchCode('فرع مدينة نصر التجمع الخامس'), 'FMN-001');
    });

    test('3.5 Handles extra spaces, trimming, and empty words gracefully', () => {
      assert.strictEqual(generateBranchCode('   Nasr    City   '), 'NC-001');
      assert.strictEqual(generateBranchCode(''), '');
      assert.strictEqual(generateBranchCode('   '), '');
    });

    test('3.6 Sequential 3-digit suffix prevents duplicates and increments safely', () => {
      const existing = ['CA-001', 'CA-002', 'NC-001', 'TFA-001'];
      assert.strictEqual(generateBranchCode('Cairo', existing), 'CA-003');
      assert.strictEqual(generateBranchCode('Nasr City', existing), 'NC-002');
      assert.strictEqual(generateBranchCode('The First Agency', existing), 'TFA-002');
    });

    test('3.7 Integration in mssOperationalService.createStore verifies uniqueness', async () => {
      const stores = await mssOperationalService.getStores();
      const existingCodes = stores.map(s => s.code);

      const generated = generateBranchCode('Downtown Branch', existingCodes);
      assert.ok(generated);

      const newStore = await mssOperationalService.createStore(
        {
          name: 'فرع وسط البلد',
          code: generated,
          type: 'STORE',
          address: 'شارع طلعت حرب',
        },
        'admin'
      );
      assert.ok(newStore.id);
      assert.strictEqual(newStore.code, generated);

      // Attempting to create another store with the exact same code should throw duplicate error
      await assert.rejects(
        async () => {
          await mssOperationalService.createStore(
            {
              name: 'فرع مكرر الكود',
              code: generated,
              type: 'STORE',
            },
            'admin'
          );
        },
        /مسجل مسبقاً|يمنع تكرار كود/i
      );
    });
  });

  // ==============================================================================
  // 4. SUPPORT SERIALIZED AND NON-SERIALIZED STOCK & FUTURE ASSIGNMENT
  // ==============================================================================
  describe('4. Serialized vs Non-Serialized Stock & Future Serial Assignment', () => {
    test('4.1 Option B: Registers bulk stock with model and quantity without serial numbers', async () => {
      const models = await mssCatalogService.getModels();
      const model = models[0];

      const bulkBatch = await mssInventoryService.createBulkStock({
        model_id: model.id,
        quantity: 8,
        stock_location: 'محل 1',
        purchase_cost: 7500,
        list_price: 10500,
        physical_condition: 'جديد بالكرتونة',
        notes: 'دفعة توريد مجمعة بدون سيريالات',
      });

      assert.ok(bulkBatch.id);
      assert.strictEqual(bulkBatch.serial_number, null, 'Bulk batch has no serial');
      assert.strictEqual(bulkBatch.is_serialized, false, 'Marked non-serialized');
      assert.strictEqual(bulkBatch.quantity, 8, 'Has quantity 8');
      assert.strictEqual(bulkBatch.status, 'AVAILABLE');

      const retrieved = await mssInventoryService.getDeviceById(bulkBatch.id);
      assert.strictEqual(retrieved?.quantity, 8);
    });

    test('4.2 Future Serial Assignment: Partial conversion of bulk stock into serialized units', async () => {
      const models = await mssCatalogService.getModels();
      const model = models[0];

      // Create bulk stock of 6 units
      const bulkBatch = await mssInventoryService.createBulkStock({
        model_id: model.id,
        quantity: 6,
        stock_location: 'محل 1',
        purchase_cost: 6500,
        list_price: 9000,
      });

      // Assign 2 serial numbers
      const serialsToAssign = [
        'SN-BULK-01-' + Date.now().toString(36).toUpperCase(),
        'SN-BULK-02-' + Date.now().toString(36).toUpperCase(),
      ];

      const assignmentResult = await mssInventoryService.assignSerialsToBulkStock({
        stock_id: bulkBatch.id,
        serial_numbers: serialsToAssign,
        notes: 'تعيين سيريالات لأول جهازين للبيع الفردي',
      });

      assert.strictEqual(assignmentResult.convertedDevices.length, 2);
      assert.ok(assignmentResult.remainingStock);
      assert.strictEqual(assignmentResult.remainingStock.quantity, 4, 'Remaining bulk quantity is 6 - 2 = 4');

      // Verify converted individual units
      for (const dev of assignmentResult.convertedDevices) {
        assert.ok(dev.id);
        assert.strictEqual(dev.is_serialized, true);
        assert.strictEqual(dev.quantity, 1);
        assert.ok(serialsToAssign.includes(dev.serial_number));
        assert.strictEqual(dev.purchase_cost, 6500, 'Preserved unit cost');
        assert.strictEqual(dev.list_price, 9000, 'Preserved list price');
        assert.strictEqual(dev.stock_location, 'محل 1', 'Preserved stock location');
      }
    });

    test('4.3 Future Serial Assignment: Full conversion of remaining bulk stock', async () => {
      const models = await mssCatalogService.getModels();
      const model = models[0];

      const bulkBatch = await mssInventoryService.createBulkStock({
        model_id: model.id,
        quantity: 3,
        stock_location: 'محل 2',
        purchase_cost: 5000,
        list_price: 7000,
      });

      const serials = [
        'SN-FULL-01-' + Date.now().toString(36).toUpperCase(),
        'SN-FULL-02-' + Date.now().toString(36).toUpperCase(),
        'SN-FULL-03-' + Date.now().toString(36).toUpperCase(),
      ];

      const res = await mssInventoryService.assignSerialsToBulkStock({
        stock_id: bulkBatch.id,
        serial_numbers: serials,
      });

      assert.strictEqual(res.convertedDevices.length, 3);
      assert.strictEqual(res.remainingStock, null, 'Remaining stock should be null when all converted');

      // Original bulk batch is removed
      const bulkAfter = await mssInventoryService.getDeviceById(bulkBatch.id);
      assert.strictEqual(bulkAfter, null, 'Original bulk record is spliced out when fully converted');
    });

    test('4.4 Assignment validation rejects over-allocation and duplicate serials', async () => {
      const models = await mssCatalogService.getModels();
      const model = models[0];

      const bulkBatch = await mssInventoryService.createBulkStock({
        model_id: model.id,
        quantity: 2,
        stock_location: 'محل 1',
        purchase_cost: 4000,
        list_price: 6000,
      });

      // Attempt to assign 3 serials to batch of 2
      await assert.rejects(
        async () => {
          await mssInventoryService.assignSerialsToBulkStock({
            stock_id: bulkBatch.id,
            serial_numbers: ['SN-ERR-1', 'SN-ERR-2', 'SN-ERR-3'],
          });
        },
        /يتجاوز الكمية المتاحة/i
      );

      // Attempt to assign duplicates within the list
      await assert.rejects(
        async () => {
          await mssInventoryService.assignSerialsToBulkStock({
            stock_id: bulkBatch.id,
            serial_numbers: ['SN-DUP-SAME', 'SN-DUP-SAME'],
          });
        },
        /تكرار.*السيريال/i
      );
    });

    test('4.5 Selling a non-serialized unit from bulk batch decrements quantity cleanly', async () => {
      const models = await mssCatalogService.getModels();
      const model = models[0];

      const bulkBatch = await mssInventoryService.createBulkStock({
        model_id: model.id,
        quantity: 5,
        stock_location: 'محل 1',
        purchase_cost: 5000,
        list_price: 7500,
      });

      const inv = await mssCommerceService.confirmSale({
        device_id: bulkBatch.id,
        selling_branch: 'محل 1',
        actual_sale_price: 7500,
        customer_name: 'عميل شراء بالجملة/تجزئة',
      });

      assert.ok(inv.id);
      assert.strictEqual(inv.serial_number, null, 'Invoice has null serial');

      // Check remaining batch quantity
      const batchAfter = await mssInventoryService.getDeviceById(bulkBatch.id);
      assert.ok(batchAfter);
      assert.strictEqual(batchAfter.quantity, 4, 'Bulk batch quantity decremented to 4');
      assert.strictEqual(batchAfter.status, 'AVAILABLE', 'Remains available while quantity > 0');
    });
  });

  // ==============================================================================
  // 5. MODEL-BASED INVENTORY SUMMARY
  // ==============================================================================
  describe('5. Model-Based Inventory Summary & Aggregations', () => {
    test('5.1 Accurately groups inventory by model and branch with serialized and bulk counts', async () => {
      const models = await mssCatalogService.getModels();
      const model = models[0];

      // Add 2 serialized units in Shop 1
      await mssInventoryService.createDevice({
        model_id: model.id,
        serial_number: 'SN-MODSUM-01-' + Date.now().toString(36).toUpperCase(),
        stock_location: 'محل 1',
        purchase_cost: 7000,
        list_price: 9500,
      });
      await mssInventoryService.createDevice({
        model_id: model.id,
        serial_number: 'SN-MODSUM-02-' + Date.now().toString(36).toUpperCase(),
        stock_location: 'محل 1',
        purchase_cost: 7000,
        list_price: 9500,
      });

      // Add bulk stock of 5 units in Shop 1
      await mssInventoryService.createBulkStock({
        model_id: model.id,
        quantity: 5,
        stock_location: 'محل 1',
        purchase_cost: 7000,
        list_price: 9500,
      });

      const summaries = await mssInventoryService.getModelInventorySummary();
      assert.ok(Array.isArray(summaries));

      // Find the summary row for this model at Shop 1
      const shop1Summary = summaries.find(s => s.model_id === model.id && s.branch === 'محل 1');
      assert.ok(shop1Summary, 'Summary row for model at محل 1 must exist');

      assert.strictEqual(shop1Summary.model_name, model.model_name);
      assert.strictEqual(shop1Summary.brand, model.brand);
      assert.strictEqual(shop1Summary.branch, 'محل 1');

      // Check counts: at least 2 serialized + at least 5 non-serialized
      assert.ok(shop1Summary.available_serialized >= 2, 'At least 2 serialized units');
      assert.ok(shop1Summary.available_non_serialized >= 5, 'At least 5 non-serialized bulk units');
      assert.strictEqual(
        shop1Summary.total_available,
        shop1Summary.available_serialized + shop1Summary.available_non_serialized
      );

      // Verify underlying devices list is included for expand/drill-down
      assert.ok(Array.isArray(shop1Summary.devices));
      assert.ok(shop1Summary.devices.length >= 3); // 2 individual + 1 bulk
    });

    test('5.2 Overall inventory summary reflects total serialized vs non-serialized available units', async () => {
      const summary = await mssInventoryService.getInventorySummary();
      assert.ok(typeof summary.available_serialized_total === 'number');
      assert.ok(typeof summary.available_non_serialized_total === 'number');
      assert.strictEqual(
        summary.available_total,
        summary.available_serialized_total + summary.available_non_serialized_total
      );
    });
  });
});
