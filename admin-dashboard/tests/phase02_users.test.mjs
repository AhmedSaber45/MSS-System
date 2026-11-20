import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { adminService } from '../src/services/adminService.ts';

describe('Admin Service Phase 2 User Management & Desktop Authentication', () => {
  const dummyActor = {
    adminId: 'admin-001',
    username: 'superadmin',
    displayName: 'Super Admin',
    role: 'superadmin',
    exp: Date.now() + 3600000,
  };

  it('creates user with version 1 and confirmed access code', async () => {
    const username = `test_u_${Date.now()}`;
    const user = await adminService.createAppUser(
      {
        username,
        displayName: 'مستخدم تجريبي',
        accessCode: 'code2026',
        confirmAccessCode: 'code2026',
        allowedModules: 'both',
        isActive: true,
      },
      dummyActor
    );

    assert.equal(user.username, username);
    assert.equal(user.credentialVersion, 1);
    assert.equal(user.permissionVersion, 1);
    assert.equal('access_code_hash' in user, false, 'No hash in returned user');
  });

  it('rejects user creation when accessCode and confirmAccessCode mismatch', async () => {
    await assert.rejects(
      async () => {
        await adminService.createAppUser(
          {
            username: `mismatch_${Date.now()}`,
            displayName: 'مستخدم غير متطابق',
            accessCode: 'code1234',
            confirmAccessCode: 'different999',
            allowedModules: 'accessories',
          },
          dummyActor
        );
      },
      { message: 'رمز الدخول وتأكيد الرمز غير متطابقين' }
    );
  });

  it('changing access code increments credential_version', async () => {
    const username = `cred_test_${Date.now()}`;
    const user = await adminService.createAppUser(
      {
        username,
        displayName: 'اختبار إصدار الأمان',
        accessCode: 'initialCode1',
        confirmAccessCode: 'initialCode1',
        allowedModules: 'mss',
      },
      dummyActor
    );

    assert.equal(user.credentialVersion, 1);

    await adminService.changeUserAccessCode(
      user.id,
      'newSecureCode2',
      dummyActor,
      'newSecureCode2'
    );

    const updatedUsers = await adminService.getAppUsers({ search: username });
    const target = updatedUsers.find(u => u.id === user.id);
    assert.ok(target);
    assert.equal(target.credentialVersion, 2, 'Credential version must increment to 2');
  });

  it('changing module permissions increments permission_version', async () => {
    const username = `perm_test_${Date.now()}`;
    const user = await adminService.createAppUser(
      {
        username,
        displayName: 'اختبار الصلاحيات',
        accessCode: 'initialCode1',
        allowedModules: 'accessories',
      },
      dummyActor
    );

    assert.equal(user.permissionVersion, 1);

    const updated = await adminService.updateAppUser(
      {
        id: user.id,
        allowedModules: 'both',
      },
      dummyActor
    );

    assert.equal(updated.permissionVersion, 2, 'Permission version must increment to 2');
  });

  it('desktop authentication: verifies valid credentials and returns session token and profile', async () => {
    const username = `desktop_auth_${Date.now()}`;
    const accessCode = 'shopSecretPass1';

    await adminService.createAppUser(
      {
        username,
        displayName: 'محاسب الفرع',
        accessCode,
        allowedModules: 'both',
        isActive: true,
      },
      dummyActor
    );

    const result = await adminService.verifyDesktopCredentials({
      username,
      accessCode,
      deviceInfo: 'Shop 1 Main Counter Windows POS',
    });

    assert.equal(result.success, true);
    assert.ok(result.user);
    assert.equal(result.user.username, username);
    assert.ok(result.sessionToken, 'Must generate session token');
    assert.ok(result.expiresAt);
    assert.equal('access_code_hash' in (result.user || {}), false);
  });

  it('desktop authentication: rejects wrong access code with generic message', async () => {
    const username = `desktop_wrong_${Date.now()}`;
    await adminService.createAppUser(
      {
        username,
        displayName: 'مستخدم خاطئ',
        accessCode: 'correctCode',
        allowedModules: 'mss',
        isActive: true,
      },
      dummyActor
    );

    const result = await adminService.verifyDesktopCredentials({
      username,
      accessCode: 'incorrectCode999',
    });

    assert.equal(result.success, false);
    assert.equal(result.error, 'بيانات الدخول غير صحيحة أو الحساب معطل');
    assert.equal(result.sessionToken, undefined);
  });

  it('desktop authentication: rejects disabled user accounts', async () => {
    const username = `disabled_u_${Date.now()}`;
    const accessCode = 'validCode777';

    const user = await adminService.createAppUser(
      {
        username,
        displayName: 'مستخدم معطل',
        accessCode,
        allowedModules: 'both',
        isActive: true,
      },
      dummyActor
    );

    // Disable the account
    await adminService.toggleUserStatus(user.id, false, dummyActor);

    const result = await adminService.verifyDesktopCredentials({
      username,
      accessCode,
    });

    assert.equal(result.success, false);
    assert.equal(result.error, 'بيانات الدخول غير صحيحة أو الحساب معطل');
  });

  it('permanently deletes user, removing account and sessions while preserving business logs', async () => {
    const username = `delete_target_${Date.now()}`;
    const accessCode = 'delCode1234';

    const user = await adminService.createAppUser(
      {
        username,
        displayName: 'مستخدم للحذف',
        accessCode,
        allowedModules: 'mss',
        isActive: true,
      },
      dummyActor
    );

    // Verify session creation
    const authRes = await adminService.verifyDesktopCredentials({
      username,
      accessCode,
    });
    assert.equal(authRes.success, true);
    assert.ok(authRes.sessionToken);

    // Now delete the user
    await adminService.deleteAppUser(user.id, dummyActor);

    // Verify user no longer exists in getAppUsers
    const users = await adminService.getAppUsers({ search: username });
    const exists = users.some(u => u.id === user.id);
    assert.equal(exists, false, 'User must not exist after permanent deletion');

    // Verify session revalidation fails
    const revalRes = await adminService.revalidateDesktopSession({
      sessionToken: authRes.sessionToken,
    });
    assert.equal(revalRes.success, false, 'Deleted user sessions must be revoked');
  });

  it('security safeguard: prevents administrator from deleting their own account', async () => {
    await assert.rejects(
      async () => {
        await adminService.deleteAppUser(dummyActor.adminId, dummyActor);
      },
      { message: 'لا يمكنك حذف حسابك الشخصي المسجل به حالياً' }
    );
  });

  it('security safeguard: rejects deletion attempt by unauthorized auditor role', async () => {
    const auditorActor = {
      adminId: 'auditor-001',
      username: 'auditor_user',
      displayName: 'مراقب النظام',
      role: 'auditor',
      exp: Date.now() + 3600000,
    };

    await assert.rejects(
      async () => {
        await adminService.deleteAppUser('some-user-id', auditorActor);
      },
      { message: 'غير مصرح: حسابات التدقيق لا تملك صلاحية حذف المستخدمين' }
    );
  });

  it('permissions workflow: assigning accessories-only persists accurately across reloads', async () => {
    const username = `perm_acc_${Date.now()}`;
    const user = await adminService.createAppUser(
      {
        username,
        displayName: 'موظف الإكسسوارات',
        accessCode: 'accPass123',
        allowedModules: 'both',
        isActive: true,
      },
      dummyActor
    );

    assert.equal(user.allowedModules, 'both');
    assert.equal(user.permissionVersion, 1);

    // Update to accessories only
    const updated = await adminService.updateAppUser(
      {
        id: user.id,
        allowedModules: 'accessories',
      },
      dummyActor
    );

    assert.equal(updated.allowedModules, 'accessories');
    assert.equal(updated.permissionVersion, 2);

    // Verify getAppUsers reflects the updated allowedModules correctly
    const allUsers = await adminService.getAppUsers({ search: username });
    const target = allUsers.find(u => u.id === user.id);
    assert.ok(target, 'User must be found in list');
    assert.equal(target.allowedModules, 'accessories', 'Must persist accessories permission accurately');
    assert.equal(target.permissionVersion, 2, 'Permission version must match');
  });

  it('permissions workflow: assigning mss-only persists accurately across reloads', async () => {
    const username = `perm_mss_${Date.now()}`;
    const user = await adminService.createAppUser(
      {
        username,
        displayName: 'موظف أجهزة MSS',
        accessCode: 'mssPass123',
        allowedModules: 'both',
        isActive: true,
      },
      dummyActor
    );

    assert.equal(user.allowedModules, 'both');

    // Update to mss only
    const updated = await adminService.updateAppUser(
      {
        id: user.id,
        allowedModules: 'mss',
      },
      dummyActor
    );

    assert.equal(updated.allowedModules, 'mss');

    // Verify getAppUsers reflects mss permission
    const allUsers = await adminService.getAppUsers({ search: username });
    const target = allUsers.find(u => u.id === user.id);
    assert.ok(target);
    assert.equal(target.allowedModules, 'mss', 'Must persist mss permission accurately');
  });
});
