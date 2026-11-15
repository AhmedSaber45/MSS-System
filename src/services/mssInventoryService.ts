import { supabase } from '../lib/supabase.ts';
import { getTodayLocalDateString } from '../lib/dateValidation.ts';
import { mssCatalogService } from './mssCatalogService.ts';
import { mssSyncService } from './mssSyncService.ts';
import type {
  MSSDevice,
  NewMSSDeviceInput,
  UpdateMSSDeviceInput,
  MSSDeviceMovement,
  TransferDeviceInput,
  MSSInventorySummary,
  MSSStockLocation,
  MSSDeviceStatus,
} from '../types/mssInventory.ts';

const MSS_DEVICES_CACHE_KEY = 'shop_mss_devices_cache_v1';
const MSS_MOVEMENTS_CACHE_KEY = 'shop_mss_movements_cache_v1';

// Initial seed devices (consistent with migration and catalog seed)
const INITIAL_SEED_DEVICES: MSSDevice[] = [
  {
    id: 'b0000000-0000-0000-0000-000000000001',
    serial_number: 'PF1K892-LEN',
    model_id: 'a0000000-0000-0000-0000-000000000001',
    purchase_cost: 8500,
    list_price: 11500,
    purchase_date: '2024-11-08',
    physical_condition: 'فرز أول ممتاز',
    stock_location: 'محل 2',
    status: 'AVAILABLE',
    notes: 'حالة ممتازة - الشاحن الأصلي',
    created_at: '2024-11-08T10:00:00Z',
    updated_at: '2024-11-08T10:00:00Z',
  },
  {
    id: 'b0000000-0000-0000-0000-000000000002',
    serial_number: 'PF1K893-LEN',
    model_id: 'a0000000-0000-0000-0000-000000000001',
    purchase_cost: 8700,
    list_price: 11800,
    purchase_date: '2024-11-09',
    physical_condition: 'فرز أول مع بطارية إضافية',
    stock_location: 'محل 2',
    status: 'AVAILABLE',
    notes: 'بطارية 95% صحة',
    created_at: '2024-11-09T11:00:00Z',
    updated_at: '2024-11-09T11:00:00Z',
  },
  {
    id: 'b0000000-0000-0000-0000-000000000003',
    serial_number: '8F9X021-DELL',
    model_id: 'a0000000-0000-0000-0000-000000000002',
    purchase_cost: 11000,
    list_price: 15000,
    purchase_date: '2024-11-07',
    physical_condition: 'كالجديد كرتونة كاملة',
    stock_location: 'محل 1',
    status: 'RESERVED',
    notes: 'محجوز حتى الغد لعميل دائم',
    created_at: '2024-11-07T09:30:00Z',
    updated_at: '2024-11-07T09:30:00Z',
  },
  {
    id: 'b0000000-0000-0000-0000-000000000004',
    serial_number: '8F9X022-DELL',
    model_id: 'a0000000-0000-0000-0000-000000000002',
    purchase_cost: 10800,
    list_price: 14800,
    purchase_date: '2024-11-10',
    physical_condition: 'فرز أول نظيف جداً',
    stock_location: 'محل 1',
    status: 'AVAILABLE',
    notes: 'جاهز للعرض',
    created_at: '2024-11-10T14:15:00Z',
    updated_at: '2024-11-10T14:15:00Z',
  },
  {
    id: 'b0000000-0000-0000-0000-000000000005',
    serial_number: '5CD9283-HP',
    model_id: 'a0000000-0000-0000-0000-000000000003',
    purchase_cost: 9800,
    list_price: 13500,
    purchase_date: '2024-11-05',
    physical_condition: 'فرز أول كيبورد مضيئة',
    stock_location: 'محل 2',
    status: 'SOLD',
    notes: 'تم البيع للعميل شريف',
    created_at: '2024-11-05T16:00:00Z',
    updated_at: '2024-11-05T16:00:00Z',
  },
  {
    id: 'b0000000-0000-0000-0000-000000000006',
    serial_number: 'CN49129-MON',
    model_id: 'a0000000-0000-0000-0000-000000000004',
    purchase_cost: 3100,
    list_price: 4200,
    purchase_date: '2024-11-11',
    physical_condition: 'سليم تماماً خالي من الخدوش',
    stock_location: 'محل 1',
    status: 'AVAILABLE',
    notes: 'شاشة عرض مع كابل DisplayPort',
    created_at: '2024-11-11T12:00:00Z',
    updated_at: '2024-11-11T12:00:00Z',
  },
];

// Initial seed movements (consistent with migration)
const INITIAL_SEED_MOVEMENTS: MSSDeviceMovement[] = [
  {
    id: 'c0000000-0000-0000-0000-000000000001',
    device_id: 'b0000000-0000-0000-0000-000000000004',
    serial_number: '8F9X022-DELL',
    from_location: 'محل 2',
    to_location: 'محل 1',
    movement_date: '2024-11-11T14:30:00Z',
    movement_status: 'COMPLETED',
    notes: 'نقل للعرض في واجهة محل 1 بناء على طلب الإدارة',
    created_at: '2024-11-11T14:30:00Z',
  },
  {
    id: 'c0000000-0000-0000-0000-000000000002',
    device_id: 'b0000000-0000-0000-0000-000000000006',
    serial_number: 'CN49129-MON',
    from_location: 'محل 2',
    to_location: 'محل 1',
    movement_date: '2024-11-12T11:00:00Z',
    movement_status: 'COMPLETED',
    notes: 'نقل شاشة احترافية لتجهيز طلب تجميعة عميل بمحل 1',
    created_at: '2024-11-12T11:00:00Z',
  },
];

function getCachedDevices(): MSSDevice[] {
  try {
    const raw = localStorage.getItem(MSS_DEVICES_CACHE_KEY);
    if (!raw) {
      localStorage.setItem(MSS_DEVICES_CACHE_KEY, JSON.stringify(INITIAL_SEED_DEVICES));
      return INITIAL_SEED_DEVICES;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_SEED_DEVICES;
  } catch {
    return INITIAL_SEED_DEVICES;
  }
}

function saveCachedDevices(devices: MSSDevice[]): void {
  localStorage.setItem(MSS_DEVICES_CACHE_KEY, JSON.stringify(devices));
}

function getCachedMovements(): MSSDeviceMovement[] {
  try {
    const raw = localStorage.getItem(MSS_MOVEMENTS_CACHE_KEY);
    if (!raw) {
      localStorage.setItem(MSS_MOVEMENTS_CACHE_KEY, JSON.stringify(INITIAL_SEED_MOVEMENTS));
      return INITIAL_SEED_MOVEMENTS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : INITIAL_SEED_MOVEMENTS;
  } catch {
    return INITIAL_SEED_MOVEMENTS;
  }
}

function saveCachedMovements(movements: MSSDeviceMovement[]): void {
  localStorage.setItem(MSS_MOVEMENTS_CACHE_KEY, JSON.stringify(movements));
}

export const mssInventoryService = {
  /**
   * Fetch all individual physical units with model metadata and offline caching
   */
  async getDevices(filters?: {
    query?: string;
    location?: string;
    status?: string;
    modelId?: string;
  }): Promise<MSSDevice[]> {
    let devices: MSSDevice[] = [];
    let isCloudFetched = false;

    // 1. Fetch catalog models to enrich devices
    const models = await mssCatalogService.getModels();
    const modelMap = new Map(models.map(m => [m.id, m]));

    // 2. Try fetching devices from Supabase
    try {
      const { data, error } = await supabase
        .from('mss_devices')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(data) && data.length > 0) {
        devices = data.map((row: any) => ({
          id: row.id,
          serial_number: row.serial_number,
          model_id: row.model_id,
          purchase_cost: Number(row.purchase_cost) || 0,
          list_price: Number(row.list_price) || 0,
          purchase_date: row.purchase_date,
          physical_condition: row.physical_condition || 'فرز أول',
          stock_location: row.stock_location as MSSStockLocation,
          status: row.status as MSSDeviceStatus,
          notes: row.notes || null,
          created_at: row.created_at,
          updated_at: row.updated_at,
        }));
        saveCachedDevices(devices);
        isCloudFetched = true;
      }
    } catch (err) {
      console.warn('Supabase fetch devices failed, using local cache:', err);
    }

    if (!isCloudFetched) {
      devices = getCachedDevices();
    }

    // 3. Attach model metadata
    devices = devices.map(d => {
      const model = modelMap.get(d.model_id);
      return {
        ...d,
        model,
        model_name: model?.model_name || 'موديل غير محدد',
        brand: model?.brand || '',
        category: model?.category || 'أخرى',
      };
    });

    // 4. Apply Filters
    if (filters?.location && filters.location !== 'ALL') {
      devices = devices.filter(d => d.stock_location === filters.location);
    }

    if (filters?.status && filters.status !== 'ALL') {
      devices = devices.filter(d => d.status === filters.status);
    }

    if (filters?.modelId) {
      devices = devices.filter(d => d.model_id === filters.modelId);
    }

    if (filters?.query && filters.query.trim()) {
      const q = filters.query.trim().toLowerCase();
      devices = devices.filter(
        d =>
          d.serial_number.toLowerCase().includes(q) ||
          d.model_name?.toLowerCase().includes(q) ||
          d.brand?.toLowerCase().includes(q) ||
          d.physical_condition.toLowerCase().includes(q) ||
          (d.notes && d.notes.toLowerCase().includes(q))
      );
    }

    return devices;
  },

  /**
   * Get single device by ID
   */
  async getDeviceById(id: string): Promise<MSSDevice | null> {
    const devices = await this.getDevices();
    return devices.find(d => d.id === id) || null;
  },

  /**
   * Get device by Serial Number (Exact match, case-insensitive)
   */
  async getDeviceBySerial(serial: string): Promise<MSSDevice | null> {
    const s = serial.trim().toUpperCase();
    const devices = await this.getDevices();
    return devices.find(d => d.serial_number.toUpperCase() === s) || null;
  },

  /**
   * Register a new individual physical device unit
   */
  async createDevice(input: NewMSSDeviceInput): Promise<MSSDevice> {
    const serial = input.serial_number.trim().toUpperCase();
    if (!serial) {
      throw new Error('السيريال نمبر الفريد للجهاز مطلوب');
    }

    if (!input.model_id) {
      throw new Error('يجب اختيار الموديل المرتبط من الكتالوج');
    }

    if (input.purchase_cost < 0) {
      throw new Error('سعر التكلفة لا يمكن أن يكون سالباً');
    }

    if (input.list_price < 0) {
      throw new Error('سعر العرض لا يمكن أن يكون سالباً');
    }

    if (!['محل 1', 'محل 2'].includes(input.stock_location)) {
      throw new Error('موقع التخزين غير صالح. يجب اختيار "محل 1" أو "محل 2"');
    }

    // Check duplicate serial number locally first
    const cached = getCachedDevices();
    const isDuplicate = cached.some(d => d.serial_number.toUpperCase() === serial);
    if (isDuplicate) {
      throw new Error(`السيريال نمبر (${serial}) مسجل مسبقاً في النظام. يمنع تكرار السيريالات.`);
    }

    // Verify model exists in catalog
    const model = await mssCatalogService.getModelById(input.model_id);
    if (!model) {
      throw new Error('الموديل المحدد غير موجود في كتالوج MSS');
    }

    const newId = 'dev-' + Math.random().toString(36).substring(2, 9) + '-' + Date.now().toString(36);
    const now = new Date().toISOString();
    const today = getTodayLocalDateString();
    const purchaseDate = input.purchase_date || today;

    if (purchaseDate > today) {
      throw new Error(`تاريخ الشراء (${purchaseDate}) لا يمكن أن يكون في المستقبل. أقصى تاريخ مسموح هو اليوم (${today}).`);
    }

    const newDevice: MSSDevice = {
      id: newId,
      serial_number: serial,
      model_id: input.model_id,
      purchase_cost: input.purchase_cost,
      list_price: input.list_price || model.default_list_price,
      purchase_date: purchaseDate,
      physical_condition: input.physical_condition?.trim() || 'فرز أول',
      stock_location: input.stock_location,
      status: input.status || 'AVAILABLE',
      notes: input.notes?.trim() || null,
      created_at: now,
      updated_at: now,
      model,
      model_name: model.model_name,
      brand: model.brand,
      category: model.category,
    };

    // Try remote insert to Supabase
    try {
      const { data, error } = await supabase
        .from('mss_devices')
        .insert({
          serial_number: newDevice.serial_number,
          model_id: newDevice.model_id,
          purchase_cost: newDevice.purchase_cost,
          list_price: newDevice.list_price,
          purchase_date: newDevice.purchase_date,
          physical_condition: newDevice.physical_condition,
          stock_location: newDevice.stock_location,
          status: newDevice.status,
          notes: newDevice.notes,
        })
        .select()
        .single();

      if (!error && data) {
        newDevice.id = data.id;
        newDevice.created_at = data.created_at;
        newDevice.updated_at = data.updated_at;
      } else if (error && error.code === '23505') {
        throw new Error(`السيريال نمبر (${serial}) موجود مسبقاً في قاعدة البيانات السحابية.`);
      }
    } catch (err: any) {
      if (err.message && err.message.includes('موجود مسبقاً')) {
        throw err;
      }
      console.warn('Supabase insert device failed, cached locally for sync:', err);
    }

    cached.unshift(newDevice);
    saveCachedDevices(cached);

    // Queue in Outbox
    mssSyncService
      .queueOperation(
        'DEVICE_ADD',
        newDevice,
        `تسجيل جهاز جديد بالسيريال (${newDevice.serial_number}) بمخزون (${newDevice.stock_location})`,
        newDevice.stock_location
      )
      .catch(console.warn);

    return newDevice;
  },

  /**
   * Update an existing individual device record
   */
  async updateDevice(id: string, input: UpdateMSSDeviceInput): Promise<MSSDevice> {
    const cached = getCachedDevices();
    const index = cached.findIndex(d => d.id === id);
    if (index < 0) {
      throw new Error('الجهاز غير موجود في المخزون');
    }

    const current = cached[index];

    // Check serial uniqueness if changing serial
    if (input.serial_number) {
      const newSerial = input.serial_number.trim().toUpperCase();
      if (newSerial !== current.serial_number.toUpperCase()) {
        const isDuplicate = cached.some(d => d.id !== id && d.serial_number.toUpperCase() === newSerial);
        if (isDuplicate) {
          throw new Error(`السيريال نمبر (${newSerial}) مستخدم بالفعل لجهاز آخر.`);
        }
      }
    }

    if (input.purchase_cost !== undefined && input.purchase_cost < 0) {
      throw new Error('سعر التكلفة لا يمكن أن يكون سالباً');
    }

    if (input.list_price !== undefined && input.list_price < 0) {
      throw new Error('سعر العرض لا يمكن أن يكون سالباً');
    }

    if (input.stock_location && !['محل 1', 'محل 2'].includes(input.stock_location)) {
      throw new Error('موقع التخزين غير صالح');
    }

    if (input.purchase_date) {
      const today = getTodayLocalDateString();
      if (input.purchase_date.trim() > today) {
        throw new Error(`تاريخ الشراء (${input.purchase_date}) لا يمكن أن يكون في المستقبل. أقصى تاريخ مسموح هو اليوم (${today}).`);
      }
    }

    const updated: MSSDevice = {
      ...current,
      serial_number: input.serial_number ? input.serial_number.trim().toUpperCase() : current.serial_number,
      model_id: input.model_id || current.model_id,
      purchase_cost: input.purchase_cost !== undefined ? input.purchase_cost : current.purchase_cost,
      list_price: input.list_price !== undefined ? input.list_price : current.list_price,
      purchase_date: input.purchase_date || current.purchase_date,
      physical_condition: input.physical_condition !== undefined ? input.physical_condition.trim() : current.physical_condition,
      stock_location: input.stock_location || current.stock_location,
      status: input.status || current.status,
      notes: input.notes !== undefined ? input.notes?.trim() || null : current.notes,
      updated_at: new Date().toISOString(),
    };

    // Try remote update
    try {
      await supabase
        .from('mss_devices')
        .update({
          serial_number: updated.serial_number,
          model_id: updated.model_id,
          purchase_cost: updated.purchase_cost,
          list_price: updated.list_price,
          purchase_date: updated.purchase_date,
          physical_condition: updated.physical_condition,
          stock_location: updated.stock_location,
          status: updated.status,
          notes: updated.notes,
        })
        .eq('id', id);
    } catch (err) {
      console.warn('Supabase update device failed, cached locally:', err);
    }

    cached[index] = updated;
    saveCachedDevices(cached);

    return updated;
  },

  /**
   * Delete device from inventory (Only if not SOLD)
   */
  async deleteDevice(id: string): Promise<void> {
    const cached = getCachedDevices();
    const device = cached.find(d => d.id === id);
    if (!device) {
      throw new Error('الجهاز غير موجود في المخزون');
    }

    if (device.status === 'SOLD') {
      throw new Error('لا يمكن حذف جهاز تم بيعه بالكامل لحفظ السجلات المالية.');
    }

    try {
      await supabase.from('mss_devices').delete().eq('id', id);
    } catch (err) {
      console.warn('Supabase delete device failed:', err);
    }

    const filtered = cached.filter(d => d.id !== id);
    saveCachedDevices(filtered);
  },

  /**
   * Physical Transfer between Shop 1 and Shop 2 (Explicit Movement Record)
   */
  async transferDevice(input: TransferDeviceInput): Promise<{ device: MSSDevice; movement: MSSDeviceMovement }> {
    const cached = getCachedDevices();
    const deviceIndex = cached.findIndex(d => d.id === input.device_id);
    if (deviceIndex < 0) {
      throw new Error('الجهاز المحدد غير موجود');
    }

    const device = cached[deviceIndex];
    const fromLocation = device.stock_location;
    const toLocation = input.to_location;

    if (fromLocation === toLocation) {
      throw new Error(`الجهاز متواجد بالفعل في (${fromLocation})، ولا يمكن تحويله إلى نفس الموقع`);
    }

    if (!['محل 1', 'محل 2'].includes(toLocation)) {
      throw new Error('المحل الهدف غير صالح. يجب أن يكون "محل 1" أو "محل 2"');
    }

    const now = new Date().toISOString();
    const movementId = 'mov-' + Math.random().toString(36).substring(2, 9) + '-' + Date.now().toString(36);

    const newMovement: MSSDeviceMovement = {
      id: movementId,
      device_id: device.id,
      serial_number: device.serial_number,
      from_location: fromLocation,
      to_location: toLocation,
      movement_date: now,
      movement_status: 'COMPLETED',
      notes: input.notes?.trim() || 'نقل فعلي بين المحلين',
      created_at: now,
      model_name: device.model_name,
      brand: device.brand,
    };

    // Try Supabase RPC or direct insert
    try {
      // Call transfer RPC or direct update
      const { data: rpcData, error: rpcError } = await supabase.rpc('transfer_mss_device', {
        p_device_id: device.id,
        p_to_location: toLocation,
        p_notes: newMovement.notes,
      });

      if (!rpcError && rpcData) {
        newMovement.id = rpcData;
      } else {
        // Fallback to manual direct update
        await supabase
          .from('mss_devices')
          .update({ stock_location: toLocation })
          .eq('id', device.id);

        const { data: insertData } = await supabase
          .from('mss_device_movements')
          .insert({
            device_id: device.id,
            serial_number: device.serial_number,
            from_location: fromLocation,
            to_location: toLocation,
            movement_status: 'COMPLETED',
            notes: newMovement.notes,
          })
          .select('id, movement_date, created_at')
          .single();

        if (insertData?.id) {
          newMovement.id = insertData.id;
          if (insertData.movement_date) newMovement.movement_date = insertData.movement_date;
        }
      }
    } catch (err) {
      console.warn('Supabase transfer device failed, recorded locally:', err);
    }

    // Update local cache
    device.stock_location = toLocation;
    device.updated_at = now;
    cached[deviceIndex] = device;
    saveCachedDevices(cached);

    const movements = getCachedMovements();
    movements.unshift(newMovement);
    saveCachedMovements(movements);

    // Queue in Outbox
    mssSyncService
      .queueOperation(
        'DEVICE_TRANSFER',
        newMovement,
        `نقل جهاز بالسيريال (${newMovement.serial_number}) من (${newMovement.from_location}) إلى (${newMovement.to_location})`,
        newMovement.from_location
      )
      .catch(console.warn);

    return { device, movement: newMovement };
  },

  /**
   * Fetch all movement records with optional filtering
   */
  async getMovements(filters?: {
    query?: string;
    deviceId?: string;
    location?: string;
  }): Promise<MSSDeviceMovement[]> {
    let movements: MSSDeviceMovement[] = [];
    let isCloudFetched = false;

    try {
      const { data, error } = await supabase
        .from('mss_device_movements')
        .select('*')
        .order('movement_date', { ascending: false });

      if (!error && Array.isArray(data) && data.length > 0) {
        movements = data.map((row: any) => ({
          id: row.id,
          device_id: row.device_id,
          serial_number: row.serial_number,
          from_location: row.from_location as MSSStockLocation,
          to_location: row.to_location as MSSStockLocation,
          movement_date: row.movement_date,
          movement_status: row.movement_status,
          notes: row.notes,
          created_at: row.created_at,
        }));
        saveCachedMovements(movements);
        isCloudFetched = true;
      }
    } catch (err) {
      console.warn('Supabase fetch movements failed, using cache:', err);
    }

    if (!isCloudFetched) {
      movements = getCachedMovements();
    }

    // Attach device metadata
    const devices = getCachedDevices();
    const devMap = new Map(devices.map(d => [d.id, d]));

    movements = movements.map(m => {
      const d = devMap.get(m.device_id);
      return {
        ...m,
        model_name: d?.model_name || '',
        brand: d?.brand || '',
      };
    });

    if (filters?.deviceId) {
      movements = movements.filter(m => m.device_id === filters.deviceId);
    }

    if (filters?.location && filters.location !== 'ALL') {
      movements = movements.filter(m => m.from_location === filters.location || m.to_location === filters.location);
    }

    if (filters?.query && filters.query.trim()) {
      const q = filters.query.trim().toLowerCase();
      movements = movements.filter(
        m =>
          m.serial_number.toLowerCase().includes(q) ||
          m.id.toLowerCase().includes(q) ||
          (m.model_name && m.model_name.toLowerCase().includes(q)) ||
          (m.notes && m.notes.toLowerCase().includes(q))
      );
    }

    return movements;
  },

  /**
   * Get movement history for a specific individual device unit
   */
  async getDeviceHistory(deviceId: string): Promise<MSSDeviceMovement[]> {
    return this.getMovements({ deviceId });
  },

  /**
   * Calculate aggregated inventory KPIs
   */
  async getInventorySummary(): Promise<MSSInventorySummary> {
    const devices = await this.getDevices();

    let available_shop1 = 0;
    let available_shop2 = 0;
    let available_total = 0;
    let reserved_total = 0;
    let sold_total = 0;
    let maintenance_total = 0;
    let returned_total = 0;
    let total_cost_value = 0;
    let total_retail_value = 0;

    devices.forEach(d => {
      if (d.status === 'AVAILABLE') {
        available_total++;
        if (d.stock_location === 'محل 1') available_shop1++;
        if (d.stock_location === 'محل 2') available_shop2++;
      } else if (d.status === 'RESERVED') {
        reserved_total++;
      } else if (d.status === 'SOLD') {
        sold_total++;
      } else if (d.status === 'MAINTENANCE') {
        maintenance_total++;
      } else if (d.status === 'RETURNED') {
        returned_total++;
      }

      // Cost and retail value for active physical devices (not sold)
      if (d.status !== 'SOLD') {
        total_cost_value += d.purchase_cost;
        total_retail_value += d.list_price;
      }
    });

    return {
      total_units: devices.length,
      available_total,
      available_shop1,
      available_shop2,
      reserved_total,
      sold_total,
      maintenance_total,
      returned_total,
      total_cost_value,
      total_retail_value,
    };
  },
};
