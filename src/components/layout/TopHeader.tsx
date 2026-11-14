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
  Sparkles,
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
      title: 'إشعار تجريبي',
      message: 'نظام الإشعارات التفاعلي يعمل بنجاح.',
    });
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200/90 px-6 flex items-center justify-between z-20 shrink-0 shadow-xs">
      {/* Left: Mobile/Sidebar toggle & Active Section Indicator */}
      <div className="flex items-center gap-4">
        <button
          onClick={toggleSidebar}
          className="text-slate-500 hover:text-slate-800 p-2 rounded-lg hover:bg-slate-100 transition-colors"
          title="تبديل القائمة الجانبية"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Prominent Active Section Badge */}
        <div
          className={cn(
            'flex items-center gap-2.5 px-3.5 py-1.5 rounded-xl border text-xs font-semibold shadow-2xs transition-all',
            isAccessories
              ? 'bg-blue-50/80 border-blue-200 text-blue-900'
              : 'bg-teal-50/80 border-teal-200 text-teal-950'
          )}
        >
          <div
            className={cn(
              'w-2.5 h-2.5 rounded-full animate-pulse',
              isAccessories ? 'bg-blue-600' : 'bg-teal-600'
            )}
          />
          <div className="flex items-center gap-1.5">
            {isAccessories ? (
              <>
                <Store className="w-4 h-4 text-blue-600" />
                <span>قسم محل الإكسسوارات</span>
                <span className="text-[11px] bg-blue-100/80 text-blue-800 px-2 py-0.5 rounded-md font-normal">
                  محلي مستقل
                </span>
              </>
            ) : (
              <>
                <Laptop className="w-4 h-4 text-teal-700" />
                <span>قسم أجهزة MSS</span>
                <span className="text-[11px] bg-teal-100/80 text-teal-900 px-2 py-0.5 rounded-md font-normal">
                  مشترك بين المحلين
                </span>
              </>
            )}
          </div>
        </div>

        {/* Quick Switch Button */}
        <button
          onClick={() => setSection(isAccessories ? 'mss' : 'accessories')}
          className="text-xs text-slate-500 hover:text-blue-600 underline font-medium cursor-pointer"
        >
          الانتقال إلى {isAccessories ? 'أجهزة MSS' : 'الإكسسوارات'}
        </button>
      </div>

      {/* Right: Date, Time, Status, Auto-Updater & Showcase Trigger */}
      <div className="flex items-center gap-3.5">
        {/* Automatic Updates Pill Button */}
        <UpdateBadgePill />

        {/* Component Showcase Modal Button for Review */}
        {onOpenShowcase && (
          <Button
            size="sm"
            variant="outline"
            onClick={onOpenShowcase}
            leftIcon={<Sparkles className="w-3.5 h-3.5 text-amber-500" />}
            className="text-xs font-semibold border-amber-300 bg-amber-50/50 hover:bg-amber-100 text-amber-900"
          >
            معاينة عناصر الواجهة (UI Showcase)
          </Button>
        )}

        {/* Connection status indicator */}
        <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 rounded-lg text-xs font-medium text-slate-600">
          {isAccessories ? (
            <>
              <WifiOff className="w-3.5 h-3.5 text-slate-500" />
              <span>وضع عدم الاتصال (آمن محلياً)</span>
            </>
          ) : (
            <>
              <Wifi className="w-3.5 h-3.5 text-emerald-600" />
              <span>جاهز للمزامنة السحابية</span>
            </>
          )}
        </div>

        {/* Live Clock & Date */}
        <div className="hidden lg:flex items-center gap-3 text-xs text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200/60 font-medium">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span>{formatDate(currentTime)}</span>
          </div>
          <span className="text-slate-300">|</span>
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-mono">{formatTime(currentTime)}</span>
          </div>
        </div>

        {/* Notifications Icon Button */}
        <button
          onClick={handleQuickNotificationTest}
          className="relative text-slate-500 hover:text-slate-800 p-2 rounded-lg hover:bg-slate-100 transition-colors"
          title="الإشعارات (انقر لإرسال إشعار تجريبي)"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-blue-600 rounded-full" />
        </button>
      </div>
    </header>
  );
};
