import { NavItemConfig } from '../types/navigation';
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Boxes,
  BadgeDollarSign,
  Receipt,
  RotateCcw,
  BarChart3,
  History,
  HardDriveDownload,
  Laptop,
  Layers,
  BookmarkCheck,
  ArrowLeftRight,
  Cloud,
} from 'lucide-react';

export const accessoriesNavItems: NavItemConfig[] = [
  {
    id: 'dashboard',
    label: 'لوحة التحكم',
    description: 'نظرة عامة ومؤشرات أداء المحل',
    icon: LayoutDashboard,
  },
  {
    id: 'products',
    label: 'المنتجات والأسعار',
    description: 'إدارة بطاقات الأصناف والباركود',
    icon: Package,
  },
  {
    id: 'purchases',
    label: 'المشتريات والوارد',
    description: 'تسجيل فواتير المشتريات وتكاليفها',
    icon: ShoppingCart,
  },
  {
    id: 'inventory',
    label: 'إدارة المخزون',
    description: 'متابعة الكميات ونواقص المحل والتسويات',
    icon: Boxes,
  },
  {
    id: 'sales',
    label: 'نقطة البيع والمبيعات',
    description: 'إتمام عمليات البيع وتطبيق الخصومات',
    icon: BadgeDollarSign,
  },
  {
    id: 'invoices',
    label: 'سجل الفواتير',
    description: 'استعراض وطباعة فواتير المبيعات A4 وحراري',
    icon: Receipt,
  },
  {
    id: 'returns',
    label: 'المرتجعات والإلغاء',
    description: 'استرجاع الأصناف وإلغاء العمليات بأمان',
    icon: RotateCcw,
  },
  {
    id: 'reports',
    label: 'التقارير المالية',
    description: 'الإيرادات والأرباح وتكلفة المبيعات',
    icon: BarChart3,
  },
  {
    id: 'history',
    label: 'سجل العمليات',
    description: 'تتبع الحركات والعمليات المنفذة بالمحل',
    icon: History,
  },
  {
    id: 'backup',
    label: 'النسخ الاحتياطي',
    description: 'حفظ واسترجاع قاعدة البيانات محلياً وخارجياً',
    icon: HardDriveDownload,
  },
];

export const mssNavItems: NavItemConfig[] = [
  {
    id: 'dashboard',
    label: 'لوحة التحكم',
    description: 'مؤشرات الأجهزة والمبيعات بين المحلين',
    icon: LayoutDashboard,
  },
  {
    id: 'catalog',
    label: 'كتالوج الأجهزة',
    description: 'موديلات اللابتوبات والشاشات المشتركة',
    icon: Laptop,
  },
  {
    id: 'inventory',
    label: 'المخزون الفعلي (السيريال)',
    description: 'تتبع كل جهاز بسيرياله في محل 1 ومحل 2',
    icon: Layers,
  },
  {
    id: 'sales',
    label: 'مبيعات الأجهزة',
    description: 'البيع وتحديد فرع البيع وفرع مصدر الجهاز',
    icon: BadgeDollarSign,
  },
  {
    id: 'reservations',
    label: 'حجوزات الأجهزة',
    description: 'حجز جهاز لعميل ومنع تكرار بيعه',
    icon: BookmarkCheck,
  },
  {
    id: 'invoices',
    label: 'فواتير MSS',
    description: 'فواتير الأجهزة متضمنة السيريال والضمان',
    icon: Receipt,
  },
  {
    id: 'returns',
    label: 'المرتجعات والإلغاء',
    description: 'إرجاع جهاز مباع وتحديث حالته بالمخزون',
    icon: RotateCcw,
  },
  {
    id: 'movements',
    label: 'حركة ونقل الأجهزة',
    description: 'تسجيل النقل الفعلي بين محل 1 ومحل 2',
    icon: ArrowLeftRight,
  },
  {
    id: 'reports',
    label: 'التقارير المشتركة',
    description: 'الإيرادات وتكلفة الشراء وصافي أرباح MSS',
    icon: BarChart3,
  },
  {
    id: 'sync',
    label: 'حالة المزامنة السحابية',
    description: 'متابعة العمليات المعلقة وحل التعارضات',
    icon: Cloud,
  },
];
