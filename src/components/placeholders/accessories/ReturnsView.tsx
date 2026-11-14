import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/common/Card';
import { Table, Column } from '@/components/common/Table';
import { Alert } from '@/components/common/Alert';
import { Badge } from '@/components/common/Badge';
import { Modal } from '@/components/common/Modal';
import { Spinner } from '@/components/common/Spinner';
import {
  RotateCcw,
  Search,
  Receipt,
  CheckCircle,
  AlertTriangle,
  Eye,
  Plus,
  ShieldCheck,
  PackageCheck,
  PackageX,
  CreditCard,
  Banknote,
  Tag,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { useNotification } from '@/context/NotificationContext';
import { salesService } from '@/services/salesService.ts';
import { returnsService } from './../../../services/returnsService.ts';
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
  const [returnNotes, setReturnNotes] = useState<string>('');
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
          type: 'warning',
          title: 'لم يتم العثور على الفاتورة',
          message: `لا توجد فاتورة مبيعات مطابقة لـ "${q}"`,
        });
        return;
      }

      const items = await salesService.getInvoiceItems(matched.id);
      setFoundInvoice(matched);
      setInvoiceItems(items);

      // Initialize return map with default quantity 0
      const initialMap = new Map();
      items.forEach(item => {
        initialMap.set(item.product_id, {
          qty: 0,
          refundPrice: item.actual_price,
          condition: 'RESTOCKED',
        });
      });
      setSelectedReturnItems(initialMap);

      showNotification({
        type: 'info',
        title: 'تم العثور على الفاتورة',
        message: `فاتورة رقم ${matched.invoice_number} بقيمة ${formatCurrency(matched.total_amount)}`,
      });
    } catch (err: any) {
      showNotification({
        type: 'error',
        title: 'خطأ في جلب الفاتورة',
        message: err.message || 'تعذر البحث عن الفاتورة',
      });
    } finally {
      setIsSearchingInvoice(false);
    }
  };

  // Toggle or update return item selection
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

  // Calculate total refund
  const totalCalculatedRefund = useMemo(() => {
    let sum = 0;
    selectedReturnItems.forEach(item => {
      if (item.qty > 0) {
        sum += item.qty * item.refundPrice;
      }
    });
    return sum;
  }, [selectedReturnItems]);

  const activeReturnCount = useMemo(() => {
    let count = 0;
    selectedReturnItems.forEach(item => {
      if (item.qty > 0) count++;
    });
    return count;
  }, [selectedReturnItems]);

  // Submit return
  const handleSubmitReturn = async () => {
    if (!foundInvoice) return;
    if (isSubmitting) return;

    if (activeReturnCount === 0) {
      showNotification({
        type: 'warning',
        title: 'لم يتم تحديد أي أصناف',
        message: 'يرجى تحديد كمية صنف واحد على الأقل لإرجاعه.',
      });
      return;
    }

    if (!returnReason.trim()) {
      showNotification({
        type: 'warning',
        title: 'سبب الإرجاع مطلوب',
        message: 'يرجى كتابة سبب الإرجاع لتوثيق الحركة وتتبعها في السجلات المالية.',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const nextReturnNumber = await returnsService.generateNextReturnNumber();
      const returnItemsInput: NewReturnItemInput[] = [];

      selectedReturnItems.forEach((val, productId) => {
        if (val.qty > 0) {
          returnItemsInput.push({
            product_id: productId,
            quantity_returned: val.qty,
            refund_unit_price: val.refundPrice,
            restock_condition: val.condition,
          });
        }
      });

      const returnRecord = await returnsService.createReturn({
        return_number: nextReturnNumber,
        invoice_id: foundInvoice.id,
        return_date: new Date().toISOString().substring(0, 10),
        refund_amount: totalCalculatedRefund,
        refund_method: refundMethod,
        reason: returnReason.trim(),
        notes: returnNotes.trim() || undefined,
        items: returnItemsInput,
      });

      showNotification({
        type: 'success',
        title: 'تم تسجيل حركة المرتجع بنجاح',
        message: `تم إصدار إشعار مرتجع رقم ${returnRecord.return_number} بمبلغ ${formatCurrency(returnRecord.refund_amount)}`,
      });

      // Reset form and reload
      setFoundInvoice(null);
      setInvoiceItems([]);
      setSelectedReturnItems(new Map());
      setReturnReason('');
      setReturnNotes('');
      setInvoiceSearchQuery('');
      await loadReturns();
    } catch (err: any) {
      showNotification({
        type: 'error',
        title: 'فشل تسجيل حركة الإرجاع',
        message: err.message || 'حدث خطأ أثناء معالجة المرتجع',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open view return modal
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

  // Columns for Returns Archive Table
  const columns: Column<ReturnRecord>[] = [
    {
      key: 'return_number',
      header: 'رقم حركة الإرجاع',
      render: (r: ReturnRecord) => (
        <button
          type="button"
          onClick={() => handleOpenReturnModal(r)}
          className="font-mono font-bold text-rose-600 hover:text-rose-800 hover:underline flex items-center gap-1.5"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>{r.return_number}</span>
        </button>
      ),
    },
    {
      key: 'invoice_number',
      header: 'الفاتورة الأصلية',
      render: (r: ReturnRecord) => (
        <span className="font-mono text-blue-600 font-bold">{r.invoice_number}</span>
      ),
    },
    {
      key: 'return_date',
      header: 'تاريخ الإرجاع',
      render: (r: ReturnRecord) => (
        <span className="font-mono text-slate-500 text-xs">{r.return_date}</span>
      ),
    },
    {
      key: 'items_count',
      header: 'الأصناف',
      align: 'center',
      render: (r: ReturnRecord) => (
        <span className="text-xs font-semibold">{r.items_count} أصناف</span>
      ),
    },
    {
      key: 'refund_amount',
      header: 'المبلغ المسترد',
      render: (r: ReturnRecord) => (
        <span className="font-mono font-bold text-rose-600 text-xs">
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
        <span className="text-xs text-slate-700 line-clamp-1 max-w-xs">{r.reason}</span>
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
        >
          تفاصيل
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
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
      <Card className="border-blue-200 bg-white shadow-sm p-4 space-y-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900 mb-1">
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
              leftIcon={<Search className="w-4 h-4 text-blue-600" />}
              className="py-2 text-sm font-mono"
            />
          </div>
          <Button
            variant="primary"
            onClick={handleSearchInvoice}
            disabled={isSearchingInvoice || !invoiceSearchQuery.trim()}
            leftIcon={isSearchingInvoice ? <Spinner size="sm" /> : <Search className="w-4 h-4" />}
          >
            بحث عن الفاتورة
          </Button>
        </div>

        {/* Found Invoice Return Processing Box */}
        {foundInvoice && (
          <div className="mt-4 pt-4 border-t border-slate-200 space-y-4 bg-slate-50/70 p-4 rounded-xl border">
            {/* Invoice Meta Summary */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-lg border border-slate-200 text-xs">
              <div>
                <span className="text-slate-500 block">رقم الفاتورة:</span>
                <span className="font-mono font-bold text-blue-700 text-sm">
                  {foundInvoice.invoice_number}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">تاريخ الفاتورة:</span>
                <span className="font-mono text-slate-800">{foundInvoice.invoice_date}</span>
              </div>
              <div>
                <span className="text-slate-500 block">العميل:</span>
                <span className="font-bold text-slate-800">
                  {foundInvoice.customer_name || 'عميل نقدي'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">إجمالي الفاتورة:</span>
                <span className="font-mono font-bold text-slate-950">
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
              <h4 className="text-xs font-bold text-slate-800 mb-2">
                حدد الأصناف والكميات المراد استرجاعها وحالتها المخزنية:
              </h4>

              <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
                <table className="w-full text-xs text-right">
                  <thead className="bg-slate-100 font-bold text-slate-700 border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">الصنف</th>
                      <th className="py-2.5 px-3 text-center">الكمية المباعة</th>
                      <th className="py-2.5 px-3 text-center">سعر البيع الفعلي</th>
                      <th className="py-2.5 px-3 text-center w-32">الكمية المرتجعة</th>
                      <th className="py-2.5 px-3 text-center w-36">الحالة المخزنية</th>
                      <th className="py-2.5 px-3 text-left w-28">المسترد</th>
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
                          className={state.qty > 0 ? 'bg-rose-50/40' : 'hover:bg-slate-50'}
                        >
                          <td className="py-2.5 px-3">
                            <p className="font-bold text-slate-900">{item.product_name}</p>
                            <p className="text-[10px] text-slate-400 font-mono">
                              {item.product_code}
                            </p>
                          </td>
                          <td className="py-2.5 px-3 text-center font-bold text-slate-700">
                            {item.quantity}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono">
                            {formatCurrency(item.actual_price)}
                          </td>
                          <td className="py-2.5 px-3 text-center">
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
                                className="w-16 text-center font-bold text-xs py-1 border border-slate-300 rounded focus:border-rose-500 focus:outline-none"
                              />
                              <span className="text-[10px] text-slate-400">/ {item.quantity}</span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <select
                              value={state.condition}
                              disabled={state.qty === 0}
                              onChange={e =>
                                handleItemReturnChange(item.product_id, {
                                  condition: e.target.value as 'RESTOCKED' | 'DAMAGED',
                                })
                              }
                              className="text-[11px] py-1 px-1.5 border border-slate-300 rounded bg-white text-slate-700 focus:outline-none disabled:opacity-40"
                            >
                              <option value="RESTOCKED">سليم ويُعاد للمخزن</option>
                              <option value="DAMAGED">تالف ولا يُعاد للمخزن</option>
                            </select>
                          </td>
                          <td className="py-2.5 px-3 text-left font-mono font-bold text-rose-600">
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2">
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  سبب الإرجاع <span className="text-rose-500">* (إلزامي للرقابة المالية)</span>:
                </label>
                <Input
                  placeholder="مثال: عيب صناعة تم فحصه، أو عدم ملاءمة للموديل، أو طلب العميل إلغاء البيع..."
                  value={returnReason}
                  onChange={e => setReturnReason(e.target.value)}
                  className="py-1.5 text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  طريقة رد المبلغ:
                </label>
                <select
                  value={refundMethod}
                  onChange={e => setRefundMethod(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:border-blue-500"
                >
                  <option value="نقدي">نقدي (كاش من الدرج)</option>
                  <option value="بطاقة / فيزا">بطاقة / فيزا</option>
                  <option value="تحويل بنكي / محفظة">تحويل بنكي / فودافون كاش</option>
                  <option value="رصيد عميل">رصيد عميل / آجل</option>
                </select>
              </div>
            </div>

            {/* Actions & Summary Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200">
              <div className="flex items-center gap-3 text-xs">
                <span className="text-slate-600">إجمالي المبلغ المسترد للعميل:</span>
                <span className="font-mono font-black text-rose-600 text-base">
                  {formatCurrency(totalCalculatedRefund)}
                </span>
                <span className="text-slate-400">({activeReturnCount} أصناف محددة)</span>
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
                  variant="primary"
                  size="sm"
                  disabled={activeReturnCount === 0 || !returnReason.trim() || isSubmitting}
                  onClick={handleSubmitReturn}
                  className="bg-rose-600 hover:bg-rose-700 border-rose-700 font-bold"
                  leftIcon={
                    isSubmitting ? <Spinner size="sm" /> : <RotateCcw className="w-4 h-4" />
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
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">سجل حركات الإرجاع السابقة</h3>
          <span className="text-xs text-slate-500">{returnsList.length} حركات مسجلة</span>
        </div>

        {isLoadingReturns ? (
          <div className="p-12 flex flex-col items-center justify-center bg-white rounded-xl border border-slate-200">
            <Spinner size="md" />
            <p className="text-xs text-slate-500 mt-2">جارٍ جلب سجل المرتجعات...</p>
          </div>
        ) : returnsList.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-xl border border-slate-200 space-y-2">
            <RotateCcw className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-sm font-bold text-slate-700">لا توجد حركات إرجاع مسجلة</p>
            <p className="text-xs text-slate-400">
              جميع عمليات البيع سليمة، أو لم يتم تسجيل أي مرتجع بعد.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
            <Table
              columns={columns}
              data={returnsList}
              keyExtractor={(item: ReturnRecord) => item.id}
            />
          </div>
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
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs">
              <div>
                <span className="text-slate-500 block">رقم الفاتورة الأصلية:</span>
                <span className="font-mono font-bold text-blue-700">
                  {viewingReturn.invoice_number}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">تاريخ الإرجاع:</span>
                <span className="font-mono">{viewingReturn.return_date}</span>
              </div>
              <div>
                <span className="text-slate-500 block">المبلغ المسترد:</span>
                <span className="font-mono font-bold text-rose-600 text-sm">
                  {formatCurrency(viewingReturn.refund_amount)}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">طريقة الرد:</span>
                <span>{viewingReturn.refund_method}</span>
              </div>
              <div className="col-span-2 pt-1 border-t border-slate-200">
                <span className="text-slate-500 block">سبب الإرجاع:</span>
                <span className="font-medium text-slate-800">{viewingReturn.reason}</span>
              </div>
            </div>

            <div>
              <h5 className="text-xs font-bold text-slate-700 mb-2">الأصناف المرتجعة:</h5>
              {isLoadingReturnItems ? (
                <div className="p-6 text-center">
                  <Spinner size="sm" />
                </div>
              ) : (
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-xs text-right">
                    <thead className="bg-slate-100 font-bold text-slate-700 border-b border-slate-200">
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
                        <tr key={item.id}>
                          <td className="py-2 px-3 font-semibold">{item.product_name}</td>
                          <td className="py-2 px-3 text-center font-bold">
                            {item.quantity_returned}
                          </td>
                          <td className="py-2 px-3 text-center font-mono">
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
                          <td className="py-2 px-3 text-left font-mono font-bold text-rose-600">
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
