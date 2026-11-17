import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT_DIR = process.cwd();

test('Compu MSS — Admin Dashboard Phase 3: Desktop Authentication, Secure Sessions & Offline Authorization', async t => {
  // ============================================================================
  // 1. SQL Migration Integrity & Backend Functions
  // ============================================================================
  await t.test('1. SQL Migration Integrity & Backend Functions', async t2 => {
    await t2.test('Phase 3 migration file exists at exact expected path', () => {
      const migPath = path.join(ROOT_DIR, 'supabase', 'migrations', '20261117_phase03_desktop_auth.sql');
      assert.ok(fs.existsSync(migPath), 'Phase 3 migration must exist');
    });

    await t2.test('migration defines revalidate_desktop_session and revoke_desktop_session functions', () => {
      const migPath = path.join(ROOT_DIR, 'supabase', 'migrations', '20261117_phase03_desktop_auth.sql');
      const content = fs.readFileSync(migPath, 'utf8');

      assert.ok(content.includes('FUNCTION public.revalidate_desktop_session'), 'Must define revalidate function');
      assert.ok(content.includes('FUNCTION public.revoke_desktop_session'), 'Must define revoke function');
      assert.ok(content.includes('last_active_at'), 'Must track last_active_at');
    });
  });

  // ============================================================================
  // 2. Desktop Authentication Service & Windows DPAPI Contract
  // ============================================================================
  await t.test('2. Desktop Authentication Service & Secure Storage Contract', async t2 => {
    const authServicePath = path.join(ROOT_DIR, 'src', 'services', 'desktopAuthService.ts');
    assert.ok(fs.existsSync(authServicePath), 'desktopAuthService must exist');
    const authCode = fs.readFileSync(authServicePath, 'utf8');

    await t2.test('desktopAuthService implements DPAPI secure session storage commands', () => {
      assert.ok(authCode.includes('save_secure_session'), 'Must invoke save_secure_session');
      assert.ok(authCode.includes('load_secure_session'), 'Must invoke load_secure_session');
      assert.ok(authCode.includes('clear_secure_session'), 'Must invoke clear_secure_session');
    });

    await t2.test('desktopAuthService does NOT persist sensitive tokens in localStorage', () => {
      assert.ok(!authCode.includes('localStorage.setItem'), 'Must NEVER store token in localStorage');
      assert.ok(!authCode.includes('sessionStorage.setItem'), 'Must NEVER store token in sessionStorage');
    });

    await t2.test('Rust backend in src-tauri defines DPAPI commands', () => {
      const libRsPath = path.join(ROOT_DIR, 'src-tauri', 'src', 'lib.rs');
      const libRs = fs.readFileSync(libRsPath, 'utf8');

      assert.ok(libRs.includes('fn save_secure_session'), 'Must define Rust save_secure_session');
      assert.ok(libRs.includes('fn load_secure_session'), 'Must define Rust load_secure_session');
      assert.ok(libRs.includes('fn clear_secure_session'), 'Must define Rust clear_secure_session');
      assert.ok(libRs.includes('ProtectedData]::Protect'), 'Must use Windows DPAPI Protect');
      assert.ok(libRs.includes('ProtectedData]::Unprotect'), 'Must use Windows DPAPI Unprotect');
    });
  });

  // ============================================================================
  // 3. Module Authorization Authoritative Logic
  // ============================================================================
  await t.test('3. Module Authorization Authoritative Logic', async t2 => {
    const { desktopAuthService } = await import('../src/services/desktopAuthService.ts');

    await t2.test('Accessories-only user: allowed on Accessories, denied on MSS', () => {
      assert.equal(desktopAuthService.canAccess('accessories', 'accessories'), true);
      assert.equal(desktopAuthService.canAccess('mss', 'accessories'), false);
    });

    await t2.test('Compu MSS-only user: denied on Accessories, allowed on MSS', () => {
      assert.equal(desktopAuthService.canAccess('accessories', 'mss'), false);
      assert.equal(desktopAuthService.canAccess('mss', 'mss'), true);
    });

    await t2.test('Both-modules user: allowed on both Accessories and MSS', () => {
      assert.equal(desktopAuthService.canAccess('accessories', 'both'), true);
      assert.equal(desktopAuthService.canAccess('mss', 'both'), true);
    });
  });

  // ============================================================================
  // 4. Offline Authorization Policy (7-Day Window & Anti-Tampering)
  // ============================================================================
  await t.test('4. Offline Authorization Policy (7-Day Window & Anti-Tampering)', async t2 => {
    const { desktopAuthService } = await import('../src/services/desktopAuthService.ts');

    const baseSession = {
      sessionToken: 'test-token-123',
      user: {
        id: 'usr-1',
        username: 'cashier',
        displayName: 'كاشير المحل',
        allowedModules: 'accessories',
        assignedStoreIds: ['st-1'],
        credentialVersion: 1,
        permissionVersion: 1,
      },
      expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
      lastOnlineValidationAt: new Date().toISOString(),
      offlineMaxDays: 7,
    };

    await t2.test('recent session within 7-day window is offline authorized', () => {
      const check = desktopAuthService.validateOfflineSession(baseSession);
      assert.equal(check.valid, true);
      assert.ok(check.daysRemaining >= 1 && check.daysRemaining <= 7);
    });

    await t2.test('session from 3 days ago is still offline authorized with 4 days remaining', () => {
      const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString();
      const session = { ...baseSession, lastOnlineValidationAt: threeDaysAgo };
      const check = desktopAuthService.validateOfflineSession(session);
      assert.equal(check.valid, true);
      assert.equal(check.daysRemaining, 4);
    });

    await t2.test('session older than 7 days is rejected with OFFLINE_MAX_EXCEEDED', () => {
      const eightDaysAgo = new Date(Date.now() - 8 * 86400000).toISOString();
      const session = { ...baseSession, lastOnlineValidationAt: eightDaysAgo };
      const check = desktopAuthService.validateOfflineSession(session);
      assert.equal(check.valid, false);
      assert.equal(check.reason, 'OFFLINE_MAX_EXCEEDED');
    });

    await t2.test('clock rollback into the past is detected as anti-tampering anomaly', () => {
      const inTheFuture = new Date(Date.now() + 2 * 86400000).toISOString();
      const session = { ...baseSession, lastOnlineValidationAt: inTheFuture };
      const check = desktopAuthService.validateOfflineSession(session);
      assert.equal(check.valid, false);
      assert.equal(check.reason, 'CLOCK_TAMPERING');
    });

    await t2.test('expired server session is rejected with EXPIRED', () => {
      const expiredSession = {
        ...baseSession,
        expiresAt: new Date(Date.now() - 1000).toISOString(),
      };
      const check = desktopAuthService.validateOfflineSession(expiredSession);
      assert.equal(check.valid, false);
      assert.equal(check.reason, 'EXPIRED');
    });
  });

  // ============================================================================
  // 5. Admin Dashboard Serverless Revalidation & Revocation
  // ============================================================================
  await t.test('5. Admin Dashboard Serverless Revalidation & Revocation', async t2 => {
    const { adminService } = await import('../admin-dashboard/src/services/adminService.ts');

    const actor = { adminId: 'adm-0', username: 'admin', displayName: 'Admin' };
    const username = `verify_u_${Date.now()}`;
    await adminService.createAppUser(
      {
        username,
        displayName: 'مستخدم فحص الجلسة',
        accessCode: 'pass12345',
        confirmAccessCode: 'pass12345',
        allowedModules: 'both',
      },
      actor
    );

    // 1. Verify credentials and get session token
    const verifyRes = await adminService.verifyDesktopCredentials({
      username,
      accessCode: 'pass12345',
      deviceInfo: 'Test Desktop Runner',
    });

    assert.equal(verifyRes.success, true);
    assert.ok(verifyRes.sessionToken, 'Must issue session token');

    const token = verifyRes.sessionToken;

    // 2. Revalidate valid session (Case A: No changes)
    const revalRes = await adminService.revalidateDesktopSession({ sessionToken: token });
    assert.equal(revalRes.success, true);
    assert.equal(revalRes.reason, 'VALID');
    assert.equal(revalRes.user?.username, username);

    // 3. Logout / Invalidate session (Case E: Revoked session)
    await adminService.logoutDesktopSession({ sessionToken: token });

    const postLogoutReval = await adminService.revalidateDesktopSession({ sessionToken: token });
    assert.equal(postLogoutReval.success, false);
    assert.equal(postLogoutReval.reason, 'SESSION_REVOKED');
  });

  // ============================================================================
  // 6. Access Code Change & Credential Version Invalidation (Case D)
  // ============================================================================
  await t.test('6. Access Code Change & Credential Version Invalidation (Case D)', async t2 => {
    const { adminService } = await import('../admin-dashboard/src/services/adminService.ts');

    // Create user
    const actor = { adminId: 'adm-0', username: 'admin', displayName: 'Admin' };
    const username = `cashier_case_d_${Date.now()}`;
    const user = await adminService.createAppUser(
      {
        username,
        displayName: 'كاشير اختبار',
        accessCode: '123456',
        confirmAccessCode: '123456',
        allowedModules: 'accessories',
      },
      actor
    );

    // Verify and establish session
    const loginRes = await adminService.verifyDesktopCredentials({
      username: user.username,
      accessCode: '123456',
    });
    assert.equal(loginRes.success, true);

    // Admin changes access code
    await adminService.changeUserAccessCode(user.id, '654321', actor, '654321');

    // Old session should now be rejected due to credential change or revocation
    const revalRes = await adminService.revalidateDesktopSession({
      sessionToken: loginRes.sessionToken,
    });
    assert.equal(revalRes.success, false);
    assert.ok(
      revalRes.reason === 'CREDENTIAL_CHANGED' || revalRes.reason === 'SESSION_REVOKED',
      'Old session must be invalidated upon access code change'
    );
  });

  // ============================================================================
  // 7. Background Sync Protection & Outbox Preservation
  // ============================================================================
  await t.test('7. Background Sync Protection & Outbox Preservation', async t2 => {
    const { mssSyncService } = await import('../src/services/mssSyncService.ts');
    const { desktopAuthService } = await import('../src/services/desktopAuthService.ts');

    // If an accessories-only user is logged in
    await desktopAuthService.saveSecureSession({
      sessionToken: 'acc-only-token',
      user: {
        id: 'usr-acc',
        username: 'acc_user',
        displayName: 'موظف إكسسوارات',
        allowedModules: 'accessories',
        assignedStoreIds: [],
        credentialVersion: 1,
        permissionVersion: 1,
      },
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
      lastOnlineValidationAt: new Date().toISOString(),
      offlineMaxDays: 7,
    });

    const queueBefore = await mssSyncService.getOutbox();

    // Trigger sync while accessories-only user is active
    const syncRes = await mssSyncService.syncOutbox();
    assert.equal(syncRes.synced, 0, 'Must NOT sync MSS operations for accessories-only user');

    const queueAfter = await mssSyncService.getOutbox();
    assert.equal(
      queueAfter.length,
      queueBefore.length,
      'Pending outbox records must be 100% preserved and never discarded'
    );

    // Cleanup session
    await desktopAuthService.clearSecureSession();
  });
});
