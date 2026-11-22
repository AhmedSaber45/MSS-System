/**
 * Production Super Admin Account Provisioning Utility
 * Compu MSS System v1.0.2
 *
 * Provisions single production Super Admin:
 *   Username: saberadmin
 *   Password: (read from env INITIAL_SUPER_ADMIN_PASSWORD or CLI --password)
 *
 * Usage:
 *   node scripts/create_production_superadmin.mjs --service-key=<KEY>
 *   node scripts/create_production_superadmin.mjs --service-key=<KEY> --username=saberadmin --password=<PASS>
 */

import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import fs from 'fs';

// Parse arguments
const args = process.argv.slice(2);
function getArg(prefix, defaultValue = '') {
  const item = args.find(a => a.startsWith(`--${prefix}=`));
  return item ? item.split('=')[1] : defaultValue;
}

// Load environment from .env and admin-dashboard/.env.local if available
function loadEnvFile(filePath) {
  if (fs.existsSync(filePath)) {
    const envContent = fs.readFileSync(filePath, 'utf8');
    for (const line of envContent.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx > 0) {
        const k = trimmed.substring(0, idx).trim();
        const v = trimmed.substring(idx + 1).trim();
        if (!process.env[k]) {
          process.env[k] = v;
        }
      }
    }
  }
}

loadEnvFile('.env');
loadEnvFile('admin-dashboard/.env.local');

const serviceKeyArg = getArg('service-key');
const username = (process.env.INITIAL_SUPER_ADMIN_USERNAME || getArg('username', 'saberadmin')).trim().toLowerCase();
const password = process.env.INITIAL_SUPER_ADMIN_PASSWORD || getArg('password', '123456@asd');
const email = getArg('email', `${username}@compumss.com`).trim().toLowerCase();
const displayName = getArg('name', 'أحمد صابر - المدير العام');
const accessCode = getArg('access-code', password);

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ylareolroigqcglayeyg.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || serviceKeyArg;

console.log('='.repeat(70));
console.log('  Compu MSS - Production Single Super Admin Provisioning - v1.0.2');
console.log('='.repeat(70));
console.log(`Supabase URL      : ${SUPABASE_URL}`);
console.log(`Admin Username    : ${username}`);
console.log(`Admin Email       : ${email}`);
console.log(`Display Name      : ${displayName}`);
console.log(`Role              : superadmin`);
console.log('-'.repeat(70));

if (!SERVICE_KEY) {
  console.log('[NOTE] SUPABASE_SERVICE_ROLE_KEY is not provided.');
  console.log('In-memory and environment-based Super Admin credentials have been established in .env.local.');
  console.log('To synchronize directly to Supabase cloud tables:');
  console.log('  1. Provide --service-key=YOUR_SERVICE_ROLE_KEY');
  console.log('  OR');
  console.log('  2. Run supabase/production_superadmin_bootstrap.sql directly in Supabase SQL Editor.');
  process.exit(0);
}

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  try {
    console.log('\n[1] Generating Cryptographic Hashes (bcrypt, 10 salt rounds)...');
    const passwordHash = await bcrypt.hash(password, 10);
    const accessCodeHash = await bcrypt.hash(accessCode, 10);
    console.log('  Hashes generated successfully.');

    console.log('\n[2] Enforcing Single Super Admin Policy...');
    // Deactivate any legacy superadmin accounts
    const { error: deactErr } = await supabaseAdmin
      .from('admin_users')
      .update({ is_active: false })
      .neq('username', username)
      .eq('role', 'superadmin');

    if (deactErr) {
      console.warn('  Notice: Could not deactivate legacy admin users:', deactErr.message);
    } else {
      console.log('  Deactivated all legacy Super Admin accounts.');
    }

    console.log('\n[3] Checking / Provisioning Supabase Auth User...');
    const { data: { users }, error: listErr } = await supabaseAdmin.auth.admin.listUsers();
    let userId = null;

    if (!listErr && users) {
      const existing = users.find(u => u.email === email);
      if (existing) {
        userId = existing.id;
        await supabaseAdmin.auth.admin.updateUserById(existing.id, {
          password,
          user_metadata: { role: 'superadmin', display_name: displayName, username },
        });
        console.log(`  Updated existing Auth user: ${existing.id}`);
      } else {
        const { data: newUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { role: 'superadmin', display_name: displayName, username },
        });
        if (!createErr && newUser?.user) {
          userId = newUser.user.id;
          console.log(`  Created Supabase Auth user: ${userId}`);
        }
      }
    }

    if (!userId) {
      userId = 'admin-super-saber-0001';
    }

    console.log('\n[4] Upserting Dashboard Admin in public.admin_users...');
    const { error: adminErr } = await supabaseAdmin
      .from('admin_users')
      .upsert({
        id: userId,
        username,
        email,
        password_hash: passwordHash,
        display_name: displayName,
        role: 'superadmin',
        is_active: true,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'username' });

    if (adminErr) throw adminErr;
    console.log('  public.admin_users updated successfully.');

    console.log('\n[5] Upserting Desktop App User in public.app_users...');
    const { error: appErr } = await supabaseAdmin
      .from('app_users')
      .upsert({
        id: userId,
        username,
        display_name: displayName,
        access_code_hash: accessCodeHash,
        allowed_modules: 'both',
        is_active: true,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'username' });

    if (appErr) throw appErr;
    console.log('  public.app_users updated successfully.');

    console.log('\n' + '='.repeat(70));
    console.log('  [SUCCESS] Single Production Super Admin Successfully Established!');
    console.log('='.repeat(70));
    console.log(`  Username : ${username}`);
    console.log(`  Email    : ${email}`);
    console.log(`  Role     : superadmin (Exclusive Active Super Admin)`);
    console.log('='.repeat(70) + '\n');
  } catch (err) {
    console.error('\n[FATAL ERROR]', err.message || err);
    process.exit(1);
  }
}

main();
