'use client';

import React from 'react';
import {
  Settings,
  ShieldCheck,
  Database,
  FileCode,
  HardDrive,
  WifiOff,
  CheckCircle2,
  Lock,
} from 'lucide-react';

export const SettingsView: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Settings className="w-5 h-5 text-brand-primary" />
          <span>إعدادات النظام والأمان المعماري</span>
        </h2>
        <p className="text-xs text-slate-400">
          مراجعة التكوين، سياسات الأمان، قواعد العزل المعماري وحالة ملف ترحيل قاعدة البيانات
        </p>
      </div>

      {/* Architecture Compliance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Rule 6: Complete Accessories Isolation */}
        <div className="p-5 rounded-xl bg-brand-card border border-brand-border space-y-3">
          <div className="flex items-center gap-2.5 text-emerald-400">
            <HardDrive className="w-5 h-5" />
            <h3 className="text-sm font-bold text-white">العزل التام للإكسسوارات (Rule 6)</h3>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            بيانات نشاط الإكسسوارات (المخزون، الفواتير، المشتريات، المرتجعات) مخزنة محلياً بنسبة 100% داخل قاعدة
            SQLite (<code className="text-brand-primary">accessories.db</code>) في حاسوب المحل، ولم يتم ترحيلها أو
            رفعها للسحابة على الإطلاق حفاظاً على خصوصية واستقلالية النشاط.
          </p>
          <div className="flex items-center gap-2 text-[11px] font-semibold text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-3 py-1.5 rounded-lg">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>حالة العزل: معتمد ومحمي محلياً</span>
          </div>
        </div>

        {/* Rule 10 & 25: Offline-First Desktop Architecture */}
        <div className="p-5 rounded-xl bg-brand-card border border-brand-border space-y-3">
          <div className="flex items-center gap-2.5 text-brand-primary">
            <WifiOff className="w-5 h-5" />
            <h3 className="text-sm font-bold text-white">بنية العمل دون إنترنت (Offline-First)</h3>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            تطبيق سطح المكتب للمحلات يواصل عمله المعتاد عبر صندوق الصادر (Outbox) عند انقطاع الإنترنت. لم يتم فرض أي
            اعتماد سحابي إجباري على العمليات التجارية، وتتم المزامنة تلقائياً عند استعادة الاتصال.
          </p>
          <div className="flex items-center gap-2 text-[11px] font-semibold text-brand-primary bg-blue-950/40 border border-blue-800/40 px-3 py-1.5 rounded-lg">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>حالة المزامنة: محفوظ بالكامل وبدون تعديل</span>
          </div>
        </div>

        {/* Security & Access Code Hashing */}
        <div className="p-5 rounded-xl bg-brand-card border border-brand-border space-y-3">
          <div className="flex items-center gap-2.5 text-amber-400">
            <Lock className="w-5 h-5" />
            <h3 className="text-sm font-bold text-white">تشفير رموز الدخول وسياسات RLS</h3>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            كافة رموز دخول مستخدمي الفروع يتم تشفيرها من طرف الخادم (Server-side) باستخدام خوارزمية{' '}
            <code className="text-brand-primary font-mono">bcrypt</code>. لا يتم إرجاع الرموز المشفرة أو الصريحة في
            استعلامات المتصفح، ولا يحتوي المتصفح على أي مفتاح Service-Role.
          </p>
          <div className="flex items-center gap-2 text-[11px] font-semibold text-amber-400 bg-amber-950/40 border border-amber-800/40 px-3 py-1.5 rounded-lg">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>حالة التشفير: تشفير أحادي الاتجاه فعال</span>
          </div>
        </div>

        {/* Supabase Migration File Info */}
        <div className="p-5 rounded-xl bg-brand-card border border-brand-border space-y-3">
          <div className="flex items-center gap-2.5 text-purple-400">
            <Database className="w-5 h-5" />
            <h3 className="text-sm font-bold text-white">ملف ترحيل قاعدة البيانات (SQL Migration)</h3>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            تم إنشاء ملف ترحيل موحد وشامل وجاهز للتنفيذ مرة واحدة في محرر SQL بسحابة Supabase:
          </p>
          <div className="p-2.5 bg-brand-surface rounded-lg border border-brand-border font-mono text-[11px] text-slate-300 flex items-center justify-between">
            <span className="truncate">supabase/migrations/20261116_phase01_admin_dashboard_foundation.sql</span>
            <FileCode className="w-4 h-4 text-purple-400 shrink-0 mr-2" />
          </div>
          <div className="text-[11px] text-slate-400">
            يشمل جداول: <code className="text-slate-200">admin_users</code>,{' '}
            <code className="text-slate-200">system_stores</code>, <code className="text-slate-200">app_users</code>,{' '}
            <code className="text-slate-200">user_store_assignments</code>,{' '}
            <code className="text-slate-200">admin_audit_logs</code>.
          </div>
        </div>
      </div>

      {/* Developer and Ownership Information */}
      <div className="p-5 rounded-xl bg-brand-card border border-brand-border flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h4 className="text-xs font-bold text-white">حقوق الملكية وتطوير النظام</h4>
          <p className="text-xs text-slate-400 mt-0.5">
            Compu MSS Admin System — المرحلة 1: التأسيس المعماري ولوحة الإدارة
          </p>
        </div>
        <div className="text-left sm:text-right font-mono text-xs text-slate-300">
          <div>© 2026 Ahmed Saber. All rights reserved.</div>
          <div className="text-brand-primary">Contact: 01030137635</div>
        </div>
      </div>
    </div>
  );
};
