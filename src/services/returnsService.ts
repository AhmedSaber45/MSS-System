import { invoke, isTauri } from '@tauri-apps/api/core';
import type { ReturnRecord, ReturnItemRecord, NewReturnInput } from '../types/returns.ts';
import { productsService } from './productsService.ts';
import { inventoryService } from './inventoryService.ts';
import { salesService } from './salesService.ts';
import { backupService } from './backupService.ts';

import { getTodayLocalDateString, validateDateRange } from '../lib/dateValidation.ts';

const RETURNS_STORAGE_KEY = 'shop_accessories_returns_v1';
const RETURN_ITEMS_STORAGE_KEY = 'shop_accessories_return_items_v1';

// Seed return records for browser preview
const INITIAL_SEED_RETURNS: ReturnRecord[] = [
  {
    id: 'ret-seed-001',
    return_number: 'RET-2024-001',
    invoice_id: 'inv-seed-001',
    invoice_number: 'INV-2024-001',
    return_date: '2024-11-11',
    refund_amount: 100,
    refund_method: 'نقدي',
    reason: 'طلب العميل استبدال أو استرجاع حامل السيارة لعدم ملاءمته لفتحة التكييف',
    notes: 'تم فحص الحامل والتأكد من سلامته التامة وإعادته لرف العرض',
    items_count: 1,
    created_at: new Date('2024-11-11T14:30:00Z').toISOString(),
  },
];

const INITIAL_SEED_RETURN_ITEMS: ReturnItemRecord[] = [
  {
    id: 'ritem-seed-001',
    return_id: 'ret-seed-001',
    product_id: 'prd-004-hldmg',
    product_name: 'حامل هاتف مغناطيسي لفتحة مكيف السيارة',
    product_code: 'HLD-CAR-MAG',
    quantity_returned: 1,
    refund_unit_price: 100,
    line_refund_total: 100,
    restock_condition: 'RESTOCKED',
  },
];

function getLocalReturns(): ReturnRecord[] {
  try {
    const raw = localStorage.getItem(RETURNS_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(RETURNS_STORAGE_KEY, JSON.stringify(INITIAL_SEED_RETURNS));
      return INITIAL_SEED_RETURNS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : INITIAL_SEED_RETURNS;
  } catch {
    return INITIAL_SEED_RETURNS;
  }
}

function saveLocalReturns(records: ReturnRecord[]): void {
  localStorage.setItem(RETURNS_STORAGE_KEY, JSON.stringify(records));
}

function getLocalReturnItems(): ReturnItemRecord[] {
  try {
    const raw = localStorage.getItem(RETURN_ITEMS_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(RETURN_ITEMS_STORAGE_KEY, JSON.stringify(INITIAL_SEED_RETURN_ITEMS));
      return INITIAL_SEED_RETURN_ITEMS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : INITIAL_SEED_RETURN_ITEMS;
  } catch {
    return INITIAL_SEED_RETURN_ITEMS;
  }
}

function saveLocalReturnItems(items: ReturnItemRecord[]): void {
  localStorage.setItem(RETURN_ITEMS_STORAGE_KEY, JSON.stringify(items));
}

export const returnsService = {
  /**
   * Get all returns, optionally filtered by invoice number or date
   */
  async getReturns(filter?: { invoiceQuery?: string; startDate?: string; endDate?: string }): Promise<ReturnRecord[]> {
    let returns: ReturnRecord[];

    if (isTauri()) {
      try {
        returns = await invoke<ReturnRecord[]>('get_accessories_returns');
      } catch (err) {
        console.warn('Tauri get_accessories_returns failed, fallback to local storage', err);
        returns = getLocalReturns();
      }
    } else {
      returns = getLocalReturns();
    }

    if (!filter) return returns;

    let res = returns;
    if (filter.invoiceQuery && filter.invoiceQuery.trim()) {
      const q = filter.invoiceQuery.trim().toLowerCase();
      res = res.filter(
        r =>
          r.return_number.toLowerCase().includes(q) ||
          r.invoice_number.toLowerCase().includes(q) ||
          r.reason.toLowerCase().includes(q)
      );
    }
    if (filter.startDate || filter.endDate) {
      const validation = validateDateRange(filter.startDate, filter.endDate);
      const safeStart = validation.sanitizedStart;
      const safeEnd = validation.sanitizedEnd;
      if (safeStart) {
        res = res.filter(r => r.return_date >= safeStart);
      }
      if (safeEnd) {
        res = res.filter(r => r.return_date <= safeEnd);
      }
    }

    return res;
  },

  /**
   * Get items of a specific return record
   */
  async getReturnItems(returnId: string): Promise<ReturnItemRecord[]> {
    if (isTauri()) {
      try {
        return await invoke<ReturnItemRecord[]>('get_accessories_return_items', { returnId });
      } catch (err) {
        console.warn('Tauri get_accessories_return_items failed, fallback to local storage', err);
      }
    }

    const all = getLocalReturnItems();
    return all.filter(item => item.return_id === returnId);
  },

  /**
   * Get return summary for an invoice:
   * calculates previously returned quantities and remaining eligible returnable quantities
   */
  async getInvoiceReturnSummary(invoiceId: string) {
    const invoice = await salesService.getInvoiceById(invoiceId);
    if (!invoice) throw new Error('الفاتورة غير موجودة');

    const invoiceItems = await salesService.getInvoiceItems(invoiceId);
    const allReturns = await this.getReturns();
    const invoiceReturns = allReturns.filter(r => r.invoice_id === invoiceId);

    // Collect all return items across all past returns for this invoice
    const previouslyReturnedQtyByProduct: Record<string, number> = {};
    for (const ret of invoiceReturns) {
      const items = await this.getReturnItems(ret.id);
      for (const item of items) {
        const key = item.invoice_item_id || item.product_id || item.id;
        previouslyReturnedQtyByProduct[key] =
          (previouslyReturnedQtyByProduct[key] || 0) + item.quantity_returned;
      }
    }

    const totalRefundedAmount = invoiceReturns.reduce((sum, r) => sum + r.refund_amount, 0);

    const itemSummaries = invoiceItems.map(item => {
      const key = item.id;
      const prodKey = item.product_id || item.id;
      const returnedQty = (previouslyReturnedQtyByProduct[key] || 0) + (item.product_id ? (previouslyReturnedQtyByProduct[prodKey] || 0) : 0);
      const remainingQty = Math.max(0, item.quantity - returnedQty);
      return {
        id: item.id,
        itemType: item.item_type || 'product',
        productId: item.product_id || null,
        productName: item.product_name,
        productCode: item.product_code || '—',
        soldQuantity: item.quantity,
        previouslyReturnedQuantity: returnedQty,
        remainingReturnableQuantity: remainingQty,
        actualUnitPrice: item.actual_price,
      };
    });

    const isFullyReturned =
      itemSummaries.length > 0 && itemSummaries.every(i => i.remainingReturnableQuantity === 0);
    const isPartiallyReturned =
      !isFullyReturned && itemSummaries.some(i => i.previouslyReturnedQuantity > 0);

    return {
      invoice,
      totalSoldAmount: invoice.total_amount,
      totalRefundedAmount,
      isFullyReturned,
      isPartiallyReturned,
      itemSummaries,
    };
  },

  /**
   * Auto-generate sequential return number (e.g. RET-2024-002)
   */
  async generateNextReturnNumber(): Promise<string> {
    const currentYear = new Date().getFullYear();
    const prefix = `RET-${currentYear}-`;
    const returns = await this.getReturns();

    const numbers = returns
      .filter(r => r.return_number.startsWith(prefix))
      .map(r => {
        const parts = r.return_number.split('-');
        const lastPart = parts[parts.length - 1];
        const num = parseInt(lastPart, 10);
        return isNaN(num) ? 0 : num;
      })
      .filter(n => n > 0);

    const nextNumber = numbers.length > 0 ? Math.max(...numbers) + 1 : 1;
    return `${prefix}${String(nextNumber).padStart(3, '0')}`;
  },

  /**
   * Create a traceable sales return record:
   * - Never deletes the finalized invoice
   * - Restores stock if restock_condition === 'RESTOCKED'
   * - Records inventory movement of type 'RETURN_RESTOCKED'
   * - Updates original invoice status ('RETURNED_PARTIAL' or 'RETURNED_FULL')
   */
  async createReturn(input: NewReturnInput): Promise<ReturnRecord> {
    const retNum = input.return_number.trim();
    if (!retNum) throw new Error('رقم حركة الإرجاع مطلوب');
    if (!input.reason.trim()) throw new Error('سبب الإرجاع إلزامي لضمان تتبع الحركات المالية والمخزنية');
    if (!input.items || input.items.length === 0) throw new Error('يجب اختيار صنف واحد على الأقل للإرجاع');

    const today = getTodayLocalDateString();
    const returnDate = (input.return_date || today).trim();
    if (returnDate > today) {
      throw new Error(`تاريخ الإرجاع (${returnDate}) لا يمكن أن يكون في المستقبل. أقصى تاريخ مسموح هو اليوم (${today}).`);
    }

    for (const item of input.items) {
      if (item.quantity_returned <= 0) throw new Error('كمية الصنف المرتجع يجب أن تكون أكبر من صفر');
      if (item.refund_unit_price < 0) throw new Error('سعر الوحدة المسترد لا يمكن أن يكون سالباً');
    }

    // Verify remaining returnable quantities before proceeding
    const returnSummary = await this.getInvoiceReturnSummary(input.invoice_id);
    if (returnSummary.isFullyReturned) {
      throw new Error('تم استرجاع جميع أصناف هذه الفاتورة بالكامل مسبقاً.');
    }

    for (const item of input.items) {
      const summaryItem = returnSummary.itemSummaries.find(i =>
        (item.invoice_item_id && i.id === item.invoice_item_id) ||
        (item.product_id && i.productId === item.product_id) ||
        (item.item_type === 'maintenance' && i.itemType === 'maintenance')
      );
      if (!summaryItem) {
        throw new Error(`الصنف أو الخدمة المحددة لم يتم بيعها في الفاتورة رقم ${returnSummary.invoice.invoice_number}`);
      }
      if (item.quantity_returned > summaryItem.remainingReturnableQuantity) {
        throw new Error(
          `الكمية المطلوب إرجاعها (${item.quantity_returned}) لـ "${summaryItem.productName}" تتجاوز الكمية المتبقية القابلة للإرجاع (${summaryItem.remainingReturnableQuantity}).`
        );
      }
    }

    if (isTauri()) {
      try {
        const ret = await invoke<ReturnRecord>('create_accessories_return', { input });
        backupService.notifyDataChanged(`تسجيل مرتجع: ${ret.return_number}`);
        return ret;
      } catch (err: any) {
        throw new Error(typeof err === 'string' ? err : err?.message || 'فشل تسجيل حركة الإرجاع');
      }
    }

    // Local persistent fallback
    const allReturns = getLocalReturns();
    if (allReturns.some(r => r.return_number.toLowerCase() === retNum.toLowerCase())) {
      throw new Error(`رقم حركة الإرجاع "${retNum}" مسجل مسبقاً.`);
    }

    const invoice = await salesService.getInvoiceById(input.invoice_id);
    if (!invoice) throw new Error('الفاتورة الأصلية غير موجودة');

    const origInvoiceItems = await salesService.getInvoiceItems(input.invoice_id);

    if (invoice.status === 'RETURNED_FULL') {
      throw new Error('تم استرجاع هذه الفاتورة بالكامل مسبقاً ولا يمكن إضافة مرتجع جديد لها');
    }

    const returnId = 'ret-' + Math.random().toString(36).substring(2, 9) + '-' + Date.now().toString(36);
    const now = new Date().toISOString();

    const newItems: ReturnItemRecord[] = [];
    let calculatedRefund = 0;

    for (const rItem of input.items) {
      const isMaint = rItem.item_type === 'maintenance' || !rItem.product_id;
      let prodName = '';
      let prodCode = '—';
      let prodId: string | null = null;

      if (isMaint) {
        // Find corresponding invoice item for name
        const invItem = origInvoiceItems.find(i => (rItem.invoice_item_id && i.id === rItem.invoice_item_id) || i.item_type === 'maintenance');
        prodName = invItem?.product_name || 'خدمة صيانة';
        prodCode = '—';
        prodId = null;
      } else {
        const product = await productsService.getProductById(rItem.product_id!);
        if (!product) throw new Error(`الصنف بالمعرف ${rItem.product_id} غير موجود`);
        prodName = product.name;
        prodCode = product.code;
        prodId = product.id;
      }

      const lineTotal = rItem.quantity_returned * rItem.refund_unit_price;
      calculatedRefund += lineTotal;

      const returnItemRecord: ReturnItemRecord = {
        id: 'ritem-' + Math.random().toString(36).substring(2, 9),
        return_id: returnId,
        invoice_item_id: rItem.invoice_item_id || null,
        product_id: prodId,
        product_name: prodName,
        product_code: prodCode,
        quantity_returned: rItem.quantity_returned,
        refund_unit_price: rItem.refund_unit_price,
        line_refund_total: lineTotal,
        restock_condition: isMaint ? 'SERVICE' : rItem.restock_condition,
        item_type: isMaint ? 'maintenance' : 'product',
      };
      newItems.push(returnItemRecord);

      // CRITICAL: Only restock if NOT maintenance and condition is RESTOCKED
      if (!isMaint && rItem.restock_condition === 'RESTOCKED' && prodId) {
        const product = await productsService.getProductById(prodId);
        if (product) {
          const previousStock = product.stock;
          const newStock = previousStock + rItem.quantity_returned;

          await productsService.updateProduct(product.id, {
            name: product.name,
            code: product.code,
            barcode: product.barcode,
            category: product.category,
            cost: product.cost,
            price: product.price,
            stock: newStock,
            low_stock_threshold: product.low_stock_threshold,
            description: product.description,
          });

          await inventoryService.recordMovementInternal({
            product_id: product.id,
            product_name: product.name,
            product_code: product.code,
            movement_type: 'RETURN_RESTOCKED',
            quantity_change: rItem.quantity_returned,
            previous_stock: previousStock,
            new_stock: newStock,
            reference_id: returnId,
            reason: `مرتجع مبيعات فاتورة رقم ${invoice.invoice_number} - ${input.reason.trim()}`,
          });
        }
      }
    }

    const finalRefundAmount = input.refund_amount > 0 ? input.refund_amount : calculatedRefund;

    const newReturn: ReturnRecord = {
      id: returnId,
      return_number: retNum,
      invoice_id: invoice.id,
      invoice_number: invoice.invoice_number,
      return_date: returnDate,
      refund_amount: finalRefundAmount,
      refund_method: input.refund_method.trim() || 'نقدي',
      reason: input.reason.trim(),
      notes: input.notes?.trim() || null,
      items_count: newItems.length,
      created_at: now,
    };

    // Save return
    allReturns.unshift(newReturn);
    saveLocalReturns(allReturns);

    const currentItems = getLocalReturnItems();
    saveLocalReturnItems([...currentItems, ...newItems]);

    // Update invoice status in localStorage (never delete!)
    const allInvoices = await salesService.getInvoices();
    const updatedInvoices = allInvoices.map(inv => {
      if (inv.id === invoice.id) {
        const totalRefunded = allReturns
          .filter(r => r.invoice_id === invoice.id)
          .reduce((sum, r) => sum + r.refund_amount, 0);

        const allItemsFullyReturned = returnSummary.itemSummaries.every(sItem => {
          const thisReturnItem = input.items.find(i =>
            (i.invoice_item_id && i.invoice_item_id === sItem.id) ||
            (i.product_id && i.product_id === sItem.productId) ||
            (i.item_type === 'maintenance' && sItem.itemType === 'maintenance')
          );
          const returnedInThisTx = thisReturnItem ? thisReturnItem.quantity_returned : 0;
          return (sItem.previouslyReturnedQuantity + returnedInThisTx) >= sItem.soldQuantity;
        });

        const newStatus = allItemsFullyReturned || totalRefunded >= inv.total_amount ? 'RETURNED_FULL' : 'RETURNED_PARTIAL';
        return { ...inv, status: newStatus };
      }
      return inv;
    });
    localStorage.setItem('shop_accessories_invoices_v1', JSON.stringify(updatedInvoices));

    backupService.notifyDataChanged(`تسجيل مرتجع: ${newReturn.return_number}`);

    return newReturn;
  },
};
