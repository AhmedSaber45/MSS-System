import React, { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { StatsCard, Card, CardHeader, CardTitle, CardContent } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Badge } from '@/components/common/Badge';
import { Alert } from '@/components/common/Alert';
import { Spinner } from '@/components/common/Spinner';
import { useNavigation } from '@/context/NavigationContext';
import {
  DollarSign,
  TrendingUp,
  ShoppingBag,
  Laptop,
  Store,
  AlertTriangle,
  RefreshCw,
  Calendar,
  ArrowUpRight,
  CheckCircle2,
  Cloud,
  Layers,
  Printer,
  ChevronLeft,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { unifiedDashboardService } from '@/services/unifiedDashboardService.ts';
import type {
  ReportPeriod,
  UnifiedBusinessDashboardData,
} from '@/types/unifiedDashboard.ts';

interface UnifiedDashboardViewProps {
  onSwitchToAccessories?: () => void;
  onSwitchToMSS?: () => void;
}

export const UnifiedDashboardView: React.FC<UnifiedDashboardViewProps> = ({
  onSwitchToAccessories,
  onSwitchToMSS,
}) => {
  const { setSection, setRoute } = useNavigation();

  const [period, setPeriod] = useState<ReportPeriod>('month');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [data, setData] = useState<UnifiedBusinessDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await unifiedDashboardService.getUnifiedDashboardData(
        period,
        customStart || undefined,
        customEnd || undefined
      );
      setData(res);
    } catch (err) {
      console.warn('Failed to load unified dashboard data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [period, customStart, customEnd]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handlePrint = () => {
    window.print();
  };

  const navigateToAccessories = (route: any = 'dashboard') => {
    setSection('accessories');
    setRoute(route);
    if (onSwitchToAccessories) onSwitchToAccessories();
  };

  const navigateToMSS = (route: any = 'dashboard') => {
    setSection('mss');
    setRoute(route);
    if (onSwitchToMSS) onSwitchToMSS();
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="لوحة القيادة الموحدة والتقارير التنفيذية"
        subtitle="نظرة عامة شاملة تجمع بين نشاط محل الإكسسوارات وبيزنس أجهزة MSS مع الفصل الصارم للقواعد المالية"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadData}
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
              <Calendar className="w-4 h-4 text-slate-500" />
              <span>فترة التقرير:</span>
            </div>

            <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50 text-xs">
              <button
                type="button"
                className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                  period === 'today' ? 'bg-white shadow text-blue-700 font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
                onClick={() => setPeriod('today')}
              >
                اليوم
              </button>
              <button
                type="button"
                className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                  period === 'yesterday' ? 'bg-white shadow text-blue-700 font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
                onClick={() => setPeriod('yesterday')}
              >
                أمس
              </button>
              <button
                type="button"
                className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                  period === 'week' ? 'bg-white shadow text-blue-700 font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
                onClick={() => setPeriod('week')}
              >
                آخر 7 أيام
              </button>
              <button
                type="button"
                className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                  period === 'month' ? 'bg-white shadow text-blue-700 font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
                onClick={() => setPeriod('month')}
              >
                آخر 30 يوماً
              </button>
              <button
                type="button"
                className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                  period === 'all' ? 'bg-white shadow text-blue-700 font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
                onClick={() => setPeriod('all')}
              >
                كافة الفترات
              </button>
              <button
                type="button"
                className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                  period === 'custom' ? 'bg-white shadow text-blue-700 font-bold' : 'text-slate-600 hover:text-slate-900'
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
            النطاق المختار: <span className="text-slate-800 font-bold">{data?.filter.label}</span>
          </div>
        </CardContent>
      </Card>

      {isLoading || !data ? (
        <div className="py-16 text-center">
          <Spinner size="lg" />
          <p className="mt-3 text-sm text-slate-500">جاري تجميع وتحليل مؤشرات المنشأة...</p>
        </div>
      ) : (
        <>
          {/* Business Alerts Banner */}
          {(data.alerts.hasStockAlerts || data.alerts.hasSyncAlerts) && (
            <div className="space-y-3">
              {data.alerts.hasStockAlerts && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start justify-between gap-3 text-amber-900">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="font-bold text-sm">تنبيهات مخزون الإكسسوارات</div>
                      <div className="text-xs text-amber-700 mt-1">
                        يوجد <span className="font-bold">{data.alerts.accessoriesOutOfStock.length}</span> أصناف نفدت تماماً، و{' '}
                        <span className="font-bold">{data.alerts.accessoriesLowStock.length}</span> أصناف وصلت لحد إعادة الطلب.
                      </div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-amber-300 hover:bg-amber-100 text-amber-900 text-xs"
                    onClick={() => navigateToAccessories('inventory')}
                  >
                    معاينة النواقص
                  </Button>
                </div>
              )}

              {data.alerts.hasSyncAlerts && (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start justify-between gap-3 text-rose-900">
                  <div className="flex items-start gap-3">
                    <Cloud className="w-5 h-5 text-rose-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="font-bold text-sm">تنبيهات مزامنة بيزنس MSS</div>
                      <div className="text-xs text-rose-700 mt-1">
                        يوجد <span className="font-bold">{data.alerts.mssPendingSync.length}</span> عمليات بانتظار المزامنة، و{' '}
                        <span className="font-bold">{data.alerts.mssConflicts.length}</span> تعارضات تتطلب التسوية اليدوية.
                      </div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-rose-300 hover:bg-rose-100 text-rose-900 text-xs"
                    onClick={() => navigateToMSS('sync')}
                  >
                    شاشة المزامنة
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Section 1: Combined Executive Financial KPIs */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-600" />
                <span>إجمالي الأداء المالي المجمع للمنشأة</span>
              </h3>
              <Badge variant="purple" size="sm">
                مجموع نشاط الإكسسوارات + بيزنس MSS
              </Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatsCard
                title="إجمالي الإيرادات المجمعة"
                value={formatCurrency(data.combined.combinedRevenue)}
                subtitle={`${data.combined.totalTransactionsCount} معاملة بيع خلال الفترة`}
                icon={DollarSign}
                accentColor="blue"
              />
              <StatsCard
                title="إجمالي تكلفة البضاعة المباعة"
                value={formatCurrency(data.combined.combinedCogs)}
                subtitle="تكلفة شراء الإكسسوارات والأجهزة المباعة"
                icon={ShoppingBag}
                accentColor="indigo"
              />
              <StatsCard
                title="مجمل الربح الإجمالي للمنشأة"
                value={formatCurrency(data.combined.combinedGrossProfit)}
                subtitle={`هامش ربح إجمالي ${data.combined.profitMarginPercent.toFixed(1)}%`}
                icon={TrendingUp}
                accentColor="emerald"
              />
              <StatsCard
                title="إجمالي الحركات المنفذة"
                value={`${data.combined.totalTransactionsCount} عملية`}
                subtitle={`${data.accessories.invoicesCount} إكسسوار + ${data.mss.soldDevicesCount} جهاز`}
                icon={CheckCircle2}
                accentColor="teal"
              />
            </div>
          </div>

          {/* Section 2: Side-by-Side Business Summaries (Accessories vs MSS) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Accessories Shop Summary Card */}
            <Card className="border-t-4 border-t-blue-600 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-3 border-b">
                <div>
                  <CardTitle className="text-base text-blue-900 flex items-center gap-2">
                    <ShoppingBag className="w-5 h-5 text-blue-600" />
                    <span>محل الإكسسوارات (Accessories Shop)</span>
                  </CardTitle>
                  <p className="text-xs text-slate-500 mt-1">
                    قاعدة بيانات SQLite محلية ومستقلة بالكامل | أرباح ملكية فردية للمحل
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigateToAccessories('dashboard')}
                  rightIcon={<ChevronLeft className="w-4 h-4" />}
                >
                  الدخول للقسم
                </Button>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100">
                    <span className="text-xs text-slate-500 font-medium">صافي المبيعات</span>
                    <div className="text-lg font-black text-blue-950 mt-1">
                      {formatCurrency(data.accessories.netSales)}
                    </div>
                    <span className="text-[11px] text-blue-700">
                      {data.accessories.invoicesCount} فاتورة بيع
                    </span>
                  </div>

                  <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-100">
                    <span className="text-xs text-slate-500 font-medium">مجمل أرباح الإكسسوارات</span>
                    <div className="text-lg font-black text-emerald-800 mt-1">
                      {formatCurrency(data.accessories.grossProfit)}
                    </div>
                    <span className="text-[11px] text-emerald-700">
                      هامش {data.accessories.profitMarginPercent.toFixed(1)}%
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs space-y-2">
                  <div className="font-bold text-slate-800 flex justify-between">
                    <span>حالة وتقييم المخزون المحلي:</span>
                    <span className="text-blue-700 font-mono">
                      {data.accessories.totalProducts} صنف ({data.accessories.totalUnits} قطعة)
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>قيمة المخزون بسعر التكلفة:</span>
                    <span className="font-bold text-slate-900 font-mono">
                      {formatCurrency(data.accessories.inventoryCostValuation)}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>القيمة البيعية المتوقعة:</span>
                    <span className="font-bold text-slate-900 font-mono">
                      {formatCurrency(data.accessories.inventoryRetailValuation)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="text-slate-500">تنبيهات الأصناف:</span>
                  <div className="flex gap-2">
                    {data.accessories.lowStockCount > 0 ? (
                      <Badge variant="warning">{data.accessories.lowStockCount} منخفض المخزون</Badge>
                    ) : (
                      <Badge variant="success">المخزون مكتمل</Badge>
                    )}
                    {data.accessories.outOfStockCount > 0 && (
                      <Badge variant="danger">{data.accessories.outOfStockCount} نفد تماماً</Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* MSS Business Summary Card */}
            <Card className="border-t-4 border-t-teal-600 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-3 border-b">
                <div>
                  <CardTitle className="text-base text-teal-900 flex items-center gap-2">
                    <Laptop className="w-5 h-5 text-teal-600" />
                    <span>بيزنس أجهزة MSS (Laptop & Monitor)</span>
                  </CardTitle>
                  <p className="text-xs text-slate-500 mt-1">
                    سحابي مشترك بين محلين | تتبع بالسيريال | أرباح مشتركة على مستوى النشاط
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigateToMSS('dashboard')}
                  rightIcon={<ChevronLeft className="w-4 h-4" />}
                >
                  الدخول للقسم
                </Button>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-teal-50/60 rounded-xl border border-teal-100">
                    <span className="text-xs text-slate-500 font-medium">إجمالي مبيعات الأجهزة</span>
                    <div className="text-lg font-black text-teal-950 mt-1">
                      {formatCurrency(data.mss.netSales)}
                    </div>
                    <span className="text-[11px] text-teal-700">
                      {data.mss.soldDevicesCount} جهاز مباع بالسيريال
                    </span>
                  </div>

                  <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-100">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500 font-medium">مجمل الربح المشترك</span>
                      <Badge variant="purple" size="sm">
                        مشترك
                      </Badge>
                    </div>
                    <div className="text-lg font-black text-emerald-800 mt-1">
                      {formatCurrency(data.mss.sharedGrossProfit)}
                    </div>
                    <span className="text-[11px] text-emerald-700">
                      على مستوى البيزنس ككل
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs space-y-2">
                  <div className="font-bold text-slate-800 flex justify-between">
                    <span>موقع الأجهزة الفعلي في المخازن:</span>
                    <span className="text-teal-700 font-mono">
                      {data.mss.totalAvailableUnits} جهاز متوفر
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-slate-600 pt-1">
                    <div className="bg-white p-2 rounded border border-slate-200">
                      <span className="font-medium">محل 1:</span>{' '}
                      <span className="font-bold text-slate-900">{data.mss.shop1AvailableUnits} جهاز</span>
                    </div>
                    <div className="bg-white p-2 rounded border border-slate-200">
                      <span className="font-medium">محل 2:</span>{' '}
                      <span className="font-bold text-slate-900">{data.mss.shop2AvailableUnits} جهاز</span>
                    </div>
                  </div>
                  <div className="flex justify-between text-slate-600 pt-1">
                    <span>تكلفة الأجهزة المتوفرة بالمخازن:</span>
                    <span className="font-bold text-slate-900 font-mono">
                      {formatCurrency(data.mss.inventoryCostValuation)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="text-slate-500">حالة السحابة والمزامنة:</span>
                  <div className="flex gap-2 items-center">
                    {data.mss.isOnline ? (
                      <Badge variant="success">السحابة متصلة</Badge>
                    ) : (
                      <Badge variant="warning">وضع عدم الاتصال</Badge>
                    )}
                    {data.mss.pendingSyncCount > 0 && (
                      <Badge variant="danger">{data.mss.pendingSyncCount} بانتظار المزامنة</Badge>
                    )}
                    {data.mss.activeReservationsCount > 0 && (
                      <Badge variant="info">{data.mss.activeReservationsCount} حجز نشط</Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Section 3: Branch Operational Execution vs Shared Profit Rule */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <Store className="w-5 h-5 text-teal-700" />
                  <span>المبيعات التشغيلية لبيزنس MSS حسب فرع التنفيذ</span>
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  تحديد حجم المعاملات والتحصيل المنفذ من خلال كل فرع
                </p>
              </div>
            </div>

            {/* Rule 16 Callout Alert */}
            <Alert
              type="info"
              title="تنبيه محاسبي حاسم (القاعدة 16): الفصل بين النشاط التشغيلي والربحية المشتركة"
              message="الأرقام أدناه توضح فقط الفرع الذي قام بتنفيذ وإتمام عملية البيع والتحصيل النقدي. بينما أرباح بيزنس MSS هي أرباح موحدة على مستوى النشاط المشترك ككل، ولا يجوز اعتبارها أو نسبتها كأرباح فردية خاصة بالفرع البائع."
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {data.branchOperationalSales.map((branchData, idx) => (
                <Card key={idx} className="border-slate-200">
                  <CardHeader className="pb-2 border-b bg-slate-50/50">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-800">
                        <Store className="w-4 h-4 text-teal-600" />
                        <span>فرع التنفيذ: {branchData.branch}</span>
                      </CardTitle>
                      <Badge variant={idx === 0 ? 'primary' : 'purple'}>
                        حصة المبيعات: {branchData.percentageOfTotalSales.toFixed(0)}%
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 space-y-3 text-xs">
                    <div className="flex justify-between items-center py-1 border-b border-slate-100">
                      <span className="text-slate-600">عدد الأجهزة المباعة:</span>
                      <span className="font-bold text-slate-900 font-mono text-sm">
                        {branchData.salesCount} أجهزة
                      </span>
                    </div>

                    <div className="flex justify-between items-center py-1 border-b border-slate-100">
                      <span className="text-slate-600">الإيراد المحصل عبر الفرع:</span>
                      <span className="font-extrabold text-teal-800 font-mono text-sm">
                        {formatCurrency(branchData.revenue)}
                      </span>
                    </div>

                    <div className="flex justify-between items-center py-1 border-b border-slate-100">
                      <span className="text-slate-600">الخصومات الممنوحة بالفرع:</span>
                      <span className="font-bold text-slate-700 font-mono">
                        {formatCurrency(branchData.discounts)}
                      </span>
                    </div>

                    <div className="flex justify-between items-center py-1">
                      <span className="text-slate-600">مبيعات أجهزة من الفرع الآخر (Cross-Branch):</span>
                      <span className="font-bold text-blue-700 font-mono">
                        {branchData.crossBranchSalesCount} عملية
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Section 4: Physical Stock Location Table */}
          <Card className="border-slate-200">
            <CardHeader className="border-b bg-slate-50/50">
              <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Laptop className="w-4 h-4 text-slate-600" />
                <span>حالة وتقييم المخزون الفيزيائي لأجهزة MSS حسب الموقع الحالي</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-3">موقع التخزين الفعلي</th>
                      <th className="p-3">أجهزة متوفرة</th>
                      <th className="p-3">أجهزة محجوزة</th>
                      <th className="p-3">تحت الصيانة</th>
                      <th className="p-3">إجمالي الوحدات</th>
                      <th className="p-3">قيمة التكلفة</th>
                      <th className="p-3">القيمة البيعية المقدرة</th>
                      <th className="p-3">الربح المتوقع</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {data.locationStockValuation.map((row, idx) => {
                      const isGrand = row.location === 'المجموع الكلي';
                      return (
                        <tr
                          key={idx}
                          className={isGrand ? 'bg-slate-50 font-extrabold text-slate-900 border-t-2 border-slate-300' : 'hover:bg-slate-50/80'}
                        >
                          <td className="p-3">
                            {isGrand ? (
                              <span className="text-blue-900">{row.location}</span>
                            ) : (
                              <Badge variant={row.location === 'محل 1' ? 'primary' : 'purple'}>
                                {row.location}
                              </Badge>
                            )}
                          </td>
                          <td className="p-3 font-mono font-bold text-emerald-700">{row.availableUnits}</td>
                          <td className="p-3 font-mono text-amber-700">{row.reservedUnits}</td>
                          <td className="p-3 font-mono text-slate-500">{row.maintenanceUnits}</td>
                          <td className="p-3 font-mono font-bold">{row.totalUnits}</td>
                          <td className="p-3 font-mono text-slate-800">{formatCurrency(row.totalCostValue)}</td>
                          <td className="p-3 font-mono text-slate-800">{formatCurrency(row.totalListValue)}</td>
                          <td className="p-3 font-mono text-emerald-800">{formatCurrency(row.potentialGrossProfit)}</td>
                        </tr>
                      );
                    })}
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
