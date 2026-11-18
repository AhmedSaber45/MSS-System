import React from 'react';
import { cn } from '../../lib/utils';
import { AlertCircle, CheckCircle2, Info, AlertTriangle, X } from 'lucide-react';

export type AlertVariant = 'info' | 'success' | 'warning' | 'danger' | 'error';

export interface AlertProps {
  type?: AlertVariant;
  variant?: AlertVariant;
  title?: string;
  message?: string;
  children?: React.ReactNode;
  onDismiss?: () => void;
  className?: string;
}

export const Alert: React.FC<AlertProps> = ({
  type,
  variant,
  title,
  message,
  children,
  onDismiss,
  className,
}) => {
  const rawType = variant || type || 'info';
  const effectiveType = rawType === 'error' ? 'danger' : rawType;
  const configs = {
    info: {
      bg: 'bg-sky-50 border-sky-300 text-sky-950',
      icon: <Info className="w-5 h-5 text-sky-700 shrink-0 mt-0.5" />,
    },
    success: {
      bg: 'bg-emerald-50 border-emerald-300 text-emerald-950',
      icon: <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />,
    },
    warning: {
      bg: 'bg-amber-50 border-amber-300 text-amber-950',
      icon: <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />,
    },
    danger: {
      bg: 'bg-rose-50 border-rose-300 text-rose-950',
      icon: <AlertCircle className="w-5 h-5 text-rose-700 shrink-0 mt-0.5" />,
    },
  };

  const current = configs[effectiveType] || configs.info;

  return (
    <div
      className={cn(
        'flex items-start gap-3.5 p-4 rounded-xl border text-sm',
        current.bg,
        className
      )}
    >
      {current.icon}
      <div className="flex-1">
        {title && <h5 className="font-bold text-sm mb-1">{title}</h5>}
        {message && <p className="text-sm leading-relaxed font-normal">{message}</p>}
        {children}
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="text-current opacity-70 hover:opacity-100 p-1 rounded transition-opacity"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};
