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
        'h-screen flex flex-col bg-white border-l border-slate-200/90 shadow-sm transition-all duration-200 select-none z-30 shrink-0',
        isSidebarCollapsed ? 'w-20' : 'w-64'
      )}
    >
      {/* Brand Header */}
      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
        {!isSidebarCollapsed ? (
          <div className="flex items-center gap-3 overflow-hidden">
            <div
              className={cn(
                'w-9 h-9 rounded-xl flex items-center justify-center font-black text-white shrink-0 shadow-sm',
                isAccessories ? 'bg-blue-600' : 'bg-teal-700'
              )}
            >
              {isAccessories ? 'إكس' : 'MSS'}
            </div>
            <div className="overflow-hidden">
              <h1 className="text-sm font-bold text-slate-800 truncate">نظام إدارة المحل</h1>
              <p className="text-[11px] text-slate-400 truncate">
                {isAccessories ? 'محل الإكسسوارات (محلي)' : 'بيزنس أجهزة MSS المشترك'}
              </p>
            </div>
          </div>
        ) : (
          <div className="mx-auto">
            <div
              className={cn(
                'w-9 h-9 rounded-xl flex items-center justify-center font-black text-white shadow-sm',
                isAccessories ? 'bg-blue-600' : 'bg-teal-700'
              )}
            >
              {isAccessories ? 'إكس' : 'MSS'}
            </div>
          </div>
        )}
      </div>

      {/* Mode Switcher */}
      <div className="p-3 border-b border-slate-100">
        <SectionSwitcher compact={isSidebarCollapsed} />
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-1">
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = currentRoute === item.id;

          const activeColors = isAccessories
            ? 'bg-blue-50 text-blue-700 font-bold border-r-4 border-blue-600 shadow-xs'
            : 'bg-teal-50 text-teal-800 font-bold border-r-4 border-teal-700 shadow-xs';

          return (
            <button
              key={item.id}
              onClick={() => setRoute(item.id as any)}
              title={isSidebarCollapsed ? `${item.label} - ${item.description}` : undefined}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all group text-right',
                isActive
                  ? activeColors
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium'
              )}
            >
              <Icon
                className={cn(
                  'w-5 h-5 shrink-0 transition-transform group-hover:scale-110',
                  isActive
                    ? isAccessories
                      ? 'text-blue-600'
                      : 'text-teal-700'
                    : 'text-slate-400 group-hover:text-slate-600'
                )}
              />
              {!isSidebarCollapsed && (
                <div className="flex-1 truncate">
                  <div className="truncate text-[13px]">{item.label}</div>
                  <div className="text-[10px] text-slate-400 truncate font-normal">
                    {item.description}
                  </div>
                </div>
              )}
              {!isSidebarCollapsed && item.badge && (
                <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer Info & Toggle */}
      <div className="p-3 border-t border-slate-100 bg-slate-50/50 flex flex-col gap-2">
        {!isSidebarCollapsed && (
          <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
            <span className="flex items-center gap-1 font-medium">
              {isAccessories ? (
                <>
                  <Database className="w-3.5 h-3.5 text-blue-600" />
                  قاعدة بيانات SQLite محلية
                </>
              ) : (
                <>
                  <Cloud className="w-3.5 h-3.5 text-teal-600" />
                  Supabase Cloud + كاش
                </>
              )}
            </span>
            <span className="text-[10px] bg-slate-200/70 text-slate-600 px-1.5 py-0.5 rounded">
              v1.0.0
            </span>
          </div>
        )}

        <button
          onClick={toggleSidebar}
          className="w-full flex items-center justify-center gap-2 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors text-xs"
          title="طي القائمة الجانبية (Ctrl + B)"
        >
          {isSidebarCollapsed ? (
            <ChevronLeft className="w-4 h-4" />
          ) : (
            <>
              <ChevronRight className="w-4 h-4" />
              <span className="text-xs text-slate-500">طي القائمة الجانبية</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
};
