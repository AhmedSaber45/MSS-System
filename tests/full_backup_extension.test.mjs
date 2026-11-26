import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Isolated in-memory localStorage mock (never touches production data or Supabase)
const memStorage = new Map();
const mockLocalStorage = {
  get length() {
    return memStorage.size;
  },
  key: (idx) => Array.from(memStorage.keys())[idx] ?? null,
  getItem: (k) => (memStorage.has(k) ? memStorage.get(k) : null),
  setItem: (k, v) => memStorage.set(k, String(v)),
  removeItem: (k) => memStorage.delete(k),
  clear: () => memStorage.clear(),
};
globalThis.localStorage = mockLocalStorage;

const { backupService } = await import('../src/services/backupService.ts');
const { exportStorageService } = await import('../src/services/exportStorageService.ts');

function createIsolatedDirs() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'as-full-backup-test-'));
  const backupDest = path.join(root, 'Backups');
  const exportRoot = path.join(root, 'Exports');
  fs.mkdirSync(backupDest, { recursive: true });
  fs.mkdirSync(path.join(exportRoot, 'MSS System Files', 'فواتير MSS'), { recursive: true });
  fs.mkdirSync(path.join(exportRoot, 'MSS System Files', 'MSS Images'), { recursive: true });
  fs.mkdirSync(path.join(exportRoot, 'Custom images'), { recursive: true });
  return { root, backupDest, exportRoot };
}

test('Full Backup Extension - Isolated End-to-End Verification Suite', async (t) => {
  t.beforeEach(() => {
    memStorage.clear();
    exportStorageService.setStorageLocation(null);
  });

  t.after(() => {
    memStorage.clear();
    exportStorageService.setStorageLocation(null);
  });

  await t.test('1 & 12. Default Full Backup setting is OFF and preserves existing schedule/retention/destinations', () => {
    const defaultCfg = backupService.getBackupConfig();
    assert.equal(defaultCfg.fullBackupEnabled, false, 'Full Backup must be OFF by default');

    const saved = backupService.saveBackupConfig({
      ...defaultCfg,
      autoBackupEnabled: true,
      scheduleMode: 'interval',
      intervalMinutes: 180,
      retentionCount: 15,
      destinations: ['D:\\TestBackups'],
      fullBackupEnabled: true,
    });
    assert.equal(saved.fullBackupEnabled, true);
    assert.equal(saved.intervalMinutes, 180);
    assert.equal(saved.retentionCount, 15);
    assert.deepEqual(saved.destinations, ['D:\\TestBackups']);

    // Reloading config simulates app restart
    const reloaded = backupService.getBackupConfig();
    assert.equal(reloaded.fullBackupEnabled, true);
    assert.equal(reloaded.intervalMinutes, 180);
    assert.deepEqual(reloaded.destinations, ['D:\\TestBackups']);
  });

  await t.test('2 & 3. Filenames & contents: Standard uses "AS System Backup", Full uses "Full AS System Backup"', async () => {
    const { root, backupDest, exportRoot } = createIsolatedDirs();
    try {
      exportStorageService.setStorageLocation(exportRoot);
      backupService.saveBackupConfig({
        ...backupService.getBackupConfig(),
        destinations: [backupDest],
        fullBackupEnabled: false,
      });

      const stdRes = await backupService.executeMultiDestinationBackup('manual');
      assert.ok(stdRes.filename.startsWith('AS System Backup_'), `Expected AS System Backup_*, got ${stdRes.filename}`);
      assert.ok(stdRes.filename.endsWith('.db'));

      const stdRaw = JSON.parse(fs.readFileSync(path.join(backupDest, stdRes.filename), 'utf-8'));
      assert.equal(stdRaw.format, undefined, 'Standard backup must not use Full Backup envelope');

      // Enable Full Backup
      backupService.saveBackupConfig({
        ...backupService.getBackupConfig(),
        destinations: [backupDest],
        fullBackupEnabled: true,
      });

      const fullRes = await backupService.executeMultiDestinationBackup('manual');
      assert.ok(fullRes.filename.startsWith('Full AS System Backup_'), `Expected Full AS System Backup_*, got ${fullRes.filename}`);
      assert.ok(fullRes.filename.endsWith('.db'));

      const fullRaw = JSON.parse(fs.readFileSync(path.join(backupDest, fullRes.filename), 'utf-8'));
      assert.equal(fullRaw.format, 'as-full-backup-v1');
      assert.equal(fullRaw.manifest.backupType, 'full');
      assert.deepEqual(fullRaw.manifest.components, [
        'accessories_sqlite',
        'mss_local_state',
        'app_settings',
        'managed_files',
      ]);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  await t.test('4, 5, 6, 7 & 13. Full Backup preserves Accessories data, MSS outbox, paths, settings, and managed files without self-inclusion or auth secrets', async () => {
    const { root, exportRoot } = createIsolatedDirs();
    // Place backup destination INSIDE exportRoot to test self-exclusion
    const nestedBackupDest = path.join(exportRoot, 'MSS System Files', 'BackupsInsideExport');
    fs.mkdirSync(nestedBackupDest, { recursive: true });

    try {
      exportStorageService.setStorageLocation(exportRoot);

      // Seed isolated Accessories, MSS Outbox, settings, and auth session (which MUST be excluded)
      localStorage.setItem('shop_accessories_products_v1', JSON.stringify([{ id: 'p-1', name: 'Mouse', stock: 12 }]));
      localStorage.setItem('shop_accessories_invoices_v1', JSON.stringify([{ id: 'inv-1', total: 500, productId: 'p-1' }]));
      localStorage.setItem('shop_mss_outbox_v1', JSON.stringify([{ uuid: 'op-123', type: 'SALE', status: 'pending', synced: false }]));
      localStorage.setItem('shop_mss_sync_state_v1', JSON.stringify({ lastSyncAt: '2026-11-26T10:00:00Z' }));
      localStorage.setItem('shop_accessories_promotional_header_v1', 'souq');
      localStorage.setItem('compu_mss_session_v1', JSON.stringify({ sessionToken: 'SECRET_TOKEN_NEVER_BACKUP' }));
      localStorage.setItem('mss_desktop_session_v1', JSON.stringify({ refreshToken: 'SECRET_REFRESH' }));

      // Create managed files + temp file that must be excluded
      fs.writeFileSync(path.join(exportRoot, 'MSS System Files', 'فواتير MSS', 'invoice_01.pdf'), 'PDF_BYTES');
      fs.writeFileSync(path.join(exportRoot, 'Custom images', 'promo_souq.png'), 'PNG_BYTES');
      fs.writeFileSync(path.join(exportRoot, 'Custom images', 'ignore_me.tmp'), 'TEMP_BYTES');

      backupService.saveBackupConfig({
        ...backupService.getBackupConfig(),
        destinations: [nestedBackupDest],
        fullBackupEnabled: true,
        retentionCount: 20,
      });

      const fullRes = await backupService.executeMultiDestinationBackup('manual');
      const backupFilePath = path.join(nestedBackupDest, fullRes.filename);
      const rawStr = fs.readFileSync(backupFilePath, 'utf-8');
      assert.ok(!rawStr.includes('SECRET_TOKEN_NEVER_BACKUP'), 'Auth session token must never be included');
      assert.ok(!rawStr.includes('SECRET_REFRESH'), 'Refresh token must never be included');

      const parsed = JSON.parse(rawStr);
      const relPaths = parsed.manifest.files.map(f => f.relativePath);
      assert.ok(relPaths.includes('MSS System Files/فواتير MSS/invoice_01.pdf'));
      assert.ok(relPaths.includes('Custom images/promo_souq.png'));
      assert.ok(!relPaths.some(p => p.endsWith('.tmp')), 'Temp files must be excluded');
      assert.ok(!relPaths.some(p => p.includes('BackupsInsideExport') || p.includes(fullRes.filename)), 'Backup file/destination must never be included inside itself');

      // Wipe localStorage & files to simulate fresh Windows install
      const externalUsbCopy = path.join(root, 'USB_Restore_Copy.db');
      fs.copyFileSync(backupFilePath, externalUsbCopy);
      memStorage.clear();
      fs.rmSync(exportRoot, { recursive: true, force: true });

      // Restore from external file path
      const restoreRes = await backupService.restoreBackup(externalUsbCopy);
      assert.equal(restoreRes.backupKind, 'full');
      assert.equal(restoreRes.restoredFileCount, 2);
      assert.equal(restoreRes.unavailableExportPath, null);

      assert.deepEqual(JSON.parse(localStorage.getItem('shop_accessories_products_v1')), [{ id: 'p-1', name: 'Mouse', stock: 12 }]);
      assert.deepEqual(JSON.parse(localStorage.getItem('shop_mss_outbox_v1')), [{ uuid: 'op-123', type: 'SALE', status: 'pending', synced: false }]);
      assert.equal(localStorage.getItem('shop_accessories_promotional_header_v1'), 'souq');
      assert.equal(exportStorageService.getStorageLocation(), exportRoot);
      assert.equal(backupService.getBackupConfig().fullBackupEnabled, true);
      assert.equal(backupService.getBackupConfig().retentionCount, 20);
      assert.equal(fs.readFileSync(path.join(exportRoot, 'Custom images', 'promo_souq.png'), 'utf-8'), 'PNG_BYTES');
      assert.equal(localStorage.getItem('compu_mss_session_v1'), null, 'Auth sessions must not be restored');

      // Test 11: Repeated restore does not duplicate records or outbox operations
      await backupService.restoreBackup(externalUsbCopy);
      assert.equal(JSON.parse(localStorage.getItem('shop_mss_outbox_v1')).length, 1);
      assert.equal(JSON.parse(localStorage.getItem('shop_accessories_products_v1')).length, 1);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  await t.test('8, 9 & 10. Unavailable export path on fresh Windows, backwards-compatible standard restore, and corrupted/unsupported rejection', async () => {
    const { root, backupDest } = createIsolatedDirs();
    try {
      // Standard backup backwards compatibility
      localStorage.setItem('shop_accessories_products_v1', JSON.stringify([{ id: 'std-1', name: 'Keyboard' }]));
      backupService.saveBackupConfig({ ...backupService.getBackupConfig(), destinations: [backupDest], fullBackupEnabled: false });
      const stdRes = await backupService.executeMultiDestinationBackup('manual');

      localStorage.setItem('shop_accessories_products_v1', JSON.stringify([{ id: 'overwrite-me' }]));
      const stdRestore = await backupService.restoreBackup(stdRes.filename);
      assert.equal(stdRestore.backupKind, 'standard');
      assert.deepEqual(JSON.parse(localStorage.getItem('shop_accessories_products_v1')), [{ id: 'std-1', name: 'Keyboard' }]);

      // Full Backup with unavailable export path on new Windows machine
      exportStorageService.setStorageLocation('Z:\\DISCONNECTED_DRIVE\\Exports');
      backupService.saveBackupConfig({ ...backupService.getBackupConfig(), destinations: [backupDest], fullBackupEnabled: true });
      const fullRes = await backupService.executeMultiDestinationBackup('manual');
      const fullPath = path.join(backupDest, fullRes.filename);

      const unavailRestore = await backupService.restoreBackup(fullPath);
      assert.equal(unavailRestore.backupKind, 'full');
      assert.equal(unavailRestore.unavailableExportPath, 'Z:\\DISCONNECTED_DRIVE\\Exports');
      assert.equal(exportStorageService.getStorageLocation(), 'Z:\\DISCONNECTED_DRIVE\\Exports', 'Saved export path preference must be preserved even if unavailable');

      // Test 10a: Corrupted hash rejection
      const tampered = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
      tampered.mssStateJson = JSON.stringify({ storageEntries: { shop_mss_outbox_v1: 'TAMPERED' } });
      const tamperedPath = path.join(root, 'tampered.db');
      fs.writeFileSync(tamperedPath, JSON.stringify(tampered));
      await assert.rejects(() => backupService.restoreBackup(tamperedPath), /SHA-256/);

      // Test 10b: Unsupported future formatVersion rejection
      const futureFmt = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
      futureFmt.manifest.formatVersion = 999;
      const futurePath = path.join(root, 'future.db');
      fs.writeFileSync(futurePath, JSON.stringify(futureFmt));
      await assert.rejects(() => backupService.restoreBackup(futurePath), /غير مدعوم/);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  await t.test('14. UI & Rust verification: BackupView Arabic label/description and Rust WAL/VACUUM/integrity checks', () => {
    const viewContent = fs.readFileSync(
      path.resolve('src/components/placeholders/accessories/BackupView.tsx'),
      'utf8'
    );
    assert.ok(viewContent.includes('تضمين جميع بيانات وإعدادات البرنامج (Full Backup)'));
    assert.ok(viewContent.includes('يشمل بيانات البرنامج المحلية وإعداداته وملفاته، بالإضافة إلى محتويات النسخة الاحتياطية العادية.'));
    assert.ok(viewContent.includes('استعادة من ملف...'));

    const dbRs = fs.readFileSync(path.resolve('src-tauri/src/db.rs'), 'utf8');
    const fullRs = fs.readFileSync(path.resolve('src-tauri/src/full_backup.rs'), 'utf8');
    assert.ok(dbRs.includes('VACUUM INTO ?1'));
    assert.ok(dbRs.includes('PRAGMA wal_checkpoint(PASSIVE);'));
    assert.ok(fullRs.includes('PRAGMA integrity_check;'));
    assert.ok(fullRs.includes('sha256_hex'));
  });
});
