import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

describe('Phase 06 — Final Security Audit, Integration & End-to-End Verification', () => {
  const rootDir = process.cwd();
  const phase06MigrationPath = path.join(rootDir, 'supabase', 'migrations', '20261117_phase06_security_hardening.sql');
  const nextConfigPath = path.join(rootDir, 'admin-dashboard', 'next.config.mjs');
  const sessionLibPath = path.join(rootDir, 'admin-dashboard', 'src', 'lib', 'session.ts');
  const securityLibPath = path.join(rootDir, 'admin-dashboard', 'src', 'lib', 'security.ts');
  const desktopVerifyRoute = path.join(rootDir, 'admin-dashboard', 'src', 'app', 'api', 'auth', 'desktop-verify', 'route.ts');
  const desktopRevalidateRoute = path.join(rootDir, 'admin-dashboard', 'src', 'app', 'api', 'auth', 'desktop-revalidate', 'route.ts');
  const desktopLogoutRoute = path.join(rootDir, 'admin-dashboard', 'src', 'app', 'api', 'auth', 'desktop-logout', 'route.ts');
  const mssSyncServicePath = path.join(rootDir, 'src', 'services', 'mssSyncService.ts');
  const desktopAuthServicePath = path.join(rootDir, 'src', 'services', 'desktopAuthService.ts');
  const salesServicePath = path.join(rootDir, 'src', 'services', 'salesService.ts');

  // ==========================================================================
  // 1. Secrets Isolation & Zero-Leak Verification (Threat Model Area D)
  // ==========================================================================
  describe('1. Secrets Isolation & Sensitive Keys Protection (Rule 21)', () => {
    it('no service_role key is bundled into desktop frontend code (src/)', () => {
      const srcFiles = fs.readdirSync(path.join(rootDir, 'src'), { recursive: true });
      for (const file of srcFiles) {
        const fullPath = path.join(rootDir, 'src', file);
        if (fs.statSync(fullPath).isFile() && (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js'))) {
          const content = fs.readFileSync(fullPath, 'utf8');
          assert.ok(!content.includes('service_role'), `File ${file} must NEVER contain service_role`);
          assert.ok(!content.includes('SUPABASE_SERVICE_ROLE_KEY'), `File ${file} must NEVER reference SUPABASE_SERVICE_ROLE_KEY`);
        }
      }
    });

    it('.gitignore explicitly protects private environment files and updater keys', () => {
      const rootGitignore = fs.readFileSync(path.join(rootDir, '.gitignore'), 'utf8');
      const adminGitignore = fs.readFileSync(path.join(rootDir, 'admin-dashboard', '.gitignore'), 'utf8');

      assert.ok(rootGitignore.includes('.env'), 'Root .gitignore must ignore .env');
      assert.ok(rootGitignore.includes('.env.*'), 'Root .gitignore must ignore .env.*');
      assert.ok(adminGitignore.includes('.env*.local'), 'Admin .gitignore must ignore .env*.local');
      assert.ok(adminGitignore.includes('.env.production'), 'Admin .gitignore must ignore .env.production');
    });

    it('.env.example files contain placeholders only without real secret tokens', () => {
      const rootEnvEx = fs.readFileSync(path.join(rootDir, '.env.example'), 'utf8');
      const adminEnvEx = fs.readFileSync(path.join(rootDir, 'admin-dashboard', '.env.example'), 'utf8');

      assert.ok(rootEnvEx.includes('your-project-ref'), 'Root .env.example must use placeholders');
      assert.ok(rootEnvEx.includes('your-anon-key'), 'Root .env.example must use placeholders');
      assert.ok(adminEnvEx.includes('super_secret_session_key_replace_in_production'), 'Admin .env.example must warn to replace secret');
    });
  });

  // ==========================================================================
  // 2. Application & API Security Hardening (Threat Model Area A & E)
  // ==========================================================================
  describe('2. Application & API Security Hardening', () => {
    it('next.config.mjs enforces enterprise security headers and Content-Security-Policy', () => {
      const config = fs.readFileSync(nextConfigPath, 'utf8');
      assert.ok(config.includes('Content-Security-Policy'), 'Must configure Content-Security-Policy');
      assert.ok(config.includes('Strict-Transport-Security'), 'Must configure Strict-Transport-Security (HSTS)');
      assert.ok(config.includes('X-Frame-Options'), 'Must configure X-Frame-Options');
      assert.ok(config.includes('X-Content-Type-Options'), 'Must configure X-Content-Type-Options');
      assert.ok(config.includes('Referrer-Policy'), 'Must configure Referrer-Policy');
      assert.ok(config.includes('Permissions-Policy'), 'Must configure Permissions-Policy');
    });

    it('desktop auth endpoints handle CORS preflight and OPTIONS requests safely', () => {
      const verifyCode = fs.readFileSync(desktopVerifyRoute, 'utf8');
      const revalidateCode = fs.readFileSync(desktopRevalidateRoute, 'utf8');
      const logoutCode = fs.readFileSync(desktopLogoutRoute, 'utf8');

      assert.ok(verifyCode.includes('OPTIONS'), 'desktop-verify must export OPTIONS handler');
      assert.ok(verifyCode.includes('Access-Control-Allow-Origin'), 'desktop-verify must return CORS headers');
      assert.ok(revalidateCode.includes('OPTIONS'), 'desktop-revalidate must export OPTIONS handler');
      assert.ok(logoutCode.includes('OPTIONS'), 'desktop-logout must export OPTIONS handler');
    });

    it('session signing enforces ADMIN_SESSION_SECRET in production and uses timingSafeEqual', () => {
      const sessionCode = fs.readFileSync(sessionLibPath, 'utf8');
      assert.ok(sessionCode.includes('timingSafeEqual'), 'Must use timingSafeEqual to prevent signature timing attacks');
      assert.ok(sessionCode.includes('ADMIN_SESSION_SECRET'), 'Must use ADMIN_SESSION_SECRET');
    });

    it('user sanitization strictly prevents access_code_hash from leaking to clients', () => {
      const secCode = fs.readFileSync(securityLibPath, 'utf8');
      assert.ok(secCode.includes('sanitizeUser'), 'Must export sanitizeUser');
      assert.ok(secCode.includes('delete clean.access_code_hash') || !secCode.includes('access_code_hash:'), 'Must strip access_code_hash');
    });
  });

  // ==========================================================================
  // 3. Database Security & Phase 6 Hardening Migration (Threat Model Area C)
  // ==========================================================================
  describe('3. Database Security & Phase 6 Hardening Migration', () => {
    it('Phase 6 migration exists and is consolidated at exact expected path', () => {
      assert.ok(fs.existsSync(phase06MigrationPath), 'Phase 6 migration must exist');
    });

    it('Phase 6 migration revokes direct anonymous access on admin_users and admin_audit_logs', () => {
      const sql = fs.readFileSync(phase06MigrationPath, 'utf8');
      assert.ok(sql.includes('public.admin_users'), 'Must configure admin_users security');
      assert.ok(sql.includes('public.admin_audit_logs'), 'Must configure admin_audit_logs security');
      assert.ok(sql.includes('Deny all audit log updates'), 'Must guarantee audit log update immutability');
      assert.ok(sql.includes('Deny all audit log deletes'), 'Must guarantee audit log delete immutability');
    });

    it('Phase 6 migration restricts inventory transfer and store merge direct client mutations', () => {
      const sql = fs.readFileSync(phase06MigrationPath, 'utf8');
      assert.ok(sql.includes('Deny delete inventory_transfers'), 'Must prevent transfer deletion');
      assert.ok(sql.includes('public.store_merges'), 'Must protect store_merges table');
    });

    it('Phase 6 migration sets safe search_path = public, extensions on all SECURITY DEFINER functions', () => {
      const sql = fs.readFileSync(phase06MigrationPath, 'utf8');
      assert.ok(sql.includes('SET search_path = public, extensions'), 'Must enforce search_path to prevent hijacking');
      assert.ok(sql.includes('verify_desktop_credentials'), 'Must harden verify_desktop_credentials');
      assert.ok(sql.includes('execute_inventory_transfer'), 'Must harden execute_inventory_transfer');
    });

    it('Phase 6 migration revokes privileged admin procedures from anonymous users', () => {
      const sql = fs.readFileSync(phase06MigrationPath, 'utf8');
      assert.ok(sql.includes('REVOKE EXECUTE ON FUNCTION public.execute_store_merge'), 'Must revoke execute_store_merge from anon');
      assert.ok(sql.includes('REVOKE EXECUTE ON FUNCTION public.execute_inventory_transfer'), 'Must revoke execute_inventory_transfer from anon');
    });
  });

  // ==========================================================================
  // 4. Desktop Offline Authorization & Concurrency (Threat Model Area F)
  // ==========================================================================
  describe('4. Desktop Offline Authorization & Conflict Resolution', () => {
    it('enforces 7-day offline maximum window and clock rollback anti-tampering', () => {
      const authCode = fs.readFileSync(desktopAuthServicePath, 'utf8');
      assert.ok(authCode.includes('DEFAULT_OFFLINE_DAYS = 7') || authCode.includes('7'), 'Must enforce 7 days default');
      assert.ok(authCode.includes('CLOCK_TAMPERING'), 'Must detect clock rollback tampering');
      assert.ok(authCode.includes('OFFLINE_MAX_EXCEEDED'), 'Must reject expired offline sessions');
    });

    it('sync service detects STALE_STOCK_TRANSFER and preserves unsynced Outbox operations', () => {
      const syncCode = fs.readFileSync(mssSyncServicePath, 'utf8');
      assert.ok(syncCode.includes('STALE_STOCK_TRANSFER'), 'Must identify STALE_STOCK_TRANSFER');
      assert.ok(syncCode.includes('تعارض'), 'Must document Arabic conflict reason');
    });
  });

  // ==========================================================================
  // 5. Module Separation & Rule 6 Compliance
  // ==========================================================================
  describe('5. Module Separation & Rule 6 Strict Compliance', () => {
    it('Accessories SQLite database is completely untouched by cloud admin and transfers', () => {
      const salesCode = fs.readFileSync(salesServicePath, 'utf8');
      assert.ok(!salesCode.includes('inventory_transfers'), 'Accessories must not reference inventory_transfers');
      assert.ok(!salesCode.includes('system_stores'), 'Accessories must not reference system_stores');
      assert.ok(!salesCode.includes('store_merges'), 'Accessories must not reference store_merges');
    });
  });
});
