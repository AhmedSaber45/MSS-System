import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

describe('COMPU MSS — Sold Devices Display, Model Stock Summary & Sales Reports', () => {
  // Mock devices dataset
  const mockDevices = [
    { id: 'dev-1', model_id: 'mod-1', model_name: 'ThinkPad T14', brand: 'Lenovo', status: 'AVAILABLE', serial_number: 'SN-001', stock_location: 'محل 1', purchase_cost: 10000, list_price: 13000 },
    { id: 'dev-2', model_id: 'mod-1', model_name: 'ThinkPad T14', brand: 'Lenovo', status: 'SOLD', serial_number: 'SN-002', stock_location: 'محل 1', purchase_cost: 10000, list_price: 13000 },
    { id: 'dev-3', model_id: 'mod-1', model_name: 'ThinkPad T14', brand: 'Lenovo', status: 'RESERVED', serial_number: 'SN-003', stock_location: 'محل 1', purchase_cost: 10000, list_price: 13000 },
    { id: 'dev-4', model_id: 'mod-2', model_name: 'Latitude 5420', brand: 'Dell', status: 'SOLD', serial_number: 'SN-004', stock_location: 'محل 2', purchase_cost: 9000, list_price: 12000 },
    { id: 'dev-5', model_id: 'mod-2', model_name: 'Latitude 5420', brand: 'Dell', status: 'AVAILABLE', serial_number: 'SN-005', stock_location: 'محل 2', purchase_cost: 9000, list_price: 12000 },
    { id: 'dev-6', model_id: 'mod-2', model_name: 'Latitude 5420', brand: 'Dell', status: 'MAINTENANCE', serial_number: 'SN-006', stock_location: 'محل 2', purchase_cost: 9000, list_price: 12000 },
    { id: 'dev-7', model_id: 'mod-3', model_name: 'EliteBook 840 G8', brand: 'HP', status: 'SOLD', serial_number: 'SN-007', stock_location: 'محل 1', purchase_cost: 11000, list_price: 14500 },
    { id: 'dev-8', model_id: 'mod-3', model_name: 'EliteBook 840 G8', brand: 'HP', status: 'AVAILABLE', serial_number: 'SN-008', stock_location: 'محل 1', purchase_cost: 11000, list_price: 14500 },
    { id: 'dev-9', model_id: 'mod-3', model_name: 'EliteBook 840 G8', brand: 'HP', status: 'AVAILABLE', serial_number: 'SN-009', stock_location: 'محل 2', purchase_cost: 11000, list_price: 14500 },
    { id: 'dev-10', model_id: 'mod-4', model_name: 'MacBook Air M2', brand: 'Apple', status: 'SOLD', serial_number: 'SN-010', stock_location: 'محل 1', purchase_cost: 25000, list_price: 32000 },
  ];

  // =========================================================================
  // REQUIREMENT 1: Visually De-emphasize Sold Devices and Move to Bottom
  // =========================================================================
  describe('Requirement 1: Sold Devices Display & Ordering', () => {
    function partitionDevices(list) {
      const nonSold = [];
      const sold = [];
      for (const d of list) {
        if (d.status === 'SOLD') {
          sold.push(d);
        } else {
          nonSold.push(d);
        }
      }
      return [...nonSold, ...sold];
    }

    function getDeviceRowClassName(item) {
      return item.status === 'SOLD'
        ? 'opacity-60 bg-slate-50/80 text-slate-500 hover:bg-slate-100/80 transition-opacity'
        : undefined;
    }

    test('Sold devices are placed strictly after all non-sold devices', () => {
      const sorted = partitionDevices(mockDevices);
      const firstSoldIndex = sorted.findIndex(d => d.status === 'SOLD');
      const lastNonSoldIndex = sorted.findLastIndex(d => d.status !== 'SOLD');

      assert.ok(firstSoldIndex > lastNonSoldIndex, 'All non-sold devices must come before any sold device');
      assert.equal(sorted.length, mockDevices.length, 'All devices must be preserved without loss');
    });

    test('Non-sold devices retain their relative order among themselves', () => {
      const sorted = partitionDevices(mockDevices);
      const originalNonSold = mockDevices.filter(d => d.status !== 'SOLD').map(d => d.id);
      const resultNonSold = sorted.filter(d => d.status !== 'SOLD').map(d => d.id);
      assert.deepEqual(resultNonSold, originalNonSold, 'Relative order of non-sold devices must be preserved');
    });

    test('Sold devices retain their relative order among themselves', () => {
      const sorted = partitionDevices(mockDevices);
      const originalSold = mockDevices.filter(d => d.status === 'SOLD').map(d => d.id);
      const resultSold = sorted.filter(d => d.status === 'SOLD').map(d => d.id);
      assert.deepEqual(resultSold, originalSold, 'Relative order of sold devices must be preserved');
    });

    test('Faded styling is applied ONLY to SOLD devices and never to AVAILABLE/RESERVED/MAINTENANCE', () => {
      const availableClass = getDeviceRowClassName({ status: 'AVAILABLE' });
      const reservedClass = getDeviceRowClassName({ status: 'RESERVED' });
      const maintenanceClass = getDeviceRowClassName({ status: 'MAINTENANCE' });
      const soldClass = getDeviceRowClassName({ status: 'SOLD' });

      assert.equal(availableClass, undefined, 'AVAILABLE devices must not be faded');
      assert.equal(reservedClass, undefined, 'RESERVED devices must not be faded');
      assert.equal(maintenanceClass, undefined, 'MAINTENANCE devices must not be faded');
      assert.ok(soldClass.includes('opacity-60'), 'SOLD devices must have opacity-60');
      assert.ok(soldClass.includes('text-slate-500'), 'SOLD devices must have muted text');
    });

    test('Pagination with 9 items per page shows non-sold on page 1 and sold items at the bottom/page 2', () => {
      const sorted = partitionDevices(mockDevices);
      const page1 = sorted.slice(0, 9);
      const page2 = sorted.slice(9, 18);

      assert.equal(page1.length, 9);
      assert.equal(page2.length, 1);
      // Last item on page 2 must be SOLD
      assert.equal(page2[0].status, 'SOLD');
    });
  });

  // =========================================================================
  // REQUIREMENT 2: Reports — Sold Laptops by Model and Warehouse
  // =========================================================================
  describe('Requirement 2: Sold Laptops by Model and Warehouse Report', () => {
    const mockInvoices = [
      {
        id: 'inv-1',
        invoice_number: 'INV-101',
        is_returned: false,
        sale_date: '2024-11-10',
        items: [
          {
            model_id: 'mod-1',
            brand: 'Lenovo',
            model_name: 'ThinkPad T14',
            category: 'لابتوب',
            quantity: 2,
            actual_sale_price: 26000,
            source_branch: 'محل 1',
          },
          {
            model_id: 'mod-2',
            brand: 'Dell',
            model_name: 'Latitude 5420',
            category: 'لابتوب',
            quantity: 1,
            actual_sale_price: 12000,
            source_branch: 'محل 2',
          },
        ],
      },
      {
        id: 'inv-2',
        invoice_number: 'INV-102',
        is_returned: false,
        sale_date: '2024-11-12',
        items: [
          {
            model_id: 'mod-1',
            brand: 'Lenovo',
            model_name: 'ThinkPad T14',
            category: 'لابتوب',
            quantity: 1,
            actual_sale_price: 13000,
            source_branch: 'محل 2',
          },
        ],
      },
      {
        // Returned invoice — must be excluded
        id: 'inv-3',
        invoice_number: 'INV-103',
        is_returned: true,
        sale_date: '2024-11-14',
        items: [
          {
            model_id: 'mod-1',
            brand: 'Lenovo',
            model_name: 'ThinkPad T14',
            category: 'لابتوب',
            quantity: 5,
            actual_sale_price: 65000,
            source_branch: 'محل 1',
          },
        ],
      },
    ];

    function generateSoldLaptopsReport(invoices, warehouse = 'ALL') {
      const activeInvoices = invoices.filter(inv => !inv.is_returned);
      const itemMap = new Map();
      const warehouseTotals = { 'محل 1': 0, 'محل 2': 0 };
      let totalSoldUnits = 0;
      let totalRevenue = 0;

      for (const inv of activeInvoices) {
        for (const it of inv.items) {
          const itemWarehouse = it.source_branch || 'محل 1';
          if (warehouse !== 'ALL' && itemWarehouse !== warehouse) {
            continue;
          }

          const modelId = it.model_id;
          const qty = it.quantity || 1;
          const rev = it.actual_sale_price || 0;

          if (!itemMap.has(modelId)) {
            itemMap.set(modelId, {
              model_id: modelId,
              brand: it.brand,
              model_name: it.model_name,
              category: it.category,
              warehouse_breakdown: {},
              total_sold_units: 0,
              total_revenue: 0,
            });
          }

          const row = itemMap.get(modelId);
          row.warehouse_breakdown[itemWarehouse] = (row.warehouse_breakdown[itemWarehouse] || 0) + qty;
          row.total_sold_units += qty;
          row.total_revenue += rev;

          warehouseTotals[itemWarehouse] = (warehouseTotals[itemWarehouse] || 0) + qty;
          totalSoldUnits += qty;
          totalRevenue += rev;
        }
      }

      const items = Array.from(itemMap.values());
      items.sort((a, b) => b.total_sold_units - a.total_sold_units);

      return {
        selected_warehouse: warehouse,
        items,
        total_sold_units: totalSoldUnits,
        total_revenue: totalRevenue,
        warehouse_totals: warehouseTotals,
      };
    }

    test('All Warehouses report correctly breaks down sales per warehouse and computes grand total', () => {
      const rep = generateSoldLaptopsReport(mockInvoices, 'ALL');

      // Returned invoice (inv-3 with 5 units) must be excluded!
      assert.equal(rep.total_sold_units, 4, 'Total sold units should be 2 (inv-1) + 1 (inv-1) + 1 (inv-2) = 4');
      assert.equal(rep.total_revenue, 51000, 'Total revenue should be 26000 + 12000 + 13000 = 51000');
      assert.equal(rep.warehouse_totals['محل 1'], 2, 'محل 1 total sold units must be 2');
      assert.equal(rep.warehouse_totals['محل 2'], 2, 'محل 2 total sold units must be 2');

      // Check ThinkPad T14 breakdown
      const t14 = rep.items.find(i => i.model_id === 'mod-1');
      assert.ok(t14, 'ThinkPad T14 must be present');
      assert.equal(t14.total_sold_units, 3, 'T14 total sold units: 2 from محل 1 + 1 from محل 2');
      assert.equal(t14.warehouse_breakdown['محل 1'], 2);
      assert.equal(t14.warehouse_breakdown['محل 2'], 1);
      assert.equal(t14.total_revenue, 39000);
    });

    test('Specific warehouse filter (محل 1) returns ONLY sales attributed to محل 1', () => {
      const rep = generateSoldLaptopsReport(mockInvoices, 'محل 1');

      assert.equal(rep.selected_warehouse, 'محل 1');
      assert.equal(rep.total_sold_units, 2);
      assert.equal(rep.total_revenue, 26000);
      assert.equal(rep.items.length, 1);
      assert.equal(rep.items[0].model_id, 'mod-1');
      assert.equal(rep.items[0].total_sold_units, 2);
      assert.equal(rep.items[0].warehouse_breakdown['محل 1'], 2);
      assert.equal(rep.items[0].warehouse_breakdown['محل 2'], undefined);
    });

    test('Specific warehouse filter (محل 2) returns ONLY sales attributed to محل 2', () => {
      const rep = generateSoldLaptopsReport(mockInvoices, 'محل 2');

      assert.equal(rep.selected_warehouse, 'محل 2');
      assert.equal(rep.total_sold_units, 2);
      assert.equal(rep.total_revenue, 25000); // 12000 (mod-2) + 13000 (mod-1)
      assert.equal(rep.items.length, 2);
    });

    test('Returned invoices (is_returned: true) are strictly excluded from sold laptops report', () => {
      const rep = generateSoldLaptopsReport(mockInvoices, 'ALL');
      // INV-103 had 5 units of T14. If it was included, total would be 9.
      assert.equal(rep.total_sold_units, 4, 'Must strictly exclude returned sales');
    });
  });

  // =========================================================================
  // REQUIREMENT 3: Model Quantity Summary — Existing, Sold, and Total Units
  // =========================================================================
  describe('Requirement 3: Model Stock Quantity Summary & Invariant', () => {
    function computeModelSummary(devices, activeInvoices) {
      const groupMap = new Map();
      const recordedSoldDeviceIds = new Set();

      for (const d of devices) {
        const branch = d.stock_location || 'محل 1';
        const key = `${d.model_id}:::${branch}`;

        if (!groupMap.has(key)) {
          groupMap.set(key, {
            model_id: d.model_id,
            model_name: d.model_name,
            brand: d.brand,
            branch,
            available_serialized: 0,
            available_non_serialized: 0,
            total_available: 0,
            existing_units: 0,
            total_units: 0,
            reserved_count: 0,
            sold_count: 0,
            maintenance_count: 0,
          });
        }

        const acc = groupMap.get(key);
        const qty = d.quantity && d.quantity > 0 ? d.quantity : 1;
        const isSer = Boolean(d.serial_number);

        if (d.status === 'AVAILABLE') {
          acc.total_available += qty;
          acc.existing_units += qty;
          if (isSer) {
            acc.available_serialized += qty;
          } else {
            acc.available_non_serialized += qty;
          }
        } else if (d.status === 'RESERVED') {
          acc.reserved_count += qty;
          acc.existing_units += qty;
        } else if (d.status === 'MAINTENANCE') {
          acc.maintenance_count += qty;
          acc.existing_units += qty;
        } else if (d.status === 'SOLD') {
          acc.sold_count += qty;
          if (d.id) recordedSoldDeviceIds.add(d.id);
        }
      }

      // Add bulk stock sales from active invoices
      for (const inv of activeInvoices) {
        for (const it of inv.items) {
          if (it.device_id && recordedSoldDeviceIds.has(it.device_id)) {
            continue; // Already counted serialized device
          }
          const branch = it.source_branch || 'محل 1';
          const key = `${it.model_id}:::${branch}`;
          if (!groupMap.has(key)) {
            groupMap.set(key, {
              model_id: it.model_id,
              model_name: it.model_name,
              brand: it.brand,
              branch,
              available_serialized: 0,
              available_non_serialized: 0,
              total_available: 0,
              existing_units: 0,
              total_units: 0,
              reserved_count: 0,
              sold_count: 0,
              maintenance_count: 0,
            });
          }
          const acc = groupMap.get(key);
          const qty = Number(it.quantity) || 1;
          acc.sold_count += qty;
        }
      }

      // Enforce strict invariant: Total Units = Existing Units + Sold Units
      for (const acc of groupMap.values()) {
        acc.existing_units = acc.total_available + acc.reserved_count + acc.maintenance_count;
        acc.total_units = acc.existing_units + acc.sold_count;
      }

      return Array.from(groupMap.values());
    }

    test('Core invariant: Total Units = Existing Units + Sold Units strictly holds for all models', () => {
      // Setup mixed scenario:
      // Model 1:
      // - 2 Serialized Available
      // - 1 Serialized Reserved
      // - 1 Serialized Maintenance
      // - 1 Serialized Sold (in devices table)
      // - Bulk stock remaining: 5 Available
      // - Bulk stock sold: 3 via invoice
      const testDevices = [
        { id: 't1', model_id: 'm1', model_name: 'T1', brand: 'Lenovo', status: 'AVAILABLE', serial_number: 'SN-1', stock_location: 'محل 1' },
        { id: 't2', model_id: 'm1', model_name: 'T1', brand: 'Lenovo', status: 'AVAILABLE', serial_number: 'SN-2', stock_location: 'محل 1' },
        { id: 't3', model_id: 'm1', model_name: 'T1', brand: 'Lenovo', status: 'RESERVED', serial_number: 'SN-3', stock_location: 'محل 1' },
        { id: 't4', model_id: 'm1', model_name: 'T1', brand: 'Lenovo', status: 'MAINTENANCE', serial_number: 'SN-4', stock_location: 'محل 1' },
        { id: 't5', model_id: 'm1', model_name: 'T1', brand: 'Lenovo', status: 'SOLD', serial_number: 'SN-5', stock_location: 'محل 1' },
        { id: 'bulk-1', model_id: 'm1', model_name: 'T1', brand: 'Lenovo', status: 'AVAILABLE', quantity: 5, stock_location: 'محل 1' },
      ];

      const testInvoices = [
        {
          id: 'inv-bulk',
          is_returned: false,
          items: [
            // Sold 3 units of bulk stock (no device_id or not in recordedSoldDeviceIds)
            { model_id: 'm1', brand: 'Lenovo', model_name: 'T1', quantity: 3, source_branch: 'محل 1' },
            // Also sold t5 serialized device (device_id: 't5') - must NOT double-count!
            { device_id: 't5', model_id: 'm1', brand: 'Lenovo', model_name: 'T1', quantity: 1, source_branch: 'محل 1' },
          ],
        },
      ];

      const summaries = computeModelSummary(testDevices, testInvoices);
      const m1Summary = summaries.find(s => s.model_id === 'm1' && s.branch === 'محل 1');

      assert.ok(m1Summary, 'Model m1 summary must exist');

      // Existing units = 2 (avail serial) + 1 (reserved) + 1 (maint) + 5 (avail bulk) = 9
      assert.equal(m1Summary.existing_units, 9, 'Existing units must equal sum of all non-sold units');
      assert.equal(m1Summary.total_available, 7, 'Total available = 2 serial + 5 bulk = 7');
      assert.equal(m1Summary.reserved_count, 1, 'Reserved = 1');
      assert.equal(m1Summary.maintenance_count, 1, 'Maintenance = 1');

      // Sold units = 1 (t5 serialized) + 3 (bulk sold) = 4
      assert.equal(m1Summary.sold_count, 4, 'Sold units must equal 1 serialized + 3 bulk = 4 (without double-counting t5)');

      // Total units = 9 existing + 4 sold = 13
      assert.equal(m1Summary.total_units, 13, 'Total units must equal 9 + 4 = 13');

      // STRICT INVARIANT CHECK
      assert.equal(
        m1Summary.total_units,
        m1Summary.existing_units + m1Summary.sold_count,
        'CRITICAL: Total Units MUST equal Existing Units + Sold Units'
      );
    });

    test('Non-sold statuses (Reserved and Maintenance) are included in Existing Units and not lost', () => {
      const devices = [
        { id: 'r1', model_id: 'm2', model_name: 'M2', brand: 'Dell', status: 'RESERVED', serial_number: 'SR-1', stock_location: 'محل 2' },
        { id: 'm1', model_id: 'm2', model_name: 'M2', brand: 'Dell', status: 'MAINTENANCE', serial_number: 'SM-1', stock_location: 'محل 2' },
      ];
      const summaries = computeModelSummary(devices, []);
      const m2 = summaries.find(s => s.model_id === 'm2');

      assert.equal(m2.existing_units, 2, 'Reserved and Maintenance units must be counted in Existing Units');
      assert.equal(m2.sold_count, 0, 'No sold units');
      assert.equal(m2.total_units, 2, 'Total units = 2');
      assert.equal(m2.total_units, m2.existing_units + m2.sold_count);
    });
  });
});
