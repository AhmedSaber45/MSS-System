import React from 'react';
import { useNotification, NotificationItem } from '../../context/NotificationContext';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';
import { cn } from '../../lib/utils';

export const ToastContainer: React.FC = () => {
  const { notifications, dismissNotification } = useNotification();

  if (notifications.length === 0) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {notifications.map(item => (
        <ToastItem key={item.id} item={item} onDismiss={() => dismissNotification(item.id)} />
      ))}
    </div>
  );
};

const ToastItem: React.FC<{ item: NotificationItem; onDismiss: () => void }> = ({
  item,
  onDismiss,
}) => {
  const icons = {
    success: <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />,
    error: <AlertCircle className="w-4 h-4 text-rose-700 shrink-0" />,
    warning: <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />,
    info: <Info className="w-4 h-4 text-sky-700 shrink-0" />,
  };

  const borders = {
    success: 'border-emerald-200 bg-white',
    error: 'border-rose-200 bg-white',
    warning: 'border-amber-200 bg-white',
    info: 'border-sky-200 bg-white',
  };

  return (
    <div
      className={cn(
        'pointer-events-auto flex items-start gap-2.5 p-3.5 rounded-lg shadow-dropdown border text-right transition-all duration-150',
        borders[item.type]
      )}
    >
      <div className="mt-0.5">{icons[item.type]}</div>
      <div className="flex-1">
        <h4 className="text-xs font-semibold text-slate-900">{item.title}</h4>
        {item.message && <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{item.message}</p>}
      </div>
      <button
        onClick={onDismiss}
        className="text-slate-400 hover:text-slate-700 p-0.5 rounded transition-colors"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
