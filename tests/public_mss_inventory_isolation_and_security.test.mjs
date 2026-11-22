import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT_DIR = process.cwd();
const PUBLIC_APP_DIR = path.join(ROOT_DIR, 'public-mss-inventory');

test('Public MSS Inventory — Architecture, Isolation & Security Suite', async (t) => {
  await t.test('1. Dedicated Folder & Complete File Isolation', () => {
    assert.ok(fs.existsSync(PUBLIC_APP_DIR), 'public-mss-inventory folder must exist');
    assert.ok(fs.existsSync(path.join(PUBLIC_APP_DIR, 'package.json')), 'Must have its own package.json');
    assert.ok(fs.existsSync(path.join(PUBLIC_APP_DIR, 'tsconfig.json')), 'Must have its own tsconfig.json');
    assert.ok(fs.existsSync(path.join(PUBLIC_APP_DIR, 'next.config.mjs')), 'Must have its own next.config.mjs');
    assert.ok(fs.existsSync(path.join(PUBLIC_APP_DIR, 'tailwind.config.ts')), 'Must have its own tailwind.config.ts');
    assert.ok(fs.existsSync(path.join(PUBLIC_APP_DIR, 'postcss.config.mjs')), 'Must have its own postcss.config.mjs');
    assert.ok(fs.existsSync(path.join(PUBLIC_APP_DIR, '.gitignore')), 'Must have its own .gitignore');
    assert.ok(fs.existsSync(path.join(PUBLIC_APP_DIR, '.env.example')), 'Must have its own .env.example');
    assert.ok(fs.existsSync(path.join(PUBLIC_APP_DIR, '.env.local')), 'Must have its own .env.local');
    assert.ok(fs.existsSync(path.join(PUBLIC_APP_DIR, 'README.md')), 'Must have its own README.md');
  });

  await t.test('2. Package.json Independent Identity & Scripts', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(PUBLIC_APP_DIR, 'package.json'), 'utf-8'));
    assert.strictEqual(pkg.name, 'public-mss-inventory');
    assert.ok(pkg.scripts?.dev, 'Must have dev script');
    assert.ok(pkg.scripts?.build, 'Must have build script');
    assert.ok(pkg.scripts?.start, 'Must have start script');
    assert.ok(pkg.dependencies?.['@supabase/supabase-js'], 'Must have @supabase/supabase-js dependency');
    assert.ok(pkg.dependencies?.next, 'Must have next dependency');
    assert.ok(pkg.dependencies?.react, 'Must have react dependency');
    assert.ok(pkg.dependencies?.['lucide-react'], 'Must have lucide-react dependency');
  });

  await t.test('3. Environment & Secret Hygiene — Zero Leakage Guarantee', () => {
    const envExample = fs.readFileSync(path.join(PUBLIC_APP_DIR, '.env.example'), 'utf-8');
    const envLocal = fs.readFileSync(path.join(PUBLIC_APP_DIR, '.env.local'), 'utf-8');
    const envDefault = fs.readFileSync(path.join(PUBLIC_APP_DIR, '.env'), 'utf-8');

    assert.ok(envExample.includes('NEXT_PUBLIC_SUPABASE_URL'), '.env.example must define NEXT_PUBLIC_SUPABASE_URL');
    assert.ok(envExample.includes('NEXT_PUBLIC_SUPABASE_ANON_KEY'), '.env.example must define NEXT_PUBLIC_SUPABASE_ANON_KEY');
    assert.ok(!envExample.includes('eyJhbGciOi'), '.env.example must not contain real JWT secret tokens');
    assert.ok(!envExample.includes('NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ'), '.env.example must use placeholder values only');

    assert.ok(envLocal.includes('NEXT_PUBLIC_SUPABASE_URL='), '.env.local must define NEXT_PUBLIC_SUPABASE_URL');
    assert.ok(envLocal.includes('NEXT_PUBLIC_SUPABASE_ANON_KEY='), '.env.local must define NEXT_PUBLIC_SUPABASE_ANON_KEY');
    assert.ok(envDefault.includes('NEXT_PUBLIC_SUPABASE_URL='), '.env must define NEXT_PUBLIC_SUPABASE_URL');
    assert.ok(envDefault.includes('NEXT_PUBLIC_SUPABASE_ANON_KEY='), '.env must define NEXT_PUBLIC_SUPABASE_ANON_KEY');

    // Never contain privileged secrets
    assert.ok(!envLocal.includes('service_role'), '.env.local must not contain service role credentials');
    assert.ok(!envLocal.includes('ADMIN_SESSION_SECRET'), '.env.local must not contain admin secrets');
    assert.ok(!envLocal.includes('INITIAL_SUPER_ADMIN_PASSWORD'), '.env.local must not contain user passwords');

    assert.ok(!envDefault.includes('service_role'), '.env must not contain service role credentials');
    assert.ok(!envDefault.includes('ADMIN_SESSION_SECRET'), '.env must not contain admin secrets');
    assert.ok(!envDefault.includes('INITIAL_SUPER_ADMIN_PASSWORD'), '.env must not contain user passwords');

    const gitignore = fs.readFileSync(path.join(PUBLIC_APP_DIR, '.gitignore'), 'utf-8');
    assert.ok(gitignore.includes('.env'), '.gitignore must ignore .env');
    assert.ok(gitignore.includes('.env*.local') || gitignore.includes('.env.local'), '.gitignore must ignore .env.local');
    assert.ok(gitignore.includes('node_modules'), '.gitignore must ignore node_modules');
    assert.ok(gitignore.includes('.next'), '.gitignore must ignore .next');
  });

  await t.test('4. Security & Public Data Exposure Restrictions', () => {
    const serviceCode = fs.readFileSync(path.join(PUBLIC_APP_DIR, 'src', 'services', 'publicInventoryService.ts'), 'utf-8');
    const supabaseCode = fs.readFileSync(path.join(PUBLIC_APP_DIR, 'src', 'lib', 'supabase.ts'), 'utf-8');

    // Supabase client only uses ANON key
    assert.ok(!supabaseCode.includes('SUPABASE_SERVICE_ROLE_KEY'), 'Must not reference service role key');

    // Queries must never select confidential fields
    assert.ok(!serviceCode.includes('purchase_cost'), 'Must NEVER query purchase_cost');
    assert.ok(!serviceCode.includes('profit'), 'Must NEVER query profit');
    assert.ok(!serviceCode.includes('customer'), 'Must NEVER query customer tables');
    assert.ok(!serviceCode.includes('audit'), 'Must NEVER query audit logs');
    assert.ok(!serviceCode.includes('app_users'), 'Must NEVER query app_users');
  });

  await t.test('5. Complete Removal of Mock and Fallback Data', () => {
    const serviceCode = fs.readFileSync(path.join(PUBLIC_APP_DIR, 'src', 'services', 'publicInventoryService.ts'), 'utf-8');
    const pageCode = fs.readFileSync(path.join(PUBLIC_APP_DIR, 'src', 'app', 'page.tsx'), 'utf-8');

    assert.ok(!serviceCode.includes('DEMO_FALLBACK_ITEMS'), 'Must not contain DEMO_FALLBACK_ITEMS');
    assert.ok(!serviceCode.includes('demo-1'), 'Must not contain mock device IDs');
    assert.ok(!serviceCode.includes('isFallback'), 'Must not contain fallback mode state');
    assert.ok(!pageCode.includes('isFallbackMode'), 'Page must not have fallback mode banner or mock data');
  });

  await t.test('6. Dynamic Branches & Status Filter Support', () => {
    const serviceCode = fs.readFileSync(path.join(PUBLIC_APP_DIR, 'src', 'services', 'publicInventoryService.ts'), 'utf-8');
    const pageCode = fs.readFileSync(path.join(PUBLIC_APP_DIR, 'src', 'app', 'page.tsx'), 'utf-8');
    const filterCode = fs.readFileSync(path.join(PUBLIC_APP_DIR, 'src', 'components', 'SearchAndFilters.tsx'), 'utf-8');

    // Dynamic branch retrieval from system_stores
    assert.ok(serviceCode.includes('system_stores'), 'Must query dynamic stores from system_stores');
    assert.ok(serviceCode.includes('fetchDynamicBranches'), 'Must have fetchDynamicBranches function');

    // Status filter options: AVAILABLE, RESERVED, SOLD, ALL
    assert.ok(filterCode.includes('AVAILABLE'), 'Must support AVAILABLE status');
    assert.ok(filterCode.includes('RESERVED'), 'Must support RESERVED status');
    assert.ok(filterCode.includes('SOLD'), 'Must support SOLD status');
    assert.ok(filterCode.includes('ALL'), 'Must support ALL status');
    assert.ok(pageCode.includes("selectedStatus: 'AVAILABLE'"), 'Default status must be AVAILABLE');
  });

  await t.test('7. Light Mode Theme Matching MSS System Exactly', () => {
    const globalsCss = fs.readFileSync(path.join(PUBLIC_APP_DIR, 'src', 'app', 'globals.css'), 'utf-8');
    const layoutCode = fs.readFileSync(path.join(PUBLIC_APP_DIR, 'src', 'app', 'layout.tsx'), 'utf-8');

    assert.ok(globalsCss.includes('color-scheme: light'), 'Must enforce color-scheme: light');
    assert.ok(globalsCss.includes('#f8fafc'), 'Body background must be #f8fafc (slate-50)');
    assert.ok(globalsCss.includes('#0f172a'), 'Body text color must be #0f172a (slate-900)');
    assert.ok(!layoutCode.includes('bg-[#0C0E12]'), 'Must not use dark background #0C0E12');
    assert.ok(layoutCode.includes('bg-slate-50'), 'Layout must use bg-slate-50');
  });

  await t.test('8. Consolidated SQL Migration Review & Schema Integrity', () => {
    const migrationPath = path.join(ROOT_DIR, 'supabase', 'migrations', '20261122_public_mss_inventory_view.sql');
    assert.ok(fs.existsSync(migrationPath), 'SQL migration file must exist');

    const migrationContent = fs.readFileSync(migrationPath, 'utf-8');
    assert.ok(migrationContent.includes('vw_public_mss_inventory'), 'Must define vw_public_mss_inventory view');
    assert.ok(migrationContent.includes('get_public_mss_inventory'), 'Must define get_public_mss_inventory RPC function');
    assert.ok(migrationContent.includes('GRANT SELECT ON public.vw_public_mss_inventory TO anon, authenticated'), 'Must grant select to anon');
    assert.ok(migrationContent.includes('GRANT SELECT ON public.system_stores TO anon, authenticated'), 'Must grant select on system_stores');
    assert.ok(migrationContent.includes("d.status IN ('AVAILABLE', 'RESERVED', 'SOLD')"), 'Must support AVAILABLE, RESERVED, SOLD');
    assert.ok(!migrationContent.match(/SELECT[\s\S]*?\bpurchase_cost\b[\s\S]*?FROM\s+public\.mss_devices/i), 'View query must not select purchase_cost');
    assert.ok(!migrationContent.match(/SELECT[\s\S]*?\bserial_number\b[\s\S]*?FROM\s+public\.mss_devices/i), 'View query must not select serial_number');
  });

  await t.test('9. Complete Accessories Module Isolation (Rule 6)', () => {
    const pageCode = fs.readFileSync(path.join(PUBLIC_APP_DIR, 'src', 'app', 'page.tsx'), 'utf-8');
    assert.ok(!pageCode.includes('accessories'), 'Public MSS page must not import or reference accessories');
    assert.ok(!pageCode.includes('accessory'), 'Public MSS page must not import or reference accessories');
  });

  await t.test('10. Public MSS Inventory Footer Matches Main MSS System Exactly', () => {
    const mainFooterCode = fs.readFileSync(path.join(ROOT_DIR, 'src', 'components', 'layout', 'AppFooter.tsx'), 'utf-8');
    const publicFooterCode = fs.readFileSync(path.join(PUBLIC_APP_DIR, 'src', 'components', 'Footer.tsx'), 'utf-8');
    const publicModalCode = fs.readFileSync(path.join(PUBLIC_APP_DIR, 'src', 'components', 'ContactModal.tsx'), 'utf-8');
    const layoutCode = fs.readFileSync(path.join(PUBLIC_APP_DIR, 'src', 'app', 'layout.tsx'), 'utf-8');

    // Layout imports and renders Footer
    assert.ok(layoutCode.includes("import { Footer } from '../components/Footer';"), 'Layout must import Footer');
    assert.ok(layoutCode.includes('<Footer />'), 'Layout must render Footer');

    // Exact copyright text matching main system
    assert.ok(publicFooterCode.includes('© 2026 Ahmed Saber. All rights reserved.'), 'Footer must contain exact copyright text');
    assert.ok(publicFooterCode.includes('01030137635'), 'Footer must contain exact phone number');
    assert.ok(publicFooterCode.includes('Contact:'), 'Footer must contain Contact label');
    assert.ok(!publicFooterCode.includes('href="tel:'), 'Footer must not use raw tel: link');

    // Styling matches main system light mode
    assert.ok(publicFooterCode.includes('bg-white'), 'Footer must be bg-white');
    assert.ok(publicFooterCode.includes('border-t border-slate-200/90'), 'Footer border must match main system');
    assert.ok(publicFooterCode.includes('text-slate-500'), 'Footer text color must match');
    assert.ok(publicFooterCode.includes('font-mono'), 'Phone number must use font-mono');

    // Contact modal fidelity & AS System branding
    assert.ok(publicModalCode.includes('Ahmed Saber'), 'Modal must contain owner name Ahmed Saber');
    assert.ok(publicModalCode.includes('01030137635'), 'Modal must contain phone number 01030137635');
    assert.ok(publicModalCode.includes('Founder of AS System'), 'Modal must contain Founder of AS System title');
    assert.ok(publicModalCode.includes('/as_logo_gold.png'), 'Modal must use official AS System gold logo symbol');
    assert.ok(publicModalCode.includes('© 2026 Ahmed Saber. All rights reserved.'), 'Modal must contain copyright notice');
  });
});
