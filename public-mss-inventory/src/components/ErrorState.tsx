import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface ErrorStateProps {
  message?: string;
  onRetry: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({ message, onRetry }) => {
  return (
    <div className="bg-white border border-rose-300 rounded-xl p-6 sm:p-8 text-center my-6 shadow-sm">
      <div className="w-11 h-11 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center mx-auto text-rose-700 mb-3">
        <AlertCircle className="w-6 h-6" />
      </div>
      <h3 className="text-sm font-bold text-slate-900 mb-1">
        تعذر تحميل بيانات المخزون المباشر
      </h3>
      <p className="text-xs text-slate-600 max-w-md mx-auto mb-4 leading-relaxed">
        {message || 'حدث خطأ أثناء الاتصال بقاعدة البيانات. يُرجى التحقق من الاتصال وإعادة المحاولة.'}
      </p>
      <button
        onClick={onRetry}
        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-rose-700 hover:text-rose-900 text-xs font-semibold border border-rose-300 shadow-2xs transition-colors"
      >
        <RefreshCw className="w-3.5 h-3.5" />
        <span>إعادة المحاولة الآن</span>
      </button>
    </div>
  );
};
