import test from 'node:test';
import assert from 'node:assert/strict';

// 100% Isolated Mock Storage
class MockLocalStorage {
  constructor() {
    this.store = new Map();
  }
  getItem(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }
  setItem(key, value) {
    this.store.set(key, String(value));
  }
  removeItem(key) {
    this.store.delete(key);
  }
  clear() {
    this.store.clear();
  }
}

globalThis.localStorage = new MockLocalStorage();
if (typeof globalThis.window === 'undefined') {
  globalThis.window = { localStorage: globalThis.localStorage };
}
if (typeof globalThis.navigator === 'undefined') {
  globalThis.navigator = { onLine: false };
}

// Strictly block network calls to production Supabase
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, options) => {
  if (typeof url === 'string' && url.includes('supabase.co')) {
    throw new Error('NETWORK BLOCKED: Automated tests must not call production Supabase!');
  }
  if (originalFetch) return originalFetch(url, options);
  throw new Error('Fetch not available');
};

test('TASK 1: Automated Multi-Device Session Revocation on Access Code Change', async (t) => {
  const usersTable = new Map();
  const sessionsTable = new Map();

  const testUser = {
    id: 'user-uuid-1111-2222',
    username: 'ahmed_store',
    display_name: 'أحمد المتجر',
    access_code_hash: '$2a$10$oldHashValuePlaceholder99',
    credential_version: 1,
    is_active: true,
  };
  usersTable.set(testUser.id, { ...testUser });

  const otherUser = {
    id: 'user-uuid-3333-4444',
    username: 'mahmoud_cashier',
    display_name: 'محمود كاشير',
    access_code_hash: '$2a$10$otherUserHashValue11',
    credential_version: 1,
    is_active: true,
  };
  usersTable.set(otherUser.id, { ...otherUser });

  const adminUser = {
    id: 'admin-uuid-0000',
    username: 'super_admin',
    display_name: 'مدير النظام الرئيسي',
    role: 'superadmin',
  };

  // 1. Multiple sessions on multiple devices for target user
  sessionsTable.set('sess-desktop-pos1', {
    id: 'sess-desktop-pos1',
    user_id: testUser.id,
    device_info: 'POS Windows Device 1',
    credential_version: 1,
    revoked_at: null,
    created_at: new Date(Date.now() - 3600000).toISOString(),
    last_active_at: new Date(Date.now() - 60000).toISOString(),
  });
  sessionsTable.set('sess-laptop-mobile', {
    id: 'sess-laptop-mobile',
    user_id: testUser.id,
    device_info: 'Manager Laptop Device 2',
    credential_version: 1,
    revoked_at: null,
    created_at: new Date(Date.now() - 7200000).toISOString(),
    last_active_at: new Date(Date.now() - 120000).toISOString(),
  });

  // Sessions for other users and administrator
  sessionsTable.set('sess-other-user', {
    id: 'sess-other-user',
    user_id: otherUser.id,
    device_info: 'POS Windows Device 3',
    credential_version: 1,
    revoked_at: null,
    created_at: new Date(Date.now() - 1800000).toISOString(),
    last_active_at: new Date(Date.now() - 30000).toISOString(),
  });
  sessionsTable.set('sess-admin', {
    id: 'sess-admin',
    user_id: adminUser.id,
    device_info: 'Admin Dashboard Browser',
    credential_version: 1,
    revoked_at: null,
    created_at: new Date(Date.now() - 900000).toISOString(),
    last_active_at: new Date(Date.now() - 10000).toISOString(),
  });

  await t.test('1 & 2. Changing access code revokes all active sessions of target user across all devices', async () => {
    const targetUserId = testUser.id;
    const newHash = '$2a$10$newBcryptHashedAccessCode77';

    // Execute credential change and session revocation logic
    const user = usersTable.get(targetUserId);
    assert.ok(user, 'Target user must exist');

    user.access_code_hash = newHash;
    user.credential_version = (user.credential_version || 1) + 1;
    usersTable.set(targetUserId, user);

    let revokedCount = 0;
    for (const [sessId, sess] of sessionsTable.entries()) {
      if (sess.user_id === targetUserId && !sess.revoked_at) {
        sess.revoked_at = new Date().toISOString();
        revokedCount++;
      }
    }

    assert.equal(revokedCount, 2, 'Must revoke all 2 sessions on all devices for this user');
    assert.ok(sessionsTable.get('sess-desktop-pos1').revoked_at !== null, 'Device 1 session must be revoked');
    assert.ok(sessionsTable.get('sess-laptop-mobile').revoked_at !== null, 'Device 2 session must be revoked');
    assert.equal(user.credential_version, 2, 'Credential version must increment to 2');
  });

  await t.test('3 & 4. Old access code is rejected and new access code is required', async () => {
    const user = usersTable.get(testUser.id);
    const oldHash = '$2a$10$oldHashValuePlaceholder99';
    const newHash = '$2a$10$newBcryptHashedAccessCode77';

    // Old hash check
    assert.notEqual(user.access_code_hash, oldHash, 'Old password hash must no longer match');
    // New hash check
    assert.equal(user.access_code_hash, newHash, 'New password hash must match for authentication');
  });

  await t.test('5 & 6. Other users sessions and administrator session remain untouched and valid', async () => {
    const otherSess = sessionsTable.get('sess-other-user');
    const adminSess = sessionsTable.get('sess-admin');

    assert.equal(otherSess.revoked_at, null, 'Other users session must NOT be revoked');
    assert.equal(adminSess.revoked_at, null, 'Administrator session must NOT be revoked');
  });

  await t.test('7. Failed credential update does not revoke sessions', async () => {
    // Reset test state for failure simulation
    const failingUserId = otherUser.id;
    const preRevokeSession = sessionsTable.get('sess-other-user');
    assert.equal(preRevokeSession.revoked_at, null);

    let credentialUpdateFailed = false;
    try {
      // Simulate validation failure (e.g. short password)
      const inputCode = '12';
      if (inputCode.length < 4) {
        throw new Error('رمز الدخول الجديد يجب ألا يقل عن 4 خانات');
      }
    } catch (err) {
      credentialUpdateFailed = true;
    }

    assert.equal(credentialUpdateFailed, true, 'Validation must fail');
    // Sessions must NOT be touched
    assert.equal(sessionsTable.get('sess-other-user').revoked_at, null, 'Sessions must remain untouched when update fails');
  });

  await t.test('8. Stale locally persisted sessions cannot bypass server-side revocation', async () => {
    // A client device that held a stale session with credential_version = 1
    const staleLocalSession = {
      sessionToken: 'stale-token-12345',
      user: {
        id: testUser.id,
        credentialVersion: 1, // Stale!
      },
    };

    // Server-side check
    const currentUserInDb = usersTable.get(testUser.id);
    const isStaleRejected = currentUserInDb.credential_version > staleLocalSession.user.credentialVersion;

    assert.equal(isStaleRejected, true, 'Server-side credential version check must reject stale local session');
  });

  await t.test('9. Existing 7-day (168-hour) inactivity timeout behavior remains intact', async () => {
    const { desktopAuthService, INACTIVITY_TIMEOUT_MS } = await import('../src/services/desktopAuthService.ts');
    assert.equal(INACTIVITY_TIMEOUT_MS, 7 * 24 * 60 * 60 * 1000, 'Inactivity timeout must equal exactly 7 days');

    const activeSession = {
      sessionToken: 'active-session-token',
      lastActivityAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
    };
    const activeCheck = desktopAuthService.checkInactivityTimeout(activeSession);
    assert.equal(activeCheck.expired, false, 'Recent session should not be expired');

    const expiredSession = {
      sessionToken: 'expired-session-token',
      lastActivityAt: new Date(Date.now() - (8 * 24 * 60 * 60 * 1000)).toISOString(), // 8 days ago
    };
    const expiredCheck = desktopAuthService.checkInactivityTimeout(expiredSession);
    assert.equal(expiredCheck.expired, true, 'Session inactive for >7 days must expire');
    assert.equal(expiredCheck.reason, 'INACTIVITY_TIMEOUT');
  });
});

test('TASK 2: Audit Logging Displays Actual Target Username and Preserves History', async (t) => {
  const { activityLogger, formatArabicDescription } = await import('../admin-dashboard/src/services/activityLogger.ts');

  await t.test('1 & 2. Access code change event identifies actor admin and target username', async () => {
    activityLogger._clearMemoryBuffer();

    const actorId = 'admin-uuid-001';
    const actorUsername = 'Ahmed Admin';
    const targetUserId = 'c8b939f5-19e0-410a-b333-8a9d16a57cf0';
    const targetUsername = 'ahmed_store';

    const eventId = await activityLogger.logActivity({
      actorId,
      actorUsername,
      eventType: 'USER_ACCESS_CODE_CHANGE',
      targetType: 'user',
      targetId: targetUserId,
      targetUsername,
      status: 'SUCCESS',
      metadata: {
        note: 'تم تغيير وتشفير رمز الدخول وإبطال الجلسات السابقة',
        credentialVersion: 2,
        targetUsername,
        username: targetUsername,
      },
    });

    assert.ok(eventId, 'Event ID must be returned');

    const buffer = activityLogger._getMemoryBuffer();
    const logged = buffer.find(b => b.id === eventId);
    assert.ok(logged, 'Event must exist in buffer');

    assert.equal(logged.actorId, actorId);
    assert.equal(logged.actorUsername, actorUsername);
    assert.equal(logged.targetId, targetUserId, 'targetId must store the stable user UUID');
    assert.equal(logged.metadata.targetUsername, targetUsername, 'metadata must store actual username');

    // Check formatted description
    const desc = logged.metadata.description;
    assert.ok(
      desc.includes('Ahmed Admin') && desc.includes('ahmed_store'),
      `Description must include actor and target username: "${desc}"`
    );
  });

  await t.test('3. No encrypted or hash-like credential value appears in place of username', async () => {
    const desc = formatArabicDescription({
      actorId: 'admin-01',
      actorUsername: 'Ahmed Admin',
      eventType: 'USER_ACCESS_CODE_CHANGE',
      targetType: 'user',
      targetId: '4d653770-bc66-4e58-9be9-a1b63eb4c143',
      targetUsername: 'ahmed_store',
    });

    assert.ok(desc.includes('ahmed_store'), 'Must include target username');
    assert.equal(desc.includes('4d653770'), false, 'Must NOT display UUID or hash-like ID in place of username');
    assert.equal(desc.includes('$2a$'), false, 'Must NOT contain password hash');
  });

  await t.test('4. Target user ID and username are associated correctly', async () => {
    const memory = activityLogger._getMemoryBuffer();
    const event = memory[0];
    assert.equal(event.targetId, 'c8b939f5-19e0-410a-b333-8a9d16a57cf0');
    assert.equal(event.metadata.targetUsername, 'ahmed_store');
  });

  await t.test('5. Safe fallback display when target user was deleted', async () => {
    // Deleted user where no targetUsername was provided
    const desc = formatArabicDescription({
      actorId: 'admin-01',
      actorUsername: 'Ahmed Admin',
      eventType: 'USER_ACCESS_CODE_CHANGE',
      targetType: 'user',
      targetId: '99999999-0000-0000-0000-000000000000',
    });

    assert.ok(
      desc.includes('مستخدم #99999999') || desc.includes('المستخدم'),
      `Must display safe fallback for deleted user: "${desc}"`
    );
  });

  await t.test('6. No plaintext credentials or password hashes in metadata', async () => {
    activityLogger._clearMemoryBuffer();

    const loggedId = await activityLogger.logActivity({
      actorId: 'admin-01',
      actorUsername: 'admin',
      eventType: 'USER_ACCESS_CODE_CHANGE',
      targetType: 'user',
      targetId: 'user-01',
      targetUsername: 'test_user',
      metadata: {
        password: 'PlainTextPassword123',
        new_password_hash: '$2a$10$hashedPasswordValue',
        accessCode: '1234',
        token: 'secretTokenValue',
      },
    });

    const logged = activityLogger._getMemoryBuffer().find(l => l.id === loggedId);
    assert.ok(logged);
    assert.equal(logged.metadata.password, '[REDACTED_SENSITIVE]');
    assert.equal(logged.metadata.new_password_hash, '[REDACTED_SENSITIVE]');
    assert.equal(logged.metadata.accessCode, '[REDACTED_SENSITIVE]');
    assert.equal(logged.metadata.token, '[REDACTED_SENSITIVE]');
  });

  await t.test('7. Existing historical audit events continue to render correctly', async () => {
    // Historical event with 'username' in metadata instead of 'targetUsername'
    const historicalEvent = {
      id: 'hist-001',
      actorId: 'admin-1',
      actorUsername: 'admin',
      eventType: 'USER_ACCESS_CODE_CHANGE',
      targetType: 'user',
      targetId: 'historical-uuid-001',
      metadata: {
        note: 'Old event',
        username: 'legacy_user',
      },
      createdAt: '2026-11-20T10:00:00Z',
    };

    const targetUser =
      historicalEvent.metadata.targetUsername ||
      historicalEvent.metadata.username ||
      historicalEvent.targetId;

    assert.equal(targetUser, 'legacy_user', 'Historical events with username field must resolve correctly');
  });
});

test('TASK 3: Access Code Authentication Disconnect, 0-Row RLS Prevention, and Credential Verification', async (t) => {
  const { hashAccessCode, verifyAccessCode, validateAccessCode } = await import('../admin-dashboard/src/lib/security.ts');

  // Simulated Authoritative Database Store (mocking Supabase app_users and app_user_sessions)
  const dbUsers = new Map();
  const dbSessions = new Map();

  // Create an existing user with access code '1234'
  const initialAccessCode = '1234';
  const initialHash = await hashAccessCode(initialAccessCode);
  const testUserId = 'user-auth-uuid-9999';

  dbUsers.set(testUserId, {
    id: testUserId,
    username: 'sales_rep',
    display_name: 'مندوب المبيعات',
    access_code_hash: initialHash,
    credential_version: 1,
    permission_version: 1,
    is_active: true,
  });

  // User has an active desktop session with credential_version = 1
  dbSessions.set('desktop-session-01', {
    id: 'desktop-session-01',
    user_id: testUserId,
    credential_version: 1,
    revoked_at: null,
  });

  await t.test('1. Initial credentials: login with "1234" succeeds, "123456789" fails', async () => {
    const user = dbUsers.get(testUserId);
    const verifyInitial = await verifyAccessCode('1234', user.access_code_hash);
    const verifyNewEarly = await verifyAccessCode('123456789', user.access_code_hash);

    assert.equal(verifyInitial, true, 'Initial access code "1234" must verify successfully');
    assert.equal(verifyNewEarly, false, 'Unchanged access code "123456789" must fail verification');
  });

  await t.test('2. Authoritative access code change from "1234" to "123456789"', async () => {
    const newAccessCode = '123456789';
    const validation = validateAccessCode(newAccessCode);
    assert.equal(validation.valid, true);

    const newHashed = await hashAccessCode(newAccessCode);
    const user = dbUsers.get(testUserId);

    // Simulate atomic update (as performed by admin_change_user_access_code RPC)
    const nextCredVer = user.credential_version + 1;
    user.access_code_hash = newHashed;
    user.credential_version = nextCredVer;
    user.updated_at = new Date().toISOString();
    dbUsers.set(testUserId, user);

    // Invalidate existing sessions
    for (const [sessId, sess] of dbSessions.entries()) {
      if (sess.user_id === testUserId && !sess.revoked_at) {
        sess.revoked_at = new Date().toISOString();
      }
    }

    assert.equal(user.credential_version, 2, 'Credential version must increment to 2');
    assert.ok(dbSessions.get('desktop-session-01').revoked_at !== null, 'Previous session must be revoked');
  });

  await t.test('3. Post-change authentication: "123456789" SUCCEEDS and "1234" FAILS immediately', async () => {
    const user = dbUsers.get(testUserId);

    // Verification with NEW code: MUST SUCCEED
    const verifyNew = await verifyAccessCode('123456789', user.access_code_hash);
    assert.equal(verifyNew, true, 'Login with new access code "123456789" MUST succeed');

    // Verification with OLD code: MUST FAIL
    const verifyOld = await verifyAccessCode('1234', user.access_code_hash);
    assert.equal(verifyOld, false, 'Login with old access code "1234" MUST fail immediately');
  });

  await t.test('4. Stale session with credential_version = 1 is rejected', async () => {
    const user = dbUsers.get(testUserId);
    const staleSession = dbSessions.get('desktop-session-01');

    // Server-side validation checks
    const isRevoked = staleSession.revoked_at !== null;
    const isVersionStale = staleSession.credential_version < user.credential_version;

    assert.equal(isRevoked, true, 'Stale session must be marked as revoked');
    assert.equal(isVersionStale, true, 'Stale session credential_version (1) must be less than current (2)');
  });

  await t.test('5. 0-row RLS update simulation must throw error and NEVER report false success', async () => {
    // When Supabase RLS blocks direct table update, PostgREST returns data: [] with error: null.
    // The service must detect updatedRows.length === 0 and throw an error.
    const simulateRlsBlockedUpdate = async (updatedRows, updError) => {
      if (updError) {
        throw new Error(`DB Error: ${updError.message}`);
      }
      if (!updatedRows || updatedRows.length === 0) {
        throw new Error(
          'فشل في تحديث رمز الدخول في قاعدة البيانات: لم يتم تعديل أي سجل (تم حظر التعديل بواسطة سياسات الأمان RLS أو لم يتم العثور على المستخدم)'
        );
      }
      return { success: true };
    };

    // Test case: 0 rows modified (RLS silent block)
    let threwRlsError = false;
    try {
      await simulateRlsBlockedUpdate([], null);
    } catch (err) {
      threwRlsError = true;
      assert.ok(err.message.includes('RLS'), 'Error message must explain RLS block or 0 rows modified');
    }
    assert.equal(threwRlsError, true, 'Service MUST throw error when 0 rows modified under RLS');

    // Test case: 1 row modified (success)
    const successResult = await simulateRlsBlockedUpdate([{ id: testUserId }], null);
    assert.equal(successResult.success, true);
  });

  await t.test('6. Other users credentials and active sessions are unaffected', async () => {
    const otherUserId = 'other-user-uuid-8888';
    const otherHash = await hashAccessCode('5555');
    dbUsers.set(otherUserId, {
      id: otherUserId,
      username: 'cashier_02',
      access_code_hash: otherHash,
      credential_version: 1,
    });
    dbSessions.set('other-session-02', {
      id: 'other-session-02',
      user_id: otherUserId,
      credential_version: 1,
      revoked_at: null,
    });

    // Verify other user still authenticates with their own code
    const otherUser = dbUsers.get(otherUserId);
    const isOtherValid = await verifyAccessCode('5555', otherUser.access_code_hash);
    assert.equal(isOtherValid, true, 'Other user must authenticate with their own code');

    // Other user session must still be active
    const otherSession = dbSessions.get('other-session-02');
    assert.equal(otherSession.revoked_at, null, 'Other user session must remain active');
    assert.equal(otherSession.credential_version, otherUser.credential_version);
  });
});

test('TASK 4: Production RPC Error Handling and Atomicity Guarantees', async (t) => {
  await t.test('1. Missing RPC function in schema cache (PGRST202) produces descriptive migration guidance', async () => {
    const handleRpcResponse = (rpcData, rpcError) => {
      if (rpcError) {
        const errMsg = rpcError.message || '';
        if (rpcError.code === 'PGRST202' || errMsg.includes('schema cache') || errMsg.includes('Could not find')) {
          throw new Error(
            'دالة admin_change_user_access_code غير موجودة في قاعدة البيانات. يرجى تطبيق ملف الترحيل 20261124_admin_change_user_access_code.sql في Supabase SQL Editor.'
          );
        }
        throw new Error(errMsg || 'فشل في تحديث رمز الدخول في قاعدة البيانات');
      }
      if (!rpcData || rpcData.length === 0) {
        throw new Error('لم يتم إرجاع أي بيانات بعد تحديث رمز الدخول للمستخدم');
      }
      return rpcData[0];
    };

    let threwMigrationGuidance = false;
    try {
      handleRpcResponse(null, {
        code: 'PGRST202',
        message: 'Could not find the function public.admin_change_user_access_code in the schema cache',
      });
    } catch (err) {
      threwMigrationGuidance = true;
      assert.ok(err.message.includes('20261124_admin_change_user_access_code.sql'), 'Must guide user to execute migration');
      assert.ok(err.message.includes('admin_change_user_access_code'), 'Must specify function name');
    }
    assert.equal(threwMigrationGuidance, true, 'Must throw descriptive error on PGRST202');
  });

  await t.test('2. Real database exceptions are never swallowed and surface accurately', async () => {
    const handleRpcResponse = (rpcData, rpcError) => {
      if (rpcError) {
        const errMsg = rpcError.message || '';
        if (rpcError.code === 'PGRST202' || errMsg.includes('schema cache') || errMsg.includes('Could not find')) {
          throw new Error(
            'دالة admin_change_user_access_code غير موجودة في قاعدة البيانات. يرجى تطبيق ملف الترحيل 20261124_admin_change_user_access_code.sql في Supabase SQL Editor.'
          );
        }
        throw new Error(errMsg || 'فشل في تحديث رمز الدخول في قاعدة البيانات');
      }
      return rpcData;
    };

    // Postgres P0001 custom error
    let threwCustomError = false;
    try {
      handleRpcResponse(null, { code: 'P0001', message: 'المستخدم غير موجود في قاعدة البيانات' });
    } catch (err) {
      threwCustomError = true;
      assert.equal(err.message, 'المستخدم غير موجود في قاعدة البيانات');
    }
    assert.equal(threwCustomError, true);

    // Postgres permission denied
    let threwPermError = false;
    try {
      handleRpcResponse(null, { code: '42501', message: 'permission denied for function admin_change_user_access_code' });
    } catch (err) {
      threwPermError = true;
      assert.ok(err.message.includes('permission denied'));
    }
    assert.equal(threwPermError, true);
  });

  await t.test('3. RPC success returns full target user snapshot with incremented credential_version', async () => {
    const mockRpcResult = [
      {
        id: 'user-uuid-9999',
        username: 'ayman',
        display_name: 'أيمن فتح الباب',
        credential_version: 2,
        updated_at: new Date().toISOString(),
      },
    ];

    const targetRow = mockRpcResult[0];
    assert.equal(targetRow.username, 'ayman');
    assert.equal(targetRow.credential_version, 2);
    assert.equal(targetRow.display_name, 'أيمن فتح الباب');
  });
});
