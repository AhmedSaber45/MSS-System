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
    description: 'إدارة بطاقات الأصناف والأسعار',
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
    label: ' البيع وإصدار الفواتير',
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
    label: 'المرتجعات ',
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
    label: ' الأجهزة',
    description: 'موديلات اللابتوبات والشاشات المشتركة',
    icon: Laptop,
  },
  {
    id: 'inventory',
    label: 'المخزون ',
    description: 'تتبع كل جهاز بسيرياله في محل 1 ومحل 2',
    icon: Layers,
  },
  {
    id: 'sales',
    label: 'المبيعات ',
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
    label: ' الفواتير',
    description: 'فواتير الأجهزة متضمنة السيريال والضمان',
    icon: Receipt,
  },
  {
    id: 'returns',
    label: 'المرتجعات ',
    description: 'إرجاع جهاز مباع وتحديث حالته بالمخزون',
    icon: RotateCcw,
  },
  {
    id: 'movements',
    label: ' نقل الأجهزة بين المخازن',
    description: 'تسجيل النقل الفعلي بين محل 1 ومحل 2',
    icon: ArrowLeftRight,
  },
  {
    id: 'reports',
    label: 'التقارير  ',
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
