import type { Product } from './product.ts';

export type PaymentType = 'FULL' | 'DEFERRED';
export type PaymentStatus = 'PAID' | 'PARTIALLY_PAID' | 'UNPAID' | 'OVERDUE';

export interface InvoicePayment {
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

export interface InstallmentScheduleItem {
  id: string;
  invoice_id: string;
  installment_number: number;
  due_date: string;
  expected_amount: number;
  notes?: string | null;
  created_at: string;
}

export interface NewPaymentInput {
  invoice_id?: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  notes?: string;
  recorded_by?: string;
}

export interface InstallmentPlanInput {
  installment_number: number;
  due_date: string;
  expected_amount: number;
  notes?: string;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  customer_name?: string | null;
  customer_phone?: string | null;
  subtotal: number;
  discount: number;
  total_amount: number;
  payment_method: string;
  notes?: string | null;
  status: string; // 'COMPLETED' etc.
  items_count: number;
  created_at: string;

  // Phase 2: Deferred & Installment Sales Fields
  payment_type?: PaymentType;
  payment_status?: PaymentStatus;
  paid_amount?: number;
  remaining_balance?: number;
  due_date?: string | null;
  installments_count?: number;
  payments?: InvoicePayment[];
  installment_schedule?: InstallmentScheduleItem[];
}

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  product_id?: string | null;
  product_name: string;
  product_code?: string | null;
  barcode?: string | null;
  quantity: number;
  original_price: number;
  discount: number;
  actual_price: number;
  cost_snapshot: number;
  line_total: number;
  item_type?: 'product' | 'maintenance';
}

export interface NewSaleItemInput {
  item_type?: 'product' | 'maintenance';
  product_id?: string | null;
  description?: string;
  price?: number;
  quantity: number;
  discount: number;
}

export interface NewSaleInput {
  invoice_number: string;
  invoice_date?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  invoice_discount: number;
  payment_method: string;
  notes?: string | null;
  items: NewSaleItemInput[];

  // Phase 2: Deferred & Installment configuration
  payment_type?: PaymentType;
  initial_payment?: number;
  due_date?: string | null;
  installments?: InstallmentPlanInput[];
}

export interface CartItem {
  id?: string;
  item_type?: 'product' | 'maintenance';
  product?: Product;
  description?: string;
  price?: number;
  quantity: number;
  discount: number; // per item discount in currency
  actual_price: number;
  line_total: number;
}
