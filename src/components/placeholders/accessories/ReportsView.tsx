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
  Package,
  Percent,
  Calendar,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { reportsService } from '@/services/reportsService.ts';
import type {
  FinancialSummary,
  DailySalesSummary,
  TopSellingProduct,
  InventoryValuation,
} from '@/types/reports.ts';

export const ReportsView: React.FC = () => {
  const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'all' | 'custom'>('month');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Data states
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [dailySummaries, setDailySummaries] = useState<DailySalesSummary[]>([]);
  const [topProducts, setTopProducts] = useState<TopSellingProduct[]>([]);
  const [valuation, setValuation] = useState<InventoryValuation | null>(null);

  // Helper to calculate date ranges
  const getDateRange = useCallback(() => {
    const today = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

    if (period === 'today') {
      return { start: todayStr, end: todayStr };
    }
    if (period === 'week') {
      const d = new Date(today);
      d.setDate(d.getDate() - 7);
      const weekStartStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      return { start: weekStartStr, end: todayStr };
    }
    if (period === 'month') {
      const d = new Date(today);
      d.setDate(d.getDate() - 30);
      const monthStartStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      return { start: monthStartStr, end: todayStr };
    }
    if (period === 'custom') {
      return { start: startDate || undefined, end: endDate || undefined };
    }
    return { start: undefined, end: undefined }; // 'all'
  }, [period, startDate, endDate]);

  const loadReportData = useCallback(async () => {
    setIsLoading(true);
    try {
      const { start, end } = getDateRange();
      const [sum, daily, top, val] = await Promise.all([
        reportsService.getFinancialSummary(start, end),
        reportsService.getDailySummaries(14),
        reportsService.getTopSellingProducts(8, start, end),
        reportsService.getInventoryValuation(),
      ]);
      setSummary(sum);
      setDailySummaries(daily);
      setTopProducts(top);
      setValuation(val);
    } catch (err) {
      console.warn('Failed to load financial reports:', err);
    } finally {
      setIsLoading(false);
    }
  }, [getDateRange]);

  useEffect(() => {
    loadReportData();
  }, [loadReportData]);

  const handlePrintReport = () => {
    window.print();
  };

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <PageHeader
        title="التقارير المالية والأرباح"
        subtitle="كشف دقيق للإيرادات وتكلفة البضاعة المباعة وصافي الأرباح وفق لقطات الأسعار الحقيقية"
        actions={
          <div className="no-print flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrintReport}
              leftIcon={<Printer className="w-4 h-4 text-slate-500" />}
            >
              طباعة كشف الأرباح
            </Button>
          </div>
        }
      />

      {/* Period Filter Selector */}
      <Card className="no-print p-2.5 bg-white border-slate-200/80 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500">الفترة الزمنية:</span>
            <div className="inline-flex p-0.5 bg-slate-100 rounded-lg border border-slate-200/80">
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
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    period === p.id
                      ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {period === 'custom' && (
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="py-1 text-xs font-mono"
                title="من تاريخ"
              />
              <span className="text-slate-400 text-xs">إلى</span>
              <Input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="py-1 text-xs font-mono"
                title="إلى تاريخ"
              />
              <Button size="sm" variant="primary" onClick={loadReportData}>
                تطبيق
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* Main KPI Stats Cards */}
      {isLoading ? (
        <div className="p-16 flex flex-col items-center justify-center bg-white rounded-xl border border-slate-200/80">
          <Spinner size="lg" />
          <p className="text-xs text-slate-500 mt-3">جارٍ حساب الإيرادات والتكاليف والأرباح...</p>
        </div>
      ) : summary ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatsCard
              title="إجمالي إيرادات المبيعات"
              value={formatCurrency(summary.totalRevenue)}
              subtitle={`${summary.invoicesCount} فاتورة مبيعات مسددة`}
              icon={DollarSign}
            />
            <StatsCard
              title="تكلفة البضاعة المباعة (COGS)"
              value={formatCurrency(summary.costOfGoodsSold)}
              subtitle="محسوبة من لقطة التكلفة عند كل بيع"
              icon={ShoppingBag}
            />
            <StatsCard
              title="مجمل الربح التجاري"
              value={formatCurrency(summary.grossProfit)}
              subtitle={`هامش ربح ${summary.profitMarginPercent.toFixed(1)}%`}
              icon={TrendingUp}
            />
            <StatsCard
              title="المرتجعات والخصومات"
              value={formatCurrency(summary.totalRefunds + summary.totalDiscounts)}
              subtitle={`خصومات: ${formatCurrency(summary.totalDiscounts)} | مرتجعات: ${formatCurrency(
                summary.totalRefunds
              )}`}
              icon={Receipt}
            />
          </div>

          {/* Secondary Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs text-xs">
            <div>
              <span className="text-slate-500 block mb-0.5">صافي المبيعات المحققة</span>
              <span className="font-mono font-semibold text-slate-900 text-sm tabular-nums">
                {formatCurrency(summary.netSales)}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block mb-0.5">متوسط قيمة الفاتورة</span>
              <span className="font-mono font-semibold text-slate-900 text-sm tabular-nums">
                {formatCurrency(summary.avgInvoiceValue)}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block mb-0.5">إجمالي الخصومات الممنوحة</span>
              <span className="font-mono font-semibold text-slate-800 text-sm tabular-nums">
                {formatCurrency(summary.totalDiscounts)}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block mb-0.5">عدد المرتجعات المسجلة</span>
              <span className="font-mono font-semibold text-slate-800 text-sm tabular-nums">
                {summary.returnsCount} عمليات
              </span>
            </div>
          </div>

          {/* Daily Sales Breakdown & Inventory Valuation */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Daily History Table (8 Cols) */}
            <div className="lg:col-span-8 space-y-5">
              <Card className="bg-white border-slate-200/80 shadow-2xs overflow-hidden">
                <CardHeader className="py-3 px-4 bg-slate-50/75 border-b border-slate-200/80">
                  <CardTitle className="text-xs font-semibold text-slate-900">
                    حركة المبيعات والأرباح اليومية (آخر أسبوعين)
                  </CardTitle>
                </CardHeader>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-right">
                    <thead className="bg-slate-50/75 text-[11px] font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200/80">
                      <tr>
                        <th className="py-2.5 px-3">التاريخ</th>
                        <th className="py-2.5 px-3 text-center">الفواتير</th>
                        <th className="py-2.5 px-3 text-left">المبيعات</th>
                        <th className="py-2.5 px-3 text-left">التكلفة (COGS)</th>
                        <th className="py-2.5 px-3 text-left">المرتجعات</th>
                        <th className="py-2.5 px-3 text-left">مجمل الربح</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {dailySummaries.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-400">
                            لا توجد بيانات مسجلة في هذه الفترة
                          </td>
                        </tr>
                      ) : (
                        dailySummaries.map(d => (
                          <tr key={d.date} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-2.5 px-3 text-slate-700 font-mono text-[11px] tabular-nums">
                              {d.date}
                            </td>
                            <td className="py-2.5 px-3 text-center text-slate-600 font-mono tabular-nums">
                              {d.invoicesCount}
                            </td>
                            <td className="py-2.5 px-3 text-left text-slate-900 font-medium font-mono tabular-nums">
                              {formatCurrency(d.revenue)}
                            </td>
                            <td className="py-2.5 px-3 text-left text-slate-500 font-mono tabular-nums">
                              {formatCurrency(d.cogs)}
                            </td>
                            <td className="py-2.5 px-3 text-left text-rose-600 font-mono tabular-nums">
                              {d.refunds > 0 ? formatCurrency(d.refunds) : '—'}
                            </td>
                            <td
                              className={`py-2.5 px-3 text-left font-semibold font-mono tabular-nums ${
                                d.grossProfit >= 0 ? 'text-emerald-700' : 'text-rose-600'
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
              <Card className="bg-white border-slate-200/80 shadow-2xs overflow-hidden">
                <CardHeader className="py-3 px-4 bg-slate-50/75 border-b border-slate-200/80">
                  <CardTitle className="text-xs font-semibold text-slate-900">
                    أعلى الأصناف مبيعاً ومساهمة في الأرباح
                  </CardTitle>
                </CardHeader>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-right">
                    <thead className="bg-slate-50/75 text-[11px] font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200/80">
                      <tr>
                        <th className="py-2.5 px-3">الصنف</th>
                        <th className="py-2.5 px-3 text-center">الكمية المباعة</th>
                        <th className="py-2.5 px-3 text-left">إجمالي الإيراد</th>
                        <th className="py-2.5 px-3 text-left">إجمالي التكلفة</th>
                        <th className="py-2.5 px-3 text-left">الربح المحقق</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {topProducts.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-slate-400">
                            لا توجد مبيعات في الفترة المحددة
                          </td>
                        </tr>
                      ) : (
                        topProducts.map(p => (
                          <tr key={p.productId} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-2.5 px-3">
                              <p className="font-medium text-slate-900">{p.productName}</p>
                              <p className="text-[10px] text-slate-400 font-mono">{p.productCode}</p>
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono tabular-nums text-slate-700">
                              {p.quantitySold}
                            </td>
                            <td className="py-2.5 px-3 text-left font-mono font-medium text-slate-900 tabular-nums">
                              {formatCurrency(p.totalRevenue)}
                            </td>
                            <td className="py-2.5 px-3 text-left font-mono text-slate-500 tabular-nums">
                              {formatCurrency(p.totalCost)}
                            </td>
                            <td className="py-2.5 px-3 text-left font-mono font-semibold text-emerald-700 tabular-nums">
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
                <Card className="bg-white border-slate-200/80 shadow-2xs p-4 space-y-4">
                  <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700">
                      <Package className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-slate-900">تقييم المخزون الحالي</h4>
                      <p className="text-[10px] text-slate-400">القيمة التقديرية للبضاعة المتوفرة</p>
                    </div>
                  </div>

                  <div className="space-y-2.5 text-xs">
                    <div className="flex justify-between items-center text-slate-600">
                      <span>إجمالي أصناف المحل</span>
                      <span className="font-semibold text-slate-900 font-mono tabular-nums">
                        {valuation.totalItemsCount}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-slate-600">
                      <span>إجمالي عدد القطع</span>
                      <span className="font-semibold text-slate-900 font-mono tabular-nums">
                        {valuation.totalUnitsCount}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-slate-600">
                      <span>قيمة المخزون بسعر التكلفة</span>
                      <span className="font-mono font-medium text-slate-900 tabular-nums">
                        {formatCurrency(valuation.totalCostValue)}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-slate-600">
                      <span>قيمة المخزون بسعر البيع</span>
                      <span className="font-mono font-medium text-slate-900 tabular-nums">
                        {formatCurrency(valuation.totalRetailValue)}
                      </span>
                    </div>

                    <div className="pt-2.5 border-t border-slate-200/80 flex justify-between items-center">
                      <span className="font-medium text-slate-800">الربح التقديري للمخزون</span>
                      <span className="font-mono font-semibold text-emerald-700 text-sm tabular-nums">
                        {formatCurrency(valuation.potentialProfit)}
                      </span>
                    </div>
                  </div>
                </Card>
              )}

              {/* Financial Protection Box */}
              <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1.5 text-xs text-slate-700">
                <p className="font-semibold text-slate-900 flex items-center gap-1.5">
                  <Percent className="w-3.5 h-3.5 text-slate-600" />
                  <span>دقة الحسابات المالية (Rule 8)</span>
                </p>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  تعتمد التقارير على لقطة سعر التكلفة والبيع المسجلة لحظة إصدار الفاتورة، ولا تتأثر بتعديل أسعار المنتجات في القوائم لاحقاً.
                </p>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
};
