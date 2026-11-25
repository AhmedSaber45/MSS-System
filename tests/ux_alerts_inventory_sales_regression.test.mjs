import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Ensure isolated test environment (no production Supabase calls)
const {
  getEffectiveDeviceQuantity,
  deduplicateDevicesById,
  resolveCanonicalBranchName,
  aggregateInventorySummary,
  aggregateInventoryValuationByLocation,
} = await import('../src/services/mssInventoryAggregation.ts');

test('UX Improvements, Alert Standardization & Inventory Accuracy Regression Suite', async (t) => {
  await t.test('1. Accessories Promotional Image: uses Megaphone icon and AlertModal (no native confirm)', () => {
    const navContent = fs.readFileSync(path.resolve('src/config/navigationConfig.ts'), 'utf8');
    const viewContent = fs.readFileSync(
      path.resolve('src/components/placeholders/accessories/AccessoriesPromotionalView.tsx'),
      'utf8'
    );

    assert.ok(navContent.includes('Megaphone'), 'Navigation config must import Megaphone icon');
    assert.ok(!navContent.includes('icon: Sparkles'), 'promotional-image nav item must no longer use Sparkles');
    assert.ok(viewContent.includes('<Megaphone'), 'AccessoriesPromotionalView header must use Megaphone icon');
    assert.ok(viewContent.includes('<AlertModal'), 'AccessoriesPromotionalView must use AlertModal for confirmation');
    assert.ok(!viewContent.includes('window.confirm('), 'AccessoriesPromotionalView must not call window.confirm');
  });

  await t.test('2. Program-wide Alert Standardization: zero native alert/confirm/prompt in frontend UI code', () => {
    const dirsToScan = [
      path.resolve('src'),
      path.resolve('admin-dashboard/src'),
      path.resolve('public-mss-inventory/src'),
    ];
    const nativeCallPattern = /\b(window\.alert|window\.confirm|window\.prompt|alert|confirm|prompt)\s*\(/;
    const violations = [];

    function walk(dir) {
      if (!fs.existsSync(dir)) return;
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(fullPath);
        } else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
          const lines = fs.readFileSync(fullPath, 'utf8').split(/\r?\n/);
          lines.forEach((line, idx) => {
            const trimmed = line.trim();
            if (trimmed.startsWith('//') || trimmed.startsWith('*')) return;
            if (nativeCallPattern.test(line)) {
              violations.push(`${path.relative(process.cwd(), fullPath)}:${idx + 1}: ${trimmed}`);
            }
          });
        }
      }
    }

    dirsToScan.forEach(walk);
    assert.deepEqual(violations, [], `Found native browser alert/confirm/prompt calls: ${violations.join('\n')}`);
  });

  await t.test('3. MSS Sales Bulk Controls & Select Displayed integration', () => {
    const salesContent = fs.readFileSync(
      path.resolve('src/components/placeholders/mss/MSSSalesView.tsx'),
      'utf8'
    );
    const selectContent = fs.readFileSync(
      path.resolve('src/components/common/SearchableItemSelect.tsx'),
      'utf8'
    );

    // Clear + and - buttons in both dropdown list and cart table
    assert.ok(salesContent.includes('aria-label="إنقاص الكمية"'), 'Bulk quantity decrease button must have aria-label');
    assert.ok(salesContent.includes('aria-label="زيادة الكمية"'), 'Bulk quantity increase button must have aria-label');
    assert.ok(salesContent.includes('handleMultiSelectDevices'), 'MSSSalesView must wire handleMultiSelectDevices');
    assert.ok(salesContent.includes('onMultiSelectChange={handleMultiSelectDevices}'), 'SearchableItemSelect must receive onMultiSelectChange');
    assert.ok(salesContent.includes('isItemDisabled='), 'MSSSalesView must guard ineligible devices');

    // SearchableItemSelect must support Select Displayed even without onMultiSelectChange and respect isItemDisabled
    assert.ok(selectContent.includes('eligibleFilteredItems'), 'SearchableItemSelect must compute eligibleFilteredItems');
    assert.ok(selectContent.includes('allFilteredSelected'), 'SearchableItemSelect must track allFilteredSelected');
  });

  await t.test('4. MSS Inventory Accuracy: 42 total / 38 available (Mohamed Fahim 34, Ayman 4, Mahmoud Masoud 0)', () => {
    const stores = [
      { id: 'st-1', code: 'MF', name: 'Mohamed Fahim' },
      { id: 'st-2', code: 'AY', name: 'Ayman' },
      { id: 'st-3', code: 'MM', name: 'Mahmoud Masoud' },
    ];

    // Isolated mock dataset matching exact distribution:
    // Mohamed Fahim: 4 serialized AVAILABLE + 1 bulk row with quantity 30 AVAILABLE = 34 AVAILABLE
    // Ayman: 1 bulk row with quantity 4 AVAILABLE = 4 AVAILABLE
    // Mahmoud Masoud: 0 AVAILABLE
    // Plus 2 RESERVED (Mohamed Fahim) + 2 MAINTENANCE (Ayman) = 4 non-available -> 42 total
    const mockDevices = [
      { id: 'd1', model_id: 'm1', is_serialized: true, serial_number: 'SN1', stock_location: 'Mohamed Fahim', status: 'AVAILABLE', quantity: 1, purchase_cost: 10000, list_price: 12000 },
      { id: 'd2', model_id: 'm1', is_serialized: true, serial_number: 'SN2', stock_location: 'Mohamed Fahim', status: 'AVAILABLE', quantity: 1, purchase_cost: 10000, list_price: 12000 },
      { id: 'd3', model_id: 'm1', is_serialized: true, serial_number: 'SN3', stock_location: 'Mohamed Fahim', status: 'AVAILABLE', quantity: 1, purchase_cost: 10000, list_price: 12000 },
      { id: 'd4', model_id: 'm1', is_serialized: true, serial_number: 'SN4', stock_location: 'Mohamed Fahim', status: 'AVAILABLE', quantity: 1, purchase_cost: 10000, list_price: 12000 },
      { id: 'd5', model_id: 'm2', is_serialized: false, serial_number: null, stock_location: 'MF', status: 'AVAILABLE', quantity: 30, purchase_cost: 8000, list_price: 9500 },
      { id: 'd6', model_id: 'm3', is_serialized: false, serial_number: null, stock_location: 'Ayman', status: 'AVAILABLE', quantity: 4, purchase_cost: 15000, list_price: 18000 },
      { id: 'd7', model_id: 'm1', is_serialized: false, serial_number: null, stock_location: 'Mohamed Fahim', status: 'RESERVED', quantity: 2, purchase_cost: 10000, list_price: 12000 },
      { id: 'd8', model_id: 'm1', is_serialized: true, serial_number: 'SN8', stock_location: 'Ayman', status: 'MAINTENANCE', quantity: 1, purchase_cost: 10000, list_price: 12000 },
      { id: 'd9', model_id: 'm1', is_serialized: true, serial_number: 'SN9', stock_location: 'Ayman', status: 'MAINTENANCE', quantity: 1, purchase_cost: 10000, list_price: 12000 },
    ];

    // Introduce duplicate join row to ensure deduplication protects totals
    const withDuplicate = [...mockDevices, { ...mockDevices[4] }];
    assert.equal(deduplicateDevicesById(withDuplicate).length, mockDevices.length);

    const summary = aggregateInventorySummary(withDuplicate, stores);
    assert.equal(summary.total_units, 42, 'Total devices must be 42');
    assert.equal(summary.available_total, 38, 'Available for sale must be 38');
    assert.equal(summary.location_breakdown['Mohamed Fahim'], 34, 'Mohamed Fahim available must be 34');
    assert.equal(summary.location_breakdown['Ayman'], 4, 'Ayman available must be 4');
    assert.equal(summary.location_breakdown['Mahmoud Masoud'] || 0, 0, 'Mahmoud Masoud available must be 0');
    assert.equal(summary.reserved_total, 2);
    assert.equal(summary.maintenance_total, 2);

    const branchValuations = aggregateInventoryValuationByLocation(
      withDuplicate,
      ['Mohamed Fahim', 'Ayman', 'Mahmoud Masoud'],
      stores
    );

    const mf = branchValuations.find(b => b.location === 'Mohamed Fahim');
    const ayman = branchValuations.find(b => b.location === 'Ayman');
    const mm = branchValuations.find(b => b.location === 'Mahmoud Masoud');
    const grand = branchValuations.find(b => b.location === 'المجموع الكلي');

    assert.ok(mf && ayman && mm && grand);
    assert.equal(mf.availableUnits, 34, 'Reports Mohamed Fahim availableUnits must be 34');
    assert.equal(mf.totalUnits, 36, 'Reports Mohamed Fahim totalUnits (34 avail + 2 reserved) must be 36');
    assert.equal(mf.totalCostValue, 4 * 10000 + 30 * 8000 + 2 * 10000, 'Cost value must multiply by bulk quantity');
    assert.equal(mf.totalListValue, 4 * 12000 + 30 * 9500 + 2 * 12000, 'List value must multiply by bulk quantity');

    assert.equal(ayman.availableUnits, 4, 'Reports Ayman availableUnits must be 4');
    assert.equal(ayman.maintenanceUnits, 2);
    assert.equal(ayman.totalUnits, 6);
    assert.equal(ayman.totalCostValue, 4 * 15000 + 2 * 10000);

    assert.equal(mm.availableUnits, 0, 'Reports Mahmoud Masoud availableUnits must be 0');
    assert.equal(mm.totalUnits, 0);
    assert.equal(mm.totalCostValue, 0);

    assert.equal(grand.availableUnits, 38, 'Reports Grand Total availableUnits must equal 38');
    assert.equal(grand.totalUnits, 42, 'Reports Grand Total totalUnits must equal 42');
  });

  await t.test('5. Missing or unmapped branch is preserved as غير محدد without corrupting active branches', () => {
    const stores = [{ id: 'st-1', code: 'MF', name: 'Mohamed Fahim' }];
    assert.equal(resolveCanonicalBranchName('', stores), 'غير محدد');
    assert.equal(resolveCanonicalBranchName('MF', stores), 'Mohamed Fahim');
    assert.equal(resolveCanonicalBranchName('  Mohamed Fahim  ', stores), 'Mohamed Fahim');
    assert.equal(getEffectiveDeviceQuantity({ quantity: 12, is_serialized: false, serial_number: null }), 12);
    assert.equal(getEffectiveDeviceQuantity({ quantity: 0, is_serialized: true, serial_number: 'SN' }), 1);

    const val = aggregateInventoryValuationByLocation(
      [{ id: 'x1', stock_location: '', status: 'AVAILABLE', quantity: 3, purchase_cost: 5000, list_price: 6000 }],
      ['Mohamed Fahim'],
      stores
    );
    const unmapped = val.find(v => v.location === 'غير محدد');
    const mf = val.find(v => v.location === 'Mohamed Fahim');
    assert.equal(unmapped?.availableUnits, 3);
    assert.equal(mf?.availableUnits, 0);
  });
});
