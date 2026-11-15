import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

// Mock localStorage for isolated Node.js test runner
const storage = new Map();
globalThis.localStorage = {
  getItem: (k) => storage.get(k) || null,
  setItem: (k, v) => storage.set(k, String(v)),
  removeItem: (k) => storage.delete(k),
  clear: () => storage.clear(),
};

// Mock Blob for Node environment
if (!globalThis.Blob) {
  globalThis.Blob = class Blob {
    constructor(parts) {
      this.size = parts.reduce(
        (acc, p) => acc + (typeof p === 'string' ? Buffer.byteLength(p) : 0),
        0
      );
    }
  };
}

// Dynamically import services
const { backupService } = await import('../src/services/backupService.ts');
const { productsService } = await import('../src/services/productsService.ts');
const { salesService } = await import('../src/services/salesService.ts');

describe('Automatic Backup System Upgrade Verification', () => {
  beforeEach(() => {
    storage.clear();
  });

  test('1 & 2. Time-based backups: 1-minute and 5-minute interval scheduling logic', async () => {
    // 1-minute interval configuration
    backupService.saveBackupConfig({
      autoBackupEnabled: true,
      timeBackupEnabled: true,
      eventBackupEnabled: false,
      scheduleMode: 'interval',
      specificTime: '22:00',
      intervalMinutes: 1,
      destinations: ['D:\\MSS Backups'],
      retentionCount: 10,
    });

    const config = backupService.getBackupConfig();
    assert.strictEqual(config.intervalMinutes, 1, 'Interval must be set to 1 minute');
    assert.strictEqual(config.destinations.length, 1);

    // Initial check when no prior backup exists
    let ran = await backupService.checkAndRunScheduledAutoBackup();
    assert.strictEqual(ran, true, 'Immediate run should succeed when no prior backup timestamp exists');

    // Subsequent check immediately after should not be due yet
    ran = await backupService.checkAndRunScheduledAutoBackup();
    assert.strictEqual(ran, false, 'Should not be due immediately after running');

    // Simulate 61 seconds later for 1-minute interval
    const updatedConfig = backupService.getBackupConfig();
    const pastTimestamp = new Date(Date.now() - 61 * 1000).toISOString();
    updatedConfig.lastAutoBackupTimestamp = pastTimestamp;
    backupService.saveBackupConfig(updatedConfig);

    ran = await backupService.checkAndRunScheduledAutoBackup();
    assert.strictEqual(ran, true, 'Must trigger backup when 1 minute has elapsed');

    // Verify 5-minute interval
    backupService.saveBackupConfig({
      ...updatedConfig,
      intervalMinutes: 5,
      lastAutoBackupTimestamp: new Date(Date.now() - 4 * 60 * 1000).toISOString(), // 4 mins ago (not due)
    });
    ran = await backupService.checkAndRunScheduledAutoBackup();
    assert.strictEqual(ran, false, 'Should not be due at 4 minutes for a 5-minute interval');

    // Advance to 6 minutes ago (due)
    const fiveMinConfig = backupService.getBackupConfig();
    fiveMinConfig.lastAutoBackupTimestamp = new Date(Date.now() - 6 * 60 * 1000).toISOString();
    backupService.saveBackupConfig(fiveMinConfig);

    ran = await backupService.checkAndRunScheduledAutoBackup();
    assert.strictEqual(ran, true, 'Must trigger backup when 5-minute interval has elapsed');
  });

  test('3. Event-based backups trigger after successful data-changing operations', async () => {
    backupService.saveBackupConfig({
      autoBackupEnabled: true,
      timeBackupEnabled: false,
      eventBackupEnabled: true,
      scheduleMode: 'interval',
      specificTime: '22:00',
      intervalMinutes: 60,
      destinations: ['D:\\MSS Backups'],
      retentionCount: 10,
    });

    // Add a product through productsService
    const prod = await productsService.addProduct({
      name: 'شاحن سيارة سريع',
      code: 'CHG-AUTO-TEST-01',
      cost: 50,
      price: 110,
      stock: 20,
      low_stock_threshold: 5,
    });
    assert.ok(prod.id, 'Product should be created');

    // Wait for debounce timer (1200ms)
    await new Promise(resolve => setTimeout(resolve, 1400));

    // Verify backup was created with trigger_type 'after_operation'
    const backups = await backupService.getBackups();
    const eventBackup = backups.find(b => b.trigger_type === 'after_operation');
    assert.ok(eventBackup, 'An after_operation backup must be created following product creation');
    assert.strictEqual(eventBackup.overall_status, 'success');
  });

  test('4. Read-only operations do NOT trigger event-based backups', async () => {
    backupService.saveBackupConfig({
      autoBackupEnabled: true,
      timeBackupEnabled: false,
      eventBackupEnabled: true,
      scheduleMode: 'interval',
      specificTime: '22:00',
      intervalMinutes: 60,
      destinations: ['D:\\MSS Backups'],
      retentionCount: 10,
    });

    const backupsBefore = (await backupService.getBackups()).length;

    // Perform read-only queries
    await productsService.getProducts();
    await productsService.getCategories();
    await salesService.getInvoices();

    // Wait for any unexpected debounce
    await new Promise(resolve => setTimeout(resolve, 300));

    const backupsAfter = (await backupService.getBackups()).length;
    assert.strictEqual(backupsAfter, backupsBefore, 'Read-only queries must never trigger backups');
  });

  test('5. Failed operations do NOT trigger event-based backups', async () => {
    backupService.saveBackupConfig({
      autoBackupEnabled: true,
      timeBackupEnabled: false,
      eventBackupEnabled: true,
      scheduleMode: 'interval',
      specificTime: '22:00',
      intervalMinutes: 60,
      destinations: ['D:\\MSS Backups'],
      retentionCount: 10,
    });

    const backupsBefore = (await backupService.getBackups()).length;

    // Attempt invalid operation that throws (e.g. negative price)
    try {
      await productsService.addProduct({
        name: 'صنف خاطئ',
        code: 'ERR-01',
        cost: -10,
        price: -20,
        stock: 5,
        low_stock_threshold: 1,
      });
      assert.fail('Should have thrown an error');
    } catch {
      // Expected rejection
    }

    // Wait to ensure no backup was scheduled
    await new Promise(resolve => setTimeout(resolve, 300));

    const backupsAfter = (await backupService.getBackups()).length;
    assert.strictEqual(backupsAfter, backupsBefore, 'Failed operations must never trigger backups');
  });

  test('6. Multiple destinations: 3 configured destinations receive real backup files', async () => {
    const destinations = [
      'D:\\MSS Backups',
      'E:\\System Backups',
      'F:\\External Backup',
    ];

    const result = await backupService.executeMultiDestinationBackup('manual', {
      destinations,
    });

    assert.strictEqual(result.total_destinations, 3);
    assert.strictEqual(result.successful_destinations, 3);
    assert.strictEqual(result.failed_destinations, 0);
    assert.strictEqual(result.overall_status, 'success');

    // Verify each destination received the file
    for (const dest of destinations) {
      const match = result.destinations.find(d => d.path === dest);
      assert.ok(match, `Destination ${dest} must be in results`);
      assert.strictEqual(match.status, 'success');
      assert.ok(match.file_path.includes(result.filename));
      assert.ok(match.size_bytes > 0, 'File size must be greater than zero');

      // Verify physical simulated existence in storage
      const stored = localStorage.getItem(`mss_dest_file_${match.file_path}`);
      assert.ok(stored, `File content must be physically written to ${match.file_path}`);
    }
  });

  test('7. Partial failure resilience: 1 disconnected destination does not prevent remaining destinations', async () => {
    const destinations = [
      'D:\\MSS Backups',
      'F:\\DISCONNECTED_DRIVE\\Backups', // Simulates disconnected external drive
      'E:\\System Backups',
    ];

    const result = await backupService.executeMultiDestinationBackup('manual', {
      destinations,
    });

    assert.strictEqual(result.total_destinations, 3);
    assert.strictEqual(result.successful_destinations, 2, '2 valid destinations must succeed');
    assert.strictEqual(result.failed_destinations, 1, '1 disconnected destination must fail');
    assert.strictEqual(result.overall_status, 'partial', 'Overall status must report partial');
    assert.ok(result.error_details.includes('DISCONNECTED_DRIVE'), 'Error details must name the failed drive');

    // Confirm that D: and E: succeeded
    const dMatch = result.destinations.find(d => d.path === 'D:\\MSS Backups');
    const eMatch = result.destinations.find(d => d.path === 'E:\\System Backups');
    const fMatch = result.destinations.find(d => d.path === 'F:\\DISCONNECTED_DRIVE\\Backups');

    assert.strictEqual(dMatch.status, 'success');
    assert.strictEqual(eMatch.status, 'success');
    assert.strictEqual(fMatch.status, 'failed');
  });

  test('8. Restart resilience: Saved schedule resumes after app restart', async () => {
    // Save configuration before restart
    backupService.saveBackupConfig({
      autoBackupEnabled: true,
      timeBackupEnabled: true,
      eventBackupEnabled: false,
      scheduleMode: 'interval',
      specificTime: '22:00',
      intervalMinutes: 15,
      destinations: ['D:\\MSS Backups', 'E:\\Second Drive'],
      retentionCount: 15,
      lastAutoBackupTimestamp: new Date(Date.now() - 20 * 60 * 1000).toISOString(), // 20m ago
    });

    // Simulate app reload by reading configuration anew
    const reloadedConfig = backupService.getBackupConfig();
    assert.strictEqual(reloadedConfig.autoBackupEnabled, true);
    assert.strictEqual(reloadedConfig.intervalMinutes, 15);
    assert.deepStrictEqual(reloadedConfig.destinations, ['D:\\MSS Backups', 'E:\\Second Drive']);

    // Check if due upon start
    const ran = await backupService.checkAndRunScheduledAutoBackup();
    assert.strictEqual(ran, true, 'Scheduler must immediately resume and run pending scheduled backup');
  });

  test('9. Overlapping backup prevention and safe queueing', async () => {
    // Initiate two backup calls simultaneously
    const p1 = backupService.executeMultiDestinationBackup('manual');
    let p2Threw = false;
    try {
      await backupService.executeMultiDestinationBackup('manual');
    } catch (err) {
      p2Threw = true;
      assert.ok(err.message.includes('قائمة الانتظار') || err.message.includes('جارية بالفعل'));
    }

    await p1;
    assert.strictEqual(p2Threw, true, 'Overlapping concurrent execution must be safely prevented');
  });

  test('10. Backup file format and naming conventions', async () => {
    const result = await backupService.executeMultiDestinationBackup('manual');
    // Expected format: MSS_Backup_YYYY-MM-DD_HH-mm-ss.db
    assert.match(
      result.filename,
      /^MSS_Backup_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.db$/,
      'Must follow MSS_Backup_YYYY-MM-DD_HH-mm-ss.db naming pattern'
    );
    assert.ok(result.size_bytes > 0, 'Must have valid non-zero byte size');
  });

  test('11 & 12. Windows Folder Picker & Browse buttons verification', async () => {
    const backupViewPath = path.resolve('src/components/placeholders/accessories/BackupView.tsx');
    assert.ok(fs.existsSync(backupViewPath), 'BackupView.tsx must exist');
    const content = fs.readFileSync(backupViewPath, 'utf-8');

    // Check that "استعراض" was replaced with "Browse"
    assert.ok(content.includes('>Browse<') || content.includes('Browse'), 'Must use Browse button label');
    assert.strictEqual(content.includes('استعراض...'), false, 'Must not contain old استعراض label');

    // Check that selectBackupFolder is called
    assert.ok(content.includes('selectBackupFolder'), 'Must call selectBackupFolder API');
    assert.ok(content.includes('selectSaveBackupPath'), 'Must call selectSaveBackupPath API');
  });

  test('13. Restore functionality remains fully functional', async () => {
    // Seed test product
    const p = await productsService.addProduct({
      name: 'صنف اختبار الاسترجاع',
      code: 'RESTORE-CHK-01',
      cost: 30,
      price: 70,
      stock: 10,
      low_stock_threshold: 2,
    });

    // Create backup
    const backup = await backupService.createBackup('manual');

    // Modify stock
    await productsService.updateProduct(p.id, {
      name: p.name,
      code: p.code,
      cost: 30,
      price: 70,
      stock: 999,
      low_stock_threshold: 2,
    });

    const modified = await productsService.getProductById(p.id);
    assert.strictEqual(modified.stock, 999);

    // Restore
    await backupService.restoreBackup(backup.filename);

    const restored = await productsService.getProductById(p.id);
    assert.strictEqual(restored.stock, 10, 'Stock must be restored to 10');
  });
});
