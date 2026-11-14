export interface Purchase {
  id: string;
  purchase_number: string;
  purchase_date: string;
  supplier_name?: string | null;
  supplier_phone?: string | null;
  total_amount: number;
  notes?: string | null;
  items_count: number;
  created_at: string;
}

export interface PurchaseItem {
  id: string;
  purchase_id: string;
  product_id: string;
  product_name: string;
  product_code: string;
  quantity: number;
  unit_cost: number;
  total_cost: number;
}

export interface NewPurchaseItemInput {
  product_id: string;
  quantity: number;
  unit_cost: number;
  update_product_cost: boolean;
}

export interface NewPurchaseInput {
  purchase_number: string;
  purchase_date: string;
  supplier_name?: string | null;
  supplier_phone?: string | null;
  notes?: string | null;
  items: NewPurchaseItemInput[];
}
