import React, { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { Select } from '@/components/common/Select';
import { Card } from '@/components/common/Card';
import { Table, Column } from '@/components/common/Table';
import { Badge } from '@/components/common/Badge';
import { Alert } from '@/components/common/Alert';
import { Spinner } from '@/components/common/Spinner';
import { RotateCcw, Search, Store, AlertTriangle, History, RefreshCw } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useDateRangeFilter } from '@/lib/dateValidation';
import { DateRangeInputs } from '@/components/common/DateRangeInputs';
import { useNotification } from '@/context/NotificationContext';
import { usePageRefresh } from '@/context/PageRefreshContext';
import { mssCommerceService } from '@/services/mssCommerceService';
import type { MSSReturn, MSSInvoice, MSSStockLocation } from '@/types/mssCommerce';
import { useMSSLocations } from '@/hooks/useMSSLocations';

export const MSSReturnsView: React.FC = () => {
  const { showNotification } = useNotification();
  const { isRefreshing, triggerRefresh } = usePageRefresh();

  const [returns, setReturns] = useState<MSSReturn[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const dateFilter = useDateRangeFilter();

  // Lookup Invoice for Return
  const [queryInput, setQueryInput] = useState<string>('');
  const [foundInvoice, setFoundInvoice] = useState<MSSInvoice | null>(null);
  const [lookupError, setLookupError] = useState<string>('');
  const [isSearchingInvoice, setIsSearchingInvoice] = useState<boolean>(false);

  // Return Form State
  const [refundAmount, setRefundAmount] = useState<number | ''>(0);
  const [returnReason, setReturnReason] = useState<string>('طلب العميل استبدال أو استرجاع الجهاز');
  const { locations } = useMSSLocations();
  const [restockLocation, setRestockLocation] = useState<MSSStockLocation>(() => locations[0] || '');

  useEffect(() => {
    if (locations.length > 0 && !locations.includes(restockLocation)) {
      setRestockLocation(locations[0]);
    }
  }, [locations, restockLocation]);
  const [newCondition, setNewCondition] = useState<string>('فرز أول ممتاز');
  const [newStatus, setNewStatus] = useState<'AVAILABLE' | 'MAINTENANCE'>('AVAILABLE');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Load completed returns
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const list = await mssCommerceService.getReturns({
        startDate: dateFilter.startDate || undefined,
        endDate: dateFilter.endDate || undefined,
      });
      setReturns(list);
    } catch (err) {
      console.error('Failed to load returns:', err);
    } finally {
      setIsLoading(false);
    }
  }, [dateFilter.startDate, dateFilter.endDate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Lookup Invoice by Serial or Invoice Number
  const handleLookupInvoice = async () => {
    if (!queryInput.trim()) {
      setLookupError('يرجى كتابة أو مسح السيريال نمبر أو رقم الفاتورة');
      return;
    }

    setIsSearchingInvoice(true);
    setLookupError('');
    setFoundInvoice(null);

    try {
      const q = queryInput.trim().toUpperCase();
      const allInvoices = await mssCommerceService.getInvoices();

      const match = allInvoices.find(
        inv =>
          inv.invoice_number.toUpperCase() === q ||
          (inv.serial_number && inv.serial_number.toUpperCase() === q)
      );

      if (!match) {
        setLookupError(`لم يتم العثور على أي فاتورة بيع مطابقة للمدخل (${queryInput.trim()})`);
      } else {
        setFoundInvoice(match);
        setRefundAmount(match.actual_sale_price);
        setRestockLocation(match.selling_branch);
      }
    } catch (err: any) {
      setLookupError(err.message || 'خطأ أثناء البحث عن الفاتورة');
    } finally {
      setIsSearchingInvoice(false);
    }
  };

  // Submit Return
  const handleSubmitReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!foundInvoice || isSubmitting) return;

    if (foundInvoice.is_returned) {
      setLookupError('تم إرجاع هذه الفاتورة مسبقاً');
      return;
    }

    if (!returnReason.trim()) {
      setLookupError('سبب الإرجاع مطلوب لتوثيق العملية');
      return;
    }

    setIsSubmitting(true);
    setLookupError('');

    try {
      const ret = await mssCommerceService.processReturn({
        invoice_id: foundInvoice.id,
        refund_amount: Number(refundAmount),
        return_reason: returnReason.trim(),
        restock_location: restockLocation,
        new_condition: newCondition.trim(),
        new_status: newStatus,
        notes: notes.trim() || undefined,
      });

      showNotification({
        type: 'success',
        title: 'تم إتمام عملية الإرجاع بنجاح',
        message: `تم توثيق الإرجاع برقم (${ret.return_number}) وإعادة الجهاز (${foundInvoice.serial_number || 'بدون سيريال'}) إلى مخزون (${restockLocation}).`,
      });

      setFoundInvoice(null);
      setQueryInput('');
      await loadData();
    } catch (err: any) {
      setLookupError(err.message || 'فشلت عملية الإرجاع');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtered Returns Table
  const filteredReturns = returns.filter(r => {
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const matchNum = r.return_number.toLowerCase().includes(q);
      const matchInv = r.invoice_number.toLowerCase().includes(q);
      const matchSerial = Boolean(r.serial_number?.toLowerCase().includes(q));
      const matchModel = r.model_name?.toLowerCase().includes(q);
      const matchReason = r.return_reason.toLowerCase().includes(q);
      if (!matchNum && !matchInv && !matchSerial && !matchModel && !matchReason) {
        return false;
      }
    }
    return true;
  });

  // Table Columns
  const columns: Column<MSSReturn>[] = [
    {
      key: 'return_number',
      header: 'رقم الإرجاع',
      align: 'center',
      nowrap: true,
      className: 'w-28 min-w-[95px] max-w-[110px] text-center px-1.5',
      render: (item: MSSReturn) => (
        <span className="font-mono font-bold text-slate-900 text-xs sm:text-sm tabular-nums whitespace-nowrap block text-center">
          {item.return_number}
        </span>
      ),
    },
    {
      key: 'invoice_number',
      header: 'الفاتورة الأصلية',
      align: 'center',
      nowrap: true,
      className: 'w-32 min-w-[110px] max-w-[130px] text-center px-1.5',
      render: (item: MSSReturn) => (
        <span className="font-mono text-slate-800 font-bold text-xs sm:text-sm tabular-nums whitespace-nowrap block text-center">
          {item.invoice_number}
        </span>
      ),
    },
    {
      key: 'serial_number',
      header: 'سيريال الجهاز',
      align: 'center',
      nowrap: true,
      className: 'w-44 min-w-[150px] max-w-[180px] text-center px-2',
      render: (item: MSSReturn) => (
        item.serial_number ? (
          <span
            className="font-mono text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200/70 px-2 py-0.5 rounded border border-slate-300 tracking-tight select-all tabular-nums truncate max-w-[160px] inline-block"
            title={item.serial_number}
          >
            {item.serial_number}
          </span>
        ) : (
          <span className="text-slate-400 font-medium text-xs whitespace-nowrap">بدون سيريال</span>
        )
      ),
    },
    {
      key: 'model_name',
      header: 'الموديل',
      align: 'right',
      nowrap: false,
      className: 'w-full min-w-[160px] px-2.5',
      render: (item: MSSReturn) => (
        <div className="min-w-[140px] space-y-0.5">
          <span className="font-bold text-slate-900 text-xs sm:text-sm block leading-snug">
            {item.brand ? `${item.brand} ` : ''}
            {item.model_name || 'جهاز لابتوب / شاشة'}
          </span>
        </div>
      ),
    },
    {
      key: 'refund_amount',
      header: 'المبلغ المسترد',
      align: 'left',
      nowrap: true,
      className: 'w-28 min-w-[95px] max-w-[115px] text-left px-2',
      render: (item: MSSReturn) => (
        <span className="font-bold text-rose-700 font-mono text-xs sm:text-sm tabular-nums whitespace-nowrap block text-left">
          {formatCurrency(item.refund_amount)}
        </span>
      ),
    },
    {
      key: 'restock_location',
      header: 'موقع الجهاز بعد الإرجاع',
      align: 'center',
      nowrap: true,
      className: 'w-44 min-w-[145px] max-w-[170px] text-center px-1.5',
      render: (item: MSSReturn) => (
        <div className="flex items-center justify-center gap-1.5 whitespace-nowrap">
          <Store className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <Badge variant="default" size="sm" className="font-semibold text-xs whitespace-nowrap">
            {item.restock_location} ({item.new_status === 'AVAILABLE' ? 'متاح للبيع' : 'صيانة'})
          </Badge>
        </div>
      ),
    },
    {
      key: 'return_reason',
      header: 'سبب الإرجاع',
      align: 'right',
      nowrap: false,
      className: 'w-52 min-w-[150px] max-w-[220px] px-2',
      render: (item: MSSReturn) => (
        <span className="text-xs text-slate-700 font-medium block truncate max-w-[210px]" title={item.return_reason}>
          {item.return_reason}
        </span>
      ),
    },
    {
      key: 'return_date',
      header: 'تاريخ الإرجاع',
      align: 'center',
      nowrap: true,
      className: 'w-32 min-w-[105px] max-w-[125px] text-center px-1.5',
      render: (item: MSSReturn) => (
        <span className="font-medium text-slate-700 text-xs tabular-nums whitespace-nowrap block text-center">
          {formatDate(item.return_date)}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="مرتجعات أجهزة Compu MSS  "
        subtitle=""
        actions={
          <Button
            variant="outline"
            size="md"
            onClick={() => triggerRefresh(loadData, 'جارٍ تحديث سجل مرتجعات أجهزة Compu MSS...')}
            disabled={isRefreshing || isLoading}
            leftIcon={<RefreshCw className={`w-4.5 h-4.5 text-slate-600 ${isRefreshing ? 'animate-spin' : ''}`} />}
            className="border-slate-300 font-semibold"
          >
            Refresh
          </Button>
        }
      />


      {/* Return Lookup & Form Card */}
      <Card className="p-4 bg-white border-slate-300 shadow-2xs space-y-4">
        <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <Search className="w-4.5 h-4.5 text-slate-500" />
          <span>البحث بالسيريال نمبر أو رقم الفاتورة لبدء عملية الإرجاع</span>
        </h4>

        <div className="flex gap-3">
          <div className="flex-1">
            <Input
              placeholder="اكتب السيريال نمبر أو رقم الفاتورة (مثال: 5CD9283-HP أو MSS-INV-101)..."
              value={queryInput}
              onChange={e => setQueryInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLookupInvoice()}
              leftIcon={<Search className="w-4.5 h-4.5" />}
            />
          </div>
          <Button
            variant="primary"
            size="md"
            onClick={handleLookupInvoice}
            disabled={isSearchingInvoice}
            className="font-bold"
            leftIcon={isSearchingInvoice ? <Spinner size="sm" /> : <Search className="w-4.5 h-4.5" />}
          >
            استعلام عن الفاتورة
          </Button>
        </div>

        {lookupError && (
          <Alert type="danger" title="تنبيه" message={lookupError} />
        )}

        {/* Found Invoice Preview & Return Form */}
        {foundInvoice && (
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-300 space-y-4 animate-in fade-in">
            {foundInvoice.is_returned ? (
              <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl text-amber-800 text-sm font-semibold flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                <span>هذه الفاتورة ({foundInvoice.invoice_number}) تم إرجاعها مسبقاً، ولا يمكن إرجاعها مرة أخرى.</span>
              </div>
            ) : (
              <form onSubmit={handleSubmitReturn} className="space-y-4">
                {/* Invoice Summary */}
                <div className="p-4 bg-white rounded-xl border border-slate-300 text-sm space-y-2.5">
                  <div className="flex items-center justify-between pb-2.5 border-b border-slate-200">
                    <span className="font-bold text-slate-900 text-base">
                      {foundInvoice.brand} {foundInvoice.model_name}
                    </span>
                    {foundInvoice.serial_number ? (
                      <span className="font-mono text-xs font-bold bg-slate-100 text-slate-900 px-3 py-1 rounded-md border border-slate-300 tabular-nums">
                        {foundInvoice.serial_number}
                      </span>
                    ) : (
                      <span className="text-slate-400 font-medium text-xs">بدون سيريال</span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-slate-600">
                    <div>
                      <span className="text-slate-500 block text-xs font-semibold">رقم الفاتورة:</span>
                      <strong className="font-mono text-slate-900 text-sm tabular-nums">{foundInvoice.invoice_number}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-xs font-semibold">تاريخ البيع:</span>
                      <span className="font-mono text-slate-800 text-sm tabular-nums">{formatDate(foundInvoice.sale_date)}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-xs font-semibold">فرع البيع:</span>
                      <strong className="text-slate-900 text-sm">{foundInvoice.selling_branch}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-xs font-semibold">سعر البيع :</span>
                      <strong className="text-slate-900 font-mono text-sm tabular-nums">{formatCurrency(foundInvoice.actual_sale_price)}</strong>
                    </div>
                  </div>
                </div>

                {/* Return Details Inputs */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Input
                    label="المبلغ المسترد للعميل (EGP) *"
                    type="number"
                    min="0"
                    placeholder="0.00"
                    value={refundAmount}
                    onChange={e => setRefundAmount(e.target.value === '' ? '' : Number(e.target.value))}
                    required
                  />

                  <div>
                    <label className="block text-sm font-semibold text-slate-800 mb-1.5">
                      المحل المستلم للجهاز المرتجع <span className="text-rose-500">*</span>
                    </label>
                    <Select
                      value={restockLocation}
                      onChange={e => setRestockLocation(e.target.value as MSSStockLocation)}
                      options={locations.map(loc => ({
                        value: loc,
                        label: loc,
                      }))}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-800 mb-1.5">
                      حالة الجهاز بعد الإرجاع <span className="text-rose-500">*</span>
                    </label>
                    <Select
                      value={newStatus}
                      onChange={e => setNewStatus(e.target.value as any)}
                      options={[
                        { value: 'AVAILABLE', label: 'متاح للبيع الفوري بالمخزون' },
                        { value: 'MAINTENANCE', label: 'تحت الفحص والصيانة' },
                      ]}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    label="سبب الإرجاع *"
                    value={returnReason}
                    onChange={e => setReturnReason(e.target.value)}
                    placeholder="مثال: رغبة العميل في استبدال الشاشة، أو عيب فني..."
                    required
                  />

                  <Input
                    label="الحالة الظاهرية بعد الفحص"
                    value={newCondition}
                    onChange={e => setNewCondition(e.target.value)}
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <Button
                    variant="outline"
                    size="md"
                    onClick={() => setFoundInvoice(null)}
                    disabled={isSubmitting}
                  >
                    إلغاء
                  </Button>
                  <Button
                    variant="danger"
                    size="md"
                    onClick={handleSubmitReturn}
                    disabled={isSubmitting}
                    className="font-bold"
                    leftIcon={isSubmitting ? <Spinner size="sm" /> : <RotateCcw className="w-4.5 h-4.5" />}
                  >
                    {isSubmitting ? 'جاري  الإرجاع...' : `تأكيد إرجاع الجهاز (${formatCurrency(Number(refundAmount) || 0)})`}
                  </Button>
                </div>
              </form>
            )}
          </div>
        )}
      </Card>

      {/* Completed Returns Table */}
      <Card className="p-4 bg-white border-slate-300 shadow-2xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-slate-600" />
            <h4 className="text-sm font-bold text-slate-900">سجل عمليات الإرجاع </h4>
          </div>

          <div className="w-full md:w-80">
            <Input
              placeholder="ابحث برقم الإرجاع، السيريال، أو الفاتورة..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onClear={() => setSearchQuery('')}
              leftIcon={<Search className="w-4 h-4" />}
            />
          </div>
        </div>

        {/* Date Filter Bar */}
        <div className="pt-3 border-t border-slate-200">
          <DateRangeInputs
            startDate={dateFilter.startDate}
            endDate={dateFilter.endDate}
            onStartDateChange={dateFilter.setStartDate}
            onEndDateChange={dateFilter.setEndDate}
            error={dateFilter.error}
            onClear={dateFilter.reset}
          />
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-sm font-medium text-slate-600">
            <Spinner size="lg" className="mx-auto mb-3" />
            جاري تحميل سجلات الإرجاع...
          </div>
        ) : filteredReturns.length === 0 ? (
          <div className="p-12 text-center text-sm text-slate-500 bg-slate-50 rounded-xl border border-slate-300">
            لا توجد عمليات إرجاع مسجلة حتى الآن.
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-300 overflow-hidden shadow-2xs">
            <Table
              columns={columns}
              data={filteredReturns}
              keyExtractor={(item: MSSReturn) => item.id}
              pagination={{ pageSize: 9 }}
              density="compact"
              className="w-full text-right"
            />
          </div>
        )}
      </Card>
    </div>
  );
};
