/**
 * Supabase Auth Users Production Cleanup Utility
 * Compu MSS System v1.0.2
 *
 * Usage:
 *   node scripts/supabase_auth_cleanup.mjs --service-key=<YOUR_SERVICE_ROLE_KEY>
 *   node scripts/supabase_auth_cleanup.mjs --service-key=<YOUR_SERVICE_ROLE_KEY> --execute
 *
 * Or set environment variable:
 *   set SUPABASE_SERVICE_ROLE_KEY=<YOUR_SERVICE_ROLE_KEY>
 *   node scripts/supabase_auth_cleanup.mjs [--execute]
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Parse CLI flags
const args = process.argv.slice(2);
const isExecute = args.includes('--execute');
const serviceKeyArg = args.find(a => a.startsWith('--service-key='))?.split('=')[1];

// Load from .env if present
let envUrl = process.env.VITE_SUPABASE_URL;
let envKey = process.env.SUPABASE_SERVICE_ROLE_KEY || serviceKeyArg;

if (fs.existsSync('.env')) {
  const envContent = fs.readFileSync('.env', 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('VITE_SUPABASE_URL=') && !envUrl) {
      envUrl = trimmed.replace('VITE_SUPABASE_URL=', '').trim();
    }
    if (trimmed.startsWith('SUPABASE_SERVICE_ROLE_KEY=') && !envKey) {
      envKey = trimmed.replace('SUPABASE_SERVICE_ROLE_KEY=', '').trim();
    }
  }
}

const SUPABASE_URL = envUrl || 'https://ylareolroigqcglayeyg.supabase.co';
const SERVICE_KEY = envKey;

console.log('='.repeat(70));
console.log('  Supabase Auth Production Users Cleanup Utility - v1.0.2');
console.log('='.repeat(70));
console.log(`Supabase URL   : ${SUPABASE_URL}`);
console.log(`Execution Mode : ${isExecute ? 'LIVE EXECUTION (Destructive Deletion)' : 'AUDIT / DRY-RUN ONLY'}`);
console.log('-'.repeat(70));

if (!SERVICE_KEY) {
  console.error('\n[ERROR] Missing Supabase Service Role Key (SUPABASE_SERVICE_ROLE_KEY).');
  console.log('\nTo retrieve your Service Role Key:');
  console.log('  1. Navigate to: https://supabase.com/dashboard/project/ylareolroigqcglayeyg/settings/api');
  console.log('  2. Under "Project API keys", copy the "service_role" secret key.');
  console.log('  3. Run the script with:');
  console.log('     node scripts/supabase_auth_cleanup.mjs --service-key=YOUR_SERVICE_ROLE_KEY [--execute]\n');
  process.exit(1);
}

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function main() {
  try {
    console.log('\n[1] Fetching registered users from Supabase Auth...');
    const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });

    if (error) {
      throw error;
    }

    console.log(`Total Auth Users Found: ${users.length}\n`);

    if (users.length === 0) {
      console.log('[INFO] No users found in Supabase Auth. The user directory is already empty.');
      process.exit(0);
    }

    // List users
    console.log('Registered Users:');
    users.forEach((u, i) => {
      console.log(`  ${String(i + 1).padStart(3)}. ID: ${u.id} | Email: ${u.email.padEnd(30)} | Created: ${u.created_at}`);
    });

    if (!isExecute) {
      console.log('\n[NOTICE] Dry-run completed. No users were deleted.');
      console.log('To permanently delete all development/test users from Supabase Auth, run:');
      console.log(`  node scripts/supabase_auth_cleanup.mjs --service-key=${SERVICE_KEY.substring(0, 10)}... --execute\n`);
      process.exit(0);
    }

    // Execution mode
    console.log('\n[2] Executing User Deletion...');
    let deletedCount = 0;
    let failedCount = 0;

    for (const u of users) {
      process.stdout.write(`  Deleting ${u.email} (${u.id})... `);
      const { error: delError } = await supabaseAdmin.auth.admin.deleteUser(u.id);
      if (delError) {
        console.log(`FAILED: ${delError.message}`);
        failedCount++;
      } else {
        console.log('OK');
        deletedCount++;
      }
    }

    console.log('\n' + '-'.repeat(70));
    console.log(`Deletion Summary:`);
    console.log(`  - Successfully deleted : ${deletedCount} users`);
    console.log(`  - Failed to delete     : ${failedCount} users`);

    if (failedCount === 0) {
      console.log('\n[SUCCESS] Supabase Auth directory is completely clean and ready for production!');
      console.log('Next step: Bootstrap your production Super Admin account:');
      console.log('  node scripts/create_production_superadmin.mjs --service-key=YOUR_SERVICE_ROLE_KEY');
    }
  } catch (err) {
    console.error('\n[FATAL ERROR]', err.message || err);
    process.exit(1);
  }
}

main();
