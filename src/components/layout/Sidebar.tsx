import React from 'react';
import { useNavigation } from '../../context/NavigationContext';
import { accessoriesNavItems, mssNavItems } from '../../config/navigationConfig';
import { SectionSwitcher } from './SectionSwitcher';
import { ChevronRight, ChevronLeft, Database, Cloud, Settings } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface SidebarProps {
  onOpenSettings?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ onOpenSettings }) => {
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
        'h-screen flex flex-col bg-white border-l border-slate-200 shadow-xs select-none z-30 shrink-0 transition-all duration-200',
        isSidebarCollapsed ? 'w-22' : 'w-72'
      )}
    >
      {/* Brand Header */}
      <div className="h-16 px-4 border-b border-slate-200 flex items-center justify-between shrink-0">
        {!isSidebarCollapsed ? (
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center shadow-xs shrink-0 p-1.5 border border-slate-800">
              <img
                src="/assets/branding/as_logo_gold.png"
                alt="AS System"
                className="w-full h-full object-contain select-none"
              />
            </div>
            <div className="overflow-hidden">
              <h1 className="text-base font-bold text-slate-900 truncate font-mono">AS System</h1>
              <p className="text-xs font-semibold text-slate-500 truncate mt-0.5">
                {isAccessories ? ' الإكسسوارات ' : ' Compu MSS '}
              </p>
            </div>
          </div>
        ) : (
          <div className="mx-auto">
            <div
              className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center shadow-xs p-1.5 border border-slate-800"
              title="AS System"
            >
              <img
                src="/assets/branding/as_logo_gold.png"
                alt="AS System"
                className="w-full h-full object-contain select-none"
              />
            </div>
          </div>
        )}
      </div>

      {/* Mode Switcher */}
      <div className="p-3 border-b border-slate-200 shrink-0">
        <SectionSwitcher compact={isSidebarCollapsed} />
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 overflow-y-auto px-3.5 py-4 space-y-3.5">
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = currentRoute === item.id;

          const activeStyle = isAccessories
            ? 'bg-blue-50/95 text-blue-700 font-bold border-r-[4.5px] border-blue-600 shadow-xs'
            : 'bg-teal-50/95 text-teal-800 font-bold border-r-[4.5px] border-teal-700 shadow-xs';

          const inactiveStyle =
            'text-slate-800 hover:bg-slate-100/70 hover:text-slate-950 font-semibold border-r-[4.5px] border-transparent';

          return (
            <button
              key={item.id}
              onClick={() => setRoute(item.id as any)}
              title={isSidebarCollapsed ? `${item.label} — ${item.description}` : undefined}
              className={cn(
                'w-full flex items-center gap-4 px-4 h-12.5 rounded-xl transition-all group text-right',
                isActive ? activeStyle : inactiveStyle
              )}
            >
              <div className="w-7 h-7 flex items-center justify-center shrink-0">
                <Icon
                  className={cn(
                    'w-6 h-6 transition-colors',
                    isActive
                      ? isAccessories
                        ? 'text-blue-600'
                        : 'text-teal-700'
                      : 'text-slate-400 group-hover:text-slate-700'
                  )}
                  strokeWidth={isActive ? 2.3 : 2}
                />
              </div>

              {!isSidebarCollapsed && (
                <span
                  className={cn(
                    'truncate text-base leading-snug',
                    isActive ? 'font-bold' : 'font-semibold'
                  )}
                >
                  {item.label}
                </span>
              )}

              {!isSidebarCollapsed && item.badge && (
                <span className="mr-auto text-xs font-bold bg-slate-200/90 text-slate-800 px-2.5 py-1 rounded-md border border-slate-300 tabular-nums">
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
          <div className="flex items-center justify-between text-xs text-slate-600 px-1 font-semibold">
            <span className="text-xs font-mono font-bold text-slate-600 tabular-nums">
              AS System v1.0.4
            </span>
            {onOpenSettings && (
              <button
                type="button"
                onClick={onOpenSettings}
                className="text-slate-500 hover:text-blue-700 text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                title="إعدادات النظام والتشغيل مع Windows"
              >
                <Settings className="w-3.5 h-3.5" />
                <span>الإعدادات</span>
              </button>
            )}
          </div>
        )}

        <button
          onClick={toggleSidebar}
          className="w-full flex items-center justify-center gap-2 h-9 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 transition-colors text-xs font-bold"
          title="طي القائمة الجانبية (Ctrl + B)"
        >
          {isSidebarCollapsed ? (
            <ChevronLeft className="w-4.5 h-4.5" />
          ) : (
            <>
              <ChevronRight className="w-4.5 h-4.5" />
              <span className="text-xs font-semibold">طي القائمة</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
};
