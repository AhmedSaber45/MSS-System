import React, { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { StatsCard, Card, CardHeader, CardTitle } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { Spinner } from '@/components/common/Spinner';
import {
  DollarSign,
  TrendingUp,
  ShoppingBag,
  Receipt,
  Printer,
  RefreshCw,
  Package,
  Percent,
  Calendar,
  FileDown,
  Wallet,
  Clock,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { DateRangeInputs } from '@/components/common/DateRangeInputs';
import { useDateRangeFilter, getTodayLocalDateString } from '@/lib/dateValidation';
import { usePageRefresh } from '@/context/PageRefreshContext';
import { useNotification } from '@/context/NotificationContext';
import { reportsService } from '@/services/reportsService.ts';
import { documentPrintService } from '@/lib/documentPrintService';
import { PrintableProfitReport } from '@/components/reports/PrintableProfitReport';
import type {
  FinancialSummary,
  DailySalesSummary,
  TopSellingProduct,
  InventoryValuation,
} from '@/types/reports.ts';

export const ReportsView: React.FC = () => {
  const { isRefreshing, triggerRefresh } = usePageRefresh();
  const { showNotification } = useNotification();
  const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'all' | 'custom'>('month');
  const dateFilter = useDateRangeFilter();
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Data states
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [dailySummaries, setDailySummaries] = useState<DailySalesSummary[]>([]);
  const [topProducts, setTopProducts] = useState<TopSellingProduct[]>([]);
  const [valuation, setValuation] = useState<InventoryValuation | null>(null);
  const [receivables, setReceivables] = useState<{
    totalReceivables: number;
    totalPaidReceivables: number;
    unpaidCount: number;
    partiallyPaidCount: number;
    overdueCount: number;
    paidCount: number;
    debtors: any[];
  } | null>(null);

  // Helper to calculate date ranges
  const getDateRange = useCallback(() => {
    const todayStr = getTodayLocalDateString();

    if (period === 'today') {
      return { start: todayStr, end: todayStr };
    }
    if (period === 'week') {
      const today = new Date();
      const d = new Date(today);
      d.setDate(d.getDate() - 7);
      const pad = (n: number) => String(n).padStart(2, '0');
      const weekStartStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      return { start: weekStartStr, end: todayStr };
    }
    if (period === 'month') {
      const today = new Date();
      const d = new Date(today);
      d.setDate(d.getDate() - 30);
      const pad = (n: number) => String(n).padStart(2, '0');
      const monthStartStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      return { start: monthStartStr, end: todayStr };
    }
    if (period === 'custom') {
      return { start: dateFilter.startDate || undefined, end: dateFilter.endDate || undefined };
    }
    return { start: undefined, end: undefined }; // 'all'
  }, [period, dateFilter.startDate, dateFilter.endDate]);

  const loadReportData = useCallback(async () => {
    setIsLoading(true);
    try {
      const { start, end } = getDateRange();
      const [sum, daily, top, val, rec] = await Promise.all([
        reportsService.getFinancialSummary(start, end),
        reportsService.getDailySummaries(14),
        reportsService.getTopSellingProducts(8, start, end),
        reportsService.getInventoryValuation(),
        reportsService.getReceivablesReport(),
      ]);
      setSummary(sum);
      setDailySummaries(daily);
      setTopProducts(top);
      setValuation(val);
      setReceivables(rec);
    } catch (err: any) {
      console.warn('Failed to load financial reports:', err);
      showNotification({
        type: 'error',
        title: 'خطأ في جلب التقارير',
        message: err?.message || 'تعذر تحميل بيانات التقارير المالية وحساب الأرباح',
      });
    } finally {
      setIsLoading(false);
    }
  }, [getDateRange, showNotification]);

  useEffect(() => {
    loadReportData();
  }, [loadReportData]);

  const periodLabels: Record<string, string> = {
    today: 'اليوم',
    week: 'آخر 7 أيام',
    month: 'الشهر الحالي (30 يوم)',
    all: 'كل الفترات',
    custom: 'فترة مخصصة',
  };

  // Direct Print Formal Report (Phase 5)
  const handlePrintReport = async () => {
    if (!summary) return;
    await documentPrintService.printElement('profit-report-document-root', {
      title: `كشف_الأرباح_${getTodayLocalDateString()}`,
      format: 'report',
      orientation: 'portrait',
    });
  };

  // Dedicated PDF Export (Phase 6)
  const handleExportPdf = async () => {
    if (!summary) return;
    showNotification({
      type: 'info',
      title: 'استخراج تقرير الأرباح كـ PDF',
      message: 'تم فتح نافذة الطباعة. اختر "حفظ بتنسيق PDF" (Save as PDF) لتنزيل التقرير المالي المعتمد.',
    });
    await documentPrintService.exportToPdf('profit-report-document-root', {
      title: `تقرير_الأرباح_${getTodayLocalDateString()}`,
      format: 'report',
      orientation: 'portrait',
    });
  };

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <PageHeader
        title="التقارير المالية والأرباح"
        subtitle=""
        actions={
          <div className="no-print flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="md"
              onClick={() => triggerRefresh(loadReportData, 'جارٍ تحديث التقارير المالية وحساب الأرباح...')}
              disabled={isRefreshing || isLoading}
              leftIcon={<RefreshCw className={`w-4.5 h-4.5 text-slate-600 ${isRefreshing ? 'animate-spin' : ''}`} />}
              className="border-slate-300 font-semibold"
            >
              Refresh
            </Button>
            <Button
              variant="outline"
              size="md"
              onClick={handleExportPdf}
              disabled={isLoading || !summary}
              leftIcon={<FileDown className="w-4.5 h-4.5 text-blue-600" />}
              className="border-slate-300 font-bold hover:bg-slate-50 text-slate-800"
              title="استخراج وحفظ كشف الأرباح كملف PDF"
            >
              استخراج PDF
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={handlePrintReport}
              disabled={isLoading || !summary}
              leftIcon={<Printer className="w-4.5 h-4.5" />}
              className="font-bold shadow-xs"
              title="طباعة التقرير المالي الرسمي مباشرة"
            >
              طباعة كشف الأرباح
            </Button>
          </div>
        }
      />

      {/* Period Filter Selector */}
      <Card className="no-print p-3.5 bg-white border-slate-300 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <div className="flex items-center gap-2.5">
            <span className="text-xs font-bold text-slate-700">الفترة الزمنية:</span>
            <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-300 gap-1">
              {[
                { id: 'today', label: 'اليوم' },
                { id: 'week', label: 'آخر 7 أيام' },
                { id: 'month', label: 'الشهر الحالي (30 يوم)' },
                { id: 'all', label: 'كل الفترات' },
                { id: 'custom', label: 'فترة مخصصة' },
              ].map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPeriod(p.id as any)}
                  className={`px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                    period === p.id
                      ? 'bg-white text-slate-900 shadow-subtle font-bold border border-slate-300'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {period === 'custom' && (
            <div className="flex items-center gap-2.5 flex-wrap">
              <DateRangeInputs
                startDate={dateFilter.startDate}
                endDate={dateFilter.endDate}
                maxStartDate={dateFilter.maxStartDate}
                minEndDate={dateFilter.minEndDate}
                maxEndDate={dateFilter.maxEndDate}
                error={dateFilter.error}
                onStartDateChange={dateFilter.setStartDate}
                onEndDateChange={dateFilter.setEndDate}
                onClear={dateFilter.clearDateRange}
              />
              <Button
                size="md"
                variant="primary"
                disabled={!dateFilter.isValid}
                onClick={loadReportData}
                className="font-bold h-9 text-xs"
              >
                تطبيق
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* Main KPI Stats Cards */}
      {isLoading ? (
        <div className="p-16 flex flex-col items-center justify-center bg-white rounded-xl border border-slate-300">
          <Spinner size="lg" />
          <p className="text-sm font-medium text-slate-600 mt-3">جارٍ حساب الإيرادات والتكاليف والأرباح...</p>
        </div>
      ) : summary ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatsCard
              title="إجمالي المبيعات (Gross Sales)"
              value={formatCurrency(summary.totalRevenue)}
              subtitle={`${summary.invoicesCount} فاتورة مبيعات مسددة`}
              icon={DollarSign}
            />
            <StatsCard
              title="إجمالي المرتجعات (Returns)"
              value={formatCurrency(summary.totalRefunds)}
              subtitle={`${summary.returnsCount} حركات استرجاع`}
              icon={Receipt}
            />
            <StatsCard
              title="صافي المبيعات (Net Sales)"
              value={formatCurrency(summary.netSales)}
              subtitle="المبيعات الإجمالية مطروحاً منها المرتجعات"
              icon={ShoppingBag}
            />
            <StatsCard
              title="إجمالي الأرباح (Gross Profit)"
              value={formatCurrency(summary.grossProfit)}
              subtitle={`هامش ربح ${summary.profitMarginPercent.toFixed(1)}%`}
              icon={TrendingUp}
            />
          </div>

          {/* Secondary Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 bg-white p-4 rounded-xl border border-slate-300 shadow-2xs text-sm">
            <div>
              <span className="text-slate-500 block mb-1 text-xs font-semibold">تكلفة البضاعة المباعة </span>
              <span className="font-mono font-bold text-slate-800 text-base tabular-nums">
                {formatCurrency(summary.costOfGoodsSold)}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block mb-1 text-xs font-semibold">متوسط قيمة الفاتورة</span>
              <span className="font-mono font-bold text-slate-900 text-base tabular-nums">
                {formatCurrency(summary.avgInvoiceValue)}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block mb-1 text-xs font-semibold">إجمالي الخصومات </span>
              <span className="font-mono font-bold text-slate-800 text-base tabular-nums">
                {formatCurrency(summary.totalDiscounts)}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block mb-1 text-xs font-semibold">عدد المرتجعات المسجلة</span>
              <span className="font-mono font-bold text-slate-800 text-base tabular-nums">
                {summary.returnsCount} عمليات
              </span>
            </div>
          </div>

          {/* Daily Sales Breakdown & Inventory Valuation */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Daily History Table (8 Cols) */}
            <div className="lg:col-span-8 space-y-5">
              <Card className="bg-white border-slate-300 shadow-2xs overflow-hidden">
                <CardHeader className="py-3.5 px-4 bg-slate-100 border-b border-slate-300">
                  <CardTitle className="text-sm font-bold text-slate-900">
                    حركة المبيعات والأرباح اليومية (آخر أسبوعين)
                  </CardTitle>
                </CardHeader>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-right">
                    <thead className="bg-slate-100 text-xs font-bold text-slate-700 border-b border-slate-300">
                      <tr>
                        <th className="py-3 px-3.5">التاريخ</th>
                        <th className="py-3 px-3.5 text-center">الفواتير</th>
                        <th className="py-3 px-3.5 text-left">المبيعات</th>
                        <th className="py-3 px-3.5 text-left">التكلفة</th>
                        <th className="py-3 px-3.5 text-left">المرتجعات</th>
                        <th className="py-3 px-3.5 text-left">مجمل الربح</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {dailySummaries.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-500 text-sm">
                            لا توجد بيانات مسجلة في هذه الفترة
                          </td>
                        </tr>
                      ) : (
                        dailySummaries.map(d => (
                          <tr key={d.date} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3 px-3.5 text-slate-800 font-mono text-sm font-semibold tabular-nums">
                              {d.date}
                            </td>
                            <td className="py-3 px-3.5 text-center text-slate-700 font-mono font-medium tabular-nums">
                              {d.invoicesCount}
                            </td>
                            <td className="py-3 px-3.5 text-left text-slate-900 font-bold font-mono tabular-nums">
                              {formatCurrency(d.revenue)}
                            </td>
                            <td className="py-3 px-3.5 text-left text-slate-600 font-mono font-medium tabular-nums">
                              {formatCurrency(d.cogs)}
                            </td>
                            <td className="py-3 px-3.5 text-left text-rose-700 font-mono font-semibold tabular-nums">
                              {d.refunds > 0 ? formatCurrency(d.refunds) : '—'}
                            </td>
                            <td
                              className={`py-3 px-3.5 text-left font-bold font-mono tabular-nums ${
                                d.grossProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'
                              }`}
                            >
                              {formatCurrency(d.grossProfit)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>

              {/* Top Selling Products */}
              <Card className="bg-white border-slate-300 shadow-2xs overflow-hidden">
                <CardHeader className="py-3.5 px-4 bg-slate-100 border-b border-slate-300">
                  <CardTitle className="text-sm font-bold text-slate-900">
                    أعلى الأصناف مبيعاً   
                  </CardTitle>
                </CardHeader>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-right">
                    <thead className="bg-slate-100 text-xs font-bold text-slate-700 border-b border-slate-300">
                      <tr>
                        <th className="py-3 px-3.5">الصنف</th>
                        <th className="py-3 px-3.5 text-center">الكمية المباعة</th>
                        <th className="py-3 px-3.5 text-left">إجمالي الإيراد</th>
                        <th className="py-3 px-3.5 text-left">إجمالي التكلفة</th>
                        <th className="py-3 px-3.5 text-left">الربح المحقق</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {topProducts.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-slate-500 text-sm">
                            لا توجد مبيعات في الفترة المحددة
                          </td>
                        </tr>
                      ) : (
                        topProducts.map(p => (
                          <tr key={p.productId} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3 px-3.5">
                              <p className="font-bold text-slate-900">{p.productName}</p>
                              <p className="text-xs text-slate-500 font-mono font-semibold tabular-nums mt-0.5">{p.productCode}</p>
                            </td>
                            <td className="py-3 px-3.5 text-center font-mono font-bold tabular-nums text-slate-800">
                              {p.quantitySold}
                            </td>
                            <td className="py-3 px-3.5 text-left font-mono font-bold text-slate-900 tabular-nums">
                              {formatCurrency(p.totalRevenue)}
                            </td>
                            <td className="py-3 px-3.5 text-left font-mono text-slate-600 font-medium tabular-nums">
                              {formatCurrency(p.totalCost)}
                            </td>
                            <td className="py-3 px-3.5 text-left font-mono font-bold text-emerald-700 tabular-nums">
                              {formatCurrency(p.grossProfit)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>

            {/* Inventory Valuation Panel (4 Cols) */}
            <div className="lg:col-span-4 space-y-4">
              {valuation && (
                <Card className="bg-white border-slate-300 shadow-2xs p-4 space-y-4">
                  <div className="flex items-center gap-2.5 border-b border-slate-200 pb-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-300 flex items-center justify-center text-slate-700">
                      <Package className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">تقييم المخزون الحالي</h4>
                      <p className="text-xs text-slate-500">القيمة التقديرية للبضاعة المتوفرة</p>
                    </div>
                  </div>

                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between items-center text-slate-700">
                      <span>إجمالي أصناف المحل</span>
                      <span className="font-bold text-slate-900 font-mono tabular-nums">
                        {valuation.totalItemsCount}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-slate-700">
                      <span>إجمالي عدد القطع</span>
                      <span className="font-bold text-slate-900 font-mono tabular-nums">
                        {valuation.totalUnitsCount}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-slate-700">
                      <span>قيمة المخزون بسعر التكلفة</span>
                      <span className="font-mono font-bold text-slate-900 tabular-nums">
                        {formatCurrency(valuation.totalCostValue)}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-slate-700">
                      <span>قيمة المخزون بسعر البيع</span>
                      <span className="font-mono font-bold text-slate-900 tabular-nums">
                        {formatCurrency(valuation.totalRetailValue)}
                      </span>
                    </div>

                    <div className="pt-3 border-t border-slate-300 flex justify-between items-center">
                      <span className="font-bold text-slate-900">الربح التقديري للمخزون</span>
                      <span className="font-mono font-bold text-emerald-800 text-base tabular-nums">
                        {formatCurrency(valuation.potentialProfit)}
                      </span>
                    </div>
                  </div>
                </Card>
              )}
            </div>
          </div>

          {/* Customer Receivables & Debt Collection Section */}
          {receivables && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                <Wallet className="w-5 h-5 text-amber-700" />
                <h3 className="text-base font-bold text-slate-900">
                  تقرير المديونيات ومستحقات العملاء المعلقة (Customer Receivables)
                </h3>
              </div>

              {/* Receivables KPI Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                <div className="p-4 bg-white border border-slate-300 rounded-xl shadow-2xs">
                  <span className="text-xs font-semibold text-slate-500 block mb-1">
                    إجمالي الديون المعلقة
                  </span>
                  <span className="font-mono text-xl font-bold text-rose-700 tabular-nums">
                    {formatCurrency(receivables.totalReceivables)}
                  </span>
                </div>

                <div className="p-4 bg-white border border-slate-300 rounded-xl shadow-2xs">
                  <span className="text-xs font-semibold text-slate-500 block mb-1">
                    فواتير متأخرة عن موعدها
                  </span>
                  <span className="font-mono text-xl font-bold text-rose-600 tabular-nums">
                    {receivables.overdueCount} فواتير
                  </span>
                </div>

                <div className="p-4 bg-white border border-slate-300 rounded-xl shadow-2xs">
                  <span className="text-xs font-semibold text-slate-500 block mb-1">
                    فواتير مسددة جزئياً
                  </span>
                  <span className="font-mono text-xl font-bold text-amber-600 tabular-nums">
                    {receivables.partiallyPaidCount} فواتير
                  </span>
                </div>

                <div className="p-4 bg-white border border-slate-300 rounded-xl shadow-2xs">
                  <span className="text-xs font-semibold text-slate-500 block mb-1">
                    فواتير غير مسددة بالكامل
                  </span>
                  <span className="font-mono text-xl font-bold text-slate-800 tabular-nums">
                    {receivables.unpaidCount} فواتير
                  </span>
                </div>
              </div>

              {/* Debtors Table */}
              <Card className="bg-white border-slate-300 shadow-2xs overflow-hidden">
                <CardHeader className="py-3 px-4 bg-slate-50/90 border-b border-slate-300">
                  <CardTitle className="text-sm font-bold text-slate-900">
                    قائمة العملاء أصحاب الأرصدة والديون المعلقة ({receivables.debtors.length})
                  </CardTitle>
                </CardHeader>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-right">
                    <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">رقم الفاتورة</th>
                        <th className="py-2.5 px-3">تاريخ البيع</th>
                        <th className="py-2.5 px-3">اسم العميل</th>
                        <th className="py-2.5 px-3">الهاتف</th>
                        <th className="py-2.5 px-3 text-left">إجمالي الفاتورة</th>
                        <th className="py-2.5 px-3 text-left">المدفوع</th>
                        <th className="py-2.5 px-3 text-left">المتبقي المطلوب</th>
                        <th className="py-2.5 px-3">تاريخ الاستحقاق</th>
                        <th className="py-2.5 px-3 text-center">حالة السداد</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {receivables.debtors.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="py-8 text-center text-slate-500">
                            لا توجد أي ديون أو مبالغ آجلة معلقة، جميع الفواتير مسددة بالكامل!
                          </td>
                        </tr>
                      ) : (
                        receivables.debtors.map(d => (
                          <tr key={d.invoiceId} className="hover:bg-slate-50">
                            <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                              {d.invoiceNumber}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-slate-600">{d.invoiceDate}</td>
                            <td className="py-2.5 px-3 font-bold text-slate-900">{d.customerName}</td>
                            <td className="py-2.5 px-3 font-mono text-slate-500">{d.customerPhone || '—'}</td>
                            <td className="py-2.5 px-3 text-left font-mono font-bold text-slate-800">
                              {formatCurrency(d.totalAmount)}
                            </td>
                            <td className="py-2.5 px-3 text-left font-mono font-bold text-emerald-700">
                              {formatCurrency(d.paidAmount)}
                            </td>
                            <td className="py-2.5 px-3 text-left font-mono font-bold text-rose-700">
                              {formatCurrency(d.remainingBalance)}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-slate-700">
                              {d.dueDate || '—'}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <span
                                className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                  d.isOverdue
                                    ? 'bg-rose-100 text-rose-900'
                                    : d.paymentStatus === 'PARTIALLY_PAID'
                                      ? 'bg-amber-100 text-amber-900'
                                      : 'bg-slate-100 text-slate-800'
                                }`}
                              >
                                {d.isOverdue
                                  ? 'متأخر'
                                  : d.paymentStatus === 'PARTIALLY_PAID'
                                    ? 'مسدد جزئياً'
                                    : 'غير مسدد'}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}
        </>
      ) : null}

      {/* Hidden Pristine Print & PDF Template (Phase 5 & 6) */}
      {summary && (
        <div className="hidden" aria-hidden="true">
          <div id="profit-report-document-root">
            <PrintableProfitReport
              summary={summary}
              dailySummaries={dailySummaries}
              topProducts={topProducts}
              valuation={valuation}
              periodLabel={periodLabels[period] || 'فترة محددة'}
              dateRangeText={
                period === 'custom' && dateFilter.startDate && dateFilter.endDate
                  ? `من ${dateFilter.startDate} إلى ${dateFilter.endDate}`
                  : undefined
              }
            />
          </div>
        </div>
      )}
    </div>
  );
};
