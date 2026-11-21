export interface FinancialSummary {
  totalRevenue: number;         // إجمالي المبيعات الإجمالية
  costOfGoodsSold: number;      // تكلفة البضاعة المباعة (COGS)
  grossProfit: number;          // مجمل الربح (الإيرادات - التكلفة - المرتجعات)
  profitMarginPercent: number;  // نسبة هامش مجمل الربح
  totalOperatingExpenses?: number; // إجمالي المصروفات التشغيلية
  netProfit?: number;           // صافي الربح بعد المصروفات (Gross Profit - Operating Expenses)
  netProfitMarginPercent?: number; // نسبة هامش صافي الربح بعد المصروفات
  totalDiscounts: number;       // إجمالي الخصومات الممنوحة
  totalRefunds: number;         // إجمالي المرتجعات المستردة
  netSales: number;             // صافي المبيعات (المبيعات - المرتجعات)
  invoicesCount: number;        // عدد فواتير المبيعات
  returnsCount: number;         // عدد حركات المرتجع
  avgInvoiceValue: number;      // متوسط قيمة الفاتورة
}

export interface DailySalesSummary {
  date: string;
  invoicesCount: number;
  revenue: number;
  cogs: number;
  grossProfit: number;
  refunds: number;
}

export interface TopSellingProduct {
  productId: string;
  productName: string;
  productCode: string;
  quantitySold: number;
  totalRevenue: number;
  totalCost: number;
  grossProfit: number;
}

export interface InventoryValuation {
  totalItemsCount: number;
  totalUnitsCount: number;
  totalCostValue: number;       // قيمة المخزون بسعر التكلفة
  totalRetailValue: number;     // قيمة المخزون بسعر البيع
  potentialProfit: number;      // الربح المتوقع عند بيع المخزون
}
