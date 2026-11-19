import React, { useState, useMemo, useRef, useEffect } from 'react';
import type { MSSDevice, MSSModel } from '@/types/mssInventory';
import type { PromotionalLaptopItem, PromotionalDisplayOptions } from '@/types/mssPromotional';
import {
  preparePromotionalItems,
  generatePromotionalArabicFilename,
  renderPromotionalToCanvas,
  exportPromotionalAsPng,
  exportPromotionalAsPdf,
  sortPromotionalItems,
} from '@/services/mssPromotionalService.ts';
import { formatCurrency } from '@/lib/utils';
import { Button } from '@/components/common/Button';
import { Badge } from '@/components/common/Badge';
import { Modal } from '@/components/common/Modal';
import { useNotification } from '@/context/NotificationContext';
import {
  Sparkles,
  Download,
  FileDown,
  Image as ImageIcon,
  CheckSquare,
  Square,
  Search,
  Filter,
  Laptop,
  Edit3,
  RotateCcw,
  SlidersHorizontal,
  X,
  Check,
  Trash2,
  ArrowUpDown,
  Tag,
  Cpu,
  Layers,
  HardDrive,
  Monitor,
  Eye,
  ChevronLeft,
  ChevronRight,
  Package,
} from 'lucide-react';

export interface MSSPromotionalGeneratorProps {
  devices: MSSDevice[];
  models: MSSModel[];
}

/**
 * Brand Logo badge component for HTML DOM preview table.
 */
const BrandBadgePreview: React.FC<{ brand: string }> = ({ brand }) => {
  const b = (brand || '').trim();
  const bUpper = b.toUpperCase();

  if (bUpper.includes('HP')) {
    return (
      <div className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-[#0b2e6d] border border-sky-400 text-white font-bold italic text-xs shadow-2xs">
        hp
      </div>
    );
  }
  if (bUpper.includes('DELL')) {
    return (
      <div className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-white border-2 border-[#0076ce] text-[#0076ce] font-extrabold text-[9px] tracking-tight shadow-2xs">
        DELL
      </div>
    );
  }
  if (bUpper.includes('LENOVO')) {
    return (
      <div className="inline-flex items-center justify-center px-1.5 py-0.5 rounded bg-[#e2231a] text-white font-bold text-[10px] tracking-tight shadow-2xs">
        Lenovo
      </div>
    );
  }
  if (bUpper.includes('APPLE')) {
    return (
      <div className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-900 text-white font-bold text-xs shadow-2xs">
        
      </div>
    );
  }
  if (bUpper.includes('MICROSOFT')) {
    return (
      <div className="inline-flex items-center gap-1">
        <div className="grid grid-cols-2 gap-0.5 w-3.5 h-3.5">
          <span className="bg-[#f25022] w-1.5 h-1.5" />
          <span className="bg-[#7fba00] w-1.5 h-1.5" />
          <span className="bg-[#00a4ef] w-1.5 h-1.5" />
          <span className="bg-[#ffb900] w-1.5 h-1.5" />
        </div>
        <span className="text-[10px] font-bold text-slate-800">MS</span>
      </div>
    );
  }
  return (
    <div className="inline-flex items-center justify-center px-2 py-0.5 rounded bg-slate-200 text-slate-800 font-bold text-[10px]">
      {b.slice(0, 8)}
    </div>
  );
};

interface PromotionalPosterPageProps {
  pageItems: PromotionalLaptopItem[];
  pageIndex: number;
  totalPages: number;
  displayOptions: PromotionalDisplayOptions;
  id?: string;
  className?: string;
}

const PromotionalPosterPage: React.FC<PromotionalPosterPageProps> = ({
  pageItems,
  pageIndex,
  totalPages,
  displayOptions,
  id,
  className = '',
}) => {
  return (
    <div
      id={id}
      className={`w-[1000px] shrink-0 bg-white rounded-xl shadow-2xl border border-slate-300 overflow-hidden text-slate-900 ${className}`}
      dir="rtl"
    >
      {/* 1. Royal Blue Header Section */}
      <div className="relative bg-gradient-to-b from-[#04102e] via-[#07205b] to-[#0c3582] p-6 text-center text-white overflow-hidden">
        {/* Subtle Central Radial Glow */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(37,99,235,0.3)_0,transparent_70%)] pointer-events-none" />

        {/* Left Angled Laptop Illustration */}
        <div className="absolute left-6 top-5 w-44 h-32 hidden sm:block pointer-events-none opacity-95">
          <svg viewBox="0 0 200 150" className="w-full h-full drop-shadow-[0_10px_10px_rgba(0,0,0,0.5)]">
            <path d="M20,105 L140,115 L180,138 L5,130 Z" fill="#cbd5e1" stroke="#64748b" strokeWidth="1.5" />
            <path d="M30,110 L130,118 L150,128 L15,123 Z" fill="#334155" />
            <path d="M30,10 L160,20 L140,115 L20,105 Z" fill="#0f172a" stroke="#94a3b8" strokeWidth="2.5" />
            <path d="M35,16 L155,25 L137,108 L26,100 Z" fill="url(#scenicGradient)" />
            <defs>
              <linearGradient id="scenicGradient" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#0284c7" />
                <stop offset="50%" stopColor="#38bdf8" />
                <stop offset="100%" stopColor="#0f766e" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        {/* Right Angled Laptop Illustration */}
        <div className="absolute right-6 top-5 w-44 h-32 hidden sm:block pointer-events-none opacity-95">
          <svg viewBox="0 0 200 150" className="w-full h-full drop-shadow-[0_10px_10px_rgba(0,0,0,0.5)] transform -scale-x-100">
            <path d="M20,105 L140,115 L180,138 L5,130 Z" fill="#cbd5e1" stroke="#64748b" strokeWidth="1.5" />
            <path d="M30,110 L130,118 L150,128 L15,123 Z" fill="#334155" />
            <path d="M30,10 L160,20 L140,115 L20,105 Z" fill="#0f172a" stroke="#94a3b8" strokeWidth="2.5" />
            <path d="M35,16 L155,25 L137,108 L26,100 Z" fill="url(#bloomGradient)" />
            <defs>
              <linearGradient id="bloomGradient" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#60a5fa" />
                <stop offset="50%" stopColor="#2563eb" />
                <stop offset="100%" stopColor="#090d16" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        {/* COMPU MSS Branding Pill */}
        <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-white/10 border border-sky-400/40 text-sky-300 text-xs font-bold tracking-widest uppercase mb-2">
          {displayOptions.storeName || 'COMPU MSS'}
        </div>

        {/* Main Headline */}
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight drop-shadow-md">
          {displayOptions.headline || 'متوفر بفضل الله'}
        </h1>

        {/* Secondary Headline & Yellow Swoosh */}
        <div className="relative inline-block mt-1">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#facc15] tracking-tight drop-shadow-sm">
            {displayOptions.subHeadline || 'أعلى جودة بأقل سعر'}
          </h2>
          <svg viewBox="0 0 300 20" className="w-full h-4 mt-0.5 text-[#facc15]" fill="none" stroke="currentColor">
            <path d="M10,12 Q150,22 290,6" strokeWidth="4" strokeLinecap="round" />
          </svg>
        </div>
      </div>

      {/* 2. Structured Specifications Table */}
      <div className="p-4 sm:p-5">
        <table className="w-full text-xs text-right border-collapse border border-slate-300">
          <thead className="bg-[#071d49] text-white font-bold text-center border-b-2 border-slate-400">
            <tr>
              <th className="py-3 px-2 w-24">
                <div className="flex flex-col items-center gap-1">
                  <Tag className="w-4 h-4 text-sky-400" />
                  <span>الماركة</span>
                </div>
              </th>
              <th className="py-3 px-3 text-right">
                <div className="flex items-center gap-1 justify-start">
                  <Laptop className="w-4 h-4 text-sky-400" />
                  <span>الموديل</span>
                </div>
              </th>
              <th className="py-3 px-2 w-20">
                <div className="flex flex-col items-center gap-1">
                  <Cpu className="w-4 h-4 text-sky-400" />
                  <span>المعالج</span>
                </div>
              </th>
              <th className="py-3 px-2 w-28">
                <div className="flex flex-col items-center gap-1">
                  <Layers className="w-4 h-4 text-sky-400" />
                  <span>الجيل</span>
                </div>
              </th>
              <th className="py-3 px-2 w-16">
                <div className="flex flex-col items-center gap-1">
                  <span className="text-[10px] text-sky-400 font-mono font-bold">RAM</span>
                  <span>الرام</span>
                </div>
              </th>
              <th className="py-3 px-2 w-28">
                <div className="flex flex-col items-center gap-1">
                  <HardDrive className="w-4 h-4 text-sky-400" />
                  <span>الهارد</span>
                </div>
              </th>
              <th className="py-3 px-2 w-24">
                <div className="flex flex-col items-center gap-1">
                  <Monitor className="w-4 h-4 text-sky-400" />
                  <span>الشاشة</span>
                </div>
              </th>
              <th className="py-3 px-2 w-28">
                <div className="flex flex-col items-center gap-1">
                  <span className="text-[10px] text-sky-400 font-mono font-bold">GPU</span>
                  <span>كارت الشاشة</span>
                </div>
              </th>
              {displayOptions.showQuantity && (
                <th className="py-3 px-2 w-16 text-center">
                  <div className="flex flex-col items-center gap-1">
                    <Package className="w-4 h-4 text-sky-400" />
                    <span>الكمية</span>
                  </div>
                </th>
              )}
              {displayOptions.showPrice && (
                <th className="py-3 px-3 w-28 text-center bg-[#05163b]">
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-[10px] text-amber-400 font-mono font-bold">EGP</span>
                    <span className="text-amber-300">السعر (جنيه)</span>
                  </div>
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {pageItems.map((item, idx) => {
              const isEven = idx % 2 === 0;
              const gpuUpper = (item.gpu || '').toUpperCase();
              const isNvidia = gpuUpper.includes('NVIDIA') || gpuUpper.includes('RTX') || gpuUpper.includes('GTX');
              const isAmd = gpuUpper.includes('AMD') || gpuUpper.includes('RADEON');
              const isIntel = gpuUpper.includes('INTEL');

              return (
                <tr key={item.id} className={`transition-colors ${isEven ? 'bg-white' : 'bg-[#f8faff]'}`}>
                  <td className="py-2.5 px-2 text-center border-l border-slate-200">
                    <BrandBadgePreview brand={item.brand} />
                  </td>
                  <td className="py-2.5 px-3 font-bold text-slate-900 border-l border-slate-200">
                    <div>{item.model_name}</div>
                  </td>
                  <td className="py-2.5 px-2 text-center font-bold text-slate-800 border-l border-slate-200 font-mono">
                    {item.processor || '---'}
                  </td>
                  <td className="py-2.5 px-2 text-center font-semibold text-slate-700 border-l border-slate-200">
                    {item.generation || '---'}
                  </td>
                  <td className="py-2.5 px-2 text-center font-mono font-bold text-slate-800 border-l border-slate-200">
                    {item.ram || '---'}
                  </td>
                  <td className="py-2.5 px-2 text-center font-mono text-slate-800 border-l border-slate-200">
                    {item.storage || '---'}
                  </td>
                  <td className="py-2.5 px-2 text-center text-slate-700 border-l border-slate-200 font-mono">
                    {item.screen || '---'}
                  </td>
                  <td
                    className={`py-2.5 px-2 text-center font-bold border-l border-slate-200 ${
                      isNvidia ? 'text-emerald-700' : isAmd ? 'text-rose-600' : isIntel ? 'text-blue-700' : 'text-slate-700'
                    }`}
                  >
                    {item.gpu || '---'}
                  </td>
                  {displayOptions.showQuantity && (
                    <td className="py-2.5 px-2 text-center font-bold text-slate-900 border-l border-slate-200">
                      {item.quantity || 1}
                    </td>
                  )}
                  {displayOptions.showPrice && (
                    <td className="py-2.5 px-3 text-center font-extrabold text-[#0a2558] text-sm tabular-nums">
                      {item.price ? Number(item.price).toLocaleString('en-US') : '---'}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 3. Poster Footer */}
      <div className="p-4 bg-slate-50 border-t border-slate-200 text-center space-y-1">
        {totalPages > 1 && (
          <div className="inline-block px-3 py-0.5 rounded-full bg-[#0c3582] text-[#facc15] text-xs font-bold mb-1">
            صفحة {pageIndex + 1} من {totalPages}
          </div>
        )}
        <p className="text-xs sm:text-sm font-bold text-slate-900">
          COMPU MSS — أجهزة أصلية معتمدة مع الضمان الشامل
        </p>
        <p className="text-[11px] text-slate-500">
          للحجز والاستفسار يرجى التواصل عبر الرسائل أو الاتصال • الفروع: محل 1 • محل 2
        </p>
      </div>
    </div>
  );
};

export const MSSPromotionalGenerator: React.FC<MSSPromotionalGeneratorProps> = ({
  devices,
  models,
}) => {
  const { showNotification } = useNotification();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // 1. Initial items prepared from available devices
  const allAvailableItems = useMemo(() => {
    return preparePromotionalItems(devices, models);
  }, [devices, models]);

  // 2. Selection & Filter State
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [selectedModelIds, setSelectedModelIds] = useState<string[]>([]);
  const [minPrice, setMinPrice] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [priceSortOrder, setPriceSortOrder] = useState<'asc' | 'desc'>('asc');

  // Auto-select all on first load
  useEffect(() => {
    if (allAvailableItems.length > 0 && selectedItemIds.size === 0) {
      setSelectedItemIds(new Set(allAvailableItems.map(it => it.id)));
    }
  }, [allAvailableItems]);

  // Extract distinct available brands for filter dropdown/chips
  const availableBrands = useMemo(() => {
    const bSet = new Set<string>();
    allAvailableItems.forEach(it => {
      if (it.brand && it.brand !== '---') bSet.add(it.brand.trim());
    });
    return Array.from(bSet).sort((a, b) => a.localeCompare(b, 'ar'));
  }, [allAvailableItems]);

  // Extract distinct models dynamically filtered by selected brands
  const filteredModels = useMemo(() => {
    if (selectedBrands.length === 0) return models;
    const brandSet = new Set(selectedBrands.map(b => b.trim().toLowerCase()));
    return models.filter(m => brandSet.has((m.brand || '').trim().toLowerCase()));
  }, [models, selectedBrands]);

  // Automatically prune selectedModelIds when selectedBrands changes
  useEffect(() => {
    if (selectedBrands.length > 0) {
      const validIds = new Set(filteredModels.map(m => m.id));
      setSelectedModelIds(prev => prev.filter(id => validIds.has(id)));
    }
  }, [selectedBrands, filteredModels]);

  // Filtered devices list strictly matching all active filters
  const visibleItems = useMemo(() => {
    return allAvailableItems.filter(item => {
      const itemBrand = (item.brand || '').trim().toLowerCase();
      const itemModelId = (item.original_model_id || '').trim().toLowerCase();
      const itemModelName = (item.model_name || '').trim().toLowerCase();

      // Multi-brand filter (OR logic across selected brands)
      if (selectedBrands.length > 0) {
        const brandSet = new Set(selectedBrands.map(b => b.trim().toLowerCase()));
        if (!brandSet.has(itemBrand)) return false;
      }

      // Multi-model filter (OR logic across selected models)
      // Note: If brands are selected but no models are selected, all models of selected brands are included!
      if (selectedModelIds.length > 0) {
        const modelSet = new Set(selectedModelIds.map(id => id.trim().toLowerCase()));
        if (!modelSet.has(itemModelId) && !modelSet.has(itemModelName)) return false;
      }

      // Price range filter: Min price
      const p = item.price || 0;
      if (minPrice && !isNaN(Number(minPrice)) && Number(minPrice) > 0) {
        if (p < Number(minPrice)) return false;
      }

      // Price range filter: Max price
      if (maxPrice && !isNaN(Number(maxPrice)) && Number(maxPrice) > 0) {
        if (p > Number(maxPrice)) return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const comb = `${item.brand} ${item.model_name} ${item.processor} ${item.generation || ''} ${item.gpu} ${item.ram} ${item.storage} ${item.screen}`.toLowerCase();
        if (!comb.includes(q)) return false;
      }

      return true;
    });
  }, [allAvailableItems, selectedBrands, selectedModelIds, minPrice, maxPrice, searchQuery]);

  // Sorted items based on price sort order (with Brand & Model tie-breaker)
  const sortedVisibleItems = useMemo(() => {
    return sortPromotionalItems(visibleItems, priceSortOrder);
  }, [visibleItems, priceSortOrder]);

  // Automatically synchronize selected items with active filters:
  // - Retain only selected IDs that match currently visible filtered items
  // - If filters change to a non-empty subset and no items were selected in that subset yet, auto-select all visible
  useEffect(() => {
    const visibleIdSet = new Set(visibleItems.map(it => it.id));
    setSelectedItemIds(prev => {
      const next = new Set<string>();
      prev.forEach(id => {
        if (visibleIdSet.has(id)) {
          next.add(id);
        }
      });
      // If none of previous selections match the new filter, default to selecting all visible items
      if (next.size === 0 && visibleItems.length > 0) {
        return new Set(visibleItems.map(it => it.id));
      }
      return next;
    });
  }, [visibleItems]);

  // 3. Selection Handlers
  const handleToggleSelectAllVisible = () => {
    const next = new Set(selectedItemIds);
    const allVisibleSelected =
      sortedVisibleItems.length > 0 && sortedVisibleItems.every(it => next.has(it.id));

    if (allVisibleSelected) {
      // Deselect visible
      sortedVisibleItems.forEach(it => next.delete(it.id));
    } else {
      // Select all visible
      sortedVisibleItems.forEach(it => next.add(it.id));
    }
    setSelectedItemIds(next);
  };

  const handleToggleItem = (id: string) => {
    const next = new Set(selectedItemIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedItemIds(next);
  };

  const handleResetFilters = () => {
    setSelectedBrands([]);
    setSelectedModelIds([]);
    setMinPrice('');
    setMaxPrice('');
    setSearchQuery('');
  };

  // Selected items within visible filter scope
  const selectedVisibleCount = useMemo(() => {
    return visibleItems.filter(it => selectedItemIds.has(it.id)).length;
  }, [visibleItems, selectedItemIds]);

  const allVisibleSelected =
    sortedVisibleItems.length > 0 && sortedVisibleItems.every(it => selectedItemIds.has(it.id));

  // 4. Promotional Display Options State
  const [displayOptions, setDisplayOptions] = useState<PromotionalDisplayOptions>({
    showPrice: true,
    showQuantity: false,
    storeName: 'COMPU MSS',
    headline: 'متوفر بفضل الله',
    subHeadline: 'أعلى جودة بأقل سعر',
    itemsPerPage: 12,
  });

  // 5. Editable Preview Modal State & Pagination
  const [isPreviewOpen, setIsPreviewOpen] = useState<boolean>(false);
  const [previewItems, setPreviewItems] = useState<PromotionalLaptopItem[]>([]);
  const [currentPageIndex, setCurrentPageIndex] = useState<number>(0);
  const [itemsPerPage, setItemsPerPage] = useState<number>(12);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<PromotionalLaptopItem>>({});
  const [isExportingPng, setIsExportingPng] = useState<boolean>(false);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);

  // Open Preview Modal with the selected items (strictly filtered from visible items)
  const handleOpenPreviewModal = () => {
    const selected = visibleItems.filter(it => selectedItemIds.has(it.id));

    if (visibleItems.length === 0) {
      showNotification({
        type: 'warning',
        title: 'لا توجد أجهزة مطابقة للفلاتر',
        message: 'لا توجد أجهزة مطابقة لخيارات الفلترة المحددة حالياً. يرجى تعديل خيارات الفلترة.',
      });
      return;
    }

    if (selected.length === 0) {
      showNotification({
        type: 'warning',
        title: 'لم يتم تحديد أي أجهزة',
        message: 'يرجى تحديد جهاز واحد على الأقل من الأجهزة المطابقة لإنشاء التصميم الترويجي.',
      });
      return;
    }

    // Deep clone to isolate temporary preview edits from database records
    const clonedItems: PromotionalLaptopItem[] = JSON.parse(JSON.stringify(selected));
    const sorted = sortPromotionalItems(clonedItems, priceSortOrder);
    setPreviewItems(sorted);
    setEditingItemId(null);
    setCurrentPageIndex(0);
    setIsPreviewOpen(true);
  };

  const handleSortOrderChange = (newOrder: 'asc' | 'desc') => {
    setPriceSortOrder(newOrder);
    setPreviewItems(prev => sortPromotionalItems(prev, newOrder));
  };

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(previewItems.length / itemsPerPage));
  const activePageItems = useMemo(() => {
    const start = currentPageIndex * itemsPerPage;
    return previewItems.slice(start, start + itemsPerPage);
  }, [previewItems, currentPageIndex, itemsPerPage]);

  // Synchronize canvas whenever previewItems, options, or page changes
  useEffect(() => {
    if (isPreviewOpen && canvasRef.current && previewItems.length > 0) {
      renderPromotionalToCanvas(
        previewItems,
        {
          ...displayOptions,
          pageIndex: currentPageIndex,
          itemsPerPage,
        },
        canvasRef.current
      );
    }
  }, [isPreviewOpen, previewItems, displayOptions, currentPageIndex, itemsPerPage]);

  // Edit in-memory item in preview modal
  const handleStartEditItem = (item: PromotionalLaptopItem) => {
    setEditingItemId(item.id);
    setEditFormData({ ...item });
  };

  const handleSaveItemEdit = () => {
    if (!editingItemId) return;
    setPreviewItems(prev =>
      prev.map(it => (it.id === editingItemId ? { ...it, ...editFormData } : it))
    );
    setEditingItemId(null);
    setEditFormData({});
    showNotification({
      type: 'info',
      title: 'تم تحديث بيانات المعاينة',
      message: 'تم تحديث المواصفات المعروضة في التصميم مؤقتاً للتصدير فقط.',
    });
  };

  const handleCancelItemEdit = () => {
    setEditingItemId(null);
    setEditFormData({});
  };

  const handleRemoveFromPreview = (id: string) => {
    setPreviewItems(prev => {
      const next = prev.filter(it => it.id !== id);
      const newTotal = Math.max(1, Math.ceil(next.length / itemsPerPage));
      if (currentPageIndex >= newTotal) {
        setCurrentPageIndex(Math.max(0, newTotal - 1));
      }
      return next;
    });
  };

  // 6. Export Handlers
  const handleExportPng = () => {
    if (!canvasRef.current || previewItems.length === 0) return;
    setIsExportingPng(true);
    try {
      renderPromotionalToCanvas(
        previewItems,
        {
          ...displayOptions,
          pageIndex: currentPageIndex,
          itemsPerPage,
        },
        canvasRef.current
      );
      const filename = generatePromotionalArabicFilename(
        previewItems,
        'png',
        totalPages > 1 ? currentPageIndex + 1 : undefined
      );
      exportPromotionalAsPng(canvasRef.current, filename);
      showNotification({
        type: 'success',
        title: 'تم تصدير الصورة الترويجية بنجاح',
        message: `تم تحميل التصميم بدقة عالية: ${filename}`,
      });
    } catch (err: any) {
      console.error('Failed to export promotional PNG:', err);
      showNotification({
        type: 'error',
        title: 'فشل تصدير الصورة',
        message: err.message || 'حدث خطأ أثناء تصدير الصورة الترويجية.',
      });
    } finally {
      setIsExportingPng(false);
    }
  };

  // Download all pages sequentially as PNG
  const handleExportAllPagesPng = async () => {
    if (!canvasRef.current || previewItems.length === 0) return;
    setIsExportingPng(true);
    try {
      for (let p = 0; p < totalPages; p++) {
        renderPromotionalToCanvas(
          previewItems,
          {
            ...displayOptions,
            pageIndex: p,
            itemsPerPage,
          },
          canvasRef.current
        );
        const filename = generatePromotionalArabicFilename(previewItems, 'png', p + 1);
        exportPromotionalAsPng(canvasRef.current, filename);
        // Small pause between downloads to let browser process
        await new Promise(res => setTimeout(res, 200));
      }
      // Restore canvas to current page
      renderPromotionalToCanvas(
        previewItems,
        {
          ...displayOptions,
          pageIndex: currentPageIndex,
          itemsPerPage,
        },
        canvasRef.current
      );
      showNotification({
        type: 'success',
        title: 'تم تحميل جميع الصفحات بنجاح',
        message: `تم تحميل ${totalPages} صور ترويجية عالية الجودة.`,
      });
    } catch (err: any) {
      console.error('Failed to export all promotional PNGs:', err);
      showNotification({
        type: 'error',
        title: 'فشل تصدير الصور',
        message: err.message || 'حدث خطأ أثناء تصدير الصور.',
      });
    } finally {
      setIsExportingPng(false);
    }
  };

  const handleExportPdf = async () => {
    if (previewItems.length === 0) return;
    setIsExportingPdf(true);
    try {
      const filename = generatePromotionalArabicFilename(previewItems, 'pdf');
      await exportPromotionalAsPdf('mss-promotional-pdf-export-container', filename);
      showNotification({
        type: 'success',
        title: 'تم فتح نافذة الطباعة / تصدير PDF',
        message: `اختر "Save as PDF" لحفظ التصميم الترويجي: ${filename}`,
      });
    } catch (err: any) {
      console.error('Failed to export promotional PDF:', err);
      showNotification({
        type: 'error',
        title: 'فشل تصدير PDF',
        message: err.message || 'حدث خطأ أثناء تصدير ملف PDF.',
      });
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <div className="space-y-6 text-slate-800" dir="rtl">
      {/* Hidden high-res canvas used for raster export */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* Hero Banner: Social Media Generator */}
      <div className="bg-gradient-to-l from-blue-900 via-indigo-900 to-slate-950 p-6 rounded-2xl text-white shadow-md border border-indigo-900/60 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1.5 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>مولد التصاميم الترويجية المعتمدة لمواقع التواصل</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
            إنشاء بوستر عروض الأجهزة المتاحة (فيسبوك / واتساب)
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            تصميم إعلاني أنيق يطابق هوية COMPU MSS الرسمية. قم بتحديد الأجهزة المطلوبة ثم عاين
            وخصص المواصفات بحرية قبل التصدير كصورة عالية الدقة PNG أو مستند PDF.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="primary"
            size="lg"
            onClick={handleOpenPreviewModal}
            disabled={selectedVisibleCount === 0}
            leftIcon={<Eye className="w-5 h-5 text-amber-300" />}
            className="font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            معاينة وتخصيص التصميم ({selectedVisibleCount})
          </Button>
        </div>
      </div>

      {/* Advanced Filter Toolbar: Brand, Model, Price Range, Search */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-300 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Filter className="w-4.5 h-4.5 text-blue-600" />
            <h3 className="font-bold text-sm text-slate-900">فلاتر تخصيص واختيار الأجهزة</h3>
            <span className="text-xs text-slate-500">
              (الفلاتر تحكم بدقة الأجهزة القابلة للإضافة والتصدير)
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 bg-slate-100 px-3 py-1 rounded-lg border border-slate-200 text-xs">
              <span className="font-semibold text-slate-600">الأجهزة المحددة:</span>
              <span className="font-bold font-mono text-blue-700 tabular-nums">
                {selectedVisibleCount}
              </span>
              <span className="text-slate-400">/</span>
              <span className="font-semibold text-slate-700 tabular-nums">
                {visibleItems.length} مطابق
              </span>
              {visibleItems.length !== allAvailableItems.length && (
                <span className="text-[11px] text-slate-500 font-mono">
                  (من إجمالي {allAvailableItems.length})
                </span>
              )}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleResetFilters}
              leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
              className="text-xs font-semibold border-slate-300 hover:bg-slate-50"
            >
              إعادة تعيين الفلاتر
            </Button>
          </div>
        </div>

        {/* Filter Controls Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {/* Brand Filter (Multi-select Checkboxes) */}
          <div className="space-y-1.5 p-3 bg-white rounded-xl border border-slate-200 flex flex-col justify-between">
            <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
              <label className="text-xs font-bold text-slate-800">
                الماركة ({selectedBrands.length > 0 ? `${selectedBrands.length} محددة` : 'كافة الماركات'}):
              </label>
              <div className="flex items-center gap-2 text-[11px]">
                <button
                  type="button"
                  onClick={() => setSelectedBrands(availableBrands)}
                  className="text-blue-700 hover:underline font-semibold"
                >
                  تحديد الكل
                </button>
                <span className="text-slate-300">|</span>
                <button
                  type="button"
                  onClick={() => setSelectedBrands([])}
                  className="text-slate-500 hover:underline font-semibold"
                >
                  مسح
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1">
              {availableBrands.map(b => {
                const isChecked = selectedBrands.includes(b);
                return (
                  <label
                    key={b}
                    className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold border cursor-pointer transition-colors ${
                      isChecked
                        ? 'bg-blue-50 text-blue-950 border-blue-300'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={e => {
                        setSelectedBrands(prev =>
                          e.target.checked ? [...prev, b] : prev.filter(x => x !== b)
                        );
                      }}
                      className="w-3.5 h-3.5 rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer"
                    />
                    <span>{b}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Model Filter (Multi-select Checkboxes Dynamically Filtered) */}
          <div className="space-y-1.5 p-3 bg-white rounded-xl border border-slate-200 flex flex-col justify-between">
            <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
              <label className="text-xs font-bold text-slate-800">
                الموديل ({selectedModelIds.length > 0 ? `${selectedModelIds.length} محدد` : 'كافة الموديلات'}):
              </label>
              <div className="flex items-center gap-2 text-[11px]">
                <button
                  type="button"
                  onClick={() => setSelectedModelIds(filteredModels.map(m => m.id))}
                  className="text-blue-700 hover:underline font-semibold"
                >
                  تحديد الكل
                </button>
                <span className="text-slate-300">|</span>
                <button
                  type="button"
                  onClick={() => setSelectedModelIds([])}
                  className="text-slate-500 hover:underline font-semibold"
                >
                  مسح
                </button>
              </div>
            </div>
            <div className="flex flex-col gap-1 max-h-24 overflow-y-auto p-1 divide-y divide-slate-50">
              {filteredModels.length === 0 ? (
                <div className="text-slate-400 text-xs py-2 text-center">لا توجد موديلات متاحة</div>
              ) : (
                filteredModels.map(m => {
                  const isChecked = selectedModelIds.includes(m.id);
                  return (
                    <label
                      key={m.id}
                      className={`inline-flex items-center gap-2 px-1.5 py-1 rounded text-xs font-medium cursor-pointer transition-colors ${
                        isChecked
                          ? 'bg-blue-50 text-blue-950 font-bold'
                          : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={e => {
                          setSelectedModelIds(prev =>
                            e.target.checked ? [...prev, m.id] : prev.filter(id => id !== m.id)
                          );
                        }}
                        className="w-3.5 h-3.5 rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer"
                      />
                      <span>
                        {m.brand} {m.model_name}
                      </span>
                    </label>
                  );
                })
              )}
            </div>
          </div>

          {/* Price Range & Quick Search */}
          <div className="space-y-2 p-3 bg-white rounded-xl border border-slate-200 flex flex-col justify-between">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-800 block">نطاق السعر (ج.م):</label>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  placeholder="من"
                  value={minPrice}
                  onChange={e => setMinPrice(e.target.value)}
                  className="w-1/2 text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-blue-500 tabular-nums"
                />
                <span className="text-slate-400 text-xs">-</span>
                <input
                  type="number"
                  placeholder="إلى"
                  value={maxPrice}
                  onChange={e => setMaxPrice(e.target.value)}
                  className="w-1/2 text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-blue-500 tabular-nums"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-800 block">بحث سريع بالمواصفات:</label>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute right-2.5 top-2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="معالج، رام، كارت..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full text-xs pr-8 pl-2 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Display Options Strip: Show Price, Show Quantity, Sort Order */}
        <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-5">
            <label className="inline-flex items-center gap-2 cursor-pointer font-semibold text-slate-800">
              <input
                type="checkbox"
                checked={displayOptions.showPrice}
                onChange={e =>
                  setDisplayOptions(prev => ({ ...prev, showPrice: e.target.checked }))
                }
                className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
              />
              <span>إظهار عمود الأسعار في التصميم</span>
            </label>

            <label className="inline-flex items-center gap-2 cursor-pointer font-semibold text-slate-800">
              <input
                type="checkbox"
                checked={displayOptions.showQuantity}
                onChange={e =>
                  setDisplayOptions(prev => ({ ...prev, showQuantity: e.target.checked }))
                }
                className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
              />
              <span>إظهار عمود الكميات في التصميم</span>
            </label>
          </div>

          <div className="flex items-center gap-2">
            <ArrowUpDown className="w-4 h-4 text-slate-500" />
            <span className="font-semibold text-slate-700">ترتيب الأسعار:</span>
            <select
              value={priceSortOrder}
              onChange={e => setPriceSortOrder(e.target.value as 'asc' | 'desc')}
              className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 cursor-pointer"
            >
              <option value="asc">من الأقل إلى الأعلى سعراً (تصاعدي)</option>
              <option value="desc">من الأعلى إلى الأقل سعراً (تنازلي)</option>
            </select>
          </div>
        </div>
      </div>

      {/* PDF Recommendation Warning Banner When > 12 Devices Selected */}
      {selectedVisibleCount > 12 && (
        <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-2xl text-blue-900 text-xs flex items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-4.5 h-4.5 text-blue-600 shrink-0" />
            <span className="font-bold">
              لقد قمت بتحديد عدد كبير من الأجهزة. يُنصح بالتصدير بصيغة PDF لتجربة عرض ومشاركة أفضل. ({selectedVisibleCount} جهاز محدد)
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleOpenPreviewModal}
            leftIcon={<FileDown className="w-3.5 h-3.5 text-blue-700" />}
            className="font-bold border-blue-300 text-blue-950 hover:bg-blue-100 text-xs shrink-0"
          >
            معاينة وتصدير PDF
          </Button>
        </div>
      )}

      {/* Device Selection Table */}
      <div className="bg-white rounded-2xl border border-slate-300 shadow-2xs overflow-hidden">
        <div className="p-3.5 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleToggleSelectAllVisible}
              className="flex items-center gap-2 text-xs font-bold text-slate-800 hover:text-blue-700 transition-colors cursor-pointer"
            >
              {allVisibleSelected ? (
                <CheckSquare className="w-4.5 h-4.5 text-blue-600" />
              ) : (
                <Square className="w-4.5 h-4.5 text-slate-400" />
              )}
              <span>
                {allVisibleSelected ? 'إلغاء تحديد المعروض' : 'تحديد كل الأجهزة المعروضة'} (
                {sortedVisibleItems.length})
              </span>
            </button>
          </div>

          <span className="text-xs text-slate-500 font-medium">
            اختر الأجهزة المراد تضمينها في التصميم الإعلاني
          </span>
        </div>

        <div className="overflow-x-auto max-h-[50vh]">
          <table className="w-full text-xs text-right border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold sticky top-0 z-10 whitespace-nowrap">
              <tr>
                <th className="p-2.5 text-center w-12">تحديد</th>
                <th className="p-2.5">الماركة والموديل</th>
                <th className="p-2.5">المعالج</th>
                <th className="p-2.5">الجيل</th>
                <th className="p-2.5">الرام</th>
                <th className="p-2.5">التخزين</th>
                <th className="p-2.5">كارت الشاشة</th>
                <th className="p-2.5">الشاشة</th>
                <th className="p-2.5 text-center">الكمية المتاحة</th>
                <th className="p-2.5 text-left">السعر</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedVisibleItems.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-500">
                    لا توجد أجهزة مطابقة للفلاتر المحددة حالياً.
                  </td>
                </tr>
              ) : (
                sortedVisibleItems.map(item => {
                  const isChecked = selectedItemIds.has(item.id);
                  return (
                    <tr
                      key={item.id}
                      onClick={() => handleToggleItem(item.id)}
                      className={`cursor-pointer transition-colors ${
                        isChecked ? 'bg-blue-50/50 hover:bg-blue-50' : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="p-2.5 text-center" onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleItem(item.id)}
                          className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                        />
                      </td>
                      <td className="p-2.5 font-bold text-slate-900 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <BrandBadgePreview brand={item.brand} />
                          <span>
                            {item.brand} {item.model_name}
                          </span>
                        </div>
                      </td>
                      <td className="p-2.5 font-mono text-slate-700 whitespace-nowrap">
                        {item.processor}
                      </td>
                      <td className="p-2.5 font-semibold text-slate-700 whitespace-nowrap">
                        {item.generation || '---'}
                      </td>
                      <td className="p-2.5 font-mono text-slate-700 whitespace-nowrap">
                        {item.ram}
                      </td>
                      <td className="p-2.5 font-mono text-slate-700 whitespace-nowrap">
                        {item.storage}
                      </td>
                      <td className="p-2.5 font-mono text-slate-700 whitespace-nowrap">
                        {item.gpu}
                      </td>
                      <td className="p-2.5 font-mono text-slate-700 whitespace-nowrap">
                        {item.screen}
                      </td>
                      <td className="p-2.5 text-center whitespace-nowrap">
                        <Badge variant="default" size="sm">
                          {item.available_quantity || item.quantity || 1} جهاز
                        </Badge>
                      </td>
                      <td className="p-2.5 text-left font-mono font-bold text-emerald-700 whitespace-nowrap">
                        {item.price ? formatCurrency(item.price) : '---'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* =====================================================================
          EDITABLE PREVIEW MODAL MATCHING REFERENCE DESIGN
          ===================================================================== */}
      {isPreviewOpen && (
        <Modal
          isOpen={isPreviewOpen}
          onClose={() => setIsPreviewOpen(false)}
          title="معاينة وتخصيص البوستر الترويجي — COMPU MSS"
          subtitle="تصميم إعلاني أنيق يطابق بوستر المتجر الرسمي مع إمكانية تعديل المواصفات مؤقتاً قبل التصدير"
          size="3xl"
          footer={
            <div className="flex items-center justify-between w-full flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="md"
                  onClick={() => setIsPreviewOpen(false)}
                  className="border-slate-300 font-semibold"
                >
                  إغلاق النافذة
                </Button>
              </div>

              <div className="flex items-center gap-2.5 flex-wrap">
                <Button
                  variant="outline"
                  size="md"
                  onClick={handleExportPdf}
                  isLoading={isExportingPdf}
                  leftIcon={<FileDown className="w-4.5 h-4.5 text-blue-600" />}
                  className="font-bold border-slate-300 hover:bg-slate-50 text-slate-800"
                >
                  تصدير كـ PDF
                </Button>

                {totalPages > 1 && (
                  <Button
                    variant="outline"
                    size="md"
                    onClick={handleExportAllPagesPng}
                    isLoading={isExportingPng}
                    leftIcon={<Layers className="w-4.5 h-4.5 text-indigo-600" />}
                    className="font-bold border-indigo-300 hover:bg-indigo-50 text-indigo-900"
                  >
                    تحميل كافة الصفحات ({totalPages} صور)
                  </Button>
                )}

                <Button
                  variant="primary"
                  size="md"
                  onClick={handleExportPng}
                  isLoading={isExportingPng}
                  leftIcon={<Download className="w-4.5 h-4.5" />}
                  className="font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-xs"
                >
                  {totalPages > 1
                    ? `تحميل الصفحة الحالية ${currentPageIndex + 1} (PNG)`
                    : 'تحميل التصميم كصورة (PNG)'}
                </Button>
              </div>
            </div>
          }
        >
          <div className="space-y-6">
            {/* PDF Recommendation Warning Banner When > 12 Devices (totalPages > 1) */}
            {totalPages > 1 && (
              <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl text-amber-950 text-xs flex items-center justify-between gap-3 shadow-2xs">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                  <span className="font-bold">
                    لقد قمت بتحديد عدد كبير من الأجهزة. يُنصح بالتصدير بصيغة PDF لتجربة عرض ومشاركة أفضل. ({previewItems.length} جهاز على {totalPages} صفحات)
                  </span>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleExportPdf}
                  isLoading={isExportingPdf}
                  leftIcon={<FileDown className="w-3.5 h-3.5 text-slate-950" />}
                  className="font-bold bg-amber-400 hover:bg-amber-500 text-slate-950 text-xs shrink-0"
                >
                  تصدير كـ PDF الآن
                </Button>
              </div>
            )}

            {/* Modal Controls Bar: Headlines, Pagination & Sorting */}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 block">
                    العنوان الرئيسي (أبيض عريض):
                  </label>
                  <input
                    type="text"
                    value={displayOptions.headline || ''}
                    onChange={e =>
                      setDisplayOptions(prev => ({ ...prev, headline: e.target.value }))
                    }
                    placeholder="متوفر بفضل الله"
                    className="w-full text-xs px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 block">
                    العنوان الثانوي (ذهبي مع خط تموج):
                  </label>
                  <input
                    type="text"
                    value={displayOptions.subHeadline || ''}
                    onChange={e =>
                      setDisplayOptions(prev => ({ ...prev, subHeadline: e.target.value }))
                    }
                    placeholder="أعلى جودة بأقل سعر"
                    className="w-full text-xs px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-slate-200 pt-2.5 flex-wrap gap-2 text-xs">
                {/* Pagination Controls */}
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-600">
                    إجمالي الأجهزة: {previewItems.length}
                  </span>
                  {totalPages > 1 && (
                    <div className="flex items-center gap-1.5 mr-2 bg-white px-2 py-1 rounded-lg border border-slate-300">
                      <button
                        type="button"
                        onClick={() => setCurrentPageIndex(prev => Math.max(0, prev - 1))}
                        disabled={currentPageIndex === 0}
                        className="p-1 rounded hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                        title="الصفحة السابقة"
                      >
                        <ChevronRight className="w-4 h-4 text-slate-700" />
                      </button>
                      <span className="font-bold text-xs text-blue-900 px-1">
                        صفحة {currentPageIndex + 1} من {totalPages}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setCurrentPageIndex(prev => Math.min(totalPages - 1, prev + 1))
                        }
                        disabled={currentPageIndex >= totalPages - 1}
                        className="p-1 rounded hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                        title="الصفحة التالية"
                      >
                        <ChevronLeft className="w-4 h-4 text-slate-700" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <ArrowUpDown className="w-3.5 h-3.5 text-indigo-600" />
                    <span className="font-semibold text-slate-700">ترتيب الأسعار:</span>
                    <select
                      value={priceSortOrder}
                      onChange={e => handleSortOrderChange(e.target.value as 'asc' | 'desc')}
                      className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 cursor-pointer"
                    >
                      <option value="asc">من الأقل للأعلى سعراً</option>
                      <option value="desc">من الأعلى للأقل سعراً</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-slate-700">أجهزة بالصفحة:</span>
                    <select
                      value={itemsPerPage}
                      onChange={e => {
                        const newCount = Number(e.target.value);
                        setItemsPerPage(newCount);
                        setCurrentPageIndex(0);
                      }}
                      className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 cursor-pointer"
                    >
                      <option value={10}>10 أجهزة</option>
                      <option value={12}>12 جهاز (افتراضي)</option>
                      <option value={14}>14 جهاز</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Live Interactive Promotional Poster Container (Matching Reference) */}
            <div className="overflow-x-auto flex justify-center bg-slate-200/60 p-2 sm:p-4 rounded-xl border border-slate-300">
              <PromotionalPosterPage
                id="mss-promotional-poster-container"
                pageItems={activePageItems}
                pageIndex={currentPageIndex}
                totalPages={totalPages}
                displayOptions={displayOptions}
              />
            </div>

            {/* Hidden Multi-Page Container Dedicated for Pristine PDF Export */}
            <div id="mss-promotional-pdf-export-container" className="hidden">
              {Array.from({ length: totalPages }).map((_, p) => {
                const pageSlice = previewItems.slice(p * itemsPerPage, (p + 1) * itemsPerPage);
                return (
                  <div
                    key={p}
                    style={{
                      pageBreakAfter: p < totalPages - 1 ? 'always' : 'auto',
                      breakAfter: p < totalPages - 1 ? 'page' : 'auto',
                      marginBottom: '20px',
                    }}
                  >
                    <PromotionalPosterPage
                      pageItems={pageSlice}
                      pageIndex={p}
                      totalPages={totalPages}
                      displayOptions={displayOptions}
                    />
                  </div>
                );
              })}
            </div>

            {/* Editable Specifications & Prices Drawer */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-300 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                  <Edit3 className="w-4 h-4 text-blue-600" />
                  <span>تعديل المواصفات أو الأسعار مؤقتاً قبل التصدير:</span>
                </span>
                <span className="text-[11px] text-slate-500">
                  (التعديلات هنا لا تؤثر على قاعدة البيانات بأي شكل)
                </span>
              </div>

              {/* Items Table for Quick Editing */}
              <div className="overflow-x-auto max-h-60 rounded-lg border border-slate-200 bg-white">
                <table className="w-full text-xs text-right border-collapse">
                  <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold sticky top-0">
                    <tr>
                      <th className="p-2">الماركة والموديل</th>
                      <th className="p-2">المعالج</th>
                      <th className="p-2">الجيل</th>
                      <th className="p-2">الرام</th>
                      <th className="p-2">الهارد</th>
                      <th className="p-2">كارت الشاشة</th>
                      <th className="p-2">السعر</th>
                      <th className="p-2 text-center">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {previewItems.map(item => {
                      const isEditing = editingItemId === item.id;
                      if (isEditing) {
                        return (
                          <tr key={item.id} className="bg-amber-50">
                            <td className="p-2" colSpan={8}>
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                                <div>
                                  <label className="text-slate-500 block">الماركة:</label>
                                  <input
                                    type="text"
                                    value={editFormData.brand || ''}
                                    onChange={e =>
                                      setEditFormData(prev => ({ ...prev, brand: e.target.value }))
                                    }
                                    className="w-full px-2 py-1 rounded border border-slate-300 bg-white"
                                  />
                                </div>
                                <div>
                                  <label className="text-slate-500 block">الموديل:</label>
                                  <input
                                    type="text"
                                    value={editFormData.model_name || ''}
                                    onChange={e =>
                                      setEditFormData(prev => ({
                                        ...prev,
                                        model_name: e.target.value,
                                      }))
                                    }
                                    className="w-full px-2 py-1 rounded border border-slate-300 bg-white"
                                  />
                                </div>
                                <div>
                                  <label className="text-slate-500 block">المعالج:</label>
                                  <input
                                    type="text"
                                    value={editFormData.processor || ''}
                                    onChange={e =>
                                      setEditFormData(prev => ({
                                        ...prev,
                                        processor: e.target.value,
                                      }))
                                    }
                                    className="w-full px-2 py-1 rounded border border-slate-300 bg-white"
                                  />
                                </div>
                                <div>
                                  <label className="text-slate-500 block">الجيل:</label>
                                  <input
                                    type="text"
                                    value={editFormData.generation || ''}
                                    onChange={e =>
                                      setEditFormData(prev => ({
                                        ...prev,
                                        generation: e.target.value,
                                      }))
                                    }
                                    className="w-full px-2 py-1 rounded border border-slate-300 bg-white"
                                  />
                                </div>
                                <div>
                                  <label className="text-slate-500 block">الرام:</label>
                                  <input
                                    type="text"
                                    value={editFormData.ram || ''}
                                    onChange={e =>
                                      setEditFormData(prev => ({ ...prev, ram: e.target.value }))
                                    }
                                    className="w-full px-2 py-1 rounded border border-slate-300 bg-white"
                                  />
                                </div>
                                <div>
                                  <label className="text-slate-500 block">الهارد:</label>
                                  <input
                                    type="text"
                                    value={editFormData.storage || ''}
                                    onChange={e =>
                                      setEditFormData(prev => ({
                                        ...prev,
                                        storage: e.target.value,
                                      }))
                                    }
                                    className="w-full px-2 py-1 rounded border border-slate-300 bg-white"
                                  />
                                </div>
                                <div>
                                  <label className="text-slate-500 block">كارت الشاشة:</label>
                                  <input
                                    type="text"
                                    value={editFormData.gpu || ''}
                                    onChange={e =>
                                      setEditFormData(prev => ({ ...prev, gpu: e.target.value }))
                                    }
                                    className="w-full px-2 py-1 rounded border border-slate-300 bg-white"
                                  />
                                </div>
                                <div>
                                  <label className="text-slate-500 block">السعر (ج.م):</label>
                                  <input
                                    type="number"
                                    value={editFormData.price || 0}
                                    onChange={e =>
                                      setEditFormData(prev => ({
                                        ...prev,
                                        price: Number(e.target.value) || 0,
                                      }))
                                    }
                                    className="w-full px-2 py-1 rounded border border-slate-300 bg-white"
                                  />
                                </div>
                              </div>
                              <div className="flex justify-end gap-2 mt-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={handleCancelItemEdit}
                                  className="text-xs"
                                >
                                  إلغاء
                                </Button>
                                <Button
                                  variant="primary"
                                  size="sm"
                                  onClick={handleSaveItemEdit}
                                  className="text-xs font-bold"
                                >
                                  حفظ التعديل
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      }

                      return (
                        <tr key={item.id} className="hover:bg-slate-50">
                          <td className="p-2 font-bold text-slate-900">
                            {item.brand} {item.model_name}
                          </td>
                          <td className="p-2 font-mono text-slate-700">{item.processor}</td>
                          <td className="p-2 text-slate-700">{item.generation || '---'}</td>
                          <td className="p-2 font-mono text-slate-700">{item.ram}</td>
                          <td className="p-2 font-mono text-slate-700">{item.storage}</td>
                          <td className="p-2 font-mono text-slate-700">{item.gpu}</td>
                          <td className="p-2 font-mono font-bold text-emerald-700">
                            {item.price ? formatCurrency(item.price) : '---'}
                          </td>
                          <td className="p-2 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleStartEditItem(item)}
                                className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                                title="تعديل المواصفات"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveFromPreview(item.id)}
                                className="p-1 text-rose-600 hover:bg-rose-50 rounded"
                                title="حذف من التصميم"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};