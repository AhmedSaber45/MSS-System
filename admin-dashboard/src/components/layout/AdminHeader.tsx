'use client';

import React from 'react';
import { Menu, LogOut, Shield, User, Circle } from 'lucide-react';
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
    title: 'نظرة عامة  ',
    subtitle: '  ',
  },
  users: {
    title: 'إدارة المستخدمين والصلاحيات',
    subtitle: '',
  },
  audit: {
    title: 'سجل النشاط والتدقيق',
    subtitle: 'سجل تفصيلي ولحظي لكافة عمليات النظام والمستخدمين',
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
    <header className="sticky top-0 z-30 bg-[#0d121c]/95 backdrop-blur-md border-b border-slate-800/90 px-4 lg:px-7 py-3 flex items-center justify-between">
      {/* Right side: title and mobile menu */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 border border-slate-800 lg:hidden"
          aria-label="تبديل القائمة الجانبية"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div>
          <h2 className="text-sm font-semibold text-slate-100 tracking-tight">{current.title}</h2>
          <p className="text-[11px] text-slate-400 hidden sm:block">{current.subtitle}</p>
        </div>
      </div>

      {/* Left side: profile, system status & logout */}
      <div className="flex items-center gap-3">




        {/* Logout Button */}
        <button
          onClick={onLogout}
          title="تسجيل الخروج من الجلسة الإدارية"
          className="px-2.5 py-1.5 text-slate-400 hover:text-rose-300 hover:bg-rose-950/30 border border-slate-800 hover:border-rose-900/40 rounded-lg transition-colors text-xs flex items-center gap-1.5 cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">خروج</span>
        </button>
      </div>
    </header>
  );
};
