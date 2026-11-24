import { supabase } from '../lib/supabase.ts';
import { getTodayLocalDateString } from '../lib/dateValidation.ts';
import { generateUUID, safeStorage } from '../lib/utils.ts';
import { mssCatalogService } from './mssCatalogService.ts';
import { mssSyncService } from './mssSyncService.ts';
import { backupService } from './backupService.ts';
import { mssOperationalService } from './mssOperationalService.ts';
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
  MSSStockAdjustment,
  StockAdjustmentInput,
} from '../types/mssInventory.ts';
import type { ModelStockQuantitySummary } from '../types/mssReports.ts';

const MSS_DEVICES_CACHE_KEY = 'shop_mss_devices_cache_v1';
const MSS_MOVEMENTS_CACHE_KEY = 'shop_mss_movements_cache_v1';
const MSS_PENDING_DEVICES_CACHE_KEY = 'shop_mss_pending_devices_cache_v1';

function getPendingDevices(): MSSDevice[] {
  try {
    const raw = safeStorage.getItem(MSS_PENDING_DEVICES_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function savePendingDevices(devices: MSSDevice[]): void {
  try {
    safeStorage.setItem(MSS_PENDING_DEVICES_CACHE_KEY, JSON.stringify(devices));
  } catch {
    // ignore
  }
}

function addPendingDevice(device: MSSDevice): void {
  const pending = getPendingDevices();
  const index = pending.findIndex(d => d.id === device.id);
  if (index >= 0) {
    pending[index] = device;
  } else {
    pending.push(device);
  }
  savePendingDevices(pending);
}

function removePendingDevice(id: string): void {
  const pending = getPendingDevices();
  const filtered = pending.filter(d => d.id !== id);
  savePendingDevices(filtered);
}

function getCachedDevices(): MSSDevice[] {
  try {
    const raw = safeStorage.getItem(MSS_DEVICES_CACHE_KEY);
    if (!raw) {
      safeStorage.setItem(MSS_DEVICES_CACHE_KEY, JSON.stringify([]));
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveCachedDevices(devices: MSSDevice[]): void {
  safeStorage.setItem(MSS_DEVICES_CACHE_KEY, JSON.stringify(devices));
}

const MSS_DELETED_DEVICES_KEY = 'shop_mss_deleted_devices_v1';

function getDeletedDeviceIds(): Set<string> {
  try {
    const raw = safeStorage.getItem(MSS_DELETED_DEVICES_KEY);
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
    safeStorage.setItem(MSS_DELETED_DEVICES_KEY, JSON.stringify(Array.from(set)));
  } catch {
    // ignore
  }
}

function removeDeletedDeviceId(id: string): void {
  try {
    const set = getDeletedDeviceIds();
    if (set.has(id)) {
      set.delete(id);
      safeStorage.setItem(MSS_DELETED_DEVICES_KEY, JSON.stringify(Array.from(set)));
    }
  } catch {
    // ignore
  }
}

function getCachedMovements(): MSSDeviceMovement[] {
  try {
    const raw = safeStorage.getItem(MSS_MOVEMENTS_CACHE_KEY);
    if (!raw) {
      safeStorage.setItem(MSS_MOVEMENTS_CACHE_KEY, JSON.stringify([]));
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveCachedMovements(movements: MSSDeviceMovement[]): void {
  safeStorage.setItem(MSS_MOVEMENTS_CACHE_KEY, JSON.stringify(movements));
}

const MSS_STOCK_ADJUSTMENTS_CACHE_KEY = 'shop_mss_stock_adjustments_cache_v1';

function getCachedAdjustments(): MSSStockAdjustment[] {
  try {
    const raw = safeStorage.getItem(MSS_STOCK_ADJUSTMENTS_CACHE_KEY);
    if (!raw) {
      safeStorage.setItem(MSS_STOCK_ADJUSTMENTS_CACHE_KEY, JSON.stringify([]));
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveCachedAdjustments(adjustments: MSSStockAdjustment[]): void {
  try {
    safeStorage.setItem(MSS_STOCK_ADJUSTMENTS_CACHE_KEY, JSON.stringify(adjustments));
  } catch {
    // ignore
  }
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

      if (!error && Array.isArray(data)) {
        const deletedIds = getDeletedDeviceIds();
        const pendingDevices = getPendingDevices();

        const cloudDevices: MSSDevice[] = data
          .filter((row: any) => !deletedIds.has(row.id))
          .map((row: any) => ({
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
            _synced: true,
          }));

        // Merge pending devices that are not yet in cloud
        const cloudIds = new Set(cloudDevices.map(d => d.id));
        const mergedDevices = [...cloudDevices];
        for (const pd of pendingDevices) {
          if (!cloudIds.has(pd.id) && !deletedIds.has(pd.id)) {
            mergedDevices.push({ ...pd, _synced: false });
          }
        }

        devices = mergedDevices;
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

    const activeLocations = await mssOperationalService.getActiveLocationNames();
    if (!activeLocations.includes(input.stock_location)) {
      throw new Error(`موقع التخزين غير صالح (${input.stock_location}). المواقع المتاحة: ${activeLocations.join('، ')}`);
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

    const newId = generateUUID();
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
      list_price: typeof input.list_price === 'number' ? input.list_price : (model.default_list_price || 0),
      purchase_date: purchaseDate,
      physical_condition: input.physical_condition?.trim() || 'فرز أول',
      stock_location: input.stock_location,
      status: input.status || 'AVAILABLE',
      notes: input.notes?.trim() || null,
      created_at: now,
      updated_at: now,
      _synced: false,
      model,
      model_name: model.model_name,
      brand: model.brand,
      category: model.category,
    };

    let synced = false;
    // Try remote insert to Supabase
    try {
      const { data, error } = await supabase
        .from('mss_devices')
        .insert({
          id: newDevice.id,
          serial_number: newDevice.serial_number,
          is_serialized: newDevice.is_serialized ?? Boolean(newDevice.serial_number),
          quantity: newDevice.quantity && newDevice.quantity > 0 ? newDevice.quantity : 1,
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
        synced = true;
        newDevice.id = data.id;
        newDevice.quantity = Number(data.quantity) || newDevice.quantity;
        newDevice.is_serialized = data.is_serialized !== undefined ? Boolean(data.is_serialized) : Boolean(newDevice.serial_number);
        newDevice.created_at = data.created_at;
        newDevice.updated_at = data.updated_at;
        newDevice._synced = true;
      } else if (error) {
        if (error.code === '23505' && serial) {
          throw new Error(`السيريال نمبر (${serial}) موجود مسبقاً في قاعدة البيانات السحابية.`);
        } else if (error.code === '23502' && error.message?.includes('serial_number')) {
          throw new Error('قاعدة البيانات السحابية تتطلب إدخال سيريال نمبر (يرجى إدخال سيريال للجهاز أو تطبيق ملف ترحيل SQL المرفق للسماح بالأجهزة بدون سيريال).');
        } else if (error.code === '23503') {
          throw new Error(`تعذر حفظ الجهاز: الموديل المحدد (${model.model_name}) غير موجود أو غير متزامن سحابياً بعد.`);
        } else {
          console.warn('Supabase insert device error, fallback to offline sync:', error);
        }
      }
    } catch (err: any) {
      if (err.message && (err.message.includes('موجود مسبقاً') || err.message.includes('تتطلب إدخال سيريال') || err.message.includes('غير متزامن سحابياً'))) {
        throw err;
      }
      console.warn('Supabase insert device network failure, cached locally for sync:', err);
    }

    if (synced) {
      removePendingDevice(newDevice.id);
    } else {
      addPendingDevice(newDevice);
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
    }

    cached.unshift(newDevice);
    saveCachedDevices(cached);

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
    const activeLocations = await mssOperationalService.getActiveLocationNames();
    if (!activeLocations.includes(input.stock_location)) {
      throw new Error(`موقع التخزين غير صالح (${input.stock_location}). المواقع المتاحة: ${activeLocations.join('، ')}`);
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

    const newId = generateUUID();
    const now = new Date().toISOString();

    const bulkDevice: MSSDevice = {
      id: newId,
      serial_number: null,
      is_serialized: false,
      quantity: qty,
      model_id: input.model_id,
      purchase_cost: input.purchase_cost,
      list_price: typeof input.list_price === 'number' ? input.list_price : (model.default_list_price || 0),
      purchase_date: purchaseDate,
      physical_condition: input.physical_condition?.trim() || 'فرز أول ممتاز',
      stock_location: input.stock_location,
      status: 'AVAILABLE',
      notes: input.notes?.trim() || null,
      created_at: now,
      updated_at: now,
      _synced: false,
      model,
      model_name: model.model_name,
      brand: model.brand,
      category: model.category,
    };

    let synced = false;
    // Try remote insert to Supabase
    try {
      const { data, error } = await supabase
        .from('mss_devices')
        .insert({
          id: bulkDevice.id,
          serial_number: null,
          is_serialized: false,
          quantity: bulkDevice.quantity,
          model_id: bulkDevice.model_id,
          purchase_cost: bulkDevice.purchase_cost,
          list_price: bulkDevice.list_price,
          purchase_date: bulkDevice.purchase_date,
          physical_condition: bulkDevice.physical_condition,
          stock_location: bulkDevice.stock_location,
          status: bulkDevice.status,
          notes: bulkDevice.notes,
        })
        .select()
        .single();

      if (!error && data) {
        synced = true;
        bulkDevice.id = data.id;
        bulkDevice.quantity = Number(data.quantity) || bulkDevice.quantity;
        bulkDevice.is_serialized = data.is_serialized !== undefined ? Boolean(data.is_serialized) : false;
        bulkDevice.created_at = data.created_at;
        bulkDevice.updated_at = data.updated_at;
        bulkDevice._synced = true;
      } else if (error) {
        if (error.code === '23502' && error.message?.includes('serial_number')) {
          throw new Error('قاعدة البيانات السحابية لا تدعم المخزون غير المسلسل حالياً لأن عمود serial_number مفروض كـ NOT NULL. يرجى تطبيق ملف الترحيل SQL المرفق لتمكين المخزون المجمع.');
        } else if (error.code === '23503') {
          throw new Error(`تعذر حفظ المخزون: الموديل المحدد (${model.model_name}) غير موجود أو غير متزامن سحابياً بعد.`);
        } else {
          console.warn('Supabase bulk stock insert error, caching locally for sync:', error);
        }
      }
    } catch (err: any) {
      if (err.message && (err.message.includes('لا تدعم المخزون') || err.message.includes('غير متزامن سحابياً'))) {
        throw err;
      }
      console.warn('Supabase bulk stock insert failed, cached locally for sync:', err);
    }

    if (synced) {
      removePendingDevice(bulkDevice.id);
    } else {
      addPendingDevice(bulkDevice);
      // Queue in Outbox
      mssSyncService
        .queueOperation(
          'DEVICE_ADD',
          bulkDevice,
          `إضافة دفعة مخزون مجمعة غير مسلسلة (${bulkDevice.quantity} وحدة) للموديل ${model.brand} ${model.model_name} بموقع (${bulkDevice.stock_location})`,
          bulkDevice.stock_location
        )
        .catch(console.warn);
    }

    const cached = getCachedDevices();
    cached.unshift(bulkDevice);
    saveCachedDevices(cached);

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
      const devId = generateUUID();
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
      const movId = generateUUID();
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
          is_serialized: true,
          quantity: 1,
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

    if (input.stock_location) {
      const activeLocations = await mssOperationalService.getActiveLocationNames();
      if (!activeLocations.includes(input.stock_location)) {
        throw new Error(`موقع التخزين غير صالح (${input.stock_location}). المواقع المتاحة: ${activeLocations.join('، ')}`);
      }
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
          is_serialized: updated.is_serialized,
          quantity: updated.quantity,
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
   * Supports both serialized devices (1 unit) and bulk devices (partial or full transfer)
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

    const activeLocations = await mssOperationalService.getActiveLocationNames();
    if (!activeLocations.includes(toLocation)) {
      throw new Error(`المحل أو المخزن الهدف غير صالح (${toLocation}). المواقع المتاحة: ${activeLocations.join('، ')}`);
    }

    const now = new Date().toISOString();
    const movementId = generateUUID();

    const deviceQty = device.quantity && device.quantity > 0 ? device.quantity : 1;
    const isSerialized = Boolean(device.serial_number && device.is_serialized !== false);
    const transferQty = isSerialized
      ? 1
      : (input.quantity !== undefined && input.quantity > 0 ? Math.floor(input.quantity) : deviceQty);

    if (transferQty <= 0) {
      throw new Error('كمية النقل يجب أن تكون رقماً صحيحاً أكبر من صفر');
    }

    if (transferQty > deviceQty) {
      throw new Error(`الكمية المراد نقلها (${transferQty}) أكبر من الكمية المتاحة (${deviceQty})`);
    }

    const isPartialBulkTransfer = !isSerialized && transferQty < deviceQty;

    const newMovement: MSSDeviceMovement = {
      id: movementId,
      device_id: device.id,
      serial_number: device.serial_number,
      from_location: fromLocation,
      to_location: toLocation,
      movement_date: now,
      movement_status: 'COMPLETED',
      notes: `${input.notes?.trim() || 'نقل فعلي بين المحلين'}${!isSerialized ? ` (الكمية المنقولة: ${transferQty} وحدة)` : ''}`,
      created_at: now,
      model_name: device.model_name,
      brand: device.brand,
    };

    if (isPartialBulkTransfer) {
      // Deduct from source bulk lot
      device.quantity = deviceQty - transferQty;
      device.updated_at = now;
      cached[deviceIndex] = device;

      try {
        await supabase
          .from('mss_devices')
          .update({ quantity: device.quantity, updated_at: now })
          .eq('id', device.id);
      } catch (err) {
        console.warn('Supabase update source bulk device failed, recorded locally:', err);
      }

      // Check if destination has existing bulk device of same model
      const destIndex = cached.findIndex(
        d => d.model_id === device.model_id &&
             d.stock_location === toLocation &&
             (!d.is_serialized || !d.serial_number) &&
             d.status === 'AVAILABLE'
      );

      if (destIndex >= 0) {
        const destDevice = cached[destIndex];
        destDevice.quantity = (destDevice.quantity || 1) + transferQty;
        destDevice.updated_at = now;
        cached[destIndex] = destDevice;
        try {
          await supabase
            .from('mss_devices')
            .update({ quantity: destDevice.quantity, updated_at: now })
            .eq('id', destDevice.id);
        } catch (err) {
          console.warn('Supabase update dest bulk device failed, recorded locally:', err);
        }
      } else {
        const newDestDevice: MSSDevice = {
          id: generateUUID(),
          serial_number: null,
          is_serialized: false,
          quantity: transferQty,
          model_id: device.model_id,
          purchase_cost: device.purchase_cost,
          list_price: device.list_price,
          purchase_date: device.purchase_date,
          physical_condition: device.physical_condition,
          stock_location: toLocation,
          status: 'AVAILABLE',
          notes: `تحويل جزئي (${transferQty} وحدة) من ${fromLocation}`,
          created_at: now,
          updated_at: now,
          _synced: false,
          model: device.model,
          model_name: device.model_name,
          brand: device.brand,
          category: device.category,
        };
        cached.unshift(newDestDevice);
        try {
          await supabase.from('mss_devices').insert({
            id: newDestDevice.id,
            serial_number: null,
            is_serialized: false,
            quantity: newDestDevice.quantity,
            model_id: newDestDevice.model_id,
            purchase_cost: newDestDevice.purchase_cost,
            list_price: newDestDevice.list_price,
            purchase_date: newDestDevice.purchase_date,
            physical_condition: newDestDevice.physical_condition,
            stock_location: newDestDevice.stock_location,
            status: newDestDevice.status,
            notes: newDestDevice.notes,
          });
          newDestDevice._synced = true;
        } catch (err) {
          console.warn('Supabase insert dest bulk device failed, cached locally:', err);
        }
      }
    } else {
      // Full transfer of device (serialized or whole bulk lot)
      try {
        const { data: rpcData, error: rpcError } = await supabase.rpc('transfer_mss_device', {
          p_device_id: device.id,
          p_to_location: toLocation,
          p_notes: newMovement.notes,
        });

        if (!rpcError && rpcData) {
          newMovement.id = rpcData;
        } else {
          await supabase
            .from('mss_devices')
            .update({ stock_location: toLocation, updated_at: now })
            .eq('id', device.id);
        }
      } catch (err) {
        console.warn('Supabase transfer device failed, recorded locally:', err);
      }

      device.stock_location = toLocation;
      device.updated_at = now;
      cached[deviceIndex] = device;
    }

    // Insert movement into Supabase
    try {
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
    } catch (err) {
      console.warn('Supabase insert movement failed, recorded locally:', err);
    }

    saveCachedDevices(cached);

    const movements = getCachedMovements();
    movements.unshift(newMovement);
    saveCachedMovements(movements);

    // Queue in Outbox
    mssSyncService
      .queueOperation(
        'DEVICE_TRANSFER',
        newMovement,
        device.serial_number
          ? `نقل جهاز بالسيريال (${newMovement.serial_number}) من (${newMovement.from_location}) إلى (${newMovement.to_location})`
          : `نقل مخزون مجمع (${transferQty} وحدة) من (${newMovement.from_location}) إلى (${newMovement.to_location})`,
        newMovement.from_location
      )
      .catch(console.warn);

    backupService.notifyDataChanged(
      device.serial_number
        ? `نقل جهاز MSS بين المحلين: ${newMovement.serial_number}`
        : `نقل مخزون MSS (${transferQty} وحدة) إلى ${toLocation}`
    );

    return { device, movement: newMovement };
  },

  /**
   * Adjust/Correct Stock Quantity for an MSS Model at a Specific Branch
   * Designed for safe correction of accidental inventory entries (e.g. 70 units -> 7 units)
   * Updates local and remote stock, logs movements and audit logs, records adjustment history.
   */
  async adjustStockQuantity(input: StockAdjustmentInput): Promise<MSSStockAdjustment> {
    if (!input.model_id) {
      throw new Error('يجب تحديد الموديل المراد تصحيح كميته');
    }
    if (!input.stock_location) {
      throw new Error('يجب تحديد الفرع أو المخزن المستهدف');
    }
    if (typeof input.new_quantity !== 'number' || isNaN(input.new_quantity) || input.new_quantity < 0) {
      throw new Error('الكمية المصححة يجب أن تكون رقماً صحيحاً أكبر من أو يساوي الصفر');
    }
    if (!input.reason || !input.reason.trim()) {
      throw new Error('يجب ذكر سبب تصحيح الكمية لأغراض التدقيق والمراجعة');
    }

    const activeLocations = await mssOperationalService.getActiveLocationNames();
    if (!activeLocations.includes(input.stock_location)) {
      throw new Error(`المحل أو المخزن غير صالح (${input.stock_location}). المواقع المتاحة: ${activeLocations.join('، ')}`);
    }

    const model = await mssCatalogService.getModelById(input.model_id);
    if (!model) {
      throw new Error('الموديل المحدد غير موجود في كتالوج MSS');
    }

    const now = new Date().toISOString();
    const targetQty = Math.floor(input.new_quantity);
    const cached = getCachedDevices();

    // Find available devices for this model at this location
    const matching = cached.filter(
      d => d.model_id === input.model_id &&
           d.stock_location === input.stock_location &&
           d.status === 'AVAILABLE'
    );

    let currentAvailableQty = 0;
    if (input.device_id) {
      const dev = cached.find(d => d.id === input.device_id);
      if (!dev) throw new Error('الجهاز المحدد غير موجود');
      currentAvailableQty = dev.quantity && dev.quantity > 0 ? dev.quantity : 1;
    } else {
      currentAvailableQty = matching.reduce((sum, d) => sum + (d.quantity && d.quantity > 0 ? d.quantity : 1), 0);
    }

    const delta = targetQty - currentAvailableQty;
    if (delta === 0) {
      throw new Error(`الكمية المصححة مطابقة للرصيد الفعلي الحالي (${currentAvailableQty})، لا يوجد تغيير لتطبيقه.`);
    }

    // Apply adjustment to stock items
    if (input.device_id) {
      const dev = cached.find(d => d.id === input.device_id)!;
      dev.quantity = targetQty;
      if (targetQty === 0) {
        dev.status = 'SOLD';
      }
      dev.updated_at = now;
      try {
        await supabase
          .from('mss_devices')
          .update({ quantity: targetQty, status: dev.status, updated_at: now })
          .eq('id', dev.id);
      } catch (err) {
        console.warn('Supabase update device on adjustment failed, recorded locally:', err);
      }
    } else {
      // Find bulk item first
      const bulkDev = matching.find(d => !d.is_serialized || !d.serial_number);
      if (bulkDev) {
        const prevBulkQty = bulkDev.quantity && bulkDev.quantity > 0 ? bulkDev.quantity : 1;
        const newBulkQty = Math.max(0, prevBulkQty + delta);
        bulkDev.quantity = newBulkQty;
        if (newBulkQty === 0 && targetQty === 0) {
          bulkDev.status = 'SOLD';
        }
        bulkDev.updated_at = now;
        try {
          await supabase
            .from('mss_devices')
            .update({ quantity: newBulkQty, status: bulkDev.status, updated_at: now })
            .eq('id', bulkDev.id);
        } catch (err) {
          console.warn('Supabase update bulk device on adjustment failed, recorded locally:', err);
        }
      } else if (delta > 0) {
        // Create new bulk device record with the delta quantity
        const newBulkDevice: MSSDevice = {
          id: generateUUID(),
          serial_number: null,
          is_serialized: false,
          quantity: delta,
          model_id: input.model_id,
          purchase_cost: matching[0]?.purchase_cost || 0,
          list_price: model.default_list_price || 0,
          purchase_date: getTodayLocalDateString(),
          physical_condition: 'فرز أول ممتاز',
          stock_location: input.stock_location,
          status: 'AVAILABLE',
          notes: `[تصحيح رصيد مخزون]: إضافة ${delta} وحدة. السبب: ${input.reason.trim()}`,
          created_at: now,
          updated_at: now,
          _synced: false,
          model,
          model_name: model.model_name,
          brand: model.brand,
          category: model.category,
        };
        cached.unshift(newBulkDevice);
        try {
          await supabase.from('mss_devices').insert({
            id: newBulkDevice.id,
            serial_number: null,
            is_serialized: false,
            quantity: newBulkDevice.quantity,
            model_id: newBulkDevice.model_id,
            purchase_cost: newBulkDevice.purchase_cost,
            list_price: newBulkDevice.list_price,
            purchase_date: newBulkDevice.purchase_date,
            physical_condition: newBulkDevice.physical_condition,
            stock_location: newBulkDevice.stock_location,
            status: newBulkDevice.status,
            notes: newBulkDevice.notes,
          });
          newBulkDevice._synced = true;
        } catch (err) {
          console.warn('Supabase insert adjusted bulk device failed, cached locally:', err);
        }
      } else if (delta < 0) {
        // Only serialized units exist and reduction is requested: mark excess units as RETURNED
        const countToArchive = Math.min(matching.length, Math.abs(delta));
        const toArchive = matching.slice(0, countToArchive);
        for (const dev of toArchive) {
          dev.status = 'RETURNED';
          dev.notes = (dev.notes ? dev.notes + ' | ' : '') + `[تصحيح رصيد: استبعاد وحدة. السبب: ${input.reason.trim()}]`;
          dev.updated_at = now;
          try {
            await supabase
              .from('mss_devices')
              .update({ status: 'RETURNED', notes: dev.notes, updated_at: now })
              .eq('id', dev.id);
          } catch (err) {
            console.warn('Supabase archive serialized unit failed, recorded locally:', err);
          }
        }
      }
    }

    saveCachedDevices(cached);

    // Create adjustment audit record
    const adjustmentId = generateUUID();
    const adjustment: MSSStockAdjustment = {
      id: adjustmentId,
      model_id: input.model_id,
      model_name: model.model_name,
      brand: model.brand,
      stock_location: input.stock_location,
      device_id: input.device_id || null,
      previous_quantity: currentAvailableQty,
      new_quantity: targetQty,
      adjustment_amount: delta,
      reason: input.reason.trim(),
      actor_id: input.actor_id,
      actor_username: input.actor_username || 'مستخدم النظام',
      created_at: now,
      _synced: false,
    };

    const adjList = getCachedAdjustments();
    adjList.unshift(adjustment);
    saveCachedAdjustments(adjList);

    // Try persisting to Supabase table
    try {
      await supabase.from('mss_stock_adjustments').insert({
        id: adjustment.id,
        model_id: adjustment.model_id,
        stock_location: adjustment.stock_location,
        device_id: adjustment.device_id,
        previous_quantity: adjustment.previous_quantity,
        new_quantity: adjustment.new_quantity,
        adjustment_amount: adjustment.adjustment_amount,
        reason: adjustment.reason,
        actor_id: adjustment.actor_id,
        actor_username: adjustment.actor_username,
      });
      adjustment._synced = true;
    } catch {
      // Non-blocking if table not migrated yet
    }

    // Log explicit movement for auditing
    const movement: MSSDeviceMovement = {
      id: generateUUID(),
      device_id: adjustment.device_id || adjustment.id,
      serial_number: null,
      from_location: input.stock_location,
      to_location: input.stock_location,
      movement_date: now,
      movement_status: 'COMPLETED',
      notes: `[تصحيح رصيد مخزون]: تعديل الكمية من (${currentAvailableQty}) إلى (${targetQty}) [الفرق: ${delta > 0 ? '+' : ''}${delta}]. السبب: ${input.reason.trim()}`,
      created_at: now,
      model_name: model.model_name,
      brand: model.brand,
    };
    const movements = getCachedMovements();
    movements.unshift(movement);
    saveCachedMovements(movements);

    // Log to Admin Audit Logs
    await mssOperationalService.logAudit({
      actorId: input.actor_id || 'system',
      actorUsername: input.actor_username || 'مدير النظام',
      eventType: 'STOCK_QUANTITY_CORRECTION',
      targetType: 'inventory',
      targetId: input.model_id,
      metadata: {
        modelId: input.model_id,
        modelName: model.model_name,
        stockLocation: input.stock_location,
        previousQuantity: currentAvailableQty,
        newQuantity: targetQty,
        delta,
        reason: input.reason.trim(),
      },
    });

    backupService.notifyDataChanged(`تصحيح كمية المخزون لموديل ${model.model_name}: ${currentAvailableQty} -> ${targetQty}`);

    return adjustment;
  },

  /**
   * Get all stock adjustment records with optional model filter
   */
  async getStockAdjustments(modelId?: string): Promise<MSSStockAdjustment[]> {
    let list = getCachedAdjustments();
    try {
      let query = supabase
        .from('mss_stock_adjustments')
        .select('*')
        .order('created_at', { ascending: false });

      if (modelId) {
        query = query.eq('model_id', modelId);
      }

      const { data, error } = await query;
      if (!error && Array.isArray(data) && data.length > 0) {
        const cloudMap = new Map<string, MSSStockAdjustment>();
        for (const row of data) {
          cloudMap.set(row.id, {
            id: row.id,
            model_id: row.model_id,
            model_name: row.model_name || '',
            brand: row.brand || '',
            stock_location: row.stock_location as MSSStockLocation,
            device_id: row.device_id,
            previous_quantity: Number(row.previous_quantity) || 0,
            new_quantity: Number(row.new_quantity) || 0,
            adjustment_amount: Number(row.adjustment_amount) || 0,
            reason: row.reason,
            actor_id: row.actor_id,
            actor_username: row.actor_username || '',
            created_at: row.created_at,
            _synced: true,
          });
        }
        for (const localAdj of list) {
          if (!cloudMap.has(localAdj.id)) {
            cloudMap.set(localAdj.id, localAdj);
          }
        }
        list = Array.from(cloudMap.values()).sort((a, b) => b.created_at.localeCompare(a.created_at));
        saveCachedAdjustments(list);
      }
    } catch {
      // Offline fallback
    }

    if (modelId) {
      return list.filter(a => a.model_id === modelId);
    }
    return list;
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

      if (!error && Array.isArray(data)) {
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
    const location_breakdown: Record<string, number> = {};

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
        if (d.stock_location) {
          location_breakdown[d.stock_location] = (location_breakdown[d.stock_location] || 0) + qty;
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
      location_breakdown,
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
      const branch = d.stock_location || mssOperationalService.getActiveLocationNamesSync()[0] || '';
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
          model: model || undefined,
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

        const branch = it.source_branch || inv.source_branch || inv.selling_branch || mssOperationalService.getActiveLocationNamesSync()[0] || '';
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
            model: model || undefined,
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
          model: model,
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

  /**
   * Push any locally queued pending devices to Supabase
   */
  async syncPendingDevices(): Promise<{ syncedCount: number; errors: any[] }> {
    const pending = getPendingDevices();
    if (pending.length === 0) return { syncedCount: 0, errors: [] };

    let syncedCount = 0;
    const errors: any[] = [];
    const remaining: MSSDevice[] = [];

    for (const dev of pending) {
      try {
        const { error } = await supabase.from('mss_devices').upsert(
          {
            id: dev.id,
            serial_number: dev.serial_number || null,
            is_serialized: dev.is_serialized !== undefined ? Boolean(dev.is_serialized) : Boolean(dev.serial_number),
            quantity: dev.quantity && dev.quantity > 0 ? Number(dev.quantity) : 1,
            model_id: dev.model_id,
            purchase_cost: dev.purchase_cost,
            list_price: dev.list_price,
            purchase_date: dev.purchase_date,
            physical_condition: dev.physical_condition,
            stock_location: dev.stock_location,
            status: dev.status || 'AVAILABLE',
            notes: dev.notes || null,
          },
          { onConflict: 'id' }
        );

        if (error) {
          errors.push({ id: dev.id, error: error.message });
          remaining.push(dev);
        } else {
          syncedCount++;
          const cached = getCachedDevices();
          const idx = cached.findIndex(d => d.id === dev.id);
          if (idx >= 0) {
            cached[idx]._synced = true;
            saveCachedDevices(cached);
          }
        }
      } catch (err: any) {
        errors.push({ id: dev.id, error: err.message });
        remaining.push(dev);
      }
    }

    savePendingDevices(remaining);
    return { syncedCount, errors };
  },
};
