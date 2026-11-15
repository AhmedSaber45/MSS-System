import { mssCommerceService } from './mssCommerceService.ts';
import { mssInventoryService } from './mssInventoryService.ts';
import { validateDateRange } from '../lib/dateValidation.ts';
import {
  roundMoney,
  calculateNetSales,
  calculateNetCogs,
  calculateGrossProfit,
  calculateProfitMarginPercent,
  computeAccountingMetrics,
} from '../lib/accounting.ts';
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
   * Get overall financial summary for MSS business for a given date range.
   * Standardized accounting definitions:
   * - Gross Sales (totalRevenue): Total sales before deducting returns
   * - Total Returns (totalRefunds): Total approved returns in period
   * - Net Sales: Gross Sales - Total Returns
   * - Net COGS: Original COGS - Reversed COGS (for AVAILABLE/sellable returns only; MAINTENANCE returns do not reverse cost)
   * - Gross Profit: Net Sales - Net COGS
   */
  async getMSSFinancialSummary(startDate?: string, endDate?: string): Promise<MSSFinancialSummary> {
    const dateVal = validateDateRange(startDate, endDate);
    const invoices = await mssCommerceService.getInvoices({ startDate: dateVal.sanitizedStart, endDate: dateVal.sanitizedEnd });
    const returns = await mssCommerceService.getReturns({ startDate: dateVal.sanitizedStart, endDate: dateVal.sanitizedEnd });

    // Gross Sales: Sum of all completed invoices in date range (preserving original sale amounts)
    const grossSales = invoices.reduce((sum, inv) => sum + (inv.actual_sale_price || 0), 0);
    const originalCogs = invoices.reduce((sum, inv) => sum + (inv.cost_snapshot || 0), 0);
    const totalDiscounts = invoices.reduce((sum, inv) => sum + (inv.discount_amount || 0), 0);
    const totalRefunds = returns.reduce((sum, r) => sum + (r.refund_amount || 0), 0);

    // Reversed COGS: only for restocked / sellable devices ('AVAILABLE')
    // Look up original invoice cost_snapshot
    const invoiceCostMap = new Map<string, number>();
    invoices.forEach(inv => invoiceCostMap.set(inv.id, inv.cost_snapshot || 0));

    let reversedCogs = 0;
    for (const r of returns) {
      if (r.new_status === 'AVAILABLE') {
        let cost = invoiceCostMap.get(r.invoice_id);
        if (cost === undefined) {
          try {
            const origInv = await mssCommerceService.getInvoiceById(r.invoice_id);
            cost = origInv?.cost_snapshot || 0;
          } catch {
            cost = 0;
          }
        }
        reversedCogs += cost || 0;
      }
      // If new_status === 'MAINTENANCE' (damaged/defective), cost remains unreversed
    }

    const metrics = computeAccountingMetrics({
      grossSales,
      totalReturns: totalRefunds,
      originalCogs,
      reversedCogs,
    });

    const soldDevicesCount = invoices.length;
    const returnedDevicesCount = returns.length;
    const netDevicesCount = Math.max(0, soldDevicesCount - returnedDevicesCount);

    const avgDevicePrice = netDevicesCount > 0
      ? roundMoney(metrics.netSales / netDevicesCount)
      : soldDevicesCount > 0
        ? roundMoney(metrics.grossSales / soldDevicesCount)
        : 0;

    const avgDeviceProfit = netDevicesCount > 0
      ? roundMoney(metrics.grossProfit / netDevicesCount)
      : 0;

    return {
      totalRevenue: metrics.grossSales,
      costOfGoodsSold: metrics.netCogs,
      grossProfit: metrics.grossProfit,
      profitMarginPercent: metrics.profitMarginPercent,
      totalDiscounts: roundMoney(totalDiscounts),
      totalRefunds: metrics.totalReturns,
      netSales: metrics.netSales,
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
    const returns = await mssCommerceService.getReturns({ startDate, endDate });

    // Gross revenue across completed invoices
    const totalGrossRevenue = invoices.reduce((sum, inv) => sum + (inv.actual_sale_price || 0), 0);

    const categories = ['لابتوب', 'شاشة', 'أخرى'];

    // Map returns to invoice category
    const invoiceMap = new Map<string, (typeof invoices)[0]>();
    invoices.forEach(inv => invoiceMap.set(inv.id, inv));

    return categories
      .map(category => {
        const catInvoices = invoices.filter(inv => {
          if (category === 'لابتوب') return inv.category === 'لابتوب' || !inv.category;
          if (category === 'شاشة') return inv.category === 'شاشة';
          return inv.category !== 'لابتوب' && inv.category !== 'شاشة';
        });

        const catReturns = returns.filter(r => {
          const inv = invoiceMap.get(r.invoice_id);
          const cat = inv?.category;
          if (category === 'لابتوب') return cat === 'لابتوب' || !cat;
          if (category === 'شاشة') return cat === 'شاشة';
          return cat !== 'لابتوب' && cat !== 'شاشة';
        });

        const grossRevenue = catInvoices.reduce((sum, inv) => sum + (inv.actual_sale_price || 0), 0);
        const refunds = catReturns.reduce((sum, r) => sum + (r.refund_amount || 0), 0);
        const netRevenue = calculateNetSales(grossRevenue, refunds);

        const origCogs = catInvoices.reduce((sum, inv) => sum + (inv.cost_snapshot || 0), 0);
        let reversedCogs = 0;
        for (const r of catReturns) {
          if (r.new_status === 'AVAILABLE') {
            const inv = invoiceMap.get(r.invoice_id);
            reversedCogs += inv?.cost_snapshot || 0;
          }
        }
        const netCogs = calculateNetCogs(origCogs, reversedCogs);
        const grossProfit = calculateGrossProfit(netRevenue, netCogs);

        const netUnitsSold = Math.max(0, catInvoices.length - catReturns.length);
        const percentageOfRevenue = totalGrossRevenue > 0 ? (grossRevenue / totalGrossRevenue) * 100 : 0;

        return {
          category,
          unitsSold: netUnitsSold,
          revenue: netRevenue,
          cogs: netCogs,
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

    // Map invoices for return cost snapshot lookups
    const invoiceMap = new Map<string, (typeof invoices)[0]>();
    invoices.forEach(inv => invoiceMap.set(inv.id, inv));

    return days.map(date => {
      // Gross sales on the sale date
      const dayInvoices = invoices.filter(inv => inv.sale_date && inv.sale_date.substring(0, 10) === date);
      // Returns attributed strictly to the return date
      const dayReturns = returns.filter(r => r.return_date && r.return_date.substring(0, 10) === date);

      const dayGrossSales = roundMoney(dayInvoices.reduce((sum, inv) => sum + (inv.actual_sale_price || 0), 0));
      const dayRefunds = roundMoney(dayReturns.reduce((sum, r) => sum + (r.refund_amount || 0), 0));
      const dayNetSales = calculateNetSales(dayGrossSales, dayRefunds);

      const dayOrigCogs = dayInvoices.reduce((sum, inv) => sum + (inv.cost_snapshot || 0), 0);
      let dayReversedCogs = 0;
      for (const r of dayReturns) {
        if (r.new_status === 'AVAILABLE') {
          const inv = invoiceMap.get(r.invoice_id);
          dayReversedCogs += inv?.cost_snapshot || 0;
        }
      }
      const dayNetCogs = calculateNetCogs(dayOrigCogs, dayReversedCogs);
      const grossProfit = calculateGrossProfit(dayNetSales, dayNetCogs);

      return {
        date,
        salesCount: dayInvoices.length,
        revenue: dayGrossSales,
        cogs: dayNetCogs,
        grossProfit,
        refunds: dayRefunds,
      };
    });
  },
};
