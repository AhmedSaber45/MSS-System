import React, { useState, useEffect } from 'react';
import { Calendar, DollarSign, Plus, Trash2, Calculator, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { formatCurrency } from '@/lib/utils';
import { roundMoney } from '@/lib/accounting';

export interface PlannedInstallmentItem {
  installment_number: number;
  expected_amount: number;
  due_date: string;
  notes?: string;
}

interface InstallmentScheduleBuilderProps {
  remainingBalance: number;
  schedule: PlannedInstallmentItem[];
  onChange: (newSchedule: PlannedInstallmentItem[]) => void;
  disabled?: boolean;
}

export const InstallmentScheduleBuilder: React.FC<InstallmentScheduleBuilderProps> = ({
  remainingBalance,
  schedule,
  onChange,
  disabled = false,
}) => {
  const [installmentsCount, setInstallmentsCount] = useState<number>(() =>
    schedule.length > 0 ? schedule.length : 3
  );
  const [firstDueDate, setFirstDueDate] = useState<string>(() => {
    if (schedule.length > 0 && schedule[0].due_date) {
      return schedule[0].due_date;
    }
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return d.toISOString().substring(0, 10);
  });
  const [intervalMonths, setIntervalMonths] = useState<number>(1);

  // Auto-generate helper
  const handleAutoGenerate = (count = installmentsCount, startDate = firstDueDate, interval = intervalMonths) => {
    if (remainingBalance <= 0 || count <= 0) return;

    const items: PlannedInstallmentItem[] = [];
    const baseAmount = Math.floor((remainingBalance / count) * 100) / 100;
    let distributed = 0;

    const [year, month, day] = startDate.split('-').map(Number);

    for (let i = 1; i <= count; i++) {
      const curDate = new Date(year, month - 1 + (i - 1) * interval, day || 1);
      const pad = (n: number) => String(n).padStart(2, '0');
      const dueStr = `${curDate.getFullYear()}-${pad(curDate.getMonth() + 1)}-${pad(curDate.getDate())}`;

      let amount = baseAmount;
      if (i === count) {
        // Adjust the last installment to absorb any cents rounding discrepancy
        amount = roundMoney(remainingBalance - distributed);
      } else {
        distributed = roundMoney(distributed + amount);
      }

      items.push({
        installment_number: i,
        expected_amount: Math.max(0, amount),
        due_date: dueStr,
        notes: `القسط رقم ${i} من ${count}`,
      });
    }

    onChange(items);
  };

  // If schedule is empty on first render and remainingBalance > 0, generate default schedule
  useEffect(() => {
    if (schedule.length === 0 && remainingBalance > 0) {
      handleAutoGenerate(installmentsCount, firstDueDate, intervalMonths);
    }
  }, [remainingBalance]);

  const handleUpdateItem = (index: number, field: keyof PlannedInstallmentItem, value: any) => {
    const updated = [...schedule];
    updated[index] = {
      ...updated[index],
      [field]: field === 'expected_amount' ? Math.max(0, Number(value) || 0) : value,
    };
    onChange(updated);
  };

  const handleAddItem = () => {
    const nextNum = schedule.length + 1;
    let nextDateStr = new Date().toISOString().substring(0, 10);
    if (schedule.length > 0) {
      const last = schedule[schedule.length - 1];
      const d = new Date(last.due_date);
      d.setMonth(d.getMonth() + 1);
      nextDateStr = d.toISOString().substring(0, 10);
    }

    const currentSum = schedule.reduce((sum, item) => sum + item.expected_amount, 0);
    const diff = roundMoney(Math.max(0, remainingBalance - currentSum));

    onChange([
      ...schedule,
      {
        installment_number: nextNum,
        expected_amount: diff,
        due_date: nextDateStr,
        notes: `القسط رقم ${nextNum}`,
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    const filtered = schedule
      .filter((_, idx) => idx !== index)
      .map((item, idx) => ({
        ...item,
        installment_number: idx + 1,
      }));
    onChange(filtered);
  };

  const totalScheduled = roundMoney(
    schedule.reduce((sum, item) => sum + (Number(item.expected_amount) || 0), 0)
  );
  const discrepancy = roundMoney(remainingBalance - totalScheduled);
  const isBalanced = Math.abs(discrepancy) < 0.01;

  return (
    <div className="space-y-3.5 bg-slate-50/80 p-4 rounded-xl border border-slate-300">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-blue-600" />
          <h4 className="text-sm font-bold text-slate-900">جدولة وتوزيع الأقساط المتوقعة</h4>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-600 font-medium">المتبقي المطلوب جدولته:</span>
          <span className="font-mono font-bold text-slate-900 text-sm tabular-nums">
            {formatCurrency(remainingBalance)}
          </span>
        </div>
      </div>

      {/* Auto generator controls */}
      {!disabled && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 items-end bg-white p-3 rounded-lg border border-slate-200">
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">عدد الأقساط</label>
            <Input
              type="number"
              min="1"
              max="60"
              value={installmentsCount}
              onChange={e => {
                const c = Math.max(1, parseInt(e.target.value, 10) || 1);
                setInstallmentsCount(c);
              }}
              className="text-center font-bold text-xs"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">تاريخ استحقاق أول قسط</label>
            <Input
              type="date"
              value={firstDueDate}
              onChange={e => setFirstDueDate(e.target.value)}
              className="text-xs"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">الفترة بين كل قسط</label>
            <select
              value={intervalMonths}
              onChange={e => setIntervalMonths(parseInt(e.target.value, 10) || 1)}
              className="w-full h-9 px-2 text-xs font-semibold bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:border-slate-800"
            >
              <option value={1}>شهرياً (كل شهر)</option>
              <option value={2}>كل شهرين</option>
              <option value={3}>ربع سنوي (كل 3 أشهر)</option>
              <option value={6}>نصف سنوي (كل 6 أشهر)</option>
            </select>
          </div>

          <div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleAutoGenerate()}
              leftIcon={<Calculator className="w-3.5 h-3.5 text-blue-600" />}
              className="w-full text-xs font-bold border-blue-200 bg-blue-50/50 hover:bg-blue-100 text-blue-900 h-9"
            >
              توزيع تلقائي بالتساوي
            </Button>
          </div>
        </div>
      )}

      {/* Installments Table */}
      <div className="overflow-x-auto border border-slate-200 rounded-lg bg-white">
        <table className="w-full text-xs text-right">
          <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
            <tr>
              <th className="py-2 px-3 text-center w-12">#</th>
              <th className="py-2 px-3 w-40">تاريخ الاستحقاق</th>
              <th className="py-2 px-3 w-36">المبلغ المتوقع (EGP)</th>
              <th className="py-2 px-3">ملاحظات</th>
              {!disabled && <th className="py-2 px-3 text-center w-14">حذف</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {schedule.map((item, idx) => (
              <tr key={item.installment_number || idx} className="hover:bg-slate-50/70">
                <td className="py-2 px-3 text-center font-bold text-slate-600 font-mono">
                  {item.installment_number}
                </td>
                <td className="py-2 px-3">
                  <Input
                    type="date"
                    value={item.due_date}
                    disabled={disabled}
                    onChange={e => handleUpdateItem(idx, 'due_date', e.target.value)}
                    className="h-8 text-xs py-1"
                  />
                </td>
                <td className="py-2 px-3">
                  <Input
                    type="number"
                    min="0"
                    step="50"
                    value={item.expected_amount || ''}
                    disabled={disabled}
                    onChange={e => handleUpdateItem(idx, 'expected_amount', e.target.value)}
                    className="h-8 text-xs py-1 font-bold font-mono text-left"
                    isMonospace
                  />
                </td>
                <td className="py-2 px-3">
                  <Input
                    type="text"
                    value={item.notes || ''}
                    disabled={disabled}
                    placeholder="ملاحظات اختيارية..."
                    onChange={e => handleUpdateItem(idx, 'notes', e.target.value)}
                    className="h-8 text-xs py-1"
                  />
                </td>
                {!disabled && (
                  <td className="py-2 px-3 text-center">
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(idx)}
                      disabled={schedule.length <= 1}
                      title="حذف هذا القسط"
                      className="p-1 text-slate-400 hover:text-rose-600 disabled:opacity-20 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add installment row manually */}
      {!disabled && (
        <div className="flex justify-between items-center pt-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleAddItem}
            leftIcon={<Plus className="w-3.5 h-3.5" />}
            className="text-xs font-bold text-slate-700 hover:text-slate-900"
          >
            إضافة قسط يدوي
          </Button>

          {/* Validation Status message */}
          <div className="flex items-center gap-2 text-xs font-semibold">
            {isBalanced ? (
              <span className="flex items-center gap-1.5 text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>إجمالي الأقساط متطابق تماماً مع المتبقي ({formatCurrency(totalScheduled)})</span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-rose-800 bg-rose-50 px-2.5 py-1 rounded-md border border-rose-200">
                <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                <span>
                  {discrepancy > 0
                    ? `متبقي بدون جدولة: ${formatCurrency(discrepancy)}`
                    : `مجموع الأقساط يزيد عن المتبقي بـ ${formatCurrency(Math.abs(discrepancy))}`}
                </span>
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
