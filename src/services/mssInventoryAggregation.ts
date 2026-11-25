import type { MSSDevice, MSSInventorySummary } from '../types/mssInventory.ts';
import type { LocationStockValuation } from '../types/mssReports.ts';

export interface StoreReference {
  id?: string;
  code?: string;
  name: string;
}

/**
 * Returns the authoritative unit quantity for an MSS device record.
 * Bulk/non-serialized rows store multiple units in `quantity`; serialized units default to 1.
 */
export function getEffectiveDeviceQuantity(
  device: Pick<MSSDevice, 'quantity' | 'is_serialized' | 'serial_number'>
): number {
  const q = Number(device.quantity);
  if (Number.isFinite(q) && q > 0) {
    return q;
  }
  return 1;
}

/**
 * Deduplicates device records by `id` so cache merges or SQL joins never double-count units.
 */
export function deduplicateDevicesById(devices: MSSDevice[]): MSSDevice[] {
  const seen = new Set<string>();
  const result: MSSDevice[] = [];
  for (const d of devices) {
    if (!d || !d.id) continue;
    if (seen.has(d.id)) continue;
    seen.add(d.id);
    result.push(d);
  }
  return result;
}

/**
 * Resolves a device's `stock_location` to a canonical branch/store name using store id, code, or trimmed name.
 * Never silently assigns an unknown or missing branch to an arbitrary active branch.
 */
export function resolveCanonicalBranchName(
  rawLocation: string | null | undefined,
  stores?: StoreReference[]
): string {
  const trimmed = (rawLocation || '').trim();
  if (!trimmed) return 'غير محدد';

  if (stores && stores.length > 0) {
    for (const store of stores) {
      const storeName = (store.name || '').trim();
      if (!storeName) continue;
      if (
        trimmed === storeName ||
        (store.id && trimmed === store.id.trim()) ||
        (store.code && trimmed === store.code.trim())
      ) {
        return storeName;
      }
    }
  }

  return trimmed;
}

/**
 * Centralized MSS inventory summary calculation used by MSS Inventory and Dashboards.
 */
export function aggregateInventorySummary(
  rawDevices: MSSDevice[],
  stores?: StoreReference[]
): MSSInventorySummary {
  const devices = deduplicateDevicesById(rawDevices);

  let available_shop1 = 0;
  let available_shop2 = 0;
  let available_total = 0;
  let available_serialized_total = 0;
  let available_non_serialized_total = 0;
  let reserved_total = 0;
  let sold_total = 0;
  let maintenance_total = 0;
  let returned_total = 0;
  let total_cost_value = 0;
  let total_retail_value = 0;
  let total_units = 0;
  const location_breakdown: Record<string, number> = {};

  for (const d of devices) {
    const qty = getEffectiveDeviceQuantity(d);
    const isSer = Boolean(d.serial_number && d.is_serialized !== false);
    const branch = resolveCanonicalBranchName(d.stock_location, stores);

    total_units += qty;

    if (d.status === 'AVAILABLE') {
      available_total += qty;
      if (isSer) {
        available_serialized_total += qty;
      } else {
        available_non_serialized_total += qty;
      }
      if (d.stock_location && branch !== 'غير محدد') {
        location_breakdown[branch] = (location_breakdown[branch] || 0) + qty;
      }
      if (branch === 'محل 1') available_shop1 += qty;
      if (branch === 'محل 2') available_shop2 += qty;
    } else if (d.status === 'RESERVED') {
      reserved_total += qty;
    } else if (d.status === 'SOLD') {
      sold_total += qty;
    } else if (d.status === 'MAINTENANCE') {
      maintenance_total += qty;
    } else if (d.status === 'RETURNED') {
      returned_total += qty;
    }

    // Cost and retail value for active physical devices (not sold)
    if (d.status !== 'SOLD') {
      total_cost_value += (Number(d.purchase_cost) || 0) * qty;
      total_retail_value += (Number(d.list_price) || 0) * qty;
    }
  }

  return {
    total_units,
    available_total,
    available_serialized_total,
    available_non_serialized_total,
    available_shop1,
    available_shop2,
    location_breakdown,
    reserved_total,
    sold_total,
    maintenance_total,
    returned_total,
    total_cost_value,
    total_retail_value,
  };
}

/**
 * Centralized branch-level physical inventory valuation & unit count aggregation
 * used by Sales Reports (`MSSReportsView`) and Unified Dashboard (`UnifiedDashboardView`).
 */
export function aggregateInventoryValuationByLocation(
  rawDevices: MSSDevice[],
  activeLocationNames: string[],
  stores?: StoreReference[]
): LocationStockValuation[] {
  const devices = deduplicateDevicesById(rawDevices);

  const normalizedActive = activeLocationNames
    .map(name => resolveCanonicalBranchName(name, stores))
    .filter(name => Boolean(name) && name !== 'غير محدد');

  const historicalBranches: string[] = Array.from(
    new Set(
      devices
        .map(d => resolveCanonicalBranchName(d.stock_location, stores))
        .filter(
          b =>
            Boolean(b) &&
            b !== 'غير محدد' &&
            !b.includes('تجريبي') &&
            !/\d{10,}/.test(b)
        )
    )
  );

  // Include 'غير محدد' only if there are active physical devices with missing branch mapping
  const hasUnmappedActiveDevices = devices.some(
    d =>
      (d.status === 'AVAILABLE' || d.status === 'RESERVED' || d.status === 'MAINTENANCE') &&
      resolveCanonicalBranchName(d.stock_location, stores) === 'غير محدد'
  );

  const branches: string[] = Array.from(
    new Set([
      ...normalizedActive,
      ...historicalBranches,
      ...(hasUnmappedActiveDevices ? ['غير محدد'] : []),
    ])
  );

  const perBranch: LocationStockValuation[] = branches.map(loc => {
    const branchDevices = devices.filter(
      d =>
        resolveCanonicalBranchName(d.stock_location, stores) === loc &&
        (d.status === 'AVAILABLE' || d.status === 'RESERVED' || d.status === 'MAINTENANCE')
    );

    let availableUnits = 0;
    let reservedUnits = 0;
    let maintenanceUnits = 0;
    let totalCostValue = 0;
    let totalListValue = 0;

    for (const d of branchDevices) {
      const qty = getEffectiveDeviceQuantity(d);
      if (d.status === 'AVAILABLE') availableUnits += qty;
      else if (d.status === 'RESERVED') reservedUnits += qty;
      else if (d.status === 'MAINTENANCE') maintenanceUnits += qty;

      totalCostValue += (Number(d.purchase_cost) || 0) * qty;
      totalListValue += (Number(d.list_price) || 0) * qty;
    }

    const totalUnits = availableUnits + reservedUnits + maintenanceUnits;
    const potentialGrossProfit = totalListValue - totalCostValue;

    return {
      location: loc,
      availableUnits,
      reservedUnits,
      maintenanceUnits,
      totalUnits,
      totalCostValue,
      totalListValue,
      potentialGrossProfit,
    };
  });

  const totalAvailableUnits = perBranch.reduce((sum, b) => sum + b.availableUnits, 0);
  const totalReservedUnits = perBranch.reduce((sum, b) => sum + b.reservedUnits, 0);
  const totalMaintenanceUnits = perBranch.reduce((sum, b) => sum + b.maintenanceUnits, 0);
  const totalUnits = perBranch.reduce((sum, b) => sum + b.totalUnits, 0);
  const totalCostValue = perBranch.reduce((sum, b) => sum + b.totalCostValue, 0);
  const totalListValue = perBranch.reduce((sum, b) => sum + b.totalListValue, 0);
  const potentialGrossProfit = totalListValue - totalCostValue;

  const grandTotal: LocationStockValuation = {
    location: 'المجموع الكلي',
    availableUnits: totalAvailableUnits,
    reservedUnits: totalReservedUnits,
    maintenanceUnits: totalMaintenanceUnits,
    totalUnits,
    totalCostValue,
    totalListValue,
    potentialGrossProfit,
  };

  return [...perBranch, grandTotal];
}
