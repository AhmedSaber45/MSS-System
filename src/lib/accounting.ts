/**
 * Centralized Accounting Engine & Financial Formulas
 * Follows standard accrual and sales accounting principles:
 * - Gross Sales: Total value of completed sales before deducting customer returns
 * - Total Returns: Total approved/completed refund amount
 * - Net Sales = Gross Sales - Total Returns
 * - Original COGS: Cost of goods sold based on historical cost snapshots
 * - Reversed COGS: Cost of goods returned that are restored to sellable inventory (RESTOCKED/AVAILABLE)
 * - Net COGS = Original COGS - Reversed COGS (Damaged/non-sellable returns do not reverse COGS)
 * - Net Profit / Gross Profit = Net Sales - Net COGS - Expenses
 * - Profit Margin % = (Gross Profit / Net Sales) * 100
 */

/**
 * Clean floating point rounding to 2 decimal places
 */
export function roundMoney(amount: number): number {
  if (isNaN(amount) || !isFinite(amount)) return 0;
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

/**
 * Calculate Net Sales from Gross Sales and Total Approved Returns
 * Formula: Net Sales = Gross Sales - Total Returns
 */
export function calculateNetSales(grossSales: number, totalReturns: number): number {
  const gross = roundMoney(grossSales);
  const returns = roundMoney(totalReturns);
  return Math.max(0, roundMoney(gross - returns));
}

/**
 * Calculate Net COGS from Original COGS and Reversed COGS for sellable returned items
 * Formula: Net COGS = Original COGS - Reversed COGS
 * (Damaged returns have Reversed COGS = 0, so their cost remains in Net COGS)
 */
export function calculateNetCogs(originalCogs: number, reversedCogs: number): number {
  const orig = roundMoney(originalCogs);
  const rev = roundMoney(reversedCogs);
  return Math.max(0, roundMoney(orig - rev));
}

/**
 * Calculate Gross Profit / Net Profit before operating expenses
 * Formula: Net Profit = Net Sales - Net COGS - Expenses
 */
export function calculateGrossProfit(
  netSales: number,
  netCogs: number,
  expenses: number = 0
): number {
  const sales = roundMoney(netSales);
  const cogs = roundMoney(netCogs);
  const exp = roundMoney(expenses);
  return roundMoney(sales - cogs - exp);
}

/**
 * Calculate Profit Margin Percentage based on Net Sales
 * Formula: (Gross Profit / Net Sales) * 100
 */
export function calculateProfitMarginPercent(
  grossProfit: number,
  netSales: number,
  fallbackGrossSales?: number
): number {
  const profit = roundMoney(grossProfit);
  const revenueBasis = roundMoney(netSales > 0 ? netSales : fallbackGrossSales || 0);
  if (revenueBasis <= 0) return 0;
  return roundMoney((profit / revenueBasis) * 100);
}

/**
 * Comprehensive Financial Calculation Model Result
 */
export interface AccountingMetrics {
  grossSales: number;
  totalReturns: number;
  netSales: number;
  originalCogs: number;
  reversedCogs: number;
  netCogs: number;
  grossProfit: number;
  profitMarginPercent: number;
}

/**
 * Compute full accounting metrics from raw components
 */
export function computeAccountingMetrics(params: {
  grossSales: number;
  totalReturns: number;
  originalCogs: number;
  reversedCogs: number;
  expenses?: number;
}): AccountingMetrics {
  const grossSales = roundMoney(params.grossSales);
  const totalReturns = roundMoney(params.totalReturns);
  const netSales = calculateNetSales(grossSales, totalReturns);

  const originalCogs = roundMoney(params.originalCogs);
  const reversedCogs = roundMoney(params.reversedCogs);
  const netCogs = calculateNetCogs(originalCogs, reversedCogs);

  const grossProfit = calculateGrossProfit(netSales, netCogs, params.expenses || 0);
  const profitMarginPercent = calculateProfitMarginPercent(grossProfit, netSales, grossSales);

  return {
    grossSales,
    totalReturns,
    netSales,
    originalCogs,
    reversedCogs,
    netCogs,
    grossProfit,
    profitMarginPercent,
  };
}
