'use client';

import React from 'react';
import {
  ArrowLeftRight,
  ShieldCheck,
  Calendar,
  Layers,
  Lock,
  Boxes,
  FileCheck2,
} from 'lucide-react';
import type { NavTab } from '../layout/AdminSidebar';

interface TransfersPlaceholderViewProps {
  onNavigate: (tab: NavTab) => void;
}

export const TransfersPlaceholderView: React.FC<TransfersPlaceholderViewProps> = ({ onNavigate }) => {
  return (
    <div className="space-y-6">
      {/* Main Phase Gate Banner */}
      <div className="p-8 rounded-2xl bg-gradient-to-br from-brand-card via-brand-surface to-brand-card border border-brand-border text-center max-w-3xl mx-auto shadow-2xl">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-4 shadow-lg">
          <ArrowLeftRight className="w-8 h-8" />
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-950/60 border border-amber-800/50 text-amber-300 text-xs font-semibold mb-3">
          <Lock className="w-3.5 h-3.5" />
          <span>ميزة مخصصة للمرحلة 5 (Phase 5: Inventory Transfers)</span>
        </div>

        <h2 className="text-xl font-bold text-white mb-2">
          تحويلات المخزون بين الفروع والمخازن
        </h2>
        <p className="text-sm text-slate-300 max-w-xl mx-auto leading-relaxed">
          وفق وثيقة المواصفات وقواعد التنفيذ الصارمة (Strict Phase Gate)، تم تخصيص ميزة تحويلات الأجهزة الفيزيائية
          للمرحلة الخامسة بعد اعتماد واكتمال الربط ومصادقة مستخدمي المحلات في المرحلة القادمة.
        </p>

        {/* Feature roadmap cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mt-8 text-right">
          <div className="p-4 rounded-xl bg-slate-900/60 border border-brand-border/60">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-brand-primary flex items-center justify-center mb-2.5">
              <Boxes className="w-4 h-4" />
            </div>
            <h4 className="text-xs font-bold text-white mb-1">تحويل جهاز مفرد</h4>
            <p className="text-[11px] text-slate-400 leading-normal">
              نقل جهاز محدد برقم السيريال من فرع لآخر مع توثيق سبب النقل وتحديث موقعه فوراً.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/60 border border-brand-border/60">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center mb-2.5">
              <Layers className="w-4 h-4" />
            </div>
            <h4 className="text-xs font-bold text-white mb-1">التحويل الجماعي</h4>
            <p className="text-[11px] text-slate-400 leading-normal">
              تحديد مجموعة أجهزة متعددة أو تحويل كامل الرصيد المتاح من محل لآخر دفعة واحدة بأمان.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/60 border border-brand-border/60">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-2.5">
              <FileCheck2 className="w-4 h-4" />
            </div>
            <h4 className="text-xs font-bold text-white mb-1">سجل التحويلات والاعتماد</h4>
            <p className="text-[11px] text-slate-400 leading-normal">
              تتبع تاريخي كامل لحركات النقل بين المحلات، التوقيت، المسؤول، وتأكيد الاستلام.
            </p>
          </div>
        </div>

        {/* Bottom actions */}
        <div className="mt-8 pt-6 border-t border-brand-border/60 flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={() => onNavigate('stores')}
            className="px-4 py-2 bg-brand-surface hover:bg-slate-800 text-slate-300 text-xs font-semibold rounded-lg border border-brand-border transition-colors"
          >
            استعراض الفروع والمخازن الحالية
          </button>
          <button
            onClick={() => onNavigate('overview')}
            className="px-4 py-2 bg-brand-primary hover:bg-brand-secondary text-white text-xs font-semibold rounded-lg transition-colors"
          >
            العودة للنظرة العامة
          </button>
        </div>
      </div>
    </div>
  );
};
