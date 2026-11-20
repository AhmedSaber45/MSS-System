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
} from 'lucide-react';
import type { OverviewStats } from '@/types/admin';
import type { NavTab } from '../layout/AdminSidebar';

interface OverviewViewProps {
  onNavigate: (tab: NavTab) => void;
}

export const OverviewView: React.FC<OverviewViewProps> = ({ onNavigate }) => {
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
        <RefreshCw className="w-8 h-8 animate-spin text-brand-primary" />
        <p className="text-sm">جاري تحميل بيانات لوحة التحكم...</p>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="p-6 bg-rose-950/20 border border-rose-900/40 rounded-xl text-rose-300 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-6 h-6 text-rose-400" />
          <span>{error || 'تعذر تحميل الإحصائيات'}</span>
        </div>
        <button
          onClick={fetchStats}
          className="px-3 py-1.5 bg-rose-900/50 hover:bg-rose-900 text-xs rounded-lg transition-colors"
        >
          إعادة المحاولة
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Welcome & Quick Actions */}
      <div className="p-5 rounded-xl bg-brand-card border border-brand-border flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
            <span className="text-xs font-semibold text-emerald-400">نظام الإدارة المركزي جاهز ونشط</span>
          </div>
          <h2 className="text-lg font-bold text-white">مرحباً بك في لوحة تحكم Compu MSS</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            إدارة الحسابات الإدارية، صلاحيات مستخدمي المحلات، وتشفير رموز الدخول وسياسات الأمان المركزية.
          </p>
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto">
          <button
            onClick={() => onNavigate('users')}
            className="flex-1 md:flex-none px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg shadow-sm flex items-center justify-center gap-1.5 transition-colors"
          >
            <Users className="w-4 h-4" />
            <span>إدارة المستخدمين</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total App Users */}
        <div className="p-5 rounded-xl bg-brand-card border border-brand-border hover:border-brand-primary/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">مستخدمو التطبيق</span>
            <div className="w-9 h-9 rounded-lg bg-blue-500/10 text-brand-primary flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-white">{stats.totalAppUsers}</span>
            <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {stats.activeAppUsers} نشط
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">حسابات الفروع المصرح لها بتسجيل الدخول</p>
        </div>

        {/* Stores & Warehouses */}
        <div className="p-5 rounded-xl bg-brand-card border border-brand-border hover:border-brand-primary/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">الفروع والمخازن</span>
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <Store className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-white">{stats.totalStores + stats.totalWarehouses}</span>
            <span className="text-xs text-slate-400">
              {stats.activeStores} محل • {stats.totalWarehouses} مخزن
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">الوحدات التنظيمية المرتبطة بالنظام</p>
        </div>

        {/* Module Permissions Distribution */}
        <div className="p-5 rounded-xl bg-brand-card border border-brand-border hover:border-brand-primary/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">توزيع الصلاحيات</span>
            <div className="w-9 h-9 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-white">{stats.modulesBreakdown.both}</span>
            <span className="text-xs text-purple-400 font-medium">كلا النشاطين</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
            إكسسوارات: {stats.modulesBreakdown.accessoriesOnly} • Compu MSS: {stats.modulesBreakdown.mssOnly}
          </p>
        </div>

        {/* Security & Audit Status */}
        <div className="p-5 rounded-xl bg-brand-card border border-brand-border hover:border-brand-primary/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">الأمان والتشفير</span>
            <div className="w-9 h-9 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-base font-bold text-emerald-400">تشفير Bcrypt</span>
            <span className="text-xs text-slate-400">RLS مفعل</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">عزل كامل لبيانات الإكسسوارات المحلية</p>
        </div>
      </div>

      {/* Module Permissions Breakdown & Architecture Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Module breakdown progress */}
        <div className="lg:col-span-1 p-5 rounded-xl bg-brand-card border border-brand-border flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-white mb-1">صلاحيات الوحدات (Modules)</h3>
            <p className="text-xs text-slate-400 mb-4">توزيع صلاحيات الحسابات بين النشاطين</p>

            <div className="space-y-3.5">
              <div>
                <div className="flex justify-between text-xs font-medium mb-1">
                  <span className="text-slate-300">كلا النشاطين (Accessories + MSS)</span>
                  <span className="text-brand-primary font-bold">{stats.modulesBreakdown.both} مستخدم</span>
                </div>
                <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-brand-primary rounded-full"
                    style={{
                      width: `${stats.totalAppUsers ? (stats.modulesBreakdown.both / stats.totalAppUsers) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-medium mb-1">
                  <span className="text-slate-300">إكسسوارات فقط (Accessories Only)</span>
                  <span className="text-amber-400 font-bold">{stats.modulesBreakdown.accessoriesOnly} مستخدم</span>
                </div>
                <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-500 rounded-full"
                    style={{
                      width: `${stats.totalAppUsers ? (stats.modulesBreakdown.accessoriesOnly / stats.totalAppUsers) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-medium mb-1">
                  <span className="text-slate-300">Compu MSS فقط</span>
                  <span className="text-emerald-400 font-bold">{stats.modulesBreakdown.mssOnly} مستخدم</span>
                </div>
                <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full"
                    style={{
                      width: `${stats.totalAppUsers ? (stats.modulesBreakdown.mssOnly / stats.totalAppUsers) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-brand-border mt-4">
            <button
              onClick={() => onNavigate('users')}
              className="w-full py-2 bg-brand-surface hover:bg-slate-800 text-slate-300 text-xs font-medium rounded-lg flex items-center justify-center gap-1.5 transition-colors"
            >
              <span>إدارة وتعديل الصلاحيات</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Recent Audit Activity Stream */}
        <div className="lg:col-span-2 p-5 rounded-xl bg-brand-card border border-brand-border flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-white">آخر النشاطات الإدارية</h3>
                <p className="text-xs text-slate-400">سجل العمليات الإدارية المنفذة مؤخراً</p>
              </div>
              <span className="text-[11px] text-slate-500 font-medium">
                (سجل التدقيق الشامل متاح بتطبيق المكتبي)
              </span>
            </div>

            <div className="space-y-2.5 overflow-y-auto max-h-[220px]">
              {stats.recentAuditLogs.length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-500">لا توجد عمليات تدقيق مسجلة حتى الآن</div>
              ) : (
                stats.recentAuditLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-2.5 rounded-lg bg-brand-surface/60 border border-brand-border/60 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-md bg-brand-primary/10 text-brand-primary flex items-center justify-center font-bold text-[10px]">
                        {log.eventType.slice(0, 3)}
                      </div>
                      <div>
                        <div className="font-semibold text-slate-200">
                          {log.eventType === 'USER_CREATE' && 'إنشاء حساب مستخدم جديد'}
                          {log.eventType === 'USER_UPDATE' && 'تحديث بيانات مستخدم'}
                          {log.eventType === 'USER_ACCESS_CODE_CHANGE' && 'تغيير وتشفير رمز الدخول'}
                          {log.eventType === 'USER_STATUS_CHANGE' && 'تغيير حالة مستخدم'}
                          {log.eventType === 'STORE_CREATE' && 'إضافة فرع / مخزن جديد'}
                          {log.eventType === 'STORE_UPDATE' && 'تحديث بيانات فرع / مخزن'}
                          {log.eventType === 'STORE_STATUS_CHANGE' && 'تغيير حالة فرع / مخزن'}
                          {log.eventType === 'ADMIN_LOGIN_SUCCESS' && 'تسجيل دخول إداري ناجح'}
                          {log.eventType === 'SYSTEM_INITIALIZATION' && 'تهيئة نظام الإدارة'}
                          {!['USER_CREATE', 'USER_UPDATE', 'USER_ACCESS_CODE_CHANGE', 'USER_STATUS_CHANGE', 'STORE_CREATE', 'STORE_UPDATE', 'STORE_STATUS_CHANGE', 'ADMIN_LOGIN_SUCCESS', 'SYSTEM_INITIALIZATION'].includes(log.eventType) && log.eventType}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          بواسطة: <span className="text-slate-300 font-medium">{log.actorUsername}</span> • الهدف: {log.targetType} #{log.targetId.slice(0, 8)}
                        </div>
                      </div>
                    </div>
                    <div className="text-[10px] text-slate-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
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
