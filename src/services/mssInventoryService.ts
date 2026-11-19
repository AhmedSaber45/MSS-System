import { supabase } from '../lib/supabase.ts';
import { getTodayLocalDateString } from '../lib/dateValidation.ts';
import { mssCatalogService } from './mssCatalogService.ts';
import { mssSyncService } from './mssSyncService.ts';
import { backupService } from './backupService.ts';
import type {
  MSSDevice,
  NewMSSDeviceInput,
  UpdateMSSDeviceInput,
  MSSDeviceMovement,
  TransferDeviceInput,
  MSSInventorySummary,
  MSSStockLocation,
  MSSDeviceStatus,
  NewMSSBulkStockInput,
  AssignSerialsInput,
  MSSModelInventorySummary,
} from '../types/mssInventory.ts';
import type { ModelStockQuantitySummary } from '../types/mssReports.ts';

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
    return Array.isArray(parsed) ? parsed : INITIAL_SEED_DEVICES;
  } catch {
    return INITIAL_SEED_DEVICES;
  }
}

function saveCachedDevices(devices: MSSDevice[]): void {
  localStorage.setItem(MSS_DEVICES_CACHE_KEY, JSON.stringify(devices));
}

const MSS_DELETED_DEVICES_KEY = 'shop_mss_deleted_devices_v1';

function getDeletedDeviceIds(): Set<string> {
  try {
    const raw = localStorage.getItem(MSS_DELETED_DEVICES_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function addDeletedDeviceId(id: string): void {
  try {
    const set = getDeletedDeviceIds();
    set.add(id);
    localStorage.setItem(MSS_DELETED_DEVICES_KEY, JSON.stringify(Array.from(set)));
  } catch {
    // ignore
  }
}

function removeDeletedDeviceId(id: string): void {
  try {
    const set = getDeletedDeviceIds();
    if (set.has(id)) {
      set.delete(id);
      localStorage.setItem(MSS_DELETED_DEVICES_KEY, JSON.stringify(Array.from(set)));
    }
  } catch {
    // ignore
  }
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
        const cloudDevices = data.map((row: any) => ({
          id: row.id,
          serial_number: row.serial_number || null,
          is_serialized: row.is_serialized !== undefined ? Boolean(row.is_serialized) : Boolean(row.serial_number),
          quantity: Number(row.quantity) || 1,
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
        const deletedIds = getDeletedDeviceIds();
        const localCached = getCachedDevices();
        const mergedMap = new Map<string, MSSDevice>();
        for (const cd of cloudDevices) {
          if (deletedIds.has(cd.id)) continue;
          const key = cd.id || (cd.serial_number ? `sn-${cd.serial_number}` : `id-${Math.random()}`);
          mergedMap.set(key, cd);
        }
        for (const ld of localCached) {
          if (deletedIds.has(ld.id)) continue;
          const key = ld.id || (ld.serial_number ? `sn-${ld.serial_number}` : `id-${Math.random()}`);
          if (!mergedMap.has(key)) {
            mergedMap.set(key, ld);
          }
        }
        for (const sd of INITIAL_SEED_DEVICES) {
          if (deletedIds.has(sd.id)) continue;
          const key = sd.id || (sd.serial_number ? `sn-${sd.serial_number}` : `id-${Math.random()}`);
          if (!mergedMap.has(key)) {
            mergedMap.set(key, sd);
          }
        }
        devices = Array.from(mergedMap.values());
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
          (d.serial_number && d.serial_number.toLowerCase().includes(q)) ||
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
    if (!serial || !serial.trim()) return null;
    const s = serial.trim().toUpperCase();
    const devices = await this.getDevices();
    return devices.find(d => d.serial_number && d.serial_number.toUpperCase() === s) || null;
  },

  /**
   * Register a new individual physical device unit (with or without serial number)
   */
  async createDevice(input: NewMSSDeviceInput): Promise<MSSDevice> {
    const rawSerial = typeof input.serial_number === 'string' ? input.serial_number.trim() : null;
    const serial = rawSerial && rawSerial.length > 0 ? rawSerial.toUpperCase() : null;
    const isSerialized = Boolean(serial);

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

    const cached = getCachedDevices();

    // Check duplicate serial number locally if serialized
    if (isSerialized && serial) {
      const isDuplicate = cached.some(
        d => d.serial_number && d.serial_number.toUpperCase() === serial
      );
      if (isDuplicate) {
        throw new Error(`السيريال نمبر (${serial}) مسجل مسبقاً في النظام. يمنع تكرار السيريالات.`);
      }
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
      is_serialized: isSerialized,
      quantity: input.quantity && input.quantity > 0 ? Math.floor(input.quantity) : 1,
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
          id: newDevice.id,
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
      } else if (error && error.code === '23505' && serial) {
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
        newDevice.serial_number
          ? `تسجيل جهاز جديد بالسيريال (${newDevice.serial_number}) بمخزون (${newDevice.stock_location})`
          : `تسجيل جهاز بدون سيريال (${model.model_name}) بمخزون (${newDevice.stock_location})`,
        newDevice.stock_location
      )
      .catch(console.warn);

    backupService.notifyDataChanged(
      newDevice.serial_number
        ? `تسجيل جهاز MSS: ${newDevice.serial_number}`
        : `تسجيل جهاز MSS بدون سيريال: ${model.model_name}`
    );

    return newDevice;
  },

  /**
   * Register bulk non-serialized inventory by model and quantity
   */
  async createBulkStock(input: NewMSSBulkStockInput): Promise<MSSDevice> {
    const qty = Math.floor(input.quantity);
    if (!qty || qty <= 0) {
      throw new Error('كمية المخزون غير المسلسل يجب أن تكون عدداً صحيحاً أكبر من صفر');
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

    const model = await mssCatalogService.getModelById(input.model_id);
    if (!model) {
      throw new Error('الموديل المحدد غير موجود في كتالوج MSS');
    }

    const today = getTodayLocalDateString();
    const purchaseDate = input.purchase_date || today;
    if (purchaseDate > today) {
      throw new Error(`تاريخ الشراء (${purchaseDate}) لا يمكن أن يكون في المستقبل.`);
    }

    const newId = 'dev-bulk-' + Math.random().toString(36).substring(2, 9) + '-' + Date.now().toString(36);
    const now = new Date().toISOString();

    const bulkDevice: MSSDevice = {
      id: newId,
      serial_number: null,
      is_serialized: false,
      quantity: qty,
      model_id: input.model_id,
      purchase_cost: input.purchase_cost,
      list_price: input.list_price || model.default_list_price,
      purchase_date: purchaseDate,
      physical_condition: input.physical_condition?.trim() || 'فرز أول ممتاز',
      stock_location: input.stock_location,
      status: 'AVAILABLE',
      notes: input.notes?.trim() || null,
      created_at: now,
      updated_at: now,
      model,
      model_name: model.model_name,
      brand: model.brand,
      category: model.category,
    };

    const cached = getCachedDevices();
    cached.unshift(bulkDevice);
    saveCachedDevices(cached);

    // Try remote insert to Supabase
    try {
      await supabase.from('mss_devices').insert({
        id: bulkDevice.id,
        serial_number: null,
        model_id: bulkDevice.model_id,
        purchase_cost: bulkDevice.purchase_cost,
        list_price: bulkDevice.list_price,
        purchase_date: bulkDevice.purchase_date,
        physical_condition: bulkDevice.physical_condition,
        stock_location: bulkDevice.stock_location,
        status: bulkDevice.status,
        notes: bulkDevice.notes,
      });
    } catch (err) {
      console.warn('Supabase bulk stock insert failed, cached locally:', err);
    }

    // Queue in Outbox
    mssSyncService
      .queueOperation(
        'DEVICE_ADD',
        bulkDevice,
        `إضافة دفعة مخزون مجمعة غير مسلسلة (${bulkDevice.quantity} وحدة) للموديل ${model.brand} ${model.model_name} بموقع (${bulkDevice.stock_location})`,
        bulkDevice.stock_location
      )
      .catch(console.warn);

    backupService.notifyDataChanged(`إضافة مخزون MSS غير مسلسل: ${model.model_name} (${qty} جهاز)`);

    return bulkDevice;
  },

  /**
   * Assign serial numbers to previously non-serialized stock (Partial or full conversion)
   */
  async assignSerialsToBulkStock(input: AssignSerialsInput): Promise<{
    convertedDevices: MSSDevice[];
    remainingStock: MSSDevice | null;
  }> {
    const cached = getCachedDevices();
    const stockIndex = cached.findIndex(d => d.id === input.stock_id);
    if (stockIndex < 0) {
      throw new Error('دفعة المخزون غير المسلسل غير موجودة');
    }

    const stock = cached[stockIndex];
    if (stock.status !== 'AVAILABLE') {
      throw new Error(`لا يمكن تحويل مخزون بحالة (${stock.status})، يجب أن يكون متاحاً للبيع.`);
    }

    const currentQty = stock.quantity && stock.quantity > 0 ? stock.quantity : 1;

    // Clean and validate serial numbers list
    if (!Array.isArray(input.serial_numbers) || input.serial_numbers.length === 0) {
      throw new Error('يرجى إدخال رقم سيريال واحد على الأقل للتعيين');
    }

    const cleanedSerials = input.serial_numbers
      .map(s => (typeof s === 'string' ? s.trim().toUpperCase() : ''))
      .filter(Boolean);

    if (cleanedSerials.length === 0) {
      throw new Error('يرجى إدخال أرقام سيريال صحيحة وغير فارغة');
    }

    const count = cleanedSerials.length;
    if (count > currentQty) {
      throw new Error(
        `عدد أرقام السيريال المدخلة (${count}) يتجاوز الكمية المتاحة في هذه الدفعة (${currentQty})`
      );
    }

    // Check duplicate within the input array
    const uniqueInput = new Set(cleanedSerials);
    if (uniqueInput.size !== cleanedSerials.length) {
      throw new Error('يوجد تكرار في أرقام السيريال المدخلة في نفس العملية');
    }

    // Check duplicate against existing serialized devices
    for (const s of cleanedSerials) {
      const exists = cached.some(
        d => d.serial_number && d.serial_number.toUpperCase() === s
      );
      if (exists) {
        throw new Error(`السيريال نمبر (${s}) مسجل مسبقاً في النظام. يرجى إدخال سيريال فريد.`);
      }
    }

    // Prepare converted devices
    const now = new Date().toISOString();
    const convertedDevices: MSSDevice[] = [];

    for (const s of cleanedSerials) {
      const devId = 'dev-' + Math.random().toString(36).substring(2, 9) + '-' + Date.now().toString(36);
      const newDev: MSSDevice = {
        id: devId,
        serial_number: s,
        is_serialized: true,
        quantity: 1,
        model_id: stock.model_id,
        purchase_cost: stock.purchase_cost,
        list_price: stock.list_price,
        purchase_date: stock.purchase_date,
        physical_condition: stock.physical_condition,
        stock_location: stock.stock_location,
        status: 'AVAILABLE',
        notes: `تم التعيين والتحويل من مخزون غير مسلسل (الدفعة: ${stock.id})${input.notes ? ' - ' + input.notes : ''}`,
        created_at: now,
        updated_at: now,
        model: stock.model,
        model_name: stock.model_name,
        brand: stock.brand,
        category: stock.category,
      };
      convertedDevices.push(newDev);
    }

    // Adjust remaining non-serialized quantity
    const remainingQty = currentQty - count;
    let remainingStock: MSSDevice | null = null;

    if (remainingQty > 0) {
      stock.quantity = remainingQty;
      stock.updated_at = now;
      cached[stockIndex] = stock;
      remainingStock = stock;
    } else {
      // All units in this batch were converted
      cached.splice(stockIndex, 1);
      addDeletedDeviceId(stock.id);
      remainingStock = null;
    }

    // Insert newly serialized units
    cached.unshift(...convertedDevices);
    saveCachedDevices(cached);

    // Record in inventory movement history / audit trail
    const movements = getCachedMovements();
    for (const dev of convertedDevices) {
      const movId = 'mov-' + Math.random().toString(36).substring(2, 9) + '-' + Date.now().toString(36);
      const mov: MSSDeviceMovement = {
        id: movId,
        device_id: dev.id,
        serial_number: dev.serial_number,
        from_location: stock.stock_location,
        to_location: stock.stock_location,
        movement_date: now,
        movement_status: 'COMPLETED',
        notes: `تحويل من مخزون مجمع غير مسلسل (الدفعة: ${stock.id}) وتعيين سيريال (${dev.serial_number})`,
        created_at: now,
        model_name: dev.model_name,
        brand: dev.brand,
      };
      movements.unshift(mov);

      try {
        await supabase.from('mss_device_movements').insert({
          id: mov.id,
          device_id: mov.device_id,
          serial_number: mov.serial_number,
          from_location: mov.from_location,
          to_location: mov.to_location,
          movement_date: mov.movement_date,
          movement_status: mov.movement_status,
          notes: mov.notes,
        });
      } catch {
        // Silently handled in local cache fallback
      }
    }
    saveCachedMovements(movements);

    // Supabase sync & logging
    try {
      for (const d of convertedDevices) {
        await supabase.from('mss_devices').insert({
          id: d.id,
          serial_number: d.serial_number,
          model_id: d.model_id,
          purchase_cost: d.purchase_cost,
          list_price: d.list_price,
          purchase_date: d.purchase_date,
          physical_condition: d.physical_condition,
          stock_location: d.stock_location,
          status: d.status,
          notes: d.notes,
        });
      }
      if (remainingQty > 0) {
        await supabase.from('mss_devices').update({ quantity: remainingQty, updated_at: now }).eq('id', stock.id);
      } else {
        await supabase.from('mss_devices').delete().eq('id', stock.id);
      }
    } catch (err) {
      console.warn('Supabase assign serials failed, cached locally:', err);
    }

    // Outbox operation
    mssSyncService
      .queueOperation(
        'DEVICE_ADD',
        {
          convertedCount: count,
          remainingQty,
          serials: cleanedSerials,
          stockLocation: stock.stock_location,
        },
        `تعيين سيريالات لـ (${count}) أجهزة من مخزون غير مسلسل بموقع (${stock.stock_location})`,
        stock.stock_location
      )
      .catch(console.warn);

    backupService.notifyDataChanged(`تعيين سيريالات MSS: ${count} أجهزة`);

    return { convertedDevices, remainingStock };
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
    let updatedSerial = current.serial_number;
    let updatedIsSerialized = current.is_serialized;
    if (input.serial_number !== undefined) {
      const raw = input.serial_number?.trim();
      const newSerial = raw && raw.length > 0 ? raw.toUpperCase() : null;
      if (newSerial && (!current.serial_number || newSerial !== current.serial_number.toUpperCase())) {
        const isDuplicate = cached.some(
          d => d.id !== id && d.serial_number && d.serial_number.toUpperCase() === newSerial
        );
        if (isDuplicate) {
          throw new Error(`السيريال نمبر (${newSerial}) مستخدم بالفعل لجهاز آخر.`);
        }
      }
      updatedSerial = newSerial;
      updatedIsSerialized = Boolean(newSerial);
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
      serial_number: updatedSerial,
      is_serialized: updatedIsSerialized,
      quantity: input.quantity !== undefined ? input.quantity : current.quantity,
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

    backupService.notifyDataChanged(`تحديث بيانات جهاز MSS: ${updated.serial_number}`);

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
    addDeletedDeviceId(id);
    saveCachedDevices(filtered);
    backupService.notifyDataChanged(`حذف جهاز MSS: ${device.serial_number}`);
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

    backupService.notifyDataChanged(`نقل جهاز MSS بين المحلين: ${newMovement.serial_number}`);

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
        const cloudMovements = data.map((row: any) => ({
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
        const localCached = getCachedMovements();
        const mergedMap = new Map<string, MSSDeviceMovement>();
        for (const cm of cloudMovements) {
          mergedMap.set(cm.id, cm);
        }
        for (const lm of localCached) {
          if (!mergedMap.has(lm.id)) {
            mergedMap.set(lm.id, lm);
          }
        }
        for (const sm of INITIAL_SEED_MOVEMENTS) {
          if (!mergedMap.has(sm.id)) {
            mergedMap.set(sm.id, sm);
          }
        }
        movements = Array.from(mergedMap.values());
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
          (m.serial_number && m.serial_number.toLowerCase().includes(q)) ||
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
    let available_serialized_total = 0;
    let available_non_serialized_total = 0;
    let reserved_total = 0;
    let sold_total = 0;
    let maintenance_total = 0;
    let returned_total = 0;
    let total_cost_value = 0;
    let total_retail_value = 0;
    let total_units = 0;

    devices.forEach(d => {
      const qty = d.quantity && d.quantity > 0 ? d.quantity : 1;
      const isSer = Boolean(d.serial_number && d.is_serialized !== false);

      total_units += qty;

      if (d.status === 'AVAILABLE') {
        available_total += qty;
        if (isSer) {
          available_serialized_total += qty;
        } else {
          available_non_serialized_total += qty;
        }
        if (d.stock_location === 'محل 1') available_shop1 += qty;
        if (d.stock_location === 'محل 2') available_shop2 += qty;
      } else if (d.status === 'RESERVED') {
        reserved_total += qty;
      } else if (d.status === 'SOLD') {
        sold_total += qty;
      } else if (d.status === 'MAINTENANCE') {
        maintenance_total += qty;
      } else if (d.status === 'RETURNED') {
        returned_total += qty;
      }

      // Cost and retail value for active physical devices (not sold)
      if (d.status !== 'SOLD') {
        total_cost_value += d.purchase_cost * qty;
        total_retail_value += d.list_price * qty;
      }
    });

    return {
      total_units,
      available_total,
      available_serialized_total,
      available_non_serialized_total,
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

  /**
   * Model-based inventory summary grouped by model and branch context.
   * Strictly guarantees: Total Units = Existing Units + Sold Units.
   * Accounts for both serialized devices and non-serialized bulk stock (including sold bulk stock).
   */
  async getModelInventorySummary(filters?: {
    branch?: string;
    search?: string;
  }): Promise<MSSModelInventorySummary[]> {
    const [devices, models] = await Promise.all([
      this.getDevices(),
      mssCatalogService.getModels(),
    ]);

    // Load active invoices dynamically to avoid circular dependencies
    let activeInvoices: any[] = [];
    try {
      const { mssCommerceService } = await import('./mssCommerceService.ts');
      const invoices = await mssCommerceService.getInvoices();
      activeInvoices = invoices.filter(inv => !inv.is_returned);
    } catch (e) {
      console.warn('Could not load invoices for model summary:', e);
    }

    const modelMap = new Map(models.map(m => [m.id, m]));
    const groupMap = new Map<string, MSSModelInventorySummary>();

    // Track serialized device IDs already counted as SOLD in the devices list
    const recordedSoldDeviceIds = new Set<string>();

    for (const d of devices) {
      const model = modelMap.get(d.model_id);
      const branch = d.stock_location || 'محل 1';
      const key = `${d.model_id}:::${branch}`;

      if (!groupMap.has(key)) {
        groupMap.set(key, {
          model_id: d.model_id,
          model_name: model?.model_name || d.model_name || 'غير محدد',
          brand: model?.brand || d.brand || '',
          model_code: (model as any)?.model_code || '',
          category: model?.category || d.category || 'أخرى',
          branch,
          available_serialized: 0,
          available_non_serialized: 0,
          total_available: 0,
          existing_units: 0,
          total_units: 0,
          reserved_count: 0,
          sold_count: 0,
          maintenance_count: 0,
          devices: [],
        });
      }

      const acc = groupMap.get(key)!;
      const qty = d.quantity && d.quantity > 0 ? d.quantity : 1;
      const isSer = Boolean(d.serial_number && d.is_serialized !== false);

      acc.devices.push(d);

      if (d.status === 'AVAILABLE') {
        acc.total_available += qty;
        acc.existing_units += qty;
        if (isSer) {
          acc.available_serialized += qty;
        } else {
          acc.available_non_serialized += qty;
        }
      } else if (d.status === 'RESERVED') {
        acc.reserved_count += qty;
        acc.existing_units += qty;
      } else if (d.status === 'SOLD') {
        acc.sold_count += qty;
        if (d.id) recordedSoldDeviceIds.add(d.id);
      } else if (d.status === 'MAINTENANCE') {
        acc.maintenance_count += qty;
        acc.existing_units += qty;
      }
    }

    // Account for sold units from active invoices (especially non-serialized bulk stock sales)
    for (const inv of activeInvoices) {
      const items = (Array.isArray(inv.items) && inv.items.length > 0)
        ? inv.items
        : [{
            device_id: inv.device_id,
            model_id: inv.model_id,
            serial_number: inv.serial_number,
            quantity: 1,
            source_branch: inv.source_branch || inv.selling_branch,
            brand: inv.brand,
            model_name: inv.model_name,
            category: inv.category,
          }];

      for (const it of items) {
        // Avoid duplicate counting if this physical device was already counted as SOLD in the devices table
        if (it.device_id && recordedSoldDeviceIds.has(it.device_id)) {
          continue;
        }

        const modelId = it.model_id || inv.model_id;
        if (!modelId) continue;

        const branch = it.source_branch || inv.source_branch || inv.selling_branch || 'محل 1';
        const key = `${modelId}:::${branch}`;

        if (!groupMap.has(key)) {
          const model = modelMap.get(modelId);
          groupMap.set(key, {
            model_id: modelId,
            model_name: model?.model_name || it.model_name || inv.model_name || 'غير محدد',
            brand: model?.brand || it.brand || inv.brand || '',
            model_code: (model as any)?.model_code || '',
            category: model?.category || it.category || inv.category || 'أخرى',
            branch,
            available_serialized: 0,
            available_non_serialized: 0,
            total_available: 0,
            existing_units: 0,
            total_units: 0,
            reserved_count: 0,
            sold_count: 0,
            maintenance_count: 0,
            devices: [],
          });
        }

        const acc = groupMap.get(key)!;
        const qty = Number(it.quantity) || 1;
        acc.sold_count += qty;
      }
    }

    // Ensure strictly: Total Units = Existing Units + Sold Units
    for (const acc of groupMap.values()) {
      acc.existing_units = acc.total_available + acc.reserved_count + acc.maintenance_count;
      acc.total_units = acc.existing_units + acc.sold_count;
    }

    let summaries = Array.from(groupMap.values());

    // Apply branch filter
    if (filters?.branch && filters.branch !== 'ALL') {
      summaries = summaries.filter(s => s.branch === filters.branch);
    }

    // Apply search filter (model_name, brand, model_code, category)
    if (filters?.search && filters.search.trim()) {
      const q = filters.search.trim().toLowerCase();
      summaries = summaries.filter(
        s =>
          s.model_name.toLowerCase().includes(q) ||
          s.brand.toLowerCase().includes(q) ||
          s.model_code.toLowerCase().includes(q) ||
          s.category.toLowerCase().includes(q)
      );
    }

    // Sort by brand then model_name
    summaries.sort((a, b) => a.brand.localeCompare(b.brand) || a.model_name.localeCompare(b.model_name));

    return summaries;
  },

  /**
   * Complete cross-warehouse Model Stock Quantity Summary.
   * Provides: Total Units = Existing Units + Sold Units across all models and per warehouse.
   */
  async getModelStockQuantitySummary(filters?: {
    branch?: string;
    search?: string;
  }): Promise<ModelStockQuantitySummary[]> {
    const [summaries, models] = await Promise.all([
      this.getModelInventorySummary({ search: filters?.search }),
      mssCatalogService.getModels(),
    ]);

    const modelMap = new Map(models.map(m => [m.id, m]));
    const aggregateMap = new Map<string, ModelStockQuantitySummary>();

    for (const s of summaries) {
      if (!aggregateMap.has(s.model_id)) {
        const model = modelMap.get(s.model_id);
        aggregateMap.set(s.model_id, {
          model_id: s.model_id,
          brand: s.brand,
          model_name: s.model_name,
          model_code: s.model_code,
          category: s.category,
          specifications: model?.specifications || '',
          total_units: 0,
          existing_units: 0,
          sold_units: 0,
          existing_serialized: 0,
          existing_non_serialized: 0,
          status_breakdown: {
            available: 0,
            reserved: 0,
            maintenance: 0,
            returned: 0,
          },
          warehouse_breakdown: {},
        });
      }

      const agg = aggregateMap.get(s.model_id)!;
      const branch = s.branch;

      // Existing units for this branch
      const branchExisting = s.existing_units;
      const branchSold = s.sold_count;
      const branchTotal = branchExisting + branchSold;

      agg.warehouse_breakdown[branch] = {
        existing_units: branchExisting,
        sold_units: branchSold,
        total_units: branchTotal,
        existing_serialized: s.available_serialized,
        existing_non_serialized: s.available_non_serialized,
      };

      agg.existing_units += branchExisting;
      agg.sold_units += branchSold;
      agg.total_units += branchTotal;
      agg.existing_serialized += s.available_serialized;
      agg.existing_non_serialized += s.available_non_serialized;

      agg.status_breakdown.available += s.total_available;
      agg.status_breakdown.reserved += s.reserved_count;
      agg.status_breakdown.maintenance += s.maintenance_count;
    }

    let results = Array.from(aggregateMap.values());

    // If branch filter applied, only keep items that have stock in that branch
    if (filters?.branch && filters.branch !== 'ALL') {
      results = results.filter(r => r.warehouse_breakdown[filters.branch!] !== undefined);
    }

    // Strictly guarantee: Total Units = Existing Units + Sold Units
    for (const r of results) {
      r.total_units = r.existing_units + r.sold_units;
    }

    results.sort((a, b) => a.brand.localeCompare(b.brand) || a.model_name.localeCompare(b.model_name));
    return results;
  },
};
