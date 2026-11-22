import { getPublicSupabase, isSupabaseConfigured } from '../lib/supabase';
import type { PublicInventoryItem, DynamicStore, MSSDeviceStatus } from '../types/inventory';

export interface FetchInventoryResult {
  items: PublicInventoryItem[];
  stores: DynamicStore[];
  error?: string;
}

/**
 * Fetches dynamic active branches directly from public.system_stores
 */
export async function fetchDynamicBranches(): Promise<DynamicStore[]> {
  const supabase = getPublicSupabase();
  if (!supabase || !isSupabaseConfigured()) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('system_stores')
      .select('id, code, name')
      .eq('is_active', true)
      .eq('is_archived', false)
      .order('name', { ascending: true });

    if (error) {
      console.warn('Failed to fetch dynamic stores from Supabase:', error.message);
      return [];
    }

    return (data || []).map((s: any) => ({
      id: String(s.id),
      code: String(s.code),
      name: String(s.name),
    }));
  } catch (err: any) {
    console.warn('Exception fetching dynamic stores:', err?.message || err);
    return [];
  }
}

/**
 * Fetches real inventory records from Supabase with zero mock or fake data
 */
export async function fetchPublicInventory(): Promise<FetchInventoryResult> {
  const supabase = getPublicSupabase();

  if (!supabase || !isSupabaseConfigured()) {
    return {
      items: [],
      stores: [],
      error: 'الاتصال بقاعدة البيانات غير مهيأ. يرجى ضبط متغيرات البيئة في .env.local أو إعدادات Vercel.',
    };
  }

  try {
    // 1. Fetch active stores dynamically
    const stores = await fetchDynamicBranches();
    const storeMap = new Map<string, string>();
    stores.forEach((s) => {
      storeMap.set(s.id, s.name);
      storeMap.set(s.code, s.name);
      storeMap.set(s.name, s.name);
    });

    // 2. Attempt primary read from the dedicated read-only view
    const { data: viewData, error: viewError } = await supabase
      .from('vw_public_mss_inventory')
      .select('*')
      .order('brand', { ascending: true })
      .order('model_name', { ascending: true });

    if (!viewError && Array.isArray(viewData)) {
      const items: PublicInventoryItem[] = viewData
        .filter((row: any) => Number(row.quantity) > 0)
        .map((row: any) => ({
          id: String(row.id || `${row.model_id}_${row.branch_name}_${row.status}`),
          model_id: String(row.model_id),
          model_name: String(row.model_name || 'جهاز بدون اسم'),
          brand: String(row.brand || 'عام'),
          category: String(row.category || 'أخرى'),
          processor: row.processor || null,
          gpu: row.gpu || null,
          ram: row.ram || null,
          storage: row.storage || null,
          screen_size: row.screen_size || null,
          specifications: row.specifications || null,
          selling_price: Number(row.selling_price) || 0,
          branch_name: String(row.branch_name || 'الفرع الرئيسي'),
          status: (row.status || 'AVAILABLE') as MSSDeviceStatus,
          quantity: Number(row.quantity) || 1,
          last_updated_at: row.last_updated_at || null,
        }));

      return { items, stores };
    }

    // 3. Safe fallback query: Query mss_devices and mss_models directly with strict public-only columns
    // (Active if the dedicated SQL view migration is pending in the Supabase SQL Editor)
    let devices: any[] | null = null;
    const { data: devWithQty, error: devError } = await supabase
      .from('mss_devices')
      .select('id, model_id, list_price, stock_location, quantity, status, updated_at')
      .in('status', ['AVAILABLE', 'RESERVED', 'SOLD']);

    if (!devError && devWithQty) {
      devices = devWithQty;
    } else {
      // Fallback if quantity column does not exist on legacy mss_devices table
      const { data: devWithoutQty, error: fallbackError } = await supabase
        .from('mss_devices')
        .select('id, model_id, list_price, stock_location, status, updated_at')
        .in('status', ['AVAILABLE', 'RESERVED', 'SOLD']);

      if (fallbackError) {
        throw new Error(`خطأ في استعلام الأجهزة: ${fallbackError.message}`);
      }
      devices = devWithoutQty;
    }

    if (!devices || devices.length === 0) {
      return { items: [], stores };
    }

    // Fetch catalog models for these devices
    const modelIds = Array.from(new Set(devices.map((d: any) => d.model_id).filter(Boolean)));
    const { data: models, error: modError } = await supabase
      .from('mss_models')
      .select('id, brand, model_name, category, processor, gpu, ram, storage, screen_size, specifications, default_list_price')
      .in('id', modelIds);

    if (modError) {
      throw new Error(`خطأ في استعلام موديلات الأجهزة: ${modError.message}`);
    }

    const modelsMap = new Map((models || []).map((m: any) => [m.id, m]));

    // Group available/reserved/sold items by model_id, branch, and status
    const groupKeyMap = new Map<string, {
      model: any;
      branchName: string;
      status: MSSDeviceStatus;
      quantity: number;
      maxPrice: number;
      lastUpdated: string | null;
    }>();

    for (const d of devices) {
      const model = modelsMap.get(d.model_id);
      if (!model) continue;

      const rawLoc = d.stock_location || 'الفرع الرئيسي';
      const branchName = storeMap.get(rawLoc) || rawLoc;
      const devStatus = (d.status || 'AVAILABLE') as MSSDeviceStatus;
      const key = `${d.model_id}___${branchName}___${devStatus}`;
      const qty = Number(d.quantity) > 0 ? Number(d.quantity) : 1;
      const price = Number(d.list_price) > 0 ? Number(d.list_price) : Number(model.default_list_price) || 0;

      const existing = groupKeyMap.get(key);
      if (existing) {
        existing.quantity += qty;
        if (price > existing.maxPrice) existing.maxPrice = price;
        if (d.updated_at && (!existing.lastUpdated || d.updated_at > existing.lastUpdated)) {
          existing.lastUpdated = d.updated_at;
        }
      } else {
        groupKeyMap.set(key, {
          model,
          branchName,
          status: devStatus,
          quantity: qty,
          maxPrice: price,
          lastUpdated: d.updated_at || null,
        });
      }
    }

    const items: PublicInventoryItem[] = Array.from(groupKeyMap.entries())
      .filter(([_, grp]) => grp.quantity > 0)
      .map(([key, grp]) => ({
        id: key,
        model_id: grp.model.id,
        model_name: grp.model.model_name,
        brand: grp.model.brand,
        category: grp.model.category,
        processor: grp.model.processor || null,
        gpu: grp.model.gpu || null,
        ram: grp.model.ram || null,
        storage: grp.model.storage || null,
        screen_size: grp.model.screen_size || null,
        specifications: grp.model.specifications || null,
        selling_price: grp.maxPrice,
        branch_name: grp.branchName,
        status: grp.status,
        quantity: grp.quantity,
        last_updated_at: grp.lastUpdated,
      }));

    return { items, stores };
  } catch (err: any) {
    console.error('Failed to fetch public inventory:', err);
    return {
      items: [],
      stores: [],
      error: err?.message || 'تعذر الاتصال بقاعدة البيانات. يرجى إعادة المحاولة.',
    };
  }
}

/**
 * Subscribes to live device status and store changes with automatic periodic fallback polling
 */
export function subscribeToLiveInventory(onUpdate: () => void): () => void {
  const supabase = getPublicSupabase();

  let devChannel: any = null;
  let storeChannel: any = null;

  if (supabase && isSupabaseConfigured()) {
    try {
      devChannel = supabase
        .channel('public-inventory-devices')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'mss_devices' },
          () => {
            onUpdate();
          }
        )
        .subscribe();

      storeChannel = supabase
        .channel('public-inventory-stores')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'system_stores' },
          () => {
            onUpdate();
          }
        )
        .subscribe();
    } catch (e) {
      console.warn('Realtime subscription not available, using periodic interval fallback:', e);
    }
  }

  // Periodic fallback refresh every 45 seconds
  const intervalId = setInterval(() => {
    onUpdate();
  }, 45000);

  return () => {
    clearInterval(intervalId);
    if (supabase) {
      if (devChannel) {
        try {
          supabase.removeChannel(devChannel);
        } catch {}
      }
      if (storeChannel) {
        try {
          supabase.removeChannel(storeChannel);
        } catch {}
      }
    }
  };
}
