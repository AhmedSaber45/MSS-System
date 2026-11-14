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
import { RotateCcw, Search, Store, AlertTriangle, History } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useNotification } from '@/context/NotificationContext';
import { mssCommerceService } from '@/services/mssCommerceService';
import type { MSSReturn, MSSInvoice, MSSStockLocation } from '@/types/mssCommerce';

export const MSSReturnsView: React.FC = () => {
  const { showNotification } = useNotification();

  const [returns, setReturns] = useState<MSSReturn[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Lookup Invoice for Return
  const [queryInput, setQueryInput] = useState<string>('');
  const [foundInvoice, setFoundInvoice] = useState<MSSInvoice | null>(null);
  const [lookupError, setLookupError] = useState<string>('');
  const [isSearchingInvoice, setIsSearchingInvoice] = useState<boolean>(false);

  // Return Form State
  const [refundAmount, setRefundAmount] = useState<number>(0);
  const [returnReason, setReturnReason] = useState<string>('طلب العميل استبدال أو استرجاع الجهاز');
  const [restockLocation, setRestockLocation] = useState<MSSStockLocation>('محل 1');
  const [newCondition, setNewCondition] = useState<string>('فرز أول ممتاز');
  const [newStatus, setNewStatus] = useState<'AVAILABLE' | 'MAINTENANCE'>('AVAILABLE');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Load completed returns
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const list = await mssCommerceService.getReturns();
      setReturns(list);
    } catch (err) {
      console.error('Failed to load returns:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

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
          inv.serial_number.toUpperCase() === q
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
        message: `تم توثيق الإرجاع برقم (${ret.return_number}) وإعادة الجهاز بالسيريال (${foundInvoice.serial_number}) إلى مخزون (${restockLocation}).`,
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
      const matchSerial = r.serial_number.toLowerCase().includes(q);
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
      render: (item: MSSReturn) => (
        <span className="font-mono font-medium text-slate-800 text-xs tabular-nums">
          {item.return_number}
        </span>
      ),
    },
    {
      key: 'invoice_number',
      header: 'الفاتورة الأصلية',
      render: (item: MSSReturn) => (
        <span className="font-mono text-slate-700 font-medium text-xs tabular-nums">
          {item.invoice_number}
        </span>
      ),
    },
    {
      key: 'serial_number',
      header: 'سيريال الجهاز',
      render: (item: MSSReturn) => (
        <span className="font-mono text-xs font-semibold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 tabular-nums">
          {item.serial_number}
        </span>
      ),
    },
    {
      key: 'model_name',
      header: 'الموديل',
      render: (item: MSSReturn) => (
        <span className="font-medium text-slate-800 text-xs">
          {item.brand ? `${item.brand} ` : ''}
          {item.model_name || 'جهاز لابتوب / شاشة'}
        </span>
      ),
    },
    {
      key: 'refund_amount',
      header: 'المبلغ المسترد',
      render: (item: MSSReturn) => (
        <span className="font-semibold text-rose-600 font-mono text-xs tabular-nums">
          {formatCurrency(item.refund_amount)}
        </span>
      ),
    },
    {
      key: 'restock_location',
      header: 'موقع الجهاز بعد الإرجاع',
      render: (item: MSSReturn) => (
        <div className="flex items-center gap-1 font-medium text-xs">
          <Store className="w-3.5 h-3.5 text-slate-400" />
          <Badge variant={item.restock_location === 'محل 1' ? 'primary' : 'default'}>
            {item.restock_location} ({item.new_status === 'AVAILABLE' ? 'متاح للبيع' : 'صيانة'})
          </Badge>
        </div>
      ),
    },
    {
      key: 'return_reason',
      header: 'سبب الإرجاع',
      render: (item: MSSReturn) => (
        <span className="text-xs text-slate-600 max-w-xs truncate block" title={item.return_reason}>
          {item.return_reason}
        </span>
      ),
    },
    {
      key: 'return_date',
      header: 'تاريخ الإرجاع',
      render: (item: MSSReturn) => (
        <span className="font-mono text-xs text-slate-500 tabular-nums">
          {formatDate(item.return_date)}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="مرتجعات أجهزة MSS وعكس العمليات"
        subtitle="توثيق استرجاع الأجهزة المباعة وعكس الأرباح وإعادة السيريال إلى المخزون المادي المعتمد"
      />

      {/* Rules Banner (Rule 8 & 19) */}
      <Alert
        type="info"
        title="توضيح لقاعدة الإرجاع وعكس العمليات (Rule 8 & 19)"
        message="لا يتم حذف فواتير المبيعات الصادرة نهائياً من النظام، وإنما يتم تسجيل عملية إرجاع منفصلة وموثقة لعكس الأثر المالي للأرباح وإعادة الجهاز بالسيريال إلى الموقع المادي المختار."
      />

      {/* Return Lookup & Form Card */}
      <Card className="p-4 bg-white border-slate-200/80 shadow-2xs space-y-3.5">
        <h4 className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
          <Search className="w-4 h-4 text-slate-500" />
          <span>البحث بالسيريال نمبر أو رقم الفاتورة لبدء عملية الإرجاع</span>
        </h4>

        <div className="flex gap-2">
          <div className="flex-1">
            <Input
              placeholder="امسح بالباركود أو اكتب السيريال نمبر أو رقم الفاتورة (مثال: 5CD9283-HP أو MSS-INV-101)..."
              value={queryInput}
              onChange={e => setQueryInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLookupInvoice()}
              scannerReady
              leftIcon={<Search className="w-4 h-4" />}
            />
          </div>
          <Button
            variant="primary"
            size="md"
            onClick={handleLookupInvoice}
            disabled={isSearchingInvoice}
            leftIcon={isSearchingInvoice ? <Spinner size="sm" /> : <Search className="w-4 h-4" />}
          >
            استعلام عن الفاتورة
          </Button>
        </div>

        {lookupError && (
          <Alert type="danger" title="تنبيه" message={lookupError} />
        )}

        {/* Found Invoice Preview & Return Form */}
        {foundInvoice && (
          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200/80 space-y-3.5 animate-in fade-in">
            {foundInvoice.is_returned ? (
              <div className="p-3 bg-amber-50/80 border border-amber-200/80 rounded-lg text-amber-800 text-xs font-medium flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>هذه الفاتورة ({foundInvoice.invoice_number}) تم إرجاعها مسبقاً، ولا يمكن إرجاعها مرة أخرى.</span>
              </div>
            ) : (
              <form onSubmit={handleSubmitReturn} className="space-y-3.5">
                {/* Invoice Summary */}
                <div className="p-3 bg-white rounded-lg border border-slate-200/80 text-xs space-y-2">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <span className="font-semibold text-slate-900 text-xs">
                      {foundInvoice.brand} {foundInvoice.model_name}
                    </span>
                    <span className="font-mono text-xs font-semibold bg-slate-100 text-slate-800 px-2 py-0.5 rounded border border-slate-200 tabular-nums">
                      {foundInvoice.serial_number}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-slate-600">
                    <div>
                      <span className="text-slate-400 block text-[10px]">رقم الفاتورة:</span>
                      <strong className="font-mono text-slate-900 tabular-nums">{foundInvoice.invoice_number}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">تاريخ البيع:</span>
                      <span className="font-mono tabular-nums">{formatDate(foundInvoice.sale_date)}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">فرع البيع:</span>
                      <strong>{foundInvoice.selling_branch}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">سعر البيع الفعلي:</span>
                      <strong className="text-slate-900 font-mono tabular-nums">{formatCurrency(foundInvoice.actual_sale_price)}</strong>
                    </div>
                  </div>
                </div>

                {/* Return Details Inputs */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Input
                    label="المبلغ المسترد للعميل (ج.م) *"
                    type="number"
                    min="0"
                    value={refundAmount}
                    onChange={e => setRefundAmount(Number(e.target.value))}
                    required
                  />

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">
                      المحل المستلم للجهاز المرتجع <span className="text-rose-500">*</span>
                    </label>
                    <Select
                      value={restockLocation}
                      onChange={e => setRestockLocation(e.target.value as MSSStockLocation)}
                      options={[
                        { value: 'محل 1', label: 'محل 1' },
                        { value: 'محل 2', label: 'محل 2' },
                      ]}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">
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

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
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
                    leftIcon={isSubmitting ? <Spinner size="sm" /> : <RotateCcw className="w-4 h-4" />}
                  >
                    {isSubmitting ? 'جاري توثيق الإرجاع...' : `تأكيد إرجاع الجهاز (${formatCurrency(refundAmount)})`}
                  </Button>
                </div>
              </form>
            )}
          </div>
        )}
      </Card>

      {/* Completed Returns Table */}
      <Card className="p-4 bg-white border-slate-200/80 shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <History className="w-4 h-4 text-slate-500" />
            <h4 className="text-xs font-semibold text-slate-900">سجل عمليات الإرجاع السابقة</h4>
          </div>

          <div className="w-72">
            <Input
              placeholder="ابحث برقم الإرجاع، السيريال، أو الفاتورة..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onClear={() => setSearchQuery('')}
              leftIcon={<Search className="w-3.5 h-3.5" />}
            />
          </div>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-xs text-slate-500">
            <Spinner size="sm" className="mx-auto mb-2" />
            جاري تحميل سجلات الإرجاع...
          </div>
        ) : filteredReturns.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400 bg-slate-50 rounded-lg border border-slate-200/80">
            لا توجد عمليات إرجاع مسجلة حتى الآن.
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200/80 overflow-hidden shadow-2xs">
            <Table
              columns={columns}
              data={filteredReturns}
              keyExtractor={(item: MSSReturn) => item.id}
            />
          </div>
        )}
      </Card>
    </div>
  );
};
