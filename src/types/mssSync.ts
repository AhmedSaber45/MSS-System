import type { MSSStockLocation } from './mssInventory';

export type SyncOperationType =
  | 'SALE_CREATE'
  | 'RESERVATION_CREATE'
  | 'RESERVATION_CANCEL'
  | 'RETURN_PROCESS'
  | 'DEVICE_ADD'
  | 'DEVICE_TRANSFER';

export type SyncOperationStatus = 'PENDING' | 'SYNCING' | 'SYNCED' | 'CONFLICT' | 'FAILED';

export type ConflictType =
  | 'DOUBLE_SALE'
  | 'DOUBLE_RESERVATION'
  | 'STALE_STOCK_TRANSFER'
  | 'DEVICE_NOT_FOUND';

export type ConflictResolutionStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'RESOLVED_MANUALLY';

export interface OutboxOperation {
  uuid: string;
  type: SyncOperationType;
  branch: MSSStockLocation;
  payload: any;
  description: string;
  client_timestamp: string;
  status: SyncOperationStatus;
  retries: number;
  last_error?: string | null;
  synced_at?: string | null;
  conflict_id?: string | null;
}

export interface MSSConflict {
  id: string;
  operation_uuid: string;
  device_id?: string | null;
  serial_number: string;
  branch: MSSStockLocation;
  conflict_type: ConflictType;
  conflict_description: string;
  local_payload: any;
  remote_state?: any;
  resolution_status: ConflictResolutionStatus;
  resolution_notes?: string | null;
  resolved_by?: string | null;
  resolved_at?: string | null;
  created_at: string;
}

export interface SyncStateSummary {
  is_online: boolean;
  pending_count: number;
  synced_count: number;
  conflict_count: number;
  failed_count: number;
  last_sync_time: string | null;
}
