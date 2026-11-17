import React from 'react';
import { ShieldCheck, Loader2 } from 'lucide-react';

export const AuthLoadingSplash: React.FC = () => {
  return (
    <div
      dir="rtl"
      className="min-h-screen w-screen bg-slate-950 flex flex-col justify-center items-center p-4 selection:bg-blue-600 selection:text-white"
    >
      <div className="text-center space-y-4 max-w-sm">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600/10 border border-blue-500/20 text-blue-500 shadow-inner">
          <ShieldCheck className="w-8 h-8" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight font-mono">Compu MSS</h1>
          <p className="text-xs text-slate-400 mt-1 font-medium">نظام إدارة المبيعات والمخزون الموحد</p>
        </div>
        <div className="pt-4 flex items-center justify-center gap-2.5 text-xs text-slate-400 font-medium">
          <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
          <span>جارٍ التحقق من الجلسة واستعادة الصلاحيات...</span>
        </div>
      </div>
    </div>
  );
};
