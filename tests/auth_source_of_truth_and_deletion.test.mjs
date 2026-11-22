import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { adminService } from '../admin-dashboard/src/services/adminService.ts';
import { desktopAuthService } from '../src/services/desktopAuthService.ts';

describe('Source-of-Truth Authentication & Authoritative User Management Suite', () => {
  const superAdminActor = {
    adminId: 'admin-super-saber-0001',
    username: 'saberadmin',
    displayName: 'أحمد صابر (Super Admin)',
    role: 'superadmin',
    exp: Date.now() + 3600000,
  };

  it('1. Authoritative User Source: deleted username "ahmed" is NOT in user list', async () => {
    const users = await adminService.getAppUsers();
    const ahmedUser = users.find(u => u.username.toLowerCase() === 'ahmed');
    assert.equal(ahmedUser, undefined, 'Deleted user "ahmed" must not exist in authoritative user list');
  });

  it('2. Authoritative Desktop Login: deleted username "ahmed" credentials are rejected', async () => {
    const result = await adminService.verifyDesktopCredentials({
      username: 'ahmed',
      accessCode: '1234',
    });
    assert.equal(result.success, false, 'Desktop credentials for deleted user must be rejected');
    assert.match(result.error || '', /بيانات الدخول غير صحيحة/);
  });

  it('3. Authoritative Admin Login: deleted username "ahmed" credentials are rejected', async () => {
    const result = await adminService.authenticateAdmin('ahmed', '1234');
    assert.equal(result, null, 'Admin login for deleted user must be rejected');
  });

  it('4. Frontend Desktop Auth Service rejects deleted username "ahmed"', async () => {
    const result = await desktopAuthService.login({
      username: 'ahmed',
      accessCode: '1234',
    });
    assert.equal(result.success, false, 'Desktop auth service must reject deleted user');
  });

  it('5. Legitimate super admin "saberadmin" authenticates successfully', async () => {
    process.env.INITIAL_SUPER_ADMIN_USERNAME = 'saberadmin';
    process.env.INITIAL_SUPER_ADMIN_PASSWORD = '123456@asd';

    const admin = await adminService.authenticateAdmin('saberadmin', '123456@asd');
    assert.ok(admin, 'Legitimate superadmin must authenticate');
    assert.equal(admin.username, 'saberadmin');
    assert.equal(admin.role, 'superadmin');

    // Desktop verification
    const desktopRes = await adminService.verifyDesktopCredentials({
      username: 'saberadmin',
      accessCode: '123456@asd',
    });
    assert.equal(desktopRes.success, true, 'Legitimate superadmin desktop login must succeed');
    assert.equal(desktopRes.user?.username, 'saberadmin');
  });

  it('6. Inactivity Timeout: 7-day policy (168 hours) is preserved', () => {
    const now = Date.now();
    const activeSession = {
      sessionToken: 'sess_test_active',
      user: {
        id: 'user-01',
        username: 'saberadmin',
        displayName: 'Super Admin',
        allowedModules: 'both',
        assignedStoreIds: [],
        credentialVersion: 1,
        permissionVersion: 1,
      },
      expiresAt: new Date(now + 30 * 86400000).toISOString(),
      lastOnlineValidationAt: new Date(now - 2 * 86400000).toISOString(), // 2 days ago
      lastActivityAt: new Date(now - 2 * 86400000).toISOString(),
      offlineMaxDays: 7,
    };

    const validCheck = desktopAuthService.checkInactivityTimeout(activeSession);
    assert.equal(validCheck.expired, false, 'Session with activity 2 days ago must be valid');

    const expiredSession = {
      ...activeSession,
      lastActivityAt: new Date(now - 8 * 86400000).toISOString(), // 8 days ago (> 168 hours)
    };

    const expiredCheck = desktopAuthService.checkInactivityTimeout(expiredSession);
    assert.equal(expiredCheck.expired, true, 'Session with inactivity > 7 days must be expired');
    assert.equal(expiredCheck.reason, 'INACTIVITY_TIMEOUT');
  });
});
