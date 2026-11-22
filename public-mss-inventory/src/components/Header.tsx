'use client';

import React from 'react';
import Image from 'next/image';
import { RefreshCw } from 'lucide-react';
import { formatRelativeTime } from '../lib/utils';

interface HeaderProps {
  lastUpdated: Date | null;
  isRefreshing: boolean;
  onRefresh: () => void;
  isLive: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  lastUpdated,
  isRefreshing,
  onRefresh,
  isLive,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-2xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 sm:py-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-4">
          
          {/* Brand & Title */}
          <div className="flex items-center justify-between sm:justify-start gap-2.5">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-slate-100 border border-slate-300 p-1 flex items-center justify-center shrink-0 shadow-2xs">
                <Image
                  src="/as_icon_512.png"
                  alt="AS System"
                  width={30}
                  height={30}
                  className="object-contain"
                  priority
                />
              </div>
              <div className="text-right">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] sm:text-[11px] font-bold text-teal-800 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200">
                    Compu MSS
                  </span>
                </div>
                <h1 className="text-sm sm:text-base lg:text-lg font-bold text-slate-900 tracking-tight leading-tight mt-0.5">
                  قائمة الأجهزة المتوفرة في الفروع
                </h1>
              </div>
            </div>

            {/* Mobile Refresh Button */}
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className="sm:hidden p-2 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors shrink-0"
              title="تحديث البيانات"
              aria-label="تحديث البيانات"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-teal-600' : ''}`} />
            </button>
          </div>

          {/* Sync Status & Action */}
          <div className="flex items-center justify-between sm:justify-end gap-2 text-xs">
 

            {/* Desktop Refresh Button */}
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 border border-slate-300 text-xs font-semibold transition-all shadow-2xs active:scale-95 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-teal-600' : ''}`} />
              <span>Refresh </span>
            </button>
          </div>

        </div>
      </div>
    </header>
  );
};
