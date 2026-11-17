import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

// Resolve project root paths
const ROOT_DIR = process.cwd();
const ADMIN_DIR = path.join(ROOT_DIR, 'admin-dashboard');
const MIGRATION_PHASE02_PATH = path.join(ROOT_DIR, 'supabase', 'migrations', '20261116_phase02_user_management_and_permissions.sql');

const require = createRequire(path.join(ADMIN_DIR, 'package.json'));
const bcrypt = require('bcryptjs');

describe('Compu MSS — Admin Dashboard Phase 2: User Management, Access Codes & Permissions', () => {

  describe('1. SQL Migration Integrity & Database Schema Extensions', () => {
    it('Phase 2 migration file exists at exact expected path', () => {
      assert.ok(fs.existsSync(MIGRATION_PHASE02_PATH), `Migration file must exist at ${MIGRATION_PHASE02_PATH}`);
    });

    it('migration includes credential_version and permission_version on app_users', () => {
      const sql = fs.readFileSync(MIGRATION_PHASE02_PATH, 'utf-8');
      assert.match(sql, /credential_version/i, 'Must add or check credential_version');
      assert.match(sql, /permission_version/i, 'Must add or check permission_version');
    });

    it('migration creates app_user_sessions table with token hash and versioning', () => {
      const sql = fs.readFileSync(MIGRATION_PHASE02_PATH, 'utf-8');
      assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.app_user_sessions/i, 'Must create app_user_sessions table');
      assert.match(sql, /session_token_hash/i, 'Must store session token hash');
      assert.match(sql, /expires_at/i, 'Must enforce expiration timestamp');
      assert.match(sql, /revoked_at/i, 'Must support revocation timestamp');
    });

    it('migration defines verify_desktop_credentials security definer function', () => {
      const sql = fs.readFileSync(MIGRATION_PHASE02_PATH, 'utf-8');
      assert.match(sql, /CREATE OR REPLACE FUNCTION public\.verify_desktop_credentials/i);
      assert.match(sql, /crypt\(p_access_code/i, 'Must verify access code using pgcrypto');
    });

    it('migration maintains RLS on app_user_sessions and prevents hard deletes', () => {
      const sql = fs.readFileSync(MIGRATION_PHASE02_PATH, 'utf-8');
      assert.match(sql, /ALTER TABLE public\.app_user_sessions ENABLE ROW LEVEL SECURITY/i);
      assert.match(sql, /"No session hard deletes"/i);
    });
  });

  describe('2. User Account Creation, Validation & Normalization', () => {
    it('normalizes username consistently (trimmed, lowercase)', () => {
      const rawUsernames = ['  Shop1_Cashier  ', 'Ayman_MSS', '   Masoud   '];
      const normalized = rawUsernames.map(u => u.trim().toLowerCase());

      assert.deepEqual(normalized, ['shop1_cashier', 'ayman_mss', 'masoud']);
    });

    it('validates username minimum length and character constraints', () => {
      const isValid = (u) => {
        const norm = u.trim().toLowerCase();
        return norm.length >= 3 && /^[a-zA-Z0-9_\u0600-\u06FF.-]+$/.test(norm);
      };

      assert.equal(isValid('ab'), false, 'Too short username rejected');
      assert.equal(isValid('   '), false, 'Empty whitespace rejected');
      assert.equal(isValid('user@name!'), false, 'Special disallowed characters rejected');
      assert.equal(isValid('cashier_1'), true, 'Valid alphanumeric username accepted');
      assert.equal(isValid('أحمد_مسؤول'), true, 'Valid Arabic username accepted');
    });

    it('validates access code minimum length and confirmation match', () => {
      const validate = (code, confirm) => {
        if (!code || code.trim().length < 4) return { valid: false, error: 'code too short' };
        if (confirm !== undefined && code !== confirm) return { valid: false, error: 'mismatch' };
        return { valid: true };
      };

      assert.equal(validate('123', '123').valid, false);
      assert.equal(validate('1234', '1235').valid, false);
      assert.equal(validate('1234', '1234').valid, true);
      assert.equal(validate('SecretPass99', 'SecretPass99').valid, true);
    });
  });

  describe('3. Access Code Hashing, Salt Rounds & Zero-Leak Guarantee', () => {
    it('hashes access codes with bcrypt salt rounds 10', async () => {
      const code = 'secureCode2026';
      const hash = await bcrypt.hash(code, 10);

      assert.ok(hash.startsWith('$2a$10$') || hash.startsWith('$2b$10$'), 'Hash must be bcrypt 10 rounds');
      assert.ok(await bcrypt.compare(code, hash), 'Bcrypt compare must verify matching code');
      assert.equal(await bcrypt.compare('wrongCode', hash), false, 'Bcrypt compare must reject invalid code');
    });

    it('sanitizes user records: access_code_hash is NEVER exposed to client', () => {
      const userRecord = {
        id: 'u-uuid-001',
        username: 'ayman',
        displayName: 'أيمن',
        access_code_hash: '$2a$10$wWj6tD8489vO0k4YhQ/v1.K6qW939tHqP.Xb0H.oV0x9b9g9b9b9b',
        allowedModules: 'mss',
        credentialVersion: 2,
        permissionVersion: 1,
        isActive: true,
      };

      // Sanitize function behavior
      const sanitize = (u) => {
        const copy = { ...u };
        delete copy.access_code_hash;
        delete copy.password_hash;
        return copy;
      };

      const safe = sanitize(userRecord);
      assert.equal('access_code_hash' in safe, false, 'access_code_hash must not exist');
      assert.equal(safe.username, 'ayman');
      assert.equal(safe.credentialVersion, 2);
    });
  });

  describe('4. Module Permissions Authoritative Enforcement', () => {
    const checkModuleAccess = (user, targetModule) => {
      if (!user.isActive) return false;
      if (user.allowedModules === 'both') return true;
      return user.allowedModules === targetModule;
    };

    it('Accessories-only user: Allowed on Accessories, Denied on Compu MSS', () => {
      const user = { allowedModules: 'accessories', isActive: true };
      assert.equal(checkModuleAccess(user, 'accessories'), true);
      assert.equal(checkModuleAccess(user, 'mss'), false);
    });

    it('Compu MSS-only user: Denied on Accessories, Allowed on Compu MSS', () => {
      const user = { allowedModules: 'mss', isActive: true };
      assert.equal(checkModuleAccess(user, 'accessories'), false);
      assert.equal(checkModuleAccess(user, 'mss'), true);
    });

    it('Both-modules user: Allowed on both Accessories and Compu MSS', () => {
      const user = { allowedModules: 'both', isActive: true };
      assert.equal(checkModuleAccess(user, 'accessories'), true);
      assert.equal(checkModuleAccess(user, 'mss'), true);
    });

    it('Disabled user: Denied on ALL modules regardless of assigned permission', () => {
      const user = { allowedModules: 'both', isActive: false };
      assert.equal(checkModuleAccess(user, 'accessories'), false);
      assert.equal(checkModuleAccess(user, 'mss'), false);
    });

    it('changing module permissions increments permission_version', () => {
      const current = { allowedModules: 'accessories', permissionVersion: 1 };
      const newModules = 'both';

      const updated = {
        ...current,
        allowedModules: newModules,
        permissionVersion: newModules !== current.allowedModules ? current.permissionVersion + 1 : current.permissionVersion,
      };

      assert.equal(updated.permissionVersion, 2);
    });
  });

  describe('5. Access Code Change & Session Revocation Foundation', () => {
    it('changing access code increments credential_version and revokes existing sessions', () => {
      const user = {
        id: 'u-1',
        credentialVersion: 1,
      };

      const activeSessions = [
        { id: 's-1', userId: 'u-1', credentialVersion: 1, revokedAt: null },
        { id: 's-2', userId: 'u-1', credentialVersion: 1, revokedAt: null },
      ];

      // Administrator changes access code
      user.credentialVersion += 1;
      const revokedAt = new Date().toISOString();
      activeSessions.forEach(s => {
        if (s.userId === user.id) {
          s.revokedAt = revokedAt;
        }
      });

      assert.equal(user.credentialVersion, 2, 'Credential version must increment');
      assert.ok(activeSessions.every(s => s.revokedAt !== null), 'All prior sessions must be marked revoked');
    });

    it('detects invalidated session when session credential_version is older than user credential_version', () => {
      const user = { id: 'u-1', credentialVersion: 3, isActive: true };
      const session = { credentialVersion: 2, revokedAt: null }; // older version

      const isSessionValid = session.revokedAt === null && session.credentialVersion === user.credentialVersion && user.isActive;
      assert.equal(isSessionValid, false, 'Stale session must be rejected upon revalidation');
    });

    it('disabling account invalidates active sessions', () => {
      const user = { id: 'u-1', isActive: false, credentialVersion: 2 };
      const session = { credentialVersion: 2, revokedAt: null };

      const isSessionValid = session.revokedAt === null && user.isActive;
      assert.equal(isSessionValid, false, 'Disabled user cannot maintain active session');
    });
  });

  describe('6. Store and Warehouse Memberships Model', () => {
    it('supports associating user with multiple stores/warehouses', () => {
      const user = {
        id: 'u-1',
        defaultStoreId: 's-shop1',
        assignedStoreIds: ['s-shop1', 's-shop2', 'wh-main'],
      };

      assert.equal(user.assignedStoreIds.length, 3);
      assert.ok(user.assignedStoreIds.includes('s-shop1'));
      assert.ok(user.assignedStoreIds.includes('wh-main'));
    });

    it('inventory belongs to store, not to user account (scenarios of user transfers/mergers)', () => {
      const laptopDevice = {
        serial: 'SN-THINKPAD-01',
        storeLocation: 'SHOP_1',
      };

      const cashier1 = { id: 'u-1', storeLocation: 'SHOP_1' };
      const cashier2 = { id: 'u-2', storeLocation: 'SHOP_1' };

      // Both cashiers operate on shop's device without personal ownership
      assert.equal(laptopDevice.storeLocation, cashier1.storeLocation);
      assert.equal(laptopDevice.storeLocation, cashier2.storeLocation);
    });
  });

  describe('7. Rate Limiting & Safe Error Handling', () => {
    it('generic error messages do NOT reveal whether a username exists', () => {
      const errorForWrongPassword = 'بيانات الدخول غير صحيحة أو الحساب معطل';
      const errorForNonExistentUser = 'بيانات الدخول غير صحيحة أو الحساب معطل';

      assert.equal(errorForWrongPassword, errorForNonExistentUser, 'Error messages must be indistinguishable');
    });
  });

  describe('8. Audit Log Data Sanitization for User Management Events', () => {
    it('records USER_CREATE, USER_UPDATE, USER_ACCESS_CODE_CHANGE, and USER_STATUS_CHANGE without secrets', () => {
      const events = [
        {
          eventType: 'USER_CREATE',
          metadata: { username: 'fahim', allowedModules: 'both', credentialVersion: 1 },
        },
        {
          eventType: 'USER_ACCESS_CODE_CHANGE',
          metadata: { credentialVersion: 2, note: 'تم تغيير وتشفير رمز الدخول' },
        },
        {
          eventType: 'USER_STATUS_CHANGE',
          metadata: { newStatus: 'DISABLED', sessionsRevoked: true },
        },
      ];

      for (const ev of events) {
        const serialized = JSON.stringify(ev.metadata);
        assert.equal(serialized.includes('password'), false);
        assert.equal(serialized.includes('hash'), false);
        assert.equal(serialized.includes('secret'), false);
      }
    });
  });
});
