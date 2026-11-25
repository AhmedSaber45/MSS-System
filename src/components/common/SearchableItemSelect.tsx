import React, { useState, useMemo } from 'react';
import { Search, X, Check, CheckSquare, Square } from 'lucide-react';
import { Input } from './Input';
import { Badge } from './Badge';

export interface SearchableItemSelectProps<T> {
  items: T[];
  selectedId?: string | null;
  selectedIds?: string[];
  onSelect?: (item: T) => void;
  onMultiSelectChange?: (selectedIds: string[]) => void;
  onItemToggle?: (item: T, isSelected: boolean) => void;
  isMulti?: boolean;
  checkboxPosition?: 'start' | 'end';
  placeholder?: string;
  emptyMessage?: string;
  getKey: (item: T) => string;
  getSearchableText: (item: T) => string;
  renderItem: (item: T, isSelected: boolean) => React.ReactNode;
  isItemDisabled?: (item: T) => boolean;
  maxHeight?: string;
  className?: string;
}

export function SearchableItemSelect<T>({
  items,
  selectedId,
  selectedIds = [],
  onSelect,
  onMultiSelectChange,
  onItemToggle,
  isMulti = false,
  checkboxPosition = 'start',
  placeholder = 'بحث في القائمة بالاسم، الموديل، السيريال...',
  emptyMessage = 'لا توجد عناصر مطابقة للبحث',
  getKey,
  getSearchableText,
  renderItem,
  isItemDisabled,
  maxHeight = 'max-h-64',
  className = '',
}: SearchableItemSelectProps<T>): React.ReactElement {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const q = searchQuery.trim().toLowerCase();
    return items.filter(item => {
      const text = getSearchableText(item).toLowerCase();
      return text.includes(q);
    });
  }, [items, searchQuery, getSearchableText]);

  const eligibleFilteredItems = useMemo(() => {
    return isItemDisabled ? filteredItems.filter(it => !isItemDisabled(it)) : filteredItems;
  }, [filteredItems, isItemDisabled]);

  const allFilteredSelected = useMemo(() => {
    if (eligibleFilteredItems.length === 0) return false;
    const selectedSet = new Set(selectedIds);
    return eligibleFilteredItems.every(it => selectedSet.has(getKey(it)));
  }, [eligibleFilteredItems, selectedIds, getKey]);

  const anyFilteredSelected = useMemo(() => {
    if (filteredItems.length === 0) return false;
    const selectedSet = new Set(selectedIds);
    return filteredItems.some(it => selectedSet.has(getKey(it)));
  }, [filteredItems, selectedIds, getKey]);

  const handleToggleMulti = (id: string, item: T) => {
    if (isItemDisabled && isItemDisabled(item) && !selectedIds.includes(id)) {
      return;
    }
    const isCurrentlySelected = selectedIds.includes(id);
    const nextSelected = isCurrentlySelected
      ? selectedIds.filter(x => x !== id)
      : [...selectedIds, id];

    if (onMultiSelectChange) {
      onMultiSelectChange(nextSelected);
    }
    if (onItemToggle) {
      onItemToggle(item, !isCurrentlySelected);
    }
  };

  const handleSelectAllFiltered = () => {
    if (eligibleFilteredItems.length === 0) return;
    const filteredKeys = eligibleFilteredItems.map(getKey);
    const combined = Array.from(new Set([...selectedIds, ...filteredKeys]));
    if (onMultiSelectChange) {
      onMultiSelectChange(combined);
    } else if (onItemToggle) {
      for (const it of eligibleFilteredItems) {
        const k = getKey(it);
        if (!selectedIds.includes(k)) {
          onItemToggle(it, true);
        }
      }
    }
  };

  const handleDeselectAllFiltered = () => {
    if (filteredItems.length === 0) return;
    const filteredKeys = new Set(filteredItems.map(getKey));
    if (onMultiSelectChange) {
      onMultiSelectChange(selectedIds.filter(id => !filteredKeys.has(id)));
    } else if (onItemToggle) {
      for (const it of filteredItems) {
        const k = getKey(it);
        if (selectedIds.includes(k)) {
          onItemToggle(it, false);
        }
      }
    }
  };

  return (
    <div className={`flex flex-col border border-slate-300 rounded-xl bg-white overflow-hidden shadow-2xs ${className}`}>
      {/* Search Input Bar */}
      <div className="p-2 border-b border-slate-200 bg-slate-50/70">
        <div className="relative">
          <Input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={placeholder}
            leftIcon={<Search className="w-4 h-4 text-slate-400" />}
            className="text-xs pr-8"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded"
              title="مسح البحث"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Multi-select Header Controls */}
        {isMulti && (
          <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-slate-200 text-[11px] text-slate-600">
            <span>
              تم تحديد <strong className="font-bold text-slate-900">{selectedIds.length}</strong> من أصل {items.length}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSelectAllFiltered}
                disabled={eligibleFilteredItems.length === 0 || allFilteredSelected}
                className="text-blue-600 hover:underline font-semibold disabled:text-slate-400 disabled:no-underline disabled:cursor-not-allowed cursor-pointer"
              >
                تحديد المعروض ({eligibleFilteredItems.length})
              </button>
              <span>|</span>
              <button
                type="button"
                onClick={handleDeselectAllFiltered}
                disabled={!anyFilteredSelected}
                className="text-rose-600 hover:underline font-semibold disabled:text-slate-400 disabled:no-underline disabled:cursor-not-allowed cursor-pointer"
              >
                إلغاء المعروض
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Options List */}
      <div className={`overflow-y-auto divide-y divide-slate-100 ${maxHeight}`}>
        {filteredItems.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500">
            {emptyMessage}
          </div>
        ) : (
          filteredItems.map(item => {
            const key = getKey(item);
            const isSelected = isMulti ? selectedIds.includes(key) : selectedId === key;

            const checkboxEl = (
              <div
                className="shrink-0 flex items-center"
                onClick={e => {
                  e.stopPropagation();
                  if (isMulti) {
                    handleToggleMulti(key, item);
                  } else if (onSelect) {
                    onSelect(item);
                  }
                }}
              >
                {isMulti ? (
                  <button
                    type="button"
                    aria-label={isSelected ? 'إلغاء التحديد' : 'تحديد'}
                    className="p-0.5 rounded hover:bg-slate-200/50 cursor-pointer focus:outline-none flex items-center justify-center"
                  >
                    {isSelected ? (
                      <CheckSquare className="w-5 h-5 text-blue-600 stroke-[2.2]" />
                    ) : (
                      <Square className="w-5 h-5 text-slate-300 hover:text-slate-500" />
                    )}
                  </button>
                ) : isSelected ? (
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center">
                    <Check className="w-3 h-3 stroke-[3]" />
                  </span>
                ) : null}
              </div>
            );

            return (
              <div
                key={key}
                onClick={() => {
                  if (isMulti) {
                    handleToggleMulti(key, item);
                  } else if (onSelect) {
                    onSelect(item);
                  }
                }}
                className={`p-2.5 text-xs cursor-pointer transition-colors flex items-center justify-between gap-3 ${
                  isSelected
                    ? 'bg-blue-50/80 hover:bg-blue-100/70 border-r-4 border-r-blue-600 font-medium'
                    : 'hover:bg-slate-50 text-slate-700'
                }`}
              >
                {checkboxPosition === 'start' && checkboxEl}

                <div className="flex-1 min-w-0">
                  {renderItem(item, isSelected)}
                </div>

                {checkboxPosition === 'end' && checkboxEl}
              </div>
            );
          })
        )}
      </div>

      {/* Footer Info */}
      <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-200 text-[10px] text-slate-500 flex items-center justify-between">
        <span>المعروض: {filteredItems.length} عنصر</span>
        {searchQuery && (
          <span className="text-blue-600 font-medium">مفلتر بواسطة: &quot;{searchQuery}&quot;</span>
        )}
      </div>
    </div>
  );
}
