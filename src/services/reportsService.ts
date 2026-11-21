import type {
  FinancialSummary,
  DailySalesSummary,
  TopSellingProduct,
  InventoryValuation,
} from '../types/reports.ts';
import type { InvoiceItem } from '../types/sale.ts';
import { salesService } from './salesService.ts';
import { returnsService } from './returnsService.ts';
import { productsService } from './productsService.ts';
import { accessoriesExpensesService } from './accessoriesExpensesService.ts';
import { validateDateRange } from '../lib/dateValidation.ts';
import {
  roundMoney,
  calculateNetSales,
  calculateNetCogs,
  calculateGrossProfit,
  computeAccountingMetrics,
} from '../lib/accounting.ts';

export const reportsService = {
  /**
   * Get overall financial summary for a given date range.
   * Standardized accounting definitions:
   * - Gross Sales: Total completed invoice amounts before returns
   * - Total Returns: Total approved refunds recorded in period
   * - Net Sales: Gross Sales - Total Returns
   * - Net COGS: Original COGS - Reversed COGS for sellable (RESTOCKED) items
   * - Gross Profit: Net Sales - Net COGS
   */
  async getFinancialSummary(startDate?: string, endDate?: string): Promise<FinancialSummary> {
    const dateVal = validateDateRange(startDate, endDate);
    const invoices = await salesService.getInvoices({ startDate: dateVal.sanitizedStart, endDate: dateVal.sanitizedEnd });
    const returns = await returnsService.getReturns({ startDate: dateVal.sanitizedStart, endDate: dateVal.sanitizedEnd });

    let grossSales = 0;
    let originalCogs = 0;
    let totalLineDiscounts = 0;
    let totalInvoiceDiscounts = 0;

    // Cache invoice items for fast lookup and accurate historical cost snapshots
    const invoiceItemsMap = new Map<string, InvoiceItem[]>();

    for (const inv of invoices) {
      grossSales += inv.total_amount;
      totalInvoiceDiscounts += inv.discount || 0;

      const items = await salesService.getInvoiceItems(inv.id);
      invoiceItemsMap.set(inv.id, items);
      for (const item of items) {
        originalCogs += (item.cost_snapshot || 0) * item.quantity;
        totalLineDiscounts += (item.discount || 0) * item.quantity;
      }
    }

    // Calculate restocked COGS reversal: salable items returned back to shelf reduce effective COGS.
    // Critical Rule: Always use the original sale's cost snapshot. Never use the current product cost.
    let reversedCogs = 0;
    for (const r of returns) {
      const rItems = await returnsService.getReturnItems(r.id);

      let origInvoiceItems = invoiceItemsMap.get(r.invoice_id);
      if (!origInvoiceItems) {
        try {
          origInvoiceItems = await salesService.getInvoiceItems(r.invoice_id);
        } catch {
          origInvoiceItems = [];
        }
      }

      for (const item of rItems) {
        if (item.restock_condition === 'RESTOCKED') {
          if (!item.product_id || item.item_type === 'maintenance') {
            continue; // Maintenance has no product COGS reversal
          }
          const origItem = origInvoiceItems?.find(ii => ii.product_id === item.product_id);
          let unitCost = origItem ? (origItem.cost_snapshot || 0) : 0;
          if (unitCost === 0 && item.product_id) {
            const prod = await productsService.getProductById(item.product_id);
            unitCost = prod?.cost || 0;
          }
          reversedCogs += unitCost * item.quantity_returned;
        }
        // If DAMAGED, reversedCogs remains 0 (cost is NOT reversed)
      }
    }

    const totalRefunds = returns.reduce((sum, r) => sum + r.refund_amount, 0);
    const totalDiscounts = roundMoney(totalLineDiscounts + totalInvoiceDiscounts);

    const metrics = computeAccountingMetrics({
      grossSales,
      totalReturns: totalRefunds,
      originalCogs,
      reversedCogs,
    });

    const avgInvoiceValue = invoices.length > 0 ? roundMoney(grossSales / invoices.length) : 0;

    // Operating Expenses & Net Profit After Expenses
    const totalOperatingExpenses = await accessoriesExpensesService.getTotalExpenses(
      dateVal.sanitizedStart,
      dateVal.sanitizedEnd
    );
    const netProfit = roundMoney(metrics.grossProfit - totalOperatingExpenses);
    const netProfitMarginPercent = metrics.netSales > 0 ? roundMoney((netProfit / metrics.netSales) * 100) : 0;

    return {
      totalRevenue: metrics.grossSales,
      costOfGoodsSold: metrics.netCogs,
      grossProfit: metrics.grossProfit,
      profitMarginPercent: metrics.profitMarginPercent,
      totalOperatingExpenses,
      netProfit,
      netProfitMarginPercent,
      totalDiscounts,
      totalRefunds: metrics.totalReturns,
      netSales: metrics.netSales,
      invoicesCount: invoices.length,
      returnsCount: returns.length,
      avgInvoiceValue,
    };
  },

  /**
   * Get daily breakdown for the last N days
   */
  async getDailySummaries(daysCount = 14): Promise<DailySalesSummary[]> {
    const today = new Date();
    const days: string[] = [];

    for (let i = daysCount - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      days.push(d.toISOString().substring(0, 10));
    }

    const minDate = days[0];
    const maxDate = days[days.length - 1];

    const invoices = await salesService.getInvoices({ startDate: minDate, endDate: maxDate });
    const returns = await returnsService.getReturns({ startDate: minDate, endDate: maxDate });

    // Preload items for all relevant invoices
    const invoiceItemsMap = new Map<string, InvoiceItem[]>();
    for (const inv of invoices) {
      const items = await salesService.getInvoiceItems(inv.id);
      invoiceItemsMap.set(inv.id, items);
    }

    // Preload return items
    const returnItemsMap = new Map<string, any[]>();
    for (const r of returns) {
      const rItems = await returnsService.getReturnItems(r.id);
      returnItemsMap.set(r.id, rItems);
    }

    return days.map(date => {
      const dayInvoices = invoices.filter(inv => inv.invoice_date === date);
      const dayReturns = returns.filter(r => r.return_date === date);

      const dayGrossSales = roundMoney(dayInvoices.reduce((sum, inv) => sum + inv.total_amount, 0));
      const dayRefunds = roundMoney(dayReturns.reduce((sum, r) => sum + r.refund_amount, 0));
      const dayNetSales = calculateNetSales(dayGrossSales, dayRefunds);

      let dayOrigCogs = 0;
      for (const inv of dayInvoices) {
        const items = invoiceItemsMap.get(inv.id) || [];
        dayOrigCogs += items.reduce((sum, item) => sum + (item.cost_snapshot || 0) * item.quantity, 0);
      }

      let dayReversedCogs = 0;
      for (const ret of dayReturns) {
        const rItems = returnItemsMap.get(ret.id) || [];
        const origItems = invoiceItemsMap.get(ret.invoice_id) || [];
        for (const item of rItems) {
          if (item.restock_condition === 'RESTOCKED' && item.product_id && item.item_type !== 'maintenance') {
            const origItem = origItems.find(ii => ii.product_id === item.product_id);
            const unitCost = origItem?.cost_snapshot || 0;
            dayReversedCogs += unitCost * item.quantity_returned;
          }
        }
      }

      const dayNetCogs = calculateNetCogs(dayOrigCogs, dayReversedCogs);
      const grossProfit = calculateGrossProfit(dayNetSales, dayNetCogs);

      return {
        date,
        invoicesCount: dayInvoices.length,
        revenue: dayGrossSales,
        cogs: dayNetCogs,
        grossProfit,
        refunds: dayRefunds,
      };
    });
  },

  /**
   * Get top selling products ranked by revenue or quantity sold
   */
  async getTopSellingProducts(
    limit = 10,
    startDate?: string,
    endDate?: string
  ): Promise<TopSellingProduct[]> {
    const dateVal = validateDateRange(startDate, endDate);
    const invoices = await salesService.getInvoices({ startDate: dateVal.sanitizedStart, endDate: dateVal.sanitizedEnd });
    const returns = await returnsService.getReturns({ startDate: dateVal.sanitizedStart, endDate: dateVal.sanitizedEnd });

    const productStats = new Map<
      string,
      {
        name: string;
        code: string;
        soldQty: number;
        returnedQty: number;
        grossRevenue: number;
        refundedRevenue: number;
        cost: number;
        reversedCost: number;
      }
    >();

    for (const inv of invoices) {
      const items = await salesService.getInvoiceItems(inv.id);
      for (const item of items) {
        if (!item.product_id || item.item_type === 'maintenance') {
          continue; // Top selling products only aggregates physical inventory products
        }

        const existing = productStats.get(item.product_id) || {
          name: item.product_name,
          code: item.product_code || '—',
          soldQty: 0,
          returnedQty: 0,
          grossRevenue: 0,
          refundedRevenue: 0,
          cost: 0,
          reversedCost: 0,
        };

        existing.soldQty += item.quantity;
        existing.grossRevenue += item.line_total;
        existing.cost += (item.cost_snapshot || 0) * item.quantity;

        productStats.set(item.product_id, existing);
      }
    }

    // Deduct returns for accurate net product performance
    for (const ret of returns) {
      const rItems = await returnsService.getReturnItems(ret.id);
      for (const rItem of rItems) {
        if (!rItem.product_id || rItem.item_type === 'maintenance') {
          continue;
        }
        const existing = productStats.get(rItem.product_id);
        if (existing) {
          existing.returnedQty += rItem.quantity_returned;
          existing.refundedRevenue += rItem.line_refund_total;
          if (rItem.restock_condition === 'RESTOCKED') {
            // Find cost snapshot from original invoice items if available
            const unitCost = rItem.refund_unit_price > 0 ? (existing.cost / Math.max(1, existing.soldQty)) : 0;
            existing.reversedCost += unitCost * rItem.quantity_returned;
          }
        }
      }
    }

    const list: TopSellingProduct[] = [];
    productStats.forEach((val, productId) => {
      const netQty = Math.max(0, val.soldQty - val.returnedQty);
      const netRevenue = Math.max(0, roundMoney(val.grossRevenue - val.refundedRevenue));
      const netCost = Math.max(0, roundMoney(val.cost - val.reversedCost));
      const grossProfit = calculateGrossProfit(netRevenue, netCost);

      list.push({
        productId,
        productName: val.name,
        productCode: val.code,
        quantitySold: netQty,
        totalRevenue: netRevenue,
        totalCost: netCost,
        grossProfit,
      });
    });

    list.sort((a, b) => b.totalRevenue - a.totalRevenue);
    return list.slice(0, limit);
  },

  /**
   * Calculate current inventory valuation
   */
  async getInventoryValuation(): Promise<InventoryValuation> {
    const products = await productsService.getProducts();

    let totalUnits = 0;
    let totalCostValue = 0;
    let totalRetailValue = 0;

    for (const p of products) {
      totalUnits += p.stock;
      totalCostValue += p.stock * p.cost;
      totalRetailValue += p.stock * p.price;
    }

    return {
      totalItemsCount: products.length,
      totalUnitsCount: totalUnits,
      totalCostValue,
      totalRetailValue,
      potentialProfit: totalRetailValue - totalCostValue,
    };
  },

  /**
   * Get customer receivables and debt collection summary for Accessories
   */
  async getReceivablesReport(): Promise<{
    totalReceivables: number;
    totalPaidReceivables: number;
    unpaidCount: number;
    partiallyPaidCount: number;
    overdueCount: number;
    paidCount: number;
    debtors: {
      invoiceId: string;
      invoiceNumber: string;
      invoiceDate: string;
      customerName: string;
      customerPhone?: string;
      totalAmount: number;
      paidAmount: number;
      remainingBalance: number;
      dueDate?: string;
      paymentStatus: string;
      isOverdue: boolean;
    }[];
  }> {
    const invoices = await salesService.getInvoices({});
    const today = new Date().toISOString().substring(0, 10);

    let totalReceivables = 0;
    let totalPaidReceivables = 0;
    let unpaidCount = 0;
    let partiallyPaidCount = 0;
    let overdueCount = 0;
    let paidCount = 0;
    const debtors: any[] = [];

    for (const inv of invoices) {
      const remaining = inv.remaining_balance ?? 0;
      const paid = inv.paid_amount ?? inv.total_amount;
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
          invoiceDate: inv.invoice_date,
          customerName: inv.customer_name || 'عميل نقدي عام',
          customerPhone: inv.customer_phone,
          totalAmount: inv.total_amount,
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
};
