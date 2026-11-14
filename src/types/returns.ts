export interface ReturnItemRecord {
  id: string;
  return_id: string;
  product_id: string;
  product_name: string;
  product_code: string;
  quantity_returned: number;
  refund_unit_price: number;
  line_refund_total: number;
  restock_condition: 'RESTOCKED' | 'DAMAGED'; // 'RESTOCKED' (سليم ويعاد للمخزون) or 'DAMAGED' (تالف ولا يعاد للمخزون)
}

export interface ReturnRecord {
  id: string;
  return_number: string;
  invoice_id: string;
  invoice_number: string;
  return_date: string;
  refund_amount: number;
  refund_method: string;
  reason: string;
  notes?: string | null;
  items_count: number;
  created_at: string;
}

export interface NewReturnItemInput {
  product_id: string;
  quantity_returned: number;
  refund_unit_price: number;
  restock_condition: 'RESTOCKED' | 'DAMAGED';
}

export interface NewReturnInput {
  return_number: string;
  invoice_id: string;
  return_date: string;
  refund_amount: number;
  refund_method: string;
  reason: string;
  notes?: string | null;
  items: NewReturnItemInput[];
}
