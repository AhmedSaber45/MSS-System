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
} from 'lucide-react';
import { autostartService } from '../../services/autostartService';
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

  useEffect(() => {
    if (isOpen) {
      loadStartupStatus();
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
      title="إعدادات النظام — MSS System"
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
                تشغيل <strong>MSS System</strong> تلقائياً عند بدء تشغيل نظام التشغيل Windows.
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

        {/* Ownership and Copyright Section */}
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-300 space-y-3">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-xs">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>معلومات الملكية وحقوق النسخ</span>
          </div>

          <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">اسم التطبيق:</span>
              <span className="font-bold text-slate-900 font-mono">MSS System</span>
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
