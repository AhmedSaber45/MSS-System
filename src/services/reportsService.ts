import type {
  FinancialSummary,
  DailySalesSummary,
  TopSellingProduct,
  InventoryValuation,
} from '../types/reports.ts';
import { salesService } from './salesService.ts';
import { returnsService } from './returnsService.ts';
import { productsService } from './productsService.ts';

export const reportsService = {
  /**
   * Get overall financial summary for a given date range
   */
  async getFinancialSummary(startDate?: string, endDate?: string): Promise<FinancialSummary> {
    const invoices = await salesService.getInvoices({ startDate, endDate });
    const returns = await returnsService.getReturns({ startDate, endDate });

    let totalRevenue = 0;
    let totalCogs = 0;
    let totalLineDiscounts = 0;
    let totalInvoiceDiscounts = 0;

    for (const inv of invoices) {
      totalRevenue += inv.total_amount;
      totalInvoiceDiscounts += inv.discount || 0;

      const items = await salesService.getInvoiceItems(inv.id);
      for (const item of items) {
        totalCogs += (item.cost_snapshot || 0) * item.quantity;
        totalLineDiscounts += (item.discount || 0) * item.quantity;
      }
    }

    const totalRefunds = returns.reduce((sum, r) => sum + r.refund_amount, 0);
    const totalDiscounts = totalLineDiscounts + totalInvoiceDiscounts;
    const netSales = Math.max(0, totalRevenue - totalRefunds);
    const grossProfit = totalRevenue - totalCogs - totalRefunds;
    const profitMarginPercent = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
    const avgInvoiceValue = invoices.length > 0 ? totalRevenue / invoices.length : 0;

    return {
      totalRevenue,
      costOfGoodsSold: totalCogs,
      grossProfit,
      profitMarginPercent,
      totalDiscounts,
      totalRefunds,
      netSales,
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
    const invoiceItemsMap = new Map<string, number>();
    for (const inv of invoices) {
      const items = await salesService.getInvoiceItems(inv.id);
      const cogs = items.reduce((sum, item) => sum + (item.cost_snapshot || 0) * item.quantity, 0);
      invoiceItemsMap.set(inv.id, cogs);
    }

    return days.map(date => {
      const dayInvoices = invoices.filter(inv => inv.invoice_date === date);
      const dayReturns = returns.filter(r => r.return_date === date);

      const revenue = dayInvoices.reduce((sum, inv) => sum + inv.total_amount, 0);
      const cogs = dayInvoices.reduce((sum, inv) => sum + (invoiceItemsMap.get(inv.id) || 0), 0);
      const refunds = dayReturns.reduce((sum, r) => sum + r.refund_amount, 0);
      const grossProfit = revenue - cogs - refunds;

      return {
        date,
        invoicesCount: dayInvoices.length,
        revenue,
        cogs,
        grossProfit,
        refunds,
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
    const invoices = await salesService.getInvoices({ startDate, endDate });
    const productStats = new Map<
      string,
      {
        name: string;
        code: string;
        qty: number;
        revenue: number;
        cost: number;
      }
    >();

    for (const inv of invoices) {
      const items = await salesService.getInvoiceItems(inv.id);
      for (const item of items) {
        const existing = productStats.get(item.product_id) || {
          name: item.product_name,
          code: item.product_code,
          qty: 0,
          revenue: 0,
          cost: 0,
        };

        existing.qty += item.quantity;
        existing.revenue += item.line_total;
        existing.cost += (item.cost_snapshot || 0) * item.quantity;

        productStats.set(item.product_id, existing);
      }
    }

    const list: TopSellingProduct[] = [];
    productStats.forEach((val, productId) => {
      list.push({
        productId,
        productName: val.name,
        productCode: val.code,
        quantitySold: val.qty,
        totalRevenue: val.revenue,
        totalCost: val.cost,
        grossProfit: val.revenue - val.cost,
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
};
