import React from 'react';
import { cn } from '../../lib/utils';
import { X, ScanBarcode } from 'lucide-react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  onClear?: () => void;
  isMonospace?: boolean;
  scannerReady?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      label,
      error,
      helperText,
      leftIcon,
      rightIcon,
      onClear,
      isMonospace = false,
      scannerReady = false,
      value,
      disabled,
      ...props
    },
    ref
  ) => {
    return (
      <div className="w-full">
        {label && (
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-sm font-semibold text-slate-800">{label}</label>
            {scannerReady && (
              <span className="inline-flex items-center gap-1.5 text-xs text-blue-900 bg-blue-50 border border-blue-300 px-2 py-0.5 rounded-md font-semibold">
                <ScanBarcode className="w-3.5 h-3.5 text-blue-700" />
                جاهز للمسح
              </span>
            )}
          </div>
        )}
        <div className="relative flex items-center">
          {leftIcon && (
            <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none flex items-center">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            value={value}
            disabled={disabled}
            className={cn(
              'w-full h-10 px-3.5 bg-white border rounded-lg text-sm text-slate-900 placeholder:text-slate-400',
              'transition-colors duration-150',
              'focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900',
              'disabled:bg-slate-50 disabled:text-slate-400 disabled:border-slate-200 disabled:cursor-not-allowed',
              error ? 'border-rose-400 focus:border-rose-600 focus:ring-rose-600' : 'border-slate-300 hover:border-slate-400',
              leftIcon ? 'pr-10' : 'pr-3.5',
              rightIcon || onClear ? 'pl-10' : 'pl-3.5',
              isMonospace && 'font-mono text-left tracking-wide tabular-nums',
              className
            )}
            {...props}
          />
          {onClear && value && !disabled && (
            <button
              type="button"
              onClick={onClear}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-800 p-1 rounded transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          {rightIcon && !onClear && (
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none flex items-center">
              {rightIcon}
            </div>
          )}
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

Input.displayName = 'Input';
