import { supabase } from '../lib/supabase.ts';
import { validateDateRange, getTodayLocalDateString } from '../lib/dateValidation.ts';
import { roundMoney } from '../lib/accounting.ts';
import { mssInventoryService } from './mssInventoryService.ts';
import { mssCatalogService } from './mssCatalogService.ts';
import { mssSyncService } from './mssSyncService.ts';
import { backupService } from './backupService.ts';
import type { MSSDevice } from '../types/mssInventory.ts';
import type {
  MSSInvoice,
  MSSInvoiceItem,
  NewMSSSaleInput,
  NewMSSSaleItemInput,
  MSSReservation,
  MSSReservationItem,
  NewMSSReservationInput,
  NewMSSReservationItemInput,
  UpdateMSSReservationInput,
  MSSReturn,
  NewMSSReturnInput,
  MSSStockLocation,
  MSSPayment,
  MSSInstallmentScheduleItem,
  NewMSSPaymentInput,
  MSSInstallmentPlanInput,
  MSSPaymentType,
  MSSPaymentStatus,
} from '../types/mssCommerce.ts';

const MSS_INVOICES_CACHE_KEY = 'shop_mss_invoices_cache_v1';
const MSS_RESERVATIONS_CACHE_KEY = 'shop_mss_reservations_cache_v1';
const MSS_RETURNS_CACHE_KEY = 'shop_mss_returns_cache_v1';
const MSS_PAYMENTS_CACHE_KEY = 'shop_mss_payments_cache_v1';
const MSS_SCHEDULES_CACHE_KEY = 'shop_mss_installment_schedules_cache_v1';

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
    payment_type: 'FULL',
    payment_status: 'PAID',
    paid_amount: 13000,
    remaining_balance: 0,
    installments_count: 0,
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

// Seed initial payment transactions
const INITIAL_SEED_PAYMENTS: MSSPayment[] = [
  {
    id: 'pay-seed-mss-01',
    invoice_id: 'd0000000-0000-0000-0000-000000000001',
    amount: 13000,
    payment_date: '2024-11-12',
    payment_method: 'نقدي',
    notes: 'سداد كامل عند تأكيد البيع',
    recorded_by: 'النظام',
    is_reversal: false,
    created_at: '2024-11-12T13:30:00Z',
  },
];

function normalizeInvoiceItems(inv: MSSInvoice): MSSInvoice {
  if (Array.isArray(inv.items) && inv.items.length > 0) {
    const totalSub = inv.subtotal ?? inv.items.reduce((s, it) => s + (it.list_price_snapshot || it.actual_sale_price), 0);
    const totalCount = inv.items_count ?? inv.items.reduce((s, it) => s + (it.quantity || 1), 0);
    return {
      ...inv,
      subtotal: totalSub,
      items_count: totalCount,
    };
  }
  const item: MSSInvoiceItem = {
    id: 'item-' + inv.id + '-1',
    invoice_id: inv.id,
    device_id: inv.device_id,
    model_id: inv.model_id,
    serial_number: inv.serial_number,
    is_serialized: Boolean(inv.serial_number),
    quantity: 1,
    list_price_snapshot: inv.list_price_snapshot,
    unit_price: inv.list_price_snapshot,
    discount_amount: inv.discount_amount || 0,
    actual_sale_price: inv.actual_sale_price,
    cost_snapshot: inv.cost_snapshot,
    gross_profit: inv.gross_profit,
    source_branch: inv.source_branch,
    brand: inv.brand,
    model_name: inv.model_name,
    category: inv.category,
    processor: inv.processor,
    gpu: inv.gpu,
    ram: inv.ram,
    storage: inv.storage,
    screen_size: inv.screen_size,
  };
  return {
    ...inv,
    items: [item],
    items_count: 1,
    subtotal: inv.list_price_snapshot,
  };
}

function normalizeReservationItems(res: MSSReservation): MSSReservation {
  if (Array.isArray(res.items) && res.items.length > 0) {
    const totalCount = res.items_count ?? res.items.reduce((s, it) => s + (it.quantity || 1), 0);
    return {
      ...res,
      items_count: totalCount,
    };
  }
  const item: MSSReservationItem = {
    id: 'item-' + res.id + '-1',
    reservation_id: res.id,
    device_id: res.device_id,
    model_id: '',
    serial_number: res.serial_number,
    is_serialized: Boolean(res.serial_number),
    quantity: 1,
    agreed_price: res.agreed_price,
    deposit_amount: res.deposit_amount,
    source_branch: res.branch,
    brand: res.brand,
    model_name: res.model_name,
  };
  return {
    ...res,
    items: [item],
    items_count: 1,
  };
}

function getCachedInvoices(): MSSInvoice[] {
  try {
    const raw = localStorage.getItem(MSS_INVOICES_CACHE_KEY);
    if (!raw) {
      localStorage.setItem(MSS_INVOICES_CACHE_KEY, JSON.stringify(INITIAL_SEED_INVOICES));
      return INITIAL_SEED_INVOICES.map(normalizeInvoiceItems);
    }
    const parsed = JSON.parse(raw);
    const list = Array.isArray(parsed) ? parsed : INITIAL_SEED_INVOICES;
    return list.map(normalizeInvoiceItems);
  } catch {
    return INITIAL_SEED_INVOICES.map(normalizeInvoiceItems);
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
      return INITIAL_SEED_RESERVATIONS.map(normalizeReservationItems);
    }
    const parsed = JSON.parse(raw);
    const list = Array.isArray(parsed) ? parsed : INITIAL_SEED_RESERVATIONS;
    return list.map(normalizeReservationItems);
  } catch {
    return INITIAL_SEED_RESERVATIONS.map(normalizeReservationItems);
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

function getCachedPayments(): MSSPayment[] {
  try {
    const raw = localStorage.getItem(MSS_PAYMENTS_CACHE_KEY);
    if (!raw) {
      localStorage.setItem(MSS_PAYMENTS_CACHE_KEY, JSON.stringify(INITIAL_SEED_PAYMENTS));
      return INITIAL_SEED_PAYMENTS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : INITIAL_SEED_PAYMENTS;
  } catch {
    return INITIAL_SEED_PAYMENTS;
  }
}

function saveCachedPayments(payments: MSSPayment[]): void {
  localStorage.setItem(MSS_PAYMENTS_CACHE_KEY, JSON.stringify(payments));
}

function getCachedSchedules(): MSSInstallmentScheduleItem[] {
  try {
    const raw = localStorage.getItem(MSS_SCHEDULES_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveCachedSchedules(schedules: MSSInstallmentScheduleItem[]): void {
  localStorage.setItem(MSS_SCHEDULES_CACHE_KEY, JSON.stringify(schedules));
}

/**
 * Authoritative financial calculation for MSS invoices
 */
export function computeMSSInvoicePaymentStatus(
  totalAmount: number,
  payments: MSSPayment[],
  dueDate?: string | null,
  schedule: MSSInstallmentScheduleItem[] = []
): { paidAmount: number; remainingBalance: number; paymentStatus: MSSPaymentStatus } {
  const netPaid = roundMoney(
    payments.reduce((sum, p) => sum + (p.amount || 0), 0)
  );
  const remainingBalance = Math.max(0, roundMoney(totalAmount - netPaid));

  let paymentStatus: MSSPaymentStatus;
  const today = getTodayLocalDateString();

  if (remainingBalance <= 0.001) {
    paymentStatus = 'PAID';
  } else {
    let isOverdue = false;
    if (dueDate && dueDate < today) {
      isOverdue = true;
    }
    if (!isOverdue && schedule.length > 0) {
      const sorted = [...schedule].sort(
        (a, b) => a.installment_number - b.installment_number || a.due_date.localeCompare(b.due_date)
      );
      let cumExpected = 0;
      for (const item of sorted) {
        cumExpected += item.expected_amount;
        if (item.due_date < today && roundMoney(netPaid) < roundMoney(cumExpected)) {
          isOverdue = true;
          break;
        }
      }
    }

    if (isOverdue) {
      paymentStatus = 'OVERDUE';
    } else if (netPaid > 0) {
      paymentStatus = 'PARTIALLY_PAID';
    } else {
      paymentStatus = 'UNPAID';
    }
  }

  return {
    paidAmount: netPaid,
    remainingBalance,
    paymentStatus,
  };
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
    paymentStatus?: string;
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
        const cloudInvoices = data.map((row: any) => ({
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
          payment_type: (row.payment_type as MSSPaymentType) || 'FULL',
          payment_status: (row.payment_status as MSSPaymentStatus) || 'PAID',
          paid_amount: Number(row.paid_amount) || Number(row.actual_sale_price) || 0,
          remaining_balance: Number(row.remaining_balance) || 0,
          due_date: row.due_date || null,
          installments_count: Number(row.installments_count) || 0,
        }));

        const localCached = getCachedInvoices();
        const mergedMap = new Map<string, MSSInvoice>();
        for (const ci of cloudInvoices) {
          mergedMap.set(ci.invoice_number, ci);
        }
        for (const li of localCached) {
          if (!mergedMap.has(li.invoice_number)) {
            mergedMap.set(li.invoice_number, li);
          }
        }
        for (const si of INITIAL_SEED_INVOICES) {
          if (!mergedMap.has(si.invoice_number)) {
            mergedMap.set(si.invoice_number, si);
          }
        }
        invoices = Array.from(mergedMap.values());
        saveCachedInvoices(invoices);
        isCloudFetched = true;
      }
    } catch (err) {
      console.warn('Supabase fetch invoices failed, using local cache:', err);
    }

    if (!isCloudFetched) {
      invoices = getCachedInvoices();
    }

    const allPayments = getCachedPayments();
    const allSchedules = getCachedSchedules();

    // Attach enriched metadata & dynamically recompute payment statuses
    invoices = invoices.map(inv => {
      const m = modelMap.get(inv.model_id);
      const invPayments = allPayments.filter(p => p.invoice_id === inv.id || p.invoice_id === inv.invoice_number);
      const invSchedules = allSchedules.filter(s => s.invoice_id === inv.id || s.invoice_id === inv.invoice_number);

      const metrics = computeMSSInvoicePaymentStatus(
        inv.actual_sale_price,
        invPayments,
        inv.due_date,
        invSchedules
      );

      return {
        ...inv,
        brand: m?.brand || '',
        model_name: m?.model_name || 'جهاز لابتوب / شاشة',
        category: m?.category || 'أخرى',
        processor: m?.processor || null,
        gpu: m?.gpu || null,
        ram: m?.ram || null,
        storage: m?.storage || null,
        screen_size: m?.screen_size || null,
        payment_type: inv.payment_type || 'FULL',
        payment_status: metrics.paymentStatus,
        paid_amount: metrics.paidAmount,
        remaining_balance: metrics.remainingBalance,
        installments_count: invSchedules.length > 0 ? invSchedules.length : inv.installments_count || 0,
        payments: invPayments,
        installment_schedule: invSchedules,
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

    if (filters?.paymentStatus && filters.paymentStatus !== 'ALL') {
      invoices = invoices.filter(inv => inv.payment_status === filters.paymentStatus);
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
          (inv.serial_number && inv.serial_number.toLowerCase().includes(q)) ||
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
   * Confirm and finalize an MSS device sale (Supports single or multi-device invoices)
   * Accurately enforces:
   * - Selling Branch vs Stock-Source Branch (Rule 9 & Section 16)
   * - Price Snapshots: list price, cost, discount, actual price, gross profit (Rule 8 & Section 17)
   * - Multi-Device Line Items: preserves unique serial, model, cost & price per device
   * - Non-serialized bulk stock support (model & quantity)
   * - Duplicate serialized device prevention
   * - Atomic inventory status/quantity deductions
   */
  async confirmSale(input: NewMSSSaleInput): Promise<MSSInvoice> {
    if (!['محل 1', 'محل 2'].includes(input.selling_branch)) {
      throw new Error('فرع البيع غير صالح. يجب اختيار "محل 1" أو "محل 2"');
    }

    // 1. Normalize line items: single-device vs multi-device
    let rawItems: NewMSSSaleItemInput[] = [];
    if (Array.isArray(input.items) && input.items.length > 0) {
      rawItems = input.items;
    } else if (input.device_id) {
      rawItems = [
        {
          device_id: input.device_id,
          actual_sale_price: Number(input.actual_sale_price) || 0,
          discount_amount: input.discount_amount,
        },
      ];
    } else {
      throw new Error('يجب تحديد جهاز واحد على الأقل لإتمام البيع');
    }

    // 2. Prevent duplicate selection of serialized devices
    const seenDeviceIds = new Set<string>();
    const seenSerials = new Set<string>();
    for (const it of rawItems) {
      if (it.device_id) {
        if (seenDeviceIds.has(it.device_id)) {
          throw new Error('يمنع تكرار اختيار نفس الجهاز المسلسل في الفاتورة');
        }
        seenDeviceIds.add(it.device_id);
      }
      if (it.serial_number && it.serial_number.trim()) {
        const cleanSN = it.serial_number.trim().toUpperCase();
        if (seenSerials.has(cleanSN)) {
          throw new Error(`يمنع تكرار الجهاز بالسيريال (${cleanSN}) في نفس الفاتورة`);
        }
        seenSerials.add(cleanSN);
      }
    }

    // 3. Validate stock availability and calculate line items
    interface ProcessedSaleItem {
      device: any;
      quantity: number;
      unitPrice: number;
      listPriceSnapshot: number;
      actualSalePrice: number;
      discountAmount: number;
      costSnapshot: number;
      grossProfit: number;
      sourceBranch: MSSStockLocation;
      activeReservation?: MSSReservation;
    }

    const processedItems: ProcessedSaleItem[] = [];
    const reservations = await this.getReservations();

    for (const item of rawItems) {
      if (!item.device_id) {
        throw new Error('يجب تحديد الجهاز أو دفعة المخزون لإتمام البيع');
      }

      const device = await mssInventoryService.getDeviceById(item.device_id);
      if (!device) {
        throw new Error('أحد الأجهزة المحددة غير موجود في المخزون');
      }

      if (device.status === 'SOLD') {
        const serialDisplay = device.serial_number ? `بالسيريال (${device.serial_number})` : '';
        throw new Error(`الجهاز ${serialDisplay} مباع مسبقاً ولا يمكن بيعه مجدداً.`);
      }

      let activeRes: MSSReservation | undefined = undefined;
      if (device.status === 'RESERVED') {
        activeRes = reservations.find(
          r =>
            (r.device_id === device.id ||
              (Boolean(device.serial_number) && r.serial_number === device.serial_number)) &&
            r.status === 'ACTIVE'
        );
        if (activeRes) {
          const saleCustomer = input.customer_name?.trim() || '';
          if (!saleCustomer || !activeRes.customer_name.includes(saleCustomer)) {
            throw new Error(
              `الجهاز محجوز حالياً للعميل (${activeRes.customer_name}) بحجز رقم ${activeRes.reservation_number}. يجب إتمام البيع عبر الحجز أو إلغاء الحجز أولاً.`
            );
          }
        } else {
          throw new Error('الجهاز محجوز حالياً ولا يمكن بيعه مباشرة');
        }
      }

      const isBulk = !device.is_serialized || Boolean(device.quantity && device.quantity > 1);
      let reqQuantity = 1;
      if (isBulk) {
        if (item.quantity === undefined || item.quantity === null) {
          reqQuantity = 1;
        } else {
          const rawQ = typeof item.quantity === 'string' && (item.quantity as string).trim() === '' ? NaN : Number(item.quantity);
          if (isNaN(rawQ) || rawQ <= 0 || !Number.isInteger(rawQ)) {
            throw new Error(
              `كمية الموديل (${device.model_name || ''}) غير صالحة (${item.quantity}). يجب إدخال عدد صحيح موجب أكبر من الصفر وبدون كسور.`
            );
          }
          reqQuantity = rawQ;
        }
      } else {
        if (item.quantity !== undefined && item.quantity !== null && Number(item.quantity) !== 1) {
          throw new Error('الأجهزة المسلسلة تباع كوحدة واحدة فقط لكل سيريال.');
        }
        reqQuantity = 1;
      }
      const availableQty = device.quantity && device.quantity > 0 ? device.quantity : 1;

      if (reqQuantity > availableQty) {
        throw new Error(
          `الكمية المطلوبة (${reqQuantity}) أكبر من المخزون المتاح (${availableQty}) للموديل (${device.model_name || ''})`
        );
      }

      const unitPrice =
        item.unit_price !== undefined
          ? Number(item.unit_price)
          : item.actual_sale_price !== undefined
          ? Number(item.actual_sale_price) / reqQuantity
          : device.list_price;

      const listPriceSnapshot =
        (item.list_price !== undefined ? Number(item.list_price) : device.list_price) * reqQuantity;

      const actualSalePrice =
        item.actual_sale_price !== undefined ? Number(item.actual_sale_price) : unitPrice * reqQuantity;

      if (actualSalePrice < 0) {
        throw new Error('سعر البيع الفعلي لا يمكن أن يكون سالباً');
      }

      const discountAmount =
        item.discount_amount !== undefined
          ? Number(item.discount_amount)
          : Math.max(0, listPriceSnapshot - actualSalePrice);

      const costSnapshot = device.purchase_cost * reqQuantity;
      const grossProfit = actualSalePrice - costSnapshot;
      const sourceBranch = item.source_branch || device.stock_location;

      processedItems.push({
        device,
        quantity: reqQuantity,
        unitPrice,
        listPriceSnapshot,
        actualSalePrice,
        discountAmount,
        costSnapshot,
        grossProfit,
        sourceBranch,
        activeReservation: activeRes,
      });
    }

    // 4. Compute totals across all line items
    const totalListPrice = processedItems.reduce((s, it) => s + it.listPriceSnapshot, 0);
    const totalActualSalePrice = processedItems.reduce((s, it) => s + it.actualSalePrice, 0);
    const totalCostSnapshot = processedItems.reduce((s, it) => s + it.costSnapshot, 0);
    const totalDiscountAmount =
      processedItems.reduce((s, it) => s + it.discountAmount, 0) +
      (input.discount_amount && input.items ? Number(input.discount_amount) : 0);
    const totalGrossProfit = totalActualSalePrice - totalCostSnapshot;
    const totalUnitsCount = processedItems.reduce((s, it) => s + it.quantity, 0);

    const invoiceNumber = await this.getNextInvoiceNumber();
    const now = new Date().toISOString();
    const newId = 'inv-' + Math.random().toString(36).substring(2, 9) + '-' + Date.now().toString(36);

    // 5. Construct line items
    const constructedItems: MSSInvoiceItem[] = processedItems.map((p, idx) => ({
      id: `inv-item-${newId}-${idx + 1}`,
      invoice_id: newId,
      device_id: p.device.id,
      model_id: p.device.model_id,
      serial_number: p.device.serial_number || null,
      is_serialized: p.device.is_serialized ?? Boolean(p.device.serial_number),
      quantity: p.quantity,
      list_price_snapshot: p.listPriceSnapshot,
      unit_price: p.unitPrice,
      discount_amount: p.discountAmount,
      actual_sale_price: p.actualSalePrice,
      cost_snapshot: p.costSnapshot,
      gross_profit: p.grossProfit,
      source_branch: p.sourceBranch,
      brand: p.device.brand,
      model_name: p.device.model_name,
      category: p.device.category,
      processor: p.device.model?.processor,
      gpu: p.device.model?.gpu,
      ram: p.device.model?.ram,
      storage: p.device.model?.storage,
      screen_size: p.device.model?.screen_size,
    }));

    // 6. Deferred & Installment Calculation
    const paymentType: MSSPaymentType = input.payment_type || 'FULL';
    let paidAmount = 0;
    let remainingBalance = 0;
    let paymentStatus: MSSPaymentStatus = 'PAID';
    const initialPaymentsToStore: MSSPayment[] = [];
    const schedulesToStore: MSSInstallmentScheduleItem[] = [];

    if (paymentType === 'DEFERRED') {
      const initialPayment = input.initial_payment !== undefined ? Number(input.initial_payment) : 0;
      if (isNaN(initialPayment) || initialPayment < 0) {
        throw new Error('الدفعة المقدمة لا يمكن أن تكون سالبة');
      }
      if (roundMoney(initialPayment) > totalActualSalePrice) {
        throw new Error('الدفعة المقدمة لا يمكن أن تتجاوز إجمالي سعر البيع الفعلي');
      }

      paidAmount = roundMoney(initialPayment);
      remainingBalance = roundMoney(totalActualSalePrice - paidAmount);

      if (input.installments && input.installments.length > 0) {
        for (const inst of input.installments) {
          if (!inst.due_date) throw new Error('تاريخ استحقاق القسط مطلوب');
          if (inst.expected_amount <= 0) throw new Error('مبلغ القسط المتوقع يجب أن يكون أكبر من صفر');
          schedulesToStore.push({
            id: 'sch-mss-' + Math.random().toString(36).substring(2, 9),
            invoice_id: newId,
            installment_number: inst.installment_number,
            due_date: inst.due_date,
            expected_amount: roundMoney(inst.expected_amount),
            notes: inst.notes || null,
            created_at: now,
          });
        }
      }

      if (paidAmount > 0) {
        initialPaymentsToStore.push({
          id: 'pay-mss-' + Math.random().toString(36).substring(2, 9) + '-' + Date.now().toString(36),
          invoice_id: newId,
          amount: paidAmount,
          payment_date: now.substring(0, 10),
          payment_method: input.payment_method?.trim() || 'نقدي',
          notes: 'دفعة أولى عند البيع بالتقسيط / الأجل',
          recorded_by: null,
          is_reversal: false,
          created_at: now,
        });
      }

      const nextDue = input.due_date || (schedulesToStore[0]?.due_date ?? null);
      const metrics = computeMSSInvoicePaymentStatus(totalActualSalePrice, initialPaymentsToStore, nextDue, schedulesToStore);
      paymentStatus = metrics.paymentStatus;
    } else {
      paidAmount = totalActualSalePrice;
      remainingBalance = 0;
      paymentStatus = 'PAID';

      if (totalActualSalePrice > 0) {
        initialPaymentsToStore.push({
          id: 'pay-mss-' + Math.random().toString(36).substring(2, 9) + '-' + Date.now().toString(36),
          invoice_id: newId,
          amount: totalActualSalePrice,
          payment_date: now.substring(0, 10),
          payment_method: input.payment_method?.trim() || 'نقدي',
          notes: 'سداد كامل عند تأكيد البيع',
          recorded_by: null,
          is_reversal: false,
          created_at: now,
        });
      }
    }

    const nextDueDate = input.due_date || (schedulesToStore[0]?.due_date ?? null);
    const firstDev = processedItems[0].device;
    const device = firstDev;

    const newInvoice: MSSInvoice = {
      id: newId,
      invoice_number: invoiceNumber,
      device_id: device.id,
      serial_number: processedItems.length === 1 ? device.serial_number : null,
      model_id: device.model_id,
      selling_branch: input.selling_branch,
      source_branch: processedItems[0].sourceBranch,
      list_price_snapshot: processedItems.length === 1 ? processedItems[0].listPriceSnapshot : totalListPrice,
      discount_amount: totalDiscountAmount,
      actual_sale_price: totalActualSalePrice,
      cost_snapshot: totalCostSnapshot,
      gross_profit: totalGrossProfit,
      subtotal: input.subtotal !== undefined ? Number(input.subtotal) : totalListPrice,
      items_count: totalUnitsCount,
      items: constructedItems,
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
      gpu: device.model?.gpu,
      ram: device.model?.ram,
      storage: device.model?.storage,
      screen_size: device.model?.screen_size,
      payment_type: paymentType,
      payment_status: paymentStatus,
      paid_amount: paidAmount,
      remaining_balance: remainingBalance,
      due_date: nextDueDate,
      installments_count: schedulesToStore.length,
      payments: initialPaymentsToStore,
      installment_schedule: schedulesToStore,
    };

    // 7. Remote insert to Supabase
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
          payment_type: newInvoice.payment_type,
          payment_status: newInvoice.payment_status,
          paid_amount: newInvoice.paid_amount,
          remaining_balance: newInvoice.remaining_balance,
          due_date: newInvoice.due_date,
          installments_count: newInvoice.installments_count,
        })
        .select()
        .single();

      if (!error && data) {
        newInvoice.id = data.id;
        newInvoice.created_at = data.created_at;
        newInvoice.updated_at = data.updated_at;
        initialPaymentsToStore.forEach(p => (p.invoice_id = data.id));
        schedulesToStore.forEach(s => (s.invoice_id = data.id));
        constructedItems.forEach(it => (it.invoice_id = data.id));

        try {
          await supabase.from('mss_invoice_items').insert(
            constructedItems.map(it => ({
              invoice_id: data.id,
              device_id: it.device_id || null,
              model_id: it.model_id,
              serial_number: it.serial_number || null,
              quantity: it.quantity,
              list_price_snapshot: it.list_price_snapshot,
              unit_price: it.unit_price,
              discount_amount: it.discount_amount,
              actual_sale_price: it.actual_sale_price,
              cost_snapshot: it.cost_snapshot,
              gross_profit: it.gross_profit,
              source_branch: it.source_branch,
            }))
          );
        } catch {
          // Fallback handled
        }
      }
    } catch (err) {
      console.warn('Supabase insert invoice failed, cached locally:', err);
    }

    // 8. Atomically update inventory devices & fulfill reservations
    for (const p of processedItems) {
      if (p.device.quantity && p.device.quantity > p.quantity) {
        await mssInventoryService.updateDevice(p.device.id, {
          quantity: p.device.quantity - p.quantity,
        });
      } else {
        await mssInventoryService.updateDevice(p.device.id, {
          status: 'SOLD',
          quantity: 0,
        });
      }

      if (p.activeReservation) {
        await this.updateReservationStatus(p.activeReservation.id, 'FULFILLED');
      }
    }

    // 9. Update local caches
    const cached = getCachedInvoices();
    cached.unshift(newInvoice);
    saveCachedInvoices(cached);

    if (initialPaymentsToStore.length > 0) {
      saveCachedPayments([...getCachedPayments(), ...initialPaymentsToStore]);
    }

    if (schedulesToStore.length > 0) {
      saveCachedSchedules([...getCachedSchedules(), ...schedulesToStore]);
    }

    // 10. Queue in Outbox
    mssSyncService
      .queueOperation(
        'SALE_CREATE',
        newInvoice,
        constructedItems.length > 1
          ? `بيع فاتورة متعددة (${constructedItems.length} أجهزة) برقم ${newInvoice.invoice_number}`
          : newInvoice.serial_number
          ? `بيع جهاز ${newInvoice.brand || ''} ${newInvoice.model_name || ''} بالسيريال (${newInvoice.serial_number}) بفاتورة رقم ${newInvoice.invoice_number}`
          : `بيع جهاز بدون سيريال ${newInvoice.brand || ''} ${newInvoice.model_name || ''} بفاتورة رقم ${newInvoice.invoice_number}`,
        newInvoice.selling_branch
      )
      .catch(console.warn);

    backupService.notifyDataChanged(`بيع أجهزة MSS: ${newInvoice.invoice_number}`);

    return newInvoice;
  },

  /**
   * Record a new customer payment for an existing MSS deferred invoice
   */
  async recordPayment(
    invoiceId: string,
    input: NewMSSPaymentInput
  ): Promise<{ invoice: MSSInvoice; payment: MSSPayment }> {
    const amount = roundMoney(Number(input.amount));
    if (isNaN(amount) || amount <= 0) {
      throw new Error('قيمة الدفعة المحصلة يجب أن تكون أكبر من صفر');
    }

    const allInvoices = getCachedInvoices();
    const invIndex = allInvoices.findIndex(inv => inv.id === invoiceId || inv.invoice_number === invoiceId);
    if (invIndex < 0) {
      throw new Error('الفاتورة غير موجودة');
    }

    const invoice = allInvoices[invIndex];
    const existingPayments = await this.getPayments(invoice.id);
    const existingSchedules = await this.getInstallmentSchedule(invoice.id);

    const currentMetrics = computeMSSInvoicePaymentStatus(
      invoice.actual_sale_price,
      existingPayments,
      invoice.due_date,
      existingSchedules
    );

    if (amount > roundMoney(currentMetrics.remainingBalance)) {
      throw new Error(
        `قيمة الدفعة (${amount} EGP) لا يمكن أن تتجاوز الرصيد المتبقي على الفاتورة (${currentMetrics.remainingBalance} EGP)`
      );
    }

    const now = new Date().toISOString();
    const newPayment: MSSPayment = {
      id: 'pay-mss-' + Math.random().toString(36).substring(2, 9) + '-' + Date.now().toString(36),
      invoice_id: invoice.id,
      amount,
      payment_date: input.payment_date || getTodayLocalDateString(),
      payment_method: input.payment_method || 'نقدي',
      notes: input.notes?.trim() || null,
      recorded_by: input.recorded_by || null,
      is_reversal: false,
      created_at: now,
    };

    // Try remote insert to Supabase
    try {
      const { data, error } = await supabase
        .from('mss_payments')
        .insert({
          invoice_id: newPayment.invoice_id,
          amount: newPayment.amount,
          payment_date: newPayment.payment_date,
          payment_method: newPayment.payment_method,
          notes: newPayment.notes,
          recorded_by: newPayment.recorded_by,
          is_reversal: false,
        })
        .select()
        .single();
      if (!error && data?.id) {
        newPayment.id = data.id;
      }
    } catch (err) {
      console.warn('Supabase insert payment failed, cached locally:', err);
    }

    // Save payment locally
    const allPayments = getCachedPayments();
    allPayments.push(newPayment);
    saveCachedPayments(allPayments);

    // Recompute invoice metrics
    const updatedPayments = [...existingPayments, newPayment];
    const newMetrics = computeMSSInvoicePaymentStatus(
      invoice.actual_sale_price,
      updatedPayments,
      invoice.due_date,
      existingSchedules
    );

    let nextDueDate = invoice.due_date;
    if (newMetrics.remainingBalance <= 0) {
      nextDueDate = null;
    } else if (existingSchedules.length > 0) {
      const sorted = [...existingSchedules].sort(
        (a, b) => a.installment_number - b.installment_number || a.due_date.localeCompare(b.due_date)
      );
      let cum = 0;
      for (const item of sorted) {
        cum += item.expected_amount;
        if (roundMoney(newMetrics.paidAmount) < roundMoney(cum)) {
          nextDueDate = item.due_date;
          break;
        }
      }
    }

    const updatedInvoice: MSSInvoice = {
      ...invoice,
      paid_amount: newMetrics.paidAmount,
      remaining_balance: newMetrics.remainingBalance,
      payment_status: newMetrics.paymentStatus,
      due_date: nextDueDate,
      payments: updatedPayments,
      installment_schedule: existingSchedules,
      updated_at: now,
    };

    // Try remote update in Supabase mss_invoices
    try {
      await supabase
        .from('mss_invoices')
        .update({
          paid_amount: updatedInvoice.paid_amount,
          remaining_balance: updatedInvoice.remaining_balance,
          payment_status: updatedInvoice.payment_status,
          due_date: updatedInvoice.due_date,
          updated_at: now,
        })
        .eq('id', invoice.id);
    } catch (err) {
      console.warn('Supabase update invoice balance failed, cached locally:', err);
    }

    allInvoices[invIndex] = updatedInvoice;
    saveCachedInvoices(allInvoices);

    // Queue in Outbox
    try {
      await mssSyncService.queueOperation(
        'PAYMENT_RECORD',
        { payment: newPayment, invoice_id: invoice.id, balances: newMetrics },
        `تحصيل دفعة بقيمة ${amount} EGP لفاتورة MSS رقم (${invoice.invoice_number})`,
        invoice.selling_branch
      );
    } catch (err) {
      console.warn('Queue PAYMENT_RECORD failed:', err);
    }

    backupService.notifyDataChanged(`تحصيل دفعة MSS: ${invoice.invoice_number}`);

    return { invoice: updatedInvoice, payment: newPayment };
  },

  /**
   * Safely reverse a payment transaction for an MSS invoice
   */
  async reversePayment(
    paymentId: string,
    reason: string,
    recorded_by?: string
  ): Promise<{ invoice: MSSInvoice; reversalPayment: MSSPayment }> {
    const safeReason = (reason || '').trim();
    if (!safeReason) {
      throw new Error('سبب إلغاء/عكس الدفعة إلزامي لضمان النزاهة المالية.');
    }

    const allPayments = getCachedPayments();
    const payment = allPayments.find(p => p.id === paymentId);
    if (!payment) {
      throw new Error('الدفعة المطلوب إلغاؤها غير موجودة.');
    }

    if (payment.is_reversal) {
      throw new Error('لا يمكن إلغاء دفعة عكسية مسجلة مسبقاً.');
    }

    const alreadyReversed = allPayments.some(p => p.reversal_of_id === paymentId);
    if (alreadyReversed) {
      throw new Error('تم إلغاء وعكس هذه الدفعة مسبقاً.');
    }

    const allInvoices = getCachedInvoices();
    const invIndex = allInvoices.findIndex(inv => inv.id === payment.invoice_id || inv.invoice_number === payment.invoice_id);
    if (invIndex < 0) {
      throw new Error('الفاتورة المرتبطة بالدفعة غير موجودة.');
    }

    const invoice = allInvoices[invIndex];
    const now = new Date().toISOString();

    const reversalPayment: MSSPayment = {
      id: 'pay-mss-rev-' + Math.random().toString(36).substring(2, 9) + '-' + Date.now().toString(36),
      invoice_id: payment.invoice_id,
      amount: -payment.amount,
      payment_date: getTodayLocalDateString(),
      payment_method: payment.payment_method,
      notes: `إلغاء دفعة: ${safeReason}`,
      recorded_by: recorded_by || null,
      is_reversal: true,
      reversal_of_id: payment.id,
      reversal_reason: safeReason,
      created_at: now,
    };

    try {
      const { data, error } = await supabase
        .from('mss_payments')
        .insert({
          invoice_id: reversalPayment.invoice_id,
          amount: reversalPayment.amount,
          payment_date: reversalPayment.payment_date,
          payment_method: reversalPayment.payment_method,
          notes: reversalPayment.notes,
          recorded_by: reversalPayment.recorded_by,
          is_reversal: true,
          reversal_of_id: reversalPayment.reversal_of_id,
          reversal_reason: reversalPayment.reversal_reason,
        })
        .select()
        .single();
      if (!error && data?.id) {
        reversalPayment.id = data.id;
      }
    } catch (err) {
      console.warn('Supabase insert reversal payment failed, cached locally:', err);
    }

    allPayments.push(reversalPayment);
    saveCachedPayments(allPayments);

    const invPayments = allPayments.filter(p => p.invoice_id === invoice.id);
    const invSchedules = await this.getInstallmentSchedule(invoice.id);
    const newMetrics = computeMSSInvoicePaymentStatus(
      invoice.actual_sale_price,
      invPayments,
      invoice.due_date,
      invSchedules
    );

    const updatedInvoice: MSSInvoice = {
      ...invoice,
      paid_amount: newMetrics.paidAmount,
      remaining_balance: newMetrics.remainingBalance,
      payment_status: newMetrics.paymentStatus,
      payments: invPayments,
      installment_schedule: invSchedules,
      updated_at: now,
    };

    try {
      await supabase
        .from('mss_invoices')
        .update({
          paid_amount: updatedInvoice.paid_amount,
          remaining_balance: updatedInvoice.remaining_balance,
          payment_status: updatedInvoice.payment_status,
          updated_at: now,
        })
        .eq('id', invoice.id);
    } catch (err) {
      console.warn('Supabase update invoice balance failed:', err);
    }

    allInvoices[invIndex] = updatedInvoice;
    saveCachedInvoices(allInvoices);

    try {
      await mssSyncService.queueOperation(
        'PAYMENT_REVERSE',
        { reversal: reversalPayment, invoice_id: invoice.id, balances: newMetrics },
        `عكس دفعة لفاتورة MSS رقم (${invoice.invoice_number}): ${safeReason}`,
        invoice.selling_branch
      );
    } catch (err) {
      console.warn('Queue PAYMENT_REVERSE failed:', err);
    }

    backupService.notifyDataChanged(`عكس دفعة MSS: ${invoice.invoice_number}`);

    return { invoice: updatedInvoice, reversalPayment };
  },

  /**
   * Get payments recorded for an MSS invoice
   */
  async getPayments(invoiceId: string): Promise<MSSPayment[]> {
    const all = getCachedPayments();
    return all
      .filter(p => p.invoice_id === invoiceId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },

  /**
   * Get installment schedule for an MSS invoice
   */
  async getInstallmentSchedule(invoiceId: string): Promise<MSSInstallmentScheduleItem[]> {
    const all = getCachedSchedules();
    return all
      .filter(s => s.invoice_id === invoiceId)
      .sort((a, b) => a.installment_number - b.installment_number || a.due_date.localeCompare(b.due_date));
  },

  /**
   * Update the future installment schedule for an MSS invoice
   */
  async updateInstallmentSchedule(
    invoiceId: string,
    installments: MSSInstallmentPlanInput[]
  ): Promise<MSSInstallmentScheduleItem[]> {
    if (!installments || installments.length === 0) {
      throw new Error('يجب تحديد قسط واحد على الأقل في الجدول.');
    }

    for (const inst of installments) {
      if (!inst.due_date) throw new Error('تاريخ استحقاق القسط مطلوب');
      if (inst.expected_amount <= 0) throw new Error('مبلغ القسط المتوقع يجب أن يكون أكبر من صفر');
    }

    const allInvoices = getCachedInvoices();
    const invIndex = allInvoices.findIndex(inv => inv.id === invoiceId || inv.invoice_number === invoiceId);
    if (invIndex < 0) {
      throw new Error('الفاتورة غير موجودة');
    }

    const invoice = allInvoices[invIndex];
    const now = new Date().toISOString();

    const newSchedules: MSSInstallmentScheduleItem[] = installments.map(inst => ({
      id: 'sch-mss-' + Math.random().toString(36).substring(2, 9),
      invoice_id: invoice.id,
      installment_number: inst.installment_number,
      due_date: inst.due_date,
      expected_amount: roundMoney(inst.expected_amount),
      notes: inst.notes || null,
      created_at: now,
    }));

    // Update local cache
    const allSchedules = getCachedSchedules().filter(s => s.invoice_id !== invoice.id);
    saveCachedSchedules([...allSchedules, ...newSchedules]);

    // Recalculate next due date
    const invPayments = await this.getPayments(invoice.id);
    const sorted = [...newSchedules].sort(
      (a, b) => a.installment_number - b.installment_number || a.due_date.localeCompare(b.due_date)
    );
    let nextDueDate: string | null = null;
    const paid = roundMoney(invPayments.reduce((s, p) => s + p.amount, 0));
    let cum = 0;
    for (const item of sorted) {
      cum += item.expected_amount;
      if (paid < roundMoney(cum)) {
        nextDueDate = item.due_date;
        break;
      }
    }
    if (!nextDueDate && sorted.length > 0) {
      nextDueDate = sorted[sorted.length - 1].due_date;
    }

    const metrics = computeMSSInvoicePaymentStatus(
      invoice.actual_sale_price,
      invPayments,
      nextDueDate,
      newSchedules
    );

    const updatedInvoice: MSSInvoice = {
      ...invoice,
      due_date: nextDueDate,
      installments_count: newSchedules.length,
      payment_status: metrics.paymentStatus,
      paid_amount: metrics.paidAmount,
      remaining_balance: metrics.remainingBalance,
      installment_schedule: newSchedules,
      payments: invPayments,
      updated_at: now,
    };

    allInvoices[invIndex] = updatedInvoice;
    saveCachedInvoices(allInvoices);

    // Queue in Outbox
    try {
      await mssSyncService.queueOperation(
        'INSTALLMENT_SCHEDULE_UPDATE',
        { invoice_id: invoice.id, schedules: newSchedules, due_date: nextDueDate, installments_count: newSchedules.length },
        `تحديث جدول أقساط فاتورة MSS رقم (${invoice.invoice_number})`,
        invoice.selling_branch
      );
    } catch (err) {
      console.warn('Queue INSTALLMENT_SCHEDULE_UPDATE failed:', err);
    }

    backupService.notifyDataChanged(`تحديث جدول أقساط MSS: ${invoice.invoice_number}`);

    return newSchedules;
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
        const cloudReservations = data.map((row: any) => ({
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
        const localCached = getCachedReservations();
        const mergedMap = new Map<string, MSSReservation>();
        for (const cr of cloudReservations) {
          mergedMap.set(cr.id, cr);
        }
        for (const lr of localCached) {
          if (!mergedMap.has(lr.id)) {
            mergedMap.set(lr.id, lr);
          }
        }
        reservations = Array.from(mergedMap.values());
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
          (r.serial_number && r.serial_number.toLowerCase().includes(q)) ||
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
   * Create device reservation visible to both shops (Supports single or multi-device reservations)
   */
  async createReservation(input: NewMSSReservationInput): Promise<MSSReservation> {
    if (!input.customer_name?.trim()) throw new Error('اسم العميل مطلوب لتوثيق الحجز');
    if (!input.customer_phone?.trim()) throw new Error('رقم هاتف العميل مطلوب');
    if (input.deposit_amount < 0) throw new Error('مبلغ العربون لا يمكن أن يكون سالباً');

    // 1. Normalize line items
    let rawItems: NewMSSReservationItemInput[] = [];
    if (Array.isArray(input.items) && input.items.length > 0) {
      rawItems = input.items;
    } else if (input.device_id) {
      rawItems = [
        {
          device_id: input.device_id,
          agreed_price: Number(input.agreed_price) || 0,
          deposit_amount: Number(input.deposit_amount) || 0,
        },
      ];
    } else {
      throw new Error('يجب اختيار جهاز واحد على الأقل للحجز');
    }

    const today = getTodayLocalDateString();
    if (input.expiry_date && input.expiry_date.trim() < today) {
      throw new Error(`تاريخ انتهاء الحجز (${input.expiry_date}) لا يمكن أن يكون في الماضي. يجب أن يكون اليوم أو تاريخاً مستقبلياً.`);
    }

    // 2. Prevent duplicate serialized device reservations
    const seenDevIds = new Set<string>();
    const seenSerials = new Set<string>();
    for (const it of rawItems) {
      if (it.device_id) {
        if (seenDevIds.has(it.device_id)) {
          throw new Error('يمنع تكرار حجز نفس الجهاز المسلسل أكثر من مرة');
        }
        seenDevIds.add(it.device_id);
      }
      if (it.serial_number && it.serial_number.trim()) {
        const s = it.serial_number.trim().toUpperCase();
        if (seenSerials.has(s)) {
          throw new Error(`يمنع تكرار حجز الجهاز بالسيريال (${s}) أكثر من مرة`);
        }
        seenSerials.add(s);
      }
    }

    // 3. Validate stock availability and calculate items
    interface ProcessedResItem {
      device: any;
      quantity: number;
      agreedPrice: number;
      depositAmount: number;
      sourceBranch: MSSStockLocation;
    }

    const processedItems: ProcessedResItem[] = [];
    for (const item of rawItems) {
      if (!item.device_id) throw new Error('يجب اختيار الجهاز المراد حجزه');
      const device = await mssInventoryService.getDeviceById(item.device_id);
      if (!device) throw new Error('الجهاز غير موجود في المخزون');

      if (device.status === 'SOLD') {
        const sDesc = device.serial_number ? `(${device.serial_number})` : '';
        throw new Error(`لا يمكن حجز جهاز مباع بالفعل ${sDesc}`);
      }

      if (device.status === 'RESERVED') {
        const sDesc = device.serial_number ? `(${device.serial_number})` : '';
        throw new Error(`الجهاز ${sDesc} محجوز مسبقاً لعميل آخر.`);
      }

      const isBulk = !device.is_serialized || Boolean(device.quantity && device.quantity > 1);
      let reqQty = 1;
      if (isBulk) {
        if (item.quantity === undefined || item.quantity === null) {
          reqQty = 1;
        } else {
          const rawQ = typeof item.quantity === 'string' && (item.quantity as string).trim() === '' ? NaN : Number(item.quantity);
          if (isNaN(rawQ) || rawQ <= 0 || !Number.isInteger(rawQ)) {
            throw new Error(
              `الكمية المطلوب حجزها للموديل (${device.model_name || ''}) غير صالحة (${item.quantity}). يجب إدخال عدد صحيح موجب أكبر من الصفر وبدون كسور.`
            );
          }
          reqQty = rawQ;
        }
      } else {
        if (item.quantity !== undefined && item.quantity !== null && Number(item.quantity) !== 1) {
          throw new Error('الأجهزة المسلسلة تحجز كوحدة واحدة فقط لكل سيريال.');
        }
        reqQty = 1;
      }
      const availQty = device.quantity && device.quantity > 0 ? device.quantity : 1;

      if (reqQty > availQty) {
        throw new Error(
          `الكمية المطلوب حجزها (${reqQty}) أكبر من المخزون المتاح (${availQty}) للموديل (${device.model_name || ''})`
        );
      }

      const itemAgreedPrice = item.agreed_price !== undefined ? Number(item.agreed_price) : device.list_price;
      if (itemAgreedPrice < 0) {
        throw new Error('السعر المتفق عليه لا يمكن أن يكون سالباً');
      }

      processedItems.push({
        device,
        quantity: reqQty,
        agreedPrice: itemAgreedPrice * reqQty,
        depositAmount: Number(item.deposit_amount) || 0,
        sourceBranch: item.source_branch || device.stock_location,
      });
    }

    const totalAgreedPrice =
      input.agreed_price !== undefined && input.device_id && !input.items
        ? Number(input.agreed_price)
        : processedItems.reduce((s, it) => s + it.agreedPrice, 0);

    const totalDeposit = Number(input.deposit_amount) || 0;
    const resNumber = await this.getNextReservationNumber();
    const now = new Date().toISOString();
    const newId = 'res-' + Math.random().toString(36).substring(2, 9) + '-' + Date.now().toString(36);

    const constructedItems: MSSReservationItem[] = processedItems.map((p, idx) => ({
      id: `res-item-${newId}-${idx + 1}`,
      reservation_id: newId,
      device_id: p.device.id,
      model_id: p.device.model_id,
      serial_number: p.device.serial_number || null,
      is_serialized: p.device.is_serialized ?? Boolean(p.device.serial_number),
      quantity: p.quantity,
      agreed_price: p.agreedPrice,
      deposit_amount: p.depositAmount,
      source_branch: p.sourceBranch,
      brand: p.device.brand,
      model_name: p.device.model_name,
      processor: p.device.model?.processor,
      gpu: p.device.model?.gpu,
      ram: p.device.model?.ram,
      storage: p.device.model?.storage,
    }));

    const firstDev = processedItems[0].device;
    const newReservation: MSSReservation = {
      id: newId,
      reservation_number: resNumber,
      device_id: firstDev.id,
      serial_number: processedItems.length === 1 ? firstDev.serial_number : null,
      branch: input.branch,
      customer_name: input.customer_name.trim(),
      customer_phone: input.customer_phone.trim(),
      deposit_amount: totalDeposit,
      agreed_price: totalAgreedPrice,
      expiry_date: input.expiry_date || new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0],
      status: 'ACTIVE',
      notes: input.notes?.trim() || null,
      items: constructedItems,
      items_count: processedItems.reduce((s, it) => s + it.quantity, 0),
      created_at: now,
      updated_at: now,
      brand: firstDev.brand,
      model_name: firstDev.model_name,
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
        constructedItems.forEach(it => (it.reservation_id = data.id));

        try {
          await supabase.from('mss_reservation_items').insert(
            constructedItems.map(it => ({
              reservation_id: data.id,
              device_id: it.device_id || null,
              model_id: it.model_id,
              serial_number: it.serial_number || null,
              quantity: it.quantity,
              agreed_price: it.agreed_price,
              deposit_amount: it.deposit_amount || 0,
              source_branch: it.source_branch,
            }))
          );
        } catch {
          // Fallback handled
        }
      }
    } catch (err) {
      console.warn('Supabase insert reservation failed, cached locally:', err);
    }

    // Atomically set device status to 'RESERVED' or decrement bulk quantity
    for (const p of processedItems) {
      if (p.device.quantity && p.device.quantity > p.quantity) {
        await mssInventoryService.updateDevice(p.device.id, {
          quantity: p.device.quantity - p.quantity,
        });
      } else {
        await mssInventoryService.updateDevice(p.device.id, {
          status: 'RESERVED',
        });
      }
    }

    const cached = getCachedReservations();
    cached.unshift(newReservation);
    saveCachedReservations(cached);

    // Queue in Outbox
    mssSyncService
      .queueOperation(
        'RESERVATION_CREATE',
        newReservation,
        constructedItems.length > 1
          ? `حجز متعدد (${constructedItems.length} أجهزة) للعميل (${newReservation.customer_name}) بحجز رقم ${newReservation.reservation_number}`
          : newReservation.serial_number
          ? `حجز جهاز بالسيريال (${newReservation.serial_number}) للعميل (${newReservation.customer_name}) بحجز رقم ${newReservation.reservation_number}`
          : `حجز جهاز بدون سيريال للعميل (${newReservation.customer_name}) بحجز رقم ${newReservation.reservation_number}`,
        newReservation.branch
      )
      .catch(console.warn);

    backupService.notifyDataChanged(`حجز جهاز MSS: ${newReservation.reservation_number}`);

    return newReservation;
  },

  /**
   * Update an existing active reservation (details, customer, notes, deposit, expiry date)
   */
  async updateReservation(
    id: string,
    input: UpdateMSSReservationInput
  ): Promise<MSSReservation> {
    const cached = getCachedReservations();
    const index = cached.findIndex(r => r.id === id);
    if (index < 0) throw new Error('سجل الحجز غير موجود');

    const res = cached[index];
    if (res.status !== 'ACTIVE') {
      throw new Error(`لا يمكن تعديل حجز بحالة (${res.status})`);
    }

    const now = new Date().toISOString();

    if (input.customer_name !== undefined) res.customer_name = input.customer_name.trim();
    if (input.customer_phone !== undefined) res.customer_phone = input.customer_phone.trim();
    if (input.deposit_amount !== undefined) res.deposit_amount = Number(input.deposit_amount);
    if (input.expiry_date !== undefined) res.expiry_date = input.expiry_date;
    if (input.notes !== undefined) res.notes = input.notes.trim() || null;
    if (input.branch !== undefined) res.branch = input.branch;

    if (input.items && input.items.length > 0) {
      const processedItems: {
        device: MSSDevice;
        quantity: number;
        agreedPrice: number;
        depositAmount: number;
        sourceBranch: MSSStockLocation;
      }[] = [];

      for (const it of input.items) {
        if (!it.device_id) throw new Error('معرف الجهاز مطلوب لكل عنصر');
        const dev = await mssInventoryService.getDeviceById(it.device_id);
        if (!dev) throw new Error(`الجهاز المعرف بـ ${it.device_id} غير موجود بالمخزون`);
        const isBulk = !dev.is_serialized || Boolean(dev.quantity && dev.quantity > 1);
        let validQty = 1;
        if (isBulk) {
          if (it.quantity === undefined || it.quantity === null) {
            validQty = 1;
          } else {
            const rawQ = typeof it.quantity === 'string' && (it.quantity as string).trim() === '' ? NaN : Number(it.quantity);
            if (isNaN(rawQ) || rawQ <= 0 || !Number.isInteger(rawQ)) {
              throw new Error(`كمية الحجز للموديل (${dev.model_name || ''}) غير صالحة. يجب إدخال عدد صحيح موجب.`);
            }
            validQty = rawQ;
          }
        } else {
          validQty = 1;
        }
        processedItems.push({
          device: dev,
          quantity: validQty,
          agreedPrice: it.agreed_price,
          depositAmount: it.deposit_amount || 0,
          sourceBranch: it.source_branch || dev.stock_location,
        });
      }

      res.items = processedItems.map((p, idx) => ({
        id: `res-item-${res.id}-${idx + 1}`,
        reservation_id: res.id,
        device_id: p.device.id,
        model_id: p.device.model_id,
        serial_number: p.device.serial_number || null,
        is_serialized: p.device.is_serialized ?? Boolean(p.device.serial_number),
        quantity: p.quantity,
        agreed_price: p.agreedPrice,
        deposit_amount: p.depositAmount,
        source_branch: p.sourceBranch,
        brand: p.device.brand,
        model_name: p.device.model_name,
        processor: p.device.model?.processor,
        gpu: p.device.model?.gpu,
        ram: p.device.model?.ram,
        storage: p.device.model?.storage,
      }));
      res.items_count = processedItems.reduce((s, it) => s + it.quantity, 0);
      res.agreed_price = processedItems.reduce((s, it) => s + it.agreedPrice, 0);
      res.device_id = processedItems[0].device.id;
      res.serial_number = processedItems.length === 1 ? processedItems[0].device.serial_number : null;
      res.brand = processedItems[0].device.brand;
      res.model_name = processedItems[0].device.model_name;
    } else if (input.agreed_price !== undefined) {
      res.agreed_price = Number(input.agreed_price);
    }

    res.updated_at = now;
    cached[index] = res;
    saveCachedReservations(cached);

    try {
      await supabase
        .from('mss_reservations')
        .update({
          customer_name: res.customer_name,
          customer_phone: res.customer_phone,
          deposit_amount: res.deposit_amount,
          agreed_price: res.agreed_price,
          expiry_date: res.expiry_date,
          notes: res.notes,
          branch: res.branch,
          updated_at: now,
        })
        .eq('id', id);
    } catch (err) {
      console.warn('Supabase update reservation failed:', err);
    }

    mssSyncService
      .queueOperation(
        'RESERVATION_CREATE',
        res,
        `تعديل بيانات حجز رقم ${res.reservation_number}`,
        res.branch
      )
      .catch(console.warn);

    backupService.notifyDataChanged(`تعديل حجز جهاز MSS: ${res.reservation_number}`);
    return res;
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

    // Release devices back to AVAILABLE
    if (Array.isArray(res.items) && res.items.length > 0) {
      for (const it of res.items) {
        if (it.device_id) {
          const dev = await mssInventoryService.getDeviceById(it.device_id);
          if (dev) {
            if (!dev.is_serialized && dev.quantity !== undefined) {
              await mssInventoryService.updateDevice(dev.id, {
                status: 'AVAILABLE',
                quantity: dev.quantity + (it.quantity || 1),
              });
            } else {
              await mssInventoryService.updateDevice(dev.id, {
                status: 'AVAILABLE',
              });
            }
          }
        }
      }
    } else if (res.device_id) {
      await mssInventoryService.updateDevice(res.device_id, {
        status: 'AVAILABLE',
      });
    }

    // Queue in Outbox
    mssSyncService
      .queueOperation(
        'RESERVATION_CANCEL',
        { reservation_id: res.id, serial_number: res.serial_number, reason },
        `إلغاء حجز رقم ${res.reservation_number}`,
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
          (r.serial_number && r.serial_number.toLowerCase().includes(q)) ||
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

    // 3. Restock device(s): set status and location
    if (Array.isArray(invoice.items) && invoice.items.length > 0) {
      for (const it of invoice.items) {
        if (it.device_id) {
          const dev = await mssInventoryService.getDeviceById(it.device_id);
          if (dev) {
            if (!dev.is_serialized && dev.quantity !== undefined) {
              await mssInventoryService.updateDevice(dev.id, {
                status: input.new_status || 'AVAILABLE',
                stock_location: input.restock_location,
                physical_condition: input.new_condition?.trim() || 'فرز أول ممتاز',
                quantity: dev.quantity + (it.quantity || 1),
              });
            } else {
              await mssInventoryService.updateDevice(dev.id, {
                status: input.new_status || 'AVAILABLE',
                stock_location: input.restock_location,
                physical_condition: input.new_condition?.trim() || 'فرز أول ممتاز',
              });
            }
          }
        }
      }
    } else if (invoice.device_id) {
      await mssInventoryService.updateDevice(invoice.device_id, {
        status: input.new_status || 'AVAILABLE',
        stock_location: input.restock_location,
        physical_condition: input.new_condition?.trim() || 'فرز أول ممتاز',
      });
    }

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
