export interface PromotionalLaptopItem {
  id: string; // Unique transient identifier for the preview session
  original_device_id?: string;
  original_model_id?: string;
  brand: string;
  model_name: string;
  generation?: string; // Arabic generation string e.g. "الجيل العاشر", "الجيل الحادي عشر"
  processor: string; // Short processor family e.g. "i7", "i5", "Ryzen 7", "M2"
  ram: string; // e.g. "16GB", "32GB"
  storage: string; // e.g. "512GB SSD"
  gpu: string; // e.g. "NVIDIA 4GB", "Intel", "AMD"
  screen: string; // e.g. "15.6", "14.1"
  price?: number;
  quantity?: number;
  available_quantity?: number;
  stock_location?: string;
  physical_condition?: string;
  serial_number?: string;
}

export interface PromotionalDisplayOptions {
  showPrice: boolean;
  showQuantity: boolean;
  storeName?: string;
  headline?: string;
  subHeadline?: string;
  contactNumber?: string;
  priceSortOrder?: 'asc' | 'desc';
  pageIndex?: number;
  itemsPerPage?: number;
}

export interface DeviceSelectionFilter {
  brand?: string;
  selectedBrands?: string[];
  selectedModelIds?: string[];
  minPrice?: number;
  maxPrice?: number;
  searchQuery?: string;
  priceSortOrder?: 'asc' | 'desc';
}
