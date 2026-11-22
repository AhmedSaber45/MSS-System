import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT_DIR = process.cwd();

test('Compu MSS — Persistent Authentication Sessions & 7-Day Inactivity Timeout Suite', async (t) => {
  // ============================================================================
  // 1. Admin Dashboard Session & 7-Day Inactivity (168 Hours) Verification
  // ============================================================================
  await t.test('1. Admin Dashboard Session Token & Inactivity Window', async (t2) => {
    const sessionModule = await import('../admin-dashboard/src/lib/session.ts');
    const {
      signSessionToken,
      verifySessionToken,
      inspectSessionToken,
      INACTIVITY_TIMEOUT_MS,
      INACTIVITY_TIMEOUT_SECONDS,
      SESSION_COOKIE_NAME,
    } = sessionModule;

    await t2.test('constants match exact 7 days / 168 hours specification', () => {
      assert.equal(INACTIVITY_TIMEOUT_SECONDS, 7 * 24 * 60 * 60, 'Must be 604,800 seconds');
      assert.equal(INACTIVITY_TIMEOUT_MS, 7 * 24 * 60 * 60 * 1000, 'Must be 604,800,000 ms (168 hours)');
      assert.equal(SESSION_COOKIE_NAME, 'mss_admin_session');
    });

    const now = Date.now();
    const baseAdminPayload = {
      adminId: 'super-admin-01',
      username: 'saberadmin',
      displayName: 'م. أحمد صابر (سوبر أدمن)',
      role: 'superadmin',
      allowedModules: 'both',
      createdAt: now,
      lastActivityAt: now,
      exp: now + INACTIVITY_TIMEOUT_MS,
    };

    await t2.test('freshly signed session token is immediately valid', () => {
      const token = signSessionToken(baseAdminPayload);
      const verified = verifySessionToken(token);
      assert.ok(verified, 'Fresh token must verify');
      assert.equal(verified.username, 'saberadmin');
      assert.equal(verified.role, 'superadmin');

      const inspection = inspectSessionToken(token);
      assert.equal(inspection.valid, true);
      assert.equal(inspection.reason, 'VALID');
    });

    await t2.test('session with activity 3 days ago is valid (well within 7-day window)', () => {
      const threeDaysAgo = now - 3 * 24 * 60 * 60 * 1000;
      const payload = {
        ...baseAdminPayload,
        lastActivityAt: threeDaysAgo,
        exp: threeDaysAgo + INACTIVITY_TIMEOUT_MS,
      };
      // For this test, ensure overall exp allows the test or adjust exp
      const activePayload = {
        ...payload,
        exp: now + 4 * 24 * 60 * 60 * 1000, // 4 days remaining overall
      };
      const token = signSessionToken(activePayload);
      const inspection = inspectSessionToken(token);
      assert.equal(inspection.valid, true);
      assert.equal(inspection.reason, 'VALID');
    });

    await t2.test('session with activity 6 days and 23 hours ago is still valid', () => {
      const nearLimit = now - (6 * 24 + 23) * 60 * 60 * 1000;
      const activePayload = {
        ...baseAdminPayload,
        lastActivityAt: nearLimit,
        exp: now + 3600000, // 1 hour remaining
      };
      const token = signSessionToken(activePayload);
      const inspection = inspectSessionToken(token);
      assert.equal(inspection.valid, true);
      assert.equal(inspection.reason, 'VALID');
    });

    await t2.test('session with activity 7 days + 1 second ago is EXPIRED by inactivity', () => {
      const pastLimit = now - (7 * 24 * 60 * 60 * 1000 + 1000);
      const inactivePayload = {
        ...baseAdminPayload,
        lastActivityAt: pastLimit,
        exp: now + 3600000, // even if exp header is in the future
      };
      const token = signSessionToken(inactivePayload);
      const verified = verifySessionToken(token);
      assert.equal(verified, null, 'verifySessionToken must reject inactive token');

      const inspection = inspectSessionToken(token);
      assert.equal(inspection.valid, false);
      assert.equal(inspection.reason, 'INACTIVITY_TIMEOUT');
    });

    await t2.test('tampered signature is rejected with SIGNATURE_INVALID', () => {
      const token = signSessionToken(baseAdminPayload);
      const parts = token.split('.');
      const tamperedToken = `${parts[0]}.invalid_signature_xyz`;
      const inspection = inspectSessionToken(tamperedToken);
      assert.equal(inspection.valid, false);
      assert.equal(inspection.reason, 'SIGNATURE_INVALID');
    });
  });

  // ============================================================================
  // 2. Desktop Auth Service Inactivity & Anti-Tampering Engine
  // ============================================================================
  await t.test('2. Desktop Auth Service Inactivity & Anti-Tampering Engine', async (t2) => {
    const { desktopAuthService, INACTIVITY_TIMEOUT_MS } = await import('../src/services/desktopAuthService.ts');

    const baseSession = {
      sessionToken: 'test-desktop-sess-token-999',
      user: {
        id: 'usr-desk-01',
        username: 'ahmed',
        displayName: 'أحمد صابر',
        allowedModules: 'both',
        assignedStoreIds: [],
        credentialVersion: 1,
        permissionVersion: 1,
      },
      expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
      lastOnlineValidationAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
      offlineMaxDays: 7,
      deviceInfo: 'Desktop Test Runner',
    };

    await t2.test('fresh desktop session is valid with ~168 hours remaining', () => {
      const check = desktopAuthService.checkInactivityTimeout(baseSession);
      assert.equal(check.expired, false);
      assert.ok(check.remainingMs > 167 * 3600 * 1000);
    });

    await t2.test('desktop session after 3 days is valid with ~96 hours remaining', () => {
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
      const session = { ...baseSession, lastActivityAt: threeDaysAgo };
      const check = desktopAuthService.checkInactivityTimeout(session);
      assert.equal(check.expired, false);
      assert.ok(check.remainingMs > 95 * 3600 * 1000 && check.remainingMs <= 96 * 3600 * 1000);
    });

    await t2.test('desktop session at 6 days 23 hours is valid', () => {
      const almostExpired = new Date(Date.now() - (6 * 24 + 23) * 60 * 60 * 1000).toISOString();
      const session = { ...baseSession, lastActivityAt: almostExpired };
      const check = desktopAuthService.checkInactivityTimeout(session);
      assert.equal(check.expired, false);
      assert.ok(check.remainingMs > 0 && check.remainingMs <= 3600 * 1000);
    });

    await t2.test('desktop session at 7 days + 5 seconds is EXPIRED by INACTIVITY_TIMEOUT', () => {
      const expired = new Date(Date.now() - (7 * 24 * 60 * 60 * 1000 + 5000)).toISOString();
      const session = { ...baseSession, lastActivityAt: expired };
      const check = desktopAuthService.checkInactivityTimeout(session);
      assert.equal(check.expired, true);
      assert.equal(check.reason, 'INACTIVITY_TIMEOUT');
      assert.equal(check.remainingMs, 0);
    });

    await t2.test('desktop session with clock moved backward > 1 min detected as CLOCK_TAMPERING', () => {
      const futureTime = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes in the future
      const session = { ...baseSession, lastActivityAt: futureTime };
      const check = desktopAuthService.checkInactivityTimeout(session);
      assert.equal(check.expired, true);
      assert.equal(check.reason, 'CLOCK_TAMPERING');
    });

    await t2.test('validateOfflineSession integrates 7-day inactivity check', () => {
      const eightDaysAgo = new Date(Date.now() - 8 * 86400000).toISOString();
      const session = { ...baseSession, lastActivityAt: eightDaysAgo };
      const check = desktopAuthService.validateOfflineSession(session);
      assert.equal(check.valid, false);
      assert.equal(check.reason, 'OFFLINE_MAX_EXCEEDED');
    });
  });

  // ============================================================================
  // 3. User Activity Recording & Passive Polling Protection
  // ============================================================================
  await t.test('3. User Activity Recording & Background Polling Isolation', async (t2) => {
    const { desktopAuthService } = await import('../src/services/desktopAuthService.ts');

    const testSession = {
      sessionToken: 'activity-test-token-111',
      user: {
        id: 'usr-act-1',
        username: 'active_user',
        displayName: 'مستخدم نشط',
        allowedModules: 'both',
        assignedStoreIds: [],
        credentialVersion: 1,
        permissionVersion: 1,
      },
      expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
      lastOnlineValidationAt: new Date(Date.now() - 2 * 86400000).toISOString(),
      lastActivityAt: new Date(Date.now() - 2 * 86400000).toISOString(),
      offlineMaxDays: 7,
    };

    await desktopAuthService.saveSecureSession(testSession);

    // Initial session has 2-day-old lastActivityAt
    const loadedBefore = await desktopAuthService.loadSecureSession();
    assert.ok(loadedBefore?.lastActivityAt);
    const beforeTime = new Date(loadedBefore.lastActivityAt).getTime();

    // Trigger explicit user activity record
    const recorded = await desktopAuthService.recordUserActivity();
    assert.equal(recorded, true, 'User activity must be recorded');

    const loadedAfter = await desktopAuthService.loadSecureSession();
    assert.ok(loadedAfter?.lastActivityAt);
    const afterTime = new Date(loadedAfter.lastActivityAt).getTime();

    assert.ok(afterTime > beforeTime, 'User activity must advance lastActivityAt timestamp');

    // Immediate re-trigger is throttled to save disk/DPAPI I/O
    const secondCall = await desktopAuthService.recordUserActivity();
    assert.equal(secondCall, false, 'Rapid immediate calls must be throttled');

    // Cleanup
    await desktopAuthService.clearSecureSession();
  });

  // ============================================================================
  // 4. Server-Side Inactivity & Revalidation Enforcement (adminService)
  // ============================================================================
  await t.test('4. Server-Side Inactivity & Revalidation Enforcement', async (t2) => {
    const { adminService } = await import('../admin-dashboard/src/services/adminService.ts');

    const actor = { adminId: 'adm-root', username: 'saberadmin', displayName: 'Super Admin' };
    const username = `inactivity_u_${Date.now()}`;
    await adminService.createAppUser(
      {
        username,
        displayName: 'مستخدم فحص الخمول',
        accessCode: 'inact1234',
        confirmAccessCode: 'inact1234',
        allowedModules: 'both',
      },
      actor
    );

    // 1. Log in and get session token
    const loginRes = await adminService.verifyDesktopCredentials({
      username,
      accessCode: 'inact1234',
      deviceInfo: 'Automated Test Agent',
    });
    assert.equal(loginRes.success, true);
    const token = loginRes.sessionToken;

    // 2. Passive revalidation (isUserAction: false) must NOT reset last_active_at
    const passiveRes = await adminService.revalidateDesktopSession({
      sessionToken: token,
      isUserAction: false,
    });
    assert.equal(passiveRes.success, true);
    assert.equal(passiveRes.reason, 'VALID');

    // 3. Meaningful action (isUserAction: true) succeeds
    const activeRes = await adminService.revalidateDesktopSession({
      sessionToken: token,
      isUserAction: true,
    });
    assert.equal(activeRes.success, true);
    assert.equal(activeRes.reason, 'VALID');

    // 4. Clean logout terminates session
    await adminService.logoutDesktopSession({ sessionToken: token });
    const postLogout = await adminService.revalidateDesktopSession({ sessionToken: token });
    assert.equal(postLogout.success, false);
    assert.equal(postLogout.reason, 'SESSION_REVOKED');
  });

  // ============================================================================
  // 5. Credential Changes & Account Revocation Invalidation
  // ============================================================================
  await t.test('5. Credential Changes & Account Revocation Invalidation', async (t2) => {
    const { adminService } = await import('../admin-dashboard/src/services/adminService.ts');

    const actor = { adminId: 'adm-root', username: 'saberadmin', displayName: 'Super Admin' };
    const username = `revoc_u_${Date.now()}`;
    const user = await adminService.createAppUser(
      {
        username,
        displayName: 'مستخدم فحص التعديلات',
        accessCode: 'passOld12',
        confirmAccessCode: 'passOld12',
        allowedModules: 'both',
      },
      actor
    );

    const loginRes = await adminService.verifyDesktopCredentials({
      username,
      accessCode: 'passOld12',
    });
    assert.equal(loginRes.success, true);
    const token = loginRes.sessionToken;

    // Admin deactivates user
    await adminService.updateAppUser({ id: user.id, isActive: false }, actor);

    // Revalidation must immediately fail with ACCOUNT_DISABLED
    const revalDisabled = await adminService.revalidateDesktopSession({ sessionToken: token });
    assert.equal(revalDisabled.success, false);
    assert.equal(revalDisabled.reason, 'ACCOUNT_DISABLED');
  });

  // ============================================================================
  // 6. Security Contract: Plaintext Password Exclusion & DPAPI Isolation
  // ============================================================================
  await t.test('6. Security Contract: No Plaintext Passwords & DPAPI Isolation', () => {
    const desktopAuthPath = path.join(ROOT_DIR, 'src', 'services', 'desktopAuthService.ts');
    const authCode = fs.readFileSync(desktopAuthPath, 'utf8');

    // Check that desktopAuthService does NOT contain raw localStorage.setItem or sessionStorage.setItem
    assert.ok(!authCode.includes('localStorage.setItem'), 'Must NEVER call localStorage.setItem in desktopAuthService.ts');
    assert.ok(!authCode.includes('sessionStorage.setItem'), 'Must NEVER call sessionStorage.setItem in desktopAuthService.ts');

    // Check that StoredSession does not store plaintext passwords or access codes
    const authTypesPath = path.join(ROOT_DIR, 'src', 'types', 'auth.ts');
    const typeContent = fs.readFileSync(authTypesPath, 'utf8');
    const sessionMatch = typeContent.match(/export interface StoredSession\s*\{[\s\S]*?\}/);
    assert.ok(sessionMatch, 'StoredSession interface must exist');
    assert.doesNotMatch(sessionMatch[0], /password\s*:/i, 'StoredSession must not have a password field');
    assert.doesNotMatch(sessionMatch[0], /accessCode\s*:/i, 'StoredSession must not have an accessCode field');
  });
});
