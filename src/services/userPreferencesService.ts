/**
 * Centralized Local User Preferences Persistence Utility
 *
 * Stores genuine local UX preferences (pagination size, view mode, sort order,
 * print format, promotional display toggles) in namespaced localStorage keys.
 * - Strictly separated from Supabase business data and auth/session credentials.
 * - Validates stored values before returning them, falling back safely to defaults.
 * - Namespaced independently between Accessories (shop_pref_accessories_*) and MSS (shop_pref_mss_*).
 */

export const PREF_KEYS = {
  ACCESSORIES_SALES_PAGE_SIZE: 'shop_pref_accessories_sales_page_size_v1',
  ACCESSORIES_INVOICES_PRINT_FORMAT: 'shop_pref_accessories_invoices_print_format_v1',
  ACCESSORIES_PROMO_SORT_ORDER: 'shop_pref_accessories_promo_sort_order_v1',
  ACCESSORIES_PROMO_SHOW_PRICE: 'shop_pref_accessories_promo_show_price_v1',
  ACCESSORIES_PROMO_SHOW_QUANTITY: 'shop_pref_accessories_promo_show_quantity_v1',
  MSS_CATALOG_VIEW_MODE: 'shop_pref_mss_catalog_view_mode_v1',
  MSS_PROMO_SORT_ORDER: 'shop_pref_mss_promo_sort_order_v1',
  MSS_PROMO_SHOW_PRICE: 'shop_pref_mss_promo_show_price_v1',
  MSS_PROMO_SHOW_QUANTITY: 'shop_pref_mss_promo_show_quantity_v1',
} as const;

export type PreferenceKey = (typeof PREF_KEYS)[keyof typeof PREF_KEYS];

function getStorage(): Storage | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
    if (typeof globalThis !== 'undefined' && (globalThis as any).localStorage) {
      return (globalThis as any).localStorage as Storage;
    }
  } catch {
    // Storage unavailable
  }
  return null;
}

export const userPreferencesService = {
  getNumber(key: PreferenceKey, defaultValue: number, allowedValues?: readonly number[]): number {
    const storage = getStorage();
    if (!storage) return defaultValue;
    try {
      const raw = storage.getItem(key);
      if (raw === null || raw.trim() === '') return defaultValue;
      const parsed = Number(raw);
      if (!Number.isFinite(parsed)) return defaultValue;
      if (allowedValues && !allowedValues.includes(parsed)) {
        return defaultValue;
      }
      return parsed;
    } catch {
      return defaultValue;
    }
  },

  setNumber(key: PreferenceKey, value: number, allowedValues?: readonly number[]): number {
    const valid =
      Number.isFinite(value) && (!allowedValues || allowedValues.includes(value));
    if (!valid) {
      return this.getNumber(key, allowedValues?.[0] ?? 9, allowedValues);
    }
    const storage = getStorage();
    if (storage) {
      try {
        storage.setItem(key, String(value));
      } catch {
        // Non-fatal
      }
    }
    return value;
  },

  getEnum<T extends string>(key: PreferenceKey, defaultValue: T, allowedValues: readonly T[]): T {
    const storage = getStorage();
    if (!storage) return defaultValue;
    try {
      const raw = storage.getItem(key);
      if (!raw) return defaultValue;
      return (allowedValues as readonly string[]).includes(raw) ? (raw as T) : defaultValue;
    } catch {
      return defaultValue;
    }
  },

  setEnum<T extends string>(key: PreferenceKey, value: T, allowedValues: readonly T[]): T {
    if (!(allowedValues as readonly string[]).includes(value)) {
      return this.getEnum(key, allowedValues[0], allowedValues);
    }
    const storage = getStorage();
    if (storage) {
      try {
        storage.setItem(key, value);
      } catch {
        // Non-fatal
      }
    }
    return value;
  },

  getBoolean(key: PreferenceKey, defaultValue: boolean): boolean {
    const storage = getStorage();
    if (!storage) return defaultValue;
    try {
      const raw = storage.getItem(key);
      if (raw === 'true') return true;
      if (raw === 'false') return false;
      return defaultValue;
    } catch {
      return defaultValue;
    }
  },

  setBoolean(key: PreferenceKey, value: boolean): boolean {
    const boolVal = Boolean(value);
    const storage = getStorage();
    if (storage) {
      try {
        storage.setItem(key, boolVal ? 'true' : 'false');
      } catch {
        // Non-fatal
      }
    }
    return boolVal;
  },
};
