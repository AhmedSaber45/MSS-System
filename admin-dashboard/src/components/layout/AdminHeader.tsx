'use client';

import React from 'react';
import { Menu, LogOut, Shield, Database, User } from 'lucide-react';
import type { NavTab } from './AdminSidebar';

interface AdminHeaderProps {
  currentTab: NavTab;
  adminName: string;
  adminRole: string;
  onLogout: () => void;
  onToggleSidebar: () => void;
}

const tabTitles: Record<NavTab, { title: string; subtitle: string }> = {
  overview: {
    title: 'نظرة عامة على النظام',
    subtitle: 'مؤشرات الأداء، توزيع الحسابات، والنشاط الإداري الأخير',
  },
  users: {
    title: 'إدارة مستخدمي الفروع',
    subtitle: 'إنشاء حسابات المستخدمين، إدارة الصلاحيات، وتعيين رموز الدخول',
  },
};

export const AdminHeader: React.FC<AdminHeaderProps> = ({
  currentTab,
  adminName,
  adminRole,
  onLogout,
  onToggleSidebar,
}) => {
  const current = tabTitles[currentTab] || { title: 'لوحة التحكم', subtitle: '' };

  return (
    <header className="sticky top-0 z-30 bg-brand-card/95 backdrop-blur-md border-b border-brand-border px-4 lg:px-8 py-3.5 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 lg:hidden"
          aria-label="تبديل القائمة"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div>
          <h2 className="text-base font-bold text-white tracking-wide">{current.title}</h2>
          <p className="text-xs text-slate-400 hidden sm:block">{current.subtitle}</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Supabase Connection Status Badge */}
        <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800/80 border border-slate-700/60 text-slate-300 text-xs">
          <Database className="w-3.5 h-3.5 text-blue-400" />
          <span>Supabase متصل</span>
        </div>

        {/* Admin User Badge */}
        <div className="flex items-center gap-2 pl-2 border-l border-brand-border">
          <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-200 font-bold text-xs">
            <User className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-right hidden sm:block">
            <div className="text-xs font-semibold text-slate-200">{adminName}</div>
            <div className="text-[10px] text-blue-400 font-medium flex items-center gap-1">
              <Shield className="w-2.5 h-2.5" />
              {adminRole === 'superadmin' ? 'مدير عام للنظام' : 'مشرف إداري'}
            </div>
          </div>
        </div>

        {/* Logout Button */}
        <button
          onClick={onLogout}
          title="تسجيل الخروج"
          className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 border border-transparent hover:border-rose-900/40 rounded-lg transition-colors text-xs flex items-center gap-1.5"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:inline">خروج</span>
        </button>
      </div>
    </header>
  );
};
