'use client';

import React from 'react';
import {
  LayoutDashboard,
  Users,
  Store,
  Boxes,
  ArrowLeftRight,
  ShieldAlert,
  Settings,
  ShieldCheck,
  Building2,
} from 'lucide-react';

export type NavTab = 'overview' | 'users' | 'stores' | 'inventory' | 'transfers' | 'audit' | 'settings';

interface AdminSidebarProps {
  currentTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  isOpen?: boolean;
  onClose?: () => void;
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({
  currentTab,
  onTabChange,
  isOpen = true,
  onClose,
}) => {
  const navItems = [
    {
      id: 'overview' as NavTab,
      label: 'نظرة عامة',
      icon: LayoutDashboard,
      badge: null,
    },
    {
      id: 'users' as NavTab,
      label: 'إدارة المستخدمين',
      icon: Users,
      badge: null,
    },
    {
      id: 'stores' as NavTab,
      label: 'الفروع والمخازن',
      icon: Store,
      badge: null,
    },
    {
      id: 'inventory' as NavTab,
      label: 'المخزون (استعراض)',
      icon: Boxes,
      badge: 'أساس',
      badgeColor: 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/50',
    },
    {
      id: 'transfers' as NavTab,
      label: 'تحويلات المخزون',
      icon: ArrowLeftRight,
      badge: 'المرحلة 5',
      badgeColor: 'bg-amber-950/60 text-amber-400 border border-amber-800/50',
    },
    {
      id: 'audit' as NavTab,
      label: 'سجل النشاط والتدقيق',
      icon: ShieldAlert,
      badge: null,
    },
    {
      id: 'settings' as NavTab,
      label: 'إعدادات النظام',
      icon: Settings,
      badge: null,
    },
  ];

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 right-0 z-50 w-72 bg-brand-card border-l border-brand-border flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="p-5 border-b border-brand-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-primary to-brand-secondary flex items-center justify-center text-white shadow-lg shadow-brand-primary/20">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold text-white tracking-wide">Compu MSS</h1>
              <p className="text-xs text-slate-400 flex items-center gap-1.5 font-medium">
                <ShieldCheck className="w-3.5 h-3.5 text-brand-primary" />
                لوحة تحكم الإدارة المركزية
              </p>
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto">
          <div className="px-3 py-2 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
            الأقسام الرئيسية
          </div>

          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onTabChange(item.id);
                  if (onClose) onClose();
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-brand-primary/15 text-brand-primary border border-brand-primary/30 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-brand-primary' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className={`text-[10px] px-2 py-0.5 rounded-md font-semibold ${item.badgeColor}`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer info & copyright */}
        <div className="p-4 border-t border-brand-border/60 bg-brand-bg/50">
          <div className="flex flex-col gap-1 text-[11px] text-slate-400">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-300">نظام Compu MSS</span>
              <span className="text-[10px] text-emerald-400 bg-emerald-950/60 border border-emerald-800/40 px-1.5 py-0.5 rounded">
                المرحلة 1
              </span>
            </div>
            <p className="text-[10px] text-slate-500 pt-1 border-t border-brand-border/40 mt-1">
              © 2026 Ahmed Saber • 01030137635
            </p>
          </div>
        </div>
      </aside>
    </>
  );
};
