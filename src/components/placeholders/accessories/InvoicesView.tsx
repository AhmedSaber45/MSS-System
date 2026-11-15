import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { Select } from '@/components/common/Select';
import { Table, Column } from '@/components/common/Table';
import { Card, StatsCard } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { Modal } from '@/components/common/Modal';
import { Spinner } from '@/components/common/Spinner';
import {
  Eye,
  Printer,
  Search,
  Receipt,
  Tag,
  CreditCard,
  RotateCcw,
  DollarSign,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { salesService } from '@/services/salesService.ts';
import { PrintableInvoice } from '@/components/sales/PrintableInvoice.tsx';
import type { Invoice, InvoiceItem } from '@/types/sale.ts';

export const InvoicesView: React.FC = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [paymentFilter, setPaymentFilter] = useState<string>('ALL');

  // Preview / Print Modal
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [selectedItems, setSelectedItems] = useState<InvoiceItem[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState<boolean>(false);
  const [printFormat, setPrintFormat] = useState<'a4' | 'thermal'>('a4');

  const loadInvoices = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await salesService.getInvoices({
        query: searchQuery,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        paymentMethod: paymentFilter,
      });
      setInvoices(data);
    } catch (err) {
      console.error('Failed to load invoices:', err);
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, startDate, endDate, paymentFilter]);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  // Open invoice preview
  const handleOpenPreview = async (invoice: Invoice, preferredFormat: 'a4' | 'thermal' = 'a4') => {
    setSelectedInvoice(invoice);
    setPrintFormat(preferredFormat);
    setIsLoadingItems(true);
    try {
      const items = await salesService.getInvoiceItems(invoice.id);
      setSelectedItems(items);
    } catch (err) {
      console.error('Failed to load invoice items:', err);
    } finally {
      setIsLoadingItems(false);
    }
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setStartDate('');
    setEndDate('');
    setPaymentFilter('ALL');
  };

  // KPI Calculations
  const stats = useMemo(() => {
    const totalCount = invoices.length;
    const totalRevenue = invoices.reduce((acc, inv) => acc + inv.total_amount, 0);
    const totalDiscounts = invoices.reduce((acc, inv) => acc + (inv.discount || 0), 0);
    const avgInvoice = totalCount > 0 ? totalRevenue / totalCount : 0;
    return { totalCount, totalRevenue, totalDiscounts, avgInvoice };
  }, [invoices]);

  const columns: Column<Invoice>[] = [
    {
      key: 'invoice_number',
      header: 'رقم الفاتورة',
      render: (inv: Invoice) => (
        <button
          type="button"
          onClick={() => handleOpenPreview(inv)}
          className="font-mono text-sm font-bold text-slate-900 hover:text-blue-700 hover:underline flex items-center gap-2 tabular-nums"
        >
          <Receipt className="w-4 h-4 text-slate-500" />
          <span>{inv.invoice_number}</span>
        </button>
      ),
    },
    {
      key: 'invoice_date',
      header: 'التاريخ',
      render: (inv: Invoice) => (
        <span className="font-mono text-slate-700 text-sm font-medium tabular-nums">{inv.invoice_date}</span>
      ),
    },
    {
      key: 'customer_name',
      header: 'العميل',
      render: (inv: Invoice) => (
        <div>
          <p className="font-bold text-slate-900 text-sm">{inv.customer_name || 'عميل نقدي'}</p>
          {inv.customer_phone && (
            <p className="font-mono text-xs text-slate-500 font-medium tabular-nums mt-0.5">{inv.customer_phone}</p>
          )}
        </div>
      ),
    },
    {
      key: 'payment_method',
      header: 'طريقة الدفع',
      render: (inv: Invoice) => (
        <Badge
          variant={
            inv.payment_method === 'نقدي'
              ? 'success'
              : inv.payment_method === 'بطاقة / فيزا'
              ? 'primary'
              : 'default'
          }
          size="sm"
          className="font-semibold"
        >
          {inv.payment_method}
        </Badge>
      ),
    },
    {
      key: 'items_count',
      header: 'الأصناف',
      align: 'center',
      render: (inv: Invoice) => (
        <span className="text-sm font-semibold text-slate-800 tabular-nums">{inv.items_count} أصناف</span>
      ),
    },
    {
      key: 'subtotal',
      header: 'المجموع الفرعي',
      render: (inv: Invoice) => (
        <span className="font-mono text-sm font-medium text-slate-700 tabular-nums">{formatCurrency(inv.subtotal)}</span>
      ),
    },
    {
      key: 'discount',
      header: 'الخصم',
      render: (inv: Invoice) => (
        <span className="font-mono text-sm font-semibold text-rose-700 tabular-nums">
          {inv.discount > 0 ? `- ${formatCurrency(inv.discount)}` : '-'}
        </span>
      ),
    },
    {
      key: 'total_amount',
      header: 'الصافي المسدد',
      render: (inv: Invoice) => (
        <span className="font-mono font-bold text-slate-900 text-sm tabular-nums">
          {formatCurrency(inv.total_amount)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'معاينة وطباعة',
      align: 'center',
      render: (inv: Invoice) => (
        <div className="flex items-center justify-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleOpenPreview(inv, 'a4')}
            leftIcon={<Eye className="w-4 h-4" />}
            className="h-8 text-xs font-bold px-2.5 border-slate-300 text-slate-800"
          >
            A4
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => handleOpenPreview(inv, 'thermal')}
            leftIcon={<Printer className="w-4 h-4" />}
            className="h-8 text-xs font-bold px-2.5"
          >
            إيصال
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <PageHeader
        title="سجل فواتير المبيعات"
        subtitle="أرشيف كامل لجميع فواتير المبيعات الصادرة، والطباعة بنموذج A4 أو الإيصال الحراري"
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <StatsCard
          title="إجمالي الفواتير"
          value={stats.totalCount}
          subtitle="فاتورة مبيعات مسجلة"
          icon={Receipt}
        />
        <StatsCard
          title="إجمالي المبيعات المحصلة"
          value={formatCurrency(stats.totalRevenue)}
          subtitle="صافي الإيرادات المسددة"
          icon={DollarSign}
        />
        <StatsCard
          title="إجمالي الخصومات"
          value={formatCurrency(stats.totalDiscounts)}
          subtitle="خصومات فواتير ممنوحة"
          icon={Tag}
        />
        <StatsCard
          title="متوسط قيمة الفاتورة"
          value={formatCurrency(stats.avgInvoice)}
          subtitle="لكل عملية بيع"
          icon={CreditCard}
        />
      </div>

      {/* Filter Toolbar */}
      <Card className="p-3.5 border-slate-300">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          {/* Query input */}
          <div className="md:col-span-4">
            <Input
              placeholder="ابحث برقم الفاتورة، اسم العميل، أو الهاتف..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onClear={() => setSearchQuery('')}
              leftIcon={<Search className="w-4.5 h-4.5 text-slate-500" />}
            />
          </div>

          {/* Date range */}
          <div className="md:col-span-4 flex items-center gap-2">
            <Input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              isMonospace
              title="من تاريخ"
            />
            <span className="text-sm font-semibold text-slate-500">إلى</span>
            <Input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              isMonospace
              title="إلى تاريخ"
            />
          </div>

          {/* Payment Method Filter */}
          <div className="md:col-span-3">
            <Select
              value={paymentFilter}
              onChange={e => setPaymentFilter(e.target.value)}
            >
              <option value="ALL">جميع طرق الدفع</option>
              <option value="نقدي">نقدي (كاش)</option>
              <option value="بطاقة / فيزا">بطاقة / فيزا</option>
              <option value="تحويل بنكي / محفظة">تحويل بنكي / محفظة</option>
              <option value="آجل">آجل (حساب عميل)</option>
            </Select>
          </div>

          {/* Reset button */}
          <div className="md:col-span-1 flex justify-end">
            <Button
              variant="outline"
              size="md"
              onClick={handleResetFilters}
              title="إعادة تعيين الفلاتر"
              className="w-full border-slate-300"
            >
              <RotateCcw className="w-4 h-4 text-slate-600" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Invoices Table */}
      {isLoading ? (
        <div className="p-16 flex flex-col items-center justify-center bg-white rounded-xl border border-slate-300">
          <Spinner size="lg" />
          <p className="text-sm font-medium text-slate-600 mt-3">جارٍ تحميل سجل الفواتير...</p>
        </div>
      ) : invoices.length === 0 ? (
        <div className="p-16 text-center bg-white rounded-xl border border-slate-300 space-y-2.5">
          <Receipt className="w-10 h-10 text-slate-400 mx-auto" />
          <p className="text-sm font-bold text-slate-800">لا توجد فواتير مطابقة للبحث</p>
          <p className="text-xs text-slate-500">قم بتغيير خيارات البحث أو قم بإصدار فاتورة جديدة من نقطة البيع</p>
        </div>
      ) : (
        <Table
          columns={columns}
          data={invoices}
          keyExtractor={(item: Invoice) => item.id}
        />
      )}

      {/* Invoice Detail / Print Modal */}
      {selectedInvoice && (
        <Modal
          isOpen={!!selectedInvoice}
          onClose={() => setSelectedInvoice(null)}
          title={`معاينة الفاتورة: ${selectedInvoice.invoice_number}`}
          subtitle="معاينة وطباعة الفاتورة بنموذج A4 أو الإيصال الحراري"
          size="xl"
          footer={
            <div className="flex items-center justify-between w-full">
              <Button variant="outline" size="md" onClick={() => setSelectedInvoice(null)} className="border-slate-300 font-semibold">
                إغلاق
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={() => window.print()}
                leftIcon={<Printer className="w-4.5 h-4.5" />}
                className="font-bold"
              >
                طباعة الفاتورة الآن
              </Button>
            </div>
          }
        >
          {isLoadingItems ? (
            <div className="p-12 flex flex-col items-center justify-center">
              <Spinner size="md" />
              <p className="text-sm font-medium text-slate-600 mt-2.5">جارٍ جلب تفاصيل أصناف الفاتورة...</p>
            </div>
          ) : (
            <PrintableInvoice
              invoice={selectedInvoice}
              items={selectedItems}
              format={printFormat}
              onFormatChange={setPrintFormat}
            />
          )}
        </Modal>
      )}
    </div>
  );
};
