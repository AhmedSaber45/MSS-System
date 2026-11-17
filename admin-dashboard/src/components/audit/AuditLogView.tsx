'use client';

import React, { useEffect, useState } from 'react';
import {
  ShieldAlert,
  Search,
  RefreshCw,
  Clock,
  User,
  ShieldCheck,
  FileJson,
  Lock,
} from 'lucide-react';
import type { AdminAuditLog, AuditTargetType } from '@/types/admin';

export const AuditLogView: React.FC = () => {
  const [logs, setLogs] = useState<AdminAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [targetFilter, setTargetFilter] = useState<'all' | AuditTargetType>('all');
  const [selectedLog, setSelectedLog] = useState<AdminAuditLog | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/audit');
      const data = await res.json();
      setLogs(data.logs || []);
    } catch {
      // Handled
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const getEventBadge = (eventType: string) => {
    switch (eventType) {
      case 'USER_CREATE':
        return { label: 'إنشاء مستخدم', color: 'bg-emerald-950/60 text-emerald-400 border-emerald-800/50' };
      case 'USER_UPDATE':
        return { label: 'تعديل مستخدم', color: 'bg-blue-950/60 text-blue-400 border-blue-800/50' };
      case 'USER_ACCESS_CODE_CHANGE':
        return { label: 'تغيير رمز الدخول', color: 'bg-amber-950/60 text-amber-400 border-amber-800/50' };
      case 'USER_STATUS_CHANGE':
        return { label: 'تغيير حالة الحساب', color: 'bg-purple-950/60 text-purple-400 border-purple-800/50' };
      case 'STORE_CREATE':
        return { label: 'إضافة فرع / مخزن', color: 'bg-cyan-950/60 text-cyan-400 border-cyan-800/50' };
      case 'STORE_UPDATE':
        return { label: 'تحديث فرع / مخزن', color: 'bg-indigo-950/60 text-indigo-400 border-indigo-800/50' };
      case 'STORE_STATUS_CHANGE':
        return { label: 'تعطيل/تفعيل فرع', color: 'bg-rose-950/60 text-rose-400 border-rose-800/50' };
      case 'ADMIN_LOGIN_SUCCESS':
        return { label: 'دخول إداري', color: 'bg-teal-950/60 text-teal-400 border-teal-800/50' };
      case 'ADMIN_LOGOUT':
        return { label: 'خروج إداري', color: 'bg-slate-800 text-slate-300 border-slate-700' };
      case 'SYSTEM_INITIALIZATION':
        return { label: 'تهيئة النظام', color: 'bg-blue-900/60 text-blue-200 border-blue-700/50' };
      default:
        return { label: eventType, color: 'bg-slate-800 text-slate-400 border-slate-700' };
    }
  };

  const filteredLogs = logs.filter((l) => {
    const matchesSearch =
      l.eventType.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.actorUsername.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.targetId.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTarget = targetFilter === 'all' || l.targetType === targetFilter;
    return matchesSearch && matchesTarget;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-brand-primary" />
            <span>سجل النشاط والتدقيق الإداري (Audit Trail)</span>
          </h2>
          <p className="text-xs text-slate-400">
            سجل غير قابل للتعديل أو الحذف لتوثيق كافة العمليات الإدارية الحساسة لضمان الشفافية والمساءلة
          </p>
        </div>

        <button
          onClick={fetchLogs}
          className="px-3 py-2 bg-brand-surface hover:bg-slate-800 text-slate-300 border border-brand-border rounded-lg text-xs flex items-center gap-2 transition-colors self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-brand-primary' : ''}`} />
          <span>تحديث السجل</span>
        </button>
      </div>

      {/* Immutability & Security Notice */}
      <div className="p-3.5 bg-slate-900/60 border border-brand-border rounded-xl text-xs flex items-center gap-2.5 text-slate-300">
        <Lock className="w-4 h-4 text-emerald-400 shrink-0" />
        <span className="text-[11px] leading-relaxed">
          <strong>ضمان عدم التلاعب (Immutability):</strong> جدول سجل التدقيق محمي على مستوى قاعدة البيانات بسياسات RLS
          تمنع عمليات التعديل (UPDATE) أو الحذف (DELETE) نهائياً. يتم تنقيح البيانات المدخلة تلقائياً لمنع تسجيل أي
          كلمات مرور أو رموز دخول صريحة.
        </span>
      </div>

      {/* Filter Toolbar */}
      <div className="p-4 bg-brand-card border border-brand-border rounded-xl flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="بحث بالنوع، اسم المشرف، أو المعرف..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-3 pr-10 py-2 bg-brand-surface border border-brand-border rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-brand-primary"
          />
        </div>

        <select
          value={targetFilter}
          onChange={(e) => setTargetFilter(e.target.value as any)}
          className="px-3 py-2 bg-brand-surface border border-brand-border rounded-lg text-xs text-slate-200 focus:outline-none focus:border-brand-primary"
        >
          <option value="all">كافة الأهداف</option>
          <option value="user">المستخدمون (Users)</option>
          <option value="store">الفروع والمخازن (Stores)</option>
          <option value="auth">جلسات الدخول (Auth)</option>
          <option value="system">النظام العام (System)</option>
        </select>
      </div>

      {/* Logs Table */}
      <div className="bg-brand-card border border-brand-border rounded-xl overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-brand-surface/80 border-b border-brand-border text-slate-400 font-semibold uppercase text-[11px]">
              <tr>
                <th className="py-3 px-4">التاريخ والوقت</th>
                <th className="py-3 px-4">المشرف المسؤول</th>
                <th className="py-3 px-4">نوع الحدث الإداري</th>
                <th className="py-3 px-4">الهدف والمعرف</th>
                <th className="py-3 px-4 text-center">التفاصيل الفنية</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-border text-slate-300">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-500">
                    <ShieldAlert className="w-8 h-8 mx-auto text-slate-600 mb-2" />
                    <p className="text-sm font-semibold text-slate-300">
                      {loading
                        ? 'جاري التحميل...'
                        : logs.length === 0
                        ? 'لا توجد سجلات تدقيق حتى الآن'
                        : 'لا توجد سجلات تدقيق مطابقة لمعايير البحث'}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      {logs.length === 0
                        ? 'يتم توثيق كافة العمليات الإدارية الحساسة آلياً وفور حدوثها'
                        : 'جرب تعديل مصطلح البحث أو تصفية نوع الهدف'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const badge = getEventBadge(log.eventType);
                  return (
                    <tr key={log.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3.5 px-4 font-mono text-[11px] text-slate-400">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-500" />
                          <span>
                            {new Date(log.createdAt).toLocaleString('ar-EG', {
                              dateStyle: 'short',
                              timeStyle: 'medium',
                            })}
                          </span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 font-semibold text-slate-200">
                          <User className="w-3.5 h-3.5 text-brand-primary" />
                          <span>{log.actorUsername}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${badge.color}`}
                        >
                          {badge.label}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="text-slate-300 font-medium">
                          {log.targetType === 'user' && 'مستخدم تطبيق'}
                          {log.targetType === 'store' && 'فرع / مخزن'}
                          {log.targetType === 'auth' && 'جلسة مصادقة'}
                          {log.targetType === 'system' && 'نظام عام'}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">#{log.targetId.slice(0, 16)}</div>
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded text-[11px] font-mono flex items-center justify-center gap-1 mx-auto transition-colors"
                        >
                          <FileJson className="w-3.5 h-3.5" />
                          <span>عرض JSON</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: JSON Details */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-brand-card border border-brand-border rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-brand-border pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <FileJson className="w-4 h-4 text-brand-primary" />
                <span>بيانات تفاصيل الحدث: {selectedLog.eventType}</span>
              </h3>
              <button onClick={() => setSelectedLog(null)} className="text-slate-400 hover:text-white text-sm">
                ✕
              </button>
            </div>

            <div className="p-3 bg-brand-surface rounded-xl border border-brand-border font-mono text-xs text-slate-300 max-h-80 overflow-y-auto ltr text-left dir-ltr">
              <pre>{JSON.stringify(selectedLog, null, 2)}</pre>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-1.5 bg-brand-surface hover:bg-slate-800 text-slate-300 text-xs rounded-lg transition-colors"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
