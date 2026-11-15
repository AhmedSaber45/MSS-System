import type { AuditLogEntry, AuditActionType } from '../types/history.ts';
import { validateDateRange } from '../lib/dateValidation.ts';
import { salesService } from './salesService.ts';
import { returnsService } from './returnsService.ts';
import { purchasesService } from './purchasesService.ts';
import { inventoryService } from './inventoryService.ts';
import { backupService } from './backupService.ts';

export const historyService = {
  /**
   * Get unified chronological audit log
   */
  async getAuditLog(filter?: {
    actionType?: AuditActionType | 'ALL';
    searchQuery?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<AuditLogEntry[]> {
    const [invoices, returns, purchases, movements, backups] = await Promise.all([
      salesService.getInvoices(),
      returnsService.getReturns(),
      purchasesService.getPurchases(),
      inventoryService.getMovements(),
      backupService.getBackups(),
    ]);

    const entries: AuditLogEntry[] = [];

    // 1. Sales Invoices
    for (const inv of invoices) {
      entries.push({
        id: `audit-inv-${inv.id}`,
        timestamp: inv.created_at,
        date: inv.invoice_date,
        actor: 'كاشير المحل',
        actionType: 'SALE',
        actionTitle: 'فاتورة مبيعات',
        referenceId: inv.id,
        referenceNumber: inv.invoice_number,
        amount: inv.total_amount,
        details: `فاتورة مبيعات رقم ${inv.invoice_number} لـ ${inv.customer_name || 'عميل نقدي'} بقيمة ${inv.total_amount} EGP (${inv.payment_method})`,
      });
    }

    // 2. Returns
    for (const ret of returns) {
      entries.push({
        id: `audit-ret-${ret.id}`,
        timestamp: ret.created_at,
        date: ret.return_date,
        actor: 'كاشير المحل',
        actionType: 'RETURN',
        actionTitle: 'مرتجع مبيعات',
        referenceId: ret.id,
        referenceNumber: ret.return_number,
        amount: -ret.refund_amount,
        details: `مرتجع مبيعات رقم ${ret.return_number} لفاتورة ${ret.invoice_number} بقيمة مستردة ${ret.refund_amount} EGP - السبب: ${ret.reason}`,
      });
    }

    // 3. Purchases
    for (const pur of purchases) {
      entries.push({
        id: `audit-pur-${pur.id}`,
        timestamp: pur.created_at,
        date: pur.purchase_date,
        actor: 'مدير المحل',
        actionType: 'PURCHASE',
        actionTitle: 'وارد مشتريات',
        referenceId: pur.id,
        referenceNumber: pur.purchase_number,
        amount: pur.total_amount,
        details: `وارد بضاعة رقم ${pur.purchase_number} من ${pur.supplier_name || 'مورد عام'} بقيمة ${pur.total_amount} EGP (${pur.items_count} أصناف)`,
      });
    }

    // 4. Stock Adjustments
    const adjustments = movements.filter(m => m.movement_type.startsWith('ADJUSTMENT'));
    for (const adj of adjustments) {
      const typeText = adj.quantity_change > 0 ? `زيادة (+${adj.quantity_change})` : `خصم (${adj.quantity_change})`;
      entries.push({
        id: `audit-adj-${adj.id}`,
        timestamp: adj.created_at,
        date: adj.created_at.substring(0, 10),
        actor: 'مدير المحل',
        actionType: 'STOCK_ADJUSTMENT',
        actionTitle: 'تسوية جردية',
        referenceId: adj.product_id,
        referenceNumber: adj.product_code,
        amount: null,
        details: `تسوية رصيد الصنف "${adj.product_name}" ${typeText} قطعة - السبب: ${adj.reason}`,
      });
    }

    // 5. Backups
    for (const b of backups) {
      const actor = b.backup_type === 'auto' ? 'النظام الآلي' : 'مدير المحل';
      entries.push({
        id: `audit-bak-${b.id}`,
        timestamp: new Date(b.date).toISOString(),
        date: b.date.substring(0, 10),
        actor,
        actionType: 'BACKUP',
        actionTitle: 'نسخ احتياطي',
        referenceId: b.filename,
        referenceNumber: b.backup_type,
        amount: null,
        details: `إنشاء نسخة احتياطية (${b.backup_type}) للملف ${b.filename} بحجم ${b.size_formatted} - الحالة: ${b.status}`,
      });
    }

    // Sort by timestamp descending
    entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    if (!filter) return entries;

    let res = entries;
    if (filter.actionType && filter.actionType !== 'ALL') {
      res = res.filter(e => e.actionType === filter.actionType);
    }
    if (filter.searchQuery && filter.searchQuery.trim()) {
      const q = filter.searchQuery.trim().toLowerCase();
      res = res.filter(
        e =>
          e.actionTitle.toLowerCase().includes(q) ||
          (e.referenceNumber && e.referenceNumber.toLowerCase().includes(q)) ||
          e.details.toLowerCase().includes(q) ||
          e.actor.toLowerCase().includes(q)
      );
    }
    if (filter.startDate || filter.endDate) {
      const validation = validateDateRange(filter.startDate, filter.endDate);
      const safeStart = validation.sanitizedStart;
      const safeEnd = validation.sanitizedEnd;
      if (safeStart) {
        res = res.filter(e => e.date >= safeStart);
      }
      if (safeEnd) {
        res = res.filter(e => e.date <= safeEnd);
      }
    }

    return res;
  },
};
