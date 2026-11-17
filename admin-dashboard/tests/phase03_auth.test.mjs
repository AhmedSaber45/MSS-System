import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { adminService } from '../src/services/adminService.ts';

describe('Admin Service Phase 3 Desktop Session Revalidation & Revocation', () => {
  const dummyActor = {
    adminId: 'admin-001',
    username: 'superadmin',
    displayName: 'Super Admin',
    role: 'superadmin',
    exp: Date.now() + 3600000,
  };

  it('revalidates active desktop session successfully', async () => {
    const username = `reval_u_${Date.now()}`;
    await adminService.createAppUser(
      {
        username,
        displayName: 'مستخدم إعادة التحقق',
        accessCode: 'secret99',
        confirmAccessCode: 'secret99',
        allowedModules: 'both',
      },
      dummyActor
    );

    const loginRes = await adminService.verifyDesktopCredentials({
      username,
      accessCode: 'secret99',
    });

    assert.equal(loginRes.success, true);
    assert.ok(loginRes.sessionToken);

    const reval = await adminService.revalidateDesktopSession({
      sessionToken: loginRes.sessionToken,
    });

    assert.equal(reval.success, true);
    assert.equal(reval.reason, 'VALID');
    assert.equal(reval.user?.username, username);
    assert.equal(reval.user?.allowedModules, 'both');
  });

  it('detects credential version change and invalidates session', async () => {
    const username = `cred_change_${Date.now()}`;
    const user = await adminService.createAppUser(
      {
        username,
        displayName: 'مستخدم تغيير الرمز',
        accessCode: 'pass111',
        confirmAccessCode: 'pass111',
        allowedModules: 'mss',
      },
      dummyActor
    );

    const loginRes = await adminService.verifyDesktopCredentials({
      username,
      accessCode: 'pass111',
    });

    assert.equal(loginRes.success, true);

    // Admin updates code
    await adminService.changeUserAccessCode(user.id, 'pass222', dummyActor, 'pass222');

    const reval = await adminService.revalidateDesktopSession({
      sessionToken: loginRes.sessionToken,
    });

    assert.equal(reval.success, false);
    assert.ok(reval.reason === 'CREDENTIAL_CHANGED' || reval.reason === 'SESSION_REVOKED');
  });

  it('detects account disabling and revokes session', async () => {
    const username = `disable_u_${Date.now()}`;
    const user = await adminService.createAppUser(
      {
        username,
        displayName: 'مستخدم معطل',
        accessCode: 'pass333',
        confirmAccessCode: 'pass333',
        allowedModules: 'accessories',
      },
      dummyActor
    );

    const loginRes = await adminService.verifyDesktopCredentials({
      username,
      accessCode: 'pass333',
    });

    assert.equal(loginRes.success, true);

    // Disable user
    await adminService.toggleUserStatus(user.id, false, dummyActor);

    const reval = await adminService.revalidateDesktopSession({
      sessionToken: loginRes.sessionToken,
    });

    assert.equal(reval.success, false);
    assert.ok(reval.reason === 'ACCOUNT_DISABLED' || reval.reason === 'SESSION_REVOKED');
  });

  it('logout invalidates active session immediately', async () => {
    const username = `logout_u_${Date.now()}`;
    await adminService.createAppUser(
      {
        username,
        displayName: 'مستخدم خروج',
        accessCode: 'pass444',
        confirmAccessCode: 'pass444',
        allowedModules: 'both',
      },
      dummyActor
    );

    const loginRes = await adminService.verifyDesktopCredentials({
      username,
      accessCode: 'pass444',
    });

    assert.equal(loginRes.success, true);

    // Logout
    await adminService.logoutDesktopSession({ sessionToken: loginRes.sessionToken });

    const reval = await adminService.revalidateDesktopSession({
      sessionToken: loginRes.sessionToken,
    });

    assert.equal(reval.success, false);
    assert.equal(reval.reason, 'SESSION_REVOKED');
  });
});
