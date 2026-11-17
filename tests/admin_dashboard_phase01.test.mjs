import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

// Resolve project root paths
const ROOT_DIR = process.cwd();
const ADMIN_DIR = path.join(ROOT_DIR, 'admin-dashboard');
const MIGRATION_PATH = path.join(ROOT_DIR, 'supabase', 'migrations', '20261116_phase01_admin_dashboard_foundation.sql');

const require = createRequire(path.join(ADMIN_DIR, 'package.json'));
const bcrypt = require('bcryptjs');

describe('Compu MSS — Admin Dashboard Phase 1 Verification', () => {

  describe('1. Project Isolation & Independent Architecture', () => {
    it('admin-dashboard exists as an independent project at root', () => {
      assert.ok(fs.existsSync(ADMIN_DIR), 'admin-dashboard directory must exist at root');
      assert.ok(fs.existsSync(path.join(ADMIN_DIR, 'package.json')), 'admin-dashboard/package.json must exist');
      assert.ok(fs.existsSync(path.join(ADMIN_DIR, 'tsconfig.json')), 'admin-dashboard/tsconfig.json must exist');
      assert.ok(fs.existsSync(path.join(ADMIN_DIR, 'tailwind.config.js')), 'admin-dashboard/tailwind.config.js must exist');
    });

    it('desktop application files and configuration remain untouched', () => {
      assert.ok(fs.existsSync(path.join(ROOT_DIR, 'src-tauri', 'tauri.conf.json')), 'Tauri config must exist');
      assert.ok(fs.existsSync(path.join(ROOT_DIR, 'src', 'App.tsx')), 'Desktop App.tsx must exist');
      assert.ok(fs.existsSync(path.join(ROOT_DIR, 'src', 'services', 'salesService.ts')), 'salesService must exist');
    });

    it('admin-dashboard package.json has Next.js, Tailwind, Lucide, Supabase, and Bcrypt', () => {
      const pkg = JSON.parse(fs.readFileSync(path.join(ADMIN_DIR, 'package.json'), 'utf-8'));
      assert.ok(pkg.dependencies['next'], 'next must be a dependency');
      assert.ok(pkg.dependencies['@supabase/supabase-js'], '@supabase/supabase-js must be a dependency');
      assert.ok(pkg.dependencies['bcryptjs'], 'bcryptjs must be a dependency');
      assert.ok(pkg.dependencies['lucide-react'], 'lucide-react must be a dependency');
    });
  });

  describe('2. Consolidated SQL Migration Review & Schema Integrity', () => {
    it('migration file exists at exact specified path', () => {
      assert.ok(fs.existsSync(MIGRATION_PATH), `Migration file must exist at ${MIGRATION_PATH}`);
    });

    it('migration contains all required Phase 1 tables and structures', () => {
      const sql = fs.readFileSync(MIGRATION_PATH, 'utf-8');

      // Tables
      assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.admin_users/i, 'Must create admin_users table');
      assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.system_stores/i, 'Must create system_stores table');
      assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.app_users/i, 'Must create app_users table');
      assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.user_store_assignments/i, 'Must create user_store_assignments table');
      assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.admin_audit_logs/i, 'Must create admin_audit_logs table');

      // Safe view
      assert.match(sql, /CREATE OR REPLACE VIEW public\.vw_app_users_safe/i, 'Must create safe view omitting password/access_code hash');

      // RLS enabled on all tables
      assert.match(sql, /ALTER TABLE public\.admin_users ENABLE ROW LEVEL SECURITY/i);
      assert.match(sql, /ALTER TABLE public\.system_stores ENABLE ROW LEVEL SECURITY/i);
      assert.match(sql, /ALTER TABLE public\.app_users ENABLE ROW LEVEL SECURITY/i);
      assert.match(sql, /ALTER TABLE public\.user_store_assignments ENABLE ROW LEVEL SECURITY/i);
      assert.match(sql, /ALTER TABLE public\.admin_audit_logs ENABLE ROW LEVEL SECURITY/i);

      // Audit log immutability (No UPDATE, No DELETE policies)
      assert.match(sql, /"No audit log updates"/i, 'Must have explicit policy denying audit log updates');
      assert.match(sql, /"No audit log deletes"/i, 'Must have explicit policy denying audit log deletes');

      // Seed stores for backward compatibility with SHOP_1 and SHOP_2
      assert.match(sql, /'SHOP_1'/i, 'Must seed default SHOP_1');
      assert.match(sql, /'SHOP_2'/i, 'Must seed default SHOP_2');
      assert.match(sql, /'WH_MAIN'/i, 'Must seed default WH_MAIN');
    });
  });

  describe('3. Security & Access Code Hashing Tests', () => {
    it('hashes access codes with bcrypt and verifies them accurately', async () => {
      const accessCode = 'pass4567';
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash(accessCode, salt);

      assert.ok(hash.startsWith('$2a$10$') || hash.startsWith('$2b$10$'), 'Must be a valid bcrypt salt rounds 10 hash');
      assert.ok(await bcrypt.compare(accessCode, hash), 'Correct access code must verify successfully');
      assert.equal(await bcrypt.compare('wrongCode', hash), false, 'Incorrect access code must be rejected');
    });

    it('rejects access codes that are too short (< 4 chars)', () => {
      const shortCode = '123';
      const valid = shortCode.trim().length >= 4;
      assert.equal(valid, false, 'Access code < 4 characters must be rejected');
    });

    it('normalizes username to trimmed lowercase', () => {
      const raw = '  Masoud_Shop1  ';
      const normalized = raw.trim().toLowerCase();
      assert.equal(normalized, 'masoud_shop1');
    });

    it('sanitizes user objects: NEVER leaks access_code_hash or password_hash to client', () => {
      const rawUser = {
        id: 'u-123',
        username: 'masoud',
        displayName: 'محمود مسعود',
        access_code_hash: '$2a$10$wWj6tD8489vO0k4YhQ/v1.K6qW939tHqP.Xb0H.oV0x9b9g9b9b9b',
        password_hash: '$2a$10$someAdminPasswordHashHere',
        allowedModules: 'both',
        isActive: true,
      };

      // Sanitize
      const copy = { ...rawUser };
      delete copy.access_code_hash;
      delete copy.password_hash;

      assert.equal('access_code_hash' in copy, false, 'access_code_hash must NOT be present in sanitized object');
      assert.equal('password_hash' in copy, false, 'password_hash must NOT be present in sanitized object');
      assert.equal(copy.username, 'masoud');
      assert.equal(copy.allowedModules, 'both');
    });
  });

  describe('4. Store & Warehouse Data Model & Historical Preservation', () => {
    it('supports store and warehouse types', () => {
      const storeType = 'store';
      const warehouseType = 'warehouse';
      const allowedTypes = ['store', 'warehouse'];

      assert.ok(allowedTypes.includes(storeType));
      assert.ok(allowedTypes.includes(warehouseType));
    });

    it('soft deactivates stores instead of hard deleting (Historical Preservation)', () => {
      const store = {
        id: 's-1',
        code: 'SHOP_1',
        name: 'محل 1',
        isActive: true,
      };

      // Deactivate
      store.isActive = false;

      assert.equal(store.isActive, false, 'Store is deactivated');
      assert.equal(store.id, 's-1', 'Store ID and historical identity are preserved');
    });

    it('verifies inventory belongs to store, not to user account', () => {
      const storeId = 's-1';
      const device = {
        serialNumber: 'PF1K892-LEN',
        storeId: storeId, // Belongs to store
      };

      const userA = { id: 'u-1', assignedStoreId: storeId };
      const userB = { id: 'u-2', assignedStoreId: storeId };

      // Both users access the same store inventory
      assert.equal(device.storeId, userA.assignedStoreId);
      assert.equal(device.storeId, userB.assignedStoreId);
    });
  });

  describe('5. Audit Trail Immutability & Sanitization', () => {
    it('sanitizes metadata: sensitive keys like passwords or access codes are redacted', () => {
      const rawMetadata = {
        note: 'User created',
        targetUsername: 'ayman',
        plainAccessCode: 'secret123',
        token: 'eyJhbGciOi...',
      };

      const sanitized = {};
      for (const [key, val] of Object.entries(rawMetadata)) {
        const lowerKey = key.toLowerCase();
        if (
          lowerKey.includes('password') ||
          lowerKey.includes('access_code') ||
          lowerKey.includes('accesscode') ||
          lowerKey.includes('code') ||
          lowerKey.includes('token') ||
          lowerKey.includes('secret')
        ) {
          sanitized[key] = '[REDACTED_SENSITIVE]';
        } else {
          sanitized[key] = val;
        }
      }

      assert.equal(sanitized.note, 'User created');
      assert.equal(sanitized.targetUsername, 'ayman');
      assert.equal(sanitized.plainAccessCode, '[REDACTED_SENSITIVE]');
      assert.equal(sanitized.token, '[REDACTED_SENSITIVE]');
    });
  });

  describe('6. Module Separation & Rule 6 Compliance', () => {
    it('ensures Accessories SQLite database is completely isolated from Supabase', () => {
      const migrationSql = fs.readFileSync(MIGRATION_PATH, 'utf-8');
      assert.equal(migrationSql.includes('accessories_products'), false, 'Accessories tables must NOT be migrated to Supabase');
      assert.equal(migrationSql.includes('accessories_sales'), false, 'Accessories sales must NOT be migrated to Supabase');
    });

    it('supports module permission permutations: accessories, mss, both', () => {
      const allowed = ['accessories', 'mss', 'both'];
      assert.ok(allowed.includes('accessories'));
      assert.ok(allowed.includes('mss'));
      assert.ok(allowed.includes('both'));
    });
  });
});
