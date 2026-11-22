/**
 * Production Cleanup Script for Accessories SQLite Database
 * Compu MSS System v1.0.2
 *
 * Usage:
 *   node scripts/cleanup_local_sqlite.mjs           # Audit / dry-run (safe inspect only)
 *   node scripts/cleanup_local_sqlite.mjs --execute # Create backup and purge all demo data
 */

import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const isExecute = process.argv.includes('--execute');

const appData = process.env.APPDATA || (
  process.platform === 'darwin'
    ? path.join(process.env.HOME || '', 'Library', 'Application Support')
    : path.join(process.env.HOME || '', '.local', 'share')
);

const dbDir = path.join(appData, 'ShopManagementSystem');
const dbPath = path.join(dbDir, 'accessories.db');

console.log('='.repeat(70));
console.log('  Accessories SQLite Production Cleanup Utility - v1.0.2');
console.log('='.repeat(70));
console.log(`Target Database: ${dbPath}`);
console.log(`Execution Mode : ${isExecute ? 'LIVE EXECUTION (Destructive with backup)' : 'AUDIT / DRY-RUN ONLY'}`);
console.log('-'.repeat(70));

if (!fs.existsSync(dbPath)) {
  console.log(`[INFO] Database file does not exist at: ${dbPath}`);
  console.log('A fresh empty database will be initialized upon the first application startup.');
  process.exit(0);
}

// Open database in read-only for audit, or read-write for execution
const db = new Database(dbPath, { readonly: !isExecute });

const ACCESSORIES_TABLES = [
  'accessories_invoice_items',
  'accessories_invoices',
  'accessories_purchase_items',
  'accessories_purchases',
  'accessories_return_items',
  'accessories_returns',
  'accessories_inventory_movements',
  'accessories_operating_expenses',
  'accessories_products',
];

try {
  // Query existing tables
  const existingTables = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
    .all()
    .map(r => r.name);

  console.log('\n[1] Current Record Counts Before Cleanup:');
  const countsBefore = {};
  let totalRecords = 0;

  for (const table of ACCESSORIES_TABLES) {
    if (existingTables.includes(table)) {
      const count = db.prepare(`SELECT count(*) as count FROM ${table}`).get().count;
      countsBefore[table] = count;
      totalRecords += count;
      console.log(`  - ${table.padEnd(35)} : ${count} records`);
    } else {
      countsBefore[table] = 0;
      console.log(`  - ${table.padEnd(35)} : [TABLE NOT FOUND / EMPTY]`);
    }
  }

  console.log(`  Total Business Records Found       : ${totalRecords}`);

  if (!isExecute) {
    console.log('\n[NOTICE] Dry-run completed. No changes were made to the database.');
    console.log('To execute the cleanup and reset all sequences, run:');
    console.log('  node scripts/cleanup_local_sqlite.mjs --execute\n');
    db.close();
    process.exit(0);
  }

  // --- LIVE EXECUTION ---
  console.log('\n[2] Creating Pre-Cleanup Safety Backup...');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(dbDir, `accessories_pre_cleanup_${timestamp}.bak`);
  fs.copyFileSync(dbPath, backupPath);
  console.log(`  Backup successfully created at:\n  -> ${backupPath}`);

  console.log('\n[3] Executing Safe Transactional Cleanup...');
  db.pragma('foreign_keys = OFF');

  const cleanupTransaction = db.transaction(() => {
    for (const table of ACCESSORIES_TABLES) {
      if (existingTables.includes(table)) {
        db.prepare(`DELETE FROM ${table}`).run();
        console.log(`  - Cleared table: ${table}`);
      }
    }

    // Reset sqlite_sequence counters if table exists
    const hasSeq = existingTables.includes('sqlite_sequence') ||
      db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='sqlite_sequence'").get();

    if (hasSeq) {
      db.prepare("DELETE FROM sqlite_sequence WHERE name LIKE 'accessories_%'").run();
      console.log('  - Cleared sqlite_sequence auto-increment counters');
    }
  });

  cleanupTransaction();
  db.pragma('foreign_keys = ON');

  console.log('\n[4] Running VACUUM to Reclaim Disk Space and Optimize...');
  db.exec('VACUUM;');
  console.log('  Database VACUUM complete.');

  console.log('\n[5] Verifying Integrity and Final Counts:');
  const integrity = db.pragma('integrity_check');
  console.log(`  Integrity Check Result             : ${JSON.stringify(integrity)}`);

  let totalAfter = 0;
  for (const table of ACCESSORIES_TABLES) {
    if (existingTables.includes(table)) {
      const count = db.prepare(`SELECT count(*) as count FROM ${table}`).get().count;
      totalAfter += count;
      console.log(`  - ${table.padEnd(35)} : ${count} records`);
    }
  }
  console.log(`  Total Business Records After       : ${totalAfter}`);

  if (totalAfter === 0) {
    console.log('\n[SUCCESS] Accessories SQLite database is 100% clean and ready for production!');
  } else {
    console.warn('\n[WARNING] Some tables still contain records. Review above counts.');
  }

} catch (err) {
  console.error('\n[ERROR] Execution failed:', err);
  process.exit(1);
} finally {
  db.close();
}
