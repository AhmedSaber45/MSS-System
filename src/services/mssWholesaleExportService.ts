import * as XLSXStyle from 'xlsx-js-style';
import type { WorkBook, WorkSheet } from 'xlsx-js-style';
const XLSX: any = (XLSXStyle as any).default || XLSXStyle;
import { mssInventoryService } from './mssInventoryService.ts';
import { mssCatalogService } from './mssCatalogService.ts';
import { exportStorageService } from './exportStorageService.ts';
import type { WholesaleExportOptions, WholesaleExportRow } from '@/types/mssReports';
import type { MSSStockLocation, MSSDevice } from '@/types/mssInventory';

/**
 * Standardized Concise Arabic Column Headers (Per Section 3 Naming Rules)
 */
export const WHOLESALE_HEADERS = {
  MODEL: 'الموديل',
  PROCESSOR: 'المعالج',
  RAM: 'الرام',
  STORAGE: 'الهارد',
  SCREEN: 'الشاشة',
  GPU: 'كارت الشاشة',
  SERIAL: 'السيريال نمبر',
  PRICE: 'السعر',
  QUANTITY: 'الكمية',
  CATEGORY: 'الفئة',
  STATUS: 'الحالة',
  BRANCH: 'الفرع / المخزن',
} as const;

export interface WholesaleExportColumn {
  header: string;
  key: string;
  width: number;
  align: 'left' | 'center' | 'right';
  isNumeric?: boolean;
  numFmt?: string;
  getValue: (item: any) => string | number;
}

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
 * Example: formatArabicExportFilename('الاجهزة_المتاحة', 'xlsx')
 *          -> 'الاجهزة_المتاحة_2026-11-19.xlsx'
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
 * Dynamically resolves the canonical column definitions based on active export options.
 * Follows concise Arabic column header naming rules:
 * - Brand & Model -> الموديل
 * - Processor -> المعالج
 * - RAM -> الرام
 * - Storage -> الهارد
 * - Screen -> الشاشة
 * - GPU -> كارت الشاشة
 * - Serial -> السيريال نمبر
 * - Price -> السعر
 * - Quantity -> الكمية
 * - Category -> الفئة
 * - Status -> الحالة
 * - Branch -> الفرع / المخزن
 */
export function getWholesaleColumns(options: WholesaleExportOptions): WholesaleExportColumn[] {
  const includePrices = options.includePrices !== false;
  const includeQuantity = options.includeQuantity !== false;
  const includeSerialNumbers = Boolean(options.includeSerialNumbers);
  const includeStatus = options.includeStatus !== false;
  const includeBranch = options.includeBranch !== false;
  const includeCategory = options.includeCategory !== false;
  const includeScreen = options.includeScreen !== false;

  const cols: WholesaleExportColumn[] = [];

  // 1. Serial Number (Mode B only)
  if (includeSerialNumbers) {
    cols.push({
      header: WHOLESALE_HEADERS.SERIAL,
      key: 'serial_number',
      width: 24,
      align: 'center',
      getValue: (item: any) => {
        return cleanSpec(
          item.serial_number ||
          item._rawDevice?.serial_number ||
          item['السيريال نمبر'] ||
          item['السيريال (Serial Number)'] ||
          item['الرقم المسلسل (Serial Number)']
        );
      },
    });
  }

  // 2. Model (Brand & Model combined)
  cols.push({
    header: WHOLESALE_HEADERS.MODEL,
    key: 'brand_and_model',
    width: 32,
    align: 'left',
    getValue: (item: any) => {
      if (item._rawDevice) {
        const m = item._rawDevice.model;
        return formatBrandAndModel(item._rawDevice.brand || m?.brand, item._rawDevice.model_name || m?.model_name);
      }
      if (item._rawGroup) {
        return formatBrandAndModel(item._rawGroup.brand, item._rawGroup.modelName);
      }
      return cleanSpec(
        item['الموديل'] ||
        item['الماركة والموديل (Brand & Model)'] ||
        (item.brand && item.model_name ? formatBrandAndModel(item.brand, item.model_name) : '') ||
        item.model_name ||
        item.model
      );
    },
  });

  // 3. Category (Optional)
  if (includeCategory) {
    cols.push({
      header: WHOLESALE_HEADERS.CATEGORY,
      key: 'category',
      width: 14,
      align: 'center',
      getValue: (item: any) => {
        return cleanSpec(
          item._rawDevice?.category ||
          item._rawDevice?.model?.category ||
          item._rawGroup?.category ||
          item['الفئة'] ||
          item.category ||
          'لابتوب'
        );
      },
    });
  }

  // 4. Processor
  cols.push({
    header: WHOLESALE_HEADERS.PROCESSOR,
    key: 'processor',
    width: 24,
    align: 'center',
    getValue: (item: any) => {
      return cleanSpec(
        item._rawDevice?.model?.processor ||
        item._rawGroup?.model?.processor ||
        item['المعالج'] ||
        item['المعالج (Processor)'] ||
        item.processor
      );
    },
  });

  // 5. RAM
  cols.push({
    header: WHOLESALE_HEADERS.RAM,
    key: 'ram',
    width: 14,
    align: 'center',
    getValue: (item: any) => {
      return cleanSpec(
        item._rawDevice?.model?.ram ||
        item._rawGroup?.model?.ram ||
        item['الرام'] ||
        item['الرام (RAM)'] ||
        item.ram
      );
    },
  });

  // 6. Storage (Hard Drive)
  cols.push({
    header: WHOLESALE_HEADERS.STORAGE,
    key: 'storage',
    width: 20,
    align: 'center',
    getValue: (item: any) => {
      return cleanSpec(
        item._rawDevice?.model?.storage ||
        item._rawGroup?.model?.storage ||
        item['الهارد'] ||
        item['سعة التخزين (Storage)'] ||
        item.storage
      );
    },
  });

  // 7. GPU
  cols.push({
    header: WHOLESALE_HEADERS.GPU,
    key: 'gpu',
    width: 22,
    align: 'center',
    getValue: (item: any) => {
      return cleanSpec(
        item._rawDevice?.model?.gpu ||
        item._rawGroup?.model?.gpu ||
        item['كارت الشاشة'] ||
        item['كارت الشاشة (GPU)'] ||
        item.gpu
      );
    },
  });

  // 8. Screen (Optional)
  if (includeScreen) {
    cols.push({
      header: WHOLESALE_HEADERS.SCREEN,
      key: 'screen',
      width: 28,
      align: 'center',
      getValue: (item: any) => {
        if (item._rawDevice?.model) {
          return formatScreenSummary(item._rawDevice.model.screen_size, item._rawDevice.model.specifications);
        }
        if (item._rawGroup?.model) {
          return formatScreenSummary(item._rawGroup.model.screen_size, item._rawGroup.model.specifications);
        }
        return cleanSpec(
          item['الشاشة'] ||
          item['الشاشة (Screen)'] ||
          formatScreenSummary(item.screen_size, item.specifications || item.specs)
        );
      },
    });
  }

  // 9. Status (Optional)
  if (includeStatus) {
    cols.push({
      header: WHOLESALE_HEADERS.STATUS,
      key: 'physical_condition',
      width: 16,
      align: 'center',
      getValue: (item: any) => {
        if (item._rawGroup?.physicalConditions) {
          return cleanSpec(
            item._rawGroup.physicalConditions.size > 0
              ? Array.from(item._rawGroup.physicalConditions).join(' / ')
              : 'ممتازة'
          );
        }
        return cleanSpec(
          item._rawDevice?.physical_condition ||
          item['الحالة'] ||
          item.physical_condition ||
          'ممتازة'
        );
      },
    });
  }

  // 10. Branch / Warehouse (Optional)
  if (includeBranch) {
    cols.push({
      header: WHOLESALE_HEADERS.BRANCH,
      key: 'stock_location',
      width: 18,
      align: 'center',
      getValue: (item: any) => {
        if (item._rawGroup?.locations) {
          return cleanSpec(
            item._rawGroup.locations.size > 0
              ? Array.from(item._rawGroup.locations).join(' و ')
              : '---'
          );
        }
        return cleanSpec(
          item._rawDevice?.stock_location ||
          item['الفرع / المخزن'] ||
          item.stock_location ||
          '---'
        );
      },
    });
  }

  // 11. Quantity (Mode A only)
  if (!includeSerialNumbers && includeQuantity) {
    cols.push({
      header: WHOLESALE_HEADERS.QUANTITY,
      key: 'quantity',
      width: 14,
      align: 'center',
      isNumeric: true,
      numFmt: '#,##0',
      getValue: (item: any) => {
        if (item._rawGroup?.availableQuantity !== undefined) {
          return Number(item._rawGroup.availableQuantity) || 0;
        }
        const val = item['الكمية'] ?? item['الكمية المتاحة'] ?? item.quantity ?? 1;
        return Number(val) || 0;
      },
    });
  }

  // 12. Price (Optional)
  if (includePrices) {
    cols.push({
      header: WHOLESALE_HEADERS.PRICE,
      key: 'price',
      width: 16,
      align: 'center',
      isNumeric: true,
      numFmt: '#,##0 "EGP"',
      getValue: (item: any) => {
        if (item._rawDevice?.list_price !== undefined) {
          return Number(item._rawDevice.list_price) || 0;
        }
        if (item._rawGroup?.listPrice !== undefined) {
          return Number(item._rawGroup.listPrice) || 0;
        }
        const val = item['السعر'] ?? item['السعر (EGP)'] ?? item.listPrice ?? item.list_price ?? item.price ?? 0;
        return Number(val) || 0;
      },
    });
  }

  return cols;
}

/**
 * Applies enhanced professional visual formatting to an Excel worksheet:
 * 1. Dark Blue / Navy header row (#0C3582) with bold white high-contrast text and medium bottom border.
 * 2. Alternating row colors (subtle zebra striping: #FFFFFF and #F1F5F9).
 * 3. Thin clean borders (#E2E8F0) around all data cells.
 * 4. Center-aligned short specs (RAM, CPU, GPU, Screen, Serial, Status, Branch, Quantity, Price).
 * 5. Left-aligned Model descriptions for natural LTR Arabic + English reading.
 * 6. Explicit numeric formatting for Price (#,##0 "EGP") and Quantity (#,##0).
 * 7. Generous row heights (header: 28pt, data: 24pt) and text wrapping on all cells to avoid clipping.
 * 8. Dynamic column widths calculated with comfortable padding.
 * 9. Frozen header row so column names remain visible during scrolling (Desktop & Mobile).
 * 10. Native Excel autofilter enabled across all active columns.
 * 11. Strictly Left-to-Right (LTR) worksheet view.
 */
export function applyStyledExcelFormatting(
  ws: WorkSheet | any,
  columns: WholesaleExportColumn[] | { header: string; key: string; width?: number; align?: string; isNumeric?: boolean; numFmt?: string }[],
  rows: any[]
): void {
  const rowCount = rows.length;
  const colCount = columns.length;

  // Row heights: header row = 26pt, data rows = 22pt
  ws['!rows'] = [{ hpt: 26 }, ...rows.map(() => ({ hpt: 22 }))];

  // Dynamic column widths calculation with padding and safe bounds
  ws['!cols'] = columns.map((col, c) => {
    let maxLen = (col.header || '').length;
    for (let r = 0; r < rowCount; r++) {
      const rowData = rows[r];
      const val = Array.isArray(rowData) ? rowData[c] : rowData?.[col.header] ?? rowData?.[col.key];
      if (val !== undefined && val !== null) {
        const len = String(val).length;
        if (len > maxLen) maxLen = len;
      }
    }

    let minWidth = 16;
    if (col.key === 'model' || col.key === 'brand_and_model' || col.header === WHOLESALE_HEADERS.MODEL || col.header.includes('الماركة والموديل')) minWidth = 30;
    else if (col.key === 'screen' || col.header === WHOLESALE_HEADERS.SCREEN) minWidth = 28;
    else if (col.key === 'processor' || col.header === WHOLESALE_HEADERS.PROCESSOR) minWidth = 24;
    else if (col.key === 'serial_number' || col.header === WHOLESALE_HEADERS.SERIAL) minWidth = 22;
    else if (col.key === 'storage' || col.header === WHOLESALE_HEADERS.STORAGE) minWidth = 18;
    else if (col.key === 'gpu' || col.header === WHOLESALE_HEADERS.GPU) minWidth = 20;
    else if (col.key === 'price' || col.header === WHOLESALE_HEADERS.PRICE) minWidth = 16;
    else if (col.key === 'quantity' || col.header === WHOLESALE_HEADERS.QUANTITY) minWidth = 14;
    else if (col.key === 'stock_location' || col.header === WHOLESALE_HEADERS.BRANCH) minWidth = 18;
    else if (col.key === 'physical_condition' || col.header === WHOLESALE_HEADERS.STATUS) minWidth = 16;
    else if (col.key === 'category' || col.header === WHOLESALE_HEADERS.CATEGORY) minWidth = 14;
    else if (col.key === 'ram' || col.header === WHOLESALE_HEADERS.RAM) minWidth = 14;

    const wch = Math.min(50, Math.max(minWidth, Math.ceil(maxLen * 1.1) + 3));
    return { wch };
  });

  // Ensure LTR view with frozen header row across desktop and mobile Excel
  ws['!views'] = [
    {
      rightToLeft: false,
      state: 'frozen',
      ySplit: 1,
      topLeftCell: 'A2',
      activePane: 'bottomLeft',
    },
  ];

  ws['!freeze'] = {
    xSplit: 0,
    ySplit: 1,
    topLeftCell: 'A2',
    activePane: 'bottomLeft',
    state: 'frozen',
  };

  // Enable native Excel autofilter on header row
  if (rowCount > 0 && colCount > 0) {
    ws['!autofilter'] = {
      ref: XLSX.utils.encode_range({
        s: { r: 0, c: 0 },
        e: { r: rowCount, c: colCount - 1 },
      }),
    };
  }

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

  // 1. Format Header Row (Row 0)
  for (let c = 0; c < colCount; c++) {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c });
    if (!ws[cellRef]) {
      ws[cellRef] = { t: 's', v: columns[c].header };
    }
    ws[cellRef].s = {
      fill: { patternType: 'solid', fgColor: { rgb: '0C3582' } },
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
        const rawVal = Array.isArray(rowData) ? rowData[c] : rowData?.[col.header] ?? rowData?.[col.key];
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

      const isModel =
        col.key === 'model' ||
        col.key === 'brand_and_model' ||
        col.header === WHOLESALE_HEADERS.MODEL ||
        col.header.includes('الماركة والموديل');
      const isPrice =
        col.key === 'price' ||
        col.header === WHOLESALE_HEADERS.PRICE ||
        col.header.includes('السعر');
      const isQuantity =
        col.key === 'quantity' ||
        col.header === WHOLESALE_HEADERS.QUANTITY ||
        col.header.includes('الكمية');

      const horizontalAlign: 'right' | 'center' = isModel ? 'right' : 'center';

      const cellStyle: any = {
        fill: {
          patternType: 'solid',
          fgColor: { rgb: bgRgb },
        },
        font: { name: 'Segoe UI', sz: 10, color: { rgb: '0F172A' } },
        alignment: { horizontal: horizontalAlign, vertical: 'center', wrapText: true },
        border: thinDataBorder,
      };

      if (isPrice) {
        const numVal = typeof cell.v === 'number' ? cell.v : Number(String(cell.v).replace(/[^0-9.-]+/g, '')) || 0;
        cell.t = 'n';
        cell.v = numVal;
        cellStyle.numFmt = '#,##0 "EGP"';
      } else if (isQuantity) {
        const numVal = typeof cell.v === 'number' ? cell.v : Number(cell.v) || 0;
        cell.t = 'n';
        cell.v = numVal;
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
  getWholesaleColumns,
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
    const { includeSerialNumbers } = options;
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
        const p = Number(d.list_price ?? (d as any).price) || Number(m?.default_list_price) || 0;
        return p >= options.minPrice!;
      });
    }

    // 4. Filter by Price Range: Max Price
    if (options.maxPrice !== undefined && options.maxPrice !== null && !isNaN(options.maxPrice) && options.maxPrice > 0) {
      allDevices = allDevices.filter(d => {
        const m = d.model || modelMap.get(d.model_id);
        const p = Number(d.list_price ?? (d as any).price) || Number(m?.default_list_price) || 0;
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

    // Resolve column definitions dynamically from options
    const columns = getWholesaleColumns(options);

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

      const rows = serializedDevices.map(d => {
        const m = d.model || modelMap.get(d.model_id);
        const deviceWrapper = { ...d, model: m };

        const rowObj: any = {};
        for (const col of columns) {
          rowObj[col.header] = col.getValue(deviceWrapper);
        }

        // Canonical property aliases
        rowObj.brand_and_model = rowObj[WHOLESALE_HEADERS.MODEL];
        rowObj.model_name = d.model_name || m?.model_name;
        rowObj.brand = d.brand || m?.brand;
        rowObj.processor = rowObj[WHOLESALE_HEADERS.PROCESSOR];
        rowObj.ram = rowObj[WHOLESALE_HEADERS.RAM];
        rowObj.storage = rowObj[WHOLESALE_HEADERS.STORAGE];
        rowObj.gpu = rowObj[WHOLESALE_HEADERS.GPU];
        if (rowObj[WHOLESALE_HEADERS.SCREEN] !== undefined) rowObj.screen = rowObj[WHOLESALE_HEADERS.SCREEN];
        if (rowObj[WHOLESALE_HEADERS.CATEGORY] !== undefined) rowObj.category = rowObj[WHOLESALE_HEADERS.CATEGORY];
        if (rowObj[WHOLESALE_HEADERS.STATUS] !== undefined) rowObj.physical_condition = rowObj[WHOLESALE_HEADERS.STATUS];
        if (rowObj[WHOLESALE_HEADERS.BRANCH] !== undefined) rowObj.stock_location = rowObj[WHOLESALE_HEADERS.BRANCH];
        if (rowObj[WHOLESALE_HEADERS.PRICE] !== undefined) rowObj.price = rowObj[WHOLESALE_HEADERS.PRICE];
        if (rowObj[WHOLESALE_HEADERS.SERIAL] !== undefined) rowObj.serial_number = rowObj[WHOLESALE_HEADERS.SERIAL];

        // Backwards-compatible legacy aliases (so existing tests and preview JSX work seamlessly)
        rowObj['الماركة والموديل (Brand & Model)'] = rowObj[WHOLESALE_HEADERS.MODEL];
        rowObj['المعالج (Processor)'] = rowObj[WHOLESALE_HEADERS.PROCESSOR];
        rowObj['الرام (RAM)'] = rowObj[WHOLESALE_HEADERS.RAM];
        rowObj['سعة التخزين (Storage)'] = rowObj[WHOLESALE_HEADERS.STORAGE];
        rowObj['كارت الشاشة (GPU)'] = rowObj[WHOLESALE_HEADERS.GPU];
        if (rowObj[WHOLESALE_HEADERS.SCREEN] !== undefined) rowObj['الشاشة (Screen)'] = rowObj[WHOLESALE_HEADERS.SCREEN];
        if (rowObj[WHOLESALE_HEADERS.PRICE] !== undefined) rowObj['السعر (EGP)'] = rowObj[WHOLESALE_HEADERS.PRICE];
        if (rowObj[WHOLESALE_HEADERS.SERIAL] !== undefined) rowObj['السيريال (Serial Number)'] = rowObj[WHOLESALE_HEADERS.SERIAL];

        // Attach non-enumerable row key & raw item for safe selection matching without polluting Excel export
        Object.defineProperty(rowObj, '_rowKey', {
          value: d.id,
          enumerable: false,
          writable: true,
          configurable: true,
        });
        Object.defineProperty(rowObj, '_rawDevice', {
          value: deviceWrapper,
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

      const rows = groups.map(g => {
        const rowObj: any = {};
        for (const col of columns) {
          rowObj[col.header] = col.getValue({ _rawGroup: g });
        }

        // Canonical property aliases
        rowObj.brand_and_model = rowObj[WHOLESALE_HEADERS.MODEL];
        rowObj.model_name = g.modelName;
        rowObj.brand = g.brand;
        rowObj.processor = rowObj[WHOLESALE_HEADERS.PROCESSOR];
        rowObj.ram = rowObj[WHOLESALE_HEADERS.RAM];
        rowObj.storage = rowObj[WHOLESALE_HEADERS.STORAGE];
        rowObj.gpu = rowObj[WHOLESALE_HEADERS.GPU];
        if (rowObj[WHOLESALE_HEADERS.SCREEN] !== undefined) rowObj.screen = rowObj[WHOLESALE_HEADERS.SCREEN];
        if (rowObj[WHOLESALE_HEADERS.CATEGORY] !== undefined) rowObj.category = rowObj[WHOLESALE_HEADERS.CATEGORY];
        if (rowObj[WHOLESALE_HEADERS.STATUS] !== undefined) rowObj.physical_condition = rowObj[WHOLESALE_HEADERS.STATUS];
        if (rowObj[WHOLESALE_HEADERS.BRANCH] !== undefined) rowObj.stock_location = rowObj[WHOLESALE_HEADERS.BRANCH];
        if (rowObj[WHOLESALE_HEADERS.QUANTITY] !== undefined) rowObj.quantity = rowObj[WHOLESALE_HEADERS.QUANTITY];
        if (rowObj[WHOLESALE_HEADERS.PRICE] !== undefined) rowObj.price = rowObj[WHOLESALE_HEADERS.PRICE];

        // Backwards-compatible legacy aliases (so existing tests and preview JSX work seamlessly)
        rowObj['الماركة والموديل (Brand & Model)'] = rowObj[WHOLESALE_HEADERS.MODEL];
        rowObj['المعالج (Processor)'] = rowObj[WHOLESALE_HEADERS.PROCESSOR];
        rowObj['الرام (RAM)'] = rowObj[WHOLESALE_HEADERS.RAM];
        rowObj['سعة التخزين (Storage)'] = rowObj[WHOLESALE_HEADERS.STORAGE];
        rowObj['كارت الشاشة (GPU)'] = rowObj[WHOLESALE_HEADERS.GPU];
        if (rowObj[WHOLESALE_HEADERS.SCREEN] !== undefined) rowObj['الشاشة (Screen)'] = rowObj[WHOLESALE_HEADERS.SCREEN];
        if (rowObj[WHOLESALE_HEADERS.QUANTITY] !== undefined) rowObj['الكمية المتاحة'] = rowObj[WHOLESALE_HEADERS.QUANTITY];
        if (rowObj[WHOLESALE_HEADERS.PRICE] !== undefined) rowObj['السعر (EGP)'] = rowObj[WHOLESALE_HEADERS.PRICE];

        // Attach non-enumerable row key & raw item for safe selection matching without polluting Excel export
        Object.defineProperty(rowObj, '_rowKey', {
          value: g.modelId,
          enumerable: false,
          writable: true,
          configurable: true,
        });
        Object.defineProperty(rowObj, '_rawGroup', {
          value: g,
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
   * Uses Array-of-Arrays (AOA) strictly derived from active columns.
   * This guarantees:
   * 1. Every enabled column appears in the exact correct position.
   * 2. Hidden columns are completely omitted with ZERO residual cells.
   * 3. No shifting, misalignment, or unstyled column anomalies.
   * 4. Full compatibility with desktop Excel and mobile spreadsheet viewers (Google Sheets, Excel Mobile).
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
    // 1. Resolve columns dynamically from active options
    const columns = getWholesaleColumns(options);

    // 2. Resolve rows
    const isDevicesArray =
      customRowsOrDevices &&
      customRowsOrDevices.length > 0 &&
      ('model_id' in customRowsOrDevices[0] || 'serial_number' in customRowsOrDevices[0]);

    let sourceRows: any[];
    let calcUnits = 0;
    let calcModels = 0;

    if (isDevicesArray) {
      const data = await this.buildWholesaleData(options, customRowsOrDevices);
      sourceRows = data.rows;
      calcUnits = data.totalUnits;
      calcModels = data.totalModels;
    } else if (customRowsOrDevices && customRowsOrDevices.length > 0) {
      sourceRows = customRowsOrDevices;
      calcUnits = sourceRows.reduce((sum, r) => sum + (Number(r[WHOLESALE_HEADERS.QUANTITY] ?? r['الكمية'] ?? r['الكمية المتاحة'] ?? r.quantity) || 1), 0);
      calcModels = sourceRows.length;
    } else {
      const data = await this.buildWholesaleData(options);
      sourceRows = data.rows;
      calcUnits = data.totalUnits;
      calcModels = data.totalModels;
    }

    // Strict validation: Never silently produce an empty Excel export file when 0 rows match
    if (!sourceRows || sourceRows.length === 0) {
      throw new Error('لا توجد أجهزة مطابقة لمعايير الفلترة المحددة لتصديرها. يرجى تعديل خيارات الفلترة واختيار أجهزة صالحة.');
    }

    // 3. Build Array of Arrays (AOA) - GUARANTEES 100% column alignment and no extra hidden keys!
    const headers = columns.map(c => c.header);
    const dataRows = sourceRows.map(row => {
      return columns.map(col => col.getValue(row));
    });

    const aoa = [headers, ...dataRows];
    const ws = XLSX.utils.aoa_to_sheet(aoa);

    // 4. Apply professional styling: colored headers, alternating zebra rows, borders, alignments, and number formats
    applyStyledExcelFormatting(ws, columns, dataRows);

    const wb = XLSX.utils.book_new();
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
      ? 'الاجهزة_المسلسلة_المتاحة'
      : 'الاجهزة_المتاحة';
    const filename = sanitizeArabicFilename(`${baseTitle}${categorySuffix}${brandSuffix}${branchSuffix}_${dateStr}.xlsx`);

    return {
      wb,
      workbook: wb,
      filename,
      rows: sourceRows,
      columns,
      totalUnits: calcUnits,
      totalModels: calcModels,
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

    // Route saving through centralized export storage service (Folder: MSS System Files/MSS Exel Sheets)
    const saveResult = await exportStorageService.saveExportedFile({
      exportType: 'mss_excel',
      filename,
      data: buffer,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      skipFallbackDownload: true,
    });

    if (!saveResult.success) {
      throw new Error(saveResult.error || 'تم إلغاء أو تعذر حفظ وتصدير ملف الإكسل.');
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
