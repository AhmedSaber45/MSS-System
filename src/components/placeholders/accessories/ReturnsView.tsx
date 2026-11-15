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
  RefreshCw,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { useNotification } from '@/context/NotificationContext';
import { usePageRefresh } from '@/context/PageRefreshContext';
import { DateRangeInputs } from '@/components/common/DateRangeInputs';
import { useDateRangeFilter, getTodayLocalDateString } from '@/lib/dateValidation';
import { salesService } from '@/services/salesService.ts';
import { returnsService } from '@/services/returnsService.ts';
import type { Invoice, InvoiceItem } from '@/types/sale.ts';
import type { ReturnRecord, ReturnItemRecord, NewReturnItemInput } from '@/types/returns.ts';

export const ReturnsView: React.FC = () => {
  const { showNotification } = useNotification();
  const { isRefreshing, triggerRefresh } = usePageRefresh();

  // Returns archive list
  const [returnsList, setReturnsList] = useState<ReturnRecord[]>([]);
  const [isLoadingReturns, setIsLoadingReturns] = useState<boolean>(true);
  const [filterQuery, setFilterQuery] = useState<string>('');

  // Date range filter for returns archive
  const dateFilter = useDateRangeFilter();

  // Invoice Lookup state
  const [invoiceSearchQuery, setInvoiceSearchQuery] = useState<string>('');
  const [isSearchingInvoice, setIsSearchingInvoice] = useState<boolean>(false);
  const [foundInvoice, setFoundInvoice] = useState<Invoice | null>(null);
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([]);
  const [returnSummary, setReturnSummary] = useState<Awaited<ReturnType<typeof returnsService.getInvoiceReturnSummary>> | null>(null);

  // Active Return Form State
  const [selectedReturnItems, setSelectedReturnItems] = useState<
    Map<string, { qty: number; refundPrice: number; condition: 'RESTOCKED' | 'DAMAGED'; remaining?: number }>
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
      const data = await returnsService.getReturns({
        invoiceQuery: filterQuery,
        startDate: dateFilter.startDate || undefined,
        endDate: dateFilter.endDate || undefined,
      });
      setReturnsList(data);
    } catch (err: any) {
      console.warn('Failed to load returns:', err);
      showNotification({
        type: 'error',
        title: 'خطأ في جلب المرتجعات',
        message: err?.message || 'تعذر تحميل سجل المرتجعات من قاعدة البيانات',
      });
    } finally {
      setIsLoadingReturns(false);
    }
  }, [filterQuery, dateFilter.startDate, dateFilter.endDate, showNotification]);

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
        setReturnSummary(null);
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

      const summary = await returnsService.getInvoiceReturnSummary(matched.id);
      setReturnSummary(summary);

      // Initialize selected return items map
      const initialMap = new Map();
      summary.itemSummaries.forEach(item => {
        initialMap.set(item.productId, {
          qty: 0,
          refundPrice: item.actualUnitPrice,
          condition: 'RESTOCKED',
          remaining: item.remainingReturnableQuantity,
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
        return_date: getTodayLocalDateString(),
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
      setReturnSummary(null);
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
        <span className="font-mono text-sm font-bold text-slate-900 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-300 tabular-nums">
          {r.return_number}
        </span>
      ),
    },
    {
      key: 'invoice_number',
      header: 'الفاتورة الأصلية',
      render: (r: ReturnRecord) => (
        <span className="font-mono text-sm font-bold text-slate-900 tabular-nums flex items-center gap-1.5">
          <Receipt className="w-4 h-4 text-slate-500" />
          <span>{r.invoice_number}</span>
        </span>
      ),
    },
    {
      key: 'return_date',
      header: 'تاريخ الإرجاع',
      render: (r: ReturnRecord) => (
        <span className="font-mono text-slate-700 text-sm font-medium tabular-nums">{r.return_date}</span>
      ),
    },
    {
      key: 'refund_amount',
      header: 'المبلغ المسترد',
      render: (r: ReturnRecord) => (
        <span className="font-mono font-bold text-rose-700 text-sm tabular-nums">
          {formatCurrency(r.refund_amount)}
        </span>
      ),
    },
    {
      key: 'refund_method',
      header: 'طريقة الرد',
      render: (r: ReturnRecord) => (
        <Badge variant="default" size="sm" className="font-semibold">
          {r.refund_method}
        </Badge>
      ),
    },
    {
      key: 'reason',
      header: 'سبب الإرجاع',
      render: (r: ReturnRecord) => (
        <span className="text-sm font-medium text-slate-800 truncate max-w-xs block">{r.reason}</span>
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
          leftIcon={<Eye className="w-4 h-4" />}
          className="h-8 text-xs font-bold px-3 border-slate-300 text-slate-800"
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
        subtitle=""
        actions={
          <Button
            variant="outline"
            size="md"
            onClick={() => triggerRefresh(loadReturns, 'جارٍ تحديث سجل المرتجعات...')}
            disabled={isRefreshing || isLoadingReturns}
            leftIcon={<RefreshCw className={`w-4 h-4 text-slate-600 ${isRefreshing ? 'animate-spin' : ''}`} />}
            className="border-slate-300 text-slate-800 font-semibold"
          >
            Refresh
          </Button>
        }
      />



      {/* Invoice Lookup & Process Return Card */}
      <Card className="p-4 border-slate-300 space-y-3.5">
        <div>
          <h3 className="text-sm font-bold text-slate-900 mb-0.5">
            بدء حركة إرجاع: البحث برقم الفاتورة الأصلية
          </h3>
          <p className="text-xs text-slate-500">
            أدخل رقم الفاتورة الأصلية (مثال: INV-2024-001) لعرض أصنافها واختيار ما سيتم إرجاعه
          </p>
        </div>

        <div className="flex gap-2.5">
          <div className="flex-1">
            <Input
              
              placeholder="اكتب رقم الفاتورة..."
              value={invoiceSearchQuery}
              onChange={e => setInvoiceSearchQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearchInvoice()}
              leftIcon={<Search className="w-4.5 h-4.5 text-slate-500" />}
              isMonospace
              className='text-right'
            />
          </div>
          <Button
            variant="primary"
            size="md"
            onClick={handleSearchInvoice}
            disabled={isSearchingInvoice || !invoiceSearchQuery.trim()}
            leftIcon={isSearchingInvoice ? <Spinner size="sm" /> : <Search className="w-4.5 h-4.5" />}
            className="font-bold"
          >
            بحث عن الفاتورة
          </Button>
        </div>

        {/* Found Invoice Return Processing Box */}
        {foundInvoice && (
          <div className="mt-4 pt-4 border-t border-slate-200 space-y-4 bg-slate-50/90 p-4 rounded-xl border border-slate-300">
            {/* Invoice Meta Summary */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-300 text-sm">
              <div>
                <span className="text-slate-500 block text-xs font-semibold mb-0.5">رقم الفاتورة:</span>
                <span className="font-mono font-bold text-slate-900 tabular-nums">
                  {foundInvoice.invoice_number}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-xs font-semibold mb-0.5">تاريخ الفاتورة:</span>
                <span className="font-mono text-slate-800 font-semibold tabular-nums">{foundInvoice.invoice_date}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-xs font-semibold mb-0.5">العميل:</span>
                <span className="font-bold text-slate-900">
                  {foundInvoice.customer_name || 'عميل نقدي'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-xs font-semibold mb-0.5">إجمالي الفاتورة:</span>
                <span className="font-mono font-bold text-slate-900 tabular-nums">
                  {formatCurrency(foundInvoice.total_amount)}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-xs font-semibold mb-0.5">حالة الفاتورة:</span>
                <Badge
                  variant={
                    foundInvoice.status === 'COMPLETED'
                      ? 'success'
                      : foundInvoice.status === 'RETURNED_PARTIAL'
                        ? 'warning'
                        : 'danger'
                  }
                  size="sm"
                  className="font-semibold"
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
              <h4 className="text-sm font-bold text-slate-900 mb-2">
                حدد الأصناف والكميات المراد استرجاعها وحالتها المخزنية:
              </h4>

              <div className="border border-slate-300 rounded-xl overflow-hidden bg-white">
                <table className="w-full text-sm text-right">
                  <thead className="bg-slate-100 font-bold text-slate-700 border-b border-slate-300 select-none">
                    <tr>
                      <th className="py-2.5 px-3.5">الصنف</th>
                      <th className="py-2.5 px-3.5 text-center">الكمية المباعة</th>
                      <th className="py-2.5 px-3.5 text-center">مسترجع سابقاً</th>
                      <th className="py-2.5 px-3.5 text-center">المتبقي للإرجاع</th>
                      <th className="py-2.5 px-3.5 text-center">سعر البيع الفعلي</th>
                      <th className="py-2.5 px-3.5 text-center w-36">الكمية المرتجعة</th>
                      <th className="py-2.5 px-3.5 text-center w-44">الحالة المخزنية</th>
                      <th className="py-2.5 px-3.5 text-left w-32">المسترد</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {invoiceItems.map(item => {
                      const summaryItem = returnSummary?.itemSummaries.find(
                        s => s.productId === item.product_id
                      );
                      const remainingQty = summaryItem ? summaryItem.remainingReturnableQuantity : item.quantity;
                      const prevReturnedQty = summaryItem ? summaryItem.previouslyReturnedQuantity : 0;

                      const state = selectedReturnItems.get(item.product_id) || {
                        qty: 0,
                        refundPrice: item.actual_price,
                        condition: 'RESTOCKED',
                      };

                      const isItemFullyReturned = remainingQty === 0;

                      return (
                        <tr
                          key={item.id}
                          className={
                            isItemFullyReturned
                              ? 'bg-slate-50/70 opacity-60'
                              : state.qty > 0
                              ? 'bg-rose-50/60'
                              : 'hover:bg-slate-50/80'
                          }
                        >
                          <td className="py-2.5 px-3.5">
                            <p className="font-bold text-slate-900">{item.product_name}</p>
                            <p className="text-xs text-slate-500 font-mono font-semibold tabular-nums mt-0.5">
                              {item.product_code}
                            </p>
                          </td>
                          <td className="py-2.5 px-3.5 text-center font-bold font-mono text-slate-800 tabular-nums">
                            {item.quantity}
                          </td>
                          <td className="py-2.5 px-3.5 text-center font-mono font-semibold text-slate-500 tabular-nums">
                            {prevReturnedQty > 0 ? (
                              <span className="text-amber-700 font-bold">{prevReturnedQty}</span>
                            ) : (
                              '0'
                            )}
                          </td>
                          <td className="py-2.5 px-3.5 text-center font-mono font-bold tabular-nums">
                            {isItemFullyReturned ? (
                              <Badge variant="default" size="sm">
                                0 (مسترجع بالكامل)
                              </Badge>
                            ) : (
                              <span className="text-emerald-700">{remainingQty}</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3.5 text-center font-mono font-semibold tabular-nums">
                            {formatCurrency(item.actual_price)}
                          </td>
                          <td className="py-2.5 px-3.5 text-center">
                            {isItemFullyReturned ? (
                              <span className="text-xs font-semibold text-slate-400 select-none">لا يوجد متبقٍ</span>
                            ) : (
                              <div className="flex items-center justify-center gap-1.5">
                                <input
                                  type="number"
                                  min="0"
                                  max={remainingQty}
                                  value={state.qty}
                                  onChange={e => {
                                    const val = parseInt(e.target.value, 10) || 0;
                                    const clamped = Math.max(0, Math.min(remainingQty, val));
                                    handleItemReturnChange(item.product_id, { qty: clamped });
                                  }}
                                  className="w-16 text-center font-bold text-sm py-1 border border-slate-300 rounded-lg focus:border-slate-800 focus:outline-none font-mono tabular-nums"
                                />
                                <span className="text-xs font-semibold text-slate-500 tabular-nums">
                                  / {remainingQty}
                                </span>
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-3.5 text-center">
                            <select
                              value={state.condition}
                              disabled={isItemFullyReturned || state.qty === 0}
                              onChange={e =>
                                handleItemReturnChange(item.product_id, {
                                  condition: e.target.value as 'RESTOCKED' | 'DAMAGED',
                                })
                              }
                              className="text-xs font-semibold py-1.5 px-2 border border-slate-300 rounded-lg bg-white text-slate-800 focus:outline-none disabled:opacity-40"
                            >
                              <option value="RESTOCKED">سليم ويُعاد للمخزن</option>
                              <option value="DAMAGED">تالف ولا يُعاد للمخزن</option>
                            </select>
                          </td>
                          <td className="py-2.5 px-3.5 text-left font-mono font-bold text-rose-700 tabular-nums">
                            {formatCurrency(state.qty * item.actual_price)}
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
                  <option value="نقدي">نقدي </option>
                  <option value="فيزا">  فيزا</option>
                  <option value="انستا باى / فودافون كاش">انستا باى  / فودافون كاش</option>
                  <option value="رصيد عميل">   آجل</option>
                </Select>
              </div>
            </div>

            {/* Actions & Summary Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-300">
              <div className="flex items-center gap-2.5 text-sm">
                <span className="text-slate-700 font-medium">إجمالي المبلغ المسترد:</span>
                <span className="font-mono font-bold text-rose-700 text-base tabular-nums">
                  {formatCurrency(totalCalculatedRefund)}
                </span>
                <span className="text-slate-500 font-semibold tabular-nums">({activeReturnCount} أصناف محددة)</span>
              </div>

              <div className="flex items-center gap-2.5">
                <Button
                  variant="outline"
                  size="md"
                  onClick={() => {
                    setFoundInvoice(null);
                    setInvoiceItems([]);
                  }}
                  className="border-slate-300 font-semibold"
                >
                  إلغاء
                </Button>
                <Button
                  variant="danger"
                  size="md"
                  disabled={activeReturnCount === 0 || !returnReason.trim() || isSubmitting}
                  onClick={handleSubmitReturn}
                  leftIcon={
                    isSubmitting ? <Spinner size="sm" /> : <RotateCcw className="w-4 h-4" />
                  }
                  className="font-bold"
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

      {/* Archive Filter Bar */}
      <Card className="p-3.5 border-slate-300">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          <div className="md:col-span-5">
            <Input
              type="text"
              placeholder="ابحث برقم المرتجع، رقم الفاتورة، أو السبب..."
              value={filterQuery}
              onChange={e => setFilterQuery(e.target.value)}
              leftIcon={<Search className="w-4 h-4 text-slate-400" />}
            />
          </div>
          <div className="md:col-span-5">
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
          <div className="md:col-span-2 flex items-center justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setFilterQuery('');
                dateFilter.clearDateRange();
              }}
              className="w-full text-xs font-semibold"
            >
              إعادة ضبط الفلاتر
            </Button>
          </div>
        </div>
      </Card>

      {/* Returns History Archive */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">سجل حركات الإرجاع السابقة</h3>
          <span className="text-sm font-semibold text-slate-500 tabular-nums">{returnsList.length} حركات مسجلة</span>
        </div>

        {isLoadingReturns ? (
          <div className="p-16 flex flex-col items-center justify-center bg-white rounded-xl border border-slate-300">
            <Spinner size="md" />
            <p className="text-sm font-medium text-slate-600 mt-2.5">جارٍ جلب سجل المرتجعات...</p>
          </div>
        ) : returnsList.length === 0 ? (
          <div className="p-16 text-center bg-white rounded-xl border border-slate-300 space-y-2">
            <RotateCcw className="w-10 h-10 text-slate-400 mx-auto" />
            <p className="text-sm font-bold text-slate-800">لا توجد حركات إرجاع مسجلة</p>
            <p className="text-xs text-slate-500">
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
            <Button variant="primary" size="md" onClick={() => setViewingReturn(null)} className="font-semibold">
              إغلاق
            </Button>
          }
        >
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3 bg-slate-50/90 p-4 rounded-xl border border-slate-300">
              <div>
                <span className="text-slate-500 block mb-1 text-xs font-semibold">رقم الفاتورة الأصلية:</span>
                <span className="font-mono font-bold text-slate-900 tabular-nums text-sm">
                  {viewingReturn.invoice_number}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block mb-1 text-xs font-semibold">تاريخ الإرجاع:</span>
                <span className="font-mono tabular-nums text-slate-800 font-semibold text-sm">{viewingReturn.return_date}</span>
              </div>
              <div>
                <span className="text-slate-500 block mb-1 text-xs font-semibold">المبلغ المسترد:</span>
                <span className="font-mono font-bold text-rose-700 tabular-nums text-sm">
                  {formatCurrency(viewingReturn.refund_amount)}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block mb-1 text-xs font-semibold">طريقة الرد:</span>
                <span className="text-slate-800 font-semibold">{viewingReturn.refund_method}</span>
              </div>
              <div className="col-span-2 pt-2 border-t border-slate-300">
                <span className="text-slate-500 block mb-1 text-xs font-semibold">سبب الإرجاع:</span>
                <span className="font-bold text-slate-900">{viewingReturn.reason}</span>
              </div>
            </div>

            <div>
              <h5 className="text-sm font-bold text-slate-900 mb-2">الأصناف المرتجعة:</h5>
              {isLoadingReturnItems ? (
                <div className="p-8 text-center">
                  <Spinner size="md" />
                </div>
              ) : (
                <div className="border border-slate-300 rounded-xl overflow-hidden">
                  <table className="w-full text-sm text-right">
                    <thead className="bg-slate-100 font-bold text-slate-700 border-b border-slate-300 select-none">
                      <tr>
                        <th className="py-2.5 px-3.5">الصنف</th>
                        <th className="py-2.5 px-3.5 text-center">الكمية</th>
                        <th className="py-2.5 px-3.5 text-center">سعر الاسترداد</th>
                        <th className="py-2.5 px-3.5 text-center">الحالة</th>
                        <th className="py-2.5 px-3.5 text-left">الإجمالي</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {viewingReturnItems.map(item => (
                        <tr key={item.id} className="hover:bg-slate-50/80">
                          <td className="py-2.5 px-3.5 font-bold text-slate-900">{item.product_name}</td>
                          <td className="py-2.5 px-3.5 text-center font-mono font-bold text-slate-900 tabular-nums">
                            {item.quantity_returned}
                          </td>
                          <td className="py-2.5 px-3.5 text-center font-mono font-semibold tabular-nums">
                            {formatCurrency(item.refund_unit_price)}
                          </td>
                          <td className="py-2.5 px-3.5 text-center">
                            <Badge
                              variant={item.restock_condition === 'RESTOCKED' ? 'success' : 'danger'}
                              size="sm"
                              className="font-semibold"
                            >
                              {item.restock_condition === 'RESTOCKED' ? 'أُعيد للمخزن' : 'تالف'}
                            </Badge>
                          </td>
                          <td className="py-2.5 px-3.5 text-left font-mono font-bold text-rose-700 tabular-nums">
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
