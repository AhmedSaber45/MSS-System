import React, { useState } from 'react';
import type { MSSInvoice, MSSInvoiceItem } from '@/types/mssCommerce';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Button } from '@/components/common/Button';
import { Printer, FileText, Receipt, FileDown, X, ZoomIn, ZoomOut } from 'lucide-react';
import { documentPrintService } from '@/lib/documentPrintService';
import { useNotification } from '@/context/NotificationContext';
import { formatArabicExportFilename } from '@/services/mssWholesaleExportService';

export interface MSSPrintableInvoiceProps {
  invoice: MSSInvoice;
  items?: MSSInvoiceItem[];
  format: 'a4' | 'thermal';
  onFormatChange?: (format: 'a4' | 'thermal') => void;
  onClose?: () => void;
}

export const MSSPrintableInvoice: React.FC<MSSPrintableInvoiceProps> = ({
  invoice,
  items: propItems,
  format,
  onFormatChange,
  onClose,
}) => {
  const { showNotification } = useNotification();
  const [zoomScale, setZoomScale] = useState<number>(85);

  // Ensure line items list is always populated
  const items: MSSInvoiceItem[] =
    propItems && propItems.length > 0
      ? propItems
      : invoice.items && invoice.items.length > 0
      ? invoice.items
      : [
          {
            id: 'item-default-' + invoice.id,
            invoice_id: invoice.id,
            device_id: invoice.device_id,
            model_id: invoice.model_id,
            serial_number: invoice.serial_number,
            is_serialized: Boolean(invoice.serial_number),
            quantity: 1,
            list_price_snapshot: invoice.list_price_snapshot,
            unit_price: invoice.list_price_snapshot,
            discount_amount: invoice.discount_amount || 0,
            actual_sale_price: invoice.actual_sale_price,
            cost_snapshot: invoice.cost_snapshot,
            gross_profit: invoice.gross_profit,
            source_branch: invoice.source_branch,
            brand: invoice.brand,
            model_name: invoice.model_name,
            category: invoice.category,
            processor: invoice.processor,
            gpu: invoice.gpu,
            ram: invoice.ram,
            storage: invoice.storage,
            screen_size: invoice.screen_size,
          },
        ];

  const totalListPrice = items.reduce(
    (sum, it) => sum + (it.list_price_snapshot || it.actual_sale_price),
    0
  );
  const totalItemDiscounts = items.reduce(
    (sum, it) => sum + (it.discount_amount || 0),
    0
  );
  const totalSavings = totalItemDiscounts + (invoice.discount_amount && items.length > 1 ? 0 : 0);

  // Direct Print
  const handlePrint = async () => {
    const elementId = format === 'a4' ? 'mss-printable-invoice-a4' : 'mss-printable-invoice-thermal';
    await documentPrintService.printElement(elementId, {
      title: formatArabicExportFilename(`فاتورة_${invoice.invoice_number}`),
      format,
    });
  };

  // Export as PDF
  const handleSavePdf = async () => {
    const elementId = format === 'a4' ? 'mss-printable-invoice-a4' : 'mss-printable-invoice-thermal';
    showNotification({
      type: 'info',
      title: 'تصدير الفاتورة بتنسيق PDF',
      message: 'تم فتح نافذة الطباعة. اختر "حفظ بتنسيق PDF" (Save as PDF) لحفظ الفاتورة بدقة عالية.',
    });
    await documentPrintService.exportToPdf(elementId, {
      title: formatArabicExportFilename(`فاتورة_${invoice.invoice_number}`, 'pdf'),
      format,
    });
  };

  return (
    <div className="space-y-4">
      {/* Controls Bar: A4, Thermal, Save as PDF, Print Now (Sticky for seamless scrolling) */}
      <div className="no-print sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 bg-white/95 backdrop-blur-xs p-3.5 sm:p-4 rounded-xl border border-slate-300 shadow-xs">
        {/* Format Selector & Zoom Controls */}
        <div className="flex items-center gap-3 flex-wrap">
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

          {/* Zoom Controls for A4 Preview */}
          {format === 'a4' && (
            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-300">
              <span className="text-[11px] font-semibold text-slate-500 px-1">معاينة:</span>
              <button
                type="button"
                onClick={() => setZoomScale(85)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  zoomScale === 85
                    ? 'bg-white text-blue-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="ملائمة عرض الصفحة بالكامل داخل النافذة"
              >
                ملائمة العرض (85%)
              </button>
              <button
                type="button"
                onClick={() => setZoomScale(100)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  zoomScale === 100
                    ? 'bg-white text-blue-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="حجم أصلي 100%"
              >
                100%
              </button>
              <div className="flex items-center gap-0.5 border-r border-slate-300 pr-1 mr-0.5">
                <button
                  type="button"
                  onClick={() => setZoomScale(prev => Math.max(50, prev - 10))}
                  className="p-1 hover:bg-slate-200 rounded text-slate-600 cursor-pointer"
                  title="تصغير المعاينة"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="text-[11px] font-mono font-bold text-slate-700 w-9 text-center tabular-nums">
                  {zoomScale}%
                </span>
                <button
                  type="button"
                  onClick={() => setZoomScale(prev => Math.min(140, prev + 10))}
                  className="p-1 hover:bg-slate-200 rounded text-slate-600 cursor-pointer"
                  title="تكبير المعاينة"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
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
            title="حفظ الفاتورة كملف PDF"
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
            {format === 'a4' ? 'طباعة الفاتورة A4' : 'طباعة الإيصال الحراري'}
          </Button>
        </div>
      </div>

      {/* Printable Paper Canvas */}
      <div className="print-container overflow-x-auto bg-slate-200/60 p-2 sm:p-4 rounded-xl flex items-start justify-center border border-slate-300 min-h-[500px]">
        {format === 'a4' ? (
          /* ========================================================
             A4 STANDARD FORMAL INVOICE LAYOUT (With Signatures)
             ======================================================== */
          <div
            className="print-zoom-wrapper transition-all duration-150 origin-top shrink-0 m-auto flex justify-center"
            style={
              zoomScale !== 100
                ? ({
                    zoom: `${zoomScale}%`,
                  } as React.CSSProperties)
                : undefined
            }
          >
            <div
              id="mss-printable-invoice-a4"
              className="print-area w-[210mm] min-h-[297mm] bg-white p-6 sm:p-7 print:p-10 shadow-md border border-slate-300 rounded-sm text-slate-900 space-y-4 shrink-0"
              dir="rtl"
              style={{ boxSizing: 'border-box' }}
            >
            {/* Header */}
            <div className="flex justify-between items-start border-b-2 border-slate-900 pb-5">
              <div>
                <h1 className="text-2xl font-bold text-slate-950 tracking-tight">Compu MSS</h1>
                <p className="text-sm text-slate-600 mt-1">
                  بيع وصيانة أجهزة اللابتوب والكمبيوتر المعتمدة
                </p>
                <div className="flex items-center gap-3 text-xs text-slate-500 mt-2">
                  <span>فرع البيع: {invoice.selling_branch}</span>
                  {invoice.source_branch && invoice.source_branch !== invoice.selling_branch && (
                    <>
                      <span>•</span>
                      <span>مصدر الأجهزة: {invoice.source_branch}</span>
                    </>
                  )}
                </div>
              </div>
              <div className="text-left" dir="ltr">
                <p className="text-base font-bold text-slate-950 font-mono mt-1 tabular-nums">
                  {invoice.invoice_number}
                </p>
                <p className="text-xs text-slate-600 mt-0.5 font-mono tabular-nums">
                  التاريخ: {formatDate(invoice.sale_date)}
                </p>
              </div>
            </div>

            {/* Status Banner if Returned */}
            {invoice.is_returned && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-center text-sm font-semibold text-rose-700">
                هذه الفاتورة تم إرجاعها رسمياً وإعادة وحداتها إلى المخزون.
              </div>
            )}

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
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-600">طريقة الدفع:</span>
                  <span className="font-bold text-xs bg-slate-100 px-2 py-0.5 rounded border border-slate-300">
                    {invoice.payment_type === 'DEFERRED' ? 'بيع آجل / أقساط' : 'سداد كامل'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-600">حالة السداد:</span>
                  <span
                    className={`font-bold text-xs px-2 py-0.5 rounded ${
                      invoice.payment_status === 'PAID'
                        ? 'bg-emerald-50 text-emerald-850 border border-emerald-300'
                        : invoice.payment_status === 'PARTIALLY_PAID'
                        ? 'bg-amber-100 text-amber-900'
                        : invoice.payment_status === 'OVERDUE'
                        ? 'bg-rose-100 text-rose-900'
                        : 'bg-slate-100 text-slate-800'
                    }`}
                  >
                    {invoice.payment_status === 'PAID'
                      ? 'مسددة بالكامل'
                      : invoice.payment_status === 'PARTIALLY_PAID'
                      ? 'مسددة جزئياً'
                      : invoice.payment_status === 'OVERDUE'
                      ? 'مستحقة متأخرة'
                      : 'غير مسددة'}
                  </span>
                </div>
              </div>
            </div>

            {/* Line Items Table (Multi-Device Support) */}
            <div className="border border-slate-300 rounded-xl overflow-x-auto print:overflow-visible print:border-slate-400 w-full">
              <table className="w-full min-w-[690px] text-xs text-right border-collapse table-auto">
                <thead
                  className="bg-slate-100 border-b border-slate-300 text-[11px] font-bold text-slate-700 print:bg-slate-100"
                  style={{ display: 'table-header-group' }}
                >
                  <tr>
                    <th className="py-2.5 px-2 w-8 min-w-[32px] text-center">#</th>
                    <th className="py-2.5 px-3 min-w-[190px] text-right">الجهاز والموديل / المواصفات</th>
                    <th className="py-2.5 px-2.5 w-44 min-w-[155px] text-center whitespace-nowrap" style={{ whiteSpace: 'nowrap' }}>السيريال / الحالة</th>
                    <th className="py-2.5 px-2 w-14 min-w-[48px] text-center whitespace-nowrap" style={{ whiteSpace: 'nowrap' }}>الكمية</th>
                    <th className="py-2.5 px-2.5 w-28 min-w-[95px] text-left whitespace-nowrap" style={{ whiteSpace: 'nowrap' }}>السعر</th>
                    <th className="py-2.5 px-2 w-20 min-w-[65px] text-left whitespace-nowrap" style={{ whiteSpace: 'nowrap' }}>الخصم</th>
                    <th className="py-2.5 px-3.5 w-28 min-w-[95px] text-left whitespace-nowrap" style={{ whiteSpace: 'nowrap' }}>الإجمالي</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {items.map((item, idx) => {
                    const hasSpecs = Boolean(item.processor || item.gpu || item.ram || item.storage || item.screen_size);

                    return (
                      <tr
                        key={item.id || idx}
                        className="hover:bg-slate-50/50"
                        style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}
                      >
                        <td className="py-2.5 px-2 text-center text-slate-500 font-mono text-xs tabular-nums">
                          {idx + 1}
                        </td>
                        <td className="py-2.5 px-3 font-medium text-slate-900 min-w-[190px]">
                          <div className="space-y-1">
                            <span className="text-slate-950 font-bold text-xs sm:text-sm block leading-snug">
                              {item.brand} {item.model_name}
                            </span>
                            {hasSpecs && (
                              <div className="flex flex-wrap items-center gap-1 text-[10px] leading-tight font-mono text-slate-600">
                                {item.processor && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 whitespace-nowrap font-medium">
                                    {item.processor}
                                  </span>
                                )}
                                {item.gpu && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 whitespace-nowrap font-medium">
                                    {item.gpu}
                                  </span>
                                )}
                                {item.ram && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 whitespace-nowrap font-medium">
                                    {item.ram}
                                  </span>
                                )}
                                {item.storage && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 whitespace-nowrap font-medium">
                                    {item.storage}
                                  </span>
                                )}
                                {item.screen_size && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 whitespace-nowrap font-medium">
                                    {item.screen_size}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-2.5 text-center whitespace-nowrap min-w-[155px]" style={{ whiteSpace: 'nowrap' }}>
                          {item.serial_number ? (
                            <span
                              className="inline-block font-mono text-[11px] font-bold bg-slate-100 px-2 py-0.5 rounded border border-slate-300 tabular-nums text-slate-900 whitespace-nowrap break-keep tracking-tight select-all"
                              style={{ whiteSpace: 'nowrap', wordBreak: 'keep-all', hyphens: 'none' }}
                            >
                              {item.serial_number}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-500 font-medium whitespace-nowrap" style={{ whiteSpace: 'nowrap' }}>
                              دفعة مخزون مجمعة
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-2 text-center font-mono font-bold text-slate-900 tabular-nums whitespace-nowrap" style={{ whiteSpace: 'nowrap' }}>
                          {item.quantity || 1}
                        </td>
                        <td className="py-2.5 px-2.5 text-left font-mono text-xs tabular-nums text-slate-700 whitespace-nowrap min-w-[95px]" style={{ whiteSpace: 'nowrap' }}>
                          <span className="whitespace-nowrap inline-block tabular-nums">
                            {formatCurrency(item.unit_price || item.list_price_snapshot)}
                          </span>
                        </td>
                        <td className="py-2.5 px-2 text-left font-mono text-xs tabular-nums text-rose-600 whitespace-nowrap min-w-[65px]" style={{ whiteSpace: 'nowrap' }}>
                          <span className="whitespace-nowrap inline-block tabular-nums">
                            {item.discount_amount > 0 ? `-${formatCurrency(item.discount_amount)}` : '0'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3.5 text-left font-mono font-bold text-slate-950 tabular-nums whitespace-nowrap min-w-[95px]" style={{ whiteSpace: 'nowrap' }}>
                          <span className="whitespace-nowrap inline-block tabular-nums font-bold">
                            {formatCurrency(item.actual_sale_price)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Financial Summary & Warranty Grid */}
            <div className="grid grid-cols-12 gap-6 items-start">
              <div className="col-span-7 space-y-3">
                <div className="p-4 bg-slate-50 border border-slate-300 rounded-xl space-y-1.5 text-xs text-slate-600 print:bg-white print:border-slate-300">
                  <span className="font-bold text-slate-900 block text-sm">شروط الضمان وسياسة المحل:</span>
                  <p className="text-slate-700 font-medium leading-relaxed">
                    {invoice.warranty_period || 'ضمان شهر كامل من تاريخ الشراء يشمل العيوب الفنية.'}
                  </p>
                  <p>• الضمان يسري بموجب هذا الأصل مع سلامة الملصقات والأرقام المسلسلة.</p>
                  <p>• الضمان لا يشمل سوء الاستخدام أو الكسر أو التعرض للسوائل أو العبث الداخلي.</p>
                  {invoice.notes && (
                    <p className="pt-2 border-t border-slate-200 text-slate-600">
                      ملاحظات: {invoice.notes}
                    </p>
                  )}
                </div>
              </div>

              <div className="col-span-5 bg-slate-50 p-4 rounded-xl border border-slate-300 space-y-2.5 text-sm print:bg-white print:border-slate-300">
                <div className="flex justify-between text-slate-700 font-medium">
                  <span>المجموع الفرعي ({items.reduce((s, it) => s + (it.quantity || 1), 0)} أجهزة):</span>
                  <span className="font-mono tabular-nums font-bold">
                    {formatCurrency(invoice.subtotal || totalListPrice)}
                  </span>
                </div>

                {invoice.discount_amount > 0 && (
                  <div className="flex justify-between text-rose-600 font-semibold">
                    <span>إجمالي الخصم الممنوح:</span>
                    <span className="font-mono tabular-nums font-bold">
                      - {formatCurrency(invoice.discount_amount)}
                    </span>
                  </div>
                )}

                {totalSavings > 0 && (
                  <div className="flex justify-between items-center bg-white p-2.5 rounded-lg border border-slate-300 text-xs print:border-slate-400">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                      <span className="font-bold text-slate-800">إجمالي وفر العميل:</span>
                    </div>
                    <span className="font-mono font-bold text-emerald-800 tabular-nums text-xs">
                      {formatCurrency(totalSavings)}
                    </span>
                  </div>
                )}

                <div className="border-t-2 border-slate-900 pt-3 flex justify-between text-base font-bold text-slate-950">
                  <span>إجمالي الفاتورة:</span>
                  <span className="font-mono text-lg tabular-nums">
                    {formatCurrency(invoice.actual_sale_price)}
                  </span>
                </div>

                {invoice.payment_type === 'DEFERRED' && (
                  <div className="pt-2 border-t border-dashed border-slate-300 space-y-1.5 text-xs">
                    <div className="flex justify-between font-bold text-emerald-800">
                      <span>المسدد:</span>
                      <span className="font-mono tabular-nums">
                        {formatCurrency(invoice.paid_amount ?? invoice.actual_sale_price)}
                      </span>
                    </div>
                    <div className="flex justify-between font-bold text-rose-800">
                      <span>المتبقي الآجل المطلوب:</span>
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

            {/* ========================================================
               REQUIREMENT 2: Customer and Store Signatures on A4 Invoice
               ======================================================== */}
            <div
              className="mt-8 pt-6 border-t-2 border-slate-300 grid grid-cols-2 gap-8 text-sm"
              style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}
            >
              {/* Customer Signature */}
              <div className="border border-dashed border-slate-300 rounded-xl p-4 text-center space-y-8 bg-slate-50/50 print:bg-white print:border-slate-400">
                <div className="flex items-center justify-center gap-1.5 font-bold text-slate-800">
                  <span>توقيع العميل / المستلم</span>
                </div>
                <div className="h-14 flex items-end justify-center">
                  <div className="w-48 border-b-2 border-dotted border-slate-400"></div>
                </div>
                <p className="text-[11px] text-slate-500 font-medium">
                  أقر أنا المستلم باستلام الأجهزة الموضحة أعلاه بحالة ممتازة ومطابقة للمواصفات
                </p>
              </div>

              {/* Store / Management Signature */}
              <div className="border border-dashed border-slate-300 rounded-xl p-4 text-center space-y-8 bg-slate-50/50 print:bg-white print:border-slate-400">
                <div className="flex items-center justify-center gap-1.5 font-bold text-slate-800">
                  <span>توقيع وختم المحل / الإدارة</span>
                </div>
                <div className="h-14 flex items-end justify-center">
                  <div className="w-48 border-b-2 border-dotted border-slate-400"></div>
                </div>
                <p className="text-[11px] text-slate-500 font-medium">
                  Compu MSS — فرع {invoice.selling_branch}
                </p>
              </div>
            </div>
          </div>
        </div>
        ) : (
          /* ========================================================
             THERMAL RECEIPT (POS 80mm) LAYOUT (Phase 3 Requirement)
             ======================================================== */
          <div
            id="mss-printable-invoice-thermal"
            className="print-area w-[80mm] max-w-[80mm] bg-white p-4 shadow-sm border border-slate-200 rounded-sm font-mono text-slate-900 text-xs space-y-2.5"
            dir="rtl"
            style={{ minHeight: 'auto', boxSizing: 'border-box' }}
          >
            {/* Header */}
            <div className="text-center pb-2 border-b border-dashed border-slate-400 space-y-0.5">
              <h2 className="text-sm font-bold tracking-tight">Compu MSS</h2>
              <p className="text-[11px] text-slate-700 font-semibold">إيصال مبيعات أجهزة رسمية</p>
              <p className="text-[10px] text-slate-600">الفرع: {invoice.selling_branch}</p>
            </div>

            {/* Receipt Meta */}
            <div className="text-[11px] space-y-1 py-1.5 border-b border-dashed border-slate-400">
              <div className="flex justify-between">
                <span className="text-slate-600">رقم الفاتورة:</span>
                <span className="font-bold tabular-nums text-slate-900">{invoice.invoice_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">التاريخ:</span>
                <span className="tabular-nums text-slate-800">{formatDate(invoice.sale_date)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">العميل:</span>
                <span className="font-medium truncate max-w-[140px] text-slate-900">
                  {invoice.customer_name || 'نقدي عام'}
                </span>
              </div>
              {invoice.customer_phone && (
                <div className="flex justify-between">
                  <span className="text-slate-600">الهاتف:</span>
                  <span className="tabular-nums text-slate-800">{invoice.customer_phone}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-600">طريقة الدفع:</span>
                <span className="font-medium text-slate-900">
                  {invoice.payment_type === 'DEFERRED' ? 'آجل / أقساط' : 'سداد كامل'}
                </span>
              </div>
            </div>

            {/* Line Items Table */}
            <div className="py-1 space-y-2 border-b border-dashed border-slate-400 text-[11px]">
              <div className="flex justify-between font-bold text-slate-800 text-[10px] pb-1 border-b border-slate-200">
                <span>الجهاز / السعر</span>
                <span>الإجمالي</span>
              </div>
              {items.map((item, idx) => (
                <div key={item.id || idx} className="space-y-0.5" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                  <p className="font-bold text-slate-900 leading-tight">
                    {idx + 1}. {item.brand} {item.model_name}
                  </p>
                  {item.serial_number ? (
                    <p className="text-[10px] text-slate-600 font-mono">
                      سيريال: {item.serial_number}
                    </p>
                  ) : (
                    <p className="text-[10px] text-slate-500">
                      كمية بدون سيريال: {item.quantity} وحدات
                    </p>
                  )}
                  <div className="flex justify-between text-slate-600 text-[10px]">
                    <span className="tabular-nums">
                      {item.quantity} × {formatCurrency(item.unit_price || item.list_price_snapshot)}
                      {item.discount_amount > 0 && (
                        <span className="text-rose-600 font-semibold"> (وفر {formatCurrency(item.discount_amount)})</span>
                      )}
                    </span>
                    <span className="font-bold text-slate-950 font-mono tabular-nums">
                      {formatCurrency(item.actual_sale_price)}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="text-[11px] space-y-1.5 py-1.5 border-b border-dashed border-slate-400">
              <div className="flex justify-between">
                <span className="text-slate-600">المجموع الفرعي ({items.reduce((s, it) => s + (it.quantity || 1), 0)} أجهزة):</span>
                <span className="tabular-nums font-bold">{formatCurrency(invoice.subtotal || totalListPrice)}</span>
              </div>
              {invoice.discount_amount > 0 && (
                <div className="flex justify-between text-rose-600">
                  <span>الخصم:</span>
                  <span className="tabular-nums font-bold">-{formatCurrency(invoice.discount_amount)}</span>
                </div>
              )}
              <div className="flex justify-between text-xs font-bold pt-1 border-t border-slate-300 text-slate-950">
                <span>الصافي المطلوب:</span>
                <span className="tabular-nums">{formatCurrency(invoice.actual_sale_price)}</span>
              </div>
              {invoice.payment_type === 'DEFERRED' && (
                <div className="pt-1 border-t border-dotted border-slate-300 space-y-1 text-[10px]">
                  <div className="flex justify-between font-bold text-emerald-800">
                    <span>المسدد:</span>
                    <span className="tabular-nums">
                      {formatCurrency(invoice.paid_amount ?? invoice.actual_sale_price)}
                    </span>
                  </div>
                  <div className="flex justify-between font-bold text-rose-800">
                    <span>المتبقي:</span>
                    <span className="tabular-nums">
                      {formatCurrency(invoice.remaining_balance ?? 0)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Terms and Footer */}
            <div className="text-[10px] text-slate-600 text-center pt-1.5 space-y-1">
              <p className="font-semibold text-slate-800">
                {invoice.warranty_period || 'ضمان شهر كامل من تاريخ الشراء'}
              </p>
              <p className="text-slate-500 text-[9px]">
                يشترط للاستبدال أو الصيانة إحضار هذا الإيصال
              </p>
              <p className="font-bold text-slate-700 text-[10px] pt-1">
                شكراً لاختياركم Compu MSS!
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
