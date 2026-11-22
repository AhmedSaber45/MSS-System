import React from 'react';
import { Loader2 } from 'lucide-react';

export const AuthLoadingSplash: React.FC = () => {
  return (
    <div
      dir="rtl"
      className="min-h-screen w-screen bg-slate-50 flex flex-col justify-center items-center p-4 selection:bg-slate-900 selection:text-white"
    >
      <div className="text-center space-y-4 max-w-sm">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm p-2.5">
          <img
            src="/assets/branding/as_logo_gold.png"
            alt="AS System"
            className="w-full h-full object-contain select-none"
          />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight font-mono">AS System</h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">نظام إدارة المبيعات والمخزون الموحد</p>
        </div>
        <div className="pt-3 flex items-center justify-center gap-2 text-xs text-slate-500 font-medium">
          <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
          <span>جارٍ التحقق من الجلسة واستعادة الصلاحيات...</span>
        </div>
      </div>
    </div>
  );
};
