import React, { useState, useEffect } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { StatsCard, Card, CardHeader, CardTitle, CardContent } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Table, Column } from '@/components/common/Table';
import { Badge } from '@/components/common/Badge';
import { Alert } from '@/components/common/Alert';
import { useNavigation } from '@/context/NavigationContext';
import {
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Package,
  Plus,
  ShoppingCart,
  Receipt,
  RotateCcw,
  HardDriveDownload,
  Barcode,
  ArrowUpRight,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { productsService } from '@/services/productsService.ts';
import { salesService } from '@/services/salesService.ts';
import { reportsService } from '@/services/reportsService.ts';
import { returnsService } from '@/services/returnsService.ts';
import type { Invoice } from '@/types/sale.ts';
import type { FinancialSummary } from '@/types/reports.ts';

import { UnifiedDashboardView } from '@/components/dashboard/UnifiedDashboardView.tsx';
import { Layers } from 'lucide-react';

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
        <span className="font-mono font-bold text-blue-600">{item.invoice_number}</span>
      ),
    },
    {
      key: 'invoice_date',
      header: 'التاريخ',
      render: (item: Invoice) => (
        <span className="font-mono text-slate-500 text-xs">{item.invoice_date}</span>
      ),
    },
    {
      key: 'customer_name',
      header: 'العميل',
      render: (item: Invoice) => (
        <span className="font-medium text-slate-800 text-xs">{item.customer_name || 'نقدي عام'}</span>
      ),
    },
    {
      key: 'items_count',
      header: 'الأصناف',
      render: (item: Invoice) => <span>{item.items_count} أصناف</span>,
    },
    {
      key: 'total_amount',
      header: 'المبلغ الإجمالي',
      render: (item: Invoice) => (
        <span className="font-bold font-mono text-slate-900">{formatCurrency(item.total_amount)}</span>
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
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50 text-xs">
            <button
              type="button"
              className="px-4 py-1.5 rounded-md font-medium text-slate-600 hover:text-slate-900 transition-all"
              onClick={() => setActiveTab('accessories')}
            >
              لوحة محل الإكسسوارات
            </button>
            <button
              type="button"
              className="px-4 py-1.5 rounded-md font-bold bg-white text-blue-800 shadow transition-all flex items-center gap-1.5"
              onClick={() => setActiveTab('unified')}
            >
              <Layers className="w-3.5 h-3.5 text-blue-600" />
              <span>لوحة القيادة الموحدة للمنشأة</span>
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
        <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50 text-xs">
          <button
            type="button"
            className="px-4 py-1.5 rounded-md font-bold bg-white text-blue-800 shadow transition-all"
            onClick={() => setActiveTab('accessories')}
          >
            لوحة محل الإكسسوارات
          </button>
          <button
            type="button"
            className="px-4 py-1.5 rounded-md font-medium text-slate-600 hover:text-slate-900 transition-all flex items-center gap-1.5"
            onClick={() => setActiveTab('unified')}
          >
            <Layers className="w-3.5 h-3.5 text-slate-500" />
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
              leftIcon={<ShoppingCart className="w-4 h-4" />}
            >
              نقطة البيع (POS)
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setRoute('products')}
              leftIcon={<Plus className="w-4 h-4" />}
            >
              إضافة صنف
            </Button>
          </div>
        }
      />

      {/* Low stock alerts if any */}
      {(metrics.outOfStockCount > 0 || metrics.lowStockCount > 0) && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-xl border bg-amber-50 border-amber-200 text-amber-900 text-xs">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <p className="font-bold text-sm text-amber-950">تنبيه المخزون المنخفض</p>
              <p className="text-amber-800 mt-0.5">
                يوجد {metrics.outOfStockCount} أصناف نفدت بالكامل و {metrics.lowStockCount} أصناف بلغت حد التنبيه الأدنى.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setRoute('inventory')}
            className="shrink-0 bg-white"
          >
            عرض النواقص في المخزون
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
          accentColor="blue"
        />
        <StatsCard
          title="مجمل الربح التجاري"
          value={summary ? formatCurrency(summary.grossProfit) : '...'}
          subtitle={summary ? `هامش ربح ${summary.profitMarginPercent.toFixed(1)}%` : 'محسوب بدقة'}
          icon={TrendingUp}
          accentColor="emerald"
        />
        <StatsCard
          title="الأصناف في المخزن"
          value={`${metrics.totalProducts} صنف`}
          subtitle={`${metrics.totalUnits} قطعة متوفرة`}
          icon={Package}
          accentColor="indigo"
        />
        <StatsCard
          title="نواقص وأصناف حرجة"
          value={`${metrics.lowStockCount + metrics.outOfStockCount} صنف`}
          subtitle={`نافد: ${metrics.outOfStockCount} | حد أدنى: ${metrics.lowStockCount}`}
          icon={AlertTriangle}
          accentColor={metrics.outOfStockCount > 0 ? 'rose' : 'amber'}
        />
      </div>

      {/* Quick Action Tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          type="button"
          onClick={() => setRoute('sales')}
          className="p-3.5 bg-white hover:bg-blue-50/70 border border-slate-200 hover:border-blue-300 rounded-xl transition-all text-right flex items-center justify-between group shadow-2xs"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
              <Barcode className="w-4 h-4" />
            </div>
            <div>
              <p className="font-bold text-xs text-slate-800 group-hover:text-blue-700">نقطة البيع (POS)</p>
              <p className="text-[10px] text-slate-400">مسح الباركود والبيع</p>
            </div>
          </div>
          <ArrowUpRight className="w-4 h-4 text-slate-300 group-hover:text-blue-600" />
        </button>

        <button
          type="button"
          onClick={() => setRoute('purchases')}
          className="p-3.5 bg-white hover:bg-indigo-50/70 border border-slate-200 hover:border-indigo-300 rounded-xl transition-all text-right flex items-center justify-between group shadow-2xs"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
              <Package className="w-4 h-4" />
            </div>
            <div>
              <p className="font-bold text-xs text-slate-800 group-hover:text-indigo-700">وارد المشتريات</p>
              <p className="text-[10px] text-slate-400">إضافة بضاعة للمخزن</p>
            </div>
          </div>
          <ArrowUpRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-600" />
        </button>

        <button
          type="button"
          onClick={() => setRoute('returns')}
          className="p-3.5 bg-white hover:bg-rose-50/70 border border-slate-200 hover:border-rose-300 rounded-xl transition-all text-right flex items-center justify-between group shadow-2xs"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center">
              <RotateCcw className="w-4 h-4" />
            </div>
            <div>
              <p className="font-bold text-xs text-slate-800 group-hover:text-rose-700">المرتجعات</p>
              <p className="text-[10px] text-slate-400">استرجاع آمن وتسوية</p>
            </div>
          </div>
          <ArrowUpRight className="w-4 h-4 text-slate-300 group-hover:text-rose-600" />
        </button>

        <button
          type="button"
          onClick={() => setRoute('backup')}
          className="p-3.5 bg-white hover:bg-emerald-50/70 border border-slate-200 hover:border-emerald-300 rounded-xl transition-all text-right flex items-center justify-between group shadow-2xs"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <HardDriveDownload className="w-4 h-4" />
            </div>
            <div>
              <p className="font-bold text-xs text-slate-800 group-hover:text-emerald-700">النسخ الاحتياطي</p>
              <p className="text-[10px] text-slate-400">حفظ واسترجاع البيانات</p>
            </div>
          </div>
          <ArrowUpRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-600" />
        </button>
      </div>

      {/* Recent Invoices Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between py-3 px-4">
          <CardTitle className="text-sm font-bold text-slate-900">آخر فواتير المبيعات الصادرة</CardTitle>
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
          />
        </CardContent>
      </Card>
    </div>
  );
};
