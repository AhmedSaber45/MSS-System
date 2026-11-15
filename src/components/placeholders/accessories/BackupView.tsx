import React, { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Table, Column } from '@/components/common/Table';
import { Badge } from '@/components/common/Badge';
import { Modal } from '@/components/common/Modal';
import { Spinner } from '@/components/common/Spinner';
import {
  HardDriveDownload,
  HardDriveUpload,
  Database,
  ShieldCheck,
  AlertTriangle,
  RotateCcw,
  RefreshCw,
  Clock,
  Settings,
  FolderDown,
  FolderOpen,
  Save,
  CheckCircle2,
} from 'lucide-react';
import { useNotification } from '@/context/NotificationContext';
import { usePageRefresh } from '@/context/PageRefreshContext';
import { backupService } from '@/services/backupService.ts';
import type { BackupItem, BackupConfig } from '@/types/backup.ts';

export const BackupView: React.FC = () => {
  const { showNotification } = useNotification();
  const { isRefreshing, triggerRefresh } = usePageRefresh();

  const [backups, setBackups] = useState<BackupItem[]>([]);
  const [config, setConfig] = useState<BackupConfig>(backupService.getBackupConfig());
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isCreatingBackup, setIsCreatingBackup] = useState<boolean>(false);
  const [backupProgressMsg, setBackupProgressMsg] = useState<string>('');

  // Restore Modal State
  const [selectedBackupForRestore, setSelectedBackupForRestore] = useState<BackupItem | null>(null);
  const [isRestoring, setIsRestoring] = useState<boolean>(false);

  // Settings Modal State
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);
  const [tempConfig, setTempConfig] = useState<BackupConfig>(config);

  const loadBackups = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await backupService.getBackups();
      setBackups(data);
    } catch (err) {
      console.warn('Failed to load backups:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBackups();

    // Check on startup
    backupService.checkAndRunScheduledAutoBackup().then(ran => {
      if (ran) loadBackups();
    });

    // Start background auto-backup timer while app is running
    const unsubscribe = backupService.startScheduler(newBackup => {
      showNotification({
        type: 'info',
        title: 'نسخ احتياطي تلقائي مجدول',
        message: `تم إنشاء نسخة احتياطية مجدولة بنجاح (${newBackup.filename}) بحجم ${newBackup.size_formatted}.`,
      });
      loadBackups();
    });

    return () => unsubscribe();
  }, [loadBackups, showNotification]);

  // Create Quick Manual Backup
  const handleCreateQuickBackup = async () => {
    if (isCreatingBackup) return;
    setIsCreatingBackup(true);
    setBackupProgressMsg('جارٍ نسخ وحفظ قاعدة البيانات المحلية...');
    try {
      const newBackup = await backupService.createBackup('manual', {
        destinationDir: config.destinationFolder,
      });
      showNotification({
        type: 'success',
        title: 'تم إنشاء النسخة الاحتياطية بنجاح',
        message: `تم حفظ النسخة (${newBackup.filename}) بحجم ${newBackup.size_formatted} واكتمال فحص السلامة.\nالمسار: ${newBackup.filepath}`,
      });
      await loadBackups();
    } catch (err: any) {
      showNotification({
        type: 'error',
        title: 'فشل إنشاء النسخة الاحتياطية',
        message: err.message || 'حدث خطأ أثناء نسخ قاعدة البيانات',
      });
    } finally {
      setIsCreatingBackup(false);
      setBackupProgressMsg('');
    }
  };

  // Create "Save As" Manual Backup with Native Save Dialog
  const handleCreateSaveAsBackup = async () => {
    if (isCreatingBackup) return;

    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const defaultFilename = `MSS-Backup-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
      now.getDate()
    )}-${pad(now.getHours())}-${pad(now.getMinutes())}.db`;

    try {
      // 1. Prompt native save file dialog
      const chosenPath = await backupService.selectSaveBackupPath(defaultFilename);
      if (!chosenPath) {
        // User cancelled the dialog safely - no action required
        return;
      }

      setIsCreatingBackup(true);
      setBackupProgressMsg(`جارٍ حفظ النسخة الاحتياطية إلى المسار المختار...`);

      // Extract directory and filename
      const lastSlash = Math.max(chosenPath.lastIndexOf('\\'), chosenPath.lastIndexOf('/'));
      const customDir = lastSlash > 0 ? chosenPath.substring(0, lastSlash) : undefined;
      const customFilename =
        lastSlash > 0 ? chosenPath.substring(lastSlash + 1) : chosenPath;

      const newBackup = await backupService.createBackup('manual', {
        destinationDir: customDir,
        customFilename,
      });

      showNotification({
        type: 'success',
        title: 'تم حفظ النسخة الاحتياطية بنجاح',
        message: `تم حفظ النسخة (${newBackup.filename}) بحجم ${newBackup.size_formatted}.\nالمسار المختار: ${newBackup.filepath}`,
      });
      await loadBackups();
    } catch (err: any) {
      showNotification({
        type: 'error',
        title: 'فشل حفظ النسخة الاحتياطية',
        message: err.message || 'تعذر حفظ ملف النسخة في المسار المحدد',
      });
    } finally {
      setIsCreatingBackup(false);
      setBackupProgressMsg('');
    }
  };

  // Choose Destination Folder for Auto-Backups
  const handleSelectDestinationFolder = async () => {
    try {
      const folder = await backupService.selectBackupFolder();
      if (folder) {
        setTempConfig(prev => ({ ...prev, destinationFolder: folder }));
      }
    } catch (err) {
      console.warn('Failed to select destination folder:', err);
    }
  };

  // Confirm and Execute Restore
  const handleExecuteRestore = async () => {
    if (!selectedBackupForRestore || isRestoring) return;
    setIsRestoring(true);
    try {
      await backupService.restoreBackup(selectedBackupForRestore.filename);
      showNotification({
        type: 'success',
        title: 'تم استرجاع قاعدة البيانات بنجاح',
        message: `تمت استعادة البيانات من ${selectedBackupForRestore.filename} بعد إنشاء نسخة حماية للبيانات السابقة.`,
      });
      setSelectedBackupForRestore(null);
      await loadBackups();
    } catch (err: any) {
      showNotification({
        type: 'error',
        title: 'فشل استرجاع قاعدة البيانات',
        message: err.message || 'الملف غير صالح أو فشل استرجاعه',
      });
    } finally {
      setIsRestoring(false);
    }
  };

  // Export Backup File to external drive or download
  const handleExportBackup = async (item: BackupItem) => {
    try {
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const defaultExportName = `Export-${item.filename}`;
      const chosenExportPath = await backupService.selectSaveBackupPath(defaultExportName);

      await backupService.exportBackup(item.filename, chosenExportPath || undefined);
      showNotification({
        type: 'success',
        title: 'تم تصدير النسخة الاحتياطية',
        message: `تم تصدير ملف النسخة الاحتياطية ${item.filename} بنجاح.`,
      });
    } catch (err: any) {
      showNotification({
        type: 'error',
        title: 'فشل تصدير النسخة',
        message: err.message || 'تعذر تصدير الملف إلى المسار المطلوب',
      });
    }
  };

  // Save Settings
  const handleSaveSettings = () => {
    backupService.saveBackupConfig(tempConfig);
    setConfig(tempConfig);
    setIsSettingsModalOpen(false);
    showNotification({
      type: 'success',
      title: 'تم حفظ إعدادات النسخ الاحتياطي',
      message: `النسخ التلقائي: ${
        tempConfig.autoBackupEnabled ? 'مفعل' : 'معطل'
      } | موعد النسخ القادم: ${backupService.calculateNextBackupDescription(tempConfig)}`,
    });
  };

  const columns: Column<BackupItem>[] = [
    {
      key: 'filename',
      header: 'اسم ملف النسخة',
      render: (item: BackupItem) => (
        <div>
          <span className="font-mono font-bold text-slate-900 text-sm block truncate max-w-md">
            {item.filename}
          </span>
          <span className="text-xs text-slate-500 font-mono font-medium block truncate max-w-md mt-0.5">
            {item.filepath}
          </span>
        </div>
      ),
    },
    {
      key: 'date',
      header: 'تاريخ الإنشاء',
      render: (item: BackupItem) => (
        <span className="font-mono text-slate-700 text-sm font-medium tabular-nums">{item.date}</span>
      ),
    },
    {
      key: 'size_formatted',
      header: 'الحجم',
      render: (item: BackupItem) => (
        <span className="font-mono text-slate-800 text-sm font-semibold tabular-nums">
          {item.size_formatted}
        </span>
      ),
    },
    {
      key: 'backup_type',
      header: 'النوع',
      render: (item: BackupItem) => (
        <Badge
          variant={
            item.backup_type === 'manual'
              ? 'primary'
              : item.backup_type === 'auto'
              ? 'success'
              : 'warning'
          }
          size="sm"
          className="font-semibold"
        >
          {item.backup_type === 'manual'
            ? 'يدوي'
            : item.backup_type === 'auto'
            ? 'تلقائي مجدول'
            : 'حماية سابقة'}
        </Badge>
      ),
    },
    {
      key: 'status',
      header: 'حالة الفحص',
      render: (item: BackupItem) => (
        <span className="inline-flex items-center gap-1.5 text-emerald-800 text-xs font-bold">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>{item.status}</span>
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'إجراءات',
      align: 'center',
      render: (item: BackupItem) => (
        <div className="flex items-center justify-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setSelectedBackupForRestore(item)}
            leftIcon={<RotateCcw className="w-4 h-4" />}
            className="h-8 text-xs font-bold px-2.5 border-slate-300 text-slate-800"
          >
            استرجاع
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => handleExportBackup(item)}
            leftIcon={<FolderDown className="w-4 h-4" />}
            className="h-8 text-xs font-bold px-2.5"
          >
            تصدير
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="إدارة النسخ الاحتياطي والأرشفة"
        subtitle="حماية وأرشفة بيانات قاعدة بيانات الإكسسوارات المحلية تلقائياً ويدوياً"
        actions={
          <div className="flex items-center gap-2.5 flex-wrap">
            <Button
              variant="outline"
              size="md"
              onClick={() => triggerRefresh(loadBackups, 'جارٍ فحص وتحديث سجل النسخ الاحتياطية...')}
              disabled={isRefreshing || isLoading}
              leftIcon={<RefreshCw className={`w-4 h-4 text-slate-600 ${isRefreshing ? 'animate-spin' : ''}`} />}
              className="border-slate-300 font-semibold"
            >
              Refresh
            </Button>
            <Button
              variant="outline"
              size="md"
              onClick={() => {
                setTempConfig(config);
                setIsSettingsModalOpen(true);
              }}
              leftIcon={<Settings className="w-4.5 h-4.5 text-slate-600" />}
              className="border-slate-300 font-semibold"
            >
              إعدادات الجدولة والتلقائي
            </Button>
            <Button
              variant="outline"
              size="md"
              onClick={handleCreateSaveAsBackup}
              disabled={isCreatingBackup}
              leftIcon={<Save className="w-4.5 h-4.5 text-slate-700" />}
              className="border-slate-300 font-bold"
            >
              حفظ باسم...
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={handleCreateQuickBackup}
              disabled={isCreatingBackup}
              leftIcon={
                isCreatingBackup ? (
                  <Spinner size="sm" />
                ) : (
                  <HardDriveDownload className="w-4.5 h-4.5" />
                )
              }
              className="font-bold"
            >
              {isCreatingBackup ? 'جارٍ النسخ...' : 'نسخ احتياطي سريع'}
            </Button>
          </div>
        }
      />

      {/* Progress alert if in progress */}
      {isCreatingBackup && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center gap-3 text-blue-900 text-sm animate-pulse">
          <Spinner size="sm" />
          <span className="font-semibold">{backupProgressMsg || 'جارٍ معالجة النسخة الاحتياطية بأمان...'}</span>
        </div>
      )}

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 bg-white border-slate-300 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600">النسخ الاحتياطي التلقائي</span>
            <Clock className="w-5 h-5 text-slate-500" />
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-lg font-bold text-slate-900">
              {config.autoBackupEnabled ? 'مفعل ونشط' : 'معطل'}
            </span>
            <Badge
              variant={config.autoBackupEnabled ? 'success' : 'default'}
              size="sm"
              className="font-semibold"
            >
              {config.autoBackupEnabled ? 'نشط' : 'متوقف'}
            </Badge>
          </div>
          <p className="text-xs text-slate-600 mt-1.5 font-medium">
            النسخة القادمة: <strong className="text-slate-900">{backupService.calculateNextBackupDescription(config)}</strong>
          </p>
        </Card>

        <Card className="p-4 bg-white border-slate-300 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600">مجلد الحفظ الافتراضي</span>
            <FolderOpen className="w-5 h-5 text-slate-500" />
          </div>
          <div className="mt-2.5">
            <span className="text-sm font-mono font-bold text-slate-900 block truncate" title={config.destinationFolder || 'المسار الافتراضي للبرنامج'}>
              {config.destinationFolder || 'المسار الافتراضي (AppData\\ShopManagementSystem\\backups)'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            الاحتفاظ بآخر {config.retentionCount} نسخ تلقائية
          </p>
        </Card>

        <Card className="p-4 bg-white border-slate-300 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600">إجمالي النسخ المتاحة</span>
            <Database className="w-5 h-5 text-slate-500" />
          </div>
          <div className="mt-2.5 flex items-baseline gap-1.5">
            <span className="text-lg font-bold text-slate-900 font-mono tabular-nums">
              {backups.length}
            </span>
            <span className="text-xs text-slate-500 font-medium">نسخة محفوظة ومتحقق منها</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            آخر نسخة:{' '}
            {backups.length > 0 ? backups[0].date.substring(0, 16) : 'لا توجد نسخ سابقة'}
          </p>
        </Card>
      </div>

      {/* Backups Table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">سجل أرشيف النسخ الاحتياطية</h3>
          <span className="text-sm font-semibold text-slate-500 tabular-nums">
            {backups.length} ملفات جاهزة للاسترجاع
          </span>
        </div>

        {isLoading ? (
          <div className="p-16 flex flex-col items-center justify-center bg-white rounded-xl border border-slate-300">
            <Spinner size="lg" />
            <p className="text-sm font-medium text-slate-600 mt-3">جارٍ فحص النسخ الاحتياطية المتاحة...</p>
          </div>
        ) : backups.length === 0 ? (
          <div className="p-16 text-center bg-white rounded-xl border border-slate-300 space-y-2.5">
            <HardDriveUpload className="w-10 h-10 text-slate-400 mx-auto" />
            <p className="text-sm font-bold text-slate-800">لا توجد نسخ احتياطية مسجلة</p>
            <p className="text-xs text-slate-500">
              قم بإنشاء نسخة احتياطية فورية بالضغط على الزر بالأعلى
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-300 overflow-hidden shadow-2xs">
            <Table
              columns={columns}
              data={backups}
              keyExtractor={(item: BackupItem) => item.id}
            />
          </div>
        )}
      </div>

      {/* Restore Confirmation Modal */}
      {selectedBackupForRestore && (
        <Modal
          isOpen={!!selectedBackupForRestore}
          onClose={() => !isRestoring && setSelectedBackupForRestore(null)}
          title="تأكيد استرجاع قاعدة البيانات"
          subtitle="عملية استرجاع تستبدل بيانات قسم الإكسسوارات الحالية"
          size="md"
          footer={
            <div className="flex items-center justify-between w-full">
              <Button
                variant="outline"
                size="md"
                onClick={() => setSelectedBackupForRestore(null)}
                disabled={isRestoring}
                className="border-slate-300 font-semibold"
              >
                إلغاء التراجع
              </Button>
              <Button
                variant="danger"
                size="md"
                onClick={handleExecuteRestore}
                disabled={isRestoring}
                leftIcon={
                  isRestoring ? <Spinner size="sm" /> : <RotateCcw className="w-4 h-4" />
                }
                className="font-bold"
              >
                {isRestoring ? 'جارٍ الاسترجاع الآمن...' : 'نعم، استرجع هذه النسخة'}
              </Button>
            </div>
          }
        >
          <div className="space-y-4 text-sm">
            <div className="p-3.5 bg-amber-50/90 border border-amber-300 rounded-xl space-y-2 text-amber-900">
              <div className="flex items-center gap-2 font-bold text-sm text-amber-900">
                <AlertTriangle className="w-4.5 h-4.5 shrink-0 text-amber-600" />
                <span>تنبيه هام قبل الاسترجاع</span>
              </div>
              <p className="text-xs leading-relaxed">
                استرجاع هذه النسخة سيقوم <strong>باستبدال كامل بيانات قاعدة البيانات الحالية</strong>{' '}
                بالبيانات المحفوظة في هذا الملف بتاريخ{' '}
                <span className="font-mono font-bold text-slate-900">
                  {selectedBackupForRestore.date}
                </span>
                .
              </p>
            </div>

            <div className="bg-slate-50/90 p-3.5 rounded-xl border border-slate-300 space-y-2 font-mono text-xs">
              <div>
                <span className="text-slate-500 font-sans font-semibold">ملف النسخة:</span>{' '}
                <span className="font-bold text-slate-900">{selectedBackupForRestore.filename}</span>
              </div>
              <div>
                <span className="text-slate-500 font-sans font-semibold">حجم النسخة:</span>{' '}
                <span className="tabular-nums font-bold text-slate-800">
                  {selectedBackupForRestore.size_formatted}
                </span>
              </div>
              <div>
                <span className="text-slate-500 font-sans font-semibold">فحص السلامة:</span>{' '}
                <span className="text-emerald-800 font-bold font-sans">
                  {selectedBackupForRestore.status}
                </span>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50/90 border border-slate-300 rounded-xl text-slate-700 text-xs space-y-1.5">
              <p className="font-bold text-slate-900 flex items-center gap-2 text-sm">
                <ShieldCheck className="w-4.5 h-4.5 text-emerald-600" />
                <span>إجراء الحماية التلقائي:</span>
              </p>
              <p className="text-slate-600 leading-relaxed">
                يقوم النظام تلقائياً بإنشاء نسخة حماية كاملة من بياناتك الحالية (Safeguard Backup)
                قبل الشروع في الاسترجاع لضمان عدم فقدان أي بيانات تحت أي ظرف.
              </p>
            </div>
          </div>
        </Modal>
      )}

      {/* Advanced Backup Settings Modal */}
      {isSettingsModalOpen && (
        <Modal
          isOpen={isSettingsModalOpen}
          onClose={() => setIsSettingsModalOpen(false)}
          title="إعدادات النسخ الاحتياطي التلقائي والجدولة"
          subtitle="تكوين المواعيد التلقائية، مجلد الوجهة، وسياسة الاحتفاظ"
          size="md"
          footer={
            <div className="flex items-center justify-between w-full">
              <Button
                variant="outline"
                size="md"
                onClick={() => setIsSettingsModalOpen(false)}
                className="border-slate-300 font-semibold"
              >
                إلغاء
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={handleSaveSettings}
                className="font-bold"
              >
                حفظ الإعدادات
              </Button>
            </div>
          }
        >
          <div className="space-y-4 text-sm">
            {/* Enable toggle */}
            <div className="flex items-center justify-between p-3.5 bg-slate-50/90 rounded-xl border border-slate-300">
              <div>
                <p className="font-bold text-slate-900">تفعيل النسخ الاحتياطي التلقائي</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  إنشاء نسخة احتياطية بشكل دوري في الخلفية طالما التطبيق يعمل
                </p>
              </div>
              <input
                type="checkbox"
                checked={tempConfig.autoBackupEnabled}
                onChange={e =>
                  setTempConfig({ ...tempConfig, autoBackupEnabled: e.target.checked })
                }
                className="w-5 h-5 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
              />
            </div>

            {/* Schedule Mode Selector */}
            <div className="space-y-2 p-3.5 bg-slate-50/90 rounded-xl border border-slate-300">
              <label className="font-bold text-slate-800 block text-xs">
                نوع ونظام الجدولة التلقائية:
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTempConfig({ ...tempConfig, scheduleMode: 'time' })}
                  className={`py-2 px-3 rounded-lg border text-xs font-bold text-center transition-all ${
                    tempConfig.scheduleMode === 'time'
                      ? 'border-blue-600 bg-blue-50 text-blue-900 shadow-xs'
                      : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  توقيت يومي محدد
                </button>
                <button
                  type="button"
                  onClick={() => setTempConfig({ ...tempConfig, scheduleMode: 'interval' })}
                  className={`py-2 px-3 rounded-lg border text-xs font-bold text-center transition-all ${
                    tempConfig.scheduleMode === 'interval'
                      ? 'border-blue-600 bg-blue-50 text-blue-900 shadow-xs'
                      : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  فترات زمنية متكررة
                </button>
              </div>

              {/* Conditional options based on scheduleMode */}
              {tempConfig.scheduleMode === 'time' ? (
                <div className="mt-2.5 pt-2 border-t border-slate-200">
                  <label className="font-semibold text-slate-700 block text-xs mb-1">
                    الوقت المحدد يومياً:
                  </label>
                  <input
                    type="time"
                    value={tempConfig.specificTime || '22:00'}
                    onChange={e =>
                      setTempConfig({ ...tempConfig, specificTime: e.target.value })
                    }
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-sm font-mono font-bold text-slate-800 focus:outline-none focus:border-slate-800"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    سيتم أخذ نسخة احتياطية يومياً في هذا التوقيت (أو عند فتح التطبيق إذا كان مغلقاً في ذلك الوقت).
                  </p>
                </div>
              ) : (
                <div className="mt-2.5 pt-2 border-t border-slate-200">
                  <label className="font-semibold text-slate-700 block text-xs mb-1">
                    التكرار كل:
                  </label>
                  <select
                    value={tempConfig.intervalHours || 6}
                    onChange={e =>
                      setTempConfig({
                        ...tempConfig,
                        intervalHours: parseInt(e.target.value, 10) || 6,
                      })
                    }
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-800 focus:outline-none focus:border-slate-800"
                  >
                    <option value={1}>كل ساعة واحدة</option>
                    <option value={2}>كل ساعتين (2 ساعات)</option>
                    <option value={3}>كل 3 ساعات</option>
                    <option value={6}>كل 6 ساعات (موصى به أثناء العمل)</option>
                    <option value={12}>كل 12 ساعة</option>
                    <option value={24}>كل 24 ساعة</option>
                  </select>
                </div>
              )}

              {/* Next Backup Live Preview */}
              <div className="mt-2 p-2 bg-white rounded-lg border border-slate-200 text-xs flex items-center justify-between">
                <span className="text-slate-500 font-medium">النسخة التلقائية القادمة:</span>
                <span className="font-bold text-blue-900">
                  {backupService.calculateNextBackupDescription(tempConfig)}
                </span>
              </div>
            </div>

            {/* Destination Folder */}
            <div className="space-y-1.5">
              <label className="font-bold text-slate-700 block text-xs">
                مجلد وجهة النسخ الاحتياطي:
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={tempConfig.destinationFolder || 'المسار الافتراضي للبرنامج'}
                  className="flex-1 bg-slate-100 border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-800 truncate"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleSelectDestinationFolder}
                  leftIcon={<FolderOpen className="w-4 h-4" />}
                  className="shrink-0 text-xs font-semibold"
                >
                  استعراض...
                </Button>
                {tempConfig.destinationFolder && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setTempConfig({ ...tempConfig, destinationFolder: undefined })}
                    className="shrink-0 text-xs text-rose-600 hover:bg-rose-50"
                  >
                    إعادة للافتراضي
                  </Button>
                )}
              </div>
              <p className="text-[11px] text-slate-500">
                يمكنك تحديد قرص صلب خارجي أو مجلد سحابي لمزيد من الأمان.
              </p>
            </div>

            {/* Retention count */}
            <div className="space-y-1.5">
              <label className="font-bold text-slate-700 block text-xs">
                الحد الأقصى لعدد النسخ المحفوظة:
              </label>
              <select
                value={tempConfig.retentionCount}
                onChange={e =>
                  setTempConfig({
                    ...tempConfig,
                    retentionCount: parseInt(e.target.value, 10) || 10,
                  })
                }
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-semibold text-slate-800 focus:outline-none focus:border-slate-800"
              >
                <option value={5}>الاحتفاظ بآخر 5 نسخ</option>
                <option value={10}>الاحتفاظ بآخر 10 نسخ (موصى به)</option>
                <option value={20}>الاحتفاظ بآخر 20 نسخة</option>
                <option value={30}>الاحتفاظ بآخر 30 نسخة</option>
              </select>
              <p className="text-[11px] text-slate-500">
                يقوم النظام بحذف أقدم النسخ التلقائية الزائدة عن هذا الحد تلقائياً لتوفير المساحة.
              </p>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
