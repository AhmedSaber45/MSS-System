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
        'h-screen flex flex-col bg-white border-l border-slate-200/90 select-none z-30 shrink-0 transition-all duration-150',
        isSidebarCollapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Brand Header */}
      <div className="h-14 px-4 border-b border-slate-100 flex items-center justify-between shrink-0">
        {!isSidebarCollapsed ? (
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div
              className={cn(
                'w-7 h-7 rounded-md flex items-center justify-center font-mono text-xs font-semibold text-white shrink-0',
                isAccessories ? 'bg-blue-700' : 'bg-teal-800'
              )}
            >
              {isAccessories ? 'ACC' : 'MSS'}
            </div>
            <div className="overflow-hidden">
              <h1 className="text-xs font-semibold text-slate-900 truncate">نظام إدارة المحل</h1>
              <p className="text-[11px] text-slate-400 truncate">
                {isAccessories ? 'محل الإكسسوارات (محلي)' : 'بيزنس أجهزة MSS المشترك'}
              </p>
            </div>
          </div>
        ) : (
          <div className="mx-auto">
            <div
              className={cn(
                'w-7 h-7 rounded-md flex items-center justify-center font-mono text-xs font-semibold text-white',
                isAccessories ? 'bg-blue-700' : 'bg-teal-800'
              )}
            >
              {isAccessories ? 'ACC' : 'MSS'}
            </div>
          </div>
        )}
      </div>

      {/* Mode Switcher */}
      <div className="p-2 border-b border-slate-100 shrink-0">
        <SectionSwitcher compact={isSidebarCollapsed} />
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = currentRoute === item.id;

          return (
            <button
              key={item.id}
              onClick={() => setRoute(item.id as any)}
              title={isSidebarCollapsed ? `${item.label} — ${item.description}` : undefined}
              className={cn(
                'w-full flex items-center gap-2.5 px-2.5 h-9 rounded-md text-xs transition-colors group text-right',
                isActive
                  ? isAccessories
                    ? 'bg-slate-100 text-slate-900 font-semibold border-r-2 border-blue-700'
                    : 'bg-slate-100 text-slate-900 font-semibold border-r-2 border-teal-800'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-normal'
              )}
            >
              <div className="w-4 h-4 flex items-center justify-center shrink-0">
                <Icon
                  className={cn(
                    'w-4 h-4 transition-colors',
                    isActive
                      ? isAccessories
                        ? 'text-blue-700'
                        : 'text-teal-800'
                      : 'text-slate-400 group-hover:text-slate-700'
                  )}
                />
              </div>

              {!isSidebarCollapsed && (
                <div className="flex-1 truncate">
                  <div className="truncate text-xs leading-none">{item.label}</div>
                </div>
              )}

              {!isSidebarCollapsed && item.badge && (
                <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200/60 tabular-nums">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer Info & Toggle */}
      <div className="p-2.5 border-t border-slate-100 bg-slate-50/70 flex flex-col gap-1.5 shrink-0">
        {!isSidebarCollapsed && (
          <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
            <span className="flex items-center gap-1.5 font-medium">
              {isAccessories ? (
                <>
                  <Database className="w-3.5 h-3.5 text-blue-700" />
                  <span>SQLite محلي</span>
                </>
              ) : (
                <>
                  <Cloud className="w-3.5 h-3.5 text-teal-700" />
                  <span>سحابي + كاش</span>
                </>
              )}
            </span>
            <span className="text-[10px] font-mono text-slate-500 tabular-nums">
              v1.0.0
            </span>
          </div>
        )}

        <button
          onClick={toggleSidebar}
          className="w-full flex items-center justify-center gap-1.5 h-7 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors text-xs"
          title="طي القائمة الجانبية (Ctrl + B)"
        >
          {isSidebarCollapsed ? (
            <ChevronLeft className="w-3.5 h-3.5" />
          ) : (
            <>
              <ChevronRight className="w-3.5 h-3.5" />
              <span className="text-[11px] text-slate-500">طي القائمة</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
};
