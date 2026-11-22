import React from 'react';
import { Inbox, RotateCcw } from 'lucide-react';

interface EmptyStateProps {
  hasFilters: boolean;
  onResetFilters?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  hasFilters,
  onResetFilters,
}) => {
  return (
    <div className="bg-white border border-slate-300 rounded-xl p-8 sm:p-12 text-center my-6 shadow-sm">
      <div className="p-3.5 bg-slate-100 border border-slate-300 rounded-xl text-slate-500 inline-flex items-center justify-center mb-3">
        <Inbox className="w-8 h-8" />
      </div>
      <h3 className="text-sm sm:text-base font-bold text-slate-800 mb-1">
        {hasFilters
          ? 'لا توجد أجهزة مطابقة لمعايير البحث المحددة'
          : 'لا توجد أجهزة متوفرة حالياً في الفروع'}
      </h3>
      <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4 font-medium leading-relaxed">
        {hasFilters
          ? 'جرّب البحث بكلمات أخرى أو تغيير الفلتر وحالة الجهاز المعروضة.'
          : 'يتم تحديث قائمة المخزون تلقائياً فور تسجيل أو استلام أجهزة جديدة.'}
      </p>
      {hasFilters && onResetFilters && (
        <button
          onClick={onResetFilters}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold border border-slate-300 transition-colors shadow-2xs"
        >
          <RotateCcw className="w-3.5 h-3.5 text-slate-600" />
          <span>إعادة ضبط البحث والفلاتر</span>
        </button>
      )}
    </div>
  );
};
