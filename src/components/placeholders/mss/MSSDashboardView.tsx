import React, { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { StatsCard, Card, CardHeader, CardTitle, CardContent } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Table, Column } from '@/components/common/Table';
import { Badge } from '@/components/common/Badge';
import { Alert } from '@/components/common/Alert';
import { Spinner } from '@/components/common/Spinner';
import { useNavigation } from '@/context/NavigationContext';
import {
  Store,
  Plus,
  RefreshCw,
  BookmarkCheck,
  Cloud,
  TrendingUp,
  Layers,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { useNotification } from '@/context/NotificationContext';
import { mssCommerceService } from '@/services/mssCommerceService.ts';
import { mssInventoryService } from '@/services/mssInventoryService.ts';
import { mssCatalogService } from '@/services/mssCatalogService.ts';
import { mssSyncService } from '@/services/mssSyncService.ts';
import { mssReportsService } from '@/services/mssReportsService.ts';
import type { MSSInvoice } from '@/types/mssCommerce.ts';
import type { MSSCatalogModel } from '@/types/mssCatalog.ts';
import { UnifiedDashboardView } from '@/components/dashboard/UnifiedDashboardView.tsx';

interface ModelStockItem extends MSSCatalogModel {
  shop_1_count: number;
  shop_2_count: number;
  total_available: number;
}

export const MSSDashboardView: React.FC = () => {
  const { setRoute } = useNavigation();
  const { showNotification } = useNotification();

  const [activeTab, setActiveTab] = useState<'mss' | 'unified'>('mss');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // MSS Data States
  const [shop1Available, setShop1Available] = useState<number>(0);
  const [shop2Available, setShop2Available] = useState<number>(0);
  const [activeReservationsCount, setActiveReservationsCount] = useState<number>(0);
  const [sharedProfit, setSharedProfit] = useState<number>(0);
  const [syncStatusText, setSyncStatusText] = useState<string>('جاري الفحص...');
  const [syncBadgeVariant, setSyncBadgeVariant] = useState<'success' | 'warning' | 'danger'>('success');
  const [modelsWithStock, setModelsWithStock] = useState<ModelStockItem[]>([]);
  const [recentSales, setRecentSales] = useState<MSSInvoice[]>([]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [devices, reservations, models, availMap, invoices, syncSummary, finSummary] =
        await Promise.all([
          mssInventoryService.getDevices(),
          mssCommerceService.getReservations({ status: 'ACTIVE' }),
          mssCatalogService.getModels(),
          mssCatalogService.getAvailabilityMap(),
          mssCommerceService.getInvoices(),
          mssSyncService.getSyncSummary(),
          mssReportsService.getMSSFinancialSummary(),
        ]);

      const s1 = devices.filter(d => d.stock_location === 'محل 1' && d.status === 'AVAILABLE').length;
      const s2 = devices.filter(d => d.stock_location === 'محل 2' && d.status === 'AVAILABLE').length;
      setShop1Available(s1);
      setShop2Available(s2);
      setActiveReservationsCount(reservations.length);
      setSharedProfit(finSummary.grossProfit);

      const mappedModels: ModelStockItem[] = models.map(m => {
        const avail = availMap[m.id] || { available_shop1: 0, available_shop2: 0, total_available: 0 };
        return {
          ...m,
          shop_1_count: avail.available_shop1,
          shop_2_count: avail.available_shop2,
          total_available: avail.total_available,
        };
      });
      setModelsWithStock(mappedModels.slice(0, 5));
      setRecentSales(invoices.filter(i => !i.is_returned).slice(0, 5));

      if (syncSummary.conflict_count > 0) {
        setSyncStatusText(`${syncSummary.conflict_count} تعارض معلق`);
        setSyncBadgeVariant('danger');
      } else if (syncSummary.pending_count > 0) {
        setSyncStatusText(`${syncSummary.pending_count} بانتظار المزامنة`);
        setSyncBadgeVariant('warning');
      } else if (syncSummary.is_online) {
        setSyncStatusText('سحابي متزامن');
        setSyncBadgeVariant('success');
      } else {
        setSyncStatusText('وضع عدم الاتصال');
        setSyncBadgeVariant('warning');
      }
    } catch (err) {
      console.warn('Failed to load MSS dashboard data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSyncNow = async () => {
    setIsSyncing(true);
    try {
      const res = await mssSyncService.syncOutbox();
      showNotification({
        type: 'success',
        title: 'اكتملت المزامنة السحابية',
        message: `تم مزامنة ${res.synced} عملية بنجاح، ووجد ${res.conflicts} تعارض.`,
      });
      loadData();
    } catch {
      showNotification({
        type: 'error',
        title: 'خطأ في المزامنة',
        message: 'تعذر الاتصال بالسحابة حالياً، تم الاحتفاظ بالبيانات محلياً.',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  if (activeTab === 'unified') {
    return (
      <div className="space-y-4">
        {/* Navigation Tab Bar */}
        <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
          <div className="inline-flex rounded-lg border border-slate-200/80 p-0.5 bg-slate-100 text-xs">
            <button
              type="button"
              className="px-3 py-1.5 rounded-md font-medium text-slate-600 hover:text-slate-900 transition-all"
              onClick={() => setActiveTab('mss')}
            >
              لوحة  MSS 
            </button>
            <button
              type="button"
              className="px-3 py-1.5 rounded-md font-semibold bg-white text-slate-900 shadow-2xs transition-all flex items-center gap-1.5"
              onClick={() => setActiveTab('unified')}
            >
              <Layers className="w-3.5 h-3.5 text-slate-600" />
              <span>لوحة القيادة الموحدة للمنشأة</span>
            </button>
          </div>
        </div>

        <UnifiedDashboardView onSwitchToMSS={() => setActiveTab('mss')} />
      </div>
    );
  }

  const columns: Column<MSSInvoice>[] = [
    {
      key: 'invoice_number',
      header: 'رقم الفاتورة',
      render: (item: MSSInvoice) => (
        <span className="font-mono font-bold text-slate-900 text-sm bg-slate-100 px-2.5 py-1 rounded-md border border-slate-300 tabular-nums">
          {item.invoice_number}
        </span>
      ),
    },
    {
      key: 'model_name',
      header: 'الموديل',
      render: (item: MSSInvoice) => (
        <span className="font-bold text-slate-900 text-sm">
          {item.brand} {item.model_name}
        </span>
      ),
    },
    {
      key: 'serial_number',
      header: 'السيريال نمبر',
      render: (item: MSSInvoice) => (
        <span className="font-mono text-xs font-bold bg-slate-100 px-2.5 py-1 rounded border border-slate-300 text-slate-800 tabular-nums">
          {item.serial_number}
        </span>
      ),
    },
    {
      key: 'selling_branch',
      header: 'فرع البيع',
      render: (item: MSSInvoice) => <Badge variant="primary" size="sm" className="font-semibold">{item.selling_branch}</Badge>,
    },
    {
      key: 'source_branch',
      header: 'مصدر الجهاز',
      render: (item: MSSInvoice) => <Badge variant="default" size="sm" className="font-semibold">{item.source_branch}</Badge>,
    },
    {
      key: 'actual_sale_price',
      header: 'سعر البيع الفعلي',
      render: (item: MSSInvoice) => (
        <span className="font-bold text-slate-900 font-mono text-sm tabular-nums">
          {formatCurrency(item.actual_sale_price)}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      {/* Top Section Tab Toggle */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
        <div className="inline-flex rounded-xl border border-slate-300 p-1 bg-slate-100 text-sm gap-1">
          <button
            type="button"
            className="px-4 py-2 rounded-lg font-bold bg-white text-slate-900 shadow-subtle border border-slate-300 transition-all"
            onClick={() => setActiveTab('mss')}
          >
            لوحة  MSS للأجهزة
          </button>
          <button
            type="button"
            className="px-4 py-2 rounded-lg font-semibold text-slate-600 hover:text-slate-900 transition-all flex items-center gap-2"
            onClick={() => setActiveTab('unified')}
          >
            <Layers className="w-4.5 h-4.5 text-slate-600" />
            <span>لوحة القيادة الموحدة للمنشأة</span>
          </button>
        </div>

        <Badge variant={syncBadgeVariant} size="md" className="font-bold text-sm px-3 py-1">{syncStatusText}</Badge>
      </div>

      <PageHeader
        title="لوحة تحكم  MSS للأجهزة"
        subtitle="نظام مشترك سحابي بين محلين مع تتبع السيريال ومزامنة فورية ودعم وضع عدم الاتصال"
        actions={
          <div className="flex items-center gap-2.5">
            <Button
              variant="outline"
              size="md"
              onClick={handleSyncNow}
              disabled={isSyncing}
              leftIcon={<RefreshCw className={`w-4.5 h-4.5 text-slate-600 ${isSyncing ? 'animate-spin' : ''}`} />}
              className="border-slate-300 font-semibold"
            >
              مزامنة سحابية الآن
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={() => setRoute('sales')}
              leftIcon={<Plus className="w-4.5 h-4.5" />}
              className="font-bold"
            >
              تسجيل عملية بيع جهاز
            </Button>
          </div>
        }
      />

      <Alert
        type="info"
        title="قواعد  MSS المشترك (Rule 9 & Rule 16)"
        message="الكتالوج مشترك بين المحلين، وتتبع الأجهزة يكون بالسيريال الفريد لكل وحدة فيزيائية، مع تسجيل فرع البيع ومصدر الجهاز بشكل منفصل تماماً، والأرباح مشتركة على مستوى ال ككل."
      />

      {isLoading ? (
        <div className="py-16 text-center">
          <Spinner size="lg" />
          <p className="mt-3 text-sm font-medium text-slate-600">جاري تحميل بيانات  MSS...</p>
        </div>
      ) : (
        <>
          {/* Top 5 KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <StatsCard
              title="مخزون محل 1 الفعلي"
              value={`${shop1Available} جهاز`}
              subtitle="متوفر وجاهز للبيع الفوري"
              icon={Store}
            />
            <StatsCard
              title="مخزون محل 2 الفعلي"
              value={`${shop2Available} جهاز`}
              subtitle="متوفر وجاهز للبيع الفوري"
              icon={Store}
            />
            <StatsCard
              title="أجهزة محجوزة لعملاء"
              value={`${activeReservationsCount} أجهزة`}
              subtitle="موقوفة من البيع المباشر"
              icon={BookmarkCheck}
            />
            <StatsCard
              title="مجمل الربح المشترك"
              value={formatCurrency(sharedProfit)}
              subtitle="أرباح موحدة على مستوى النشاط"
              icon={TrendingUp}
            />
            <StatsCard
              title="حالة المزامنة السحابية"
              value={syncStatusText}
              subtitle="دعم كامل لوضع الأوفلاين"
              icon={Cloud}
            />
          </div>

          {/* Availability by Model Table */}
          <Card className="bg-white border-slate-300 shadow-2xs overflow-hidden">
            <CardHeader className="py-3.5 px-4 bg-slate-100 border-b border-slate-300 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-bold text-slate-900">
                موقف الأجهزة المتوفرة بالموديل بين المحلين
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setRoute('inventory')}
                className="text-xs font-bold text-slate-700 hover:text-slate-900"
              >
                عرض تفاصيل السيريالات &larr;
              </Button>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-right">
                <thead className="bg-slate-100 text-xs font-bold text-slate-700 border-b border-slate-300">
                  <tr>
                    <th className="py-3 px-3.5">موديل الجهاز</th>
                    <th className="py-3 px-3.5 text-center">محل 1 (الكمية)</th>
                    <th className="py-3 px-3.5 text-center">محل 2 (الكمية)</th>
                    <th className="py-3 px-3.5 text-center">الإجمالي المشترك</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {modelsWithStock.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-slate-500 text-sm">
                        لا توجد موديلات مسجلة
                      </td>
                    </tr>
                  ) : (
                    modelsWithStock.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-3.5 font-bold text-slate-900">
                          {item.brand} {item.model_name}
                        </td>
                        <td className="py-3 px-3.5 text-center font-mono font-bold tabular-nums text-slate-800">
                          {item.shop_1_count}
                        </td>
                        <td className="py-3 px-3.5 text-center font-mono font-bold tabular-nums text-slate-800">
                          {item.shop_2_count}
                        </td>
                        <td className="py-3 px-3.5 text-center">
                          <span className="font-mono tabular-nums font-bold text-slate-900 bg-slate-100 px-3 py-1 rounded-md border border-slate-300">
                            {item.total_available}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Recent Sales Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">آخر مبيعات الأجهزة المسجلة في MSS</h3>
              <Button size="sm" variant="outline" onClick={() => setRoute('invoices')} className="border-slate-300 text-slate-800 font-semibold">
                عرض سجل الفواتير كاملاً
              </Button>
            </div>
            <div className="bg-white rounded-xl border border-slate-300 overflow-hidden shadow-2xs">
              <Table
                columns={columns}
                data={recentSales}
                keyExtractor={(item: MSSInvoice) => item.id}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
};
