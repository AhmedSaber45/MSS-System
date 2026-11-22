import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';

test('Single Super Admin and Admin Dashboard Redesign Security Suite', async (t) => {
  await t.test('1. Environment variable configuration in .env.local', () => {
    const envLocalPath = path.resolve('admin-dashboard/.env.local');
    assert.ok(fs.existsSync(envLocalPath), '.env.local must exist in admin-dashboard');
    const content = fs.readFileSync(envLocalPath, 'utf8');
    assert.match(content, /INITIAL_SUPER_ADMIN_USERNAME\s*=\s*saberadmin/, 'Must configure saberadmin as username');
    assert.match(content, /INITIAL_SUPER_ADMIN_PASSWORD\s*=\s*123456@asd/, 'Must configure initial password');
  });

  await t.test('2. No hardcoded passwords in client-facing LoginPage.tsx', () => {
    const loginPath = path.resolve('admin-dashboard/src/app/login/page.tsx');
    const content = fs.readFileSync(loginPath, 'utf8');
    assert.doesNotMatch(content, /adminMSS@2026/, 'LoginPage must not contain legacy adminMSS@2026 password');
    assert.doesNotMatch(content, /123456@asd/, 'LoginPage must not contain hardcoded 123456@asd password');
    assert.doesNotMatch(content, /handleQuickLogin/, 'LoginPage must not contain 1-click quick login bypass');
  });

  await t.test('3. No hardcoded password fallback in adminService.ts', () => {
    const servicePath = path.resolve('admin-dashboard/src/services/adminService.ts');
    const content = fs.readFileSync(servicePath, 'utf8');
    assert.doesNotMatch(content, /adminMSS@2026/, 'adminService must not contain hardcoded adminMSS fallback');
    assert.match(content, /INITIAL_SUPER_ADMIN_USERNAME/, 'adminService must support INITIAL_SUPER_ADMIN_USERNAME');
    assert.match(content, /INITIAL_SUPER_ADMIN_PASSWORD/, 'adminService must support INITIAL_SUPER_ADMIN_PASSWORD');
  });

  await t.test('4. SQL bootstrap file provisions saberadmin as single Super Admin', () => {
    const sqlPath = path.resolve('supabase/production_superadmin_bootstrap.sql');
    assert.ok(fs.existsSync(sqlPath), 'Bootstrap SQL must exist');
    const content = fs.readFileSync(sqlPath, 'utf8');
    assert.match(content, /v_username TEXT := 'saberadmin';/, 'Bootstrap SQL must use saberadmin');
    assert.match(content, /v_password_plain TEXT := '123456@asd';/, 'Bootstrap SQL must use 123456@asd');
    assert.match(content, /UPDATE public\.admin_users[\s\S]*SET is_active = false[\s\S]*WHERE username != v_username/, 'Must deactivate legacy superadmins');
  });

  await t.test('5. Automated authentication flow verification with saberadmin', async () => {
    // Set environment variables dynamically as Next.js does
    process.env.INITIAL_SUPER_ADMIN_USERNAME = 'saberadmin';
    process.env.INITIAL_SUPER_ADMIN_PASSWORD = '123456@asd';

    // Import adminService dynamically
    const adminServiceModule = await import('../admin-dashboard/src/services/adminService.ts');
    const adminService = adminServiceModule.adminService;

    // Test correct credentials
    const admin = await adminService.authenticateAdmin('saberadmin', '123456@asd');
    assert.ok(admin, 'Authentication must succeed with valid saberadmin credentials');
    assert.equal(admin.username, 'saberadmin');
    assert.equal(admin.role, 'superadmin');
    assert.equal(admin.isActive, true);

    // Test case-insensitivity on username
    const adminUpper = await adminService.authenticateAdmin('SABERADMIN', '123456@asd');
    assert.ok(adminUpper, 'Username should be case-insensitive');

    // Test invalid password
    const invalidPass = await adminService.authenticateAdmin('saberadmin', 'WrongPass123!');
    assert.equal(invalidPass, null, 'Must reject incorrect password');

    // Test non-existent user
    const unknownUser = await adminService.authenticateAdmin('random_user_999', '123456@asd');
    assert.equal(unknownUser, null, 'Must reject unknown user');
  });

  await t.test('6. Git ignore protects environment secrets', () => {
    const gitignoreRoot = fs.readFileSync('.gitignore', 'utf8');
    assert.match(gitignoreRoot, /\.env/, '.gitignore must ignore .env files');
    const gitignoreAdmin = fs.readFileSync('admin-dashboard/.gitignore', 'utf8');
    assert.match(gitignoreAdmin, /\.env\*\.local/, 'admin-dashboard/.gitignore must ignore .env*.local');
  });
});
