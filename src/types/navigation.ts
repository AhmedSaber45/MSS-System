import { LucideIcon } from 'lucide-react';

export type AppSection = 'accessories' | 'mss';

export type AccessoriesRoute =
  | 'dashboard'
  | 'products'
  | 'purchases'
  | 'inventory'
  | 'sales'
  | 'invoices'
  | 'returns'
  | 'reports'
  | 'history'
  | 'backup';

export type MSSRoute =
  | 'dashboard'
  | 'catalog'
  | 'inventory'
  | 'sales'
  | 'reservations'
  | 'invoices'
  | 'returns'
  | 'movements'
  | 'stores'
  | 'audit'
  | 'reports'
  | 'sync';

export type ActiveRoute = AccessoriesRoute | MSSRoute;

export interface NavItemConfig {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  badge?: string | number;
}

export interface SectionMeta {
  id: AppSection;
  title: string;
  subTitle: string;
  badge: string;
  accentColor: string;
  isCloudConnected: boolean;
}
