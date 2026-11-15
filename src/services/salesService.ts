import { invoke, isTauri } from '@tauri-apps/api/core';
import type { Invoice, InvoiceItem, NewSaleInput } from '../types/sale.ts';
import { productsService } from './productsService.ts';
import { inventoryService } from './inventoryService.ts';
import { backupService } from './backupService.ts';

const INVOICES_STORAGE_KEY = 'shop_accessories_invoices_v1';
const INVOICE_ITEMS_STORAGE_KEY = 'shop_accessories_invoice_items_v1';

// Initial seed sales for browser / fallback preview
const INITIAL_SEED_INVOICES: Invoice[] = [
  {
    id: 'inv-seed-001',
    invoice_number: 'INV-2024-001',
    invoice_date: '2024-11-10',
    customer_name: 'أحمد محمود العوضي',
    customer_phone: '01012345678',
    subtotal: 340,
    discount: 20,
    total_amount: 320,
    payment_method: 'نقدي',
    notes: 'عميل دائم - خصم خاص على الفاتورة',
    status: 'COMPLETED',
    items_count: 2,
    created_at: new Date('2024-11-10T16:20:00Z').toISOString(),
  },
  {
    id: 'inv-seed-002',
    invoice_number: 'INV-2024-002',
    invoice_date: '2024-11-12',
    customer_name: 'سارة خالد الشريف',
    customer_phone: '01234567890',
    subtotal: 550,
    discount: 0,
    total_amount: 550,
    payment_method: 'فيزا',
    notes: 'دفع بالفيزا مع ضمان أسبوعين',
    status: 'COMPLETED',
    items_count: 2,
    created_at: new Date('2024-11-12T18:45:00Z').toISOString(),
  },
];

const INITIAL_SEED_INVOICE_ITEMS: InvoiceItem[] = [
  {
    id: 'iitem-seed-001',
    invoice_id: 'inv-seed-001',
    product_id: 'prd-001-chg20',
    product_name: 'شاحن سريع 20 واط Type-C أصلي',
    product_code: 'CHG-20W-QC',
    barcode: '622123456001',
    quantity: 2,
    original_price: 120,
    discount: 0,
    actual_price: 120,
    cost_snapshot: 65,
    line_total: 240,
  },
  {
    id: 'iitem-seed-002',
    invoice_id: 'inv-seed-001',
    product_id: 'prd-004-hldmg',
    product_name: 'حامل هاتف مغناطيسي لفتحة مكيف السيارة',
    product_code: 'HLD-CAR-MAG',
    barcode: '622123456004',
    quantity: 1,
    original_price: 100,
    discount: 0,
    actual_price: 100,
    cost_snapshot: 55,
    line_total: 100,
  },
  {
    id: 'iitem-seed-003',
    invoice_id: 'inv-seed-002',
    product_id: 'prd-003-twsanc',
    product_name: 'سماعة بلوتوث لاسلكية TWS مع خاصية العزل',
    product_code: 'TWS-ANC-PRO',
    barcode: '622123456003',
    quantity: 1,
    original_price: 450,
    discount: 0,
    actual_price: 450,
    cost_snapshot: 240,
    line_total: 450,
  },
  {
    id: 'iitem-seed-004',
    invoice_id: 'inv-seed-002',
    product_id: 'prd-004-hldmg',
    product_name: 'حامل هاتف مغناطيسي لفتحة مكيف السيارة',
    product_code: 'HLD-CAR-MAG',
    barcode: '622123456004',
    quantity: 1,
    original_price: 100,
    discount: 0,
    actual_price: 100,
    cost_snapshot: 55,
    line_total: 100,
  },
];

import { getTodayLocalDateString, validateDateRange } from '../lib/dateValidation.ts';

function getLocalInvoices(): Invoice[] {
  try {
    const raw = localStorage.getItem(INVOICES_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(INVOICES_STORAGE_KEY, JSON.stringify(INITIAL_SEED_INVOICES));
      return INITIAL_SEED_INVOICES;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : INITIAL_SEED_INVOICES;
  } catch {
    return INITIAL_SEED_INVOICES;
  }
}

function saveLocalInvoices(invoices: Invoice[]): void {
  localStorage.setItem(INVOICES_STORAGE_KEY, JSON.stringify(invoices));
}

function getLocalInvoiceItems(): InvoiceItem[] {
  try {
    const raw = localStorage.getItem(INVOICE_ITEMS_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(INVOICE_ITEMS_STORAGE_KEY, JSON.stringify(INITIAL_SEED_INVOICE_ITEMS));
      return INITIAL_SEED_INVOICE_ITEMS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : INITIAL_SEED_INVOICE_ITEMS;
  } catch {
    return INITIAL_SEED_INVOICE_ITEMS;
  }
}

function saveLocalInvoiceItems(items: InvoiceItem[]): void {
  localStorage.setItem(INVOICE_ITEMS_STORAGE_KEY, JSON.stringify(items));
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
   * - Validates invoice header and cart items
   * - Ensures available stock for all items BEFORE any modification
   * - Preserves price snapshots: original_price, discount, actual_price, cost_snapshot
   * - Atomic stock deduction
   * - Logs SALE inventory movement
   * - Prevents duplicate invoice numbers
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
      if (!item.product_id) {
        throw new Error('يجب تحديد الصنف');
      }
      if (item.quantity <= 0) {
        throw new Error('كمية الصنف المباعة يجب أن تكون أكبر من صفر');
      }
      if (item.discount < 0) {
        throw new Error('خصم الصنف لا يمكن أن يكون سالباً');
      }
    }

    if (isTauri()) {
      try {
        const inv = await invoke<Invoice>('create_accessories_sale', { input });
        backupService.notifyDataChanged(`إصدار فاتورة مبيعات: ${inv.invoice_number}`);
        return inv;
      } catch (err: any) {
        throw new Error(typeof err === 'string' ? err : err?.message || 'فشل تسجيل فاتورة المبيعات');
      }
    }

    // Local persistent fallback with strict transactional integrity
    const allInvoices = getLocalInvoices();

    // Check duplicate invoice number
    if (allInvoices.some(inv => inv.invoice_number.toLowerCase() === invNum.toLowerCase())) {
      throw new Error(`رقم فاتورة المبيعات "${invNum}" مسجل مسبقاً. يرجى استخدام رقم فريد.`);
    }

    // Pre-flight check: Verify every single product exists and has sufficient stock
    type PreparedItem = {
      product: Awaited<ReturnType<typeof productsService.getProductById>> extends (infer P | null) ? P : never;
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
      const product = await productsService.getProductById(item.product_id);
      if (!product) {
        throw new Error(`الصنف بالمعرف ${item.product_id} غير موجود في قاعدة البيانات`);
      }

      if (product.stock < item.quantity) {
        throw new Error(
          `الرصيد المتاح من الصنف "${product.name}" هو ${product.stock} قطعة فقط، ولا يكفي لبيع ${item.quantity} قطعة`
        );
      }

      if (item.discount > product.price) {
        throw new Error(`خصم الصنف (${item.discount}) لا يمكن أن يتجاوز سعر بيعه (${product.price})`);
      }

      const actualPrice = product.price - item.discount;
      const lineTotal = actualPrice * item.quantity;
      subtotal += lineTotal;

      preparedItems.push({
        product,
        quantity: item.quantity,
        originalPrice: product.price,
        discount: item.discount,
        actualPrice,
        costSnapshot: product.cost,
        lineTotal,
      });
    }

    if (input.invoice_discount < 0) {
      throw new Error('خصم الفاتورة لا يمكن أن يكون سالباً');
    }
    if (input.invoice_discount > subtotal) {
      throw new Error('خصم الفاتورة الإجمالي لا يمكن أن يتجاوز مجموع الأصناف');
    }

    const finalTotal = subtotal - input.invoice_discount;
    const invoiceId = 'inv-' + Math.random().toString(36).substring(2, 9) + '-' + Date.now().toString(36);
    const now = new Date().toISOString();
    const todayDate = now.substring(0, 10);

    // Save items, deduct stock, and record inventory movements
    const newItems: InvoiceItem[] = [];

    for (const p of preparedItems) {
      const itemRecord: InvoiceItem = {
        id: 'iitem-' + Math.random().toString(36).substring(2, 9),
        invoice_id: invoiceId,
        product_id: p.product.id,
        product_name: p.product.name,
        product_code: p.product.code,
        barcode: p.product.barcode || null,
        quantity: p.quantity,
        original_price: p.originalPrice,
        discount: p.discount,
        actual_price: p.actualPrice,
        cost_snapshot: p.costSnapshot,
        line_total: p.lineTotal,
      };
      newItems.push(itemRecord);

      const previousStock = p.product.stock;
      const newStock = previousStock - p.quantity;

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

    const newInvoice: Invoice = {
      id: invoiceId,
      invoice_number: invNum,
      invoice_date: todayDate,
      customer_name: input.customer_name?.trim() || null,
      customer_phone: input.customer_phone?.trim() || null,
      subtotal,
      discount: input.invoice_discount,
      total_amount: finalTotal,
      payment_method: input.payment_method.trim() || 'نقدي',
      notes: input.notes?.trim() || null,
      status: 'COMPLETED',
      items_count: newItems.length,
      created_at: now,
    };

    const currentInvoices = getLocalInvoices();
    currentInvoices.unshift(newInvoice);
    saveLocalInvoices(currentInvoices);

    const currentItems = getLocalInvoiceItems();
    saveLocalInvoiceItems([...currentItems, ...newItems]);

    backupService.notifyDataChanged(`إصدار فاتورة مبيعات: ${newInvoice.invoice_number}`);

    return newInvoice;
  },
};
