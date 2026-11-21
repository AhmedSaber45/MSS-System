import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// Setup mock browser/window/localStorage environment for Node.js
const storage = new Map();
globalThis.localStorage = {
  getItem: (k) => storage.get(k) || null,
  setItem: (k, v) => storage.set(k, String(v)),
  removeItem: (k) => storage.delete(k),
  clear: () => storage.clear(),
};

if (!globalThis.window) {
  globalThis.window = {
    localStorage: globalThis.localStorage,
    dispatchEvent: () => true,
    atob: (str) => Buffer.from(str, 'base64').toString('binary'),
    btoa: (str) => Buffer.from(str, 'binary').toString('base64'),
  };
} else {
  globalThis.window.atob = globalThis.window.atob || ((str) => Buffer.from(str, 'base64').toString('binary'));
  globalThis.window.btoa = globalThis.window.btoa || ((str) => Buffer.from(str, 'binary').toString('base64'));
}

if (!globalThis.CustomEvent) {
  globalThis.CustomEvent = class CustomEvent {
    constructor(type, eventInitDict) {
      this.type = type;
      this.detail = eventInitDict?.detail;
    }
  };
}

// Canvas mock for image generation tests
if (!globalThis.document) {
  globalThis.document = {
    getElementById: (id) => null,
    querySelectorAll: () => [],
    createElement: (tag) => {
      if (tag === 'canvas') {
        return {
          width: 800,
          height: 600,
          getContext: () => ({
            fillRect: () => {},
            clearRect: () => {},
            drawImage: () => {},
            fillText: () => {},
            measureText: () => ({ width: 50 }),
            beginPath: () => {},
            moveTo: () => {},
            lineTo: () => {},
            stroke: () => {},
            fill: () => {},
            arc: () => {},
            arcTo: () => {},
            quadraticCurveTo: () => {},
            bezierCurveTo: () => {},
            closePath: () => {},
            save: () => {},
            restore: () => {},
            clip: () => {},
            setTransform: () => {},
            scale: () => {},
            rotate: () => {},
            translate: () => {},
          }),
          toDataURL: () => 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        };
      }
      return {
        appendChild: () => {},
        removeChild: () => {},
        click: () => {},
        href: '',
        download: '',
      };
    },
    body: {
      appendChild: () => {},
      removeChild: () => {},
    },
    fonts: {
      ready: Promise.resolve(),
    },
  };
}

// Import services under test
const {
  exportStorageService,
  ROOT_EXPORT_FOLDER,
  EXPORT_FOLDERS,
  EXPORT_SUBFOLDERS,
  EXPORT_STORAGE_LOCATION_KEY,
} = await import('../src/services/exportStorageService.ts');

const { mssWholesaleExportService } = await import('../src/services/mssWholesaleExportService.ts');
const { exportPromotionalAsPng, exportPromotionalAsPdf } = await import('../src/services/mssPromotionalService.ts');
const { documentPrintService } = await import('../src/lib/documentPrintService.ts');

describe('Configurable Export Storage Location & Automatic File Organization', () => {
  let tempBaseDirA;
  let tempBaseDirB;

  beforeEach(() => {
    storage.clear();
    exportStorageService.setCustomFolderPicker(null);
    exportStorageService.clearStorageLocation();
    tempBaseDirA = fs.mkdtempSync(path.join(os.tmpdir(), 'mss-export-test-a-'));
    tempBaseDirB = fs.mkdtempSync(path.join(os.tmpdir(), 'mss-export-test-b-'));
  });

  afterEach(() => {
    exportStorageService.setCustomFolderPicker(null);
    exportStorageService.clearStorageLocation();
    if (tempBaseDirA && fs.existsSync(tempBaseDirA)) {
      fs.rmSync(tempBaseDirA, { recursive: true, force: true });
    }
    if (tempBaseDirB && fs.existsSync(tempBaseDirB)) {
      fs.rmSync(tempBaseDirB, { recursive: true, force: true });
    }
  });

  test('1. Exact Folder Names & Structure Constants match requirements', () => {
    assert.strictEqual(ROOT_EXPORT_FOLDER, 'MSS System Files');
    assert.strictEqual(EXPORT_FOLDERS.ROOT, 'MSS System Files');

    // Exact subfolder names
    assert.strictEqual(EXPORT_FOLDERS.ACCESSORIES_INVOICES, 'فواتير الاكسسوارات');
    assert.strictEqual(EXPORT_FOLDERS.MSS_INVOICES, 'فواتير MSS');
    assert.strictEqual(EXPORT_FOLDERS.ACCESSORIES_REPORTS, 'تقارير الاكسسوارات');
    assert.strictEqual(EXPORT_FOLDERS.MSS_REPORTS, 'تقارير MSS');
    assert.strictEqual(EXPORT_FOLDERS.MSS_EXCEL, 'MSS Exel Sheets');
    assert.strictEqual(EXPORT_FOLDERS.MSS_IMAGES, 'MSS Images');
    assert.strictEqual(EXPORT_FOLDERS.ACCESSORIES_EXCEL, 'Accessories Exel sheets');

    // Mapping completeness for all 7 types
    assert.strictEqual(EXPORT_SUBFOLDERS.accessories_invoices, 'فواتير الاكسسوارات');
    assert.strictEqual(EXPORT_SUBFOLDERS.mss_invoices, 'فواتير MSS');
    assert.strictEqual(EXPORT_SUBFOLDERS.accessories_reports, 'تقارير الاكسسوارات');
    assert.strictEqual(EXPORT_SUBFOLDERS.mss_reports, 'تقارير MSS');
    assert.strictEqual(EXPORT_SUBFOLDERS.mss_excel, 'MSS Exel Sheets');
    assert.strictEqual(EXPORT_SUBFOLDERS.mss_images, 'MSS Images');
    assert.strictEqual(EXPORT_SUBFOLDERS.accessories_excel, 'Accessories Exel sheets');
  });

  test('2. Setting Storage & Persistence across restarts in localStorage', () => {
    assert.strictEqual(exportStorageService.getStorageLocation(), null);
    assert.strictEqual(exportStorageService.isDestinationConfigured(), false);

    // Set custom destination
    exportStorageService.setStorageLocation(tempBaseDirA);
    assert.strictEqual(exportStorageService.getStorageLocation(), tempBaseDirA);
    assert.strictEqual(exportStorageService.isDestinationConfigured(), true);
    assert.strictEqual(localStorage.getItem(EXPORT_STORAGE_LOCATION_KEY), tempBaseDirA);

    // Simulating app restart / new instance: reads from persisted localStorage
    assert.strictEqual(exportStorageService.getStorageLocation(), tempBaseDirA);

    // Can change destination at any time
    exportStorageService.setStorageLocation(tempBaseDirB);
    assert.strictEqual(exportStorageService.getStorageLocation(), tempBaseDirB);
    assert.strictEqual(localStorage.getItem(EXPORT_STORAGE_LOCATION_KEY), tempBaseDirB);

    // Clear destination
    exportStorageService.clearStorageLocation();
    assert.strictEqual(exportStorageService.getStorageLocation(), null);
    assert.strictEqual(exportStorageService.isDestinationConfigured(), false);
    assert.strictEqual(localStorage.getItem(EXPORT_STORAGE_LOCATION_KEY), null);
  });

  test('3. Automatic Root Folder Creation: NOT created immediately when set, only created on first export', async () => {
    exportStorageService.setStorageLocation(tempBaseDirA);

    const expectedRoot = path.join(tempBaseDirA, 'MSS System Files');
    // Immediately after setting destination, root folder MUST NOT exist yet
    assert.strictEqual(fs.existsSync(expectedRoot), false, 'Root folder must not be created on destination selection');

    // Perform an export operation
    const result = await exportStorageService.saveExportedFile({
      exportType: 'mss_invoices',
      filename: 'فاتورة_MSS-INV-001.pdf',
      data: Buffer.from('Mock invoice pdf data'),
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.savedToCustomLocation, true);

    // NOW root folder must exist
    assert.strictEqual(fs.existsSync(expectedRoot), true, 'Root folder should be created on first export');
  });

  test('4. Lazy Creation of Subfolders: Only the subfolder for the triggered export is created', async () => {
    exportStorageService.setStorageLocation(tempBaseDirA);
    const expectedRoot = path.join(tempBaseDirA, 'MSS System Files');

    // Export only Compu MSS Invoices
    await exportStorageService.saveExportedFile({
      exportType: 'mss_invoices',
      filename: 'فاتورة_MSS-INV-002.pdf',
      data: Buffer.from('MSS invoice file'),
    });

    const mssInvoicesFolder = path.join(expectedRoot, 'فواتير MSS');
    assert.strictEqual(fs.existsSync(mssInvoicesFolder), true);

    // The other 6 subfolders must NOT be created yet
    const otherFolders = [
      'فواتير الاكسسوارات',
      'تقارير الاكسسوارات',
      'تقارير MSS',
      'MSS Exel Sheets',
      'MSS Images',
      'Accessories Exel sheets',
    ];

    for (const folderName of otherFolders) {
      assert.strictEqual(
        fs.existsSync(path.join(expectedRoot, folderName)),
        false,
        `Subfolder "${folderName}" should not be created until its export type is used`
      );
    }

    // Now export an Excel sheet
    await exportStorageService.saveExportedFile({
      exportType: 'mss_excel',
      filename: 'الاجهزة_المتاحة_2026-11-21.xlsx',
      data: Buffer.from('Mock excel content'),
    });

    const mssExcelFolder = path.join(expectedRoot, 'MSS Exel Sheets');
    assert.strictEqual(fs.existsSync(mssExcelFolder), true, 'MSS Exel Sheets folder should now be created lazily');

    // Other unused folders still do not exist
    assert.strictEqual(fs.existsSync(path.join(expectedRoot, 'MSS Images')), false);
    assert.strictEqual(fs.existsSync(path.join(expectedRoot, 'فواتير الاكسسوارات')), false);
  });

  test('5. All 7 Subfolders created with exact names when all export types are executed', async () => {
    exportStorageService.setStorageLocation(tempBaseDirA);
    const expectedRoot = path.join(tempBaseDirA, 'MSS System Files');

    const testExports = [
      { type: 'accessories_invoices', name: 'فاتورة_INV-100.pdf', expectedSub: 'فواتير الاكسسوارات' },
      { type: 'mss_invoices', name: 'فاتورة_MSS-INV-100.pdf', expectedSub: 'فواتير MSS' },
      { type: 'accessories_reports', name: 'تقرير_الأرباح_2026-11-21.pdf', expectedSub: 'تقارير الاكسسوارات' },
      { type: 'mss_reports', name: 'تقرير_أرباح_Compu_MSS_2026-11-21.pdf', expectedSub: 'تقارير MSS' },
      { type: 'mss_excel', name: 'مخزون_الجملة_2026-11-21.xlsx', expectedSub: 'MSS Exel Sheets' },
      { type: 'mss_images', name: 'عرض_Apple_2026-11-21.png', expectedSub: 'MSS Images' },
      { type: 'accessories_excel', name: 'مخزون_الاكسسوارات_2026-11-21.xlsx', expectedSub: 'Accessories Exel sheets' },
    ];

    for (const item of testExports) {
      const res = await exportStorageService.saveExportedFile({
        exportType: item.type,
        filename: item.name,
        data: Buffer.from(`Data for ${item.name}`),
      });

      assert.strictEqual(res.success, true);
      assert.strictEqual(res.savedToCustomLocation, true);
      const targetSubPath = path.join(expectedRoot, item.expectedSub);
      assert.strictEqual(fs.existsSync(targetSubPath), true, `Directory "${item.expectedSub}" must exist`);
      const targetFilePath = path.join(targetSubPath, item.name);
      assert.strictEqual(fs.existsSync(targetFilePath), true, `File "${item.name}" must exist inside "${item.expectedSub}"`);
    }
  });

  test('6. Reuses existing subfolders without creating duplicate or nested folders', async () => {
    exportStorageService.setStorageLocation(tempBaseDirA);
    const expectedRoot = path.join(tempBaseDirA, 'MSS System Files');

    // Pre-create standard subfolder
    const reportsDir = path.join(expectedRoot, 'تقارير MSS');
    fs.mkdirSync(reportsDir, { recursive: true });

    // Save multiple reports
    await exportStorageService.saveExportedFile({
      exportType: 'mss_reports',
      filename: 'تقرير_1.pdf',
      data: Buffer.from('rep 1'),
    });
    await exportStorageService.saveExportedFile({
      exportType: 'mss_reports',
      filename: 'تقرير_2.pdf',
      data: Buffer.from('rep 2'),
    });

    const entries = fs.readdirSync(expectedRoot);
    const reportsEntries = entries.filter(e => e.includes('تقارير MSS'));
    assert.strictEqual(reportsEntries.length, 1, 'Must not duplicate the folder');
    assert.strictEqual(fs.readdirSync(reportsDir).length, 2);
  });

  test('7. Filename collision handling: appends " (1)", " (2)" and never overwrites existing files', async () => {
    exportStorageService.setStorageLocation(tempBaseDirA);

    // Export file 1
    const res1 = await exportStorageService.saveExportedFile({
      exportType: 'mss_excel',
      filename: 'مخزون_الجملة.xlsx',
      data: Buffer.from('version 1'),
    });
    assert.strictEqual(res1.filename, 'مخزون_الجملة.xlsx');

    // Export file 2 with SAME name
    const res2 = await exportStorageService.saveExportedFile({
      exportType: 'mss_excel',
      filename: 'مخزون_الجملة.xlsx',
      data: Buffer.from('version 2'),
    });
    assert.strictEqual(res2.filename, 'مخزون_الجملة (1).xlsx');

    // Export file 3 with SAME name
    const res3 = await exportStorageService.saveExportedFile({
      exportType: 'mss_excel',
      filename: 'مخزون_الجملة.xlsx',
      data: Buffer.from('version 3'),
    });
    assert.strictEqual(res3.filename, 'مخزون_الجملة (2).xlsx');

    const subfolder = path.join(tempBaseDirA, 'MSS System Files', 'MSS Exel Sheets');
    assert.strictEqual(fs.readFileSync(path.join(subfolder, 'مخزون_الجملة.xlsx'), 'utf-8'), 'version 1');
    assert.strictEqual(fs.readFileSync(path.join(subfolder, 'مخزون_الجملة (1).xlsx'), 'utf-8'), 'version 2');
    assert.strictEqual(fs.readFileSync(path.join(subfolder, 'مخزون_الجملة (2).xlsx'), 'utf-8'), 'version 3');
  });

  test('8. Changing destination affects future exports without moving or deleting old files', async () => {
    // 1. Export to Location A
    exportStorageService.setStorageLocation(tempBaseDirA);
    await exportStorageService.saveExportedFile({
      exportType: 'mss_images',
      filename: 'صورة_عرض_A.png',
      data: Buffer.from('Image A content'),
    });

    const fileInA = path.join(tempBaseDirA, 'MSS System Files', 'MSS Images', 'صورة_عرض_A.png');
    assert.strictEqual(fs.existsSync(fileInA), true, 'File should exist in Location A');

    // 2. Change destination to Location B
    exportStorageService.setStorageLocation(tempBaseDirB);
    await exportStorageService.saveExportedFile({
      exportType: 'mss_images',
      filename: 'صورة_عرض_B.png',
      data: Buffer.from('Image B content'),
    });

    const fileInB = path.join(tempBaseDirB, 'MSS System Files', 'MSS Images', 'صورة_عرض_B.png');
    assert.strictEqual(fs.existsSync(fileInB), true, 'New file should exist in Location B');

    // Old file in Location A MUST still exist intact!
    assert.strictEqual(fs.existsSync(fileInA), true, 'Old file in Location A must remain completely intact');
  });

  test('9. Single Saved Path: Entered path immediately becomes active destination for future exports without prompting or folder pickers', async () => {
    exportStorageService.clearStorageLocation();
    assert.strictEqual(exportStorageService.isDestinationConfigured(), false);

    // Save path manually (simulating user entering path in text input and clicking "إضافة المسار")
    exportStorageService.setStorageLocation(tempBaseDirA);
    assert.strictEqual(exportStorageService.getStorageLocation(), tempBaseDirA);
    assert.strictEqual(exportStorageService.isDestinationConfigured(), true);

    // First export: Uses saved path immediately without any folder picker dialog
    const res1 = await exportStorageService.saveExportedFile({
      exportType: 'mss_invoices',
      filename: 'فاتورة_MSS-001.pdf',
      data: Buffer.from('PDF data 1'),
    });

    assert.strictEqual(res1.success, true);
    assert.strictEqual(res1.savedToCustomLocation, true);
    assert.strictEqual(exportStorageService.getStorageLocation(), tempBaseDirA);

    const savedFile1 = path.join(tempBaseDirA, 'MSS System Files', 'فواتير MSS', 'فاتورة_MSS-001.pdf');
    assert.strictEqual(fs.existsSync(savedFile1), true, 'File 1 should exist in saved folder');

    // Subsequent export: Uses saved path automatically without prompting
    const res2 = await exportStorageService.saveExportedFile({
      exportType: 'mss_invoices',
      filename: 'فاتورة_MSS-002.pdf',
      data: Buffer.from('PDF data 2'),
    });

    assert.strictEqual(res2.success, true);
    assert.strictEqual(res2.savedToCustomLocation, true);
    const savedFile2 = path.join(tempBaseDirA, 'MSS System Files', 'فواتير MSS', 'فاتورة_MSS-002.pdf');
    assert.strictEqual(fs.existsSync(savedFile2), true, 'File 2 should exist in previously saved folder');
  });

  test('10. Integration with mssWholesaleExportService: Exports directly to "MSS System Files/MSS Exel Sheets"', async () => {
    exportStorageService.setStorageLocation(tempBaseDirA);

    const mockDevices = [
      {
        id: 'dev-1',
        brand: 'Dell',
        model_name: 'Latitude 5420',
        serial_number: 'DELL-SN-1234',
        cpu: 'Core i5 11th Gen',
        ram: '16GB',
        storage: '512GB SSD',
        gpu: 'Intel Iris Xe',
        screen_size: '14 inch',
        wholesale_price: 15500,
        status: 'available',
        branch: 'محل 1',
      },
      {
        id: 'dev-2',
        brand: 'HP',
        model_name: 'EliteBook 840 G8',
        serial_number: 'HP-SN-5678',
        cpu: 'Core i7 11th Gen',
        ram: '16GB',
        storage: '512GB SSD',
        gpu: 'Intel Iris Xe',
        screen_size: '14 inch',
        wholesale_price: 18000,
        status: 'available',
        branch: 'محل 2',
      },
    ];

    const result = await mssWholesaleExportService.exportWholesaleInventoryToExcel(
      {
        exportMode: 'individual',
        baseTitle: 'مخزون_تجريبي',
      },
      mockDevices
    );

    assert.ok(result.filename.endsWith('.xlsx'));
    const expectedFilePath = path.join(tempBaseDirA, 'MSS System Files', 'MSS Exel Sheets', result.filename);
    assert.strictEqual(fs.existsSync(expectedFilePath), true, 'Excel file should be physically written to "MSS Exel Sheets"');
    const stats = fs.statSync(expectedFilePath);
    assert.ok(stats.size > 0, 'Exported Excel file must have non-zero size');
  });

  test('11. Integration with mssPromotionalService: Saves promotional images and PDF catalogs to "MSS Images"', async () => {
    exportStorageService.setStorageLocation(tempBaseDirA);

    // PNG Export
    exportPromotionalAsPng('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'عرض_دعائي_تجريبي');

    // Allow async save to flush
    await new Promise(r => setTimeout(r, 100));

    const imagesDir = path.join(tempBaseDirA, 'MSS System Files', 'MSS Images');
    assert.strictEqual(fs.existsSync(imagesDir), true, '"MSS Images" subfolder must exist');
    const files = fs.readdirSync(imagesDir);
    const pngFile = files.find(f => f.startsWith('عرض_دعائي_تجريبي') && f.endsWith('.png'));
    assert.ok(pngFile, 'Promotional PNG file should exist in "MSS Images"');

    // PDF Export
    const mockGroups = [
      {
        brand: 'Apple',
        modelName: 'MacBook Air M2',
        processor: 'Apple M2 8-Core',
        ram: '8GB',
        storage: '256GB SSD',
        gpu: '10-Core GPU',
        screen: '13.6 Retina',
        cashPrice: 38000,
        status: 'available',
        category: 'laptop',
        quantity: 3,
        devices: [],
      },
    ];

    const pdfRes = await exportPromotionalAsPdf(mockGroups, 'كتالوج_أجهزة_Compu_MSS');
    assert.ok(pdfRes.filename.endsWith('.pdf'));

    const pdfFiles = fs.readdirSync(imagesDir);
    const pdfFile = pdfFiles.find(f => f.startsWith('كتالوج_أجهزة_Compu_MSS') && f.endsWith('.pdf'));
    assert.ok(pdfFile, 'Promotional PDF catalog should exist in "MSS Images"');
  });

  test('12. Missing Destination: When no destination is configured, export halts with clear Arabic error and does NOT silently fall back or open picker', async () => {
    exportStorageService.clearStorageLocation();
    assert.strictEqual(exportStorageService.isDestinationConfigured(), false);

    const res = await exportStorageService.saveExportedFile({
      exportType: 'accessories_invoices',
      filename: 'فاتورة_ملغاة.pdf',
      data: Buffer.from('Cancelled invoice data'),
    });

    assert.strictEqual(res.success, false, 'Export must halt when no destination is configured');
    assert.strictEqual(res.savedToCustomLocation, false);
    assert.ok(res.error, 'An error message must be returned');
    assert.ok(res.error.includes('لم يتم تحديد مسار لحفظ ملفات التصدير'), `Error was: ${res.error}`);
    assert.strictEqual(exportStorageService.getStorageLocation(), null, 'Storage location remains unconfigured');
  });

  test('13. Persistence Across Application Restarts: Survives localStorage clearing via disk configuration', async () => {
    // User sets path
    exportStorageService.setStorageLocation(tempBaseDirA);
    assert.strictEqual(exportStorageService.getStorageLocation(), tempBaseDirA);

    // Simulate complete application close and restart:
    // clear localStorage, reset in-memory cache
    storage.clear();
    // In Node test, getStorageLocation() checks disk config file if localStorage is empty
    const recoveredLocation = await exportStorageService.getStorageLocationAsync();
    assert.strictEqual(recoveredLocation, tempBaseDirA, 'Location should be recovered from persistent disk configuration');
  });

  test('14. Inaccessible / Deleted Saved Folder: Detects missing folder, halts with clear Arabic error, and does NOT silently fall back', async () => {
    const dirToDelete = fs.mkdtempSync(path.join(os.tmpdir(), 'mss-to-delete-'));
    exportStorageService.setStorageLocation(dirToDelete);
    assert.strictEqual(exportStorageService.getStorageLocation(), dirToDelete);

    // Delete the saved directory to simulate deleted or moved folder
    fs.rmSync(dirToDelete, { recursive: true, force: true });
    assert.strictEqual(fs.existsSync(dirToDelete), false);

    // Run export: Should detect invalid path, halt with error, and alert user to update in Settings
    const res = await exportStorageService.saveExportedFile({
      exportType: 'accessories_reports',
      filename: 'تقرير_مبيعات_بديل.pdf',
      data: Buffer.from('Replacement report content'),
    });

    assert.strictEqual(res.success, false, 'Must halt when destination folder is missing or deleted');
    assert.strictEqual(res.savedToCustomLocation, false);
    assert.ok(res.error, 'Must provide clear error explaining why export stopped');
    assert.ok(res.error.includes('غير متاح') || res.error.includes('غير موجود'), `Error was: ${res.error}`);
  });

  test('15. Invalid Path Input Validation: Validating empty or nonexistent path fails and does not overwrite valid path', async () => {
    // Set a valid path first
    exportStorageService.setStorageLocation(tempBaseDirA);
    assert.strictEqual(exportStorageService.getStorageLocation(), tempBaseDirA);

    // Try validating an empty path
    const emptyCheck = await exportStorageService.validateDestination('');
    assert.strictEqual(emptyCheck.valid, false);
    assert.ok(emptyCheck.error?.includes('فارغ'));

    // Try validating a nonexistent path
    const nonExistentPath = 'C:\\NonExistent_Folder_12345_XYZ';
    const nonExistentCheck = await exportStorageService.validateDestination(nonExistentPath);
    assert.strictEqual(nonExistentCheck.valid, false);

    // Valid path remains intact and is NOT replaced by invalid path
    assert.strictEqual(exportStorageService.getStorageLocation(), tempBaseDirA);
  });

  test('16. Wholesale Excel Export: Throws clear error on missing destination without silent download fallback', async () => {
    exportStorageService.clearStorageLocation();

    const mockDevices = [
      {
        id: 'dev-1',
        brand: 'Dell',
        model_name: 'Latitude 5420',
        serial_number: 'DELL-SN-1234',
        cpu: 'Core i5',
        ram: '16GB',
        storage: '512GB SSD',
        gpu: 'Intel Iris',
        screen_size: '14 inch',
        wholesale_price: 15500,
        status: 'available',
        branch: 'محل 1',
      },
    ];

    await assert.rejects(
      async () => {
        await mssWholesaleExportService.exportWholesaleInventoryToExcel(
          { exportMode: 'individual', baseTitle: 'مخزون_اختبار' },
          mockDevices
        );
      },
      (err) => {
        assert.ok(
          err.message.includes('لم يتم تحديد مسار') ||
          err.message.includes('يجب تحديد مجلد') ||
          err.message.includes('تعذر حفظ وتصدير') ||
          err.message.includes('إلغاء'),
          `Error was: ${err.message}`
        );
        return true;
      }
    );
  });

  test('17. Settings Modal UI: Single editable path input, "إضافة المسار" button, and clear/remove action', () => {
    const modalPath = path.resolve(process.cwd(), 'src/components/common/SystemSettingsModal.tsx');
    const modalCode = fs.readFileSync(modalPath, 'utf8');

    // Text input where user types or pastes full Windows path
    assert.ok(modalCode.includes('inputPath'), 'Must have inputPath state for text input');
    assert.ok(modalCode.includes('placeholder="مثال: C:\\Users\\Administrator\\Desktop أو D:\\MSS Exports"'), 'Must have Windows path placeholder');

    // Action button labeled "إضافة المسار"
    assert.ok(modalCode.includes('إضافة المسار'), 'Must have action button labeled "إضافة المسار"');

    // Clear / remove path capability
    assert.ok(modalCode.includes('handleClearExportLocation'), 'Must have handler to clear saved path');
    assert.ok(modalCode.includes('clearStorageLocation()'), 'Must call clearStorageLocation to persistently wipe path');

    // Clear indication of currently saved path
    assert.ok(modalCode.includes('exportLocation'), 'Must display currently saved exportLocation');

    // Single path behavior: replaces previous path
    assert.ok(modalCode.includes('exportStorageService.setStorageLocation(trimmed)'), 'Must replace saved path with new trimmed path');

    // Does NOT contain folder picker button
    assert.ok(!modalCode.includes('handleSelectExportLocation'), 'Must NOT have folder picker selection handler');
    assert.ok(!modalCode.includes('selectDestinationFolder'), 'Must NOT call selectDestinationFolder in Settings modal');
  });
});
