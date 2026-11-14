import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { Table, Column } from '@/components/common/Table';
import { Card } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { Modal } from '@/components/common/Modal';
import { Spinner } from '@/components/common/Spinner';
import {
  Eye,
  Printer,
  Search,
  Calendar,
  Filter,
  DollarSign,
  Receipt,
  Tag,
  CreditCard,
  RotateCcw,
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
          className="font-mono font-bold text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1.5"
        >
          <Receipt className="w-3.5 h-3.5 text-blue-500" />
          <span>{inv.invoice_number}</span>
        </button>
      ),
    },
    {
      key: 'invoice_date',
      header: 'التاريخ',
      render: (inv: Invoice) => (
        <span className="font-mono text-slate-600 text-xs">{inv.invoice_date}</span>
      ),
    },
    {
      key: 'customer_name',
      header: 'العميل',
      render: (inv: Invoice) => (
        <div>
          <p className="font-bold text-slate-800 text-xs">{inv.customer_name || 'عميل نقدي'}</p>
          {inv.customer_phone && (
            <p className="font-mono text-[11px] text-slate-400">{inv.customer_phone}</p>
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
        <span className="text-xs font-semibold text-slate-700">{inv.items_count} أصناف</span>
      ),
    },
    {
      key: 'subtotal',
      header: 'المجموع الفرعي',
      render: (inv: Invoice) => (
        <span className="font-mono text-xs text-slate-600">{formatCurrency(inv.subtotal)}</span>
      ),
    },
    {
      key: 'discount',
      header: 'الخصم',
      render: (inv: Invoice) => (
        <span className="font-mono text-xs text-rose-600">
          {inv.discount > 0 ? `- ${formatCurrency(inv.discount)}` : '-'}
        </span>
      ),
    },
    {
      key: 'total_amount',
      header: 'الصافي المسدد',
      render: (inv: Invoice) => (
        <span className="font-mono font-bold text-slate-900 text-xs">
          {formatCurrency(inv.total_amount)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'معاينة وطباعة',
      align: 'center',
      render: (inv: Invoice) => (
        <div className="flex items-center justify-center gap-1.5">
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleOpenPreview(inv, 'a4')}
            leftIcon={<Eye className="w-3.5 h-3.5" />}
          >
            A4
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => handleOpenPreview(inv, 'thermal')}
            leftIcon={<Printer className="w-3.5 h-3.5" />}
          >
            إيصال
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="سجل فواتير المبيعات"
        subtitle="أرشيف كامل لجميع فواتير المبيعات الصادرة، والطباعة بنموذج A4 أو الإيصال الحراري"
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 bg-white border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">إجمالي الفواتير</span>
            <Receipt className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-xl font-black text-slate-900 font-mono mt-2">{stats.totalCount}</p>
          <p className="text-[11px] text-slate-400 mt-1">فاتورة مبيعات مسجلة</p>
        </Card>

        <Card className="p-4 bg-white border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">إجمالي المبيعات المحصلة</span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-xl font-black text-emerald-700 font-mono mt-2">
            {formatCurrency(stats.totalRevenue)}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">صافي الإيرادات المسددة</p>
        </Card>

        <Card className="p-4 bg-white border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">إجمالي الخصومات</span>
            <Tag className="w-4 h-4 text-rose-600" />
          </div>
          <p className="text-xl font-black text-rose-600 font-mono mt-2">
            {formatCurrency(stats.totalDiscounts)}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">خصومات فواتير ممنوحة</p>
        </Card>

        <Card className="p-4 bg-white border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">متوسط قيمة الفاتورة</span>
            <CreditCard className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-xl font-black text-slate-800 font-mono mt-2">
            {formatCurrency(stats.avgInvoice)}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">لكل عملية بيع</p>
        </Card>
      </div>

      {/* Filter Toolbar */}
      <Card className="p-4 bg-white border-slate-200 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          {/* Query input */}
          <div className="md:col-span-4">
            <Input
              placeholder="ابحث برقم الفاتورة، اسم العميل، الهاتف، أو الملاحظات..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              leftIcon={<Search className="w-4 h-4 text-slate-400" />}
              className="py-1.5 text-xs"
            />
          </div>

          {/* Date range */}
          <div className="md:col-span-4 flex items-center gap-2">
            <Input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="py-1.5 text-xs font-mono"
              title="من تاريخ"
            />
            <span className="text-xs text-slate-400">إلى</span>
            <Input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="py-1.5 text-xs font-mono"
              title="إلى تاريخ"
            />
          </div>

          {/* Payment Method Filter */}
          <div className="md:col-span-3">
            <select
              value={paymentFilter}
              onChange={e => setPaymentFilter(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:border-blue-500"
            >
              <option value="ALL">جميع طرق الدفع</option>
              <option value="نقدي">نقدي (كاش)</option>
              <option value="بطاقة / فيزا">بطاقة / فيزا</option>
              <option value="تحويل بنكي / محفظة">تحويل بنكي / محفظة</option>
              <option value="آجل">آجل (حساب عميل)</option>
            </select>
          </div>

          {/* Reset button */}
          <div className="md:col-span-1 flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetFilters}
              title="إعادة تعيين الفلاتر"
            >
              <RotateCcw className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Invoices Table */}
      {isLoading ? (
        <div className="p-16 flex flex-col items-center justify-center bg-white rounded-xl border border-slate-200">
          <Spinner size="lg" />
          <p className="text-xs text-slate-500 mt-3">جارٍ تحميل سجل الفواتير...</p>
        </div>
      ) : invoices.length === 0 ? (
        <div className="p-16 text-center bg-white rounded-xl border border-slate-200 space-y-3">
          <Receipt className="w-12 h-12 text-slate-300 mx-auto" />
          <p className="text-sm font-bold text-slate-800">لا توجد فواتير مطابقة للبحث</p>
          <p className="text-xs text-slate-400">قم بتغيير خيارات البحث أو قم بإصدار فاتورة جديدة من نقطة البيع</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
          <Table
            columns={columns}
            data={invoices}
            keyExtractor={(item: Invoice) => item.id}
          />
        </div>
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
              <Button variant="outline" size="sm" onClick={() => setSelectedInvoice(null)}>
                إغلاق
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => window.print()}
                leftIcon={<Printer className="w-4 h-4" />}
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
              <p className="text-xs text-slate-500 mt-2">جارٍ جلب تفاصيل أصناف الفاتورة...</p>
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
