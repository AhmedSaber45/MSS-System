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
  FileDown,
  Search,
  Receipt,
  Tag,
  CreditCard,
  RotateCcw,
  RefreshCw,
  DollarSign,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Wallet,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { DateRangeInputs } from '@/components/common/DateRangeInputs';
import { useDateRangeFilter } from '@/lib/dateValidation';
import { salesService } from '@/services/salesService.ts';
import { PrintableInvoice } from '@/components/sales/PrintableInvoice.tsx';
import { documentPrintService } from '@/lib/documentPrintService';
import { usePageRefresh } from '@/context/PageRefreshContext';
import { useNotification } from '@/context/NotificationContext';
import {
  PaymentHistorySection,
  PaymentRecordItem,
  PaymentScheduleItem,
} from '@/components/common/PaymentHistorySection';
import type { Invoice, InvoiceItem } from '@/types/sale.ts';

export const InvoicesView: React.FC = () => {
  const { isRefreshing, triggerRefresh } = usePageRefresh();
  const { showNotification } = useNotification();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [paymentFilter, setPaymentFilter] = useState<string>('ALL');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>('ALL');
  const dateFilter = useDateRangeFilter();

  // Preview / Print Modal
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [selectedItems, setSelectedItems] = useState<InvoiceItem[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState<boolean>(false);
  const [printFormat, setPrintFormat] = useState<'a4' | 'thermal'>('a4');

  // Payment Tracking Tab in Modal
  const [modalTab, setModalTab] = useState<'print' | 'payments'>('print');
  const [invoicePayments, setInvoicePayments] = useState<PaymentRecordItem[]>([]);
  const [invoiceSchedule, setInvoiceSchedule] = useState<PaymentScheduleItem[]>([]);
  const [isLoadingPayments, setIsLoadingPayments] = useState<boolean>(false);

  const loadInvoices = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await salesService.getInvoices({
        query: searchQuery,
        startDate: dateFilter.startDate || undefined,
        endDate: dateFilter.endDate || undefined,
        paymentMethod: paymentFilter,
        paymentStatus: paymentStatusFilter !== 'ALL' ? paymentStatusFilter : undefined,
      });
      setInvoices(data);
    } catch (err: any) {
      console.error('Failed to load invoices:', err);
      showNotification({
        type: 'error',
        title: 'خطأ في جلب الفواتير',
        message: err?.message || 'تعذر تحميل سجل الفواتير من قاعدة البيانات',
      });
    } finally {
      setIsLoading(false);
    }
  }, [
    searchQuery,
    dateFilter.startDate,
    dateFilter.endDate,
    paymentFilter,
    paymentStatusFilter,
    showNotification,
  ]);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  // Open invoice preview
  const handleOpenPreview = async (
    invoice: Invoice,
    preferredFormat: 'a4' | 'thermal' = 'a4',
    initialTab: 'print' | 'payments' = 'print'
  ) => {
    setSelectedInvoice(invoice);
    setPrintFormat(preferredFormat);
    setModalTab(initialTab);
    setIsLoadingItems(true);
    setIsLoadingPayments(true);
    try {
      const [items, payments, schedule] = await Promise.all([
        salesService.getInvoiceItems(invoice.id),
        salesService.getPayments(invoice.id),
        salesService.getInstallmentSchedule(invoice.id),
      ]);
      setSelectedItems(items);
      setInvoicePayments(payments);
      setInvoiceSchedule(schedule);
    } catch (err) {
      console.error('Failed to load invoice items/payments:', err);
    } finally {
      setIsLoadingItems(false);
      setIsLoadingPayments(false);
    }
  };

  // Refresh invoice data inside the open modal
  const refreshModalInvoice = async (invoiceId: string) => {
    try {
      const [allInvs, payments, schedule] = await Promise.all([
        salesService.getInvoices({}),
        salesService.getPayments(invoiceId),
        salesService.getInstallmentSchedule(invoiceId),
      ]);
      const updated = allInvs.find(i => i.id === invoiceId);
      if (updated) {
        setSelectedInvoice(updated);
      }
      setInvoicePayments(payments);
      setInvoiceSchedule(schedule);
      setInvoices(allInvs);
    } catch (err) {
      console.error('Failed to refresh modal invoice:', err);
    }
  };

  // Handle recording payment
  const handleRecordPayment = async (data: {
    amount: number;
    payment_date: string;
    payment_method: string;
    notes?: string;
  }) => {
    if (!selectedInvoice) return;
    await salesService.recordPayment(selectedInvoice.id, {
      invoice_id: selectedInvoice.id,
      amount: data.amount,
      payment_date: data.payment_date,
      payment_method: data.payment_method,
      notes: data.notes,
    });
    showNotification({
      type: 'success',
      title: 'تم تسجيل الدفعة بنجاح',
      message: `تم تحصيل مبلغ ${formatCurrency(data.amount)} وتحديث رصيد الفاتورة.`,
    });
    await refreshModalInvoice(selectedInvoice.id);
  };

  // Handle reversing payment
  const handleReversePayment = async (paymentId: string, reason: string) => {
    if (!selectedInvoice) return;
    await salesService.reversePayment(paymentId, reason);
    showNotification({
      type: 'info',
      title: 'تم عكس الدفعة بنجاح',
      message: 'تم تسجيل قيد عكسي وتحديث رصيد الفاتورة وحالتها تلقائياً.',
    });
    await refreshModalInvoice(selectedInvoice.id);
  };

  // Handle updating schedule
  const handleUpdateSchedule = async (newSchedule: any[]) => {
    if (!selectedInvoice) return;
    await salesService.updateInstallmentSchedule(selectedInvoice.id, newSchedule);
    showNotification({
      type: 'success',
      title: 'تم تحديث جدول الأقساط',
      message: 'تم حفظ جدول مواعيد ومبالغ الأقساط المحدث.',
    });
    await refreshModalInvoice(selectedInvoice.id);
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    dateFilter.clearDateRange();
    setPaymentFilter('ALL');
    setPaymentStatusFilter('ALL');
  };

  // KPI Calculations
  const stats = useMemo(() => {
    const totalCount = invoices.length;
    const totalRevenue = invoices.reduce((acc, inv) => acc + inv.total_amount, 0);
    const totalPaid = invoices.reduce(
      (acc, inv) => acc + (inv.paid_amount ?? inv.total_amount),
      0
    );
    const totalReceivables = invoices.reduce(
      (acc, inv) => acc + (inv.remaining_balance ?? 0),
      0
    );
    const overdueCount = invoices.filter(inv => inv.payment_status === 'OVERDUE').length;
    return { totalCount, totalRevenue, totalPaid, totalReceivables, overdueCount };
  }, [invoices]);

  const columns: Column<Invoice>[] = [
    {
      key: 'invoice_number',
      header: 'رقم الفاتورة',
      render: (inv: Invoice) => (
        <button
          type="button"
          onClick={() => handleOpenPreview(inv, 'a4', 'print')}
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
        <span className="font-mono text-slate-700 text-sm font-medium tabular-nums">
          {inv.invoice_date}
        </span>
      ),
    },
    {
      key: 'customer_name',
      header: 'العميل',
      render: (inv: Invoice) => (
        <div>
          <p className="font-bold text-slate-900 text-sm">{inv.customer_name || 'عميل نقدي'}</p>
          {inv.customer_phone && (
            <p className="font-mono text-xs text-slate-500 font-medium tabular-nums mt-0.5">
              {inv.customer_phone}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'payment_type',
      header: 'نوع البيع',
      render: (inv: Invoice) => (
        <Badge
          variant={inv.payment_type === 'DEFERRED' ? 'warning' : 'default'}
          size="sm"
          className="font-semibold"
        >
          {inv.payment_type === 'DEFERRED' ? 'آجل / أقساط' : 'سداد كامل'}
        </Badge>
      ),
    },
    {
      key: 'total_amount',
      header: 'إجمالي الفاتورة',
      render: (inv: Invoice) => (
        <span className="font-mono font-bold text-slate-900 text-sm tabular-nums">
          {formatCurrency(inv.total_amount)}
        </span>
      ),
    },
    {
      key: 'paid_amount',
      header: 'المدفوع',
      render: (inv: Invoice) => (
        <span className="font-mono font-bold text-emerald-700 text-sm tabular-nums">
          {formatCurrency(inv.paid_amount ?? inv.total_amount)}
        </span>
      ),
    },
    {
      key: 'remaining_balance',
      header: 'المتبقي',
      render: (inv: Invoice) => {
        const remaining = inv.remaining_balance ?? 0;
        return (
          <span
            className={`font-mono font-bold text-sm tabular-nums ${
              remaining > 0 ? 'text-rose-700' : 'text-slate-500'
            }`}
          >
            {remaining > 0 ? formatCurrency(remaining) : '—'}
          </span>
        );
      },
    },
    {
      key: 'payment_status',
      header: 'حالة السداد',
      render: (inv: Invoice) => {
        const st = inv.payment_status || 'PAID';
        if (st === 'PAID') {
          return (
            <Badge variant="success" size="sm" className="font-semibold">
              مسددة
            </Badge>
          );
        }
        if (st === 'PARTIALLY_PAID') {
          return (
            <Badge variant="warning" size="sm" className="font-semibold">
              جزئي
            </Badge>
          );
        }
        if (st === 'OVERDUE') {
          return (
            <Badge variant="danger" size="sm" className="font-semibold">
              متأخر
            </Badge>
          );
        }
        return (
          <Badge variant="danger" size="sm" className="font-semibold">
            غير مسدد
          </Badge>
        );
      },
    },
    {
      key: 'actions',
      header: 'إجراءات ومعاينة',
      align: 'center',
      render: (inv: Invoice) => (
        <div className="flex items-center justify-center gap-1.5">
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleOpenPreview(inv, 'a4', 'payments')}
            leftIcon={<Wallet className="w-3.5 h-3.5 text-emerald-600" />}
            className="h-8 text-xs font-bold px-2 border-emerald-300 text-emerald-900 bg-emerald-50/50 hover:bg-emerald-100"
            title="إدارة التحصيل وسجل الدفعات"
          >
            تحصيل
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleOpenPreview(inv, 'a4', 'print')}
            leftIcon={<Eye className="w-3.5 h-3.5" />}
            className="h-8 text-xs font-bold px-2 border-slate-300 text-slate-800"
          >
            A4
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => handleOpenPreview(inv, 'thermal', 'print')}
            leftIcon={<Printer className="w-3.5 h-3.5" />}
            className="h-8 text-xs font-bold px-2"
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
        title="سجل الفواتير والتحصيلات"
        subtitle="متابعة فواتير المبيعات النقدية والآجلة وتحصيل الأقساط"
        actions={
          <Button
            variant="outline"
            size="md"
            onClick={() => triggerRefresh(loadInvoices, 'جارٍ تحديث سجل الفواتير والمبيعات...')}
            disabled={isRefreshing || isLoading}
            leftIcon={
              <RefreshCw className={`w-4 h-4 text-slate-600 ${isRefreshing ? 'animate-spin' : ''}`} />
            }
            className="border-slate-300 text-slate-800 font-semibold"
          >
            تحديث
          </Button>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <StatsCard
          title="إجمالي الفواتير"
          value={stats.totalCount}
          subtitle="فاتورة مسجلة"
          icon={Receipt}
        />
        <StatsCard
          title="إجمالي المبيعات"
          value={formatCurrency(stats.totalRevenue)}
          subtitle="قيمة البضائع والخدمات"
          icon={DollarSign}
        />
        <StatsCard
          title="المحصل فعلياً"
          value={formatCurrency(stats.totalPaid)}
          subtitle="النقدية والمدفوعات المستلمة"
          icon={CheckCircle2}
        />
        <StatsCard
          title="المستحقات المعلقة (الديون)"
          value={formatCurrency(stats.totalReceivables)}
          subtitle={stats.overdueCount > 0 ? `${stats.overdueCount} فواتير متأخرة` : 'أرصدة آجلة للمتابعة'}
          icon={Wallet}
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
          <div className="md:col-span-3">
            <DateRangeInputs
              startDate={dateFilter.startDate}
              endDate={dateFilter.endDate}
              maxStartDate={dateFilter.maxStartDate}
              minEndDate={dateFilter.minEndDate}
              maxEndDate={dateFilter.maxEndDate}
              error={dateFilter.error}
              onStartDateChange={dateFilter.setStartDate}
              onEndDateChange={dateFilter.setEndDate}
              onClear={dateFilter.clearDateRange}
            />
          </div>

          {/* Payment Method Filter */}
          <div className="md:col-span-2">
            <Select value={paymentFilter} onChange={e => setPaymentFilter(e.target.value)}>
              <option value="ALL">جميع طرق الدفع</option>
              <option value="نقدي">نقدي</option>
              <option value="فيزا">فيزا</option>
              <option value="انستا باى / فودافون كاش">فودافون كاش / انستا باى</option>
              <option value="آجل">آجل</option>
            </Select>
          </div>

          {/* Payment Status Filter */}
          <div className="md:col-span-2">
            <Select
              value={paymentStatusFilter}
              onChange={e => setPaymentStatusFilter(e.target.value)}
            >
              <option value="ALL">جميع حالات السداد</option>
              <option value="PAID">مسددة بالكامل</option>
              <option value="PARTIALLY_PAID">مسددة جزئياً</option>
              <option value="UNPAID">غير مسددة</option>
              <option value="OVERDUE">متأخرة عن الموعد</option>
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
          <p className="text-xs text-slate-500">
            قم بتغيير خيارات البحث أو قم بإصدار فاتورة جديدة من نقطة البيع
          </p>
        </div>
      ) : (
        <Table columns={columns} data={invoices} keyExtractor={(item: Invoice) => item.id} pagination={{ pageSize: 9 }} />
      )}

      {/* Invoice Detail / Print / Collection Modal */}
      {selectedInvoice && (
        <Modal
          isOpen={!!selectedInvoice}
          onClose={() => setSelectedInvoice(null)}
          title={`الفاتورة: ${selectedInvoice.invoice_number}`}
          subtitle={`التاريخ: ${selectedInvoice.invoice_date} • العميل: ${selectedInvoice.customer_name || 'عميل نقدي'}`}
          size="xl"
          footer={
            <div className="flex items-center justify-between w-full">
              <Button
                variant="outline"
                size="md"
                onClick={() => setSelectedInvoice(null)}
                className="border-slate-300 font-semibold"
              >
                إغلاق
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="md"
                  onClick={async () => {
                    const elementId =
                      printFormat === 'a4' ? 'printable-invoice-a4' : 'printable-invoice-thermal';
                    showNotification({
                      type: 'info',
                      title: 'حفظ الفاتورة بتنسيق PDF',
                      message:
                        'تم فتح نافذة الطباعة. اختر الوجهة "حفظ بتنسيق PDF" لحفظ المستند بجودة عالية.',
                    });
                    await documentPrintService.exportToPdf(elementId, {
                      title: `فاتورة_${selectedInvoice.invoice_number}`,
                      format: printFormat,
                      exportType: 'accessories_invoices',
                    });
                  }}
                  leftIcon={<FileDown className="w-4.5 h-4.5 text-blue-600" />}
                  className="font-bold border-slate-300 hover:bg-slate-50 text-slate-800"
                >
                  حفظ كـ PDF
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  onClick={async () => {
                    const elementId =
                      printFormat === 'a4' ? 'printable-invoice-a4' : 'printable-invoice-thermal';
                    await documentPrintService.printElement(elementId, {
                      title: `فاتورة_${selectedInvoice.invoice_number}`,
                      format: printFormat,
                    });
                  }}
                  leftIcon={<Printer className="w-4.5 h-4.5" />}
                  className="font-bold shadow-xs"
                >
                  طباعة الفاتورة الآن
                </Button>
              </div>
            </div>
          }
        >
          {/* Modal Header Tabs: Print vs Collection */}
          <div className="flex border-b border-slate-200 mb-4 pb-1 gap-2">
            <button
              type="button"
              onClick={() => setModalTab('print')}
              className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors cursor-pointer ${
                modalTab === 'print'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              معاينة وطباعة الفاتورة
            </button>
            <button
              type="button"
              onClick={() => setModalTab('payments')}
              className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors flex items-center gap-2 cursor-pointer ${
                modalTab === 'payments'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Wallet className="w-4 h-4 text-emerald-500" />
              <span>إدارة التحصيل وسجل الدفعات ({invoicePayments.length})</span>
            </button>
          </div>

          {modalTab === 'print' ? (
            isLoadingItems ? (
              <div className="p-12 flex flex-col items-center justify-center">
                <Spinner size="md" />
                <p className="text-sm font-medium text-slate-600 mt-2.5">
                  جارٍ جلب تفاصيل أصناف الفاتورة...
                </p>
              </div>
            ) : (
              <PrintableInvoice
                invoice={selectedInvoice}
                items={selectedItems}
                format={printFormat}
                onFormatChange={setPrintFormat}
              />
            )
          ) : (
            <PaymentHistorySection
              invoiceId={selectedInvoice.id}
              invoiceNumber={selectedInvoice.invoice_number}
              customerName={selectedInvoice.customer_name}
              totalAmount={selectedInvoice.total_amount}
              paidAmount={selectedInvoice.paid_amount ?? selectedInvoice.total_amount}
              remainingBalance={selectedInvoice.remaining_balance ?? 0}
              paymentType={selectedInvoice.payment_type || 'FULL'}
              paymentStatus={selectedInvoice.payment_status || 'PAID'}
              dueDate={selectedInvoice.due_date}
              installmentsCount={selectedInvoice.installments_count}
              payments={invoicePayments}
              schedule={invoiceSchedule}
              onRecordPayment={handleRecordPayment}
              onReversePayment={handleReversePayment}
              onUpdateSchedule={handleUpdateSchedule}
            />
          )}
        </Modal>
      )}
    </div>
  );
};
