export type ExpenseCategory =
  | 'مرتبات الموظفين'
  | 'بنزين ومواصلات'
  | 'كهرباء ومرافق'
  | 'نظافة ومستلزمات'
  | 'صيانة وإصلاحات'
  | 'إيجار'
  | 'ضيافة'
  | 'مستلزمات مكتبية'
  | 'مصروفات أخرى';

export const PREDEFINED_EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'مرتبات الموظفين',
  'بنزين ومواصلات',
  'كهرباء ومرافق',
  'نظافة ومستلزمات',
  'صيانة وإصلاحات',
  'إيجار',
  'ضيافة',
  'مستلزمات مكتبية',
  'مصروفات أخرى',
];

export type ExpensePaymentSource = 'أموال المحل' | 'أموال الشركة' | 'أموال الفرع';

export const EXPENSE_PAYMENT_SOURCES: ExpensePaymentSource[] = [
  'أموال المحل',
  'أموال الشركة',
  'أموال الفرع',
];

export type ExpensePaymentMethod =
  | 'نقدي (كاش)'
  | 'تحويل بنكي'
  | 'فودافون كاش / محفظة'
  | 'فيزا / بطاقة بنكية'
  | 'شيك'
  | 'أخرى';

export const EXPENSE_PAYMENT_METHODS: ExpensePaymentMethod[] = [
  'نقدي (كاش)',
  'تحويل بنكي',
  'فودافون كاش / محفظة',
  'فيزا / بطاقة بنكية',
  'شيك',
  'أخرى',
];

export interface OperatingExpense {
  id: string; // UUID
  module: 'accessories' | 'mss';
  title: string; // Expense Name
  category: ExpenseCategory | string;
  amount: number; // in EGP
  branch: string; // dynamic branch name
  expense_date: string; // YYYY-MM-DD
  payment_source: ExpensePaymentSource | string;
  payment_method: ExpensePaymentMethod | string;
  description?: string | null;
  created_at: string;
  updated_at?: string;
  created_by?: string | null;
}

export interface NewExpenseInput {
  title: string;
  category: ExpenseCategory | string;
  amount: number;
  branch: string;
  expense_date: string;
  payment_source: ExpensePaymentSource | string;
  payment_method: ExpensePaymentMethod | string;
  description?: string;
  created_by?: string;
}

export interface ExpenseFilterParams {
  startDate?: string;
  endDate?: string;
  category?: string;
  branch?: string;
  searchQuery?: string;
}

export interface ExpensePeriodStats {
  todayTotal: number;
  weekTotal: number;
  monthTotal: number;
  periodTotal: number;
  transactionsCount: number;
  categoryBreakdown: { category: string; total: number; count: number }[];
  branchBreakdown: { branch: string; total: number; count: number }[];
}
