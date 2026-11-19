import { mssCommerceService } from './mssCommerceService.ts';
import { mssInventoryService } from './mssInventoryService.ts';
import { mssCatalogService } from './mssCatalogService.ts';
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
  SoldLaptopsByModelWarehouseItem,
  SoldLaptopsReport,
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

  /**
   * Get customer receivables and debt collection summary for Compu MSS
   */
  async getMSSReceivablesReport(): Promise<{
    totalReceivables: number;
    totalPaidReceivables: number;
    unpaidCount: number;
    partiallyPaidCount: number;
    overdueCount: number;
    paidCount: number;
    debtors: {
      invoiceId: string;
      invoiceNumber: string;
      saleDate: string;
      customerName: string;
      customerPhone?: string;
      sellingBranch: string;
      brand?: string;
      modelName: string;
      serialNumber: string;
      totalAmount: number;
      paidAmount: number;
      remainingBalance: number;
      dueDate?: string;
      paymentStatus: string;
      isOverdue: boolean;
    }[];
  }> {
    const invoices = await mssCommerceService.getInvoices({});
    const today = new Date().toISOString().substring(0, 10);

    let totalReceivables = 0;
    let totalPaidReceivables = 0;
    let unpaidCount = 0;
    let partiallyPaidCount = 0;
    let overdueCount = 0;
    let paidCount = 0;
    const debtors: any[] = [];

    for (const inv of invoices) {
      if (inv.is_returned) continue;

      const remaining = inv.remaining_balance ?? 0;
      const paid = inv.paid_amount ?? inv.actual_sale_price;
      const status = inv.payment_status || (remaining <= 0 ? 'PAID' : 'UNPAID');
      const isOverdue = status === 'OVERDUE' || (remaining > 0 && !!inv.due_date && inv.due_date < today);

      if (status === 'PAID') {
        paidCount++;
      } else if (status === 'PARTIALLY_PAID') {
        partiallyPaidCount++;
      } else if (isOverdue) {
        overdueCount++;
      } else {
        unpaidCount++;
      }

      if (remaining > 0) {
        totalReceivables = roundMoney(totalReceivables + remaining);
        totalPaidReceivables = roundMoney(totalPaidReceivables + paid);
        debtors.push({
          invoiceId: inv.id,
          invoiceNumber: inv.invoice_number,
          saleDate: inv.sale_date,
          customerName: inv.customer_name || 'عميل نقدي عام',
          customerPhone: inv.customer_phone,
          sellingBranch: inv.selling_branch,
          brand: inv.brand,
          modelName: inv.model_name,
          serialNumber: inv.serial_number,
          totalAmount: inv.actual_sale_price,
          paidAmount: paid,
          remainingBalance: remaining,
          dueDate: inv.due_date,
          paymentStatus: isOverdue ? 'OVERDUE' : status,
          isOverdue,
        });
      }
    }

    debtors.sort((a, b) => b.remainingBalance - a.remainingBalance);

    return {
      totalReceivables,
      totalPaidReceivables,
      unpaidCount,
      partiallyPaidCount,
      overdueCount,
      paidCount,
      debtors,
    };
  },

  /**
   * Sold Laptops by Model and Warehouse Report (Requirement 2)
   * Attributes sales based on authoritative source branch of the invoice line item.
   * Excludes returned invoices (is_returned = true).
   * Does NOT count reservations as sales.
   */
  async getSoldLaptopsByModelReport(options?: {
    warehouse?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<SoldLaptopsReport> {
    const { warehouse = 'ALL', startDate, endDate } = options || {};
    const dateVal = validateDateRange(startDate, endDate);
    const invoices = await mssCommerceService.getInvoices({
      startDate: dateVal.sanitizedStart,
      endDate: dateVal.sanitizedEnd,
    });

    // Only active, non-returned completed invoices
    const activeInvoices = invoices.filter(inv => !inv.is_returned);

    const models = await mssCatalogService.getModels();
    const modelMap = new Map(models.map(m => [m.id, m]));

    // Map: model_id -> SoldLaptopsByModelWarehouseItem
    const itemMap = new Map<string, SoldLaptopsByModelWarehouseItem>();
    const warehouseTotals: Record<string, number> = {
      'محل 1': 0,
      'محل 2': 0,
    };
    let totalSoldUnits = 0;
    let totalRevenue = 0;

    for (const inv of activeInvoices) {
      const items = Array.isArray(inv.items) && inv.items.length > 0
        ? inv.items
        : [{
            device_id: inv.device_id,
            model_id: inv.model_id,
            serial_number: inv.serial_number,
            quantity: 1,
            actual_sale_price: inv.actual_sale_price,
            source_branch: inv.source_branch || inv.selling_branch,
            brand: inv.brand,
            model_name: inv.model_name,
            category: inv.category,
          }];

      for (const it of items) {
        // Authoritative warehouse from transaction line item
        const itemWarehouse = it.source_branch || inv.source_branch || inv.selling_branch || 'محل 1';

        // Filter by warehouse if a specific warehouse was chosen
        if (warehouse !== 'ALL' && itemWarehouse !== warehouse) {
          continue;
        }

        const modelId = it.model_id || inv.model_id || 'unknown';
        const model = modelMap.get(modelId);
        const brand = model?.brand || it.brand || inv.brand || 'غير محدد';
        const modelName = model?.model_name || it.model_name || inv.model_name || 'موديل غير محدد';
        const category = model?.category || it.category || inv.category || 'لابتوب';
        const modelCode = (model as any)?.model_code || '';

        const qty = Number(it.quantity) || 1;
        const rev = Number(it.actual_sale_price) || 0;

        if (!itemMap.has(modelId)) {
          itemMap.set(modelId, {
            model_id: modelId,
            brand,
            model_name: modelName,
            category,
            model_code: modelCode,
            warehouse_breakdown: {},
            total_sold_units: 0,
            total_revenue: 0,
          });
        }

        const row = itemMap.get(modelId)!;
        row.warehouse_breakdown[itemWarehouse] = (row.warehouse_breakdown[itemWarehouse] || 0) + qty;
        row.total_sold_units += qty;
        row.total_revenue += rev;

        warehouseTotals[itemWarehouse] = (warehouseTotals[itemWarehouse] || 0) + qty;
        totalSoldUnits += qty;
        totalRevenue += rev;
      }
    }

    const items = Array.from(itemMap.values());
    // Sort by total sold units descending, then brand and model_name
    items.sort(
      (a, b) =>
        b.total_sold_units - a.total_sold_units ||
        a.brand.localeCompare(b.brand) ||
        a.model_name.localeCompare(b.model_name)
    );

    const dateLabel =
      dateVal.sanitizedStart && dateVal.sanitizedEnd
        ? `${dateVal.sanitizedStart} إلى ${dateVal.sanitizedEnd}`
        : dateVal.sanitizedStart
        ? `من ${dateVal.sanitizedStart}`
        : dateVal.sanitizedEnd
        ? `حتى ${dateVal.sanitizedEnd}`
        : 'كافة الفترات';

    return {
      selected_warehouse: warehouse,
      start_date: dateVal.sanitizedStart,
      end_date: dateVal.sanitizedEnd,
      date_label: dateLabel,
      generated_at: new Date().toISOString(),
      items,
      total_sold_units: totalSoldUnits,
      total_revenue: totalRevenue,
      warehouse_totals: warehouseTotals,
    };
  },
};
