import React from 'react';
import { cn } from '../../lib/utils';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost' | 'success' | 'mss';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      children,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      disabled,
      leftIcon,
      rightIcon,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center font-semibold rounded-lg transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-1 disabled:opacity-50 disabled:pointer-events-none select-none';

    const variants = {
      primary:
        'bg-slate-900 text-white hover:bg-slate-800 active:bg-slate-950 border border-slate-900 shadow-sm',
      secondary:
        'bg-slate-100 text-slate-800 hover:bg-slate-200 active:bg-slate-300 border border-slate-300 shadow-sm',
      outline:
        'border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 hover:border-slate-400 hover:text-slate-900 active:bg-slate-100 shadow-sm',
      danger:
        'bg-rose-700 text-white hover:bg-rose-800 active:bg-rose-900 border border-rose-700 shadow-sm',
      ghost:
        'text-slate-700 hover:bg-slate-100 hover:text-slate-900 active:bg-slate-200',
      success:
        'bg-emerald-700 text-white hover:bg-emerald-800 active:bg-emerald-900 border border-emerald-700 shadow-sm',
      mss:
        'bg-teal-700 text-white hover:bg-teal-800 active:bg-teal-900 border border-teal-700 shadow-sm',
    };

    const sizes = {
      sm: 'h-8.5 text-xs px-3 gap-2 font-medium',
      md: 'h-10 text-sm px-4 gap-2.5 font-semibold',
      lg: 'h-11 text-base px-5 gap-3 font-semibold',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      >
        {isLoading ? (
          <Loader2 className={cn('animate-spin text-current shrink-0', size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4')} />
        ) : (
          leftIcon && <span className="inline-flex shrink-0 items-center justify-center">{leftIcon}</span>
        )}
        <span>{children}</span>
        {!isLoading && rightIcon && <span className="inline-flex shrink-0 items-center justify-center">{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';
