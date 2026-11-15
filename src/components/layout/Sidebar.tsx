import React from 'react';
import { useNavigation } from '../../context/NavigationContext';
import { accessoriesNavItems, mssNavItems } from '../../config/navigationConfig';
import { SectionSwitcher } from './SectionSwitcher';
import { ChevronRight, ChevronLeft, Database, Cloud } from 'lucide-react';
import { cn } from '../../lib/utils';

export const Sidebar: React.FC = () => {
  const {
    currentSection,
    currentRoute,
    setRoute,
    isSidebarCollapsed,
    toggleSidebar,
  } = useNavigation();

  const navItems = currentSection === 'accessories' ? accessoriesNavItems : mssNavItems;
  const isAccessories = currentSection === 'accessories';

  return (
    <aside
      className={cn(
        'h-screen flex flex-col bg-white border-l border-slate-300 select-none z-30 shrink-0 transition-all duration-150',
        isSidebarCollapsed ? 'w-18' : 'w-68'
      )}
    >
      {/* Brand Header */}
      <div className="h-16 px-4 border-b border-slate-200 flex items-center justify-between shrink-0">
        {!isSidebarCollapsed ? (
          <div className="flex items-center gap-3 overflow-hidden">
            <div
              className={cn(
                'w-9 h-9 rounded-lg flex items-center justify-center font-mono text-xs font-bold text-white shadow-sm shrink-0',
                isAccessories ? 'bg-blue-700' : 'bg-teal-800'
              )}
            >
              {isAccessories ? 'ACC' : 'MSS'}
            </div>
            <div className="overflow-hidden">
              <h1 className="text-sm font-bold text-slate-900 truncate">نظام إدارة المحل</h1>
              <p className="text-xs font-medium text-slate-500 truncate mt-0.5">
                {isAccessories ? 'محل الإكسسوارات (محلي)' : 'بيزنس أجهزة MSS المشترك'}
              </p>
            </div>
          </div>
        ) : (
          <div className="mx-auto">
            <div
              className={cn(
                'w-9 h-9 rounded-lg flex items-center justify-center font-mono text-xs font-bold text-white shadow-sm',
                isAccessories ? 'bg-blue-700' : 'bg-teal-800'
              )}
            >
              {isAccessories ? 'ACC' : 'MSS'}
            </div>
          </div>
        )}
      </div>

      {/* Mode Switcher */}
      <div className="p-2.5 border-b border-slate-200 shrink-0">
        <SectionSwitcher compact={isSidebarCollapsed} />
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 overflow-y-auto px-2.5 py-3 space-y-1">
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = currentRoute === item.id;

          return (
            <button
              key={item.id}
              onClick={() => setRoute(item.id as any)}
              title={isSidebarCollapsed ? `${item.label} — ${item.description}` : undefined}
              className={cn(
                'w-full flex items-center gap-3 px-3 h-10.5 rounded-lg text-sm transition-colors group text-right',
                isActive
                  ? isAccessories
                    ? 'bg-slate-100 text-slate-900 font-bold border-r-3 border-blue-700 shadow-sm'
                    : 'bg-slate-100 text-slate-900 font-bold border-r-3 border-teal-800 shadow-sm'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium'
              )}
            >
              <div className="w-5 h-5 flex items-center justify-center shrink-0">
                <Icon
                  className={cn(
                    'w-5 h-5 transition-colors',
                    isActive
                      ? isAccessories
                        ? 'text-blue-700'
                        : 'text-teal-800'
                      : 'text-slate-500 group-hover:text-slate-800'
                  )}
                />
              </div>

              {!isSidebarCollapsed && (
                <div className="flex-1 truncate">
                  <div className="truncate text-sm leading-snug">{item.label}</div>
                </div>
              )}

              {!isSidebarCollapsed && item.badge && (
                <span className="text-xs font-semibold bg-slate-200/90 text-slate-800 px-2 py-0.5 rounded-md border border-slate-300 tabular-nums">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer Info & Toggle */}
      <div className="p-3 border-t border-slate-200 bg-slate-50/80 flex flex-col gap-2 shrink-0">
        {!isSidebarCollapsed && (
          <div className="flex items-center justify-between text-xs text-slate-600 px-1 font-medium">
            <span className="text-xs font-mono font-semibold text-slate-600 tabular-nums">
              v1.0.1
            </span>
          </div>
        )}

        <button
          onClick={toggleSidebar}
          className="w-full flex items-center justify-center gap-2 h-8 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200/70 transition-colors text-xs font-semibold"
          title="طي القائمة الجانبية (Ctrl + B)"
        >
          {isSidebarCollapsed ? (
            <ChevronLeft className="w-4 h-4" />
          ) : (
            <>
              <ChevronRight className="w-4 h-4" />
              <span className="text-xs">طي القائمة</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
};
