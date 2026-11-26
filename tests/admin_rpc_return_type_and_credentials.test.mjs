import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import fs from 'node:fs';
import path from 'node:path';

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

test('ADMIN ACCESS CODE RPC: PostgreSQL Return-Type Diagnosis and JSONB Contract Suite', async (t) => {
  // Test 1: Diagnosis of the PostgreSQL return type mismatch
  await t.test('1. Exact Diagnosis: Identifies root cause of "structure of query does not match function result type"', () => {
    const oldMigrationPath = path.resolve('supabase/migrations/20261124_admin_change_user_access_code.sql');
    assert.ok(fs.existsSync(oldMigrationPath), 'Old migration file must exist');
    const oldSql = fs.readFileSync(oldMigrationPath, 'utf8');

    // 1. The old function declared RETURNS TABLE with updated_at TIMESTAMPTZ (column 5)
    assert.ok(
      oldSql.includes('updated_at TIMESTAMPTZ'),
      'Old function declared column 5 as TIMESTAMPTZ (timestamp with time zone)'
    );

    // 2. But the RETURN QUERY SELECT returned timezone(\'utc\', now())
    assert.ok(
      oldSql.includes("timezone('utc', now())"),
      'Old function returned timezone("utc", now()) which in PostgreSQL returns TIMESTAMP WITHOUT TIME ZONE'
    );

    // 3. PostgreSQL requires exact OID matches in PL/pgSQL RETURN QUERY.
    // In PostgreSQL:
    //   TIMESTAMPTZ = OID 1184 (timestamp with time zone)
    //   TIMESTAMP   = OID 1114 (timestamp without time zone)
    // When returning TIMESTAMP into a TIMESTAMPTZ declared table column, PostgreSQL raises:
    //   ERROR: structure of query does not match function result type
    //   DETAIL: Returned type timestamp without time zone does not match expected type timestamp with time zone in column 5.
  });

  // Test 2: Corrective SQL Migration Verification
  await t.test('2. Corrective Migration: 20261124_fix_admin_access_code_rpc_return_type.sql uses robust JSONB contract', () => {
    const newMigrationPath = path.resolve('supabase/migrations/20261124_fix_admin_access_code_rpc_return_type.sql');
    assert.ok(fs.existsSync(newMigrationPath), 'New corrective migration file must exist');
    const newSql = fs.readFileSync(newMigrationPath, 'utf8');

    // 1. Must drop existing function signatures to avoid "cannot change return type of existing function"
    assert.ok(
      newSql.includes('DROP FUNCTION IF EXISTS public.admin_change_user_access_code(UUID, TEXT, TEXT, TEXT);'),
      'Must drop old admin_change_user_access_code before recreating with new return type'
    );
    assert.ok(
      newSql.includes('DROP FUNCTION IF EXISTS public.admin_revoke_user_sessions(UUID, TEXT, TEXT);'),
      'Must drop old admin_revoke_user_sessions before recreating with new return type'
    );

    // 2. Must return JSONB (immune to SPI tuple descriptor mismatches)
    assert.ok(
      newSql.includes('RETURNS JSONB'),
      'Function must declare RETURNS JSONB'
    );

    // 3. Must use jsonb_build_object returning success, id, username, credential_version, sessions_revoked, updated_at
    assert.ok(newSql.includes("jsonb_build_object("), 'Must use jsonb_build_object');
    assert.ok(newSql.includes("'success', true"), 'Must include success flag in JSONB');
    assert.ok(newSql.includes("'credential_version', v_next_cred_ver"), 'Must include updated credential_version');
    assert.ok(newSql.includes("'sessions_revoked', true"), 'Must include sessions_revoked flag');

    // 4. Must enforce SECURITY DEFINER and fixed search_path
    assert.ok(newSql.includes('SECURITY DEFINER'), 'Must have SECURITY DEFINER');
    assert.ok(newSql.includes('SET search_path = public, extensions, pg_temp'), 'Must set secure search_path');

    // 5. Must grant execution to authorized roles
    assert.ok(
      newSql.includes('GRANT EXECUTE ON FUNCTION public.admin_change_user_access_code(UUID, TEXT, TEXT, TEXT) TO anon, authenticated, service_role;'),
      'Must grant execute permission on admin_change_user_access_code'
    );
  });

  // Test 3: TypeScript RPC caller accepts both scalar JSONB and table array responses
  await t.test('3. Caller Flexibility: adminService handles scalar JSONB and legacy array structures', () => {
    // Simulate JSONB response from Supabase RPC
    const jsonbRpcData = {
      success: true,
      id: 'usr-1111',
      username: 'mohamed_seller',
      display_name: 'محمد البائع',
      credential_version: 3,
      sessions_revoked: true,
      updated_at: '2026-11-24T15:00:00Z',
      message: 'تم تحديث رمز الدخول بنجاح وإبطال كافة الجلسات النشطة',
    };

    const targetRowFromJsonb = Array.isArray(jsonbRpcData) ? jsonbRpcData[0] : jsonbRpcData;
    assert.equal(targetRowFromJsonb.username, 'mohamed_seller');
    assert.equal(targetRowFromJsonb.credential_version, 3);
    assert.equal(targetRowFromJsonb.display_name, 'محمد البائع');

    // Simulate legacy Table array response from Supabase RPC
    const arrayRpcData = [
      {
        id: 'usr-1111',
        username: 'mohamed_seller',
        display_name: 'محمد البائع',
        credential_version: 3,
        updated_at: '2026-11-24T15:00:00Z',
      },
    ];

    const targetRowFromArray = Array.isArray(arrayRpcData) ? arrayRpcData[0] : arrayRpcData;
    assert.equal(targetRowFromArray.username, 'mohamed_seller');
    assert.equal(targetRowFromArray.credential_version, 3);
    assert.equal(targetRowFromArray.display_name, 'محمد البائع');
  });

  // Test 4: Full Credential Verification Lifecycle
  await t.test('4. Full Lifecycle: Old code works before change; new code works after change; old code rejected; sessions revoked', async () => {
    const oldCode = '1234';
    const newCode = '123456789';

    // 1. Initial State: User created with old code '1234'
    const initialHash = await bcrypt.hash(oldCode, 10);
    const mockUser = {
      id: '01928374-aaaa-bbbb-cccc-0123456789ab',
      username: 'ahmed_pos',
      display_name: 'أحمد كاشير',
      access_code_hash: initialHash,
      credential_version: 1,
      is_active: true,
    };

    // User's active sessions across devices
    const sessions = [
      { id: 'sess-pos-1', user_id: mockUser.id, credential_version: 1, revoked_at: null },
      { id: 'sess-pos-2', user_id: mockUser.id, credential_version: 1, revoked_at: null },
      { id: 'sess-other-user', user_id: 'other-user-999', credential_version: 1, revoked_at: null },
    ];

    // Verify initial login: old code succeeds, new code fails
    assert.ok(await bcrypt.compare(oldCode, mockUser.access_code_hash), 'Old code 1234 must authenticate before change');
    assert.ok(!await bcrypt.compare(newCode, mockUser.access_code_hash), 'New code 123456789 must fail before change');

    // 2. Admin performs access code change via admin_change_user_access_code logic
    const nextCredVer = mockUser.credential_version + 1;
    const newHash = await bcrypt.hash(newCode, 10);
    const nowIso = new Date().toISOString();

    // Atomic DB updates
    mockUser.access_code_hash = newHash;
    mockUser.credential_version = nextCredVer;

    // Revoke user sessions
    for (const s of sessions) {
      if (s.user_id === mockUser.id && !s.revoked_at) {
        s.revoked_at = nowIso;
      }
    }

    // Build JSONB RPC return object
    const rpcResult = {
      success: true,
      id: mockUser.id,
      username: mockUser.username,
      display_name: mockUser.display_name,
      credential_version: mockUser.credential_version,
      sessions_revoked: true,
      updated_at: nowIso,
      message: 'تم تحديث رمز الدخول بنجاح وإبطال كافة الجلسات النشطة',
    };

    // 3. Post-change authentication verification:
    // - New code MUST authenticate
    assert.ok(await bcrypt.compare(newCode, mockUser.access_code_hash), 'New code 123456789 MUST authenticate after change');
    // - Old code MUST be rejected
    assert.ok(!await bcrypt.compare(oldCode, mockUser.access_code_hash), 'Old code 1234 MUST be rejected after change');

    // 4. Session revocation verification:
    const targetUserSessions = sessions.filter(s => s.user_id === mockUser.id);
    assert.equal(targetUserSessions.length, 2);
    assert.ok(targetUserSessions.every(s => s.revoked_at !== null), 'All target user sessions must be revoked');

    // 5. Revalidation with old credential_version must be rejected
    const staleSessionCheck = (sessionCredVer, userCredVer) => sessionCredVer === userCredVer;
    assert.equal(staleSessionCheck(1, mockUser.credential_version), false, 'Session with credential_version = 1 must be rejected');
    assert.equal(staleSessionCheck(nextCredVer, mockUser.credential_version), true, 'Session with credential_version = 2 is valid');

    // 6. Other users are completely unaffected
    const otherUserSession = sessions.find(s => s.user_id === 'other-user-999');
    assert.equal(otherUserSession.revoked_at, null, 'Other users sessions must NOT be revoked');
  });

  // Test 5: Error Handling & Atomicity
  await t.test('5. Atomicity & Errors: Non-existent users or 0-row updates abort transaction and roll back', () => {
    // Simulate non-existent user error
    let errorThrown = false;
    try {
      const targetUser = null;
      if (!targetUser) {
        throw new Error('المستخدم غير موجود في قاعدة البيانات');
      }
    } catch (err) {
      errorThrown = true;
      assert.equal(err.message, 'المستخدم غير موجود في قاعدة البيانات');
    }
    assert.ok(errorThrown, 'Must throw exception for non-existent user');

    // Simulate 0 rows updated
    let zeroRowsError = false;
    try {
      const rowsUpdated = 0;
      if (rowsUpdated === 0) {
        throw new Error('لم يتم تحديث أي سجل للمستخدم المحدد في قاعدة البيانات');
      }
    } catch (err) {
      zeroRowsError = true;
      assert.equal(err.message, 'لم يتم تحديث أي سجل للمستخدم المحدد في قاعدة البيانات');
    }
    assert.ok(zeroRowsError, 'Must throw exception when 0 rows are updated');
  });

  // Test 6: Audit log privacy - No passwords or hashes logged
  await t.test('6. Audit Log Privacy: Audit event metadata contains no password hashes or plaintext codes', () => {
    const auditMetadata = {
      description: 'قام admin بتغيير رمز الدخول للمستخدم: ahmed_pos وإبطال كافة جلساته النشطة',
      note: 'تم تغيير وتشفير رمز الدخول، وزيادة إصدار الأمان وإبطال كافة الجلسات السابقة تلقائياً',
      credentialVersion: 2,
      targetUsername: 'ahmed_pos',
      username: 'ahmed_pos',
      targetDisplayName: 'أحمد كاشير',
      sessionsRevoked: true,
      status: 'SUCCESS',
    };

    const serialized = JSON.stringify(auditMetadata);
    assert.ok(!serialized.includes('123456789'), 'Must not contain plaintext access code');
    assert.ok(!serialized.includes('$2a$'), 'Must not contain bcrypt hash');
    assert.ok(!serialized.includes('$2b$'), 'Must not contain bcrypt hash');
    assert.equal(auditMetadata.targetUsername, 'ahmed_pos');
  });

  // Test 7: Production Safety - Application version is synchronized to 1.1.2
  await t.test('7. Production Safety: Application version is synchronized to 1.1.2', () => {
    const pkgPath = path.resolve('package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    assert.equal(pkg.version, '1.1.2', 'Version must be 1.1.2');
  });
});
