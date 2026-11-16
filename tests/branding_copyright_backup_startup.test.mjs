import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

// Mock localStorage for isolated Node.js test environment
const storage = new Map();
globalThis.localStorage = {
  getItem: (k) => storage.get(k) || null,
  setItem: (k, v) => storage.set(k, String(v)),
  removeItem: (k) => storage.delete(k),
  clear: () => storage.clear(),
};

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

// Dynamically import services under test
const { backupService } = await import('../src/services/backupService.ts');
const { autostartService } = await import('../src/services/autostartService.ts');

describe('MSS System — Branding, Copyright, Backup Destinations & Windows Startup', () => {
  const testDir1 = 'C:\\Users\\Administrator\\Desktop\\test backup';
  const testDir2 = path.resolve('./tests/test_secondary_backup');

  beforeEach(() => {
    storage.clear();
    if (!fs.existsSync(testDir1)) {
      try { fs.mkdirSync(testDir1, { recursive: true }); } catch {}
    }
    if (!fs.existsSync(testDir2)) {
      try { fs.mkdirSync(testDir2, { recursive: true }); } catch {}
    }
  });

  afterEach(() => {
    try {
      if (fs.existsSync(testDir2)) {
        fs.rmSync(testDir2, { recursive: true, force: true });
      }
    } catch {}
  });

  test('1. Application Branding: tauri.conf.json has productName Compu MSS and preserves identifier', () => {
    const tauriConfRaw = fs.readFileSync(path.resolve('./src-tauri/tauri.conf.json'), 'utf-8');
    const tauriConf = JSON.parse(tauriConfRaw);

    assert.strictEqual(tauriConf.productName, 'Compu MSS', 'productName must be Compu MSS');
    assert.strictEqual(tauriConf.identifier, 'com.shop.management.system', 'Application identifier must be preserved to protect SQLite storage');
    assert.ok(tauriConf.app?.windows?.[0]?.title?.includes('Compu MSS'), 'Window title must reflect Compu MSS');
  });

  test('2. Copyright & Contact Notice: Exact details in AppFooter, ContactModal, and SystemSettingsModal without triggering browser app alerts', () => {
    const footerContent = fs.readFileSync(path.resolve('./src/components/layout/AppFooter.tsx'), 'utf-8');
    assert.ok(footerContent.includes('© 2026 Ahmed Saber. All rights reserved.'), 'Footer must contain exact copyright text');
    assert.ok(footerContent.includes('01030137635'), 'Footer must contain exact contact phone');
    assert.ok(footerContent.includes('ContactModal'), 'Footer must open ContactModal on click');
    assert.ok(!footerContent.includes('href="tel:'), 'Footer must not use raw tel: link to avoid browser Pick an app dialog');

    const contactModalContent = fs.readFileSync(path.resolve('./src/components/common/ContactModal.tsx'), 'utf-8');
    assert.ok(contactModalContent.includes('Ahmed Saber'), 'Contact modal must contain Ahmed Saber');
    assert.ok(contactModalContent.includes('01030137635'), 'Contact modal must contain phone number');
    assert.ok(contactModalContent.includes('© 2026 Ahmed Saber. All rights reserved.'), 'Contact modal must contain copyright');

    const settingsContent = fs.readFileSync(path.resolve('./src/components/common/SystemSettingsModal.tsx'), 'utf-8');
    assert.ok(settingsContent.includes('© 2026 Ahmed Saber. All rights reserved.'), 'Settings modal must contain copyright');
    assert.ok(settingsContent.includes('01030137635'), 'Settings modal must contain phone number');
  });

  test('3. Real Backup Creation in user destination: C:\\Users\\Administrator\\Desktop\\test backup', async () => {
    const config = backupService.saveBackupConfig({
      autoBackupEnabled: true,
      timeBackupEnabled: true,
      scheduleMode: 'interval',
      intervalMinutes: 1,
      destinations: [testDir1],
      retentionCount: 10,
    });

    assert.strictEqual(config.destinations.length, 1);
    assert.strictEqual(config.destinations[0], testDir1);

    const result = await backupService.executeMultiDestinationBackup('manual', {
      destinations: [testDir1],
    });

    assert.strictEqual(result.overall_status, 'success');
    assert.strictEqual(result.successful_destinations, 1);
    assert.strictEqual(result.failed_destinations, 0);

    const destEntry = result.destinations[0];
    assert.strictEqual(destEntry.status, 'success');
    assert.ok(destEntry.file_path, 'Destination must provide absolute file path');
    assert.ok(destEntry.file_path.startsWith(testDir1), 'File path must be inside test backup folder');

    // Verify physical file on disk!
    assert.ok(fs.existsSync(destEntry.file_path), 'Physical backup file MUST exist on disk');
    const stats = fs.statSync(destEntry.file_path);
    assert.ok(stats.size > 0, 'Backup file size must be greater than zero bytes');

    // Verify history records this exact file
    const backups = await backupService.getBackups();
    assert.ok(backups.length > 0);
    const recorded = backups.find(b => b.filename === result.filename);
    assert.ok(recorded, 'Backup must be recorded in history');
    assert.ok(recorded.destinations.some(d => d.file_path === destEntry.file_path));
  });

  test('4. Multiple Backup Destinations: independent files created in both folders', async () => {
    const result = await backupService.executeMultiDestinationBackup('manual', {
      destinations: [testDir1, testDir2],
    });

    assert.strictEqual(result.overall_status, 'success');
    assert.strictEqual(result.total_destinations, 2);
    assert.strictEqual(result.successful_destinations, 2);

    const f1 = result.destinations.find(d => d.path === testDir1)?.file_path;
    const f2 = result.destinations.find(d => d.path === testDir2)?.file_path;

    assert.ok(f1 && fs.existsSync(f1), 'File in testDir1 must exist');
    assert.ok(f2 && fs.existsSync(f2), 'File in testDir2 must exist');
    assert.ok(fs.statSync(f1).size > 0);
    assert.ok(fs.statSync(f2).size > 0);
  });

  test('5. Scheduled 1-minute backup execution and persistence', async () => {
    backupService.saveBackupConfig({
      autoBackupEnabled: true,
      timeBackupEnabled: true,
      scheduleMode: 'interval',
      intervalMinutes: 1,
      destinations: [testDir1],
      retentionCount: 10,
    });

    // Fresh execution
    let executed = await backupService.checkAndRunScheduledAutoBackup();
    assert.strictEqual(executed, true, 'Immediate execution when no previous backup timestamp');

    // Immediately after, not due
    executed = await backupService.checkAndRunScheduledAutoBackup();
    assert.strictEqual(executed, false, 'Should not execute again within the same minute');

    // Advance timestamp by 61 seconds
    const config = backupService.getBackupConfig();
    config.lastAutoBackupTimestamp = new Date(Date.now() - 61 * 1000).toISOString();
    backupService.saveBackupConfig(config);

    executed = await backupService.checkAndRunScheduledAutoBackup();
    assert.strictEqual(executed, true, 'Must execute when 1 minute interval has elapsed');

    // Check description calculation
    const desc = backupService.calculateNextBackupDescription(backupService.getBackupConfig());
    assert.ok(desc.includes('كل 1 دقيقة'), 'Schedule preview must say every 1 minute');
  });

  test('6. Startup with Windows Service: status and toggling API', async () => {
    const status = await autostartService.getStartupStatus();
    assert.strictEqual(typeof status.enabled, 'boolean');

    const updateRes = await autostartService.setStartupStatus(true);
    assert.strictEqual(updateRes.enabled, true);

    const disabledRes = await autostartService.setStartupStatus(false);
    assert.strictEqual(disabledRes.enabled, false);
  });
});
