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
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
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
    <div className="space-y-5">
      {/* Header */}
      <PageHeader
        title="تقارير بيزنس MSS المشترك والأرباح"
        subtitle="تقرير الإيرادات المشتركة وتكاليف شراء الأجهزة ومجمل الأرباح وإحصائيات مبيعات الفروع المعتمدة"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadReportData}
              leftIcon={<RefreshCw className={`w-4 h-4 text-slate-500 ${isLoading ? 'animate-spin' : ''}`} />}
            >
              تحديث
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              leftIcon={<Printer className="w-4 h-4 text-slate-500" />}
            >
              طباعة التقرير
            </Button>
          </div>
        }
      />

      {/* Date Filter Bar */}
      <Card className="bg-white border-slate-200/80 shadow-2xs">
        <CardContent className="p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 font-medium text-slate-500 ml-1">
              <Calendar className="w-4 h-4 text-slate-400" />
              <span>فترة التقرير:</span>
            </div>

            <div className="inline-flex rounded-lg border border-slate-200/80 p-0.5 bg-slate-100 text-xs">
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
                  className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                    period === p.id ? 'bg-white text-slate-900 shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'
                  }`}
                  onClick={() => setPeriod(p.id as ReportPeriod)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {period === 'custom' && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customStart}
                onChange={e => setCustomStart(e.target.value)}
                className="text-xs font-mono border border-slate-200/80 rounded-md px-2 py-1 bg-white"
                placeholder="من تاريخ"
              />
              <span className="text-slate-400 text-xs">إلى</span>
              <input
                type="date"
                value={customEnd}
                onChange={e => setCustomEnd(e.target.value)}
                className="text-xs font-mono border border-slate-200/80 rounded-md px-2 py-1 bg-white"
                placeholder="إلى تاريخ"
              />
            </div>
          )}

          <div className="text-xs text-slate-500">
            النطاق: <span className="text-slate-800 font-medium">{dateLabel}</span>
          </div>
        </CardContent>
      </Card>

      {/* Rule 16 Explicit Callout Alert */}
      <Alert
        type="info"
        title="محددات أرباح بيزنس MSS المشترك (Rule 16)"
        message="أرباح بيزنس أجهزة MSS تُحسب حصراً على مستوى النشاط ككل كشراكة موحدة (إجمالي سعر البيع الفعلي ناقص تكلفة شراء الأجهزة المحفوظة تاريخياً). تقارير مبيعات الفروع تمثل الأداء التشغيلي والتحصيل فقط، ولا يجوز اعتبارها أو توزيعها كأرباح فردية منفصلة للفرع البائع."
      />

      {isLoading || !summary ? (
        <div className="py-16 text-center">
          <Spinner size="lg" />
          <p className="mt-3 text-xs text-slate-500">جاري إعداد تقارير بيزنس MSS...</p>
        </div>
      ) : (
        <>
          {/* Top 4 KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatsCard
              title="إجمالي إيرادات أجهزة MSS"
              value={formatCurrency(summary.totalRevenue)}
              subtitle={`صافي البيع: ${formatCurrency(summary.netSales)}`}
              icon={DollarSign}
            />
            <StatsCard
              title="تكلفة شراء الأجهزة المباعة"
              value={formatCurrency(summary.costOfGoodsSold)}
              subtitle="محسوبة من لقطات التكلفة التاريخية"
              icon={Laptop}
            />
            <StatsCard
              title="مجمل الربح المشترك"
              value={formatCurrency(summary.grossProfit)}
              subtitle={`هامش ربح ${summary.profitMarginPercent.toFixed(1)}% على مستوى النشاط`}
              icon={TrendingUp}
            />
            <StatsCard
              title="عدد الأجهزة المباعة"
              value={`${summary.soldDevicesCount} جهاز`}
              subtitle={
                summary.returnedDevicesCount > 0
                  ? `بما فيها ${summary.returnedDevicesCount} مرتجع مسترد`
                  : 'متوسط ربح ' + formatCurrency(summary.avgDeviceProfit) + '/جهاز'
              }
              icon={Store}
            />
          </div>

          {/* Operational Sales Attribution vs Current Stock by Location */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Operational Sales Attribution */}
            <Card className="bg-white border-slate-200/80 shadow-2xs overflow-hidden">
              <CardHeader className="py-3 px-4 bg-slate-50/75 border-b border-slate-200/80 flex flex-row items-center justify-between">
                <CardTitle className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
                  <Store className="w-4 h-4 text-slate-500" />
                  <span>المبيعات التشغيلية حسب فرع التنفيذ</span>
                </CardTitle>
                <Badge variant="default" size="sm">
                  تشغيلي وتحصيل
                </Badge>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                {branchSales.map((b, idx) => (
                  <div key={idx} className="p-3 bg-slate-50 rounded-lg space-y-1.5 text-xs border border-slate-200/80">
                    <div className="flex justify-between items-center font-medium text-slate-800">
                      <span>{b.branch}</span>
                      <span className="font-semibold text-slate-900 font-mono tabular-nums">
                        {formatCurrency(b.revenue)}
                      </span>
                    </div>

                    <div className="flex justify-between text-slate-500 text-[11px] pt-0.5">
                      <span>نفذ {b.salesCount} عمليات بيع</span>
                      <span className="font-medium text-slate-700">
                        حصة المبيعات: {b.percentageOfTotalSales.toFixed(1)}%
                      </span>
                    </div>

                    <div className="flex justify-between text-slate-400 text-[10px] border-t border-slate-200/80 pt-1.5">
                      <span>الخصومات الممنوحة بالفرع: {formatCurrency(b.discounts)}</span>
                      <span>مبيعات عبر الفروع: {b.crossBranchSalesCount} عملية</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Current Stock Location Valuation */}
            <Card className="bg-white border-slate-200/80 shadow-2xs overflow-hidden">
              <CardHeader className="py-3 px-4 bg-slate-50/75 border-b border-slate-200/80">
                <CardTitle className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
                  <Laptop className="w-4 h-4 text-slate-500" />
                  <span>قيمة المخزون الفعلي الحالي حسب الموقع</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                {stockValuation
                  .filter(l => l.location !== 'المجموع الكلي')
                  .map((loc, idx) => (
                    <div key={idx} className="p-3 bg-slate-50 rounded-lg space-y-1.5 text-xs border border-slate-200/80">
                      <div className="flex justify-between items-center font-medium text-slate-800">
                        <span>المخزن الفيزيائي: {loc.location}</span>
                        <span className="font-semibold text-slate-900 font-mono tabular-nums">
                          {loc.availableUnits} جهاز متوفر
                        </span>
                      </div>

                      <div className="flex justify-between text-slate-500 text-[11px] pt-0.5">
                        <span>قيمة التكلفة: {formatCurrency(loc.totalCostValue)}</span>
                        <span>القيمة السوقية: {formatCurrency(loc.totalListValue)}</span>
                      </div>

                      <div className="flex justify-between text-slate-400 text-[10px] border-t border-slate-200/80 pt-1.5">
                        <span>أجهزة محجوزة: {loc.reservedUnits}</span>
                        <span className="font-medium text-emerald-700">
                          الربح المتوقع: {formatCurrency(loc.potentialGrossProfit)}
                        </span>
                      </div>
                    </div>
                  ))}
              </CardContent>
            </Card>
          </div>

          {/* Category Breakdown (Laptops vs Monitors) */}
          <Card className="bg-white border-slate-200/80 shadow-2xs overflow-hidden">
            <CardHeader className="py-3 px-4 bg-slate-50/75 border-b border-slate-200/80">
              <CardTitle className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
                <Monitor className="w-4 h-4 text-slate-500" />
                <span>تحليل المبيعات حسب فئة الأجهزة (لابتوبات مقابل شاشات)</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {categoryBreakdown.map((cat, idx) => (
                  <div key={idx} className="p-3.5 bg-slate-50 rounded-lg border border-slate-200/80 space-y-2 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-slate-900">{cat.category}</span>
                      <Badge variant="default">
                        {cat.unitsSold} جهاز مباع
                      </Badge>
                    </div>
                    <div className="flex justify-between text-slate-500 pt-1">
                      <span>إجمالي الإيرادات:</span>
                      <span className="font-medium text-slate-900 font-mono tabular-nums">{formatCurrency(cat.revenue)}</span>
                    </div>
                    <div className="flex justify-between text-slate-500">
                      <span>تكلفة البضاعة المباعة:</span>
                      <span className="font-medium text-slate-900 font-mono tabular-nums">{formatCurrency(cat.cogs)}</span>
                    </div>
                    <div className="flex justify-between text-slate-800 font-medium border-t border-slate-200/80 pt-1.5">
                      <span>مجمل الربح المحقق:</span>
                      <span className="text-emerald-700 font-mono tabular-nums">{formatCurrency(cat.grossProfit)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Daily Trend Table */}
          <Card className="bg-white border-slate-200/80 shadow-2xs overflow-hidden">
            <CardHeader className="py-3 px-4 bg-slate-50/75 border-b border-slate-200/80">
              <CardTitle className="text-xs font-semibold text-slate-900">
                حركة مبيعات وأرباح أجهزة MSS اليومية (آخر 14 يوماً)
              </CardTitle>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50/75 text-[11px] font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200/80">
                  <tr>
                    <th className="py-2.5 px-3">التاريخ</th>
                    <th className="py-2.5 px-3 text-center">عدد المبيعات</th>
                    <th className="py-2.5 px-3 text-left">الإيراد اليومي</th>
                    <th className="py-2.5 px-3 text-left">تكلفة الأجهزة المباعة</th>
                    <th className="py-2.5 px-3 text-left">المرتجعات</th>
                    <th className="py-2.5 px-3 text-left">مجمل الربح اليومي</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {dailySummaries.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        لا توجد بيانات مسجلة في هذه الفترة
                      </td>
                    </tr>
                  ) : (
                    dailySummaries.map((day, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-3 font-mono font-medium text-slate-800 tabular-nums">{day.date}</td>
                        <td className="py-2.5 px-3 text-center font-mono tabular-nums text-slate-600">{day.salesCount}</td>
                        <td className="py-2.5 px-3 text-left font-mono font-medium text-slate-900 tabular-nums">{formatCurrency(day.revenue)}</td>
                        <td className="py-2.5 px-3 text-left font-mono text-slate-500 tabular-nums">{formatCurrency(day.cogs)}</td>
                        <td className="py-2.5 px-3 text-left font-mono text-rose-600 tabular-nums">{day.refunds > 0 ? formatCurrency(day.refunds) : '—'}</td>
                        <td className={`py-2.5 px-3 text-left font-mono font-semibold tabular-nums ${day.grossProfit >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
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
