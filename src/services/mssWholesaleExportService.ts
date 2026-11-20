import * as XLSXStyle from 'xlsx-js-style';
import type { WorkBook, WorkSheet } from 'xlsx-js-style';
const XLSX: any = (XLSXStyle as any).default || XLSXStyle;
import { mssInventoryService } from './mssInventoryService.ts';
import { mssCatalogService } from './mssCatalogService.ts';
import type { WholesaleExportOptions, WholesaleExportRow } from '@/types/mssReports';
import type { MSSStockLocation, MSSDevice } from '@/types/mssInventory';

/**
 * Sanitizes a string for safe use as a Windows filename.
 */
export function sanitizeArabicFilename(name: string): string {
  if (!name) return 'ملف';
  return name
    .replace(/[/\\?%*:|"<>]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/__+/g, '_')
    .trim();
}

/**
 * Formats an Arabic export filename with today's export generation date (YYYY-MM-DD),
 * ensuring Windows-safe characters and avoiding duplicate dates.
 *
 * Example: formatArabicExportFilename('تقرير_مخزون_الأجهزة_المتاحة', 'xlsx')
 *          -> 'تقرير_مخزون_الأجهزة_المتاحة_2026-11-19.xlsx'
 */
export function formatArabicExportFilename(baseName: string, ext: string = 'xlsx'): string {
  const today = new Date().toISOString().split('T')[0]; // Format: YYYY-MM-DD
  const cleanExt = ext.replace(/^\./, '');

  // Strip existing extension if present
  let cleanBase = baseName.replace(new RegExp(`\\.${cleanExt}$`, 'i'), '');

  // Check if cleanBase already ends with a YYYY-MM-DD date
  const dateRegex = /_\d{4}-\d{2}-\d{2}$/;
  if (dateRegex.test(cleanBase)) {
    // If it already ends with a date, update to today's date (never duplicate date)
    cleanBase = cleanBase.replace(dateRegex, `_${today}`);
  } else {
    cleanBase = `${cleanBase}_${today}`;
  }

  return `${sanitizeArabicFilename(cleanBase)}.${cleanExt}`;
}

/**
 * Clean specification value for Excel cell.
 * If null, undefined, empty, or placeholder, returns '---'.
 */
export function cleanSpec(val: any): string {
  if (val === null || val === undefined) return '---';
  const str = String(val).trim();
  if (str === '' || str === 'null' || str === 'undefined' || str === '-') {
    return '---';
  }
  return str;
}

/**
 * Extracts Screen Size, Resolution, and Type into separate dedicated values.
 */
export function extractScreenDetails(screenSizeRaw?: string | null, specsRaw?: string | null): {
  size: string;
  resolution: string;
  type: string;
} {
  const combined = `${screenSizeRaw || ''} ${specsRaw || ''}`.trim();
  if (!combined) {
    return { size: '---', resolution: '---', type: '---' };
  }

  // 1. Screen size: e.g. 14", 15.6", 13.3", 16 Inch, etc.
  let size = '---';
  const sizeMatch = combined.match(/(\d{1,2}(?:\.\d)?)\s*(?:["”']|inch|بوصة)/i);
  if (sizeMatch) {
    size = `${sizeMatch[1]}"`;
  } else if (screenSizeRaw && screenSizeRaw.trim()) {
    const firstWord = screenSizeRaw.trim().split(/\s+/)[0];
    size = cleanSpec(firstWord || screenSizeRaw.trim());
  }

  // 2. Resolution: e.g. 4K, 2K, QHD, FHD, HD+, HD, Retina
  let resolution = '---';
  if (/4K|3840\s*[x×]\s*2160/i.test(combined)) {
    resolution = '4K UHD (3840×2160)';
  } else if (/2K|QHD|WQXGA|2560\s*[x×]\s*1440|2560\s*[x×]\s*1600/i.test(combined)) {
    resolution = '2K QHD (2560×1440)';
  } else if (/FHD|1080p|1920\s*[x×]\s*1080|1920\s*[x×]\s*1200/i.test(combined)) {
    resolution = 'FHD (1920×1080)';
  } else if (/HD\+|1600\s*[x×]\s*900/i.test(combined)) {
    resolution = 'HD+ (1600×900)';
  } else if (/HD|1366\s*[x×]\s*768/i.test(combined)) {
    resolution = 'HD (1366×768)';
  } else if (/Retina/i.test(combined)) {
    resolution = 'Retina Display';
  }

  // 3. Screen Type: e.g. IPS, OLED, AMOLED, Touch, Anti-Glare
  let type = '---';
  const typeParts: string[] = [];
  if (/OLED/i.test(combined)) typeParts.push('OLED');
  else if (/AMOLED/i.test(combined)) typeParts.push('AMOLED');
  else if (/IPS/i.test(combined)) typeParts.push('IPS');
  else if (/VA/i.test(combined)) typeParts.push('VA');
  else if (/TN/i.test(combined)) typeParts.push('TN');

  if (/Touch|لمس/i.test(combined)) typeParts.push('Touch');
  if (/Anti-Glare|Matte|غير لامع/i.test(combined)) typeParts.push('Anti-Glare');
  if (/Liquid Retina/i.test(combined)) typeParts.push('Liquid Retina');

  if (typeParts.length > 0) {
    type = typeParts.join(' / ');
  }

  return { size, resolution, type };
}

/**
 * Merges Brand and Model into one formatted string.
 * - If model already starts with brand, avoid duplicate brand (e.g. "Apple" + "Apple MacBook Air" -> "Apple MacBook Air").
 * - If one is missing, display available one.
 * - If both are missing, display '---'.
 */
export function formatBrandAndModel(brandRaw?: string | null, modelRaw?: string | null): string {
  const brand = brandRaw ? String(brandRaw).trim() : '';
  const model = modelRaw ? String(modelRaw).trim() : '';
  const isBrandValid = brand !== '' && brand !== '---' && brand !== 'null' && brand !== 'undefined' && brand !== '-';
  const isModelValid = model !== '' && model !== '---' && model !== 'null' && model !== 'undefined' && model !== '-';

  if (!isBrandValid && !isModelValid) return '---';
  if (isBrandValid && !isModelValid) return brand;
  if (!isBrandValid && isModelValid) return model;

  // Check if model already starts with brand (case-insensitive)
  if (model.toLowerCase().startsWith(brand.toLowerCase())) {
    return model;
  }
  return `${brand} ${model}`;
}

/**
 * Combines Screen Type, Screen Size, and Screen Resolution into a single cell string.
 * Order: 1. Screen Type, 2. Screen Size, 3. Screen Resolution.
 * Separator: ' - '
 * Example: 'IPS - 15.6" - FHD (1920×1080)'
 * Omits missing parts cleanly. If all missing, returns '---'.
 */
export function formatScreenSummary(screenSizeRaw?: string | null, specsRaw?: string | null): string {
  const details = extractScreenDetails(screenSizeRaw, specsRaw);
  const parts: string[] = [];

  // 1. Screen Type
  if (details.type && details.type !== '---') {
    parts.push(details.type);
  }
  // 2. Screen Size
  if (details.size && details.size !== '---') {
    parts.push(details.size);
  }
  // 3. Screen Resolution
  if (details.resolution && details.resolution !== '---') {
    parts.push(details.resolution);
  }

  if (parts.length === 0) return '---';
  return parts.join(' - ');
}

/**
 * Applies enhanced professional visual formatting to an Excel worksheet:
 * 1. Dark Blue / Navy header row (#0C3582) with bold white high-contrast text and medium bottom border.
 * 2. Alternating row colors (zebra striping: #FFFFFF and #F1F5F9).
 * 3. Thin clean borders (#CBD5E1) around all data cells.
 * 4. Center-aligned short specs (RAM, CPU, GPU, Screen, Serial, Status, Branch, Quantity, Price).
 * 5. Right-aligned Brand & Model descriptions for optimal Arabic RTL reading.
 * 6. Explicit numeric formatting for Price (#,##0 "EGP") and Quantity (#,##0).
 * 7. Generous row heights (header: 26pt, data: 22pt) and text wrapping on all cells to avoid clipping.
 * 8. Dynamic column widths calculated with comfortable padding.
 * 9. Starts directly at Row 1 (header row) with NO extra merged title banner rows.
 */
export function applyStyledExcelFormatting(
  ws: WorkSheet | any,
  columns: { header: string; key: string; width?: number }[],
  rows: any[]
): void {
  const rowCount = rows.length;
  const colCount = columns.length;

  // Row heights: header row = 26pt, data rows = 22pt
  ws['!rows'] = [{ hpt: 26 }, ...rows.map(() => ({ hpt: 22 }))];

  // Dynamic column widths calculation with padding
  ws['!cols'] = columns.map(col => {
    let maxLen = (col.header || '').length;
    for (let r = 0; r < rowCount; r++) {
      const val = rows[r]?.[col.header];
      if (val !== undefined && val !== null) {
        const len = String(val).length;
        if (len > maxLen) maxLen = len;
      }
    }

    let minWidth = 16;
    if (col.key === 'brand_and_model') minWidth = 32;
    else if (col.key === 'screen') minWidth = 30;
    else if (col.key === 'processor') minWidth = 26;
    else if (col.key === 'serial_number') minWidth = 26;
    else if (col.key === 'storage') minWidth = 20;
    else if (col.key === 'gpu') minWidth = 22;
    else if (col.key === 'price') minWidth = 18;
    else if (col.key === 'quantity') minWidth = 16;
    else if (col.key === 'stock_location') minWidth = 18;
    else if (col.key === 'physical_condition') minWidth = 16;
    else if (col.key === 'category') minWidth = 14;
    else if (col.key === 'ram') minWidth = 14;

    const wch = Math.min(50, Math.max(minWidth, Math.ceil(maxLen * 1.1) + 3));
    return { wch };
  });

  // Ensure LTR view: First column starts on the left side of the sheet (A1)
  ws['!views'] = [{ rightToLeft: false }];

  // Border styles
  const thinDataBorder = {
    top: { style: 'thin', color: { rgb: 'CBD5E1' } },
    bottom: { style: 'thin', color: { rgb: 'CBD5E1' } },
    left: { style: 'thin', color: { rgb: 'CBD5E1' } },
    right: { style: 'thin', color: { rgb: 'CBD5E1' } },
  };

  const headerBorder = {
    top: { style: 'thin', color: { rgb: '07205B' } },
    bottom: { style: 'medium', color: { rgb: '07205B' } },
    left: { style: 'thin', color: { rgb: '1E3A8A' } },
    right: { style: 'thin', color: { rgb: '1E3A8A' } },
  };

  // 1. Format Header Row (Row 0 in 0-indexed)
  for (let c = 0; c < colCount; c++) {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c });
    if (!ws[cellRef]) {
      ws[cellRef] = { t: 's', v: columns[c].header };
    }
    ws[cellRef].s = {
      fill: { fgColor: { rgb: '0C3582' } },
      font: { name: 'Segoe UI', sz: 11, bold: true, color: { rgb: 'FFFFFF' } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: headerBorder,
    };
  }

  // 2. Format Data Rows (Row 1 to rowCount)
  for (let r = 1; r <= rowCount; r++) {
    const isEvenRow = (r - 1) % 2 === 0;
    const bgRgb = isEvenRow ? 'FFFFFF' : 'F1F5F9';
    const rowData = rows[r - 1];

    for (let c = 0; c < colCount; c++) {
      const col = columns[c];
      const cellRef = XLSX.utils.encode_cell({ r, c });

      if (!ws[cellRef]) {
        const rawVal = rowData?.[col.header];
        ws[cellRef] = {
          t: typeof rawVal === 'number' ? 'n' : 's',
          v: rawVal !== undefined && rawVal !== null ? rawVal : '---',
        };
      }

      const cell = ws[cellRef];
      if (cell.v === undefined || cell.v === null || cell.v === '' || cell.t === 'z') {
        cell.t = 's';
        cell.v = '---';
      }

      // Check column type for alignment and number formatting
      const isBrandModel = col.key === 'brand_and_model' || col.header.includes('الماركة والموديل');
      const isPrice = col.key === 'price' || col.header.includes('السعر');
      const isQuantity = col.key === 'quantity' || col.header.includes('الكمية');

      const horizontalAlign: 'left' | 'center' = isBrandModel ? 'left' : 'center';

      const cellStyle: any = {
        fill: { fgColor: { rgb: bgRgb } },
        font: { name: 'Segoe UI', sz: 10, color: { rgb: '0F172A' } },
        alignment: { horizontal: horizontalAlign, vertical: 'center', wrapText: true },
        border: thinDataBorder,
      };

      if (isPrice && typeof cell.v === 'number') {
        cell.t = 'n';
        cellStyle.numFmt = '#,##0 "EGP"';
      } else if (isQuantity && typeof cell.v === 'number') {
        cell.t = 'n';
        cellStyle.numFmt = '#,##0';
      }

      cell.s = cellStyle;
    }
  }
}

/**
 * Evaluates whether an item's category matches the user's selected category filters.
 * Supports exact dynamic matching as well as common Arabic/English aliases (e.g., Laptops / Monitors).
 */
export function matchesCategory(itemCatRaw?: string | null, selectedCategories?: string[]): boolean {
  if (!selectedCategories || selectedCategories.length === 0) return false;

  const itemCat = (itemCatRaw || '').trim().toLowerCase();

  return selectedCategories.some(sel => {
    const s = (sel || '').trim().toLowerCase();
    if (!s) return false;
    if (s === itemCat) return true;

    // Laptop aliases
    const isItemLaptop = itemCat === 'لابتوب' || itemCat === 'لاب توب' || itemCat === 'laptop' || itemCat === 'laptops';
    const isSelLaptop = s === 'لابتوب' || s === 'لاب توب' || s === 'laptop' || s === 'laptops';
    if (isItemLaptop && isSelLaptop) return true;

    // Monitor / Screen aliases
    const isItemMonitor = itemCat === 'شاشة' || itemCat === 'شاشات' || itemCat === 'monitor' || itemCat === 'monitors' || itemCat === 'screen' || itemCat === 'screens';
    const isSelMonitor = s === 'شاشة' || s === 'شاشات' || s === 'monitor' || s === 'monitors' || s === 'screen' || s === 'screens';
    if (isItemMonitor && isSelMonitor) return true;

    return false;
  });
}

export const mssWholesaleExportService = {
  cleanSpec,
  extractScreenDetails,
  formatBrandAndModel,
  formatScreenSummary,
  matchesCategory,
  sanitizeArabicFilename,
  applyStyledExcelFormatting,

  /**
   * Prepares rows and columns for Wholesale Inventory Excel Export.
   * Supports advanced filtering: selected brands, models, price range, and individual devices.
   */
  async buildWholesaleData(options: WholesaleExportOptions, customDevices?: MSSDevice[]): Promise<{
    rows: any[];
    columns: { header: string; key: string; width: number }[];
    totalUnits: number;
    totalModels: number;
  }> {
    const { includePrices, includeQuantity, includeSerialNumbers } = options;
    const includeBranch = options.includeBranch !== false;
    const includeStatus = options.includeStatus !== false;
    const includeCategory = options.includeCategory !== false;
    const includeScreen = options.includeScreen !== false;
    const branch = options.branchFilter || options.branch || 'ALL';

    // Fetch ONLY available devices (strictly exclude SOLD, RESERVED, MAINTENANCE)
    const rawDevices = customDevices && customDevices.length > 0
      ? customDevices
      : await mssInventoryService.getDevices({
          status: 'AVAILABLE',
          location: branch === 'ALL' ? undefined : (branch as MSSStockLocation),
        });

    let models: any[] = [];
    try {
      models = await mssCatalogService.getModels();
    } catch {
      models = [];
    }
    const modelMap = new Map(models.map(m => [m.id, m]));

    // Apply Advanced Filtering (Category, Brand, Model, Price Range, Selected Devices)
    let allDevices = rawDevices;

    // Filter by Branch / Store Location (strictly apply whether customDevices was passed or fetched)
    if (branch && branch !== 'ALL') {
      allDevices = allDevices.filter(d => (d.stock_location || '').trim() === branch.trim());
    }

    // 0. Filter by Categories (Dynamic Multi-Select)
    if (options.selectedCategories !== undefined) {
      if (options.selectedCategories.length === 0) {
        // Explicitly cleared all categories -> 0 devices match
        allDevices = [];
      } else {
        allDevices = allDevices.filter(d => {
          const m = d.model || modelMap.get(d.model_id);
          const cat = (d.category || m?.category || 'لابتوب').trim();
          return matchesCategory(cat, options.selectedCategories);
        });
      }
    }

    // 1. Filter by Brands (case-insensitive & trimmed, OR logic across selected brands)
    if (options.selectedBrands && options.selectedBrands.length > 0) {
      const targetBrands = options.selectedBrands
        .map(b => (b || '').trim().toLowerCase())
        .filter(Boolean);
      if (targetBrands.length > 0) {
        allDevices = allDevices.filter(d => {
          const m = d.model || modelMap.get(d.model_id);
          const b = (d.brand || m?.brand || '').trim().toLowerCase();
          return targetBrands.includes(b);
        });
      }
    }

    // 2. Filter by Models (case-insensitive ID or model_name, OR logic across selected models)
    if (options.selectedModelIds && options.selectedModelIds.length > 0) {
      const targetModelIds = new Set(
        options.selectedModelIds.map(id => (id || '').trim().toLowerCase()).filter(Boolean)
      );
      if (targetModelIds.size > 0) {
        allDevices = allDevices.filter(d => {
          const m = d.model || modelMap.get(d.model_id);
          const devModelId = (d.model_id || '').trim().toLowerCase();
          const mId = (m?.id || '').trim().toLowerCase();
          const devModelName = (d.model_name || m?.model_name || '').trim().toLowerCase();
          return targetModelIds.has(devModelId) || targetModelIds.has(mId) || targetModelIds.has(devModelName);
        });
      }
    }

    // 3. Filter by Price Range: Min Price
    if (options.minPrice !== undefined && options.minPrice !== null && !isNaN(options.minPrice) && options.minPrice > 0) {
      allDevices = allDevices.filter(d => {
        const m = d.model || modelMap.get(d.model_id);
        const p = Number(d.list_price) || Number(m?.default_list_price) || 0;
        return p >= options.minPrice!;
      });
    }

    // 4. Filter by Price Range: Max Price
    if (options.maxPrice !== undefined && options.maxPrice !== null && !isNaN(options.maxPrice) && options.maxPrice > 0) {
      allDevices = allDevices.filter(d => {
        const m = d.model || modelMap.get(d.model_id);
        const p = Number(d.list_price) || Number(m?.default_list_price) || 0;
        return p <= options.maxPrice!;
      });
    }

    // 5. Filter by individual device IDs / keys (if provided)
    if (options.selectedDeviceIds && options.selectedDeviceIds.length > 0) {
      const idSet = new Set(
        options.selectedDeviceIds.map(id => String(id).trim()).filter(Boolean)
      );
      if (idSet.size > 0) {
        allDevices = allDevices.filter(d => {
          const m = d.model || modelMap.get(d.model_id);
          const devId = (d.id || '').trim();
          const modelId = (d.model_id || m?.id || '').trim();
          return idSet.has(devId) || idSet.has(modelId);
        });
      }
    }

    if (includeSerialNumbers) {
      // =========================================================================
      // MODE B — Serial Numbers Enabled
      // - Export each available serialized device as an individual row.
      // - No quantity column (each row represents 1 physical device).
      // - Sorted by price in ASCENDING order (lowest price to highest price).
      // - Sorting applies even if price column is hidden.
      // - Exclude non-serialized stock (never invent fake serial numbers).
      // =========================================================================
      const serializedDevices = allDevices.filter(d => Boolean(d.serial_number && d.serial_number.trim()));

      const sortOrder = options.priceSortOrder || 'asc';
      // Sort by selling price (asc or desc) with Brand & Model as stable secondary tie-breaker
      serializedDevices.sort((a, b) => {
        const priceA = Number(a.list_price) || 0;
        const priceB = Number(b.list_price) || 0;
        if (priceA !== priceB) {
          return sortOrder === 'desc' ? priceB - priceA : priceA - priceB;
        }
        const brandA = (a.brand || a.model?.brand || '').trim();
        const brandB = (b.brand || b.model?.brand || '').trim();
        const brandCmp = brandA.localeCompare(brandB, 'ar');
        if (brandCmp !== 0) return brandCmp;
        const modelA = (a.model_name || a.model?.model_name || '').trim();
        const modelB = (b.model_name || b.model?.model_name || '').trim();
        return modelA.localeCompare(modelB, 'ar');
      });

      const columns: { header: string; key: string; width: number }[] = [
        { header: 'السيريال (Serial Number)', key: 'serial_number', width: 24 },
        { header: 'الماركة والموديل (Brand & Model)', key: 'brand_and_model', width: 28 },
      ];

      // Optional Category Column
      if (includeCategory) {
        columns.push({ header: 'الفئة', key: 'category', width: 14 });
      }

      columns.push(
        { header: 'المعالج (Processor)', key: 'processor', width: 24 },
        { header: 'الرام (RAM)', key: 'ram', width: 14 },
        { header: 'سعة التخزين (Storage)', key: 'storage', width: 18 },
        { header: 'كارت الشاشة (GPU)', key: 'gpu', width: 20 }
      );

      // Optional Screen Specifications Column
      if (includeScreen) {
        columns.push({ header: 'الشاشة (Screen)', key: 'screen', width: 26 });
      }

      // Optional Status Column
      if (includeStatus) {
        columns.push({ header: 'الحالة', key: 'physical_condition', width: 16 });
      }

      // Optional Branch / Warehouse Column
      if (includeBranch) {
        columns.push({ header: 'الفرع / المخزن', key: 'stock_location', width: 18 });
      }

      // Only include price column if includePrices is enabled
      if (includePrices) {
        columns.push({ header: 'السعر (EGP)', key: 'price', width: 16 });
      }

      const rows = serializedDevices.map(d => {
        const m = d.model || modelMap.get(d.model_id);

        const rowObj: any = {
          'السيريال (Serial Number)': cleanSpec(d.serial_number),
          'الماركة والموديل (Brand & Model)': formatBrandAndModel(d.brand || m?.brand, d.model_name || m?.model_name),
        };

        if (includeCategory) {
          rowObj['الفئة'] = cleanSpec(d.category || m?.category || 'لابتوب');
        }

        rowObj['المعالج (Processor)'] = cleanSpec(m?.processor);
        rowObj['الرام (RAM)'] = cleanSpec(m?.ram);
        rowObj['سعة التخزين (Storage)'] = cleanSpec(m?.storage);
        rowObj['كارت الشاشة (GPU)'] = cleanSpec(m?.gpu);

        if (includeScreen) {
          rowObj['الشاشة (Screen)'] = formatScreenSummary(m?.screen_size, m?.specifications);
        }

        if (includeStatus) {
          rowObj['الحالة'] = cleanSpec(d.physical_condition || 'ممتازة');
        }

        if (includeBranch) {
          rowObj['الفرع / المخزن'] = cleanSpec(d.stock_location);
        }

        if (includePrices) {
          rowObj['السعر (EGP)'] = Number(d.list_price) || 0;
        }

        // Attach non-enumerable row key for safe selection matching without polluting Excel export
        Object.defineProperty(rowObj, '_rowKey', {
          value: d.id,
          enumerable: false,
          writable: true,
          configurable: true,
        });

        return rowObj;
      });

      const uniqueModelIds = new Set(serializedDevices.map(d => d.model_id));
      return {
        rows,
        columns,
        totalUnits: serializedDevices.length,
        totalModels: uniqueModelIds.size,
      };
    } else {
      // =========================================================================
      // MODE A — Serial Numbers Disabled
      // - Group available inventory by laptop model (1 row per model).
      // - Display full specifications in dedicated columns.
      // - Display total available quantity for that model (if includeQuantity is on).
      // - Omit serial numbers completely.
      // - If includePrices is on, display price.
      // =========================================================================
      interface ModelGroup {
        modelId: string;
        brand: string;
        modelName: string;
        category: string;
        model?: any;
        availableQuantity: number;
        listPrice: number;
        locations: Set<string>;
        physicalConditions: Set<string>;
      }

      const groupMap = new Map<string, ModelGroup>();

      for (const d of allDevices) {
        const m = d.model || modelMap.get(d.model_id);
        const modelId = d.model_id || (m ? m.id : 'unknown');
        const qty = d.is_serialized ? 1 : Math.max(1, d.quantity || 1);

        if (!groupMap.has(modelId)) {
          groupMap.set(modelId, {
            modelId,
            brand: d.brand || m?.brand || '---',
            modelName: d.model_name || m?.model_name || '---',
            category: d.category || m?.category || 'لابتوب',
            model: m,
            availableQuantity: 0,
            listPrice: Number(d.list_price) || Number(m?.default_list_price) || 0,
            locations: new Set<string>(),
            physicalConditions: new Set<string>(),
          });
        }

        const grp = groupMap.get(modelId)!;
        grp.availableQuantity += qty;
        if (d.stock_location) grp.locations.add(d.stock_location);
        if (d.physical_condition) grp.physicalConditions.add(d.physical_condition);
        if (!grp.listPrice && d.list_price) grp.listPrice = Number(d.list_price);
      }

      const groups = Array.from(groupMap.values());
      const sortOrder = options.priceSortOrder || 'asc';
      // Sort by selling price (asc or desc) with Brand & Model as stable secondary tie-breaker
      groups.sort((a, b) => {
        const priceA = Number(a.listPrice) || 0;
        const priceB = Number(b.listPrice) || 0;
        if (priceA !== priceB) {
          return sortOrder === 'desc' ? priceB - priceA : priceA - priceB;
        }
        const brandCmp = (a.brand || '').localeCompare(b.brand || '', 'ar');
        if (brandCmp !== 0) return brandCmp;
        return (a.modelName || '').localeCompare(b.modelName || '', 'ar');
      });

      const columns: { header: string; key: string; width: number }[] = [
        { header: 'الماركة والموديل (Brand & Model)', key: 'brand_and_model', width: 28 },
      ];

      // Optional Category Column
      if (includeCategory) {
        columns.push({ header: 'الفئة', key: 'category', width: 14 });
      }

      columns.push(
        { header: 'المعالج (Processor)', key: 'processor', width: 24 },
        { header: 'الرام (RAM)', key: 'ram', width: 14 },
        { header: 'سعة التخزين (Storage)', key: 'storage', width: 18 },
        { header: 'كارت الشاشة (GPU)', key: 'gpu', width: 20 }
      );

      // Optional Screen Specifications Column
      if (includeScreen) {
        columns.push({ header: 'الشاشة (Screen)', key: 'screen', width: 26 });
      }

      // Optional Status Column
      if (includeStatus) {
        columns.push({ header: 'الحالة', key: 'physical_condition', width: 16 });
      }

      // Optional Branch / Warehouse Column
      if (includeBranch) {
        columns.push({ header: 'الفرع / المخزن', key: 'stock_location', width: 18 });
      }

      if (includeQuantity) {
        columns.push({ header: 'الكمية المتاحة', key: 'quantity', width: 14 });
      }

      if (includePrices) {
        columns.push({ header: 'السعر (EGP)', key: 'price', width: 16 });
      }

      const rows = groups.map(g => {
        const m = g.model;
        const locDisplay = g.locations.size > 0 ? Array.from(g.locations).join(' و ') : '---';
        const condDisplay = g.physicalConditions.size > 0 ? Array.from(g.physicalConditions).join(' / ') : 'ممتازة';

        const rowObj: any = {
          'الماركة والموديل (Brand & Model)': formatBrandAndModel(g.brand, g.modelName),
        };

        if (includeCategory) {
          rowObj['الفئة'] = cleanSpec(g.category);
        }

        rowObj['المعالج (Processor)'] = cleanSpec(m?.processor);
        rowObj['الرام (RAM)'] = cleanSpec(m?.ram);
        rowObj['سعة التخزين (Storage)'] = cleanSpec(m?.storage);
        rowObj['كارت الشاشة (GPU)'] = cleanSpec(m?.gpu);

        if (includeScreen) {
          rowObj['الشاشة (Screen)'] = formatScreenSummary(m?.screen_size, m?.specifications);
        }

        if (includeStatus) {
          rowObj['الحالة'] = cleanSpec(condDisplay);
        }

        if (includeBranch) {
          rowObj['الفرع / المخزن'] = locDisplay;
        }

        if (includeQuantity) {
          rowObj['الكمية المتاحة'] = g.availableQuantity;
        }

        if (includePrices) {
          rowObj['السعر (EGP)'] = g.listPrice;
        }

        // Attach non-enumerable row key for safe selection matching without polluting Excel export
        Object.defineProperty(rowObj, '_rowKey', {
          value: g.modelId,
          enumerable: false,
          writable: true,
          configurable: true,
        });

        return rowObj;
      });

      const totalUnits = groups.reduce((sum, g) => sum + g.availableQuantity, 0);
      return {
        rows,
        columns,
        totalUnits,
        totalModels: groups.length,
      };
    }
  },

  /**
   * Generates a fully formatted XLSX Workbook.
   * If customRowsOrDevices is provided, uses them directly while preserving column definitions and RTL styling.
   */
  async buildWholesaleWorkbook(options: WholesaleExportOptions, customRowsOrDevices?: any[]): Promise<{
    wb: WorkBook;
    workbook?: WorkBook;
    filename: string;
    rows: any[];
    columns: any[];
    totalUnits: number;
    totalModels: number;
  }> {
    const isDevicesArray =
      customRowsOrDevices &&
      customRowsOrDevices.length > 0 &&
      ('model_id' in customRowsOrDevices[0] || 'serial_number' in customRowsOrDevices[0]);

    const { rows: dataRows, columns, totalUnits: calcUnits, totalModels: calcModels } =
      await this.buildWholesaleData(options, isDevicesArray ? customRowsOrDevices : undefined);

    const rows = !isDevicesArray && customRowsOrDevices && customRowsOrDevices.length > 0 ? customRowsOrDevices : dataRows;

    // Strict validation: Never silently produce an empty Excel export file when 0 rows match
    if (!rows || rows.length === 0) {
      throw new Error('لا توجد أجهزة مطابقة لمعايير الفلترة المحددة لتصديرها. يرجى تعديل خيارات الفلترة واختيار أجهزة صالحة.');
    }

    const totalUnits =
      !isDevicesArray && customRowsOrDevices && customRowsOrDevices.length > 0
        ? customRowsOrDevices.reduce((sum, r) => sum + (Number(r['الكمية المتاحة']) || 1), 0)
        : calcUnits;
    const totalModels =
      !isDevicesArray && customRowsOrDevices && customRowsOrDevices.length > 0
        ? customRowsOrDevices.length
        : calcModels;

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows, {
      header: columns.map(c => c.header),
    });

    // Apply professional styling: colored headers, alternating zebra rows, borders, alignments, and number formats
    applyStyledExcelFormatting(ws, columns, rows);

    // Force Left-to-Right (LTR) workbook and worksheet view
    if (!wb.Workbook) wb.Workbook = {} as any;
    if (!wb.Workbook.Views) wb.Workbook.Views = [];
    wb.Workbook.Views[0] = { RTL: false } as any;

    const sheetName = 'المخزون المتاح للجملة';
    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    const branchTarget = options.branchFilter || options.branch || 'ALL';
    const dateStr = new Date().toISOString().split('T')[0];
    const branchSuffix = branchTarget && branchTarget !== 'ALL' ? `_${branchTarget.replace(/\s+/g, '_')}` : '';
    const brandSuffix = options.selectedBrands && options.selectedBrands.length === 1 ? `_${options.selectedBrands[0]}` : '';
    const categorySuffix = options.selectedCategories && options.selectedCategories.length === 1 ? `_${options.selectedCategories[0].replace(/\s+/g, '_')}` : '';
    const baseTitle = options.includeSerialNumbers
      ? 'تقرير_الأجهزة_المسلسلة_المتاحة_للجملة'
      : 'تقرير_مخزون_الأجهزة_المتاحة_للجملة';
    const filename = sanitizeArabicFilename(`${baseTitle}${categorySuffix}${brandSuffix}${branchSuffix}_${dateStr}.xlsx`);

    return {
      wb,
      workbook: wb,
      filename,
      rows,
      columns,
      totalUnits,
      totalModels,
    };
  },

  /**
   * Exports Wholesale Inventory to Excel and triggers browser download if in DOM environment.
   */
  async exportWholesaleInventoryToExcel(options: WholesaleExportOptions, customRows?: any[]): Promise<{
    filename: string;
    rowCount: number;
    totalUnits: number;
    totalModels: number;
    buffer: Uint8Array;
  }> {
    const { wb, filename, rows, totalUnits, totalModels } = await this.buildWholesaleWorkbook(options, customRows);

    // Generate binary buffer (works in Node.js and browser)
    const rawBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const buffer = new Uint8Array(rawBuffer);

    // If running in browser/Tauri frontend, trigger file download
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      XLSX.writeFile(wb, filename);
    }

    return {
      filename,
      rowCount: rows.length,
      totalUnits,
      totalModels,
      buffer,
    };
  },
};
