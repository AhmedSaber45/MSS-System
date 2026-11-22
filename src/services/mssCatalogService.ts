import { supabase } from '../lib/supabase.ts';
import { backupService } from './backupService.ts';
import { generateUUID, safeStorage } from '../lib/utils.ts';
import type {
  MSSCatalogModel,
  NewMSSModelInput,
  UpdateMSSModelInput,
  MSSModelAvailability,
  MSSCategory,
} from '../types/mssCatalog.ts';

const MSS_MODELS_CACHE_KEY = 'shop_mss_models_cache_v1';
const MSS_DEVICES_CACHE_KEY = 'shop_mss_devices_cache_v1';
const MSS_DELETED_MODELS_CACHE_KEY = 'shop_mss_deleted_models_cache_v1';
const MSS_PENDING_MODELS_CACHE_KEY = 'shop_mss_pending_models_cache_v1';

function getDeletedModelIds(): Set<string> {
  try {
    const raw = safeStorage.getItem(MSS_DELETED_MODELS_CACHE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function addDeletedModelId(id: string): void {
  const current = getDeletedModelIds();
  current.add(id);
  safeStorage.setItem(MSS_DELETED_MODELS_CACHE_KEY, JSON.stringify(Array.from(current)));
}

function getPendingModelIds(): Set<string> {
  try {
    const raw = safeStorage.getItem(MSS_PENDING_MODELS_CACHE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function markModelPending(id: string): void {
  const current = getPendingModelIds();
  current.add(id);
  safeStorage.setItem(MSS_PENDING_MODELS_CACHE_KEY, JSON.stringify(Array.from(current)));
}

function unmarkModelPending(id: string): void {
  const current = getPendingModelIds();
  if (current.has(id)) {
    current.delete(id);
    safeStorage.setItem(MSS_PENDING_MODELS_CACHE_KEY, JSON.stringify(Array.from(current)));
  }
}

function getCachedModels(): MSSCatalogModel[] {
  try {
    const raw = safeStorage.getItem(MSS_MODELS_CACHE_KEY);
    if (!raw) {
      safeStorage.setItem(MSS_MODELS_CACHE_KEY, JSON.stringify([]));
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveCachedModels(models: MSSCatalogModel[]): void {
  safeStorage.setItem(MSS_MODELS_CACHE_KEY, JSON.stringify(models));
}

function getCachedDevices(): any[] {
  try {
    const raw = safeStorage.getItem(MSS_DEVICES_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export const mssCatalogService = {
  /**
   * Sync any models created offline that are pending in local cache
   */
  async syncPendingModels(): Promise<void> {
    const pendingIds = getPendingModelIds();
    if (pendingIds.size === 0) return;

    const cached = getCachedModels();
    for (const id of Array.from(pendingIds)) {
      const model = cached.find(m => m.id === id);
      if (!model) {
        unmarkModelPending(id);
        continue;
      }

      try {
        const { error } = await supabase
          .from('mss_models')
          .upsert({
            id: model.id,
            brand: model.brand,
            model_name: model.model_name,
            category: model.category,
            processor: model.processor,
            gpu: model.gpu,
            ram: model.ram,
            storage: model.storage,
            screen_size: model.screen_size,
            specifications: model.specifications,
            default_list_price: model.default_list_price,
            created_at: model.created_at,
            updated_at: model.updated_at,
          }, { onConflict: 'id' });

        if (!error) {
          unmarkModelPending(id);
        }
      } catch (err) {
        console.warn(`Sync pending model ${id} failed:`, err);
      }
    }
  },

  /**
   * Fetch catalog models where Supabase is the AUTHORITATIVE source of truth.
   * If options?.confirmedOnly is true, only models verified in Supabase are returned (throws if Supabase unreachable).
   */
  async getModels(
    query?: string,
    category?: string,
    options?: { confirmedOnly?: boolean }
  ): Promise<MSSCatalogModel[]> {
    let models: MSSCatalogModel[] = [];
    let isCloudFetched = false;

    // Trigger sync for any models that were created offline
    this.syncPendingModels().catch(() => {});

    try {
      const { data, error } = await supabase
        .from('mss_models')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(data)) {
        const cloudModels: MSSCatalogModel[] = data.map((row: any) => ({
          id: row.id,
          brand: row.brand,
          model_name: row.model_name,
          category: row.category as MSSCategory,
          processor: row.processor,
          gpu: row.gpu || null,
          ram: row.ram,
          storage: row.storage,
          screen_size: row.screen_size,
          specifications: row.specifications,
          default_list_price: Number(row.default_list_price) || 0,
          created_at: row.created_at,
          updated_at: row.updated_at,
          _synced: true,
        }));

        const cloudIds = new Set(cloudModels.map(m => m.id));
        const pendingIds = getPendingModelIds();
        const cached = getCachedModels();

        // Any pending model that is now found in cloudModels has been successfully synced
        for (const pid of Array.from(pendingIds)) {
          if (cloudIds.has(pid)) {
            unmarkModelPending(pid);
          }
        }

        // Only keep local pending models that are legitimately waiting to sync
        const legitimatePendingModels: MSSCatalogModel[] = [];
        for (const m of cached) {
          if (pendingIds.has(m.id) && !cloudIds.has(m.id)) {
            legitimatePendingModels.push({ ...m, _synced: false });
          }
        }

        // RECONCILE: Supabase is authoritative.
        // Stale cached models that no longer exist in Supabase are purged!
        // We do NOT do an array union with cached models.
        const reconciledModels = [...cloudModels, ...legitimatePendingModels];
        saveCachedModels(reconciledModels);
        isCloudFetched = true;

        if (options?.confirmedOnly) {
          models = cloudModels;
        } else {
          models = reconciledModels;
        }
      } else if (error) {
        console.warn('Supabase fetch models error:', error);
      }
    } catch (err) {
      console.warn('Supabase fetch models network failure:', err);
    }

    if (!isCloudFetched) {
      if (options?.confirmedOnly) {
        throw new Error('تعذر التحقق من كتالوج الموديلات السحابي (Supabase غير متاح حالياً). يرجى التأكد من اتصال الإنترنت.');
      }
      models = getCachedModels();
    }

    if (query && query.trim()) {
      const q = query.trim().toLowerCase();
      models = models.filter(
        m =>
          m.brand.toLowerCase().includes(q) ||
          m.model_name.toLowerCase().includes(q) ||
          (m.processor && m.processor.toLowerCase().includes(q)) ||
          (m.gpu && m.gpu.toLowerCase().includes(q)) ||
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
   * Fetch strictly confirmed models from Supabase (Used by Add Device modal)
   */
  async getConfirmedModels(query?: string, category?: string): Promise<MSSCatalogModel[]> {
    return this.getModels(query, category, { confirmedOnly: true });
  },

  /**
   * Get single model by ID
   */
  async getModelById(id: string): Promise<MSSCatalogModel | null> {
    const all = await this.getModels();
    return all.find(m => m.id === id) || null;
  },

  /**
   * Add a new catalog model to Supabase and update local cache.
   * Generates a stable RFC-4122 v4 UUID so offline-created models have valid UUIDs.
   */
  async createModel(input: NewMSSModelInput): Promise<MSSCatalogModel> {
    const brand = input.brand.trim();
    const modelName = input.model_name.trim();

    if (!brand) throw new Error('الماركة (Brand) مطلوبة');
    if (!modelName) throw new Error('اسم الموديل (Model Name) مطلوب');
    if (input.default_list_price < 0) throw new Error('السعر الاسترشادي لا يمكن أن يكون سالباً');

    const newId = generateUUID();
    const now = new Date().toISOString();

    const newModel: MSSCatalogModel = {
      id: newId,
      brand,
      model_name: modelName,
      category: input.category,
      processor: input.processor?.trim() || null,
      gpu: input.gpu?.trim() || null,
      ram: input.ram?.trim() || null,
      storage: input.storage?.trim() || null,
      screen_size: input.screen_size?.trim() || null,
      specifications: input.specifications?.trim() || null,
      default_list_price: input.default_list_price,
      created_at: now,
      updated_at: now,
    };

    // Try remote insert
    let remoteSaved = false;
    try {
      const { data, error } = await supabase
        .from('mss_models')
        .insert({
          id: newModel.id,
          brand: newModel.brand,
          model_name: newModel.model_name,
          category: newModel.category,
          processor: newModel.processor,
          gpu: newModel.gpu,
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
        remoteSaved = true;
        newModel._synced = true;
        unmarkModelPending(newModel.id);
      } else if (error) {
        console.warn('Supabase insert model failed with error, cached locally for sync:', error.message);
        remoteSaved = false;
        newModel._synced = false;
        markModelPending(newModel.id);
      }
    } catch (err) {
      console.warn('Supabase insert model network error, cached locally for sync:', err);
      remoteSaved = false;
      newModel._synced = false;
      markModelPending(newModel.id);
    }

    if (!remoteSaved) {
      markModelPending(newModel.id);
      newModel._synced = false;
    } else {
      unmarkModelPending(newModel.id);
      newModel._synced = true;
    }

    const cached = getCachedModels().filter(m => m.id !== newModel.id);
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
      gpu: input.gpu !== undefined ? input.gpu.trim() || null : current.gpu,
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
          gpu: updated.gpu,
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
    // Check if any devices reference this model (local or remote)
    const devices = getCachedDevices();
    const hasDevices = devices.some((d: any) => d.model_id === id);
    if (hasDevices) {
      throw new Error('لا يمكن حذف الموديل لوجود أجهزة مسجلة مرتبطة به في المخزون.');
    }

    addDeletedModelId(id);
    unmarkModelPending(id);

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

      if (!error && Array.isArray(data)) {
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
      if (!modelId) return;

      if (!availabilityMap[modelId]) {
        availabilityMap[modelId] = {
          model_id: modelId,
          available_shop1: 0,
          available_shop2: 0,
          branch_availability: {},
          total_available: 0,
          reserved_count: 0,
          sold_count: 0,
        };
      }

      if (d.status === 'AVAILABLE') {
        if (d.stock_location) {
          if (!availabilityMap[modelId].branch_availability) {
            availabilityMap[modelId].branch_availability = {};
          }
          availabilityMap[modelId].branch_availability![d.stock_location] =
            (availabilityMap[modelId].branch_availability![d.stock_location] || 0) + 1;
        }
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
