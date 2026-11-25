import type { PromotionalLaptopItem } from '../types/mssPromotional';
import { extractGenerationAndShortProcessor } from './mssPromotionalService.ts';
import { PROMOTIONAL_HEADER_ASSETS } from '../assets/promotional/promotionalAssets.ts';

export const ACCESSORIES_PROMOTIONAL_STORAGE_KEY = 'accessories_promotional_devices_v1';
export const ACCESSORIES_HEADER_STORAGE_KEY = 'shop_accessories_promotional_header_v1';

export type AccessoriesHeaderOptionId = 'compu_mss' | 'souq' | 'makkah';

export interface AccessoriesHeaderOption {
  id: AccessoriesHeaderOptionId;
  label: string;
  imageSrc: string;
}

export const ACCESSORIES_PROMOTIONAL_HEADERS: AccessoriesHeaderOption[] = [
  {
    id: 'compu_mss',
    label: 'Compu MSS',
    imageSrc: PROMOTIONAL_HEADER_ASSETS.banner,
  },
  {
    id: 'souq',
    label: 'Souq',
    imageSrc: '/assets/promotional/promotional-header-souq.jpg',
  },
  {
    id: 'makkah',
    label: 'مكة',
    imageSrc: '/assets/promotional/promotional-header-makkah.jpg',
  },
];

export function getAccessoriesHeaderOption(id?: string | null): AccessoriesHeaderOption {
  return (
    ACCESSORIES_PROMOTIONAL_HEADERS.find(h => h.id === id) ||
    ACCESSORIES_PROMOTIONAL_HEADERS[0]
  );
}

export function loadSelectedHeaderId(): AccessoriesHeaderOptionId {
  if (typeof window === 'undefined' || !window.localStorage) {
    return 'compu_mss';
  }
  try {
    const saved = localStorage.getItem(ACCESSORIES_HEADER_STORAGE_KEY);
    if (saved && ACCESSORIES_PROMOTIONAL_HEADERS.some(h => h.id === saved)) {
      return saved as AccessoriesHeaderOptionId;
    }
  } catch {
    // Fallback to default
  }
  return 'compu_mss';
}

export function saveSelectedHeaderId(id: AccessoriesHeaderOptionId): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  try {
    localStorage.setItem(ACCESSORIES_HEADER_STORAGE_KEY, id);
  } catch {
    // Non-fatal
  }
}

export interface ManualDeviceInput {
  brand?: string;
  model_name?: string;
  processor?: string;
  generation?: string;
  ram?: string;
  storage?: string;
  gpu?: string;
  screen?: string;
  price?: number | string;
  quantity?: number | string;
  notes?: string;
}

/**
 * Loads the manually entered promotional devices from independent local storage.
 * Strictly guarantees ZERO access to Accessories or MSS inventory tables.
 */
export function loadManualPromotionalDevices(): PromotionalLaptopItem[] {
  if (typeof window === 'undefined' || !window.localStorage) {
    return [];
  }
  try {
    const raw = localStorage.getItem(ACCESSORIES_PROMOTIONAL_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    return [];
  } catch (err) {
    console.warn('Failed to load manual promotional devices from localStorage:', err);
    return [];
  }
}

/**
 * Persists the manually entered promotional devices to independent local storage.
 */
export function saveManualPromotionalDevices(items: PromotionalLaptopItem[]): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  try {
    localStorage.setItem(ACCESSORIES_PROMOTIONAL_STORAGE_KEY, JSON.stringify(items));
  } catch (err) {
    console.warn('Failed to save manual promotional devices to localStorage:', err);
  }
}

/**
 * Formats and normalizes a manual input into a full PromotionalLaptopItem.
 * Handles optional fields and numeric conversion cleanly without inserting placeholder data.
 */
export function createPromotionalItemFromManual(
  input: ManualDeviceInput,
  existingId?: string
): PromotionalLaptopItem {
  const id = existingId || `manual_promo_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const brand = (input.brand || '').trim() || '---';
  const modelName = (input.model_name || '').trim();
  const processor = (input.processor || '').trim() || '---';

  // If generation is not explicitly provided, try to extract it from processor
  let generation = (input.generation || '').trim();
  if (!generation && processor !== '---') {
    const extracted = extractGenerationAndShortProcessor(processor);
    if (extracted.generation) {
      generation = extracted.generation;
    }
  }

  const rawPrice = input.price;
  const numPrice = rawPrice !== undefined && rawPrice !== null && rawPrice !== ''
    ? Number(rawPrice)
    : undefined;
  const validPrice = numPrice !== undefined && !isNaN(numPrice) && numPrice >= 0 ? numPrice : undefined;

  const rawQty = input.quantity;
  const numQty = rawQty !== undefined && rawQty !== null && rawQty !== ''
    ? Number(rawQty)
    : undefined;
  const validQty = numQty !== undefined && !isNaN(numQty) && numQty >= 0 ? Math.floor(numQty) : 1;

  return {
    id,
    brand,
    model_name: modelName || '---',
    processor,
    generation: generation || undefined,
    ram: (input.ram || '').trim() || '---',
    storage: (input.storage || '').trim() || '---',
    gpu: (input.gpu || '').trim(),
    screen: (input.screen || '').trim() || '---',
    price: validPrice,
    quantity: validQty,
    available_quantity: validQty,
    notes: (input.notes || '').trim() || undefined,
  };
}

export const accessoriesPromotionalService = {
  ACCESSORIES_PROMOTIONAL_STORAGE_KEY,
  ACCESSORIES_HEADER_STORAGE_KEY,
  ACCESSORIES_PROMOTIONAL_HEADERS,
  getAccessoriesHeaderOption,
  loadSelectedHeaderId,
  saveSelectedHeaderId,
  loadManualPromotionalDevices,
  saveManualPromotionalDevices,
  createPromotionalItemFromManual,
};
