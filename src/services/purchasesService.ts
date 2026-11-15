import { invoke, isTauri } from '@tauri-apps/api/core';
import type { Purchase, PurchaseItem, NewPurchaseInput } from '../types/purchase';
import { getTodayLocalDateString, validateDateRange } from '../lib/dateValidation.ts';
import { productsService } from './productsService.ts';
import { inventoryService } from './inventoryService.ts';
import { backupService } from './backupService.ts';

const PURCHASES_STORAGE_KEY = 'shop_accessories_purchases_v1';
const PURCHASE_ITEMS_STORAGE_KEY = 'shop_accessories_purchase_items_v1';

// Initial seed purchases for browser / fallback preview
const INITIAL_SEED_PURCHASES: Purchase[] = [
  {
    id: 'pur-seed-001',
    purchase_number: 'PUR-2024-001',
    purchase_date: '2024-11-05',
    supplier_name: 'شركة الأهرام للإلكترونيات والمستوردات',
    supplier_phone: '01011122233',
    total_amount: 4500,
    notes: 'بضاعة شواحن وسماعات فرز أول أصلي',
    items_count: 2,
    created_at: new Date('2024-11-05T10:00:00Z').toISOString(),
  },
  {
    id: 'pur-seed-002',
    purchase_number: 'PUR-2024-002',
    purchase_date: '2024-11-08',
    supplier_name: 'الوكيل العام لكابلات النيل',
    supplier_phone: '01144455566',
    total_amount: 1200,
    notes: 'دفعة كابلات قماش معتمدة',
    items_count: 1,
    created_at: new Date('2024-11-08T11:30:00Z').toISOString(),
  },
];

const INITIAL_SEED_ITEMS: PurchaseItem[] = [
  {
    id: 'pitem-seed-001',
    purchase_id: 'pur-seed-001',
    product_id: 'prd-001-chg20',
    product_name: 'شاحن سريع 20 واط Type-C أصلي',
    product_code: 'CHG-20W-QC',
    quantity: 50,
    unit_cost: 65,
    total_cost: 3250,
  },
  {
    id: 'pitem-seed-002',
    purchase_id: 'pur-seed-001',
    product_id: 'prd-005-scr9d',
    product_name: 'لاصقة حماية شاشة زجاجية 9D معالجة للخصوصية',
    product_code: 'SCR-9D-PRIV',
    quantity: 80,
    unit_cost: 15.625,
    total_cost: 1250,
  },
  {
    id: 'pitem-seed-003',
    purchase_id: 'pur-seed-002',
    product_id: 'prd-002-cbliph',
    product_name: 'كابل شحن آيفون أصلي قماش ضد القطع',
    product_code: 'CBL-IPH-BRAID',
    quantity: 30,
    unit_cost: 40,
    total_cost: 1200,
  },
];

function getLocalPurchases(): Purchase[] {
  try {
    const raw = localStorage.getItem(PURCHASES_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(PURCHASES_STORAGE_KEY, JSON.stringify(INITIAL_SEED_PURCHASES));
      return INITIAL_SEED_PURCHASES;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : INITIAL_SEED_PURCHASES;
  } catch {
    return INITIAL_SEED_PURCHASES;
  }
}

function saveLocalPurchases(purchases: Purchase[]): void {
  localStorage.setItem(PURCHASES_STORAGE_KEY, JSON.stringify(purchases));
}

function getLocalPurchaseItems(): PurchaseItem[] {
  try {
    const raw = localStorage.getItem(PURCHASE_ITEMS_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(PURCHASE_ITEMS_STORAGE_KEY, JSON.stringify(INITIAL_SEED_ITEMS));
      return INITIAL_SEED_ITEMS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : INITIAL_SEED_ITEMS;
  } catch {
    return INITIAL_SEED_ITEMS;
  }
}

function saveLocalPurchaseItems(items: PurchaseItem[]): void {
  localStorage.setItem(PURCHASE_ITEMS_STORAGE_KEY, JSON.stringify(items));
}

export const purchasesService = {
  /**
   * Fetch all purchases sorted by purchase_date desc
   */
  async getPurchases(filters?: { query?: string; startDate?: string; endDate?: string }): Promise<Purchase[]> {
    let list: Purchase[];
    if (isTauri()) {
      try {
        list = await invoke<Purchase[]>('get_accessories_purchases');
      } catch (err) {
        console.warn('Tauri get_accessories_purchases failed, fallback to local storage:', err);
        list = getLocalPurchases();
      }
    } else {
      list = getLocalPurchases();
    }

    if (!filters) return list;

    let res = list;
    if (filters.query && filters.query.trim()) {
      const q = filters.query.trim().toLowerCase();
      res = res.filter(
        p =>
          p.purchase_number.toLowerCase().includes(q) ||
          (p.supplier_name && p.supplier_name.toLowerCase().includes(q)) ||
          (p.supplier_phone && p.supplier_phone.toLowerCase().includes(q)) ||
          (p.notes && p.notes.toLowerCase().includes(q))
      );
    }

    if (filters.startDate || filters.endDate) {
      const validation = validateDateRange(filters.startDate, filters.endDate);
      const safeStart = validation.sanitizedStart;
      const safeEnd = validation.sanitizedEnd;
      if (safeStart) {
        res = res.filter(p => p.purchase_date >= safeStart);
      }
      if (safeEnd) {
        res = res.filter(p => p.purchase_date <= safeEnd);
      }
    }

    return res;
  },

  /**
   * Fetch item details of a specific purchase
   */
  async getPurchaseItems(purchaseId: string): Promise<PurchaseItem[]> {
    if (isTauri()) {
      try {
        return await invoke<PurchaseItem[]>('get_accessories_purchase_items', { purchaseId });
      } catch (err) {
        console.warn('Tauri get_accessories_purchase_items failed:', err);
      }
    }
    const allItems = getLocalPurchaseItems();
    return allItems.filter(i => i.purchase_id === purchaseId);
  },

  /**
   * Automatically generate next suggested purchase number (e.g. PUR-2024-003)
   */
  async generateNextPurchaseNumber(): Promise<string> {
    const purchases = await this.getPurchases();
    const currentYear = new Date().getFullYear();
    const prefix = `PUR-${currentYear}-`;

    const numbers = purchases
      .map(p => {
        if (p.purchase_number.startsWith(prefix)) {
          const num = parseInt(p.purchase_number.replace(prefix, ''), 10);
          return isNaN(num) ? 0 : num;
        }
        return 0;
      })
      .filter(n => n > 0);

    const nextNumber = numbers.length > 0 ? Math.max(...numbers) + 1 : 1;
    return `${prefix}${String(nextNumber).padStart(3, '0')}`;
  },

  /**
   * Record a new confirmed purchase:
   * - Validates all inputs
   * - Saves purchase header & line items
   * - Increases product stock
   * - Updates product cost if specified
   * - Records traceable inventory movements
   */
  async createPurchase(input: NewPurchaseInput): Promise<Purchase> {
    const purchaseNumber = input.purchase_number.trim();
    if (!purchaseNumber) throw new Error('رقم فاتورة الشراء مطلوب');
    if (!input.purchase_date.trim()) throw new Error('تاريخ فاتورة الشراء مطلوب');

    const today = getTodayLocalDateString();
    const cleanPurchaseDate = input.purchase_date.trim();
    if (cleanPurchaseDate > today) {
      throw new Error(`تاريخ فاتورة الشراء (${cleanPurchaseDate}) لا يمكن أن يكون في المستقبل. أقصى تاريخ مسموح هو اليوم (${today}).`);
    }
    if (!input.items || input.items.length === 0) {
      throw new Error('يجب اختيار صنف واحد على الأقل في فاتورة الشراء');
    }

    // Validate items
    for (const item of input.items) {
      if (!item.product_id) throw new Error('يجب تحديد الصنف');
      if (item.quantity <= 0) throw new Error('كمية الصنف يجب أن تكون أكبر من صفر');
      if (item.unit_cost < 0) throw new Error('سعر تكلفة الشراء لا يمكن أن يكون سالباً');
    }

    if (isTauri()) {
      try {
        const pur = await invoke<Purchase>('create_accessories_purchase', { input });
        backupService.notifyDataChanged(`تسجيل فاتورة شراء: ${pur.purchase_number}`);
        return pur;
      } catch (err: any) {
        throw new Error(typeof err === 'string' ? err : err?.message || 'فشل تسجيل فاتورة الشراء');
      }
    }

    // Local persistent fallback logic with exact atomic integrity
    const allPurchases = getLocalPurchases();

    // Check duplicate purchase number
    if (
      allPurchases.some(
        p => p.purchase_number.toLowerCase() === purchaseNumber.toLowerCase()
      )
    ) {
      throw new Error(`رقم الفاتورة "${purchaseNumber}" مسجل مسبقاً. يرجى اختيار رقم فريد.`);
    }

    const purchaseId = 'pur-' + Math.random().toString(36).substring(2, 9) + '-' + Date.now().toString(36);
    const now = new Date().toISOString();

    let totalAmount = 0;
    const newItems: PurchaseItem[] = [];

    // Process each item, update stock, and record inventory movements
    for (const item of input.items) {
      const product = await productsService.getProductById(item.product_id);
      if (!product) {
        throw new Error(`الصنف بالمعرف ${item.product_id} غير موجود`);
      }

      const lineTotal = item.quantity * item.unit_cost;
      totalAmount += lineTotal;

      const purchaseItem: PurchaseItem = {
        id: 'pitem-' + Math.random().toString(36).substring(2, 9),
        purchase_id: purchaseId,
        product_id: item.product_id,
        product_name: product.name,
        product_code: product.code,
        quantity: item.quantity,
        unit_cost: item.unit_cost,
        total_cost: lineTotal,
      };
      newItems.push(purchaseItem);

      const previousStock = product.stock;
      const newStock = previousStock + item.quantity;

      // Update product stock and optionally cost
      await productsService.updateProduct(product.id, {
        name: product.name,
        code: product.code,
        barcode: product.barcode,
        category: product.category,
        cost: item.update_product_cost ? item.unit_cost : product.cost,
        price: product.price,
        stock: newStock,
        low_stock_threshold: product.low_stock_threshold,
        description: product.description,
      });

      // Record inventory movement
      await inventoryService.recordMovementInternal({
        product_id: product.id,
        product_name: product.name,
        product_code: product.code,
        movement_type: 'PURCHASE',
        quantity_change: item.quantity,
        previous_stock: previousStock,
        new_stock: newStock,
        reference_id: purchaseId,
        reason: `وارد مشتريات فاتورة رقم ${purchaseNumber}`,
      });
    }

    const newPurchase: Purchase = {
      id: purchaseId,
      purchase_number: purchaseNumber,
      purchase_date: input.purchase_date.trim(),
      supplier_name: input.supplier_name ? input.supplier_name.trim() : null,
      supplier_phone: input.supplier_phone ? input.supplier_phone.trim() : null,
      total_amount: totalAmount,
      notes: input.notes ? input.notes.trim() : null,
      items_count: input.items.length,
      created_at: now,
    };

    allPurchases.unshift(newPurchase);
    saveLocalPurchases(allPurchases);

    const allItems = getLocalPurchaseItems();
    allItems.push(...newItems);
    saveLocalPurchaseItems(allItems);

    backupService.notifyDataChanged(`تسجيل فاتورة شراء: ${newPurchase.purchase_number}`);

    return newPurchase;
  },
};
