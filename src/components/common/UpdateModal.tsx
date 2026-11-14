import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Badge } from './Badge';
import { Spinner } from './Spinner';
import {
  Download,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  WifiOff,
  Database,
  ArrowUpCircle,
} from 'lucide-react';
import { updaterService } from '@/services/updaterService.ts';
import type { UpdateInfo } from '@/types/updater.ts';
import { useNotification } from '@/context/NotificationContext';

interface UpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UpdateModal: React.FC<UpdateModalProps> = ({ isOpen, onClose }) => {
  const { showNotification } = useNotification();
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo>(updaterService.getState());
  const [isDownloading, setIsDownloading] = useState<boolean>(false);

  useEffect(() => {
    const unsubscribe = updaterService.subscribe(setUpdateInfo);
    return () => unsubscribe();
  }, []);

  const handleCheckNow = async () => {
    const res = await updaterService.checkForUpdates(true);
    if (res.status === 'UP_TO_DATE') {
      showNotification({
        type: 'info',
        title: 'النظام محدث',
        message: `أنت تستخدم أحدث إصدار متاح حالياً (${res.currentVersion}).`,
      });
    } else if (res.status === 'AVAILABLE') {
      showNotification({
        type: 'success',
        title: 'تحديث جديد متوفر',
        message: `تم العثور على إصدار جديد (${res.availableVersion}). جاهز للتحميل والتثبيت.`,
      });
    } else if (res.status === 'OFFLINE') {
      showNotification({
        type: 'warning',
        title: 'تعذر الاتصال',
        message: 'لا يتوفر اتصال بالإنترنت للتحقق من التحديثات.',
      });
    }
  };

  const handleDownloadAndInstall = async () => {
    setIsDownloading(true);
    const res = await updaterService.downloadAndInstallUpdate();
    setIsDownloading(false);

    if (res.success) {
      showNotification({
        type: 'success',
        title: 'اكتمل تجهيز التحديث',
        message: `تم تحميل حزمة التحديث بنجاح وأخذ نسخة احتياطية مسبقة باسم (${res.backupFilename || 'نسخة احترازية'}).`,
      });
    } else {
      showNotification({
        type: 'error',
        title: 'فشل التثبيت',
        message: 'حدث خطأ أثناء تحميل حزمة التحديث، تم الاحتفاظ ببياناتك دون تغيير.',
      });
    }
  };

  const handleSimulateUpdate = () => {
    updaterService.simulateUpdateAvailable('1.1.0', 'إصدار جديد يتضمن تحسينات على تقارير الأداء والأمان وتحديث لوحة القيادة الموحدة');
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="إدارة وتحديثات النظام (Tauri Auto-Updater)"
      size="md"
      footer={
        <div className="flex items-center justify-between w-full">
          {import.meta.env.DEV ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSimulateUpdate}
              className="text-xs text-slate-400 hover:text-slate-600"
            >
              تجربة محاكاة التحديث
            </Button>
          ) : (
            <div />
          )}

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              إغلاق
            </Button>

            {updateInfo.status === 'AVAILABLE' && (
              <Button
                variant="primary"
                size="sm"
                onClick={handleDownloadAndInstall}
                disabled={isDownloading}
                leftIcon={<Download className="w-3.5 h-3.5" />}
              >
                {isDownloading ? 'جاري التحميل...' : 'تحميل وتثبيت التحديث'}
              </Button>
            )}

            {updateInfo.status !== 'AVAILABLE' && updateInfo.status !== 'DOWNLOADING' && (
              <Button
                variant="primary"
                size="sm"
                onClick={handleCheckNow}
                disabled={updateInfo.status === 'CHECKING'}
                leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${updateInfo.status === 'CHECKING' ? 'animate-spin' : ''}`} />}
              >
                {updateInfo.status === 'CHECKING' ? 'جاري الفحص...' : 'فحص التحديثات الآن'}
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-4 text-xs">
        {/* Status Header Box */}
        <div className="p-3.5 rounded-lg border border-slate-200/90 bg-slate-50/70 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-slate-500 font-medium">الإصدار المثبت حالياً:</span>
            <div className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <span className="font-mono tabular-nums">v{updateInfo.currentVersion}</span>
              {updateInfo.status === 'UP_TO_DATE' && (
                <Badge variant="success" size="sm">
                  أحدث إصدار
                </Badge>
              )}
            </div>
            {updateInfo.lastChecked && (
              <div className="text-[11px] text-slate-400 tabular-nums">
                آخر فحص: {new Date(updateInfo.lastChecked).toLocaleTimeString('ar-EG')}
              </div>
            )}
          </div>

          <div>
            {updateInfo.status === 'CHECKING' && (
              <Badge variant="info" size="md">
                <Spinner size="sm" className="ml-1.5" />
                جاري الاتصال بالسيرفر...
              </Badge>
            )}
            {updateInfo.status === 'AVAILABLE' && (
              <Badge variant="warning" size="md">
                <ArrowUpCircle className="w-3.5 h-3.5 ml-1 text-amber-700" />
                إصدار متاح: v{updateInfo.availableVersion}
              </Badge>
            )}
            {updateInfo.status === 'UP_TO_DATE' && (
              <Badge variant="success" size="md">
                <CheckCircle2 className="w-3.5 h-3.5 ml-1 text-emerald-700" />
                النظام محدث بالكامل
              </Badge>
            )}
            {updateInfo.status === 'OFFLINE' && (
              <Badge variant="warning" size="md">
                <WifiOff className="w-3.5 h-3.5 ml-1 text-amber-700" />
                الجهاز غير متصل بالإنترنت
              </Badge>
            )}
            {updateInfo.status === 'ERROR' && (
              <Badge variant="danger" size="md">
                <AlertTriangle className="w-3.5 h-3.5 ml-1 text-rose-700" />
                فشل الفحص
              </Badge>
            )}
          </div>
        </div>

        {/* Update Available Details */}
        {updateInfo.status === 'AVAILABLE' && (
          <div className="space-y-2.5 p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-900 flex items-center gap-1.5">
                <ArrowUpCircle className="w-4 h-4 text-slate-700" />
                <span>تفاصيل الإصدار الجديد v{updateInfo.availableVersion}</span>
              </span>
              <span className="text-slate-500 text-[11px] tabular-nums">
                {updateInfo.releaseDate ? new Date(updateInfo.releaseDate).toLocaleDateString('ar-EG') : ''}
              </span>
            </div>

            <div className="bg-white p-3 rounded-md border border-slate-200/90 text-slate-700 font-sans leading-relaxed text-xs">
              {updateInfo.releaseNotes}
            </div>

            {/* Safeguard Notice */}
            <div className="flex items-start gap-2 text-slate-700 bg-white p-2.5 rounded-md border border-slate-200/90 text-[11px]">
              <ShieldCheck className="w-4 h-4 text-emerald-700 mt-0.5 shrink-0" />
              <div>
                <span className="font-medium text-slate-900">أمان البيانات مضمون (القاعدة 22 و 23):</span>{' '}
                <span>
                  يقوم النظام تلقائياً بإنشاء نسخة احتياطية من قاعدة بيانات SQLite المحلية قبل بدء التثبيت، مع ضمان عدم مساس التحديث بملفات العمل في AppData.
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Download Progress Bar */}
        {(updateInfo.status === 'DOWNLOADING' || updateInfo.status === 'READY_TO_INSTALL') && (
          <div className="space-y-2 p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
            <div className="flex justify-between items-center font-medium text-slate-900">
              <span>{updateInfo.status === 'READY_TO_INSTALL' ? 'اكتمل التحميل وجاهز للتثبيت' : 'جاري تحميل التحديث بأمان...'}</span>
              <span className="font-mono tabular-nums">{updateInfo.downloadProgress}%</span>
            </div>

            <div className="w-full bg-slate-200 h-2 rounded overflow-hidden">
              <div
                className="bg-slate-900 h-full rounded transition-all duration-300"
                style={{ width: `${updateInfo.downloadProgress}%` }}
              />
            </div>

            {updateInfo.preUpdateBackupFilename && (
              <div className="text-[11px] text-slate-600 flex items-center gap-1 pt-1">
                <Database className="w-3.5 h-3.5 text-slate-500" />
                <span>تم تأمين نسخة احتياطية احترازية: {updateInfo.preUpdateBackupFilename}</span>
              </div>
            )}
          </div>
        )}

        {/* Technical Architecture Info */}
        <div className="p-3 bg-slate-50/70 rounded-lg border border-slate-100 space-y-1.5 text-[11px] text-slate-500">
          <div className="font-medium text-slate-700 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-slate-600" />
            <span>معايير أمان التحديثات المعتمدة في النظام:</span>
          </div>
          <ul className="list-disc list-inside space-y-1 pr-1 leading-relaxed">
            <li>كافة حزم التحديثات موقعة رقمياً بتشفير Minisign ولا يتم تثبيت أي ملف غير موقع ومطابق للمفتاح العام.</li>
            <li>المفتاح الخاص للتوقيع محمي بالكامل ومحجوب عن المستودعات العامة.</li>
            <li>يتم توزيع التحديثات عبر GitHub Releases مع التحقق من الاتصال وسلامة الملفات.</li>
          </ul>
        </div>
      </div>
    </Modal>
  );
};
