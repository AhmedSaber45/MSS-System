import { reportsService } from './reportsService.ts';
import { productsService } from './productsService.ts';
import { mssReportsService } from './mssReportsService.ts';
import { mssCommerceService } from './mssCommerceService.ts';
import { mssSyncService } from './mssSyncService.ts';
import { desktopAuthService } from './desktopAuthService.ts';
import { validateDateRange, getTodayLocalDateString } from '../lib/dateValidation.ts';
import type {
  ReportPeriod,
  DateRangeFilter,
  UnifiedBusinessDashboardData,
  CombinedFinancials,
  AccessoriesSummarySection,
  MSSSummarySection,
  DashboardAlerts,
  DashboardModuleScope,
} from '../types/unifiedDashboard.ts';

function padZero(n: number): string {
  return String(n).padStart(2, '0');
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${padZero(d.getMonth() + 1)}-${padZero(d.getDate())}`;
}

export const unifiedDashboardService = {
  /**
   * Helper to construct start & end dates from chosen period
   */
  calculateDateRange(
    period: ReportPeriod = 'month',
    customStart?: string,
    customEnd?: string
  ): DateRangeFilter {
    const today = new Date();
    const todayStr = formatDate(today);

    if (period === 'today') {
      return { period, startDate: todayStr, endDate: todayStr, label: 'اليوم' };
    }

    if (period === 'yesterday') {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yStr = formatDate(yesterday);
      return { period, startDate: yStr, endDate: yStr, label: 'أمس' };
    }

    if (period === 'week') {
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);
      return { period, startDate: formatDate(weekAgo), endDate: todayStr, label: 'آخر 7 أيام' };
    }

    if (period === 'month') {
      const monthAgo = new Date(today);
      monthAgo.setDate(monthAgo.getDate() - 30);
      return { period, startDate: formatDate(monthAgo), endDate: todayStr, label: 'آخر 30 يوماً' };
    }

    if (period === 'custom') {
      const validation = validateDateRange(customStart, customEnd);
      const safeStart = validation.sanitizedStart;
      const safeEnd = validation.sanitizedEnd;
      return {
        period,
        startDate: safeStart,
        endDate: safeEnd,
        label: safeStart && safeEnd ? `من ${safeStart} إلى ${safeEnd}` : 'فترة مخصصة',
      };
    }

    return { period: 'all', startDate: undefined, endDate: undefined, label: 'كافة الفترات' };
  },

  /**
   * Aggregates and returns the complete unified business dashboard data:
   * - Accessories Independent Shop Summary (SQLite)
   * - MSS Shared Business Summary (Supabase / Offline Outbox)
   * - Combined Business Performance
   * - Low stock & Pending synchronization alerts
   * - Branch operational attribution vs Shared profitability (Rule 16)
   */
  async getUnifiedDashboardData(
    period: ReportPeriod = 'month',
    customStart?: string,
    customEnd?: string,
    enforcedScope?: DashboardModuleScope
  ): Promise<UnifiedBusinessDashboardData> {
    const filter = this.calculateDateRange(period, customStart, customEnd);
    const { startDate, endDate } = filter;

    // Resolve authoritative module scope
    let scope: DashboardModuleScope = enforcedScope || 'both';

    if (!enforcedScope) {
      try {
        const session = await desktopAuthService.loadSecureSession();
        if (session && session.user) {
          const user = session.user;
          // 1. Strict source of truth: user's actual assigned module permission
          if (
            user.allowedModules === 'accessories' ||
            user.allowedModules === 'mss' ||
            user.allowedModules === 'both' ||
            user.allowedModules === 'none'
          ) {
            scope = user.allowedModules;
          } else if (
            (user as any).role === 'superadmin' ||
            user.username === 'admin' ||
            user.username === 'ahmed'
          ) {
            scope = 'both';
          }
        }
      } catch (err) {
        console.warn('Could not determine session module scope for unified dashboard:', err);
      }
    }

    // =========================================================================
    // CASE D: NO MODULE PERMISSIONS GRANTED
    // =========================================================================
    if (scope === 'none') {
      return {
        moduleScope: 'none',
        filter,
        combined: {
          combinedRevenue: 0,
          combinedCogs: 0,
          combinedGrossProfit: 0,
          profitMarginPercent: 0,
          totalTransactionsCount: 0,
        },
        accessories: null,
        mss: null,
        branchOperationalSales: [],
        locationStockValuation: [],
        alerts: {
          accessoriesLowStock: [],
          accessoriesOutOfStock: [],
          mssPendingSync: [],
          mssConflicts: [],
          hasStockAlerts: false,
          hasSyncAlerts: false,
        },
      };
    }

    // =========================================================================
    // CASE A: ACCESSORIES ONLY (STRICT DATA & BACKEND ISOLATION)
    // =========================================================================
    if (scope === 'accessories') {
      // Query Accessories SQLite services ONLY — MSS Supabase services are NEVER queried
      const [accFinancials, accMetrics, accValuation, allProducts] = await Promise.all([
        reportsService.getFinancialSummary(startDate, endDate),
        productsService.getMetrics(),
        reportsService.getInventoryValuation(),
        productsService.getProducts(),
      ]);

      const combinedRevenue = accFinancials.netSales;
      const combinedCogs = accFinancials.costOfGoodsSold;
      const combinedGrossProfit = accFinancials.grossProfit;
      const profitMarginPercent = combinedRevenue > 0 ? (combinedGrossProfit / combinedRevenue) * 100 : 0;
      const totalTransactionsCount = accFinancials.invoicesCount;

      const combined: CombinedFinancials = {
        combinedRevenue,
        combinedCogs,
        combinedGrossProfit,
        profitMarginPercent,
        totalTransactionsCount,
      };

      const accessories: AccessoriesSummarySection = {
        netSales: accFinancials.netSales,
        costOfGoodsSold: accFinancials.costOfGoodsSold,
        grossProfit: accFinancials.grossProfit,
        profitMarginPercent: accFinancials.profitMarginPercent,
        invoicesCount: accFinancials.invoicesCount,
        returnsCount: accFinancials.returnsCount,
        totalProducts: accMetrics.totalProducts,
        totalUnits: accMetrics.totalUnits,
        inventoryCostValuation: accValuation.totalCostValue,
        inventoryRetailValuation: accValuation.totalRetailValue,
        lowStockCount: accMetrics.lowStockCount,
        outOfStockCount: accMetrics.outOfStockCount,
      };

      const lowStockProducts = allProducts
        .filter(p => p.stock <= p.low_stock_threshold && p.stock > 0)
        .map(p => ({
          id: p.id,
          name: p.name,
          code: p.code,
          stock: p.stock,
          threshold: p.low_stock_threshold,
        }));

      const outOfStockProducts = allProducts
        .filter(p => p.stock === 0)
        .map(p => ({
          id: p.id,
          name: p.name,
          code: p.code,
        }));

      const alerts: DashboardAlerts = {
        accessoriesLowStock: lowStockProducts,
        accessoriesOutOfStock: outOfStockProducts,
        mssPendingSync: [],
        mssConflicts: [],
        hasStockAlerts: lowStockProducts.length > 0 || outOfStockProducts.length > 0,
        hasSyncAlerts: false,
      };

      return {
        moduleScope: 'accessories',
        filter,
        combined,
        accessories,
        mss: null,
        branchOperationalSales: [],
        locationStockValuation: [],
        alerts,
      };
    }

    // =========================================================================
    // CASE B: COMPU MSS ONLY (STRICT DATA & BACKEND ISOLATION)
    // =========================================================================
    if (scope === 'mss') {
      // Query MSS services ONLY — SQLite Accessories services are NEVER queried
      const [
        mssFinancials,
        branchSales,
        locationStock,
        activeReservations,
        pendingSyncOps,
        conflicts,
        isOnline,
      ] = await Promise.all([
        mssReportsService.getMSSFinancialSummary(startDate, endDate),
        mssReportsService.getBranchOperationalBreakdown(startDate, endDate),
        mssReportsService.getInventoryValuationByLocation(),
        mssCommerceService.getReservations({ status: 'ACTIVE' }),
        mssSyncService.getPendingOperations(),
        mssSyncService.getConflicts(),
        mssSyncService.checkConnectivity(),
      ]);

      const combinedRevenue = mssFinancials.netSales;
      const combinedCogs = mssFinancials.costOfGoodsSold;
      const combinedGrossProfit = mssFinancials.grossProfit;
      const profitMarginPercent = combinedRevenue > 0 ? (combinedGrossProfit / combinedRevenue) * 100 : 0;
      const totalTransactionsCount = mssFinancials.soldDevicesCount;

      const combined: CombinedFinancials = {
        combinedRevenue,
        combinedCogs,
        combinedGrossProfit,
        profitMarginPercent,
        totalTransactionsCount,
      };

      const shop1Stock = locationStock.find(l => l.location === 'محل 1');
      const shop2Stock = locationStock.find(l => l.location === 'محل 2');
      const grandStock = locationStock.find(l => l.location === 'المجموع الكلي');

      const mss: MSSSummarySection = {
        netSales: mssFinancials.netSales,
        costOfGoodsSold: mssFinancials.costOfGoodsSold,
        sharedGrossProfit: mssFinancials.grossProfit,
        profitMarginPercent: mssFinancials.profitMarginPercent,
        soldDevicesCount: mssFinancials.soldDevicesCount,
        returnedDevicesCount: mssFinancials.returnedDevicesCount,
        activeReservationsCount: activeReservations.length,
        totalAvailableUnits: grandStock?.availableUnits || 0,
        shop1AvailableUnits: shop1Stock?.availableUnits || 0,
        shop2AvailableUnits: shop2Stock?.availableUnits || 0,
        inventoryCostValuation: grandStock?.totalCostValue || 0,
        inventoryListValuation: grandStock?.totalListValue || 0,
        pendingSyncCount: pendingSyncOps.length,
        conflictsCount: conflicts.filter(c => c.resolution_status === 'PENDING').length,
        isOnline,
      };

      const pendingSyncItems = pendingSyncOps.map(op => ({
        uuid: op.uuid,
        type: op.type,
        branch: op.branch,
        description: op.description,
        timestamp: op.client_timestamp,
      }));

      const pendingConflictItems = conflicts
        .filter(c => c.resolution_status === 'PENDING')
        .map(c => ({
          id: c.id,
          serial: c.serial_number,
          type: c.conflict_type,
          description: c.conflict_description,
        }));

      const alerts: DashboardAlerts = {
        accessoriesLowStock: [],
        accessoriesOutOfStock: [],
        mssPendingSync: pendingSyncItems,
        mssConflicts: pendingConflictItems,
        hasStockAlerts: false,
        hasSyncAlerts: pendingSyncItems.length > 0 || pendingConflictItems.length > 0,
      };

      return {
        moduleScope: 'mss',
        filter,
        combined,
        accessories: null,
        mss,
        branchOperationalSales: branchSales,
        locationStockValuation: locationStock,
        alerts,
      };
    }

    // =========================================================================
    // CASE C: BOTH MODULES (OR SUPER ADMIN)
    // =========================================================================
    // 1. Fetch Accessories Metrics & Reports (Database 1: SQLite)
    const [accFinancials, accMetrics, accValuation, allProducts] = await Promise.all([
      reportsService.getFinancialSummary(startDate, endDate),
      productsService.getMetrics(),
      reportsService.getInventoryValuation(),
      productsService.getProducts(),
    ]);

    // 2. Fetch MSS Metrics & Reports (Database 2: Supabase / MSS Cache)
    const [
      mssFinancials,
      branchSales,
      locationStock,
      activeReservations,
      pendingSyncOps,
      conflicts,
      isOnline,
    ] = await Promise.all([
      mssReportsService.getMSSFinancialSummary(startDate, endDate),
      mssReportsService.getBranchOperationalBreakdown(startDate, endDate),
      mssReportsService.getInventoryValuationByLocation(),
      mssCommerceService.getReservations({ status: 'ACTIVE' }),
      mssSyncService.getPendingOperations(),
      mssSyncService.getConflicts(),
      mssSyncService.checkConnectivity(),
    ]);

    // 3. Combined Calculations
    const combinedRevenue = accFinancials.netSales + mssFinancials.netSales;
    const combinedCogs = accFinancials.costOfGoodsSold + mssFinancials.costOfGoodsSold;
    const combinedGrossProfit = accFinancials.grossProfit + mssFinancials.grossProfit;
    const profitMarginPercent = combinedRevenue > 0 ? (combinedGrossProfit / combinedRevenue) * 100 : 0;
    const totalTransactionsCount = accFinancials.invoicesCount + mssFinancials.soldDevicesCount;

    const combined: CombinedFinancials = {
      combinedRevenue,
      combinedCogs,
      combinedGrossProfit,
      profitMarginPercent,
      totalTransactionsCount,
    };

    // 4. Accessories Section Summary
    const accessories: AccessoriesSummarySection = {
      netSales: accFinancials.netSales,
      costOfGoodsSold: accFinancials.costOfGoodsSold,
      grossProfit: accFinancials.grossProfit,
      profitMarginPercent: accFinancials.profitMarginPercent,
      invoicesCount: accFinancials.invoicesCount,
      returnsCount: accFinancials.returnsCount,
      totalProducts: accMetrics.totalProducts,
      totalUnits: accMetrics.totalUnits,
      inventoryCostValuation: accValuation.totalCostValue,
      inventoryRetailValuation: accValuation.totalRetailValue,
      lowStockCount: accMetrics.lowStockCount,
      outOfStockCount: accMetrics.outOfStockCount,
    };

    // 5. MSS Section Summary (Shared Profit, Rule 16)
    const shop1Stock = locationStock.find(l => l.location === 'محل 1');
    const shop2Stock = locationStock.find(l => l.location === 'محل 2');
    const grandStock = locationStock.find(l => l.location === 'المجموع الكلي');

    const mss: MSSSummarySection = {
      netSales: mssFinancials.netSales,
      costOfGoodsSold: mssFinancials.costOfGoodsSold,
      sharedGrossProfit: mssFinancials.grossProfit, // Whole-business level shared profit
      profitMarginPercent: mssFinancials.profitMarginPercent,
      soldDevicesCount: mssFinancials.soldDevicesCount,
      returnedDevicesCount: mssFinancials.returnedDevicesCount,
      activeReservationsCount: activeReservations.length,
      totalAvailableUnits: grandStock?.availableUnits || 0,
      shop1AvailableUnits: shop1Stock?.availableUnits || 0,
      shop2AvailableUnits: shop2Stock?.availableUnits || 0,
      inventoryCostValuation: grandStock?.totalCostValue || 0,
      inventoryListValuation: grandStock?.totalListValue || 0,
      pendingSyncCount: pendingSyncOps.length,
      conflictsCount: conflicts.filter(c => c.resolution_status === 'PENDING').length,
      isOnline,
    };

    // 6. Active Alerts Compilation
    const lowStockProducts = allProducts
      .filter(p => p.stock <= p.low_stock_threshold && p.stock > 0)
      .map(p => ({
        id: p.id,
        name: p.name,
        code: p.code,
        stock: p.stock,
        threshold: p.low_stock_threshold,
      }));

    const outOfStockProducts = allProducts
      .filter(p => p.stock === 0)
      .map(p => ({
        id: p.id,
        name: p.name,
        code: p.code,
      }));

    const pendingSyncItems = pendingSyncOps.map(op => ({
      uuid: op.uuid,
      type: op.type,
      branch: op.branch,
      description: op.description,
      timestamp: op.client_timestamp,
    }));

    const pendingConflictItems = conflicts
      .filter(c => c.resolution_status === 'PENDING')
      .map(c => ({
        id: c.id,
        serial: c.serial_number,
        type: c.conflict_type,
        description: c.conflict_description,
      }));

    const alerts: DashboardAlerts = {
      accessoriesLowStock: lowStockProducts,
      accessoriesOutOfStock: outOfStockProducts,
      mssPendingSync: pendingSyncItems,
      mssConflicts: pendingConflictItems,
      hasStockAlerts: lowStockProducts.length > 0 || outOfStockProducts.length > 0,
      hasSyncAlerts: pendingSyncItems.length > 0 || pendingConflictItems.length > 0,
    };

    return {
      moduleScope: 'both',
      filter,
      combined,
      accessories,
      mss,
      branchOperationalSales: branchSales,
      locationStockValuation: locationStock,
      alerts,
    };
  },
};
