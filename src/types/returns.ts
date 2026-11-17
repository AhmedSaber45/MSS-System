export interface ReturnItemRecord {
  id: string;
  return_id: string;
  invoice_item_id?: string | null;
  product_id?: string | null;
  product_name: string;
  product_code?: string | null;
  quantity_returned: number;
  refund_unit_price: number;
  line_refund_total: number;
  restock_condition: 'RESTOCKED' | 'DAMAGED' | 'SERVICE'; // 'RESTOCKED' (سليم ويعاد للمخزون) or 'DAMAGED' (تالف ولا يعاد للمخزون) or 'SERVICE' (صيانة لا تؤثر على المخزون)
  item_type?: 'product' | 'maintenance';
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
  invoice_item_id?: string | null;
  product_id?: string | null;
  quantity_returned: number;
  refund_unit_price: number;
  restock_condition: 'RESTOCKED' | 'DAMAGED' | 'SERVICE';
  item_type?: 'product' | 'maintenance';
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
