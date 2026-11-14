import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { Select } from '@/components/common/Select';
import { Card } from '@/components/common/Card';
import { Table, Column } from '@/components/common/Table';
import { Alert } from '@/components/common/Alert';
import { Badge } from '@/components/common/Badge';
import { Modal } from '@/components/common/Modal';
import { Spinner } from '@/components/common/Spinner';
import {
  RotateCcw,
  Search,
  Receipt,
  Eye,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { useNotification } from '@/context/NotificationContext';
import { salesService } from '@/services/salesService.ts';
import { returnsService } from '@/services/returnsService.ts';
import type { Invoice, InvoiceItem } from '@/types/sale.ts';
import type { ReturnRecord, ReturnItemRecord, NewReturnItemInput } from '@/types/returns.ts';

export const ReturnsView: React.FC = () => {
  const { showNotification } = useNotification();

  // Returns archive list
  const [returnsList, setReturnsList] = useState<ReturnRecord[]>([]);
  const [isLoadingReturns, setIsLoadingReturns] = useState<boolean>(true);
  const [filterQuery, setFilterQuery] = useState<string>('');

  // Invoice Lookup state
  const [invoiceSearchQuery, setInvoiceSearchQuery] = useState<string>('');
  const [isSearchingInvoice, setIsSearchingInvoice] = useState<boolean>(false);
  const [foundInvoice, setFoundInvoice] = useState<Invoice | null>(null);
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([]);

  // Active Return Form State
  const [selectedReturnItems, setSelectedReturnItems] = useState<
    Map<string, { qty: number; refundPrice: number; condition: 'RESTOCKED' | 'DAMAGED' }>
  >(new Map());
  const [returnReason, setReturnReason] = useState<string>('');
  const [refundMethod, setRefundMethod] = useState<string>('نقدي');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Return Details Modal
  const [viewingReturn, setViewingReturn] = useState<ReturnRecord | null>(null);
  const [viewingReturnItems, setViewingReturnItems] = useState<ReturnItemRecord[]>([]);
  const [isLoadingReturnItems, setIsLoadingReturnItems] = useState<boolean>(false);

  // Load returns archive
  const loadReturns = useCallback(async () => {
    setIsLoadingReturns(true);
    try {
      const data = await returnsService.getReturns({ invoiceQuery: filterQuery });
      setReturnsList(data);
    } catch (err: any) {
      console.warn('Failed to load returns:', err);
    } finally {
      setIsLoadingReturns(false);
    }
  }, [filterQuery]);

  useEffect(() => {
    loadReturns();
  }, [loadReturns]);

  // Search invoice for return
  const handleSearchInvoice = async () => {
    const q = invoiceSearchQuery.trim();
    if (!q) {
      showNotification({
        type: 'warning',
        title: 'رقم الفاتورة مطلوب',
        message: 'يرجى إدخال رقم الفاتورة للبحث عنها',
      });
      return;
    }

    setIsSearchingInvoice(true);
    try {
      const invoices = await salesService.getInvoices({ query: q });
      const matched = invoices.find(
        inv =>
          inv.invoice_number.toLowerCase() === q.toLowerCase() ||
          inv.id.toLowerCase() === q.toLowerCase()
      ) || invoices[0];

      if (!matched) {
        setFoundInvoice(null);
        setInvoiceItems([]);
        showNotification({
          type: 'error',
          title: 'لم يتم العثور على الفاتورة',
          message: `لا توجد فاتورة برقم "${q}" في قاعدة البيانات المحلية.`,
        });
        return;
      }

      setFoundInvoice(matched);
      const items = await salesService.getInvoiceItems(matched.id);
      setInvoiceItems(items);

      // Initialize selected return items map
      const initialMap = new Map();
      items.forEach(item => {
        initialMap.set(item.product_id, {
          qty: 0,
          refundPrice: item.actual_price,
          condition: 'RESTOCKED',
        });
      });
      setSelectedReturnItems(initialMap);
    } catch (err: any) {
      showNotification({
        type: 'error',
        title: 'خطأ أثناء البحث',
        message: err.message || 'فشل البحث عن الفاتورة',
      });
    } finally {
      setIsSearchingInvoice(false);
    }
  };

  const handleItemReturnChange = (
    productId: string,
    updates: Partial<{ qty: number; refundPrice: number; condition: 'RESTOCKED' | 'DAMAGED' }>
  ) => {
    setSelectedReturnItems(prev => {
      const next = new Map(prev);
      const current = next.get(productId) || { qty: 0, refundPrice: 0, condition: 'RESTOCKED' };
      next.set(productId, { ...current, ...updates });
      return next;
    });
  };

  // Calculations
  const totalCalculatedRefund = useMemo(() => {
    let sum = 0;
    selectedReturnItems.forEach(item => {
      sum += item.qty * item.refundPrice;
    });
    return sum;
  }, [selectedReturnItems]);

  const activeReturnCount = useMemo(() => {
    let count = 0;
    selectedReturnItems.forEach(item => {
      if (item.qty > 0) count += 1;
    });
    return count;
  }, [selectedReturnItems]);

  // Submit Return
  const handleSubmitReturn = async () => {
    if (!foundInvoice) return;

    if (activeReturnCount === 0) {
      showNotification({
        type: 'warning',
        title: 'لم يتم تحديد أي صنف',
        message: 'حدد كمية صنف واحد على الأقل لإرجاعه.',
      });
      return;
    }

    if (!returnReason.trim()) {
      showNotification({
        type: 'error',
        title: 'سبب الإرجاع مطلوب',
        message: 'القاعدة 8 تتطلب توثيق سبب صريح للإرجاع للرقابة المالية.',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const itemsToSubmit: NewReturnItemInput[] = [];

      selectedReturnItems.forEach((val, prodId) => {
        if (val.qty > 0) {
          itemsToSubmit.push({
            product_id: prodId,
            quantity_returned: val.qty,
            refund_unit_price: val.refundPrice,
            restock_condition: val.condition,
          });
        }
      });

      const nextReturnNum = await returnsService.generateNextReturnNumber();

      await returnsService.createReturn({
        return_number: nextReturnNum,
        invoice_id: foundInvoice.id,
        return_date: new Date().toISOString().substring(0, 10),
        reason: returnReason.trim(),
        refund_amount: totalCalculatedRefund,
        refund_method: refundMethod,
        items: itemsToSubmit,
      });

      showNotification({
        type: 'success',
        title: 'تم تسجيل حركة الإرجاع بنجاح',
        message: `تم توثيق المرتجع (${nextReturnNum}) واسترجاع الأصناف السليمة إلى المخزون.`,
      });

      // Reset
      setFoundInvoice(null);
      setInvoiceItems([]);
      setReturnReason('');
      setInvoiceSearchQuery('');
      await loadReturns();
    } catch (err: any) {
      showNotification({
        type: 'error',
        title: 'فشل إتمام الإرجاع',
        message: err.message || 'حدث خطأ أثناء حفظ حركة الإرجاع',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open details modal
  const handleOpenReturnModal = async (ret: ReturnRecord) => {
    setViewingReturn(ret);
    setIsLoadingReturnItems(true);
    try {
      const items = await returnsService.getReturnItems(ret.id);
      setViewingReturnItems(items);
    } catch (err) {
      console.warn('Failed to load return items:', err);
    } finally {
      setIsLoadingReturnItems(false);
    }
  };

  const columns: Column<ReturnRecord>[] = [
    {
      key: 'return_number',
      header: 'رقم المرتجع',
      render: (r: ReturnRecord) => (
        <span className="font-mono text-xs font-medium text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200/70 tabular-nums">
          {r.return_number}
        </span>
      ),
    },
    {
      key: 'invoice_number',
      header: 'الفاتورة الأصلية',
      render: (r: ReturnRecord) => (
        <span className="font-mono text-xs font-medium text-slate-900 tabular-nums flex items-center gap-1">
          <Receipt className="w-3.5 h-3.5 text-slate-400" />
          <span>{r.invoice_number}</span>
        </span>
      ),
    },
    {
      key: 'return_date',
      header: 'تاريخ الإرجاع',
      render: (r: ReturnRecord) => (
        <span className="font-mono text-slate-600 text-xs tabular-nums">{r.return_date}</span>
      ),
    },
    {
      key: 'refund_amount',
      header: 'المبلغ المسترد',
      render: (r: ReturnRecord) => (
        <span className="font-mono font-semibold text-rose-700 text-xs tabular-nums">
          {formatCurrency(r.refund_amount)}
        </span>
      ),
    },
    {
      key: 'refund_method',
      header: 'طريقة الرد',
      render: (r: ReturnRecord) => (
        <Badge variant="default" size="sm">
          {r.refund_method}
        </Badge>
      ),
    },
    {
      key: 'reason',
      header: 'سبب الإرجاع',
      render: (r: ReturnRecord) => (
        <span className="text-xs text-slate-700 truncate max-w-xs block">{r.reason}</span>
      ),
    },
    {
      key: 'actions',
      header: 'معاينة',
      align: 'center',
      render: (r: ReturnRecord) => (
        <Button
          size="sm"
          variant="outline"
          onClick={() => handleOpenReturnModal(r)}
          leftIcon={<Eye className="w-3.5 h-3.5" />}
          className="h-7 text-xs px-2"
        >
          تفاصيل
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="المرتجعات وإلغاء العمليات"
        subtitle="معالجة استرجاع الأصناف وإلغاء الفواتير بحركات عكسية آمنة دون حذف السجلات المالية"
      />

      {/* Financial Protection Notice */}
      <Alert
        type="warning"
        title="قاعدة الحفاظ على السجلات المالية والأثر التدقيقي (Rule 8 & 9)"
        message="لا يتم حذف أي فاتورة مبيعات سابقة مطلقاً. يتم تسجيل حركة إرجاع منفصلة بحسابات عكسية، ويُعاد الصنف للمخزون إذا كان بحالة سليمة، مع توثيق الحركة في سجل المخزون والتدقيق المالي."
      />

      {/* Invoice Lookup & Process Return Card */}
      <Card className="p-3.5 space-y-3.5">
        <div>
          <h3 className="text-xs font-semibold text-slate-900 mb-0.5">
            بدء حركة إرجاع: البحث برقم الفاتورة الأصلية
          </h3>
          <p className="text-xs text-slate-500">
            أدخل رقم الفاتورة الأصلية (مثال: INV-2024-001) لعرض أصنافها واختيار ما سيتم إرجاعه
          </p>
        </div>

        <div className="flex gap-2">
          <div className="flex-1">
            <Input
              placeholder="اكتب رقم الفاتورة أو جزء منه..."
              value={invoiceSearchQuery}
              onChange={e => setInvoiceSearchQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearchInvoice()}
              leftIcon={<Search className="w-3.5 h-3.5" />}
              isMonospace
            />
          </div>
          <Button
            variant="primary"
            onClick={handleSearchInvoice}
            disabled={isSearchingInvoice || !invoiceSearchQuery.trim()}
            leftIcon={isSearchingInvoice ? <Spinner size="sm" /> : <Search className="w-3.5 h-3.5" />}
          >
            بحث عن الفاتورة
          </Button>
        </div>

        {/* Found Invoice Return Processing Box */}
        {foundInvoice && (
          <div className="mt-3.5 pt-3.5 border-t border-slate-200/90 space-y-3.5 bg-slate-50/70 p-3.5 rounded-lg border">
            {/* Invoice Meta Summary */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 bg-white p-3 rounded-md border border-slate-200 text-xs">
              <div>
                <span className="text-slate-500 block">رقم الفاتورة:</span>
                <span className="font-mono font-medium text-slate-900 text-xs tabular-nums">
                  {foundInvoice.invoice_number}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">تاريخ الفاتورة:</span>
                <span className="font-mono text-slate-800 tabular-nums">{foundInvoice.invoice_date}</span>
              </div>
              <div>
                <span className="text-slate-500 block">العميل:</span>
                <span className="font-medium text-slate-800">
                  {foundInvoice.customer_name || 'عميل نقدي'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">إجمالي الفاتورة:</span>
                <span className="font-mono font-semibold text-slate-900 tabular-nums">
                  {formatCurrency(foundInvoice.total_amount)}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">حالة الفاتورة:</span>
                <Badge
                  variant={
                    foundInvoice.status === 'COMPLETED'
                      ? 'success'
                      : foundInvoice.status === 'RETURNED_PARTIAL'
                      ? 'warning'
                      : 'danger'
                  }
                  size="sm"
                >
                  {foundInvoice.status === 'COMPLETED'
                    ? 'مكتملة بالكامل'
                    : foundInvoice.status === 'RETURNED_PARTIAL'
                    ? 'مرتجع جزئي'
                    : 'مرتجع كامل'}
                </Badge>
              </div>
            </div>

            {/* Line Items to Return */}
            <div>
              <h4 className="text-xs font-semibold text-slate-800 mb-1.5">
                حدد الأصناف والكميات المراد استرجاعها وحالتها المخزنية:
              </h4>

              <div className="border border-slate-200 rounded-md overflow-hidden bg-white">
                <table className="w-full text-xs text-right">
                  <thead className="bg-slate-50 font-medium text-slate-600 border-b border-slate-200 select-none">
                    <tr>
                      <th className="py-2 px-3">الصنف</th>
                      <th className="py-2 px-3 text-center">الكمية المباعة</th>
                      <th className="py-2 px-3 text-center">سعر البيع الفعلي</th>
                      <th className="py-2 px-3 text-center w-32">الكمية المرتجعة</th>
                      <th className="py-2 px-3 text-center w-36">الحالة المخزنية</th>
                      <th className="py-2 px-3 text-left w-28">المسترد</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {invoiceItems.map(item => {
                      const state = selectedReturnItems.get(item.product_id) || {
                        qty: 0,
                        refundPrice: item.actual_price,
                        condition: 'RESTOCKED',
                      };

                      return (
                        <tr
                          key={item.id}
                          className={state.qty > 0 ? 'bg-rose-50/40' : 'hover:bg-slate-50/60'}
                        >
                          <td className="py-2 px-3">
                            <p className="font-medium text-slate-900">{item.product_name}</p>
                            <p className="text-[10px] text-slate-400 font-mono tabular-nums">
                              {item.product_code}
                            </p>
                          </td>
                          <td className="py-2 px-3 text-center font-medium font-mono text-slate-700 tabular-nums">
                            {item.quantity}
                          </td>
                          <td className="py-2 px-3 text-center font-mono tabular-nums">
                            {formatCurrency(item.actual_price)}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <input
                                type="number"
                                min="0"
                                max={item.quantity}
                                value={state.qty}
                                onChange={e => {
                                  const val = parseInt(e.target.value, 10) || 0;
                                  const clamped = Math.max(0, Math.min(item.quantity, val));
                                  handleItemReturnChange(item.product_id, { qty: clamped });
                                }}
                                className="w-14 text-center font-medium text-xs py-1 border border-slate-200 rounded focus:border-slate-800 focus:outline-none font-mono tabular-nums"
                              />
                              <span className="text-[10px] text-slate-400 tabular-nums">/ {item.quantity}</span>
                            </div>
                          </td>
                          <td className="py-2 px-3 text-center">
                            <select
                              value={state.condition}
                              disabled={state.qty === 0}
                              onChange={e =>
                                handleItemReturnChange(item.product_id, {
                                  condition: e.target.value as 'RESTOCKED' | 'DAMAGED',
                                })
                              }
                              className="text-xs py-1 px-1.5 border border-slate-200 rounded bg-white text-slate-700 focus:outline-none disabled:opacity-40"
                            >
                              <option value="RESTOCKED">سليم ويُعاد للمخزن</option>
                              <option value="DAMAGED">تالف ولا يُعاد للمخزن</option>
                            </select>
                          </td>
                          <td className="py-2 px-3 text-left font-mono font-medium text-rose-700 tabular-nums">
                            {state.qty > 0 ? formatCurrency(state.qty * state.refundPrice) : '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Return Reason, Refund Method & Notes */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
              <div className="md:col-span-2">
                <Input
                  label="سبب الإرجاع * (إلزامي للرقابة المالية):"
                  placeholder="مثال: عيب صناعة تم فحصه، أو عدم ملاءمة للموديل..."
                  value={returnReason}
                  onChange={e => setReturnReason(e.target.value)}
                />
              </div>

              <div>
                <Select
                  label="طريقة رد المبلغ:"
                  value={refundMethod}
                  onChange={e => setRefundMethod(e.target.value)}
                >
                  <option value="نقدي">نقدي (كاش من الدرج)</option>
                  <option value="بطاقة / فيزا">بطاقة / فيزا</option>
                  <option value="تحويل بنكي / محفظة">تحويل بنكي / فودافون كاش</option>
                  <option value="رصيد عميل">رصيد عميل / آجل</option>
                </Select>
              </div>
            </div>

            {/* Actions & Summary Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2.5 border-t border-slate-200">
              <div className="flex items-center gap-2.5 text-xs">
                <span className="text-slate-600">إجمالي المبلغ المسترد:</span>
                <span className="font-mono font-semibold text-rose-700 text-sm tabular-nums">
                  {formatCurrency(totalCalculatedRefund)}
                </span>
                <span className="text-slate-400 tabular-nums">({activeReturnCount} أصناف محددة)</span>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setFoundInvoice(null);
                    setInvoiceItems([]);
                  }}
                >
                  إلغاء
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  disabled={activeReturnCount === 0 || !returnReason.trim() || isSubmitting}
                  onClick={handleSubmitReturn}
                  leftIcon={
                    isSubmitting ? <Spinner size="sm" /> : <RotateCcw className="w-3.5 h-3.5" />
                  }
                >
                  {isSubmitting
                    ? 'جارٍ تسجيل المرتجع...'
                    : `تأكيد حركة الإرجاع (${formatCurrency(totalCalculatedRefund)})`}
                </Button>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Returns History Archive */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-slate-800">سجل حركات الإرجاع السابقة</h3>
          <span className="text-xs text-slate-500 tabular-nums">{returnsList.length} حركات مسجلة</span>
        </div>

        {isLoadingReturns ? (
          <div className="p-12 flex flex-col items-center justify-center bg-white rounded-xl border border-slate-200">
            <Spinner size="md" />
            <p className="text-xs text-slate-500 mt-2">جارٍ جلب سجل المرتجعات...</p>
          </div>
        ) : returnsList.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-xl border border-slate-200 space-y-1.5">
            <RotateCcw className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-xs font-medium text-slate-700">لا توجد حركات إرجاع مسجلة</p>
            <p className="text-[11px] text-slate-400">
              جميع عمليات البيع سليمة، أو لم يتم تسجيل أي مرتجع بعد.
            </p>
          </div>
        ) : (
          <Table
            columns={columns}
            data={returnsList}
            keyExtractor={(item: ReturnRecord) => item.id}
          />
        )}
      </div>

      {/* Return Details Preview Modal */}
      {viewingReturn && (
        <Modal
          isOpen={!!viewingReturn}
          onClose={() => setViewingReturn(null)}
          title={`تفاصيل حركة الإرجاع: ${viewingReturn.return_number}`}
          subtitle={`مرتجع تابع لفاتورة المبيعات ${viewingReturn.invoice_number}`}
          footer={
            <Button variant="outline" size="sm" onClick={() => setViewingReturn(null)}>
              إغلاق
            </Button>
          }
        >
          <div className="space-y-3.5 text-xs">
            <div className="grid grid-cols-2 gap-2.5 bg-slate-50 p-3 rounded-lg border border-slate-200">
              <div>
                <span className="text-slate-500 block mb-0.5">رقم الفاتورة الأصلية:</span>
                <span className="font-mono font-medium text-slate-900 tabular-nums">
                  {viewingReturn.invoice_number}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block mb-0.5">تاريخ الإرجاع:</span>
                <span className="font-mono tabular-nums text-slate-700">{viewingReturn.return_date}</span>
              </div>
              <div>
                <span className="text-slate-500 block mb-0.5">المبلغ المسترد:</span>
                <span className="font-mono font-semibold text-rose-700 tabular-nums">
                  {formatCurrency(viewingReturn.refund_amount)}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block mb-0.5">طريقة الرد:</span>
                <span className="text-slate-700">{viewingReturn.refund_method}</span>
              </div>
              <div className="col-span-2 pt-1 border-t border-slate-200">
                <span className="text-slate-500 block mb-0.5">سبب الإرجاع:</span>
                <span className="font-medium text-slate-800">{viewingReturn.reason}</span>
              </div>
            </div>

            <div>
              <h5 className="text-xs font-semibold text-slate-700 mb-1.5">الأصناف المرتجعة:</h5>
              {isLoadingReturnItems ? (
                <div className="p-6 text-center">
                  <Spinner size="sm" />
                </div>
              ) : (
                <div className="border border-slate-200 rounded-md overflow-hidden">
                  <table className="w-full text-xs text-right">
                    <thead className="bg-slate-50 font-medium text-slate-600 border-b border-slate-200 select-none">
                      <tr>
                        <th className="py-2 px-3">الصنف</th>
                        <th className="py-2 px-3 text-center">الكمية</th>
                        <th className="py-2 px-3 text-center">سعر الاسترداد</th>
                        <th className="py-2 px-3 text-center">الحالة</th>
                        <th className="py-2 px-3 text-left">الإجمالي</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {viewingReturnItems.map(item => (
                        <tr key={item.id} className="hover:bg-slate-50/60">
                          <td className="py-2 px-3 font-medium text-slate-900">{item.product_name}</td>
                          <td className="py-2 px-3 text-center font-mono tabular-nums">
                            {item.quantity_returned}
                          </td>
                          <td className="py-2 px-3 text-center font-mono tabular-nums">
                            {formatCurrency(item.refund_unit_price)}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <Badge
                              variant={item.restock_condition === 'RESTOCKED' ? 'success' : 'danger'}
                              size="sm"
                            >
                              {item.restock_condition === 'RESTOCKED' ? 'أُعيد للمخزن' : 'تالف'}
                            </Badge>
                          </td>
                          <td className="py-2 px-3 text-left font-mono font-medium text-rose-700 tabular-nums">
                            {formatCurrency(item.line_refund_total)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
