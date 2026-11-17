import type { Product } from './product.ts';

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
  status: string;
  items_count: number;
  created_at: string;
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
