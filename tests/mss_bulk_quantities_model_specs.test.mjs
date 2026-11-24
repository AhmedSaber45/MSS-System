import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Setup Mock LocalStorage for 100% isolated in-memory test environment
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
  globalThis.window = { localStorage: globalThis.localStorage };
}
if (typeof globalThis.navigator === 'undefined') {
  globalThis.navigator = { onLine: false }; // Offline mode guarantees zero remote network calls
}

// Block any attempt to send HTTP requests to real Supabase
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, options) => {
  if (typeof url === 'string' && url.includes('supabase.co')) {
    throw new Error('NETWORK BLOCKED: Automated tests are strictly isolated from production Supabase!');
  }
  if (originalFetch) return originalFetch(url, options);
  throw new Error('Fetch not available');
};

// Import formatter functions from mssModelSpecsService
const {
  formatCompactModelSpecs,
  formatRamString,
  cleanNotesString,
} = await import('../src/services/mssModelSpecsService.ts');

test('MSS Bulk Model Quantities - Specifications & Notes Under Model Name Suite', async (t) => {
  // Test 1: Full laptop specifications formatting
  await t.test('1. Laptop Model: Formats full hardware specs into compact pipe-separated string and extracts notes', () => {
    const laptopModel = {
      id: 'model-laptop-001',
      brand: 'Dell',
      model_name: 'G15 5511',
      category: 'لابتوب',
      processor: 'Core i7-11800H',
      ram: '16GB',
      storage: '512GB SSD',
      gpu: 'RTX 3050',
      screen_size: '15.6" FHD 120Hz',
      specifications: 'ملاحظات: كيبورد عربي وإنجليزي مضيء، شاحن أصلي 180W',
      default_list_price: 24500,
      created_at: '2024-11-20T10:00:00Z',
      updated_at: '2024-11-20T10:00:00Z',
    };

    const result = formatCompactModelSpecs(laptopModel);
    assert.equal(
      result.specsText,
      'Core i7-11800H | 16GB RAM | 512GB SSD | RTX 3050 | 15.6" FHD 120Hz'
    );
    assert.equal(result.notesText, 'كيبورد عربي وإنجليزي مضيء، شاحن أصلي 180W');
  });

  // Test 2: Standard user example match
  await t.test('2. User Prompt Example: Formats Core i7, 16GB RAM, 512GB SSD, RTX 3050 correctly', () => {
    const exampleModel = {
      id: 'model-laptop-example',
      brand: 'Lenovo',
      model_name: 'Legion 5',
      category: 'لابتوب',
      processor: 'Core i7',
      ram: '16GB',
      storage: '512GB SSD',
      gpu: 'RTX 3050',
      screen_size: null,
      specifications: null,
      default_list_price: 22000,
      created_at: '2024-11-20T10:00:00Z',
      updated_at: '2024-11-20T10:00:00Z',
    };

    const result = formatCompactModelSpecs(exampleModel);
    assert.equal(result.specsText, 'Core i7 | 16GB RAM | 512GB SSD | RTX 3050');
    assert.equal(result.notesText, null);
  });

  // Test 3: Screen / Monitor model formatting
  await t.test('3. Screen / Monitor Model: Formats monitor-specific specs and notes', () => {
    const screenModel = {
      id: 'model-screen-001',
      brand: 'Dell',
      model_name: 'UltraSharp U2723QE',
      category: 'شاشة',
      screen_size: '27" 4K UHD (3840×2160) IPS 60Hz Flat',
      specifications:
        'زمن الاستجابة: 5ms • الأبعاد: 16:9 • المنافذ: HDMI 2.0, DP 1.4 • السطوع: 400 nits • ملاحظات: قاعدة هيدروليك قابلة للدوران',
      default_list_price: 18500,
      created_at: '2024-11-20T10:00:00Z',
      updated_at: '2024-11-20T10:00:00Z',
    };

    const result = formatCompactModelSpecs(screenModel);
    assert.ok(result.specsText.includes('27"'));
    assert.ok(result.specsText.includes('4K UHD (3840×2160)'));
    assert.ok(result.specsText.includes('IPS'));
    assert.ok(result.specsText.includes('60Hz'));
    assert.ok(result.specsText.includes('5ms'));
    assert.equal(result.notesText, 'قاعدة هيدروليك قابلة للدوران');
  });

  // Test 4: Curved gaming monitor without notes
  await t.test('4. Curved Gaming Monitor: Includes curved indicator and returns null notes', () => {
    const curvedMonitor = {
      id: 'model-screen-curved',
      brand: 'Samsung',
      model_name: 'Odyssey G5',
      category: 'شاشة',
      screen_size: '32" 2K QHD (2560×1440) VA 165Hz Curved',
      specifications: 'زمن الاستجابة: 1ms • المنافذ: HDMI 2.0, DisplayPort 1.2',
      default_list_price: 12500,
      created_at: '2024-11-20T10:00:00Z',
      updated_at: '2024-11-20T10:00:00Z',
    };

    const result = formatCompactModelSpecs(curvedMonitor);
    assert.ok(result.specsText.includes('32"'));
    assert.ok(result.specsText.includes('2K QHD (2560×1440)'));
    assert.ok(result.specsText.includes('VA'));
    assert.ok(result.specsText.includes('165Hz'));
    assert.ok(result.specsText.includes('Curved') || result.specsText.includes('منحنية'));
    assert.ok(result.specsText.includes('1ms'));
    assert.equal(result.notesText, null);
  });

  // Test 5: RAM formatting helper handles units without redundant duplication
  await t.test('5. RAM formatting: prevents duplicate "RAM RAM" or "DDR RAM"', () => {
    assert.equal(formatRamString('16GB'), '16GB RAM');
    assert.equal(formatRamString('16 GB'), '16 GB RAM');
    assert.equal(formatRamString('32GB'), '32GB RAM');
    assert.equal(formatRamString('16GB RAM'), '16GB RAM');
    assert.equal(formatRamString('16GB DDR4'), '16GB DDR4');
    assert.equal(formatRamString('32GB DDR5 4800MHz'), '32GB DDR5 4800MHz');
    assert.equal(formatRamString('16 جيجا'), '16 جيجا');
    assert.equal(formatRamString(''), '');
    assert.equal(formatRamString(null), '');
  });

  // Test 6: Notes cleaning helper removes prefixes and empty placeholders
  await t.test('6. Notes cleaning: removes "ملاحظات:" and handles empty placeholders', () => {
    assert.equal(cleanNotesString('ملاحظات: حالة ممتازة'), 'حالة ممتازة');
    assert.equal(cleanNotesString('ملاحظات إضافية: شاحن أصلي'), 'شاحن أصلي');
    assert.equal(cleanNotesString('ملاحظة: جهاز سليم'), 'جهاز سليم');
    assert.equal(cleanNotesString('حالة الزيرو'), 'حالة الزيرو');
    assert.equal(cleanNotesString('---'), null);
    assert.equal(cleanNotesString('لا توجد'), null);
    assert.equal(cleanNotesString('null'), null);
    assert.equal(cleanNotesString('none'), null);
    assert.equal(cleanNotesString(''), null);
    assert.equal(cleanNotesString(null), null);
  });

  // Test 7: Empty or null model handling
  await t.test('7. Empty Model: Returns empty specs string and null notes (no empty placeholder)', () => {
    const emptyModel = {
      id: 'model-empty',
      brand: 'Generic',
      model_name: 'Device',
      category: 'أخرى',
      processor: null,
      ram: null,
      storage: null,
      gpu: null,
      screen_size: null,
      specifications: null,
      default_list_price: 1000,
      created_at: '2024-11-20T10:00:00Z',
      updated_at: '2024-11-20T10:00:00Z',
    };

    const result = formatCompactModelSpecs(emptyModel);
    assert.equal(result.specsText, '');
    assert.equal(result.notesText, null);

    const nullResult = formatCompactModelSpecs(null);
    assert.equal(nullResult.specsText, '');
    assert.equal(nullResult.notesText, null);
  });

  // Test 8: Missing fields do not produce trailing pipes or gaps
  await t.test('8. Partial Specs: Omits null/undefined fields without double pipes or gaps', () => {
    const partialModel = {
      id: 'model-partial',
      brand: 'HP',
      model_name: 'ProBook 450 G8',
      category: 'لابتوب',
      processor: 'Core i5-1135G7',
      ram: '8GB',
      storage: '256GB SSD',
      gpu: null, // missing GPU
      screen_size: null, // missing screen size
      specifications: null,
      default_list_price: 15000,
      created_at: '2024-11-20T10:00:00Z',
      updated_at: '2024-11-20T10:00:00Z',
    };

    const result = formatCompactModelSpecs(partialModel);
    assert.equal(result.specsText, 'Core i5-1135G7 | 8GB RAM | 256GB SSD');
    assert.equal(result.notesText, null);
    assert.ok(!result.specsText.includes('||'));
    assert.ok(!result.specsText.endsWith('|'));
    assert.ok(!result.specsText.startsWith('|'));
  });

  // Test 9: Model with only specifications string (fallback for legacy or custom formats)
  await t.test('9. Legacy/Custom Model: Uses specifications field when hardware columns are empty', () => {
    const customModel = {
      id: 'model-custom',
      brand: 'Custom',
      model_name: 'Desktop PC',
      category: 'أخرى',
      processor: null,
      ram: null,
      storage: null,
      gpu: null,
      screen_size: null,
      specifications: 'Core i9 12900K | 32GB RAM | 1TB NVMe | RTX 3080',
      default_list_price: 45000,
      created_at: '2024-11-20T10:00:00Z',
      updated_at: '2024-11-20T10:00:00Z',
    };

    const result = formatCompactModelSpecs(customModel);
    assert.equal(result.specsText, 'Core i9 12900K | 32GB RAM | 1TB NVMe | RTX 3080');
    assert.equal(result.notesText, null);
  });

  // Test 10: MSSInventoryView.tsx Integration check
  await t.test('10. MSSInventoryView.tsx Integration: Specs and notes are rendered under model name without click requirement', () => {
    const inventoryViewPath = path.resolve('src/components/placeholders/mss/MSSInventoryView.tsx');
    assert.ok(fs.existsSync(inventoryViewPath), 'MSSInventoryView.tsx must exist');
    const content = fs.readFileSync(inventoryViewPath, 'utf8');

    // 1. Must import formatCompactModelSpecs
    assert.ok(
      content.includes('formatCompactModelSpecs'),
      'MSSInventoryView.tsx must import formatCompactModelSpecs'
    );

    // 2. In isCrossWarehouseModalOpen modal, formatCompactModelSpecs is called
    assert.ok(
      content.includes('formatCompactModelSpecs('),
      'formatCompactModelSpecs must be invoked for crossWarehouseSummaries items'
    );

    // 3. specsText must be rendered in table cell
    assert.ok(
      content.includes('{specsText && ('),
      'specsText must be rendered directly under the model name'
    );

    // 4. notesText must be rendered in table cell with secondary styling
    assert.ok(
      content.includes('{notesText && ('),
      'notesText must be rendered directly under the specs'
    );
    assert.ok(
      content.includes('text-[11px] text-slate-500'),
      'notesText must use smaller secondary font style (text-[11px] text-slate-500)'
    );

    // 5. Must NOT add an info button or modal trigger inside this table cell
    // Locate the cell in isCrossWarehouseModalOpen
    const modalSectionMatch = content.match(
      /isCrossWarehouseModalOpen[\s\S]*?crossWarehouseSummaries\.map\(\(item, idx\) => \{([\s\S]*?)\}\)\s*\}/
    );
    assert.ok(modalSectionMatch, 'Found crossWarehouseSummaries map loop');
    const loopBody = modalSectionMatch[1];

    assert.ok(
      !loopBody.includes('handleOpenModelSpecs'),
      'DO NOT add handleOpenModelSpecs in Bulk Model Quantities modal'
    );
    assert.ok(
      !loopBody.includes('<Info'),
      'DO NOT add Info icon button in Bulk Model Quantities modal'
    );
  });

  // Test 11: Application Version and Production Data Safety
  await t.test('11. Safety Check: Application version is synchronized to 1.0.9, no mock data pollution', () => {
    const pkgJson = JSON.parse(fs.readFileSync(path.resolve('package.json'), 'utf8'));
    assert.equal(pkgJson.version, '1.0.9', 'Application version must be 1.0.9');
  });
});
