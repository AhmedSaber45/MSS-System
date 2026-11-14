import React, { useState, useEffect } from 'react';
import { ArrowUpCircle, Sparkles } from 'lucide-react';
import { updaterService } from '@/services/updaterService.ts';
import type { UpdateInfo } from '@/types/updater.ts';
import { UpdateModal } from './UpdateModal.tsx';

export const UpdateBadgePill: React.FC = () => {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo>(updaterService.getState());
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  useEffect(() => {
    const unsubscribe = updaterService.subscribe(setUpdateInfo);
    // Start background schedule (e.g. check on app launch)
    const cleanup = updaterService.startBackgroundSchedule(12);

    return () => {
      unsubscribe();
      cleanup();
    };
  }, []);

  const isUpdateAvailable = updateInfo.status === 'AVAILABLE';

  return (
    <>
      <button
        type="button"
        onClick={() => setIsModalOpen(true)}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all shadow-2xs ${
          isUpdateAvailable
            ? 'bg-amber-100 text-amber-900 border border-amber-300 hover:bg-amber-200 animate-pulse'
            : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200'
        }`}
        title={isUpdateAvailable ? `تحديث جديد متوفر: v${updateInfo.availableVersion}` : 'إدارة التحديثات وإصدار النظام'}
      >
        {isUpdateAvailable ? (
          <>
            <Sparkles className="w-3.5 h-3.5 text-amber-700" />
            <span>تحديث v{updateInfo.availableVersion}</span>
          </>
        ) : (
          <>
            <ArrowUpCircle className="w-3.5 h-3.5 text-slate-500" />
            <span className="font-mono">v{updateInfo.currentVersion}</span>
          </>
        )}
      </button>

      <UpdateModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
};
