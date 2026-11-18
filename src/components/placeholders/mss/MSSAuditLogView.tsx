import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { Select } from '@/components/common/Select';
import { Badge } from '@/components/common/Badge';
import { Modal } from '@/components/common/Modal';
import { Spinner } from '@/components/common/Spinner';
import { useNotification } from '@/context/NotificationContext';
import { usePageRefresh } from '@/context/PageRefreshContext';
import { mssOperationalService } from '@/services/mssOperationalService';
import { formatDate } from '@/lib/utils';
import type { AdminAuditLog, AuditTargetType } from '@/types/mssOperational';
import {
  ShieldAlert,
  Search,
  RefreshCw,
  Clock,
  User,
  ShieldCheck,
  FileJson,
  Lock,
  Eye,
  Filter,
  Building,
  Boxes,
  Key,
} from 'lucide-react';

export const MSSAuditLogView: React.FC = () => {
  const { showNotification } = useNotification();
  const { isRefreshing, triggerRefresh } = usePageRefresh();

  const [logs, setLogs] = useState<AdminAuditLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [targetFilter, setTargetFilter] = useState<'all' | AuditTargetType>('all');
  const [selectedLog, setSelectedLog] = useState<AdminAuditLog | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await mssOperationalService.getAuditLogs(150);
      setLogs(data);
    } catch (err: any) {
      console.warn('Failed to fetch audit logs:', err);
      showNotification({
        type: 'error',
        title: 'خطأ في جلب سجل التدقيق',
        message: err.message || 'تعذر تحميل سجل الحركات الإدارية',
      });
    } finally {
      setLoading(false);
    }
  }, [showNotification]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const getEventBadge = (eventType: string) => {
    switch (eventType) {
      case 'USER_CREATE':
        return { label: 'إنشاء مستخدم', variant: 'primary' as const };
      case 'USER_UPDATE':
        return { label: 'تعديل مستخدم', variant: 'default' as const };
      case 'USER_ACCESS_CODE_CHANGE':
        return { label: 'تغيير رمز الدخول', variant: 'warning' as const };
      case 'USER_STATUS_CHANGE':
        return { label: 'تغيير حالة الحساب', variant: 'danger' as const };
      case 'STORE_CREATE':
        return { label: 'إضافة فرع / مخزن', variant: 'primary' as const };
      case 'STORE_UPDATE':
        return { label: 'تحديث فرع / مخزن', variant: 'default' as const };
      case 'STORE_STATUS_CHANGE':
        return { label: 'تعطيل/تفعيل/أرشفة فرع', variant: 'danger' as const };
      case 'INVENTORY_TRANSFER_COMPLETED':
        return { label: 'تحويل مخزون مكتمل', variant: 'success' as const };
      case 'ADMIN_LOGIN_SUCCESS':
        return { label: 'دخول إداري', variant: 'info' as const };
      case 'ADMIN_LOGOUT':
        return { label: 'خروج إداري', variant: 'default' as const };
      default:
        return { label: eventType, variant: 'default' as const };
    }
  };

  const getTargetIcon = (targetType: AuditTargetType) => {
    switch (targetType) {
      case 'user':
        return <User className="w-3.5 h-3.5 text-blue-600" />;
      case 'store':
        return <Building className="w-3.5 h-3.5 text-indigo-600" />;
      case 'inventory':
        return <Boxes className="w-3.5 h-3.5 text-emerald-600" />;
      case 'auth':
        return <Key className="w-3.5 h-3.5 text-amber-600" />;
      default:
        return <ShieldCheck className="w-3.5 h-3.5 text-slate-500" />;
    }
  };

  const filteredLogs = useMemo(() => {
    return logs.filter(l => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        l.eventType.toLowerCase().includes(q) ||
        l.actorUsername.toLowerCase().includes(q) ||
        l.targetId.toLowerCase().includes(q);

      const matchesTarget = targetFilter === 'all' || l.targetType === targetFilter;
      return matchesSearch && matchesTarget;
    });
  }, [logs, searchQuery, targetFilter]);

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <PageHeader
        title="سجل النشاط والتدقيق الإداري (Activity & Audit Trail)"
        subtitle="سجل تدقيق مركزي غير قابل للتعديل لتوثيق كافة الحركات الإدارية والعمليات الحساسة لنظام Compu MSS"
        actions={
          <Button
            variant="outline"
            size="md"
            onClick={() => triggerRefresh(fetchLogs, 'جارٍ تحديث سجل التدقيق المركزي...')}
            disabled={isRefreshing || loading}
            leftIcon={<RefreshCw className={`w-4.5 h-4.5 text-slate-600 ${isRefreshing ? 'animate-spin' : ''}`} />}
          >
            تحديث السجل
          </Button>
        }
      />

      {/* Immutability Notice Banner */}
      <Card className="p-3.5 bg-slate-900 border border-slate-800 text-slate-200 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/20 text-blue-400 rounded-lg">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-white text-xs">سجل موثق سحابياً محمي ضد التعديل (Append-Only Audit Log)</h4>
            <p className="text-[11px] text-slate-400 mt-0.5">
              كل حركة إدارية تسجل بصمة المسؤول والتوقيت ولقطة البيانات التفصيلية. الحذف أو التعديل محظور بموجب سياسات RLS لقاعدة البيانات.
            </p>
          </div>
        </div>
        <Badge variant="success" size="sm" className="hidden sm:inline-flex">
          محمي وموثق
        </Badge>
      </Card>

      {/* Filter Bar */}
      <Card className="p-3 bg-white border border-slate-200 shadow-xs">
        <div className="flex flex-col md:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="البحث بنوع العملية أو اسم المنفذ أو المعرف..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pr-9 text-xs"
            />
          </div>

          <div className="w-full md:w-56">
            <Select
              value={targetFilter}
              onChange={e => setTargetFilter(e.target.value as any)}
              options={[
                { value: 'all', label: 'كافة أنواع الكيانات' },
                { value: 'user', label: 'المستخدمون والموظفون' },
                { value: 'store', label: 'الفروع والمخازن' },
                { value: 'inventory', label: 'المخزون والتحويلات' },
                { value: 'auth', label: 'جلسات الدخول والأمان' },
                { value: 'system', label: 'تهيئة النظام' },
              ]}
              className="text-xs"
            />
          </div>
        </div>
      </Card>

      {/* Audit Log Table */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-12 text-slate-400 gap-3">
          <Spinner size="lg" />
          <p className="text-xs">جارٍ جلب سجلات التدقيق...</p>
        </div>
      ) : filteredLogs.length === 0 ? (
        <Card className="p-8 text-center bg-white border border-slate-200">
          <ShieldAlert className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">لا توجد حركات مسجلة</h3>
          <p className="text-xs text-slate-500 mt-1">
            لم يتم العثور على سجلات تدقيق تطابق معايير البحث الحالية.
          </p>
        </Card>
      ) : (
        <Card className="border border-slate-200 bg-white overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-3.5">المنفذ (Actor)</th>
                  <th className="py-3 px-3.5">نوع العملية</th>
                  <th className="py-3 px-3.5">الكيان المستهدف</th>
                  <th className="py-3 px-3.5">التوقيت</th>
                  <th className="py-3 px-3.5 text-center">التفاصيل والبيانات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredLogs.map(log => {
                  const badge = getEventBadge(log.eventType);
                  return (
                    <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-3.5">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-slate-100 border border-slate-300 flex items-center justify-center font-bold text-slate-700">
                            {log.actorUsername.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 block">{log.actorUsername}</span>
                            <span className="text-[10px] text-slate-400 font-mono">ID: {log.actorId.slice(0, 8)}</span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-3.5">
                        <Badge variant={badge.variant} size="sm">
                          {badge.label}
                        </Badge>
                      </td>

                      <td className="py-3 px-3.5">
                        <div className="flex items-center gap-1.5">
                          {getTargetIcon(log.targetType)}
                          <span className="font-bold text-slate-700 uppercase text-[11px]">
                            {log.targetType}
                          </span>
                          <span className="font-mono text-slate-500 text-[10px]">
                            ({log.targetId.slice(0, 10)})
                          </span>
                        </div>
                      </td>

                      <td className="py-3 px-3.5 text-slate-600 font-mono text-[11px] tabular-nums" dir="ltr">
                        {formatDate(log.createdAt)}
                      </td>

                      <td className="py-3 px-3.5 text-center">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedLog(log)}
                          leftIcon={<Eye className="w-3.5 h-3.5" />}
                          className="text-[11px]"
                        >
                          عرض البيانات
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Metadata Detail Modal */}
      {selectedLog && (
        <Modal
          isOpen={!!selectedLog}
          onClose={() => setSelectedLog(null)}
          title={`تفاصيل حركة التدقيق: ${selectedLog.eventType}`}
          subtitle={`المنفذ: ${selectedLog.actorUsername} | التوقيت: ${formatDate(selectedLog.createdAt)}`}
          size="md"
          footer={
            <div className="flex justify-end w-full">
              <Button variant="outline" size="md" onClick={() => setSelectedLog(null)}>
                إغلاق
              </Button>
            </div>
          }
        >
          <div className="space-y-3.5 text-xs">
            <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <div>
                <span className="text-slate-400 block text-[10px]">معرف الحركة:</span>
                <span className="font-mono text-slate-800 select-all">{selectedLog.id}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">الكيان المستهدف:</span>
                <span className="font-mono text-slate-800 select-all">
                  {selectedLog.targetType} ({selectedLog.targetId})
                </span>
              </div>
            </div>

            <div>
              <span className="font-bold text-slate-800 block mb-1">لقطة البيانات الموثقة (Metadata Snapshot):</span>
              <pre
                className="p-3 bg-slate-900 text-slate-100 rounded-xl font-mono text-[11px] overflow-x-auto max-h-60 leading-relaxed"
                dir="ltr"
              >
                {JSON.stringify(selectedLog.metadata, null, 2)}
              </pre>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
