import React, { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/common/Button';
import { Table, Column } from '@/components/common/Table';
import { Badge } from '@/components/common/Badge';
import { Alert } from '@/components/common/Alert';
import { Card } from '@/components/common/Card';
import { Modal } from '@/components/common/Modal';
import { Spinner } from '@/components/common/Spinner';
import {
  RefreshCw,
  AlertTriangle,
  Clock,
  Cloud,
  CheckCircle2,
  Copy,
  Check,
  ShieldAlert,
  ArrowRightLeft,
  Layers,
} from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { useNotification } from '@/context/NotificationContext';
import { mssSyncService } from '@/services/mssSyncService';
import type {
  OutboxOperation,
  MSSConflict,
  SyncStateSummary,
  ConflictResolutionStatus,
} from '@/types/mssSync';

export const SyncStatusView: React.FC = () => {
  const { showNotification } = useNotification();

  const [outbox, setOutbox] = useState<OutboxOperation[]>([]);
  const [conflicts, setConflicts] = useState<MSSConflict[]>([]);
  const [summary, setSummary] = useState<SyncStateSummary | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [copiedUUID, setCopiedUUID] = useState<string | null>(null);

  // Conflict Resolution Modal
  const [selectedConflict, setSelectedConflict] = useState<MSSConflict | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState<string>('تمت التسوية والمراجعة مع العميل والفرع الآخر');
  const [isResolving, setIsResolving] = useState<boolean>(false);

  // Load Sync State
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [outboxList, conflictsList, sum] = await Promise.all([
        mssSyncService.getOutbox(),
        mssSyncService.getConflicts(),
        mssSyncService.getSyncSummary(),
      ]);
      setOutbox(outboxList);
      setConflicts(conflictsList);
      setSummary(sum);
    } catch (err: any) {
      console.error('Failed to load sync status:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    // Periodic check every 15 seconds
    const interval = setInterval(loadData, 15000);
    return () => clearInterval(interval);
  }, [loadData]);

  // Copy UUID
  const handleCopyUUID = (uuid: string) => {
    navigator.clipboard.writeText(uuid);
    setCopiedUUID(uuid);
    setTimeout(() => setCopiedUUID(null), 2000);
    showNotification({
      type: 'info',
      title: 'تم النسخ',
      message: `تم نسخ معرف العملية (${uuid}) إلى الحافظة`,
    });
  };

  // Manual Sync Now
  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      const result = await mssSyncService.syncOutbox();
      showNotification({
        type: 'success',
        title: 'اكتملت دورة المزامنة',
        message: `تمت مزامنة (${result.synced}) عملية، ورصد (${result.conflicts}) تعارض، وفشل (${result.failed}) عملية.`,
      });
      await loadData();
    } catch (err: any) {
      showNotification({
        type: 'error',
        title: 'فشلت المزامنة',
        message: err.message || 'تعذر استكمال المزامنة السحابية',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // Resolve Conflict
  const handleResolveConflict = async (resolution: ConflictResolutionStatus) => {
    if (!selectedConflict || isResolving) return;

    setIsResolving(true);
    try {
      await mssSyncService.resolveConflict(
        selectedConflict.id,
        resolution,
        resolutionNotes,
        'مدير النظام بالمحل'
      );

      showNotification({
        type: 'success',
        title: 'تمت تسوية التعارض بنجاح',
        message: `تم اعتماد قرار التسوية (${resolution}) وحفظه في سجلات النظام`,
      });

      setSelectedConflict(null);
      await loadData();
    } catch (err: any) {
      showNotification({
        type: 'error',
        title: 'خطأ في التسوية',
        message: err.message || 'تعذر تسوية التعارض',
      });
    } finally {
      setIsResolving(false);
    }
  };

  // Table Columns for Outbox
  const outboxColumns: Column<OutboxOperation>[] = [
    {
      key: 'uuid',
      header: 'معرف العملية (UUID)',
      render: (item: OutboxOperation) => (
        <div className="flex items-center gap-1 font-mono text-xs">
          <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded border border-slate-200 select-all font-semibold tabular-nums">
            {item.uuid.substring(0, 13)}...
          </span>
          <button
            onClick={() => handleCopyUUID(item.uuid)}
            title="نسخ المعرف كاملاً"
            className="text-slate-400 hover:text-slate-700 p-0.5 rounded"
          >
            {copiedUUID === item.uuid ? (
              <Check className="w-3.5 h-3.5 text-emerald-600" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'نوع العملية',
      render: (item: OutboxOperation) => {
        switch (item.type) {
          case 'SALE_CREATE':
            return <Badge variant="success">بيع جهاز</Badge>;
          case 'RESERVATION_CREATE':
            return <Badge variant="warning">حجز جهاز</Badge>;
          case 'RESERVATION_CANCEL':
            return <Badge variant="danger">إلغاء حجز</Badge>;
          case 'RETURN_PROCESS':
            return <Badge variant="info">إرجاع جهاز</Badge>;
          case 'DEVICE_ADD':
            return <Badge variant="primary">تسجيل جهاز</Badge>;
          case 'DEVICE_TRANSFER':
            return <Badge variant="default">نقل جهاز</Badge>;
          default:
            return <Badge variant="default">{item.type}</Badge>;
        }
      },
    },
    {
      key: 'branch',
      header: 'الفرع',
      render: (item: OutboxOperation) => (
        <Badge variant={item.branch === 'محل 1' ? 'primary' : 'default'}>
          {item.branch}
        </Badge>
      ),
    },
    {
      key: 'client_timestamp',
      header: 'التوقيت المحلي',
      render: (item: OutboxOperation) => (
        <span className="font-mono text-xs text-slate-500 tabular-nums">
          {formatDate(item.client_timestamp)}
        </span>
      ),
    },
    {
      key: 'description',
      header: 'البيان والتفاصيل',
      render: (item: OutboxOperation) => (
        <span className="font-medium text-slate-800 text-xs max-w-xs truncate block" title={item.description}>
          {item.description}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'حالة المزامنة',
      render: (item: OutboxOperation) => {
        switch (item.status) {
          case 'SYNCED':
            return <Badge variant="success">متزامن</Badge>;
          case 'PENDING':
            return <Badge variant="info">معلق</Badge>;
          case 'SYNCING':
            return <Badge variant="warning">جاري المزامنة</Badge>;
          case 'CONFLICT':
            return <Badge variant="danger">تعارض</Badge>;
          case 'FAILED':
            return <Badge variant="default">فشل</Badge>;
          default:
            return <Badge variant="default">{item.status}</Badge>;
        }
      },
    },
    {
      key: 'retries',
      header: 'المحاولات',
      render: (item: OutboxOperation) => (
        <span className="font-mono text-xs text-slate-500 font-semibold tabular-nums">
          {item.retries}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="المزامنة السحابية وطابور العمليات"
        subtitle="متابعة طابور العمليات المعلقة وضمان استمرارية العمل بدون إنترنت مع الكشف التلقائي للتعارضات"
        actions={
          <Button
            variant="primary"
            size="sm"
            onClick={handleManualSync}
            disabled={isSyncing}
            leftIcon={isSyncing ? <Spinner size="sm" /> : <RefreshCw className="w-4 h-4" />}
          >
            {isSyncing ? 'جاري المزامنة...' : 'بدء مزامنة فورية الآن'}
          </Button>
        }
      />

      {/* Limitation Notice Banner (Rule 10 & 25) */}
      <Alert
        type="info"
        title="توضيح هندسي هام لقاعدة العمل في وضع عدم الاتصال (Rule 10 & Rule 25)"
        message="لا يمكن لأي نظامين منفصلين تماماً عن الإنترنت منع بيع نفس الجهاز مرتين إذا تم البيع في نفس اللحظة بكلا المحلين بدون اتصال. يوفر النظام كشفاً تلقائياً لهذه التعارضات فور عودة الاتصال مع الحفاظ التام على سجل كلا العمليتين وتوفير نافذة مراجعة وتصفية يدوية آمنة دون أي فقدان للبيانات."
      />

      {/* 4 Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 bg-white border border-slate-200/80 shadow-2xs">
          <p className="text-xs text-slate-500 font-medium mb-1">حالة الاتصال بالسحابة</p>
          <div className="flex items-baseline justify-between">
            <span
              className={`text-lg font-semibold ${
                summary?.is_online ? 'text-emerald-700' : 'text-amber-700'
              }`}
            >
              {summary?.is_online ? 'متصل ونشط' : 'وضع عدم الاتصال'}
            </span>
            <Cloud
              className={`w-4 h-4 ${
                summary?.is_online ? 'text-emerald-600' : 'text-amber-600'
              }`}
            />
          </div>
          <span className="text-[11px] text-slate-400">
            {summary?.is_online ? 'سيرفر Supabase متاح' : 'يتم الحفظ في الطابور المحلي'}
          </span>
        </Card>

        <Card className="p-4 bg-white border border-slate-200/80 shadow-2xs">
          <p className="text-xs text-slate-500 font-medium mb-1">العمليات المعلقة بالطابور</p>
          <div className="flex items-baseline justify-between">
            <span className="text-lg font-semibold text-slate-900 font-mono tabular-nums">{summary?.pending_count || 0}</span>
            <Clock className="w-4 h-4 text-slate-400" />
          </div>
          <span className="text-[11px] text-slate-400">في انتظار الرفع الآلي</span>
        </Card>

        <Card className="p-4 bg-white border border-slate-200/80 shadow-2xs">
          <p className="text-xs text-slate-500 font-medium mb-1">العمليات المكتملة المتزامنة</p>
          <div className="flex items-baseline justify-between">
            <span className="text-lg font-semibold text-slate-900 font-mono tabular-nums">{summary?.synced_count || 0}</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <span className="text-[11px] text-slate-400">تم تأكيدها في سحابة Supabase</span>
        </Card>

        <Card className="p-4 bg-white border border-slate-200/80 shadow-2xs">
          <p className="text-xs text-slate-500 font-medium mb-1">التعارضات المسجلة</p>
          <div className="flex items-baseline justify-between">
            <span
              className={`text-lg font-semibold font-mono tabular-nums ${
                (summary?.conflict_count || 0) > 0 ? 'text-rose-600' : 'text-slate-900'
              }`}
            >
              {summary?.conflict_count || 0}
            </span>
            <AlertTriangle
              className={`w-4 h-4 ${
                (summary?.conflict_count || 0) > 0 ? 'text-rose-600' : 'text-slate-400'
              }`}
            />
          </div>
          <span className="text-[11px] text-slate-400">
            {(summary?.conflict_count || 0) > 0 ? 'تتطلب مراجعة وتسوية' : 'لا توجد تعارضات معلقة'}
          </span>
        </Card>
      </div>

      {/* ========================================================================= */}
      {/* SECTION: Pending Conflicts (If Any) */}
      {/* ========================================================================= */}
      {conflicts.filter(c => c.resolution_status === 'PENDING').length > 0 && (
        <Card className="p-4 bg-white border-amber-200/80 shadow-2xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-amber-600" />
              <h3 className="text-xs font-semibold text-slate-900">
                تعارضات غير متصلة تم رصدها بحاجة لمراجعة وتسوية (Rule 10 & Rule 25)
              </h3>
            </div>
            <span className="text-xs font-mono text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200/80">
              {conflicts.filter(c => c.resolution_status === 'PENDING').length} تعارض
            </span>
          </div>

          <div className="space-y-2">
            {conflicts
              .filter(c => c.resolution_status === 'PENDING')
              .map(cnf => (
                <div
                  key={cnf.id}
                  className="p-3 bg-slate-50 border border-slate-200/80 rounded-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <Badge variant="danger">{cnf.conflict_type}</Badge>
                      <span className="font-mono text-xs font-semibold bg-slate-100 text-slate-800 px-2 py-0.5 rounded border border-slate-200 tabular-nums">
                        {cnf.serial_number}
                      </span>
                      <span className="text-slate-500">تم في: {cnf.branch}</span>
                    </div>
                    <p className="font-medium text-slate-800">{cnf.conflict_description}</p>
                  </div>

                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      setSelectedConflict(cnf);
                      setResolutionNotes('تمت التسوية والمراجعة المباشرة مع العميل');
                    }}
                    className="shrink-0"
                    leftIcon={<ArrowRightLeft className="w-3.5 h-3.5" />}
                  >
                    مراجعة وتسوية التعارض
                  </Button>
                </div>
              ))}
          </div>
        </Card>
      )}

      {/* ========================================================================= */}
      {/* SECTION: Outbox Queue Table */}
      {/* ========================================================================= */}
      <Card className="bg-white border-slate-200/80 shadow-2xs overflow-hidden">
        <div className="p-3.5 bg-slate-50/75 border-b border-slate-200/80 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-slate-500" />
            <h3 className="text-xs font-semibold text-slate-900">
              طابور العمليات الصادرة والمزامنة (Outbox Audit Log)
            </h3>
          </div>
          <span className="text-xs text-slate-400 font-mono tabular-nums">
            {outbox.length} عملية مسجلة محلياً
          </span>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-xs text-slate-500">
            <Spinner size="sm" className="mx-auto mb-2" />
            جاري تحميل سجلات الطابور...
          </div>
        ) : (
          <Table
            columns={outboxColumns}
            data={outbox}
            keyExtractor={(item: OutboxOperation) => item.uuid}
          />
        )}
      </Card>

      {/* ========================================================================= */}
      {/* MODAL: Conflict Resolution Dialog */}
      {/* ========================================================================= */}
      <Modal
        isOpen={!!selectedConflict}
        onClose={() => !isResolving && setSelectedConflict(null)}
        title="مراجعة وتسوية التعارض الناتج عن وضع عدم الاتصال"
        subtitle={`تسوية تعارض السيريال (${selectedConflict?.serial_number}) المسجل بفرع (${selectedConflict?.branch})`}
        size="lg"
        footer={
          <div className="flex items-center justify-between w-full">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedConflict(null)}
              disabled={isResolving}
            >
              إلغاء
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleResolveConflict('RESOLVED_MANUALLY')}
              disabled={isResolving}
              leftIcon={isResolving ? <Spinner size="sm" /> : <CheckCircle2 className="w-4 h-4" />}
            >
              {isResolving ? 'جاري التسوية...' : 'اعتماد التسوية اليدوية'}
            </Button>
          </div>
        }
      >
        {selectedConflict && (
          <div className="space-y-4 text-xs font-sans">
            <Alert
              type="danger"
              title="طبيعة التعارض"
              message={selectedConflict.conflict_description}
            />

            {/* Side-by-side comparison */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Local state */}
              <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-lg space-y-2">
                <span className="font-semibold text-slate-800 text-xs block border-b border-slate-200/80 pb-1">
                  1. العملية المحلية بفرع ({selectedConflict.branch}):
                </span>
                <pre className="font-mono text-[11px] bg-white p-2.5 rounded border border-slate-200/80 overflow-x-auto text-slate-800">
                  {JSON.stringify(selectedConflict.local_payload, null, 2)}
                </pre>
              </div>

              {/* Remote conflicting state */}
              <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-lg space-y-2">
                <span className="font-semibold text-slate-800 text-xs block border-b border-slate-200/80 pb-1">
                  2. السجل السحابي المتعارض:
                </span>
                <pre className="font-mono text-[11px] bg-white p-2.5 rounded border border-slate-200/80 overflow-x-auto text-slate-800">
                  {JSON.stringify(selectedConflict.remote_state || 'لا توجد بيانات سحابية إضافية', null, 2)}
                </pre>
              </div>
            </div>

            {/* Resolution Notes Input */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                بيان التسوية والإجراء المتخذ (Audit Notes) <span className="text-rose-500">*</span>
              </label>
              <textarea
                className="w-full px-3 py-2 text-xs border border-slate-200/80 rounded-lg focus:outline-none focus:border-slate-400 transition-colors"
                rows={3}
                placeholder="اكتب تفاصيل الاتفاق (مثال: تم تسليم عميل محل 1 جهازاً بديلاً بنفس المواصفات أو استرداد المبلغ)..."
                value={resolutionNotes}
                onChange={e => setResolutionNotes(e.target.value)}
                required
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
