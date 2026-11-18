import React, { useState } from 'react';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { Spinner } from '@/components/common/Spinner';
import { Alert } from '@/components/common/Alert';
import { formatCurrency } from '@/lib/utils';
import { DollarSign, CreditCard, Banknote, Calendar, CheckCircle2, X } from 'lucide-react';

export interface PaymentCollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoiceNumber: string;
  customerName?: string;
  totalAmount: number;
  paidAmount: number;
  remainingBalance: number;
  nextInstallmentAmount?: number;
  onConfirmPayment: (data: {
    amount: number;
    payment_date: string;
    payment_method: string;
    notes?: string;
  }) => Promise<void>;
}

const PAYMENT_METHODS = [
  { id: 'نقدي', label: 'نقدي (كاش)' },
  { id: 'فيزا', label: 'فيزا / بطاقة بنكية' },
  { id: 'تحويل بنكي', label: 'تحويل بنكي' },
  { id: 'فودافون كاش / انستا باي', label: 'انستا باي / فودافون كاش' },
];

export const PaymentCollectionModal: React.FC<PaymentCollectionModalProps> = ({
  isOpen,
  onClose,
  invoiceNumber,
  customerName,
  totalAmount,
  paidAmount,
  remainingBalance,
  nextInstallmentAmount,
  onConfirmPayment,
}) => {
  const [amount, setAmount] = useState<string>(() =>
    nextInstallmentAmount && nextInstallmentAmount <= remainingBalance
      ? String(nextInstallmentAmount)
      : String(remainingBalance)
  );
  const [paymentDate, setPaymentDate] = useState<string>(() =>
    new Date().toISOString().substring(0, 10)
  );
  const [paymentMethod, setPaymentMethod] = useState<string>('نقدي');
  const [notes, setNotes] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Quick set helper
  const handleQuickAmount = (val: number) => {
    setAmount(String(Math.min(remainingBalance, Math.max(0, val))));
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('يرجى إدخال مبلغ سداد صحيح أكبر من الصفر');
      return;
    }

    if (parsedAmount > remainingBalance + 0.001) {
      setError(
        `المبلغ المدخل (${formatCurrency(parsedAmount)}) يتجاوز المتبقي على الفاتورة (${formatCurrency(remainingBalance)})`
      );
      return;
    }

    if (!paymentDate) {
      setError('يرجى تحديد تاريخ السداد الفعلي');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      await onConfirmPayment({
        amount: parsedAmount,
        payment_date: paymentDate,
        payment_method: paymentMethod,
        notes: notes.trim() || undefined,
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || 'حدث خطأ أثناء تسجيل الدفعة في قاعدة البيانات');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={isSubmitting ? () => {} : onClose}
      title="تحصيل دفعة مالية جديدة"
      subtitle={`تسجيل دفعة على الفاتورة رقم (${invoiceNumber}) ${customerName ? `- العميل: ${customerName}` : ''}`}
      size="md"
      footer={
        <div className="flex items-center justify-between w-full">
          <Button
            type="button"
            variant="outline"
            size="md"
            disabled={isSubmitting}
            onClick={onClose}
          >
            إلغاء
          </Button>
          <Button
            type="button"
            variant="primary"
            size="md"
            disabled={isSubmitting || remainingBalance <= 0}
            onClick={handleSubmit}
            leftIcon={isSubmitting ? <Spinner size="sm" /> : <CheckCircle2 className="w-4.5 h-4.5" />}
            className="font-bold shadow-xs"
          >
            {isSubmitting ? 'جارٍ تسجيل الدفعة...' : 'تأكيد وحفظ الدفعة'}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4 py-1">
        {error && <Alert type="danger" title="خطأ" message={error} />}

        {/* Invoice Balance Summary Cards */}
        <div className="grid grid-cols-3 gap-2.5 p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
          <div className="p-2 bg-white rounded-lg border border-slate-200">
            <span className="block text-[11px] font-bold text-slate-500 mb-0.5">إجمالي الفاتورة</span>
            <span className="font-mono font-bold text-slate-900 text-sm tabular-nums">
              {formatCurrency(totalAmount)}
            </span>
          </div>

          <div className="p-2 bg-white rounded-lg border border-slate-200">
            <span className="block text-[11px] font-bold text-emerald-700 mb-0.5">المسدد سابقاً</span>
            <span className="font-mono font-bold text-emerald-700 text-sm tabular-nums">
              {formatCurrency(paidAmount)}
            </span>
          </div>

          <div className="p-2 bg-white rounded-lg border border-rose-200 bg-rose-50/30">
            <span className="block text-[11px] font-bold text-rose-700 mb-0.5">المتبقي المطلوب</span>
            <span className="font-mono font-bold text-rose-700 text-sm tabular-nums">
              {formatCurrency(remainingBalance)}
            </span>
          </div>
        </div>

        {/* Payment Amount */}
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <label className="text-xs font-bold text-slate-800">
              مبلغ الدفعة المسددة (EGP) <span className="text-rose-600">*</span>
            </label>
            <div className="flex items-center gap-1.5">
              {nextInstallmentAmount && nextInstallmentAmount > 0 && nextInstallmentAmount < remainingBalance && (
                <button
                  type="button"
                  onClick={() => handleQuickAmount(nextInstallmentAmount)}
                  className="text-[11px] font-bold text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded border border-blue-200 transition-colors"
                >
                  قيمة القسط ({formatCurrency(nextInstallmentAmount)})
                </button>
              )}
              <button
                type="button"
                onClick={() => handleQuickAmount(remainingBalance)}
                className="text-[11px] font-bold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded border border-slate-300 transition-colors"
              >
                كامل المتبقي ({formatCurrency(remainingBalance)})
              </button>
            </div>
          </div>
          <Input
            type="number"
            min="0.01"
            max={remainingBalance}
            step="10"
            value={amount}
            onChange={e => {
              setAmount(e.target.value);
              if (error) setError('');
            }}
            placeholder="أدخل مبلغ السداد..."
            className="text-lg font-bold font-mono text-slate-900"
            isMonospace
            required
            autoFocus
          />
        </div>

        {/* Date and Method */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              تاريخ السداد الفعلي <span className="text-rose-600">*</span>
            </label>
            <Input
              type="date"
              value={paymentDate}
              onChange={e => setPaymentDate(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">طريقة السداد</label>
            <select
              value={paymentMethod}
              onChange={e => setPaymentMethod(e.target.value)}
              className="w-full h-10 px-3 text-sm font-semibold bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:border-slate-800"
            >
              {PAYMENT_METHODS.map(m => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="text-xs font-bold text-slate-700 block mb-1">ملاحظات التحصيل (اختياري)</label>
          <Input
            type="text"
            placeholder="مثال: سداد القسط الثاني نقداً بالفرع..."
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
        </div>
      </form>
    </Modal>
  );
};
