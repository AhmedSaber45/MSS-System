'use client';

import React, { useEffect, useState } from 'react';
import {
  Users,
  Store,
  Layers,
  ShieldCheck,
  ArrowUpRight,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Laptop,
  ShieldAlert,
  HardDrive,
  Database,
  Activity,
} from 'lucide-react';
import type { OverviewStats } from '@/types/admin';
import type { NavTab } from '../layout/AdminSidebar';

interface OverviewViewProps {
  onNavigate: (tab: NavTab) => void;
  adminUser?: {
    id: string;
    username: string;
    displayName: string;
    role: string;
    allowedModules?: string;
  } | null;
}

export const OverviewView: React.FC<OverviewViewProps> = ({ onNavigate, adminUser }) => {
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/overview');
      if (!res.ok) throw new Error('فشل في جلب إحصائيات النظام');
      const data = await res.json();
      setStats(data.stats);
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء تحميل البيانات');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-slate-400 gap-3">
        <RefreshCw className="w-6 h-6 animate-spin text-sky-400" />
        <p className="text-xs font-mono text-slate-400">جاري تحميل بيانات لوحة التحكم...</p>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="p-5 bg-rose-950/20 border border-rose-900/50 rounded-xl text-rose-300 flex items-center justify-between text-xs">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
          <span>{error || 'تعذر تحميل الإحصائيات الإدارية'}</span>
        </div>
        <button
          onClick={fetchStats}
          className="px-3 py-1.5 bg-rose-900/40 hover:bg-rose-900/70 border border-rose-800 text-xs rounded-lg transition-colors cursor-pointer"
        >
          إعادة المحاولة
        </button>
      </div>
    );
  }

  const scope = stats.moduleScope || 'both';

  // =========================================================================
  // SCENARIO: NO MODULE PERMISSIONS GRANTED
  // =========================================================================
  if (scope === 'none') {
    return (
      <div className="space-y-6">
        <div className="p-8 bg-[#101625] border border-slate-800 rounded-2xl text-center space-y-4 shadow-xl max-w-xl mx-auto my-12">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 mx-auto flex items-center justify-center">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div className="space-y-2">
            <h3 className="text-base font-semibold text-slate-100">لا توجد صلاحيات وحدات مخصصة لحسابك</h3>
            <p className="text-xs text-slate-400 leading-relaxed max-w-md mx-auto">
              لم يتم تعيين أي صلاحية وصول (إكسسوارات أو Compu MSS) لحسابك حالياً. تم حجب كافة الإحصائيات والبيانات لحماية خصوصية وسرية النظام.
            </p>
          </div>
          <div className="pt-2">
            <button
              onClick={fetchStats}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg transition-colors border border-slate-700 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>إعادة التحقق من الصلاحيات</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // SCENARIO: ACCESSORIES-ONLY USERS
  // =========================================================================
  if (scope === 'accessories') {
    return (
      <div className="space-y-6">
        {/* Scope Context Banner */}
        <div className="p-4 rounded-xl bg-[#101625] border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-amber-400"></span>
              <span className="text-xs font-mono text-amber-400">نطاق الصلاحيات: قسم الإكسسوارات فقط</span>
            </div>
            <h2 className="text-sm font-semibold text-slate-100">لوحة تحكم قسم الإكسسوارات (Accessories)</h2>
            <p className="text-xs text-slate-400 mt-0.5">مؤشرات الحسابات، نشاط المحل، وسجل العمليات المعزولة.</p>
          </div>

          <button
            onClick={() => onNavigate('users')}
            className="px-3.5 py-2 bg-slate-100 hover:bg-white text-slate-900 text-xs font-semibold rounded-lg shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Users className="w-4 h-4" />
            <span>إدارة مستخدمي الإكسسوارات</span>
          </button>
        </div>

        {/* KPI Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-[#101625] border border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">مستخدمو الإكسسوارات</span>
              <div className="w-8 h-8 rounded-lg bg-slate-800/80 border border-slate-700/60 text-slate-300 flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2.5 flex items-baseline justify-between">
              <span className="text-2xl font-bold text-slate-100 tabular-nums">{stats.totalAppUsers}</span>
              <span className="text-xs font-medium text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {stats.activeAppUsers} نشط
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">حسابات كاشير ومبيعات المحل</p>
          </div>

          <div className="p-4 rounded-xl bg-[#101625] border border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">قاعدة البيانات المحلية</span>
              <div className="w-8 h-8 rounded-lg bg-slate-800/80 border border-slate-700/60 text-slate-300 flex items-center justify-center">
                <HardDrive className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2.5 flex items-baseline justify-between">
              <span className="text-base font-semibold text-slate-200">SQLite محلي</span>
              <span className="text-xs text-sky-400 font-mono">100% مستقل</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">تخزين بيانات المبيعات محلياً</p>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // SCENARIO: FULL ACCESS (BOTH MODULES / SUPER ADMIN)
  // =========================================================================
  return (
    <div className="space-y-6">
      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Users */}
        <div className="p-4 rounded-xl bg-[#101625] border border-slate-800/90 shadow-sm hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">المستخدمين المسجلين</span>
            <div className="w-8 h-8 rounded-lg bg-slate-800/80 border border-slate-700/60 text-slate-300 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-100 tabular-nums">{stats.totalAppUsers}</span>
            <span className="text-xs font-medium text-emerald-400 flex items-center gap-1 font-mono">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {stats.activeAppUsers} نشط
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1.5">حسابات الفروع المصرح لها بالدخول</p>
        </div>



        {/* Card 4: Module Distribution */}
        <div className="p-4 rounded-xl bg-[#101625] border border-slate-800/90 shadow-sm hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">صلاحيات الأقسام</span>
            <div className="w-8 h-8 rounded-lg bg-slate-800/80 border border-slate-700/60 text-slate-300 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-100 tabular-nums">
              {stats.modulesBreakdown.both}
            </span>
            <span className="text-xs text-sky-400 font-mono">كلا النشاطين</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1.5 font-mono">
            {stats.modulesBreakdown.accessoriesOnly} إكسسوارات • {stats.modulesBreakdown.mssOnly} Compu MSS
          </p>
        </div>
      </div>

      {/* Main Content Sections: 2-Column Balanced Composition */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left Column: Permissions Breakdown & System Health (1 col) */}
        <div className="lg:col-span-1 space-y-5">
          {/* Card: Permissions Distribution */}
          <div className="p-4 rounded-xl bg-[#101625] border border-slate-800/90 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-slate-200">توزيع صلاحيات المستخدمين</h3>
              <span className="text-[10px] text-slate-500 font-mono">Module Access</span>
            </div>

            <div className="space-y-3">
              {/* Both */}
              <div>
                <div className="flex justify-between text-xs mb-1 font-mono">
                  <span className="text-slate-300">Accessories + MSS</span>
                  <span className="text-sky-400 font-semibold">{stats.modulesBreakdown.both}</span>
                </div>
                <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-sky-500 rounded-full"
                    style={{
                      width: `${stats.totalAppUsers ? (stats.modulesBreakdown.both / stats.totalAppUsers) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>

              {/* Accessories Only */}
              <div>
                <div className="flex justify-between text-xs mb-1 font-mono">
                  <span className="text-slate-300">Accessories Only</span>
                  <span className="text-amber-400 font-semibold">{stats.modulesBreakdown.accessoriesOnly}</span>
                </div>
                <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-500 rounded-full"
                    style={{
                      width: `${stats.totalAppUsers ? (stats.modulesBreakdown.accessoriesOnly / stats.totalAppUsers) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>

              {/* MSS Only */}
              <div>
                <div className="flex justify-between text-xs mb-1 font-mono">
                  <span className="text-slate-300">Compu MSS Only</span>
                  <span className="text-emerald-400 font-semibold">{stats.modulesBreakdown.mssOnly}</span>
                </div>
                <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full"
                    style={{
                      width: `${stats.totalAppUsers ? (stats.modulesBreakdown.mssOnly / stats.totalAppUsers) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="pt-3.5 border-t border-slate-800/80 mt-3.5">
              <button
                onClick={() => onNavigate('users')}
                className="w-full py-2 bg-slate-850 bg-[#141b2b] hover:bg-slate-800 text-slate-300 text-xs font-medium rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-slate-800"
              >
                <span>إدارة وتعديل الصلاحيات</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>


        </div>

        {/* Right Column: Recent Administrative Audit Log (2 cols) */}
        <div className="lg:col-span-2 p-4 rounded-xl bg-[#101625] border border-slate-800/90 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-800/80">
              <div>
                <h3 className="text-xs font-semibold text-slate-200">سجل العمليات والنشاطات الإدارية</h3>
                <p className="text-[11px] text-slate-500">سجل عمليات إنشاء وتعديل المستخدمين والفروع وتحويلات الأجهزة</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onNavigate('audit')}
                  className="flex items-center gap-1 text-[11px] text-sky-400 hover:text-sky-300 transition-colors cursor-pointer"
                >
                  <span>عرض السجل الكامل</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={fetchStats}
                  title="تحديث السجل"
                  className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="space-y-2 overflow-y-auto max-h-[320px] pr-0.5">
              {stats.recentAuditLogs.length === 0 ? (
                <div className="text-center py-10 text-xs text-slate-500 font-mono">
                  لا توجد عمليات تدقيق مسجلة حتى الآن
                </div>
              ) : (
                stats.recentAuditLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-2.5 rounded-lg bg-[#0d121d] border border-slate-800/70 flex items-center justify-between text-xs hover:border-slate-700/80 transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-md bg-slate-800 border border-slate-700/80 text-sky-400 flex items-center justify-center font-mono text-[10px] font-bold">
                        {log.eventType.slice(0, 3)}
                      </div>
                      <div>
                        <div className="font-medium text-slate-200 text-xs">
                          {typeof log.metadata?.description === 'string' ? (
                            log.metadata.description
                          ) : (
                            <>
                              {log.eventType === 'USER_CREATE' && 'إنشاء حساب مستخدم جديد'}
                              {log.eventType === 'USER_UPDATE' && 'تحديث بيانات مستخدم'}
                              {log.eventType === 'USER_PERMISSIONS_CHANGE' && 'تعديل صلاحيات مستخدم'}
                              {log.eventType === 'USER_ACCESS_CODE_CHANGE' && 'تغيير وتشفير رمز الدخول'}
                              {log.eventType === 'USER_STATUS_CHANGE' && 'تغيير حالة مستخدم'}
                              {log.eventType === 'USER_DELETE' && 'حذف حساب مستخدم'}
                              {log.eventType === 'STORE_CREATE' && 'إضافة فرع / مخزن جديد'}
                              {log.eventType === 'STORE_UPDATE' && 'تحديث بيانات فرع / مخزن'}
                              {log.eventType === 'STORE_STATUS_CHANGE' && 'تغيير حالة فرع / مخزن'}
                              {log.eventType === 'INVENTORY_TRANSFER_COMPLETED' && 'تحويل مخزون بين الفروع'}
                              {log.eventType === 'ADMIN_LOGIN_SUCCESS' && 'تسجيل دخول إداري ناجح'}
                              {log.eventType === 'SYSTEM_INITIALIZATION' && 'تهيئة نظام الإدارة'}
                              {!['USER_CREATE', 'USER_UPDATE', 'USER_PERMISSIONS_CHANGE', 'USER_ACCESS_CODE_CHANGE', 'USER_STATUS_CHANGE', 'USER_DELETE', 'STORE_CREATE', 'STORE_UPDATE', 'STORE_STATUS_CHANGE', 'INVENTORY_TRANSFER_COMPLETED', 'ADMIN_LOGIN_SUCCESS', 'SYSTEM_INITIALIZATION'].includes(log.eventType) && log.eventType}
                            </>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          بواسطة: <span className="text-slate-400">{log.actorUsername}</span>
                          {log.targetType && (
                            <span> • {log.targetType} #{log.targetId?.slice(0, 8)}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-[10px] text-slate-500 flex items-center gap-1 font-mono">
                      <Clock className="w-3 h-3 text-slate-600" />
                      <span>{new Date(log.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
