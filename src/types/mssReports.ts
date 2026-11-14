import type { MSSStockLocation } from './mssInventory.ts';

export interface MSSFinancialSummary {
  totalRevenue: number;
  costOfGoodsSold: number;
  grossProfit: number;
  profitMarginPercent: number;
  totalDiscounts: number;
  totalRefunds: number;
  netSales: number;
  soldDevicesCount: number;
  returnedDevicesCount: number;
  avgDevicePrice: number;
  avgDeviceProfit: number;
}

export interface BranchOperationalSales {
  branch: MSSStockLocation;
  salesCount: number;
  revenue: number;
  listValue: number;
  discounts: number;
  crossBranchSalesCount: number;
  percentageOfTotalSales: number;
  percentageOfTotalRevenue: number;
  // IMPORTANT: By Rule 16, MSS gross profit is shared at the whole-business level,
  // and is never attributed individually to the executing branch.
}

export interface LocationStockValuation {
  location: MSSStockLocation | 'المجموع الكلي';
  availableUnits: number;
  reservedUnits: number;
  maintenanceUnits: number;
  totalUnits: number;
  totalCostValue: number;
  totalListValue: number;
  potentialGrossProfit: number;
}

export interface CategoryBreakdown {
  category: string;
  unitsSold: number;
  revenue: number;
  cogs: number;
  grossProfit: number;
  percentageOfRevenue: number;
}

export interface DailyMSSSummary {
  date: string;
  salesCount: number;
  revenue: number;
  cogs: number;
  grossProfit: number;
  refunds: number;
}
