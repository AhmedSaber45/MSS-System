export type AuditActionType =
  | 'SALE'
  | 'RETURN'
  | 'PURCHASE'
  | 'STOCK_ADJUSTMENT'
  | 'PRODUCT_CREATE'
  | 'PRODUCT_UPDATE'
  | 'BACKUP'
  | 'RESTORE';

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  date: string;
  actor: string; // 'كاشير المحل' | 'مدير المحل' | 'النظام الآلي'
  actionType: AuditActionType;
  actionTitle: string;
  referenceId?: string | null;
  referenceNumber?: string | null;
  amount?: number | null;
  details: string;
}
