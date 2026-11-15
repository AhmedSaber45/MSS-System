import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

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

// Dynamically import backupService
const { backupService } = await import('../src/services/backupService.ts');

describe('Scheduled Backup Settings, Persistence & Real Folder Selection', () => {
  let tempTestDirA;
  let tempTestDirB;

  beforeEach(() => {
    storage.clear();
    tempTestDirA = fs.mkdtempSync(path.join(os.tmpdir(), 'mss-backup-test-a-'));
    tempTestDirB = fs.mkdtempSync(path.join(os.tmpdir(), 'mss-backup-test-b-'));
  });

  afterEach(() => {
    if (tempTestDirA && fs.existsSync(tempTestDirA)) {
      fs.rmSync(tempTestDirA, { recursive: true, force: true });
    }
    if (tempTestDirB && fs.existsSync(tempTestDirB)) {
      fs.rmSync(tempTestDirB, { recursive: true, force: true });
    }
  });

  test('1. Schedule Settings Persistence: Never reverts to 6 hours when configured to 1 min, 5 min, 1 hr, or 24 hr', () => {
    const testCases = [
      { mins: 1, expectedDesc: 'كل 1 دقيقة' },
      { mins: 5, expectedDesc: 'كل 5 دقائق' },
      { mins: 10, expectedDesc: 'كل 10 دقائق' },
      { mins: 15, expectedDesc: 'كل 15 دقيقة' },
      { mins: 30, expectedDesc: 'كل 30 دقيقة' },
      { mins: 60, expectedDesc: 'كل 1 ساعة' },
      { mins: 120, expectedDesc: 'كل ساعتين' },
      { mins: 180, expectedDesc: 'كل 3 ساعات' },
      { mins: 720, expectedDesc: 'كل 12 ساعة' },
      { mins: 1440, expectedDesc: 'كل 24 ساعة' },
    ];

    for (const tc of testCases) {
      // Save configuration
      backupService.saveBackupConfig({
        autoBackupEnabled: true,
        timeBackupEnabled: true,
        eventBackupEnabled: false,
        scheduleMode: 'interval',
        specificTime: '22:00',
        intervalMinutes: tc.mins,
        destinations: [tempTestDirA],
        retentionCount: 10,
      });

      // Retrieve and verify immediately
      const config = backupService.getBackupConfig();
      assert.strictEqual(
        config.intervalMinutes,
        tc.mins,
        `Interval must persist as ${tc.mins} minutes, got ${config.intervalMinutes}`
      );
      assert.notStrictEqual(
        config.intervalMinutes,
        360,
        `Interval must NOT revert to default 360 (6 hours) when set to ${tc.mins}`
      );
      assert.ok(
        config.nextScheduledBackup.includes(tc.expectedDesc),
        `Description must mention "${tc.expectedDesc}", got "${config.nextScheduledBackup}"`
      );
    }
  });

  test('2. Reactive onConfigChange Listener: Notifies subscribers immediately without application reload', () => {
    let notifiedConfig = null;
    let callCount = 0;

    const unsubscribe = backupService.onConfigChange((newConfig) => {
      notifiedConfig = newConfig;
      callCount++;
    });

    backupService.saveBackupConfig({
      autoBackupEnabled: true,
      timeBackupEnabled: true,
      eventBackupEnabled: true,
      scheduleMode: 'interval',
      specificTime: '15:30',
      intervalMinutes: 15,
      destinations: [tempTestDirA, tempTestDirB],
      retentionCount: 5,
    });

    assert.strictEqual(callCount, 1, 'Listener should have been called exactly once');
    assert.ok(notifiedConfig !== null, 'Listener should receive the updated config');
    assert.strictEqual(notifiedConfig.intervalMinutes, 15);
    assert.strictEqual(notifiedConfig.destinations.length, 2);
    assert.strictEqual(notifiedConfig.eventBackupEnabled, true);

    unsubscribe();

    // After unsubscribe, saving config should not invoke listener
    backupService.saveBackupConfig({
      ...notifiedConfig,
      intervalMinutes: 30,
    });
    assert.strictEqual(callCount, 1, 'Listener should not be called after unsubscribe');
  });

  test('3. Daily Specific Time Mode: Correctly stores and formats scheduled time', () => {
    backupService.saveBackupConfig({
      autoBackupEnabled: true,
      timeBackupEnabled: true,
      eventBackupEnabled: false,
      scheduleMode: 'time',
      specificTime: '23:45',
      intervalMinutes: 360,
      destinations: [tempTestDirA],
      retentionCount: 10,
    });

    const config = backupService.getBackupConfig();
    assert.strictEqual(config.scheduleMode, 'time');
    assert.strictEqual(config.specificTime, '23:45');
    assert.ok(
      config.nextScheduledBackup.includes('23:45') || config.nextScheduledBackup.includes('11:45'),
      `Description should include target time: "${config.nextScheduledBackup}"`
    );
  });

  test('4. Purge Fake Legacy Paths: No C:\\Users\\User mock items returned', async () => {
    // Seed localStorage with legacy fictional data
    const legacyData = [
      {
        id: 'MSS_Backup_fake.db',
        filename: 'MSS_Backup_fake.db',
        filepath: 'C:\\Users\\User\\AppData\\Roaming\\ShopManagementSystem\\backups\\MSS_Backup_fake.db',
        size_bytes: 1000,
        size_formatted: '1 KB',
        backup_type: 'auto',
        date: '2024-11-13 03:00:00',
        status: 'سليم ومتحقق منه',
        overall_status: 'success',
      },
    ];
    storage.set('shop_accessories_backups_metadata_v1', JSON.stringify(legacyData));

    const backups = await backupService.getBackups();
    const hasFakeUserPath = backups.some((b) => b.filepath && b.filepath.includes('C:\\Users\\User'));
    assert.strictEqual(hasFakeUserPath, false, 'Backups must not contain fictional C:\\Users\\User paths');
  });

  test('5. Destination Validation: Validates real paths, rejects non-existing and invalid paths', async () => {
    // Real directory A
    const resA = await backupService.validateDestination(tempTestDirA);
    assert.strictEqual(resA.valid, true, `Real directory ${tempTestDirA} must be valid`);

    // Empty path
    const resEmpty = await backupService.validateDestination('');
    assert.strictEqual(resEmpty.valid, false, 'Empty path must be invalid');

    // Invalid drive or characters
    const resInvalid = await backupService.validateDestination('Z:\\NonExistentDirectory_123456');
    assert.strictEqual(resInvalid.valid, false, 'Non-existent drive/directory must be invalid');
  });

  test('6. Deduplication and Normalization of Destinations', () => {
    const rawConfig = {
      autoBackupEnabled: true,
      timeBackupEnabled: true,
      destinations: [tempTestDirA, tempTestDirA, tempTestDirB, '   '],
      intervalMinutes: 5,
    };

    const normalized = backupService.normalizeConfig(rawConfig);
    assert.strictEqual(normalized.destinations.length, 2, 'Should deduplicate paths and strip empty items');
    assert.ok(normalized.destinations.includes(tempTestDirA));
    assert.ok(normalized.destinations.includes(tempTestDirB));
  });

  test('7. Real Backup Execution to Multiple Configured Destinations', async () => {
    backupService.saveBackupConfig({
      autoBackupEnabled: true,
      timeBackupEnabled: true,
      eventBackupEnabled: false,
      scheduleMode: 'interval',
      specificTime: '22:00',
      intervalMinutes: 5,
      destinations: [tempTestDirA, tempTestDirB],
      retentionCount: 10,
    });

    const result = await backupService.executeMultiDestinationBackup('manual');

    assert.strictEqual(result.overall_status, 'success', 'Overall status should be success');
    assert.strictEqual(result.destinations.length, 2, 'Should write to both destinations');
    assert.strictEqual(result.destinations[0].status, 'success');
    assert.strictEqual(result.destinations[1].status, 'success');

    // Verify files were actually written to disk in tempTestDirA and tempTestDirB
    const filesA = fs.readdirSync(tempTestDirA);
    const filesB = fs.readdirSync(tempTestDirB);

    assert.ok(filesA.length >= 1, 'File must exist in tempTestDirA');
    assert.ok(filesB.length >= 1, 'File must exist in tempTestDirB');

    const filePathA = path.join(tempTestDirA, filesA[0]);
    const filePathB = path.join(tempTestDirB, filesB[0]);

    const statA = fs.statSync(filePathA);
    const statB = fs.statSync(filePathB);

    assert.ok(statA.size > 0, `File in Dir A must have non-zero size, got ${statA.size}`);
    assert.ok(statB.size > 0, `File in Dir B must have non-zero size, got ${statB.size}`);

    // Verify backup history contains this entry
    const history = await backupService.getBackups();
    assert.ok(history.length >= 1, 'Backup history should record the new backup');
    const latest = history[0];
    assert.strictEqual(latest.overall_status, 'success');
    assert.ok(latest.destinations.length >= 2);
  });

  test('8. Multi-Destination Resilience: Continues when one destination fails', async () => {
    const invalidDir = 'Z:\\InvalidDrive_DoesNotExist';

    backupService.saveBackupConfig({
      autoBackupEnabled: true,
      timeBackupEnabled: true,
      eventBackupEnabled: false,
      scheduleMode: 'interval',
      specificTime: '22:00',
      intervalMinutes: 10,
      destinations: [tempTestDirA, invalidDir],
      retentionCount: 10,
    });

    const result = await backupService.executeMultiDestinationBackup('manual');

    // Status should be partial because tempTestDirA succeeded and invalidDir failed
    assert.strictEqual(result.overall_status, 'partial', 'Status must be partial when one destination fails');
    const successDest = result.destinations.find((d) => d.status === 'success');
    const failedDest = result.destinations.find((d) => d.status === 'failed');

    assert.ok(successDest, 'One destination must succeed');
    assert.strictEqual(successDest.path, tempTestDirA);
    assert.ok(failedDest, 'One destination must fail');
    assert.strictEqual(failedDest.path, invalidDir);
  });
});
