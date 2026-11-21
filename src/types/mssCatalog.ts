export type MSSCategory = 'لابتوب' | 'شاشة' | 'أخرى';

export interface MSSCatalogModel {
  id: string;
  brand: string;
  model_name: string;
  category: MSSCategory;
  processor?: string | null;
  gpu?: string | null;
  ram?: string | null;
  storage?: string | null;
  screen_size?: string | null;
  specifications?: string | null;
  default_list_price: number;
  created_at: string;
  updated_at: string;
}

export interface NewMSSModelInput {
  brand: string;
  model_name: string;
  category: MSSCategory;
  processor?: string;
  gpu?: string;
  ram?: string;
  storage?: string;
  screen_size?: string;
  specifications?: string;
  default_list_price: number;
}

export interface UpdateMSSModelInput {
  brand?: string;
  model_name?: string;
  category?: MSSCategory;
  processor?: string;
  gpu?: string;
  ram?: string;
  storage?: string;
  screen_size?: string;
  specifications?: string;
  default_list_price?: number;
}

export interface MSSModelAvailability {
  model_id: string;
  available_shop1: number;
  available_shop2: number;
  branch_availability?: Record<string, number>;
  total_available: number;
  reserved_count: number;
  sold_count: number;
}
