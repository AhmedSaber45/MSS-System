import { supabase } from '../lib/supabase.ts';
import { validateDateRange, getTodayLocalDateString } from '../lib/dateValidation.ts';
import { mssInventoryService } from './mssInventoryService.ts';
import { mssCatalogService } from './mssCatalogService.ts';
import { mssSyncService } from './mssSyncService.ts';
import { backupService } from './backupService.ts';
import type {
  MSSInvoice,
  NewMSSSaleInput,
  MSSReservation,
  NewMSSReservationInput,
  MSSReturn,
  NewMSSReturnInput,
  MSSStockLocation,
} from '../types/mssCommerce.ts';

const MSS_INVOICES_CACHE_KEY = 'shop_mss_invoices_cache_v1';
const MSS_RESERVATIONS_CACHE_KEY = 'shop_mss_reservations_cache_v1';
const MSS_RETURNS_CACHE_KEY = 'shop_mss_returns_cache_v1';

// Seed initial invoices
const INITIAL_SEED_INVOICES: MSSInvoice[] = [
  {
    id: 'd0000000-0000-0000-0000-000000000001',
    invoice_number: 'MSS-INV-101',
    device_id: 'b0000000-0000-0000-0000-000000000005',
    serial_number: '5CD9283-HP',
    model_id: 'a0000000-0000-0000-0000-000000000003',
    selling_branch: 'محل 1',
    source_branch: 'محل 2',
    list_price_snapshot: 13500,
    discount_amount: 500,
    actual_sale_price: 13000,
    cost_snapshot: 9800,
    gross_profit: 3200,
    customer_name: 'أ. شريف كمال',
    customer_phone: '01012345678',
    warranty_period: 'ضمان شهر كامل',
    notes: 'بيع جهاز مخزن بمحل 2 من خلال محل 1',
    sale_date: '2024-11-12T13:30:00Z',
    is_returned: false,
    created_at: '2024-11-12T13:30:00Z',
    updated_at: '2024-11-12T13:30:00Z',
    brand: 'HP',
    model_name: 'EliteBook 840 G6',
    category: 'لابتوب',
  },
];

// Seed initial reservations
const INITIAL_SEED_RESERVATIONS: MSSReservation[] = [
  {
    id: 'e0000000-0000-0000-0000-000000000001',
    reservation_number: 'MSS-RES-01',
    device_id: 'b0000000-0000-0000-0000-000000000003',
    serial_number: '8F9X021-DELL',
    branch: 'محل 1',
    customer_name: 'أحمد محمود الجزار',
    customer_phone: '01234567890',
    deposit_amount: 1000,
    agreed_price: 14500,
    expiry_date: '2026-11-20',
    status: 'ACTIVE',
    notes: 'حجز مع عربون 1000 EGP حتى استلام الراتب',
    created_at: '2024-11-10T09:30:00Z',
    updated_at: '2024-11-10T09:30:00Z',
    brand: 'Dell',
    model_name: 'Latitude 5420',
  },
];

// Seed initial returns
const INITIAL_SEED_RETURNS: MSSReturn[] = [];

function getCachedInvoices(): MSSInvoice[] {
  try {
    const raw = localStorage.getItem(MSS_INVOICES_CACHE_KEY);
    if (!raw) {
      localStorage.setItem(MSS_INVOICES_CACHE_KEY, JSON.stringify(INITIAL_SEED_INVOICES));
      return INITIAL_SEED_INVOICES;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : INITIAL_SEED_INVOICES;
  } catch {
    return INITIAL_SEED_INVOICES;
  }
}

function saveCachedInvoices(invoices: MSSInvoice[]): void {
  localStorage.setItem(MSS_INVOICES_CACHE_KEY, JSON.stringify(invoices));
}

function getCachedReservations(): MSSReservation[] {
  try {
    const raw = localStorage.getItem(MSS_RESERVATIONS_CACHE_KEY);
    if (!raw) {
      localStorage.setItem(MSS_RESERVATIONS_CACHE_KEY, JSON.stringify(INITIAL_SEED_RESERVATIONS));
      return INITIAL_SEED_RESERVATIONS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : INITIAL_SEED_RESERVATIONS;
  } catch {
    return INITIAL_SEED_RESERVATIONS;
  }
}

function saveCachedReservations(reservations: MSSReservation[]): void {
  localStorage.setItem(MSS_RESERVATIONS_CACHE_KEY, JSON.stringify(reservations));
}

function getCachedReturns(): MSSReturn[] {
  try {
    const raw = localStorage.getItem(MSS_RETURNS_CACHE_KEY);
    if (!raw) {
      localStorage.setItem(MSS_RETURNS_CACHE_KEY, JSON.stringify(INITIAL_SEED_RETURNS));
      return INITIAL_SEED_RETURNS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : INITIAL_SEED_RETURNS;
  } catch {
    return INITIAL_SEED_RETURNS;
  }
}

function saveCachedReturns(returns: MSSReturn[]): void {
  localStorage.setItem(MSS_RETURNS_CACHE_KEY, JSON.stringify(returns));
}

export const mssCommerceService = {
  /**
   * Fetch all MSS invoices with model metadata and offline caching
   */
  async getInvoices(filters?: {
    query?: string;
    sellingBranch?: string;
    sourceBranch?: string;
    isReturned?: boolean;
    startDate?: string;
    endDate?: string;
  }): Promise<MSSInvoice[]> {
    let invoices: MSSInvoice[] = [];
    let isCloudFetched = false;

    // Load models to enrich
    const models = await mssCatalogService.getModels();
    const modelMap = new Map(models.map(m => [m.id, m]));

    try {
      const { data, error } = await supabase
        .from('mss_invoices')
        .select('*')
        .order('sale_date', { ascending: false });

      if (!error && Array.isArray(data) && data.length > 0) {
        invoices = data.map((row: any) => ({
          id: row.id,
          invoice_number: row.invoice_number,
          device_id: row.device_id,
          serial_number: row.serial_number,
          model_id: row.model_id,
          selling_branch: row.selling_branch as MSSStockLocation,
          source_branch: row.source_branch as MSSStockLocation,
          list_price_snapshot: Number(row.list_price_snapshot) || 0,
          discount_amount: Number(row.discount_amount) || 0,
          actual_sale_price: Number(row.actual_sale_price) || 0,
          cost_snapshot: Number(row.cost_snapshot) || 0,
          gross_profit: Number(row.gross_profit) || 0,
          customer_name: row.customer_name || null,
          customer_phone: row.customer_phone || null,
          warranty_period: row.warranty_period || 'ضمان شهر كامل',
          notes: row.notes || null,
          sale_date: row.sale_date,
          is_returned: Boolean(row.is_returned),
          created_at: row.created_at,
          updated_at: row.updated_at,
        }));
        saveCachedInvoices(invoices);
        isCloudFetched = true;
      }
    } catch (err) {
      console.warn('Supabase fetch invoices failed, using local cache:', err);
    }

    if (!isCloudFetched) {
      invoices = getCachedInvoices();
    }

    // Attach enriched metadata
    invoices = invoices.map(inv => {
      const m = modelMap.get(inv.model_id);
      return {
        ...inv,
        brand: m?.brand || '',
        model_name: m?.model_name || 'جهاز لابتوب / شاشة',
        category: m?.category || 'أخرى',
        processor: m?.processor || null,
        ram: m?.ram || null,
        storage: m?.storage || null,
        screen_size: m?.screen_size || null,
      };
    });

    // Apply filters
    if (filters?.sellingBranch && filters.sellingBranch !== 'ALL') {
      invoices = invoices.filter(inv => inv.selling_branch === filters.sellingBranch);
    }

    if (filters?.sourceBranch && filters.sourceBranch !== 'ALL') {
      invoices = invoices.filter(inv => inv.source_branch === filters.sourceBranch);
    }

    if (filters?.isReturned !== undefined) {
      invoices = invoices.filter(inv => inv.is_returned === filters.isReturned);
    }

    if (filters?.startDate || filters?.endDate) {
      const validation = validateDateRange(filters.startDate, filters.endDate);
      const safeStart = validation.sanitizedStart;
      const safeEnd = validation.sanitizedEnd;
      if (safeStart) {
        invoices = invoices.filter(inv => inv.sale_date && inv.sale_date.substring(0, 10) >= safeStart);
      }
      if (safeEnd) {
        invoices = invoices.filter(inv => inv.sale_date && inv.sale_date.substring(0, 10) <= safeEnd);
      }
    }

    if (filters?.query && filters.query.trim()) {
      const q = filters.query.trim().toLowerCase();
      invoices = invoices.filter(
        inv =>
          inv.invoice_number.toLowerCase().includes(q) ||
          inv.serial_number.toLowerCase().includes(q) ||
          inv.model_name?.toLowerCase().includes(q) ||
          inv.brand?.toLowerCase().includes(q) ||
          (inv.customer_name && inv.customer_name.toLowerCase().includes(q)) ||
          (inv.customer_phone && inv.customer_phone.includes(q))
      );
    }

    return invoices;
  },

  /**
   * Get single invoice by ID
   */
  async getInvoiceById(id: string): Promise<MSSInvoice | null> {
    const list = await this.getInvoices();
    return list.find(inv => inv.id === id) || null;
  },

  /**
   * Get single invoice by Invoice Number
   */
  async getInvoiceByNumber(invoiceNumber: string): Promise<MSSInvoice | null> {
    const q = invoiceNumber.trim().toUpperCase();
    const list = await this.getInvoices();
    return list.find(inv => inv.invoice_number.toUpperCase() === q) || null;
  },

  /**
   * Generate next sequential invoice number (e.g. MSS-INV-102)
   */
  async getNextInvoiceNumber(): Promise<string> {
    const invoices = await this.getInvoices();
    if (invoices.length === 0) return 'MSS-INV-101';

    let maxNum = 100;
    invoices.forEach(inv => {
      const match = inv.invoice_number.match(/MSS-INV-(\d+)/i);
      if (match) {
        const n = parseInt(match[1], 10);
        if (!isNaN(n) && n > maxNum) maxNum = n;
      }
    });

    return `MSS-INV-${maxNum + 1}`;
  },

  /**
   * Confirm and finalize an MSS device sale
   * Accurately enforces:
   * - Selling Branch vs Stock-Source Branch (Rule 9 & Section 16)
   * - Price Snapshots: list price, cost, discount, actual price, gross profit (Rule 8 & Section 17)
   * - Updates device status to 'SOLD'
   */
  async confirmSale(input: NewMSSSaleInput): Promise<MSSInvoice> {
    if (!input.device_id) {
      throw new Error('يجب تحديد الجهاز المراد بيعه بالسيريال');
    }

    const device = await mssInventoryService.getDeviceById(input.device_id);
    if (!device) {
      throw new Error('الجهاز غير موجود في المخزون');
    }

    if (device.status === 'SOLD') {
      throw new Error(`الجهاز بالسيريال (${device.serial_number}) مباع مسبقاً ولا يمكن بيعه مجدداً.`);
    }

    // Check if device is reserved by someone else
    const reservations = await this.getReservations();
    const activeRes = reservations.find(r => r.device_id === device.id && r.status === 'ACTIVE');
    if (activeRes) {
      // If customer name matches reservation customer, allow fulfillment; otherwise require releasing/cancelling first
      const saleCustomer = input.customer_name?.trim() || '';
      if (!saleCustomer || !activeRes.customer_name.includes(saleCustomer)) {
        throw new Error(
          `الجهاز محجوز حالياً للعميل (${activeRes.customer_name}) بحجز رقم ${activeRes.reservation_number}. يجب إتمام البيع عبر الحجز أو إلغاء الحجز أولاً.`
        );
      }
    }

    if (input.actual_sale_price < 0) {
      throw new Error('سعر البيع الفعلي لا يمكن أن يكون سالباً');
    }

    if (!['محل 1', 'محل 2'].includes(input.selling_branch)) {
      throw new Error('فرع البيع غير صالح. يجب اختيار "محل 1" أو "محل 2"');
    }

    const sourceBranch = device.stock_location;
    const sellingBranch = input.selling_branch;
    const listPriceSnapshot = device.list_price;
    const costSnapshot = device.purchase_cost;
    const actualSalePrice = Number(input.actual_sale_price) || 0;
    const discountAmount =
      input.discount_amount !== undefined
        ? Number(input.discount_amount)
        : Math.max(0, listPriceSnapshot - actualSalePrice);
    const grossProfit = actualSalePrice - costSnapshot;

    const invoiceNumber = await this.getNextInvoiceNumber();
    const now = new Date().toISOString();
    const newId = 'inv-' + Math.random().toString(36).substring(2, 9) + '-' + Date.now().toString(36);

    const newInvoice: MSSInvoice = {
      id: newId,
      invoice_number: invoiceNumber,
      device_id: device.id,
      serial_number: device.serial_number,
      model_id: device.model_id,
      selling_branch: sellingBranch,
      source_branch: sourceBranch,
      list_price_snapshot: listPriceSnapshot,
      discount_amount: discountAmount,
      actual_sale_price: actualSalePrice,
      cost_snapshot: costSnapshot,
      gross_profit: grossProfit,
      customer_name: input.customer_name?.trim() || null,
      customer_phone: input.customer_phone?.trim() || null,
      warranty_period: input.warranty_period?.trim() || 'ضمان شهر كامل',
      notes: input.notes?.trim() || null,
      sale_date: now,
      is_returned: false,
      created_at: now,
      updated_at: now,
      brand: device.brand,
      model_name: device.model_name,
      category: device.category,
      processor: device.model?.processor,
      ram: device.model?.ram,
      storage: device.model?.storage,
      screen_size: device.model?.screen_size,
    };

    // 1. Try remote insert to Supabase
    try {
      const { data, error } = await supabase
        .from('mss_invoices')
        .insert({
          invoice_number: newInvoice.invoice_number,
          device_id: newInvoice.device_id,
          serial_number: newInvoice.serial_number,
          model_id: newInvoice.model_id,
          selling_branch: newInvoice.selling_branch,
          source_branch: newInvoice.source_branch,
          list_price_snapshot: newInvoice.list_price_snapshot,
          discount_amount: newInvoice.discount_amount,
          actual_sale_price: newInvoice.actual_sale_price,
          cost_snapshot: newInvoice.cost_snapshot,
          gross_profit: newInvoice.gross_profit,
          customer_name: newInvoice.customer_name,
          customer_phone: newInvoice.customer_phone,
          warranty_period: newInvoice.warranty_period,
          notes: newInvoice.notes,
          sale_date: newInvoice.sale_date,
          is_returned: false,
        })
        .select()
        .single();

      if (!error && data) {
        newInvoice.id = data.id;
        newInvoice.created_at = data.created_at;
        newInvoice.updated_at = data.updated_at;
      }
    } catch (err) {
      console.warn('Supabase insert invoice failed, cached locally:', err);
    }

    // 2. Atomically update device status in inventory to 'SOLD'
    await mssInventoryService.updateDevice(device.id, {
      status: 'SOLD',
    });

    // 3. If there was an active reservation for this device, mark it FULFILLED
    if (activeRes) {
      await this.updateReservationStatus(activeRes.id, 'FULFILLED');
    }

    // 4. Update local cache
    const cached = getCachedInvoices();
    cached.unshift(newInvoice);
    saveCachedInvoices(cached);

    // 5. Queue in Outbox for reliable synchronization
    mssSyncService
      .queueOperation(
        'SALE_CREATE',
        newInvoice,
        `بيع جهاز ${newInvoice.brand || ''} ${newInvoice.model_name || ''} بالسيريال (${newInvoice.serial_number}) بفاتورة رقم ${newInvoice.invoice_number}`,
        newInvoice.selling_branch
      )
      .catch(console.warn);

    backupService.notifyDataChanged(`بيع جهاز MSS: ${newInvoice.invoice_number}`);

    return newInvoice;
  },

  /**
   * Fetch all reservations
   */
  async getReservations(filters?: {
    query?: string;
    branch?: string;
    status?: string;
  }): Promise<MSSReservation[]> {
    let reservations: MSSReservation[] = [];
    let isCloudFetched = false;

    const devices = await mssInventoryService.getDevices();
    const devMap = new Map(devices.map(d => [d.id, d]));

    try {
      const { data, error } = await supabase
        .from('mss_reservations')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(data) && data.length > 0) {
        reservations = data.map((row: any) => ({
          id: row.id,
          reservation_number: row.reservation_number,
          device_id: row.device_id,
          serial_number: row.serial_number,
          branch: row.branch as MSSStockLocation,
          customer_name: row.customer_name,
          customer_phone: row.customer_phone,
          deposit_amount: Number(row.deposit_amount) || 0,
          agreed_price: Number(row.agreed_price) || 0,
          expiry_date: row.expiry_date,
          status: row.status,
          notes: row.notes || null,
          created_at: row.created_at,
          updated_at: row.updated_at,
        }));
        saveCachedReservations(reservations);
        isCloudFetched = true;
      }
    } catch (err) {
      console.warn('Supabase fetch reservations failed, using cache:', err);
    }

    if (!isCloudFetched) {
      reservations = getCachedReservations();
    }

    // Attach device metadata
    reservations = reservations.map(r => {
      const d = devMap.get(r.device_id);
      return {
        ...r,
        brand: d?.brand || '',
        model_name: d?.model_name || '',
      };
    });

    // Filters
    if (filters?.branch && filters.branch !== 'ALL') {
      reservations = reservations.filter(r => r.branch === filters.branch);
    }

    if (filters?.status && filters.status !== 'ALL') {
      reservations = reservations.filter(r => r.status === filters.status);
    }

    if (filters?.query && filters.query.trim()) {
      const q = filters.query.trim().toLowerCase();
      reservations = reservations.filter(
        r =>
          r.reservation_number.toLowerCase().includes(q) ||
          r.serial_number.toLowerCase().includes(q) ||
          r.customer_name.toLowerCase().includes(q) ||
          r.customer_phone.includes(q) ||
          (r.model_name && r.model_name.toLowerCase().includes(q))
      );
    }

    return reservations;
  },

  /**
   * Generate next sequential reservation number (e.g. MSS-RES-02)
   */
  async getNextReservationNumber(): Promise<string> {
    const list = await this.getReservations();
    if (list.length === 0) return 'MSS-RES-01';

    let maxNum = 0;
    list.forEach(r => {
      const match = r.reservation_number.match(/MSS-RES-(\d+)/i);
      if (match) {
        const n = parseInt(match[1], 10);
        if (!isNaN(n) && n > maxNum) maxNum = n;
      }
    });

    const next = maxNum + 1;
    return `MSS-RES-${next < 10 ? '0' + next : next}`;
  },

  /**
   * Create device reservation visible to both shops
   */
  async createReservation(input: NewMSSReservationInput): Promise<MSSReservation> {
    if (!input.device_id) throw new Error('يجب اختيار الجهاز المراد حجزه');
    if (!input.customer_name?.trim()) throw new Error('اسم العميل مطلوب لتوثيق الحجز');
    if (!input.customer_phone?.trim()) throw new Error('رقم هاتف العميل مطلوب');
    if (input.deposit_amount < 0) throw new Error('مبلغ العربون لا يمكن أن يكون سالباً');
    if (input.agreed_price < 0) throw new Error('السعر المتفق عليه لا يمكن أن يكون سالباً');

    const today = getTodayLocalDateString();
    if (input.expiry_date && input.expiry_date.trim() < today) {
      throw new Error(`تاريخ انتهاء الحجز (${input.expiry_date}) لا يمكن أن يكون في الماضي. يجب أن يكون اليوم أو تاريخاً مستقبلياً.`);
    }

    const device = await mssInventoryService.getDeviceById(input.device_id);
    if (!device) throw new Error('الجهاز غير موجود في المخزون');

    if (device.status === 'SOLD') {
      throw new Error(`لا يمكن حجز جهاز مباع بالفعل (${device.serial_number})`);
    }

    if (device.status === 'RESERVED') {
      throw new Error(`الجهاز بالسيريال (${device.serial_number}) محجوز مسبقاً لعميل آخر.`);
    }

    const resNumber = await this.getNextReservationNumber();
    const now = new Date().toISOString();
    const newId = 'res-' + Math.random().toString(36).substring(2, 9) + '-' + Date.now().toString(36);

    const newReservation: MSSReservation = {
      id: newId,
      reservation_number: resNumber,
      device_id: device.id,
      serial_number: device.serial_number,
      branch: input.branch,
      customer_name: input.customer_name.trim(),
      customer_phone: input.customer_phone.trim(),
      deposit_amount: Number(input.deposit_amount) || 0,
      agreed_price: Number(input.agreed_price) || device.list_price,
      expiry_date: input.expiry_date || new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0],
      status: 'ACTIVE',
      notes: input.notes?.trim() || null,
      created_at: now,
      updated_at: now,
      brand: device.brand,
      model_name: device.model_name,
    };

    // Try remote insert
    try {
      const { data, error } = await supabase
        .from('mss_reservations')
        .insert({
          reservation_number: newReservation.reservation_number,
          device_id: newReservation.device_id,
          serial_number: newReservation.serial_number,
          branch: newReservation.branch,
          customer_name: newReservation.customer_name,
          customer_phone: newReservation.customer_phone,
          deposit_amount: newReservation.deposit_amount,
          agreed_price: newReservation.agreed_price,
          expiry_date: newReservation.expiry_date,
          status: newReservation.status,
          notes: newReservation.notes,
        })
        .select()
        .single();

      if (!error && data) {
        newReservation.id = data.id;
      }
    } catch (err) {
      console.warn('Supabase insert reservation failed, cached locally:', err);
    }

    // Atomically set device status to 'RESERVED'
    await mssInventoryService.updateDevice(device.id, {
      status: 'RESERVED',
    });

    const cached = getCachedReservations();
    cached.unshift(newReservation);
    saveCachedReservations(cached);

    // Queue in Outbox
    mssSyncService
      .queueOperation(
        'RESERVATION_CREATE',
        newReservation,
        `حجز جهاز بالسيريال (${newReservation.serial_number}) للعميل (${newReservation.customer_name}) بحجز رقم ${newReservation.reservation_number}`,
        newReservation.branch
      )
      .catch(console.warn);

    backupService.notifyDataChanged(`حجز جهاز MSS: ${newReservation.reservation_number}`);

    return newReservation;
  },

  /**
   * Cancel an active reservation and restore device to AVAILABLE
   */
  async cancelReservation(id: string, reason?: string): Promise<void> {
    const cached = getCachedReservations();
    const index = cached.findIndex(r => r.id === id);
    if (index < 0) throw new Error('سجل الحجز غير موجود');

    const res = cached[index];
    if (res.status !== 'ACTIVE') {
      throw new Error(`لا يمكن إلغاء حجز بحالة (${res.status})`);
    }

    const now = new Date().toISOString();
    res.status = 'CANCELLED';
    res.notes = reason ? `${res.notes || ''} [سبب الإلغاء: ${reason}]` : res.notes;
    res.updated_at = now;

    try {
      await supabase
        .from('mss_reservations')
        .update({ status: 'CANCELLED', notes: res.notes, updated_at: now })
        .eq('id', id);
    } catch (err) {
      console.warn('Supabase cancel reservation failed:', err);
    }

    cached[index] = res;
    saveCachedReservations(cached);

    // Release device back to AVAILABLE
    await mssInventoryService.updateDevice(res.device_id, {
      status: 'AVAILABLE',
    });

    // Queue in Outbox
    mssSyncService
      .queueOperation(
        'RESERVATION_CANCEL',
        { reservation_id: res.id, serial_number: res.serial_number, reason },
        `إلغاء حجز رقم ${res.reservation_number} للجهاز (${res.serial_number})`,
        res.branch
      )
      .catch(console.warn);

    backupService.notifyDataChanged(`إلغاء حجز جهاز MSS: ${res.reservation_number}`);
  },

  /**
   * Internal helper to update reservation status
   */
  async updateReservationStatus(id: string, status: MSSReservation['status']): Promise<void> {
    const cached = getCachedReservations();
    const index = cached.findIndex(r => r.id === id);
    if (index >= 0) {
      cached[index].status = status;
      cached[index].updated_at = new Date().toISOString();
      saveCachedReservations(cached);
    }

    try {
      await supabase
        .from('mss_reservations')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id);
    } catch (err) {
      console.warn('Supabase update reservation status failed:', err);
    }
  },

  /**
   * Fetch all returns
   */
  async getReturns(filters?: { query?: string; startDate?: string; endDate?: string }): Promise<MSSReturn[]> {
    let returns: MSSReturn[] = [];
    let isCloudFetched = false;

    try {
      const { data, error } = await supabase
        .from('mss_returns')
        .select('*')
        .order('return_date', { ascending: false });

      if (!error && Array.isArray(data) && data.length > 0) {
        returns = data.map((row: any) => ({
          id: row.id,
          return_number: row.return_number,
          invoice_id: row.invoice_id,
          invoice_number: row.invoice_number,
          device_id: row.device_id,
          serial_number: row.serial_number,
          refund_amount: Number(row.refund_amount) || 0,
          return_reason: row.return_reason,
          restock_location: row.restock_location as MSSStockLocation,
          new_condition: row.new_condition || 'فرز أول ممتاز',
          new_status: row.new_status,
          return_date: row.return_date,
          notes: row.notes || null,
          created_at: row.created_at,
        }));
        saveCachedReturns(returns);
        isCloudFetched = true;
      }
    } catch (err) {
      console.warn('Supabase fetch returns failed, using cache:', err);
    }

    if (!isCloudFetched) {
      returns = getCachedReturns();
    }

    const devices = await mssInventoryService.getDevices();
    const devMap = new Map(devices.map(d => [d.id, d]));

    returns = returns.map(ret => {
      const d = devMap.get(ret.device_id);
      return {
        ...ret,
        brand: d?.brand || '',
        model_name: d?.model_name || '',
      };
    });

    if (filters?.startDate || filters?.endDate) {
      const validation = validateDateRange(filters.startDate, filters.endDate);
      const safeStart = validation.sanitizedStart;
      const safeEnd = validation.sanitizedEnd;
      if (safeStart) {
        returns = returns.filter(r => r.return_date && r.return_date.substring(0, 10) >= safeStart);
      }
      if (safeEnd) {
        returns = returns.filter(r => r.return_date && r.return_date.substring(0, 10) <= safeEnd);
      }
    }

    if (filters?.query && filters.query.trim()) {
      const q = filters.query.trim().toLowerCase();
      returns = returns.filter(
        r =>
          r.return_number.toLowerCase().includes(q) ||
          r.invoice_number.toLowerCase().includes(q) ||
          r.serial_number.toLowerCase().includes(q) ||
          (r.model_name && r.model_name.toLowerCase().includes(q)) ||
          r.return_reason.toLowerCase().includes(q)
      );
    }

    return returns;
  },

  /**
   * Generate next sequential return number (e.g. MSS-RET-01)
   */
  async getNextReturnNumber(): Promise<string> {
    const list = await this.getReturns();
    if (list.length === 0) return 'MSS-RET-01';

    let maxNum = 0;
    list.forEach(r => {
      const match = r.return_number.match(/MSS-RET-(\d+)/i);
      if (match) {
        const n = parseInt(match[1], 10);
        if (!isNaN(n) && n > maxNum) maxNum = n;
      }
    });

    const next = maxNum + 1;
    return `MSS-RET-${next < 10 ? '0' + next : next}`;
  },

  /**
   * Process and finalize a sales return / reversal
   * Accurately enforces:
   * - Reversing the sale and marking invoice is_returned = true (Rule 8 & 9)
   * - Safely restocks device to specified location with specified status
   * - Prevents duplicate return of the same invoice
   */
  async processReturn(input: NewMSSReturnInput): Promise<MSSReturn> {
    if (!input.invoice_id) throw new Error('معرف الفاتورة الأصلية مطلوب');
    if (!input.return_reason?.trim()) throw new Error('سبب الإرجاع مطلوب لتوثيق العملية');
    if (input.refund_amount < 0) throw new Error('المبلغ المسترد لا يمكن أن يكون سالباً');
    if (!['محل 1', 'محل 2'].includes(input.restock_location)) {
      throw new Error('موقع استلام الجهاز المرتجع غير صالح');
    }

    const invoice = await this.getInvoiceById(input.invoice_id);
    if (!invoice) throw new Error('الفاتورة الأصلية غير موجودة');

    if (invoice.is_returned) {
      throw new Error(`تم إرجاع الفاتورة (${invoice.invoice_number}) مسبقاً. يمنع تكرار الإرجاع لنفس الفاتورة.`);
    }

    const returnNumber = await this.getNextReturnNumber();
    const now = new Date().toISOString();
    const newId = 'ret-' + Math.random().toString(36).substring(2, 9) + '-' + Date.now().toString(36);

    const newReturn: MSSReturn = {
      id: newId,
      return_number: returnNumber,
      invoice_id: invoice.id,
      invoice_number: invoice.invoice_number,
      device_id: invoice.device_id,
      serial_number: invoice.serial_number,
      refund_amount: input.refund_amount,
      return_reason: input.return_reason.trim(),
      restock_location: input.restock_location,
      new_condition: input.new_condition?.trim() || 'فرز أول ممتاز',
      new_status: input.new_status || 'AVAILABLE',
      return_date: now,
      notes: input.notes?.trim() || null,
      created_at: now,
      brand: invoice.brand,
      model_name: invoice.model_name,
    };

    // 1. Try remote insert into mss_returns
    try {
      const { data, error } = await supabase
        .from('mss_returns')
        .insert({
          return_number: newReturn.return_number,
          invoice_id: newReturn.invoice_id,
          invoice_number: newReturn.invoice_number,
          device_id: newReturn.device_id,
          serial_number: newReturn.serial_number,
          refund_amount: newReturn.refund_amount,
          return_reason: newReturn.return_reason,
          restock_location: newReturn.restock_location,
          new_condition: newReturn.new_condition,
          new_status: newReturn.new_status,
          return_date: newReturn.return_date,
          notes: newReturn.notes,
        })
        .select()
        .single();

      if (!error && data) {
        newReturn.id = data.id;
      }
    } catch (err) {
      console.warn('Supabase insert return failed, cached locally:', err);
    }

    // 2. Mark invoice as returned
    try {
      await supabase
        .from('mss_invoices')
        .update({ is_returned: true, updated_at: now })
        .eq('id', invoice.id);
    } catch (err) {
      console.warn('Supabase update invoice returned failed:', err);
    }

    const invoices = getCachedInvoices();
    const invIndex = invoices.findIndex(i => i.id === invoice.id);
    if (invIndex >= 0) {
      invoices[invIndex].is_returned = true;
      invoices[invIndex].updated_at = now;
      saveCachedInvoices(invoices);
    }

    // 3. Restock device: set status and location
    await mssInventoryService.updateDevice(invoice.device_id, {
      status: input.new_status || 'AVAILABLE',
      stock_location: input.restock_location,
      physical_condition: input.new_condition?.trim() || 'فرز أول ممتاز',
    });

    // 4. Save return to local cache
    const cachedReturns = getCachedReturns();
    cachedReturns.unshift(newReturn);
    saveCachedReturns(cachedReturns);

    // 5. Queue in Outbox
    mssSyncService
      .queueOperation(
        'RETURN_PROCESS',
        newReturn,
        `إرجاع جهاز بالسيريال (${newReturn.serial_number}) لفاتورة رقم ${newReturn.invoice_number} بمستند ${newReturn.return_number}`,
        newReturn.restock_location
      )
      .catch(console.warn);

    backupService.notifyDataChanged(`مرتجع جهاز MSS: ${newReturn.return_number}`);

    return newReturn;
  },
};
