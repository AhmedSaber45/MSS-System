import test from 'node:test';
import assert from 'node:assert/strict';

// Setup Mock LocalStorage for Node.js test environment
class MockLocalStorage {
  constructor() {
    this.store = new Map();
  }
  getItem(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }
  setItem(key, value) {
    this.store.set(key, String(value));
  }
  removeItem(key) {
    this.store.delete(key);
  }
  clear() {
    this.store.clear();
  }
}

globalThis.localStorage = new MockLocalStorage();
if (typeof globalThis.window === 'undefined') {
  globalThis.window = { localStorage: globalThis.localStorage };
}
if (typeof globalThis.navigator === 'undefined') {
  globalThis.navigator = { onLine: true };
}

// Import services
const { mssCommerceService } = await import('../src/services/mssCommerceService.ts');
const { mssReportsService } = await import('../src/services/mssReportsService.ts');
const { mssSyncService } = await import('../src/services/mssSyncService.ts');
const { mssCatalogService } = await import('../src/services/mssCatalogService.ts');
const { supabase } = await import('../src/lib/supabase.ts');

test('MSS Sales, Invoices Cache Invalidation and 14-Day Activity Regression Suite', async (t) => {
  const MSS_INVOICES_CACHE_KEY = 'shop_mss_invoices_cache_v1';
  const MSS_OUTBOX_CACHE_KEY = 'shop_mss_outbox_queue_v1';

  // Helper to mock Supabase from('mss_invoices').select('*')
  const originalFrom = supabase.from;

  t.afterEach(() => {
    supabase.from = originalFrom;
    globalThis.localStorage.clear();
  });

  await t.test('1. Empty State & Cache Purge: When Supabase returns 0 invoices, local cache is purged', async () => {
    // Pre-populate stale deleted invoices in local cache
    const staleInvoices = [
      {
        id: 'stale-inv-1',
        invoice_number: 'MSS-INV-991',
        device_id: 'dev-1',
        model_id: 'mod-1',
        selling_branch: 'محل 1',
        source_branch: 'محل 1',
        actual_sale_price: 15000,
        cost_snapshot: 12000,
        sale_date: new Date().toISOString(),
        is_returned: false,
      },
      {
        id: 'stale-inv-2',
        invoice_number: 'MSS-INV-992',
        device_id: 'dev-2',
        model_id: 'mod-1',
        selling_branch: 'محل 2',
        source_branch: 'محل 2',
        actual_sale_price: 22000,
        cost_snapshot: 18000,
        sale_date: new Date().toISOString(),
        is_returned: false,
      },
    ];
    globalThis.localStorage.setItem(MSS_INVOICES_CACHE_KEY, JSON.stringify(staleInvoices));
    globalThis.localStorage.setItem(MSS_OUTBOX_CACHE_KEY, JSON.stringify([]));

    // Mock Supabase returning empty data [] (representing user deleted all cloud invoices)
    supabase.from = (table) => {
      if (table === 'mss_invoices') {
        return {
          select: () => ({
            order: async () => ({ data: [], error: null }),
          }),
        };
      }
      return originalFrom.call(supabase, table);
    };

    const invoices = await mssCommerceService.getInvoices();
    assert.strictEqual(invoices.length, 0, 'getInvoices must return 0 invoices when Supabase returns empty');

    // Verify localStorage cache was purged
    const cachedRaw = globalThis.localStorage.getItem(MSS_INVOICES_CACHE_KEY);
    const cached = JSON.parse(cachedRaw || '[]');
    assert.strictEqual(cached.length, 0, 'Stale local cache must be purged when cloud returns 0 records');

    // Verify recent sales slice has 0 items
    const recentSales = invoices.filter(i => !i.is_returned).slice(0, 5);
    assert.strictEqual(recentSales.length, 0, 'Recent sales on dashboard must have 0 items');
  });

  await t.test('2. Selective Deletion: Deleted cloud invoices do NOT reappear from local cache', async () => {
    // Cloud has invoice MSS-INV-102. Local cache has MSS-INV-101 (deleted from cloud) and MSS-INV-102.
    const localCached = [
      {
        id: 'inv-101',
        invoice_number: 'MSS-INV-101',
        model_id: 'mod-1',
        selling_branch: 'محل 1',
        source_branch: 'محل 1',
        actual_sale_price: 10000,
        cost_snapshot: 8000,
        sale_date: new Date().toISOString(),
        is_returned: false,
      },
      {
        id: 'inv-102',
        invoice_number: 'MSS-INV-102',
        model_id: 'mod-1',
        selling_branch: 'محل 1',
        source_branch: 'محل 1',
        actual_sale_price: 15000,
        cost_snapshot: 12000,
        sale_date: new Date().toISOString(),
        is_returned: false,
      },
    ];
    globalThis.localStorage.setItem(MSS_INVOICES_CACHE_KEY, JSON.stringify(localCached));
    globalThis.localStorage.setItem(MSS_OUTBOX_CACHE_KEY, JSON.stringify([]));

    // Supabase returns only MSS-INV-102 (MSS-INV-101 was deleted in Supabase)
    supabase.from = (table) => {
      if (table === 'mss_invoices') {
        return {
          select: () => ({
            order: async () => ({
              data: [
                {
                  id: 'inv-102',
                  invoice_number: 'MSS-INV-102',
                  model_id: 'mod-1',
                  selling_branch: 'محل 1',
                  source_branch: 'محل 1',
                  actual_sale_price: 15000,
                  cost_snapshot: 12000,
                  sale_date: new Date().toISOString(),
                  is_returned: false,
                },
              ],
              error: null,
            }),
          }),
        };
      }
      return originalFrom.call(supabase, table);
    };

    const invoices = await mssCommerceService.getInvoices();
    assert.strictEqual(invoices.length, 1, 'Should only contain the 1 invoice currently in cloud');
    assert.strictEqual(invoices[0].invoice_number, 'MSS-INV-102', 'Only non-deleted invoice must be returned');

    // Verify cache now only contains MSS-INV-102 and deleted MSS-INV-101 was removed
    const cached = JSON.parse(globalThis.localStorage.getItem(MSS_INVOICES_CACHE_KEY) || '[]');
    assert.strictEqual(cached.length, 1);
    assert.strictEqual(cached[0].invoice_number, 'MSS-INV-102');
  });

  await t.test('3. Offline Preservation: Legitimate pending outbox sales are preserved when cloud is fetched', async () => {
    const offlinePendingInvoice = {
      id: 'pending-offline-inv-1',
      invoice_number: 'MSS-INV-PENDING-01',
      model_id: 'mod-1',
      selling_branch: 'محل 1',
      source_branch: 'محل 1',
      actual_sale_price: 25000,
      cost_snapshot: 20000,
      sale_date: new Date().toISOString(),
      is_returned: false,
    };

    // Stored in local cache
    globalThis.localStorage.setItem(MSS_INVOICES_CACHE_KEY, JSON.stringify([offlinePendingInvoice]));

    // Queued in outbox with PENDING status
    const pendingOutboxOp = {
      uuid: 'op-12345',
      type: 'SALE_CREATE',
      status: 'PENDING',
      payload: offlinePendingInvoice,
      client_timestamp: new Date().toISOString(),
    };
    globalThis.localStorage.setItem(MSS_OUTBOX_CACHE_KEY, JSON.stringify([pendingOutboxOp]));

    // Cloud has 1 synced invoice
    const cloudInvoice = {
      id: 'cloud-inv-200',
      invoice_number: 'MSS-INV-200',
      model_id: 'mod-1',
      selling_branch: 'محل 2',
      source_branch: 'محل 2',
      actual_sale_price: 30000,
      cost_snapshot: 24000,
      sale_date: new Date().toISOString(),
      is_returned: false,
    };

    supabase.from = (table) => {
      if (table === 'mss_invoices') {
        return {
          select: () => ({
            order: async () => ({
              data: [cloudInvoice],
              error: null,
            }),
          }),
        };
      }
      return originalFrom.call(supabase, table);
    };

    const invoices = await mssCommerceService.getInvoices();
    assert.strictEqual(invoices.length, 2, 'Must contain both the cloud invoice and the unsynced pending invoice');
    const numbers = invoices.map(i => i.invoice_number);
    assert.ok(numbers.includes('MSS-INV-200'), 'Cloud invoice present');
    assert.ok(numbers.includes('MSS-INV-PENDING-01'), 'Pending offline invoice preserved');
  });

  await t.test('4. 14-Day Activity & Date Range Exclusion: Sales outside the last 14 days are excluded', async () => {
    const today = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const formatDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    // Date 3 days ago (inside window)
    const d3 = new Date(today);
    d3.setDate(d3.getDate() - 3);
    const dateInside = formatDate(d3);

    // Date 20 days ago (strictly outside 14-day window)
    const d20 = new Date(today);
    d20.setDate(d20.getDate() - 20);
    const dateOutside = formatDate(d20);

    const validRecentInvoice = {
      id: 'inv-recent',
      invoice_number: 'MSS-INV-RECENT',
      model_id: 'mod-1',
      selling_branch: 'محل 1',
      source_branch: 'محل 1',
      actual_sale_price: 18000,
      cost_snapshot: 14000,
      sale_date: `${dateInside}T14:00:00Z`,
      is_returned: false,
    };

    const oldOutsideInvoice = {
      id: 'inv-old',
      invoice_number: 'MSS-INV-OLD',
      model_id: 'mod-1',
      selling_branch: 'محل 1',
      source_branch: 'محل 1',
      actual_sale_price: 50000,
      cost_snapshot: 40000,
      sale_date: `${dateOutside}T10:00:00Z`,
      is_returned: false,
    };

    supabase.from = (table) => {
      if (table === 'mss_invoices') {
        return {
          select: () => ({
            order: async () => ({
              data: [validRecentInvoice, oldOutsideInvoice],
              error: null,
            }),
          }),
        };
      }
      if (table === 'mss_returns') {
        return {
          select: () => ({
            order: async () => ({ data: [], error: null }),
          }),
        };
      }
      return originalFrom.call(supabase, table);
    };

    const dailySummaries = await mssReportsService.getDailyMSSSummaries(14);
    assert.strictEqual(dailySummaries.length, 14, 'Daily summary must produce exactly 14 calendar days');

    // Verify active days
    const activeDays = dailySummaries.filter(d => d.salesCount > 0 || d.refunds > 0 || d.revenue > 0);
    assert.strictEqual(activeDays.length, 1, 'Only the 1 sale inside the 14-day window must be counted as active');
    assert.strictEqual(activeDays[0].date, dateInside, 'Active date must match the recent sale date');
    assert.strictEqual(activeDays[0].revenue, 18000, 'Active revenue matches the recent sale');

    // Verify the 20-day-old sale was NOT included in any day of the 14-day summary
    const total14DayRevenue = dailySummaries.reduce((sum, d) => sum + d.revenue, 0);
    assert.strictEqual(total14DayRevenue, 18000, 'Total 14-day revenue must exclude the 20-day-old invoice');
  });

  await t.test('5. Zero Sales in 14 Days: Returns 0 active days for proper UI empty state', async () => {
    supabase.from = (table) => {
      if (table === 'mss_invoices' || table === 'mss_returns') {
        return {
          select: () => ({
            order: async () => ({ data: [], error: null }),
          }),
        };
      }
      return originalFrom.call(supabase, table);
    };

    const dailySummaries = await mssReportsService.getDailyMSSSummaries(14);
    const activeDays = dailySummaries.filter(d => d.salesCount > 0 || d.refunds > 0 || d.revenue > 0);
    assert.strictEqual(activeDays.length, 0, 'Zero active days must be found when database has no sales');

    const totalRevenue = dailySummaries.reduce((sum, d) => sum + d.revenue, 0);
    assert.strictEqual(totalRevenue, 0, 'Total revenue across 14 days must be exactly 0');
  });

  await t.test('6. Error Handling: Graceful fallback on network error without fabricating fake records', async () => {
    // Local cache is empty
    globalThis.localStorage.setItem(MSS_INVOICES_CACHE_KEY, JSON.stringify([]));

    // Supabase throws network error
    supabase.from = (table) => {
      if (table === 'mss_invoices') {
        return {
          select: () => ({
            order: async () => {
              throw new Error('Network connection failed');
            },
          }),
        };
      }
      return originalFrom.call(supabase, table);
    };

    const invoices = await mssCommerceService.getInvoices();
    assert.strictEqual(invoices.length, 0, 'Must return empty array on failure when cache is empty, never fake data');
  });
});
