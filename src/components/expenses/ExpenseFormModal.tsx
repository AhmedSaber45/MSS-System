import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import {
  OperatingExpense,
  NewExpenseInput,
} from '@/types/expenses';
import { getTodayLocalDateString } from '@/lib/dateValidation';
import { ReceiptText, Building2, Calendar, DollarSign, FileText } from 'lucide-react';

export interface ExpenseFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (expense: NewExpenseInput) => Promise<void>;
  initialData?: OperatingExpense | null;
  moduleName: 'accessories' | 'mss';
  availableBranches: string[];
}

export const ExpenseFormModal: React.FC<ExpenseFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
  moduleName,
  availableBranches,
}) => {
  const isAccessories = moduleName === 'accessories';

  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState<string>('');
  const [branch, setBranch] = useState<string>('');
  const [expenseDate, setExpenseDate] = useState<string>(getTodayLocalDateString());
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setTitle(initialData.title);
        setAmount(String(initialData.amount));
        setBranch(initialData.branch || (availableBranches[0] || ''));
        setExpenseDate(initialData.expense_date);
        setDescription(initialData.description || '');
      } else {
        // Reset to clean defaults
        setTitle('');
        setAmount('');
        setBranch(availableBranches[0] || '');
        setExpenseDate(getTodayLocalDateString());
        setDescription('');
      }
      setError(null);
    }
  }, [isOpen, initialData, availableBranches]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError('يرجى إدخال اسم أو بيان المصروف.');
      return;
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('يجب أن يكون المبلغ رقماً موجباً أكبر من صفر.');
      return;
    }

    if (!expenseDate) {
      setError('يرجى اختيار تاريخ المصروف.');
      return;
    }

    // Branch is required for MSS only; Accessories uses dynamic active branch default safely
    if (!isAccessories && !branch.trim()) {
      setError('يرجى اختيار الفرع المسؤول عن المصروف.');
      return;
    }

    // Preserve existing record attributes when editing, or apply standard database schema defaults
    const finalCategory = initialData?.category || 'مصروفات عامة';

    const finalBranch = isAccessories
      ? (initialData?.branch || availableBranches[0] || 'محل 1')
      : branch.trim();

    const finalPaymentSource = isAccessories
      ? (initialData?.payment_source || 'أموال المحل')
      : (initialData?.payment_source || 'أموال الشركة');

    const finalPaymentMethod = initialData?.payment_method || 'نقدي (كاش)';

    setIsSubmitting(true);
    try {
      await onSave({
        title: title.trim(),
        category: finalCategory,
        amount: numAmount,
        branch: finalBranch,
        expense_date: expenseDate,
        payment_source: finalPaymentSource,
        payment_method: finalPaymentMethod,
        description: description.trim() || undefined,
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || 'تعذر حفظ المصروف، يرجى المحاولة مرة أخرى.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        initialData
          ? isAccessories
            ? 'تعديل بيانات المصروف'
            : 'تعديل بيانات المصروف التشغيلي — MSS'
          : isAccessories
          ? 'تسجيل مصروف جديد'
          : 'تسجيل مصروف  جديد — Compu MSS'
      }
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-sm" dir="rtl">
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs font-semibold">
            {error}
          </div>
        )}

        {isAccessories ? (
          <>
            {/* 1. Expense Title */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                الاسم     <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Input
                  type="text"
                  required
                  placeholder="مثال: فاتورة كهرباء، أدوات نظافة، صيانة إضاءة، بنزين ومواصلات..."
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="pr-9"
                />
                <ReceiptText className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
              </div>
            </div>

            {/* 2. Amount & Date in 2 Cols */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  المبلغ المالي (EGP) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Input
                    type="number"
                    step="any"
                    min="0.01"
                    required
                    placeholder="0.00"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    className="pr-9 font-mono font-bold"
                  />
                  <DollarSign className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                   التاريخ <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Input
                    type="date"
                    required
                    value={expenseDate}
                    onChange={e => setExpenseDate(e.target.value)}
                    className="pr-9 font-mono"
                  />
                  <Calendar className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* 3. Description / Notes (Optional) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                ملاحظات وتفاصيل إضافية (اختياري)
              </label>
              <div className="relative">
                <textarea
                  rows={3}
                  placeholder="اكتب أية تفاصيل إضافية تتعلق بالمصروف أو الفاتورة أو المستلم..."
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs text-slate-800"
                />
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Compu MSS: Title, Amount, Date, Branch, Notes (Category, Payment Source, Payment Method removed) */}
            {/* 1. Expense Title */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                الاسم    <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Input
                  type="text"
                  required
                  placeholder="مثال: مرتبات شهر نوفمبر، فاتورة كهرباء، بنزين ومواصلات..."
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="pr-9"
                />
                <ReceiptText className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
              </div>
            </div>

            {/* 2. Amount & Date in 2 Cols */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  المبلغ المالي (EGP) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Input
                    type="number"
                    step="any"
                    min="0.01"
                    required
                    placeholder="0.00"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    className="pr-9 font-mono font-bold"
                  />
                  <DollarSign className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  التاريخ  <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Input
                    type="date"
                    required
                    value={expenseDate}
                    onChange={e => setExpenseDate(e.target.value)}
                    className="pr-9 font-mono"
                  />
                  <Calendar className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* 3. Responsible Branch */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                الفرع المسؤول <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <select
                  value={branch}
                  onChange={e => setBranch(e.target.value)}
                  className="w-full h-10 px-3 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600 font-medium text-slate-900 pr-9"
                >
                  {availableBranches.map(b => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
                <Building2 className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
              </div>
            </div>

            {/* 4. Description / Notes (Optional) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                ملاحظات وتفاصيل إضافية (اختياري)
              </label>
              <div className="relative">
                <textarea
                  rows={3}
                  placeholder="اكتب أية تفاصيل إضافية تتعلق بالمصروف أو الفاتورة أو المستلم..."
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600 text-xs text-slate-800"
                />
              </div>
            </div>
          </>
        )}



        {/* Modal Actions */}
        <div className="pt-3 border-t border-slate-200 flex justify-end gap-2.5">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
            إلغاء
          </Button>
          <Button type="submit" variant="primary" disabled={isSubmitting}>
            {isSubmitting ? 'جارٍ الحفظ...' : initialData ? 'تحديث المصروف' : 'حفظ وتسجيل المصروف'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
