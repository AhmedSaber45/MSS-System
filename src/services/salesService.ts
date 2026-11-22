import { invoke, isTauri } from '@tauri-apps/api/core';
import type {
  Invoice,
  InvoiceItem,
  NewSaleInput,
  PaymentType,
  PaymentStatus,
  InvoicePayment,
  InstallmentScheduleItem,
  NewPaymentInput,
  InstallmentPlanInput,
} from '../types/sale.ts';
import { productsService } from './productsService.ts';
import { inventoryService } from './inventoryService.ts';
import { backupService } from './backupService.ts';
import { getTodayLocalDateString, validateDateRange } from '../lib/dateValidation.ts';
import { roundMoney } from '../lib/accounting.ts';

const INVOICES_STORAGE_KEY = 'shop_accessories_invoices_v1';
const INVOICE_ITEMS_STORAGE_KEY = 'shop_accessories_invoice_items_v1';
const ACCESSORIES_PAYMENTS_STORAGE_KEY = 'shop_accessories_payments_v1';
const ACCESSORIES_SCHEDULES_STORAGE_KEY = 'shop_accessories_installment_schedules_v1';

// Initial seed sales for browser / fallback preview
const INITIAL_SEED_INVOICES: Invoice[] = [];
const INITIAL_SEED_INVOICE_ITEMS: InvoiceItem[] = [];
const INITIAL_SEED_PAYMENTS: InvoicePayment[] = [];

const isTestEnv =
  typeof process !== 'undefined' &&
  Boolean(
    process.env?.NODE_ENV === 'test' ||
    process.env?.npm_lifecycle_event === 'test' ||
    (Array.isArray(process.argv) && process.argv.some(a => a.includes('test')))
  );

function getLocalInvoices(): Invoice[] {
  try {
    const raw = localStorage.getItem(INVOICES_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(inv => !inv.id?.startsWith('inv-seed-'));
  } catch {
    return [];
  }
}

function saveLocalInvoices(invoices: Invoice[]): void {
  localStorage.setItem(INVOICES_STORAGE_KEY, JSON.stringify(invoices));
}

function getLocalInvoiceItems(): InvoiceItem[] {
  try {
    const raw = localStorage.getItem(INVOICE_ITEMS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(item => !item.id?.startsWith('iitem-seed-') && !item.invoice_id?.startsWith('inv-seed-'));
  } catch {
    return [];
  }
}

function saveLocalInvoiceItems(items: InvoiceItem[]): void {
  localStorage.setItem(INVOICE_ITEMS_STORAGE_KEY, JSON.stringify(items));
}

function getLocalPayments(): InvoicePayment[] {
  try {
    const raw = localStorage.getItem(ACCESSORIES_PAYMENTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(pay => !pay.id?.startsWith('pay-seed-') && !pay.invoice_id?.startsWith('inv-seed-'));
  } catch {
    return [];
  }
}

function saveLocalPayments(payments: InvoicePayment[]): void {
  localStorage.setItem(ACCESSORIES_PAYMENTS_STORAGE_KEY, JSON.stringify(payments));
}

function getLocalSchedules(): InstallmentScheduleItem[] {
  try {
    const raw = localStorage.getItem(ACCESSORIES_SCHEDULES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLocalSchedules(schedules: InstallmentScheduleItem[]): void {
  localStorage.setItem(ACCESSORIES_SCHEDULES_STORAGE_KEY, JSON.stringify(schedules));
}

/**
 * Authoritative financial calculation for an invoice's payment status, total collected, and remaining balance.
 */
export function computeInvoicePaymentStatus(
  totalAmount: number,
  payments: InvoicePayment[],
  dueDate?: string | null,
  schedule: InstallmentScheduleItem[] = []
): { paidAmount: number; remainingBalance: number; paymentStatus: PaymentStatus } {
  // Sum up all payments (positive for standard, negative for reversals)
  const netPaid = roundMoney(
    payments.reduce((sum, p) => sum + (p.amount || 0), 0)
  );
  const remainingBalance = Math.max(0, roundMoney(totalAmount - netPaid));

  let paymentStatus: PaymentStatus;
  const today = getTodayLocalDateString();

  if (remainingBalance <= 0.001) {
    paymentStatus = 'PAID';
  } else {
    // Check for overdue conditions:
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

export const salesService = {
  /**
   * Get all invoices, optionally filtered
   */
  async getInvoices(filters?: {
    query?: string;
    startDate?: string;
    endDate?: string;
    paymentMethod?: string;
    paymentStatus?: string;
  }): Promise<Invoice[]> {
    let invoices: Invoice[];

    if (isTauri()) {
      try {
        invoices = await invoke<Invoice[]>('get_accessories_invoices');
      } catch (err) {
        console.warn('Tauri get_accessories_invoices failed, falling back to local storage', err);
        invoices = getLocalInvoices();
      }
    } else {
      invoices = getLocalInvoices();
    }

    // Enrich each invoice with its payments, schedule, and dynamic payment status
    const allPayments = getLocalPayments();
    const allSchedules = getLocalSchedules();

    invoices = invoices.map(inv => {
      const invPayments = allPayments.filter(p => p.invoice_id === inv.id);
      const invSchedules = allSchedules.filter(s => s.invoice_id === inv.id);

      // If we have recorded payments in local storage, use them to dynamically compute payment status
      if (invPayments.length > 0) {
        const metrics = computeInvoicePaymentStatus(
          inv.total_amount,
          invPayments,
          inv.due_date,
          invSchedules
        );

        return {
          ...inv,
          payment_type: inv.payment_type || 'FULL',
          payment_status: metrics.paymentStatus,
          paid_amount: metrics.paidAmount,
          remaining_balance: metrics.remainingBalance,
          installments_count: invSchedules.length > 0 ? invSchedules.length : inv.installments_count || 0,
          payments: invPayments,
          installment_schedule: invSchedules,
        };
      }

      // If no separate payment records exist, preserve authoritative values from invoice record (e.g. from SQLite)
      const isDeferred = inv.payment_type === 'DEFERRED';
      const paid = inv.paid_amount !== undefined && inv.paid_amount !== null
        ? inv.paid_amount
        : (isDeferred ? 0 : inv.total_amount);
      const remaining = inv.remaining_balance !== undefined && inv.remaining_balance !== null
        ? inv.remaining_balance
        : (isDeferred ? Math.max(0, inv.total_amount - paid) : 0);
      const status = inv.payment_status || (remaining <= 0.001 ? 'PAID' : (paid > 0 ? 'PARTIALLY_PAID' : 'UNPAID'));

      return {
        ...inv,
        payment_type: inv.payment_type || 'FULL',
        payment_status: status,
        paid_amount: paid,
        remaining_balance: remaining,
        installments_count: invSchedules.length > 0 ? invSchedules.length : inv.installments_count || 0,
        payments: invPayments,
        installment_schedule: invSchedules,
      };
    });

    if (!filters) return invoices;

    let result = invoices;

    if (filters.query && filters.query.trim()) {
      const q = filters.query.trim().toLowerCase();
      result = result.filter(
        inv =>
          inv.invoice_number.toLowerCase().includes(q) ||
          (inv.customer_name && inv.customer_name.toLowerCase().includes(q)) ||
          (inv.customer_phone && inv.customer_phone.toLowerCase().includes(q)) ||
          (inv.notes && inv.notes.toLowerCase().includes(q))
      );
    }

    // Validate and sanitize date filters against future dates and range ordering
    if (filters.startDate || filters.endDate) {
      const validation = validateDateRange(filters.startDate, filters.endDate);
      const safeStart = validation.sanitizedStart;
      const safeEnd = validation.sanitizedEnd;

      if (safeStart) {
        result = result.filter(inv => inv.invoice_date >= safeStart);
      }
      if (safeEnd) {
        result = result.filter(inv => inv.invoice_date <= safeEnd);
      }
    }

    if (filters.paymentMethod && filters.paymentMethod !== 'ALL') {
      result = result.filter(inv => inv.payment_method === filters.paymentMethod);
    }

    if (filters.paymentStatus && filters.paymentStatus !== 'ALL') {
      result = result.filter(inv => inv.payment_status === filters.paymentStatus);
    }

    return result;
  },

  /**
   * Get a single invoice by ID
   */
  async getInvoiceById(id: string): Promise<Invoice | null> {
    const all = await this.getInvoices();
    return all.find(inv => inv.id === id) || null;
  },

  /**
   * Get items belonging to a specific invoice
   */
  async getInvoiceItems(invoiceId: string): Promise<InvoiceItem[]> {
    if (isTauri()) {
      try {
        return await invoke<InvoiceItem[]>('get_accessories_invoice_items', {
          invoiceId,
        });
      } catch (err) {
        console.warn('Tauri get_accessories_invoice_items failed, using local storage', err);
      }
    }

    const allItems = getLocalInvoiceItems();
    return allItems.filter(item => item.invoice_id === invoiceId);
  },

  /**
   * Get payments recorded for an invoice
   */
  async getPayments(invoiceId: string): Promise<InvoicePayment[]> {
    const all = getLocalPayments();
    return all
      .filter(p => p.invoice_id === invoiceId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },

  /**
   * Get installment schedule for an invoice
   */
  async getInstallmentSchedule(invoiceId: string): Promise<InstallmentScheduleItem[]> {
    const all = getLocalSchedules();
    return all
      .filter(s => s.invoice_id === invoiceId)
      .sort((a, b) => a.installment_number - b.installment_number || a.due_date.localeCompare(b.due_date));
  },

  /**
   * Auto-generate the next sequential invoice number (e.g. INV-2024-003)
   */
  async generateNextInvoiceNumber(): Promise<string> {
    const currentYear = new Date().getFullYear();
    const prefix = `INV-${currentYear}-`;
    const invoices = await this.getInvoices();

    const numbers = invoices
      .filter(inv => inv.invoice_number.startsWith(prefix))
      .map(inv => {
        const parts = inv.invoice_number.split('-');
        const lastPart = parts[parts.length - 1];
        const num = parseInt(lastPart, 10);
        return isNaN(num) ? 0 : num;
      })
      .filter(n => n > 0);

    const nextNumber = numbers.length > 0 ? Math.max(...numbers) + 1 : 1;
    return `${prefix}${String(nextNumber).padStart(3, '0')}`;
  },

  /**
   * Create a confirmed sale:
   * - Supports FULL payment or DEFERRED / INSTALLMENT payments
   * - Validates invoice header and cart items
   * - Ensures available stock for all items BEFORE any modification
   * - On Tauri desktop: Atomically executes through SQLite transaction (create_accessories_sale)
   * - On browser/test: Atomically deducts stock & logs movements with automatic rollback on error
   * - Preserves price snapshots & creates individual payment transactions
   * - Stores planned installment schedule separately from actual payments
   */
  async createSale(input: NewSaleInput): Promise<Invoice> {
    const invNum = input.invoice_number.trim();
    if (!invNum) {
      throw new Error('رقم فاتورة المبيعات مطلوب');
    }
    if (!input.items || input.items.length === 0) {
      throw new Error('يجب إضافة صنف واحد على الأقل في سلة المبيعات');
    }

    const today = getTodayLocalDateString();
    if (input.invoice_date && input.invoice_date.trim() > today) {
      throw new Error(`تاريخ الفاتورة (${input.invoice_date}) لا يمكن أن يكون في المستقبل. أقصى تاريخ مسموح هو اليوم (${today}).`);
    }

    // Input item validation
    for (const item of input.items) {
      if (item.item_type === 'maintenance') {
        if (!item.description || !item.description.trim()) {
          throw new Error('وصف خدمة الصيانة إلزامي');
        }
        if (item.price === undefined || item.price < 0) {
          throw new Error('سعر خدمة الصيانة يجب أن يكون رقماً غير سالب');
        }
      } else {
        if (!item.product_id) {
          throw new Error('يجب تحديد الصنف');
        }
      }
      if (item.quantity <= 0) {
        throw new Error('كمية الصنف المباعة يجب أن تكون أكبر من صفر');
      }
      if ((item.discount || 0) < 0) {
        throw new Error('خصم الصنف لا يمكن أن يكون سالباً');
      }
    }

    // --- DESKTOP TAURI ATOMIC EXECUTION ---
    if (isTauri()) {
      const sanitizedInput = {
        invoice_number: invNum,
        customer_name: input.customer_name?.trim() || null,
        customer_phone: input.customer_phone?.trim() || null,
        invoice_discount: Number(input.invoice_discount || 0),
        payment_method: input.payment_method?.trim() || 'نقدي',
        notes: input.notes?.trim() || null,
        payment_type: input.payment_type || 'FULL',
        initial_payment: input.initial_payment !== undefined ? Number(input.initial_payment) : null,
        due_date: input.due_date || null,
        installments: input.installments?.map(inst => ({
          installment_number: Number(inst.installment_number),
          due_date: String(inst.due_date),
          expected_amount: Number(inst.expected_amount),
          notes: inst.notes || null,
        })) || null,
        items: input.items.map(item => ({
          product_id: item.product_id || null,
          item_type: item.item_type || 'product',
          description: item.description || null,
          price: item.price !== undefined ? Number(item.price) : null,
          quantity: Math.floor(Number(item.quantity)),
          discount: Number(item.discount || 0),
        })),
      };

      const invoice = await invoke<Invoice>('create_accessories_sale', { input: sanitizedInput });

      // Fetch items recorded in SQLite
      let items: InvoiceItem[] = [];
      try {
        items = await invoke<InvoiceItem[]>('get_accessories_invoice_items', {
          invoiceId: invoice.id,
        });
      } catch (err) {
        console.warn('Could not fetch inserted invoice items', err);
      }

      // Sync local storage for caching and offline view
      try {
        const localInvs = getLocalInvoices().filter(i => i.id !== invoice.id);
        localInvs.unshift(invoice);
        saveLocalInvoices(localInvs);

        if (items.length > 0) {
          const localItems = getLocalInvoiceItems().filter(i => i.invoice_id !== invoice.id);
          saveLocalInvoiceItems([...localItems, ...items]);
        }

        if (invoice.paid_amount && invoice.paid_amount > 0) {
          const localPayments = getLocalPayments().filter(p => p.invoice_id !== invoice.id);
          localPayments.push({
            id: 'pay-' + Math.random().toString(36).substring(2, 9),
            invoice_id: invoice.id,
            amount: invoice.paid_amount,
            payment_date: invoice.invoice_date,
            payment_method: invoice.payment_method,
            notes: invoice.payment_type === 'DEFERRED' ? 'دفعة أولى عند البيع بالتقسيط / الأجل' : 'سداد كامل عند إصدار الفاتورة',
            recorded_by: null,
            is_reversal: false,
            created_at: invoice.created_at,
          });
          saveLocalPayments(localPayments);
        }

        if (input.installments && input.installments.length > 0) {
          const localSchedules = getLocalSchedules().filter(s => s.invoice_id !== invoice.id);
          for (const inst of input.installments) {
            localSchedules.push({
              id: 'sch-' + Math.random().toString(36).substring(2, 9),
              invoice_id: invoice.id,
              installment_number: inst.installment_number,
              due_date: inst.due_date,
              expected_amount: roundMoney(inst.expected_amount),
              notes: inst.notes || null,
              created_at: invoice.created_at,
            });
          }
          saveLocalSchedules(localSchedules);
        }
      } catch (err) {
        console.warn('Failed to sync invoice to local storage', err);
      }

      backupService.notifyDataChanged(`إصدار فاتورة مبيعات: ${invoice.invoice_number}`);
      return invoice;
    }

    // --- BROWSER / TEST PERSISTENT FALLBACK WITH STRICT TRANSACTIONAL INTEGRITY ---
    const allInvoices = getLocalInvoices();

    // Check duplicate invoice number
    if (allInvoices.some(inv => inv.invoice_number.toLowerCase() === invNum.toLowerCase())) {
      throw new Error(`رقم فاتورة المبيعات "${invNum}" مسجل مسبقاً. يرجى استخدام رقم فريد.`);
    }

    // Pre-flight check: Verify every single product exists and has sufficient stock
    type PreparedItem = {
      itemType: 'product' | 'maintenance';
      productId?: string | null;
      productName: string;
      productCode: string;
      barcode?: string | null;
      product?: any;
      quantity: number;
      originalPrice: number;
      discount: number;
      actualPrice: number;
      costSnapshot: number;
      lineTotal: number;
    };

    const preparedItems: PreparedItem[] = [];
    let subtotal = 0;

    for (const item of input.items) {
      if (item.item_type === 'maintenance') {
        const desc = (item.description || '').trim();
        const price = item.price || 0;
        const discount = item.discount || 0;
        if (discount > price) {
          throw new Error(`خصم خدمة الصيانة (${discount}) لا يمكن أن يتجاوز قيمتها (${price})`);
        }
        const actualPrice = price - discount;
        const lineTotal = actualPrice * item.quantity;
        subtotal += lineTotal;

        preparedItems.push({
          itemType: 'maintenance',
          productId: null,
          productName: desc,
          productCode: '—',
          barcode: null,
          quantity: item.quantity,
          originalPrice: price,
          discount,
          actualPrice,
          costSnapshot: 0,
          lineTotal,
        });
      } else {
        const product = await productsService.getProductById(item.product_id!);
        if (!product) {
          throw new Error(`الصنف بالمعرف ${item.product_id} غير موجود في قاعدة البيانات`);
        }

        if (product.stock < item.quantity) {
          throw new Error(
            `الرصيد المتاح من الصنف "${product.name}" هو ${product.stock} قطعة فقط، ولا يكفي لبيع ${item.quantity} قطعة`
          );
        }

        const discount = item.discount || 0;
        if (discount > product.price) {
          throw new Error(`خصم الصنف (${discount}) لا يمكن أن يتجاوز سعر بيعه (${product.price})`);
        }

        const actualPrice = product.price - discount;
        const lineTotal = actualPrice * item.quantity;
        subtotal += lineTotal;

        preparedItems.push({
          itemType: 'product',
          productId: product.id,
          productName: product.name,
          productCode: product.code,
          barcode: product.barcode || null,
          product,
          quantity: item.quantity,
          originalPrice: product.price,
          discount,
          actualPrice,
          costSnapshot: product.cost,
          lineTotal,
        });
      }
    }

    const invoiceDiscount = input.invoice_discount ? Number(input.invoice_discount) : 0;
    if (invoiceDiscount < 0) {
      throw new Error('خصم الفاتورة لا يمكن أن يكون سالباً');
    }
    if (invoiceDiscount > subtotal) {
      throw new Error('خصم الفاتورة الإجمالي لا يمكن أن يتجاوز مجموع الأصناف');
    }

    const finalTotal = roundMoney(subtotal - invoiceDiscount);
    const invoiceId = 'inv-' + Math.random().toString(36).substring(2, 9) + '-' + Date.now().toString(36);
    const now = new Date().toISOString();
    const todayDate = input.invoice_date || now.substring(0, 10);
    const safePaymentMethod = input.payment_method?.trim() || 'نقدي';

    // Save items, deduct stock, and record inventory movements with rollback protection
    const newItems: InvoiceItem[] = [];
    const rollbacks: Array<() => Promise<void>> = [];

    try {
      for (const p of preparedItems) {
        const itemRecord: InvoiceItem = {
          id: 'iitem-' + Math.random().toString(36).substring(2, 9),
          invoice_id: invoiceId,
          product_id: p.productId,
          product_name: p.productName,
          product_code: p.productCode,
          barcode: p.barcode || null,
          quantity: p.quantity,
          original_price: p.originalPrice,
          discount: p.discount,
          actual_price: p.actualPrice,
          cost_snapshot: p.costSnapshot,
          line_total: p.lineTotal,
          item_type: p.itemType,
        };
        newItems.push(itemRecord);

        // Only deduct inventory and record movements for physical products!
        if (p.itemType === 'product' && p.product) {
          const previousStock = p.product.stock;
          const newStock = previousStock - p.quantity;

          rollbacks.push(async () => {
            await productsService.updateProduct(p.product.id, {
              ...p.product,
              stock: previousStock,
            });
          });

          // 1. Deduct stock from product
          await productsService.updateProduct(p.product.id, {
            name: p.product.name,
            code: p.product.code,
            barcode: p.product.barcode,
            category: p.product.category,
            cost: p.product.cost,
            price: p.product.price,
            stock: newStock,
            low_stock_threshold: p.product.low_stock_threshold,
            description: p.product.description,
          });

          // 2. Record inventory movement as SALE
          await inventoryService.recordMovementInternal({
            product_id: p.product.id,
            product_name: p.product.name,
            product_code: p.product.code,
            movement_type: 'SALE',
            quantity_change: -p.quantity,
            previous_stock: previousStock,
            new_stock: newStock,
            reference_id: invoiceId,
            reason: `فاتورة مبيعات رقم ${invNum}`,
          });
        }
      }
    } catch (err) {
      for (const rollback of rollbacks) {
        try { await rollback(); } catch {}
      }
      throw err;
    }

    // Phase 2: Deferred & Installment Calculation
    const paymentType: PaymentType = input.payment_type || 'FULL';
    let paidAmount = 0;
    let remainingBalance = 0;
    let paymentStatus: PaymentStatus = 'PAID';
    const initialPaymentsToStore: InvoicePayment[] = [];
    const schedulesToStore: InstallmentScheduleItem[] = [];

    if (paymentType === 'DEFERRED') {
      const initialPayment = input.initial_payment !== undefined ? Number(input.initial_payment) : 0;
      if (isNaN(initialPayment) || initialPayment < 0) {
        throw new Error('الدفعة المقدمة لا يمكن أن تكون سالبة');
      }
      if (roundMoney(initialPayment) > finalTotal) {
        throw new Error('الدفعة المقدمة لا يمكن أن تتجاوز إجمالي الفاتورة');
      }

      paidAmount = roundMoney(initialPayment);
      remainingBalance = roundMoney(finalTotal - paidAmount);

      // Validate and record planned installment schedule
      if (input.installments && input.installments.length > 0) {
        for (const inst of input.installments) {
          if (!inst.due_date) {
            throw new Error('تاريخ استحقاق القسط مطلوب');
          }
          if (inst.expected_amount <= 0) {
            throw new Error('مبلغ القسط المتوقع يجب أن يكون أكبر من صفر');
          }
          schedulesToStore.push({
            id: 'sch-' + Math.random().toString(36).substring(2, 9),
            invoice_id: invoiceId,
            installment_number: inst.installment_number,
            due_date: inst.due_date,
            expected_amount: roundMoney(inst.expected_amount),
            notes: inst.notes || null,
            created_at: now,
          });
        }
      }

      // Record initial payment transaction if initial payment > 0
      if (paidAmount > 0) {
        initialPaymentsToStore.push({
          id: 'pay-' + Math.random().toString(36).substring(2, 9) + '-' + Date.now().toString(36),
          invoice_id: invoiceId,
          amount: paidAmount,
          payment_date: todayDate,
          payment_method: safePaymentMethod,
          notes: 'دفعة أولى عند البيع بالتقسيط / الأجل',
          recorded_by: null,
          is_reversal: false,
          created_at: now,
        });
      }

      // Determine initial payment status
      const metrics = computeInvoicePaymentStatus(
        finalTotal,
        initialPaymentsToStore,
        input.due_date || (schedulesToStore[0]?.due_date ?? null),
        schedulesToStore
      );
      paymentStatus = metrics.paymentStatus;
    } else {
      // FULL Payment
      paidAmount = finalTotal;
      remainingBalance = 0;
      paymentStatus = 'PAID';

      if (finalTotal > 0) {
        initialPaymentsToStore.push({
          id: 'pay-' + Math.random().toString(36).substring(2, 9) + '-' + Date.now().toString(36),
          invoice_id: invoiceId,
          amount: finalTotal,
          payment_date: todayDate,
          payment_method: safePaymentMethod,
          notes: 'سداد كامل عند إنشاء الفاتورة',
          recorded_by: null,
          is_reversal: false,
          created_at: now,
        });
      }
    }

    const nextDueDate = input.due_date || (schedulesToStore[0]?.due_date ?? null);

    const newInvoice: Invoice = {
      id: invoiceId,
      invoice_number: invNum,
      invoice_date: todayDate,
      customer_name: input.customer_name?.trim() || null,
      customer_phone: input.customer_phone?.trim() || null,
      subtotal,
      discount: invoiceDiscount,
      total_amount: finalTotal,
      payment_method: safePaymentMethod,
      notes: input.notes?.trim() || null,
      status: 'COMPLETED',
      items_count: newItems.length,
      created_at: now,
      payment_type: paymentType,
      payment_status: paymentStatus,
      paid_amount: paidAmount,
      remaining_balance: remainingBalance,
      due_date: nextDueDate,
      installments_count: schedulesToStore.length,
      payments: initialPaymentsToStore,
      installment_schedule: schedulesToStore,
    };

    const currentInvoices = getLocalInvoices();
    currentInvoices.unshift(newInvoice);
    saveLocalInvoices(currentInvoices);

    const currentItems = getLocalInvoiceItems();
    saveLocalInvoiceItems([...currentItems, ...newItems]);

    if (initialPaymentsToStore.length > 0) {
      saveLocalPayments([...getLocalPayments(), ...initialPaymentsToStore]);
    }

    if (schedulesToStore.length > 0) {
      saveLocalSchedules([...getLocalSchedules(), ...schedulesToStore]);
    }

    backupService.notifyDataChanged(`إصدار فاتورة مبيعات: ${newInvoice.invoice_number}`);

    return newInvoice;
  },

  /**
   * Record a new customer payment for an existing deferred invoice:
   * - Strict financial validation: amount > 0, amount <= remaining balance
   * - Never overwrites previous payments (append-only ledger)
   * - Recalculates total paid and remaining balance automatically
   * - Updates invoice payment status immediately
   */
  async recordPayment(invoiceId: string, input: NewPaymentInput): Promise<{ invoice: Invoice; payment: InvoicePayment }> {
    const amount = roundMoney(Number(input.amount));
    if (isNaN(amount) || amount <= 0) {
      throw new Error('قيمة الدفعة المحصلة يجب أن تكون أكبر من صفر');
    }

    const invoice = await this.getInvoiceById(invoiceId);
    if (!invoice) {
      throw new Error('الفاتورة غير موجودة');
    }

    const existingPayments = await this.getPayments(invoiceId);
    const existingSchedules = await this.getInstallmentSchedule(invoiceId);

    const currentMetrics = computeInvoicePaymentStatus(
      invoice.total_amount,
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
    const newPayment: InvoicePayment = {
      id: 'pay-' + Math.random().toString(36).substring(2, 9) + '-' + Date.now().toString(36),
      invoice_id: invoiceId,
      amount,
      payment_date: input.payment_date || getTodayLocalDateString(),
      payment_method: input.payment_method || 'نقدي',
      notes: input.notes?.trim() || null,
      recorded_by: input.recorded_by || null,
      is_reversal: false,
      created_at: now,
    };

    // Save payment
    const allPayments = getLocalPayments();
    allPayments.push(newPayment);
    saveLocalPayments(allPayments);

    // Recompute invoice metrics
    const updatedPayments = [...existingPayments, newPayment];
    const newMetrics = computeInvoicePaymentStatus(
      invoice.total_amount,
      updatedPayments,
      invoice.due_date,
      existingSchedules
    );

    // Update next due date from schedule if any
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

    const updatedInvoice: Invoice = {
      ...invoice,
      paid_amount: newMetrics.paidAmount,
      remaining_balance: newMetrics.remainingBalance,
      payment_status: newMetrics.paymentStatus,
      due_date: nextDueDate,
      payments: updatedPayments,
      installment_schedule: existingSchedules,
    };

    const allInvoices = getLocalInvoices();
    const invIndex = allInvoices.findIndex(inv => inv.id === invoiceId);
    if (invIndex >= 0) {
      allInvoices[invIndex] = updatedInvoice;
    } else {
      allInvoices.unshift(updatedInvoice);
    }
    saveLocalInvoices(allInvoices);
    backupService.notifyDataChanged(`تسجيل دفعة بقيمة ${amount} EGP لفاتورة ${invoice.invoice_number}`);

    return { invoice: updatedInvoice, payment: newPayment };
  },

  /**
   * Safely reverse a previously recorded payment without deleting financial history:
   * - Records a reversal transaction with negative amount and explicit reason
   * - Recalculates remaining balance and updates invoice status
   */
  async reversePayment(
    paymentId: string,
    reason: string,
    recorded_by?: string
  ): Promise<{ invoice: Invoice; reversalPayment: InvoicePayment }> {
    const safeReason = (reason || '').trim();
    if (!safeReason) {
      throw new Error('سبب إلغاء/عكس الدفعة إلزامي لضمان النزاهة المالية وتوثيق السجل.');
    }

    const allPayments = getLocalPayments();
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

    const invoice = await this.getInvoiceById(payment.invoice_id);
    if (!invoice) {
      throw new Error('الفاتورة المرتبطة بالدفعة غير موجودة.');
    }

    const now = new Date().toISOString();

    const reversalPayment: InvoicePayment = {
      id: 'pay-rev-' + Math.random().toString(36).substring(2, 9) + '-' + Date.now().toString(36),
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

    allPayments.push(reversalPayment);
    saveLocalPayments(allPayments);

    const invPayments = allPayments.filter(p => p.invoice_id === invoice.id);
    const invSchedules = await this.getInstallmentSchedule(invoice.id);
    const newMetrics = computeInvoicePaymentStatus(
      invoice.total_amount,
      invPayments,
      invoice.due_date,
      invSchedules
    );

    const updatedInvoice: Invoice = {
      ...invoice,
      paid_amount: newMetrics.paidAmount,
      remaining_balance: newMetrics.remainingBalance,
      payment_status: newMetrics.paymentStatus,
      payments: invPayments,
      installment_schedule: invSchedules,
    };

    const allInvoices = getLocalInvoices();
    const invIndex = allInvoices.findIndex(inv => inv.id === payment.invoice_id);
    if (invIndex >= 0) {
      allInvoices[invIndex] = updatedInvoice;
    } else {
      allInvoices.unshift(updatedInvoice);
    }
    saveLocalInvoices(allInvoices);
    backupService.notifyDataChanged(`عكس دفعة لفاتورة ${invoice.invoice_number}: ${safeReason}`);

    return { invoice: updatedInvoice, reversalPayment };
  },

  /**
   * Update the expected installment plan without modifying historical payment records:
   * - Allows configuring future dates and expected installment amounts
   * - Recalculates next expected payment date
   */
  async updateInstallmentSchedule(
    invoiceId: string,
    installments: InstallmentPlanInput[]
  ): Promise<InstallmentScheduleItem[]> {
    if (!installments || installments.length === 0) {
      throw new Error('يجب تحديد قسط واحد على الأقل في الجدول.');
    }

    for (const inst of installments) {
      if (!inst.due_date) {
        throw new Error('تاريخ استحقاق القسط مطلوب');
      }
      if (inst.expected_amount <= 0) {
        throw new Error('مبلغ القسط المتوقع يجب أن يكون أكبر من صفر');
      }
    }

    const invoice = await this.getInvoiceById(invoiceId);
    if (!invoice) {
      throw new Error('الفاتورة غير موجودة');
    }

    const now = new Date().toISOString();

    const newSchedules: InstallmentScheduleItem[] = installments.map(inst => ({
      id: 'sch-' + Math.random().toString(36).substring(2, 9),
      invoice_id: invoiceId,
      installment_number: inst.installment_number,
      due_date: inst.due_date,
      expected_amount: roundMoney(inst.expected_amount),
      notes: inst.notes || null,
      created_at: now,
    }));

    // Replace schedules for this invoice
    const allSchedules = getLocalSchedules().filter(s => s.invoice_id !== invoiceId);
    saveLocalSchedules([...allSchedules, ...newSchedules]);

    // Recalculate invoice metrics
    const invPayments = await this.getPayments(invoiceId);
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

    const metrics = computeInvoicePaymentStatus(
      invoice.total_amount,
      invPayments,
      nextDueDate,
      newSchedules
    );

    const updatedInvoice: Invoice = {
      ...invoice,
      due_date: nextDueDate,
      installments_count: newSchedules.length,
      payment_status: metrics.paymentStatus,
      paid_amount: metrics.paidAmount,
      remaining_balance: metrics.remainingBalance,
      installment_schedule: newSchedules,
      payments: invPayments,
    };

    const allInvoices = getLocalInvoices();
    const invIndex = allInvoices.findIndex(inv => inv.id === invoiceId);
    if (invIndex >= 0) {
      allInvoices[invIndex] = updatedInvoice;
    } else {
      allInvoices.unshift(updatedInvoice);
    }
    saveLocalInvoices(allInvoices);
    backupService.notifyDataChanged(`تحديث جدول أقساط فاتورة ${invoice.invoice_number}`);

    return newSchedules;
  },
};
