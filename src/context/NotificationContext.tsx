import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { inventoryService } from '@/services/inventoryService';
import { mssSyncService } from '@/services/mssSyncService';
import { AppSection, ActiveRoute } from '@/types/navigation';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  message?: string;
  duration?: number;
}

export interface DrawerNotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: string;
  category: 'inventory' | 'sync' | 'system';
  isRead: boolean;
  target?: {
    section: AppSection;
    route: ActiveRoute;
  };
}

const READ_IDS_STORAGE_KEY = 'mss_read_notification_ids_v1';
const RUNTIME_NOTIFICATIONS_STORAGE_KEY = 'mss_runtime_notifications_v1';

interface NotificationContextType {
  // Ephemeral toast notifications (preserved)
  notifications: NotificationItem[];
  showNotification: (item: Omit<NotificationItem, 'id'>) => string;
  dismissNotification: (id: string) => void;
  clearAll: () => void;

  // Notification Drawer system
  drawerNotifications: DrawerNotificationItem[];
  unreadCount: number;
  isDrawerOpen: boolean;
  isLoadingDrawer: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  toggleDrawer: () => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  refreshSystemAlerts: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Toast notifications state
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  // Drawer state
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [isLoadingDrawer, setIsLoadingDrawer] = useState<boolean>(false);
  const [systemAlerts, setSystemAlerts] = useState<DrawerNotificationItem[]>([]);
  const [runtimeNotifications, setRuntimeNotifications] = useState<DrawerNotificationItem[]>(() => {
    try {
      const stored = localStorage.getItem(RUNTIME_NOTIFICATIONS_STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {
      // Fallback
    }
    return [];
  });

  // Read IDs set from localStorage
  const [readIds, setReadIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem(READ_IDS_STORAGE_KEY);
      if (stored) {
        return new Set(JSON.parse(stored));
      }
    } catch {
      // Fallback
    }
    return new Set<string>();
  });

  // Save read IDs to storage helper
  const persistReadIds = (newSet: Set<string>) => {
    try {
      localStorage.setItem(READ_IDS_STORAGE_KEY, JSON.stringify(Array.from(newSet)));
    } catch (err) {
      console.warn('Failed to persist read notification IDs:', err);
    }
  };

  // Save runtime notifications helper
  const persistRuntimeNotifications = (items: DrawerNotificationItem[]) => {
    try {
      localStorage.setItem(RUNTIME_NOTIFICATIONS_STORAGE_KEY, JSON.stringify(items.slice(0, 50)));
    } catch (err) {
      console.warn('Failed to persist runtime notifications:', err);
    }
  };

  // Toast actions
  const dismissNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  // Refresh System Alerts (Inventory + Sync)
  const refreshSystemAlerts = useCallback(async () => {
    setIsLoadingDrawer(true);
    try {
      const alerts: DrawerNotificationItem[] = [];

      // 1. Fetch Inventory alerts
      const stock = await inventoryService.getStockAlerts().catch(() => ({ lowStock: [], outOfStock: [] }));
      
      // Out of stock
      stock.outOfStock.forEach(p => {
        alerts.push({
          id: `stock-out-${p.id}`,
          type: 'error',
          title: `نفاد الرصيد: ${p.name}`,
          message: `نفد رصيد الصنف كود (${p.code}) بالكامل (0 قطعة). يُرجى طلب توريد كميات جديدة.`,
          timestamp: new Date().toISOString(),
          category: 'inventory',
          isRead: false,
          target: { section: 'accessories', route: 'inventory' },
        });
      });

      // Low stock
      stock.lowStock.forEach(p => {
        alerts.push({
          id: `stock-low-${p.id}`,
          type: 'warning',
          title: `مخزون منخفض: ${p.name}`,
          message: `وصل الرصيد الحالي (${p.stock} قطعة) إلى حد التنبيه الأدنى (${p.low_stock_threshold} قطعة).`,
          timestamp: new Date().toISOString(),
          category: 'inventory',
          isRead: false,
          target: { section: 'accessories', route: 'inventory' },
        });
      });

      // 2. Fetch Sync conflicts
      const conflicts = await mssSyncService.getConflicts().catch(() => []);
      const pendingConflicts = conflicts.filter(c => c.resolution_status === 'PENDING');
      pendingConflicts.forEach(c => {
        alerts.push({
          id: `sync-conflict-${c.id}`,
          type: 'error',
          title: 'تعارض في المزامنة السحابية',
          message: `تعارض على جهاز بالسيريال (${c.serial_number}) - نوع: ${c.conflict_type}. يتطلب المراجعة اليدوية.`,
          timestamp: c.created_at || new Date().toISOString(),
          category: 'sync',
          isRead: false,
          target: { section: 'mss', route: 'sync' },
        });
      });

      // 3. Fetch Sync summary
      const syncSummary = await mssSyncService.getSyncSummary().catch(() => null);
      if (syncSummary && syncSummary.pending_count > 0) {
        alerts.push({
          id: 'sync-pending-queue',
          type: 'info',
          title: 'طابور المزامنة المعلقة',
          message: `يوجد ${syncSummary.pending_count} عملية محلية بانتظار المزامنة مع السحابة فور استقرار الاتصال.`,
          timestamp: new Date().toISOString(),
          category: 'sync',
          isRead: false,
          target: { section: 'mss', route: 'sync' },
        });
      }

      setSystemAlerts(alerts);
    } catch (err) {
      console.warn('Failed to load system alerts:', err);
    } finally {
      setIsLoadingDrawer(false);
    }
  }, []);

  // Initial load of system alerts
  useEffect(() => {
    refreshSystemAlerts();
  }, [refreshSystemAlerts]);

  // showNotification creates both an ephemeral toast and a drawer item
  const showNotification = useCallback(
    ({ type, title, message, duration = 4000 }: Omit<NotificationItem, 'id'>) => {
      const id = Math.random().toString(36).substring(2, 9);
      const newItem: NotificationItem = { id, type, title, message, duration };

      setNotifications(prev => [...prev, newItem]);

      if (duration > 0) {
        setTimeout(() => {
          dismissNotification(id);
        }, duration);
      }

      // Also record into Drawer runtime notifications
      const drawerItem: DrawerNotificationItem = {
        id: `rt-${Date.now()}-${id}`,
        type,
        title,
        message: message || '',
        timestamp: new Date().toISOString(),
        category: 'system',
        isRead: false,
      };

      setRuntimeNotifications(prev => {
        const next = [drawerItem, ...prev.slice(0, 49)];
        persistRuntimeNotifications(next);
        return next;
      });

      return id;
    },
    [dismissNotification]
  );

  // Mark as read
  const markAsRead = useCallback((id: string) => {
    setReadIds(prev => {
      const next = new Set(prev);
      next.add(id);
      persistReadIds(next);
      return next;
    });
  }, []);

  // Mark all as read
  const markAllAsRead = useCallback(() => {
    setReadIds(prev => {
      const next = new Set(prev);
      systemAlerts.forEach(a => next.add(a.id));
      runtimeNotifications.forEach(r => next.add(r.id));
      persistReadIds(next);
      return next;
    });
  }, [systemAlerts, runtimeNotifications]);

  // Combined Drawer notifications with read states applied
  const drawerNotifications = useMemo(() => {
    const combined = [...systemAlerts, ...runtimeNotifications];
    return combined.map(item => ({
      ...item,
      isRead: readIds.has(item.id),
    }));
  }, [systemAlerts, runtimeNotifications, readIds]);

  // Unread counter
  const unreadCount = useMemo(() => {
    return drawerNotifications.filter(n => !n.isRead).length;
  }, [drawerNotifications]);

  // Drawer toggles
  const openDrawer = useCallback(() => {
    setIsDrawerOpen(true);
    refreshSystemAlerts();
  }, [refreshSystemAlerts]);

  const closeDrawer = useCallback(() => {
    setIsDrawerOpen(false);
  }, []);

  const toggleDrawer = useCallback(() => {
    setIsDrawerOpen(prev => {
      if (!prev) refreshSystemAlerts();
      return !prev;
    });
  }, [refreshSystemAlerts]);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        showNotification,
        dismissNotification,
        clearAll,

        drawerNotifications,
        unreadCount,
        isDrawerOpen,
        isLoadingDrawer,
        openDrawer,
        closeDrawer,
        toggleDrawer,
        markAsRead,
        markAllAsRead,
        refreshSystemAlerts,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotification = (): NotificationContextType => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};
