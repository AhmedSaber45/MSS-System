import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Badge } from './Badge';
import { Spinner } from './Spinner';
import {
  Settings,
  Power,
  Copy,
  Check,
  Phone,
  HardDrive,
  Info,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  FolderDown,
  FolderOpen,
  Plus,
  Trash2,
} from 'lucide-react';
import { autostartService } from '../../services/autostartService';
import { exportStorageService } from '../../services/exportStorageService';
import { useNotification } from '../../context/NotificationContext';
import { isTauri } from '@tauri-apps/api/core';

export interface SystemSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SystemSettingsModal: React.FC<SystemSettingsModalProps> = ({ isOpen, onClose }) => {
  const { showNotification } = useNotification();
  const [isStartupEnabled, setIsStartupEnabled] = useState<boolean>(false);
  const [isLoadingStartup, setIsLoadingStartup] = useState<boolean>(true);
  const [isSavingStartup, setIsSavingStartup] = useState<boolean>(false);
  const [startupMsg, setStartupMsg] = useState<string>('');
  const [hasCopiedPhone, setHasCopiedPhone] = useState<boolean>(false);

  // Export Storage Location State (Single Editable Path Input)
  const [exportLocation, setExportLocation] = useState<string | null>(exportStorageService.getStorageLocation());
  const [inputPath, setInputPath] = useState<string>('');
  const [isSavingPath, setIsSavingPath] = useState<boolean>(false);
  const [pathError, setPathError] = useState<string>('');
  const [locationValidation, setLocationValidation] = useState<{ valid: boolean; error?: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadStartupStatus();
      const loc = exportStorageService.getStorageLocation();
      setExportLocation(loc);
      setInputPath(loc || '');
      setPathError('');
      if (loc) {
        exportStorageService.validateDestination(loc).then(res => {
          setLocationValidation(res);
        });
      } else {
        setLocationValidation(null);
      }
    }
  }, [isOpen]);

  const loadStartupStatus = async () => {
    setIsLoadingStartup(true);
    try {
      const res = await autostartService.getStartupStatus();
      setIsStartupEnabled(res.enabled);
      if (res.message) {
        setStartupMsg(res.message);
      }
    } catch (err: any) {
      console.warn('Failed to load startup status:', err);
    } finally {
      setIsLoadingStartup(false);
    }
  };

  const handleSavePath = async () => {
    setPathError('');
    const trimmed = inputPath.trim();
    if (!trimmed) {
      setPathError('يرجى كتابة أو لصق مسار المجلد أولاً.');
      return;
    }

    setIsSavingPath(true);
    try {
      const validation = await exportStorageService.validateDestination(trimmed);
      if (!validation.valid) {
        setPathError(validation.error || 'المسار غير صالح أو غير متاح للكتابة.');
        return;
      }

      exportStorageService.setStorageLocation(trimmed);
      setExportLocation(trimmed);
      setInputPath(trimmed);
      setLocationValidation(validation);
      setPathError('');

      showNotification({
        type: 'success',
        title: 'تم حفظ مسار التصدير بنجاح',
        message: `تم تعيين مسار حفظ وتصدير ملفات النظام: ${trimmed}`,
      });
    } catch (err: any) {
      setPathError(err?.message || 'فشل التحقق من المسار.');
    } finally {
      setIsSavingPath(false);
    }
  };

  const handleClearExportLocation = () => {
    exportStorageService.clearStorageLocation();
    setExportLocation(null);
    setInputPath('');
    setLocationValidation(null);
    setPathError('');
    showNotification({
      type: 'info',
      title: 'تمت إزالة مسار التصدير',
      message: 'تم تفريغ مسار التصدير بنجاح. يمكنك كتابة وإضافة مسار جديد في أي وقت.',
    });
  };

  const handleOpenInExplorer = async () => {
    try {
      await exportStorageService.openFolderInExplorer();
    } catch (err: any) {
      showNotification({
        type: 'error',
        title: 'تعذر فتح المجلد',
        message: err.message || 'المسار غير موجود أو تعذر الوصول إليه.',
      });
    }
  };

  const handleToggleStartup = async (nextState: boolean) => {
    setIsSavingStartup(true);
    try {
      const res = await autostartService.setStartupStatus(nextState);
      setIsStartupEnabled(res.enabled);
      showNotification({
        type: 'success',
        title: res.enabled ? 'تم تفعيل التشغيل مع Windows' : 'تم تعطيل التشغيل مع Windows',
        message: res.message || (res.enabled ? 'سيتم تشغيل البرنامج تلقائياً عند بدء تشغيل Windows.' : 'تم إزالة البرنامج من قائمة بدء التشغيل.'),
      });
    } catch (err: any) {
      showNotification({
        type: 'error',
        title: 'فشل تغيير إعدادات بدء التشغيل',
        message: err.message || 'تعذر تعديل سجل بدء تشغيل Windows',
      });
    } finally {
      setIsSavingStartup(false);
    }
  };

  const handleCopyPhone = async () => {
    try {
      await navigator.clipboard.writeText('01030137635');
      setHasCopiedPhone(true);
      showNotification({
        type: 'info',
        title: 'تم نسخ الرقم',
        message: 'تم نسخ رقم الهاتف (01030137635) إلى الحافظة بنجاح.',
      });
      setTimeout(() => setHasCopiedPhone(false), 2500);
    } catch {
      // Fallback
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="إعدادات النظام — Compu MSS"
      subtitle=""
      size="md"
      footer={
        <div className="flex justify-end w-full">
          <Button variant="outline" size="md" onClick={onClose} className="border-slate-300 font-bold">
            إغلاق
          </Button>
        </div>
      }
    >
      <div className="space-y-4 text-sm select-none">
        {/* Startup with Windows Feature */}
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-300 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Power className="w-4 h-4 text-blue-600" />
                <h4 className="font-bold text-slate-900 text-sm">Startup with Windows</h4>
                <Badge variant={isStartupEnabled ? 'success' : 'default'} size="sm" className="font-mono">
                  {isStartupEnabled ? 'مفعل' : 'معطل'}
                </Badge>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                تشغيل <strong>Compu MSS</strong> تلقائياً عند بدء تشغيل نظام التشغيل Windows.
              </p>
            </div>

            <div className="shrink-0 pt-0.5">
              {isLoadingStartup ? (
                <Spinner size="sm" />
              ) : (
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isStartupEnabled}
                    onChange={e => handleToggleStartup(e.target.checked)}
                    disabled={isSavingStartup}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              )}
            </div>
          </div>


        </div>

        {/* Export Files Storage Location Feature */}
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-300 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <FolderDown className="w-4 h-4 text-emerald-600" />
                <h4 className="font-bold text-slate-900 text-sm">Export Files Storage Path</h4>
                <Badge
                  variant={!exportLocation ? 'default' : locationValidation?.valid ? 'success' : 'danger'}
                  size="sm"
                  className="font-mono"
                >
                  {!exportLocation ? 'غير محدد' : locationValidation?.valid ? 'مفعل وجاهز' : 'غير متاح'}
                </Badge>
              </div>
  
            </div>
          </div>

          {/* Current Saved Path display (if a path is saved) */}
          {exportLocation ? (
            <div className="p-2.5 bg-white rounded-lg border border-slate-200 flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 overflow-hidden flex-1">
                <FolderOpen className="w-4 h-4 text-slate-400 shrink-0" />
                <span
                  className={`font-mono truncate dir-ltr text-left font-semibold ${
                    locationValidation && !locationValidation.valid
                      ? 'text-rose-700 line-through'
                      : 'text-slate-800'
                  }`}
                  title={exportLocation}
                >
                  {exportLocation}
                </span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {locationValidation?.valid && (
                  <button
                    type="button"
                    onClick={handleOpenInExplorer}
                    className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors cursor-pointer"
                    title="فتح هذا المجلد في Windows Explorer"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleClearExportLocation}
                  className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                  title="إزالة  المسار"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <div className="p-3 bg-white rounded-lg border border-dashed border-slate-300 text-center text-xs text-slate-500">
              لم يتم تعيين مسار لحفظ الملفات  .   
            </div>
          )}

          {/* Inaccessible Warning Alert */}
          {exportLocation && locationValidation && !locationValidation.valid && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
              <div className="space-y-0.5">
                <p className="font-bold">المسار المحفوظ غير متاح أو تم نقله</p>
                <p className="text-[11px] text-rose-600 leading-normal">
                  {locationValidation.error || 'تعذر العثور على المجلد على القرص'}. يرجى إدخال مسار بديل أدناه والضغط على &quot;إضافة المسار&quot;.
                </p>
              </div>
            </div>
          )}

          {/* Single Editable Path Input with Action Button ("إضافة المسار") */}
          <div className="space-y-1.5 pt-2 border-t border-slate-200">
            <label className="font-semibold text-slate-700 block text-xs">
              {exportLocation ? 'تعديل أو استبدال مسار التصدير:' : 'إضافة مسار التصدير:'}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={inputPath}
                onChange={e => {
                  setInputPath(e.target.value);
                  setPathError('');
                }}
                placeholder="مثال:D:\MSS Exports"
                className="flex-1 bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-800 focus:outline-none focus:border-slate-800 dir-ltr text-left"
                dir="ltr"
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleSavePath}
                disabled={isSavingPath || !inputPath.trim()}
                leftIcon={isSavingPath ? <Spinner size="sm" /> : <Plus className="w-4 h-4" />}
                className="shrink-0 text-xs font-bold"
              >
                إضافة المسار
              </Button>
            </div>

            {pathError && (
              <p className="text-[11px] font-semibold text-rose-600 flex items-center gap-1 mt-1">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>{pathError}</span>
              </p>
            )}
          </div>
        </div>

        {/* Ownership and Copyright Section */}
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-300 space-y-3">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-xs">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>معلومات الملكية وحقوق النسخ</span>
          </div>

          <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">اسم التطبيق:</span>
              <span className="font-bold text-slate-900 font-mono">Compu MSS</span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">الإصدار:</span>
              <span className="font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">v1.0.1</span>
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">حقوق الملكية:</span>
              <span className="font-semibold text-slate-900 font-mono">
                © 2026 Ahmed Saber. All rights reserved.
              </span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">بيانات التواصل:</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyPhone}
                  className="font-mono font-bold text-blue-700 hover:text-blue-900 hover:underline inline-flex items-center gap-1.5 cursor-pointer"
                  title="انقر لنسخ الرقم: 01030137635"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>01030137635</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyPhone}
                  className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                  title="نسخ رقم الهاتف"
                >
                  {hasCopiedPhone ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};
