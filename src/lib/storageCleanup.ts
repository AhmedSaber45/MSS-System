/**
 * Storage Cleanup Utilities for Production Release v1.0.2
 * Compu MSS & Accessories Modules
 */

export const KNOWN_STORAGE_KEYS = [
  // Accessories Local Cache
  'shop_accessories_products_v1',
  'shop_accessories_purchases_v1',
  'shop_accessories_purchase_items_v1',
  'shop_accessories_invoices_v1',
  'shop_accessories_invoice_items_v1',
  'shop_accessories_returns_v1',
  'shop_accessories_return_items_v1',
  'shop_accessories_movements_v1',
  'shop_accessories_expenses_v1',
  'shop_accessories_payments_v1',
  'shop_accessories_schedules_v1',

  // Compu MSS Local Cache
  'shop_mss_devices_cache_v1',
  'shop_mss_models_cache_v1',
  'shop_mss_invoices_cache_v1',
  'shop_mss_reservations_cache_v1',
  'shop_mss_returns_cache_v1',
  'shop_mss_payments_cache_v1',
  'shop_mss_expenses_v1',
  'shop_mss_stores_cache_v1',
  'shop_mss_audit_cache_v1',
  'shop_mss_transfers_cache_v1',
  'shop_mss_outbox_v1',
  'shop_mss_conflicts_v1',
  'shop_mss_sync_state_v1',
  'shop_mss_system_stores_v1',
  'shop_mss_deleted_devices_v1',
  'shop_mss_deleted_models_v1',

  // Sessions and credentials
  'compu_mss_session_v1',
  'mss_desktop_session_v1',
  'shop_management_session',
  'admin_dashboard_auth_token',
  'sb-ylareolroigqcglayeyg-auth-token',
] as const;

export interface StorageAuditResult {
  foundKeys: string[];
  totalKeys: number;
}

/**
 * Audit all browser storage keys matching the application
 */
export function auditBrowserStorage(): StorageAuditResult {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { foundKeys: [], totalKeys: 0 };
  }

  const foundKeys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;
    if (
      key.startsWith('shop_') ||
      key.startsWith('mss_') ||
      key.startsWith('compu_') ||
      key.startsWith('sb-') ||
      KNOWN_STORAGE_KEYS.includes(key as any)
    ) {
      foundKeys.push(key);
    }
  }

  return {
    foundKeys,
    totalKeys: foundKeys.length,
  };
}

/**
 * Clear all demo, test, and development cache keys from LocalStorage and SessionStorage
 */
export function clearAllApplicationStorage(): number {
  if (typeof window === 'undefined') return 0;

  const { foundKeys } = auditBrowserStorage();
  let count = 0;

  for (const k of foundKeys) {
    try {
      localStorage.removeItem(k);
      count++;
    } catch {
      // ignore
    }
  }

  try {
    sessionStorage.clear();
  } catch {
    // ignore
  }

  return count;
}
