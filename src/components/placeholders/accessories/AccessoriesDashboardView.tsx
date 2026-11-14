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
        <span className="font-mono text-xs font-semibold text-slate-900 tabular-nums">{item.invoice_number}</span>
      ),
    },
    {
      key: 'invoice_date',
      header: 'التاريخ',
      render: (item: Invoice) => (
        <span className="font-mono text-slate-500 text-xs tabular-nums">{item.invoice_date}</span>
      ),
    },
    {
      key: 'customer_name',
      header: 'العميل',
      render: (item: Invoice) => (
        <span className="font-normal text-slate-800 text-xs">{item.customer_name || 'نقدي عام'}</span>
      ),
    },
    {
      key: 'items_count',
      header: 'الأصناف',
      render: (item: Invoice) => <span className="tabular-nums text-xs">{item.items_count} أصناف</span>,
    },
    {
      key: 'total_amount',
      header: 'المبلغ الإجمالي',
      render: (item: Invoice) => (
        <span className="font-semibold font-mono text-slate-900 tabular-nums text-xs">{formatCurrency(item.total_amount)}</span>
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
              : item.payment_method === 'بطاقة / فيزا'
              ? 'primary'
              : 'default'
          }
          size="sm"
        >
          {item.payment_method}
        </Badge>
      ),
    },
  ];

  if (activeTab === 'unified') {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200/90 pb-3">
          <div className="inline-flex rounded-lg border border-slate-200/90 p-0.5 bg-slate-100 text-xs">
            <button
              type="button"
              className="px-3 py-1 rounded-md text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors"
              onClick={() => setActiveTab('accessories')}
            >
              لوحة محل الإكسسوارات
            </button>
            <button
              type="button"
              className="px-3 py-1 rounded-md text-xs font-semibold bg-white text-slate-900 shadow-subtle border border-slate-200/90 transition-colors flex items-center gap-1.5"
              onClick={() => setActiveTab('unified')}
            >
              <Layers className="w-3 h-3 text-slate-600" />
              <span>لوحة القيادة الموحدة للمنشأة</span>
            </button>
          </div>
        </div>

        <UnifiedDashboardView onSwitchToAccessories={() => setActiveTab('accessories')} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Top Section Tab Toggle */}
      <div className="flex items-center justify-between border-b border-slate-200/90 pb-3">
        <div className="inline-flex rounded-lg border border-slate-200/90 p-0.5 bg-slate-100 text-xs">
          <button
            type="button"
            className="px-3 py-1 rounded-md text-xs font-semibold bg-white text-slate-900 shadow-subtle border border-slate-200/90 transition-colors"
            onClick={() => setActiveTab('accessories')}
          >
            لوحة محل الإكسسوارات
          </button>
          <button
            type="button"
            className="px-3 py-1 rounded-md text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors flex items-center gap-1.5"
            onClick={() => setActiveTab('unified')}
          >
            <Layers className="w-3 h-3 text-slate-500" />
            <span>لوحة القيادة الموحدة للمنشأة</span>
          </button>
        </div>
      </div>

      <PageHeader
        title="لوحة تحكم محل الإكسسوارات"
        subtitle="نظرة تشغيلية عامة ومباشرة على المبيعات، المخزون، والأرباح الحالية"
        actions={
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="primary"
              onClick={() => setRoute('sales')}
              leftIcon={<ShoppingCart className="w-3.5 h-3.5" />}
            >
              نقطة البيع (POS)
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setRoute('products')}
              leftIcon={<Plus className="w-3.5 h-3.5" />}
            >
              إضافة صنف
            </Button>
          </div>
        }
      />

      {/* Low stock alerts if any */}
      {(metrics.outOfStockCount > 0 || metrics.lowStockCount > 0) && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 rounded-lg border bg-amber-50 border-amber-200 text-amber-900 text-xs">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
            <div>
              <p className="font-semibold text-xs text-amber-950">تنبيه المخزون المنخفض</p>
              <p className="text-amber-800 mt-0.5">
                يوجد <span className="font-medium tabular-nums">{metrics.outOfStockCount}</span> أصناف نفدت بالكامل و <span className="font-medium tabular-nums">{metrics.lowStockCount}</span> أصناف بلغت حد التنبيه الأدنى.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setRoute('inventory')}
            className="shrink-0 bg-white text-xs border-amber-300 hover:bg-amber-100 text-amber-900"
          >
            عرض النواقص
          </Button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <StatsCard
          title="إجمالي المبيعات"
          value={summary ? formatCurrency(summary.totalRevenue) : '...'}
          subtitle={`${summary?.invoicesCount || 0} فاتورة مبيعات`}
          icon={DollarSign}
        />
        <StatsCard
          title="مجمل الربح التجاري"
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
          title="نواقص وأصناف حرجة"
          value={`${metrics.lowStockCount + metrics.outOfStockCount} صنف`}
          subtitle={`نافد: ${metrics.outOfStockCount} | حد أدنى: ${metrics.lowStockCount}`}
          icon={AlertTriangle}
        />
      </div>

      {/* Quick Action Tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          type="button"
          onClick={() => setRoute('sales')}
          className="p-3 bg-white hover:bg-slate-50 border border-slate-200/90 rounded-lg transition-colors text-right flex items-center justify-between group shadow-subtle"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-slate-100 text-slate-700 flex items-center justify-center">
              <Barcode className="w-3.5 h-3.5" />
            </div>
            <div>
              <p className="font-semibold text-xs text-slate-900">نقطة البيع (POS)</p>
              <p className="text-[11px] text-slate-400">مسح الباركود والبيع</p>
            </div>
          </div>
          <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-700" />
        </button>

        <button
          type="button"
          onClick={() => setRoute('purchases')}
          className="p-3 bg-white hover:bg-slate-50 border border-slate-200/90 rounded-lg transition-colors text-right flex items-center justify-between group shadow-subtle"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-slate-100 text-slate-700 flex items-center justify-center">
              <Package className="w-3.5 h-3.5" />
            </div>
            <div>
              <p className="font-semibold text-xs text-slate-900">وارد المشتريات</p>
              <p className="text-[11px] text-slate-400">إضافة بضاعة للمخزن</p>
            </div>
          </div>
          <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-700" />
        </button>

        <button
          type="button"
          onClick={() => setRoute('returns')}
          className="p-3 bg-white hover:bg-slate-50 border border-slate-200/90 rounded-lg transition-colors text-right flex items-center justify-between group shadow-subtle"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-slate-100 text-slate-700 flex items-center justify-center">
              <RotateCcw className="w-3.5 h-3.5" />
            </div>
            <div>
              <p className="font-semibold text-xs text-slate-900">المرتجعات</p>
              <p className="text-[11px] text-slate-400">استرجاع آمن وتسوية</p>
            </div>
          </div>
          <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-700" />
        </button>

        <button
          type="button"
          onClick={() => setRoute('backup')}
          className="p-3 bg-white hover:bg-slate-50 border border-slate-200/90 rounded-lg transition-colors text-right flex items-center justify-between group shadow-subtle"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-slate-100 text-slate-700 flex items-center justify-center">
              <HardDriveDownload className="w-3.5 h-3.5" />
            </div>
            <div>
              <p className="font-semibold text-xs text-slate-900">النسخ الاحتياطي</p>
              <p className="text-[11px] text-slate-400">حفظ واسترجاع البيانات</p>
            </div>
          </div>
          <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-700" />
        </button>
      </div>

      {/* Recent Invoices Table */}
      <Card>
        <CardHeader className="py-2.5 px-4 bg-slate-50/70 border-b border-slate-100">
          <CardTitle className="text-xs font-semibold text-slate-900">آخر فواتير المبيعات الصادرة</CardTitle>
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
