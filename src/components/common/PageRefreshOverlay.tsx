import React from 'react';
import { usePageRefresh } from '../../context/PageRefreshContext';
import { useNavigation } from '../../context/NavigationContext';
import { Spinner } from './Spinner';
import { cn } from '../../lib/utils';

export interface PageRefreshOverlayProps {
  className?: string;
  customMessage?: string;
  isControlled?: boolean;
  isVisible?: boolean;
}

export const PageRefreshOverlay: React.FC<PageRefreshOverlayProps> = ({
  className,
  customMessage,
  isControlled = false,
  isVisible: controlledVisible,
}) => {
  const { isRefreshing, refreshMessage } = usePageRefresh();
  const { currentSection } = useNavigation();

  const visible = isControlled ? !!controlledVisible : isRefreshing;
  const message = customMessage || refreshMessage || 'جارٍ تحديث البيانات...';
  const isAccessories = currentSection === 'accessories';

  if (!visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn(
        'absolute inset-0 z-40 flex flex-col items-center justify-center',
        'bg-slate-50/90 backdrop-blur-xs transition-opacity duration-200 select-none animate-in fade-in',
        className
      )}
      dir="rtl"
    >
      <div className="flex flex-col items-center justify-center p-8 sm:p-10 bg-white rounded-2xl border border-slate-200/90 shadow-md space-y-4 max-w-sm w-full mx-4 text-center">
        <div className="w-12 h-12 rounded-xl bg-slate-900 flex items-center justify-center p-2 shadow-xs border border-slate-800">
          <img
            src="/assets/branding/as_logo_gold.png"
            alt="AS System"
            className="w-full h-full object-contain select-none"
          />
        </div>

        <div className="relative flex items-center justify-center">
          <Spinner
            size="xl"
            className={cn(isAccessories ? 'text-blue-600' : 'text-teal-700')}
          />
        </div>

        <div className="space-y-1">
          <h3 className="text-base font-bold text-slate-900 leading-snug">
            {message}
          </h3>
          <p className="text-xs font-semibold text-slate-500">
            يرجى الانتظار لحظات ريثما يتم جلب أحدث البيانات
          </p>
        </div>
      </div>
    </div>
  );
};
