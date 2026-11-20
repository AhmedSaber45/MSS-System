import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Badge } from '@/components/common/Badge';
import { Spinner } from '@/components/common/Spinner';
import { DateRangeInputs } from '@/components/common/DateRangeInputs';
import {
  FileSpreadsheet,
  Laptop,
  CheckCircle2,
  Printer,
  FileDown,
  Download,
  RefreshCw,
  Search,
  Filter,
  DollarSign,
  Hash,
  Eye,
  EyeOff,
  Layers,
  ArrowUpDown,
  ShoppingBag,
  Store,
  Building2,
  FolderTree,
  Monitor,
  Sparkles,
  CheckSquare,
  Square,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
import { mssInventoryService } from '@/services/mssInventoryService.ts';
import { mssCatalogService } from '@/services/mssCatalogService.ts';
import { mssReportsService } from '@/services/mssReportsService.ts';
import { mssWholesaleExportService, formatArabicExportFilename, matchesCategory } from '@/services/mssWholesaleExportService.ts';
import { unifiedDashboardService } from '@/services/unifiedDashboardService.ts';
import { documentPrintService } from '@/lib/documentPrintService';
import { usePageRefresh } from '@/context/PageRefreshContext';
import { useNotification } from '@/context/NotificationContext';
import { MSSPromotionalGenerator } from '@/components/placeholders/mss/MSSPromotionalGenerator.tsx';
import type { MSSDevice, MSSModel } from '@/types/mssInventory.ts';
import type {
  ModelStockQuantitySummary,
  SoldLaptopsReport,
  WholesaleExportOptions,
  WholesaleExportRow,
} from '@/types/mssReports.ts';
import type { ReportPeriod } from '@/types/unifiedDashboard.ts';

export const MSSDeviceReportsView: React.FC = () => {
  const { showNotification } = useNotification();
  const { isRefreshing, triggerRefresh } = usePageRefresh();

  // Active sub-tab
  const [activeTab, setActiveTab] = useState<'wholesale' | 'promotional-image' | 'model-summary' | 'sold-report'>('wholesale');

  // Raw devices and models for promotional generation and advanced filters
  const [allDevices, setAllDevices] = useState<MSSDevice[]>([]);
  const [allModels, setAllModels] = useState<MSSModel[]>([]);

  // Loading states
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // =========================================================================
  // 1. WHOLESALE EXPORT CONTROLS & PREVIEW STATE
  // =========================================================================
  const [wholesaleOptions, setWholesaleOptions] = useState<WholesaleExportOptions>({
    includePrices: true,
    includeQuantity: true,
    includeSerialNumbers: false,
    includeStatus: true,
    includeBranch: true,
    includeCategory: true,
    includeScreen: true,
    branchFilter: 'ALL',
    priceSortOrder: 'asc',
  });
  const [wholesaleData, setWholesaleData] = useState<WholesaleExportRow[]>([]);
  const [wholesaleSearch, setWholesaleSearch] = useState<string>('');
  const [wholesalePage, setWholesalePage] = useState<number>(1);
  const wholesalePageSize = 9;

  // Advanced Filtering & Device Selection State for Wholesale Export
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const categoriesInitializedRef = useRef<boolean>(false);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [selectedModelIds, setSelectedModelIds] = useState<string[]>([]);
  const [wholesaleMinPrice, setWholesaleMinPrice] = useState<string>('');
  const [wholesaleMaxPrice, setWholesaleMaxPrice] = useState<string>('');
  const [selectedRowKeys, setSelectedRowKeys] = useState<Set<string>>(new Set());

  // =========================================================================
  // 2. MODEL QUANTITY SUMMARY STATE
  // =========================================================================
  const [modelSummaries, setModelSummaries] = useState<ModelStockQuantitySummary[]>([]);
  const [summarySearch, setSummarySearch] = useState<string>('');
  const [summaryCategory, setSummaryCategory] = useState<string>('ALL');
  const [summaryPage, setSummaryPage] = useState<number>(1);
  const summaryPageSize = 9;

  // =========================================================================
  // 3. SOLD DEVICES REPORT STATE
  // =========================================================================
  const [soldPeriod, setSoldPeriod] = useState<ReportPeriod>('month');
  const [soldCustomStart, setSoldCustomStart] = useState<string>('');
  const [soldCustomEnd, setSoldCustomEnd] = useState<string>('');
  const [soldWarehouse, setSoldWarehouse] = useState<string>('ALL');
  const [soldReport, setSoldReport] = useState<SoldLaptopsReport | null>(null);
  const [soldDateLabel, setSoldDateLabel] = useState<string>('');
  const [soldPage, setSoldPage] = useState<number>(1);
  const soldPageSize = 9;

  // Stable row key extractor for wholesale export rows
  const getRowKey = useCallback((r: WholesaleExportRow, fallbackIdx?: number): string => {
    return (
      r._rowKey ||
      r['السيريال نمبر'] ||
      r['السيريال (Serial Number)'] ||
      r.serial_number ||
      r['الموديل'] ||
      r['الماركة والموديل (Brand & Model)'] ||
      r.model_name ||
      (fallbackIdx !== undefined ? `row-${fallbackIdx}` : '')
    );
  }, []);

  // Active filter options for wholesale export (excluding row selection keys to prevent feedback loop)
  const activeWholesaleFilterOptions = useMemo<WholesaleExportOptions>(() => {
    return {
      ...wholesaleOptions,
      selectedCategories: selectedCategories.length > 0 ? selectedCategories : (categoriesInitializedRef.current ? [] : undefined),
      selectedBrands: selectedBrands.length > 0 ? selectedBrands : undefined,
      selectedModelIds: selectedModelIds.length > 0 ? selectedModelIds : undefined,
      minPrice: wholesaleMinPrice ? Number(wholesaleMinPrice) : undefined,
      maxPrice: wholesaleMaxPrice ? Number(wholesaleMaxPrice) : undefined,
    };
  }, [wholesaleOptions, selectedCategories, selectedBrands, selectedModelIds, wholesaleMinPrice, wholesaleMaxPrice]);

  // Active filter signature representing data-level filters (categories, brands, models, prices, branch, mode, options)
  const activeFilterSignature = useMemo(() => {
    return [
      (selectedCategories || []).slice().sort().join(','),
      (selectedBrands || []).slice().sort().join(','),
      (selectedModelIds || []).slice().sort().join(','),
      (wholesaleMinPrice || '').trim(),
      (wholesaleMaxPrice || '').trim(),
      wholesaleOptions.branchFilter || 'ALL',
      wholesaleOptions.includeSerialNumbers ? 'serial' : 'model',
      wholesaleOptions.priceSortOrder || 'asc',
      wholesaleOptions.includeBranch !== false ? 'withBranch' : 'noBranch',
      wholesaleOptions.includeStatus !== false ? 'withStatus' : 'noStatus',
      wholesaleOptions.includeCategory !== false ? 'withCategory' : 'noCategory',
      wholesaleOptions.includeScreen !== false ? 'withScreen' : 'noScreen',
      wholesaleOptions.includePrices !== false ? 'withPrices' : 'noPrices',
      wholesaleOptions.includeQuantity !== false ? 'withQty' : 'noQty',
    ].join(':::');
  }, [selectedCategories, selectedBrands, selectedModelIds, wholesaleMinPrice, wholesaleMaxPrice, wholesaleOptions]);

  const [loadedFilterSignature, setLoadedFilterSignature] = useState<string>('');

  // Combined full filter signature including client-side search query
  const fullFilterSignature = useMemo(() => {
    return `${loadedFilterSignature}###${(wholesaleSearch || '').trim().toLowerCase()}`;
  }, [loadedFilterSignature, wholesaleSearch]);

  const lastSelectedSignatureRef = useRef<string | null>(null);

  // Dynamically extract distinct categories from devices and catalog models
  const availableCategories = useMemo(() => {
    const cats = new Set<string>();
    allDevices.forEach(d => {
      const c = d.category || d.model?.category;
      if (c && c.trim()) cats.add(c.trim());
    });
    allModels.forEach(m => {
      if (m.category && m.category.trim()) cats.add(m.category.trim());
    });
    // Fallback: If no categories loaded yet or empty, provide default Laptops & Screens
    if (cats.size === 0) {
      cats.add('لابتوب');
      cats.add('شاشة');
    }
    return Array.from(cats).sort((a, b) => a.localeCompare(b, 'ar'));
  }, [allDevices, allModels]);

  // Initialize selectedCategories on first load once availableCategories are ready
  useEffect(() => {
    if (!categoriesInitializedRef.current && availableCategories.length > 0) {
      categoriesInitializedRef.current = true;
      setSelectedCategories(availableCategories);
    }
  }, [availableCategories]);

  // Unique brands list for filters (filtered by category if selected)
  const availableBrands = useMemo(() => {
    const brands = new Set<string>();
    allDevices.forEach(d => {
      const devCat = d.category || d.model?.category;
      if (selectedCategories.length > 0 && !matchesCategory(devCat, selectedCategories)) {
        return;
      }
      if (d.brand) brands.add(d.brand.trim());
    });
    return Array.from(brands).sort((a, b) => a.localeCompare(b, 'ar'));
  }, [allDevices, selectedCategories]);

  // Available models dynamically filtered by selected categories and brands
  const availableModels = useMemo(() => {
    let list = allModels;
    if (selectedCategories.length > 0) {
      list = list.filter(m => matchesCategory(m.category, selectedCategories));
    }
    if (selectedBrands.length > 0) {
      const brandSet = new Set(selectedBrands.map(b => b.trim().toLowerCase()));
      list = list.filter(m => brandSet.has((m.brand || '').trim().toLowerCase()));
    }
    return list;
  }, [allModels, selectedCategories, selectedBrands]);

  // Automatically prune selectedBrands if they are no longer in availableBrands
  useEffect(() => {
    if (selectedCategories.length > 0 && selectedBrands.length > 0) {
      const validBrands = new Set(availableBrands);
      setSelectedBrands(prev => prev.filter(b => validBrands.has(b)));
    }
  }, [selectedCategories, availableBrands]);

  // Automatically prune selectedModelIds if they are no longer in availableModels
  useEffect(() => {
    if (selectedBrands.length > 0 || selectedCategories.length > 0) {
      const validIds = new Set(availableModels.map(m => m.id));
      setSelectedModelIds(prev => prev.filter(id => validIds.has(id)));
    }
  }, [selectedBrands, selectedCategories, availableModels]);

  // =========================================================================
  // DATA LOADING
  // =========================================================================
  const loadAllData = useCallback(async () => {
    setIsLoading(true);
    try {
      // 0. Load raw devices and models for promotional image generator and advanced filters
      const [devices, models] = await Promise.all([
        mssInventoryService.getDevices({ status: 'AVAILABLE' }),
        mssCatalogService.getModels(),
      ]);
      setAllDevices(devices || []);
      setAllModels(models || []);

      // 1. Build wholesale export preview data using loaded devices
      const { rows: previewRows } = await mssWholesaleExportService.buildWholesaleData(
        activeWholesaleFilterOptions,
        devices || []
      );
      setWholesaleData(previewRows || []);
      setLoadedFilterSignature(activeFilterSignature);

      // 2. Load model stock quantity summary
      const crossSummaries = await mssInventoryService.getModelStockQuantitySummary();
      setModelSummaries(crossSummaries);

      // 3. Load sold devices report
      const dateFilter = unifiedDashboardService.calculateDateRange(
        soldPeriod,
        soldCustomStart,
        soldCustomEnd
      );
      setSoldDateLabel(dateFilter.label);
      const soldData = await mssReportsService.getSoldLaptopsByModelReport({
        warehouse: soldWarehouse,
        startDate: dateFilter.startDate,
        endDate: dateFilter.endDate,
      });
      setSoldReport(soldData);
    } catch (err: any) {
      console.warn('Failed to load device reports data:', err);
      showNotification({
        type: 'error',
        title: 'خطأ في جلب بيانات تقارير الأجهزة',
        message: err.message || 'تعذر تحميل بيانات الأجهزة ومخزون الجملة',
      });
    } finally {
      setIsLoading(false);
    }
  }, [activeWholesaleFilterOptions, activeFilterSignature, soldPeriod, soldCustomStart, soldCustomEnd, soldWarehouse, showNotification]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // Re-run wholesale preview instantaneously in-memory when activeWholesaleFilterOptions change
  useEffect(() => {
    if (allDevices.length === 0) return;
    let isCancelled = false;
    mssWholesaleExportService.buildWholesaleData(activeWholesaleFilterOptions, allDevices).then(({ rows }) => {
      if (!isCancelled) {
        setWholesaleData(rows || []);
        setLoadedFilterSignature(activeFilterSignature);
      }
    });
    return () => {
      isCancelled = true;
    };
  }, [activeWholesaleFilterOptions, allDevices, activeFilterSignature]);

  // Handle Export to Excel
  const handleExportToExcel = async () => {
    if (filteredWholesaleRows.length === 0) {
      showNotification({
        type: 'warning',
        title: 'لا توجد أجهزة مطابقة للتصدير',
        message: 'لا توجد أجهزة مطابقة لمعايير الفلترة المحددة حالياً. يرجى تعديل خيارات الفلترة.',
      });
      return;
    }

    // Export only matching rows that are selected
    const rowsToExport = filteredWholesaleRows.filter((r, idx) => {
      const key = getRowKey(r, idx);
      return selectedRowKeys.has(key);
    });

    if (rowsToExport.length === 0) {
      showNotification({
        type: 'warning',
        title: 'لم يتم تحديد أي أجهزة للتصدير',
        message: 'يرجى تحديد جهاز واحد على الأقل لتصديره أو الضغط على "تحديد كافة المطابقة".',
      });
      return;
    }

    setIsExporting(true);
    try {
      const { filename } = await mssWholesaleExportService.exportWholesaleInventoryToExcel(
        activeWholesaleFilterOptions,
        rowsToExport
      );
      showNotification({
        type: 'success',
        title: 'تم تصدير ملف إكسل بنجاح',
        message: `تم تجهيز وتحميل ملف مخزون الجملة: ${filename}`,
      });
    } catch (err: any) {
      console.error('Failed to export wholesale excel:', err);
      showNotification({
        type: 'error',
        title: 'فشل تصدير ملف إكسل',
        message: err.message || 'حدث خطأ أثناء إنشاء ملف الإكسل',
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Handle Print Sold Devices Report
  const handlePrintSoldReport = async () => {
    if (!soldReport) return;
    const title = formatArabicExportFilename(`تقرير_مبيعات_الأجهزة_${soldWarehouse}_${soldDateLabel || 'فترة'}`);
    await documentPrintService.printElement('mss-device-sold-report-print', {
      title,
      format: 'report',
      orientation: 'portrait',
    });
  };

  // Handle Export Sold Devices PDF
  const handleExportSoldReportPdf = async () => {
    if (!soldReport) return;
    showNotification({
      type: 'info',
      title: 'استخراج تقرير الأجهزة المباعة كـ PDF',
      message: 'تم فتح نافذة الطباعة. اختر "حفظ بتنسيق PDF" (Save as PDF) لحفظ المستند.',
    });
    await handlePrintSoldReport();
  };

  // =========================================================================
  // FILTERED LISTS & PAGINATION
  // =========================================================================

  // 1. Wholesale Preview Filtering
  const filteredWholesaleRows = useMemo(() => {
    if (!wholesaleSearch.trim()) return wholesaleData;
    const q = wholesaleSearch.toLowerCase().trim();
    return wholesaleData.filter(row => {
      const values = Object.values(row).join(' ').toLowerCase();
      return values.includes(q);
    });
  }, [wholesaleData, wholesaleSearch]);

  const totalWholesalePages = Math.max(1, Math.ceil(filteredWholesaleRows.length / wholesalePageSize));
  const paginatedWholesaleRows = useMemo(() => {
    const start = (wholesalePage - 1) * wholesalePageSize;
    return filteredWholesaleRows.slice(start, start + wholesalePageSize);
  }, [filteredWholesaleRows, wholesalePage, wholesalePageSize]);

  // Automatically select all filtered devices whenever filters change or initial data loads:
  // - When fullFilterSignature changes: auto-select all matching devices and prune old selections
  // - When user unchecks an individual device: manual exclusion is preserved
  // - When user reselects a device: manual inclusion is preserved
  useEffect(() => {
    if (!loadedFilterSignature) return;

    const matchingKeys = filteredWholesaleRows.map((r, idx) => getRowKey(r, idx)).filter(Boolean);
    const matchingKeySet = new Set(matchingKeys);

    // If filter signature changed (or first time after data loaded)
    if (lastSelectedSignatureRef.current !== fullFilterSignature) {
      lastSelectedSignatureRef.current = fullFilterSignature;
      setSelectedRowKeys(new Set(matchingKeys));
      return;
    }

    // If fullFilterSignature didn't change but filteredWholesaleRows changed:
    // Retain only selections that still match active filters
    setSelectedRowKeys(prev => {
      const next = new Set<string>();
      prev.forEach(key => {
        if (matchingKeySet.has(key)) {
          next.add(key);
        }
      });
      // If previous selections no longer match anything but matching items exist, auto-select all
      if (next.size === 0 && matchingKeys.length > 0) {
        return new Set(matchingKeys);
      }
      return next;
    });
  }, [loadedFilterSignature, fullFilterSignature, filteredWholesaleRows, getRowKey]);

  // Selected device count strictly within currently filtered/matching devices
  const selectedCount = useMemo(() => {
    return filteredWholesaleRows.filter((r, idx) => selectedRowKeys.has(getRowKey(r, idx))).length;
  }, [filteredWholesaleRows, selectedRowKeys, getRowKey]);

  // 2. Model Summary Filtering
  const filteredModelSummaries = useMemo(() => {
    return modelSummaries.filter(m => {
      if (summaryCategory !== 'ALL' && m.category !== summaryCategory) return false;
      if (!summarySearch.trim()) return true;
      const q = summarySearch.toLowerCase().trim();
      return (
        m.model_name.toLowerCase().includes(q) ||
        m.brand.toLowerCase().includes(q) ||
        (m.model_code && m.model_code.toLowerCase().includes(q)) ||
        (m.specifications && m.specifications.toLowerCase().includes(q))
      );
    });
  }, [modelSummaries, summarySearch, summaryCategory]);

  const totalSummaryPages = Math.max(1, Math.ceil(filteredModelSummaries.length / summaryPageSize));
  const paginatedModelSummaries = useMemo(() => {
    const start = (summaryPage - 1) * summaryPageSize;
    return filteredModelSummaries.slice(start, start + summaryPageSize);
  }, [filteredModelSummaries, summaryPage, summaryPageSize]);

  // 3. Sold Items Filtering
  const soldItems = useMemo(() => {
    return soldReport?.items || [];
  }, [soldReport]);

  const totalSoldPages = Math.max(1, Math.ceil(soldItems.length / soldPageSize));
  const paginatedSoldItems = useMemo(() => {
    const start = (soldPage - 1) * soldPageSize;
    return soldItems.slice(start, start + soldPageSize);
  }, [soldItems, soldPage, soldPageSize]);

  // Top KPI calculations for Model Summary
  const grandTotal = modelSummaries.reduce((sum, s) => sum + s.total_units, 0);
  const grandExisting = modelSummaries.reduce((sum, s) => sum + s.existing_units, 0);
  const grandSold = modelSummaries.reduce((sum, s) => sum + s.sold_units, 0);
  const grandSerial = modelSummaries.reduce((sum, s) => sum + s.existing_serialized, 0);
  const grandBulk = modelSummaries.reduce((sum, s) => sum + s.existing_non_serialized, 0);
  const isStrictMatch = grandTotal === grandExisting + grandSold;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="تقارير الأجهزة ومخزون الجملة — Compu MSS"
        subtitle="ملخص كميات الموديلات بالمخزون، تقارير الأجهزة المباعة، وتصدير قوائم المخزون المتاح للجملة (Excel)"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => triggerRefresh(loadAllData, 'جارٍ تحديث تقارير الأجهزة ومخزون الجملة...')}
              isLoading={isRefreshing || isLoading}
              leftIcon={<RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />}
            >
              تحديث البيانات
            </Button>
          </div>
        }
      />

      {/* Navigation Sub-Tabs */}
      <div className="flex border-b border-slate-300 bg-white p-1 rounded-xl shadow-2xs gap-1.5 flex-wrap">
        <button
          type="button"
          onClick={() => setActiveTab('wholesale')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-all cursor-pointer ${
            activeTab === 'wholesale'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <FileSpreadsheet className="w-4.5 h-4.5 text-emerald-400" />
          <span>تصدير مخزون الجملة (Excel)</span>
          <Badge variant="primary" size="sm" className="mr-1">
            {wholesaleData.length}
          </Badge>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('promotional-image')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-all cursor-pointer ${
            activeTab === 'promotional-image'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Sparkles className="w-4.5 h-4.5 text-amber-400" />
          <span>تصميم عروض السوشيال ميديا (Promotional Images)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('model-summary')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-all cursor-pointer ${
            activeTab === 'model-summary'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Layers className="w-4.5 h-4.5 text-blue-400" />
          <span>ملخص كميات الموديلات</span>
          <Badge variant="default" size="sm" className="mr-1">
            {modelSummaries.length}
          </Badge>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('sold-report')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-all cursor-pointer ${
            activeTab === 'sold-report'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <ShoppingBag className="w-4.5 h-4.5 text-purple-400" />
          <span>تقرير الأجهزة المباعة</span>
          <Badge variant="default" size="sm" className="mr-1">
            {soldReport?.total_sold_units || 0} مباع
          </Badge>
        </button>
      </div>

      {/* =====================================================================
          TAB 1: WHOLESALE INVENTORY EXCEL EXPORT (تصدير مخزون الجملة)
          ===================================================================== */}
      {activeTab === 'wholesale' && (
        <div className="space-y-6">
          {/* Controls Card */}
          <Card className="bg-white border-slate-300 shadow-2xs">
            <CardHeader className="py-3.5 px-5 bg-slate-50 border-b border-slate-200">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                  <CardTitle className="text-base font-bold text-slate-900">
                    إعدادات تصدير ملف مخزون الجملة (Excel)
                  </CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="primary"
                    size="md"
                    onClick={handleExportToExcel}
                    disabled={filteredWholesaleRows.length === 0 || isExporting}
                    isLoading={isExporting}
                    leftIcon={<Download className="w-4.5 h-4.5" />}
                    className="font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    تصدير ملف إكسل للجملة (XLSX)
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              {/* Controls Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7 gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
                {/* 1. Include Prices */}
                <label className="flex items-start gap-3 p-3 bg-white rounded-lg border border-slate-200 hover:border-slate-300 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={wholesaleOptions.includePrices}
                    onChange={e =>
                      setWholesaleOptions(prev => ({ ...prev, includePrices: e.target.checked }))
                    }
                    className="mt-0.5 w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                  />
                  <div>
                    <span className="text-sm font-bold text-slate-900 block flex items-center gap-1.5">
                      <DollarSign className="w-4 h-4 text-emerald-600" />
                      إدراج الأسعار (Prices)
                    </span>
                    <span className="text-xs text-slate-500 block mt-0.5">
                      {wholesaleOptions.includePrices ? 'الأسعار ظاهرة في ملف الإكسل' : 'إخفاء عمود الأسعار بالكامل'}
                    </span>
                  </div>
                </label>

                {/* 2. Include Quantity (Only relevant when serials off) */}
                <label
                  className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                    wholesaleOptions.includeSerialNumbers
                      ? 'bg-slate-100 border-slate-200 opacity-60 cursor-not-allowed'
                      : 'bg-white border-slate-200 hover:border-slate-300 cursor-pointer'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={wholesaleOptions.includeQuantity}
                    disabled={wholesaleOptions.includeSerialNumbers}
                    onChange={e =>
                      setWholesaleOptions(prev => ({ ...prev, includeQuantity: e.target.checked }))
                    }
                    className="mt-0.5 w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                  />
                  <div>
                    <span className="text-sm font-bold text-slate-900 block flex items-center gap-1.5">
                      <Hash className="w-4 h-4 text-blue-600" />
                      إدراج الكمية (Quantity)
                    </span>
                    <span className="text-xs text-slate-500 block mt-0.5">
                      {wholesaleOptions.includeSerialNumbers
                        ? 'محجوب تلقائياً في نمط الأجهزة المسلسلة'
                        : wholesaleOptions.includeQuantity
                        ? 'عرض إجمالي الكمية المتاحة لكل موديل'
                        : 'إخفاء عمود الكمية من الملف'}
                    </span>
                  </div>
                </label>

                {/* 3. Include Serial Numbers (Switches to Mode B) */}
                <label className="flex items-start gap-3 p-3 bg-white rounded-lg border border-slate-200 hover:border-slate-300 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={wholesaleOptions.includeSerialNumbers}
                    onChange={e =>
                      setWholesaleOptions(prev => ({
                        ...prev,
                        includeSerialNumbers: e.target.checked,
                      }))
                    }
                    className="mt-0.5 w-4 h-4 text-purple-600 rounded border-slate-300 focus:ring-purple-500 cursor-pointer"
                  />
                  <div>
                    <span className="text-sm font-bold text-slate-900 block flex items-center gap-1.5">
                      <Laptop className="w-4 h-4 text-purple-600" />
                      إدراج السيريال (Serials)
                    </span>
                    <span className="text-xs text-slate-500 block mt-0.5">
                      {wholesaleOptions.includeSerialNumbers
                        ? 'نمط Mode B: أجهزة فردية مسلسلة فقط'
                        : 'نمط Mode A: تجميعي حسب الموديل'}
                    </span>
                  </div>
                </label>

                {/* 4. Include Category Column */}
                <label className="flex items-start gap-3 p-3 bg-white rounded-lg border border-slate-200 hover:border-slate-300 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={wholesaleOptions.includeCategory !== false}
                    onChange={e =>
                      setWholesaleOptions(prev => ({
                        ...prev,
                        includeCategory: e.target.checked,
                      }))
                    }
                    className="mt-0.5 w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                  />
                  <div>
                    <span className="text-sm font-bold text-slate-900 block flex items-center gap-1.5">
                      <FolderTree className="w-4 h-4 text-amber-600" />
                      إدراج عمود الفئة
                    </span>
                    <span className="text-xs text-slate-500 block mt-0.5">
                      {wholesaleOptions.includeCategory !== false
                        ? 'عمود الفئة ظاهر في ملف الإكسل'
                        : 'إخفاء عمود الفئة تماماً من الملف'}
                    </span>
                  </div>
                </label>

                {/* 5. Include Screen Column */}
                <label className="flex items-start gap-3 p-3 bg-white rounded-lg border border-slate-200 hover:border-slate-300 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={wholesaleOptions.includeScreen !== false}
                    onChange={e =>
                      setWholesaleOptions(prev => ({
                        ...prev,
                        includeScreen: e.target.checked,
                      }))
                    }
                    className="mt-0.5 w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                  />
                  <div>
                    <span className="text-sm font-bold text-slate-900 block flex items-center gap-1.5">
                      <Monitor className="w-4 h-4 text-blue-600" />
                      إدراج عمود الشاشة (Screen)
                    </span>
                    <span className="text-xs text-slate-500 block mt-0.5">
                      {wholesaleOptions.includeScreen !== false
                        ? 'عمود مواصفات الشاشة ظاهر في الملف'
                        : 'إخفاء عمود الشاشة تماماً من الملف'}
                    </span>
                  </div>
                </label>

                {/* 6. Include Status Column */}
                <label className="flex items-start gap-3 p-3 bg-white rounded-lg border border-slate-200 hover:border-slate-300 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={wholesaleOptions.includeStatus !== false}
                    onChange={e =>
                      setWholesaleOptions(prev => ({
                        ...prev,
                        includeStatus: e.target.checked,
                      }))
                    }
                    className="mt-0.5 w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                  />
                  <div>
                    <span className="text-sm font-bold text-slate-900 block flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-teal-600" />
                      إدراج عمود الحالة (Status)
                    </span>
                    <span className="text-xs text-slate-500 block mt-0.5">
                      {wholesaleOptions.includeStatus !== false
                        ? 'عمود الحالة ظاهر في الملف'
                        : 'إخفاء عمود الحالة تماماً من الملف'}
                    </span>
                  </div>
                </label>

                {/* 7. Include Branch & Stock Column (تحديد وتصدير الفرع والمخزون) */}
                <label className="flex items-start gap-3 p-3 bg-white rounded-lg border border-slate-200 hover:border-slate-300 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={wholesaleOptions.includeBranch !== false}
                    onChange={e =>
                      setWholesaleOptions(prev => ({
                        ...prev,
                        includeBranch: e.target.checked,
                      }))
                    }
                    className="mt-0.5 w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                  />
                  <div>
                    <span className="text-sm font-bold text-slate-900 block flex items-center gap-1.5">
                      <Building2 className="w-4 h-4 text-indigo-600" />
                      تحديد الفرع والمخزون (Branch)
                    </span>
                    <span className="text-xs text-slate-500 block mt-0.5">
                      {wholesaleOptions.includeBranch !== false
                        ? 'تصدير عمود الفرع والمخزن في ملف الإكسل'
                        : 'عدم تصدير عمود الفرع والمخزن (إخفاء بالكامل)'}
                    </span>
                  </div>
                </label>

                {/* 8. Target Branch / Store Filter */}
                <div className="p-3 bg-white rounded-lg border border-slate-200 flex flex-col justify-between">
                  <label className="text-sm font-bold text-slate-900 block flex items-center gap-1.5 mb-1.5">
                    <Store className="w-4 h-4 text-blue-600" />
                    فرع المخزون المستهدف للتصدير:
                  </label>
                  <select
                    value={wholesaleOptions.branchFilter}
                    onChange={e =>
                      setWholesaleOptions(prev => ({ ...prev, branchFilter: e.target.value }))
                    }
                    aria-label="تحديد الفرع / المخزن لتصدير مخزون الجملة"
                    className="w-full text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                  >
                    <option value="ALL">كافة الفروع والمخازن</option>
                    <option value="محل 1">محل 1 فقط</option>
                    <option value="محل 2">محل 2 فقط</option>
                  </select>
                  <span className="text-[11px] text-slate-500 block mt-1">
                    {wholesaleOptions.branchFilter === 'محل 1'
                      ? 'تصدير مخزون محل 1 فقط'
                      : wholesaleOptions.branchFilter === 'محل 2'
                      ? 'تصدير مخزون محل 2 فقط'
                      : 'تصدير مخزون كافة الفروع والمخازن'}
                  </span>
                </div>

                {/* 9. Price Sort Order */}
                <div className="p-3 bg-white rounded-lg border border-slate-200 flex flex-col justify-between">
                  <label className="text-sm font-bold text-slate-900 block flex items-center gap-1.5 mb-1.5">
                    <ArrowUpDown className="w-4 h-4 text-emerald-600" />
                    ترتيب الأسعار:
                  </label>
                  <select
                    value={wholesaleOptions.priceSortOrder || 'asc'}
                    onChange={e =>
                      setWholesaleOptions(prev => ({
                        ...prev,
                        priceSortOrder: e.target.value as 'asc' | 'desc',
                      }))
                    }
                    aria-label="ترتيب الأسعار في التصدير"
                    className="w-full text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                  >
                    <option value="asc">من الأقل للأعلى (تصاعدي)</option>
                    <option value="desc">من الأعلى للأقل (تنازلي)</option>
                  </select>
                  <span className="text-[11px] text-slate-500 block mt-1">
                    {(wholesaleOptions.priceSortOrder || 'asc') === 'asc'
                      ? 'يبدأ بالأجهزة الأقل سعراً'
                      : 'يبدأ بالأجهزة الأعلى سعراً'}
                  </span>
                </div>
              </div>

              {/* Mode Explanation Notice Banner */}
              <div
                className={`p-3.5 rounded-xl border flex items-start gap-3 text-xs leading-relaxed ${
                  wholesaleOptions.includeSerialNumbers
                    ? 'bg-purple-50/80 border-purple-200 text-purple-950'
                    : 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
                }`}
              >
                <div className="shrink-0 mt-0.5">
                  {wholesaleOptions.includeSerialNumbers ? (
                    <Laptop className="w-4.5 h-4.5 text-purple-700" />
                  ) : (
                    <Layers className="w-4.5 h-4.5 text-emerald-700" />
                  )}
                </div>
                <div className="space-y-0.5">
                  <div className="font-bold text-sm">
                    {wholesaleOptions.includeSerialNumbers
                      ? 'النمط الفردي المسلسل (Mode B): أجهزة مفردة مع السيريال — مرتبة تصاعدياً حسب السعر'
                      : 'النمط التجميعي حسب الموديل (Mode A): سطر واحد لكل موديل لابتوب'}
                  </div>
                  <p>
                    {wholesaleOptions.includeSerialNumbers
                      ? 'يتم استخراج الأجهزة المسلسلة المتاحة فقط (سطر واحد لكل جهاز فعلي مع رقم السيريال). يتم فرز وترتيب الأجهزة تصاعدياً من الأقل سعراً إلى الأعلى سعراً، حتى وإن تم إخفاء عمود السعر. يُستبعد المخزون غير المسلسل (المجمع) تلقائياً لتجنب اختلاق أرقام سيريال وهمية.'
                      : 'يتم استخراج سطر واحد لكل موديل متاح، مدمجاً إجمالي الكميات المتاحة من الأجهزة المسلسلة والمخزون المجمع في فرع العرض المختار. المواصفات الفنية معروضة في أعمدة مستقلة تماماً.'}
                  </p>
                  <div className="font-semibold text-[11px] pt-1">
                    اسم ورقة الإكسل: <span className="font-mono underline">المخزون المتاح للجملة</span> • أي معلومة غير متوفرة تُستبدل تلقائياً برمز <span className="font-mono bg-white/70 px-1 rounded">---</span>
                  </div>
                </div>
              </div>

              {/* Advanced Filtering & Selection Controls */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <SlidersHorizontal className="w-4 h-4 text-slate-700" />
                    <span className="text-sm font-bold text-slate-900">
                      تصفية وتخصيص الأجهزة المحددة للتصدير (Advanced Selection)
                    </span>
                  </div>
                  {(selectedCategories.length < availableCategories.length || selectedBrands.length > 0 || selectedModelIds.length > 0 || wholesaleMinPrice || wholesaleMaxPrice || wholesaleSearch || selectedCount < filteredWholesaleRows.length) && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCategories([...availableCategories]);
                        setSelectedBrands([]);
                        setSelectedModelIds([]);
                        setWholesaleMinPrice('');
                        setWholesaleMaxPrice('');
                        setWholesaleSearch('');
                        setWholesalePage(1);
                      }}
                      className="text-xs text-rose-600 hover:text-rose-800 font-semibold cursor-pointer underline"
                    >
                      إعادة ضبط التصفية المتقدمة
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                  {/* Category Filter (Dynamic Multi-select Checkboxes) */}
                  <div className="space-y-1.5 p-3 bg-white rounded-lg border border-slate-200 flex flex-col justify-between">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                      <label className="text-xs font-bold text-slate-800">
                        تصفية حسب الفئة ({selectedCategories.length > 0 ? `${selectedCategories.length} محددة` : 'كافة الفئات'}):
                      </label>
                      <div className="flex items-center gap-2 text-[11px]">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedCategories([...availableCategories]);
                            setWholesalePage(1);
                          }}
                          className="text-emerald-700 hover:underline font-semibold"
                        >
                          تحديد الكل
                        </button>
                        <span className="text-slate-300">|</span>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedCategories([]);
                            setWholesalePage(1);
                          }}
                          className="text-slate-500 hover:underline font-semibold"
                        >
                          مسح
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-1">
                      {availableCategories.map(cat => {
                        const isChecked = selectedCategories.includes(cat);
                        return (
                          <label
                            key={cat}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border cursor-pointer transition-colors ${
                              isChecked
                                ? 'bg-emerald-50 text-emerald-950 border-emerald-300'
                                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={e => {
                                setSelectedCategories(prev =>
                                  e.target.checked ? [...prev, cat] : prev.filter(x => x !== cat)
                                );
                                setWholesalePage(1);
                              }}
                              className="w-3.5 h-3.5 rounded text-emerald-600 border-slate-300 focus:ring-emerald-500 cursor-pointer"
                            />
                            <span>{cat}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {/* Brand Filter (Multi-select Checkboxes) */}
                  <div className="space-y-1.5 p-3 bg-white rounded-lg border border-slate-200 flex flex-col justify-between">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                      <label className="text-xs font-bold text-slate-800">
                        تصفية حسب الماركة ({selectedBrands.length > 0 ? `${selectedBrands.length} محددة` : 'كافة الماركات'}):
                      </label>
                      <div className="flex items-center gap-2 text-[11px]">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedBrands(availableBrands);
                            setWholesalePage(1);
                          }}
                          className="text-emerald-700 hover:underline font-semibold"
                        >
                          تحديد الكل
                        </button>
                        <span className="text-slate-300">|</span>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedBrands([]);
                            setWholesalePage(1);
                          }}
                          className="text-slate-500 hover:underline font-semibold"
                        >
                          مسح
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-1">
                      {availableBrands.map(b => {
                        const isChecked = selectedBrands.includes(b);
                        return (
                          <label
                            key={b}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border cursor-pointer transition-colors ${
                              isChecked
                                ? 'bg-emerald-50 text-emerald-950 border-emerald-300'
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
                                setWholesalePage(1);
                              }}
                              className="w-3.5 h-3.5 rounded text-emerald-600 border-slate-300 focus:ring-emerald-500 cursor-pointer"
                            />
                            <span>{b}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {/* Model Filter (Multi-select Checkboxes with Dynamic Brand Filtering) */}
                  <div className="space-y-1.5 p-3 bg-white rounded-lg border border-slate-200 flex flex-col justify-between">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                      <label className="text-xs font-bold text-slate-800">
                        تصفية حسب الموديل ({selectedModelIds.length > 0 ? `${selectedModelIds.length} محدد` : 'كافة الموديلات'}):
                      </label>
                      <div className="flex items-center gap-2 text-[11px]">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedModelIds(availableModels.map(m => m.id));
                            setWholesalePage(1);
                          }}
                          className="text-emerald-700 hover:underline font-semibold"
                        >
                          تحديد الكل
                        </button>
                        <span className="text-slate-300">|</span>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedModelIds([]);
                            setWholesalePage(1);
                          }}
                          className="text-slate-500 hover:underline font-semibold"
                        >
                          مسح
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 max-h-28 overflow-y-auto p-1 divide-y divide-slate-50">
                      {availableModels.length === 0 ? (
                        <div className="text-slate-400 text-xs py-2 text-center">لا توجد موديلات متاحة</div>
                      ) : (
                        availableModels.map(m => {
                          const isChecked = selectedModelIds.includes(m.id);
                          return (
                            <label
                              key={m.id}
                              className={`inline-flex items-center gap-2 px-2 py-1 rounded text-xs font-medium cursor-pointer transition-colors ${
                                isChecked
                                  ? 'bg-emerald-50 text-emerald-950 font-bold'
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
                                  setWholesalePage(1);
                                }}
                                className="w-3.5 h-3.5 rounded text-emerald-600 border-slate-300 focus:ring-emerald-500 cursor-pointer"
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

                  {/* Price Range Filter */}
                  <div className="space-y-1.5 p-3 bg-white rounded-lg border border-slate-200 flex flex-col justify-between">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                      <label className="text-xs font-bold text-slate-800">نطاق السعر (Price Range):</label>
                      {(wholesaleMinPrice || wholesaleMaxPrice) && (
                        <button
                          type="button"
                          onClick={() => {
                            setWholesaleMinPrice('');
                            setWholesaleMaxPrice('');
                            setWholesalePage(1);
                          }}
                          className="text-rose-600 text-[11px] hover:underline font-semibold"
                        >
                          مسح السعر
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <div>
                        <span className="text-[10px] text-slate-500 block mb-0.5">من سعر (ج.م):</span>
                        <input
                          type="number"
                          min="0"
                          step="500"
                          placeholder="الحد الأدنى"
                          value={wholesaleMinPrice}
                          onChange={e => {
                            setWholesaleMinPrice(e.target.value);
                            setWholesalePage(1);
                          }}
                          className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-emerald-500 tabular-nums"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block mb-0.5">إلى سعر (ج.م):</span>
                        <input
                          type="number"
                          min="0"
                          step="500"
                          placeholder="الحد الأقصى"
                          value={wholesaleMaxPrice}
                          onChange={e => {
                            setWholesaleMaxPrice(e.target.value);
                            setWholesalePage(1);
                          }}
                          className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-emerald-500 tabular-nums"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Live Device Counter & Summary Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <div className="relative w-full sm:w-80">
                  <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                  <input
                    type="text"
                    value={wholesaleSearch}
                    onChange={e => {
                      setWholesaleSearch(e.target.value);
                      setWholesalePage(1);
                    }}
                    placeholder="بحث في المعاينة (ماركة، موديل، معالج، رام...)"
                    className="w-full text-xs pr-9 pl-3 py-2 rounded-lg border border-slate-300 bg-white placeholder-slate-400 focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  {/* Live Device Counter */}
                  <div className="flex items-center gap-1.5 text-xs bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
                    <span className="font-semibold text-slate-700">تم تحديد</span>
                    <span className="font-bold font-mono text-emerald-700 tabular-nums">
                      {selectedCount}
                    </span>
                    <span className="font-semibold text-slate-700">من أصل</span>
                    <span className="font-bold font-mono text-slate-900 tabular-nums">
                      {filteredWholesaleRows.length}
                    </span>
                    <span className="font-semibold text-slate-700">جهاز مطابق</span>
                    {allDevices.length > 0 && (
                      <span className="text-[11px] text-slate-500 font-mono">
                        (إجمالي المخزون: {allDevices.length})
                      </span>
                    )}
                  </div>

                  {filteredWholesaleRows.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const next = new Set<string>();
                          filteredWholesaleRows.forEach((r, idx) => {
                            const key = getRowKey(r, idx);
                            if (key) next.add(key);
                          });
                          setSelectedRowKeys(next);
                        }}
                        className="text-xs font-semibold border-slate-300 text-slate-700"
                      >
                        تحديد كافة المطابقة
                      </Button>
                      {selectedCount > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedRowKeys(new Set())}
                          className="text-xs text-rose-600 hover:bg-rose-50 font-semibold"
                        >
                          إلغاء التحديد
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Warning Alert When 0 Matching Devices Exist */}
              {filteredWholesaleRows.length === 0 && (
                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-center gap-2.5">
                  <ShieldAlert className="w-4.5 h-4.5 text-amber-600 shrink-0" />
                  <span className="font-semibold">
                    لا توجد أجهزة مطابقة لمعايير الفلترة المحددة حالياً. يرجى تعديل خيارات الفلترة أو إعادة ضبطها لإظهار وتصدير الأجهزة.
                  </span>
                </div>
              )}

              {/* Preview Table */}
              <div className="border border-slate-300 rounded-xl overflow-hidden bg-white">
                <div className="overflow-x-auto max-h-[60vh]">
                  <table className="w-full text-xs text-right border-collapse">
                    <thead className="bg-slate-100 border-b border-slate-300 text-slate-800 font-bold sticky top-0 z-10 whitespace-nowrap">
                      <tr>
                        <th className="p-2.5 text-center w-10">
                          <input
                            type="checkbox"
                            checked={
                              paginatedWholesaleRows.length > 0 &&
                              paginatedWholesaleRows.every((r, idx) =>
                                selectedRowKeys.has(getRowKey(r, (wholesalePage - 1) * wholesalePageSize + idx))
                              )
                            }
                            onChange={e => {
                              const next = new Set(selectedRowKeys);
                              paginatedWholesaleRows.forEach((r, idx) => {
                                const key = getRowKey(r, (wholesalePage - 1) * wholesalePageSize + idx);
                                if (key) {
                                  if (e.target.checked) next.add(key);
                                  else next.delete(key);
                                }
                              });
                              setSelectedRowKeys(next);
                            }}
                            className="w-4 h-4 rounded text-emerald-600 border-slate-300 cursor-pointer"
                            title="تحديد الكل في هذه الصفحة"
                          />
                        </th>
                        <th className="p-2.5 text-center w-10">#</th>
                        {wholesaleOptions.includeSerialNumbers && (
                          <th className="p-2.5 text-center bg-purple-50/70 border-x border-purple-200">
                            السيريال نمبر
                          </th>
                        )}
                        <th className="p-2.5">الموديل</th>
                        {wholesaleOptions.includeCategory !== false && (
                          <th className="p-2.5 text-center">الفئة</th>
                        )}
                        <th className="p-2.5">المعالج</th>
                        <th className="p-2.5">الرام</th>
                        <th className="p-2.5">الهارد</th>
                        <th className="p-2.5">كارت الشاشة</th>
                        {wholesaleOptions.includeScreen !== false && (
                          <th className="p-2.5 text-center">الشاشة</th>
                        )}
                        {wholesaleOptions.includeStatus !== false && (
                          <th className="p-2.5 text-center">الحالة</th>
                        )}
                        {wholesaleOptions.includeBranch !== false && (
                          <th className="p-2.5 text-center">الفرع / المخزن</th>
                        )}
                        {!wholesaleOptions.includeSerialNumbers && wholesaleOptions.includeQuantity && (
                          <th className="p-2.5 text-center bg-blue-50/70 font-bold text-blue-900 border-x border-blue-200">
                            الكمية
                          </th>
                        )}
                        {wholesaleOptions.includePrices && (
                          <th className="p-2.5 text-left bg-emerald-50/70 font-bold text-emerald-900 border-r border-emerald-200">
                            السعر
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {paginatedWholesaleRows.length === 0 ? (
                        <tr>
                          <td colSpan={15} className="py-10 text-center text-slate-500">
                            لا توجد سجلات تطابق معايير البحث والفرز الحالية
                          </td>
                        </tr>
                      ) : (
                        paginatedWholesaleRows.map((row, idx) => {
                          const globalIdx = (wholesalePage - 1) * wholesalePageSize + idx + 1;
                          const rowKey = getRowKey(row, globalIdx - 1);
                          const isRowChecked = selectedRowKeys.has(rowKey);
                          return (
                            <tr
                              key={rowKey}
                              onClick={() => {
                                const next = new Set(selectedRowKeys);
                                if (isRowChecked) next.delete(rowKey);
                                else next.add(rowKey);
                                setSelectedRowKeys(next);
                              }}
                              className={`hover:bg-slate-50/80 transition-colors cursor-pointer ${
                                isRowChecked ? 'bg-emerald-50/40' : ''
                              }`}
                            >
                              <td className="p-2.5 text-center" onClick={e => e.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  checked={isRowChecked}
                                  onChange={e => {
                                    const next = new Set(selectedRowKeys);
                                    if (e.target.checked) next.add(rowKey);
                                    else next.delete(rowKey);
                                    setSelectedRowKeys(next);
                                  }}
                                  className="w-4 h-4 rounded text-emerald-600 border-slate-300 cursor-pointer"
                                />
                              </td>
                              <td className="p-2.5 text-center font-mono text-slate-500 text-[11px]">
                                {globalIdx}
                              </td>
                              {wholesaleOptions.includeSerialNumbers && (
                                <td className="p-2.5 text-center font-mono font-bold text-purple-900 bg-purple-50/20 border-x border-purple-100 whitespace-nowrap">
                                  {row['السيريال نمبر'] || row['السيريال (Serial Number)'] || row['الرقم المسلسل (Serial Number)'] || row.serial_number || '---'}
                                </td>
                              )}
                              <td className="p-2.5 font-bold text-slate-900 whitespace-nowrap">
                                {row['الموديل'] || row['الماركة والموديل (Brand & Model)'] || (row['الماركة'] ? `${row['الماركة']} ${row['الموديل']}` : row['الموديل']) || row.model_name || '---'}
                              </td>
                              {wholesaleOptions.includeCategory !== false && (
                                <td className="p-2.5 text-center font-medium text-slate-700 whitespace-nowrap">
                                  {row['الفئة'] || row.category || '---'}
                                </td>
                              )}
                              <td className="p-2.5 font-mono text-slate-700 whitespace-nowrap">
                                {row['المعالج'] || row['المعالج (Processor)'] || row.processor || '---'}
                              </td>
                              <td className="p-2.5 font-mono text-slate-700 whitespace-nowrap">
                                {row['الرام'] || row['الرام (RAM)'] || row['الذاكرة العشوائية (RAM)'] || row.ram || '---'}
                              </td>
                              <td className="p-2.5 font-mono text-slate-700 whitespace-nowrap">
                                {row['الهارد'] || row['سعة التخزين (Storage)'] || row.storage || '---'}
                              </td>
                              <td className="p-2.5 font-mono text-slate-700 whitespace-nowrap">
                                {row['كارت الشاشة'] || row['كارت الشاشة (GPU)'] || row.gpu || '---'}
                              </td>
                              {wholesaleOptions.includeScreen !== false && (
                                <td className="p-2.5 text-center font-mono text-slate-700 whitespace-nowrap">
                                  {row['الشاشة'] || row['الشاشة (Screen)'] || row['حجم الشاشة'] || row.screen || '---'}
                                </td>
                              )}
                              {wholesaleOptions.includeStatus !== false && (
                                <td className="p-2.5 text-center whitespace-nowrap">
                                  <Badge variant="default" size="sm">
                                    {row['الحالة'] || row['الحالة (Condition)'] || row.physical_condition || '---'}
                                  </Badge>
                                </td>
                              )}
                              {wholesaleOptions.includeBranch !== false && (
                                <td className="p-2.5 text-center whitespace-nowrap">
                                  <Badge variant="primary" size="sm">
                                    {row['الفرع / المخزن'] || row['المخزن / الفرع (Location)'] || row.stock_location || '---'}
                                  </Badge>
                                </td>
                              )}
                              {!wholesaleOptions.includeSerialNumbers && wholesaleOptions.includeQuantity && (
                                <td className="p-2.5 text-center font-mono font-bold text-blue-900 bg-blue-50/20 border-x border-blue-100 whitespace-nowrap">
                                  {row['الكمية'] ?? row['الكمية المتاحة'] ?? row['الكمية المتاحة (Quantity)'] ?? row.quantity ?? '---'}
                                </td>
                              )}
                              {wholesaleOptions.includePrices && (
                                <td className="p-2.5 text-left font-mono font-bold text-emerald-800 bg-emerald-50/20 border-r border-emerald-100 whitespace-nowrap">
                                  {row['السعر'] !== undefined
                                    ? formatCurrency(row['السعر'])
                                    : row['السعر (EGP)'] !== undefined
                                    ? formatCurrency(row['السعر (EGP)'])
                                    : row['السعر (Price EGP)'] !== undefined
                                    ? formatCurrency(row['السعر (Price EGP)'])
                                    : '---'}
                                </td>
                              )}
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
                  <div className="font-semibold">
                    عرض الصفحة <span className="font-bold text-slate-900">{wholesalePage}</span> من{' '}
                    <span className="font-bold text-slate-900">{totalWholesalePages}</span>{' '}
                    (إجمالي {filteredWholesaleRows.length} بند)
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setWholesalePage(prev => Math.max(1, prev - 1))}
                      disabled={wholesalePage <= 1}
                      leftIcon={<ChevronRight className="w-4 h-4" />}
                    >
                      السابق
                    </Button>
                    <span className="px-2 font-mono font-bold text-slate-800">{wholesalePage}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setWholesalePage(prev => Math.min(totalWholesalePages, prev + 1))}
                      disabled={wholesalePage >= totalWholesalePages}
                      rightIcon={<ChevronLeft className="w-4 h-4" />}
                    >
                      التالي
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* =====================================================================
          TAB: PROMOTIONAL DEVICE IMAGE GENERATOR (عروض السوشيال ميديا)
          ===================================================================== */}
      {activeTab === 'promotional-image' && (
        <MSSPromotionalGenerator devices={allDevices} models={allModels} />
      )}

      {/* =====================================================================
          TAB 2: MODEL QUANTITY SUMMARY (ملخص كميات الموديلات)
          ===================================================================== */}
      {activeTab === 'model-summary' && (
        <div className="space-y-6">
          {/* Top KPI Metrics Banner */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3.5 p-4 bg-white rounded-xl border border-slate-300 shadow-2xs text-xs">
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <span className="text-slate-500 block mb-0.5">الموجود بالمخزون (Existing)</span>
              <span className="font-mono text-xl font-bold text-emerald-800">{grandExisting} وحدة</span>
              <span className="text-[10px] text-slate-500 block mt-0.5">
                ({grandSerial} مسلسل • {grandBulk} مجمع)
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <span className="text-slate-500 block mb-0.5">الوحدات المباعة (Sold)</span>
              <span className="font-mono text-xl font-bold text-slate-800">{grandSold} وحدة</span>
              <span className="text-[10px] text-slate-500 block mt-0.5">مبيعات معتمدة من الفروع</span>
            </div>

            <div className="p-3 bg-blue-50/70 rounded-lg border border-blue-200">
              <span className="text-blue-900 font-bold block mb-0.5">إجمالي الوحدات المسجلة (Total)</span>
              <span className="font-mono text-xl font-bold text-blue-900">{grandTotal} وحدة</span>
              <span className="text-[10px] text-blue-700 block mt-0.5 font-medium">
                Total = Existing + Sold
              </span>
            </div>

            <div className="p-3 bg-emerald-50/70 rounded-lg border border-emerald-200 flex flex-col justify-center">
              <span className="text-emerald-900 font-bold flex items-center gap-1.5 text-xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>صحة المعادلة المحاسبية</span>
              </span>
              <span className="text-[11px] text-emerald-800 mt-1 font-medium">
                {isStrictMatch ? '✓ المعادلة مطابقة 100% لكافة الموديلات' : 'تنبيه: يوجد فرق غير مطابق'}
              </span>
            </div>
          </div>

          {/* Model Summary Table Card */}
          <Card className="bg-white border-slate-300 shadow-2xs overflow-hidden">
            <CardHeader className="py-3 px-4 bg-slate-50/90 border-b border-slate-300 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-blue-600" />
                <CardTitle className="text-base font-bold text-slate-900">
                  ملخص كميات الموديلات في المخازن والفروع ({filteredModelSummaries.length} موديل)
                </CardTitle>
              </div>

              {/* Filters */}
              <div className="flex items-center gap-2.5 flex-wrap">
                <div className="relative w-64">
                  <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                  <input
                    type="text"
                    value={summarySearch}
                    onChange={e => {
                      setSummarySearch(e.target.value);
                      setSummaryPage(1);
                    }}
                    placeholder="بحث بالموديل أو الكود أو المعالج..."
                    className="w-full text-xs pr-9 pl-3 py-1.5 rounded-lg border border-slate-300 bg-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <select
                  value={summaryCategory}
                  onChange={e => {
                    setSummaryCategory(e.target.value);
                    setSummaryPage(1);
                  }}
                  aria-label="تصفية حسب التصنيف"
                  className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 font-medium"
                >
                  <option value="ALL">كافة التصنيفات</option>
                  <option value="Laptop">لابتوبات (Laptop)</option>
                  <option value="Monitor">شاشات (Monitor)</option>
                </select>
              </div>
            </CardHeader>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right border-collapse">
                <thead className="bg-slate-100 border-b border-slate-300 text-slate-800 font-bold sticky top-0 z-10 whitespace-nowrap">
                  <tr>
                    <th className="p-2.5 text-center w-10">#</th>
                    <th className="p-2.5">الموديل والماركة</th>
                    <th className="p-2.5">المواصفات الأساسية</th>
                    <th className="p-2.5 text-center bg-blue-50/40">محل 1 (موجود / مباع / إجمالي)</th>
                    <th className="p-2.5 text-center bg-emerald-50/40">محل 2 (موجود / مباع / إجمالي)</th>
                    <th className="p-2.5 text-center bg-emerald-50/20 font-bold text-emerald-950">
                      الموجود الكلي (Existing)
                    </th>
                    <th className="p-2.5 text-center bg-slate-100 font-bold text-slate-900">
                      المباع الكلي (Sold)
                    </th>
                    <th className="p-2.5 text-center font-bold text-blue-950 bg-blue-50/60">
                      إجمالي الوحدات (Total)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedModelSummaries.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-10 text-center text-slate-500">
                        لا توجد موديلات مطابقة لمعايير البحث الحالية
                      </td>
                    </tr>
                  ) : (
                    paginatedModelSummaries.map((item, idx) => {
                      const globalIdx = (summaryPage - 1) * summaryPageSize + idx + 1;
                      const s1 = item.warehouse_breakdown['محل 1'] || {
                        existing_units: 0,
                        sold_units: 0,
                        total_units: 0,
                      };
                      const s2 = item.warehouse_breakdown['محل 2'] || {
                        existing_units: 0,
                        sold_units: 0,
                        total_units: 0,
                      };

                      return (
                        <tr key={item.model_id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-2.5 text-center font-mono text-slate-500 text-[11px]">
                            {globalIdx}
                          </td>
                          <td className="p-2.5 whitespace-nowrap">
                            <span className="font-bold text-slate-900 block">
                              {item.brand} {item.model_name}
                            </span>
                            {item.model_code && (
                              <span className="font-mono text-[10px] text-slate-500 bg-slate-100 px-1 py-0.5 rounded border border-slate-200">
                                {item.model_code}
                              </span>
                            )}
                          </td>
                          <td className="p-2.5">
                            {item.specifications ? (
                              <span className="text-[11px] font-mono text-slate-600 block line-clamp-2">
                                {item.specifications}
                              </span>
                            ) : (
                              <span className="text-slate-400 text-xs">---</span>
                            )}
                          </td>
                          <td className="p-2.5 text-center font-mono bg-blue-50/15 whitespace-nowrap">
                            <span className="text-emerald-700 font-bold">{s1.existing_units}</span>
                            <span className="text-slate-400 mx-1">/</span>
                            <span className="text-slate-600">{s1.sold_units}</span>
                            <span className="text-slate-400 mx-1">/</span>
                            <span className="text-blue-900 font-bold">{s1.total_units}</span>
                          </td>
                          <td className="p-2.5 text-center font-mono bg-emerald-50/15 whitespace-nowrap">
                            <span className="text-emerald-700 font-bold">{s2.existing_units}</span>
                            <span className="text-slate-400 mx-1">/</span>
                            <span className="text-slate-600">{s2.sold_units}</span>
                            <span className="text-slate-400 mx-1">/</span>
                            <span className="text-emerald-900 font-bold">{s2.total_units}</span>
                          </td>
                          <td className="p-2.5 text-center font-mono font-bold text-emerald-800 bg-emerald-50/10 whitespace-nowrap">
                            {item.existing_units}
                            <span className="text-[10px] text-slate-500 font-normal block">
                              ({item.existing_serialized} مسلسَل • {item.existing_non_serialized} مجمع)
                            </span>
                          </td>
                          <td className="p-2.5 text-center font-mono font-bold text-slate-800 whitespace-nowrap">
                            {item.sold_units}
                          </td>
                          <td className="p-2.5 text-center font-mono font-bold text-blue-950 bg-blue-50/30 whitespace-nowrap">
                            <span className="text-sm">{item.total_units}</span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                {modelSummaries.length > 0 && (
                  <tfoot className="bg-slate-100 font-bold border-t-2 border-slate-300 text-slate-900 text-xs">
                    <tr>
                      <td colSpan={3} className="p-3 text-right">
                        الإجمالي الكلي لكافة الموديلات والفروع ({modelSummaries.length} موديل):
                      </td>
                      <td className="p-3 text-center font-mono text-blue-900">
                        {modelSummaries.reduce(
                          (s, it) => s + (it.warehouse_breakdown['محل 1']?.total_units || 0),
                          0
                        )}{' '}
                        وحدة
                      </td>
                      <td className="p-3 text-center font-mono text-emerald-900">
                        {modelSummaries.reduce(
                          (s, it) => s + (it.warehouse_breakdown['محل 2']?.total_units || 0),
                          0
                        )}{' '}
                        وحدة
                      </td>
                      <td className="p-3 text-center font-mono text-emerald-900 text-sm">
                        {grandExisting} وحدة
                      </td>
                      <td className="p-3 text-center font-mono text-slate-800 text-sm">
                        {grandSold} وحدة
                      </td>
                      <td className="p-3 text-center font-mono text-blue-950 text-sm">
                        {grandTotal} وحدة
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
              <div className="font-semibold">
                عرض الصفحة <span className="font-bold text-slate-900">{summaryPage}</span> من{' '}
                <span className="font-bold text-slate-900">{totalSummaryPages}</span>{' '}
                (إجمالي {filteredModelSummaries.length} موديل)
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSummaryPage(prev => Math.max(1, prev - 1))}
                  disabled={summaryPage <= 1}
                  leftIcon={<ChevronRight className="w-4 h-4" />}
                >
                  السابق
                </Button>
                <span className="px-2 font-mono font-bold text-slate-800">{summaryPage}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSummaryPage(prev => Math.min(totalSummaryPages, prev + 1))}
                  disabled={summaryPage >= totalSummaryPages}
                  rightIcon={<ChevronLeft className="w-4 h-4" />}
                >
                  التالي
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* =====================================================================
          TAB 3: SOLD DEVICES REPORT (تقرير الأجهزة المباعة حسب الموديل والفرع)
          ===================================================================== */}
      {activeTab === 'sold-report' && (
        <div className="space-y-6">
          {/* Controls Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-white rounded-xl border border-slate-300 shadow-2xs">
            <div className="flex items-center gap-3 flex-wrap">
              {/* Warehouse selector */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-600">الفرع / المخزن:</span>
                <div className="inline-flex rounded-lg border border-slate-300 bg-slate-100 p-0.5 text-xs">
                  {['ALL', 'محل 1', 'محل 2'].map(wh => (
                    <button
                      key={wh}
                      type="button"
                      onClick={() => {
                        setSoldWarehouse(wh);
                        setSoldPage(1);
                      }}
                      className={`px-3 py-1.5 rounded-md font-bold transition-all cursor-pointer ${
                        soldWarehouse === wh
                          ? 'bg-white text-slate-900 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {wh === 'ALL' ? 'كافة الفروع' : wh}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date Filter selector */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-600">الفترة:</span>
                <div className="inline-flex rounded-lg border border-slate-300 bg-slate-100 p-0.5 text-xs">
                  {[
                    { id: 'today', label: 'اليوم' },
                    { id: 'yesterday', label: 'أمس' },
                    { id: 'week', label: 'آخر 7 أيام' },
                    { id: 'month', label: 'آخر 30 يوماً' },
                    { id: 'all', label: 'كافة الفترات' },
                    { id: 'custom', label: 'مخصص' },
                  ].map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setSoldPeriod(p.id as ReportPeriod);
                        setSoldPage(1);
                      }}
                      className={`px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer ${
                        soldPeriod === p.id
                          ? 'bg-white text-slate-900 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {soldPeriod === 'custom' && (
                <DateRangeInputs
                  startDate={soldCustomStart}
                  endDate={soldCustomEnd}
                  onStartDateChange={setSoldCustomStart}
                  onEndDateChange={setSoldCustomEnd}
                />
              )}
            </div>

            {/* Print & PDF Buttons */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportSoldReportPdf}
                leftIcon={<FileDown className="w-4 h-4 text-blue-600" />}
                className="font-bold border-slate-300"
              >
                تصدير PDF
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrintSoldReport}
                leftIcon={<Printer className="w-4 h-4 text-slate-700" />}
                className="font-bold border-slate-300"
              >
                طباعة التقرير
              </Button>
            </div>
          </div>

          {/* Sold Summary Cards */}
          {soldReport && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
              <div className="p-4 bg-white border border-slate-300 rounded-xl shadow-2xs">
                <span className="text-xs font-semibold text-slate-500 block mb-1">
                  إجمالي الوحدات المباعة
                </span>
                <span className="font-mono text-xl font-bold text-slate-900 tabular-nums">
                  {soldReport.total_sold_units} جهاز
                </span>
                <span className="text-[10px] text-slate-500 block mt-0.5">
                  {soldWarehouse === 'ALL' ? 'عبر كافة الفروع' : `من ${soldWarehouse}`}
                </span>
              </div>

              <div className="p-4 bg-white border border-slate-300 rounded-xl shadow-2xs">
                <span className="text-xs font-semibold text-slate-500 block mb-1">
                  إجمالي إيرادات الموديلات
                </span>
                <span className="font-mono text-xl font-bold text-emerald-700 tabular-nums">
                  {formatCurrency(soldReport.total_revenue)}
                </span>
                <span className="text-[10px] text-slate-500 block mt-0.5">
                  صافي الفواتير المعتمدة
                </span>
              </div>

              <div className="p-4 bg-white border border-slate-300 rounded-xl shadow-2xs">
                <span className="text-xs font-semibold text-slate-500 block mb-1">
                  مبيعات محل 1
                </span>
                <span className="font-mono text-xl font-bold text-blue-800 tabular-nums">
                  {soldReport.warehouse_totals['محل 1'] || 0} جهاز
                </span>
                <span className="text-[10px] text-slate-500 block mt-0.5">الفرع الأول</span>
              </div>

              <div className="p-4 bg-white border border-slate-300 rounded-xl shadow-2xs">
                <span className="text-xs font-semibold text-slate-500 block mb-1">
                  مبيعات محل 2
                </span>
                <span className="font-mono text-xl font-bold text-purple-800 tabular-nums">
                  {soldReport.warehouse_totals['محل 2'] || 0} جهاز
                </span>
                <span className="text-[10px] text-slate-500 block mt-0.5">الفرع الثاني</span>
              </div>
            </div>
          )}

          {/* Sold Laptops Table Card */}
          <Card className="bg-white border-slate-300 shadow-2xs overflow-hidden">
            <CardHeader className="py-3 px-4 bg-slate-50/90 border-b border-slate-300 flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="text-sm font-bold text-slate-900">
                قائمة الموديلات المباعة ({soldReport?.items.length || 0} موديل) —{' '}
                {soldWarehouse === 'ALL' ? 'كافة الفروع' : soldWarehouse}
              </CardTitle>
              <span className="text-xs text-slate-500 font-medium">
                النطاق الزمني: <strong className="text-slate-800">{soldDateLabel || 'كافة الفترات'}</strong>
              </span>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right border-collapse">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 whitespace-nowrap">
                  <tr>
                    <th className="py-2.5 px-3 text-center w-10">#</th>
                    <th className="py-2.5 px-3">الموديل والماركة</th>
                    <th className="py-2.5 px-3">التصنيف</th>
                    {soldWarehouse === 'ALL' ? (
                      <>
                        <th className="py-2.5 px-3 text-center bg-blue-50/30">مبيعات محل 1</th>
                        <th className="py-2.5 px-3 text-center bg-purple-50/30">مبيعات محل 2</th>
                      </>
                    ) : (
                      <th className="py-2.5 px-3 text-center">المخزن / الفرع</th>
                    )}
                    <th className="py-2.5 px-3 text-center">إجمالي الوحدات المباعة</th>
                    <th className="py-2.5 px-3 text-left">إجمالي الإيراد</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedSoldItems.length === 0 ? (
                    <tr>
                      <td colSpan={soldWarehouse === 'ALL' ? 7 : 6} className="py-10 text-center text-slate-500">
                        لا توجد مبيعات مسجلة لأجهزة اللابتوب في هذه الفترة{' '}
                        {soldWarehouse !== 'ALL' ? `لهذا الفرع (${soldWarehouse})` : ''}
                      </td>
                    </tr>
                  ) : (
                    paginatedSoldItems.map((it, idx) => {
                      const globalIdx = (soldPage - 1) * soldPageSize + idx + 1;
                      return (
                        <tr key={it.model_id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2.5 px-3 font-mono text-slate-500 text-[11px] text-center">
                            {globalIdx}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="font-bold text-slate-900 block">
                              {it.brand} {it.model_name}
                            </span>
                            {it.model_code && (
                              <span className="font-mono text-[10px] text-slate-500 bg-slate-100 px-1 py-0.5 rounded border border-slate-200">
                                {it.model_code}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3">
                            <Badge variant="default" size="sm" className="text-[10px]">
                              {it.category}
                            </Badge>
                          </td>
                          {soldWarehouse === 'ALL' ? (
                            <>
                              <td className="py-2.5 px-3 text-center font-mono font-bold text-blue-900 bg-blue-50/10">
                                {it.warehouse_breakdown['محل 1'] || 0}
                              </td>
                              <td className="py-2.5 px-3 text-center font-mono font-bold text-purple-900 bg-purple-50/10">
                                {it.warehouse_breakdown['محل 2'] || 0}
                              </td>
                            </>
                          ) : (
                            <td className="py-2.5 px-3 text-center">
                              <Badge variant={soldWarehouse === 'محل 1' ? 'primary' : 'default'} size="sm">
                                {soldWarehouse}
                              </Badge>
                            </td>
                          )}
                          <td className="py-2.5 px-3 text-center">
                            <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2.5 py-0.5 rounded border border-slate-200 text-xs">
                              {it.total_sold_units}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-left font-mono font-bold text-emerald-800 text-xs">
                            {formatCurrency(it.total_revenue)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                {soldReport && soldReport.items.length > 0 && (
                  <tfoot className="bg-slate-100 font-bold border-t-2 border-slate-300 text-slate-900 text-xs">
                    <tr>
                      <td colSpan={3} className="py-3 px-3 text-right">
                        الإجمالي الكلي لتقرير المبيعات ({soldReport.items.length} موديل):
                      </td>
                      {soldWarehouse === 'ALL' ? (
                        <>
                          <td className="py-3 px-3 text-center font-mono text-blue-900">
                            {soldReport.warehouse_totals['محل 1'] || 0} جهاز
                          </td>
                          <td className="py-3 px-3 text-center font-mono text-purple-900">
                            {soldReport.warehouse_totals['محل 2'] || 0} جهاز
                          </td>
                        </>
                      ) : (
                        <td className="py-3 px-3 text-center font-mono">{soldWarehouse}</td>
                      )}
                      <td className="py-3 px-3 text-center font-mono text-slate-950 text-sm">
                        {soldReport.total_sold_units} جهاز
                      </td>
                      <td className="py-3 px-3 text-left font-mono text-emerald-900 text-sm">
                        {formatCurrency(soldReport.total_revenue)}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
              <div className="font-semibold">
                عرض الصفحة <span className="font-bold text-slate-900">{soldPage}</span> من{' '}
                <span className="font-bold text-slate-900">{totalSoldPages}</span>{' '}
                (إجمالي {soldItems.length} موديل مباع)
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSoldPage(prev => Math.max(1, prev - 1))}
                  disabled={soldPage <= 1}
                  leftIcon={<ChevronRight className="w-4 h-4" />}
                >
                  السابق
                </Button>
                <span className="px-2 font-mono font-bold text-slate-800">{soldPage}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSoldPage(prev => Math.min(totalSoldPages, prev + 1))}
                  disabled={soldPage >= totalSoldPages}
                  rightIcon={<ChevronLeft className="w-4 h-4" />}
                >
                  التالي
                </Button>
              </div>
            </div>
          </Card>

          {/* Hidden Sold Laptops Report Template for Print & PDF */}
          <div className="hidden" aria-hidden="true">
            <div
              id="mss-device-sold-report-print"
              className="p-8 bg-white text-slate-900 space-y-6 max-w-[210mm] mx-auto"
              dir="rtl"
            >
              {/* Report Header */}
              <div className="border-b-2 border-slate-900 pb-5 flex justify-between items-start">
                <div>
                  <h1 className="text-2xl font-bold text-slate-950 tracking-tight">Compu MSS</h1>
                  <p className="text-base font-semibold text-slate-800 mt-1">
                    تقرير مبيعات الأجهزة حسب الموديل والمخزن
                  </p>
                  <p className="text-xs text-slate-600 mt-1">
                    الفرع المستهدف:{' '}
                    <span className="font-bold text-slate-900">
                      {soldWarehouse === 'ALL' ? 'كافة الفروع والمخازن' : soldWarehouse}
                    </span>
                    <span className="mx-2">•</span>
                    فترة التقرير:{' '}
                    <span className="font-bold text-slate-900">{soldDateLabel || 'كافة الفترات'}</span>
                  </p>
                </div>
                <div className="text-left text-xs text-slate-500 font-mono space-y-1">
                  <div>تاريخ الطباعة: {formatDate(new Date().toISOString())}</div>
                  <div>Compu MSS Reports System</div>
                </div>
              </div>

              {/* Summary KPIs */}
              {soldReport && (
                <div className="grid grid-cols-4 gap-4 p-4 bg-slate-50 border border-slate-300 rounded-xl">
                  <div>
                    <span className="text-xs text-slate-500 block">إجمالي الوحدات المباعة:</span>
                    <span className="text-lg font-bold font-mono text-slate-900">
                      {soldReport.total_sold_units} جهاز
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 block">إجمالي الإيرادات:</span>
                    <span className="text-lg font-bold font-mono text-emerald-800">
                      {formatCurrency(soldReport.total_revenue)}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 block">مبيعات محل 1:</span>
                    <span className="text-lg font-bold font-mono text-blue-900">
                      {soldReport.warehouse_totals['محل 1'] || 0} جهاز
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 block">مبيعات محل 2:</span>
                    <span className="text-lg font-bold font-mono text-purple-900">
                      {soldReport.warehouse_totals['محل 2'] || 0} جهاز
                    </span>
                  </div>
                </div>
              )}

              {/* Table */}
              <table className="w-full text-xs text-right border-collapse border border-slate-300">
                <thead className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
                  <tr>
                    <th className="p-2 border-l border-slate-300 text-center w-8">#</th>
                    <th className="p-2 border-l border-slate-300">الموديل والماركة</th>
                    <th className="p-2 border-l border-slate-300">التصنيف</th>
                    <th className="p-2 border-l border-slate-300 text-center">محل 1</th>
                    <th className="p-2 border-l border-slate-300 text-center">محل 2</th>
                    <th className="p-2 border-l border-slate-300 text-center">إجمالي المباع</th>
                    <th className="p-2 text-left">إجمالي الإيراد</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {soldReport?.items.map((it, idx) => (
                    <tr key={it.model_id}>
                      <td className="p-2 border-l border-slate-300 text-center font-mono">{idx + 1}</td>
                      <td className="p-2 border-l border-slate-300 font-bold text-slate-900">
                        {it.brand} {it.model_name}
                      </td>
                      <td className="p-2 border-l border-slate-300">{it.category}</td>
                      <td className="p-2 border-l border-slate-300 text-center font-mono">
                        {it.warehouse_breakdown['محل 1'] || 0}
                      </td>
                      <td className="p-2 border-l border-slate-300 text-center font-mono">
                        {it.warehouse_breakdown['محل 2'] || 0}
                      </td>
                      <td className="p-2 border-l border-slate-300 text-center font-mono font-bold">
                        {it.total_sold_units}
                      </td>
                      <td className="p-2 text-left font-mono font-bold text-emerald-800">
                        {formatCurrency(it.total_revenue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Footer */}
              <div className="pt-4 border-t border-slate-200 flex justify-between items-center text-[10px] text-slate-500 font-mono">
                <span>نظام Compu MSS — تقرير الأجهزة المباعة المعتمد</span>
                <span>© 2026 Ahmed Saber. All rights reserved. • Contact: 01030137635</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
