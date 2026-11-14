import React, { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/common/Card';
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
  CheckCircle,
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
      header: 'اسم ملف النسخة الاحتياطية',
      render: (item: BackupItem) => (
        <div>
          <span className="font-mono font-bold text-slate-800 text-xs block truncate max-w-md">
            {item.filename}
          </span>
          <span className="text-[10px] text-slate-400 font-mono block truncate max-w-md">
            {item.filepath}
          </span>
        </div>
      ),
    },
    {
      key: 'date',
      header: 'تاريخ ووقت الإنشاء',
      render: (item: BackupItem) => (
        <span className="font-mono text-slate-600 text-xs">{item.date}</span>
      ),
    },
    {
      key: 'size_formatted',
      header: 'حجم الملف',
      render: (item: BackupItem) => (
        <span className="font-mono text-slate-700 text-xs font-semibold">
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
        >
          {item.backup_type === 'manual'
            ? 'يدوي'
            : item.backup_type === 'auto'
            ? 'تلقائي مجدول'
            : 'نسخة حماية قبل استرجاع'}
        </Badge>
      ),
    },
    {
      key: 'status',
      header: 'حالة الفحص',
      render: (item: BackupItem) => (
        <span className="inline-flex items-center gap-1 text-emerald-700 text-xs font-bold">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>{item.status}</span>
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'إجراءات',
      align: 'center',
      render: (item: BackupItem) => (
        <div className="flex items-center justify-center gap-1.5">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setSelectedBackupForRestore(item)}
            leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
          >
            استرجاع
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => handleExportBackup(item)}
            leftIcon={<FolderDown className="w-3.5 h-3.5" />}
          >
            تصدير
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="النسخ الاحتياطي والاسترجاع (Backup & Restore)"
        subtitle="حماية وأرشفة قاعدة بيانات قسم الإكسسوارات مع ميزات النسخ التلقائي المجدول والاسترجاع الآمن"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setTempConfig(config);
                setIsSettingsModalOpen(true);
              }}
              leftIcon={<Settings className="w-4 h-4" />}
            >
              إعدادات الجدولة
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleCreateManualBackup}
              disabled={isCreatingBackup}
              leftIcon={
                isCreatingBackup ? <Spinner size="sm" /> : <HardDriveDownload className="w-4 h-4" />
              }
              className="font-bold shadow-sm"
            >
              {isCreatingBackup ? 'جارٍ النسخ الاحتياطي...' : 'إنشاء نسخة احتياطية فورية'}
            </Button>
          </div>
        }
      />

      {/* Safety Notice */}
      <Alert
        type="info"
        title="أمان قاعدة البيانات المحلية (Local Data Protection - Rule 13)"
        message="يتم حفظ النسخ الاحتياطية خارج مجلد تثبيت البرنامج لضمان عدم تأثر البيانات بأي تحديثات. يُنصح دائماً بتصدير نسخة دورياً إلى وحدة تخزين خارجية (Flash Drive / USB) لحماية بيانات محلك من أعطال الجهاز."
      />

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 bg-white border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">النسخ الاحتياطي التلقائي</span>
            <Clock className="w-4 h-4 text-blue-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-lg font-black text-slate-900">
              {config.autoBackupEnabled ? 'مفعل (يومياً)' : 'معطل'}
            </span>
            <Badge variant={config.autoBackupEnabled ? 'success' : 'default'} size="sm">
              {config.autoBackupEnabled ? 'نشط' : 'متوقف'}
            </Badge>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            الاحتفاظ بآخر {config.retentionCount} نسخ تلقائية
          </p>
        </Card>

        <Card className="p-4 bg-white border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">إجمالي النسخ المتاحة</span>
            <Database className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2">
            <span className="text-lg font-black text-slate-900 font-mono">{backups.length}</span>
            <span className="text-xs text-slate-500 mr-1.5">نسخة محفوظة</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            آخر نسخة:{' '}
            {backups.length > 0 ? backups[0].date.substring(0, 16) : 'لا توجد نسخ سابقة'}
          </p>
        </Card>

        <Card className="p-4 bg-white border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">تصدير لوحدة خارجية</span>
            <Usb className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="mt-2">
            <span className="text-xs font-bold text-slate-800">تصدير إلى Flash Drive</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            انقر على زر "تصدير" بجانب أي نسخة لتنزيلها أو نسخها
          </p>
        </Card>
      </div>

      {/* Backups Table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">أرشيف النسخ الاحتياطية المتوفرة</h3>
          <span className="text-xs text-slate-500">{backups.length} ملفات جاهزة للاسترجاع</span>
        </div>

        {isLoading ? (
          <div className="p-16 flex flex-col items-center justify-center bg-white rounded-xl border border-slate-200">
            <Spinner size="lg" />
            <p className="text-xs text-slate-500 mt-3">جارٍ فحص النسخ الاحتياطية المتاحة...</p>
          </div>
        ) : backups.length === 0 ? (
          <div className="p-16 text-center bg-white rounded-xl border border-slate-200 space-y-3">
            <HardDriveUpload className="w-12 h-12 text-slate-300 mx-auto" />
            <p className="text-sm font-bold text-slate-800">لا توجد نسخ احتياطية مسجلة</p>
            <p className="text-xs text-slate-400">
              قم بإنشاء نسخة احتياطية فورية بالضغط على الزر بالأعلى
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
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
          subtitle="عملية استرجاع حساسة تستبدل بيانات المحل الحالية"
          size="md"
          footer={
            <div className="flex items-center justify-between w-full">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedBackupForRestore(null)}
                disabled={isRestoring}
              >
                إلغاء التراجع
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleExecuteRestore}
                disabled={isRestoring}
                className="bg-amber-600 hover:bg-amber-700 border-amber-700 font-bold"
                leftIcon={
                  isRestoring ? <Spinner size="sm" /> : <RotateCcw className="w-4 h-4" />
                }
              >
                {isRestoring ? 'جارٍ الاسترجاع الآمن...' : 'نعم، استرجع هذه النسخة'}
              </Button>
            </div>
          }
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-2 text-amber-900">
              <div className="flex items-center gap-2 font-bold text-sm text-amber-800">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <span>تحذير هام قبل الاسترجاع!</span>
              </div>
              <p className="leading-relaxed">
                استرجاع هذه النسخة سيقوم <strong>باستبدال كامل بيانات قاعدة البيانات الحالية</strong>{' '}
                بالبيانات المحفوظة في هذا الملف بتاريخ{' '}
                <span className="font-mono font-bold text-slate-900">
                  {selectedBackupForRestore.date}
                </span>
                .
              </p>
            </div>

            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1.5 font-mono text-[11px]">
              <div>
                <span className="text-slate-500 font-sans">ملف النسخة:</span>{' '}
                <span className="font-bold text-slate-800">{selectedBackupForRestore.filename}</span>
              </div>
              <div>
                <span className="text-slate-500 font-sans">حجم النسخة:</span>{' '}
                <span>{selectedBackupForRestore.size_formatted}</span>
              </div>
              <div>
                <span className="text-slate-500 font-sans">فحص السلامة:</span>{' '}
                <span className="text-emerald-700 font-bold font-sans">
                  {selectedBackupForRestore.status}
                </span>
              </div>
            </div>

            <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-lg text-blue-900 text-[11px] space-y-1">
              <p className="font-bold flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-blue-700" />
                <span>إجراء الحماية التلقائي:</span>
              </p>
              <p>
                سيقوم النظام تلقائياً بإنشاء نسخة حماية كاملة من بياناتك الحالية (Safeguard Backup)
                قبل الشروع في الاسترجاع، لضمان عدم ضياع أي بيانات تحت أي ظرف.
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
                size="sm"
                onClick={() => setIsSettingsModalOpen(false)}
              >
                إلغاء
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSaveSettings}
                className="font-bold"
              >
                حفظ الإعدادات
              </Button>
            </div>
          }
        >
          <div className="space-y-4 text-xs">
            {/* Enable toggle */}
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div>
                <p className="font-bold text-slate-900">تفعيل النسخ الاحتياطي التلقائي</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  إنشاء نسخة احتياطية بصورة دورية يومية تلقائياً
                </p>
              </div>
              <input
                type="checkbox"
                checked={tempConfig.autoBackupEnabled}
                onChange={e =>
                  setTempConfig({ ...tempConfig, autoBackupEnabled: e.target.checked })
                }
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
              />
            </div>

            {/* Retention count */}
            <div className="space-y-1.5">
              <label className="font-bold text-slate-700 block">
                الحد الأقصى لعدد النسخ المحفوظة (Retention Limit):
              </label>
              <select
                value={tempConfig.retentionCount}
                onChange={e =>
                  setTempConfig({
                    ...tempConfig,
                    retentionCount: parseInt(e.target.value, 10) || 10,
                  })
                }
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 font-bold text-slate-800 focus:outline-none focus:border-blue-500"
              >
                <option value={5}>الاحتفاظ بآخر 5 نسخ</option>
                <option value={10}>الاحتفاظ بآخر 10 نسخ (موصى به)</option>
                <option value={20}>الاحتفاظ بآخر 20 نسخة</option>
                <option value={30}>الاحتفاظ بآخر 30 نسخة</option>
              </select>
              <p className="text-[10px] text-slate-400">
                يقوم النظام بحذف أقدم النسخ التلقائية الزائدة عن هذا الحد تلقائياً لتوفير المساحة.
              </p>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
