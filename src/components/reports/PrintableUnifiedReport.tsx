import React from 'react';
import type {
  UnifiedBusinessDashboardData,
  ReportPeriod,
} from '@/types/unifiedDashboard.ts';
import { formatCurrency } from '@/lib/utils';

export interface PrintableUnifiedReportProps {
  data: UnifiedBusinessDashboardData;
  period: ReportPeriod;
  customStart?: string;
  customEnd?: string;
}

export const PrintableUnifiedReport: React.FC<PrintableUnifiedReportProps> = ({
  data,
  period,
  customStart,
  customEnd,
}) => {
  const currentDate = new Date().toLocaleDateString('ar-EG', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const currentTime = new Date().toLocaleTimeString('ar-EG', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const periodLabels: Record<ReportPeriod, string> = {
    today: 'اليوم',
    yesterday: 'أمس',
    week: 'آخر 7 أيام',
    month: 'آخر 30 يوماً',
    all: 'كافة الفترات',
    custom: 'فترة مخصصة',
  };

  const periodText =
    period === 'custom' && customStart && customEnd
      ? `الفترة المخصصة: من ${customStart} إلى ${customEnd}`
      : `الفترة المحددة: ${periodLabels[period] || period}`;

  const { combined, accessories, mss, branchOperationalSales, locationStockValuation } = data;

  return (
    <div
      id="printable-unified-report"
      className="bg-white text-slate-900 p-8 sm:p-12 w-full max-w-[210mm] mx-auto space-y-6 text-sm"
      dir="rtl"
      style={{ minHeight: 'auto', boxSizing: 'border-box' }}
    >
      {/* 1. Header */}
      <div className="border-b-2 border-slate-900 pb-5">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-xl font-bold text-slate-950 tracking-tight">
              Compu MSS — تقرير مجمع   
            </h1>
            <p className="text-sm font-semibold text-slate-700 mt-1">
              تقرير الأداء المالي المجمع — نشاط الإكسسوارات و Compu MSS المشترك
            </p>
            <div className="flex items-center gap-3 text-xs text-slate-600 mt-2">
              <span>تاريخ الاستخراج: {currentDate} ({currentTime})</span>
              <span>•</span>
              <span>العملة: الجنيه المصري (EGP)</span>
            </div>
          </div>

          <div className="text-left border border-slate-300 bg-slate-50 p-3 rounded-lg text-xs space-y-1 print:bg-white print:border-slate-400">
            <p className="text-slate-600 font-mono">المرجع: EXEC-{Date.now().toString(36).toUpperCase()}</p>
          </div>
        </div>

        {/* Title Banner */}
          <div className="text-left font-mono text-xs font-bold text-slate-800">
            <span className="bg-white px-2 py-1 rounded border border-slate-300">{periodText}</span>
          </div>
      </div>

      {/* 2. Combined Financial Performance Table */}
      <div className="space-y-2 avoid-break" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
        <h3 className="font-bold text-sm text-slate-900 border-r-4 border-slate-900 pr-2">
          أولاً: الأداء المالي المجمع  (الإكسسوارات + Compu MSS)
        </h3>

        <div className="border border-slate-300 rounded-xl overflow-hidden">
          <table className="w-full text-sm text-right">
            <thead className="bg-slate-100 text-xs font-bold text-slate-700 border-b border-slate-300">
              <tr>
                <th className="py-2.5 px-4">المؤشر المالي العام</th>
                <th className="py-2.5 px-4 text-center">البيان</th>
                <th className="py-2.5 px-4 text-left">المبلغ (EGP)</th>
                <th className="py-2.5 px-4 text-left">التصنيف</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              <tr>
                <td className="py-2.5 px-4 font-semibold text-slate-900">إجمالي الإيرادات المجمعة</td>
                <td className="py-2.5 px-4 text-center font-mono tabular-nums text-slate-700">{combined.totalTransactionsCount} معاملة تجارية</td>
                <td className="py-2.5 px-4 text-left font-bold font-mono tabular-nums text-slate-900">{formatCurrency(combined.combinedRevenue)}</td>
                <td className="py-2.5 px-4 text-left text-xs text-slate-600">نشاط المحل واللابتوبات</td>
              </tr>
              <tr>
                <td className="py-2.5 px-4 font-semibold text-slate-900">إجمالي تكلفة البضاعة المباعة </td>
                <td className="py-2.5 px-4 text-center font-mono text-xs text-slate-600">التكلفة التاريخية الدقيقة</td>
                <td className="py-2.5 px-4 text-left font-mono tabular-nums text-slate-700">{formatCurrency(combined.combinedCogs)}</td>
                <td className="py-2.5 px-4 text-left text-xs text-slate-600">تكلفة شراء البضاعة</td>
              </tr>
              <tr className="bg-slate-100 border-t-2 border-slate-900 font-bold print:bg-slate-50">
                <td className="py-3 px-4 text-slate-950 text-base">مجمل الأرباح المجمعة</td>
                <td className="py-3 px-4 text-center font-mono text-sm text-slate-900">
                  هامش الربح العام: {combined.profitMarginPercent.toFixed(1)}%
                </td>
                <td className="py-3 px-4 text-left font-mono tabular-nums text-emerald-800 text-lg print:text-slate-950">
                  {formatCurrency(combined.combinedGrossProfit)}
                </td>
                <td className="py-3 px-4 text-left text-xs font-bold text-emerald-800 print:text-slate-900">
                  صافي الأرباح التشغيلية
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. Sectional Business Separation (Rule 6: Accessories vs MSS) */}
      <div className="space-y-3 avoid-break" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
        <h3 className="font-bold text-sm text-slate-900 border-r-4 border-slate-900 pr-2">
          ثانياً: التحليل المالي المفصل    
        </h3>

        <div className="grid grid-cols-2 gap-4">
          {/* Accessories Activity */}
          <div className="border border-slate-300 rounded-xl p-4 bg-slate-50 print:bg-white space-y-2.5 text-xs">
            <h4 className="font-bold text-sm text-slate-900 border-b border-slate-200 pb-2">
              1. نشاط محل الإكسسوارات 
            </h4>
            <div className="flex justify-between py-1 border-b border-slate-200">
              <span className="text-slate-600">صافي المبيعات :</span>
              <span className="font-mono font-bold text-slate-900">{formatCurrency(accessories.netSales)}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-200">
              <span className="text-slate-600">تكلفة البضاعة :</span>
              <span className="font-mono tabular-nums">{formatCurrency(accessories.costOfGoodsSold)}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-200 font-bold">
              <span className="text-slate-900">أرباح الإكسسوارات (هامش {accessories.profitMarginPercent.toFixed(1)}%):</span>
              <span className="font-mono text-emerald-800 print:text-slate-950">{formatCurrency(accessories.grossProfit)}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-200">
              <span className="text-slate-600">فواتير مسددة / مرتجعات:</span>
              <span className="font-mono">{accessories.invoicesCount} فاتورة / {accessories.returnsCount} مرتجع</span>
            </div>
            <div className="flex justify-between py-1 pt-2 font-semibold">
              <span className="text-slate-700">قيمة المخزون  (تكلفة):</span>
              <span className="font-mono text-slate-900">{formatCurrency(accessories.inventoryCostValuation)}</span>
            </div>
          </div>

          {/* MSS Activity */}
          <div className="border border-slate-300 rounded-xl p-4 bg-slate-50 print:bg-white space-y-2.5 text-xs">
            <h4 className="font-bold text-sm text-slate-900 border-b border-slate-200 pb-2">
              2. نشاط  Compu MSS 
            </h4>
            <div className="flex justify-between py-1 border-b border-slate-200">
              <span className="text-slate-600">صافي المبيعات :</span>
              <span className="font-mono font-bold text-slate-900">{formatCurrency(mss.netSales)}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-200">
              <span className="text-slate-600">تكلفة شراء الأجهزة :</span>
              <span className="font-mono tabular-nums">{formatCurrency(mss.costOfGoodsSold)}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-200 font-bold">
              <span className="text-slate-900">أرباح Compu MSS  (هامش {mss.profitMarginPercent.toFixed(1)}%):</span>
              <span className="font-mono text-emerald-800 print:text-slate-950">{formatCurrency(mss.sharedGrossProfit)}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-200">
              <span className="text-slate-600">أجهزة مباعة / مرتجعة / محجوزة:</span>
              <span className="font-mono">{mss.soldDevicesCount} مباع / {mss.returnedDevicesCount} مرتجع / {mss.activeReservationsCount} حجز</span>
            </div>
            <div className="flex justify-between py-1 pt-2 font-semibold">
              <span className="text-slate-700">قيمة  الأجهزة (تكلفة):</span>
              <span className="font-mono text-slate-900">{formatCurrency(mss.inventoryCostValuation)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Branch Operational Distribution Table */}
      {branchOperationalSales && branchOperationalSales.length > 0 && (
        <div className="space-y-2 avoid-break" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
          <h3 className="font-bold text-sm text-slate-900 border-r-4 border-slate-900 pr-2">
            ثالثاً: توزيع المبيعات  حسب الفروع 
          </h3>

          <div className="border border-slate-300 rounded-xl overflow-hidden">
            <table className="w-full text-xs text-right">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300">
                <tr>
                  <th className="py-2 px-3">الفرع   </th>
                  <th className="py-2 px-3 text-center">العمليات المنفذة</th>
                  <th className="py-2 px-3 text-left">إجمالي المبيعات</th>
                  <th className="py-2 px-3 text-left">الخصومات</th>
                  <th className="py-2 px-3 text-left">النسبة من الإيرادات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {branchOperationalSales.map((b, idx) => (
                  <tr key={idx} style={{ breakInside: 'avoid' }}>
                    <td className="py-2 px-3 font-bold text-slate-900">{b.branch}</td>
                    <td className="py-2 px-3 text-center font-mono tabular-nums">{b.salesCount} عملية</td>
                    <td className="py-2 px-3 text-left font-mono font-bold text-slate-900">{formatCurrency(b.revenue)}</td>
                    <td className="py-2 px-3 text-left font-mono text-slate-600">{formatCurrency(b.discounts)}</td>
                    <td className="py-2 px-3 text-left font-mono text-slate-700">{b.percentageOfTotalRevenue.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. Physical Inventory Location Valuation (Rule 9) */}
      {locationStockValuation && locationStockValuation.length > 0 && (
        <div className="space-y-2 avoid-break" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
          <h3 className="font-bold text-sm text-slate-900 border-r-4 border-slate-900 pr-2">
            رابعاً: تواجد الأجهزة  في الفروع والمخازن
          </h3>

          <div className="grid grid-cols-2 gap-3">
            {locationStockValuation.map((loc, idx) => (
              <div key={idx} className="border border-slate-300 rounded-xl p-3 bg-slate-50 print:bg-white text-xs space-y-1">
                <div className="flex justify-between font-bold text-slate-900 border-b border-slate-200 pb-1">
                  <span>مقر: {loc.location}</span>
                  <span className="font-mono">{loc.availableUnits} جهاز متوفر</span>
                </div>
                <div className="flex justify-between pt-1 text-slate-600">
                  <span>قيمة الأجهزة بسعر التكلفة:</span>
                  <span className="font-mono font-semibold text-slate-900">{formatCurrency(loc.totalCostValue)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 6. Certification Signatures & Footnotes */}
      <div
        className="pt-6 border-t-2 border-slate-900 space-y-4 avoid-break"
        style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}
      >
        <div className="grid grid-cols-2 gap-8 text-xs text-slate-700 font-semibold text-center">
          <div className="p-3 border border-slate-200 rounded-lg">
            <p className="mb-8">إعداد وتدقيق الحسابات المجمعة:</p>
            <p className="font-mono text-slate-400">________________________</p>
          </div>
          <div className="p-3 border border-slate-200 rounded-lg">
            <p className="mb-8">اعتماد وختم الإدارة   :</p>
            <p className="font-mono text-slate-400">________________________</p>
          </div>
        </div>

        <div className="flex justify-between items-center text-[11px] text-slate-500 pt-2 border-t border-slate-200">
          <span>نظام Compu MSS — وثيقة مالية  مجمعة  صادرة إلكترونياً</span>
          <span>© 2026 Ahmed Saber. All rights reserved. • Contact: 01030137635</span>
        </div>
      </div>
    </div>
  );
};
