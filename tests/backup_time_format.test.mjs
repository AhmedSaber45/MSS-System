import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Load BackupView.tsx to test formatTime12Hour and column rendering
const backupViewPath = path.resolve('src/components/placeholders/accessories/BackupView.tsx');
const backupViewSource = fs.readFileSync(backupViewPath, 'utf8');

// Extract formatTime12Hour function from BackupView.tsx
const formatFnMatch = backupViewSource.match(/export function formatTime12Hour\([\s\S]*?\n\}/);
if (!formatFnMatch) {
  throw new Error('formatTime12Hour function not found in BackupView.tsx');
}

// Strip TypeScript annotations from the extracted function body so it can run in plain JS
const jsFnSource = formatFnMatch[0]
  .replace('export function', 'function')
  .replace(/timeStr:\s*string/, 'timeStr')
  .replace(/\):\s*string/, ')');

// Evaluate helper function in isolated scope
const formatTime12Hour = new Function(`${jsFnSource}; return formatTime12Hour;`)();

test('1. Morning timestamps formatted correctly in 12-hour format with ص', () => {
  assert.equal(formatTime12Hour('09:15:30'), '09:15:30 ص');
  assert.equal(formatTime12Hour('08:00:00'), '08:00:00 ص');
  assert.equal(formatTime12Hour('01:05:09'), '01:05:09 ص');
  assert.equal(formatTime12Hour('11:59:59'), '11:59:59 ص');
  assert.equal(formatTime12Hour('09:30'), '09:30 ص');
});

test('2. Afternoon and evening timestamps formatted correctly in 12-hour format with م', () => {
  assert.equal(formatTime12Hour('14:45:20'), '02:45:20 م');
  assert.equal(formatTime12Hour('13:00:00'), '01:00:00 م');
  assert.equal(formatTime12Hour('18:30:45'), '06:30:45 م');
  assert.equal(formatTime12Hour('20:15:00'), '08:15:00 م');
  assert.equal(formatTime12Hour('23:59:59'), '11:59:59 م');
  assert.equal(formatTime12Hour('15:20'), '03:20 م');
});

test('3. Midnight timestamps formatted correctly (12:xx:xx ص)', () => {
  assert.equal(formatTime12Hour('00:00:00'), '12:00:00 ص');
  assert.equal(formatTime12Hour('00:00'), '12:00 ص');
  assert.equal(formatTime12Hour('00:30:15'), '12:30:15 ص');
  assert.equal(formatTime12Hour('00:59:59'), '12:59:59 ص');
});

test('4. Noon timestamps formatted correctly (12:xx:xx م)', () => {
  assert.equal(formatTime12Hour('12:00:00'), '12:00:00 م');
  assert.equal(formatTime12Hour('12:00'), '12:00 م');
  assert.equal(formatTime12Hour('12:30:15'), '12:30:15 م');
  assert.equal(formatTime12Hour('12:59:59'), '12:59:59 م');
});

test('5. Handles full datetime strings and edge cases', () => {
  assert.equal(formatTime12Hour('2026-11-21 14:35:20'), '02:35:20 م');
  assert.equal(formatTime12Hour('2026-11-21T09:15:00'), '09:15:00 ص');
  assert.equal(formatTime12Hour(''), '');
  assert.equal(formatTime12Hour('02:45:20 م'), '02:45:20 م');
});

test('6. Backup Archive History table column in BackupView.tsx formats date and time properly', () => {
  // Check that the column definition in BackupView uses formatTime12Hour
  assert.match(backupViewSource, /key:\s*'date'/);
  assert.match(backupViewSource, /header:\s*'تاريخ الإنشاء'/);
  assert.match(backupViewSource, /formatTime12Hour\(timeStr\)/);

  // Simulate column render logic
  const renderItem = (item) => {
    const parts = (item.date || '').split(' ');
    const dateStr = parts[0] || item.date;
    const timeStr = parts[1] || '';
    const formattedTime = timeStr ? formatTime12Hour(timeStr) : '';
    return { dateStr, formattedTime };
  };

  // Test morning
  const morning = renderItem({ date: '2026-11-21 09:15:30' });
  assert.equal(morning.dateStr, '2026-11-21');
  assert.equal(morning.formattedTime, '09:15:30 ص');

  // Test afternoon
  const afternoon = renderItem({ date: '2026-11-21 14:45:20' });
  assert.equal(afternoon.dateStr, '2026-11-21');
  assert.equal(afternoon.formattedTime, '02:45:20 م');

  // Test midnight
  const midnight = renderItem({ date: '2026-11-21 00:00:00' });
  assert.equal(midnight.dateStr, '2026-11-21');
  assert.equal(midnight.formattedTime, '12:00:00 ص');

  // Test noon
  const noon = renderItem({ date: '2026-11-21 12:00:00' });
  assert.equal(noon.dateStr, '2026-11-21');
  assert.equal(noon.formattedTime, '12:00:00 م');
});

test('7. Confirms only Backup Archive History table column uses formatTime12Hour; details modal retains exact timestamp', () => {
  // Details modal should continue to display raw timestamp
  assert.match(backupViewSource, /\{selectedBackupDetails\.date\}/);

  // backupService should continue to store standard format
  const backupServicePath = path.resolve('src/services/backupService.ts');
  const backupServiceSource = fs.readFileSync(backupServicePath, 'utf8');
  assert.doesNotMatch(backupServiceSource, /formatTime12Hour/);
});
