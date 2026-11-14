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
} from 'lucide-react';
import { formatDate, formatTime, cn } from '../../lib/utils';
import { Button } from '../common/Button';
import { UpdateBadgePill } from '../common/UpdateBadgePill';

export interface TopHeaderProps {
  onOpenShowcase?: () => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({ onOpenShowcase }) => {
  const { currentSection, setSection, toggleSidebar } = useNavigation();
  const { showNotification } = useNotification();
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const isAccessories = currentSection === 'accessories';

  const handleQuickNotificationTest = () => {
    showNotification({
      type: 'info',
      title: 'إشعار النظام',
      message: 'نظام الإشعارات والتحذيرات يعمل بصورة طبيعية.',
    });
  };

  return (
    <header className="h-14 bg-white border-b border-slate-200/90 px-4 md:px-6 flex items-center justify-between z-20 shrink-0 select-none">
      {/* Left: Mobile/Sidebar toggle & Active Section Indicator */}
      <div className="flex items-center gap-3">
        <button
          onClick={toggleSidebar}
          className="text-slate-500 hover:text-slate-800 p-1.5 rounded-md hover:bg-slate-100 transition-colors"
          title="تبديل القائمة الجانبية"
        >
          <Menu className="w-4 h-4" />
        </button>

        {/* Active Section Tag */}
        <div
          className={cn(
            'flex items-center gap-2 px-2.5 py-1 rounded-md border text-xs font-medium',
            isAccessories
              ? 'bg-blue-50/70 border-blue-200 text-blue-900'
              : 'bg-teal-50/70 border-teal-200 text-teal-950'
          )}
        >
          <div
            className={cn(
              'w-2 h-2 rounded-full',
              isAccessories ? 'bg-blue-600' : 'bg-teal-700'
            )}
          />
          <div className="flex items-center gap-1.5">
            {isAccessories ? (
              <>
                <Store className="w-3.5 h-3.5 text-blue-700" />
                <span>محل الإكسسوارات</span>
                <span className="text-[10px] text-blue-700 font-normal">| محلي مستقل</span>
              </>
            ) : (
              <>
                <Laptop className="w-3.5 h-3.5 text-teal-800" />
                <span>بيزنس أجهزة MSS</span>
                <span className="text-[10px] text-teal-800 font-normal">| مشترك وسحابي</span>
              </>
            )}
          </div>
        </div>

        {/* Quick Switch Button */}
        <button
          onClick={() => setSection(isAccessories ? 'mss' : 'accessories')}
          className="text-xs text-slate-500 hover:text-slate-900 transition-colors font-normal cursor-pointer mr-1"
        >
          الانتقال إلى {isAccessories ? 'أجهزة MSS' : 'الإكسسوارات'}
        </button>
      </div>

      {/* Right: Date, Time, Status, Auto-Updater & Showcase Trigger */}
      <div className="flex items-center gap-2.5">
        {/* Automatic Updates Pill Button */}
        <UpdateBadgePill />

        {/* Component Showcase Modal Button for Review */}
        {onOpenShowcase && (
          <Button
            size="sm"
            variant="outline"
            onClick={onOpenShowcase}
            leftIcon={<Layers className="w-3.5 h-3.5 text-slate-500" />}
            className="text-xs font-medium text-slate-700"
          >
            عناصر الواجهة
          </Button>
        )}

        {/* Connection status indicator */}
        <div className="hidden md:flex items-center gap-1.5 px-2.5 h-8 bg-slate-50 border border-slate-200/90 rounded-lg text-xs font-normal text-slate-600">
          {isAccessories ? (
            <>
              <WifiOff className="w-3.5 h-3.5 text-slate-400" />
              <span>محلي (أوفلاين)</span>
            </>
          ) : (
            <>
              <Wifi className="w-3.5 h-3.5 text-emerald-600" />
              <span>جاهز للمزامنة</span>
            </>
          )}
        </div>

        {/* Live Clock & Date */}
        <div className="hidden lg:flex items-center gap-2.5 text-xs text-slate-500 bg-slate-50 px-2.5 h-8 rounded-lg border border-slate-200/90 font-normal">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span>{formatDate(currentTime)}</span>
          </div>
          <span className="text-slate-300">|</span>
          <div className="flex items-center gap-1.5 font-mono tabular-nums">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>{formatTime(currentTime)}</span>
          </div>
        </div>

        {/* Notifications Icon Button */}
        <button
          onClick={handleQuickNotificationTest}
          className="relative text-slate-500 hover:text-slate-800 p-2 rounded-lg hover:bg-slate-100 transition-colors"
          title="الإشعارات (اختبار)"
        >
          <Bell className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
