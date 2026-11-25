import type { MSSDevice, MSSModel } from '../types/mssInventory.ts';
import type {
  PromotionalLaptopItem,
  PromotionalDisplayOptions,
  DeviceSelectionFilter,
  PromotionalExportOptions,
  PromotionalPdfExportResult,
} from '../types/mssPromotional.ts';
import { PROMOTIONAL_MAX_DEVICES_PER_PAGE } from '../types/mssPromotional.ts';
import { extractScreenDetails, formatScreenSummary, formatBrandAndModel, formatArabicExportFilename } from './mssWholesaleExportService.ts';
import { documentPrintService } from '../lib/documentPrintService.ts';
import { jsPDF } from 'jspdf';
import {
  PROMOTIONAL_HEADER_ICONS,
  PROMOTIONAL_BRAND_LOGOS,
  PROMOTIONAL_HEADER_ASSETS,
  getBrandLogoConfig,
} from '../assets/promotional/promotionalAssets.ts';
import { mssOperationalService } from './mssOperationalService.ts';
import { exportStorageService } from './exportStorageService.ts';
import { resolvePromotionalHeaderColors } from './promotionalThemes.ts';

export { PROMOTIONAL_MAX_DEVICES_PER_PAGE };

// Synchronous image element cache for HTML5 canvas rendering
const imageElementCache: Record<string, HTMLImageElement> = {};

function getCachedImage(src: string): HTMLImageElement | null {
  if (typeof window === 'undefined' || typeof Image === 'undefined') return null;
  if (!src) return null;
  if (imageElementCache[src]) return imageElementCache[src];
  const img = new Image();
  img.src = src;
  imageElementCache[src] = img;
  return img;
}

/**
 * Ensures an image asset is fully loaded in the browser cache before Canvas drawing or DOM capture,
 * preventing blank headers or race conditions immediately after switching header selection.
 */
export function ensurePromotionalImageLoaded(src: string): Promise<HTMLImageElement | null> {
  if (typeof window === 'undefined' || typeof Image === 'undefined') {
    return Promise.resolve(null);
  }
  const img = getCachedImage(src);
  if (!img) return Promise.resolve(null);
  if (img.complete && img.naturalWidth > 0) {
    return Promise.resolve(img);
  }
  return new Promise(resolve => {
    const onDone = () => {
      img.removeEventListener('load', onDone);
      img.removeEventListener('error', onDone);
      resolve(img);
    };
    img.addEventListener('load', onDone);
    img.addEventListener('error', onDone);
  });
}

/**
 * Arabic names for processor generations (1st through 14th).
 */
export const ARABIC_GENERATIONS: Record<number, string> = {
  1: 'الجيل الأول',
  2: 'الجيل الثاني',
  3: 'الجيل الثالث',
  4: 'الجيل الرابع',
  5: 'الجيل الخامس',
  6: 'الجيل السادس',
  7: 'الجيل السابع',
  8: 'الجيل الثامن',
  9: 'الجيل التاسع',
  10: 'الجيل العاشر',
  11: 'الجيل الحادي عشر',
  12: 'الجيل الثاني عشر',
  13: 'الجيل الثالث عشر',
  14: 'الجيل الرابع عشر',
};

/**
 * Extracts short processor family (e.g. i7, i5, Ryzen 7, M2).
 */
export function extractShortProcessor(processorStr?: string | null): string {
  if (!processorStr) return '---';
  const str = processorStr.trim();
  if (/i9/i.test(str)) return 'i9';
  if (/i7/i.test(str)) return 'i7';
  if (/i5/i.test(str)) return 'i5';
  if (/i3/i.test(str)) return 'i3';
  if (/Ryzen\s*9/i.test(str)) return 'Ryzen 9';
  if (/Ryzen\s*7/i.test(str)) return 'Ryzen 7';
  if (/Ryzen\s*5/i.test(str)) return 'Ryzen 5';
  if (/Ryzen\s*3/i.test(str)) return 'Ryzen 3';
  if (/Ultra\s*7/i.test(str)) return 'Ultra 7';
  if (/Ultra\s*5/i.test(str)) return 'Ultra 5';
  if (/\bM3\b/i.test(str)) return 'M3';
  if (/\bM2\b/i.test(str)) return 'M2';
  if (/\bM1\b/i.test(str)) return 'M1';

  // Fallback: take first two words
  const parts = str.split(/\s+/);
  return parts.slice(0, 2).join(' ') || str;
}

/**
 * Extracts generation string in clear Arabic (e.g. "الجيل العاشر", "الجيل الحادي عشر")
 * and short processor family from full processor string or specifications.
 */
export function extractGenerationAndShortProcessor(
  processorStr?: string | null,
  specifications?: any
): { generation: string; shortProcessor: string } {
  const pStr = (processorStr || '').trim();
  const specs = typeof specifications === 'object' && specifications !== null ? specifications : {};

  // Check explicit generation from specifications
  if (specs.generation && typeof specs.generation === 'string' && specs.generation.trim()) {
    const rawGen = specs.generation.trim();
    if (rawGen.startsWith('الجيل')) {
      return {
        generation: rawGen,
        shortProcessor: extractShortProcessor(pStr),
      };
    }
    const num = parseInt(rawGen.replace(/\D/g, ''), 10);
    if (!isNaN(num) && ARABIC_GENERATIONS[num]) {
      return {
        generation: ARABIC_GENERATIONS[num],
        shortProcessor: extractShortProcessor(pStr),
      };
    }
  }

  // Check if pStr contains explicit Arabic "الجيل"
  const arabicGenMatch = pStr.match(/الجيل\s+[\u0600-\u06FF]+/);
  if (arabicGenMatch) {
    return {
      generation: arabicGenMatch[0].trim(),
      shortProcessor: extractShortProcessor(pStr),
    };
  }

  // 1. Intel Core i3/i5/i7/i9 pattern:
  // e.g. "i5-8350U", "i7-10750H", "i5 11th", "i7-12700H", "Core i5-1145G7"
  const intelMatch = pStr.match(/i([3579])[- ](\d{4,5}[A-Z\d]*|\d{1,2}(?:th|st|nd|rd)?)/i);
  if (intelMatch) {
    const family = `i${intelMatch[1]}`;
    const code = intelMatch[2];

    if (/^\d{1,2}(?:th|st|nd|rd)?$/i.test(code)) {
      const gNum = parseInt(code, 10);
      return {
        generation: ARABIC_GENERATIONS[gNum] || `الجيل ${gNum}`,
        shortProcessor: family,
      };
    }

    const digitPrefix = code.match(/^\d+/)?.[0] || '';
    if (digitPrefix) {
      const twoDigit = parseInt(digitPrefix.slice(0, 2), 10);
      if (twoDigit >= 10 && twoDigit <= 15) {
        return {
          generation: ARABIC_GENERATIONS[twoDigit] || `الجيل ${twoDigit}`,
          shortProcessor: family,
        };
      }
      const firstDigit = parseInt(digitPrefix[0], 10);
      if (firstDigit >= 2 && firstDigit <= 9) {
        return {
          generation: ARABIC_GENERATIONS[firstDigit] || `الجيل ${firstDigit}`,
          shortProcessor: family,
        };
      }
    }
  }

  // Check simple "i5 8th", "i7 10th", "Core i5 11th"
  const genThMatch = pStr.match(/(\d{1,2})(?:th|st|nd|rd)\s*(?:Gen|generation)?/i);
  if (genThMatch) {
    const gNum = parseInt(genThMatch[1], 10);
    return {
      generation: ARABIC_GENERATIONS[gNum] || `الجيل ${gNum}`,
      shortProcessor: extractShortProcessor(pStr),
    };
  }

  // 2. Intel Core Ultra
  if (/Ultra\s*([579])/i.test(pStr)) {
    const m = pStr.match(/Ultra\s*([579])/i);
    return {
      generation: 'سلسلة Ultra',
      shortProcessor: `Ultra ${m?.[1] || '7'}`,
    };
  }

  // 3. AMD Ryzen (e.g. Ryzen 7 5800U, Ryzen 5 3500U)
  const ryzenMatch = pStr.match(/Ryzen\s*([3579])(?:\s*(\d)(\d{3}))?/i);
  if (ryzenMatch) {
    const tier = ryzenMatch[1];
    const genDigit = ryzenMatch[2];
    const shortProc = `Ryzen ${tier}`;
    if (genDigit) {
      const gNum = parseInt(genDigit, 10);
      return {
        generation: ARABIC_GENERATIONS[gNum] || `سلسلة ${gNum}000`,
        shortProcessor: shortProc,
      };
    }
    return {
      generation: 'سلسلة Ryzen',
      shortProcessor: shortProc,
    };
  }

  // 4. Apple Silicon (M1, M2, M3)
  const appleMatch = pStr.match(/\b(M[1234])(?:\s*(Pro|Max|Ultra))?\b/i);
  if (appleMatch) {
    const chip = appleMatch[1].toUpperCase();
    const sub = appleMatch[2] ? ` ${appleMatch[2]}` : '';
    const num = parseInt(chip.replace('M', ''), 10);
    return {
      generation: ARABIC_GENERATIONS[num] || 'سيليكون أبل',
      shortProcessor: `${chip}${sub}`,
    };
  }

  return {
    generation: '---',
    shortProcessor: extractShortProcessor(pStr),
  };
}

/**
 * Sanitizes a string for safe use as a Windows/Unix filename.
 * Replaces illegal characters (/ \ : * ? " < > |) with underscores.
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
 * Generates a meaningful Arabic filename based on the selected promotional content.
 * Automatically appends the actual generation date in format YYYY-MM-DD.
 * Examples:
 * - عروض_لابتوبات_Dell_2026-11-19.png
 * - تشكيلة_لابتوبات_متاحة_2026-11-19.pdf
 * - عرض_Apple_MacBook_Air_M2_2026-11-19.png
 */
export function generatePromotionalArabicFilename(
  items: PromotionalLaptopItem[],
  format: 'png' | 'pdf',
  pageNumber?: number,
  totalPages?: number
): string {
  let prefix = format === 'pdf' ? 'تقرير_دعائي_للأجهزة' : 'أجهزة_لابتوب_متاحة';

  if (items && items.length > 0) {
    const distinctBrands = Array.from(
      new Set(items.map(it => (it.brand || '').trim()).filter(b => b && b !== '---'))
    );

    if (distinctBrands.length === 1) {
      const brandName = distinctBrands[0];
      if (items.length === 1 && format !== 'pdf') {
        const modelPart = items[0].model_name ? `_${items[0].model_name}` : '';
        prefix = `عرض_${brandName}${modelPart}`;
      } else {
        prefix = `عروض_لابتوبات_${brandName}`;
      }
    } else if (distinctBrands.length > 1) {
      prefix = format === 'pdf' ? 'عروض_لابتوبات_مختارة_Compu_MSS' : 'أجهزة_Compu_MSS';
    }
  }

  const baseWithDate = formatArabicExportFilename(prefix, format);
  if (pageNumber !== undefined && pageNumber !== null && pageNumber > 0) {
    if (totalPages !== undefined && totalPages > 1) {
      const padPage = String(pageNumber).padStart(2, '0');
      const padTotal = String(totalPages).padStart(2, '0');
      const baseNoExt = baseWithDate.replace(/\.(png|pdf)$/i, '');
      return `${baseNoExt} - ${padPage} من ${padTotal}.${format}`;
    }
    return baseWithDate.replace(/\.(png|pdf)$/i, `_${pageNumber}.${format}`);
  }
  return baseWithDate;
}

/**
 * Sorts promotional items by selling price:
 * - 'asc': lowest to highest (من الأقل للأعلى سعراً)
 * - 'desc': highest to lowest (من الأعلى للأقل سعراً)
 * Uses Brand and Model as a stable secondary tie-breaker.
 * Maintains correct sort order even when price badge is hidden.
 */
export function sortPromotionalItems(
  items: PromotionalLaptopItem[],
  order: 'asc' | 'desc' = 'asc'
): PromotionalLaptopItem[] {
  return [...items].sort((a, b) => {
    const priceA = Number(a.price) || 0;
    const priceB = Number(b.price) || 0;
    if (priceA !== priceB) {
      return order === 'desc' ? priceB - priceA : priceA - priceB;
    }
    const brandCompare = (a.brand || '').localeCompare(b.brand || '', 'ar');
    if (brandCompare !== 0) return brandCompare;
    return (a.model_name || '').localeCompare(b.model_name || '', 'ar');
  });
}

/**
 * Transforms inventory devices and catalog models into clean PromotionalLaptopItems.
 * Aggregates available stock by model to showcase clean cards suitable for social media ads.
 */
export function preparePromotionalItems(
  devices: MSSDevice[],
  models?: MSSModel[]
): PromotionalLaptopItem[] {
  const modelMap = new Map((models || []).map(m => [m.id, m]));

  // Strictly include only available devices
  const availableDevices = (devices || []).filter(d => d.status === 'AVAILABLE');

  // Group by model_id (or fallback key brand_model)
  const grouped = new Map<string, {
    modelId: string;
    brand: string;
    modelName: string;
    model?: MSSModel;
    price: number;
    totalQuantity: number;
    locations: Set<string>;
    conditions: Set<string>;
    devices: MSSDevice[];
  }>();

  for (const d of availableDevices) {
    const m = d.model || modelMap.get(d.model_id);
    const brand = (d.brand || m?.brand || '---').trim();
    const modelName = (d.model_name || m?.model_name || '---').trim();
    const groupKey = d.model_id || `${brand}_${modelName}`;

    const existing = grouped.get(groupKey);
    const qty = d.is_serialized ? 1 : Math.max(1, d.quantity || 1);
    const devicePrice = Number(d.list_price) || Number(m?.default_list_price) || 0;

    if (!existing) {
      grouped.set(groupKey, {
        modelId: d.model_id,
        brand,
        modelName,
        model: m,
        price: devicePrice,
        totalQuantity: qty,
        locations: new Set(d.stock_location ? [d.stock_location] : []),
        conditions: new Set(d.physical_condition ? [d.physical_condition] : []),
        devices: [d],
      });
    } else {
      existing.totalQuantity += qty;
      if (d.stock_location) existing.locations.add(d.stock_location);
      if (d.physical_condition) existing.conditions.add(d.physical_condition);
      existing.devices.push(d);
      // Keep highest list price if variance
      if (devicePrice > existing.price) {
        existing.price = devicePrice;
      }
    }
  }

  return Array.from(grouped.values()).map((g, index) => {
    const m = g.model;
    const screenText = formatScreenSummary(m?.screen_size, m?.specifications);
    const locDisplay = g.locations.size > 0 ? Array.from(g.locations).join(' و ') : '';
    const condDisplay = g.conditions.size > 0 ? Array.from(g.conditions).join(' / ') : 'ممتازة';
    const genInfo = extractGenerationAndShortProcessor(m?.processor, m?.specifications);

    return {
      id: `promo-model-${g.modelId || index}-${Date.now().toString(36)}`,
      original_device_id: g.devices[0]?.id,
      original_model_id: g.modelId,
      brand: g.brand,
      model_name: g.modelName,
      generation: genInfo.generation,
      processor: genInfo.shortProcessor || m?.processor || '---',
      ram: m?.ram || '---',
      storage: m?.storage || '---',
      gpu: m?.gpu || '---',
      screen: screenText,
      price: g.price,
      quantity: g.totalQuantity,
      available_quantity: g.totalQuantity,
      stock_location: locDisplay,
      physical_condition: condDisplay,
    };
  });
}

/**
 * Filters promotional items based on Brand, Model, Price Range, and search query.
 */
export function filterPromotionalItems(
  items: PromotionalLaptopItem[],
  filter: DeviceSelectionFilter
): PromotionalLaptopItem[] {
  return items.filter(item => {
    const itemBrand = (item.brand || '').trim().toLowerCase();
    const itemModelId = (item.original_model_id || '').trim().toLowerCase();
    const itemModelName = (item.model_name || '').trim().toLowerCase();

    // 1. Single Brand filter
    if (filter.brand && filter.brand !== 'ALL') {
      if (itemBrand !== filter.brand.trim().toLowerCase()) {
        return false;
      }
    }

    // 2. Multi-Brand filter (case-insensitive & trimmed, OR logic)
    if (filter.selectedBrands && filter.selectedBrands.length > 0) {
      const targetBrands = filter.selectedBrands.map(b => b.trim().toLowerCase()).filter(Boolean);
      if (targetBrands.length > 0 && !targetBrands.includes(itemBrand)) {
        return false;
      }
    }

    // 3. Model filter (matches model_id or model_name, case-insensitive, OR logic)
    if (filter.selectedModelIds && filter.selectedModelIds.length > 0) {
      const targetModelIds = new Set(filter.selectedModelIds.map(id => id.trim().toLowerCase()).filter(Boolean));
      if (targetModelIds.size > 0 && !targetModelIds.has(itemModelId) && !targetModelIds.has(itemModelName)) {
        return false;
      }
    }

    // 4. Price range: Min price
    if (filter.minPrice !== undefined && filter.minPrice !== null && !isNaN(filter.minPrice) && filter.minPrice > 0) {
      if ((item.price || 0) < filter.minPrice) {
        return false;
      }
    }

    // 4. Price range: Max price
    if (filter.maxPrice !== undefined && filter.maxPrice !== null && !isNaN(filter.maxPrice) && filter.maxPrice > 0) {
      if ((item.price || 0) > filter.maxPrice) {
        return false;
      }
    }

    // 5. Search query
    if (filter.searchQuery && filter.searchQuery.trim()) {
      const q = filter.searchQuery.toLowerCase().trim();
      const combined = `${item.brand} ${item.model_name} ${item.processor} ${item.generation || ''} ${item.gpu} ${item.ram} ${item.storage} ${item.screen}`.toLowerCase();
      if (!combined.includes(q)) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Creates a mock canvas for non-browser/SSR/Node environments.
 */
function createFallbackCanvas(width = 1000, height = 1000): HTMLCanvasElement {
  const noop = () => { };
  const grad = { addColorStop: noop };
  const mockCtx = new Proxy(
    {
      measureText: (text: string) => ({ width: (text || '').length * 8 }),
      createLinearGradient: () => grad,
      createRadialGradient: () => grad,
      setLineDash: noop,
      getLineDash: () => [],
    },
    {
      get(target, prop) {
        if (prop in target) {
          return (target as any)[prop];
        }
        return noop;
      },
      set() {
        return true;
      },
    }
  );

  return {
    width,
    height,
    getContext: () => mockCtx,
    toDataURL: () =>
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  } as any;
}

/**
 * Draws rounded rectangle helper for HTML5 Canvas.
 */
function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/**
 * Draws an angled laptop mockup on the left or right of the header.
 */
function drawAngledLaptop(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  isRightSide: boolean
) {
  ctx.save();
  ctx.translate(x, y);
  if (isRightSide) {
    ctx.scale(-scale, scale);
  } else {
    ctx.scale(scale, scale);
  }

  // Shadow under laptop
  ctx.beginPath();
  ctx.ellipse(90, 140, 110, 18, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.fill();

  // Screen Lid (Angled trapezoid)
  ctx.beginPath();
  ctx.moveTo(35, 10);
  ctx.lineTo(165, 20);
  ctx.lineTo(145, 115);
  ctx.lineTo(25, 105);
  ctx.closePath();
  ctx.fillStyle = '#0f172a';
  ctx.fill();
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Screen display area (Wallpaper)
  ctx.beginPath();
  ctx.moveTo(40, 16);
  ctx.lineTo(160, 25);
  ctx.lineTo(142, 108);
  ctx.lineTo(31, 100);
  ctx.closePath();
  ctx.save();
  ctx.clip();

  if (!isRightSide) {
    // Left Screen: Scenic Mountain/Lake wallpaper
    const skyGrad = ctx.createLinearGradient(40, 16, 142, 108);
    skyGrad.addColorStop(0, '#0284c7');
    skyGrad.addColorStop(0.5, '#38bdf8');
    skyGrad.addColorStop(1, '#0f766e');
    ctx.fillStyle = skyGrad;
    ctx.fill();

    // Mountain silhouettes
    ctx.beginPath();
    ctx.moveTo(30, 85);
    ctx.lineTo(75, 45);
    ctx.lineTo(105, 75);
    ctx.lineTo(135, 50);
    ctx.lineTo(160, 85);
    ctx.lineTo(160, 110);
    ctx.lineTo(30, 110);
    ctx.closePath();
    ctx.fillStyle = '#1e293b';
    ctx.fill();

    // Water reflection
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.fillRect(30, 85, 130, 25);
  } else {
    // Right Screen: Windows 11 Blue Bloom wallpaper
    const winGrad = ctx.createRadialGradient(95, 65, 5, 95, 65, 70);
    winGrad.addColorStop(0, '#60a5fa');
    winGrad.addColorStop(0.4, '#2563eb');
    winGrad.addColorStop(0.8, '#1e3a8a');
    winGrad.addColorStop(1, '#090d16');
    ctx.fillStyle = winGrad;
    ctx.fill();

    // Curved floral petals of Windows 11 bloom
    ctx.beginPath();
    ctx.ellipse(95, 65, 25, 38, Math.PI / 4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(147, 197, 253, 0.45)';
    ctx.fill();

    ctx.beginPath();
    ctx.ellipse(90, 70, 32, 22, -Math.PI / 6, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(96, 165, 250, 0.55)';
    ctx.fill();
  }
  ctx.restore();

  // Laptop Base (Keyboard area angled downward)
  ctx.beginPath();
  ctx.moveTo(25, 105);
  ctx.lineTo(145, 115);
  ctx.lineTo(185, 138);
  ctx.lineTo(5, 130);
  ctx.closePath();
  const baseGrad = ctx.createLinearGradient(5, 130, 185, 115);
  baseGrad.addColorStop(0, '#cbd5e1');
  baseGrad.addColorStop(0.5, '#e2e8f0');
  baseGrad.addColorStop(1, '#94a3b8');
  ctx.fillStyle = baseGrad;
  ctx.fill();
  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Keyboard grid impression
  ctx.beginPath();
  ctx.moveTo(35, 110);
  ctx.lineTo(135, 118);
  ctx.lineTo(155, 128);
  ctx.lineTo(20, 123);
  ctx.closePath();
  ctx.fillStyle = '#334155';
  ctx.fill();

  // Touchpad impression
  ctx.beginPath();
  ctx.moveTo(75, 126);
  ctx.lineTo(105, 128);
  ctx.lineTo(102, 133);
  ctx.lineTo(72, 131);
  ctx.closePath();
  ctx.fillStyle = '#64748b';
  ctx.fill();

  ctx.restore();
}

/**
 * Draws brand badge icon and text inside a table cell.
 * Uses authentic local brand logos with exact Flaticon 747 white Apple logo.
 */
function drawBrandBadge(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  brand: string
) {
  const brandConfig = getBrandLogoConfig(brand);

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  if (brandConfig) {
    const img = getCachedImage(brandConfig.dataUri);

    // 1. Apple: dark circular badge with white Flaticon 747 Apple logo
    if (brandConfig.key === 'apple') {
      ctx.beginPath();
      ctx.arc(x, y, 14, 0, Math.PI * 2);
      ctx.fillStyle = '#0f172a';
      ctx.fill();

      if (img && img.complete && img.naturalWidth > 0) {
        ctx.drawImage(img, x - 8, y - 8, 16, 16);
      } else {
        ctx.font = 'bold 11px "Segoe UI", Arial, sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.fillText('Apple', x, y);
      }
    } else if (brandConfig.key === 'lenovo') {
      // 2. Lenovo: Official red rectangular badge with crisp white wordmark
      if (img && img.complete && img.naturalWidth > 0) {
        const targetW = 60;
        const targetH = 20;
        ctx.drawImage(img, x - targetW / 2, y - targetH / 2, targetW, targetH);
      } else {
        drawRoundedRect(ctx, x - 30, y - 10, 60, 20, 3);
        ctx.fillStyle = '#E2231A';
        ctx.fill();
        ctx.font = 'bold 11px "Segoe UI", Arial, sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.fillText('lenovo', x, y);
      }
    } else if (['dell', 'hp', 'huawei', 'lg', 'razer', 'alienware', 'google', 'microsoft'].includes(brandConfig.key)) {
      // 3. Circular / emblem-shaped logos
      if (img && img.complete && img.naturalWidth > 0) {
        ctx.drawImage(img, x - 13, y - 13, 26, 26);
      } else {
        ctx.font = 'bold 10px "Segoe UI", Arial, sans-serif';
        ctx.fillStyle = '#0f172a';
        ctx.fillText(brandConfig.name, x, y);
      }
    } else {
      // 4. Wordmark logos: Asus, Acer, MSI, Samsung, Toshiba, Sony, Fujitsu
      if (img && img.complete && img.naturalWidth > 0) {
        const aspect = (img.naturalWidth || 60) / (img.naturalHeight || 20);
        const targetH = 18;
        const targetW = Math.min(68, targetH * aspect);
        ctx.drawImage(img, x - targetW / 2, y - targetH / 2, targetW, targetH);
      } else {
        ctx.font = 'bold 11px "Segoe UI", Arial, sans-serif';
        ctx.fillStyle = '#0f172a';
        ctx.fillText(brandConfig.name, x, y);
      }
    }
  } else {
    // Generic fallback for custom test strings
    const b = (brand || '').trim();
    drawRoundedRect(ctx, x - 24, y - 10, 48, 20, 4);
    ctx.fillStyle = '#e2e8f0';
    ctx.fill();
    ctx.font = 'bold 11px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = '#1e293b';
    ctx.fillText(b.slice(0, 8), x, y + 1);
  }

  ctx.restore();
}

/**
 * Draws text measured against a maximum width, truncating with ellipsis if it exceeds.
 * Prevents text overlapping across adjacent table columns in HTML Canvas rendering.
 */
function drawFittedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number
): void {
  if (!text) return;
  const metrics = ctx.measureText(text);
  if (metrics.width <= maxWidth) {
    ctx.fillText(text, x, y);
    return;
  }
  let truncated = text;
  while (truncated.length > 2 && ctx.measureText(truncated + '...').width > maxWidth) {
    truncated = truncated.slice(0, -1);
  }
  ctx.fillText(truncated + '...', x, y);
}

/**
 * Renders the promotional social media banner onto an HTML5 Canvas matching the reference ad.
 * Layout:
 * - Royal blue header with 2 angled laptops, "متوفر بفضل الله", "أعلى جودة بأقل سعر" with yellow swoosh
 * - Structured table with columns: الماركة, الموديل, المعالج, الجيل, الرام, الهارد, الشاشة, كارت الشاشة, السعر, الكمية
 * - Alternating white/light-blue rows with brand badges and color-coded GPU
 * - Automatic pagination (12-14 items per page)
 */
export function renderPromotionalToCanvas(
  items: PromotionalLaptopItem[],
  options: PromotionalDisplayOptions,
  canvas: HTMLCanvasElement
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const width = 1200;
  const itemsPerPage = options.itemsPerPage && options.itemsPerPage > 0 ? options.itemsPerPage : PROMOTIONAL_MAX_DEVICES_PER_PAGE;
  const totalPages = Math.max(1, Math.ceil(items.length / itemsPerPage));
  const pageIndex = Math.min(Math.max(0, options.pageIndex || 0), totalPages - 1);
  const pageItems = items.slice(pageIndex * itemsPerPage, (pageIndex + 1) * itemsPerPage);

  const rowCount = Math.max(pageItems.length, 1);
  const maxRows = itemsPerPage;
  const rowHeight = 76;
  const tableHeaderHeight = 70;
  const footerSectionHeight = 90;

  const headerColors = resolvePromotionalHeaderColors(options.themeId, options.headerImageSrc);

  // Resolve static promotional header banner and compute proportional full-width height (zero side gaps)
  const bannerSrc = options.headerImageSrc || PROMOTIONAL_HEADER_ASSETS.banner;
  const bannerImg = getCachedImage(bannerSrc);
  const imgAspect =
    bannerImg && bannerImg.complete && bannerImg.naturalWidth > 0 && bannerImg.naturalHeight > 0
      ? bannerImg.naturalWidth / bannerImg.naturalHeight
      : 1024 / 317;
  const headerSectionHeight = Math.round(width / imgAspect);

  // Use uniform canvas height based on maxRows so every page has identical dimensions across PNG and PDF
  const totalHeight = headerSectionHeight + tableHeaderHeight + maxRows * rowHeight + footerSectionHeight + 40;

  canvas.width = width;
  canvas.height = totalHeight;

  // 1. Overall Background: Clean white / deep border container
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, totalHeight);

  // 2. Static Commercial Header Banner Section (100% edge-to-edge width, proportional height)
  if (bannerImg && bannerImg.complete && bannerImg.naturalWidth > 0) {
    ctx.drawImage(bannerImg, 0, 0, width, headerSectionHeight);
  } else {
    ctx.fillStyle = '#040e24';
    ctx.fillRect(0, 0, width, headerSectionHeight);
  }

  // 3. Structured Specifications Table
  // Table margins: width 1140px, centered (left = 30)
  const tableX = 30;
  const tableY = headerSectionHeight + 15;
  const tableW = 1140;

  // Define Columns in LTR orientation from left-to-right on canvas:
  // Leftmost is Brand, Rightmost is Price (or Quantity / GPU)
  const showPrice = options.showPrice;
  const showQty = options.showQuantity;

  let colWidths: { id: string; label: string; icon: string; width: number }[] = [];

  if (showPrice && showQty) {
    colWidths = [
      { id: 'brand', label: 'الماركة', icon: 'tag', width: 90 },
      { id: 'model', label: 'الموديل', icon: 'laptop', width: 185 },
      { id: 'processor', label: 'المعالج', icon: 'cpu', width: 90 },
      { id: 'generation', label: 'الجيل', icon: 'calendar', width: 125 },
      { id: 'ram', label: 'الرام', icon: 'ram', width: 80 },
      { id: 'storage', label: 'الهارد', icon: 'hdd', width: 115 },
      { id: 'screen', label: 'الشاشة', icon: 'screen', width: 115 },
      { id: 'gpu', label: 'كارت الشاشة', icon: 'gpu', width: 125 },
      { id: 'quantity', label: 'الكمية', icon: 'box', width: 75 },
      { id: 'price', label: 'السعر (جنيه)', icon: 'price', width: 140 },
    ];
  } else if (showPrice && !showQty) {
    colWidths = [
      { id: 'brand', label: 'الماركة', icon: 'tag', width: 95 },
      { id: 'model', label: 'الموديل', icon: 'laptop', width: 200 },
      { id: 'processor', label: 'المعالج', icon: 'cpu', width: 95 },
      { id: 'generation', label: 'الجيل', icon: 'calendar', width: 135 },
      { id: 'ram', label: 'الرام', icon: 'ram', width: 85 },
      { id: 'storage', label: 'الهارد', icon: 'hdd', width: 125 },
      { id: 'screen', label: 'الشاشة', icon: 'screen', width: 125 },
      { id: 'gpu', label: 'كارت الشاشة', icon: 'gpu', width: 135 },
      { id: 'price', label: 'السعر (جنيه)', icon: 'price', width: 145 },
    ];
  } else if (!showPrice && showQty) {
    colWidths = [
      { id: 'brand', label: 'الماركة', icon: 'tag', width: 100 },
      { id: 'model', label: 'الموديل', icon: 'laptop', width: 200 },
      { id: 'processor', label: 'المعالج', icon: 'cpu', width: 105 },
      { id: 'generation', label: 'الجيل', icon: 'calendar', width: 145 },
      { id: 'ram', label: 'الرام', icon: 'ram', width: 95 },
      { id: 'storage', label: 'الهارد', icon: 'hdd', width: 135 },
      { id: 'screen', label: 'الشاشة', icon: 'screen', width: 135 },
      { id: 'gpu', label: 'كارت الشاشة', icon: 'gpu', width: 145 },
      { id: 'quantity', label: 'الكمية', icon: 'box', width: 80 },
    ];
  } else {
    colWidths = [
      { id: 'brand', label: 'الماركة', icon: 'tag', width: 105 },
      { id: 'model', label: 'الموديل', icon: 'laptop', width: 240 },
      { id: 'processor', label: 'المعالج', icon: 'cpu', width: 110 },
      { id: 'generation', label: 'الجيل', icon: 'calendar', width: 155 },
      { id: 'ram', label: 'الرام', icon: 'ram', width: 100 },
      { id: 'storage', label: 'الهارد', icon: 'hdd', width: 140 },
      { id: 'screen', label: 'الشاشة', icon: 'screen', width: 140 },
      { id: 'gpu', label: 'كارت الشاشة', icon: 'gpu', width: 150 },
    ];
  }

  // Draw Table Header Bar (conditional gradient for SOUQ/Makkah; exact original solid for Compu MSS)
  drawRoundedRect(ctx, tableX, tableY, tableW, tableHeaderHeight, 8);
  if (headerColors.gradientStops && typeof ctx.createLinearGradient === 'function') {
    const headerGradient = ctx.createLinearGradient(tableX, tableY, tableX + tableW, tableY);
    headerColors.gradientStops.forEach(stop => {
      headerGradient.addColorStop(stop.offset, stop.color);
    });
    ctx.fillStyle = headerGradient;
  } else {
    ctx.fillStyle = headerColors.tableHeaderBg;
  }
  ctx.fill();
  ctx.strokeStyle = headerColors.tableHeaderStroke;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Flat bottom corners for header
  ctx.fillRect(tableX, tableY + tableHeaderHeight - 8, tableW, 8);

  // Draw Header Columns and Icons
  let curX = tableX;
  ctx.save();
  ctx.textAlign = 'center';

  colWidths.forEach((col, cIdx) => {
    const colCenterX = curX + col.width / 2;

    // Price column background highlight
    if (col.id === 'price') {
      ctx.fillStyle = headerColors.tableHeaderPriceOverlay || headerColors.tableHeaderPriceBg;
      ctx.fillRect(curX, tableY, col.width, tableHeaderHeight);
    }

    // Flaticon table header icons
    const headerIconMap: Record<string, string> = {
      brand: PROMOTIONAL_HEADER_ICONS.brand,
      model: PROMOTIONAL_HEADER_ICONS.model,
      processor: PROMOTIONAL_HEADER_ICONS.processor,
      generation: PROMOTIONAL_HEADER_ICONS.generation,
      ram: PROMOTIONAL_HEADER_ICONS.ram,
      storage: PROMOTIONAL_HEADER_ICONS.storage,
      screen: PROMOTIONAL_HEADER_ICONS.screen,
      gpu: PROMOTIONAL_HEADER_ICONS.gpu,
      price: PROMOTIONAL_HEADER_ICONS.price,
      quantity: PROMOTIONAL_HEADER_ICONS.quantity,
    };

    const iconUri = headerIconMap[col.id];
    let iconDrawn = false;
    if (iconUri) {
      const iconImg = getCachedImage(iconUri);
      if (iconImg && iconImg.complete && iconImg.naturalWidth > 0) {
        ctx.drawImage(iconImg, colCenterX - 9, tableY + 8, 18, 18);
        iconDrawn = true;
      }
    }

    if (!iconDrawn) {
      ctx.strokeStyle = headerColors.headerFallbackAccent;
      ctx.fillStyle = headerColors.headerFallbackAccent;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(colCenterX, tableY + 17, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Header label text (Arabic with proper RTL text rendering)
    ctx.font = 'bold 17px "Segoe UI", Cairo, Arial, sans-serif';
    ctx.fillStyle = col.id === 'price' ? headerColors.tableHeaderPriceText : headerColors.tableHeaderText;
    ctx.direction = 'rtl';
    ctx.fillText(col.label, colCenterX, tableY + 46);

    // Column border divider in header (between columns)
    if (cIdx < colWidths.length - 1) {
      ctx.strokeStyle = headerColors.tableHeaderDivider;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(curX + col.width, tableY + 8);
      ctx.lineTo(curX + col.width, tableY + tableHeaderHeight - 8);
      ctx.stroke();
    }

    curX += col.width;
  });
  ctx.restore();

  // Draw Table Rows
  pageItems.forEach((item, rIdx) => {
    const rowY = tableY + tableHeaderHeight + rIdx * rowHeight;
    const isEven = rIdx % 2 === 0;

    // Row Background (Alternating white and soft sky-blue tint)
    ctx.fillStyle = isEven ? '#ffffff' : '#f8faff';
    ctx.fillRect(tableX, rowY, tableW, rowHeight);

    // Row bottom border
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(tableX, rowY + rowHeight);
    ctx.lineTo(tableX + tableW, rowY + rowHeight);
    ctx.stroke();

    // Render cells in row
    let cellX = tableX;
    colWidths.forEach((col, cIdx) => {
      const cellCenterX = cellX + col.width / 2;
      const cellCenterY = rowY + rowHeight / 2;

      // Vertical column divider between cells
      if (cIdx < colWidths.length - 1) {
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cellX + col.width, rowY);
        ctx.lineTo(cellX + col.width, rowY + rowHeight);
        ctx.stroke();
      }

      ctx.save();
      ctx.textBaseline = 'middle';

      if (col.id === 'brand') {
        ctx.textAlign = 'center';
        drawBrandBadge(ctx, cellCenterX, cellCenterY, item.brand);
      } else if (col.id === 'model') {
        ctx.textAlign = 'center';
        ctx.direction = 'ltr';
        ctx.font = 'bold 24px "Segoe UI", Cairo, Arial, sans-serif';
        ctx.fillStyle = '#0f172a';
        drawFittedText(ctx, item.model_name || '---', cellCenterX, cellCenterY, col.width - 16);
      } else if (col.id === 'processor') {
        ctx.textAlign = 'center';
        ctx.direction = 'ltr';
        ctx.font = 'bold 24px "Segoe UI", Cairo, Arial, sans-serif';
        ctx.fillStyle = '#1e293b';
        drawFittedText(ctx, item.processor || '---', cellCenterX, cellCenterY, col.width - 8);
      } else if (col.id === 'generation') {
        ctx.textAlign = 'center';
        const genText = item.generation || '---';
        const hasArabic = /[\u0600-\u06FF]/.test(genText);
        ctx.direction = hasArabic ? 'rtl' : 'ltr';
        ctx.font = 'bold 23px "Segoe UI", Cairo, Arial, sans-serif';
        ctx.fillStyle = '#334155';
        drawFittedText(ctx, genText, cellCenterX, cellCenterY, col.width - 8);
      } else if (col.id === 'ram') {
        ctx.textAlign = 'center';
        ctx.direction = 'ltr';
        ctx.font = 'bold 24px "Segoe UI", Cairo, Arial, sans-serif';
        ctx.fillStyle = '#1e293b';
        drawFittedText(ctx, item.ram || '---', cellCenterX, cellCenterY, col.width - 8);
      } else if (col.id === 'storage') {
        ctx.textAlign = 'center';
        ctx.direction = 'ltr';
        ctx.font = 'bold 23px "Segoe UI", Cairo, Arial, sans-serif';
        ctx.fillStyle = '#1e293b';
        drawFittedText(ctx, item.storage || '---', cellCenterX, cellCenterY, col.width - 10);
      } else if (col.id === 'screen') {
        ctx.textAlign = 'center';
        ctx.direction = 'ltr';
        ctx.font = 'bold 22px "Segoe UI", Cairo, Arial, sans-serif';
        ctx.fillStyle = '#1e293b';
        drawFittedText(ctx, item.screen || '---', cellCenterX, cellCenterY, col.width - 10);
      } else if (col.id === 'gpu') {
        ctx.textAlign = 'center';
        ctx.direction = 'ltr';
        const gpuUpper = (item.gpu || '').toUpperCase();
        if (gpuUpper.includes('NVIDIA') || gpuUpper.includes('RTX') || gpuUpper.includes('GTX')) {
          ctx.fillStyle = '#16a34a'; // NVIDIA Green
        } else if (gpuUpper.includes('AMD') || gpuUpper.includes('RADEON')) {
          ctx.fillStyle = '#dc2626'; // AMD Red
        } else if (gpuUpper.includes('INTEL')) {
          ctx.fillStyle = '#2563eb'; // Intel Blue
        } else {
          ctx.fillStyle = '#475569';
        }
        ctx.font = 'bold 23px "Segoe UI", Cairo, Arial, sans-serif';
        drawFittedText(ctx, item.gpu || '---', cellCenterX, cellCenterY, col.width - 10);
      } else if (col.id === 'quantity') {
        ctx.textAlign = 'center';
        ctx.direction = 'ltr';
        ctx.font = 'bold 24px "Segoe UI", Cairo, Arial, sans-serif';
        ctx.fillStyle = '#0f172a';
        ctx.fillText(String(item.quantity || 1), cellCenterX, cellCenterY);
      } else if (col.id === 'price') {
        ctx.textAlign = 'center';
        ctx.direction = 'ltr';
        const priceNum = Number(item.price) || 0;
        const priceFormatted = priceNum > 0 ? priceNum.toLocaleString('en-US') : '---';
        ctx.font = 'bold 27px "Segoe UI", Arial, sans-serif';
        ctx.fillStyle = '#0a2558'; // Bold dark blue numbers
        drawFittedText(ctx, priceFormatted, cellCenterX, cellCenterY, col.width - 10);
      }

      ctx.restore();
      cellX += col.width;
    });
  });

  // Outer border of table
  drawRoundedRect(ctx, tableX, tableY, tableW, tableHeaderHeight + rowCount * rowHeight, 8);
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // 4. Footer Section: Store branding and pagination
  const footY = totalHeight - footerSectionHeight + 20;

  ctx.save();
  ctx.textAlign = 'center';
  ctx.direction = 'rtl';

  // Multi-page badge (e.g. صفحة 1 من 2)
  if (totalPages > 1) {
    const pageText = `صفحة ${pageIndex + 1} من ${totalPages}`;
    ctx.font = 'bold 14px "Segoe UI", Cairo, Arial, sans-serif';
    const pw = ctx.measureText(pageText).width + 28;
    drawRoundedRect(ctx, (width - pw) / 2, footY - 14, pw, 26, 13);
    ctx.fillStyle = '#0c3582';
    ctx.fill();
    ctx.fillStyle = '#facc15';
    ctx.fillText(pageText, width / 2, footY + 4);
  }

  // Slogan & Info
  ctx.font = 'bold 17px "Segoe UI", Cairo, Arial, sans-serif';
  ctx.fillStyle = '#0f172a';
  ctx.fillText('', width / 2, footY + 34);

  ctx.font = '14px "Segoe UI", Cairo, Arial, sans-serif';
  ctx.fillStyle = '#64748b';
  const activeBranches = mssOperationalService.getActiveLocationNamesSync();
  const branchesText = activeBranches.length > 0 ? activeBranches.join(' • ') : '';
  if (branchesText) {
    ctx.fillText(`${branchesText}`, width / 2, footY + 56);
  }
  ctx.restore();
}

/**
 * Downloads the rendered canvas or data URL as a high quality PNG file.
 * Automatically ensures the filename has the export date _YYYY-MM-DD.png without duplication.
 * Routes directly to custom export folder (MSS System Files/MSS Images) if configured.
 */
export async function exportPromotionalAsPng(
  canvasOrDataUrl: HTMLCanvasElement | string,
  filename: string,
  exportType: import('./exportStorageService').ExportType = 'mss_images'
): Promise<any> {
  const finalFilename = formatArabicExportFilename(filename, 'png');
  const dataUrl = typeof canvasOrDataUrl === 'string'
    ? canvasOrDataUrl
    : canvasOrDataUrl.toDataURL('image/png', 1.0);

  const res = await exportStorageService.saveExportedFile({
    exportType,
    filename: finalFilename,
    data: dataUrl,
    mimeType: 'image/png',
  });

  if (!res.success) {
    throw new Error(res.error || 'تم إلغاء أو تعذر حفظ الصورة الترويجية.');
  }

  return res;
}

/**
 * Exports the promotional poster as a pristine, uncropped multi-page PDF document.
 * 
 * Key guarantees:
 * 1. Each page represents one complete promotional design with identical dimensions.
 * 2. Full visual fidelity: complete commercial header, brand logos, dual laptop renders,
 *    structured specifications table, and footer.
 * 3. Zero cropping, clipping, or stretching: perfectly scaled edge-to-edge.
 * 4. Automatic multi-page pagination for datasets exceeding PROMOTIONAL_MAX_DEVICES_PER_PAGE.
 * 5. Works seamlessly in browser, Tauri desktop, and Node.js test environments.
 */
export async function exportPromotionalAsPdf(
  itemsOrElementId: PromotionalLaptopItem[] | string,
  filenameOrOptions?: string | PromotionalExportOptions,
  legacyFilename?: string
): Promise<PromotionalPdfExportResult> {
  // Resolve arguments: supports both (items, options) and legacy (elementId, filename)
  let items: PromotionalLaptopItem[] = [];
  let options: PromotionalExportOptions = { showPrice: true, showQuantity: false };
  let customFilename = '';

  if (Array.isArray(itemsOrElementId)) {
    items = itemsOrElementId;
    if (typeof filenameOrOptions === 'string') {
      customFilename = filenameOrOptions;
    } else if (filenameOrOptions && typeof filenameOrOptions === 'object') {
      options = { ...options, ...filenameOrOptions };
      customFilename = filenameOrOptions.filename || '';
    }
  } else {
    customFilename = typeof filenameOrOptions === 'string' ? filenameOrOptions : legacyFilename || 'promotional.pdf';
  }

  const itemsPerPage = options.itemsPerPage && options.itemsPerPage > 0
    ? options.itemsPerPage
    : PROMOTIONAL_MAX_DEVICES_PER_PAGE;
  const totalPages = Math.max(1, Math.ceil(items.length / itemsPerPage));

  const finalPdfName = formatArabicExportFilename(
    customFilename || generatePromotionalArabicFilename(items, 'pdf'),
    'pdf'
  );

  // Standard uniform poster dimensions: 1000px width x 1000px height (uniform 1:1 square aspect ratio)
  const PAGE_WIDTH = 1000;
  const PAGE_HEIGHT = 1000;

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'px',
    format: [PAGE_WIDTH, PAGE_HEIGHT],
    hotfixes: ['px_scaling'],
  });

  // Ensure the selected header image is loaded before rendering any PDF page
  await ensurePromotionalImageLoaded(options.headerImageSrc || PROMOTIONAL_HEADER_ASSETS.banner);

  // Batch render and capture loop
  for (let p = 0; p < totalPages; p++) {
    if (options.onProgress) {
      options.onProgress(p + 1, totalPages);
    }

    let pageDataUrl = options.pageDataUrls && options.pageDataUrls[p];

    if (!pageDataUrl) {
      // 1. Try DOM element capture if in browser environment
      if (typeof document !== 'undefined') {
        const domId = typeof itemsOrElementId === 'string' && totalPages === 1
          ? itemsOrElementId
          : `mss-promotional-page-container-${p}`;
        const pageEl = document.getElementById(domId) ||
          (p === 0 ? document.getElementById('mss-promotional-poster-container') : null);

        if (pageEl) {
          try {
            if (document.fonts && document.fonts.ready) {
              await document.fonts.ready;
            }
            const imgs = pageEl.querySelectorAll('img');
            await Promise.all(
              Array.from(imgs).map(img => {
                if (img.complete) return Promise.resolve();
                return new Promise(resolve => {
                  img.onload = resolve;
                  img.onerror = resolve;
                });
              })
            );
            const { toPng } = await import('html-to-image');
            pageDataUrl = await toPng(pageEl, {
              quality: 1.0,
              pixelRatio: 2,
              backgroundColor: '#ffffff',
              cacheBust: true,
            });
          } catch (e) {
            console.warn(`DOM capture for PDF page ${p + 1} failed, using canvas fallback:`, e);
          }
        }
      }

      // 2. Pure Canvas fallback (works in Node.js and headless/fallback environments)
      if (!pageDataUrl) {
        let canvas: HTMLCanvasElement | null = null;
        if (typeof document !== 'undefined' && document.createElement) {
          canvas = document.createElement('canvas');
        } else {
          canvas = createFallbackCanvas(PAGE_WIDTH, PAGE_HEIGHT);
        }

        if (canvas) {
          renderPromotionalToCanvas(
            items,
            {
              ...options,
              pageIndex: p,
              itemsPerPage,
            },
            canvas
          );
          pageDataUrl = canvas.toDataURL('image/png', 1.0);
        }
      }
    }

    if (!pageDataUrl) {
      throw new Error(`فشل إنشاء الصفحة ${p + 1} للتصدير بصيغة PDF.`);
    }

    if (p > 0) {
      pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT], 'portrait');
    }
    pdf.addImage(pageDataUrl, 'PNG', 0, 0, PAGE_WIDTH, PAGE_HEIGHT, undefined, 'FAST');
  }

  const rawArrayBuffer = pdf.output('arraybuffer');
  const buffer = new Uint8Array(rawArrayBuffer);

  // Route saving through centralized export storage service
  const targetExportType = (options.exportType as any) || 'mss_images';
  const saveResult = await exportStorageService.saveExportedFile({
    exportType: targetExportType,
    filename: finalPdfName,
    data: buffer,
    mimeType: 'application/pdf',
  });

  if (!saveResult.success) {
    throw new Error(saveResult.error || 'تم إلغاء أو تعذر حفظ كتالوج الصور بتنسيق PDF.');
  }

  return {
    filename: finalPdfName,
    pageCount: totalPages,
    buffer,
  };
}

/**
 * Sequentially exports all pages of promotional items as high-resolution PNG images.
 * Uses standard Arabic filename format with zero-padded page numbering:
 * Example: "أجهزة كومبي ام اس اس - 2026-11-20 - 01 من 10.png"
 */
export async function exportPromotionalAllPagesAsPng(
  items: PromotionalLaptopItem[],
  options: PromotionalExportOptions,
  onProgress?: (currentPage: number, totalPages: number) => void
): Promise<{ filenames: string[]; totalPages: number }> {
  const itemsPerPage = options.itemsPerPage && options.itemsPerPage > 0
    ? options.itemsPerPage
    : PROMOTIONAL_MAX_DEVICES_PER_PAGE;
  const totalPages = Math.max(1, Math.ceil(items.length / itemsPerPage));
  const generatedFilenames: string[] = [];

  // Ensure the selected header image is loaded before rendering any PNG page
  await ensurePromotionalImageLoaded(options.headerImageSrc || PROMOTIONAL_HEADER_ASSETS.banner);

  for (let p = 0; p < totalPages; p++) {
    if (onProgress) {
      onProgress(p + 1, totalPages);
    }

    let pageDataUrl = options.pageDataUrls && options.pageDataUrls[p];

    if (!pageDataUrl) {
      if (typeof document !== 'undefined') {
        const pageEl = document.getElementById(`mss-promotional-page-container-${p}`) ||
          (p === 0 ? document.getElementById('mss-promotional-poster-container') : null);

        if (pageEl) {
          try {
            if (document.fonts && document.fonts.ready) {
              await document.fonts.ready;
            }
            const imgs = pageEl.querySelectorAll('img');
            await Promise.all(
              Array.from(imgs).map(img => {
                if (img.complete) return Promise.resolve();
                return new Promise(resolve => {
                  img.onload = resolve;
                  img.onerror = resolve;
                });
              })
            );
            const { toPng } = await import('html-to-image');
            pageDataUrl = await toPng(pageEl, {
              quality: 1.0,
              pixelRatio: 2,
              backgroundColor: '#ffffff',
              cacheBust: true,
            });
          } catch (e) {
            console.warn(`DOM capture for PNG page ${p + 1} failed, using canvas fallback:`, e);
          }
        }
      }

      if (!pageDataUrl) {
        let canvas: HTMLCanvasElement | null = null;
        if (typeof document !== 'undefined' && document.createElement) {
          canvas = document.createElement('canvas');
        } else {
          canvas = createFallbackCanvas(1200, 1000);
        }

        if (canvas) {
          renderPromotionalToCanvas(
            items,
            {
              ...options,
              pageIndex: p,
              itemsPerPage,
            },
            canvas
          );
          pageDataUrl = canvas.toDataURL('image/png', 1.0);
        }
      }
    }

    if (!pageDataUrl) {
      throw new Error(`فشل إنشاء الصورة الترويجية للصفحة ${p + 1}.`);
    }

    const filename = generatePromotionalArabicFilename(
      items,
      'png',
      p + 1,
      totalPages
    );

    if (typeof document !== 'undefined' && typeof window !== 'undefined') {
      const targetExportType = (options.exportType as any) || 'mss_images';
      await exportPromotionalAsPng(pageDataUrl, filename, targetExportType);
      // Small pause between downloads to let browser process
      await new Promise(res => setTimeout(res, 250));
    }

    generatedFilenames.push(filename);
  }

  return {
    filenames: generatedFilenames,
    totalPages,
  };
}

export const mssPromotionalService = {
  ARABIC_GENERATIONS,
  PROMOTIONAL_MAX_DEVICES_PER_PAGE,
  extractShortProcessor,
  extractGenerationAndShortProcessor,
  sanitizeArabicFilename,
  generatePromotionalArabicFilename,
  preparePromotionalItems,
  filterPromotionalItems,
  sortPromotionalItems,
  renderPromotionalToCanvas,
  ensurePromotionalImageLoaded,
  exportPromotionalAsPng,
  exportPromotionalAllPagesAsPng,
  exportPromotionalAsPdf,
};
