'use client';

import React, { useEffect, useState } from 'react';
import {
  X,
  ArrowRight,
  Boxes,
  Calendar,
  User,
  CheckCircle2,
  AlertCircle,
  Clock,
  DollarSign,
  Smartphone,
  Layers,
  FileText,
  Loader2,
} from 'lucide-react';
import type { InventoryTransfer } from '@/types/admin';

interface TransferDetailsModalProps {
  transferId: string;
  isOpen: boolean;
  onClose: () => void;
}

export const TransferDetailsModal: React.FC<TransferDetailsModalProps> = ({
  transferId,
  isOpen,
  onClose,
}) => {
  const [transfer, setTransfer] = useState<InventoryTransfer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !transferId) return;

    const fetchDetails = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/transfers?id=${transferId}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'فشل في جلب تفاصيل التحويل');
        setTransfer(data.transfer);
      } catch (err: any) {
        setError(err.message || 'حدث خطأ أثناء تحميل البيانات');
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [transferId, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/10 text-brand-primary rounded-xl border border-blue-500/20">
              <Boxes className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">تفاصيل تحويل المخزون</h3>
                {transfer && (
                  <span className="font-mono text-xs px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    {transfer.referenceNumber}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                مراجعة الأجهزة المنقولة وسجلات التكلفة والوجهة المعتمدة
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
              <p className="text-sm">جاري تحميل تفاصيل التحويل والأجهزة...</p>
            </div>
          ) : error ? (
            <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-sm flex items-center gap-3">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{error}</span>
            </div>
          ) : !transfer ? (
            <div className="text-center py-12 text-slate-500">لا توجد بيانات متاحة لهذا التحويل</div>
          ) : (
            <>
              {/* Summary Header Card */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950/50 p-4 rounded-xl border border-slate-800/80">
                <div>
                  <div className="text-[11px] font-medium text-slate-400">المسار (المصدر ➔ الوجهة)</div>
                  <div className="text-sm font-bold text-white mt-1 flex items-center gap-1.5 flex-wrap">
                    <span className="text-slate-300">{transfer.sourceLocation}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-blue-400 rotate-180 shrink-0" />
                    <span className="text-emerald-400">{transfer.destinationLocation}</span>
                  </div>
                </div>

                <div>
                  <div className="text-[11px] font-medium text-slate-400">نوع التحويل والحالة</div>
                  <div className="text-sm font-semibold text-white mt-1 flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-xs bg-slate-800 text-slate-300 font-mono">
                      {transfer.transferType}
                    </span>
                    <span className="px-2 py-0.5 rounded text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                      {transfer.status}
                    </span>
                  </div>
                </div>

                <div>
                  <div className="text-[11px] font-medium text-slate-400">عدد الأجهزة والتكلفة</div>
                  <div className="text-sm font-bold text-white mt-1">
                    {transfer.itemCount} جهاز{' '}
                    <span className="text-xs font-normal text-slate-400">
                      ({transfer.totalCost.toLocaleString()} ج.م)
                    </span>
                  </div>
                </div>

                <div>
                  <div className="text-[11px] font-medium text-slate-400">المسؤول والتوقيت</div>
                  <div className="text-xs text-slate-300 mt-1">
                    <div className="font-semibold">{transfer.createdByUsername}</div>
                    <div className="text-[11px] text-slate-500">
                      {new Date(transfer.createdAt).toLocaleString('ar-EG')}
                    </div>
                  </div>
                </div>
              </div>

              {/* Notes if present */}
              {transfer.notes && (
                <div className="p-3 bg-slate-800/40 border border-slate-800 rounded-lg text-xs text-slate-300 flex items-start gap-2">
                  <FileText className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-slate-200">ملاحظات التحويل: </span>
                    {transfer.notes}
                  </div>
                </div>
              )}

              {/* Itemized Device Table */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Smartphone className="w-4 h-4 text-brand-primary" />
                    <span>الأجهزة المشمولة في التحويل ({transfer.items?.length || 0})</span>
                  </h4>
                  <span className="text-[11px] text-slate-500">
                    أرقام السيريال وتكلفة الشراء محفوظة تاريخياً
                  </span>
                </div>

                <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/40">
                  <table className="w-full text-right text-xs text-slate-300">
                    <thead className="bg-slate-900/80 text-slate-400 text-[11px] font-semibold uppercase border-b border-slate-800">
                      <tr>
                        <th className="p-3">#</th>
                        <th className="p-3">رقم السيريال</th>
                        <th className="p-3">الموديل</th>
                        <th className="p-3">تكلفة الشراء</th>
                        <th className="p-3">الحالة السابقة</th>
                        <th className="p-3">الحالة الناتجة</th>
                        <th className="p-3">نتيجة البند</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-sans">
                      {(!transfer.items || transfer.items.length === 0) ? (
                        <tr>
                          <td colSpan={7} className="p-6 text-center text-slate-500">
                            لا توجد بنود مسجلة لهذا التحويل
                          </td>
                        </tr>
                      ) : (
                        transfer.items.map((item, idx) => (
                          <tr key={item.id} className="hover:bg-slate-900/50 transition-colors">
                            <td className="p-3 text-slate-500 font-mono text-[11px]">{idx + 1}</td>
                            <td className="p-3 font-mono font-bold text-white tracking-wider">
                              {item.serialNumber}
                            </td>
                            <td className="p-3 text-slate-300">{item.modelName || 'غير محدد'}</td>
                            <td className="p-3 font-mono font-medium text-slate-200">
                              {item.purchaseCostSnapshot.toLocaleString()} ج.م
                            </td>
                            <td className="p-3">
                              <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400">
                                {item.previousStatus}
                              </span>
                            </td>
                            <td className="p-3">
                              <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                                {item.resultingStatus}
                              </span>
                            </td>
                            <td className="p-3">
                              <span className="inline-flex items-center gap-1 text-emerald-400 text-[11px] font-semibold">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>مكتمل</span>
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between shrink-0">
          <div className="text-[11px] text-slate-500 font-mono">
            {transfer && `Idempotency: ${transfer.idempotencyKey || 'N/A'}`}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold cursor-pointer transition-colors"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};

export default TransferDetailsModal;
