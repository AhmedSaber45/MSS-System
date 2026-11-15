import React, { useState, useEffect } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { StatsCard, Card, CardHeader, CardTitle, CardContent } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Table, Column } from '@/components/common/Table';
import { Badge } from '@/components/common/Badge';
import { useNavigation } from '@/context/NavigationContext';
import {
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Package,
  Plus,
  ShoppingCart,
  RotateCcw,
  HardDriveDownload,
  Barcode,
  ArrowUpRight,
  Layers,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { productsService } from '@/services/productsService.ts';
import { salesService } from '@/services/salesService.ts';
import { reportsService } from '@/services/reportsService.ts';
import type { Invoice } from '@/types/sale.ts';
import type { FinancialSummary } from '@/types/reports.ts';

import { UnifiedDashboardView } from '@/components/dashboard/UnifiedDashboardView.tsx';

export const AccessoriesDashboardView: React.FC = () => {
  const { setRoute } = useNavigation();
  const [activeTab, setActiveTab] = useState<'accessories' | 'unified'>('accessories');

  const [metrics, setMetrics] = useState({
    totalProducts: 0,
    totalUnits: 0,
    lowStockCount: 0,
    outOfStockCount: 0,
  });

  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [recentInvoices, setRecentInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    async function loadDashboardData() {
      setIsLoading(true);
      try {
        const [prodMetrics, finSummary, allInvoices] = await Promise.all([
          productsService.getMetrics(),
          reportsService.getFinancialSummary(),
          salesService.getInvoices(),
        ]);

        setMetrics({
          totalProducts: prodMetrics.totalProducts,
          totalUnits: prodMetrics.totalUnits,
          lowStockCount: prodMetrics.lowStockCount,
          outOfStockCount: prodMetrics.outOfStockCount,
        });

        setSummary(finSummary);
        setRecentInvoices(allInvoices.slice(0, 5));
      } catch (err) {
        console.warn('Failed to load dashboard data:', err);
      } finally {
        setIsLoading(false);
      }
    }

    loadDashboardData();
  }, []);

  const columns: Column<Invoice>[] = [
    {
      key: 'invoice_number',
      header: 'رقم الفاتورة',
      render: (item: Invoice) => (
        <span className="font-mono text-sm font-bold text-slate-900 tabular-nums">{item.invoice_number}</span>
      ),
    },
    {
      key: 'invoice_date',
      header: 'التاريخ',
      render: (item: Invoice) => (
        <span className="font-mono text-slate-600 text-sm tabular-nums font-medium">{item.invoice_date}</span>
      ),
    },
    {
      key: 'customer_name',
      header: 'العميل',
      render: (item: Invoice) => (
        <span className="font-medium text-slate-900 text-sm">{item.customer_name || 'نقدي عام'}</span>
      ),
    },
    {
      key: 'items_count',
      header: 'الأصناف',
      render: (item: Invoice) => <span className="tabular-nums text-sm font-medium text-slate-700">{item.items_count} أصناف</span>,
    },
    {
      key: 'total_amount',
      header: 'المبلغ الإجمالي',
      render: (item: Invoice) => (
        <span className="font-bold font-mono text-slate-900 tabular-nums text-sm">{formatCurrency(item.total_amount)}</span>
      ),
    },
    {
      key: 'payment_method',
      header: 'طريقة الدفع',
      render: (item: Invoice) => (
        <Badge
          variant={
            item.payment_method === 'نقدي'
              ? 'success'
              : item.payment_method === 'فيزا'
                ? 'primary'
                : 'default'
          }
          size="md"
        >
          {item.payment_method}
        </Badge>
      ),
    },
  ];

  if (activeTab === 'unified') {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div className="inline-flex rounded-xl border border-slate-300 p-1 bg-slate-100 text-sm shadow-sm">
            <button
              type="button"
              className="px-4 py-1.5 rounded-lg text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors"
              onClick={() => setActiveTab('accessories')}
            >
              لوحة محل الإكسسوارات
            </button>
            <button
              type="button"
              className="px-4 py-1.5 rounded-lg text-sm font-bold bg-white text-slate-900 shadow-sm border border-slate-300 transition-colors flex items-center gap-2"
              onClick={() => setActiveTab('unified')}
            >
              <Layers className="w-4 h-4 text-slate-700" />
              <span>نظرة شاملة على الإحصائيات</span>
            </button>
          </div>
        </div>

        <UnifiedDashboardView onSwitchToAccessories={() => setActiveTab('accessories')} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Section Tab Toggle */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
        <div className="inline-flex rounded-xl border border-slate-300 p-1 bg-slate-100 text-sm shadow-sm">
          <button
            type="button"
            className="px-4 py-1.5 rounded-lg text-sm font-bold bg-white text-slate-900 shadow-sm border border-slate-300 transition-colors"
            onClick={() => setActiveTab('accessories')}
          >
            لوحة محل الإكسسوارات
          </button>
          <button
            type="button"
            className="px-4 py-1.5 rounded-lg text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors flex items-center gap-2"
            onClick={() => setActiveTab('unified')}
          >
            <Layers className="w-4 h-4 text-slate-600" />
            <span>نظرة شاملة على الإحصائيات</span>
          </button>
        </div>
      </div>

      <PageHeader
        title="لوحة تحكم محل الإكسسوارات"
        subtitle=""
        actions={
          <div className="flex gap-2.5">
            <Button
              size="md"
              variant="primary"
              onClick={() => setRoute('sales')}
              leftIcon={<ShoppingCart className="w-4.5 h-4.5" />}
            >
              نقطة البيع
            </Button>
            <Button
              size="md"
              variant="outline"
              onClick={() => setRoute('products')}
              leftIcon={<Plus className="w-4.5 h-4.5" />}
            >
              إضافة صنف
            </Button>
          </div>
        }
      />

      {/* Low stock alerts if any */}
      {(metrics.outOfStockCount > 0 || metrics.lowStockCount > 0) && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3.5 p-4 rounded-xl border bg-amber-50 border-amber-300 text-amber-950 text-sm shadow-sm">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0" />
            <div>
              <p className="font-bold text-sm text-amber-950">تنبيه المخزون المنخفض</p>
              <p className="text-amber-900 mt-0.5 text-sm">
                يوجد <span className="font-bold tabular-nums">{metrics.outOfStockCount}</span> أصناف نفدت بالكامل و <span className="font-bold tabular-nums">{metrics.lowStockCount}</span> أصناف بلغت حد التنبيه الأدنى.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setRoute('inventory')}
            className="shrink-0 bg-white text-xs border-amber-300 hover:bg-amber-100 text-amber-900 font-bold"
          >
            عرض النواقص
          </Button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="إجمالي المبيعات"
          value={summary ? formatCurrency(summary.totalRevenue) : '...'}
          subtitle={`${summary?.invoicesCount || 0} فاتورة مبيعات`}
          icon={DollarSign}
        />
        <StatsCard
          title="مجمل الربح "
          value={summary ? formatCurrency(summary.grossProfit) : '...'}
          subtitle={summary ? `هامش ربح ${summary.profitMarginPercent.toFixed(1)}%` : 'محسوب بدقة'}
          icon={TrendingUp}
        />
        <StatsCard
          title="الأصناف في المخزن"
          value={`${metrics.totalProducts} صنف`}
          subtitle={`${metrics.totalUnits} قطعة متوفرة`}
          icon={Package}
        />
        <StatsCard
          title="نواقص "
          value={`${metrics.lowStockCount + metrics.outOfStockCount} صنف`}
          subtitle={`نافد: ${metrics.outOfStockCount} | حد أدنى: ${metrics.lowStockCount}`}
          icon={AlertTriangle}
        />
      </div>

      {/* Quick Action Tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <button
          type="button"
          onClick={() => setRoute('sales')}
          className="p-4 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl transition-all text-right flex items-center justify-between group shadow-sm hover:border-slate-400"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-800 flex items-center justify-center border border-slate-200 shrink-0">
              <Barcode className="w-5 h-5 text-slate-700" />
            </div>
            <div>
              <p className="font-bold text-sm text-slate-900">نقطة البيع </p>
              {/* <p className="text-xs text-slate-500 font-medium mt-0.5">مسح الباركود والبيع</p> */}
            </div>
          </div>
          <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-slate-800" />
        </button>

        <button
          type="button"
          onClick={() => setRoute('purchases')}
          className="p-4 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl transition-all text-right flex items-center justify-between group shadow-sm hover:border-slate-400"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-800 flex items-center justify-center border border-slate-200 shrink-0">
              <Package className="w-5 h-5 text-slate-700" />
            </div>
            <div>
              <p className="font-bold text-sm text-slate-900">وارد المشتريات</p>
              {/* <p className="text-xs text-slate-500 font-medium mt-0.5">إضافة بضاعة للمخزن</p> */}
            </div>
          </div>
          <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-slate-800" />
        </button>

        <button
          type="button"
          onClick={() => setRoute('returns')}
          className="p-4 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl transition-all text-right flex items-center justify-between group shadow-sm hover:border-slate-400"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-800 flex items-center justify-center border border-slate-200 shrink-0">
              <RotateCcw className="w-5 h-5 text-slate-700" />
            </div>
            <div>
              <p className="font-bold text-sm text-slate-900">المرتجعات</p>
              {/* <p className="text-xs text-slate-500 font-medium mt-0.5">استرجاع آمن وتسوية</p> */}
            </div>
          </div>
          <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-slate-800" />
        </button>

        <button
          type="button"
          onClick={() => setRoute('backup')}
          className="p-4 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl transition-all text-right flex items-center justify-between group shadow-sm hover:border-slate-400"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-800 flex items-center justify-center border border-slate-200 shrink-0">
              <HardDriveDownload className="w-5 h-5 text-slate-700" />
            </div>
            <div>
              <p className="font-bold text-sm text-slate-900">النسخ الاحتياطي</p>
              {/* <p className="text-xs text-slate-500 font-medium mt-0.5">حفظ واسترجاع البيانات</p> */}
            </div>
          </div>
          <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-slate-800" />
        </button>
      </div>

      {/* Recent Invoices Table */}
      <Card>
        <CardHeader className="py-3 px-6 bg-slate-50 border-b border-slate-200">
          <CardTitle className="text-base font-bold text-slate-900">آخر فواتير المبيعات </CardTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setRoute('invoices')}
          >
            عرض سجل الفواتير كاملاً
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table
            columns={columns}
            data={recentInvoices}
            keyExtractor={(item: Invoice) => item.id}
            emptyMessage="لم تصدر أي فواتير مبيعات بعد"
          />
        </CardContent>
      </Card>
    </div>
  );
};
