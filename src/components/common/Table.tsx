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
  onRowClick,
}: TableProps<T>) {
  return (
    <div className="w-full overflow-hidden border border-slate-200/90 rounded-xl bg-white shadow-subtle">
      <div className="overflow-x-auto">
        <table className={cn('w-full text-right text-sm text-slate-700', className)}>
          <thead className="bg-slate-50/90 text-xs font-medium text-slate-600 border-b border-slate-200/90 select-none">
            <tr>
              {columns.map(col => (
                <th
                  key={col.key}
                  className={cn(
                    'px-4 py-2.5 whitespace-nowrap',
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
          <tbody className="divide-y divide-slate-100 text-[13px]">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, idx) => (
                <tr key={`skeleton-${idx}`}>
                  {columns.map((_, colIdx) => (
                    <td key={`skel-col-${colIdx}`} className="px-4 py-3">
                      <Skeleton className="h-3.5 w-full rounded" />
                    </td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center">
                  <div className="flex flex-col items-center justify-center">
                    <div className="p-2 bg-slate-50 border border-slate-100 rounded-lg text-slate-400 mb-2">
                      <Inbox className="w-5 h-5" />
                    </div>
                    <p className="text-xs font-medium text-slate-600">{emptyMessage}</p>
                    {emptySubMessage && (
                      <p className="text-[11px] text-slate-400 mt-0.5 max-w-sm">{emptySubMessage}</p>
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
                    'hover:bg-slate-50/70 transition-colors',
                    onRowClick && 'cursor-pointer'
                  )}
                >
                  {columns.map(col => (
                    <td
                      key={col.key}
                      className={cn(
                        'px-4 py-2.5 whitespace-nowrap text-slate-700 tabular-nums',
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
