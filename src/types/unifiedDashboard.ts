import type {
  BranchOperationalSales,
  LocationStockValuation,
} from './mssReports.ts';

export type ReportPeriod = 'today' | 'yesterday' | 'week' | 'month' | 'all' | 'custom';

export interface DateRangeFilter {
  period: ReportPeriod;
  startDate?: string;
  endDate?: string;
  label: string;
}

export interface CombinedFinancials {
  combinedRevenue: number;
  combinedCogs: number;
  combinedGrossProfit: number;
  profitMarginPercent: number;
  totalTransactionsCount: number;
}

export interface AccessoriesSummarySection {
  netSales: number;
  costOfGoodsSold: number;
  grossProfit: number;
  profitMarginPercent: number;
  invoicesCount: number;
  returnsCount: number;
  totalProducts: number;
  totalUnits: number;
  inventoryCostValuation: number;
  inventoryRetailValuation: number;
  lowStockCount: number;
  outOfStockCount: number;
}

export interface MSSSummarySection {
  netSales: number;
  costOfGoodsSold: number;
  sharedGrossProfit: number; // Stored and displayed as shared whole-business profit
  profitMarginPercent: number;
  soldDevicesCount: number;
  returnedDevicesCount: number;
  activeReservationsCount: number;
  totalAvailableUnits: number;
  shop1AvailableUnits: number;
  shop2AvailableUnits: number;
  inventoryCostValuation: number;
  inventoryListValuation: number;
  pendingSyncCount: number;
  conflictsCount: number;
  isOnline: boolean;
}

export interface DashboardAlerts {
  accessoriesLowStock: Array<{
    id: string;
    name: string;
    code: string;
    stock: number;
    threshold: number;
  }>;
  accessoriesOutOfStock: Array<{
    id: string;
    name: string;
    code: string;
  }>;
  mssPendingSync: Array<{
    uuid: string;
    type: string;
    branch: string;
    description: string;
    timestamp: string;
  }>;
  mssConflicts: Array<{
    id: string;
    serial: string;
    type: string;
    description: string;
  }>;
  hasStockAlerts: boolean;
  hasSyncAlerts: boolean;
}

export interface UnifiedBusinessDashboardData {
  filter: DateRangeFilter;
  combined: CombinedFinancials;
  accessories: AccessoriesSummarySection;
  mss: MSSSummarySection;
  branchOperationalSales: BranchOperationalSales[];
  locationStockValuation: LocationStockValuation[];
  alerts: DashboardAlerts;
}
