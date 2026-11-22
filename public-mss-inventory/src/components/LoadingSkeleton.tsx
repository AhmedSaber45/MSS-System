import React from 'react';

export const LoadingSkeleton: React.FC = () => {
  return (
    <div className="space-y-4 my-5">
      {/* Table Skeleton */}
      <div className="hidden md:block rounded-xl border border-slate-300 bg-white p-4 shadow-sm">
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="flex items-center justify-between p-3 rounded-lg bg-slate-50 animate-pulse border border-slate-200"
            >
              <div className="space-y-2 w-1/4">
                <div className="h-4 bg-slate-200 rounded w-3/4" />
                <div className="h-3 bg-slate-200 rounded w-1/2" />
              </div>
              <div className="h-4 bg-slate-200 rounded w-1/4" />
              <div className="h-6 bg-slate-200 rounded w-20" />
              <div className="h-6 bg-slate-200 rounded w-16" />
              <div className="h-6 bg-slate-200 rounded w-24" />
            </div>
          ))}
        </div>
      </div>

      {/* Mobile Cards Skeleton */}
      <div className="grid grid-cols-1 gap-3 md:hidden">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-slate-300 bg-white p-4 space-y-3 animate-pulse shadow-sm"
          >
            <div className="flex justify-between">
              <div className="h-4 bg-slate-200 rounded w-1/3" />
              <div className="h-4 bg-slate-200 rounded w-1/4" />
            </div>
            <div className="h-5 bg-slate-200 rounded w-2/3" />
            <div className="h-8 bg-slate-100 rounded w-full" />
            <div className="flex justify-between pt-2">
              <div className="h-5 bg-slate-200 rounded w-1/4" />
              <div className="h-6 bg-slate-200 rounded w-1/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
