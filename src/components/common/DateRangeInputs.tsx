import React from 'react';
import { Calendar, AlertCircle, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface DateRangeInputsProps {
  startDate: string;
  endDate: string;
  onStartDateChange: (val: string) => void;
  onEndDateChange: (val: string) => void;
  onClear?: () => void;
  error?: string;
  maxStartDate?: string;
  minEndDate?: string;
  maxEndDate?: string;
  label?: string;
  className?: string;
  disabled?: boolean;
}

export const DateRangeInputs: React.FC<DateRangeInputsProps> = ({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  onClear,
  error,
  maxStartDate,
  minEndDate,
  maxEndDate,
  label,
  className,
  disabled = false,
}) => {
  const hasDates = Boolean(startDate || endDate);

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      {label && (
        <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5 select-none">
          <Calendar className="w-3.5 h-3.5 text-slate-500" />
          {label}
        </span>
      )}

      <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
        {/* From Date */}
        <div className="relative flex-1 min-w-[130px]">
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 select-none pointer-events-none">
            من
          </span>
          <input
            type="date"
            value={startDate}
            max={maxStartDate}
            disabled={disabled}
            onChange={e => onStartDateChange(e.target.value)}
            className={cn(
              'w-full py-1.5 pr-8 pl-2.5 text-xs font-mono font-semibold rounded-lg border bg-white text-slate-800 transition-colors',
              'focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-slate-600',
              error ? 'border-rose-400 bg-rose-50/30' : 'border-slate-300',
              disabled && 'opacity-50 cursor-not-allowed bg-slate-100'
            )}
            title="من تاريخ (لا يمكن اختيار تاريخ مستقبلي)"
          />
        </div>

        <span className="text-xs font-bold text-slate-400 select-none">إلى</span>

        {/* To Date */}
        <div className="relative flex-1 min-w-[130px]">
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 select-none pointer-events-none">
            إلى
          </span>
          <input
            type="date"
            value={endDate}
            min={minEndDate}
            max={maxEndDate}
            disabled={disabled}
            onChange={e => onEndDateChange(e.target.value)}
            className={cn(
              'w-full py-1.5 pr-8 pl-2.5 text-xs font-mono font-semibold rounded-lg border bg-white text-slate-800 transition-colors',
              'focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-slate-600',
              error ? 'border-rose-400 bg-rose-50/30' : 'border-slate-300',
              disabled && 'opacity-50 cursor-not-allowed bg-slate-100'
            )}
            title="إلى تاريخ (لا يمكن اختيار تاريخ مستقبلي أو سابق لتاريخ البداية)"
          />
        </div>

        {/* Clear Button */}
        {hasDates && onClear && (
          <button
            type="button"
            onClick={onClear}
            disabled={disabled}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
            title="مسح نطاق التواريخ"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Validation Error Message */}
      {error && (
        <div className="flex items-center gap-1.5 text-rose-600 text-xs font-medium mt-0.5 animate-fadeIn">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};
