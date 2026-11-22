'use client';

import React from 'react';
import { Search, MapPin, ArrowDownUp, X } from 'lucide-react';
import type { InventoryFilters, DynamicStore, MSSDeviceStatus } from '../types/inventory';

interface SearchAndFiltersProps {
  filters: InventoryFilters;
  stores: DynamicStore[];
  categories: string[];
  onFilterChange: (newFilters: Partial<InventoryFilters>) => void;
  onClearFilters: () => void;
  hasActiveFilters: boolean;
}

export const SearchAndFilters: React.FC<SearchAndFiltersProps> = ({
  filters,
  stores,
  categories,
  onFilterChange,
  onClearFilters,
  hasActiveFilters,
}) => {
  const statusOptions: { id: 'ALL' | MSSDeviceStatus; label: string }[] = [
    { id: 'AVAILABLE', label: 'متوفر' },
    { id: 'RESERVED', label: 'محجوز' },
    { id: 'SOLD', label: 'مباع' },
    { id: 'ALL', label: 'الكل' },
  ];

  return (
    <div className="bg-white border border-slate-300 rounded-xl p-3.5 sm:p-5 mb-4 sm:mb-5 shadow-sm space-y-3.5">
      {/* Search Bar & Sort Dropdown */}
      <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3">
        {/* Search Bar */}
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={filters.searchQuery}
            onChange={(e) => onFilterChange({ searchQuery: e.target.value })}
            placeholder="ابحث باسم الموديل، الماركة، المعالج أو المواصفات..."
            className="w-full pl-8 pr-9 py-2 rounded-lg bg-white border border-slate-300 focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600 text-xs sm:text-sm text-slate-900 placeholder-slate-400 transition-colors"
          />
          {filters.searchQuery && (
            <button
              onClick={() => onFilterChange({ searchQuery: '' })}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1"
              aria-label="مسح البحث"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Sort Select & Reset */}
        <div className="flex items-center gap-2">
          <div className="flex-1 sm:flex-none flex items-center justify-between gap-1.5 px-3 py-2 rounded-lg bg-slate-50 border border-slate-300 text-xs sm:text-sm text-slate-700">
            <div className="flex items-center gap-1.5">
              <ArrowDownUp className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <select
                value={filters.sortBy}
                onChange={(e) => onFilterChange({ sortBy: e.target.value as any })}
                aria-label="ترتيب حسب"
                className="bg-transparent border-none text-slate-900 font-medium focus:outline-none cursor-pointer text-xs sm:text-sm"
              >
               
                <option value="price-asc">السعر: الأقل أولاً</option>
                <option value="price-desc">السعر: الأعلى أولاً</option>
                <option value="qty-desc">الكمية: الأكثر أولاً</option>
              </select>
            </div>
          </div>

          {hasActiveFilters && (
            <button
              onClick={onClearFilters}
              className="px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-300 shrink-0 flex items-center gap-1 transition-colors"
              title="إعادة ضبط الفلاتر"
            >
              <X className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">إعادة ضبط</span>
            </button>
          )}
        </div>
      </div>

      {/* Status Filter & Dynamic Branch Filter */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-3 border-t border-slate-200">
        
        {/* Status Filter (Default: AVAILABLE) */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-slate-700 text-xs shrink-0">الحالة:</span>
          <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-300 gap-1 flex-wrap">
            {statusOptions.map((opt) => {
              const isActive = filters.selectedStatus === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => onFilterChange({ selectedStatus: opt.id })}
                  className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-white text-slate-900 shadow-sm font-bold border border-slate-300'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Dynamic Branch Filter (From Supabase system_stores) */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 text-xs text-slate-700 font-bold shrink-0">
            <MapPin className="w-3.5 h-3.5 text-teal-700" />
            <span>الفرع:</span>
          </div>
          <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-300 gap-1 flex-wrap">
            <button
              onClick={() => onFilterChange({ selectedBranch: 'all' })}
              className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs font-semibold transition-all ${
                filters.selectedBranch === 'all'
                  ? 'bg-white text-slate-900 shadow-sm font-bold border border-slate-300'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              كافة الفروع
            </button>
            {stores.map((s) => (
              <button
                key={s.id}
                onClick={() => onFilterChange({ selectedBranch: s.name })}
                className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  filters.selectedBranch === s.name
                    ? 'bg-white text-slate-900 shadow-sm font-bold border border-slate-300'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {s.name}
              </button>
            ))}
          </div>
        </div>

        {/* Category Filter */}
        {categories.length > 1 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-slate-700 shrink-0">القسم:</span>
            <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-300 gap-1 flex-wrap">
              <button
                onClick={() => onFilterChange({ selectedCategory: 'all' })}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                  filters.selectedCategory === 'all'
                    ? 'bg-white text-slate-900 shadow-sm font-bold border border-slate-300'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                الكل
              </button>
              {categories.map((c) => (
                <button
                  key={c}
                  onClick={() => onFilterChange({ selectedCategory: c })}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                    filters.selectedCategory === c
                      ? 'bg-white text-slate-900 shadow-sm font-bold border border-slate-300'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
