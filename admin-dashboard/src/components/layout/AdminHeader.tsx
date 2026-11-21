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
    title: 'نظرة عامة  ',
    subtitle: '  ',
  },
  users: {
    title: 'إدارة المستخدمين ',
    subtitle: '',
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
