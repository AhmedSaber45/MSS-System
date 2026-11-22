// ==============================================================================
// Compu MSS — Public Inventory Types (Read-Only)
// ==============================================================================

export type MSSDeviceStatus = 'AVAILABLE' | 'RESERVED' | 'SOLD';
export type MSSCategory = 'لابتوب' | 'شاشة' | 'أخرى' | string;

export interface PublicInventoryItem {
  id: string;
  model_id: string;
  model_name: string;
  brand: string;
  category: MSSCategory;
  processor: string | null;
  gpu: string | null;
  ram: string | null;
  storage: string | null;
  screen_size: string | null;
  specifications: string | null;
  selling_price: number;
  branch_name: string;
  status: MSSDeviceStatus;
  quantity: number;
  last_updated_at: string | null;
}

export interface InventoryFilters {
  searchQuery: string;
  selectedBranch: string; // 'all' or branch name
  selectedStatus: 'ALL' | MSSDeviceStatus; // default: 'AVAILABLE'
  selectedCategory: string; // 'all' or category name
  sortBy: 'name-asc' | 'price-asc' | 'price-desc' | 'qty-desc';
}

export interface DynamicStore {
  id: string;
  code: string;
  name: string;
}

export interface InventoryStats {
  totalModels: number;
  availableCount: number;
  reservedCount: number;
  soldCount: number;
  totalDevices: number;
  branchesCount: number;
}
