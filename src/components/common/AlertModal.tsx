import React from 'react';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  HelpCircle,
} from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './Button';

export type AlertModalType = 'success' | 'error' | 'warning' | 'info' | 'confirm';

export interface AlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  type?: AlertModalType;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void | Promise<void>;
  isLoading?: boolean;
  confirmVariant?: 'primary' | 'danger' | 'outline';
  zIndexClassName?: string;
}

const TYPE_STYLES: Record<
  AlertModalType,
  { icon: React.ReactNode; badgeBg: string; defaultTitle: string }
> = {
  success: {
    icon: <CheckCircle2 className="w-6 h-6 text-emerald-600" />,
    badgeBg: 'bg-emerald-50 border-emerald-200',
    defaultTitle: 'تمت العملية بنجاح',
  },
  error: {
    icon: <XCircle className="w-6 h-6 text-rose-600" />,
    badgeBg: 'bg-rose-50 border-rose-200',
    defaultTitle: 'حدث خطأ',
  },
  warning: {
    icon: <AlertTriangle className="w-6 h-6 text-amber-600" />,
    badgeBg: 'bg-amber-50 border-amber-200',
    defaultTitle: 'تنبيه',
  },
  info: {
    icon: <Info className="w-6 h-6 text-blue-600" />,
    badgeBg: 'bg-blue-50 border-blue-200',
    defaultTitle: 'معلومة',
  },
  confirm: {
    icon: <HelpCircle className="w-6 h-6 text-amber-600" />,
    badgeBg: 'bg-amber-50 border-amber-200',
    defaultTitle: 'تأكيد الإجراء',
  },
};

export const AlertModal: React.FC<AlertModalProps> = ({
  isOpen,
  onClose,
  type = 'info',
  title,
  message,
  confirmLabel,
  cancelLabel = 'إلغاء',
  onConfirm,
  isLoading = false,
  confirmVariant,
  zIndexClassName = 'z-[70]',
}) => {
  const style = TYPE_STYLES[type];
  const isConfirmMode = type === 'confirm' || Boolean(onConfirm);

  const resolvedConfirmVariant =
    confirmVariant || (type === 'confirm' ? 'danger' : 'primary');

  const resolvedConfirmLabel =
    confirmLabel || (isConfirmMode ? 'تأكيد' : 'حسناً');

  const handleConfirmClick = async () => {
    if (onConfirm) {
      await onConfirm();
    } else {
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        if (!isLoading) onClose();
      }}
      title={title || style.defaultTitle}
      size="sm"
      closeOnBackdrop={!isLoading}
      zIndexClassName={zIndexClassName}
      footer={
        <div className="flex items-center justify-end gap-2.5 w-full" dir="rtl">
          {isConfirmMode && (
            <Button
              type="button"
              variant="outline"
              size="md"
              disabled={isLoading}
              onClick={onClose}
            >
              {cancelLabel}
            </Button>
          )}
          <Button
            type="button"
            variant={resolvedConfirmVariant}
            size="md"
            isLoading={isLoading}
            disabled={isLoading}
            onClick={handleConfirmClick}
          >
            {resolvedConfirmLabel}
          </Button>
        </div>
      }
    >
      <div className="flex items-start gap-3.5 py-1" dir="rtl">
        <div
          className={`w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 ${style.badgeBg}`}
        >
          {style.icon}
        </div>
        <div className="flex-1 min-w-0 pt-0.5">
          <p className="text-sm text-slate-700 leading-relaxed font-medium whitespace-pre-line">
            {message}
          </p>
        </div>
      </div>
    </Modal>
  );
};
