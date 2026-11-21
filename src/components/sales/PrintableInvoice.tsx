import React from 'react';
import type { Invoice, InvoiceItem } from '@/types/sale.ts';
import { formatCurrency } from '@/lib/utils';
import { Button } from '@/components/common/Button';
import { Printer, FileText, Receipt, FileDown, X } from 'lucide-react';
import { documentPrintService } from '@/lib/documentPrintService';
import { useNotification } from '@/context/NotificationContext';

interface PrintableInvoiceProps {
  invoice: Invoice;
  items: InvoiceItem[];
  format: 'a4' | 'thermal';
  onFormatChange?: (format: 'a4' | 'thermal') => void;
  onClose?: () => void;
}

export const PrintableInvoice: React.FC<PrintableInvoiceProps> = ({
  invoice,
  items,
  format,
  onFormatChange,
  onClose,
}) => {
  const { showNotification } = useNotification();

  const totalItemDiscounts = items.reduce(
    (sum, item) => sum + (item.discount || 0) * item.quantity,
    0
  );
  const totalSavings = totalItemDiscounts + (invoice.discount || 0);

  // Direct Print Now
  const handlePrint = async () => {
    const elementId = format === 'a4' ? 'printable-invoice-a4' : 'printable-invoice-thermal';
    await documentPrintService.printElement(elementId, {
      title: `فاتورة_${invoice.invoice_number}`,
      format: format,
    });
  };

  // Save / Export as PDF
  const handleSavePdf = async () => {
    const elementId = format === 'a4' ? 'printable-invoice-a4' : 'printable-invoice-thermal';
    try {
      await documentPrintService.exportToPdf(elementId, {
        title: `فاتورة_مبيعات_${invoice.invoice_number}`,
        format: format,
        exportType: 'accessories_invoices',
      });
      showNotification({
        type: 'success',
        title: 'حفظ الفاتورة بتنسيق PDF',
        message: 'تم حفظ وتحميل الفاتورة بتنسيق PDF بنجاح.',
      });
    } catch (err: any) {
      showNotification({
        type: 'error',
        title: 'فشل حفظ الفاتورة',
        message: err?.message || 'تعذر حفظ الفاتورة بتنسيق PDF.',
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* Controls Bar (Phase 2: A4, Thermal, Save as PDF, Print Now) */}
      <div className="no-print flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-300 shadow-2xs">
        {/* Format Selector: A4 vs Thermal Receipt */}
        <div className="flex items-center gap-3">
          <div className="inline-flex rounded-xl border border-slate-300 bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => onFormatChange?.('a4')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                format === 'a4'
                  ? 'bg-white text-slate-900 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText className="w-4 h-4 text-blue-600" />
              <span>فاتورة قياسية A4</span>
            </button>
            <button
              type="button"
              onClick={() => onFormatChange?.('thermal')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                format === 'thermal'
                  ? 'bg-white text-slate-900 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Receipt className="w-4 h-4 text-emerald-600" />
              <span>إيصال حراري (POS 80mm)</span>
            </button>
          </div>
        </div>

        {/* Action Buttons: Close, Save as PDF, Print Now */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {onClose && (
            <Button
              variant="outline"
              size="md"
              onClick={onClose}
              leftIcon={<X className="w-4.5 h-4.5" />}
              className="border-slate-300 font-semibold"
            >
              إغلاق
            </Button>
          )}

          <Button
            variant="outline"
            size="md"
            onClick={handleSavePdf}
            className="font-bold border-slate-300 hover:bg-slate-50 text-slate-800"
            leftIcon={<FileDown className="w-4.5 h-4.5 text-blue-600" />}
            title="حفظ الفاتورة كملف PDF على جهازك"
          >
            حفظ كـ PDF
          </Button>

          <Button
            variant="primary"
            size="md"
            onClick={handlePrint}
            className="font-bold shadow-xs"
            leftIcon={<Printer className="w-4.5 h-4.5" />}
            title="إرسال الفاتورة إلى الطابعة فوراً"
          >
            طباعة الفاتورة الآن
          </Button>
        </div>
      </div>

      {/* Printable Paper Canvas */}
      <div className="print-container overflow-x-auto bg-slate-100/75 p-6 rounded-xl flex justify-center border border-slate-300">
        {format === 'a4' ? (
          /* ========================================================
             A4 STANDARD FORMAL INVOICE LAYOUT
             ======================================================== */
          <div
            id="printable-invoice-a4"
            className="print-area w-full max-w-[210mm] bg-white p-8 sm:p-12 shadow-sm border border-slate-300 rounded-sm text-slate-900 space-y-6"
            dir="rtl"
            style={{ minHeight: 'auto', boxSizing: 'border-box' }}
          >
            {/* Header */}
            <div className="flex justify-between items-start border-b-2 border-slate-900 pb-5">
              <div>
                <h1 className="text-2xl font-bold text-slate-950 tracking-tight">SOUQ</h1>
                <p className="text-sm text-slate-600 mt-1">
                  بيع أجهزة وإكسسوارات الكمبيوتر والمحمول      
                </p>
                <div className="flex items-center gap-3 text-xs text-slate-500 mt-2">
                  <span>هاتف: 01099434534</span>
                  <span>•</span>
                  <span>العنوان: شبين القناطر كفرطحا الشارع الكبير أمام سوبر ماركت المدينة </span>
                </div>
              </div>
              <div className="text-left" dir="ltr">
   
                <p className="text-base font-bold text-slate-950 font-mono mt-2 tabular-nums">
                  {invoice.invoice_number}
                </p>
                <p className="text-xs text-slate-600 mt-0.5 font-mono tabular-nums">
                  التاريخ: {invoice.invoice_date}
                </p>
              </div>
            </div>

            {/* Bill To & Meta Info */}
            <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-300 text-sm print:bg-white print:border-slate-300">
              <div className="space-y-1.5">
                <span className="font-semibold text-slate-500 block uppercase tracking-wider text-xs">
                  بيانات العميل:
                </span>
                <p className="font-bold text-slate-900 text-sm">
                  {invoice.customer_name || 'عميل نقدي عام'}
                </p>
                {invoice.customer_phone && (
                  <p className="text-slate-600 font-mono text-xs tabular-nums">
                    الهاتف: {invoice.customer_phone}
                  </p>
                )}
              </div>
              <div className="space-y-1.5 text-left" dir="rtl">
                <span className="font-semibold text-slate-500 block uppercase tracking-wider text-xs">
                  معلومات السداد:
                </span>
                <p className="font-semibold text-slate-900 text-sm">
                  طريقة الدفع: <span className="text-slate-800">{invoice.payment_method}</span>
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-slate-600">نوع العملية:</span>
                  <span className="font-bold text-xs bg-slate-100 px-2 py-0.5 rounded border border-slate-300">
                    {invoice.payment_type === 'DEFERRED' ? 'بيع آجل / أقساط' : 'سداد كامل'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-600">حالة السداد:</span>
                  <span className={`font-bold text-xs px-2 py-0.5 rounded ${
                    invoice.payment_status === 'PAID'
                      ? 'bg-emerald-50 text-emerald-850 border border-emerald-300'
                      : invoice.payment_status === 'PARTIALLY_PAID'
                        ? 'bg-amber-100 text-amber-900'
                        : invoice.payment_status === 'OVERDUE'
                          ? 'bg-rose-100 text-rose-900'
                          : 'bg-slate-100 text-slate-800'
                  }`}>
                    {invoice.payment_status === 'PAID'
                      ? 'مسددة بالكامل'
                      : invoice.payment_status === 'PARTIALLY_PAID'
                        ? 'مسددة جزئياً'
                        : invoice.payment_status === 'OVERDUE'
                          ? 'مستحقة متأخرة'
                          : invoice.payment_status === 'UNPAID'
                            ? 'غير مسددة'
                            : 'مكتملة ومسددة'}
                  </span>
                </div>
              </div>
            </div>

            {/* Line Items Table with Repeated Header for Multi-page (Phase 3.D) */}
            <div className="border border-slate-300 rounded-xl overflow-hidden print:border-slate-400">
              <table className="w-full text-sm text-right">
                <thead
                  className="bg-slate-100 border-b border-slate-300 text-xs font-bold text-slate-700 print:bg-slate-100"
                  style={{ display: 'table-header-group' }}
                >
                  <tr>
                    <th className="py-3 px-3.5 w-12 text-center">#</th>
                    <th className="py-3 px-3.5">النوع / البيان</th>
                    <th className="py-3 px-3.5 w-28 text-center">الكود / التصنيف</th>
                    <th className="py-3 px-3.5 w-20 text-center">الكمية</th>
                    <th className="py-3 px-3.5 w-28 text-left">السعر</th>
                    <th className="py-3 px-3.5 w-24 text-left">الخصم</th>
                    <th className="py-3 px-3.5 w-28 text-left">الصافي</th>
                    <th className="py-3 px-3.5 w-32 text-left">الإجمالي</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {items.map((item, idx) => {
                    const isMaint = item.item_type === 'maintenance';
                    return (
                      <tr
                        key={item.id}
                        className={`hover:bg-slate-50/50 ${isMaint ? 'bg-amber-50/25' : ''}`}
                        style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}
                      >
                        <td className="py-2.5 px-3.5 text-center text-slate-500 font-mono text-xs tabular-nums">
                          {idx + 1}
                        </td>
                        <td className="py-2.5 px-3.5 font-bold text-slate-900">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {isMaint && (
                              <span className="px-1.5 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                صيانة
                              </span>
                            )}
                            <span>{item.product_name}</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3.5 text-center font-mono text-slate-600 text-xs">
                          {isMaint ? (
                            <span className="text-amber-800 font-bold text-[11px]">خدمة صيانة</span>
                          ) : (
                            item.product_code
                          )}
                        </td>
                        <td className="py-2.5 px-3.5 text-center font-mono font-bold text-slate-900 tabular-nums">
                          {item.quantity}
                        </td>
                        <td className="py-2.5 px-3.5 text-left font-mono text-slate-600 tabular-nums">
                          {formatCurrency(item.original_price)}
                        </td>
                        <td className="py-2.5 px-3.5 text-left font-mono font-semibold text-rose-600 tabular-nums">
                          {item.discount > 0 ? formatCurrency(item.discount) : '—'}
                        </td>
                        <td className="py-2.5 px-3.5 text-left font-mono font-bold text-slate-900 tabular-nums">
                          {formatCurrency(item.actual_price)}
                        </td>
                        <td className="py-2.5 px-3.5 text-left font-mono font-bold text-slate-950 tabular-nums">
                          {formatCurrency(item.line_total)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Totals & Notes Section (Avoid page breaks inside totals block) */}
            <div
              className="grid grid-cols-12 gap-6 items-start pt-2"
              style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}
            >
              <div className="col-span-7 space-y-3 text-sm">
                {invoice.notes && (
                  <div className="p-3.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 print:bg-white print:border-slate-300">
                    <span className="font-bold text-slate-900 block mb-1">ملاحظات الفاتورة:</span>
                    <p className="text-xs text-slate-600">{invoice.notes}</p>
                  </div>
                )}
                <div className="p-3.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-600 text-xs space-y-1.5 print:bg-white print:border-slate-300">
                  <p className="font-bold text-slate-900 text-sm">شروط الضمان والاسترجاع:</p>
                  <p>• البضاعة المباعة لا ترد ولكن تستبدل خلال 14 يوماً بحالتها الأصلية وفاتورة الشراء الأصلية.</p>
                  <p>• الضمان لا يشمل سوء الاستخدام أو الكسر أو التعرض للسوائل.</p>
                </div>
              </div>

              <div className="col-span-5 bg-slate-50 p-4 rounded-xl border border-slate-300 space-y-2.5 text-sm print:bg-white print:border-slate-300">
                <div className="flex justify-between text-slate-700 font-medium">
                  <span>المجموع الفرعي للأصناف:</span>
                  <span className="font-mono tabular-nums font-bold">
                    {formatCurrency(invoice.subtotal)}
                  </span>
                </div>

                {invoice.discount > 0 && (
                  <div className="flex justify-between text-rose-600 font-semibold">
                    <span>خصم إضافي على الفاتورة:</span>
                    <span className="font-mono tabular-nums font-bold">
                      - {formatCurrency(invoice.discount)}
                    </span>
                  </div>
                )}

                {/* Phase 3.C: Print-safe high-contrast customer savings box (replaces dark green background) */}
                {totalSavings > 0 && (
                  <div className="flex justify-between items-center bg-white p-2.5 rounded-lg border border-slate-300 text-xs print:border-slate-400">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-600 print:bg-slate-700"></span>
                      <span className="font-bold text-slate-800">إجمالي وفر العميل:</span>
                    </div>
                    <span className="font-mono font-bold text-emerald-800 print:text-slate-950 tabular-nums text-xs">
                      {formatCurrency(totalSavings)}
                    </span>
                  </div>
                )}

                <div className="border-t-2 border-slate-900 pt-3 flex justify-between text-base font-bold text-slate-950">
                  <span>إجمالي الفاتورة:</span>
                  <span className="font-mono text-lg tabular-nums">
                    {formatCurrency(invoice.total_amount)}
                  </span>
                </div>

                {invoice.payment_type === 'DEFERRED' && (
                  <div className="pt-2 border-t border-dashed border-slate-300 space-y-1.5 text-xs">
                    <div className="flex justify-between font-bold text-emerald-800">
                      <span>المسدد:</span>
                      <span className="font-mono tabular-nums">
                        {formatCurrency(invoice.paid_amount ?? invoice.total_amount)}
                      </span>
                    </div>
                    <div className="flex justify-between font-bold text-rose-800">
                      <span>المتبقي الآجل:</span>
                      <span className="font-mono tabular-nums">
                        {formatCurrency(invoice.remaining_balance ?? 0)}
                      </span>
                    </div>
                    {invoice.due_date && (
                      <div className="flex justify-between text-slate-600 font-medium">
                        <span>موعد القسط القادم:</span>
                        <span className="font-mono tabular-nums">{invoice.due_date}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Signatures & Footer (Phase 3.D: Avoid breaking signatures) */}
            <div
              className="pt-8 border-t border-slate-200 flex justify-between items-center text-sm text-slate-500 font-medium"
              style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}
            >
              <div>
                <p>توقيع المستلم: ___________________</p>
              </div>
              <div>
                <p>توقيع وختم المحل: ___________________</p>
              </div>
            </div>
          </div>
        ) : (
          /* ========================================================
             THERMAL RECEIPT (POS 80mm) LAYOUT (Phase 4)
             ======================================================== */
          <div
            id="printable-invoice-thermal"
            className="print-area w-[80mm] max-w-[80mm] bg-white p-4 shadow-sm border border-slate-200 rounded-sm font-mono text-slate-900 text-xs space-y-2.5"
            dir="rtl"
            style={{ minHeight: 'auto', boxSizing: 'border-box' }}
          >
            {/* Header */}
            <div className="text-center pb-2 border-b border-dashed border-slate-400 space-y-0.5">
              <h2 className="text-sm font-bold tracking-tight">SOUQ</h2>
              <p className="text-[11px] text-slate-700 font-semibold">إيصال استلام مبيعات</p>
              <p className="text-[10px] text-slate-600 tabular-nums">هاتف: 01000000000</p>
            </div>

            {/* Receipt Meta */}
            <div className="text-[11px] space-y-1 py-1.5 border-b border-dashed border-slate-400">
              <div className="flex justify-between">
                <span className="text-slate-600">رقم الفاتورة:</span>
                <span className="font-bold tabular-nums text-slate-900">{invoice.invoice_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">التاريخ:</span>
                <span className="tabular-nums text-slate-800">{invoice.invoice_date}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">العميل:</span>
                <span className="font-medium truncate max-w-[140px] text-slate-900">
                  {invoice.customer_name || 'نقدي عام'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">طريقة الدفع:</span>
                <span className="font-medium text-slate-900">{invoice.payment_method}</span>
              </div>
            </div>

            {/* Line Items Table */}
            <div className="py-1 space-y-1.5 border-b border-dashed border-slate-400 text-[11px]">
              <div className="flex justify-between font-bold text-slate-800 text-[10px] pb-1 border-b border-slate-200">
                <span>الصنف / السعر</span>
                <span>الإجمالي</span>
              </div>
              {items.map(item => {
                const isMaint = item.item_type === 'maintenance';
                return (
                  <div key={item.id} className="space-y-0.5" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {isMaint && (
                        <span className="text-[10px] font-bold text-amber-900 bg-amber-100 px-1 rounded border border-amber-300">
                          صيانة
                        </span>
                      )}
                      <p className="font-bold text-slate-900 leading-tight">{item.product_name}</p>
                    </div>
                    <div className="flex justify-between text-slate-600 text-[10px]">
                      <span className="tabular-nums">
                        {item.quantity} × {formatCurrency(item.actual_price)}
                        {item.discount > 0 && <span className="text-rose-600 font-semibold"> (وفر {item.discount})</span>}
                      </span>
                      <span className="font-bold text-slate-950 font-mono tabular-nums">
                        {formatCurrency(item.line_total)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Totals */}
            <div className="py-1.5 space-y-1 text-[11px]" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
              <div className="flex justify-between text-slate-600">
                <span>المجموع الفرعي:</span>
                <span className="font-mono tabular-nums font-medium">{formatCurrency(invoice.subtotal)}</span>
              </div>

              {invoice.discount > 0 && (
                <div className="flex justify-between text-rose-600 font-medium">
                  <span>الخصم الإضافي:</span>
                  <span className="font-mono tabular-nums">- {formatCurrency(invoice.discount)}</span>
                </div>
              )}

              {totalSavings > 0 && (
                <div className="flex justify-between text-slate-800 font-semibold text-[10px] bg-slate-50 py-0.5 px-1 border border-slate-200 rounded">
                  <span>إجمالي الوفر:</span>
                  <span className="font-mono tabular-nums">{formatCurrency(totalSavings)}</span>
                </div>
              )}

              <div className="flex justify-between text-xs font-bold text-slate-950 border-t-2 border-slate-900 pt-1.5 mt-1">
                <span>إجمالي الفاتورة:</span>
                <span className="font-mono text-sm tabular-nums">{formatCurrency(invoice.total_amount)}</span>
              </div>

              {invoice.payment_type === 'DEFERRED' && (
                <div className="pt-1 border-t border-dashed border-slate-300 space-y-0.5 text-[10px]">
                  <div className="flex justify-between font-bold text-emerald-800">
                    <span>المسدد:</span>
                    <span className="font-mono tabular-nums">{formatCurrency(invoice.paid_amount ?? invoice.total_amount)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-rose-800">
                    <span>المتبقي الآجل:</span>
                    <span className="font-mono tabular-nums">{formatCurrency(invoice.remaining_balance ?? 0)}</span>
                  </div>
                  {invoice.due_date && (
                    <div className="flex justify-between text-slate-600">
                      <span>الاستحقاق:</span>
                      <span className="font-mono tabular-nums">{invoice.due_date}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Thermal Footer */}
            <div
              className="pt-2 border-t border-dashed border-slate-400 text-center text-[10px] text-slate-600 space-y-0.5"
              style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}
            >
              {invoice.notes && <p className="italic text-slate-700">ملاحظة: {invoice.notes}</p>}
              <p className="font-bold text-slate-800">شكراً لزيارتكم ونسعد بخدمتكم دائماً</p>
              <p>الاستبدال خلال 14 يوماً مع الإيصال الأصلي</p>
              <p className="font-mono text-[9px] pt-0.5 text-slate-500">*** {invoice.invoice_number} ***</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
