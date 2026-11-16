import React, { useState, useEffect } from 'react';
import { useNavigation } from '../../context/NavigationContext';
import { useNotification } from '../../context/NotificationContext';
import {
  Store,
  Laptop,
  Wifi,
  WifiOff,
  Bell,
  Clock,
  Calendar,
  Layers,
  Menu,
  Settings,
} from 'lucide-react';
import { formatDate, formatTime, cn } from '../../lib/utils';
import { Button } from '../common/Button';
import { UpdateBadgePill } from '../common/UpdateBadgePill';

export interface TopHeaderProps {
  onOpenShowcase?: () => void;
  onOpenSettings?: () => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({ onOpenShowcase, onOpenSettings }) => {
  const { currentSection, setSection, toggleSidebar } = useNavigation();
  const { toggleDrawer, unreadCount, isDrawerOpen } = useNotification();
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const isAccessories = currentSection === 'accessories';

  return (
    <header className="h-16 bg-white border-b border-slate-300 px-4 md:px-6 flex items-center justify-between z-20 shrink-0 select-none shadow-sm">
      {/* Left: Mobile/Sidebar toggle & Active Section Indicator */}
      <div className="flex items-center gap-3.5">
        <button
          onClick={toggleSidebar}
          className="text-slate-600 hover:text-slate-900 p-2 rounded-lg hover:bg-slate-100 transition-colors"
          title="تبديل القائمة الجانبية"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Active Section Tag */}
        <div
          className={cn(
            'flex items-center gap-2.5 px-3 py-1.5 rounded-lg border text-sm font-bold shadow-sm',
            isAccessories
              ? 'bg-blue-50 border-blue-300 text-blue-950'
              : 'bg-teal-50 border-teal-300 text-teal-950'
          )}
        >
          <div
            className={cn(
              'w-2.5 h-2.5 rounded-full',
              isAccessories ? 'bg-blue-700' : 'bg-teal-700'
            )}
          />
          <div className="flex items-center gap-2">
            {isAccessories ? (
              <>
                <Store className="w-4.5 h-4.5 text-blue-700" />
                <span> الإكسسوارات</span>
              
              </>
            ) : (
              <>
                <Laptop className="w-4.5 h-4.5 text-teal-800" />
                <span>  MSS</span>
            
              </>
            )}
          </div>
        </div>

        {/* Quick Switch Button */}
        <button
          onClick={() => setSection(isAccessories ? 'mss' : 'accessories')}
          className="text-sm text-slate-600 hover:text-slate-900 transition-colors font-semibold cursor-pointer mr-2"
        >
          الانتقال إلى {isAccessories ? ' MSS' : 'الإكسسوارات'}
        </button>
      </div>

      {/* Right: Date, Time, Status, Auto-Updater & Showcase Trigger */}
      <div className="flex items-center gap-3">
        {/* Automatic Updates Pill Button */}
        <UpdateBadgePill />



        {/* Live Clock & Date */}
        <div className="hidden lg:flex items-center gap-3 text-sm text-slate-700 bg-slate-100/80 px-3 h-9 rounded-lg border border-slate-300 font-medium shadow-sm">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-500" />
            <span>{formatDate(currentTime)}</span>
          </div>
          <span className="text-slate-300">|</span>
          <div className="flex items-center gap-2 font-mono tabular-nums font-semibold">
            <Clock className="w-4 h-4 text-slate-500" />
            <span>{formatTime(currentTime)}</span>
          </div>
        </div>

        {/* Notifications Icon Button with Side Drawer Toggle & Unread Badge */}
        <button
          onClick={toggleDrawer}
          className={cn(
            'relative p-2 rounded-lg transition-colors cursor-pointer',
            isDrawerOpen
              ? 'bg-slate-200 text-slate-900'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          )}
          title="مركز الإشعارات والتنبيهات"
          aria-label="مركز الإشعارات والتنبيهات"
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[19px] h-[19px] px-1 bg-rose-600 text-white text-[11px] font-bold rounded-full flex items-center justify-center font-mono shadow-sm animate-in zoom-in">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>

        {/* System Settings & Startup with Windows Modal Trigger */}
        <button
          onClick={onOpenSettings}
          className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
          title="إعدادات النظام والتشغيل التلقائي — Startup with Windows"
          aria-label="إعدادات النظام"
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
};
