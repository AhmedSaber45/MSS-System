import { supabase } from '../lib/supabase.ts';
import { backupService } from './backupService.ts';
import type {
  MSSCatalogModel,
  NewMSSModelInput,
  UpdateMSSModelInput,
  MSSModelAvailability,
  MSSCategory,
} from '../types/mssCatalog.ts';

const MSS_MODELS_CACHE_KEY = 'shop_mss_models_cache_v1';
const MSS_DEVICES_CACHE_KEY = 'shop_mss_devices_cache_v1';

// Seed models for offline preview and initial synchronization
const INITIAL_SEED_MODELS: MSSCatalogModel[] = [
  {
    id: 'a0000000-0000-0000-0000-000000000001',
    brand: 'Lenovo',
    model_name: 'ThinkPad T480',
    category: 'لابتوب',
    processor: 'Intel Core i5-8350U',
    ram: '16 GB DDR4',
    storage: '256 GB NVMe SSD',
    screen_size: '14" FHD IPS',
    specifications: 'بطارية مزدوجة، كيبورد مضيئة، كاميرا خصوصية ThinkShutter',
    default_list_price: 11500,
    created_at: '2024-11-01T10:00:00Z',
    updated_at: '2024-11-01T10:00:00Z',
  },
  {
    id: 'a0000000-0000-0000-0000-000000000002',
    brand: 'Dell',
    model_name: 'Latitude 5420',
    category: 'لابتوب',
    processor: 'Intel Core i5-1145G7',
    ram: '16 GB DDR4',
    storage: '512 GB NVMe SSD',
    screen_size: '14" FHD Anti-Glare',
    specifications: 'الجيل الحادي عشر، شاحن تايب سي، بصمة إصبع',
    default_list_price: 15000,
    created_at: '2024-11-02T11:30:00Z',
    updated_at: '2024-11-02T11:30:00Z',
  },
  {
    id: 'a0000000-0000-0000-0000-000000000003',
    brand: 'HP',
    model_name: 'EliteBook 840 G6',
    category: 'لابتوب',
    processor: 'Intel Core i7-8665U',
    ram: '16 GB DDR4',
    storage: '512 GB NVMe SSD',
    screen_size: '14" FHD IPS',
    specifications: 'هيكل ألومنيوم أنيق، صوت Bang & Olufsen فاخر',
    default_list_price: 13500,
    created_at: '2024-11-03T09:15:00Z',
    updated_at: '2024-11-03T09:15:00Z',
  },
  {
    id: 'a0000000-0000-0000-0000-000000000004',
    brand: 'Dell',
    model_name: 'UltraSharp U2419H',
    category: 'شاشة',
    processor: '-',
    ram: '-',
    storage: '-',
    screen_size: '24" FHD IPS InfinityEdge',
    specifications: 'شاشة احترافية لمصممي الجرافيك، حواف نحيفة جداً، حامل هيدروليك كامل',
    default_list_price: 4200,
    created_at: '2024-11-04T14:20:00Z',
    updated_at: '2024-11-04T14:20:00Z',
  },
];

// Seed sample device units for initial offline stock availability
const INITIAL_SEED_DEVICES = [
  { id: 'b1', serial_number: 'PF1K892-LEN', model_id: 'a0000000-0000-0000-0000-000000000001', stock_location: 'محل 2', status: 'AVAILABLE' },
  { id: 'b2', serial_number: 'PF1K893-LEN', model_id: 'a0000000-0000-0000-0000-000000000001', stock_location: 'محل 2', status: 'AVAILABLE' },
  { id: 'b3', serial_number: '8F9X021-DELL', model_id: 'a0000000-0000-0000-0000-000000000002', stock_location: 'محل 1', status: 'RESERVED' },
  { id: 'b4', serial_number: '8F9X022-DELL', model_id: 'a0000000-0000-0000-0000-000000000002', stock_location: 'محل 1', status: 'AVAILABLE' },
  { id: 'b5', serial_number: '5CD9283-HP', model_id: 'a0000000-0000-0000-0000-000000000003', stock_location: 'محل 2', status: 'SOLD' },
  { id: 'b6', serial_number: 'CN49129-MON', model_id: 'a0000000-0000-0000-0000-000000000004', stock_location: 'محل 1', status: 'AVAILABLE' },
];

function getCachedModels(): MSSCatalogModel[] {
  try {
    const raw = localStorage.getItem(MSS_MODELS_CACHE_KEY);
    if (!raw) {
      localStorage.setItem(MSS_MODELS_CACHE_KEY, JSON.stringify(INITIAL_SEED_MODELS));
      return INITIAL_SEED_MODELS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : INITIAL_SEED_MODELS;
  } catch {
    return INITIAL_SEED_MODELS;
  }
}

function saveCachedModels(models: MSSCatalogModel[]): void {
  localStorage.setItem(MSS_MODELS_CACHE_KEY, JSON.stringify(models));
}

function getCachedDevices(): typeof INITIAL_SEED_DEVICES {
  try {
    const raw = localStorage.getItem(MSS_DEVICES_CACHE_KEY);
    if (!raw) {
      localStorage.setItem(MSS_DEVICES_CACHE_KEY, JSON.stringify(INITIAL_SEED_DEVICES));
      return INITIAL_SEED_DEVICES;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : INITIAL_SEED_DEVICES;
  } catch {
    return INITIAL_SEED_DEVICES;
  }
}

export const mssCatalogService = {
  /**
   * Fetch all catalog models with offline cache fallback
   */
  async getModels(query?: string, category?: string): Promise<MSSCatalogModel[]> {
    let models: MSSCatalogModel[] = [];
    let isCloudFetched = false;

    try {
      const { data, error } = await supabase
        .from('mss_models')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(data) && data.length > 0) {
        models = data.map((row: any) => ({
          id: row.id,
          brand: row.brand,
          model_name: row.model_name,
          category: row.category as MSSCategory,
          processor: row.processor,
          ram: row.ram,
          storage: row.storage,
          screen_size: row.screen_size,
          specifications: row.specifications,
          default_list_price: Number(row.default_list_price) || 0,
          created_at: row.created_at,
          updated_at: row.updated_at,
        }));
        saveCachedModels(models);
        isCloudFetched = true;
      }
    } catch (err) {
      console.warn('Supabase fetch models failed, using local cache:', err);
    }

    if (!isCloudFetched) {
      models = getCachedModels();
    }

    if (query && query.trim()) {
      const q = query.trim().toLowerCase();
      models = models.filter(
        m =>
          m.brand.toLowerCase().includes(q) ||
          m.model_name.toLowerCase().includes(q) ||
          (m.processor && m.processor.toLowerCase().includes(q)) ||
          (m.ram && m.ram.toLowerCase().includes(q)) ||
          (m.storage && m.storage.toLowerCase().includes(q)) ||
          (m.specifications && m.specifications.toLowerCase().includes(q))
      );
    }

    if (category && category !== 'ALL') {
      models = models.filter(m => m.category === category);
    }

    return models;
  },

  /**
   * Get single model by ID
   */
  async getModelById(id: string): Promise<MSSCatalogModel | null> {
    const all = await this.getModels();
    return all.find(m => m.id === id) || null;
  },

  /**
   * Add a new catalog model to Supabase and update local cache
   */
  async createModel(input: NewMSSModelInput): Promise<MSSCatalogModel> {
    const brand = input.brand.trim();
    const modelName = input.model_name.trim();

    if (!brand) throw new Error('الماركة (Brand) مطلوبة');
    if (!modelName) throw new Error('اسم الموديل (Model Name) مطلوب');
    if (input.default_list_price < 0) throw new Error('السعر الاسترشادي لا يمكن أن يكون سالباً');

    const newId = 'mod-' + Math.random().toString(36).substring(2, 9) + '-' + Date.now().toString(36);
    const now = new Date().toISOString();

    const newModel: MSSCatalogModel = {
      id: newId,
      brand,
      model_name: modelName,
      category: input.category,
      processor: input.processor?.trim() || null,
      ram: input.ram?.trim() || null,
      storage: input.storage?.trim() || null,
      screen_size: input.screen_size?.trim() || null,
      specifications: input.specifications?.trim() || null,
      default_list_price: input.default_list_price,
      created_at: now,
      updated_at: now,
    };

    // Try remote insert
    try {
      const { data, error } = await supabase
        .from('mss_models')
        .insert({
          brand: newModel.brand,
          model_name: newModel.model_name,
          category: newModel.category,
          processor: newModel.processor,
          ram: newModel.ram,
          storage: newModel.storage,
          screen_size: newModel.screen_size,
          specifications: newModel.specifications,
          default_list_price: newModel.default_list_price,
        })
        .select()
        .single();

      if (!error && data) {
        newModel.id = data.id;
        newModel.created_at = data.created_at;
        newModel.updated_at = data.updated_at;
      }
    } catch (err) {
      console.warn('Supabase insert model failed, cached locally for sync:', err);
    }

    const cached = getCachedModels();
    cached.unshift(newModel);
    saveCachedModels(cached);

    backupService.notifyDataChanged(`إضافة موديل في كتالوج MSS: ${newModel.model_name}`);

    return newModel;
  },

  /**
   * Update an existing catalog model (including controlled price override)
   */
  async updateModel(id: string, input: UpdateMSSModelInput): Promise<MSSCatalogModel> {
    const cached = getCachedModels();
    const index = cached.findIndex(m => m.id === id);
    if (index < 0) throw new Error('الموديل غير موجود في الكتالوج');

    if (input.default_list_price !== undefined && input.default_list_price < 0) {
      throw new Error('السعر الاسترشادي لا يمكن أن يكون سالباً');
    }

    const current = cached[index];
    const updated: MSSCatalogModel = {
      ...current,
      brand: input.brand?.trim() ?? current.brand,
      model_name: input.model_name?.trim() ?? current.model_name,
      category: input.category ?? current.category,
      processor: input.processor !== undefined ? input.processor.trim() || null : current.processor,
      ram: input.ram !== undefined ? input.ram.trim() || null : current.ram,
      storage: input.storage !== undefined ? input.storage.trim() || null : current.storage,
      screen_size: input.screen_size !== undefined ? input.screen_size.trim() || null : current.screen_size,
      specifications: input.specifications !== undefined ? input.specifications.trim() || null : current.specifications,
      default_list_price: input.default_list_price ?? current.default_list_price,
      updated_at: new Date().toISOString(),
    };

    // Try remote update
    try {
      await supabase
        .from('mss_models')
        .update({
          brand: updated.brand,
          model_name: updated.model_name,
          category: updated.category,
          processor: updated.processor,
          ram: updated.ram,
          storage: updated.storage,
          screen_size: updated.screen_size,
          specifications: updated.specifications,
          default_list_price: updated.default_list_price,
        })
        .eq('id', id);
    } catch (err) {
      console.warn('Supabase update model failed, cached locally:', err);
    }

    cached[index] = updated;
    saveCachedModels(cached);

    backupService.notifyDataChanged(`تعديل موديل في كتالوج MSS: ${updated.model_name}`);

    return updated;
  },

  /**
   * Delete model from catalog
   */
  async deleteModel(id: string): Promise<void> {
    try {
      await supabase.from('mss_models').delete().eq('id', id);
    } catch (err) {
      console.warn('Supabase delete model failed:', err);
    }

    const cached = getCachedModels();
    const filtered = cached.filter(m => m.id !== id);
    saveCachedModels(filtered);

    backupService.notifyDataChanged(`حذف موديل من كتالوج MSS: ${id}`);
  },

  /**
   * Get physical availability breakdown for models (Shop 1 vs Shop 2)
   */
  async getAvailabilityMap(): Promise<Record<string, MSSModelAvailability>> {
    let devices: any[] = [];
    let isCloud = false;

    try {
      const { data, error } = await supabase
        .from('mss_devices')
        .select('id, model_id, stock_location, status');

      if (!error && Array.isArray(data) && data.length > 0) {
        devices = data;
        localStorage.setItem(MSS_DEVICES_CACHE_KEY, JSON.stringify(devices));
        isCloud = true;
      }
    } catch (err) {
      console.warn('Supabase fetch availability failed, using device cache:', err);
    }

    if (!isCloud) {
      devices = getCachedDevices();
    }

    const availabilityMap: Record<string, MSSModelAvailability> = {};

    devices.forEach((d: any) => {
      const modelId = d.model_id;
      if (!availabilityMap[modelId]) {
        availabilityMap[modelId] = {
          model_id: modelId,
          available_shop1: 0,
          available_shop2: 0,
          total_available: 0,
          reserved_count: 0,
          sold_count: 0,
        };
      }

      if (d.status === 'AVAILABLE') {
        if (d.stock_location === 'محل 1') {
          availabilityMap[modelId].available_shop1++;
        } else if (d.stock_location === 'محل 2') {
          availabilityMap[modelId].available_shop2++;
        }
        availabilityMap[modelId].total_available++;
      } else if (d.status === 'RESERVED') {
        availabilityMap[modelId].reserved_count++;
      } else if (d.status === 'SOLD') {
        availabilityMap[modelId].sold_count++;
      }
    });

    return availabilityMap;
  },
};
