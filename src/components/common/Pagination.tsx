import React from 'react';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface PaginationProps {
  currentPage: number;
  totalItems: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
  className?: string;
  showItemCount?: boolean;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalItems,
  pageSize = 9,
  onPageChange,
  className,
  showItemCount = true,
}) => {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  if (totalItems <= 0) {
    return null;
  }

  // Calculate range displayed (e.g. 1 - 9)
  const fromItem = (safeCurrentPage - 1) * pageSize + 1;
  const toItem = Math.min(safeCurrentPage * pageSize, totalItems);

  // Generate page numbers with smart ellipsis windowing
  const getPageNumbers = (): (number | string)[] => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const pages: (number | string)[] = [];
    pages.push(1);

    if (safeCurrentPage > 3) {
      pages.push('ellipsis-start');
    }

    const start = Math.max(2, safeCurrentPage - 1);
    const end = Math.min(totalPages - 1, safeCurrentPage + 1);

    for (let p = start; p <= end; p++) {
      pages.push(p);
    }

    if (safeCurrentPage < totalPages - 2) {
      pages.push('ellipsis-end');
    }

    pages.push(totalPages);
    return pages;
  };

  const pageNumbers = getPageNumbers();

  return (
    <div
      className={cn(
        'flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 bg-white border-t border-slate-200 select-none text-xs text-slate-700',
        className
      )}
      dir="rtl"
    >
      {/* Record count summary */}
      {showItemCount && (
        <div className="font-medium text-slate-600">
          عرض <span className="font-bold text-slate-900 font-mono tabular-nums">{fromItem}</span> -{' '}
          <span className="font-bold text-slate-900 font-mono tabular-nums">{toItem}</span> من إجمالي{' '}
          <span className="font-bold text-slate-900 font-mono tabular-nums">{totalItems}</span> سجل{' '}
          <span className="text-slate-400 mx-1">•</span>{' '}
          صفحة <span className="font-bold text-slate-900 font-mono tabular-nums">{safeCurrentPage}</span> من{' '}
          <span className="font-bold text-slate-900 font-mono tabular-nums">{totalPages}</span>
        </div>
      )}

      {/* Pagination Controls */}
      <div className="flex items-center gap-1.5 flex-wrap justify-center">
        {/* Previous Button (in RTL, goes rightward) */}
        <button
          type="button"
          onClick={() => onPageChange(safeCurrentPage - 1)}
          disabled={safeCurrentPage <= 1}
          className={cn(
            'flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-colors cursor-pointer',
            safeCurrentPage <= 1
              ? 'border-slate-200 text-slate-300 cursor-not-allowed bg-slate-50'
              : 'border-slate-300 text-slate-700 hover:bg-slate-100 hover:text-slate-900 bg-white'
          )}
          title="الصفحة السابقة"
        >
          <ChevronRight className="w-4 h-4" />
          <span>السابق</span>
        </button>

        {/* Page numbers */}
        {pageNumbers.map((p, idx) => {
          if (typeof p === 'string') {
            return (
              <span
                key={`ellipsis-${idx}`}
                className="px-2 py-1 text-slate-400 font-mono tracking-widest text-xs"
              >
                ...
              </span>
            );
          }

          const isActive = p === safeCurrentPage;
          return (
            <button
              key={`page-${p}`}
              type="button"
              onClick={() => onPageChange(p)}
              className={cn(
                'min-w-8 h-8 px-2 rounded-lg text-xs font-bold font-mono transition-all cursor-pointer tabular-nums',
                isActive
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 hover:text-slate-900'
              )}
            >
              {p}
            </button>
          );
        })}

        {/* Next Button (in RTL, goes leftward) */}
        <button
          type="button"
          onClick={() => onPageChange(safeCurrentPage + 1)}
          disabled={safeCurrentPage >= totalPages}
          className={cn(
            'flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-colors cursor-pointer',
            safeCurrentPage >= totalPages
              ? 'border-slate-200 text-slate-300 cursor-not-allowed bg-slate-50'
              : 'border-slate-300 text-slate-700 hover:bg-slate-100 hover:text-slate-900 bg-white'
          )}
          title="الصفحة التالية"
        >
          <span>التالي</span>
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
