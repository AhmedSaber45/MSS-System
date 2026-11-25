import React, { useState, useMemo, useRef, useEffect } from 'react';
import { toPng } from 'html-to-image';
import type { MSSDevice, MSSModel } from '@/types/mssInventory';
import type { PromotionalLaptopItem, PromotionalDisplayOptions } from '@/types/mssPromotional';
import {
  preparePromotionalItems,
  generatePromotionalArabicFilename,
  renderPromotionalToCanvas,
  ensurePromotionalImageLoaded,
  exportPromotionalAsPng,
  exportPromotionalAllPagesAsPng,
  exportPromotionalAsPdf,
  sortPromotionalItems,
  PROMOTIONAL_MAX_DEVICES_PER_PAGE,
} from '@/services/mssPromotionalService.ts';
import { formatCurrency } from '@/lib/utils';
import { Button } from '@/components/common/Button';
import { Badge } from '@/components/common/Badge';
import { Modal } from '@/components/common/Modal';
import { Pagination } from '@/components/common/Pagination';
import { useNotification } from '@/context/NotificationContext';
import {
  PROMOTIONAL_HEADER_ICONS,
  PROMOTIONAL_BRAND_LOGOS,
  PROMOTIONAL_HEADER_ASSETS,
  getBrandLogoConfig,
} from '@/assets/promotional/promotionalAssets';
import { useMSSLocations } from '@/hooks/useMSSLocations';
import {
  resolvePromotionalTheme,
  type PromotionalThemeId,
} from '@/services/promotionalThemes';
import {
  Share2,
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
  devices?: MSSDevice[];
  models?: MSSModel[];
  mode?: 'mss' | 'accessories_manual';
  manualItems?: PromotionalLaptopItem[];
  onManualItemsChange?: (items: PromotionalLaptopItem[]) => void;
  onEditItem?: (item: PromotionalLaptopItem) => void;
  onDeleteItem?: (id: string) => void;
  exportType?: import('@/services/exportStorageService').ExportType;
  headerImageSrc?: string;
  headerId?: PromotionalThemeId;
}

/**
 * Authentic brand logo badge component for HTML DOM preview table,
 * device selector table, and export rendering.
 *
 * Provides 100% authentic logos for all Compu MSS supported laptop brands
 * with exact Flaticon 747 icon for Apple, and graceful text fallback for custom test entries.
 */
const BrandBadgePreview: React.FC<{ brand: string; pillBg?: string | null }> = ({ brand, pillBg }) => {
  const [imgError, setImgError] = useState(false);
  const brandConfig = getBrandLogoConfig(brand);

  const wrapWithPill = (node: React.ReactNode) =>
    pillBg ? (
      <div
        className="inline-flex items-center justify-center rounded-md px-1.5 py-0.5 min-w-[64px] h-8 shadow-2xs"
        style={{ backgroundColor: pillBg }}
      >
        {node}
      </div>
    ) : (
      node
    );

  if (!brandConfig || imgError) {
    const label = brandConfig?.name || (brand || '').trim().slice(0, 8);
    return (
      <div className="inline-flex items-center justify-center px-2 py-0.5 rounded bg-slate-200 text-slate-800 font-bold text-[11px] shadow-2xs">
        {label}
      </div>
    );
  }

  // 1. Apple: balanced circular badge with Flaticon 747 white Apple logo
  if (brandConfig.key === 'apple') {
    return wrapWithPill(
      <div className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-900 shadow-2xs">
        <img
          src={brandConfig.dataUri}
          alt="Apple"
          className="w-4 h-4 object-contain"
          loading="eager"
          onError={() => setImgError(true)}
        />
      </div>
    );
  }

  // 2. Lenovo: Distinctive official red badge with crisp white wordmark
  if (brandConfig.key === 'lenovo') {
    return wrapWithPill(
      <div className="inline-flex items-center justify-center h-6 max-w-[76px] px-0.5">
        <img
          src={brandConfig.dataUri}
          alt="Lenovo"
          className="h-5 w-auto object-contain drop-shadow-2xs rounded-xs"
          loading="eager"
          onError={() => setImgError(true)}
        />
      </div>
    );
  }

  // 3. Circular / square badge-friendly icons (Dell, HP, Huawei, LG, Razer, Alienware, Google, Microsoft)
  if (['dell', 'hp', 'huawei', 'lg', 'razer', 'alienware', 'google', 'microsoft'].includes(brandConfig.key)) {
    return wrapWithPill(
      <div className="inline-flex items-center justify-center w-7 h-7">
        <img
          src={brandConfig.dataUri}
          alt={brandConfig.name}
          className="max-w-[26px] max-h-[26px] object-contain drop-shadow-2xs"
          loading="eager"
          onError={() => setImgError(true)}
        />
      </div>
    );
  }

  // 4. Wordmark logos (Asus, Acer, MSI, Samsung, Toshiba, Sony, Fujitsu)
  return wrapWithPill(
    <div className="inline-flex items-center justify-center h-7 max-w-[76px] px-1">
      <img
        src={brandConfig.dataUri}
        alt={brandConfig.name}
        className="max-h-5 max-w-[72px] object-contain drop-shadow-2xs"
        loading="eager"
        onError={() => setImgError(true)}
      />
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
  const { locations } = useMSSLocations();
  const theme = resolvePromotionalTheme(displayOptions.themeId, displayOptions.headerImageSrc);
  return (
    <div
      id={id}
      className={`promotional-poster-container w-[1000px] shrink-0 rounded-xl shadow-2xl border overflow-hidden flex flex-col justify-between ${className}`}
      style={{
        minHeight: '960px',
        backgroundColor: theme.posterBg,
        borderColor: theme.posterBorder,
        color: theme.textPrimary,
      }}
      dir="rtl"
    >
      <div>
        {/* 1. Static Commercial Header Banner Section */}
        <div
          className="relative text-center overflow-hidden border-b flex items-center justify-center"
          style={{
            backgroundColor: theme.headerBackdropBg,
            borderBottomColor: theme.headerBottomBorder,
          }}
        >
          <img
            src={displayOptions.headerImageSrc || PROMOTIONAL_HEADER_ASSETS.banner}
            alt="Promotional Header"
            className="w-full max-h-[280px] object-contain mx-auto block"
            loading="eager"
          />
        </div>

      {/* 2. Structured Specifications Table */}
      <div className="p-4 sm:p-5" dir="ltr">
        <table
          className="w-full text-[20px] text-left border-collapse border font-bold"
          style={{ borderColor: theme.tableOuterBorder }}
          dir="ltr"
        >
          <thead
            className="font-bold text-center border-b-2 text-[14px]"
            style={{
              backgroundColor: theme.tableHeaderBg,
              color: theme.tableHeaderText,
              borderBottomColor: theme.tableHeaderStroke,
            }}
          >
            <tr>
              <th className="py-3 px-2 w-24 text-center">
                <div className="flex flex-col items-center gap-1">
                  <img src={PROMOTIONAL_HEADER_ICONS.brand} alt="الماركة" className="w-4 h-4 object-contain" />
                  <span>الماركة</span>
                </div>
              </th>
              <th className="py-3 px-3 text-center">
                <div className="flex flex-col items-center gap-1 justify-center">
                  <img src={PROMOTIONAL_HEADER_ICONS.model} alt="الموديل" className="w-4 h-4 object-contain" />
                  <span>الموديل</span>
                </div>
              </th>
              <th className="py-3 px-2 w-20 text-center">
                <div className="flex flex-col items-center gap-1">
                  <img src={PROMOTIONAL_HEADER_ICONS.processor} alt="المعالج" className="w-4 h-4 object-contain" />
                  <span>المعالج</span>
                </div>
              </th>
              <th className="py-3 px-2 w-28 text-center">
                <div className="flex flex-col items-center gap-1">
                  <img src={PROMOTIONAL_HEADER_ICONS.generation} alt="الجيل" className="w-4 h-4 object-contain" />
                  <span>الجيل</span>
                </div>
              </th>
              <th className="py-3 px-2 w-16 text-center">
                <div className="flex flex-col items-center gap-1">
                  <img src={PROMOTIONAL_HEADER_ICONS.ram} alt="الرام" className="w-4 h-4 object-contain" />
                  <span>الرام</span>
                </div>
              </th>
              <th className="py-3 px-2 w-28 text-center">
                <div className="flex flex-col items-center gap-1">
                  <img src={PROMOTIONAL_HEADER_ICONS.storage} alt="الهارد" className="w-4 h-4 object-contain" />
                  <span>الهارد</span>
                </div>
              </th>
              <th className="py-3 px-2 w-24 text-center">
                <div className="flex flex-col items-center gap-1">
                  <img src={PROMOTIONAL_HEADER_ICONS.screen} alt="الشاشة" className="w-4 h-4 object-contain" />
                  <span>الشاشة</span>
                </div>
              </th>
              <th className="py-3 px-2 w-28 text-center">
                <div className="flex flex-col items-center gap-1">
                  <img src={PROMOTIONAL_HEADER_ICONS.gpu} alt="كارت الشاشة" className="w-4 h-4 object-contain" />
                  <span>كارت الشاشة</span>
                </div>
              </th>
              {displayOptions.showQuantity && (
                <th className="py-3 px-2 w-16 text-center">
                  <div className="flex flex-col items-center gap-1">
                    <img src={PROMOTIONAL_HEADER_ICONS.quantity} alt="الكمية" className="w-4 h-4 object-contain" />
                    <span>الكمية</span>
                  </div>
                </th>
              )}
              {displayOptions.showPrice && (
                <th
                  className="py-3 px-3 w-28 text-center"
                  style={{ backgroundColor: theme.tableHeaderPriceBg }}
                >
                  <div className="flex flex-col items-center gap-1">
                    <img src={PROMOTIONAL_HEADER_ICONS.price} alt="السعر" className="w-4 h-4 object-contain" />
                    <span style={{ color: theme.tableHeaderPriceText }}>السعر (جنيه)</span>
                  </div>
                </th>
              )}
            </tr>
          </thead>
          <tbody className="font-bold text-[20px]">
            {pageItems.map((item, idx) => {
              const isEven = idx % 2 === 0;
              const gpuUpper = (item.gpu || '').toUpperCase();
              const isNvidia = gpuUpper.includes('NVIDIA') || gpuUpper.includes('RTX') || gpuUpper.includes('GTX');
              const isAmd = gpuUpper.includes('AMD') || gpuUpper.includes('RADEON');
              const isIntel = gpuUpper.includes('INTEL');
              const gpuColor = isNvidia
                ? theme.gpuNvidia
                : isAmd
                  ? theme.gpuAmd
                  : isIntel
                    ? theme.gpuIntel
                    : theme.gpuDefault;

              return (
                <tr
                  key={item.id}
                  className="transition-colors border-b"
                  style={{
                    backgroundColor: isEven ? theme.rowEvenBg : theme.rowOddBg,
                    borderBottomColor: theme.rowBorderBottom,
                  }}
                >
                  <td className="py-3.5 px-2 text-center border-r" style={{ borderRightColor: theme.cellDivider }}>
                    <BrandBadgePreview brand={item.brand} pillBg={theme.brandBadgePillBg} />
                  </td>
                  <td
                    className="py-3.5 px-3 font-bold border-r text-center align-middle text-[20px]"
                    style={{ color: theme.textPrimary, borderRightColor: theme.cellDivider }}
                  >
                    <div dir="ltr" className="text-center truncate max-w-full">{item.model_name}</div>
                  </td>
                  <td
                    className="py-3.5 px-2 text-center font-bold border-r font-mono text-[20px]"
                    style={{ color: theme.textSecondary, borderRightColor: theme.cellDivider }}
                    dir="ltr"
                  >
                    {item.processor || '---'}
                  </td>
                  <td
                    className="py-3.5 px-2 text-center font-bold border-r text-[20px]"
                    style={{ color: theme.textMuted, borderRightColor: theme.cellDivider }}
                  >
                    <bdi>{item.generation || '---'}</bdi>
                  </td>
                  <td
                    className="py-3.5 px-2 text-center font-mono font-bold border-r text-[20px]"
                    style={{ color: theme.textSecondary, borderRightColor: theme.cellDivider }}
                    dir="ltr"
                  >
                    {item.ram || '---'}
                  </td>
                  <td
                    className="py-3.5 px-2 text-center font-mono font-bold border-r text-[20px]"
                    style={{ color: theme.textSecondary, borderRightColor: theme.cellDivider }}
                    dir="ltr"
                  >
                    {item.storage || '---'}
                  </td>
                  <td
                    className="py-3.5 px-2 text-center font-mono font-bold border-r text-[19.5px]"
                    style={{ color: theme.textSecondary, borderRightColor: theme.cellDivider }}
                    dir="ltr"
                  >
                    {item.screen || '---'}
                  </td>
                  <td
                    className={`py-3.5 px-2 text-center font-bold text-[20px] ${
                      displayOptions.showQuantity || displayOptions.showPrice ? 'border-r' : ''
                    }`}
                    style={{
                      color: gpuColor,
                      borderRightColor:
                        displayOptions.showQuantity || displayOptions.showPrice ? theme.cellDivider : undefined,
                    }}
                    dir="ltr"
                  >
                    {item.gpu || '---'}
                  </td>
                  {displayOptions.showQuantity && (
                    <td
                      className={`py-3.5 px-2 text-center font-bold text-[20px] ${
                        displayOptions.showPrice ? 'border-r' : ''
                      }`}
                      style={{
                        color: theme.textPrimary,
                        borderRightColor: displayOptions.showPrice ? theme.cellDivider : undefined,
                      }}
                      dir="ltr"
                    >
                      {item.quantity || 1}
                    </td>
                  )}
                  {displayOptions.showPrice && (
                    <td
                      className="py-3.5 px-3 text-center font-extrabold text-[22px] tabular-nums"
                      style={{ color: theme.priceText }}
                      dir="ltr"
                    >
                      {item.price ? Number(item.price).toLocaleString('en-US') : '---'}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      </div>

      {/* 3. Poster Footer */}
      <div
        className="p-4 border-t text-center space-y-1"
        style={{
          backgroundColor: theme.footerBg,
          borderTopColor: theme.footerBorderTop,
        }}
      >
        {totalPages > 1 && (
          <div
            className="inline-block px-3 py-0.5 rounded-full text-xs font-bold mb-1"
            style={{
              backgroundColor: theme.pageBadgeBg,
              color: theme.pageBadgeText,
            }}
          >
            صفحة {pageIndex + 1} من {totalPages}
          </div>
        )}

      </div>
    </div>
  );
};

export const MSSPromotionalGenerator: React.FC<MSSPromotionalGeneratorProps> = ({
  devices = [],
  models = [],
  mode = 'mss',
  manualItems,
  onManualItemsChange,
  onEditItem,
  onDeleteItem,
  exportType = 'mss_images',
  headerImageSrc,
  headerId,
}) => {
  const { showNotification } = useNotification();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // 1. Initial items prepared from available devices (or manualItems in accessories_manual mode)
  const allAvailableItems = useMemo(() => {
    if (mode === 'accessories_manual') {
      return manualItems || [];
    }
    return preparePromotionalItems(devices, models);
  }, [mode, manualItems, devices, models]);

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
    if (mode === 'accessories_manual') {
      const distinctModelsMap = new Map<string, MSSModel>();
      allAvailableItems.forEach(it => {
        const key = (it.model_name || '').trim();
        if (key && key !== '---' && !distinctModelsMap.has(key)) {
          distinctModelsMap.set(key, {
            id: it.id,
            model_name: it.model_name,
            brand: it.brand,
            category: 'لابتوب',
            default_list_price: it.price || 0,
            created_at: '',
            updated_at: '',
          });
        }
      });
      const list = Array.from(distinctModelsMap.values());
      if (selectedBrands.length === 0) return list;
      const brandSet = new Set(selectedBrands.map(b => b.trim().toLowerCase()));
      return list.filter(m => brandSet.has((m.brand || '').trim().toLowerCase()));
    }
    if (selectedBrands.length === 0) return models;
    const brandSet = new Set(selectedBrands.map(b => b.trim().toLowerCase()));
    return models.filter(m => brandSet.has((m.brand || '').trim().toLowerCase()));
  }, [mode, allAvailableItems, models, selectedBrands]);

  // Safely prune selectedModelIds ONLY when selectedBrands changes and some selected model is no longer valid
  useEffect(() => {
    if (selectedBrands.length > 0 && filteredModels.length > 0) {
      const validIds = new Set(filteredModels.map(m => m.id));
      setSelectedModelIds(prev => {
        if (prev.length === 0) return prev;
        const filtered = prev.filter(id => validIds.has(id));
        return filtered.length !== prev.length ? filtered : prev;
      });
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
    setTablePage(1);
  };

  // Table Pagination State
  const [tablePage, setTablePage] = useState<number>(1);
  const tablePageSize = 9;

  // Reset page to 1 when filter inputs change
  useEffect(() => {
    setTablePage(1);
  }, [selectedBrands, selectedModelIds, minPrice, maxPrice, searchQuery, priceSortOrder]);

  // Ensure current tablePage is within valid bounds
  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(sortedVisibleItems.length / tablePageSize));
    if (tablePage > maxPage) {
      setTablePage(1);
    }
  }, [sortedVisibleItems.length, tablePage, tablePageSize]);

  // Paginated visible items for the table
  const paginatedTableItems = useMemo(() => {
    const start = (tablePage - 1) * tablePageSize;
    return sortedVisibleItems.slice(start, start + tablePageSize);
  }, [sortedVisibleItems, tablePage, tablePageSize]);

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
    itemsPerPage: PROMOTIONAL_MAX_DEVICES_PER_PAGE,
  });

  // Only allow custom headerImageSrc and themeId in Accessories mode; MSS always uses the default Compu MSS header and theme.
  const effectiveDisplayOptions = useMemo<PromotionalDisplayOptions>(
    () =>
      mode === 'accessories_manual'
        ? {
            ...displayOptions,
            ...(headerImageSrc ? { headerImageSrc } : {}),
            ...(headerId ? { themeId: headerId } : {}),
          }
        : displayOptions,
    [displayOptions, mode, headerImageSrc, headerId]
  );

  // Preload header image immediately whenever it changes to prevent blank exports
  useEffect(() => {
    const src = effectiveDisplayOptions.headerImageSrc || PROMOTIONAL_HEADER_ASSETS.banner;
    ensurePromotionalImageLoaded(src);
  }, [effectiveDisplayOptions.headerImageSrc]);

  // 5. Editable Preview Modal State & Pagination
  const [isPreviewOpen, setIsPreviewOpen] = useState<boolean>(false);
  const [previewItems, setPreviewItems] = useState<PromotionalLaptopItem[]>([]);
  const [currentPageIndex, setCurrentPageIndex] = useState<number>(0);
  const [itemsPerPage, setItemsPerPage] = useState<number>(PROMOTIONAL_MAX_DEVICES_PER_PAGE);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<Omit<PromotionalLaptopItem, 'price'> & { price?: number | string }>>({});
  const [isExportingPng, setIsExportingPng] = useState<boolean>(false);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
  const [exportProgress, setExportProgress] = useState<{
    isExporting: boolean;
    type: 'png' | 'pdf';
    currentPage: number;
    totalPages: number;
  } | null>(null);

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
    setEditFormData({
      ...item,
      price: item.price !== undefined && item.price !== null && item.price !== 0 ? item.price : '',
    });
  };

  const handleSaveItemEdit = () => {
    if (!editingItemId) return;
    const rawPrice = editFormData.price;
    const finalPrice =
      rawPrice === '' || rawPrice === undefined || rawPrice === null
        ? undefined
        : Math.max(0, Number(rawPrice));

    setPreviewItems(prev => {
      const updated = prev.map(it => (it.id === editingItemId ? { ...it, ...editFormData, price: finalPrice } : it));
      if (mode === 'accessories_manual' && onManualItemsChange) {
        onManualItemsChange(updated);
      }
      return updated;
    });
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
      if (mode === 'accessories_manual' && onManualItemsChange) {
        onManualItemsChange(next);
      }
      const newTotal = Math.max(1, Math.ceil(next.length / itemsPerPage));
      if (currentPageIndex >= newTotal) {
        setCurrentPageIndex(Math.max(0, newTotal - 1));
      }
      return next;
    });
  };

  // 6. Export Handlers

  // Export current single page as PNG
  const handleExportSinglePagePng = async () => {
    if (previewItems.length === 0) return;
    setIsExportingPng(true);
    setExportProgress({ isExporting: true, type: 'png', currentPage: currentPageIndex + 1, totalPages });
    try {
      if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
        await document.fonts.ready;
      }

      const targetEl =
        document.getElementById('mss-promotional-poster-container') ||
        document.getElementById(`mss-promotional-page-container-${currentPageIndex}`);

      if (!targetEl) {
        throw new Error('لم يتم العثور على عنصر التصميم للتصدير.');
      }

      const filename = generatePromotionalArabicFilename(
        previewItems,
        'png',
        currentPageIndex + 1,
        totalPages
      );

      const imgs = targetEl.querySelectorAll('img');
      await Promise.all(
        Array.from(imgs).map(img => {
          if (img.complete) return Promise.resolve();
          return new Promise(resolve => {
            img.onload = resolve;
            img.onerror = resolve;
          });
        })
      );

      await ensurePromotionalImageLoaded(
        effectiveDisplayOptions.headerImageSrc || PROMOTIONAL_HEADER_ASSETS.banner
      );

      const dataUrl = await toPng(targetEl, {
        quality: 1.0,
        pixelRatio: 2,
        backgroundColor: resolvePromotionalTheme(
          effectiveDisplayOptions.themeId,
          effectiveDisplayOptions.headerImageSrc
        ).posterBg,
        cacheBust: true,
      });

      await exportPromotionalAsPng(dataUrl, filename, exportType);
      showNotification({
        type: 'success',
        title: 'تم تصدير صفحة المعاينة الحالية',
        message: `تم تحميل الصفحة ${currentPageIndex + 1} بنجاح: ${filename}`,
      });
    } catch (err: any) {
      console.warn('html-to-image failed, falling back to canvas:', err);
      try {
        if (canvasRef.current) {
          await ensurePromotionalImageLoaded(
            effectiveDisplayOptions.headerImageSrc || PROMOTIONAL_HEADER_ASSETS.banner
          );
          renderPromotionalToCanvas(
            previewItems,
            {
              ...effectiveDisplayOptions,
              pageIndex: currentPageIndex,
              itemsPerPage,
            },
            canvasRef.current
          );
          const filename = generatePromotionalArabicFilename(
            previewItems,
            'png',
            currentPageIndex + 1,
            totalPages
          );
          await exportPromotionalAsPng(canvasRef.current, filename, exportType);
          showNotification({
            type: 'success',
            title: 'تم تصدير صفحة المعاينة الحالية',
            message: `تم تحميل الصفحة ${currentPageIndex + 1}: ${filename}`,
          });
          return;
        }
      } catch (canvasErr) {
        console.error('Canvas fallback also failed:', canvasErr);
      }
      showNotification({
        type: 'error',
        title: 'فشل تصدير الصفحة',
        message: err.message || 'حدث خطأ أثناء تصدير الصفحة الترويجية.',
      });
    } finally {
      setIsExportingPng(false);
      setExportProgress(null);
    }
  };

  // Download all pages sequentially as PNG with automatic pagination
  const handleExportAllPagesPng = async () => {
    if (previewItems.length === 0) return;
    setIsExportingPng(true);
    setExportProgress({ isExporting: true, type: 'png', currentPage: 1, totalPages });
    try {
      const result = await exportPromotionalAllPagesAsPng(
        previewItems,
        {
          ...effectiveDisplayOptions,
          itemsPerPage,
          exportType,
        },
        (curr, total) => {
          setExportProgress({ isExporting: true, type: 'png', currentPage: curr, totalPages: total });
        }
      );

      showNotification({
        type: 'success',
        title: 'تم تصدير كافة الصفحات بنجاح',
        message: `تم تحميل ${result.totalPages} صور ترويجية عالية الدقة بالتسمية التسلسلية المعتمدة.`,
      });
    } catch (err: any) {
      console.error('Failed to export all promotional PNGs:', err);
      showNotification({
        type: 'error',
        title: 'فشل تصدير الصور',
        message: err.message || 'حدث خطأ أثناء تصدير الصور الترويجية.',
      });
    } finally {
      setIsExportingPng(false);
      setExportProgress(null);
    }
  };

  // Main PNG export handler: automatically handles single or multi-page datasets
  const handleExportPng = async () => {
    if (previewItems.length === 0) return;
    if (totalPages > 1) {
      await handleExportAllPagesPng();
    } else {
      await handleExportSinglePagePng();
    }
  };

  // Automatic multi-page PDF export using genuine jsPDF document engine: exportPromotionalAsPdf('mss-promotional-pdf-export-container')
  const handleExportPdf = async () => {
    if (previewItems.length === 0) return;
    setIsExportingPdf(true);
    setExportProgress({ isExporting: true, type: 'pdf', currentPage: 1, totalPages });
    try {
      const filename = generatePromotionalArabicFilename(previewItems, 'pdf');
      const result = await exportPromotionalAsPdf(
        previewItems,
        {
          ...effectiveDisplayOptions,
          itemsPerPage,
          filename,
          exportType,
          onProgress: (curr, total) => {
            setExportProgress({ isExporting: true, type: 'pdf', currentPage: curr, totalPages: total });
          },
        }
      );

      showNotification({
        type: 'success',
        title: 'تم تصدير ملف PDF بنجاح',
        message: `تم إنشاء وتحميل ملف PDF متكامل بنجاح (${result.pageCount} صفحات متناسقة بدون أي اقتصاص): ${result.filename}`,
      });
    } catch (err: any) {
      console.error('Failed to export promotional PDF:', err);
      showNotification({
        type: 'error',
        title: 'فشل تصدير PDF',
        message: err.message || 'حدث خطأ أثناء إنشاء وتصدير ملف PDF.',
      });
    } finally {
      setIsExportingPdf(false);
      setExportProgress(null);
    }
  };

  return (
    <div className="space-y-6 text-slate-800" dir="rtl">
      {/* Hidden high-res canvas used for raster export */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* Advanced Filter Toolbar: Brand, Model, Price Range, Search */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-300 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Filter className="w-4.5 h-4.5 text-blue-600" />
            <h3 className="font-bold text-sm text-slate-900">فلاتر تخصيص واختيار الأجهزة</h3>
  
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

            <Button
              variant="primary"
              size="sm"
              onClick={handleOpenPreviewModal}
              disabled={selectedVisibleCount === 0}
              leftIcon={<Eye className="w-4 h-4 text-white" />}
              className="text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-2xs transition-all disabled:opacity-50"
            >
              معاينة التصميم ({selectedVisibleCount})
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
              <label className="text-xs font-bold text-slate-800 block">نطاق السعر :</label>
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
              <option value="asc">من الأقل إلى الأعلى  </option>
              <option value="desc">من الأعلى إلى الأقل  </option>
            </select>
          </div>
        </div>
      </div>

      {/* Device Selection Table */}
      <div className="bg-white rounded-2xl border border-slate-300 shadow-2xs overflow-hidden">
        <div className="p-3.5 bg-slate-100 border-b border-slate-200 flex items-center justify-between flex-wrap gap-3">
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


        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-right border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold sticky top-0 z-10">
              <tr>
                <th className="p-2.5 text-center w-12 shrink-0">تحديد</th>
                <th className="p-2.5 text-right min-w-[170px]">الماركة والموديل</th>
                <th className="p-2.5 text-right min-w-[120px] max-w-[170px]">المعالج</th>
                <th className="p-2.5 text-center w-20">الجيل</th>
                <th className="p-2.5 text-center w-20">الرام</th>
                <th className="p-2.5 text-center w-24">التخزين</th>
                <th className="p-2.5 text-right min-w-[110px] max-w-[160px]">كارت الشاشة</th>
                <th className="p-2.5 text-center w-24">الشاشة</th>
                <th className="p-2.5 text-center w-24">الكمية المتاحة</th>
                <th className="p-2.5 text-left w-28">السعر</th>
                {mode === 'accessories_manual' && (
                  <th className="p-2.5 text-center w-24">الإجراءات</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedTableItems.length === 0 ? (
                <tr>
                  <td colSpan={mode === 'accessories_manual' ? 11 : 10} className="py-12 text-center text-slate-500">
                    {mode === 'accessories_manual' && allAvailableItems.length === 0
                      ? 'لا توجد أجهزة مضافة حتى الآن. '
                      : 'لا توجد أجهزة مطابقة للفلاتر المحددة حالياً.'}
                  </td>
                </tr>
              ) : (
                paginatedTableItems.map(item => {
                  const isChecked = selectedItemIds.has(item.id);
                  return (
                    <tr
                      key={item.id}
                      onClick={() => handleToggleItem(item.id)}
                      className={`cursor-pointer transition-colors ${
                        isChecked ? 'bg-blue-50/50 hover:bg-blue-50' : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="p-2.5 text-center w-12 shrink-0" onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleItem(item.id)}
                          className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                        />
                      </td>
                      <td className="p-2.5 font-bold text-slate-900 min-w-[170px]">
                        <div className="flex items-center gap-2">
                          <BrandBadgePreview brand={item.brand} />
                          <span className="truncate">
                            {item.brand} {item.model_name}
                          </span>
                        </div>
                      </td>
                      <td className="p-2.5 font-mono text-slate-700 min-w-[120px] max-w-[170px] truncate" title={item.processor}>
                        {item.processor || '---'}
                      </td>
                      <td className="p-2.5 font-semibold text-slate-700 text-center w-20">
                        {item.generation || '---'}
                      </td>
                      <td className="p-2.5 font-mono text-slate-700 text-center w-20">
                        {item.ram || '---'}
                      </td>
                      <td className="p-2.5 font-mono text-slate-700 text-center w-24">
                        {item.storage || '---'}
                      </td>
                      <td className="p-2.5 font-mono text-slate-700 min-w-[110px] max-w-[160px] truncate" title={item.gpu}>
                        {item.gpu || '---'}
                      </td>
                      <td className="p-2.5 font-mono text-slate-700 text-center w-24">
                        {item.screen || '---'}
                      </td>
                      <td className="p-2.5 text-center w-24">
                        <Badge variant="default" size="sm">
                          {item.available_quantity || item.quantity || 1} جهاز
                        </Badge>
                      </td>
                      <td className="p-2.5 text-left font-mono font-bold text-emerald-700 w-28 whitespace-nowrap">
                        {item.price ? formatCurrency(item.price) : '---'}
                      </td>
                      {mode === 'accessories_manual' && (
                        <td className="p-2.5 text-center w-24" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1.5">
                            {onEditItem && (
                              <button
                                type="button"
                                onClick={() => onEditItem(item)}
                                className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-100/60 rounded-md transition-colors cursor-pointer"
                                title="تعديل بيانات الجهاز"
                                aria-label="تعديل"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {onDeleteItem && (
                              <button
                                type="button"
                                onClick={() => onDeleteItem(item.id)}
                                className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-100/60 rounded-md transition-colors cursor-pointer"
                                title="حذف الجهاز من القائمة"
                                aria-label="حذف"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {sortedVisibleItems.length > 0 && (
          <Pagination
            currentPage={tablePage}
            totalItems={sortedVisibleItems.length}
            pageSize={tablePageSize}
            onPageChange={setTablePage}
            showItemCount={true}
          />
        )}
      </div>

      {/* =====================================================================
          EDITABLE PREVIEW MODAL MATCHING REFERENCE DESIGN
          ===================================================================== */}
      {isPreviewOpen && (
        <Modal
          isOpen={isPreviewOpen}
          onClose={() => setIsPreviewOpen(false)}
          title="معاينة  البوستر  — COMPU MSS"
          subtitle=""
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
                  إغلاق 
                </Button>
              </div>

              <div className="flex items-center gap-2.5 flex-wrap">
                <Button
                  variant="outline"
                  size="md"
                  onClick={handleExportPdf}
                  isLoading={isExportingPdf}
                  disabled={Boolean(exportProgress)}
                  leftIcon={<FileDown className="w-4.5 h-4.5 text-blue-600" />}
                  className="font-bold border-slate-300 hover:bg-slate-50 text-slate-800"
                >
                  {totalPages > 1 ? `تصدير كافة الصفحات (${totalPages}) كـ PDF` : 'تصدير كـ PDF'}
                </Button>

                {totalPages > 1 && (
                  <>
                    <Button
                      variant="outline"
                      size="md"
                      onClick={handleExportAllPagesPng}
                      isLoading={isExportingPng}
                      disabled={Boolean(exportProgress)}
                      leftIcon={<Layers className="w-4.5 h-4.5 text-indigo-600" />}
                      className="font-bold border-indigo-300 hover:bg-indigo-50 text-indigo-900"
                    >
                      تحميل كافة الصفحات ({totalPages} صور PNG)
                    </Button>

                    <Button
                      variant="primary"
                      size="md"
                      onClick={handleExportSinglePagePng}
                      disabled={Boolean(exportProgress)}
                      leftIcon={<Download className="w-4.5 h-4.5" />}
                      className="font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-xs"
                    >
                      تحميل الصفحة الحالية {currentPageIndex + 1} (PNG)
                    </Button>
                  </>
                )}

                {totalPages === 1 && (
                  <Button
                    variant="primary"
                    size="md"
                    onClick={handleExportPng}
                    isLoading={isExportingPng}
                    disabled={Boolean(exportProgress)}
                    leftIcon={<Download className="w-4.5 h-4.5" />}
                    className="font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-xs"
                  >
                    تحميل التصميم  (PNG)
                  </Button>
                )}
              </div>
            </div>
          }
        >
          <div className="space-y-6">
            {/* Live Export Progress Banner */}
            {exportProgress && (
              <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl text-blue-950 text-xs flex items-center justify-between gap-3 shadow-xs animate-pulse">
                <div className="flex items-center gap-2.5">
                  <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin shrink-0" />
                  <span className="font-bold">
                    جاري إنشاء وتصدير الصفحة {exportProgress.currentPage} من {exportProgress.totalPages} ({exportProgress.type === 'pdf' ? 'مستند PDF موحد' : 'صور ترويجية PNG'})... يرجى الانتظار
                  </span>
                </div>
                <span className="font-mono font-extrabold text-blue-800 text-sm">
                  {Math.round((exportProgress.currentPage / exportProgress.totalPages) * 100)}%
                </span>
              </div>
            )}

            {/* PDF Recommendation Warning Banner When > 10 Devices (totalPages > 1) */}
            {totalPages > 1 && !exportProgress && (
              <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl text-amber-950 text-xs flex items-center justify-between gap-3 shadow-2xs">
                <div className="flex items-center gap-2">
                  <Share2 className="w-4 h-4 text-amber-600 shrink-0" />
                  <span className="font-bold">
                    لقد قمت بتحديد عدد أجهزة ({previewItems.length} جهاز على {totalPages} صفحات). يُنصح بالتصدير بصيغة PDF لتجربة عرض ومشاركة متناسقة بدون أي اقتصاص.
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
                      <option value="asc">من الأقل للأعلى </option>
                      <option value="desc">من الأعلى للأقل </option>
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
                      <option value={8}>8 أجهزة</option>
                      <option value={10}>10 أجهزة </option>
                      <option value={12}>12 جهاز</option>
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
                displayOptions={effectiveDisplayOptions}
              />
            </div>

            {/* Multi-Page Container Dedicated for Pristine PDF and Batch PNG Export */}
            <div
              id="mss-promotional-pdf-export-container"
              style={{
                position: 'fixed',
                left: '-99999px',
                top: 0,
                pointerEvents: 'none',
                zIndex: -9999,
                width: '1000px',
              }}
            >
              {Array.from({ length: totalPages }).map((_, p) => {
                const pageSlice = previewItems.slice(p * itemsPerPage, (p + 1) * itemsPerPage);
                return (
                  <div
                    key={p}
                    className="promotional-page-wrapper"
                    style={{
                      pageBreakAfter: p < totalPages - 1 ? 'always' : 'auto',
                      breakAfter: p < totalPages - 1 ? 'page' : 'auto',
                      marginBottom: '20px',
                    }}
                  >
                    <PromotionalPosterPage
                      id={`mss-promotional-page-container-${p}`}
                      pageItems={pageSlice}
                      pageIndex={p}
                      totalPages={totalPages}
                      displayOptions={effectiveDisplayOptions}
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
                                    min="0"
                                    placeholder="0"
                                    value={editFormData.price !== undefined && editFormData.price !== null ? editFormData.price : ''}
                                    onChange={e => {
                                      let val = e.target.value;
                                      if (val.length > 1 && val.startsWith('0') && !val.startsWith('0.')) {
                                        val = val.replace(/^0+(?=\d)/, '');
                                      }
                                      setEditFormData(prev => ({
                                        ...prev,
                                        price: val,
                                      }));
                                    }}
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