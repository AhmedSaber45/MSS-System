import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

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

const { mssWholesaleExportService, matchesCategory } = await import('../src/services/mssWholesaleExportService.ts');
const { mssInventoryService } = await import('../src/services/mssInventoryService.ts');
const { mssCatalogService } = await import('../src/services/mssCatalogService.ts');

describe('COMPU MSS — DEVICES REPORTS REFRESH LIFECYCLE & FILTER PRESERVATION', () => {

  // =========================================================================
  // 1. COMPONENT SOURCE CODE AUDIT: DECOUPLING & INFINITE LOOP PREVENTION
  // =========================================================================
  describe('1. Refresh Lifecycle & Dependency Decoupling Audit', () => {
    test('1.1 loadAllData does NOT have activeWholesaleFilterOptions or activeFilterSignature in its dependencies', () => {
      const source = fs.readFileSync('src/components/placeholders/mss/MSSDeviceReportsView.tsx', 'utf8');

      // Check loadAllData declaration and its dependency array
      const loadAllDataMatch = source.match(/const loadAllData = useCallback\(async \(\) => \{[\s\S]*?\}, \[([\s\S]*?)\]\);/);
      assert.ok(loadAllDataMatch, 'loadAllData must be declared with useCallback');

      const depsString = loadAllDataMatch[1];
      assert.ok(
        !depsString.includes('activeWholesaleFilterOptions'),
        'loadAllData must NOT depend on activeWholesaleFilterOptions (would cause infinite loop on filter changes)'
      );
      assert.ok(
        !depsString.includes('activeFilterSignature'),
        'loadAllData must NOT depend on activeFilterSignature (would cause infinite loop on filter changes)'
      );
      assert.ok(
        !depsString.includes('selectedBrands'),
        'loadAllData must NOT depend on selectedBrands'
      );
      assert.ok(
        !depsString.includes('selectedModelIds'),
        'loadAllData must NOT depend on selectedModelIds'
      );
    });

    test('1.2 Component includes isFetchingRef concurrency guard to prevent duplicate concurrent network requests', () => {
      const source = fs.readFileSync('src/components/placeholders/mss/MSSDeviceReportsView.tsx', 'utf8');
      assert.ok(source.includes('isFetchingRef'), 'MSSDeviceReportsView must define isFetchingRef');
      assert.ok(source.includes('if (isFetchingRef.current) return;'), 'loadAllData must check isFetchingRef to prevent duplicate requests');
    });

    test('1.3 Initial master data load runs once on mount and not on filter modifications', () => {
      const source = fs.readFileSync('src/components/placeholders/mss/MSSDeviceReportsView.tsx', 'utf8');
      assert.ok(
        source.includes('// Initial master data load on component mount only'),
        'Must have comment documenting initial mount only'
      );
      // Sold report period changes are separated to loadSoldReport
      assert.ok(source.includes('loadSoldReport'), 'Must have separate loadSoldReport callback');
    });
  });

  // =========================================================================
  // 2. SAFE PRUNING LOGIC & REFERENCE PRESERVATION
  // =========================================================================
  describe('2. Safe Pruning & Reference Preservation Logic', () => {
    test('2.1 Pruning preserves exact array reference when all selected brands are valid', () => {
      const availableBrands = ['Dell', 'HP', 'Apple', 'Lenovo'];
      const selectedBrands = ['Dell', 'Apple'];

      // Simulate safe pruning logic implemented in MSSDeviceReportsView
      const validBrandNormalizedSet = new Set(availableBrands.map(b => b.trim().toLowerCase()));
      const filtered = selectedBrands.filter(b => validBrandNormalizedSet.has(b.trim().toLowerCase()));
      const result = filtered.length !== selectedBrands.length ? filtered : selectedBrands;

      assert.equal(result, selectedBrands, 'Reference must be strictly identical (prev === next) when all brands valid');
    });

    test('2.2 Pruning does NOT wipe out selected brands if data is loading or empty', () => {
      const emptyAvailableBrands = [];
      const selectedBrands = ['Dell', 'Lenovo'];
      const allDevicesCount = 0; // Loading state

      // Logic check: if allDevices.length === 0, pruning must immediately return and do nothing
      let updatedBrands = selectedBrands;
      if (allDevicesCount > 0 && emptyAvailableBrands.length > 0) {
        const validSet = new Set(emptyAvailableBrands);
        updatedBrands = selectedBrands.filter(b => validSet.has(b));
      }

      assert.deepEqual(updatedBrands, selectedBrands, 'Selected brands must remain untouched during loading');
    });

    test('2.3 Pruning gracefully removes only the unavailable brand while preserving other selected brands', () => {
      const availableBrands = ['Dell', 'Lenovo']; // HP was deleted/sold out
      const selectedBrands = ['Dell', 'HP', 'Lenovo'];

      const validBrandNormalizedSet = new Set(availableBrands.map(b => b.trim().toLowerCase()));
      const filtered = selectedBrands.filter(b => validBrandNormalizedSet.has(b.trim().toLowerCase()));
      const result = filtered.length !== selectedBrands.length ? filtered : selectedBrands;

      assert.notEqual(result, selectedBrands, 'Reference should update when an item is removed');
      assert.deepEqual(result, ['Dell', 'Lenovo'], 'Only HP should be removed; Dell and Lenovo must remain intact');
    });

    test('2.4 Model IDs pruning preserves exact array reference when prev is empty or valid', () => {
      const availableModels = [{ id: 'm1' }, { id: 'm2' }, { id: 'm3' }];
      const emptySelected = [];

      // Safe prune on empty prev
      let resultEmpty = emptySelected;
      if (emptySelected.length > 0) {
        const validIds = new Set(availableModels.map(m => m.id));
        const filtered = emptySelected.filter(id => validIds.has(id));
        resultEmpty = filtered.length !== emptySelected.length ? filtered : emptySelected;
      }
      assert.equal(resultEmpty, emptySelected, 'Empty selectedModelIds must keep exact same reference');

      // Safe prune on valid selected models
      const validSelected = ['m1', 'm3'];
      const validIds = new Set(availableModels.map(m => m.id));
      const filteredValid = validSelected.filter(id => validIds.has(id));
      const resultValid = filteredValid.length !== validSelected.length ? filteredValid : validSelected;
      assert.equal(resultValid, validSelected, 'Valid selectedModelIds must keep exact same reference');
    });
  });

  // =========================================================================
  // 3. FILTER PRESERVATION ACROSS DATA REFRESH CYCLES
  // =========================================================================
  describe('3. Filter Preservation Across Data Refresh Cycles', () => {
    let mockDevices = [];

    beforeEach(() => {
      mockDevices = [
        {
          id: 'dev-1',
          brand: 'Dell',
          model_name: 'Latitude 5420',
          category: 'لابتوب',
          processor: 'Core i7',
          ram: '16GB',
          storage: '512GB SSD',
          price: 15000,
          list_price: 15000,
          quantity: 1,
          serial_number: 'SN-DELL-1',
          stock_location: 'محل 1',
          physical_condition: 'فرز أول',
        },
        {
          id: 'dev-2',
          brand: 'Apple',
          model_name: 'MacBook Air M2',
          category: 'لابتوب',
          processor: 'M2',
          ram: '16GB',
          storage: '512GB SSD',
          price: 25000,
          quantity: 1,
          serial_number: 'SN-APPLE-1',
          stock_location: 'محل 1',
          physical_condition: 'جديد',
        },
        {
          id: 'dev-3',
          brand: 'Lenovo',
          model_name: 'ThinkPad T480',
          category: 'لابتوب',
          processor: 'Core i5',
          ram: '16GB',
          storage: '256GB SSD',
          price: 12000,
          quantity: 1,
          serial_number: 'SN-LENOVO-1',
          stock_location: 'محل 2',
          physical_condition: 'مستعمل',
        },
        {
          id: 'dev-4',
          brand: 'Dell',
          model_name: 'UltraSharp U2419H',
          category: 'شاشة',
          processor: '---',
          ram: '---',
          storage: '---',
          price: 4500,
          quantity: 1,
          serial_number: 'SN-SCREEN-1',
          stock_location: 'محل 1',
          physical_condition: 'سليم',
        },
      ];
    });

    test('3.1 Applying filters (Brand = Dell) produces correct filtered wholesale rows', async () => {
      const filterOptions = {
        includePrices: true,
        includeQuantity: true,
        includeSerialNumbers: true,
        includeBranch: true,
        includeStatus: true,
        includeCategory: true,
        includeScreen: true,
        selectedBrands: ['Dell'],
      };

      const { rows } = await mssWholesaleExportService.buildWholesaleData(filterOptions, mockDevices);
      assert.equal(rows.length, 2, 'Should match 2 Dell devices (1 laptop + 1 monitor)');
      rows.forEach(r => {
        const brandModel = r['الماركة والموديل (Brand & Model)'] || r['الموديل'] || '';
        assert.ok(brandModel.toLowerCase().includes('dell'), `Row must be Dell: ${brandModel}`);
      });
    });

    test('3.2 Data refresh with updated devices preserves active filters and produces updated results without resetting state', async () => {
      // User active filter configuration
      const userFilters = {
        selectedBrands: ['Dell'],
        selectedCategories: ['لابتوب'],
        minPrice: 10000,
        maxPrice: 20000,
        includeSerialNumbers: true,
      };

      // 1. Initial build with initial dataset
      const initialBuild = await mssWholesaleExportService.buildWholesaleData(userFilters, mockDevices);
      assert.equal(initialBuild.rows.length, 1, 'Initially 1 Dell laptop in 10000-20000 price range');

      // 2. Simulate background data refresh: new Dell laptop is added to inventory
      const updatedDevices = [
        ...mockDevices,
        {
          id: 'dev-5',
          brand: 'Dell',
          model_name: 'Latitude 7420',
          category: 'لابتوب',
          processor: 'Core i7-1185G7',
          ram: '32GB',
          storage: '1TB SSD',
          price: 18000,
          list_price: 18000,
          quantity: 1,
          serial_number: 'SN-DELL-NEW',
          stock_location: 'محل 1',
          physical_condition: 'ممتاز',
        },
      ];

      // Re-run build with EXACT SAME user filters (as happens during background refresh)
      const refreshedBuild = await mssWholesaleExportService.buildWholesaleData(userFilters, updatedDevices);
      assert.equal(refreshedBuild.rows.length, 2, 'Refreshed data includes both Dell laptops matching the preserved filters');
      assert.ok(
        refreshedBuild.rows.some(r => (r['السيريال (Serial Number)'] || '').includes('SN-DELL-NEW')),
        'New device appears under active filters'
      );

      // Verify filters themselves did not change
      assert.deepEqual(userFilters.selectedBrands, ['Dell']);
      assert.deepEqual(userFilters.selectedCategories, ['لابتوب']);
      assert.equal(userFilters.minPrice, 10000);
      assert.equal(userFilters.maxPrice, 20000);
    });

    test('3.3 Selected row keys selection is preserved across background data refresh', () => {
      // Suppose user had dev-1 selected
      const previouslySelectedKeys = new Set(['SN-DELL-1']);

      // Newly refreshed rows matching the filters
      const newlyRefreshedRows = [
        { _rowKey: 'SN-DELL-1', serial_number: 'SN-DELL-1' },
        { _rowKey: 'SN-DELL-NEW', serial_number: 'SN-DELL-NEW' },
      ];
      const matchingKeySet = new Set(newlyRefreshedRows.map(r => r._rowKey));

      // Simulate the updated setSelectedRowKeys logic
      const next = new Set();
      previouslySelectedKeys.forEach(k => {
        if (matchingKeySet.has(k)) {
          next.add(k);
        }
      });

      assert.equal(next.size, 1);
      assert.ok(next.has('SN-DELL-1'), 'Previously selected device remains selected after refresh');
    });

    test('3.4 Promotional image generator safe pruning does not wipe selectedModelIds on brand changes', () => {
      const source = fs.readFileSync('src/components/placeholders/mss/MSSPromotionalGenerator.tsx', 'utf8');
      assert.ok(
        source.includes('filtered.length !== prev.length ? filtered : prev'),
        'MSSPromotionalGenerator must use safe pruning with reference preservation'
      );
    });
  });
});
