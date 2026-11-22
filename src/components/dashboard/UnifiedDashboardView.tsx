import React, { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { StatsCard, Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Badge } from '@/components/common/Badge';
import { Alert } from '@/components/common/Alert';
import { Spinner } from '@/components/common/Spinner';
import { useNavigation } from '@/context/NavigationContext';
import { usePageRefresh } from '@/context/PageRefreshContext';
import { useNotification } from '@/context/NotificationContext';
import { useAuth } from '@/context/AuthContext';
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
  FileDown,
  ChevronLeft,
  ShieldAlert,
  ReceiptText,
  Wallet,
} from 'lucide-react';
import { formatCurrency, formatPieceCount, cn } from '@/lib/utils';
import { DateRangeInputs } from '@/components/common/DateRangeInputs';
import { unifiedDashboardService } from '@/services/unifiedDashboardService.ts';
import { desktopAuthService } from '@/services/desktopAuthService.ts';
import { documentPrintService } from '@/lib/documentPrintService';
import { PrintableUnifiedReport } from '@/components/reports/PrintableUnifiedReport';
import type {
  ReportPeriod,
  UnifiedBusinessDashboardData,
  DashboardModuleScope,
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
  const { isRefreshing, triggerRefresh } = usePageRefresh();
  const { showNotification } = useNotification();
  const { user } = useAuth();

  const [period, setPeriod] = useState<ReportPeriod>('month');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [data, setData] = useState<UnifiedBusinessDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Authoritative module permission resolution (Source of truth: user.allowedModules)
  const userAllowed = user?.allowedModules;
  const isExplicitPermission =
    userAllowed === 'accessories' ||
    userAllowed === 'mss' ||
    userAllowed === 'both' ||
    userAllowed === 'none';

  const userPermissionScope: DashboardModuleScope = isExplicitPermission
    ? userAllowed
    : (user as any)?.role === 'superadmin' || user?.username === 'admin' || user?.username === 'saberadmin'
    ? 'both'
    : 'both';

  const canSwitchScope = userPermissionScope === 'both';
  const [selectedScopeFilter, setSelectedScopeFilter] = useState<'both' | 'accessories' | 'mss'>('both');
  const effectiveScope: DashboardModuleScope = canSwitchScope ? selectedScopeFilter : userPermissionScope;

  // Reset manual filter if permission scope changes to single-module
  useEffect(() => {
    if (!canSwitchScope) {
      setSelectedScopeFilter('both');
    }
  }, [canSwitchScope]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      let scopeToQuery = effectiveScope;
      if (!user) {
        // Fallback to secure session store if context user state has not settled yet
        const session = await desktopAuthService.loadSecureSession();
        if (session?.user?.allowedModules) {
          const mod = session.user.allowedModules;
          if (mod === 'accessories' || mod === 'mss' || mod === 'both' || mod === 'none') {
            scopeToQuery = mod;
          }
        }
      }

      const res = await unifiedDashboardService.getUnifiedDashboardData(
        period,
        customStart || undefined,
        customEnd || undefined,
        scopeToQuery
      );
      setData(res);
    } catch (err: any) {
      console.warn('Failed to load unified dashboard data:', err);
      showNotification({
        type: 'error',
        title: 'خطأ في جلب بيانات لوحة التحكم',
        message: err?.message || 'تعذر جلب مؤشرات لوحة التحكم الموحدة',
      });
    } finally {
      setIsLoading(false);
    }
  }, [period, customStart, customEnd, effectiveScope, user, showNotification]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handlePrint = async () => {
    if (!data) return;
    await documentPrintService.printElement('unified-report-document-root', {
      title: `تقرير_تنفيذي_موحد_${new Date().toISOString().slice(0, 10)}`,
      format: 'report',
      orientation: 'portrait',
    });
  };

  const handleExportPdf = async () => {
    if (!data) return;
    try {
      await documentPrintService.exportToPdf('unified-report-document-root', {
        title: `تقرير_تنفيذي_موحد_${new Date().toISOString().slice(0, 10)}`,
        format: 'report',
        orientation: 'portrait',
        exportType: scope === 'mss' ? 'mss_reports' : 'accessories_reports',
      });
      showNotification({
        type: 'success',
        title: 'استخراج التقرير الموحد كـ PDF',
        message: 'تم تصدير وتحميل التقرير المالي والتنفيذي الموحد بتنسيق PDF بنجاح.',
      });
    } catch (err: any) {
      showNotification({
        type: 'error',
        title: 'فشل استخراج PDF',
        message: err?.message || 'تعذر تصدير ملف PDF للتقرير الموحد.',
      });
    }
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

  const scope = data?.moduleScope || effectiveScope;

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <PageHeader
        title={
          scope === 'accessories'
            ? 'لوحة القيادة والتقارير التنفيذية — الإكسسوارات'
            : scope === 'mss'
            ? 'لوحة القيادة والتقارير التنفيذية — Compu MSS'
            : 'لوحة القيادة الموحدة والتقارير التنفيذية'
        }
        subtitle={
          scope === 'accessories'
            ? 'نظرة عامة متقدمة للأداء المالي لموديول الإكسسوارات ومراقبة المخزون'
            : scope === 'mss'
            ? 'نظرة عامة للأداء المالي لموديول Compu MSS ومراقبة الأصول والمخزون'
            : 'نظرة عامة مجمعة لنشاط محل الإكسسوارات و Compu MSS'
        }
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => triggerRefresh(loadData, 'جارٍ تحديث مؤشرات لوحة التحكم الموحدة...')}
              disabled={isRefreshing || isLoading}
              leftIcon={<RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${isRefreshing ? 'animate-spin' : ''}`} />}
            >
              Refresh
            </Button>
            {scope !== 'none' && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportPdf}
                  disabled={isLoading || !data}
                  leftIcon={<FileDown className="w-3.5 h-3.5 text-blue-600" />}
                  className="border-slate-300 font-bold hover:bg-slate-50 text-slate-800"
                  title="استخراج وحفظ التقرير التنفيذي الموحد كملف PDF"
                >
                  استخراج PDF
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrint}
                  disabled={isLoading || !data}
                  leftIcon={<Printer className="w-3.5 h-3.5 text-slate-500" />}
                  title="طباعة التقرير التنفيذي الموحد"
                >
                  طباعة
                </Button>
              </>
            )}
          </div>
        }
      />

      {/* Date Filter Bar */}
      {scope !== 'none' && (
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
                    className={`px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-colors ${period === opt.id
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
      )}

      {isLoading || !data ? (
        <div className="py-16 text-center">
          <Spinner size="lg" />
          <p className="mt-2.5 text-xs text-slate-500">جاري تجميع المؤشرات والبيانات...</p>
        </div>
      ) : scope === 'none' ? (
        /* SCENARIO 4: NO MODULE PERMISSIONS GRANTED */
        <div className="space-y-6">
          <div className="p-8 bg-white border border-slate-200 rounded-2xl text-center space-y-4 shadow-sm max-w-2xl mx-auto my-12">
            <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 mx-auto flex items-center justify-center">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-slate-900">لا توجد صلاحيات وحدات مخصصة لحسابك</h3>
              <p className="text-xs text-slate-500 leading-relaxed max-w-md mx-auto">
                لم يتم تعيين أي صلاحية وصول (إكسسوارات أو Compu MSS) لحسابك حالياً. تم حجب كافة الإحصائيات والبيانات لحماية خصوصية وسرية النظام. يرجى التواصل مع مسؤول النظام لمنحك الصلاحيات اللازمة.
              </p>
            </div>
            <div className="pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={loadData}
                leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
              >
                إعادة التحقق من الصلاحيات
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Business Alerts Banner (Strictly Filtered by Scope) */}
          {(((scope === 'accessories' || scope === 'both') && data.alerts.hasStockAlerts) ||
            ((scope === 'mss' || scope === 'both') && data.alerts.hasSyncAlerts)) && (
            <div className="space-y-2.5">
              {(scope === 'accessories' || scope === 'both') && data.alerts.hasStockAlerts && (
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

              {(scope === 'mss' || scope === 'both') && data.alerts.hasSyncAlerts && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-lg flex items-start justify-between gap-3 text-rose-900">
                  <div className="flex items-start gap-2.5">
                    <Cloud className="w-4 h-4 text-rose-700 mt-0.5 shrink-0" />
                    <div>
                      <div className="font-semibold text-xs">تنبيهات مزامنة Compu MSS</div>
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

          {/* Section 1: Executive Financial KPIs (Strictly Isolated Calculations) */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2.5 mb-2.5">
              <div className="flex items-center gap-2">
                <Badge
                  variant={scope === 'accessories' ? 'primary' : scope === 'mss' ? 'purple' : 'outline'}
                  size="md"
                >
                  {scope === 'accessories'
                    ? 'قسم الإكسسوارات فقط'
                    : scope === 'mss'
                    ? 'قسم Compu MSS فقط'
                    : 'الإكسسوارات + Compu MSS'}
                </Badge>
              </div>

              {canSwitchScope && (
                <div className="inline-flex rounded-xl border border-slate-300 p-1 bg-slate-100 text-xs shadow-sm">
                  <button
                    type="button"
                    className={`px-3 py-1 rounded-lg font-semibold transition-colors ${
                      selectedScopeFilter === 'both'
                        ? 'bg-white shadow-sm text-slate-900 font-bold border border-slate-300'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
                    }`}
                    onClick={() => setSelectedScopeFilter('both')}
                  >
                    الكل (الموحد)
                  </button>
                  <button
                    type="button"
                    className={`px-3 py-1 rounded-lg font-semibold transition-colors ${
                      selectedScopeFilter === 'accessories'
                        ? 'bg-white shadow-sm text-blue-700 font-bold border border-slate-300'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
                    }`}
                    onClick={() => setSelectedScopeFilter('accessories')}
                  >
                    الإكسسوارات فقط
                  </button>
                  <button
                    type="button"
                    className={`px-3 py-1 rounded-lg font-semibold transition-colors ${
                      selectedScopeFilter === 'mss'
                        ? 'bg-white shadow-sm text-teal-700 font-bold border border-slate-300'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
                    }`}
                    onClick={() => setSelectedScopeFilter('mss')}
                  >
                    Compu MSS فقط
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
              <StatsCard
                title="إجمالي الإيرادات"
                value={formatCurrency(data.combined.combinedRevenue)}
                subtitle={
                  scope === 'accessories'
                    ? `${data.combined.totalTransactionsCount} فاتورة بيع خلال الفترة`
                    : scope === 'mss'
                    ? `${data.combined.totalTransactionsCount} جهاز مباع خلال الفترة`
                    : `${data.combined.totalTransactionsCount} معاملة بيع خلال الفترة`
                }
                icon={DollarSign}
              />
              <StatsCard
                title="إجمالي تكلفة البضاعة المباعة"
                value={formatCurrency(data.combined.combinedCogs)}
                subtitle={
                  scope === 'accessories'
                    ? 'تكلفة شراء بضاعة الإكسسوارات المباعة'
                    : scope === 'mss'
                    ? 'تكلفة شراء الأجهزة المباعة'
                    : 'تكلفة شراء الإكسسوارات والأجهزة المباعة'
                }
                icon={scope === 'accessories' ? ShoppingBag : scope === 'mss' ? Laptop : ShoppingBag}
              />
              <StatsCard
                title="مجمل الربح الإجمالي"
                value={formatCurrency(data.combined.combinedGrossProfit)}
                subtitle={`هامش ربح إجمالي ${data.combined.profitMarginPercent.toFixed(1)}%`}
                icon={TrendingUp}
              />
              <StatsCard
                title="المصروفات التشغيلية"
                value={formatCurrency(data.combined.combinedOperatingExpenses || 0)}
                subtitle="إجمالي المصروفات للفترة"
                icon={ReceiptText}
              />
              <StatsCard
                title="صافي الربح بعد المصروفات"
                value={formatCurrency(data.combined.combinedNetProfit ?? (data.combined.combinedGrossProfit - (data.combined.combinedOperatingExpenses || 0)))}
                subtitle={`هامش صافي ${(data.combined.netProfitMarginPercent ?? 0).toFixed(1)}%`}
                icon={Wallet}
              />
              <StatsCard
                title="إجمالي الحركات المنفذة"
                value={`${data.combined.totalTransactionsCount} عملية`}
                subtitle={
                  scope === 'accessories'
                    ? `${data.accessories?.invoicesCount || 0} فاتورة إكسسوارات`
                    : scope === 'mss'
                    ? `${data.mss?.soldDevicesCount || 0} جهاز مباع بالسيريال`
                    : `${data.accessories?.invoicesCount || 0} إكسسوار + ${data.mss?.soldDevicesCount || 0} جهاز`
                }
                icon={CheckCircle2}
              />
            </div>
          </div>

          {/* Section 2: Business Summaries (Dynamically Isolated & Naturally Responsive) */}
          <div className={cn('grid gap-5', scope === 'both' ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1')}>
            {/* Accessories Shop Summary Card (Rendered only when Accessories is authorized) */}
            {(scope === 'accessories' || scope === 'both') && data.accessories && (
              <Card>
                <CardHeader className="py-4 px-6 border-b border-slate-200">
                  <div>
                    <CardTitle className="text-base font-bold flex items-center gap-2.5 text-slate-900">
                      <ShoppingBag className="w-5 h-5 text-blue-700" />
                      <span>محل الإكسسوارات</span>
                    </CardTitle>
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
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                      <span className="text-xs text-slate-600 font-semibold">صافي المبيعات</span>
                      <div className="text-lg font-bold text-slate-900 mt-1 tabular-nums">
                        {formatCurrency(data.accessories.netSales)}
                      </div>
                      <span className="text-[11px] text-slate-500 tabular-nums font-medium">
                        {data.accessories.invoicesCount} فاتورة بيع
                      </span>
                    </div>

                    <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                      <span className="text-xs text-slate-600 font-semibold">مجمل الأرباح </span>
                      <div className="text-lg font-bold text-emerald-800 mt-1 tabular-nums">
                        {formatCurrency(data.accessories.grossProfit)}
                      </div>
                      <span className="text-[11px] text-emerald-700 tabular-nums font-semibold">
                        هامش {data.accessories.profitMarginPercent.toFixed(1)}%
                      </span>
                    </div>

                    <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                      <span className="text-xs text-slate-600 font-semibold">صافي الربح</span>
                      <div className="text-lg font-bold text-emerald-900 mt-1 tabular-nums">
                        {formatCurrency(data.accessories.netProfit ?? (data.accessories.grossProfit - (data.accessories.operatingExpenses || 0)))}
                      </div>
                      <span className="text-[11px] text-rose-600 tabular-nums font-medium">
                        مصروفات: {formatCurrency(data.accessories.operatingExpenses || 0)}
                      </span>
                    </div>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-sm space-y-2">
                    <div className="font-bold text-slate-900 flex justify-between">
                      <span>حالة وتقييم المخزون :</span>
                      <span className="font-mono tabular-nums text-slate-800">
                        {data.accessories.totalProducts} صنف ({formatPieceCount(data.accessories.totalUnits, { zeroText: '0 قطعة' })})
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
            )}

            {/* MSS Business Summary Card (Rendered only when Compu MSS is authorized) */}
            {(scope === 'mss' || scope === 'both') && data.mss && (
              <Card>
                <CardHeader className="py-4 px-6 border-b border-slate-200">
                  <div>
                    <CardTitle className="text-base font-bold flex items-center gap-2.5 text-slate-900">
                      <Laptop className="w-5 h-5 text-teal-700" />
                      <span> Compu MSS </span>
                    </CardTitle>
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
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                      <span className="text-xs text-slate-600 font-semibold">إجمالي المبيعات </span>
                      <div className="text-lg font-bold text-slate-900 mt-1 tabular-nums">
                        {formatCurrency(data.mss.netSales)}
                      </div>
                      <span className="text-[11px] text-slate-500 tabular-nums font-medium">
                        {data.mss.soldDevicesCount} جهاز مباع
                      </span>
                    </div>

                    <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-600 font-semibold">مجمل الربح </span>
                        <Badge variant="purple" size="sm">
                          مشترك
                        </Badge>
                      </div>
                      <div className="text-lg font-bold text-emerald-800 mt-1 tabular-nums">
                        {formatCurrency(data.mss.sharedGrossProfit)}
                      </div>
                      <span className="text-[11px] text-emerald-700 tabular-nums font-semibold">
                        هامش {data.mss.profitMarginPercent.toFixed(1)}%
                      </span>
                    </div>

                    <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                      <span className="text-xs text-slate-600 font-semibold">صافي الربح</span>
                      <div className="text-lg font-bold text-emerald-900 mt-1 tabular-nums">
                        {formatCurrency(data.mss.netProfit ?? (data.mss.sharedGrossProfit - (data.mss.operatingExpenses || 0)))}
                      </div>
                      <span className="text-[11px] text-rose-600 tabular-nums font-medium">
                        مصروفات: {formatCurrency(data.mss.operatingExpenses || 0)}
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
                      {data.mss.locationAvailableUnits && Object.keys(data.mss.locationAvailableUnits).length > 0 ? (
                        Object.entries(data.mss.locationAvailableUnits).map(([loc, count]) => (
                          <div key={loc} className="bg-white p-2.5 rounded-lg border border-slate-200">
                            <span className="font-semibold text-xs">{loc}:</span>{' '}
                            <span className="font-bold text-slate-900 tabular-nums text-sm">{count} جهاز</span>
                          </div>
                        ))
                      ) : (
                        <div className="bg-white p-2.5 rounded-lg border border-slate-200 col-span-2 text-center text-xs text-slate-500">
                          لا توجد فروع مسجلة حالياً
                        </div>
                      )}
                    </div>
                    <div className="flex justify-between text-slate-700 pt-1 font-medium">
                      <span>تكلفة الأجهزة المتوفرة بالمخازن:</span>
                      <span className="font-bold text-slate-900 font-mono tabular-nums">
                        {formatCurrency(data.mss.inventoryCostValuation)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-200">
                    <div className="flex gap-2 items-center">
                      {data.mss.isOnline ? (
                        <Badge variant="success">متصل </Badge>
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
            )}
          </div>

          {/* Section 3: Branch Operational Execution (Strictly MSS Only) */}
          {(scope === 'mss' || scope === 'both') && data.branchOperationalSales && data.branchOperationalSales.length > 0 && (
            <div className="space-y-3.5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2.5">
                    <Store className="w-5 h-5 text-slate-700" />
                    <span>المبيعات التشغيلية لـ Compu MSS مفصلة</span>
                  </h3>
                </div>
              </div>

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
                        <span className="text-slate-600 font-medium">الإيراد المحصل:</span>
                        <span className="font-bold text-slate-900 font-mono tabular-nums">
                          {formatCurrency(branchData.revenue)}
                        </span>
                      </div>

                      <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                        <span className="text-slate-600 font-medium">الخصومات الممنوحة:</span>
                        <span className="font-semibold text-slate-700 font-mono tabular-nums">
                          {formatCurrency(branchData.discounts)}
                        </span>
                      </div>

                      <div className="flex justify-between items-center py-1.5">
                        <span className="text-slate-600 font-medium">مبيعات أجهزة من مخزون الفرع الآخر:</span>
                        <span className="font-bold text-slate-900 font-mono tabular-nums">
                          {branchData.crossBranchSalesCount} عملية
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Section 4: Physical Stock Location Table (Strictly MSS Only) */}
          {(scope === 'mss' || scope === 'both') && data.locationStockValuation && data.locationStockValuation.length > 0 && (
            <Card>
              <CardHeader className="py-4 px-6 bg-slate-50 border-b border-slate-200">
                <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Laptop className="w-5 h-5 text-slate-700" />
                  <span>حالة وتقييم المخزون لأجهزة Compu MSS</span>
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
                                <Badge variant="primary" size="sm">
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
          )}

          {/* Hidden Pristine Unified Executive Report Template for Print & PDF */}
          <div className="hidden" aria-hidden="true">
            <div id="unified-report-document-root">
              <PrintableUnifiedReport
                data={data}
                period={period}
                customStart={customStart}
                customEnd={customEnd}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
};
