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
  Trash2,
  Plus,
  Zap,
  Info,
  XCircle,
  ExternalLink,
  Power,
} from 'lucide-react';
import { isTauri } from '@tauri-apps/api/core';
import { autostartService } from '@/services/autostartService';
import { useNotification } from '@/context/NotificationContext';
import { usePageRefresh } from '@/context/PageRefreshContext';
import { backupService } from '@/services/backupService.ts';
import type {
  BackupItem,
  BackupConfig,
  BackupDestinationResult,
} from '@/types/backup.ts';

const INTERVAL_OPTIONS = [
  { value: 1, label: 'كل 1 دقيقة ' },
  { value: 5, label: 'كل 5 دقائق' },
  { value: 10, label: 'كل 10 دقائق' },
  { value: 15, label: 'كل 15 دقيقة' },
  { value: 30, label: 'كل 30 دقيقة' },
  { value: 60, label: 'كل 1 ساعة' },
  { value: 120, label: 'كل ساعتين ' },
  { value: 180, label: 'كل 3 ساعات' },
  { value: 360, label: 'كل 6 ساعات ' },
  { value: 720, label: 'كل 12 ساعة' },
  { value: 1440, label: 'كل 24 ساعة ' },
];

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

  // Destinations Details Modal State
  const [selectedBackupDetails, setSelectedBackupDetails] = useState<BackupItem | null>(null);

  // Settings Modal State
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);
  const [tempConfig, setTempConfig] = useState<BackupConfig>(config);
  const [newDestinationInput, setNewDestinationInput] = useState<string>('');
  const [isAddingDestination, setIsAddingDestination] = useState<boolean>(false);
  const [destinationError, setDestinationError] = useState<string>('');
  const [isStartupEnabled, setIsStartupEnabled] = useState<boolean>(false);

  useEffect(() => {
    autostartService.getStartupStatus().then(res => setIsStartupEnabled(res.enabled));
  }, []);

  const loadBackups = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await backupService.getBackups();
      setBackups(data);
    } catch (err: any) {
      console.warn('Failed to load backups:', err);
      showNotification({
        type: 'error',
        title: 'خطأ في جلب النسخ الاحتياطية',
        message: err?.message || 'تعذر تحميل سجل النسخ الاحتياطية',
      });
    } finally {
      setIsLoading(false);
    }
  }, [showNotification]);

  useEffect(() => {
    loadBackups();

    // Subscribe to real-time configuration changes
    const unsubscribeConfig = backupService.onConfigChange(newConfig => {
      setConfig(newConfig);
    });

    // Listen to scheduler notifications and refresh list
    const unsubscribeScheduler = backupService.startScheduler(() => {
      loadBackups();
    });

    return () => {
      unsubscribeConfig();
      unsubscribeScheduler();
    };
  }, [loadBackups]);

  // Create Quick Manual Backup to all configured destinations
  const handleCreateQuickBackup = async () => {
    if (isCreatingBackup) return;
    setIsCreatingBackup(true);
    setBackupProgressMsg('جارٍ نسخ وحفظ قاعدة البيانات في جميع الوجهات المحددة...');
    try {
      const result = await backupService.executeMultiDestinationBackup('manual');
      const successCount = result.destinations.filter(d => d.status === 'success').length;
      const failedCount = result.destinations.filter(d => d.status === 'failed').length;

      if (result.overall_status === 'success') {
        showNotification({
          type: 'success',
          title: 'تم إنشاء النسخة الاحتياطية بنجاح',
          message: `تم حفظ النسخة (${result.filename}) بحجم ${result.size_formatted} واكتمال فحص السلامة في ${successCount} وجهات.`,
        });
      } else if (result.overall_status === 'partial') {
        const failedNames = result.destinations
          .filter(d => d.status === 'failed')
          .map(d => d.path)
          .join(', ');
        showNotification({
          type: 'warning',
          title: 'نجاح جزئي للنسخ الاحتياطي',
          message: `تم حفظ النسخة في ${successCount} وجهة، ولكن تعذر الحفظ في: ${failedNames}`,
        });
      } else {
        showNotification({
          type: 'error',
          title: 'فشل النسخ الاحتياطي',
          message: 'تعذر حفظ النسخة الاحتياطية في أي من الوجهات المحددة. يرجى مراجعة المسارات.',
        });
      }

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

  // Create "Save As" Manual Backup with Native Windows Save Dialog
  const handleCreateSaveAsBackup = async () => {
    if (isCreatingBackup) return;

    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const defaultFilename = `MSS_Backup_${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
      now.getDate()
    )}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}.db`;

    try {
      // 1. Prompt native save file dialog
      const chosenPath = await backupService.selectSaveBackupPath(defaultFilename);
      if (!chosenPath) {
        // User cancelled dialog safely
        return;
      }

      setIsCreatingBackup(true);
      setBackupProgressMsg(`جارٍ حفظ النسخة الاحتياطية إلى المسار المختار...`);

      // Extract directory and filename
      const lastSlash = Math.max(chosenPath.lastIndexOf('\\'), chosenPath.lastIndexOf('/'));
      const customDir = lastSlash > 0 ? chosenPath.substring(0, lastSlash) : undefined;
      const customFilename =
        lastSlash > 0 ? chosenPath.substring(lastSlash + 1) : chosenPath;

      const result = await backupService.executeMultiDestinationBackup('manual', {
        destinations: customDir ? [customDir] : undefined,
        customFilename,
      });

      showNotification({
        type: 'success',
        title: 'تم حفظ النسخة الاحتياطية بنجاح',
        message: `تم حفظ النسخة (${result.filename}) بحجم ${result.size_formatted}.\nالمسار المختار: ${chosenPath}`,
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

  // Open Native Windows Folder Picker for adding destination
  const handleBrowseForDestination = async () => {
    setDestinationError('');
    try {
      const folder = await backupService.selectBackupFolder();
      if (folder) {
        setNewDestinationInput(folder);
      }
    } catch (err: any) {
      console.warn('Folder picker cancelled or failed:', err);
    }
  };

  // Add Destination with validation and duplicate prevention
  const handleAddDestination = async () => {
    setDestinationError('');
    const pathToAdd = newDestinationInput.trim();
    if (!pathToAdd) {
      setDestinationError('يرجى تحديد مسار المجلد أولاً أو الضغط على Browse');
      return;
    }

    // Check duplicate
    if (tempConfig.destinations.some(d => d.toLowerCase() === pathToAdd.toLowerCase())) {
      setDestinationError('هذا المسار مضاف مسبقاً في قائمة الوجهات');
      return;
    }

    setIsAddingDestination(true);
    try {
      const validation = await backupService.validateDestination(pathToAdd);
      if (!validation.valid) {
        setDestinationError(validation.error || 'المسار غير صالح أو غير متاح للكتابة');
        return;
      }

      setTempConfig(prev => ({
        ...prev,
        destinations: [...prev.destinations, pathToAdd],
      }));
      setNewDestinationInput('');
    } catch (err: any) {
      setDestinationError(err?.message || 'فشل التحقق من المسار');
    } finally {
      setIsAddingDestination(false);
    }
  };

  // Remove Destination
  const handleRemoveDestination = (indexToRemove: number) => {
    setTempConfig(prev => ({
      ...prev,
      destinations: prev.destinations.filter((_, idx) => idx !== indexToRemove),
    }));
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

  // Save Settings Modal Action
  const handleSaveSettings = () => {
    const saved = backupService.saveBackupConfig(tempConfig, { recheckScheduler: true });
    setConfig(saved);
    setIsSettingsModalOpen(false);
    showNotification({
      type: 'success',
      title: 'تم حفظ وتفعيل إعدادات النسخ الاحتياطي',
      message: `النسخ التلقائي: ${
        saved.autoBackupEnabled ? 'مفعل' : 'معطل'
      } | النظام المجدول: ${backupService.calculateNextBackupDescription(saved)}`,
    });
  };

  const columns: Column<BackupItem>[] = [
    {
      key: 'filename',
      header: 'ملف النسخة والمسار',
      className: 'max-w-[210px] xl:max-w-[260px]',
      render: (item: BackupItem) => (
        <div className="min-w-0">
          <span
            className="font-mono font-bold text-slate-900 text-xs block truncate"
            title={item.filename}
          >
            {item.filename}
          </span>
          <span
            className="text-[11px] text-slate-500 font-mono font-medium block truncate mt-0.5"
            title={item.filepath}
          >
            {item.filepath}
          </span>
        </div>
      ),
    },
    {
      key: 'trigger_type',
      header: 'النوع',
      align: 'center',
      className: 'w-24',
      render: (item: BackupItem) => {
        const trigger = item.trigger_type || (item.backup_type === 'auto' ? 'scheduled' : item.backup_type);
        const label =
          trigger === 'after_operation'
            ? 'بعد عملية'
            : trigger === 'scheduled'
              ? 'مجدول'
              : trigger === 'safeguard'
                ? 'حماية سابقة'
                : 'يدوي';

        const variant =
          trigger === 'after_operation'
            ? 'success'
            : trigger === 'scheduled'
              ? 'primary'
              : trigger === 'safeguard'
                ? 'warning'
                : 'default';

        return (
          <Badge variant={variant} size="sm" className="font-semibold text-xs whitespace-nowrap">
            {label}
          </Badge>
        );
      },
    },
    {
      key: 'date',
      header: 'تاريخ الإنشاء',
      align: 'center',
      className: 'w-24',
      render: (item: BackupItem) => {
        const parts = (item.date || '').split(' ');
        const dateStr = parts[0] || item.date;
        const timeStr = parts[1] || '';
        return (
          <div className="font-mono tabular-nums leading-tight text-xs">
            <span className="font-semibold text-slate-800 block">{dateStr}</span>
            {timeStr && <span className="text-slate-500 text-[11px] block mt-0.5">{timeStr}</span>}
          </div>
        );
      },
    },
    {
      key: 'size_formatted',
      header: 'الحجم',
      align: 'center',
      className: 'w-20',
      render: (item: BackupItem) => (
        <span className="font-mono text-slate-800 text-xs font-semibold tabular-nums">
          {item.size_formatted}
        </span>
      ),
    },
    {
      key: 'destinations',
      header: 'الوجهات',
      align: 'center',
      className: 'w-24',
      render: (item: BackupItem) => {
        const dests = item.destinations || [];
        const successCount = dests.filter(d => d.status === 'success').length;
        const total = dests.length || 1;

        return (
          <button
            type="button"
            onClick={() => setSelectedBackupDetails(item)}
            className="inline-flex items-center justify-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 transition-colors"
            title="انقر لعرض تفاصيل المسارات والوجهات"
          >
            <span>{total > 1 ? `${successCount}/${total} وجهات` : 'وجهة 1'}</span>
            <ExternalLink className="w-3 h-3 text-slate-500 shrink-0" />
          </button>
        );
      },
    },
    {
      key: 'status',
      header: 'الحالة',
      align: 'center',
      className: 'w-20',
      render: (item: BackupItem) => {
        const isSuccess = item.overall_status === 'success' || item.status.includes('سليم');
        const isPartial = item.overall_status === 'partial' || item.status.includes('جزئي');

        if (isSuccess) {
          return (
            <span
              className="inline-flex items-center justify-center gap-1 text-emerald-800 text-xs font-bold"
              title="سليم ومتحقق منه بالكامل"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>سليم</span>
            </span>
          );
        }
        if (isPartial) {
          return (
            <span
              className="inline-flex items-center justify-center gap-1 text-amber-800 text-xs font-bold"
              title="نجاح جزئي في بعض الوجهات"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>جزئي</span>
            </span>
          );
        }
        return (
          <span
            className="inline-flex items-center justify-center gap-1 text-rose-800 text-xs font-bold"
            title="فشل الحفظ"
          >
            <XCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
            <span>فشل</span>
          </span>
        );
      },
    },
    {
      key: 'actions',
      header: 'إجراءات',
      align: 'center',
      className: 'w-36',
      render: (item: BackupItem) => (
        <div className="flex items-center justify-center gap-1">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setSelectedBackupForRestore(item)}
            leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
            className="h-7 text-xs font-bold px-2 border-slate-300 text-slate-800 hover:bg-slate-100"
            title="استرجاع قاعدة البيانات من هذه النسخة"
          >
            استرجاع
          </Button>
          <button
            type="button"
            onClick={() => backupService.openBackupFolder(item.filepath)}
            title="فتح مسار النسخة في مستكشف Windows"
            className="h-7 w-7 inline-flex items-center justify-center rounded-lg border border-slate-300 text-slate-600 hover:text-slate-900 hover:bg-slate-100 hover:border-slate-400 transition-colors shrink-0 cursor-pointer"
          >
            <FolderOpen className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => handleExportBackup(item)}
            title="تصدير ملف النسخة الاحتياطية"
            className="h-7 w-7 inline-flex items-center justify-center rounded-lg border border-slate-300 text-slate-600 hover:text-slate-900 hover:bg-slate-100 hover:border-slate-400 transition-colors shrink-0 cursor-pointer"
          >
            <FolderDown className="w-3.5 h-3.5" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="إدارة النسخ الاحتياطي والأرشفة"
        subtitle=""
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
                const latest = backupService.getBackupConfig();
                setConfig(latest);
                setTempConfig(latest);
                setNewDestinationInput('');
                setDestinationError('');
                setIsSettingsModalOpen(true);
              }}
              leftIcon={<Settings className="w-4.5 h-4.5 text-slate-600" />}
              className="border-slate-300 font-semibold"
            >
              إعدادات النسخ التلقائي
            </Button>
            {/* <Button   never uncoment it 
              variant="outline"
              size="md"
              onClick={handleCreateSaveAsBackup}
              disabled={isCreatingBackup}
              leftIcon={<Save className="w-4.5 h-4.5 text-slate-700" />}
              className="border-slate-300 font-bold"
            >
              حفظ باسم...
            </Button> */}
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
            النظام: <strong className="text-slate-900">{backupService.calculateNextBackupDescription(config)}</strong>
          </p>
        </Card>

        <Card className="p-4 bg-white border-slate-300 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600">وجهات الحفظ النشطة</span>
            <FolderOpen className="w-5 h-5 text-slate-500" />
          </div>
          <div className="mt-2.5">
            <span className="text-sm font-bold text-slate-900 block truncate">
              {config.destinations.length > 0
                ? `${config.destinations.length} مسارات وجهات مهيأة`
                : 'المسار الافتراضي للبرنامج'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            الاحتفاظ بآخر {config.retentionCount} نسخ تلقائية لكل مسار
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
          <Table
            columns={columns}
            data={backups}
            density="compact"
            keyExtractor={(item: BackupItem) => item.id}
          />
        )}
      </div>

      {/* Destinations Details Modal */}
      {selectedBackupDetails && (
        <Modal
          isOpen={!!selectedBackupDetails}
          onClose={() => setSelectedBackupDetails(null)}
          title="تفاصيل مسارات ووجهات النسخة الاحتياطية"
          subtitle={selectedBackupDetails.filename}
          size="md"
          footer={
            <Button
              variant="outline"
              size="md"
              onClick={() => setSelectedBackupDetails(null)}
              className="border-slate-300 font-semibold"
            >
              إغلاق
            </Button>
          }
        >
          <div className="space-y-3.5 text-sm">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-600">تاريخ الإنشاء:</span>
              <span className="text-xs font-mono font-bold text-slate-900">{selectedBackupDetails.date}</span>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-800">حالة الحفظ في كل مسار وجهة:</h4>
              <div className="space-y-2">
                {(selectedBackupDetails.destinations && selectedBackupDetails.destinations.length > 0
                  ? selectedBackupDetails.destinations
                  : [
                      {
                        path: selectedBackupDetails.filepath,
                        status: 'success' as const,
                        file_path: selectedBackupDetails.filepath,
                        size_formatted: selectedBackupDetails.size_formatted,
                      },
                    ]
                ).map((dest: BackupDestinationResult, idx: number) => {
                  const isDestSuccess = dest.status === 'success';
                  return (
                    <div
                      key={idx}
                      className={`p-3 rounded-xl border text-xs space-y-1 ${
                        isDestSuccess
                          ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                          : 'bg-rose-50/70 border-rose-200 text-rose-950'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 font-bold font-mono truncate max-w-sm">
                          {isDestSuccess ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          ) : (
                            <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                          )}
                          <span className="truncate">{dest.path}</span>
                        </div>
                        <Badge variant={isDestSuccess ? 'success' : 'danger'} size="sm">
                          {isDestSuccess ? 'ناجح' : 'فشل الحفظ'}
                        </Badge>
                      </div>

                      {dest.file_path && (
                        <div className="flex items-center justify-between pt-1 gap-2">
                          <p className="text-[11px] font-mono text-slate-600 truncate flex-1">
                            الملف الكامل: {dest.file_path}
                          </p>
                          <button
                            type="button"
                            onClick={() => backupService.openBackupFolder(dest.file_path!)}
                            className="text-[11px] text-blue-700 hover:text-blue-900 font-bold underline px-1 shrink-0 flex items-center gap-1 cursor-pointer"
                          >
                            <span>فتح في Explorer</span>
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        </div>
                      )}

                      {dest.error && (
                        <p className="text-[11px] font-semibold text-rose-700">
                          الخطأ: {dest.error}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </Modal>
      )}

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

      {/* Advanced Automatic Backup Settings Modal */}
      {isSettingsModalOpen && (
        <Modal
          isOpen={isSettingsModalOpen}
          onClose={() => setIsSettingsModalOpen(false)}
          title="إعدادات النسخ الاحتياطي التلقائي  "
          subtitle=""
          size="lg"
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
            {/* Master Toggle */}
            <div className="flex items-center justify-between p-3.5 bg-slate-50/90 rounded-xl border border-slate-300">
              <div>
                <p className="font-bold text-slate-900">تفعيل النسخ الاحتياطي التلقائي </p>
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

            {/* Triggers: Time-based vs Event-based */}
            <div className="p-3.5 bg-slate-50/90 rounded-xl border border-slate-300 space-y-3">
              <p className="font-bold text-xs text-slate-800">أنماط تشغيل النسخ التلقائي :</p>

              {/* Event-based toggle */}
              <div className="p-3 bg-white rounded-lg border border-slate-200 flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900">
                    
                    <span>نسخ فوري بعد كل عملية ناجحة </span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    إنشاء نسخة احتياطية فورية تلقائياً بعد كل عملية بيع، شراء، إضافة أو تعديل أصناف    .
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={tempConfig.eventBackupEnabled}
                  onChange={e =>
                    setTempConfig({ ...tempConfig, eventBackupEnabled: e.target.checked })
                  }
                  className="w-5 h-5 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer mt-0.5"
                />
              </div>

              {/* Time-based toggle */}
              <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900">
                      <Clock className="w-4 h-4 text-blue-500" />
                      <span>نسخ مجدول زمنياً </span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      إنشاء نسخة احتياطية بشكل دوري في الخلفية طالما التطبيق يعمل.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={tempConfig.timeBackupEnabled}
                    onChange={e =>
                      setTempConfig({ ...tempConfig, timeBackupEnabled: e.target.checked })
                    }
                    className="w-5 h-5 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer mt-0.5"
                  />
                </div>

                {tempConfig.timeBackupEnabled && (
                  <div className="pt-2 border-t border-slate-200 space-y-2.5 animate-in fade-in-50">
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setTempConfig({ ...tempConfig, scheduleMode: 'interval' })}
                        className={`py-1.5 px-3 rounded-lg border text-xs font-bold text-center transition-all ${
                          tempConfig.scheduleMode === 'interval'
                            ? 'border-blue-600 bg-blue-50 text-blue-900'
                            : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        فترات زمنية متكررة
                      </button>
                      <button
                        type="button"
                        onClick={() => setTempConfig({ ...tempConfig, scheduleMode: 'time' })}
                        className={`py-1.5 px-3 rounded-lg border text-xs font-bold text-center transition-all ${
                          tempConfig.scheduleMode === 'time'
                            ? 'border-blue-600 bg-blue-50 text-blue-900'
                            : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        توقيت يومي محدد
                      </button>
                    </div>

                    {tempConfig.scheduleMode === 'interval' ? (
                      <div className="space-y-1">
                        <label className="font-semibold text-slate-700 block text-xs">
                          تكرار النسخ الاحتياطي:
                        </label>
                        <select
                          value={tempConfig.intervalMinutes || 360}
                          onChange={e => {
                            const mins = parseInt(e.target.value, 10) || 60;
                            const hrs = Math.max(1, Math.round(mins / 60));
                            setTempConfig({
                              ...tempConfig,
                              intervalMinutes: mins,
                              intervalHours: hrs,
                            });
                          }}
                          className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:border-slate-800"
                        >
                          {INTERVAL_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <label className="font-semibold text-slate-700 block text-xs">
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
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Schedule Live Preview */}
              <div className="p-2 bg-white rounded-lg border border-slate-200 text-xs flex items-center justify-between">
                <span className="text-slate-500 font-medium">الجدول المهيأ حالياً:</span>
                <span className="font-bold text-blue-900">
                  {backupService.calculateNextBackupDescription(tempConfig)}
                </span>
              </div>
            </div>

            {/* Multiple Backup Destinations Section */}
            <div className="p-3.5 bg-slate-50/90 rounded-xl border border-slate-300 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-xs text-slate-800">
                    مسارات  النسخ  :
                  </h4>
                </div>
                <span className="text-xs font-mono font-bold text-slate-600 bg-slate-200/80 px-2 py-0.5 rounded">
                  {tempConfig.destinations.length} مسارات
                </span>
              </div>

              {/* Configured destinations list */}
              {tempConfig.destinations.length === 0 ? (
                <div className="p-3 bg-white rounded-lg border border-dashed border-slate-300 text-center text-xs text-slate-500">
                  لم يتم تخصيص مسارات خارجية. سيتم الحفظ في المسار الافتراضي للبرنامج .
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {tempConfig.destinations.map((dest, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 bg-white rounded-lg border border-slate-200 flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="flex items-center gap-2 overflow-hidden flex-1">
                        <FolderOpen className="w-4 h-4 text-slate-400 shrink-0" />
                        <span className="font-mono text-slate-800 font-semibold truncate" title={dest}>
                          {dest}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => backupService.openBackupFolder(dest)}
                          className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="فتح هذا المجلد في Windows Explorer"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveDestination(idx)}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                          title="حذف هذا المسار"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add New Destination Input with Browse Button */}
              <div className="space-y-1.5 pt-2 border-t border-slate-200">
                <label className="font-semibold text-slate-700 block text-xs">
                  إضافة مسار  جديد:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newDestinationInput}
                    onChange={e => setNewDestinationInput(e.target.value)}
                    placeholder="مثال: C:\Users\Administrator\Desktop\test backup أو D:\Compu MSS Backups"
                    className="flex-1 bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-800 focus:outline-none focus:border-slate-800"
                  />

                  {isTauri() && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleBrowseForDestination}
                      leftIcon={<FolderOpen className="w-4 h-4 text-slate-600" />}
                      className="shrink-0 text-xs font-bold border-slate-300"
                    >
                      استعراض المجلد
                    </Button>
                  )}

                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handleAddDestination}
                    disabled={isAddingDestination || !newDestinationInput.trim()}
                    leftIcon={isAddingDestination ? <Spinner size="sm" /> : <Plus className="w-4 h-4" />}
                    className="shrink-0 text-xs font-bold"
                  >
                    إضافة المسار
                  </Button>
                </div>

                {destinationError && (
                  <p className="text-[11px] font-semibold text-rose-600 flex items-center gap-1 mt-1">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>{destinationError}</span>
                  </p>
                )}
              </div>
            </div>

            {/* Retention count */}
            <div className="space-y-1.5">
              <label className="font-bold text-slate-700 block text-xs">
                الحد الأقصى لعدد النسخ المحفوظة :
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
                يقوم النظام بحذف أقدم النسخ التلقائية الزائدة عن هذا الحد تلقائياً لتوفير المساحة، مع الحفاظ على النسخ اليدوية.
              </p>
            </div>

            {/* Startup with Windows Feature */}
            <div className="p-3.5 bg-slate-50/90 rounded-xl border border-slate-300 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Power className="w-4 h-4 text-blue-600" />
                    <h5 className="font-bold text-xs text-slate-900">Startup with Windows </h5>
                    <Badge variant={isStartupEnabled ? 'success' : 'default'} size="sm">
                      {isStartupEnabled ? 'مفعل' : 'معطل'}
                    </Badge>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={isStartupEnabled}
                  onChange={async e => {
                    const checked = e.target.checked;
                    try {
                      const res = await autostartService.setStartupStatus(checked);
                      setIsStartupEnabled(res.enabled);
                      showNotification({
                        type: 'success',
                        title: res.enabled ? 'تم تفعيل التشغيل مع Windows' : 'تم تعطيل التشغيل مع Windows',
                        message: res.message || 'تم تحديث حالة بدء التشغيل بنجاح',
                      });
                    } catch (err: any) {
                      showNotification({
                        type: 'error',
                        title: 'فشل تغيير بدء التشغيل',
                        message: err.message || 'تعذر تعديل الإعداد',
                      });
                    }
                  }}
                  className="w-5 h-5 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer mt-0.5"
                />
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
