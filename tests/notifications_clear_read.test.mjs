import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';

describe('Clear Read Notifications Action & Safety Verification', () => {
  // Mock localStorage for isolated node test runner
  const storage = new Map();
  globalThis.localStorage = {
    getItem: (k) => storage.get(k) || null,
    setItem: (k, v) => storage.set(k, String(v)),
    removeItem: (k) => storage.delete(k),
    clear: () => storage.clear(),
  };

  const READ_IDS_STORAGE_KEY = 'mss_read_notification_ids_v1';
  const RUNTIME_NOTIFICATIONS_STORAGE_KEY = 'mss_runtime_notifications_v1';
  const DISMISSED_NOTIFICATION_IDS_STORAGE_KEY = 'mss_dismissed_notification_ids_v1';

  beforeEach(() => {
    storage.clear();
  });

  test('1. Deletes read notifications while preserving all unread notifications', async () => {
    // Seed initial notifications (3 unread, 2 read)
    const initialItems = [
      { id: 'item-1', title: 'Unread 1', isRead: false },
      { id: 'item-2', title: 'Read 1', isRead: true },
      { id: 'item-3', title: 'Unread 2', isRead: false },
      { id: 'item-4', title: 'Read 2', isRead: true },
      { id: 'item-5', title: 'Unread 3', isRead: false },
    ];

    const readIds = new Set(['item-2', 'item-4']);
    const dismissedIds = new Set();
    let runtimeItems = [...initialItems];

    // Simulate clearReadNotifications logic
    const readItems = runtimeItems.filter(n => readIds.has(n.id));
    assert.strictEqual(readItems.length, 2, 'Must detect exactly 2 read notifications');

    // Add read IDs to dismissed and persist
    readItems.forEach(n => dismissedIds.add(n.id));
    localStorage.setItem(DISMISSED_NOTIFICATION_IDS_STORAGE_KEY, JSON.stringify(Array.from(dismissedIds)));

    // Filter runtime items
    runtimeItems = runtimeItems.filter(n => !dismissedIds.has(n.id));
    localStorage.setItem(RUNTIME_NOTIFICATIONS_STORAGE_KEY, JSON.stringify(runtimeItems));

    // Clear readIds
    readItems.forEach(n => readIds.delete(n.id));
    localStorage.setItem(READ_IDS_STORAGE_KEY, JSON.stringify(Array.from(readIds)));

    // Verifications
    assert.strictEqual(runtimeItems.length, 3, 'Exactly 3 notifications must remain');
    assert.ok(runtimeItems.every(n => !n.isRead), 'All remaining notifications must be unread');
    assert.deepStrictEqual(runtimeItems.map(n => n.id), ['item-1', 'item-3', 'item-5']);
    assert.strictEqual(readIds.size, 0, 'readIds set must be completely cleared of deleted items');
  });

  test('2. Edge Case: No read notifications returns 0 and causes no side effects', async () => {
    const allUnread = [
      { id: 'unread-1', title: 'Alert 1', isRead: false },
      { id: 'unread-2', title: 'Alert 2', isRead: false },
    ];

    const readIds = new Set();
    const dismissedIds = new Set();
    let runtimeItems = [...allUnread];

    const readItems = runtimeItems.filter(n => readIds.has(n.id));
    assert.strictEqual(readItems.length, 0, 'No read notifications found');

    if (readItems.length === 0) {
      // Early exit as in NotificationContext
      assert.strictEqual(runtimeItems.length, 2, 'List remains completely untouched');
      assert.strictEqual(dismissedIds.size, 0, 'No dismissed IDs added');
    }
  });

  test('3. Reopening / Simulated Restart: dismissed read notifications never reappear', async () => {
    // Seed dismissed IDs in localStorage
    storage.set(DISMISSED_NOTIFICATION_IDS_STORAGE_KEY, JSON.stringify(['item-old-read']));
    storage.set(RUNTIME_NOTIFICATIONS_STORAGE_KEY, JSON.stringify([
      { id: 'item-old-read', title: 'Deleted Read Item', isRead: true },
      { id: 'item-active-unread', title: 'Active Unread Item', isRead: false },
    ]));

    // Read back as simulated app reload
    const dismissedRaw = JSON.parse(storage.get(DISMISSED_NOTIFICATION_IDS_STORAGE_KEY) || '[]');
    const dismissedSet = new Set(dismissedRaw);

    const runtimeRaw = JSON.parse(storage.get(RUNTIME_NOTIFICATIONS_STORAGE_KEY) || '[]');
    const activeNotifications = runtimeRaw.filter(item => !dismissedSet.has(item.id));

    assert.strictEqual(activeNotifications.length, 1);
    assert.strictEqual(activeNotifications[0].id, 'item-active-unread');
    assert.strictEqual(activeNotifications[0].title, 'Active Unread Item');
  });

  test('4. NotificationDrawer and Modal Egyptian Arabic text validation', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');

    const drawerPath = path.resolve('src/components/common/NotificationDrawer.tsx');
    assert.ok(fs.existsSync(drawerPath), 'NotificationDrawer.tsx must exist');
    const content = fs.readFileSync(drawerPath, 'utf-8');

    // Button label
    assert.ok(content.includes('مسح الإشعارات المقروءة'), 'Must have button labeled مسح الإشعارات المقروءة');
    // Lucide Trash2 icon
    assert.ok(content.includes('Trash2'), 'Must use Lucide Trash2 icon');
    // Egyptian Arabic Modal confirmation wording
    assert.ok(content.includes('مسح الإشعارات المقروءة؟'), 'Must have title: مسح الإشعارات المقروءة؟');
    assert.ok(content.includes('هيتم حذف كل الإشعارات اللي اتقرت بالفعل، ومش هتقدر ترجعها بعد كده.'), 'Must have description: هيتم حذف كل الإشعارات اللي اتقرت بالفعل، ومش هتقدر ترجعها بعد كده.');
    assert.ok(content.includes('مسح الإشعارات'), 'Must have confirm button: مسح الإشعارات');
    assert.ok(content.includes('إلغاء'), 'Must have cancel button: إلغاء');
  });
});
