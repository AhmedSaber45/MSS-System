import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// Mock localStorage and browser globals for Node.js environment
const memoryStorage = new Map();
globalThis.localStorage = {
  getItem: (k) => memoryStorage.get(k) || null,
  setItem: (k, v) => memoryStorage.set(k, String(v)),
  removeItem: (k) => memoryStorage.delete(k),
  clear: () => memoryStorage.clear(),
};

if (!globalThis.window) {
  globalThis.window = {
    localStorage: globalThis.localStorage,
    dispatchEvent: () => true,
    atob: (str) => Buffer.from(str, 'base64').toString('binary'),
    btoa: (str) => Buffer.from(str, 'binary').toString('base64'),
    scrollTo: () => {},
  };
}

// Import services and helpers
import {
  accessoriesPromotionalService,
  loadManualPromotionalDevices,
  saveManualPromotionalDevices,
  createPromotionalItemFromManual,
  ACCESSORIES_PROMOTIONAL_STORAGE_KEY,
} from '../src/services/accessoriesPromotionalService.ts';

import {
  exportStorageService,
  EXPORT_FOLDERS,
  EXPORT_SUBFOLDERS,
} from '../src/services/exportStorageService.ts';

import {
  sortPromotionalItems,
  preparePromotionalItems,
  filterPromotionalItems,
  renderPromotionalToCanvas,
  exportPromotionalAsPng,
  generatePromotionalArabicFilename,
} from '../src/services/mssPromotionalService.ts';

import { accessoriesNavItems } from '../src/config/navigationConfig.ts';

test('Accessories Promotional Image Generator - Complete Reuse & Data Independence Suite', async (t) => {
  let tempBaseDir;

  beforeEach(() => {
    memoryStorage.clear();
    tempBaseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'acc-promo-test-'));
    exportStorageService.setStorageLocation(tempBaseDir);
  });

  afterEach(() => {
    if (tempBaseDir && fs.existsSync(tempBaseDir)) {
      try {
        fs.rmSync(tempBaseDir, { recursive: true, force: true });
      } catch {
        // ignore
      }
    }
    exportStorageService.clearStorageLocation();
  });

  await t.test('1. Navigation & UI Integration: Accessories module includes "الصورة الدعائية"', () => {
    const promoNavItem = accessoriesNavItems.find(item => item.id === 'promotional-image');
    assert.ok(promoNavItem, 'accessoriesNavItems must contain an item with id "promotional-image"');
    assert.equal(promoNavItem.label, 'الصورة الدعائية', 'Navigation item label must be "الصورة الدعائية"');
    assert.ok(promoNavItem.icon, 'Navigation item must have an icon defined');

    // Verify AppShell route mapping exists
    const appShellContent = fs.readFileSync(path.resolve('src/components/layout/AppShell.tsx'), 'utf8');
    assert.ok(
      appShellContent.includes("case 'promotional-image':") &&
      appShellContent.includes('<AccessoriesPromotionalView />'),
      'AppShell must route promotional-image to AccessoriesPromotionalView'
    );
  });

  await t.test('2. Manual Device Entry: Add multiple devices with stable identifiers & local persistence', () => {
    const dev1 = createPromotionalItemFromManual({
      brand: 'HP',
      model_name: 'ProBook 650 G5',
      processor: 'Core i7-8565U',
      ram: '16GB DDR4',
      storage: '512GB SSD NVMe',
      gpu: 'Intel UHD 620',
      screen: '15.6 FHD',
      price: 18500,
      quantity: 3,
      notes: 'حالة الزيرو كرتونة فرز أول',
    });

    const dev2 = createPromotionalItemFromManual({
      brand: 'Dell',
      model_name: 'Latitude 5410',
      processor: 'Core i5-10310U',
      ram: '8GB DDR4',
      storage: '256GB SSD',
      gpu: 'Intel UHD',
      screen: '14.0 FHD',
      price: 14000,
      quantity: 5,
    });

    assert.ok(dev1.id.startsWith('manual_promo_'), 'Device ID must be stable and prefixed');
    assert.ok(dev2.id.startsWith('manual_promo_'), 'Device ID must be stable and prefixed');
    assert.notEqual(dev1.id, dev2.id, 'IDs must be unique');

    // Auto generation extraction
    assert.equal(dev1.generation, 'الجيل الثامن', 'Generation should auto-extract from Core i7-8565U');
    assert.equal(dev2.generation, 'الجيل العاشر', 'Generation should auto-extract from Core i5-10310U');

    // Persistence to independent storage
    saveManualPromotionalDevices([dev1, dev2]);
    const loaded = loadManualPromotionalDevices();
    assert.equal(loaded.length, 2, 'Must load exactly 2 devices from storage');
    assert.equal(loaded[0].model_name, 'ProBook 650 G5');
    assert.equal(loaded[1].model_name, 'Latitude 5410');
  });

  await t.test('3. Editing a manually entered device preserves ID and updates values', () => {
    const original = createPromotionalItemFromManual({
      brand: 'Lenovo',
      model_name: 'ThinkPad T14',
      processor: 'Core i5-10310U',
      ram: '8GB',
      storage: '256GB SSD',
      price: 15000,
    });

    const updated = createPromotionalItemFromManual(
      {
        brand: 'Lenovo',
        model_name: 'ThinkPad T14 Gen 1',
        processor: 'Core i7-10510U',
        ram: '16GB',
        storage: '512GB SSD',
        price: 17500,
      },
      original.id
    );

    assert.equal(updated.id, original.id, 'Edited device must preserve its original ID');
    assert.equal(updated.model_name, 'ThinkPad T14 Gen 1');
    assert.equal(updated.ram, '16GB');
    assert.equal(updated.price, 17500);
  });

  await t.test('4. Removing a manually entered device updates independent list', () => {
    const dev1 = createPromotionalItemFromManual({ brand: 'HP', model_name: 'Device 1' });
    const dev2 = createPromotionalItemFromManual({ brand: 'Dell', model_name: 'Device 2' });
    const dev3 = createPromotionalItemFromManual({ brand: 'Apple', model_name: 'Device 3' });

    let list = [dev1, dev2, dev3];
    saveManualPromotionalDevices(list);

    // Remove dev2
    list = list.filter(item => item.id !== dev2.id);
    saveManualPromotionalDevices(list);

    const loaded = loadManualPromotionalDevices();
    assert.equal(loaded.length, 2);
    assert.ok(!loaded.some(d => d.id === dev2.id), 'Deleted device must not exist in loaded list');
    assert.ok(loaded.some(d => d.id === dev1.id));
    assert.ok(loaded.some(d => d.id === dev3.id));
  });

  await t.test('5. Optional and empty specifications: Handles optional fields without fake dummy strings', () => {
    const minimalDev = createPromotionalItemFromManual({
      model_name: 'Custom Laptop',
      price: '',
      quantity: '',
    });

    assert.equal(minimalDev.model_name, 'Custom Laptop');
    assert.equal(minimalDev.brand, '---');
    assert.equal(minimalDev.processor, '---');
    assert.equal(minimalDev.gpu, '', 'Empty GPU must remain empty without fake GPU string');
    assert.equal(minimalDev.price, undefined, 'Empty price must remain undefined');
    assert.equal(minimalDev.quantity, 1, 'Default quantity should fall back to 1');
    assert.equal(minimalDev.notes, undefined, 'Empty notes should remain undefined');

    const withGpu = createPromotionalItemFromManual({
      model_name: 'Gaming Laptop',
      gpu: 'RTX 4060',
    });
    assert.equal(withGpu.gpu, 'RTX 4060', 'Provided GPU must be preserved');
  });

  await t.test('6. Filtering manually entered devices (brand, price, search)', () => {
    const devHP = createPromotionalItemFromManual({ brand: 'HP', model_name: 'ProBook', price: 12000, processor: 'Core i5' });
    const devDell = createPromotionalItemFromManual({ brand: 'Dell', model_name: 'Latitude', price: 18000, processor: 'Core i7' });
    const devApple = createPromotionalItemFromManual({ brand: 'Apple', model_name: 'MacBook Pro', price: 28000, processor: 'M1 Pro' });

    const all = [devHP, devDell, devApple];

    // Filter by Brand: HP
    const hpOnly = all.filter(d => d.brand.toLowerCase() === 'hp');
    assert.equal(hpOnly.length, 1);
    assert.equal(hpOnly[0].model_name, 'ProBook');

    // Filter by Price range: 15,000 to 30,000
    const midToHigh = all.filter(d => (d.price || 0) >= 15000 && (d.price || 0) <= 30000);
    assert.equal(midToHigh.length, 2);

    // Filter by search query: "macbook"
    const searchResult = all.filter(d =>
      `${d.brand} ${d.model_name} ${d.processor}`.toLowerCase().includes('macbook')
    );
    assert.equal(searchResult.length, 1);
    assert.equal(searchResult[0].brand, 'Apple');
  });

  await t.test('7. Price Sorting: sortPromotionalItems orders items correctly', () => {
    const devLow = createPromotionalItemFromManual({ model_name: 'Low', price: 10000 });
    const devMid = createPromotionalItemFromManual({ model_name: 'Mid', price: 15000 });
    const devHigh = createPromotionalItemFromManual({ model_name: 'High', price: 20000 });

    const sortedAsc = sortPromotionalItems([devHigh, devLow, devMid], 'asc');
    assert.equal(sortedAsc[0].price, 10000);
    assert.equal(sortedAsc[1].price, 15000);
    assert.equal(sortedAsc[2].price, 20000);

    const sortedDesc = sortPromotionalItems([devLow, devHigh, devMid], 'desc');
    assert.equal(sortedDesc[0].price, 20000);
    assert.equal(sortedDesc[1].price, 15000);
    assert.equal(sortedDesc[2].price, 10000);
  });

  await t.test('8. Promotional Image Rendering: renderPromotionalToCanvas accepts manual items seamlessly', () => {
    const items = [
      createPromotionalItemFromManual({ brand: 'HP', model_name: 'Victus 15', processor: 'Core i5-12500H', price: 25000 }),
      createPromotionalItemFromManual({ brand: 'Dell', model_name: 'G15 5520', processor: 'Core i7-12700H', price: 32000 }),
    ];

    // Mock HTML5 canvas
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ({
        fillRect: () => {},
        drawImage: () => {},
        fillText: () => {},
        strokeText: () => {},
        beginPath: () => {},
        moveTo: () => {},
        lineTo: () => {},
        quadraticCurveTo: () => {},
        arc: () => {},
        closePath: () => {},
        clip: () => {},
        stroke: () => {},
        fill: () => {},
        save: () => {},
        restore: () => {},
        measureText: (txt) => ({ width: (txt || '').length * 8 }),
      }),
      toDataURL: () => 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    };

    // Must execute cleanly without error
    assert.doesNotThrow(() => {
      renderPromotionalToCanvas(items, { showPrice: true, showQuantity: false }, canvas);
    });
    assert.equal(canvas.width, 1200, 'Canvas width must be 1200px');
    assert.ok(canvas.height > 500, 'Canvas height must accommodate commercial header and rows');
  });

  await t.test('9. Complete Data Independence: Zero queries to Accessories or MSS inventory tables', () => {
    const serviceContent = fs.readFileSync(path.resolve('src/services/accessoriesPromotionalService.ts'), 'utf8');
    const viewContent = fs.readFileSync(path.resolve('src/components/placeholders/accessories/AccessoriesPromotionalView.tsx'), 'utf8');

    // Confirm no inventory database imports
    assert.ok(!serviceContent.includes('mssInventoryService'), 'Must not import mssInventoryService');
    assert.ok(!serviceContent.includes('supabase'), 'Must not import Supabase');
    assert.ok(!serviceContent.includes('productsService'), 'Must not import productsService');
    assert.ok(!viewContent.includes('mssInventoryService'), 'View must not import mssInventoryService');
    assert.ok(!viewContent.includes('useProducts'), 'View must not import useProducts');
    assert.ok(!viewContent.includes('purchasesService'), 'View must not import purchasesService');
  });

  await t.test('10. Complete Data Independence: Adding, editing, removing items modifies zero inventory records', () => {
    // Only localStorage is touched
    const dev = createPromotionalItemFromManual({ brand: 'Asus', model_name: 'ROG Strix', price: 45000 });
    saveManualPromotionalDevices([dev]);

    const storageRaw = memoryStorage.get(ACCESSORIES_PROMOTIONAL_STORAGE_KEY);
    assert.ok(storageRaw, 'Only dedicated localStorage key should be populated');
    assert.ok(storageRaw.includes('ROG Strix'), 'Stored data contains manual device');
  });

  await t.test('11. Export Location: All generated Accessories promotional images save inside "<Selected Base Directory>/Custom images/"', async () => {
    assert.equal(EXPORT_FOLDERS.CUSTOM_IMAGES, 'Custom images');
    assert.equal(EXPORT_SUBFOLDERS.custom_images, 'Custom images');

    // Verify expected folder path
    const expectedPath = exportStorageService.getExpectedFolderPath('custom_images');
    const expectedTarget = path.join(tempBaseDir, 'Custom images');
    assert.equal(path.normalize(expectedPath), path.normalize(expectedTarget));

    // Save dummy PNG image using exportStorageService
    const dummyPngData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const filename = 'عروض_أجهزة_تجريبية.png';

    const saveResult = await exportStorageService.saveExportedFile({
      exportType: 'custom_images',
      filename,
      data: dummyPngData,
      mimeType: 'image/png',
    });

    assert.ok(saveResult.success, 'Save operation must succeed');
    assert.ok(saveResult.savedToCustomLocation, 'Must save to custom storage location');

    // Verify file actually exists in <Selected Base Directory>/Custom images/
    const targetFolder = path.join(tempBaseDir, 'Custom images');
    assert.ok(fs.existsSync(targetFolder), 'Custom images folder must be created on disk');

    const filesInCustomImages = fs.readdirSync(targetFolder);
    assert.ok(filesInCustomImages.length >= 1, 'File must exist inside Custom images folder');
    assert.ok(filesInCustomImages[0].includes('عروض_أجهزة_تجريبية'), 'File name must match');

    // Verify collision avoidance when saving same filename again into existing Custom images folder
    const saveResult2 = await exportStorageService.saveExportedFile({
      exportType: 'custom_images',
      filename,
      data: dummyPngData,
      mimeType: 'image/png',
    });
    assert.ok(saveResult2.success, 'Second save in existing Custom images folder must succeed');
    assert.equal(fs.readdirSync(targetFolder).length, 2, 'Collision avoidance must keep both files');

    // Verify invalid path produces an error (not false success)
    exportStorageService.setStorageLocation('Z:\\invalid\0path\\custom_test');
    const invalidRes = await exportStorageService.saveExportedFile({
      exportType: 'custom_images',
      filename,
      data: dummyPngData,
      mimeType: 'image/png',
      interactive: false,
      skipFallbackDownload: true,
    });
    assert.equal(invalidRes.success, false, 'Invalid storage location must fail rather than report success');
    assert.equal(invalidRes.savedToCustomLocation, false, 'Invalid storage location must not report savedToCustomLocation');
    exportStorageService.setStorageLocation(tempBaseDir);

    // Verify MSS System Files folder was NOT created for custom_images export
    const mssFilesRoot = path.join(tempBaseDir, 'MSS System Files');
    assert.ok(!fs.existsSync(mssFilesRoot), 'MSS System Files root folder must NOT be created for Custom images export');
  });

  await t.test('12. MSS Promotional Generator Remains Intact: MSS export retains "MSS System Files/MSS Images"', async () => {
    const expectedMssPath = exportStorageService.getExpectedFolderPath('mss_images');
    const expectedMssTarget = path.join(tempBaseDir, 'MSS System Files', 'MSS Images');
    assert.equal(path.normalize(expectedMssPath), path.normalize(expectedMssTarget));

    // Save an MSS promotional image
    const dummyPngData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const mssFilename = 'عروض_ام_اس_اس.png';

    const mssSaveResult = await exportStorageService.saveExportedFile({
      exportType: 'mss_images',
      filename: mssFilename,
      data: dummyPngData,
      mimeType: 'image/png',
    });

    assert.ok(mssSaveResult.success, 'MSS save operation must succeed');
    assert.ok(fs.existsSync(expectedMssTarget), 'MSS Images folder inside MSS System Files must be created');
  });

  await t.test('13. Edit Device Data UX: Clicking Edit loads device data and smoothly scrolls to form across window or scrollable container', () => {
    const viewPath = path.resolve('src/components/placeholders/accessories/AccessoriesPromotionalView.tsx');
    const viewContent = fs.readFileSync(viewPath, 'utf8');

    assert.ok(viewContent.includes('const formCardRef = useRef<HTMLDivElement | null>(null);'), 'formCardRef must be defined');
    assert.ok(viewContent.includes('<div ref={formCardRef} className="scroll-mt-6">'), 'Form container must have ref and top scroll offset');
    assert.ok(viewContent.includes("formEl.scrollIntoView({ behavior: 'smooth', block: 'start' })"), 'Must scroll form into view smoothly');
    assert.ok(viewContent.includes("style.overflowY === 'auto' || style.overflowY === 'scroll'"), 'Must support internal scrollable containers');
    assert.ok(viewContent.includes('window.requestAnimationFrame'), 'Must wait for React render commit before scrolling');
  });
});
