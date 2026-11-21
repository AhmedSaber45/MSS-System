import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNotification, DrawerNotificationItem } from '@/context/NotificationContext';
import { useNavigation } from '@/context/NavigationContext';
import {
  X,
  Bell,
  AlertTriangle,
  AlertOctagon,
  CheckCircle2,
  Info,
  Check,
  CheckCheck,
  RefreshCw,
  Package,
  Layers,
  ChevronLeft,
  ArrowRight,
  Clock,
  Trash2,
} from 'lucide-react';
import { cn, formatDate, formatTime } from '@/lib/utils';
import { Button } from './Button';
import { Badge } from './Badge';
import { Spinner } from './Spinner';
import { Modal } from './Modal';

type FilterTab = 'all' | 'unread' | 'inventory' | 'sync';

export const NotificationDrawer: React.FC = () => {
  const {
    isDrawerOpen,
    closeDrawer,
    drawerNotifications,
    unreadCount,
    readCount,
    isLoadingDrawer,
    markAsRead,
    markAllAsRead,
    clearReadNotifications,
    refreshSystemAlerts,
    showNotification,
  } = useNotification();

  const { setSection, setRoute } = useNavigation();
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState<boolean>(false);
  const [isDeletingRead, setIsDeletingRead] = useState<boolean>(false);
  const drawerRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isDrawerOpen) {
        closeDrawer();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDrawerOpen, closeDrawer]);

  // Prevent background scroll when drawer is open
  useEffect(() => {
    if (isDrawerOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isDrawerOpen]);

  // Filter notifications by active tab
  const filteredNotifications = useMemo(() => {
    switch (activeTab) {
      case 'unread':
        return drawerNotifications.filter(n => !n.isRead);
      case 'inventory':
        return drawerNotifications.filter(n => n.category === 'inventory');
      case 'sync':
        return drawerNotifications.filter(n => n.category === 'sync' || n.category === 'system');
      case 'all':
      default:
        return drawerNotifications;
    }
  }, [drawerNotifications, activeTab]);

  // Inventory & Sync alert counts for tab badges
  const inventoryAlertsCount = useMemo(() => {
    return drawerNotifications.filter(n => n.category === 'inventory').length;
  }, [drawerNotifications]);

  const syncAlertsCount = useMemo(() => {
    return drawerNotifications.filter(n => n.category === 'sync' || n.category === 'system').length;
  }, [drawerNotifications]);

  // Handle click on a notification card (navigation & read)
  const handleNotificationClick = (item: DrawerNotificationItem) => {
    if (!item.isRead) {
      markAsRead(item.id);
    }
    if (item.target) {
      setSection(item.target.section);
      const params = item.category === 'inventory' ? { filter: 'low_and_out' } : undefined;
      setRoute(item.target.route, params);
      closeDrawer();
    }
  };

  // Handle clear read notifications confirmation
  const handleConfirmClearRead = async () => {
    if (isDeletingRead) return;
    setIsDeletingRead(true);
    try {
      const deletedCount = await clearReadNotifications();
      setIsConfirmModalOpen(false);
      showNotification({
        type: 'success',
        title: 'تم مسح الإشعارات المقروءة',
        message: `تم مسح ${deletedCount} من الإشعارات المقروءة بنجاح.`,
      });
    } catch (err: any) {
      showNotification({
        type: 'error',
        title: 'فشل مسح الإشعارات',
        message: err?.message || 'حدث خطأ أثناء محاولة مسح الإشعارات المقروءة',
      });
    } finally {
      setIsDeletingRead(false);
    }
  };

  // Render meaningful icon based on notification type and category
  const renderIcon = (item: DrawerNotificationItem) => {
    const iconClass = 'w-5 h-5 shrink-0';
    if (item.category === 'inventory') {
      if (item.type === 'error') {
        return <AlertOctagon className={cn(iconClass, 'text-rose-600')} />;
      }
      return <Package className={cn(iconClass, 'text-amber-600')} />;
    }
    if (item.category === 'sync') {
      if (item.type === 'error') {
        return <AlertTriangle className={cn(iconClass, 'text-rose-600')} />;
      }
      return <RefreshCw className={cn(iconClass, 'text-teal-600')} />;
    }

    switch (item.type) {
      case 'error':
        return <AlertOctagon className={cn(iconClass, 'text-rose-600')} />;
      case 'warning':
        return <AlertTriangle className={cn(iconClass, 'text-amber-600')} />;
      case 'success':
        return <CheckCircle2 className={cn(iconClass, 'text-emerald-600')} />;
      case 'info':
      default:
        return <Info className={cn(iconClass, 'text-blue-600')} />;
    }
  };

  return (
    <>
      {/* Backdrop overlay */}
      <div
        className={cn(
          'fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 transition-opacity duration-300 ease-in-out select-none',
          isDrawerOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
        onClick={closeDrawer}
        aria-hidden="true"
      />

      {/* Side Drawer panel attached to left side (RTL end / bell side) */}
      <aside
        ref={drawerRef}
        aria-label="لوحة الإشعارات والتنبيهات"
        className={cn(
          'fixed top-0 left-0 h-full w-full max-w-md bg-white border-r border-slate-300 shadow-2xl z-50 flex flex-col',
          'transition-transform duration-300 ease-in-out transform',
          isDrawerOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Drawer Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 text-base">مركز التنبيهات</h3>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 text-xs font-mono font-bold bg-rose-600 text-white rounded-full">
                    {unreadCount} جديد
                  </span>
                )}
              </div>
       
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={refreshSystemAlerts}
              isLoading={isLoadingDrawer}
              title="فحص التنبيهات الآن"
              className="p-2 h-9 w-9 text-slate-600 hover:text-slate-900"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
            <button
              type="button"
              onClick={closeDrawer}
              className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-200/80 rounded-lg transition-colors cursor-pointer"
              title="إغلاق اللوحة (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Header Actions & Filter Tabs */}
        <div className="p-3 bg-white border-b border-slate-200 shrink-0 space-y-2.5">
          {/* Quick Mark All As Read & Clear Read Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs px-1">
            <span className="font-semibold text-slate-600">
              إجمالي التنبيهات: <strong className="font-mono text-slate-900">{drawerNotifications.length}</strong>
            </span>

            <div className="flex items-center gap-2.5">
              {unreadCount > 0 ? (
                <button
                  type="button"
                  onClick={markAllAsRead}
                  className="inline-flex items-center gap-1.5 text-blue-700 hover:text-blue-900 font-bold hover:underline cursor-pointer transition-colors"
                >
                  <CheckCheck className="w-4 h-4" />
                  <span>تحديد الكل كمقروء</span>
                </button>
              ) : (
                <span className="text-slate-400 font-medium">كافة التنبيهات مقروءة</span>
              )}

              <span className="text-slate-300">|</span>

              <button
                type="button"
                disabled={readCount === 0 || isDeletingRead}
                onClick={() => setIsConfirmModalOpen(true)}
                className={cn(
                  'inline-flex items-center gap-1.5 font-bold transition-colors select-none',
                  readCount > 0 && !isDeletingRead
                    ? 'text-rose-600 hover:text-rose-800 hover:underline cursor-pointer'
                    : 'text-slate-400 opacity-50 cursor-not-allowed'
                )}
                title={readCount > 0 ? `مسح ${readCount} إشعار مقروء` : 'لا توجد إشعارات مقروءة لمسحها'}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>مسح الإشعارات المقروءة</span>
              </button>
            </div>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={cn(
                'px-2.5 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-colors cursor-pointer',
                activeTab === 'all'
                  ? 'bg-slate-900 text-white font-bold'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900'
              )}
            >
              الكل ({drawerNotifications.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('unread')}
              className={cn(
                'px-2.5 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-colors cursor-pointer',
                activeTab === 'unread'
                  ? 'bg-slate-900 text-white font-bold'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900'
              )}
            >
              غير مقروءة ({unreadCount})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('inventory')}
              className={cn(
                'px-2.5 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-colors cursor-pointer',
                activeTab === 'inventory'
                  ? 'bg-slate-900 text-white font-bold'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900'
              )}
            >
              المخزون ({inventoryAlertsCount})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('sync')}
              className={cn(
                'px-2.5 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-colors cursor-pointer',
                activeTab === 'sync'
                  ? 'bg-slate-900 text-white font-bold'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900'
              )}
            >
              المزامنة والنظام ({syncAlertsCount})
            </button>
          </div>
        </div>

        {/* Notification Items List */}
        <div className="flex-1 overflow-y-auto p-3.5 space-y-2.5">
          {isLoadingDrawer && drawerNotifications.length === 0 ? (
            <div className="p-12 flex flex-col items-center justify-center text-center space-y-3">
              <Spinner size="lg" />
              <p className="text-sm font-semibold text-slate-700">جارٍ جلب وفحص التنبيهات...</p>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="p-12 flex flex-col items-center justify-center text-center space-y-3">
              {activeTab === 'unread' ? (
                <>
                  <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">تمت قراءة جميع التنبيهات</h4>
                    <p className="text-xs text-slate-500 mt-1">لا توجد أي إشعارات جديدة غير مقروءة حالياً.</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center border border-slate-200">
                    <Bell className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">لا توجد إشعارات حالياً</h4>
                    <p className="text-xs text-slate-500 mt-1">كافة أرصدة المخزون والمزامنة تعمل بصورة طبيعية ولا توجد تنبيهات تستدعي الانتباه.</p>
                  </div>
                </>
              )}
            </div>
          ) : (
            filteredNotifications.map(item => {
              const dateObj = new Date(item.timestamp);
              const formattedDate = formatDate(dateObj);
              const formattedTime = formatTime(dateObj);

              return (
                <div
                  key={item.id}
                  onClick={() => handleNotificationClick(item)}
                  className={cn(
                    'relative p-3.5 rounded-xl border transition-all cursor-pointer group text-right',
                    item.isRead
                      ? 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/80 opacity-90'
                      : item.type === 'error'
                      ? 'bg-rose-50/50 border-rose-300 hover:border-rose-400 shadow-2xs'
                      : item.type === 'warning'
                      ? 'bg-amber-50/50 border-amber-300 hover:border-amber-400 shadow-2xs'
                      : 'bg-blue-50/40 border-blue-300 hover:border-blue-400 shadow-2xs'
                  )}
                >
                  {/* Top Row: Icon, Title, Read action & Unread dot */}
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex items-start gap-2.5 flex-1 min-w-0">
                      <div className="mt-0.5">{renderIcon(item)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className={cn('text-sm font-bold truncate', item.isRead ? 'text-slate-800' : 'text-slate-950')}>
                            {item.title}
                          </h4>
                          {!item.isRead && (
                            <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" title="غير مقروء" />
                          )}
                        </div>
                        <p className="text-xs text-slate-600 mt-1 leading-relaxed font-normal">
                          {item.message}
                        </p>
                      </div>
                    </div>

                    {/* Mark as read button if unread */}
                    {!item.isRead && (
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          markAsRead(item.id);
                        }}
                        className="p-1 text-slate-400 hover:text-slate-800 hover:bg-slate-200/70 rounded-md transition-colors shrink-0"
                        title="تحديد كمقروء"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Footer: Timestamp & Resolution Navigation Link */}
                  <div className="mt-2.5 pt-2 border-t border-slate-200/80 flex items-center justify-between text-[11px] text-slate-500 font-medium">
                    <div className="flex items-center gap-1.5 font-mono tabular-nums">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>{formattedTime} - {formattedDate}</span>
                    </div>

                    {item.target && (
                      <span className="inline-flex items-center gap-1 text-blue-700 font-bold group-hover:underline">
                        <span>الانتقال للمعاينة</span>
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Drawer Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 shrink-0 flex items-center justify-between text-xs text-slate-600">
          <span>نظام التنبيهات الموحد</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={closeDrawer}
            className="text-xs font-semibold text-slate-700 hover:text-slate-900"
          >
            إغلاق اللوحة
          </Button>
        </div>
      </aside>

      {/* Clear Read Notifications Confirmation Modal */}
      <Modal
        isOpen={isConfirmModalOpen}
        onClose={() => !isDeletingRead && setIsConfirmModalOpen(false)}
        title="مسح الإشعارات المقروءة؟"
        size="sm"
        zIndexClassName="z-[70]"
        footer={
          <div className="flex items-center justify-end gap-2.5">
            <Button
              variant="outline"
              size="md"
              disabled={isDeletingRead}
              onClick={() => setIsConfirmModalOpen(false)}
            >
              إلغاء
            </Button>
            <Button
              variant="danger"
              size="md"
              isLoading={isDeletingRead}
              disabled={isDeletingRead}
              onClick={handleConfirmClearRead}
              leftIcon={<Trash2 className="w-4 h-4" />}
            >
              مسح الإشعارات
            </Button>
          </div>
        }
      >
        <div className="space-y-3 py-1 text-right" dir="rtl">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 shrink-0 mt-0.5">
              <Trash2 className="w-5 h-5" />
            </div>
            <div className="space-y-1.5 flex-1">
              <p className="text-sm text-slate-800 font-medium leading-relaxed">
                هيتم حذف كل الإشعارات اللي اتقرت بالفعل، ومش هتقدر ترجعها بعد كده.
              </p>
              <p className="text-xs text-slate-500">
                (عدد الإشعارات المقروءة المراد مسحها: <strong className="font-mono text-slate-700">{readCount}</strong>، وستظل جميع الإشعارات غير المقروءة محفوظة بالكامل دون أي مساس)
              </p>
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
};
