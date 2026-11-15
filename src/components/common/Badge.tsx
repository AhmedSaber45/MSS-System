import React from 'react';
import { cn } from '../../lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'purple' | 'outline';
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({
  className,
  variant = 'default',
  size = 'md',
  children,
  ...props
}) => {
  const variants = {
    default: 'bg-slate-100 text-slate-800 border-slate-300',
    primary: 'bg-blue-50 text-blue-900 border-blue-300',
    success: 'bg-emerald-50 text-emerald-900 border-emerald-300',
    warning: 'bg-amber-50 text-amber-950 border-amber-300',
    danger: 'bg-rose-50 text-rose-900 border-rose-300',
    info: 'bg-sky-50 text-sky-950 border-sky-300',
    purple: 'bg-teal-50 text-teal-950 border-teal-300',
    outline: 'bg-white text-slate-800 border-slate-300',
  };

  const sizes = {
    sm: 'text-xs px-2 py-0.5 leading-tight',
    md: 'text-xs px-2.5 py-1 leading-normal',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-semibold rounded-md border tabular-nums select-none',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
};
