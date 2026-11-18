import type { MSSStockLocation } from './mssInventory';

export type { MSSStockLocation };

export interface MSSInvoice {
  id: string;
  invoice_number: string;
  device_id: string;
  serial_number: string;
  model_id: string;
  selling_branch: MSSStockLocation;
  source_branch: MSSStockLocation;
  list_price_snapshot: number;
  discount_amount: number;
  actual_sale_price: number;
  cost_snapshot: number;
  gross_profit: number;
  customer_name?: string | null;
  customer_phone?: string | null;
  warranty_period?: string | null;
  notes?: string | null;
  sale_date: string;
  is_returned: boolean;
  created_at: string;
  updated_at: string;

  // Enriched display fields
  brand?: string;
  model_name?: string;
  category?: string;
  processor?: string | null;
  gpu?: string | null;
  ram?: string | null;
  storage?: string | null;
  screen_size?: string | null;
}

export interface NewMSSSaleInput {
  device_id: string;
  selling_branch: MSSStockLocation;
  actual_sale_price: number;
  discount_amount?: number;
  customer_name?: string;
  customer_phone?: string;
  warranty_period?: string;
  notes?: string;
}

export type MSSReservationStatus = 'ACTIVE' | 'FULFILLED' | 'CANCELLED' | 'EXPIRED';

export interface MSSReservation {
  id: string;
  reservation_number: string;
  device_id: string;
  serial_number: string;
  branch: MSSStockLocation;
  customer_name: string;
  customer_phone: string;
  deposit_amount: number;
  agreed_price: number;
  expiry_date: string;
  status: MSSReservationStatus;
  notes?: string | null;
  created_at: string;
  updated_at: string;

  // Enriched display fields
  brand?: string;
  model_name?: string;
}

export interface NewMSSReservationInput {
  device_id: string;
  branch: MSSStockLocation;
  customer_name: string;
  customer_phone: string;
  deposit_amount: number;
  agreed_price: number;
  expiry_date: string;
  notes?: string;
}

export interface MSSReturn {
  id: string;
  return_number: string;
  invoice_id: string;
  invoice_number: string;
  device_id: string;
  serial_number: string;
  refund_amount: number;
  return_reason: string;
  restock_location: MSSStockLocation;
  new_condition: string;
  new_status: 'AVAILABLE' | 'MAINTENANCE';
  return_date: string;
  notes?: string | null;
  created_at: string;

  // Enriched display fields
  brand?: string;
  model_name?: string;
}

export interface NewMSSReturnInput {
  invoice_id: string;
  refund_amount: number;
  return_reason: string;
  restock_location: MSSStockLocation;
  new_condition?: string;
  new_status?: 'AVAILABLE' | 'MAINTENANCE';
  notes?: string;
}
