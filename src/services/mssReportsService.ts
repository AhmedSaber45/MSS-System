import { mssCommerceService } from './mssCommerceService.ts';
import { mssInventoryService } from './mssInventoryService.ts';
import { validateDateRange } from '../lib/dateValidation.ts';
import type { MSSStockLocation } from '../types/mssInventory.ts';
import type {
  MSSFinancialSummary,
  BranchOperationalSales,
  LocationStockValuation,
  CategoryBreakdown,
  DailyMSSSummary,
} from '../types/mssReports.ts';

export const mssReportsService = {
  /**
   * Get overall financial summary for MSS business for a given date range
   * Gross profit is computed at the shared business level (Rule 16)
   */
  async getMSSFinancialSummary(startDate?: string, endDate?: string): Promise<MSSFinancialSummary> {
    const dateVal = validateDateRange(startDate, endDate);
    const invoices = await mssCommerceService.getInvoices({ startDate: dateVal.sanitizedStart, endDate: dateVal.sanitizedEnd });
    const returns = await mssCommerceService.getReturns({ startDate: dateVal.sanitizedStart, endDate: dateVal.sanitizedEnd });

    // Active sales (excluding returned invoices)
    const activeInvoices = invoices.filter(inv => !inv.is_returned);

    const totalRevenue = activeInvoices.reduce((sum, inv) => sum + (inv.actual_sale_price || 0), 0);
    const totalCogs = activeInvoices.reduce((sum, inv) => sum + (inv.cost_snapshot || 0), 0);
    const totalDiscounts = activeInvoices.reduce((sum, inv) => sum + (inv.discount_amount || 0), 0);
    const totalRefunds = returns.reduce((sum, r) => sum + (r.refund_amount || 0), 0);

    const netSales = Math.max(0, totalRevenue - totalRefunds);
    const grossProfit = totalRevenue - totalCogs;
    const profitMarginPercent = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
    const soldDevicesCount = activeInvoices.length;
    const returnedDevicesCount = returns.length;
    const avgDevicePrice = soldDevicesCount > 0 ? totalRevenue / soldDevicesCount : 0;
    const avgDeviceProfit = soldDevicesCount > 0 ? grossProfit / soldDevicesCount : 0;

    return {
      totalRevenue,
      costOfGoodsSold: totalCogs,
      grossProfit,
      profitMarginPercent,
      totalDiscounts,
      totalRefunds,
      netSales,
      soldDevicesCount,
      returnedDevicesCount,
      avgDevicePrice,
      avgDeviceProfit,
    };
  },

  /**
   * Operational Sales Attribution by Branch (Rule 9 & Section 16)
   * Attributes operational execution (number of sales, collected revenue) to the executing shop.
   * NOTE: In accordance with Rule 16, shared gross profit is NEVER attributed as individual branch profit.
   */
  async getBranchOperationalBreakdown(
    startDate?: string,
    endDate?: string
  ): Promise<BranchOperationalSales[]> {
    const invoices = await mssCommerceService.getInvoices({ startDate, endDate });
    const activeInvoices = invoices.filter(inv => !inv.is_returned);

    const totalSalesCount = activeInvoices.length;
    const totalRevenue = activeInvoices.reduce((sum, inv) => sum + (inv.actual_sale_price || 0), 0);

    const branches: MSSStockLocation[] = ['محل 1', 'محل 2'];

    return branches.map(branch => {
      const branchInvoices = activeInvoices.filter(inv => inv.selling_branch === branch);
      const salesCount = branchInvoices.length;
      const revenue = branchInvoices.reduce((sum, inv) => sum + (inv.actual_sale_price || 0), 0);
      const listValue = branchInvoices.reduce((sum, inv) => sum + (inv.list_price_snapshot || 0), 0);
      const discounts = branchInvoices.reduce((sum, inv) => sum + (inv.discount_amount || 0), 0);
      const crossBranchSalesCount = branchInvoices.filter(inv => inv.source_branch !== branch).length;

      const percentageOfTotalSales = totalSalesCount > 0 ? (salesCount / totalSalesCount) * 100 : 0;
      const percentageOfTotalRevenue = totalRevenue > 0 ? (revenue / totalRevenue) * 100 : 0;

      return {
        branch,
        salesCount,
        revenue,
        listValue,
        discounts,
        crossBranchSalesCount,
        percentageOfTotalSales,
        percentageOfTotalRevenue,
      };
    });
  },

  /**
   * Current physical inventory stock valuation by stock location
   */
  async getInventoryValuationByLocation(): Promise<LocationStockValuation[]> {
    const devices = await mssInventoryService.getDevices();

    const branches: MSSStockLocation[] = ['محل 1', 'محل 2'];

    const perBranch: LocationStockValuation[] = branches.map(loc => {
      const branchDevices = devices.filter(
        d =>
          d.stock_location === loc &&
          (d.status === 'AVAILABLE' || d.status === 'RESERVED' || d.status === 'MAINTENANCE')
      );

      const availableUnits = branchDevices.filter(d => d.status === 'AVAILABLE').length;
      const reservedUnits = branchDevices.filter(d => d.status === 'RESERVED').length;
      const maintenanceUnits = branchDevices.filter(d => d.status === 'MAINTENANCE').length;
      const totalUnits = branchDevices.length;

      const totalCostValue = branchDevices.reduce((sum, d) => sum + (Number(d.purchase_cost) || 0), 0);
      const totalListValue = branchDevices.reduce((sum, d) => sum + (Number(d.list_price) || 0), 0);
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
  },

  /**
   * Device category sales breakdown (Laptops vs Monitors)
   */
  async getCategoryBreakdown(startDate?: string, endDate?: string): Promise<CategoryBreakdown[]> {
    const invoices = await mssCommerceService.getInvoices({ startDate, endDate });
    const activeInvoices = invoices.filter(inv => !inv.is_returned);

    const totalRevenue = activeInvoices.reduce((sum, inv) => sum + (inv.actual_sale_price || 0), 0);

    const categories = ['لابتوب', 'شاشة', 'أخرى'];

    return categories
      .map(category => {
        const catInvoices = activeInvoices.filter(inv => {
          if (category === 'لابتوب') return inv.category === 'لابتوب' || !inv.category;
          if (category === 'شاشة') return inv.category === 'شاشة';
          return inv.category !== 'لابتوب' && inv.category !== 'شاشة';
        });

        const unitsSold = catInvoices.length;
        const revenue = catInvoices.reduce((sum, inv) => sum + (inv.actual_sale_price || 0), 0);
        const cogs = catInvoices.reduce((sum, inv) => sum + (inv.cost_snapshot || 0), 0);
        const grossProfit = revenue - cogs;
        const percentageOfRevenue = totalRevenue > 0 ? (revenue / totalRevenue) * 100 : 0;

        return {
          category,
          unitsSold,
          revenue,
          cogs,
          grossProfit,
          percentageOfRevenue,
        };
      })
      .filter(c => c.unitsSold > 0 || c.category !== 'أخرى');
  },

  /**
   * Daily sales breakdown for the last N days
   */
  async getDailyMSSSummaries(daysCount = 14): Promise<DailyMSSSummary[]> {
    const today = new Date();
    const days: string[] = [];

    const pad = (n: number) => String(n).padStart(2, '0');
    for (let i = daysCount - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      days.push(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
    }

    const minDate = days[0];
    const maxDate = days[days.length - 1];

    const invoices = await mssCommerceService.getInvoices({ startDate: minDate, endDate: maxDate });
    const returns = await mssCommerceService.getReturns({ startDate: minDate, endDate: maxDate });

    return days.map(date => {
      const dayInvoices = invoices.filter(inv => inv.sale_date && inv.sale_date.substring(0, 10) === date && !inv.is_returned);
      const dayReturns = returns.filter(r => r.return_date && r.return_date.substring(0, 10) === date);

      const revenue = dayInvoices.reduce((sum, inv) => sum + (inv.actual_sale_price || 0), 0);
      const cogs = dayInvoices.reduce((sum, inv) => sum + (inv.cost_snapshot || 0), 0);
      const refunds = dayReturns.reduce((sum, r) => sum + (r.refund_amount || 0), 0);
      const grossProfit = revenue - cogs - refunds;

      return {
        date,
        salesCount: dayInvoices.length,
        revenue,
        cogs,
        grossProfit,
        refunds,
      };
    });
  },
};
