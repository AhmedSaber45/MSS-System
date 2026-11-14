export type MovementType =
  | 'PURCHASE'
  | 'ADJUSTMENT_ADD'
  | 'ADJUSTMENT_SUBTRACT'
  | 'SALE'
  | 'RETURN'
  | 'RETURN_RESTOCKED';

export interface InventoryMovement {
  id: string;
  product_id: string;
  product_name: string;
  product_code: string;
  movement_type: MovementType;
  quantity_change: number;
  previous_stock: number;
  new_stock: number;
  reference_id?: string | null;
  reason: string;
  created_at: string;
}

export type AdjustmentType = 'ADD' | 'SUBTRACT' | 'SET';

export interface StockAdjustmentInput {
  product_id: string;
  adjustment_type: AdjustmentType;
  quantity: number;
  reason: string;
  notes?: string | null;
}

export interface InventoryFilter {
  searchQuery?: string;
  category?: string;
  stockStatus?: 'all' | 'in_stock' | 'low_stock' | 'out_of_stock';
}
