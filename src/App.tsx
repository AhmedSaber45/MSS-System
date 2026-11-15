import React, { useEffect } from 'react';
import { NavigationProvider } from './context/NavigationContext';
import { NotificationProvider, useNotification } from './context/NotificationContext';
import { PageRefreshProvider } from './context/PageRefreshContext';
import { AppShell } from './components/layout/AppShell';
import { backupService } from './services/backupService';

// Background scheduler manager that runs across the entire application lifecycle
const BackupSchedulerManager: React.FC = () => {
  const { showNotification } = useNotification();

  useEffect(() => {
    // Start global application-level scheduler on app startup
    const unsubscribe = backupService.startGlobalScheduler(result => {
      const successCount = result.destinations.filter(d => d.status === 'success').length;
      const failedDests = result.destinations
        .filter(d => d.status === 'failed')
        .map(d => d.path)
        .join(', ');

      if (result.overall_status === 'success') {
        const title =
          result.trigger_type === 'after_operation'
            ? 'نسخ احتياطي تلقائي بعد العملية'
            : 'نسخ احتياطي تلقائي مجدول';

        showNotification({
          type: 'info',
          title,
          message: `تم حفظ النسخة (${result.filename}) بنجاح في ${successCount} من الوجهات المحددة بحجم ${result.size_formatted}.`,
        });
      } else if (result.overall_status === 'partial') {
        showNotification({
          type: 'warning',
          title: 'تحذير: نجاح جزئي للنسخ الاحتياطي',
          message: `تم حفظ النسخة (${result.filename}) في ${successCount} وجهات، ولكن فشل الحفظ في: ${failedDests}`,
        });
      } else if (result.overall_status === 'failed') {
        showNotification({
          type: 'error',
          title: 'فشل النسخ الاحتياطي التلقائي',
          message: `تعذر حفظ النسخة الاحتياطية (${result.filename}) في جميع الوجهات المحددة. يرجى التحقق من الأقراص وصلاحيات الكتابة.`,
        });
      }
    });

    return () => unsubscribe();
  }, [showNotification]);

  return null;
};

export const App: React.FC = () => {
  return (
    <NotificationProvider>
      <BackupSchedulerManager />
      <NavigationProvider>
        <PageRefreshProvider>
          <AppShell />
        </PageRefreshProvider>
      </NavigationProvider>
    </NotificationProvider>
  );
};

export default App;
