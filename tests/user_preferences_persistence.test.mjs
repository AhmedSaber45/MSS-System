import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Isolated in-memory localStorage mock
const memStorage = new Map();
const mockLocalStorage = {
  get length() {
    return memStorage.size;
  },
  key: (idx) => Array.from(memStorage.keys())[idx] ?? null,
  getItem: (k) => (memStorage.has(k) ? memStorage.get(k) : null),
  setItem: (k, v) => memStorage.set(k, String(v)),
  removeItem: (k) => memStorage.delete(k),
  clear: () => memStorage.clear(),
};
globalThis.localStorage = mockLocalStorage;

const { userPreferencesService, PREF_KEYS } = await import('../src/services/userPreferencesService.ts');

test('Local User Preferences Persistence Suite (Accessories & MSS)', async (t) => {
  t.beforeEach(() => {
    memStorage.clear();
  });

  await t.test('1 & 2. Accessories Sales & Invoice Issuing page size defaults to 9 and persists across restarts', () => {
    assert.equal(
      userPreferencesService.getNumber(PREF_KEYS.ACCESSORIES_SALES_PAGE_SIZE, 9, [6, 9, 12, 18]),
      9
    );

    const saved = userPreferencesService.setNumber(PREF_KEYS.ACCESSORIES_SALES_PAGE_SIZE, 18, [6, 9, 12, 18]);
    assert.equal(saved, 18);
    assert.equal(
      userPreferencesService.getNumber(PREF_KEYS.ACCESSORIES_SALES_PAGE_SIZE, 9, [6, 9, 12, 18]),
      18
    );
  });

  await t.test('3. Missing, corrupted, or out-of-range saved values fall back safely to defaults', () => {
    localStorage.setItem(PREF_KEYS.ACCESSORIES_SALES_PAGE_SIZE, 'invalid-number');
    assert.equal(
      userPreferencesService.getNumber(PREF_KEYS.ACCESSORIES_SALES_PAGE_SIZE, 9, [6, 9, 12, 18]),
      9
    );

    localStorage.setItem(PREF_KEYS.ACCESSORIES_SALES_PAGE_SIZE, '999');
    assert.equal(
      userPreferencesService.getNumber(PREF_KEYS.ACCESSORIES_SALES_PAGE_SIZE, 9, [6, 9, 12, 18]),
      9
    );

    localStorage.setItem(PREF_KEYS.MSS_CATALOG_VIEW_MODE, 'unknown_mode');
    assert.equal(
      userPreferencesService.getEnum(PREF_KEYS.MSS_CATALOG_VIEW_MODE, 'table', ['table', 'cards']),
      'table'
    );

    localStorage.setItem(PREF_KEYS.MSS_PROMO_SHOW_QUANTITY, 'not-a-bool');
    assert.equal(userPreferencesService.getBoolean(PREF_KEYS.MSS_PROMO_SHOW_QUANTITY, false), false);
  });

  await t.test('4 & 5. Accessories and MSS preferences are independently namespaced and never collide', () => {
    userPreferencesService.setEnum(PREF_KEYS.ACCESSORIES_PROMO_SORT_ORDER, 'desc', ['asc', 'desc']);
    userPreferencesService.setBoolean(PREF_KEYS.ACCESSORIES_PROMO_SHOW_PRICE, false);
    userPreferencesService.setBoolean(PREF_KEYS.ACCESSORIES_PROMO_SHOW_QUANTITY, true);

    // MSS remains at its own independent values
    assert.equal(
      userPreferencesService.getEnum(PREF_KEYS.MSS_PROMO_SORT_ORDER, 'asc', ['asc', 'desc']),
      'asc'
    );
    assert.equal(userPreferencesService.getBoolean(PREF_KEYS.MSS_PROMO_SHOW_PRICE, true), true);
    assert.equal(userPreferencesService.getBoolean(PREF_KEYS.MSS_PROMO_SHOW_QUANTITY, false), false);

    // Changing MSS viewMode & promo prefs does not affect Accessories
    userPreferencesService.setEnum(PREF_KEYS.MSS_CATALOG_VIEW_MODE, 'cards', ['table', 'cards']);
    userPreferencesService.setEnum(PREF_KEYS.MSS_PROMO_SORT_ORDER, 'asc', ['asc', 'desc']);
    assert.equal(
      userPreferencesService.getEnum(PREF_KEYS.ACCESSORIES_PROMO_SORT_ORDER, 'asc', ['asc', 'desc']),
      'desc'
    );
    assert.equal(
      userPreferencesService.getEnum(PREF_KEYS.MSS_CATALOG_VIEW_MODE, 'table', ['table', 'cards']),
      'cards'
    );
  });

  await t.test('6. UI integration: SalesView, CatalogView, and MSSPromotionalGenerator wire userPreferencesService without persisting transient state', () => {
    const salesView = fs.readFileSync(
      path.resolve('src/components/placeholders/accessories/SalesView.tsx'),
      'utf8'
    );
    const catalogView = fs.readFileSync(
      path.resolve('src/components/placeholders/mss/CatalogView.tsx'),
      'utf8'
    );
    const promoGen = fs.readFileSync(
      path.resolve('src/components/placeholders/mss/MSSPromotionalGenerator.tsx'),
      'utf8'
    );

    assert.ok(salesView.includes('PREF_KEYS.ACCESSORIES_SALES_PAGE_SIZE'));
    assert.ok(salesView.includes("useState<string>('')") && !salesView.includes('PREF_KEYS.SEARCH'));
    assert.ok(catalogView.includes('PREF_KEYS.MSS_CATALOG_VIEW_MODE'));
    assert.ok(promoGen.includes('PREF_KEYS.ACCESSORIES_PROMO_SORT_ORDER'));
    assert.ok(promoGen.includes('PREF_KEYS.MSS_PROMO_SORT_ORDER'));
  });
});
