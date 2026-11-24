'use client';

import React from 'react';
import {
  LayoutDashboard,
  Users,
  ShieldCheck,
  Building2,
  Terminal,
  ShieldAlert,
} from 'lucide-react';

export type NavTab = 'overview' | 'users' | 'audit';

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
      label: 'نظرة عامة  ',
      icon: LayoutDashboard,
    },
    {
      id: 'users' as NavTab,
      label: 'إدارة المستخدمين والصلاحيات',
      icon: Users,
    },
    {
      id: 'audit' as NavTab,
      label: 'سجل النشاط والتدقيق',
      icon: ShieldAlert,
    },
  ];

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden transition-opacity"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 right-0 z-50 w-64 bg-[#0d121c] border-l border-slate-800/90 flex flex-col transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="p-4 border-b border-slate-800/90 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-700/80 flex items-center justify-center p-1 shadow-sm">
              <img
                src="/assets/branding/as_logo_gold.png"
                alt="AS System"
                className="w-full h-full object-contain select-none"
              />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-sm font-semibold text-slate-100 tracking-tight">AS System</h1>
                <span className="text-[10px] px-1.5 py-0.2 bg-slate-800 text-sky-400 border border-slate-700/60 rounded font-medium">
                  Admin
                </span>
              </div>
          
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          <div className="px-2.5 py-1 text-[11px] font-medium text-slate-500 uppercase tracking-wider font-mono">
            القائمة الرئيسية
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
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-slate-800/90 text-slate-100 border border-slate-700/80 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-sky-400' : 'text-slate-500'}`} />
                  <span>{item.label}</span>
                </div>
                {isActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer info & copyright */}
        <div className="p-3.5 border-t border-slate-800/90 bg-[#0a0e17]">
          <div className="flex flex-col gap-1.5 text-[11px]">
            <div className="flex items-center justify-between">
              <span className="font-medium text-slate-300">AS System</span>
              <span className="text-[10px] text-slate-400 bg-slate-800/80 border border-slate-700/60 px-1.5 py-0.5 rounded font-mono">
                v1.0.9
              </span>
            </div>
            <p className="text-[10px] text-slate-500 border-t border-slate-800/80 pt-1.5">
              © 2026 Ahmed Saber • 01030137635
            </p>
          </div>
        </div>
      </aside>
    </>
  );
};
