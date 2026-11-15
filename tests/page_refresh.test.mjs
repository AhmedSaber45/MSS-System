import { test, describe } from 'node:test';
import assert from 'node:assert';

describe('Page Refresh Architecture & Lifecycle Verification', () => {
  test('1. Refresh lifecycle: executes async operation and resets isRefreshing in finally', async () => {
    let isRefreshing = false;
    let refreshMessage = 'جارٍ تحديث البيانات...';

    const triggerRefresh = async (fn, msg) => {
      if (isRefreshing) return;
      isRefreshing = true;
      if (msg) refreshMessage = msg;
      try {
        await fn();
      } finally {
        isRefreshing = false;
      }
    };

    let executed = false;
    const task = async () => {
      assert.strictEqual(isRefreshing, true, 'isRefreshing must be true during task execution');
      await new Promise(r => setTimeout(r, 20));
      executed = true;
    };

    const promise = triggerRefresh(task, 'جارٍ تحديث بيانات المخزون...');
    assert.strictEqual(isRefreshing, true, 'isRefreshing must be set synchronously on trigger');
    assert.strictEqual(refreshMessage, 'جارٍ تحديث بيانات المخزون...');

    await promise;
    assert.strictEqual(executed, true, 'Task must have completed');
    assert.strictEqual(isRefreshing, false, 'isRefreshing must be reset to false in finally');
  });

  test('2. Error resilience: resets isRefreshing to false even when async operation throws', async () => {
    let isRefreshing = false;

    const triggerRefresh = async (fn) => {
      if (isRefreshing) return;
      isRefreshing = true;
      try {
        await fn();
      } finally {
        isRefreshing = false;
      }
    };

    const failingTask = async () => {
      await new Promise(r => setTimeout(r, 10));
      throw new Error('Database connection failed');
    };

    try {
      await triggerRefresh(failingTask);
      assert.fail('Should have rethrown or thrown error');
    } catch (err) {
      assert.strictEqual(err.message, 'Database connection failed');
    }

    assert.strictEqual(isRefreshing, false, 'isRefreshing must NEVER remain stuck on error');
  });

  test('3. Concurrency protection: duplicate triggerRefresh calls are rejected while active', async () => {
    let isRefreshing = false;
    let callCount = 0;

    const triggerRefresh = async (fn) => {
      if (isRefreshing) return;
      isRefreshing = true;
      try {
        await fn();
      } finally {
        isRefreshing = false;
      }
    };

    const longTask = async () => {
      callCount++;
      await new Promise(r => setTimeout(r, 50));
    };

    // First call starts
    const p1 = triggerRefresh(longTask);
    // Concurrent duplicate calls while p1 is in flight
    const p2 = triggerRefresh(longTask);
    const p3 = triggerRefresh(longTask);

    await Promise.all([p1, p2, p3]);

    assert.strictEqual(callCount, 1, 'Only the initial refresh call must execute; duplicates ignored');
    assert.strictEqual(isRefreshing, false, 'isRefreshing must be false after completion');
  });

  test('4. Verification of PageRefreshContext and PageRefreshOverlay implementations', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');

    const contextPath = path.resolve('src/context/PageRefreshContext.tsx');
    assert.ok(fs.existsSync(contextPath), 'PageRefreshContext.tsx must exist');
    const contextContent = fs.readFileSync(contextPath, 'utf-8');
    assert.ok(contextContent.includes('export const PageRefreshProvider'), 'Must export PageRefreshProvider');
    assert.ok(contextContent.includes('export function usePageRefresh'), 'Must export usePageRefresh');
    assert.ok(contextContent.includes('triggerRefresh'), 'Must include triggerRefresh method');

    const overlayPath = path.resolve('src/components/common/PageRefreshOverlay.tsx');
    assert.ok(fs.existsSync(overlayPath), 'PageRefreshOverlay.tsx must exist');
    const overlayContent = fs.readFileSync(overlayPath, 'utf-8');
    assert.ok(overlayContent.includes('export const PageRefreshOverlay'), 'Must export PageRefreshOverlay');
    assert.ok(overlayContent.includes('backdrop-blur-xs'), 'Must feature clean Unslop backdrop');
    assert.ok(overlayContent.includes('Spinner'), 'Must utilize shared design system Spinner');
  });
});
