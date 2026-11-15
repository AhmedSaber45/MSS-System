export interface Product {
  id: string;
  name: string;
  code: string;
  barcode?: string | null;
  category?: string | null;
  cost: number;
  price: number;
  stock: number;
  low_stock_threshold: number;
  description?: string | null;
  created_at: string;
  updated_at: string;
}

export interface NewProductInput {
  name: string;
  code: string;
  barcode?: string | null;
  category?: string | null;
  cost: number;
  price: number;
  stock: number;
  low_stock_threshold: number;
  description?: string | null;
}

export interface UpdateProductInput {
  name: string;
  code: string;
  barcode?: string | null;
  category?: string | null;
  cost: number;
  price: number;
  stock: number;
  low_stock_threshold: number;
  description?: string | null;
}

export type StockStatusFilter = 'all' | 'in_stock' | 'low_stock' | 'out_of_stock' | 'low_and_out';

export interface ProductFilter {
  searchQuery?: string;
  category?: string;
  stockStatus?: StockStatusFilter;
}
