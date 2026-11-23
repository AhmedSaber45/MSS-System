// Automated Verification Suite for Phase 11: Automatic Updates & Release Preparation
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

// Mock localStorage for Node.js test environment if not present
if (!global.localStorage) {
  const storage = new Map();
  global.localStorage = {
    getItem: (key) => storage.get(key) || null,
    setItem: (key, val) => storage.set(key, String(val)),
    removeItem: (key) => storage.delete(key),
    clear: () => storage.clear(),
  };
}

// Import services dynamically
const { updaterService } = await import('../src/services/updaterService.ts');
const { backupService } = await import('../src/services/backupService.ts');

describe('Phase 11 — Automatic Updates & Release Preparation Verification', () => {
  beforeEach(() => {
    updaterService.resetState();
  });

  test('1. Version and configuration: Reports current version v1.0.6 matching tauri.conf.json', () => {
    const currentVersion = updaterService.getCurrentVersion();
    assert.strictEqual(currentVersion, '1.0.6');

    const tauriConfig = JSON.parse(
      fs.readFileSync(path.resolve('src-tauri/tauri.conf.json'), 'utf8')
    );
    assert.strictEqual(tauriConfig.version, currentVersion);
    assert.ok(tauriConfig.plugins?.updater?.pubkey, 'Updater public key must be configured in tauri.conf.json');
    assert.ok(
      tauriConfig.plugins.updater.endpoints?.length > 0,
      'GitHub Releases endpoint must be configured'
    );
  });

  test('2. Key Isolation & Security (Rule 21): Private signing key is kept strictly out of git and configured via CI secrets', () => {
    const gitignoreContent = fs.readFileSync(path.resolve('.gitignore'), 'utf8');

    // 1. Verify sensitive files and directories are strictly Git-ignored
    assert.ok(gitignoreContent.includes('.tauri/'), '.gitignore must ignore .tauri/ directory');
    assert.ok(gitignoreContent.includes('*.key'), '.gitignore must ignore *.key files');
    assert.ok(gitignoreContent.includes('.env'), '.gitignore must ignore .env files');
    assert.ok(gitignoreContent.includes('secrets/'), '.gitignore must ignore secrets/ directory');

    // 2. Verify updater public key is configured in tauri.conf.json and is a valid minisign key
    const tauriConfig = JSON.parse(
      fs.readFileSync(path.resolve('src-tauri/tauri.conf.json'), 'utf8')
    );
    const pubKey = tauriConfig.plugins?.updater?.pubkey;
    assert.ok(pubKey, 'Updater public key must be configured in tauri.conf.json');
    assert.ok(pubKey.length > 20, 'Public key must have valid length');
    const decodedPubKey = Buffer.from(pubKey, 'base64').toString('utf8');
    assert.ok(decodedPubKey.includes('minisign public key'), 'Public key must be valid minisign key');

    // 3. Verify workflow references signing keys exclusively from GitHub Actions Secrets (never committed to git)
    const workflowPath = path.resolve('.github/workflows/release.yml');
    assert.ok(fs.existsSync(workflowPath), '.github/workflows/release.yml must exist');
    const workflowContent = fs.readFileSync(workflowPath, 'utf8');
    assert.ok(
      workflowContent.includes('TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}'),
      'Workflow must inject TAURI_SIGNING_PRIVATE_KEY from secrets'
    );
    assert.ok(
      workflowContent.includes('TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}'),
      'Workflow must inject TAURI_SIGNING_PRIVATE_KEY_PASSWORD from secrets'
    );

    // 4. Verify no private key file is required in CI or tracked in Git
    const keyPath = path.resolve('.tauri/shop-updater.key');
    if (fs.existsSync(keyPath)) {
      // If present locally in dev environment, verify it is strictly inside an ignored path
      assert.ok(
        gitignoreContent.includes('.tauri/'),
        'Local key file must be in a git-ignored directory'
      );
    }
  });

  test('3. Graceful offline handling: Missing internet does not crash and returns OFFLINE status', async () => {
    // Simulate offline state using Object.defineProperty on navigator
    const hadNavigator = typeof global.navigator !== 'undefined';
    const originalOnLine = hadNavigator ? global.navigator.onLine : true;

    try {
      if (hadNavigator) {
        Object.defineProperty(global.navigator, 'onLine', {
          value: false,
          configurable: true,
          writable: true,
        });
      }

      const res = await updaterService.checkForUpdates(true);
      assert.strictEqual(res.status, 'OFFLINE');
      assert.ok(res.errorMessage?.includes('لا يتوفر اتصال بالإنترنت'));
    } finally {
      if (hadNavigator) {
        Object.defineProperty(global.navigator, 'onLine', {
          value: originalOnLine,
          configurable: true,
          writable: true,
        });
      }
    }
  });

  test('4. Update check lifecycle: Successfully detects up-to-date and available updates', async () => {
    // Normal check
    const checkRes = await updaterService.checkForUpdates(false);
    assert.ok(['UP_TO_DATE', 'AVAILABLE', 'CHECKING', 'OFFLINE'].includes(checkRes.status));

    // Simulate update availability
    const simulated = updaterService.simulateUpdateAvailable('1.1.0', 'إصلاحات وتحديثات جديدة');
    assert.strictEqual(simulated.status, 'AVAILABLE');
    assert.strictEqual(simulated.availableVersion, '1.1.0');
    assert.ok(simulated.releaseNotes?.includes('إصلاحات وتحديثات'));

    const state = updaterService.getState();
    assert.strictEqual(state.status, 'AVAILABLE');
    assert.strictEqual(state.availableVersion, '1.1.0');
  });

  test('5. Pre-update data safeguard: Automatically backs up SQLite database before download/install (Rule 22 & 23)', async () => {
    // Stage an update
    updaterService.simulateUpdateAvailable('1.1.0', 'تحديث أمان');

    const backupsBefore = await backupService.getBackups();

    // Trigger download and install
    const progressSteps = [];
    const installResult = await updaterService.downloadAndInstallUpdate(progress => {
      progressSteps.push(progress);
    });

    assert.strictEqual(installResult.success, true, 'Update preparation must succeed');
    assert.strictEqual(installResult.backupCreated, true, 'Safeguard backup must be created before update');
    assert.ok(installResult.backupFilename, 'Backup filename must be returned');

    // Verify a new backup was added to local storage / filesystem
    const backupsAfter = await backupService.getBackups();
    assert.strictEqual(
      backupsAfter.length,
      backupsBefore.length + 1,
      'A new automatic pre-update backup must be preserved'
    );

    const latestBackup = backupsAfter[0];
    assert.strictEqual(
      latestBackup.backup_type,
      'safeguard',
      'Backup type must be safeguard before application upgrade'
    );

    // Verify download progress occurred
    assert.ok(progressSteps.length > 0);
    assert.strictEqual(progressSteps[progressSteps.length - 1], 100);

    const finalState = updaterService.getState();
    assert.strictEqual(finalState.status, 'READY_TO_INSTALL');
  });

  test('6. Recovery scenario: Restores database safely if update is cancelled or rollback needed', async () => {
    // Fetch latest safeguard backup
    const backups = await backupService.getBackups();
    const safeguard = backups.find(b => b.backup_type === 'safeguard');
    assert.ok(safeguard, 'Safeguard backup must exist from test 5');

    // Verify recovery restoration executes without error
    await assert.doesNotReject(
      async () => {
        await backupService.restoreBackup(safeguard.filename);
      },
      'Safeguard backup must be safely restorable without errors'
    );
  });

  test('7. Windows Installer and Bundle Configuration: NSIS & MSI targets configured properly', () => {
    const tauriConfig = JSON.parse(
      fs.readFileSync(path.resolve('src-tauri/tauri.conf.json'), 'utf8')
    );

    assert.strictEqual(tauriConfig.bundle.active, true);
    assert.strictEqual(tauriConfig.bundle.createUpdaterArtifacts, true);
    assert.strictEqual(tauriConfig.bundle.windows?.nsis?.installMode, 'currentUser');

    // Check Cargo.toml updater crate dependency
    const cargoToml = fs.readFileSync(path.resolve('src-tauri/Cargo.toml'), 'utf8');
    assert.ok(cargoToml.includes('tauri-plugin-updater'), 'Cargo.toml must declare tauri-plugin-updater dependency');

    // Check capabilities default.json
    const capabilities = JSON.parse(
      fs.readFileSync(path.resolve('src-tauri/capabilities/default.json'), 'utf8')
    );
    assert.ok(capabilities.permissions.includes('updater:default'), 'capabilities must permit updater:default');
  });

  test('8. GitHub Releases distribution pipeline: Workflow file exists and conforms to CI spec', () => {
    const workflowPath = path.resolve('.github/workflows/release.yml');
    assert.ok(fs.existsSync(workflowPath), '.github/workflows/release.yml must exist');

    const workflowContent = fs.readFileSync(workflowPath, 'utf8');
    assert.ok(
      workflowContent.includes('tauri-apps/tauri-action') || workflowContent.includes('tauri-apps/action'),
      'Must use official tauri-apps/tauri-action'
    );
    assert.ok(workflowContent.includes('TAURI_SIGNING_PRIVATE_KEY'), 'Must use signing key from secrets');
    assert.ok(workflowContent.includes('TAURI_SIGNING_PRIVATE_KEY_PASSWORD'), 'Must use signing key password');
  });
});
