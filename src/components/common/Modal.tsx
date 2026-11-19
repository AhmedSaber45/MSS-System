import React, { useEffect } from 'react';
import { cn } from '../../lib/utils';
import { X } from 'lucide-react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | 'full';
  children: React.ReactNode;
  footer?: React.ReactNode;
  closeOnBackdrop?: boolean;
  zIndexClassName?: string;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  size = 'md',
  children,
  footer,
  closeOnBackdrop = true,
  zIndexClassName,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    '2xl': 'max-w-5xl',
    '3xl': 'max-w-6xl',
    full: 'max-w-[96vw] h-[92vh]',
  };

  return (
    <div className={cn('fixed inset-0 overflow-y-auto', zIndexClassName || 'z-50')}>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/30 transition-opacity duration-150"
        onClick={() => closeOnBackdrop && onClose()}
      />

      {/* Dialog box */}
      <div className="flex min-h-full items-center justify-center p-2 sm:p-4">
        <div
          className={cn(
            'relative w-full max-w-[calc(100vw-1rem)] bg-white rounded-2xl shadow-modal border border-slate-300 overflow-hidden transition-all min-w-0',
            sizeClasses[size]
          )}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-4 sm:px-6 py-4.5 border-b border-slate-200 flex items-center justify-between bg-slate-50/90 gap-3">
            <div className="min-w-0 flex-1">
              <h3 className="text-base sm:text-lg font-bold text-slate-900 truncate">{title}</h3>
              {subtitle && <p className="text-xs sm:text-sm text-slate-600 mt-1 truncate">{subtitle}</p>}
            </div>
            <button
              onClick={onClose}
              className="text-slate-500 hover:text-slate-800 p-1.5 rounded-lg hover:bg-slate-200/70 transition-colors shrink-0"
              aria-label="إغلاق"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="p-3 sm:p-6 max-h-[calc(88vh-90px)] overflow-y-auto overflow-x-auto text-slate-800 text-sm min-w-0">
            {children}
          </div>

          {/* Footer */}
          {footer && (
            <div className="px-4 sm:px-6 py-3.5 sm:py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3 flex-wrap">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
