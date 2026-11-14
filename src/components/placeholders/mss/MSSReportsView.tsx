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
  ShoppingBag,
  RotateCcw,
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
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="تقارير بيزنس MSS المشترك والأرباح"
        subtitle="تقرير الإيرادات المشتركة، تكاليف شراء الأجهزة، مجمل الأرباح وإحصائيات مبيعات الفروع المعتمدة"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadReportData}
              leftIcon={<RefreshCw className={`w-4 h-4 text-slate-600 ${isLoading ? 'animate-spin' : ''}`} />}
            >
              تحديث
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              leftIcon={<Printer className="w-4 h-4 text-slate-600" />}
            >
              طباعة التقرير
            </Button>
          </div>
        }
      />

      {/* Date Filter Bar */}
      <Card className="bg-white border-slate-200">
        <CardContent className="p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 ml-2">
              <Calendar className="w-4 h-4 text-teal-600" />
              <span>فترة التقرير:</span>
            </div>

            <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50 text-xs">
              <button
                type="button"
                className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                  period === 'today' ? 'bg-white shadow text-teal-800 font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
                onClick={() => setPeriod('today')}
              >
                اليوم
              </button>
              <button
                type="button"
                className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                  period === 'yesterday' ? 'bg-white shadow text-teal-800 font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
                onClick={() => setPeriod('yesterday')}
              >
                أمس
              </button>
              <button
                type="button"
                className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                  period === 'week' ? 'bg-white shadow text-teal-800 font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
                onClick={() => setPeriod('week')}
              >
                آخر 7 أيام
              </button>
              <button
                type="button"
                className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                  period === 'month' ? 'bg-white shadow text-teal-800 font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
                onClick={() => setPeriod('month')}
              >
                آخر 30 يوماً
              </button>
              <button
                type="button"
                className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                  period === 'all' ? 'bg-white shadow text-teal-800 font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
                onClick={() => setPeriod('all')}
              >
                كافة الفترات
              </button>
              <button
                type="button"
                className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                  period === 'custom' ? 'bg-white shadow text-teal-800 font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
                onClick={() => setPeriod('custom')}
              >
                مخصص
              </button>
            </div>
          </div>

          {period === 'custom' && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customStart}
                onChange={e => setCustomStart(e.target.value)}
                className="text-xs border border-slate-300 rounded px-2 py-1"
                placeholder="من تاريخ"
              />
              <span className="text-slate-400 text-xs">إلى</span>
              <input
                type="date"
                value={customEnd}
                onChange={e => setCustomEnd(e.target.value)}
                className="text-xs border border-slate-300 rounded px-2 py-1"
                placeholder="إلى تاريخ"
              />
            </div>
          )}

          <div className="text-xs font-semibold text-slate-500">
            النطاق: <span className="text-slate-800 font-bold">{dateLabel}</span>
          </div>
        </CardContent>
      </Card>

      {/* Rule 16 Explicit Callout Alert */}
      <Alert
        type="info"
        title="محددات أرباح بيزنس MSS المشترك (القاعدة 16)"
        message="أرباح بيزنس أجهزة MSS تُحسب حصراً على مستوى النشاط ككل كشراكة موحدة (إجمالي سعر البيع الفعلي ناقص تكلفة شراء الأجهزة المحفوظة تاريخياً). تقارير مبيعات الفروع تمثل الأداء التشغيلي والتحصيل فقط، ولا يجوز اعتبارها أو توزيعها كأرباح فردية منفصلة للفرع البائع."
      />

      {isLoading || !summary ? (
        <div className="py-16 text-center">
          <Spinner size="lg" />
          <p className="mt-3 text-sm text-slate-500">جاري إعداد تقارير بيزنس MSS...</p>
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
              accentColor="teal"
            />
            <StatsCard
              title="تكلفة شراء الأجهزة المباعة"
              value={formatCurrency(summary.costOfGoodsSold)}
              subtitle="محسوبة من لقطات التكلفة التاريخية"
              icon={Laptop}
              accentColor="indigo"
            />
            <StatsCard
              title="مجمل الربح المشترك"
              value={formatCurrency(summary.grossProfit)}
              subtitle={`هامش ربح ${summary.profitMarginPercent.toFixed(1)}% على مستوى النشاط`}
              icon={TrendingUp}
              accentColor="emerald"
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
              accentColor="blue"
            />
          </div>

          {/* Operational Sales Attribution vs Current Stock by Location */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Operational Sales Attribution */}
            <Card>
              <CardHeader className="border-b bg-slate-50/50">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <Store className="w-4 h-4 text-teal-600" />
                    <span>المبيعات التشغيلية حسب فرع التنفيذ</span>
                  </CardTitle>
                  <Badge variant="purple" size="sm">
                    تشغيلي وتحصيل
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                {branchSales.map((b, idx) => (
                  <div key={idx} className="p-3 bg-slate-50 rounded-xl space-y-2 text-xs border border-slate-100">
                    <div className="flex justify-between items-center font-bold text-slate-800">
                      <span className="text-sm">{b.branch}</span>
                      <span className="text-teal-800 font-extrabold font-mono text-sm">
                        {formatCurrency(b.revenue)}
                      </span>
                    </div>

                    <div className="flex justify-between text-slate-500 pt-1">
                      <span>نفذ {b.salesCount} عمليات بيع</span>
                      <span className="font-semibold text-blue-700">
                        حصة المبيعات: {b.percentageOfTotalSales.toFixed(1)}%
                      </span>
                    </div>

                    <div className="flex justify-between text-slate-500 border-t border-slate-200/60 pt-1.5">
                      <span>الخصومات الممنوحة بالفرع: {formatCurrency(b.discounts)}</span>
                      <span>مبيعات عبر الفروع: {b.crossBranchSalesCount} عملية</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Current Stock Location Valuation */}
            <Card>
              <CardHeader className="border-b bg-slate-50/50">
                <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <Laptop className="w-4 h-4 text-slate-600" />
                  <span>قيمة المخزون الفعلي الحالي حسب الموقع</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                {stockValuation
                  .filter(l => l.location !== 'المجموع الكلي')
                  .map((loc, idx) => (
                    <div key={idx} className="p-3 bg-slate-50 rounded-xl space-y-2 text-xs border border-slate-100">
                      <div className="flex justify-between items-center font-bold text-slate-800">
                        <span className="text-sm">المخزن الفيزيائي: {loc.location}</span>
                        <span className="text-slate-900 font-extrabold font-mono text-sm">
                          {loc.availableUnits} جهاز متوفر
                        </span>
                      </div>

                      <div className="flex justify-between text-slate-500 pt-1">
                        <span>قيمة التكلفة: {formatCurrency(loc.totalCostValue)}</span>
                        <span>القيمة السوقية: {formatCurrency(loc.totalListValue)}</span>
                      </div>

                      <div className="flex justify-between text-slate-500 border-t border-slate-200/60 pt-1.5">
                        <span>أجهزة محجوزة: {loc.reservedUnits}</span>
                        <span className="font-semibold text-emerald-700">
                          الربح المتوقع: {formatCurrency(loc.potentialGrossProfit)}
                        </span>
                      </div>
                    </div>
                  ))}
              </CardContent>
            </Card>
          </div>

          {/* Category Breakdown (Laptops vs Monitors) */}
          <Card>
            <CardHeader className="border-b bg-slate-50/50">
              <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Monitor className="w-4 h-4 text-teal-600" />
                <span>تحليل المبيعات حسب فئة الأجهزة (لابتوبات مقابل شاشات)</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {categoryBreakdown.map((cat, idx) => (
                  <div key={idx} className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="font-extrabold text-sm text-slate-800">{cat.category}</span>
                      <Badge variant={cat.category === 'لابتوب' ? 'primary' : 'purple'}>
                        {cat.unitsSold} جهاز مباع
                      </Badge>
                    </div>
                    <div className="flex justify-between text-slate-600 pt-1">
                      <span>إجمالي الإيرادات:</span>
                      <span className="font-bold text-teal-800 font-mono">{formatCurrency(cat.revenue)}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>تكلفة البضاعة المباعة:</span>
                      <span className="font-bold text-slate-800 font-mono">{formatCurrency(cat.cogs)}</span>
                    </div>
                    <div className="flex justify-between text-slate-800 font-bold border-t border-slate-200 pt-1.5">
                      <span>مجمل الربح المحقق:</span>
                      <span className="text-emerald-700 font-mono">{formatCurrency(cat.grossProfit)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Daily Trend Table */}
          <Card>
            <CardHeader className="border-b bg-slate-50/50">
              <CardTitle className="text-sm font-bold text-slate-800">
                حركة مبيعات وأرباح أجهزة MSS اليومية (آخر 14 يوماً)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b">
                    <tr>
                      <th className="p-3">التاريخ</th>
                      <th className="p-3">عدد المبيعات</th>
                      <th className="p-3">الإيراد اليومي</th>
                      <th className="p-3">تكلفة الأجهزة المباعة</th>
                      <th className="p-3">المرتجعات</th>
                      <th className="p-3">مجمل الربح اليومي</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {dailySummaries.map((day, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/80">
                        <td className="p-3 font-mono font-bold text-slate-800">{day.date}</td>
                        <td className="p-3 font-mono">{day.salesCount}</td>
                        <td className="p-3 font-mono font-bold text-teal-800">{formatCurrency(day.revenue)}</td>
                        <td className="p-3 font-mono text-slate-600">{formatCurrency(day.cogs)}</td>
                        <td className="p-3 font-mono text-rose-700">{formatCurrency(day.refunds)}</td>
                        <td className="p-3 font-mono font-extrabold text-emerald-800">{formatCurrency(day.grossProfit)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};
