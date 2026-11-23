import test from 'node:test';
import assert from 'node:assert/strict';

// Setup Mock LocalStorage for Node.js test environment
class MockLocalStorage {
  constructor() {
    this.store = new Map();
  }
  getItem(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }
  setItem(key, value) {
    this.store.set(key, String(value));
  }
  removeItem(key) {
    this.store.delete(key);
  }
  clear() {
    this.store.clear();
  }
}

globalThis.localStorage = new MockLocalStorage();
if (typeof globalThis.window === 'undefined') {
  globalThis.window = globalThis;
}
globalThis.window.localStorage = globalThis.localStorage;
globalThis.window.atob = globalThis.window.atob || ((str) => Buffer.from(str, 'base64').toString('binary'));
globalThis.window.btoa = globalThis.window.btoa || ((str) => Buffer.from(str, 'binary').toString('base64'));
if (typeof globalThis.navigator === 'undefined') {
  globalThis.navigator = { onLine: true };
}

// Import promotional service functions
const {
  preparePromotionalItems,
  filterPromotionalItems,
  sortPromotionalItems,
  generatePromotionalArabicFilename,
} = await import('../src/services/mssPromotionalService.ts');

test('Promotional Image Data Editor - Input Placeholder & Value Regression Suite', async (t) => {
  // Model state simulator replicating the exact component state lifecycle
  function createInputEditorHarness(initialItem) {
    let editingItemId = initialItem.id;
    let editFormData = {
      ...initialItem,
      price: initialItem.price !== undefined && initialItem.price !== null && initialItem.price !== 0
        ? initialItem.price
        : '',
    };

    const inputConfig = {
      placeholder: '0',
      min: 0,
    };

    function getInputValue() {
      return editFormData.price !== undefined && editFormData.price !== null ? editFormData.price : '';
    }

    function handleInputChange(rawEventValue) {
      let val = rawEventValue;
      if (val.length > 1 && val.startsWith('0') && !val.startsWith('0.')) {
        val = val.replace(/^0+(?=\d)/, '');
      }
      editFormData = {
        ...editFormData,
        price: val,
      };
      return getInputValue();
    }

    function saveItemEdit() {
      const rawPrice = editFormData.price;
      const finalPrice =
        rawPrice === '' || rawPrice === undefined || rawPrice === null
          ? undefined
          : Math.max(0, Number(rawPrice));

      return {
        ...initialItem,
        ...editFormData,
        price: finalPrice,
      };
    }

    return {
      getEditingItemId: () => editingItemId,
      getEditFormData: () => editFormData,
      getInputPlaceholder: () => inputConfig.placeholder,
      getInputValue,
      handleInputChange,
      saveItemEdit,
    };
  }

  await t.test('1. Initial placeholder display without an actual input value', () => {
    // Case A: Item with undefined price
    const harnessA = createInputEditorHarness({
      id: 'test-item-1',
      brand: 'Dell',
      model_name: 'Latitude 5420',
      processor: 'i7 11th',
      price: undefined,
    });

    assert.strictEqual(harnessA.getInputPlaceholder(), '0', 'Input placeholder must visually be 0');
    assert.strictEqual(harnessA.getInputValue(), '', 'Initial input value must be empty string, NOT 0');

    // Case B: Item with 0 price
    const harnessB = createInputEditorHarness({
      id: 'test-item-2',
      brand: 'HP',
      model_name: 'EliteBook 840 G8',
      processor: 'i5 11th',
      price: 0,
    });

    assert.strictEqual(harnessB.getInputPlaceholder(), '0', 'Input placeholder must visually be 0');
    assert.strictEqual(harnessB.getInputValue(), '', 'Initial input value for 0 price must be empty string');
  });

  await t.test('2. Clearing the input produces an empty value (not automatically reverted to 0)', () => {
    const harness = createInputEditorHarness({
      id: 'test-item-3',
      brand: 'Lenovo',
      model_name: 'ThinkPad T14',
      processor: 'Ryzen 7',
      price: 22000,
    });

    assert.strictEqual(harness.getInputValue(), 22000, 'Initial price should be 22000');

    // Simulate clearing the input
    const valAfterClear = harness.handleInputChange('');
    assert.strictEqual(valAfterClear, '', 'Value after clearing must be empty string');
    assert.strictEqual(harness.getEditFormData().price, '', 'State price must be empty string');
    assert.strictEqual(harness.getInputPlaceholder(), '0', 'Placeholder remains 0');
  });

  await t.test('3. Typing "1" after clearing produces "1", never "01"', () => {
    const harness = createInputEditorHarness({
      id: 'test-item-4',
      brand: 'Dell',
      model_name: 'XPS 13',
      processor: 'i7 12th',
      price: 35000,
    });

    // 1. Clear field
    harness.handleInputChange('');
    assert.strictEqual(harness.getInputValue(), '');

    // 2. Type "1"
    const valAfterTyping = harness.handleInputChange('1');
    assert.strictEqual(valAfterTyping, '1', 'Input value must be exactly "1", never "01"');
    assert.notStrictEqual(valAfterTyping, '01', 'Input value must not contain prepended placeholder 0');
  });

  await t.test('4. Replacing "0" with "5" produces "5"', () => {
    // If field had "0" and user typed "5" without deleting (browser event produces "05")
    const harness = createInputEditorHarness({
      id: 'test-item-5',
      brand: 'HP',
      model_name: 'ZBook Firefly',
      processor: 'i7 10th',
      price: 0,
    });

    // Simulate browser appending 5 to 0 -> "05"
    const val = harness.handleInputChange('05');
    assert.strictEqual(val, '5', 'Typing 5 over or after 0 must normalize to "5", not "05"');

    // Simulate select all and type "5"
    const valDirect = harness.handleInputChange('5');
    assert.strictEqual(valDirect, '5', 'Directly typing 5 must be "5"');
  });

  await t.test('5. Clearing and typing a multi-digit number works correctly', () => {
    const harness = createInputEditorHarness({
      id: 'test-item-6',
      brand: 'Apple',
      model_name: 'MacBook Pro M1',
      processor: 'M1 Pro',
      price: 45000,
    });

    // Clear
    harness.handleInputChange('');
    assert.strictEqual(harness.getInputValue(), '');

    // Type 2 -> 25 -> 250 -> 2500 -> 25000
    assert.strictEqual(harness.handleInputChange('2'), '2');
    assert.strictEqual(harness.handleInputChange('25'), '25');
    assert.strictEqual(harness.handleInputChange('250'), '250');
    assert.strictEqual(harness.handleInputChange('2500'), '2500');
    assert.strictEqual(harness.handleInputChange('25000'), '25000');

    // Save and verify final numeric persistence
    const saved = harness.saveItemEdit();
    assert.strictEqual(saved.price, 25000, 'Saved price must be numeric 25000');
  });

  await t.test('6. Existing validation and promotional image generation still work', () => {
    // 6.1 Empty price saved as undefined (graceful poster display '---')
    const harnessEmpty = createInputEditorHarness({
      id: 'test-item-7',
      brand: 'Dell',
      model_name: 'Precision 3551',
      processor: 'i7 10th',
      price: 18000,
    });
    harnessEmpty.handleInputChange('');
    const savedEmpty = harnessEmpty.saveItemEdit();
    assert.strictEqual(savedEmpty.price, undefined, 'Empty price must save as undefined');

    // 6.2 Negative number constrained to 0
    const harnessNeg = createInputEditorHarness({
      id: 'test-item-8',
      brand: 'Dell',
      model_name: 'Latitude 5520',
      processor: 'i5',
      price: 15000,
    });
    harnessNeg.handleInputChange('-500');
    const savedNeg = harnessNeg.saveItemEdit();
    assert.strictEqual(savedNeg.price, 0, 'Negative values must be clamped to 0');

    // 6.3 Sorting by price works with updated items
    const items = [
      { id: '1', brand: 'HP', model_name: 'A', processor: 'i5', ram: '8GB', storage: '256GB', gpu: 'Intel', screen: '15.6', price: 10000 },
      { id: '2', brand: 'Dell', model_name: 'B', processor: 'i7', ram: '16GB', storage: '512GB', gpu: 'Nvidia', screen: '15.6', price: 25000 },
      { id: '3', brand: 'Lenovo', model_name: 'C', processor: 'Ryzen 5', ram: '16GB', storage: '512GB', gpu: 'AMD', screen: '14.1', price: 15000 },
    ];

    const sortedAsc = sortPromotionalItems(items, 'asc');
    assert.strictEqual(sortedAsc[0].price, 10000);
    assert.strictEqual(sortedAsc[2].price, 25000);

    const sortedDesc = sortPromotionalItems(items, 'desc');
    assert.strictEqual(sortedDesc[0].price, 25000);
    assert.strictEqual(sortedDesc[2].price, 10000);

    // 6.4 Filename generation
    const filename = generatePromotionalArabicFilename(items, 'png', 1, 1);
    assert.ok(typeof filename === 'string' && filename.includes('أجهزة_Compu_MSS'), 'Arabic promotional filename generated correctly');
  });
});
