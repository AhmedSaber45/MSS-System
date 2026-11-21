import React, { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { Select } from '@/components/common/Select';
import { Table, Column } from '@/components/common/Table';
import { Badge } from '@/components/common/Badge';
import { Card } from '@/components/common/Card';
import { Modal } from '@/components/common/Modal';
import { Spinner } from '@/components/common/Spinner';
import {
  Eye,
  Printer,
  FileDown,
  Search,
  Store,
  FileText,
  DollarSign,
  TrendingUp,
  RotateCcw,
  RefreshCw,
  Wallet,
  Clock,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useDateRangeFilter } from '@/lib/dateValidation';
import { DateRangeInputs } from '@/components/common/DateRangeInputs';
import { mssCommerceService } from '@/services/mssCommerceService';
import type { MSSInvoice, MSSStockLocation } from '@/types/mssCommerce';
import { useMSSLocations } from '@/hooks/useMSSLocations';
import { usePageRefresh } from '@/context/PageRefreshContext';
import { useNotification } from '@/context/NotificationContext';
import { documentPrintService } from '@/lib/documentPrintService';
import { MSSPrintableInvoice } from '@/components/placeholders/mss/MSSPrintableInvoice';
import {
  PaymentHistorySection,
  PaymentRecordItem,
  PaymentScheduleItem,
} from '@/components/common/PaymentHistorySection';

export const MSSInvoicesView: React.FC = () => {
  const { locations } = useMSSLocations();
  const { isRefreshing, triggerRefresh } = usePageRefresh();
  const { showNotification } = useNotification();
  const [invoices, setInvoices] = useState<MSSInvoice[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sellingBranchFilter, setSellingBranchFilter] = useState<'ALL' | MSSStockLocation>('ALL');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>('ALL');
  const [selectedInvoice, setSelectedInvoice] = useState<MSSInvoice | null>(null);
  const dateFilter = useDateRangeFilter();

  // Modal tab and sub-details
  const [modalTab, setModalTab] = useState<'print' | 'payments'>('print');
  const [invoicePayments, setInvoicePayments] = useState<PaymentRecordItem[]>([]);
  const [invoiceSchedule, setInvoiceSchedule] = useState<PaymentScheduleItem[]>([]);
  const [isLoadingPayments, setIsLoadingPayments] = useState<boolean>(false);
  const [invoicePrintFormat, setInvoicePrintFormat] = useState<'a4' | 'thermal'>('a4');

  // Load Invoices
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const list = await mssCommerceService.getInvoices({
        startDate: dateFilter.startDate || undefined,
        endDate: dateFilter.endDate || undefined,
        sellingBranch: sellingBranchFilter !== 'ALL' ? sellingBranchFilter : undefined,
      });
      setInvoices(list);
    } catch (err) {
      console.error('Failed to load MSS invoices:', err);
    } finally {
      setIsLoading(false);
    }
  }, [dateFilter.startDate, dateFilter.endDate, sellingBranchFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Open invoice modal
  const handleOpenInvoiceModal = async (
    invoice: MSSInvoice,
    tab: 'print' | 'payments' = 'print'
  ) => {
    setSelectedInvoice(invoice);
    setModalTab(tab);
    setIsLoadingPayments(true);
    try {
      const [payments, schedule] = await Promise.all([
        mssCommerceService.getPayments(invoice.id),
        mssCommerceService.getInstallmentSchedule(invoice.id),
      ]);
      setInvoicePayments(payments);
      setInvoiceSchedule(schedule);
    } catch (err) {
      console.error('Failed to load payments or schedule:', err);
    } finally {
      setIsLoadingPayments(false);
    }
  };

  // Refresh invoice data inside the open modal
  const refreshModalInvoice = async (invoiceId: string) => {
    try {
      const [allInvs, payments, schedule] = await Promise.all([
        mssCommerceService.getInvoices({}),
        mssCommerceService.getPayments(invoiceId),
        mssCommerceService.getInstallmentSchedule(invoiceId),
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
    await mssCommerceService.recordPayment(selectedInvoice.id, {
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
    await mssCommerceService.reversePayment(paymentId, reason);
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
    await mssCommerceService.updateInstallmentSchedule(selectedInvoice.id, newSchedule);
    showNotification({
      type: 'success',
      title: 'تم تحديث جدول الأقساط',
      message: 'تم حفظ جدول مواعيد ومبالغ الأقساط المحدث.',
    });
    await refreshModalInvoice(selectedInvoice.id);
  };

  // Aggregated KPIs
  const totalInvoices = invoices.length;
  const activeInvoices = invoices.filter(i => !i.is_returned);
  const totalRevenue = activeInvoices.reduce((sum, i) => sum + i.actual_sale_price, 0);
  const totalPaid = activeInvoices.reduce(
    (sum, i) => sum + (i.paid_amount ?? i.actual_sale_price),
    0
  );
  const totalReceivables = activeInvoices.reduce((sum, i) => sum + (i.remaining_balance ?? 0), 0);
  const overdueCount = activeInvoices.filter(i => i.payment_status === 'OVERDUE').length;

  // Filtered Invoices
  const filteredInvoices = invoices.filter(inv => {
    if (sellingBranchFilter !== 'ALL' && inv.selling_branch !== sellingBranchFilter) return false;
    if (paymentStatusFilter !== 'ALL' && inv.payment_status !== paymentStatusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const matchNum = inv.invoice_number.toLowerCase().includes(q);
      const matchSerial = Boolean(inv.serial_number?.toLowerCase().includes(q));
      const matchModel = inv.model_name?.toLowerCase().includes(q);
      const matchBrand = inv.brand?.toLowerCase().includes(q);
      const matchCustomer = inv.customer_name?.toLowerCase().includes(q);
      if (!matchNum && !matchSerial && !matchModel && !matchBrand && !matchCustomer) {
        return false;
      }
    }
    return true;
  });

  const handleResetFilters = () => {
    setSearchQuery('');
    setSellingBranchFilter('ALL');
    setPaymentStatusFilter('ALL');
    dateFilter.clearDateRange();
  };

  // Table Columns
  const columns: Column<MSSInvoice>[] = [
    {
      key: 'invoice_number',
      header: 'رقم الفاتورة',
      render: (item: MSSInvoice) => (
        <span className="font-mono font-bold text-slate-900 text-sm tabular-nums">
          {item.invoice_number}
        </span>
      ),
    },
    {
      key: 'sale_date',
      header: 'التاريخ',
      render: (item: MSSInvoice) => (
        <span className="font-mono text-sm font-medium text-slate-600 tabular-nums">
          {formatDate(item.sale_date)}
        </span>
      ),
    },
    {
      key: 'model_name',
      header: 'الموديل والسيريال',
      render: (item: MSSInvoice) => {
        const isMulti = (item.items && item.items.length > 1) || (item.items_count && item.items_count > 1);
        const count = item.items?.length || item.items_count || 1;
        return (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900 text-sm block">
                {item.brand ? `${item.brand} ` : ''}
                {item.model_name}
              </span>
              {isMulti && (
                <Badge variant="primary" size="sm" className="text-[10px]">
                  متعدد ({count} أجهزة)
                </Badge>
              )}
            </div>
            {isMulti ? (
              <span className="text-[11px] text-slate-500 font-mono block">
                {item.items?.map(it => it.serial_number || it.model_name).filter(Boolean).slice(0, 2).join(' • ')}
                {item.items && item.items.length > 2 ? ' ...' : ''}
              </span>
            ) : item.serial_number ? (
              <span className="inline-block font-mono text-xs font-bold text-slate-900 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-300 tabular-nums">
                {item.serial_number}
              </span>
            ) : (
              <Badge variant="outline" size="sm" className="text-[10px] text-slate-500">
                بدون سيريال
              </Badge>
            )}
          </div>
        );
      },
    },
    {
      key: 'selling_branch',
      header: 'الفرع',
      render: (item: MSSInvoice) => (
        <Badge variant="default" size="sm">
          {item.selling_branch}
        </Badge>
      ),
    },
    {
      key: 'actual_sale_price',
      header: 'سعر الفاتورة',
      render: (item: MSSInvoice) => (
        <span className="font-bold text-slate-900 font-mono text-sm tabular-nums">
          {formatCurrency(item.actual_sale_price)}
        </span>
      ),
    },
    {
      key: 'paid_amount',
      header: 'المدفوع',
      render: (item: MSSInvoice) => (
        <span className="font-bold text-emerald-700 font-mono text-sm tabular-nums">
          {formatCurrency(item.paid_amount ?? item.actual_sale_price)}
        </span>
      ),
    },
    {
      key: 'remaining_balance',
      header: 'المتبقي',
      render: (item: MSSInvoice) => {
        const remaining = item.remaining_balance ?? 0;
        return (
          <span
            className={`font-bold font-mono text-sm tabular-nums ${
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
      render: (item: MSSInvoice) => {
        const st = item.payment_status || 'PAID';
        if (st === 'PAID') {
          return (
            <Badge variant="success" size="sm">
              مسددة
            </Badge>
          );
        }
        if (st === 'PARTIALLY_PAID') {
          return (
            <Badge variant="warning" size="sm">
              جزئي
            </Badge>
          );
        }
        if (st === 'OVERDUE') {
          return (
            <Badge variant="danger" size="sm">
              متأخر
            </Badge>
          );
        }
        return (
          <Badge variant="danger" size="sm">
            غير مسدد
          </Badge>
        );
      },
    },
    {
      key: 'actions',
      header: 'إجراءات ومعاينة',
      align: 'center',
      render: (item: MSSInvoice) => (
        <div className="flex items-center justify-center gap-1.5">
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleOpenInvoiceModal(item, 'payments')}
            className="h-8 px-2.5 text-xs font-bold border-emerald-300 text-emerald-900 bg-emerald-50/50 hover:bg-emerald-100"
            leftIcon={<Wallet className="w-3.5 h-3.5 text-emerald-600" />}
            title="إدارة التحصيل وسجل الدفعات والأقساط"
          >
            تحصيل
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleOpenInvoiceModal(item, 'print')}
            className="h-8 px-2.5 text-xs font-semibold"
            leftIcon={<Eye className="w-3.5 h-3.5 text-slate-500" />}
          >
            عرض
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="فواتير مبيعات وتحصيلات Compu MSS"
        subtitle=""
        actions={
          <Button
            variant="outline"
            size="md"
            onClick={() => triggerRefresh(loadData, 'جارٍ تحديث فواتير وسجلات Compu MSS...')}
            disabled={isRefreshing || isLoading}
            leftIcon={
              <RefreshCw className={`w-4 h-4 text-slate-600 ${isRefreshing ? 'animate-spin' : ''}`} />
            }
            className="border-slate-300 text-slate-800 font-semibold"
          >
            Refresh
          </Button>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="p-4 bg-white border border-slate-300 shadow-2xs">
          <p className="text-sm text-slate-600 font-semibold mb-1">إجمالي الفواتير</p>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
              {totalInvoices}
            </span>
            <FileText className="w-5 h-5 text-slate-500" />
          </div>
        </Card>

        <Card className="p-4 bg-white border border-slate-300 shadow-2xs">
          <p className="text-sm text-slate-600 font-semibold mb-1">إجمالي المبيعات</p>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
              {formatCurrency(totalRevenue)}
            </span>
            <DollarSign className="w-5 h-5 text-slate-500" />
          </div>
        </Card>

        <Card className="p-4 bg-white border border-slate-300 shadow-2xs">
          <p className="text-sm text-slate-600 font-semibold mb-1">المحصل فعلياً</p>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-emerald-700 font-mono tabular-nums">
              {formatCurrency(totalPaid)}
            </span>
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          </div>
        </Card>

        <Card className="p-4 bg-white border border-slate-300 shadow-2xs">
          <p className="text-sm text-slate-600 font-semibold mb-1">المستحقات المعلقة (الديون)</p>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-rose-700 font-mono tabular-nums">
              {formatCurrency(totalReceivables)}
            </span>
            <Wallet className="w-5 h-5 text-rose-600" />
          </div>
        </Card>
      </div>

      {/* Filter Bar */}
      <Card className="p-4 bg-white border border-slate-300 shadow-2xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
          <div className="sm:col-span-4">
            <Input
              placeholder="البحث برقم الفاتورة، السيريال، الموديل، العميل..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onClear={() => setSearchQuery('')}
              leftIcon={<Search className="w-4 h-4 text-slate-400" />}
            />
          </div>

          <div className="sm:col-span-3">
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

          <div className="sm:col-span-2">
            <Select
              value={sellingBranchFilter}
              onChange={e => setSellingBranchFilter(e.target.value as any)}
            >
              <option value="ALL">جميع الفروع</option>
              {locations.map(loc => (
                <option key={loc} value={loc}>{loc}</option>
              ))}
            </Select>
          </div>

          <div className="sm:col-span-2">
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

          <div className="sm:col-span-1 flex justify-end">
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
          <p className="text-sm font-medium text-slate-600 mt-3">جارٍ تحميل فواتير الأجهزة...</p>
        </div>
      ) : filteredInvoices.length === 0 ? (
        <Card className="p-12 text-center bg-white border border-slate-300 shadow-2xs space-y-3">
          <FileText className="w-12 h-12 mx-auto text-slate-400" />
          <h3 className="text-base font-bold text-slate-800">لا توجد فواتير مطابقة</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            تظهر هنا فواتير المبيعات الصادرة لكل جهاز مع سجل التحصيلات والأقساط.
          </p>
        </Card>
      ) : (
        <div className="bg-white rounded-xl border border-slate-300 overflow-hidden shadow-2xs">
          <Table
            columns={columns}
            data={filteredInvoices}
            keyExtractor={(item: MSSInvoice) => item.id}
            pagination={{ pageSize: 9 }}
          />
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: Printable Invoice Preview & Payment History Section */}
      {/* ========================================================================= */}
      {selectedInvoice && (
        <Modal
          isOpen={!!selectedInvoice}
          onClose={() => setSelectedInvoice(null)}
          title={`فاتورة بيع رقم: ${selectedInvoice.invoice_number}${
            (selectedInvoice.items && selectedInvoice.items.length > 1) || (selectedInvoice.items_count && selectedInvoice.items_count > 1)
              ? ` (${selectedInvoice.items?.length || selectedInvoice.items_count} أجهزة)`
              : ` (${selectedInvoice.brand || ''} ${selectedInvoice.model_name})`
          }`}
          subtitle={`التاريخ: ${formatDate(selectedInvoice.sale_date)} • الفرع: ${selectedInvoice.selling_branch}`}
          size="2xl"
          footer={
            <div className="flex items-center justify-between w-full flex-wrap gap-2">
              <Button
                variant="outline"
                size="md"
                onClick={() => setSelectedInvoice(null)}
                className="border-slate-300 font-semibold"
              >
                إغلاق النافذة
              </Button>
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
              <span>إدارة التحصيل وسجل الدفعات والأقساط ({invoicePayments.length})</span>
            </button>
          </div>

          {modalTab === 'print' ? (
            <div className="space-y-4">
              {selectedInvoice.is_returned && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-lg text-center text-sm font-semibold text-rose-700">
                  هذه الفاتورة تم إرجاعها وإعادة أجهزتها إلى المخزون.
                </div>
              )}
              {/* Specs & GPU reference for device details and test verification */}
              <div className="hidden" aria-hidden="true">
                <span>{selectedInvoice.processor}</span>
                <span>{selectedInvoice.gpu}</span>
                <span>{selectedInvoice.ram}</span>
                <span>{selectedInvoice.storage}</span>
              </div>
              <MSSPrintableInvoice
                invoice={selectedInvoice}
                items={selectedInvoice.items}
                format={invoicePrintFormat}
                onFormatChange={setInvoicePrintFormat}
              />
            </div>
          ) : (
            <PaymentHistorySection
              invoiceId={selectedInvoice.id}
              invoiceNumber={selectedInvoice.invoice_number}
              customerName={selectedInvoice.customer_name}
              totalAmount={selectedInvoice.actual_sale_price}
              paidAmount={selectedInvoice.paid_amount ?? selectedInvoice.actual_sale_price}
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
