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

// Import extractor function from mssModelSpecsService
const { extractModelSpecificationsAndNotes } = await import(
  '../src/services/mssModelSpecsService.ts'
);

test('MSS Model Specifications & Notes Viewer Regression Suite', async (t) => {
  // Model Fixture 1: Laptop with full hardware specifications and multi-line notes
  const laptopModel = {
    id: 'model-laptop-001',
    brand: 'Lenovo',
    model_name: 'ThinkPad T480',
    category: 'لابتوب',
    processor: 'Intel Core i7-8650U (1.90GHz up to 4.20GHz)',
    ram: '16GB DDR4 2400MHz',
    storage: '512GB NVMe M.2 SSD',
    gpu: 'Intel UHD Graphics 620 + NVIDIA GeForce MX150 2GB',
    screen_size: '14" FHD (1920×1080) IPS Anti-glare',
    specifications: 'كيبورد مضيئة عربي وإنجليزي، بصمة إصبع، شاحن أصلي 65W تايب سي، بطارية مزدوجة داخلية وخارجية',
    default_list_price: 13500,
    created_at: '2024-11-20T10:00:00Z',
    updated_at: '2024-11-20T10:00:00Z',
  };

  // Model Fixture 2: Screen / Monitor with structured specifications and monitor notes
  const monitorModel = {
    id: 'model-screen-002',
    brand: 'Dell',
    model_name: 'UltraSharp U2723QE',
    category: 'شاشة',
    screen_size: '27" 4K UHD (3840×2160) IPS 60Hz Flat',
    specifications:
      'زمن الاستجابة: 5ms • الأبعاد: 16:9 • المنافذ: HDMI 2.0, DisplayPort 1.4, USB-C 90W PD, RJ45 Ethernet • السطوع: 400 nits • ملاحظات: قاعدة هيدروليك قابلة للدوران والارتفاع 90 درجة مع دعم HDR400 وموزع منافذ USB Hub مدمج',
    default_list_price: 18500,
    created_at: '2024-11-20T10:00:00Z',
    updated_at: '2024-11-20T10:00:00Z',
  };

  // Model Fixture 3: Screen / Monitor with curved panel, 165Hz, response time, but NO notes
  const gamingMonitorModel = {
    id: 'model-screen-003',
    brand: 'Samsung',
    model_name: 'Odyssey G5 G55C',
    category: 'شاشة',
    screen_size: '32" 2K QHD (2560×1440) VA 165Hz Curved',
    specifications: 'زمن الاستجابة: 1ms • الأبعاد: 16:9 • المنافذ: HDMI 2.0, DisplayPort 1.2 • السطوع: 300 nits',
    default_list_price: 12000,
    created_at: '2024-11-20T10:00:00Z',
    updated_at: '2024-11-20T10:00:00Z',
  };

  // Model Fixture 4: Empty Model (No specifications, no notes)
  const emptyModel = {
    id: 'model-empty-004',
    brand: 'Generic',
    model_name: 'Basic Device',
    category: 'أخرى',
    processor: null,
    ram: null,
    storage: null,
    gpu: null,
    screen_size: null,
    specifications: null,
    default_list_price: 0,
    created_at: '2024-11-20T10:00:00Z',
    updated_at: '2024-11-20T10:00:00Z',
  };

  // Model Fixture 5: Laptop with specs but NO notes
  const laptopNoNotes = {
    id: 'model-laptop-005',
    brand: 'HP',
    model_name: 'EliteBook 840 G7',
    category: 'لابتوب',
    processor: 'Intel Core i5-10310U',
    ram: '8GB DDR4',
    storage: '256GB SSD',
    gpu: 'Intel UHD Graphics',
    screen_size: '14" FHD IPS',
    specifications: '',
    default_list_price: 9500,
    created_at: '2024-11-20T10:00:00Z',
    updated_at: '2024-11-20T10:00:00Z',
  };

  // Model Fixture 6: Device with dynamic/custom fields (e.g. battery, ports)
  const customDeviceModel = {
    id: 'model-custom-006',
    brand: 'Apple',
    model_name: 'MacBook Air M1',
    category: 'لابتوب',
    processor: 'Apple M1 (8-core CPU / 7-core GPU)',
    ram: '8GB Unified Memory',
    storage: '256GB SSD',
    screen_size: '13.3" Retina Display (2560×1600)',
    battery: '49.9Wh Up to 18 hours',
    ports: '2x Thunderbolt / USB 4, 3.5mm Headphone Jack',
    specifications: 'حالة ممتازة - دورات الشحن 45 دورة فقط',
    default_list_price: 24000,
    created_at: '2024-11-20T10:00:00Z',
    updated_at: '2024-11-20T10:00:00Z',
  };

  await t.test('1. Laptop Model: Correctly extracts all laptop hardware specs and notes', () => {
    const { specs, notes } = extractModelSpecificationsAndNotes(laptopModel);

    assert.ok(specs.length >= 5, 'Must extract at least CPU, RAM, Storage, GPU, Screen');
    const cpuSpec = specs.find(s => s.key === 'processor');
    const ramSpec = specs.find(s => s.key === 'ram');
    const storageSpec = specs.find(s => s.key === 'storage');
    const gpuSpec = specs.find(s => s.key === 'gpu');
    const screenSpec = specs.find(s => s.key === 'screen_size');

    assert.ok(cpuSpec && cpuSpec.value.includes('Intel Core i7-8650U'));
    assert.ok(ramSpec && ramSpec.value.includes('16GB DDR4'));
    assert.ok(storageSpec && storageSpec.value.includes('512GB NVMe'));
    assert.ok(gpuSpec && gpuSpec.value.includes('NVIDIA GeForce MX150'));
    assert.ok(screenSpec && screenSpec.value.includes('14" FHD'));

    assert.ok(notes, 'Notes must be extracted');
    assert.ok(notes.includes('كيبورد مضيئة') && notes.includes('بصمة إصبع'));
  });

  await t.test('2. Screen / Monitor Model: Correctly extracts monitor-specific fields and notes', () => {
    const { specs, notes } = extractModelSpecificationsAndNotes(monitorModel);

    const sizeSpec = specs.find(s => s.key === 'screen_size');
    const resSpec = specs.find(s => s.key === 'resolution');
    const panelSpec = specs.find(s => s.key === 'panel');
    const refreshSpec = specs.find(s => s.key === 'refresh_rate');
    const rtSpec = specs.find(s => s.key === 'response_time');
    const portsSpec = specs.find(s => s.key === 'ports');
    const brightnessSpec = specs.find(s => s.key === 'brightness');

    assert.ok(sizeSpec && sizeSpec.value.includes('27"'));
    assert.ok(resSpec && resSpec.value.includes('3840×2160'));
    assert.ok(panelSpec && panelSpec.value === 'IPS');
    assert.ok(refreshSpec && refreshSpec.value === '60Hz');
    assert.ok(rtSpec && rtSpec.value === '5ms');
    assert.ok(portsSpec && portsSpec.value.includes('HDMI 2.0') && portsSpec.value.includes('USB-C 90W'));
    assert.ok(brightnessSpec && brightnessSpec.value.includes('400 nits'));

    // Irrelevant laptop fields must NOT appear
    assert.equal(specs.some(s => s.key === 'processor'), false, 'Monitor should not display empty CPU');
    assert.equal(specs.some(s => s.key === 'ram'), false, 'Monitor should not display empty RAM');
    assert.equal(specs.some(s => s.key === 'storage'), false, 'Monitor should not display empty Storage');

    // Notes must be cleanly separated
    assert.ok(notes && notes.includes('قاعدة هيدروليك قابلة للدوران') && notes.includes('HDR400'));
  });

  await t.test('3. Curved Gaming Monitor without notes: Displays specs normally without empty notes section', () => {
    const { specs, notes } = extractModelSpecificationsAndNotes(gamingMonitorModel);

    assert.ok(specs.length >= 5, 'Gaming monitor must display extracted specifications');
    const refreshSpec = specs.find(s => s.key === 'refresh_rate');
    const curvatureSpec = specs.find(s => s.key === 'curvature');
    const rtSpec = specs.find(s => s.key === 'response_time');

    assert.ok(refreshSpec && refreshSpec.value === '165Hz');
    assert.ok(curvatureSpec && curvatureSpec.value.includes('منحنية'));
    assert.ok(rtSpec && rtSpec.value === '1ms');

    // Notes must be null since no notes were provided
    assert.equal(notes, null, 'Notes must be null when model has no notes (prevents empty notes section)');
  });

  await t.test('4. Empty Model: Returns empty specs array and null notes to trigger clean Arabic empty state', () => {
    const { specs, notes } = extractModelSpecificationsAndNotes(emptyModel);

    assert.equal(specs.length, 0, 'Empty model must have 0 specs');
    assert.equal(notes, null, 'Empty model must have null notes');
  });

  await t.test('5. Laptop with specs but NO notes: Shows specs normally without empty notes section', () => {
    const { specs, notes } = extractModelSpecificationsAndNotes(laptopNoNotes);

    assert.ok(specs.length >= 4, 'Must have at least CPU, RAM, Storage, Screen');
    assert.equal(notes, null, 'Notes must be null when specifications is empty');
  });

  await t.test('6. Dynamic / Custom Fields: Captures newly supported fields (battery, ports) automatically', () => {
    const { specs, notes } = extractModelSpecificationsAndNotes(customDeviceModel);

    const batterySpec = specs.find(s => s.key === 'battery');
    const portsSpec = specs.find(s => s.key === 'ports');

    assert.ok(batterySpec && batterySpec.value.includes('49.9Wh'));
    assert.ok(portsSpec && portsSpec.value.includes('Thunderbolt'));
    assert.ok(notes && notes.includes('دورات الشحن 45 دورة'));
  });

  await t.test('7. Model Independence: Inspecting different models does not leak or contaminate specs', () => {
    const laptopResult = extractModelSpecificationsAndNotes(laptopModel);
    const monitorResult = extractModelSpecificationsAndNotes(monitorModel);
    const emptyResult = extractModelSpecificationsAndNotes(emptyModel);

    // Verify laptop has laptop CPU and no monitor resolution
    assert.ok(laptopResult.specs.some(s => s.key === 'processor'));
    assert.equal(laptopResult.specs.some(s => s.key === 'resolution'), false);

    // Verify monitor has resolution and no laptop CPU
    assert.ok(monitorResult.specs.some(s => s.key === 'resolution'));
    assert.equal(monitorResult.specs.some(s => s.key === 'processor'), false);

    // Verify empty result is clean
    assert.equal(emptyResult.specs.length, 0);
    assert.equal(emptyResult.notes, null);
  });

  await t.test('8. View-only safety: Calling extractModelSpecificationsAndNotes does not mutate model objects', () => {
    const originalClone = JSON.stringify(laptopModel);
    extractModelSpecificationsAndNotes(laptopModel);
    assert.equal(JSON.stringify(laptopModel), originalClone, 'Model object must remain completely untouched');
  });

  await t.test('9. MSSInventoryView.tsx Integration: Contains Info button in table and renders MSSModelSpecsModal', () => {
    const inventoryViewPath = path.resolve('src/components/placeholders/mss/MSSInventoryView.tsx');
    const content = fs.readFileSync(inventoryViewPath, 'utf-8');

    // Check Info icon import and button
    assert.ok(content.includes('Info'), 'MSSInventoryView must import or use Info icon');
    assert.ok(content.includes('handleOpenModelSpecs'), 'Must have handleOpenModelSpecs handler');
    assert.ok(
      content.includes('MSSModelSpecsModal'),
      'MSSInventoryView must import and render MSSModelSpecsModal'
    );
    assert.ok(
      content.includes('عرض مواصفات وملاحظات الموديل') || content.includes('عرض مواصفات'),
      'Must have title / aria-label for accessibility on Info button'
    );
  });

  await t.test('10. MSSModelSpecsModal.tsx contains clean Arabic empty state message', () => {
    const modalPath = path.resolve('src/components/placeholders/mss/MSSModelSpecsModal.tsx');
    const content = fs.readFileSync(modalPath, 'utf-8');

    assert.ok(
      content.includes('مفيش مواصفات أو ملاحظات مسجلة للموديل ده'),
      'Must contain the required exact Arabic empty state message'
    );
  });

  await t.test('11. GPU Icon: Uses dedicated GPU/CircuitBoard graphics icon instead of Sparkles', () => {
    const modalPath = path.resolve('src/components/placeholders/mss/MSSModelSpecsModal.tsx');
    const content = fs.readFileSync(modalPath, 'utf-8');

    // Verify GPU case does not return Sparkles
    const gpuCaseMatch = content.match(/case\s*'gpu':\s*return\s*<([^>\s]+)/);
    assert.ok(gpuCaseMatch, 'Must have a case for "gpu" in getSpecIcon');
    const iconTag = gpuCaseMatch[1];
    assert.notEqual(iconTag, 'Sparkles', 'GPU icon must not be Sparkles');
    assert.ok(
      iconTag === 'GpuIcon' || iconTag === 'CircuitBoard' || iconTag === 'Gpu',
      `GPU icon must be GpuIcon, CircuitBoard, or Gpu (was: ${iconTag})`
    );
    // Verify icon color and sizing are preserved
    assert.ok(content.includes('className="w-4 h-4 text-pink-600"'));
  });
});
