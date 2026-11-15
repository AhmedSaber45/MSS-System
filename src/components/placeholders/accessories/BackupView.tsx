import React, { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Alert } from '@/components/common/Alert';
import { Table, Column } from '@/components/common/Table';
import { Badge } from '@/components/common/Badge';
import { Modal } from '@/components/common/Modal';
import { Spinner } from '@/components/common/Spinner';
import {
  HardDriveDownload,
  HardDriveUpload,
  Usb,
  Database,
  ShieldCheck,
  AlertTriangle,
  RotateCcw,
  RefreshCw,
  Clock,
  Settings,
  FolderDown,
} from 'lucide-react';
import { useNotification } from '@/context/NotificationContext';
import { backupService } from '@/services/backupService.ts';
import type { BackupItem, BackupConfig } from '@/types/backup.ts';

export const BackupView: React.FC = () => {
  const { showNotification } = useNotification();

  const [backups, setBackups] = useState<BackupItem[]>([]);
  const [config, setConfig] = useState<BackupConfig>(backupService.getBackupConfig());
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isCreatingBackup, setIsCreatingBackup] = useState<boolean>(false);

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
    // Run scheduled backup if due
    backupService.checkAndRunScheduledAutoBackup().then(ran => {
      if (ran) loadBackups();
    });
  }, [loadBackups]);

  // Create Manual Backup
  const handleCreateManualBackup = async () => {
    if (isCreatingBackup) return;
    setIsCreatingBackup(true);
    try {
      const newBackup = await backupService.createBackup('manual');
      showNotification({
        type: 'success',
        title: 'تم إنشاء النسخة الاحتياطية بنجاح',
        message: `تم حفظ النسخة (${newBackup.filename}) بحجم ${newBackup.size_formatted} واكتمال فحص السلامة.`,
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
        message: `تمت استعادة البيانات من ${selectedBackupForRestore.filename} بعد أخذ نسخة حماية للبيانات السابقة.`,
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
      await backupService.exportBackup(item.filename);
      showNotification({
        type: 'success',
        title: 'تم تصدير النسخة الاحتياطية',
        message: `تم تنزيل / تصدير ملف النسخة الاحتياطية ${item.filename} بنجاح.`,
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
      message: `النسخ التلقائي: ${tempConfig.autoBackupEnabled ? 'مفعل' : 'معطل'} | الحد الأقصى للاحتفاظ: ${tempConfig.retentionCount} نسخ`,
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
            : 'نسخة حماية سابقة'}
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
        title="النسخ الاحتياطي "
        subtitle=""
        actions={
          <div className="flex items-center gap-2.5">
            <Button
              variant="outline"
              size="md"
              onClick={loadBackups}
              isLoading={isLoading}
              leftIcon={<RefreshCw className="w-4 h-4 text-slate-600" />}
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
              إعدادات الجدولة
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={handleCreateManualBackup}
              disabled={isCreatingBackup}
              leftIcon={
                isCreatingBackup ? <Spinner size="sm" /> : <HardDriveDownload className="w-4.5 h-4.5" />}
              className="font-bold"
            >
              {isCreatingBackup ? 'جارٍ النسخ الاحتياطي...' : 'إنشاء نسخة احتياطية فورية'}
            </Button>
          </div>
        }
      />

      {/* Safety Notice */}


      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 bg-white border-slate-300 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600">النسخ الاحتياطي التلقائي</span>
            <Clock className="w-5 h-5 text-slate-500" />
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-lg font-bold text-slate-900">
              {config.autoBackupEnabled ? 'مفعل (يومياً)' : 'معطل'}
            </span>
            <Badge variant={config.autoBackupEnabled ? 'success' : 'default'} size="sm" className="font-semibold">
              {config.autoBackupEnabled ? 'نشط' : 'متوقف'}
            </Badge>
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
            <span className="text-lg font-bold text-slate-900 font-mono tabular-nums">{backups.length}</span>
            <span className="text-xs text-slate-500 font-medium">نسخة محفوظة</span>
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
          <h3 className="text-sm font-bold text-slate-900">أرشيف النسخ الاحتياطية المتوفرة</h3>
          <span className="text-sm font-semibold text-slate-500 tabular-nums">{backups.length} ملفات جاهزة للاسترجاع</span>
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

      {/* Safe Restore Confirmation Modal */}
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
                <span className="tabular-nums font-bold text-slate-800">{selectedBackupForRestore.size_formatted}</span>
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
                قبل الشروع في الاسترجاع لضمان عدم فقدان أي بيانات.
              </p>
            </div>
          </div>
        </Modal>
      )}

      {/* Backup Settings Modal */}
      {isSettingsModalOpen && (
        <Modal
          isOpen={isSettingsModalOpen}
          onClose={() => setIsSettingsModalOpen(false)}
          title="إعدادات النسخ الاحتياطي التلقائي والاحتفاظ"
          subtitle="تكوين سياسة الأرشفة الدورية ومعدل الاحتفاظ بالملفات"
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
                <p className="text-xs text-slate-500 mt-1">
                  إنشاء نسخة احتياطية بصورة دورية يومية تلقائياً
                </p>
              </div>
              <input
                type="checkbox"
                checked={tempConfig.autoBackupEnabled}
                onChange={e =>
                  setTempConfig({ ...tempConfig, autoBackupEnabled: e.target.checked })
                }
                className="w-4.5 h-4.5 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
              />
            </div>

            {/* Retention count */}
            <div className="space-y-2">
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
                className="w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2 text-sm font-semibold text-slate-800 focus:outline-none focus:border-slate-800"
              >
                <option value={5}>الاحتفاظ بآخر 5 نسخ</option>
                <option value={10}>الاحتفاظ بآخر 10 نسخ (موصى به)</option>
                <option value={20}>الاحتفاظ بآخر 20 نسخة</option>
                <option value={30}>الاحتفاظ بآخر 30 نسخة</option>
              </select>
              <p className="text-xs text-slate-500">
                يقوم النظام بحذف أقدم النسخ التلقائية الزائدة عن هذا الحد تلقائياً لتوفير المساحة.
              </p>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
