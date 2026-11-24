import type { MSSCatalogModel } from '../types/mssCatalog.ts';
import { parseScreenSpecs } from './mssScreenSpecs.ts';

export type SpecIconType =
  | 'cpu'
  | 'ram'
  | 'storage'
  | 'gpu'
  | 'monitor'
  | 'resolution'
  | 'refresh'
  | 'panel'
  | 'ports'
  | 'touch'
  | 'battery'
  | 'curvature'
  | 'brightness'
  | 'generic';

export interface SpecItem {
  key: string;
  label: string;
  value: string;
  iconType?: SpecIconType;
}

export interface ModelSpecsAndNotesResult {
  specs: SpecItem[];
  notes: string | null;
}

/**
 * Extracts all available specifications and notes dynamically
 * for any device category (Laptops, Screens/Monitors, and other devices)
 */
export function extractModelSpecificationsAndNotes(
  model: MSSCatalogModel | null
): ModelSpecsAndNotesResult {
  if (!model) return { specs: [], notes: null };

  const specs: SpecItem[] = [];
  let notes: string | null = null;
  const isScreen = model.category === 'شاشة';

  if (isScreen) {
    // 1. Screens / Monitors
    const parsed = parseScreenSpecs(model.screen_size, model.specifications);

    if (parsed.size) {
      specs.push({
        key: 'screen_size',
        label: 'مقاس الشاشة (Screen Size)',
        value: parsed.size,
        iconType: 'monitor',
      });
    } else if (model.screen_size && model.screen_size.trim()) {
      specs.push({
        key: 'screen_size',
        label: 'مقاس ومواصفات الشاشة',
        value: model.screen_size.trim(),
        iconType: 'monitor',
      });
    }

    if (parsed.resolution) {
      specs.push({
        key: 'resolution',
        label: 'دقة العرض (Resolution)',
        value: parsed.resolution,
        iconType: 'resolution',
      });
    }

    if (parsed.panel) {
      specs.push({
        key: 'panel',
        label: 'نوع اللوحة (Panel Type)',
        value: parsed.panel,
        iconType: 'panel',
      });
    }

    if (parsed.refreshRate) {
      specs.push({
        key: 'refresh_rate',
        label: 'معدل التحديث (Refresh Rate)',
        value: parsed.refreshRate,
        iconType: 'refresh',
      });
    }

    if (parsed.responseTime) {
      specs.push({
        key: 'response_time',
        label: 'زمن الاستجابة (Response Time)',
        value: parsed.responseTime,
        iconType: 'refresh',
      });
    }

    if (parsed.aspectRatio) {
      specs.push({
        key: 'aspect_ratio',
        label: 'نسبة الأبعاد (Aspect Ratio)',
        value: parsed.aspectRatio,
        iconType: 'resolution',
      });
    }

    if (parsed.curvature && parsed.curvature.trim()) {
      specs.push({
        key: 'curvature',
        label: 'تصميم الشاشة (Curvature)',
        value: parsed.curvature,
        iconType: 'curvature',
      });
    }

    if (parsed.brightness) {
      specs.push({
        key: 'brightness',
        label: 'السطوع (Brightness)',
        value: parsed.brightness,
        iconType: 'brightness',
      });
    }

    if (parsed.ports) {
      specs.push({
        key: 'ports',
        label: 'المنافذ والتوصيل (Ports)',
        value: parsed.ports,
        iconType: 'ports',
      });
    }

    if (parsed.touch && (parsed.touch === 'نعم' || parsed.touch.toLowerCase() === 'yes')) {
      specs.push({
        key: 'touch',
        label: 'شاشة لمس (Touchscreen)',
        value: 'نعم (Touchscreen)',
        iconType: 'touch',
      });
    }

    // Dynamic fallback for any additional specs entered on screen model
    if (model.processor && model.processor.trim()) {
      specs.push({
        key: 'processor',
        label: 'المعالج (Processor)',
        value: model.processor.trim(),
        iconType: 'cpu',
      });
    }
    if (model.ram && model.ram.trim()) {
      specs.push({
        key: 'ram',
        label: 'الذاكرة (RAM)',
        value: model.ram.trim(),
        iconType: 'ram',
      });
    }
    if (model.storage && model.storage.trim()) {
      specs.push({
        key: 'storage',
        label: 'التخزين (Storage)',
        value: model.storage.trim(),
        iconType: 'storage',
      });
    }
    if (model.gpu && model.gpu.trim()) {
      specs.push({
        key: 'gpu',
        label: 'كارت الشاشة (GPU)',
        value: model.gpu.trim(),
        iconType: 'gpu',
      });
    }

    if (parsed.notes && parsed.notes.trim()) {
      notes = parsed.notes.trim();
    }
  } else {
    // 2. Laptops & General Devices
    if (model.processor && model.processor.trim()) {
      specs.push({
        key: 'processor',
        label: 'المعالج (Processor / CPU)',
        value: model.processor.trim(),
        iconType: 'cpu',
      });
    }

    if (model.ram && model.ram.trim()) {
      specs.push({
        key: 'ram',
        label: 'الذاكرة العشوائية (RAM)',
        value: model.ram.trim(),
        iconType: 'ram',
      });
    }

    if (model.storage && model.storage.trim()) {
      specs.push({
        key: 'storage',
        label: 'سعة التخزين (Storage)',
        value: model.storage.trim(),
        iconType: 'storage',
      });
    }

    if (model.gpu && model.gpu.trim()) {
      specs.push({
        key: 'gpu',
        label: 'كارت الشاشة (GPU / Graphics)',
        value: model.gpu.trim(),
        iconType: 'gpu',
      });
    }

    if (model.screen_size && model.screen_size.trim()) {
      specs.push({
        key: 'screen_size',
        label: 'الشاشة والعرض (Display / Screen)',
        value: model.screen_size.trim(),
        iconType: 'monitor',
      });
    }

    // Process specifications field for laptops/general
    if (model.specifications && model.specifications.trim()) {
      const rawSpecs = model.specifications.trim();
      if (rawSpecs.includes('•')) {
        const parts = rawSpecs.split('•').map(p => p.trim()).filter(Boolean);
        const remainingNotes: string[] = [];
        for (const p of parts) {
          if (p.startsWith('ملاحظات:')) {
            remainingNotes.push(p.replace('ملاحظات:', '').trim());
          } else if (p.includes(':')) {
            const [label, ...valParts] = p.split(':');
            const val = valParts.join(':').trim();
            if (val) {
              specs.push({
                key: `custom_${label.trim()}`,
                label: label.trim(),
                value: val,
                iconType: 'generic',
              });
            }
          } else {
            remainingNotes.push(p);
          }
        }
        if (remainingNotes.length > 0) {
          notes = remainingNotes.join(' • ');
        }
      } else {
        notes = rawSpecs;
      }
    }
  }

  // 3. Dynamic check for any other arbitrary fields on model object (e.g. battery, ports, etc.)
  const knownKeys = new Set([
    'id', 'brand', 'model_name', 'category', 'processor', 'ram',
    'storage', 'gpu', 'screen_size', 'specifications', 'default_list_price',
    'created_at', 'updated_at', '_synced', 'model_code'
  ]);

  for (const [key, rawVal] of Object.entries(model)) {
    if (!knownKeys.has(key) && rawVal !== null && rawVal !== undefined) {
      const valStr = String(rawVal).trim();
      if (valStr && valStr !== '' && !valStr.toLowerCase().startsWith('object')) {
        let label = key;
        let iconType: SpecIconType = 'generic';
        if (key.toLowerCase().includes('battery') || key.includes('بطارية')) {
          label = 'البطارية (Battery)';
          iconType = 'battery';
        } else if (key.toLowerCase().includes('port') || key.includes('منفذ') || key.includes('منافذ')) {
          label = 'المنافذ (Ports)';
          iconType = 'ports';
        }
        specs.push({
          key,
          label,
          value: valStr,
          iconType,
        });
      }
    }
  }

  return { specs, notes };
}

export interface CompactModelSpecsResult {
  specsText: string;
  notesText: string | null;
}

/**
 * Formats a RAM string to ensure clean unit presentation (e.g. '16GB' -> '16GB RAM')
 * while preventing redundant duplication if 'RAM' or 'DDR' is already included.
 */
export function formatRamString(ram?: string | null): string {
  if (!ram) return '';
  const trimmed = ram.trim();
  if (!trimmed) return '';
  if (/ram|رام|ddr|جيجا/i.test(trimmed)) {
    return trimmed;
  }
  if (/^\d+\s*(?:gb|tb|mb)$/i.test(trimmed)) {
    return `${trimmed} RAM`;
  }
  return trimmed;
}

/**
 * Cleans notes text by removing redundant 'ملاحظات:' prefixes
 * and filters out empty placeholder values ('---', 'لا توجد', null, etc.).
 */
export function cleanNotesString(raw?: string | null): string | null {
  if (!raw) return null;
  let trimmed = String(raw).trim();
  if (!trimmed) return null;
  trimmed = trimmed.replace(/^(?:ملاحظات|ملاحظة)(?:\s*إضافية)?\s*:\s*/i, '').trim();
  if (
    !trimmed ||
    trimmed === '---' ||
    trimmed === '-' ||
    trimmed === 'لا توجد' ||
    trimmed.toLowerCase() === 'null' ||
    trimmed.toLowerCase() === 'none' ||
    trimmed.toLowerCase() === 'undefined'
  ) {
    return null;
  }
  return trimmed;
}

/**
 * Generates a concise, single-line summary of model specifications
 * and extracts saved notes, adapting dynamically to the device type (laptop vs screen vs other).
 *
 * Example laptop output: 'Core i7 | 16GB RAM | 512GB SSD | RTX 3050'
 * Example screen output: '27" | 2K QHD (2560×1440) | IPS | 144Hz | Curved'
 */
export function formatCompactModelSpecs(
  model?: MSSCatalogModel | null
): CompactModelSpecsResult {
  if (!model) {
    return { specsText: '', notesText: null };
  }

  const isScreen =
    model.category === 'شاشة' ||
    (typeof model.category === 'string' && /screen|monitor/i.test(model.category));

  if (isScreen) {
    const parsed = parseScreenSpecs(model.screen_size, model.specifications);
    const parts: string[] = [];

    // 1. Screen Size
    if (parsed.size && parsed.size.trim()) {
      parts.push(parsed.size.trim());
    } else if (model.screen_size && model.screen_size.trim()) {
      parts.push(model.screen_size.trim());
    }

    // 2. Resolution (e.g. 2K QHD (2560×1440), FHD (1920×1080))
    if (
      parsed.resolution &&
      parsed.resolution.trim() &&
      !parts.some(p => p.includes(parsed.resolution.trim()))
    ) {
      parts.push(parsed.resolution.trim());
    }

    // 3. Panel (e.g. IPS, VA, OLED, TN)
    if (
      parsed.panel &&
      parsed.panel.trim() &&
      !parts.some(p => p.includes(parsed.panel.trim()))
    ) {
      parts.push(parsed.panel.trim());
    }

    // 4. Refresh Rate (e.g. 144Hz, 240Hz, 75Hz)
    if (
      parsed.refreshRate &&
      parsed.refreshRate.trim() &&
      !parts.some(p => p.toLowerCase().includes(parsed.refreshRate.trim().toLowerCase()))
    ) {
      parts.push(parsed.refreshRate.trim());
    }

    // 5. Curvature (Only highlight if Curved)
    if (
      parsed.curvature &&
      (parsed.curvature.includes('منحنية') || parsed.curvature.toLowerCase().includes('curved'))
    ) {
      parts.push(parsed.curvature.includes('منحنية') ? 'شاشة منحنية (Curved)' : 'Curved');
    }

    // 6. Response Time (e.g. 1ms)
    if (
      parsed.responseTime &&
      parsed.responseTime.trim() &&
      !parts.some(p => p.toLowerCase().includes(parsed.responseTime.trim().toLowerCase()))
    ) {
      parts.push(parsed.responseTime.trim());
    }

    // 7. Touchscreen
    if (
      parsed.touch &&
      (parsed.touch === 'نعم' ||
        parsed.touch.toLowerCase() === 'yes' ||
        parsed.touch.toLowerCase().includes('touch'))
    ) {
      parts.push('شاشة لمس (Touch)');
    }

    // 8. Ports (if concise, e.g. HDMI, DP)
    if (parsed.ports && parsed.ports.trim()) {
      parts.push(parsed.ports.trim());
    }

    // Fallback hardware if entered on screen model (e.g. All-In-One PC)
    if (model.processor && model.processor.trim()) {
      parts.push(model.processor.trim());
    }
    if (model.ram && model.ram.trim()) {
      parts.push(formatRamString(model.ram.trim()));
    }
    if (model.storage && model.storage.trim()) {
      parts.push(model.storage.trim());
    }
    if (model.gpu && model.gpu.trim()) {
      parts.push(model.gpu.trim());
    }

    let notesText = cleanNotesString(parsed.notes);
    if (!notesText && (model as any).notes) {
      notesText = cleanNotesString((model as any).notes);
    }

    const specsText = parts
      .map(p => p.trim())
      .filter(p => p.length > 0 && p !== '---' && p !== 'null' && p !== 'undefined')
      .join(' | ');

    return { specsText, notesText };
  }

  // Laptops and other device types (Desktops, etc.)
  const parts: string[] = [];
  let notesText: string | null = null;

  // 1. Processor
  if (model.processor && model.processor.trim()) {
    parts.push(model.processor.trim());
  }

  // 2. RAM
  if (model.ram && model.ram.trim()) {
    parts.push(formatRamString(model.ram.trim()));
  }

  // 3. Storage
  if (model.storage && model.storage.trim()) {
    parts.push(model.storage.trim());
  }

  // 4. GPU / Graphics
  if (model.gpu && model.gpu.trim()) {
    parts.push(model.gpu.trim());
  }

  // 5. Screen Size / Display
  if (model.screen_size && model.screen_size.trim()) {
    parts.push(model.screen_size.trim());
  }

  // 6. Process specifications & notes
  if (model.specifications && model.specifications.trim()) {
    const rawSpecs = model.specifications.trim();
    if (rawSpecs.includes('•')) {
      const specParts = rawSpecs.split('•').map(p => p.trim()).filter(Boolean);
      const remainingNotes: string[] = [];
      for (const p of specParts) {
        if (/^(?:ملاحظات|ملاحظة)/i.test(p)) {
          const cleaned = cleanNotesString(p);
          if (cleaned) remainingNotes.push(cleaned);
        } else if (p.includes(':')) {
          const [lbl, ...valParts] = p.split(':');
          const val = valParts.join(':').trim();
          if (val && !/^(?:لا|none|null|---)$/i.test(val)) {
            parts.push(`${lbl.trim()}: ${val}`);
          }
        } else {
          remainingNotes.push(p);
        }
      }
      const filteredNotes = remainingNotes.filter(Boolean);
      if (filteredNotes.length > 0) {
        notesText = cleanNotesString(filteredNotes.join(' • '));
      }
    } else {
      if (/^(?:ملاحظات|ملاحظة)/i.test(rawSpecs)) {
        notesText = cleanNotesString(rawSpecs);
      } else if (parts.length > 0) {
        // If we already have primary hardware specs, any general string in specifications is notes
        notesText = cleanNotesString(rawSpecs);
      } else {
        // If no hardware specs exist at all, specifications is the specs description
        parts.push(rawSpecs);
      }
    }
  }

  if (!notesText && (model as any).notes) {
    notesText = cleanNotesString((model as any).notes);
  }

  const specsText = parts
    .map(p => p.trim())
    .filter(p => p.length > 0 && p !== '---' && p !== 'null' && p !== 'undefined')
    .join(' | ');

  return { specsText, notesText };
}

