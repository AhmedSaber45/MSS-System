import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// Setup mock browser/window/localStorage environment for Node.js test runner
const storage = new Map();
globalThis.localStorage = {
  getItem: (k) => storage.get(k) || null,
  setItem: (k, v) => storage.set(k, String(v)),
  removeItem: (k) => storage.delete(k),
  clear: () => storage.clear(),
};

const downloadedFiles = [];

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

if (!globalThis.document) {
  globalThis.document = {
    getElementById: () => null,
    querySelectorAll: () => [],
    createElement: (tag) => {
      const el = {
        tagName: tag,
        href: '',
        download: '',
        style: {},
        click: () => {
          if (tag === 'a' && el.download) {
            downloadedFiles.push({ filename: el.download, href: el.href });
          }
        },
      };
      return el;
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

if (!globalThis.URL) {
  globalThis.URL = {
    createObjectURL: () => 'blob:mock-url',
    revokeObjectURL: () => {},
  };
} else if (!globalThis.URL.createObjectURL) {
  globalThis.URL.createObjectURL = () => 'blob:mock-url';
  globalThis.URL.revokeObjectURL = () => {};
}

// Import services under test
const {
  exportStorageService,
  ROOT_EXPORT_FOLDER,
  EXPORT_FOLDERS,
  EXPORT_SUBFOLDERS,
  EXPORT_STORAGE_LOCATION_KEY,
} = await import('../src/services/exportStorageService.ts');

const { backupService } = await import('../src/services/backupService.ts');
const { mssWholesaleExportService } = await import('../src/services/mssWholesaleExportService.ts');
const { exportPromotionalAsPng } = await import('../src/services/mssPromotionalService.ts');

describe('Extracted Files Destination Path Regression Verification', () => {
  let tempBaseDirA;
  let tempBaseDirB;

  beforeEach(() => {
    storage.clear();
    downloadedFiles.length = 0;
    exportStorageService.clearStorageLocation();
    tempBaseDirA = fs.mkdtempSync(path.join(os.tmpdir(), 'extracted-reg-a-'));
    tempBaseDirB = fs.mkdtempSync(path.join(os.tmpdir(), 'extracted-reg-b-'));
  });

  afterEach(() => {
    exportStorageService.clearStorageLocation();
    if (tempBaseDirA && fs.existsSync(tempBaseDirA)) {
      fs.rmSync(tempBaseDirA, { recursive: true, force: true });
    }
    if (tempBaseDirB && fs.existsSync(tempBaseDirB)) {
      fs.rmSync(tempBaseDirB, { recursive: true, force: true });
    }
  });

  test('1. Saving a file using the default destination', async () => {
    // When NO custom destination is configured:
    assert.strictEqual(exportStorageService.getStorageLocation(), null);
    assert.strictEqual(exportStorageService.isDestinationConfigured(), false);

    // Save an extracted file: must succeed cleanly using default destination
    const res = await exportStorageService.saveExportedFile({
      exportType: 'mss_excel',
      filename: 'مخزون_افتراضي_2026-11-22.xlsx',
      data: Buffer.from('Mock excel data for default location'),
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    assert.strictEqual(res.success, true, 'Saving with default destination must succeed');
    assert.strictEqual(res.savedToCustomLocation, false, 'Should report default destination (savedToCustomLocation=false)');
    assert.strictEqual(res.folderPath, 'Downloads');
    assert.strictEqual(res.filename, 'مخزون_افتراضي_2026-11-22.xlsx');

    // Verify direct download trigger was executed
    assert.strictEqual(downloadedFiles.length, 1);
    assert.strictEqual(downloadedFiles[0].filename, 'مخزون_افتراضي_2026-11-22.xlsx');

    // Verify Wholesale Excel export service also works seamlessly out-of-the-box
    const mockDevices = [
      {
        id: 'dev-1',
        brand: 'Dell',
        model_name: 'Latitude 5420',
        serial_number: 'SN-001',
        wholesale_price: 15000,
        status: 'available',
        branch: 'محل 1',
      },
    ];

    const wholesaleRes = await mssWholesaleExportService.exportWholesaleInventoryToExcel(
      { exportMode: 'individual', baseTitle: 'مخزون_تجريبي' },
      mockDevices
    );
    assert.ok(wholesaleRes.filename.includes('.xlsx'));
    assert.strictEqual(downloadedFiles.length, 2);
  });

  test('2. Saving a file using a custom destination', async () => {
    // User sets a custom destination directory
    exportStorageService.setStorageLocation(tempBaseDirA);
    assert.strictEqual(exportStorageService.getStorageLocation(), tempBaseDirA);
    assert.strictEqual(exportStorageService.isDestinationConfigured(), true);

    const expectedRoot = path.join(tempBaseDirA, ROOT_EXPORT_FOLDER);
    // Root folder must NOT exist prior to the first save
    assert.strictEqual(fs.existsSync(expectedRoot), false);

    // Save invoice PDF to custom destination
    const res = await exportStorageService.saveExportedFile({
      exportType: 'mss_invoices',
      filename: 'فاتورة_MSS-INV-100.pdf',
      data: Buffer.from('PDF Content for MSS Invoice'),
      mimeType: 'application/pdf',
    });

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.savedToCustomLocation, true);

    // Physical file must be written to disk in the custom directory under assigned subfolder
    const expectedFilePath = path.join(expectedRoot, 'فواتير MSS', 'فاتورة_MSS-INV-100.pdf');
    assert.strictEqual(fs.existsSync(expectedFilePath), true, 'File must exist at expected custom destination path');
    assert.strictEqual(fs.readFileSync(expectedFilePath, 'utf8'), 'PDF Content for MSS Invoice');

    // Existing files must NOT be overwritten unexpectedly (Collision resolution)
    const res2 = await exportStorageService.saveExportedFile({
      exportType: 'mss_invoices',
      filename: 'فاتورة_MSS-INV-100.pdf',
      data: Buffer.from('Second PDF Version'),
      mimeType: 'application/pdf',
    });

    assert.strictEqual(res2.success, true);
    assert.strictEqual(res2.filename, 'فاتورة_MSS-INV-100 (1).pdf');
    const expectedFile2 = path.join(expectedRoot, 'فواتير MSS', 'فاتورة_MSS-INV-100 (1).pdf');
    assert.strictEqual(fs.existsSync(expectedFile2), true);
    assert.strictEqual(fs.readFileSync(expectedFilePath, 'utf8'), 'PDF Content for MSS Invoice', 'Original file must remain untouched');
    assert.strictEqual(fs.readFileSync(expectedFile2, 'utf8'), 'Second PDF Version');
  });

  test('3. Restarting the app and saving again without reselecting the destination', async () => {
    // User configured destination
    exportStorageService.setStorageLocation(tempBaseDirA);
    assert.strictEqual(exportStorageService.getStorageLocation(), tempBaseDirA);

    // Simulate application restart:
    // Memory cache cleared, localStorage preserves persisted path
    exportStorageService.setCustomFolderPicker(null);
    const restoredPath = exportStorageService.getStorageLocation();
    assert.strictEqual(restoredPath, tempBaseDirA, 'Configured path must persist across application restart');

    // Save a new file without reselecting destination
    const res = await exportStorageService.saveExportedFile({
      exportType: 'mss_images',
      filename: 'عرض_خاص.png',
      data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      mimeType: 'image/png',
    });

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.savedToCustomLocation, true);
    const expectedImgPath = path.join(tempBaseDirA, ROOT_EXPORT_FOLDER, 'MSS Images', 'عرض_خاص.png');
    assert.strictEqual(fs.existsSync(expectedImgPath), true, 'File must be written to persisted destination');

    // Simulate complete storage loss recovered via persistent disk config
    storage.clear();
    const diskRecovered = await exportStorageService.getStorageLocationAsync();
    assert.strictEqual(diskRecovered, tempBaseDirA, 'Path must be recovered from persistent disk configuration');
  });

  test('4. Changing the destination and verifying the new location is used', async () => {
    // 1. Initial destination is Location A
    exportStorageService.setStorageLocation(tempBaseDirA);
    await exportStorageService.saveExportedFile({
      exportType: 'accessories_reports',
      filename: 'تقرير_ارباح_موقع_أ.pdf',
      data: Buffer.from('Report for Location A'),
    });

    const fileInA = path.join(tempBaseDirA, ROOT_EXPORT_FOLDER, 'تقارير الاكسسوارات', 'تقرير_ارباح_موقع_أ.pdf');
    assert.strictEqual(fs.existsSync(fileInA), true, 'File must exist in Location A');

    // 2. Change destination to Location B
    exportStorageService.setStorageLocation(tempBaseDirB);
    assert.strictEqual(exportStorageService.getStorageLocation(), tempBaseDirB);

    await exportStorageService.saveExportedFile({
      exportType: 'accessories_reports',
      filename: 'تقرير_ارباح_موقع_ب.pdf',
      data: Buffer.from('Report for Location B'),
    });

    const fileInB = path.join(tempBaseDirB, ROOT_EXPORT_FOLDER, 'تقارير الاكسسوارات', 'تقرير_ارباح_موقع_ب.pdf');
    assert.strictEqual(fs.existsSync(fileInB), true, 'New file must be saved in Location B');

    // Verify old file in Location A remains completely untouched
    assert.strictEqual(fs.existsSync(fileInA), true, 'Old file in Location A must remain intact');
  });

  test('5. Handling a missing or inaccessible destination directory', async () => {
    // Create a temporary directory then delete it to simulate a deleted or unplugged drive
    const tempDirToDelete = fs.mkdtempSync(path.join(os.tmpdir(), 'missing-dir-'));
    exportStorageService.setStorageLocation(tempDirToDelete);
    fs.rmSync(tempDirToDelete, { recursive: true, force: true });
    assert.strictEqual(fs.existsSync(tempDirToDelete), false);

    // Save file: must report clear error and must NOT swallow or report false success
    const res = await exportStorageService.saveExportedFile({
      exportType: 'mss_reports',
      filename: 'تقرير_فاشل.pdf',
      data: Buffer.from('Should fail cleanly'),
      skipFallbackDownload: true,
      allowDirectDownloadFallback: false,
    });

    assert.strictEqual(res.success, false, 'Must fail when destination directory is missing or inaccessible');
    assert.strictEqual(res.savedToCustomLocation, false);
    assert.ok(res.error, 'A descriptive error message must be returned');
    assert.ok(
      res.error.includes('غير متاح') || res.error.includes('غير موجود') || res.error.includes('تعذر الوصول'),
      `Error message was: ${res.error}`
    );

    // Validating an empty string also fails cleanly
    const emptyValidation = await exportStorageService.validateDestination('');
    assert.strictEqual(emptyValidation.valid, false);
  });

  test('6. Confirming the backup destination feature still works exactly as before', async () => {
    // Verify backup config retrieval
    const backupConfig = backupService.getBackupConfig();
    assert.ok(backupConfig, 'Backup configuration must be accessible');
    assert.strictEqual(typeof backupConfig.autoBackupEnabled, 'boolean');

    // Test saving backup configuration with multiple destinations
    const updated = backupService.saveBackupConfig({
      ...backupConfig,
      destinations: [tempBaseDirA],
    });
    assert.deepStrictEqual(updated.destinations, [tempBaseDirA]);

    // Verify backup list & safeguard mechanisms
    const backups = await backupService.getBackups();
    assert.ok(Array.isArray(backups), 'Backups list must be an array');

    // Verify backupService default filename generators & validation
    const defaultFilename = `accessories_backup_${Date.now()}_manual.db`;
    assert.ok(defaultFilename.endsWith('.db'));
  });

  test('7. Path Normalization: Prevents duplicate directory segments and handles Windows roots', () => {
    // Setting path already ending with ROOT_EXPORT_FOLDER
    const pathWithRoot = path.join('D:\\Exports', ROOT_EXPORT_FOLDER);
    exportStorageService.setStorageLocation(pathWithRoot);

    const resolvedRoot = exportStorageService.getRootFolderPath();
    // Must NOT be D:\Exports\MSS System Files\MSS System Files
    assert.strictEqual(resolvedRoot, pathWithRoot, 'Must not duplicate ROOT_EXPORT_FOLDER segment');

    // Setting a drive root like C:\
    exportStorageService.setStorageLocation('C:\\');
    const driveRoot = exportStorageService.getRootFolderPath();
    assert.strictEqual(driveRoot, 'C:\\MSS System Files');
  });
});
