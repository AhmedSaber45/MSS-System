import React, { useState, useEffect } from 'react';
import { useNavigation } from '../../context/NavigationContext';
import { useNotification } from '../../context/NotificationContext';
import { useAuth } from '../../context/AuthContext';
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
  User,
  LogOut,
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
  const { user, isOnline, isOfflineAuthorized, offlineDaysRemaining, logout, canAccess } = useAuth();
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const isAccessories = currentSection === 'accessories';
  const canSwitchSection = canAccess('accessories') && canAccess('mss');

  const moduleLabel =
    user?.allowedModules === 'both'
      ? 'كلا القسمين'
      : user?.allowedModules === 'accessories'
      ? 'الإكسسوارات'
      : 'Compu MSS';

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
                <span>Compu MSS</span>
            
              </>
            )}
          </div>
        </div>

        {/* Quick Switch Button (Only available if user has permission to both modules) */}
        {canSwitchSection && (
          <button
            onClick={() => setSection(isAccessories ? 'mss' : 'accessories')}
            className="text-sm text-slate-600 hover:text-slate-900 transition-colors font-semibold cursor-pointer mr-2"
          >
            الانتقال إلى {isAccessories ? 'Compu MSS' : 'الإكسسوارات'}
          </button>
        )}
      </div>

      {/* Right: Date, Time, User, Connectivity, Auto-Updater & Settings */}
      <div className="flex items-center gap-3">
        {/* Automatic Updates Pill Button */}
        <UpdateBadgePill />

        {/* Connectivity Status Pill */}
        <div
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border shadow-xs',
            isOnline
              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
              : 'bg-amber-50 text-amber-900 border-amber-300'
          )}
          title={
            isOnline
              ? 'متصل بالإنترنت ومزامن مع الخادم'
              : `يعمل بدون اتصال بالإنترنت (متبقي ${offlineDaysRemaining} يوم صلاحية)`
          }
        >
          {isOnline ? (
            <>
              <Wifi className="w-3.5 h-3.5 text-emerald-600" />
              <span>متصل</span>
            </>
          ) : (
            <>
              <WifiOff className="w-3.5 h-3.5 text-amber-600" />
              <span>أوفلاين ({offlineDaysRemaining} ي)</span>
            </>
          )}
        </div>

        {/* Authenticated User Pill */}
        {user && (
          <div
            className="hidden sm:flex items-center gap-2 px-3 py-1 bg-slate-100 rounded-lg border border-slate-300 text-xs font-medium text-slate-800 shadow-xs"
            title={`المستخدم: ${user.username} (${user.displayName}) — الصلاحية: ${moduleLabel}`}
          >
            <User className="w-3.5 h-3.5 text-slate-600" />
            <span className="font-semibold">{user.displayName || user.username}</span>
            <span className="text-slate-400">|</span>
            <span className="text-[11px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
              {moduleLabel}
            </span>
          </div>
        )}

        {/* Logout Button */}
        <button
          onClick={() => logout()}
          className="p-2 rounded-lg text-slate-600 hover:text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer"
          title="تسجيل الخروج من المنظومة"
          aria-label="تسجيل الخروج"
        >
          <LogOut className="w-4.5 h-4.5" />
        </button>



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
