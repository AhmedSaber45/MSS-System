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
  Calendar,
  RefreshCw,
  Monitor,
  RotateCcw,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { DateRangeInputs } from '@/components/common/DateRangeInputs';
import { mssReportsService } from '@/services/mssReportsService.ts';
import type {
  MSSFinancialSummary,
  BranchOperationalSales,
  LocationStockValuation,
  CategoryBreakdown,
  DailyMSSSummary,
} from '@/types/mssReports.ts';
import type { ReportPeriod } from '@/types/unifiedDashboard.ts';
import { unifiedDashboardService } from '@/services/unifiedDashboardService.ts';

export const MSSReportsView: React.FC = () => {
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

  const loadReportData = useCallback(async () => {
    setIsLoading(true);
    try {
      const dateFilter = unifiedDashboardService.calculateDateRange(period, customStart, customEnd);
      setDateLabel(dateFilter.label);
      const { startDate, endDate } = dateFilter;

      const [sum, bSales, sVal, catBreak, daily] = await Promise.all([
        mssReportsService.getMSSFinancialSummary(startDate, endDate),
        mssReportsService.getBranchOperationalBreakdown(startDate, endDate),
        mssReportsService.getInventoryValuationByLocation(),
        mssReportsService.getCategoryBreakdown(startDate, endDate),
        mssReportsService.getDailyMSSSummaries(14),
      ]);

      setSummary(sum);
      setBranchSales(bSales);
      setStockValuation(sVal);
      setCategoryBreakdown(catBreak);
      setDailySummaries(daily);
    } catch (err) {
      console.warn('Failed to load MSS report data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [period, customStart, customEnd]);

  useEffect(() => {
    loadReportData();
  }, [loadReportData]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="تقارير  MSS  والأرباح"
        subtitle="تقرير الإيرادات المشتركة وتكاليف شراء الأجهزة ومجمل الأرباح وإحصائيات مبيعات الفروع المعتمدة"
        actions={
          <div className="flex items-center gap-2.5">
            <Button
              variant="outline"
              size="md"
              onClick={loadReportData}
              isLoading={isLoading}
              className="font-semibold"
              leftIcon={<RefreshCw className="w-4.5 h-4.5 text-slate-500" />}
            >
              Refresh
            </Button>
            <Button
              variant="outline"
              size="md"
              onClick={handlePrint}
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

      {/* Rule 16 Explicit Callout Alert */}
      <Alert
        type="info"
        title="محددات أرباح  MSS  (Rule 16)"
        message="أرباح   MSS تُحسب حصراً على مستوى النشاط ككل كشراكة موحدة (إجمالي سعر البيع الفعلي ناقص تكلفة شراء الأجهزة المحفوظة تاريخياً). تقارير مبيعات الفروع تمثل الأداء التشغيلي والتحصيل فقط، ولا يجوز اعتبارها أو توزيعها كأرباح فردية منفصلة للفرع البائع."
      />

      {isLoading || !summary ? (
        <div className="py-16 text-center">
          <Spinner size="lg" />
          <p className="mt-3 text-sm font-medium text-slate-600">جاري إعداد تقارير  MSS...</p>
        </div>
      ) : (
        <>
          {/* Financial KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatsCard
              title="إجمالي المبيعات (Gross Sales)"
              value={formatCurrency(summary.totalRevenue)}
              subtitle={`قبل المرتجعات (${summary.soldDevicesCount} جهاز)`}
              icon={DollarSign}
            />
            <StatsCard
              title="إجمالي المرتجعات (Returns)"
              value={formatCurrency(summary.totalRefunds)}
              subtitle={`${summary.returnedDevicesCount} جهاز مسترد`}
              icon={RotateCcw}
            />
            <StatsCard
              title="صافي المبيعات (Net Sales)"
              value={formatCurrency(summary.netSales)}
              subtitle="الإيراد الفعلي بعد خصم المرتجعات"
              icon={Laptop}
            />
            <StatsCard
              title="مجمل الربح المشترك (Gross Profit)"
              value={formatCurrency(summary.grossProfit)}
              subtitle={`هامش ربح ${summary.profitMarginPercent.toFixed(1)}% على مستوى النشاط`}
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
                  <span>المبيعات التشغيلية حسب فرع التنفيذ</span>
                </CardTitle>
                <Badge variant="default" size="sm">
                  تشغيلي وتحصيل
                </Badge>
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
                      <span>مبيعات عبر الفروع: {b.crossBranchSalesCount} عملية</span>
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
                  <span>قيمة المخزون الفعلي الحالي حسب الموقع</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                {stockValuation
                  .filter(l => l.location !== 'المجموع الكلي')
                  .map((loc, idx) => (
                    <div key={idx} className="p-3.5 bg-slate-50 rounded-xl space-y-2 text-sm border border-slate-300">
                      <div className="flex justify-between items-center font-bold text-slate-900">
                        <span>المخزن الفيزيائي: {loc.location}</span>
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
                <span>تحليل المبيعات حسب فئة الأجهزة (لابتوبات مقابل شاشات)</span>
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
                      <span>مجمل الربح المحقق:</span>
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
                حركة مبيعات وأرباح أجهزة MSS اليومية (آخر 14 يوماً)
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
        </>
      )}
    </div>
  );
};
