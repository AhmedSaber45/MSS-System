import React from 'react';
import { Laptop, Store, CheckCircle, Clock } from 'lucide-react';
import type { InventoryStats } from '../types/inventory';

interface StatsBannerProps {
  stats: InventoryStats;
}

export const StatsBanner: React.FC<StatsBannerProps> = ({ stats }) => {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4 my-3 sm:my-5">
      
      {/* Total Models */}
      <div className="bg-white border border-slate-300 rounded-xl p-2.5 sm:p-4 shadow-sm flex items-center justify-between min-w-0">
        <div className="min-w-0">
          <p className="text-[10px] sm:text-xs text-slate-500 font-medium truncate">موديلات بالمخزون</p>
          <p className="text-base sm:text-2xl font-bold text-slate-900 mt-0.5 font-mono tabular-nums">
            {stats.totalModels}
          </p>
        </div>
        <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 shrink-0">
          <Laptop className="w-3.5 h-3.5 sm:w-4.5 sm:h-4.5" />
        </div>
      </div>

      {/* Available Devices */}
      <div className="bg-white border border-slate-300 rounded-xl p-2.5 sm:p-4 shadow-sm flex items-center justify-between min-w-0">
        <div className="min-w-0">
          <p className="text-[10px] sm:text-xs text-slate-500 font-medium truncate">أجهزة متاحة للبيع</p>
          <p className="text-base sm:text-2xl font-bold text-emerald-700 mt-0.5 font-mono tabular-nums flex items-baseline gap-1">
            <span>{stats.availableCount}</span>
            <span className="text-[10px] sm:text-xs font-normal text-slate-500">جهاز</span>
          </p>
        </div>
        <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 shrink-0">
          <CheckCircle className="w-3.5 h-3.5 sm:w-4.5 sm:h-4.5" />
        </div>
      </div>

      {/* Reserved Devices */}
      <div className="bg-white border border-slate-300 rounded-xl p-2.5 sm:p-4 shadow-sm flex items-center justify-between min-w-0">
        <div className="min-w-0">
          <p className="text-[10px] sm:text-xs text-slate-500 font-medium truncate">أجهزة محجوزة</p>
          <p className="text-base sm:text-2xl font-bold text-amber-800 mt-0.5 font-mono tabular-nums flex items-baseline gap-1">
            <span>{stats.reservedCount}</span>
            <span className="text-[10px] sm:text-xs font-normal text-slate-500">جهاز</span>
          </p>
        </div>
        <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-800 shrink-0">
          <Clock className="w-3.5 h-3.5 sm:w-4.5 sm:h-4.5" />
        </div>
      </div>

      {/* Active Branches */}
      <div className="bg-white border border-slate-300 rounded-xl p-2.5 sm:p-4 shadow-sm flex items-center justify-between min-w-0">
        <div className="min-w-0">
          <p className="text-[10px] sm:text-xs text-slate-500 font-medium truncate">فروع متوفر بها أجهزة</p>
          <p className="text-base sm:text-2xl font-bold text-slate-900 mt-0.5 font-mono tabular-nums">
            {stats.branchesCount}
          </p>
        </div>
        <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-blue-700 shrink-0">
          <Store className="w-3.5 h-3.5 sm:w-4.5 sm:h-4.5" />
        </div>
      </div>

    </div>
  );
};
