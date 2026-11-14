import React, { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { StatsCard, Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/common/Card';
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
    <div className="space-y-5">
      {/* Page Header */}
      <PageHeader
        title="لوحة القيادة الموحدة والتقارير التنفيذية"
        subtitle="نظرة عامة مجمعة لنشاط محل الإكسسوارات وبيزنس أجهزة MSS مع الفصل الصارم للقواعد المالية"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadData}
              leftIcon={<RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${isLoading ? 'animate-spin' : ''}`} />}
            >
              تحديث
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              leftIcon={<Printer className="w-3.5 h-3.5 text-slate-500" />}
            >
              طباعة
            </Button>
          </div>
        }
      />

      {/* Date Filter Bar */}
      <Card className="p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>فترة التقرير:</span>
            </div>

            <div className="inline-flex rounded-lg border border-slate-200/90 p-0.5 bg-slate-100/80 text-xs">
              {[
                { id: 'today', label: 'اليوم' },
                { id: 'yesterday', label: 'أمس' },
                { id: 'week', label: 'آخر 7 أيام' },
                { id: 'month', label: 'آخر 30 يوماً' },
                { id: 'all', label: 'كافة الفترات' },
                { id: 'custom', label: 'مخصص' },
              ].map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                    period === opt.id
                      ? 'bg-white shadow-subtle text-slate-900 font-semibold border border-slate-200/90'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  onClick={() => setPeriod(opt.id as ReportPeriod)}
                >
                  {opt.label}
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
                className="h-8 text-xs border border-slate-200 rounded-md px-2 text-slate-800 bg-white"
                placeholder="من تاريخ"
              />
              <span className="text-slate-400 text-xs">إلى</span>
              <input
                type="date"
                value={customEnd}
                onChange={e => setCustomEnd(e.target.value)}
                className="h-8 text-xs border border-slate-200 rounded-md px-2 text-slate-800 bg-white"
                placeholder="إلى تاريخ"
              />
            </div>
          )}

          <div className="text-xs text-slate-500 font-normal">
            النطاق: <span className="text-slate-900 font-medium">{data?.filter.label}</span>
          </div>
        </div>
      </Card>

      {isLoading || !data ? (
        <div className="py-16 text-center">
          <Spinner size="lg" />
          <p className="mt-2.5 text-xs text-slate-500">جاري تجميع المؤشرات والبيانات...</p>
        </div>
      ) : (
        <>
          {/* Business Alerts Banner */}
          {(data.alerts.hasStockAlerts || data.alerts.hasSyncAlerts) && (
            <div className="space-y-2.5">
              {data.alerts.hasStockAlerts && (
                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-lg flex items-start justify-between gap-3 text-amber-900">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-amber-700 mt-0.5 shrink-0" />
                    <div>
                      <div className="font-semibold text-xs">تنبيهات مخزون الإكسسوارات</div>
                      <div className="text-xs text-amber-800 mt-0.5">
                        يوجد <span className="font-medium tabular-nums">{data.alerts.accessoriesOutOfStock.length}</span> أصناف نفدت، و{' '}
                        <span className="font-medium tabular-nums">{data.alerts.accessoriesLowStock.length}</span> أصناف وصلت لحد إعادة الطلب.
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
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-lg flex items-start justify-between gap-3 text-rose-900">
                  <div className="flex items-start gap-2.5">
                    <Cloud className="w-4 h-4 text-rose-700 mt-0.5 shrink-0" />
                    <div>
                      <div className="font-semibold text-xs">تنبيهات مزامنة بيزنس MSS</div>
                      <div className="text-xs text-rose-800 mt-0.5">
                        يوجد <span className="font-medium tabular-nums">{data.alerts.mssPendingSync.length}</span> عمليات بانتظار المزامنة، و{' '}
                        <span className="font-medium tabular-nums">{data.alerts.mssConflicts.length}</span> تعارضات تتطلب التسوية اليدوية.
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
            <div className="flex items-center justify-between mb-2.5">
              <h3 className="text-xs font-semibold text-slate-700 flex items-center gap-1.5 uppercase tracking-wide">
                <Layers className="w-3.5 h-3.5 text-slate-500" />
                <span>إجمالي الأداء المالي المجمع للمنشأة</span>
              </h3>
              <Badge variant="outline" size="sm">
                الإكسسوارات + بيزنس MSS
              </Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              <StatsCard
                title="إجمالي الإيرادات المجمعة"
                value={formatCurrency(data.combined.combinedRevenue)}
                subtitle={`${data.combined.totalTransactionsCount} معاملة بيع خلال الفترة`}
                icon={DollarSign}
              />
              <StatsCard
                title="إجمالي تكلفة البضاعة المباعة"
                value={formatCurrency(data.combined.combinedCogs)}
                subtitle="تكلفة شراء الإكسسوارات والأجهزة المباعة"
                icon={ShoppingBag}
              />
              <StatsCard
                title="مجمل الربح الإجمالي للمنشأة"
                value={formatCurrency(data.combined.combinedGrossProfit)}
                subtitle={`هامش ربح إجمالي ${data.combined.profitMarginPercent.toFixed(1)}%`}
                icon={TrendingUp}
              />
              <StatsCard
                title="إجمالي الحركات المنفذة"
                value={`${data.combined.totalTransactionsCount} عملية`}
                subtitle={`${data.accessories.invoicesCount} إكسسوار + ${data.mss.soldDevicesCount} جهاز`}
                icon={CheckCircle2}
              />
            </div>
          </div>

          {/* Section 2: Side-by-Side Business Summaries (Accessories vs MSS) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Accessories Shop Summary Card */}
            <Card>
              <CardHeader className="py-3 px-4">
                <div>
                  <CardTitle className="text-sm font-semibold flex items-center gap-2 text-slate-900">
                    <ShoppingBag className="w-4 h-4 text-blue-700" />
                    <span>محل الإكسسوارات (Accessories Shop)</span>
                  </CardTitle>
                  <CardDescription>
                    SQLite محلي ومستقل بالكامل | أرباح ملكية فردية للمحل
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigateToAccessories('dashboard')}
                  rightIcon={<ChevronLeft className="w-3.5 h-3.5" />}
                >
                  الدخول للقسم
                </Button>
              </CardHeader>
              <CardContent className="p-4 space-y-3.5">
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <span className="text-[11px] text-slate-500 font-medium">صافي المبيعات</span>
                    <div className="text-base font-semibold text-slate-900 mt-0.5 tabular-nums">
                      {formatCurrency(data.accessories.netSales)}
                    </div>
                    <span className="text-[11px] text-slate-500 tabular-nums">
                      {data.accessories.invoicesCount} فاتورة بيع
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <span className="text-[11px] text-slate-500 font-medium">مجمل أرباح الإكسسوارات</span>
                    <div className="text-base font-semibold text-emerald-800 mt-0.5 tabular-nums">
                      {formatCurrency(data.accessories.grossProfit)}
                    </div>
                    <span className="text-[11px] text-emerald-700 tabular-nums">
                      هامش {data.accessories.profitMarginPercent.toFixed(1)}%
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 text-xs space-y-1.5">
                  <div className="font-medium text-slate-800 flex justify-between">
                    <span>حالة وتقييم المخزون المحلي:</span>
                    <span className="font-mono tabular-nums text-slate-700">
                      {data.accessories.totalProducts} صنف ({data.accessories.totalUnits} قطعة)
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>قيمة المخزون بسعر التكلفة:</span>
                    <span className="font-medium text-slate-900 font-mono tabular-nums">
                      {formatCurrency(data.accessories.inventoryCostValuation)}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>القيمة البيعية المتوقعة:</span>
                    <span className="font-medium text-slate-900 font-mono tabular-nums">
                      {formatCurrency(data.accessories.inventoryRetailValuation)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                  <span className="text-slate-500">تنبيهات الأصناف:</span>
                  <div className="flex gap-1.5">
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
            <Card>
              <CardHeader className="py-3 px-4">
                <div>
                  <CardTitle className="text-sm font-semibold flex items-center gap-2 text-slate-900">
                    <Laptop className="w-4 h-4 text-teal-700" />
                    <span>بيزنس أجهزة MSS (Laptop & Monitor)</span>
                  </CardTitle>
                  <CardDescription>
                    سحابي مشترك بين محلين | تتبع بالسيريال | أرباح مشتركة للبيزنس
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigateToMSS('dashboard')}
                  rightIcon={<ChevronLeft className="w-3.5 h-3.5" />}
                >
                  الدخول للقسم
                </Button>
              </CardHeader>
              <CardContent className="p-4 space-y-3.5">
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <span className="text-[11px] text-slate-500 font-medium">إجمالي مبيعات الأجهزة</span>
                    <div className="text-base font-semibold text-slate-900 mt-0.5 tabular-nums">
                      {formatCurrency(data.mss.netSales)}
                    </div>
                    <span className="text-[11px] text-slate-500 tabular-nums">
                      {data.mss.soldDevicesCount} جهاز مباع بالسيريال
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-slate-500 font-medium">مجمل الربح المشترك</span>
                      <Badge variant="purple" size="sm">
                        مشترك
                      </Badge>
                    </div>
                    <div className="text-base font-semibold text-emerald-800 mt-0.5 tabular-nums">
                      {formatCurrency(data.mss.sharedGrossProfit)}
                    </div>
                    <span className="text-[11px] text-slate-500">
                      على مستوى البيزنس ككل
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 text-xs space-y-1.5">
                  <div className="font-medium text-slate-800 flex justify-between">
                    <span>موقع الأجهزة الفعلي في المخازن:</span>
                    <span className="font-mono tabular-nums text-slate-700">
                      {data.mss.totalAvailableUnits} جهاز متوفر
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-slate-600 pt-0.5">
                    <div className="bg-white p-2 rounded border border-slate-200/80">
                      <span className="font-medium">محل 1:</span>{' '}
                      <span className="font-semibold text-slate-900 tabular-nums">{data.mss.shop1AvailableUnits} جهاز</span>
                    </div>
                    <div className="bg-white p-2 rounded border border-slate-200/80">
                      <span className="font-medium">محل 2:</span>{' '}
                      <span className="font-semibold text-slate-900 tabular-nums">{data.mss.shop2AvailableUnits} جهاز</span>
                    </div>
                  </div>
                  <div className="flex justify-between text-slate-600 pt-0.5">
                    <span>تكلفة الأجهزة المتوفرة بالمخازن:</span>
                    <span className="font-medium text-slate-900 font-mono tabular-nums">
                      {formatCurrency(data.mss.inventoryCostValuation)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                  <span className="text-slate-500">حالة السحابة والمزامنة:</span>
                  <div className="flex gap-1.5 items-center">
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
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <Store className="w-4 h-4 text-slate-600" />
                  <span>المبيعات التشغيلية لبيزنس MSS حسب فرع التنفيذ</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {data.branchOperationalSales.map((branchData, idx) => (
                <Card key={idx}>
                  <CardHeader className="py-2.5 px-4 bg-slate-50/70 border-b border-slate-100">
                    <div className="flex items-center justify-between w-full">
                      <CardTitle className="text-xs font-semibold flex items-center gap-1.5 text-slate-800">
                        <Store className="w-3.5 h-3.5 text-slate-500" />
                        <span>فرع التنفيذ: {branchData.branch}</span>
                      </CardTitle>
                      <Badge variant={idx === 0 ? 'primary' : 'purple'} size="sm">
                        حصة المبيعات: {branchData.percentageOfTotalSales.toFixed(0)}%
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-3.5 space-y-2 text-xs">
                    <div className="flex justify-between items-center py-1 border-b border-slate-100">
                      <span className="text-slate-500">عدد الأجهزة المباعة:</span>
                      <span className="font-medium text-slate-900 font-mono tabular-nums">
                        {branchData.salesCount} أجهزة
                      </span>
                    </div>

                    <div className="flex justify-between items-center py-1 border-b border-slate-100">
                      <span className="text-slate-500">الإيراد المحصل عبر الفرع:</span>
                      <span className="font-semibold text-slate-900 font-mono tabular-nums">
                        {formatCurrency(branchData.revenue)}
                      </span>
                    </div>

                    <div className="flex justify-between items-center py-1 border-b border-slate-100">
                      <span className="text-slate-500">الخصومات الممنوحة بالفرع:</span>
                      <span className="font-medium text-slate-700 font-mono tabular-nums">
                        {formatCurrency(branchData.discounts)}
                      </span>
                    </div>

                    <div className="flex justify-between items-center py-1">
                      <span className="text-slate-500">مبيعات أجهزة من الفرع الآخر (Cross-Branch):</span>
                      <span className="font-medium text-slate-900 font-mono tabular-nums">
                        {branchData.crossBranchSalesCount} عملية
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Section 4: Physical Stock Location Table */}
          <Card>
            <CardHeader className="py-3 px-4 bg-slate-50/70 border-b border-slate-100">
              <CardTitle className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
                <Laptop className="w-3.5 h-3.5 text-slate-500" />
                <span>حالة وتقييم المخزون الفيزيائي لأجهزة MSS حسب الموقع الحالي</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50/90 text-slate-600 font-medium border-b border-slate-200/90 select-none">
                    <tr>
                      <th className="px-4 py-2.5">موقع التخزين الفعلي</th>
                      <th className="px-4 py-2.5">أجهزة متوفرة</th>
                      <th className="px-4 py-2.5">أجهزة محجوزة</th>
                      <th className="px-4 py-2.5">تحت الصيانة</th>
                      <th className="px-4 py-2.5">إجمالي الوحدات</th>
                      <th className="px-4 py-2.5">قيمة التكلفة</th>
                      <th className="px-4 py-2.5">القيمة البيعية المقدرة</th>
                      <th className="px-4 py-2.5">الربح المتوقع</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.locationStockValuation.map((row, idx) => {
                      const isGrand = row.location === 'المجموع الكلي';
                      return (
                        <tr
                          key={idx}
                          className={isGrand ? 'bg-slate-50/90 font-semibold text-slate-900 border-t border-slate-200' : 'hover:bg-slate-50/60 transition-colors'}
                        >
                          <td className="px-4 py-2.5">
                            {isGrand ? (
                              <span className="text-slate-900 font-semibold">{row.location}</span>
                            ) : (
                              <Badge variant={row.location === 'محل 1' ? 'primary' : 'purple'} size="sm">
                                {row.location}
                              </Badge>
                            )}
                          </td>
                          <td className="px-4 py-2.5 font-mono tabular-nums text-emerald-700 font-medium">{row.availableUnits}</td>
                          <td className="px-4 py-2.5 font-mono tabular-nums text-amber-700">{row.reservedUnits}</td>
                          <td className="px-4 py-2.5 font-mono tabular-nums text-slate-500">{row.maintenanceUnits}</td>
                          <td className="px-4 py-2.5 font-mono tabular-nums font-semibold">{row.totalUnits}</td>
                          <td className="px-4 py-2.5 font-mono tabular-nums text-slate-700">{formatCurrency(row.totalCostValue)}</td>
                          <td className="px-4 py-2.5 font-mono tabular-nums text-slate-700">{formatCurrency(row.totalListValue)}</td>
                          <td className="px-4 py-2.5 font-mono tabular-nums text-emerald-800 font-medium">{formatCurrency(row.potentialGrossProfit)}</td>
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
