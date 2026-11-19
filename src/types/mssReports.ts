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

export interface SoldLaptopsByModelWarehouseItem {
  model_id: string;
  brand: string;
  model_name: string;
  category: string;
  model_code?: string;
  warehouse_breakdown: Record<string, number>;
  total_sold_units: number;
  total_revenue: number;
}

export interface SoldLaptopsReport {
  selected_warehouse: string;
  start_date?: string;
  end_date?: string;
  date_label: string;
  generated_at: string;
  items: SoldLaptopsByModelWarehouseItem[];
  total_sold_units: number;
  total_revenue: number;
  warehouse_totals: Record<string, number>;
}

export interface ModelStockQuantitySummary {
  model_id: string;
  brand: string;
  model_name: string;
  model_code?: string;
  category: string;
  specifications?: string;
  total_units: number;
  existing_units: number;
  sold_units: number;
  existing_serialized: number;
  existing_non_serialized: number;
  status_breakdown: {
    available: number;
    reserved: number;
    maintenance: number;
    returned: number;
  };
  warehouse_breakdown: Record<string, {
    existing_units: number;
    sold_units: number;
    total_units: number;
    existing_serialized: number;
    existing_non_serialized: number;
  }>;
}
