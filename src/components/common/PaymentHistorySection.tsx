import React, { useState } from 'react';
import {
  DollarSign,
  Calendar,
  CreditCard,
  Plus,
  RotateCcw,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileText,
  ChevronDown,
  ChevronUp,
  Edit2,
  ShieldAlert,
} from 'lucide-react';
import { Button } from '@/components/common/Button';
import { Badge } from '@/components/common/Badge';
import { Modal } from '@/components/common/Modal';
import { AlertModal } from '@/components/common/AlertModal';
import { Input } from '@/components/common/Input';
import { Spinner } from '@/components/common/Spinner';
import { formatCurrency, formatDate } from '@/lib/utils';
import { PaymentCollectionModal } from './PaymentCollectionModal';
import { InstallmentScheduleBuilder, PlannedInstallmentItem } from './InstallmentScheduleBuilder';

export interface PaymentRecordItem {
  id: string;
  invoice_id: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  notes?: string;
  created_by?: string;
  created_at: string;
  is_reversal?: boolean;
  reversal_of_id?: string;
  reversal_reason?: string;
}

export interface PaymentScheduleItem {
  id?: string;
  installment_number: number;
  expected_amount: number;
  due_date: string;
  notes?: string;
}

export interface PaymentHistorySectionProps {
  invoiceId: string;
  invoiceNumber: string;
  customerName?: string;
  totalAmount: number;
  paidAmount: number;
  remainingBalance: number;
  paymentType: 'FULL' | 'DEFERRED';
  paymentStatus: 'PAID' | 'PARTIALLY_PAID' | 'UNPAID' | 'OVERDUE';
  dueDate?: string;
  installmentsCount?: number;
  payments: PaymentRecordItem[];
  schedule: PaymentScheduleItem[];
  onRecordPayment: (data: {
    amount: number;
    payment_date: string;
    payment_method: string;
    notes?: string;
  }) => Promise<void>;
  onReversePayment?: (paymentId: string, reason: string) => Promise<void>;
  onUpdateSchedule?: (newSchedule: PlannedInstallmentItem[]) => Promise<void>;
  readOnly?: boolean;
}

export const PaymentHistorySection: React.FC<PaymentHistorySectionProps> = ({
  invoiceId,
  invoiceNumber,
  customerName,
  totalAmount,
  paidAmount,
  remainingBalance,
  paymentType,
  paymentStatus,
  dueDate,
  installmentsCount,
  payments,
  schedule,
  onRecordPayment,
  onReversePayment,
  onUpdateSchedule,
  readOnly = false,
}) => {
  const [isRecordModalOpen, setIsRecordModalOpen] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'payments' | 'schedule'>('payments');

  // Reversal Modal state
  const [reversalTarget, setReversalTarget] = useState<PaymentRecordItem | null>(null);
  const [reversalReason, setReversalReason] = useState<string>('');
  const [isReversing, setIsReversing] = useState<boolean>(false);
  const [reversalError, setReversalError] = useState<string>('');

  // Schedule Edit Modal state
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState<boolean>(false);
  const [editableSchedule, setEditableSchedule] = useState<PlannedInstallmentItem[]>([]);
  const [isSavingSchedule, setIsSavingSchedule] = useState<boolean>(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  // Status Badge helper
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PAID':
        return (
          <Badge variant="success" size="md" className="font-bold">
            <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
            مسددة بالكامل
          </Badge>
        );
      case 'PARTIALLY_PAID':
        return (
          <Badge variant="warning" size="md" className="font-bold">
            <Clock className="w-3.5 h-3.5 mr-1" />
            مسددة جزئياً
          </Badge>
        );
      case 'OVERDUE':
        return (
          <Badge variant="danger" size="md" className="font-bold">
            <AlertTriangle className="w-3.5 h-3.5 mr-1" />
            متأخرة عن موعدها
          </Badge>
        );
      case 'UNPAID':
      default:
        return (
          <Badge variant="danger" size="md" className="font-bold">
            غير مسددة
          </Badge>
        );
    }
  };

  // Check if an installment date is overdue
  const todayStr = new Date().toISOString().substring(0, 10);

  // Execute safe reversal
  const handleConfirmReversal = async () => {
    if (!reversalTarget || !onReversePayment) return;
    if (!reversalReason.trim()) {
      setReversalError('يرجى كتابة سبب الإلغاء أو التصحيح');
      return;
    }

    setIsReversing(true);
    setReversalError('');
    try {
      await onReversePayment(reversalTarget.id, reversalReason.trim());
      setReversalTarget(null);
      setReversalReason('');
    } catch (err: any) {
      setReversalError(err?.message || 'فشل إلغاء الدفعة');
    } finally {
      setIsReversing(false);
    }
  };

  // Open Schedule Edit
  const handleOpenScheduleEdit = () => {
    setEditableSchedule(
      schedule.map(s => ({
        installment_number: s.installment_number,
        expected_amount: s.expected_amount,
        due_date: s.due_date,
        notes: s.notes,
      }))
    );
    setIsScheduleModalOpen(true);
  };

  // Save Schedule Edit
  const handleSaveSchedule = async () => {
    if (!onUpdateSchedule) return;
    setIsSavingSchedule(true);
    try {
      await onUpdateSchedule(editableSchedule);
      setIsScheduleModalOpen(false);
    } catch (err: any) {
      setScheduleError(err?.message || 'فشل حفظ جدول الأقساط');
    } finally {
      setIsSavingSchedule(false);
    }
  };

  // Find next unpaid installment expected amount
  const nextInstallment = schedule.find(s => s.due_date >= todayStr);
  const nextAmount = nextInstallment ? nextInstallment.expected_amount : undefined;

  return (
    <div className="space-y-4 pt-3 border-t border-slate-300">
      {/* Header bar with summary & action */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-300">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-bold text-slate-900">حالة السداد والتحصيلات</h4>
            {getStatusBadge(paymentStatus)}
            {paymentType === 'DEFERRED' && (
              <span className="text-xs bg-amber-100 text-amber-900 px-2 py-0.5 rounded font-bold border border-amber-300">
                بيع آجل / أقساط
              </span>
            )}
          </div>
          <p className="text-xs text-slate-600 mt-1">
            {paymentType === 'DEFERRED'
              ? `إجمالي الأقساط المخططة: ${installmentsCount || schedule.length || '—'} ${
                  dueDate ? `• موعد الاستحقاق القادم: ${dueDate}` : ''
                }`
              : 'فاتورة سداد نقدي كامل'}
          </p>
        </div>

        {/* Action Button: Record Payment */}
        {!readOnly && remainingBalance > 0 && (
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => setIsRecordModalOpen(true)}
            leftIcon={<Plus className="w-4 h-4" />}
            className="font-bold shadow-xs bg-emerald-600 hover:bg-emerald-700"
          >
            تسجيل دفعة جديدة ({formatCurrency(remainingBalance)})
          </Button>
        )}
      </div>

      {/* KPI Financial Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-2xs">
          <span className="text-xs font-semibold text-slate-500 block mb-1">إجمالي الفاتورة</span>
          <span className="font-mono text-base font-bold text-slate-900 tabular-nums">
            {formatCurrency(totalAmount)}
          </span>
        </div>

        <div className="p-3 bg-emerald-50/50 border border-emerald-200 rounded-xl shadow-2xs">
          <span className="text-xs font-semibold text-emerald-800 block mb-1">المبلغ المحصل فعلياً</span>
          <span className="font-mono text-base font-bold text-emerald-700 tabular-nums">
            {formatCurrency(paidAmount)}
          </span>
        </div>

        <div
          className={`p-3 rounded-xl shadow-2xs border ${
            remainingBalance > 0
              ? 'bg-rose-50/50 border-rose-200 text-rose-900'
              : 'bg-slate-50 border-slate-200 text-slate-700'
          }`}
        >
          <span className="text-xs font-semibold block mb-1">المتبقي المطلوب تحصيله</span>
          <span className="font-mono text-base font-bold tabular-nums">
            {formatCurrency(remainingBalance)}
          </span>
        </div>

        <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-2xs">
          <span className="text-xs font-semibold text-slate-500 block mb-1">موعد الاستحقاق</span>
          <span className="font-mono text-xs font-bold text-slate-800 tabular-nums block mt-1">
            {dueDate ? formatDate(dueDate) : 'غير محدد'}
          </span>
        </div>
      </div>

      {/* Tabs: Payment History vs Planned Schedule */}
      <div className="border border-slate-200 rounded-xl bg-white overflow-hidden shadow-2xs">
        <div className="flex border-b border-slate-200 bg-slate-50/80 px-2 pt-2 gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('payments')}
            className={`px-4 py-2 text-xs font-bold rounded-t-lg transition-colors border-t border-x ${
              activeTab === 'payments'
                ? 'bg-white text-slate-900 border-slate-200 border-b-transparent shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 border-transparent'
            }`}
          >
            سجل الدفعات الفعلية ({payments.length})
          </button>

          {paymentType === 'DEFERRED' && (
            <button
              type="button"
              onClick={() => setActiveTab('schedule')}
              className={`px-4 py-2 text-xs font-bold rounded-t-lg transition-colors border-t border-x ${
                activeTab === 'schedule'
                  ? 'bg-white text-slate-900 border-slate-200 border-b-transparent shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 border-transparent'
              }`}
            >
              جدول الأقساط المخطط ({schedule.length})
            </button>
          )}
        </div>

        {/* Tab 1: Payments History */}
        {activeTab === 'payments' && (
          <div className="p-3 space-y-3">
            {payments.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-500">
                لا توجد دفعات مسجلة حتى الآن على هذه الفاتورة.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-right">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3 w-12 text-center">#</th>
                      <th className="py-2.5 px-3 w-28">تاريخ السداد</th>
                      <th className="py-2.5 px-3 w-32">المبلغ (EGP)</th>
                      <th className="py-2.5 px-3 w-32">طريقة الدفع</th>
                      <th className="py-2.5 px-3 w-32">الموظف / المسجل</th>
                      <th className="py-2.5 px-3">ملاحظات وبيان العملية</th>
                      {!readOnly && onReversePayment && (
                        <th className="py-2.5 px-3 text-center w-24">إجراء</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {payments.map((p, idx) => {
                      const isRev = !!p.is_reversal || p.amount < 0;
                      return (
                        <tr
                          key={p.id}
                          className={`hover:bg-slate-50 ${isRev ? 'bg-rose-50/50 text-rose-900' : ''}`}
                        >
                          <td className="py-2 px-3 text-center font-mono font-semibold text-slate-500">
                            {idx + 1}
                          </td>
                          <td className="py-2 px-3 font-mono text-slate-700 tabular-nums">
                            {formatDate(p.payment_date)}
                          </td>
                          <td className="py-2 px-3 font-mono font-bold tabular-nums">
                            {isRev ? (
                              <span className="text-rose-700">
                                - {formatCurrency(Math.abs(p.amount))}
                              </span>
                            ) : (
                              <span className="text-emerald-700 font-bold">
                                + {formatCurrency(p.amount)}
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3">
                            <span className="bg-slate-100 px-2 py-0.5 rounded text-[11px] font-semibold text-slate-700 border border-slate-200">
                              {p.payment_method}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-slate-600 font-medium">
                            {p.created_by || 'النظام'}
                          </td>
                          <td className="py-2 px-3 text-slate-600">
                            {isRev ? (
                              <span className="text-rose-700 font-semibold">
                                عملية عكس وتصحيح دفعة {p.reversal_reason ? `(${p.reversal_reason})` : ''}
                              </span>
                            ) : (
                              p.notes || '—'
                            )}
                          </td>
                          {!readOnly && onReversePayment && (
                            <td className="py-2 px-3 text-center">
                              {!isRev && (
                                <button
                                  type="button"
                                  onClick={() => setReversalTarget(p)}
                                  title="عكس / إلغاء هذه الدفعة مالياً"
                                  className="text-xs text-rose-600 hover:text-rose-800 font-bold hover:underline"
                                >
                                  عكس الدفعة
                                </button>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Planned Installment Schedule */}
        {activeTab === 'schedule' && paymentType === 'DEFERRED' && (
          <div className="p-3 space-y-3">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <span className="text-xs text-slate-600 font-semibold">
                الأقساط المجدولة مسبقاً (مستقلة عن حركات السداد الفعلية)
              </span>
              {!readOnly && onUpdateSchedule && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleOpenScheduleEdit}
                  leftIcon={<Edit2 className="w-3.5 h-3.5 text-blue-600" />}
                  className="text-xs font-bold border-blue-200 text-blue-800 hover:bg-blue-50"
                >
                  تعديل جدول الأقساط القادمة
                </Button>
              )}
            </div>

            {schedule.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-500">
                لا يوجد جدول أقساط محدد لهذه الفاتورة.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-right">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3 w-16 text-center">رقم القسط</th>
                      <th className="py-2.5 px-3 w-32">تاريخ الاستحقاق</th>
                      <th className="py-2.5 px-3 w-36">المبلغ المخطط (EGP)</th>
                      <th className="py-2.5 px-3 w-28 text-center">حالة الموعد</th>
                      <th className="py-2.5 px-3">ملاحظات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {schedule.map(item => {
                      const isPast = item.due_date < todayStr && remainingBalance > 0;
                      return (
                        <tr
                          key={item.installment_number}
                          className={`hover:bg-slate-50 ${isPast ? 'bg-amber-50/40' : ''}`}
                        >
                          <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-700">
                            {item.installment_number}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-800 font-medium tabular-nums">
                            {formatDate(item.due_date)}
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-900 tabular-nums">
                            {formatCurrency(item.expected_amount)}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {remainingBalance <= 0 ? (
                              <Badge variant="success" size="sm">
                                مسدد
                              </Badge>
                            ) : isPast ? (
                              <Badge variant="danger" size="sm">
                                مستحق متأخر
                              </Badge>
                            ) : (
                              <Badge variant="info" size="sm">
                                قادم
                              </Badge>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600">{item.notes || '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Record Payment Modal */}
      {isRecordModalOpen && (
        <PaymentCollectionModal
          isOpen={isRecordModalOpen}
          onClose={() => setIsRecordModalOpen(false)}
          invoiceNumber={invoiceNumber}
          customerName={customerName}
          totalAmount={totalAmount}
          paidAmount={paidAmount}
          remainingBalance={remainingBalance}
          nextInstallmentAmount={nextAmount}
          onConfirmPayment={onRecordPayment}
        />
      )}

      {/* Reversal Confirmation Modal */}
      {reversalTarget && (
        <Modal
          isOpen={!!reversalTarget}
          onClose={() => setReversalTarget(null)}
          title="عكس وتصحيح دفعة مالية"
          subtitle={`سيتم إنشاء حركة عكس قيد محاسبية دقيقة بقيمة (${formatCurrency(reversalTarget.amount)})`}
          size="md"
          footer={
            <div className="flex items-center justify-between w-full">
              <Button
                variant="outline"
                size="md"
                disabled={isReversing}
                onClick={() => setReversalTarget(null)}
              >
                إلغاء
              </Button>
              <Button
                variant="danger"
                size="md"
                disabled={isReversing || !reversalReason.trim()}
                onClick={handleConfirmReversal}
                leftIcon={isReversing ? <Spinner size="sm" /> : <ShieldAlert className="w-4 h-4" />}
                className="font-bold"
              >
                {isReversing ? 'جارٍ عكس القيد...' : 'تأكيد عكس الدفعة'}
              </Button>
            </div>
          }
        >
          <div className="space-y-4 py-1">
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-900 text-xs space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-sm">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                <span>إشعار النزاهة المالية والمحاسبية:</span>
              </div>
              <p>
                لن يتم حذف الدفعة الأصلية من السجلات التاريخية. بدلاً من ذلك، سيتم تسجيل عملية عكس قيد
                محاسبية بمبلغ سالب مع إعادة حساب رصيد الفاتورة المتبقي وتحديث حالتها تلقائياً.
              </p>
            </div>

            {reversalError && (
              <div className="p-2.5 bg-rose-100 text-rose-900 text-xs font-bold rounded-lg">
                {reversalError}
              </div>
            )}

            <div>
              <label className="text-xs font-bold text-slate-800 block mb-1">
                سبب الإلغاء أو التصحيح <span className="text-rose-600">*</span>
              </label>
              <Input
                type="text"
                placeholder="مثال: تسجيل خاطئ لمبلغ الدفعة، شيك مرتجع، الخ..."
                value={reversalReason}
                onChange={e => setReversalReason(e.target.value)}
                autoFocus
                required
              />
            </div>
          </div>
        </Modal>
      )}

      {/* Edit Installment Schedule Modal */}
      {isScheduleModalOpen && (
        <Modal
          isOpen={isScheduleModalOpen}
          onClose={() => setIsScheduleModalOpen(false)}
          title="تعديل جدول الأقساط القادمة"
          subtitle={`تعديل المواعيد والمبالغ المخططة للأقساط المتبقية (${formatCurrency(remainingBalance)}) دون المساس بسجل الدفعات السابقة`}
          size="lg"
          footer={
            <div className="flex items-center justify-between w-full">
              <Button
                variant="outline"
                size="md"
                disabled={isSavingSchedule}
                onClick={() => setIsScheduleModalOpen(false)}
              >
                إلغاء
              </Button>
              <Button
                variant="primary"
                size="md"
                disabled={isSavingSchedule}
                onClick={handleSaveSchedule}
                leftIcon={isSavingSchedule ? <Spinner size="sm" /> : <CheckCircle2 className="w-4.5 h-4.5" />}
                className="font-bold"
              >
                {isSavingSchedule ? 'جارٍ الحفظ...' : 'حفظ جدول الأقساط المحدث'}
              </Button>
            </div>
          }
        >
          <div className="py-2">
            <InstallmentScheduleBuilder
              remainingBalance={remainingBalance}
              schedule={editableSchedule}
              onChange={setEditableSchedule}
            />
          </div>
        </Modal>
      )}

      <AlertModal
        isOpen={Boolean(scheduleError)}
        onClose={() => setScheduleError(null)}
        type="error"
        title="تعذر حفظ جدول الأقساط"
        message={scheduleError || ''}
      />
    </div>
  );
};
