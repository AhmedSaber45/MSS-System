'use client';

import React from 'react';
import {
  LayoutDashboard,
  Users,
  ShieldCheck,
  Building2,
} from 'lucide-react';

export type NavTab = 'overview' | 'users';

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
    },
    {
      id: 'users' as NavTab,
      label: 'إدارة المستخدمين',
      icon: Users,
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
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-sm">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold text-white tracking-wide">  Admin Dashboard</h1>
      
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
       

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
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-600/15 text-blue-400 border border-blue-500/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-blue-400' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>
              </button>
            );
          })}
        </nav>

        {/* Footer info & copyright */}
        <div className="p-4 border-t border-brand-border bg-brand-bg/40">
          <div className="flex flex-col gap-1 text-[11px] text-slate-400">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-300"> Compu MSS Admin Dashboard</span>
              <span className="text-[10px] text-slate-400 bg-slate-800/60 border border-slate-700/50 px-1.5 py-0.5 rounded font-mono">
                v1.0.0
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
