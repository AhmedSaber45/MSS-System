// Operational Types for Compu MSS (Migrated from Admin Operations)

export type StoreType = 'store' | 'warehouse' | 'combined';

export interface StoreAssignedUser {
  id: string;
  username: string;
  displayName: string;
  allowedModules: 'accessories' | 'mss' | 'both';
  isPrimary: boolean;
  assignedAt: string;
}

export interface SystemStore {
  id: string;
  code: string;
  name: string;
  type: StoreType;
  description?: string;
  address?: string;
  phone?: string;
  isActive: boolean;
  isArchived?: boolean;
  archivedAt?: string;
  mergedIntoId?: string;
  mergedIntoName?: string;
  createdAt: string;
  updatedAt: string;
  assignedUsersCount?: number;
  deviceCount?: number;
  assignedUsers?: StoreAssignedUser[];
}

export interface CreateStoreInput {
  code: string;
  name: string;
  type: StoreType;
  description?: string;
  address?: string;
  phone?: string;
  isActive?: boolean;
}

export interface UpdateStoreInput {
  id: string;
  code?: string;
  name?: string;
  type?: StoreType;
  description?: string;
  address?: string;
  phone?: string;
  isActive?: boolean;
  isArchived?: boolean;
}

export interface AssignUserToStoreInput {
  userId: string;
  storeId: string;
  isPrimary?: boolean;
}

export interface StoreMergeImpactPreview {
  sourceStores: SystemStore[];
  destinationStore?: SystemStore;
  newDestinationName?: string;
  affectedUsers: {
    userId: string;
    username: string;
    displayName: string;
    currentStores: string[];
    alreadyInDestination: boolean;
  }[];
  inventorySummary: {
    storeId: string;
    storeName: string;
    storeCode: string;
    deviceCount: number;
    notice: string;
  }[];
  historicalRecordsNotice: string;
  canMerge: boolean;
  validationErrors?: string[];
}

export interface ExecuteStoreMergeInput {
  sourceStoreIds: string[];
  destinationStoreId?: string;
  newDestination?: CreateStoreInput;
  notes?: string;
}

export interface StoreMergeResult {
  success: boolean;
  mergeId: string;
  destinationStore: SystemStore;
  mergedSourceStoreIds: string[];
  reassignedUserIds: string[];
  message: string;
}

export type AuditTargetType = 'user' | 'store' | 'system' | 'auth' | 'inventory';

export interface AdminAuditLog {
  id: string;
  actorId: string;
  actorUsername: string;
  eventType: string;
  targetType: AuditTargetType;
  targetId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export type TransferType = 'INDIVIDUAL' | 'SELECTED' | 'MODEL_GROUP' | 'ALL_ELIGIBLE';
export type TransferStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'REQUIRES_REVIEW';

export interface InventoryTransferItem {
  id: string;
  transferId: string;
  deviceId: string;
  serialNumber: string;
  modelId?: string;
  modelName?: string;
  sourceLocation: string;
  destinationLocation: string;
  purchaseCostSnapshot: number;
  previousStatus: string;
  resultingStatus: string;
  itemStatus: 'COMPLETED' | 'EXCLUDED' | 'FAILED';
  notes?: string;
  createdAt: string;
}

export interface InventoryTransfer {
  id: string;
  referenceNumber: string;
  sourceLocation: string;
  destinationLocation: string;
  sourceStoreId?: string;
  destinationStoreId?: string;
  transferType: TransferType;
  status: TransferStatus;
  itemCount: number;
  totalCost: number;
  notes?: string;
  idempotencyKey?: string;
  createdByAdminId: string;
  createdByUsername: string;
  createdAt: string;
  completedAt?: string;
  failureReason?: string;
  items?: InventoryTransferItem[];
}

export interface TransferPreviewRequest {
  sourceLocation: string;
  destinationLocation: string;
  transferType: TransferType;
  deviceIds?: string[];
  modelId?: string;
  allEligible?: boolean;
}

export interface TransferPreviewResponse {
  canTransfer: boolean;
  sourceLocation: string;
  destinationLocation: string;
  transferType: TransferType;
  eligibleDevices: {
    id: string;
    serial_number: string;
    model_name: string;
    brand: string;
    purchase_cost: number;
    stock_location: string;
    status: string;
  }[];
  ineligibleDevices: {
    id: string;
    serial_number: string;
    model_name: string;
    brand: string;
    stock_location: string;
    status: string;
    reason: string;
  }[];
  totalEligibleCount: number;
  totalIneligibleCount: number;
  totalEligibleCost: number;
  validationErrors?: string[];
  historicalNotice: string;
}

export interface ExecuteTransferRequest {
  sourceLocation: string;
  destinationLocation: string;
  transferType: TransferType;
  deviceIds?: string[];
  modelId?: string;
  allEligible?: boolean;
  notes?: string;
  idempotencyKey?: string;
  confirmed: boolean;
}

export interface ExecuteTransferResult {
  success: boolean;
  transferId: string;
  referenceNumber: string;
  itemCount: number;
  totalCost: number;
  sourceLocation: string;
  destinationLocation: string;
  transferredAt: string;
  message: string;
}
