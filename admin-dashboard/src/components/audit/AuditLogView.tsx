'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  ShieldAlert,
  Search,
  RefreshCw,
  Clock,
  CheckCircle2,
  XCircle,
  Filter,
  User,
  KeyRound,
  ShieldCheck,
  Building2,
  Laptop,
  ChevronLeft,
  ChevronRight,
  Info,
  AlertTriangle,
  Activity,
  Layers,
} from 'lucide-react';
import type { AdminAuditLog } from '@/types/admin';

type CategoryFilter = 'ALL' | 'AUTH' | 'USER' | 'STORE' | 'INVENTORY';
type StatusFilter = 'ALL' | 'SUCCESS' | 'FAILURE';

export const AuditLogView: React.FC = () => {
  const [logs, setLogs] = useState<AdminAuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Pagination
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('ALL');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // Details Modal
  const [selectedLog, setSelectedLog] = useState<AdminAuditLog | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('limit', pageSize.toString());
      params.set('offset', ((page - 1) * pageSize).toString());

      if (searchQuery.trim()) {
        params.set('search', searchQuery.trim());
      }

      if (statusFilter !== 'ALL') {
        params.set('status', statusFilter);
      }

      const res = await fetch(`/api/audit?${params.toString()}`);
      if (!res.ok) {
        throw new Error('فشل في جلب سجل النشاط من الخادم');
      }

      const data = await res.json();
      setLogs(data.logs || []);
      setTotal(data.total ?? (data.logs || []).length);
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء تحميل السجل');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, searchQuery, statusFilter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Client-side category filtering
  const filteredLogs = useMemo(() => {
    if (categoryFilter === 'ALL') return logs;

    return logs.filter((log) => {
      const evt = log.eventType.toUpperCase();
      if (categoryFilter === 'AUTH') {
        return (
          evt.includes('LOGIN') ||
          evt.includes('LOGOUT') ||
          evt.includes('TIMEOUT') ||
          evt.includes('SESSION')
        );
      }
      if (categoryFilter === 'USER') {
        return evt.startsWith('USER_') || evt.startsWith('ADMIN_');
      }
      if (categoryFilter === 'STORE') {
        return evt.startsWith('STORE_');
      }
      if (categoryFilter === 'INVENTORY') {
        return evt.includes('INVENTORY') || evt.includes('TRANSFER');
      }
      return true;
    });
  }, [logs, categoryFilter]);

  // Counters
  const counters = useMemo(() => {
    const successCount = logs.filter(
      (l) => l.metadata?.status === 'SUCCESS' || !l.metadata?.status
    ).length;
    const failureCount = logs.filter((l) => l.metadata?.status === 'FAILURE').length;
    const today = new Date().toDateString();
    const todayCount = logs.filter(
      (l) => new Date(l.createdAt).toDateString() === today
    ).length;

    return { successCount, failureCount, todayCount, totalDisplay: total || logs.length };
  }, [logs, total]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const getEventBadge = (eventType: string) => {
    const evt = eventType.toUpperCase();
    if (evt.includes('LOGIN_SUCCESS')) {
      return { label: 'تسجيل دخول', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' };
    }
    if (evt.includes('LOGIN_FAILURE') || evt.includes('LOGIN_REJECTED')) {
      return { label: 'دخول مرفوض/فاشل', color: 'bg-rose-500/10 text-rose-400 border-rose-500/20' };
    }
    if (evt.includes('LOGOUT')) {
      return { label: 'تسجيل خروج', color: 'bg-slate-500/10 text-slate-400 border-slate-500/20' };
    }
    if (evt.includes('INACTIVITY') || evt.includes('EXPIRED')) {
      return { label: 'انتهاء جلسة', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' };
    }
    if (evt === 'USER_CREATE') {
      return { label: 'إنشاء مستخدم', color: 'bg-sky-500/10 text-sky-400 border-sky-500/20' };
    }
    if (evt === 'USER_PERMISSIONS_CHANGE' || evt === 'USER_ROLE_CHANGE') {
      return { label: 'تعديل صلاحيات', color: 'bg-purple-500/10 text-purple-400 border-purple-500/20' };
    }
    if (evt === 'USER_UPDATE') {
      return { label: 'تحديث مستخدم', color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' };
    }
    if (evt === 'USER_STATUS_CHANGE') {
      return { label: 'تغيير حالة', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' };
    }
    if (evt === 'USER_ACCESS_CODE_CHANGE') {
      return { label: 'تغيير رمز الدخول', color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' };
    }
    if (evt === 'USER_DELETE' || evt === 'ADMIN_DELETE') {
      return { label: 'حذف مستخدم', color: 'bg-rose-500/10 text-rose-400 border-rose-500/20' };
    }
    if (evt.startsWith('STORE_')) {
      return { label: 'عملية فروع', color: 'bg-teal-500/10 text-teal-400 border-teal-500/20' };
    }
    if (evt.includes('INVENTORY') || evt.includes('TRANSFER')) {
      return { label: 'تحويل مخزون', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' };
    }
    return { label: eventType, color: 'bg-slate-500/10 text-slate-400 border-slate-500/20' };
  };

  const formatTimestamp = (iso: string) => {
    try {
      const date = new Date(iso);
      return date.toLocaleString('ar-EG', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and Counters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100">سجل النشاط  </h2>
              <p className="text-xs text-slate-400">
                تسجيل لحظي وتفصيلي غير قابل للتعديل لكافة عمليات الدخول، إدارة المستخدمين، وتغييرات النظام
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={fetchLogs}
          disabled={loading}
          className="flex items-center gap-2 px-3.5 py-1.5 bg-[#101625] hover:bg-slate-800 border border-slate-700/80 text-xs text-slate-200 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-sky-400' : ''}`} />
          <span>Refresh </span>
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl bg-[#101625] border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1.5">
            <span>إجمالي الأحداث</span>
            <Activity className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-xl font-bold font-mono text-slate-100">{counters.totalDisplay}</div>
        
        </div>

        <div className="p-3.5 rounded-xl bg-[#101625] border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1.5">
            <span>العمليات الناجحة</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl font-bold font-mono text-emerald-400">{counters.successCount}</div>
         
        </div>

        <div className="p-3.5 rounded-xl bg-[#101625] border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1.5">
            <span>محاولات مرفوضة  </span>
            <XCircle className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-xl font-bold font-mono text-rose-400">{counters.failureCount}</div>
          
        </div>

        <div className="p-3.5 rounded-xl bg-[#101625] border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1.5">
            <span>نشاط اليوم</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-xl font-bold font-mono text-amber-400">{counters.todayCount}</div>
          <p className="text-[10px] text-slate-500 mt-1">منذ بداية اليوم الحالي</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-3.5 rounded-xl bg-[#101625] border border-slate-800 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            placeholder="بحث بالمنفّذ، المستهدف، أو نوع العملية..."
            className="w-full bg-[#090d16] border border-slate-700/80 rounded-lg pr-9 pl-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
          />
        </div>

        {/* Category Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          <button
            onClick={() => setCategoryFilter('ALL')}
            className={`px-2.5 py-1 text-xs rounded-lg border transition-colors cursor-pointer whitespace-nowrap ${
              categoryFilter === 'ALL'
                ? 'bg-sky-500/10 text-sky-400 border-sky-500/30'
                : 'bg-[#090d16] text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
          >
            كافة العمليات
          </button>
          <button
            onClick={() => setCategoryFilter('AUTH')}
            className={`px-2.5 py-1 text-xs rounded-lg border transition-colors cursor-pointer whitespace-nowrap ${
              categoryFilter === 'AUTH'
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-[#090d16] text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
          >
            تسجيل الدخول والجلسات
          </button>
          <button
            onClick={() => setCategoryFilter('USER')}
            className={`px-2.5 py-1 text-xs rounded-lg border transition-colors cursor-pointer whitespace-nowrap ${
              categoryFilter === 'USER'
                ? 'bg-purple-500/10 text-purple-400 border-purple-500/30'
                : 'bg-[#090d16] text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
          >
            المستخدمين والصلاحيات
          </button>
          <button
            onClick={() => setCategoryFilter('STORE')}
            className={`px-2.5 py-1 text-xs rounded-lg border transition-colors cursor-pointer whitespace-nowrap ${
              categoryFilter === 'STORE'
                ? 'bg-teal-500/10 text-teal-400 border-teal-500/30'
                : 'bg-[#090d16] text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
          >
            الفروع والمخازن
          </button>
        </div>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as StatusFilter);
            setPage(1);
          }}
          className="bg-[#090d16] border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-sky-500"
        >
          <option value="ALL">كافة الحالات</option>
          <option value="SUCCESS">ناجحة فقط</option>
          <option value="FAILURE">فاشلة ومرفوضة فقط</option>
        </select>
      </div>

      {/* Main Table */}
      <div className="bg-[#101625] border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        {loading && logs.length === 0 ? (
          <div className="p-16 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
            <RefreshCw className="w-6 h-6 animate-spin text-sky-400" />
            <p className="text-xs font-mono">جاري تحميل سجل النشاط والتدقيق...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-rose-400 flex flex-col items-center justify-center gap-2">
            <AlertTriangle className="w-6 h-6 text-rose-500" />
            <p className="text-xs">{error}</p>
            <button
              onClick={fetchLogs}
              className="mt-2 px-3 py-1 bg-rose-950/40 hover:bg-rose-900 border border-rose-800 text-xs rounded-lg transition-colors cursor-pointer"
            >
              إعادة المحاولة
            </button>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-16 text-center text-slate-500 flex flex-col items-center justify-center gap-2 font-mono">
            <Clock className="w-8 h-8 text-slate-600 mb-1" />
            <p className="text-sm font-medium text-slate-300">لا توجد عمليات مسجلة تطابق معايير البحث</p>
            <p className="text-xs text-slate-500">
              سيتم ظهور العمليات الجديدة هنا تلقائياً بمجرد قيام المستخدمين أو المشرفين بأي إجراء.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-[#090d16] text-slate-400 border-b border-slate-800 font-medium">
                <tr>
                  <th className="py-3 px-4 font-mono">الوقت والتاريخ</th>
                  <th className="py-3 px-4">المنفّذ</th>
                  <th className="py-3 px-4">نوع العملية</th>
                  <th className="py-3 px-4">وصف العملية</th>
                  <th className="py-3 px-4">المستهدف</th>
                  <th className="py-3 px-4 text-center">الحالة</th>
                  <th className="py-3 px-4 text-center">التفاصيل</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredLogs.map((log) => {
                  const badge = getEventBadge(log.eventType);
                  const isSuccess = log.metadata?.status !== 'FAILURE';
                  const description =
                    typeof log.metadata?.description === 'string'
                      ? log.metadata.description
                      : `${badge.label} بواسطة ${log.actorUsername}`;

                  return (
                    <tr
                      key={log.id}
                      className="hover:bg-slate-800/30 transition-colors"
                    >
                      {/* Timestamp */}
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                        {formatTimestamp(log.createdAt)}
                      </td>

                      {/* Actor */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <div className="w-5 h-5 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 text-[10px]">
                            <User className="w-3 h-3" />
                          </div>
                          <span className="font-medium text-slate-200">{log.actorUsername}</span>
                        </div>
                      </td>

                      {/* Event Type Badge */}
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${badge.color}`}
                        >
                          {badge.label}
                        </span>
                      </td>

                      {/* Description */}
                      <td className="py-3 px-4">
                        <div className="font-normal text-slate-200 max-w-md truncate">
                          {description}
                        </div>
                        {log.metadata?.failureReason ? (
                          <div className="text-[10px] text-rose-400 mt-0.5 truncate">
                            سبب الرفض: {String(log.metadata.failureReason)}
                          </div>
                        ) : null}
                      </td>

                      {/* Target */}
                      <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                        {log.metadata?.targetUsername ? (
                          <span className="text-slate-300 font-medium">
                            {String(log.metadata.targetUsername)}
                          </span>
                        ) : log.targetId && log.targetId !== 'system' ? (
                          <span>
                            {log.targetType}: #{log.targetId.slice(0, 8)}
                          </span>
                        ) : (
                          <span className="text-slate-600">النظام</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 text-center">
                        {isSuccess ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>نجاح</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                            <XCircle className="w-3 h-3" />
                            <span>فشل</span>
                          </span>
                        )}
                      </td>

                      {/* Action Button */}
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => setSelectedLog(log)}
                          title="عرض تفاصيل العملية"
                          className="p-1 hover:bg-slate-700/60 rounded text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                        >
                          <Info className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        <div className="p-3.5 bg-[#090d16] border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2 font-mono">
            <span>عرض</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(parseInt(e.target.value, 10));
                setPage(1);
              }}
              className="bg-[#101625] border border-slate-700/80 rounded px-1.5 py-0.5 text-xs text-slate-300 focus:outline-none"
            >
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>
            <span>سجل لكل صفحة (إجمالي: {total})</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px]">
              صفحة {page} من {totalPages}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || loading}
                className="p-1 rounded bg-[#101625] hover:bg-slate-800 border border-slate-800 disabled:opacity-40 transition-colors cursor-pointer"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || loading}
                className="p-1 rounded bg-[#101625] hover:bg-slate-800 border border-slate-800 disabled:opacity-40 transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Details Modal */}
      {selectedLog && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn"
          onClick={() => setSelectedLog(null)}
        >
          <div
            className="bg-[#101625] border border-slate-800 rounded-2xl max-w-lg w-full p-5 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-sky-400" />
                <h3 className="text-sm font-semibold text-slate-100">تفاصيل العملية الإدارية</h3>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-slate-500 hover:text-slate-200 transition-colors text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 p-3 rounded-lg bg-[#090d16] border border-slate-800">
                <div>
                  <span className="text-slate-500 block text-[10px]">نوع العملية</span>
                  <span className="text-slate-200 font-mono">{selectedLog.eventType}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">المنفّذ</span>
                  <span className="text-slate-200 font-mono">{selectedLog.actorUsername} ({selectedLog.actorId})</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">المستهدف</span>
                  <span className="text-slate-200 font-mono">{selectedLog.targetType}: {selectedLog.targetId}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">التوقيت (UTC)</span>
                  <span className="text-slate-200 font-mono">{formatTimestamp(selectedLog.createdAt)}</span>
                </div>
              </div>

              <div>
                <span className="text-slate-400 block mb-1">الوصف المباشر:</span>
                <p className="p-2.5 rounded-lg bg-sky-950/20 border border-sky-900/40 text-sky-200">
                  {typeof selectedLog.metadata?.description === 'string'
                    ? selectedLog.metadata.description
                    : selectedLog.eventType}
                </p>
              </div>

              {selectedLog.metadata?.failureReason ? (
                <div>
                  <span className="text-rose-400 block mb-1">سبب الفشل:</span>
                  <p className="p-2.5 rounded-lg bg-rose-950/20 border border-rose-900/40 text-rose-300">
                    {String(selectedLog.metadata.failureReason)}
                  </p>
                </div>
              ) : null}

              <div>
                <span className="text-slate-400 block mb-1">البيانات الإضافية الآمنة (Metadata):</span>
                <pre className="p-3 rounded-lg bg-[#090d16] border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto max-h-48 text-left dir-ltr">
                  {JSON.stringify(selectedLog.metadata || {}, null, 2)}
                </pre>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 rounded-lg transition-colors cursor-pointer"
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
