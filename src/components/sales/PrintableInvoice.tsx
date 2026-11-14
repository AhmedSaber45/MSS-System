import React from 'react';
import type { Invoice, InvoiceItem } from '@/types/sale.ts';
import { formatCurrency } from '@/lib/utils';
import { Button } from '@/components/common/Button';
import { Printer, FileText, Receipt, X } from 'lucide-react';

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
  const handlePrint = () => {
    window.print();
  };

  const totalItemDiscounts = items.reduce(
    (sum, item) => sum + (item.discount || 0) * item.quantity,
    0
  );
  const totalSavings = totalItemDiscounts + (invoice.discount || 0);

  return (
    <div className="space-y-4">
      {/* Controls Bar (hidden during print) */}
      <div className="no-print flex flex-wrap items-center justify-between gap-3 bg-slate-100 p-3 rounded-xl border border-slate-200">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-700">تنسيق الطباعة:</span>
          <div className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5 shadow-2xs">
            <button
              type="button"
              onClick={() => onFormatChange?.('a4')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                format === 'a4'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>فاتورة قياسية A4</span>
            </button>
            <button
              type="button"
              onClick={() => onFormatChange?.('thermal')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                format === 'thermal'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>إيصال حراري (POS 80mm)</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onClose && (
            <Button variant="outline" size="sm" onClick={onClose} leftIcon={<X className="w-4 h-4" />}>
              إغلاق
            </Button>
          )}
          <Button
            variant="primary"
            size="sm"
            onClick={handlePrint}
            leftIcon={<Printer className="w-4 h-4" />}
            className="shadow-sm font-bold"
          >
            طباعة الفاتورة الآن
          </Button>
        </div>
      </div>

      {/* Printable Paper Canvas */}
      <div className="print-container overflow-x-auto bg-slate-200/50 p-4 rounded-xl flex justify-center">
        {format === 'a4' ? (
          /* ========================================================
             A4 STANDARD FORMAL INVOICE LAYOUT
             ======================================================== */
          <div
            id="printable-invoice-a4"
            className="print-area w-full max-w-[210mm] min-h-[280mm] bg-white p-8 sm:p-10 shadow-lg border border-slate-300 rounded-sm text-slate-900 space-y-6"
            dir="rtl"
          >
            {/* Header */}
            <div className="flex justify-between items-start border-b-2 border-slate-900 pb-5">
              <div>
                <h1 className="text-2xl font-black text-slate-950 tracking-tight">محل إكسسوارات المحمول</h1>
                <p className="text-xs text-slate-600 font-medium mt-1">
                  بيع وشراء وصيانة إكسسوارات الهواتف الذكية والأجهزة اللوحية
                </p>
                <div className="flex items-center gap-4 text-xs text-slate-500 mt-2">
                  <span>هاتف: 01000000000</span>
                  <span>•</span>
                  <span>العنوان: المحل الرئيسي - قسم الإكسسوارات</span>
                </div>
              </div>
              <div className="text-left" dir="ltr">
                <span className="inline-block px-3 py-1 bg-slate-900 text-white text-xs font-black tracking-wider uppercase rounded">
                  TAX INVOICE
                </span>
                <p className="text-sm font-black text-slate-950 font-mono mt-2">{invoice.invoice_number}</p>
                <p className="text-xs text-slate-500 mt-0.5">التاريخ: {invoice.invoice_date}</p>
              </div>
            </div>

            {/* Bill To & Meta Info */}
            <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200 text-xs">
              <div className="space-y-1.5">
                <span className="font-bold text-slate-500 block uppercase tracking-wider text-[11px]">بيانات العميل:</span>
                <p className="font-bold text-slate-900 text-sm">{invoice.customer_name || 'عميل نقدي عام'}</p>
                {invoice.customer_phone && (
                  <p className="text-slate-600 font-mono">الهاتف: {invoice.customer_phone}</p>
                )}
              </div>
              <div className="space-y-1.5 text-left" dir="rtl">
                <span className="font-bold text-slate-500 block uppercase tracking-wider text-[11px]">معلومات السداد:</span>
                <p className="font-bold text-slate-900">
                  طريقة الدفع: <span className="text-blue-700">{invoice.payment_method}</span>
                </p>
                <p className="text-slate-500">حالة الفاتورة: مكتملة ومسددة</p>
              </div>
            </div>

            {/* Line Items Table */}
            <div className="border border-slate-300 rounded-md overflow-hidden">
              <table className="w-full text-xs text-right">
                <thead className="bg-slate-100 border-b border-slate-300 font-bold text-slate-800">
                  <tr>
                    <th className="py-2.5 px-3 w-10 text-center">#</th>
                    <th className="py-2.5 px-3">بيان الصنف</th>
                    <th className="py-2.5 px-3 w-24 text-center">كود الصنف</th>
                    <th className="py-2.5 px-3 w-20 text-center">الكمية</th>
                    <th className="py-2.5 px-3 w-24 text-left">السعر الأصلي</th>
                    <th className="py-2.5 px-3 w-20 text-left">الخصم</th>
                    <th className="py-2.5 px-3 w-24 text-left">السعر الفعلي</th>
                    <th className="py-2.5 px-3 w-28 text-left">الإجمالي</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {items.map((item, idx) => (
                    <tr key={item.id} className="hover:bg-slate-50/50">
                      <td className="py-2 px-3 text-center text-slate-500 font-mono">{idx + 1}</td>
                      <td className="py-2 px-3 font-semibold text-slate-900">{item.product_name}</td>
                      <td className="py-2 px-3 text-center font-mono text-slate-500 text-[11px]">{item.product_code}</td>
                      <td className="py-2 px-3 text-center font-bold text-slate-900">{item.quantity}</td>
                      <td className="py-2 px-3 text-left font-mono text-slate-600">{formatCurrency(item.original_price)}</td>
                      <td className="py-2 px-3 text-left font-mono text-rose-600">
                        {item.discount > 0 ? formatCurrency(item.discount) : '-'}
                      </td>
                      <td className="py-2 px-3 text-left font-mono font-bold text-slate-900">
                        {formatCurrency(item.actual_price)}
                      </td>
                      <td className="py-2 px-3 text-left font-mono font-bold text-slate-950">
                        {formatCurrency(item.line_total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals & Notes Section */}
            <div className="grid grid-cols-12 gap-6 items-start pt-2">
              <div className="col-span-7 space-y-3 text-xs">
                {invoice.notes && (
                  <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-lg text-amber-900">
                    <span className="font-bold block mb-1">ملاحظات الفاتورة:</span>
                    <p>{invoice.notes}</p>
                  </div>
                )}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-600 text-[11px] space-y-1">
                  <p className="font-bold text-slate-800">شروط الضمان والاسترجاع:</p>
                  <p>• البضاعة المباعة ترد وتستبدل خلال 14 يوماً بحالتها الأصلية وفاتورة الشراء الأصلية.</p>
                  <p>• الضمان لا يشمل سوء الاستخدام أو الكسر أو التعرض للسوائل.</p>
                </div>
              </div>

              <div className="col-span-5 bg-slate-50 p-4 rounded-xl border border-slate-300 space-y-2 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>المجموع الفرعي للأصناف:</span>
                  <span className="font-mono font-bold">{formatCurrency(invoice.subtotal)}</span>
                </div>
                {invoice.discount > 0 && (
                  <div className="flex justify-between text-rose-600 font-medium">
                    <span>خصم إضافي على الفاتورة:</span>
                    <span className="font-mono font-bold">- {formatCurrency(invoice.discount)}</span>
                  </div>
                )}
                {totalSavings > 0 && (
                  <div className="flex justify-between text-emerald-700 bg-emerald-50 px-2 py-1 rounded text-[11px] font-bold">
                    <span>إجمالي وفر العميل:</span>
                    <span className="font-mono">{formatCurrency(totalSavings)}</span>
                  </div>
                )}
                <div className="border-t-2 border-slate-900 pt-2 flex justify-between text-sm font-black text-slate-950">
                  <span>الصافي النهائي المستحق:</span>
                  <span className="font-mono text-base text-blue-800">{formatCurrency(invoice.total_amount)}</span>
                </div>
              </div>
            </div>

            {/* Signatures & Footer */}
            <div className="pt-8 border-t border-slate-200 flex justify-between items-center text-xs text-slate-500">
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
             THERMAL RECEIPT (POS 80mm) LAYOUT
             ======================================================== */
          <div
            id="printable-invoice-thermal"
            className="print-area w-[80mm] min-h-[140mm] bg-white p-4 shadow-lg border border-slate-300 rounded-sm font-mono text-slate-950 text-xs space-y-3"
            dir="rtl"
          >
            {/* Header */}
            <div className="text-center pb-2 border-b border-dashed border-slate-400 space-y-1">
              <h2 className="text-sm font-black tracking-tight">محل إكسسوارات المحمول</h2>
              <p className="text-[11px] text-slate-600">إيصال استلام مبيعات</p>
              <p className="text-[10px] text-slate-500">هاتف: 01000000000</p>
            </div>

            {/* Receipt Meta */}
            <div className="text-[11px] space-y-1 py-1 border-b border-dashed border-slate-400">
              <div className="flex justify-between">
                <span>رقم الفاتورة:</span>
                <span className="font-bold">{invoice.invoice_number}</span>
              </div>
              <div className="flex justify-between">
                <span>التاريخ:</span>
                <span>{invoice.invoice_date}</span>
              </div>
              <div className="flex justify-between">
                <span>العميل:</span>
                <span className="font-bold truncate max-w-[140px]">{invoice.customer_name || 'نقدي عام'}</span>
              </div>
              <div className="flex justify-between">
                <span>طريقة الدفع:</span>
                <span>{invoice.payment_method}</span>
              </div>
            </div>

            {/* Items */}
            <div className="py-1 space-y-2 border-b border-dashed border-slate-400 text-[11px]">
              <div className="flex justify-between font-bold text-slate-800 text-[10px] pb-1 border-b border-slate-200">
                <span>الصنف / السعر</span>
                <span>الإجمالي</span>
              </div>
              {items.map(item => (
                <div key={item.id} className="space-y-0.5">
                  <p className="font-bold text-slate-900 leading-tight">{item.product_name}</p>
                  <div className="flex justify-between text-slate-600 text-[10px]">
                    <span>
                      {item.quantity} × {formatCurrency(item.actual_price)}
                      {item.discount > 0 && <span className="text-rose-600"> (خصم {item.discount})</span>}
                    </span>
                    <span className="font-bold text-slate-900 font-mono">{formatCurrency(item.line_total)}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="py-1 space-y-1.5 text-[11px]">
              <div className="flex justify-between text-slate-600">
                <span>المجموع:</span>
                <span className="font-mono">{formatCurrency(invoice.subtotal)}</span>
              </div>
              {invoice.discount > 0 && (
                <div className="flex justify-between text-rose-600 font-semibold">
                  <span>الخصم الإضافي:</span>
                  <span className="font-mono">- {formatCurrency(invoice.discount)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-black text-slate-950 border-t border-slate-900 pt-1.5">
                <span>الصافي المدفوع:</span>
                <span className="font-mono">{formatCurrency(invoice.total_amount)}</span>
              </div>
            </div>

            {/* Thermal Footer */}
            <div className="pt-2 border-t border-dashed border-slate-400 text-center text-[10px] text-slate-500 space-y-1">
              {invoice.notes && <p className="italic text-slate-700">ملاحظة: {invoice.notes}</p>}
              <p className="font-bold text-slate-700">شكراً لزيارتكم ونسعد بخدمتكم دائماً</p>
              <p>الاستبدال خلال 14 يوماً مع الإيصال الأصلي</p>
              <p className="font-mono text-[9px] pt-1">*** {invoice.invoice_number} ***</p>
            </div>
          </div>
        )}
      </div>

      {/* Global Print Stylesheet for Browser Print Window */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          .no-print, nav, aside, header, footer {
            display: none !important;
          }
          .print-container {
            background: transparent !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .print-area, .print-area * {
            visibility: visible !important;
          }
          .print-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 10mm !important;
            box-shadow: none !important;
            border: none !important;
          }
          @page {
            size: ${format === 'thermal' ? '80mm auto' : 'A4'};
            margin: 5mm;
          }
        }
      `}</style>
    </div>
  );
};
