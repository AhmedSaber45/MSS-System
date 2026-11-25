import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Mock isolated localStorage before importing services
const memStorage = new Map();
const mockLocalStorage = {
  getItem: (k) => (memStorage.has(k) ? memStorage.get(k) : null),
  setItem: (k, v) => memStorage.set(k, String(v)),
  removeItem: (k) => memStorage.delete(k),
  clear: () => memStorage.clear(),
};
globalThis.localStorage = mockLocalStorage;
globalThis.window = {
  atob: globalThis.atob,
  btoa: globalThis.btoa,
  localStorage: mockLocalStorage,
};

// Mock Image class to track loaded image srcs and canvas drawImage calls
const loadedImages = new Map();
class MockImage {
  constructor() {
    this._src = '';
    this.complete = false;
    this.naturalWidth = 0;
    this.naturalHeight = 0;
    this._listeners = { load: [], error: [] };
  }
  set src(val) {
    this._src = val;
    this.complete = true;
    this.naturalWidth = 1024;
    this.naturalHeight = 317;
    loadedImages.set(val, this);
    for (const cb of this._listeners.load) cb();
  }
  get src() {
    return this._src;
  }
  addEventListener(type, cb) {
    if (this._listeners[type]) this._listeners[type].push(cb);
  }
  removeEventListener(type, cb) {
    if (this._listeners[type]) {
      this._listeners[type] = this._listeners[type].filter(fn => fn !== cb);
    }
  }
}
globalThis.Image = MockImage;

const {
  ACCESSORIES_PROMOTIONAL_HEADERS,
  ACCESSORIES_HEADER_STORAGE_KEY,
  loadSelectedHeaderId,
  saveSelectedHeaderId,
  getAccessoriesHeaderOption,
} = await import('../src/services/accessoriesPromotionalService.ts');

const { PROMOTIONAL_HEADER_ASSETS } = await import('../src/assets/promotional/promotionalAssets.ts');
const {
  renderPromotionalToCanvas,
  ensurePromotionalImageLoaded,
} = await import('../src/services/mssPromotionalService.ts');
const {
  PROMOTIONAL_THEMES,
  resolvePromotionalTheme,
} = await import('../src/services/promotionalThemes.ts');

test('Accessories Promotional Image: Three Selectable Static Header Designs', async (t) => {
  await t.test('1. Exactly three header options exist with correct labels and asset files', () => {
    assert.equal(ACCESSORIES_PROMOTIONAL_HEADERS.length, 3);
    assert.deepEqual(
      ACCESSORIES_PROMOTIONAL_HEADERS.map(h => h.label),
      ['Compu MSS', 'Souq', 'مكة']
    );
    assert.equal(ACCESSORIES_PROMOTIONAL_HEADERS[0].imageSrc, PROMOTIONAL_HEADER_ASSETS.banner);
    assert.equal(ACCESSORIES_PROMOTIONAL_HEADERS[1].imageSrc, '/assets/promotional/promotional-header-souq.jpg');
    assert.equal(ACCESSORIES_PROMOTIONAL_HEADERS[2].imageSrc, '/assets/promotional/promotional-header-makkah.jpg');

    // Verify physical asset files exist in public/assets/promotional/
    assert.ok(fs.existsSync(path.resolve('public/assets/promotional/promotional-header-souq.jpg')));
    assert.ok(fs.existsSync(path.resolve('public/assets/promotional/promotional-header-makkah.jpg')));
    assert.ok(fs.existsSync(path.resolve('public/assets/promotional/compu_mss_header_banner.jpg')));
  });

  await t.test('2. Header selector UI exists ONLY in AccessoriesPromotionalView, NEVER in MSS', () => {
    const accView = fs.readFileSync(
      path.resolve('src/components/placeholders/accessories/AccessoriesPromotionalView.tsx'),
      'utf8'
    );
    const sharedGen = fs.readFileSync(
      path.resolve('src/components/placeholders/mss/MSSPromotionalGenerator.tsx'),
      'utf8'
    );
    const mssReports = fs.readFileSync(
      path.resolve('src/components/placeholders/mss/MSSDeviceReportsView.tsx'),
      'utf8'
    );

    assert.ok(accView.includes('ACCESSORIES_PROMOTIONAL_HEADERS'), 'Accessories view must render header selector');
    assert.ok(accView.includes('headerImageSrc={selectedHeaderOption.imageSrc}'), 'Accessories view passes selected headerImageSrc');
    assert.ok(accView.includes('headerId={selectedHeaderOption.id}'), 'Accessories view passes selected headerId');
    assert.ok(!sharedGen.includes('ACCESSORIES_PROMOTIONAL_HEADERS'), 'Shared generator must NOT contain Accessories header selector');
    assert.ok(!sharedGen.includes('promotional-header-souq'), 'Shared generator must NOT hardcode Souq header');
    assert.ok(!sharedGen.includes('promotional-header-makkah'), 'Shared generator must NOT hardcode Makkah header');
    assert.ok(!mssReports.includes('headerImageSrc'), 'MSS reports view must NOT pass headerImageSrc');
    assert.ok(!mssReports.includes('headerId'), 'MSS reports view must NOT pass headerId');
    assert.ok(
      sharedGen.includes("mode === 'accessories_manual'") && sharedGen.includes('themeId: headerId'),
      'Shared generator must gate custom headerImageSrc and themeId strictly on accessories_manual mode'
    );
  });

  await t.test('3. Compu MSS is selected by default in Accessories', () => {
    memStorage.clear();
    const defaultId = loadSelectedHeaderId();
    assert.equal(defaultId, 'compu_mss');
    assert.equal(getAccessoriesHeaderOption(defaultId).imageSrc, PROMOTIONAL_HEADER_ASSETS.banner);
  });

  await t.test('4 & 5 & 6. Switching between Souq, مكة, and back to Compu MSS updates selection and restores original', () => {
    saveSelectedHeaderId('souq');
    assert.equal(loadSelectedHeaderId(), 'souq');
    assert.equal(getAccessoriesHeaderOption('souq').imageSrc, '/assets/promotional/promotional-header-souq.jpg');

    saveSelectedHeaderId('makkah');
    assert.equal(loadSelectedHeaderId(), 'makkah');
    assert.equal(getAccessoriesHeaderOption('makkah').imageSrc, '/assets/promotional/promotional-header-makkah.jpg');

    saveSelectedHeaderId('compu_mss');
    assert.equal(loadSelectedHeaderId(), 'compu_mss');
    assert.equal(getAccessoriesHeaderOption('compu_mss').imageSrc, PROMOTIONAL_HEADER_ASSETS.banner);
  });

  await t.test('7, 8, 9 & 10. Canvas rendering uses selected header across pages and handles rapid switching', async () => {
    const drawnImages = [];
    const mockCtx = {
      save: () => {},
      restore: () => {},
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      quadraticCurveTo: () => {},
      arc: () => {},
      closePath: () => {},
      fill: () => {},
      stroke: () => {},
      clip: () => {},
      fillRect: () => {},
      strokeRect: () => {},
      clearRect: () => {},
      fillText: () => {},
      measureText: (txt) => ({ width: (txt || '').length * 8 }),
      drawImage: (img) => {
        drawnImages.push(img.src);
      },
      font: '',
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      textAlign: 'center',
      textBaseline: 'middle',
      direction: 'ltr',
    };
    const mockCanvas = { width: 0, height: 0, getContext: () => mockCtx };

    const items = Array.from({ length: 12 }, (_, idx) => ({
      id: `item-${idx}`,
      brand: 'Dell',
      model_name: `Model ${idx + 1}`,
      processor: 'Core i7',
      ram: '16GB',
      storage: '512GB SSD',
      gpu: 'Intel',
      screen: '15.6"',
      price: 15000 + idx * 500,
      quantity: 2,
    }));

    // Rapidly switch souq -> makkah -> souq and preload before export
    saveSelectedHeaderId('souq');
    saveSelectedHeaderId('makkah');
    const latestHeader = getAccessoriesHeaderOption(loadSelectedHeaderId());
    await ensurePromotionalImageLoaded(latestHeader.imageSrc);

    // Render Page 1 and Page 2 with Makkah header
    drawnImages.length = 0;
    renderPromotionalToCanvas(
      items,
      { showPrice: true, showQuantity: true, pageIndex: 0, itemsPerPage: 9, headerImageSrc: latestHeader.imageSrc },
      mockCanvas
    );
    renderPromotionalToCanvas(
      items,
      { showPrice: true, showQuantity: true, pageIndex: 1, itemsPerPage: 9, headerImageSrc: latestHeader.imageSrc },
      mockCanvas
    );

    const drawnBanners = drawnImages.filter(
      src => src.includes('promotional-header-') || src === PROMOTIONAL_HEADER_ASSETS.banner
    );
    assert.equal(drawnBanners.length, 2, 'Both pages must draw header banner image');
    assert.equal(drawnBanners[0], '/assets/promotional/promotional-header-makkah.jpg');
    assert.equal(drawnBanners[1], '/assets/promotional/promotional-header-makkah.jpg');
  });

  await t.test('11 & 12. MSS Canvas rendering always uses Compu MSS banner regardless of Accessories selection', () => {
    saveSelectedHeaderId('souq');
    assert.equal(memStorage.get(ACCESSORIES_HEADER_STORAGE_KEY), 'souq');

    const drawnImages = [];
    const mockCtx = {
      save: () => {},
      restore: () => {},
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      quadraticCurveTo: () => {},
      arc: () => {},
      closePath: () => {},
      fill: () => {},
      stroke: () => {},
      clip: () => {},
      fillRect: () => {},
      strokeRect: () => {},
      clearRect: () => {},
      fillText: () => {},
      measureText: (txt) => ({ width: (txt || '').length * 8 }),
      drawImage: (img) => drawnImages.push(img.src),
      font: '',
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      textAlign: 'center',
      textBaseline: 'middle',
      direction: 'ltr',
    };
    const mockCanvas = { width: 0, height: 0, getContext: () => mockCtx };

    // MSS calls renderPromotionalToCanvas without headerImageSrc
    renderPromotionalToCanvas(
      [{ id: 'mss-1', brand: 'HP', model_name: 'ProBook', processor: 'Core i5', ram: '8GB', storage: '256GB', gpu: 'Intel', screen: '14"', price: 12000, quantity: 1 }],
      { showPrice: true, showQuantity: false },
      mockCanvas
    );

    assert.equal(drawnImages[0], PROMOTIONAL_HEADER_ASSETS.banner, 'MSS must strictly use original Compu MSS banner');
  });

  await t.test('13 & 14. Dynamic Theme Matching: Centralized themes synchronize HTML preview, Canvas, and exports for SOUQ, Makkah, and Compu MSS', () => {
    // 1. Verify centralized theme resolution by ID and by imageSrc
    const compuTheme = resolvePromotionalTheme('compu_mss');
    const souqTheme = resolvePromotionalTheme('souq');
    const makkahTheme = resolvePromotionalTheme('makkah');

    assert.equal(compuTheme.id, 'compu_mss');
    assert.equal(compuTheme.posterBg, '#ffffff');
    assert.equal(compuTheme.tableHeaderBg, '#071d49');
    assert.equal(compuTheme.priceText, '#0a2558');

    assert.equal(souqTheme.id, 'souq');
    assert.equal(souqTheme.isDark, true);
    assert.equal(resolvePromotionalTheme(undefined, '/assets/promotional/promotional-header-souq.jpg').id, 'souq');

    assert.equal(makkahTheme.id, 'makkah');
    assert.equal(makkahTheme.isDark, true);
    assert.equal(resolvePromotionalTheme(undefined, '/assets/promotional/promotional-header-makkah.jpg').id, 'makkah');

    // 2. Capture Canvas fillStyle & strokeStyle values for each theme
    const captureCanvasColors = (themeOptions) => {
      const fillStyles = [];
      const strokeStyles = [];
      const mockCtx = {
        save: () => {},
        restore: () => {},
        beginPath: () => {},
        moveTo: () => {},
        lineTo: () => {},
        quadraticCurveTo: () => {},
        arc: () => {},
        closePath: () => {},
        fill: () => { fillStyles.push(mockCtx.fillStyle); },
        stroke: () => { strokeStyles.push(mockCtx.strokeStyle); },
        clip: () => {},
        fillRect: () => { fillStyles.push(mockCtx.fillStyle); },
        strokeRect: () => { strokeStyles.push(mockCtx.strokeStyle); },
        clearRect: () => {},
        fillText: () => { fillStyles.push(mockCtx.fillStyle); },
        measureText: (txt) => ({ width: (txt || '').length * 8 }),
        drawImage: () => {},
        font: '',
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 1,
        textAlign: 'center',
        textBaseline: 'middle',
        direction: 'ltr',
      };
      const mockCanvas = { width: 0, height: 0, getContext: () => mockCtx };
      renderPromotionalToCanvas(
        [{
          id: 'theme-test-1',
          brand: 'Dell',
          model_name: 'Latitude 5540',
          processor: 'i7',
          generation: 'الجيل الثالث عشر',
          ram: '16GB',
          storage: '512GB SSD',
          gpu: 'Intel',
          screen: '15.6"',
          price: 25000,
          quantity: 3,
        }, {
          id: 'theme-test-2',
          brand: 'HP',
          model_name: 'ZBook G8',
          processor: 'i7',
          generation: 'الجيل الحادي عشر',
          ram: '32GB',
          storage: '1TB SSD',
          gpu: 'NVIDIA 4GB',
          screen: '15.6"',
          price: 32000,
          quantity: 1,
        }],
        { showPrice: true, showQuantity: true, ...themeOptions },
        mockCanvas
      );
      return { fillStyles, strokeStyles };
    };

    const souqRender = captureCanvasColors({
      themeId: 'souq',
      headerImageSrc: '/assets/promotional/promotional-header-souq.jpg',
    });
    assert.ok(souqRender.fillStyles.includes(PROMOTIONAL_THEMES.souq.posterBg), 'SOUQ Canvas must use SOUQ posterBg');
    assert.ok(souqRender.fillStyles.includes(PROMOTIONAL_THEMES.souq.tableHeaderBg), 'SOUQ Canvas must use SOUQ tableHeaderBg');
    assert.ok(souqRender.fillStyles.includes(PROMOTIONAL_THEMES.souq.rowEvenBg), 'SOUQ Canvas must use SOUQ rowEvenBg');
    assert.ok(souqRender.fillStyles.includes(PROMOTIONAL_THEMES.souq.rowOddBg), 'SOUQ Canvas must use SOUQ rowOddBg');
    assert.ok(souqRender.fillStyles.includes(PROMOTIONAL_THEMES.souq.priceText), 'SOUQ Canvas must use SOUQ priceText');
    assert.ok(souqRender.strokeStyles.includes(PROMOTIONAL_THEMES.souq.tableOuterBorder), 'SOUQ Canvas must use SOUQ tableOuterBorder');
    assert.ok(!souqRender.fillStyles.includes(PROMOTIONAL_THEMES.makkah.rowEvenBg), 'SOUQ Canvas must not use Makkah colors');

    const makkahRender = captureCanvasColors({
      themeId: 'makkah',
      headerImageSrc: '/assets/promotional/promotional-header-makkah.jpg',
    });
    assert.ok(makkahRender.fillStyles.includes(PROMOTIONAL_THEMES.makkah.posterBg), 'Makkah Canvas must use Makkah posterBg');
    assert.ok(makkahRender.fillStyles.includes(PROMOTIONAL_THEMES.makkah.tableHeaderBg), 'Makkah Canvas must use Makkah tableHeaderBg');
    assert.ok(makkahRender.fillStyles.includes(PROMOTIONAL_THEMES.makkah.rowEvenBg), 'Makkah Canvas must use Makkah rowEvenBg');
    assert.ok(makkahRender.fillStyles.includes(PROMOTIONAL_THEMES.makkah.rowOddBg), 'Makkah Canvas must use Makkah rowOddBg');
    assert.ok(makkahRender.fillStyles.includes(PROMOTIONAL_THEMES.makkah.priceText), 'Makkah Canvas must use Makkah priceText');
    assert.ok(makkahRender.strokeStyles.includes(PROMOTIONAL_THEMES.makkah.tableOuterBorder), 'Makkah Canvas must use Makkah tableOuterBorder');
    assert.ok(!makkahRender.fillStyles.includes(PROMOTIONAL_THEMES.souq.rowEvenBg), 'Makkah Canvas must not use SOUQ colors');

    const compuRender = captureCanvasColors({
      themeId: 'compu_mss',
      headerImageSrc: PROMOTIONAL_HEADER_ASSETS.banner,
    });
    assert.ok(compuRender.fillStyles.includes(PROMOTIONAL_THEMES.compu_mss.posterBg), 'Compu MSS Canvas must preserve white posterBg');
    assert.ok(compuRender.fillStyles.includes(PROMOTIONAL_THEMES.compu_mss.tableHeaderBg), 'Compu MSS Canvas must preserve #071d49 tableHeaderBg');
    assert.ok(compuRender.fillStyles.includes(PROMOTIONAL_THEMES.compu_mss.priceText), 'Compu MSS Canvas must preserve #0a2558 priceText');
    assert.ok(!compuRender.fillStyles.includes(PROMOTIONAL_THEMES.souq.posterBg), 'Compu MSS Canvas must never use SOUQ colors');
    assert.ok(!compuRender.fillStyles.includes(PROMOTIONAL_THEMES.makkah.posterBg), 'Compu MSS Canvas must never use Makkah colors');

    // 3. Verify HTML preview & toPng export share resolvePromotionalTheme
    const sharedGen = fs.readFileSync(
      path.resolve('src/components/placeholders/mss/MSSPromotionalGenerator.tsx'),
      'utf8'
    );
    assert.ok(
      sharedGen.includes('resolvePromotionalTheme(displayOptions.themeId, displayOptions.headerImageSrc)'),
      'HTML preview must resolve theme via centralized resolvePromotionalTheme'
    );
    assert.ok(
      sharedGen.includes('backgroundColor: resolvePromotionalTheme('),
      'DOM toPng export must use theme.posterBg from resolvePromotionalTheme'
    );
  });
});
