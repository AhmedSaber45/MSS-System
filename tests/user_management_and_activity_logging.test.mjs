import test from 'node:test';
import assert from 'node:assert/strict';
import { adminService } from '../admin-dashboard/src/services/adminService.ts';
import { activityLogger, formatArabicDescription } from '../admin-dashboard/src/services/activityLogger.ts';

const mockActor = {
  adminId: 'admin-super-saber-0001',
  username: 'saberadmin',
  displayName: 'أحمد صابر',
  role: 'superadmin',
  exp: Math.floor(Date.now() / 1000) + 3600,
};

test.describe('Compu MSS - User Management & Admin Activity Logging Test Suite', () => {
  test.beforeEach(() => {
    activityLogger._clearMemoryBuffer();
  });

  // ============================================================================
  // 1. User Creation Validation & Constraints
  // ============================================================================
  test('1. User Creation rejects short username (less than 3 characters)', async () => {
    await assert.rejects(
      async () => {
        await adminService.createAppUser(
          {
            username: 'ab',
            displayName: 'Test User',
            accessCode: '1234',
            confirmAccessCode: '1234',
            allowedModules: 'both',
          },
          mockActor
        );
      },
      (err) => {
        assert.ok(err.message.includes('3 أحرف'));
        return true;
      }
    );
  });

  test('2. User Creation rejects short access code (less than 4 characters)', async () => {
    await assert.rejects(
      async () => {
        await adminService.createAppUser(
          {
            username: 'validuser',
            displayName: 'Test User',
            accessCode: '12',
            confirmAccessCode: '12',
            allowedModules: 'both',
          },
          mockActor
        );
      },
      (err) => {
        assert.ok(err.message.includes('4'));
        return true;
      }
    );
  });

  test('3. User Creation rejects mismatched access code confirmation', async () => {
    await assert.rejects(
      async () => {
        await adminService.createAppUser(
          {
            username: 'validuser2',
            displayName: 'Test User',
            accessCode: '12345',
            confirmAccessCode: '99999',
            allowedModules: 'both',
          },
          mockActor
        );
      },
      (err) => {
        assert.ok(err.message.includes('غير متطابقين'));
        return true;
      }
    );
  });

  // ============================================================================
  // 2. Authoritative User Lifecycle (Create -> Read -> Update -> Auth -> Delete)
  // ============================================================================
  test('4. Full User Lifecycle: Create, List, Authenticate, Modify, and Delete', async () => {
    const testUsername = `diag_user_${Date.now()}`;
    const testAccessCode = 'Pass@9876';

    // A. Create User
    const created = await adminService.createAppUser(
      {
        username: testUsername,
        displayName: 'مستخدم تجريبي للمعاينة',
        accessCode: testAccessCode,
        confirmAccessCode: testAccessCode,
        allowedModules: 'both',
        isActive: true,
      },
      mockActor
    );

    assert.ok(created.id, 'User must have a generated ID');
    assert.equal(created.username, testUsername.toLowerCase());
    assert.equal(created.displayName, 'مستخدم تجريبي للمعاينة');
    assert.equal(created.allowedModules, 'both');
    assert.equal(created.isActive, true);

    // Verify activity log recorded user creation
    const creationLogs = await activityLogger.getLogs({ search: testUsername });
    assert.ok(creationLogs.logs.length > 0, 'Creation must be logged in activity logs');
    const createLog = creationLogs.logs[0];
    assert.equal(createLog.eventType, 'USER_CREATE');
    assert.ok(createLog.metadata?.description?.includes(testUsername));

    // B. List users - newly created user MUST be present
    const usersList = await adminService.getAppUsers({ search: testUsername });
    const found = usersList.find((u) => u.username === testUsername.toLowerCase());
    assert.ok(found, 'Created user must be returned in user list query');

    // C. Authenticate using created credentials
    const authResult = await adminService.verifyDesktopCredentials({
      username: testUsername,
      accessCode: testAccessCode,
      deviceInfo: 'Automated Test Harness',
    });
    assert.equal(authResult.success, true, 'User must authenticate successfully with created access code');
    assert.ok(authResult.sessionToken, 'Must generate valid session token');

    // D. Rejection with invalid access code
    const invalidAuth = await adminService.verifyDesktopCredentials({
      username: testUsername,
      accessCode: 'WRONG_CODE_123',
    });
    assert.equal(invalidAuth.success, false, 'Invalid access code must be rejected');

    // E. Modify User Status to Disabled
    await adminService.toggleUserStatus(created.id, false, mockActor);

    // Disabled user authentication must be rejected
    const disabledAuth = await adminService.verifyDesktopCredentials({
      username: testUsername,
      accessCode: testAccessCode,
    });
    assert.equal(disabledAuth.success, false, 'Disabled user authentication must be rejected');

    // F. Re-activate user
    await adminService.toggleUserStatus(created.id, true, mockActor);

    // G. Delete User
    await adminService.deleteAppUser(created.id, mockActor);

    // Verify deleted user cannot authenticate
    const postDeleteAuth = await adminService.verifyDesktopCredentials({
      username: testUsername,
      accessCode: testAccessCode,
    });
    assert.equal(postDeleteAuth.success, false, 'Deleted user cannot authenticate');

    // Verify deleted user is absent from user list
    const postDeleteList = await adminService.getAppUsers({ search: testUsername });
    const stillPresent = postDeleteList.find((u) => u.username === testUsername.toLowerCase());
    assert.equal(stillPresent, undefined, 'Deleted user must be absent from user list');

    // Verify deletion was logged in activity logs
    const deletionLogs = await activityLogger.getLogs({ eventType: 'USER_DELETE' });
    const deleteEntry = deletionLogs.logs.find(
      (l) => l.targetId === created.id || l.metadata?.targetUsername === testUsername
    );
    assert.ok(deleteEntry, 'User deletion must be logged in activity logs');
  });

  // ============================================================================
  // 3. Centralized Activity Logging Details & Formatting
  // ============================================================================
  test('5. Activity Logger generates accurate, human-readable Arabic descriptions', () => {
    const descLogin = formatArabicDescription({
      actorId: 'u-1',
      actorUsername: 'أحمد',
      eventType: 'LOGIN_SUCCESS',
    });
    assert.equal(descLogin, 'قام أحمد بتسجيل الدخول');

    const descFail = formatArabicDescription({
      actorId: 'anonymous',
      actorUsername: 'anonymous',
      targetUsername: 'mohamed',
      eventType: 'LOGIN_FAILURE',
    });
    assert.equal(descFail, 'محاولة تسجيل دخول فاشلة للمستخدم mohamed');

    const descRejected = formatArabicDescription({
      actorId: 'anonymous',
      actorUsername: 'anonymous',
      targetUsername: 'tarek',
      eventType: 'LOGIN_REJECTED',
    });
    assert.ok(descRejected.includes('تم رفض محاولة تسجيل الدخول'));

    const descCreate = formatArabicDescription({
      actorId: 'admin-1',
      actorUsername: 'المدير',
      targetUsername: 'khalid',
      eventType: 'USER_CREATE',
    });
    assert.equal(descCreate, 'قام المدير بإنشاء مستخدم جديد باسم khalid');

    const descPerm = formatArabicDescription({
      actorId: 'admin-1',
      actorUsername: 'المدير',
      targetUsername: 'khalid',
      eventType: 'USER_PERMISSIONS_CHANGE',
    });
    assert.equal(descPerm, 'قام المدير بتعديل صلاحيات المستخدم khalid');

    const descDelete = formatArabicDescription({
      actorId: 'admin-1',
      actorUsername: 'المدير',
      targetUsername: 'khalid',
      eventType: 'USER_DELETE',
    });
    assert.equal(descDelete, 'قام المدير بحذف المستخدم khalid');

    const descTimeout = formatArabicDescription({
      actorId: 'u-5',
      actorUsername: 'salem',
      eventType: 'INACTIVITY_TIMEOUT',
    });
    assert.ok(descTimeout.includes('7 أيام'));
  });

  test('6. Activity Logger strictly redacts sensitive data from metadata', async () => {
    await activityLogger.logActivity({
      actorId: 'adm-01',
      actorUsername: 'admin',
      eventType: 'USER_CREATE',
      metadata: {
        username: 'secureuser',
        password: 'SuperSecretPassword123!',
        accessCode: '9999',
        access_code_hash: '$2a$10$abcdefghijklmnopqrstuvwxyz',
        sessionToken: 'tok_live_123456789',
        apiKeySecret: 'secret_live_key',
        allowedModules: 'both',
      },
    });

    const recent = await activityLogger.getLogs({ limit: 1 });
    assert.equal(recent.logs.length, 1);
    const meta = recent.logs[0].metadata;

    assert.equal(meta.password, '[REDACTED_SENSITIVE]');
    assert.equal(meta.accessCode, '[REDACTED_SENSITIVE]');
    assert.equal(meta.access_code_hash, '[REDACTED_SENSITIVE]');
    assert.equal(meta.sessionToken, '[REDACTED_SENSITIVE]');
    assert.equal(meta.apiKeySecret, '[REDACTED_SENSITIVE]');
    assert.equal(meta.allowedModules, 'both');
  });

  test('7. Super admin "saberadmin" authentication is protected and operational', async () => {
    const admin = await adminService.authenticateAdmin('saberadmin', '123456@asd');
    assert.ok(admin, 'Super admin credentials must validate');
    assert.ok(admin.role === 'superadmin' || admin.role === 'admin');
    assert.equal(admin.username, 'saberadmin');
  });

  test('8. Deleted user credentials remain rejected after session recreation', async () => {
    const deletedAuth = await adminService.verifyDesktopCredentials({
      username: 'ahmed',
      accessCode: '123456',
    });
    assert.equal(deletedAuth.success, false, 'Deleted user "ahmed" credentials must be rejected');
  });
});
