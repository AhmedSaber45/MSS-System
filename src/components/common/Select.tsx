import React from 'react';
import { cn } from '../../lib/utils';
import { ChevronDown } from 'lucide-react';

export interface SelectOption {
  value: string | number;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
  options?: SelectOption[];
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, helperText, options, children, disabled, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && <label className="block text-sm font-semibold text-slate-800 mb-1.5">{label}</label>}
        <div className="relative">
          <select
            ref={ref}
            disabled={disabled}
            className={cn(
              'w-full h-10 appearance-none px-3.5 pl-9 pr-3.5 bg-white border rounded-lg text-sm text-slate-900',
              'transition-colors duration-150 cursor-pointer',
              'focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900',
              'disabled:bg-slate-50 disabled:text-slate-400 disabled:border-slate-200 disabled:cursor-not-allowed',
              error ? 'border-rose-400 focus:border-rose-600 focus:ring-rose-600' : 'border-slate-300 hover:border-slate-400',
              className
            )}
            {...props}
          >
            {options
              ? options.map(option => (
                  <option key={option.value} value={option.value} disabled={option.disabled}>
                    {option.label}
                  </option>
                ))
              : children}
          </select>
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none flex items-center">
            <ChevronDown className="w-4.5 h-4.5" />
          </div>
        </div>
        {error ? (
          <p className="mt-1.5 text-xs text-rose-600 font-semibold">{error}</p>
        ) : helperText ? (
          <p className="mt-1.5 text-xs text-slate-600 font-normal">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

Select.displayName = 'Select';
