import test from 'node:test';
import assert from 'node:assert/strict';

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

// Import services and helpers
const { mssCatalogService } = await import('../src/services/mssCatalogService.ts');
const {
  buildScreenSummary,
  buildScreenSpecifications,
  parseScreenSpecs,
} = await import('../src/services/mssScreenSpecs.ts');

// In-memory table for mss_models
const inMemoryModels = new Map();

// Helper to reset in-memory state
function resetState() {
  inMemoryModels.clear();
  globalThis.localStorage.clear();
}

test('1. parseScreenSpecs accurately parses canonical screen specifications', () => {
  const screenSize = '24" FHD (1920×1080) IPS 75Hz Flat';
  const specs = 'زمن الاستجابة: 1ms • الأبعاد: 16:9 • المنافذ: HDMI, DisplayPort • السطوع: 250 nits • شاشة لمس: لا • ملاحظات: شاشة احترافية بحالة ممتازة';

  const parsed = parseScreenSpecs(screenSize, specs);
  assert.equal(parsed.size, '24"');
  assert.equal(parsed.resolution, 'FHD (1920×1080)');
  assert.equal(parsed.panel, 'IPS');
  assert.equal(parsed.refreshRate, '75Hz');
  assert.equal(parsed.curvature, 'مسطحة (Flat)');
  assert.equal(parsed.responseTime, '1ms');
  assert.equal(parsed.aspectRatio, '16:9');
  assert.equal(parsed.ports, 'HDMI, DisplayPort');
  assert.equal(parsed.brightness, '250 nits');
  assert.equal(parsed.touch, 'لا');
  assert.equal(parsed.notes, 'شاشة احترافية بحالة ممتازة');
});

test('2. parseScreenSpecs accurately parses curved high-refresh gaming monitor specs', () => {
  const screenSize = '27" 2K QHD (2560×1440) VA 144Hz Curved';
  const specs = 'زمن الاستجابة: 4ms • الأبعاد: 16:9 • المنافذ: HDMI, DP • السطوع: 300 nits • ملاحظات: قاعدة متحركة';

  const parsed = parseScreenSpecs(screenSize, specs);
  assert.equal(parsed.size, '27"');
  assert.equal(parsed.resolution, '2K QHD (2560×1440)');
  assert.equal(parsed.panel, 'VA');
  assert.equal(parsed.refreshRate, '144Hz');
  assert.equal(parsed.curvature, 'منحنية (Curved)');
  assert.equal(parsed.responseTime, '4ms');
  assert.equal(parsed.aspectRatio, '16:9');
  assert.equal(parsed.ports, 'HDMI, DP');
  assert.equal(parsed.brightness, '300 nits');
  assert.equal(parsed.notes, 'قاعدة متحركة');
});

test('3. parseScreenSpecs handles legacy/unstructured screen records gracefully', () => {
  const screenSize = '21.5 بوصة 60Hz IPS';
  const specs = 'Dell monitor with VGA and power cable';

  const parsed = parseScreenSpecs(screenSize, specs);
  assert.equal(parsed.size, '21.5"');
  assert.equal(parsed.panel, 'IPS');
  assert.equal(parsed.refreshRate, '60Hz');
  assert.equal(parsed.curvature, 'مسطحة (Flat)');
  assert.equal(parsed.touch, 'لا');
  assert.equal(parsed.notes, 'Dell monitor with VGA and power cable');
});

test('4. buildScreenSummary formats monitor specifications correctly', () => {
  const summary1 = buildScreenSummary('24', 'FHD (1920×1080)', 'IPS', '75', 'مسطحة (Flat)');
  assert.equal(summary1, '24" FHD (1920×1080) IPS 75Hz Flat');

  const summary2 = buildScreenSummary('32"', '4K UHD (3840×2160)', 'OLED', '240Hz', 'منحنية (Curved)');
  assert.equal(summary2, '32" 4K UHD (3840×2160) OLED 240Hz Curved');

  const summaryPartial = buildScreenSummary('27"', '', 'VA', '', 'مسطحة (Flat)');
  assert.equal(summaryPartial, '27" VA Flat');
});

test('5. buildScreenSpecifications formats detailed specs correctly', () => {
  const specs = buildScreenSpecifications({
    responseTime: '1ms',
    aspectRatio: '16:9',
    ports: 'HDMI, DisplayPort, USB-C',
    brightness: '350',
    touch: 'نعم',
    notes: 'مخرج صوت وسماعات مدمجة',
  });

  assert.equal(
    specs,
    'زمن الاستجابة: 1ms • الأبعاد: 16:9 • المنافذ: HDMI, DisplayPort, USB-C • السطوع: 350 nits • شاشة لمس: نعم • ملاحظات: مخرج صوت وسماعات مدمجة'
  );
});

test('6. Saving a Screen model preserves its screen specifications and leaves hardware fields null', async () => {
  resetState();

  const constructedScreenSize = buildScreenSummary('24"', 'FHD (1920×1080)', 'IPS', '75Hz', 'مسطحة (Flat)');
  const constructedSpecs = buildScreenSpecifications({
    responseTime: '1ms',
    aspectRatio: '16:9',
    ports: 'HDMI, DisplayPort',
    brightness: '250 nits',
    touch: 'لا',
    notes: 'جديدة بالكرتونة',
  });

  const screenModel = await mssCatalogService.createModel({
    brand: 'Samsung',
    model_name: 'LF24T350',
    category: 'شاشة',
    processor: undefined,
    gpu: undefined,
    ram: undefined,
    storage: undefined,
    screen_size: constructedScreenSize,
    specifications: constructedSpecs,
    default_list_price: 4200,
  });

  assert.equal(screenModel.brand, 'Samsung');
  assert.equal(screenModel.model_name, 'LF24T350');
  assert.equal(screenModel.category, 'شاشة');
  assert.equal(screenModel.screen_size, '24" FHD (1920×1080) IPS 75Hz Flat');
  assert.ok(screenModel.specifications?.includes('HDMI, DisplayPort'));
  assert.equal(screenModel.processor, null);
  assert.equal(screenModel.gpu, null);
  assert.equal(screenModel.ram, null);
  assert.equal(screenModel.storage, null);
  assert.equal(screenModel.default_list_price, 4200);
});

test('7. Saving a Laptop model preserves laptop specifications and does not contain monitor specs', async () => {
  resetState();

  const laptopModel = await mssCatalogService.createModel({
    brand: 'Lenovo',
    model_name: 'ThinkPad T480',
    category: 'لابتوب',
    processor: 'Intel Core i5-8350U',
    gpu: 'Intel UHD 620',
    ram: '16 GB DDR4',
    storage: '512 GB NVMe SSD',
    screen_size: '14" FHD IPS',
    specifications: 'كيبورد مضيئة، بصمة إصبع',
    default_list_price: 15000,
  });

  assert.equal(laptopModel.brand, 'Lenovo');
  assert.equal(laptopModel.model_name, 'ThinkPad T480');
  assert.equal(laptopModel.category, 'لابتوب');
  assert.equal(laptopModel.processor, 'Intel Core i5-8350U');
  assert.equal(laptopModel.gpu, 'Intel UHD 620');
  assert.equal(laptopModel.ram, '16 GB DDR4');
  assert.equal(laptopModel.storage, '512 GB NVMe SSD');
  assert.equal(laptopModel.screen_size, '14" FHD IPS');
  assert.equal(laptopModel.specifications, 'كيبورد مضيئة، بصمة إصبع');
  assert.equal(laptopModel.default_list_price, 15000);
});

test('8. Switching from Laptop to Screen clears incompatible hardware specs on update', async () => {
  resetState();

  // Initially created as a Laptop
  const initialLaptop = await mssCatalogService.createModel({
    brand: 'Dell',
    model_name: 'Hybrid Device',
    category: 'لابتوب',
    processor: 'Core i7-10510U',
    gpu: 'Intel UHD',
    ram: '16 GB',
    storage: '512 GB SSD',
    screen_size: '15.6" FHD',
    specifications: 'Original laptop specs',
    default_list_price: 18000,
  });

  assert.equal(initialLaptop.processor, 'Core i7-10510U');

  // Updated to Screen: Hardware fields passed as empty strings to clear them
  const updatedToScreen = await mssCatalogService.updateModel(initialLaptop.id, {
    category: 'شاشة',
    processor: '',
    gpu: '',
    ram: '',
    storage: '',
    screen_size: buildScreenSummary('27"', '2K QHD (2560×1440)', 'IPS', '144Hz', 'مسطحة (Flat)'),
    specifications: buildScreenSpecifications({
      ports: 'HDMI, DP',
      responseTime: '1ms',
      notes: 'Now used as dedicated display',
    }),
    default_list_price: 12000,
  });

  assert.equal(updatedToScreen.category, 'شاشة');
  assert.equal(updatedToScreen.processor, null, 'Processor must be cleared to null');
  assert.equal(updatedToScreen.gpu, null, 'GPU must be cleared to null');
  assert.equal(updatedToScreen.ram, null, 'RAM must be cleared to null');
  assert.equal(updatedToScreen.storage, null, 'Storage must be cleared to null');
  assert.equal(updatedToScreen.screen_size, '27" 2K QHD (2560×1440) IPS 144Hz Flat');
  assert.ok(updatedToScreen.specifications?.includes('HDMI, DP'));
  assert.equal(updatedToScreen.default_list_price, 12000);
});

test('9. Incompatible fields do not contaminate another device type upon save', async () => {
  resetState();

  // Simulating form submit for Screen where leftover laptop state might exist
  const leftoverLaptopState = {
    processor: 'Core i5-1135G7',
    ram: '8 GB',
    storage: '256 GB',
  };

  // Submit logic sanitizes and sets incompatible fields to undefined for create
  const sanitizedScreenInput = {
    brand: 'LG',
    model_name: '24MP400',
    category: 'شاشة',
    processor: undefined,
    gpu: undefined,
    ram: undefined,
    storage: undefined,
    screen_size: buildScreenSummary('24"', 'FHD (1920×1080)', 'IPS', '75Hz', 'مسطحة (Flat)'),
    specifications: buildScreenSpecifications({
      ports: 'HDMI, VGA',
      responseTime: '5ms',
    }),
    default_list_price: 3800,
  };

  const createdModel = await mssCatalogService.createModel(sanitizedScreenInput);
  assert.equal(createdModel.processor, null);
  assert.equal(createdModel.gpu, null);
  assert.equal(createdModel.ram, null);
  assert.equal(createdModel.storage, null);
});

test('10. Common fields (brand, model_name, default_list_price) remain intact across device types', async () => {
  resetState();

  const commonBrand = 'ASUS';
  const commonModel = 'ZenScreen MB16AC';
  const commonPrice = 8500;

  const model = await mssCatalogService.createModel({
    brand: commonBrand,
    model_name: commonModel,
    category: 'شاشة',
    screen_size: '15.6" FHD IPS',
    specifications: 'USB Type-C portable monitor',
    default_list_price: commonPrice,
  });

  assert.equal(model.brand, commonBrand);
  assert.equal(model.model_name, commonModel);
  assert.equal(model.default_list_price, commonPrice);

  // Updating category to أخرى
  const updatedModel = await mssCatalogService.updateModel(model.id, {
    category: 'أخرى',
    default_list_price: commonPrice,
  });

  assert.equal(updatedModel.brand, commonBrand);
  assert.equal(updatedModel.model_name, commonModel);
  assert.equal(updatedModel.category, 'أخرى');
  assert.equal(updatedModel.default_list_price, commonPrice);
});

test('11. Existing model records remain compatible and parse seamlessly for editing', async () => {
  resetState();

  const existingModel = {
    id: 'test-model-legacy-screen',
    brand: 'HP',
    model_name: 'EliteDisplay E243',
    category: 'شاشة',
    processor: null,
    gpu: null,
    ram: null,
    storage: null,
    screen_size: '23.8" FHD IPS 60Hz Flat',
    specifications: 'زمن الاستجابة: 5ms • الأبعاد: 16:9 • المنافذ: HDMI, DisplayPort, VGA • السطوع: 250 nits • ملاحظات: بحالة الزيرو',
    default_list_price: 3900,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const parsed = parseScreenSpecs(existingModel.screen_size, existingModel.specifications);
  assert.equal(parsed.size, '23.8"');
  assert.equal(parsed.resolution, 'FHD (1920×1080)');
  assert.equal(parsed.panel, 'IPS');
  assert.equal(parsed.refreshRate, '60Hz');
  assert.equal(parsed.curvature, 'مسطحة (Flat)');
  assert.equal(parsed.responseTime, '5ms');
  assert.equal(parsed.aspectRatio, '16:9');
  assert.equal(parsed.ports, 'HDMI, DisplayPort, VGA');
  assert.equal(parsed.brightness, '250 nits');
  assert.equal(parsed.notes, 'بحالة الزيرو');
});

test('12. Validation enforces brand, model_name, valid price, and category requirements', async () => {
  resetState();

  // Test missing brand
  await assert.rejects(
    async () => {
      await mssCatalogService.createModel({
        brand: '',
        model_name: 'Monitor A',
        category: 'شاشة',
        default_list_price: 3000,
      });
    },
    /الماركة.*مطلوبة/
  );

  // Test missing model_name
  await assert.rejects(
    async () => {
      await mssCatalogService.createModel({
        brand: 'Dell',
        model_name: '',
        category: 'شاشة',
        default_list_price: 3000,
      });
    },
    /اسم الموديل.*مطلوب/
  );

  // Test negative price
  await assert.rejects(
    async () => {
      await mssCatalogService.createModel({
        brand: 'Dell',
        model_name: 'P2419H',
        category: 'شاشة',
        default_list_price: -100,
      });
    },
    /السعر الاسترشادي لا يمكن أن يكون سالباً/
  );
});
