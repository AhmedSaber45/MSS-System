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
import { DateRangeInputs } from '@/components/common/DateRangeInputs';
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

  const navigateToAccessories = (route: any = 'dashboard', params?: Record<string, any>) => {
    setSection('accessories');
    setRoute(route, params);
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
        subtitle="نظرة عامة مجمعة لنشاط محل الإكسسوارات و  MSS مع الفصل الصارم للقواعد المالية"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadData}
              isLoading={isLoading}
              leftIcon={<RefreshCw className="w-3.5 h-3.5 text-slate-500" />}
            >
              Refresh
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
      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <Calendar className="w-4.5 h-4.5 text-slate-500" />
              <span>فترة التقرير:</span>
            </div>

            <div className="inline-flex rounded-xl border border-slate-300 p-1 bg-slate-100 text-sm shadow-sm">
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
                  className={`px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                    period === opt.id
                      ? 'bg-white shadow-sm text-slate-900 font-bold border border-slate-300'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
                  }`}
                  onClick={() => setPeriod(opt.id as ReportPeriod)}
                >
                  {opt.label}
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
            النطاق: <span className="text-slate-900 font-bold">{data?.filter.label}</span>
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
                    className="border-amber-300 hover:bg-amber-100 text-amber-900 text-xs font-bold"
                    onClick={() => navigateToAccessories('inventory', { filter: 'low_and_out' })}
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
                      <div className="font-semibold text-xs">تنبيهات مزامنة  MSS</div>
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
                الإكسسوارات +  MSS
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Accessories Shop Summary Card */}
            <Card>
              <CardHeader className="py-4 px-6 border-b border-slate-200">
                <div>
                  <CardTitle className="text-base font-bold flex items-center gap-2.5 text-slate-900">
                    <ShoppingBag className="w-5 h-5 text-blue-700" />
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
                  rightIcon={<ChevronLeft className="w-4 h-4" />}
                >
                  الدخول للقسم
                </Button>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-3.5">
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-xs text-slate-600 font-semibold">صافي المبيعات</span>
                    <div className="text-xl font-bold text-slate-900 mt-1 tabular-nums">
                      {formatCurrency(data.accessories.netSales)}
                    </div>
                    <span className="text-xs text-slate-500 tabular-nums font-medium">
                      {data.accessories.invoicesCount} فاتورة بيع
                    </span>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-xs text-slate-600 font-semibold">مجمل أرباح الإكسسوارات</span>
                    <div className="text-xl font-bold text-emerald-800 mt-1 tabular-nums">
                      {formatCurrency(data.accessories.grossProfit)}
                    </div>
                    <span className="text-xs text-emerald-700 tabular-nums font-semibold">
                      هامش {data.accessories.profitMarginPercent.toFixed(1)}%
                    </span>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-sm space-y-2">
                  <div className="font-bold text-slate-900 flex justify-between">
                    <span>حالة وتقييم المخزون المحلي:</span>
                    <span className="font-mono tabular-nums text-slate-800">
                      {data.accessories.totalProducts} صنف ({data.accessories.totalUnits} قطعة)
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-700 font-medium">
                    <span>قيمة المخزون بسعر التكلفة:</span>
                    <span className="font-bold text-slate-900 font-mono tabular-nums">
                      {formatCurrency(data.accessories.inventoryCostValuation)}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-700 font-medium">
                    <span>القيمة البيعية المتوقعة:</span>
                    <span className="font-bold text-slate-900 font-mono tabular-nums">
                      {formatCurrency(data.accessories.inventoryRetailValuation)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-200">
                  <span className="text-slate-600 font-semibold">تنبيهات الأصناف:</span>
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
            <Card>
              <CardHeader className="py-4 px-6 border-b border-slate-200">
                <div>
                  <CardTitle className="text-base font-bold flex items-center gap-2.5 text-slate-900">
                    <Laptop className="w-5 h-5 text-teal-700" />
                    <span> أجهزة MSS (Laptop & Monitor)</span>
                  </CardTitle>
                  <CardDescription>
                    سحابي مشترك بين محلين | تتبع بالسيريال | أرباح مشتركة لل
                  </CardDescription>
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
              <CardContent className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-3.5">
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-xs text-slate-600 font-semibold">إجمالي مبيعات الأجهزة</span>
                    <div className="text-xl font-bold text-slate-900 mt-1 tabular-nums">
                      {formatCurrency(data.mss.netSales)}
                    </div>
                    <span className="text-xs text-slate-500 tabular-nums font-medium">
                      {data.mss.soldDevicesCount} جهاز مباع بالسيريال
                    </span>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-600 font-semibold">مجمل الربح المشترك</span>
                      <Badge variant="purple" size="sm">
                        مشترك
                      </Badge>
                    </div>
                    <div className="text-xl font-bold text-emerald-800 mt-1 tabular-nums">
                      {formatCurrency(data.mss.sharedGrossProfit)}
                    </div>
                    <span className="text-xs text-slate-500 font-medium">
                      على مستوى ال ككل
                    </span>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-sm space-y-2">
                  <div className="font-bold text-slate-900 flex justify-between">
                    <span>موقع الأجهزة الفعلي في المخازن:</span>
                    <span className="font-mono tabular-nums text-slate-800">
                      {data.mss.totalAvailableUnits} جهاز متوفر
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-slate-700 pt-0.5">
                    <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                      <span className="font-semibold text-xs">محل 1:</span>{' '}
                      <span className="font-bold text-slate-900 tabular-nums text-sm">{data.mss.shop1AvailableUnits} جهاز</span>
                    </div>
                    <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                      <span className="font-semibold text-xs">محل 2:</span>{' '}
                      <span className="font-bold text-slate-900 tabular-nums text-sm">{data.mss.shop2AvailableUnits} جهاز</span>
                    </div>
                  </div>
                  <div className="flex justify-between text-slate-700 pt-1 font-medium">
                    <span>تكلفة الأجهزة المتوفرة بالمخازن:</span>
                    <span className="font-bold text-slate-900 font-mono tabular-nums">
                      {formatCurrency(data.mss.inventoryCostValuation)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-200">
                  <span className="text-slate-600 font-semibold">حالة السحابة والمزامنة:</span>
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
          <div className="space-y-3.5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2.5">
                  <Store className="w-5 h-5 text-slate-700" />
                  <span>المبيعات التشغيلية ل MSS حسب فرع التنفيذ</span>
                </h3>
                <p className="text-sm text-slate-600 mt-1">
                  تحديد حجم المعاملات والتحصيل المنفذ من خلال كل فرع
                </p>
              </div>
            </div>

            {/* Rule 16 Callout Alert */}
            <Alert
              type="info"
              title="تنبيه محاسبي حاسم (القاعدة 16): الفصل بين النشاط التشغيلي والربحية المشتركة"
              message="الأرقام أدناه توضح فقط الفرع الذي قام بتنفيذ وإتمام عملية البيع والتحصيل النقدي. بينما أرباح  MSS هي أرباح موحدة على مستوى النشاط المشترك ككل، ولا يجوز اعتبارها أو نسبتها كأرباح فردية خاصة بالفرع البائع."
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {data.branchOperationalSales.map((branchData, idx) => (
                <Card key={idx}>
                  <CardHeader className="py-3 px-5 bg-slate-50 border-b border-slate-200">
                    <div className="flex items-center justify-between w-full">
                      <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-900">
                        <Store className="w-4 h-4 text-slate-600" />
                        <span>فرع التنفيذ: {branchData.branch}</span>
                      </CardTitle>
                      <Badge variant={idx === 0 ? 'primary' : 'purple'} size="sm">
                        حصة المبيعات: {branchData.percentageOfTotalSales.toFixed(0)}%
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 space-y-2.5 text-sm">
                    <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                      <span className="text-slate-600 font-medium">عدد الأجهزة المباعة:</span>
                      <span className="font-bold text-slate-900 font-mono tabular-nums">
                        {branchData.salesCount} أجهزة
                      </span>
                    </div>

                    <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                      <span className="text-slate-600 font-medium">الإيراد المحصل عبر الفرع:</span>
                      <span className="font-bold text-slate-900 font-mono tabular-nums">
                        {formatCurrency(branchData.revenue)}
                      </span>
                    </div>

                    <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                      <span className="text-slate-600 font-medium">الخصومات الممنوحة بالفرع:</span>
                      <span className="font-semibold text-slate-700 font-mono tabular-nums">
                        {formatCurrency(branchData.discounts)}
                      </span>
                    </div>

                    <div className="flex justify-between items-center py-1.5">
                      <span className="text-slate-600 font-medium">مبيعات أجهزة من الفرع الآخر (Cross-Branch):</span>
                      <span className="font-bold text-slate-900 font-mono tabular-nums">
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
            <CardHeader className="py-4 px-6 bg-slate-50 border-b border-slate-200">
              <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Laptop className="w-5 h-5 text-slate-700" />
                <span>حالة وتقييم المخزون الفيزيائي لأجهزة MSS حسب الموقع الحالي</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-right text-sm">
                  <thead className="bg-slate-100/90 text-slate-700 font-semibold border-b border-slate-300 select-none">
                    <tr>
                      <th className="px-4 py-3">موقع التخزين الفعلي</th>
                      <th className="px-4 py-3">أجهزة متوفرة</th>
                      <th className="px-4 py-3">أجهزة محجوزة</th>
                      <th className="px-4 py-3">تحت الصيانة</th>
                      <th className="px-4 py-3">إجمالي الوحدات</th>
                      <th className="px-4 py-3">قيمة التكلفة</th>
                      <th className="px-4 py-3">القيمة البيعية المقدرة</th>
                      <th className="px-4 py-3">الربح المتوقع</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {data.locationStockValuation.map((row, idx) => {
                      const isGrand = row.location === 'المجموع الكلي';
                      return (
                        <tr
                          key={idx}
                          className={isGrand ? 'bg-slate-100/80 font-bold text-slate-900 border-t-2 border-slate-300' : 'hover:bg-slate-50 transition-colors'}
                        >
                          <td className="px-4 py-3">
                            {isGrand ? (
                              <span className="text-slate-900 font-bold">{row.location}</span>
                            ) : (
                              <Badge variant={row.location === 'محل 1' ? 'primary' : 'purple'} size="sm">
                                {row.location}
                              </Badge>
                            )}
                          </td>
                          <td className="px-4 py-3 font-mono tabular-nums text-emerald-700 font-bold">{row.availableUnits}</td>
                          <td className="px-4 py-3 font-mono tabular-nums text-amber-800 font-semibold">{row.reservedUnits}</td>
                          <td className="px-4 py-3 font-mono tabular-nums text-slate-600 font-medium">{row.maintenanceUnits}</td>
                          <td className="px-4 py-3 font-mono tabular-nums font-bold text-slate-900">{row.totalUnits}</td>
                          <td className="px-4 py-3 font-mono tabular-nums text-slate-800 font-medium">{formatCurrency(row.totalCostValue)}</td>
                          <td className="px-4 py-3 font-mono tabular-nums text-slate-800 font-medium">{formatCurrency(row.totalListValue)}</td>
                          <td className="px-4 py-3 font-mono tabular-nums text-emerald-800 font-bold">{formatCurrency(row.potentialGrossProfit)}</td>
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
