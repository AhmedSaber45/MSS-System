import type { MSSCatalogModel, MSSCategory } from './mssCatalog';

export type { MSSCatalogModel };
export type MSSModel = MSSCatalogModel;

export type MSSDeviceStatus = 'AVAILABLE' | 'RESERVED' | 'SOLD' | 'MAINTENANCE' | 'RETURNED';

export type MSSStockLocation = 'محل 1' | 'محل 2';

export type MSSMovementStatus = 'COMPLETED' | 'PENDING' | 'IN_TRANSIT' | 'CANCELLED';

export interface MSSDevice {
  id: string;
  serial_number: string | null;
  is_serialized?: boolean;
  quantity?: number;
  model_id: string;
  purchase_cost: number;
  list_price: number;
  purchase_date: string;
  physical_condition: string;
  stock_location: MSSStockLocation;
  status: MSSDeviceStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;

  // Joined display fields
  model?: MSSCatalogModel;
  model_name?: string;
  brand?: string;
  category?: MSSCategory;
}

export interface NewMSSDeviceInput {
  serial_number?: string | null;
  is_serialized?: boolean;
  quantity?: number;
  model_id: string;
  purchase_cost: number;
  list_price: number;
  purchase_date?: string;
  physical_condition?: string;
  stock_location: MSSStockLocation;
  status?: MSSDeviceStatus;
  notes?: string;
}

export interface UpdateMSSDeviceInput {
  serial_number?: string | null;
  is_serialized?: boolean;
  quantity?: number;
  model_id?: string;
  purchase_cost?: number;
  list_price?: number;
  purchase_date?: string;
  physical_condition?: string;
  stock_location?: MSSStockLocation;
  status?: MSSDeviceStatus;
  notes?: string;
}

export interface MSSDeviceMovement {
  id: string;
  device_id: string;
  serial_number: string | null;
  from_location: MSSStockLocation;
  to_location: MSSStockLocation;
  movement_date: string;
  movement_status: MSSMovementStatus;
  notes: string | null;
  created_at: string;

  // Joined display fields
  model_name?: string;
  brand?: string;
}

export interface TransferDeviceInput {
  device_id: string;
  to_location: MSSStockLocation;
  notes?: string;
}

export interface NewMSSBulkStockInput {
  model_id: string;
  quantity: number;
  stock_location: MSSStockLocation;
  purchase_cost: number;
  list_price: number;
  purchase_date?: string;
  physical_condition?: string;
  notes?: string;
}

export interface AssignSerialsInput {
  stock_id: string;
  serial_numbers: string[];
  notes?: string;
}

export interface MSSModelInventorySummary {
  model_id: string;
  model_name: string;
  brand: string;
  model_code: string;
  category: string;
  branch: string;
  available_serialized: number;
  available_non_serialized: number;
  total_available: number;
  existing_units: number;
  total_units: number;
  reserved_count: number;
  sold_count: number;
  maintenance_count: number;
  devices: MSSDevice[];
}

export interface MSSInventorySummary {
  total_units: number;
  available_total: number;
  available_serialized_total?: number;
  available_non_serialized_total?: number;
  available_shop1: number;
  available_shop2: number;
  reserved_total: number;
  sold_total: number;
  maintenance_total: number;
  returned_total: number;
  total_cost_value: number;
  total_retail_value: number;
}
