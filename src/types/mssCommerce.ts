import type { MSSStockLocation } from './mssInventory';

export type { MSSStockLocation };

export type MSSPaymentType = 'FULL' | 'DEFERRED';
export type MSSPaymentStatus = 'PAID' | 'PARTIALLY_PAID' | 'UNPAID' | 'OVERDUE';

export interface MSSPayment {
  id: string;
  invoice_id: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  notes?: string | null;
  recorded_by?: string | null;
  is_reversal: boolean;
  reversal_of_id?: string | null;
  reversal_reason?: string | null;
  created_at: string;
}

export interface MSSInstallmentScheduleItem {
  id: string;
  invoice_id: string;
  installment_number: number;
  due_date: string;
  expected_amount: number;
  notes?: string | null;
  created_at: string;
}

export interface NewMSSPaymentInput {
  invoice_id?: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  notes?: string;
  recorded_by?: string;
}

export interface MSSInstallmentPlanInput {
  installment_number: number;
  due_date: string;
  expected_amount: number;
  notes?: string;
}

export interface MSSInvoiceItem {
  id: string;
  invoice_id: string;
  device_id?: string | null;
  model_id: string;
  serial_number: string | null;
  is_serialized?: boolean;
  quantity: number;
  list_price_snapshot: number;
  unit_price: number;
  discount_amount: number;
  actual_sale_price: number;
  cost_snapshot: number;
  gross_profit: number;
  source_branch: MSSStockLocation;

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

export interface NewMSSSaleItemInput {
  device_id?: string | null;
  model_id?: string;
  serial_number?: string | null;
  quantity?: number;
  list_price?: number;
  unit_price?: number;
  actual_sale_price: number;
  discount_amount?: number;
  source_branch?: MSSStockLocation;
}

export interface MSSInvoice {
  id: string;
  invoice_number: string;
  device_id: string;
  serial_number: string | null;
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

  // Multi-Device Line Items
  items?: MSSInvoiceItem[];
  items_count?: number;
  subtotal?: number;

  // Phase 2: Deferred & Installments Fields
  payment_type?: MSSPaymentType;
  payment_status?: MSSPaymentStatus;
  paid_amount?: number;
  remaining_balance?: number;
  due_date?: string | null;
  installments_count?: number;
  payments?: MSSPayment[];
  installment_schedule?: MSSInstallmentScheduleItem[];

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
  device_id?: string;
  selling_branch: MSSStockLocation;
  subtotal?: number;
  actual_sale_price?: number;
  discount_amount?: number;
  customer_name?: string;
  customer_phone?: string;
  warranty_period?: string;
  notes?: string;
  items?: NewMSSSaleItemInput[];

  // Phase 2: Deferred & Installments Fields
  payment_type?: MSSPaymentType;
  initial_payment?: number;
  due_date?: string | null;
  payment_method?: string;
  installments?: MSSInstallmentPlanInput[];
}

export type MSSReservationStatus = 'ACTIVE' | 'FULFILLED' | 'CANCELLED' | 'EXPIRED';

export interface MSSReservationItem {
  id: string;
  reservation_id: string;
  device_id?: string | null;
  model_id: string;
  serial_number: string | null;
  is_serialized?: boolean;
  quantity: number;
  agreed_price: number;
  deposit_amount?: number;
  source_branch: MSSStockLocation;

  // Enriched display fields
  brand?: string;
  model_name?: string;
  processor?: string | null;
  gpu?: string | null;
  ram?: string | null;
  storage?: string | null;
}

export interface NewMSSReservationItemInput {
  device_id?: string | null;
  model_id?: string;
  serial_number?: string | null;
  quantity?: number;
  agreed_price: number;
  deposit_amount?: number;
  source_branch?: MSSStockLocation;
}

export interface MSSReservation {
  id: string;
  reservation_number: string;
  device_id: string;
  serial_number: string | null;
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

  // Multi-Device Reservation Items
  items?: MSSReservationItem[];
  items_count?: number;

  // Enriched display fields
  brand?: string;
  model_name?: string;
}

export interface NewMSSReservationInput {
  device_id?: string;
  branch: MSSStockLocation;
  customer_name: string;
  customer_phone: string;
  deposit_amount: number;
  agreed_price?: number;
  expiry_date: string;
  notes?: string;
  items?: NewMSSReservationItemInput[];
}

export interface MSSReturn {
  id: string;
  return_number: string;
  invoice_id: string;
  invoice_number: string;
  device_id: string;
  serial_number: string | null;
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
  return_reason: string;
  restock_location: MSSStockLocation;
  new_condition?: string;
  new_status?: 'AVAILABLE' | 'MAINTENANCE';
  refund_amount?: number;
  notes?: string;
}
