import React, { useState, useEffect } from 'react';
import { ArrowUpCircle } from 'lucide-react';
import { updaterService } from '@/services/updaterService.ts';
import type { UpdateInfo } from '@/types/updater.ts';
import { UpdateModal } from './UpdateModal.tsx';

export const UpdateBadgePill: React.FC = () => {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo>(updaterService.getState());
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  useEffect(() => {
    const unsubscribe = updaterService.subscribe(setUpdateInfo);
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
        className={`flex items-center gap-2 px-3 h-9 rounded-lg text-sm font-semibold transition-colors select-none ${
          isUpdateAvailable
            ? 'bg-amber-50 text-amber-950 border border-amber-300 hover:bg-amber-100'
            : 'bg-white text-slate-800 border border-slate-300 hover:bg-slate-50'
        }`}
        title={isUpdateAvailable ? `تحديث جديد متوفر: v${updateInfo.availableVersion}` : 'إدارة التحديثات وإصدار النظام'}
      >
        <ArrowUpCircle className={`w-4.5 h-4.5 ${isUpdateAvailable ? 'text-amber-700' : 'text-slate-500'}`} />
        {isUpdateAvailable ? (
          <span className="tabular-nums font-bold">تحديث متاح: v{updateInfo.availableVersion}</span>
        ) : (
          <span className="font-mono tabular-nums text-slate-700 font-semibold">v{updateInfo.currentVersion}</span>
        )}
      </button>

      <UpdateModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
};
