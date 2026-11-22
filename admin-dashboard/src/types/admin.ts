// Types for Compu MSS Admin Dashboard
export type ModulePermission = 'accessories' | 'mss' | 'both';
export type StoreType = 'store' | 'warehouse' | 'combined';
export type AdminRole = 'superadmin' | 'admin' | 'auditor';

export interface AdminUser {
  id: string;
  username: string;
  email?: string;
  displayName: string;
  role: AdminRole;
  allowedModules?: ModulePermission;
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StoreAssignedUser {
  id: string;
  username: string;
  displayName: string;
  allowedModules: ModulePermission;
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

export interface AppUser {
  id: string;
  username: string;
  displayName: string;
  allowedModules: ModulePermission;
  defaultStoreId?: string;
  defaultStoreName?: string;
  defaultStoreCode?: string;
  assignedStoreIds?: string[];
  assignedStoresCount?: number;
  credentialVersion: number;
  permissionVersion: number;
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAppUserInput {
  username: string;
  displayName: string;
  accessCode: string;
  confirmAccessCode?: string;
  allowedModules: ModulePermission;
  defaultStoreId?: string;
  assignedStoreIds?: string[];
  isActive?: boolean;
}

export interface UpdateAppUserInput {
  id: string;
  displayName?: string;
  username?: string;
  allowedModules?: ModulePermission;
  defaultStoreId?: string;
  assignedStoreIds?: string[];
  isActive?: boolean;
}

export interface ChangeAccessCodeInput {
  userId: string;
  newAccessCode: string;
  confirmNewAccessCode?: string;
}

export interface AppUserSession {
  id: string;
  userId: string;
  sessionTokenHash: string;
  credentialVersion: number;
  permissionVersion: number;
  deviceInfo?: string;
  ipAddress?: string;
  expiresAt: string;
  lastActiveAt?: string;
  revokedAt?: string;
  createdAt: string;
}

export interface DesktopVerifyInput {
  username: string;
  accessCode: string;
  deviceInfo?: string;
}

export interface DesktopVerifyResult {
  success: boolean;
  error?: string;
  user?: {
    id: string;
    username: string;
    displayName: string;
    allowedModules: ModulePermission;
    defaultStoreId?: string;
    assignedStoreIds: string[];
    credentialVersion: number;
    permissionVersion: number;
  };
  sessionToken?: string;
  expiresAt?: string;
}

export interface DesktopRevalidateInput {
  sessionToken: string;
  isUserAction?: boolean;
}

export interface DesktopRevalidateResult {
  success: boolean;
  reason?: 'VALID' | 'SESSION_REVOKED' | 'SESSION_EXPIRED' | 'ACCOUNT_DISABLED' | 'CREDENTIAL_CHANGED';
  error?: string;
  user?: {
    id: string;
    username: string;
    displayName: string;
    allowedModules: ModulePermission;
    defaultStoreId?: string;
    assignedStoreIds: string[];
    credentialVersion: number;
    permissionVersion: number;
  };
  expiresAt?: string;
}

export interface DesktopLogoutInput {
  sessionToken: string;
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

export type AuditTargetType = 'user' | 'store' | 'system' | 'auth' | 'inventory' | 'session' | 'role';

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

export interface AccessoriesOverviewMetrics {
  totalUsers: number;
  activeUsers: number;
  totalStores: number;
  activeStores: number;
  localSyncStatus?: string;
}

export interface MSSOverviewMetrics {
  totalUsers: number;
  activeUsers: number;
  totalStores: number;
  activeStores: number;
  totalWarehouses: number;
  devicesCount: number;
  availableDevices: number;
  reservedDevices: number;
  soldDevices: number;
  modelsCount: number;
  byLocation: Record<string, number>;
  activeTransfersCount?: number;
}

export interface OverviewStats {
  moduleScope: ModulePermission | 'none';
  totalAppUsers: number;
  activeAppUsers: number;
  totalStores: number;
  activeStores: number;
  totalWarehouses: number;
  modulesBreakdown: {
    accessoriesOnly: number;
    mssOnly: number;
    both: number;
  };
  recentAuditLogs: AdminAuditLog[];
  accessoriesMetrics?: AccessoriesOverviewMetrics;
  mssMetrics?: MSSOverviewMetrics;
}

// ============================================================================
// PHASE 5: INVENTORY & TRANSFERS TYPES
// ============================================================================
export type DeviceStatus = 'AVAILABLE' | 'RESERVED' | 'SOLD' | 'MAINTENANCE' | 'RETURNED';

export interface InventoryDevice {
  id: string;
  serialNumber: string;
  modelId: string;
  modelName: string;
  brand: string;
  category: string;
  purchaseCost: number;
  listPrice: number;
  purchaseDate: string;
  physicalCondition: string;
  stockLocation: string;
  status: DeviceStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  isEligibleForTransfer: boolean;
  ineligibilityReason?: string;
}

export interface InventoryFilterOptions {
  search?: string;
  stockLocation?: string;
  status?: string;
  category?: string;
  modelId?: string;
  page?: number;
  limit?: number;
}

export interface InventoryOverviewSummary {
  totalCount: number;
  availableCount: number;
  reservedCount: number;
  soldCount: number;
  maintenanceCount: number;
  returnedCount: number;
  totalCostValue: number;
  totalRetailValue: number;
  byLocation: Record<string, {
    total: number;
    available: number;
    reserved: number;
    sold: number;
    costValue: number;
  }>;
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
  eligibleDevices: InventoryDevice[];
  ineligibleDevices: InventoryDevice[];
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

