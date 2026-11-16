import React from 'react';
import { cn } from '../../lib/utils';
import { Inbox } from 'lucide-react';
import { Skeleton } from './Spinner';

export interface Column<T> {
  key: string;
  header: string;
  render?: (item: T, index: number) => React.ReactNode;
  className?: string;
  align?: 'right' | 'center' | 'left';
}

export interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T, index: number) => string | number;
  isLoading?: boolean;
  emptyMessage?: string;
  emptySubMessage?: string;
  className?: string;
  density?: 'normal' | 'compact';
  onRowClick?: (item: T) => void;
}

export function Table<T>({
  columns,
  data,
  keyExtractor,
  isLoading = false,
  emptyMessage = 'لا توجد بيانات متاحة حالياً',
  emptySubMessage,
  className,
  density = 'normal',
  onRowClick,
}: TableProps<T>) {
  const isCompact = density === 'compact';
  return (
    <div className="w-full overflow-hidden border border-slate-300 rounded-xl bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className={cn('w-full text-right text-sm text-slate-800', className)}>
          <thead className="bg-slate-100/90 text-sm font-semibold text-slate-700 border-b border-slate-300 select-none">
            <tr>
              {columns.map(col => (
                <th
                  key={col.key}
                  className={cn(
                    isCompact ? 'px-3 py-2.5 text-xs' : 'px-4 py-3 text-sm',
                    'whitespace-nowrap font-semibold',
                    col.align === 'center'
                      ? 'text-center'
                      : col.align === 'left'
                      ? 'text-left'
                      : 'text-right',
                    col.className
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-sm">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, idx) => (
                <tr key={`skeleton-${idx}`}>
                  {columns.map((_, colIdx) => (
                    <td
                      key={`skel-col-${colIdx}`}
                      className={cn(isCompact ? 'px-3 py-2' : 'px-4 py-3.5')}
                    >
                      <Skeleton className="h-4 w-full rounded" />
                    </td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-center">
                  <div className="flex flex-col items-center justify-center">
                    <div className="p-3.5 bg-slate-100 border border-slate-300 rounded-xl text-slate-500 mb-3">
                      <Inbox className="w-8 h-8" />
                    </div>
                    <p className="text-sm font-bold text-slate-700">{emptyMessage}</p>
                    {emptySubMessage && (
                      <p className="text-xs text-slate-500 mt-1 max-w-sm font-medium">{emptySubMessage}</p>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              data.map((item, index) => (
                <tr
                  key={keyExtractor(item, index)}
                  onClick={() => onRowClick && onRowClick(item)}
                  className={cn(
                    'hover:bg-slate-50 transition-colors',
                    onRowClick && 'cursor-pointer'
                  )}
                >
                  {columns.map(col => (
                    <td
                      key={col.key}
                      className={cn(
                        isCompact ? 'px-3 py-2 text-xs' : 'px-4 py-3 text-sm',
                        'whitespace-nowrap text-slate-800 tabular-nums',
                        col.align === 'center'
                          ? 'text-center'
                          : col.align === 'left'
                          ? 'text-left'
                          : 'text-right',
                        col.className
                      )}
                    >
                      {col.render
                        ? col.render(item, index)
                        : (item as Record<string, unknown>)[col.key] !== undefined
                        ? String((item as Record<string, unknown>)[col.key])
                        : '-'}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
