import React, { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { StatsCard, Card, CardHeader, CardTitle, CardContent } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Badge } from '@/components/common/Badge';
import { Alert } from '@/components/common/Alert';
import { Spinner } from '@/components/common/Spinner';
import {
  DollarSign,
  TrendingUp,
  Laptop,
  Store,
  Printer,
  FileDown,
  Calendar,
  RefreshCw,
  Monitor,
  RotateCcw,
  Wallet,
  Clock,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
import { DateRangeInputs } from '@/components/common/DateRangeInputs';
import { mssReportsService } from '@/services/mssReportsService.ts';
import type {
  MSSFinancialSummary,
  BranchOperationalSales,
  LocationStockValuation,
  CategoryBreakdown,
  DailyMSSSummary,
  SoldLaptopsReport,
} from '@/types/mssReports.ts';
import type { ReportPeriod } from '@/types/unifiedDashboard.ts';
import { unifiedDashboardService } from '@/services/unifiedDashboardService.ts';
import { usePageRefresh } from '@/context/PageRefreshContext';
import { useNotification } from '@/context/NotificationContext';
import { documentPrintService } from '@/lib/documentPrintService';

export const MSSReportsView: React.FC = () => {
  const { showNotification } = useNotification();
  const { isRefreshing, triggerRefresh } = usePageRefresh();
  const [period, setPeriod] = useState<ReportPeriod>('month');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Data states
  const [summary, setSummary] = useState<MSSFinancialSummary | null>(null);
  const [branchSales, setBranchSales] = useState<BranchOperationalSales[]>([]);
  const [stockValuation, setStockValuation] = useState<LocationStockValuation[]>([]);
  const [categoryBreakdown, setCategoryBreakdown] = useState<CategoryBreakdown[]>([]);
  const [dailySummaries, setDailySummaries] = useState<DailyMSSSummary[]>([]);
  const [dateLabel, setDateLabel] = useState<string>('');
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('ALL');
  const [soldLaptopsReport, setSoldLaptopsReport] = useState<SoldLaptopsReport | null>(null);
  const [receivables, setReceivables] = useState<{
    totalReceivables: number;
    totalPaidReceivables: number;
    unpaidCount: number;
    partiallyPaidCount: number;
    overdueCount: number;
    paidCount: number;
    debtors: any[];
  } | null>(null);

  const loadReportData = useCallback(async () => {
    setIsLoading(true);
    try {
      const dateFilter = unifiedDashboardService.calculateDateRange(period, customStart, customEnd);
      setDateLabel(dateFilter.label);
      const { startDate, endDate } = dateFilter;

      const [sum, bSales, sVal, catBreak, daily, rec, soldReport] = await Promise.all([
        mssReportsService.getMSSFinancialSummary(startDate, endDate),
        mssReportsService.getBranchOperationalBreakdown(startDate, endDate),
        mssReportsService.getInventoryValuationByLocation(),
        mssReportsService.getCategoryBreakdown(startDate, endDate),
        mssReportsService.getDailyMSSSummaries(14),
        mssReportsService.getMSSReceivablesReport(),
        mssReportsService.getSoldLaptopsByModelReport({ warehouse: selectedWarehouse, startDate, endDate }),
      ]);

      setSummary(sum);
      setBranchSales(bSales);
      setStockValuation(sVal);
      setCategoryBreakdown(catBreak);
      setDailySummaries(daily);
      setReceivables(rec);
      setSoldLaptopsReport(soldReport);
    } catch (err) {
      console.warn('Failed to load MSS report data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [period, customStart, customEnd, selectedWarehouse]);

  useEffect(() => {
    loadReportData();
  }, [loadReportData]);

  const handlePrint = async () => {
    if (!summary) return;
    await documentPrintService.printElement('mss-report-document-root', {
      title: `تقرير_أرباح_Compu_MSS_${dateLabel || 'فترة'}`,
      format: 'report',
      orientation: 'portrait',
    });
  };

  const handlePrintSoldLaptopsReport = async () => {
    if (!soldLaptopsReport) return;
    await documentPrintService.printElement('mss-sold-laptops-report-print', {
      title: `تقرير_مبيعات_الأجهزة_حسب_الموديل_${selectedWarehouse}_${dateLabel || 'فترة'}`,
      format: 'report',
      orientation: 'portrait',
    });
  };

  const handleExportSoldLaptopsPdf = async () => {
    if (!soldLaptopsReport) return;
    showNotification({
      type: 'info',
      title: 'استخراج تقرير مبيعات الأجهزة كـ PDF',
      message: 'تم فتح نافذة الطباعة. اختر "حفظ بتنسيق PDF" (Save as PDF) لحفظ المستند.',
    });
    await handlePrintSoldLaptopsReport();
  };

  const handleExportPdf = async () => {
    if (!summary) return;
    showNotification({
      type: 'info',
      title: 'استخراج تقرير أرباح Compu MSS كـ PDF',
      message: 'تم فتح نافذة الطباعة. اختر "حفظ بتنسيق PDF" (Save as PDF) لحفظ المستند المالي الرسمي.',
    });
    await documentPrintService.exportToPdf('mss-report-document-root', {
      title: `تقرير_أرباح_Compu_MSS_${dateLabel || 'فترة'}`,
      format: 'report',
      orientation: 'portrait',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="تقارير Compu MSS "
        subtitle=""
        actions={
          <div className="flex items-center gap-2.5">
            <Button
              variant="outline"
              size="md"
              onClick={() => triggerRefresh(loadReportData, 'جارٍ تحديث تقارير وأرباح أجهزة Compu MSS...')}
              disabled={isRefreshing || isLoading}
              className="font-semibold"
              leftIcon={<RefreshCw className={`w-4.5 h-4.5 text-slate-500 ${isRefreshing ? 'animate-spin' : ''}`} />}
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
              title="استخراج وحفظ التقرير كملف PDF"
            >
              استخراج PDF
            </Button>
            <Button
              variant="outline"
              size="md"
              onClick={handlePrint}
              disabled={isLoading || !summary}
              className="font-semibold"
              leftIcon={<Printer className="w-4.5 h-4.5 text-slate-500" />}
            >
              طباعة التقرير
            </Button>
          </div>
        }
      />

      {/* Date Filter Bar */}
      <Card className="bg-white border-slate-300 shadow-2xs">
        <CardContent className="p-4 flex flex-wrap items-center justify-between gap-4 text-sm">
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="flex items-center gap-1.5 font-semibold text-slate-700 ml-1">
              <Calendar className="w-4.5 h-4.5 text-slate-500" />
              <span>فترة التقرير:</span>
            </div>

            <div className="inline-flex rounded-xl border border-slate-300 p-1 bg-slate-100 text-sm">
              {[
                { id: 'today', label: 'اليوم' },
                { id: 'yesterday', label: 'أمس' },
                { id: 'week', label: 'آخر 7 أيام' },
                { id: 'month', label: 'آخر 30 يوماً' },
                { id: 'all', label: 'كافة الفترات' },
                { id: 'custom', label: 'مخصص' },
              ].map(p => (
                <button
                  key={p.id}
                  type="button"
                  className={`px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                    period === p.id ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                  onClick={() => setPeriod(p.id as ReportPeriod)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {period === 'custom' && (
            <div className="flex items-center">
              <DateRangeInputs
                startDate={customStart}
                endDate={customEnd}
                onStartDateChange={setCustomStart}
                onEndDateChange={setCustomEnd}
              />
            </div>
          )}

          <div className="text-sm text-slate-600 font-medium">
            النطاق: <span className="text-slate-900 font-bold">{dateLabel}</span>
          </div>
        </CardContent>
      </Card>

      {isLoading || !summary ? (
        <div className="py-16 text-center">
          <Spinner size="lg" />
          <p className="mt-3 text-sm font-medium text-slate-600">جاري إعداد تقارير Compu MSS...</p>
        </div>
      ) : (
        <>
          {/* Financial KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatsCard
              title="إجمالي المبيعات"
              value={formatCurrency(summary.totalRevenue)}
              subtitle={`قبل المرتجعات (${summary.soldDevicesCount} جهاز)`}
              icon={DollarSign}
            />
            <StatsCard
              title="إجمالي المرتجعات "
              value={formatCurrency(summary.totalRefunds)}
              subtitle={`${summary.returnedDevicesCount} جهاز مسترد`}
              icon={RotateCcw}
            />
            <StatsCard
              title="صافي المبيعات "
              value={formatCurrency(summary.netSales)}
              subtitle="الإيراد الفعلي بعد خصم المرتجعات"
              icon={Laptop}
            />
            <StatsCard
              title="مجمل الربح  "
              value={formatCurrency(summary.grossProfit)}
              subtitle={`هامش ربح ${summary.profitMarginPercent.toFixed(1)}% `}
              icon={TrendingUp}
            />
          </div>

          {/* Operational Sales Attribution vs Current Stock by Location */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Operational Sales Attribution */}
            <Card className="bg-white border-slate-300 shadow-2xs overflow-hidden">
              <CardHeader className="py-3.5 px-5 bg-slate-100/90 border-b border-slate-300 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Store className="w-4.5 h-4.5 text-slate-600" />
                  <span>المبيعات  حسب كل فرع </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                {branchSales.map((b, idx) => (
                  <div key={idx} className="p-3.5 bg-slate-50 rounded-xl space-y-2 text-sm border border-slate-300">
                    <div className="flex justify-between items-center font-bold text-slate-900">
                      <span>{b.branch}</span>
                      <span className="font-mono tabular-nums text-base">
                        {formatCurrency(b.revenue)}
                      </span>
                    </div>

                    <div className="flex justify-between text-slate-600 text-xs pt-0.5">
                      <span>نفذ {b.salesCount} عمليات بيع</span>
                      <span className="font-semibold text-slate-800">
                        حصة المبيعات: {b.percentageOfTotalSales.toFixed(1)}%
                      </span>
                    </div>

                    <div className="flex justify-between text-slate-500 text-xs border-t border-slate-200 pt-2">
                      <span>الخصومات الممنوحة بالفرع: {formatCurrency(b.discounts)}</span>
                      <span>عدد عمليات البيع  : {b.crossBranchSalesCount} عملية</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Current Stock Location Valuation */}
            <Card className="bg-white border-slate-300 shadow-2xs overflow-hidden">
              <CardHeader className="py-3.5 px-5 bg-slate-100/90 border-b border-slate-300">
                <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Laptop className="w-4.5 h-4.5 text-slate-600" />
                  <span>قيمة المخزون   حسب كل فرع </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                {stockValuation
                  .filter(l => l.location !== 'المجموع الكلي')
                  .map((loc, idx) => (
                    <div key={idx} className="p-3.5 bg-slate-50 rounded-xl space-y-2 text-sm border border-slate-300">
                      <div className="flex justify-between items-center font-bold text-slate-900">
                        <span>  {loc.location}:</span>
                        <span className="font-mono tabular-nums text-base">
                          {loc.availableUnits} جهاز متوفر
                        </span>
                      </div>

                      <div className="flex justify-between text-slate-600 text-xs pt-0.5">
                        <span>قيمة التكلفة: {formatCurrency(loc.totalCostValue)}</span>
                        <span>القيمة السوقية: {formatCurrency(loc.totalListValue)}</span>
                      </div>

                      <div className="flex justify-between text-slate-500 text-xs border-t border-slate-200 pt-2">
                        <span>أجهزة محجوزة: {loc.reservedUnits}</span>
                        <span className="font-bold text-emerald-700">
                          الربح المتوقع: {formatCurrency(loc.potentialGrossProfit)}
                        </span>
                      </div>
                    </div>
                  ))}
              </CardContent>
            </Card>
          </div>

          {/* Category Breakdown (Laptops vs Monitors) */}
          <Card className="bg-white border-slate-300 shadow-2xs overflow-hidden">
            <CardHeader className="py-3.5 px-5 bg-slate-100/90 border-b border-slate-300">
              <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Monitor className="w-4.5 h-4.5 text-slate-600" />
                <span>تحليل المبيعات حسب فئة الأجهزة </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {categoryBreakdown.map((cat, idx) => (
                  <div key={idx} className="p-4 bg-slate-50 rounded-xl border border-slate-300 space-y-2.5 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-slate-900 text-base">{cat.category}</span>
                      <Badge variant="default" size="sm">
                        {cat.unitsSold} جهاز مباع
                      </Badge>
                    </div>
                    <div className="flex justify-between text-slate-600 pt-1">
                      <span>إجمالي الإيرادات:</span>
                      <span className="font-bold text-slate-900 font-mono tabular-nums">{formatCurrency(cat.revenue)}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>تكلفة البضاعة المباعة:</span>
                      <span className="font-bold text-slate-900 font-mono tabular-nums">{formatCurrency(cat.cogs)}</span>
                    </div>
                    <div className="flex justify-between text-slate-900 font-bold border-t border-slate-200 pt-2">
                      <span>مجمل الربح :</span>
                      <span className="text-emerald-700 font-mono text-base tabular-nums">{formatCurrency(cat.grossProfit)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Daily Trend Table */}
          <Card className="bg-white border-slate-300 shadow-2xs overflow-hidden">
            <CardHeader className="py-3.5 px-5 bg-slate-100/90 border-b border-slate-300">
              <CardTitle className="text-sm font-bold text-slate-900">
                حركة مبيعات   Compu MSS اليومية (آخر 14 يوماً)
              </CardTitle>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead className="bg-slate-100/90 text-xs font-bold text-slate-700 uppercase tracking-wider border-b border-slate-300">
                  <tr>
                    <th className="py-3 px-3.5">التاريخ</th>
                    <th className="py-3 px-3.5 text-center">عدد المبيعات</th>
                    <th className="py-3 px-3.5 text-left">الإيراد اليومي</th>
                    <th className="py-3 px-3.5 text-left">تكلفة الأجهزة المباعة</th>
                    <th className="py-3 px-3.5 text-left">المرتجعات</th>
                    <th className="py-3 px-3.5 text-left">مجمل الربح اليومي</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {dailySummaries.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500">
                        لا توجد بيانات مسجلة في هذه الفترة
                      </td>
                    </tr>
                  ) : (
                    dailySummaries.map((day, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-3.5 font-mono font-medium text-slate-900 tabular-nums">{day.date}</td>
                        <td className="py-3 px-3.5 text-center font-mono tabular-nums text-slate-700 font-semibold">{day.salesCount}</td>
                        <td className="py-3 px-3.5 text-left font-mono font-bold text-slate-900 tabular-nums">{formatCurrency(day.revenue)}</td>
                        <td className="py-3 px-3.5 text-left font-mono text-slate-600 tabular-nums">{formatCurrency(day.cogs)}</td>
                        <td className="py-3 px-3.5 text-left font-mono font-semibold text-rose-600 tabular-nums">{day.refunds > 0 ? formatCurrency(day.refunds) : '—'}</td>
                        <td className={`py-3 px-3.5 text-left font-mono font-bold tabular-nums ${day.grossProfit >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                          {formatCurrency(day.grossProfit)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {/* ========================================================================= */}
          {/* SECTION: Sold Laptops by Model and Warehouse Report (Requirement 2) */}
          {/* ========================================================================= */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <Laptop className="w-5 h-5 text-blue-700" />
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    تقرير مبيعات الأجهزة حسب الموديل والمخزن (Sold Laptops by Model & Warehouse)
                  </h3>
                  <p className="text-xs text-slate-500">
                    تقرير معتمد لحصر الأجهزة والكميات المباعة لكل موديل وفقاً للفرع البائع الأصلي
                  </p>
                </div>
              </div>

              {/* Warehouse Selection & Print Actions */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-300 gap-1">
                  <button
                    onClick={() => setSelectedWarehouse('ALL')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      selectedWarehouse === 'ALL'
                        ? 'bg-white text-slate-900 shadow-subtle font-bold border border-slate-300'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    كافة الفروع
                  </button>
                  <button
                    onClick={() => setSelectedWarehouse('محل 1')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      selectedWarehouse === 'محل 1'
                        ? 'bg-white text-slate-900 shadow-subtle font-bold border border-slate-300'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    محل 1
                  </button>
                  <button
                    onClick={() => setSelectedWarehouse('محل 2')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      selectedWarehouse === 'محل 2'
                        ? 'bg-white text-slate-900 shadow-subtle font-bold border border-slate-300'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    محل 2
                  </button>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrintSoldLaptopsReport}
                  leftIcon={<Printer className="w-4 h-4 text-slate-700" />}
                  className="font-bold text-xs"
                >
                  طباعة التقرير
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportSoldLaptopsPdf}
                  leftIcon={<FileDown className="w-4 h-4 text-blue-700" />}
                  className="font-bold text-xs text-blue-700 border-blue-200 bg-blue-50/50 hover:bg-blue-100"
                >
                  تصدير PDF
                </Button>
              </div>
            </div>

            {/* Sold Laptops KPI Summary Cards */}
            {soldLaptopsReport && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                <div className="p-4 bg-white border border-slate-300 rounded-xl shadow-2xs">
                  <span className="text-xs font-semibold text-slate-500 block mb-1">
                    إجمالي الوحدات المباعة
                  </span>
                  <span className="font-mono text-xl font-bold text-slate-900 tabular-nums">
                    {soldLaptopsReport.total_sold_units} جهاز
                  </span>
                  <span className="text-[10px] text-slate-500 block mt-0.5">
                    {selectedWarehouse === 'ALL' ? 'عبر كافة الفروع' : `من ${selectedWarehouse}`}
                  </span>
                </div>

                <div className="p-4 bg-white border border-slate-300 rounded-xl shadow-2xs">
                  <span className="text-xs font-semibold text-slate-500 block mb-1">
                    إجمالي إيرادات الموديلات
                  </span>
                  <span className="font-mono text-xl font-bold text-emerald-700 tabular-nums">
                    {formatCurrency(soldLaptopsReport.total_revenue)}
                  </span>
                  <span className="text-[10px] text-slate-500 block mt-0.5">
                    صافي الفواتير المعتمدة
                  </span>
                </div>

                <div className="p-4 bg-white border border-slate-300 rounded-xl shadow-2xs">
                  <span className="text-xs font-semibold text-slate-500 block mb-1">
                    مبيعات محل 1
                  </span>
                  <span className="font-mono text-xl font-bold text-blue-800 tabular-nums">
                    {soldLaptopsReport.warehouse_totals['محل 1'] || 0} جهاز
                  </span>
                  <span className="text-[10px] text-slate-500 block mt-0.5">
                    الفرع الأول
                  </span>
                </div>

                <div className="p-4 bg-white border border-slate-300 rounded-xl shadow-2xs">
                  <span className="text-xs font-semibold text-slate-500 block mb-1">
                    مبيعات محل 2
                  </span>
                  <span className="font-mono text-xl font-bold text-purple-800 tabular-nums">
                    {soldLaptopsReport.warehouse_totals['محل 2'] || 0} جهاز
                  </span>
                  <span className="text-[10px] text-slate-500 block mt-0.5">
                    الفرع الثاني
                  </span>
                </div>
              </div>
            )}

            {/* Sold Laptops Table */}
            <Card className="bg-white border-slate-300 shadow-2xs overflow-hidden">
              <CardHeader className="py-3 px-4 bg-slate-50/90 border-b border-slate-300 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-bold text-slate-900">
                  قائمة الموديلات المباعة ({soldLaptopsReport?.items.length || 0} موديل) — {selectedWarehouse === 'ALL' ? 'كافة الفروع' : selectedWarehouse}
                </CardTitle>
                <span className="text-xs text-slate-500 font-medium">
                  النطاق الزمني: <strong className="text-slate-800">{dateLabel || 'كافة الفترات'}</strong>
                </span>
              </CardHeader>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-right">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">#</th>
                      <th className="py-2.5 px-3">الموديل والماركة</th>
                      <th className="py-2.5 px-3">التصنيف</th>
                      {selectedWarehouse === 'ALL' ? (
                        <>
                          <th className="py-2.5 px-3 text-center bg-blue-50/30">مبيعات محل 1</th>
                          <th className="py-2.5 px-3 text-center bg-purple-50/30">مبيعات محل 2</th>
                        </>
                      ) : (
                        <th className="py-2.5 px-3 text-center">المخزن / الفرع</th>
                      )}
                      <th className="py-2.5 px-3 text-center">إجمالي الوحدات المباعة</th>
                      <th className="py-2.5 px-3 text-left">إجمالي الإيراد</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {!soldLaptopsReport || soldLaptopsReport.items.length === 0 ? (
                      <tr>
                        <td colSpan={selectedWarehouse === 'ALL' ? 7 : 6} className="py-8 text-center text-slate-500">
                          لا توجد مبيعات مسجلة لأجهزة اللابتوب في هذه الفترة {selectedWarehouse !== 'ALL' ? `لهذا الفرع (${selectedWarehouse})` : ''}
                        </td>
                      </tr>
                    ) : (
                      soldLaptopsReport.items.map((it, idx) => (
                        <tr key={it.model_id} className="hover:bg-slate-50">
                          <td className="py-2.5 px-3 font-mono text-slate-500 text-[11px]">{idx + 1}</td>
                          <td className="py-2.5 px-3">
                            <span className="font-bold text-slate-900 block">{it.brand} {it.model_name}</span>
                            {it.model_code && (
                              <span className="font-mono text-[10px] text-slate-500 bg-slate-100 px-1 py-0.5 rounded border border-slate-200">
                                {it.model_code}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3">
                            <Badge variant="default" size="sm" className="text-[10px]">
                              {it.category}
                            </Badge>
                          </td>
                          {selectedWarehouse === 'ALL' ? (
                            <>
                              <td className="py-2.5 px-3 text-center font-mono font-bold text-blue-900 bg-blue-50/10">
                                {it.warehouse_breakdown['محل 1'] || 0}
                              </td>
                              <td className="py-2.5 px-3 text-center font-mono font-bold text-purple-900 bg-purple-50/10">
                                {it.warehouse_breakdown['محل 2'] || 0}
                              </td>
                            </>
                          ) : (
                            <td className="py-2.5 px-3 text-center">
                              <Badge variant={selectedWarehouse === 'محل 1' ? 'primary' : 'default'} size="sm">
                                {selectedWarehouse}
                              </Badge>
                            </td>
                          )}
                          <td className="py-2.5 px-3 text-center">
                            <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2.5 py-0.5 rounded border border-slate-200 text-xs">
                              {it.total_sold_units}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-left font-mono font-bold text-emerald-800 text-xs">
                            {formatCurrency(it.total_revenue)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {soldLaptopsReport && soldLaptopsReport.items.length > 0 && (
                    <tfoot className="bg-slate-100 font-bold border-t-2 border-slate-300 text-slate-900 text-xs">
                      <tr>
                        <td colSpan={3} className="py-3 px-3 text-right">
                          الإجمالي الكلي لتقرير المبيعات ({soldLaptopsReport.items.length} موديل):
                        </td>
                        {selectedWarehouse === 'ALL' ? (
                          <>
                            <td className="py-3 px-3 text-center font-mono text-blue-900">
                              {soldLaptopsReport.warehouse_totals['محل 1'] || 0} جهاز
                            </td>
                            <td className="py-3 px-3 text-center font-mono text-purple-900">
                              {soldLaptopsReport.warehouse_totals['محل 2'] || 0} جهاز
                            </td>
                          </>
                        ) : (
                          <td className="py-3 px-3 text-center font-mono">
                            {selectedWarehouse}
                          </td>
                        )}
                        <td className="py-3 px-3 text-center font-mono text-slate-950 text-sm">
                          {soldLaptopsReport.total_sold_units} جهاز
                        </td>
                        <td className="py-3 px-3 text-left font-mono text-emerald-900 text-sm">
                          {formatCurrency(soldLaptopsReport.total_revenue)}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </Card>
          </div>

          {/* Compu MSS Customer Receivables & Debt Collection Section */}
          {receivables && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                <Wallet className="w-5 h-5 text-amber-700" />
                <h3 className="text-base font-bold text-slate-900">
                  تقرير مديونيات وأقساط عملاء أجهزة Compu MSS (Customer Receivables)
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
                    قائمة عملاء الأجهزة أصحاب الأرصدة والديون المعلقة ({receivables.debtors.length})
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
                        <th className="py-2.5 px-3">الجهاز والسيريال</th>
                        <th className="py-2.5 px-3">الفرع</th>
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
                          <td colSpan={11} className="py-8 text-center text-slate-500">
                            لا توجد أي ديون أو مبالغ آجلة معلقة على أجهزة Compu MSS!
                          </td>
                        </tr>
                      ) : (
                        receivables.debtors.map(d => (
                          <tr key={d.invoiceId} className="hover:bg-slate-50">
                            <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                              {d.invoiceNumber}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-slate-600">
                              {formatDate(d.saleDate)}
                            </td>
                            <td className="py-2.5 px-3 font-bold text-slate-900">{d.customerName}</td>
                            <td className="py-2.5 px-3 font-mono text-slate-500">{d.customerPhone || '—'}</td>
                            <td className="py-2.5 px-3">
                              <span className="font-bold block">{d.brand} {d.modelName}</span>
                              <span className="font-mono text-[10px] text-slate-500">{d.serialNumber}</span>
                            </td>
                            <td className="py-2.5 px-3">
                              <Badge variant={d.sellingBranch === 'محل 1' ? 'primary' : 'default'} size="sm">
                                {d.sellingBranch}
                              </Badge>
                            </td>
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
                              {d.dueDate ? formatDate(d.dueDate) : '—'}
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

          {/* Hidden Pristine Compu MSS Report Template for Print & PDF */}
          <div className="hidden" aria-hidden="true">
            <div id="mss-report-document-root" className="p-8 bg-white text-slate-900 space-y-6 max-w-[210mm] mx-auto" dir="rtl">
              {/* Report Header */}
              <div className="border-b-2 border-slate-900 pb-5 flex justify-between items-start">
                <div>
                  <h1 className="text-2xl font-bold text-slate-950 tracking-tight">Compu MSS   </h1>
                  <p className="text-sm font-semibold text-slate-700 mt-1">تقرير الأداء المالي والأرباح  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    فترة التقرير: <span className="font-bold text-slate-900">{dateLabel || 'كافة الفترات'}</span>
                  </p>
                </div>
                <div className="text-left font-mono text-xs text-slate-500" dir="ltr">
                  <p className="font-bold text-slate-900">Compu MSS Management</p>
                  <p>تاريخ الإصدار: {new Date().toLocaleDateString('ar-EG')}</p>
                </div>
              </div>

              {/* Financial KPI Summary Table */}
              <div className="border border-slate-300 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100 border-b border-slate-300 font-bold text-slate-800 text-xs">
                    <tr>
                      <th className="py-2.5 px-3.5 text-right">المؤشر المالي</th>
                      <th className="py-2.5 px-3.5 text-left">القيمة (EGP)</th>
                      <th className="py-2.5 px-3.5 text-right">ملاحظات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    <tr>
                      <td className="py-2 px-3.5 font-bold">إجمالي المبيعات </td>
                      <td className="py-2 px-3.5 font-mono font-bold text-left tabular-nums">{formatCurrency(summary.totalRevenue)}</td>
                      <td className="py-2 px-3.5 text-xs text-slate-600">قبل خصم المرتجعات ({summary.soldDevicesCount} جهاز)</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3.5 font-bold">إجمالي المرتجعات </td>
                      <td className="py-2 px-3.5 font-mono font-bold text-left text-rose-700 tabular-nums">{formatCurrency(summary.totalRefunds)}</td>
                      <td className="py-2 px-3.5 text-xs text-slate-600">{summary.returnedDevicesCount} جهاز مسترد إلى المخزون</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3.5 font-bold">صافي الإيرادات </td>
                      <td className="py-2 px-3.5 font-mono font-bold text-left text-blue-900 tabular-nums">{formatCurrency(summary.netSales)}</td>
                      <td className="py-2 px-3.5 text-xs text-slate-600">الإيراد الفعلي بعد استبعاد المرتجعات</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3.5 font-bold">تكلفة الأجهزة المباعة </td>
                      <td className="py-2 px-3.5 font-mono font-bold text-left text-slate-700 tabular-nums">{formatCurrency(summary.costOfGoodsSold)}</td>
                      <td className="py-2 px-3.5 text-xs text-slate-600">تكلفة شراء الأجهزة المحفوظة تاريخياً</td>
                    </tr>
                    <tr className="bg-slate-50 font-bold">
                      <td className="py-3 px-3.5 text-base text-emerald-900">مجمل الربح المشترك </td>
                      <td className="py-3 px-3.5 font-mono text-base font-bold text-left text-emerald-800 tabular-nums">{formatCurrency(summary.grossProfit)}</td>
                      <td className="py-3 px-3.5 text-xs text-emerald-900 font-semibold">هامش ربح {summary.profitMarginPercent.toFixed(1)}% </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Branch Operational Sales Breakdown */}
              <div className="space-y-2 pt-2">
                <h3 className="text-sm font-bold text-slate-900">أداء  البيع حسب كل فرع  :</h3>
                <div className="border border-slate-300 rounded-lg overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-100 border-b border-slate-300 font-bold text-slate-700">
                      <tr>
                        <th className="py-2 px-3 text-right">الفرع </th>
                        <th className="py-2 px-3 text-center">عدد الأجهزة</th>
                        <th className="py-2 px-3 text-left">إجمالي المبيعات</th>
                        <th className="py-2 px-3 text-left">نسبة البيع</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {branchSales.map(b => (
                        <tr key={b.branch}>
                          <td className="py-2 px-3 font-bold">{b.branch}</td>
                          <td className="py-2 px-3 text-center font-mono tabular-nums">{b.salesCount}</td>
                          <td className="py-2 px-3 text-left font-mono font-bold tabular-nums">{formatCurrency(b.revenue)}</td>
                          <td className="py-2 px-3 text-left font-mono tabular-nums">{b.percentageOfTotalRevenue.toFixed(1)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Inventory Valuation by Location */}
              <div className="space-y-2 pt-2">
                <h3 className="text-sm font-bold text-slate-900">تقييم المخزون المتاح حسب الموقع:</h3>
                <div className="border border-slate-300 rounded-lg overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-100 border-b border-slate-300 font-bold text-slate-700">
                      <tr>
                        <th className="py-2 px-3 text-right">الموقع </th>
                        <th className="py-2 px-3 text-center">الأجهزة المتاحة</th>
                        <th className="py-2 px-3 text-left">قيمة الشراء </th>
                        <th className="py-2 px-3 text-left">القيمة البيعية المتوقعة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {stockValuation.map(s => (
                        <tr key={s.location}>
                          <td className="py-2 px-3 font-bold">{s.location}</td>
                          <td className="py-2 px-3 text-center font-mono tabular-nums">{s.availableUnits}</td>
                          <td className="py-2 px-3 text-left font-mono font-bold tabular-nums">{formatCurrency(s.totalCostValue)}</td>
                          <td className="py-2 px-3 text-left font-mono font-bold text-emerald-800 tabular-nums">{formatCurrency(s.totalListValue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Signatures & Approvals */}
              <div className="pt-6 border-t-2 border-slate-300 grid grid-cols-2 gap-8 text-xs text-slate-700" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                <div className="space-y-6">
                  <p className="font-bold">إعداد / إدارة المبيعات:</p>
                  <p className="border-b border-dotted border-slate-400 pb-1 w-48">التوقيع: ___________________</p>
                </div>
                <div className="space-y-6 text-left" dir="rtl">
                  <p className="font-bold">اعتماد الإدارة العامة والشراكة:</p>
                  <p className="border-b border-dotted border-slate-400 pb-1 w-48">الختم والاعتماد: ___________________</p>
                </div>
              </div>

              {/* Footer Notice */}
              <div className="pt-4 border-t border-slate-200 flex justify-between items-center text-[10px] text-slate-500 font-mono">
                <span>نظام Compu MSS — تم استخراج التقرير إلكترونياً وهو معتمد رسمياً</span>
                <span>© 2026 Ahmed Saber. All rights reserved. • Contact: 01030137635</span>
              </div>
            </div>
          </div>

          {/* Hidden Sold Laptops by Model and Warehouse Report Template for Print & PDF */}
          <div className="hidden" aria-hidden="true">
            <div id="mss-sold-laptops-report-print" className="p-8 bg-white text-slate-900 space-y-6 max-w-[210mm] mx-auto" dir="rtl">
              {/* Report Header */}
              <div className="border-b-2 border-slate-900 pb-5 flex justify-between items-start">
                <div>
                  <h1 className="text-2xl font-bold text-slate-950 tracking-tight">Compu MSS</h1>
                  <p className="text-base font-semibold text-slate-800 mt-1">تقرير مبيعات الأجهزة حسب الموديل والمخزن</p>
                  <p className="text-xs text-slate-600 mt-1">
                    الفرع المستهدف: <span className="font-bold text-slate-900">{selectedWarehouse === 'ALL' ? 'كافة الفروع والمخازن' : selectedWarehouse}</span>
                    <span className="mx-2">•</span>
                    فترة التقرير: <span className="font-bold text-slate-900">{dateLabel || 'كافة الفترات'}</span>
                  </p>
                </div>
                <div className="text-left font-mono text-xs text-slate-500" dir="ltr">
                  <p className="font-bold text-slate-900">Compu MSS Sales Management</p>
                  <p>تاريخ الاستخراج: {new Date().toLocaleDateString('ar-EG')}</p>
                </div>
              </div>

              {/* KPI Summary Table */}
              {soldLaptopsReport && (
                <div className="grid grid-cols-3 gap-4 border border-slate-300 p-3 rounded-lg bg-slate-50 text-xs">
                  <div>
                    <span className="text-slate-600 block">إجمالي الوحدات المباعة:</span>
                    <span className="font-mono text-base font-bold text-slate-950">{soldLaptopsReport.total_sold_units} جهاز</span>
                  </div>
                  <div>
                    <span className="text-slate-600 block">إجمالي الإيرادات:</span>
                    <span className="font-mono text-base font-bold text-emerald-800">{formatCurrency(soldLaptopsReport.total_revenue)}</span>
                  </div>
                  <div>
                    <span className="text-slate-600 block">تفصيل الفروع:</span>
                    <span className="font-mono font-bold text-slate-800">
                      محل 1: {soldLaptopsReport.warehouse_totals['محل 1'] || 0} • محل 2: {soldLaptopsReport.warehouse_totals['محل 2'] || 0}
                    </span>
                  </div>
                </div>
              )}

              {/* Items Table */}
              <div className="border border-slate-300 rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-slate-100 border-b border-slate-300 font-bold text-slate-800">
                    <tr>
                      <th className="py-2 px-2.5 text-right">#</th>
                      <th className="py-2 px-2.5 text-right">الموديل والماركة</th>
                      <th className="py-2 px-2.5 text-right">التصنيف</th>
                      {selectedWarehouse === 'ALL' ? (
                        <>
                          <th className="py-2 px-2.5 text-center">محل 1</th>
                          <th className="py-2 px-2.5 text-center">محل 2</th>
                        </>
                      ) : (
                        <th className="py-2 px-2.5 text-center">الفرع</th>
                      )}
                      <th className="py-2 px-2.5 text-center">إجمالي المباع</th>
                      <th className="py-2 px-2.5 text-left">إجمالي الإيراد</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {!soldLaptopsReport || soldLaptopsReport.items.length === 0 ? (
                      <tr>
                        <td colSpan={selectedWarehouse === 'ALL' ? 6 : 5} className="py-6 text-center text-slate-500">
                          لا توجد مبيعات في هذه الفترة
                        </td>
                      </tr>
                    ) : (
                      soldLaptopsReport.items.map((it, idx) => (
                        <tr key={it.model_id}>
                          <td className="py-2 px-2.5 font-mono">{idx + 1}</td>
                          <td className="py-2 px-2.5 font-bold">
                            {it.brand} {it.model_name}
                            {it.model_code && <span className="mr-1 text-[10px] text-slate-500">({it.model_code})</span>}
                          </td>
                          <td className="py-2 px-2.5">{it.category}</td>
                          {selectedWarehouse === 'ALL' ? (
                            <>
                              <td className="py-2 px-2.5 text-center font-mono">{it.warehouse_breakdown['محل 1'] || 0}</td>
                              <td className="py-2 px-2.5 text-center font-mono">{it.warehouse_breakdown['محل 2'] || 0}</td>
                            </>
                          ) : (
                            <td className="py-2 px-2.5 text-center">{selectedWarehouse}</td>
                          )}
                          <td className="py-2 px-2.5 text-center font-mono font-bold">{it.total_sold_units}</td>
                          <td className="py-2 px-2.5 text-left font-mono font-bold text-emerald-800">{formatCurrency(it.total_revenue)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {soldLaptopsReport && (
                    <tfoot className="bg-slate-100 font-bold border-t-2 border-slate-300">
                      <tr>
                        <td colSpan={3} className="py-2.5 px-2.5 text-right">المجموع الكلي:</td>
                        {selectedWarehouse === 'ALL' ? (
                          <>
                            <td className="py-2.5 px-2.5 text-center font-mono">{soldLaptopsReport.warehouse_totals['محل 1'] || 0}</td>
                            <td className="py-2.5 px-2.5 text-center font-mono">{soldLaptopsReport.warehouse_totals['محل 2'] || 0}</td>
                          </>
                        ) : (
                          <td className="py-2.5 px-2.5 text-center">{selectedWarehouse}</td>
                        )}
                        <td className="py-2.5 px-2.5 text-center font-mono text-sm">{soldLaptopsReport.total_sold_units}</td>
                        <td className="py-2.5 px-2.5 text-left font-mono text-emerald-900 text-sm">{formatCurrency(soldLaptopsReport.total_revenue)}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>

              {/* Signatures & Approvals */}
              <div className="pt-6 border-t-2 border-slate-300 grid grid-cols-2 gap-8 text-xs text-slate-700" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                <div className="space-y-6">
                  <p className="font-bold">مسؤول مبيعات الفرع:</p>
                  <p className="border-b border-dotted border-slate-400 pb-1 w-48">التوقيع: ___________________</p>
                </div>
                <div className="space-y-6 text-left" dir="rtl">
                  <p className="font-bold">اعتماد الإدارة والمخازن:</p>
                  <p className="border-b border-dotted border-slate-400 pb-1 w-48">الختم والاعتماد: ___________________</p>
                </div>
              </div>

              {/* Footer Notice */}
              <div className="pt-4 border-t border-slate-200 flex justify-between items-center text-[10px] text-slate-500 font-mono">
                <span>نظام Compu MSS — تقرير رسمي لمبيعات الأجهزة حسب الموديل والمخزن</span>
                <span>© 2026 Compu MSS. All rights reserved.</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
