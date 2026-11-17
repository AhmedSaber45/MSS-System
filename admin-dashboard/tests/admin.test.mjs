import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import {
  normalizeUsername,
  validateUsername,
  validateAccessCode,
  hashAccessCode,
  verifyAccessCode,
  sanitizeUser,
  checkRateLimit,
  recordFailedAttempt,
  clearRateLimit,
} from '../src/lib/security.ts';

describe('Admin Dashboard Unit & Security Tests', () => {
  describe('Username Normalization & Validation', () => {
    it('normalizes username to trimmed lowercase', () => {
      assert.equal(normalizeUsername('  Ahmad_Saber  '), 'ahmad_saber');
      assert.equal(normalizeUsername('Shop1_Masoud'), 'shop1_masoud');
    });

    it('validates username length >= 3 and valid characters', () => {
      assert.equal(validateUsername('ab').valid, false);
      assert.equal(validateUsername('valid_user').valid, true);
      assert.equal(validateUsername('مستخدم_1').valid, true);
      assert.equal(validateUsername('').valid, false);
    });
  });

  describe('Access Code Security & Hashing', () => {
    it('validates access code length >= 4', () => {
      assert.equal(validateAccessCode('123').valid, false);
      assert.equal(validateAccessCode('1234').valid, true);
      assert.equal(validateAccessCode('pass2026').valid, true);
    });

    it('hashes and verifies access codes accurately using bcrypt', async () => {
      const code = 'shopPass2026';
      const hash = await hashAccessCode(code);
      assert.ok(hash.startsWith('$2a$') || hash.startsWith('$2b$'));
      const isValid = await verifyAccessCode(code, hash);
      assert.equal(isValid, true);
      const isInvalid = await verifyAccessCode('wrongPass', hash);
      assert.equal(isInvalid, false);
    });

    it('sanitizes user objects: NEVER leaks hashes to frontend', () => {
      const user = {
        id: 'u-1',
        username: 'masoud',
        displayName: 'محمود مسعود',
        access_code_hash: '$2a$10$xyz...',
        password_hash: '$2a$10$abc...',
        allowedModules: 'both',
      };

      const sanitized = sanitizeUser(user);
      assert.equal('access_code_hash' in sanitized, false);
      assert.equal('password_hash' in sanitized, false);
      assert.equal(sanitized.username, 'masoud');
    });
  });

  describe('Rate Limiting & Brute Force Protection', () => {
    it('allows attempts initially and locks after max failed attempts', () => {
      const key = 'test_admin_rate_limit';
      clearRateLimit(key);

      assert.equal(checkRateLimit(key).allowed, true);
      for (let i = 0; i < 5; i++) {
        recordFailedAttempt(key);
      }

      const check = checkRateLimit(key);
      assert.equal(check.allowed, false);
      assert.ok(check.remainingMs && check.remainingMs > 0);

      clearRateLimit(key);
      assert.equal(checkRateLimit(key).allowed, true);
    });
  });
});
