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
import { usePageRefresh } from '@/context/PageRefreshContext';
import { mssSyncService } from '@/services/mssSyncService';
import type {
  OutboxOperation,
  MSSConflict,
  SyncStateSummary,
  ConflictResolutionStatus,
} from '@/types/mssSync';

export const SyncStatusView: React.FC = () => {
  const { showNotification } = useNotification();
  const { isRefreshing, triggerRefresh } = usePageRefresh();

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
        <div className="flex items-center gap-1.5 font-mono text-xs">
          <span className="bg-slate-100 text-slate-900 px-2.5 py-1 rounded-md border border-slate-300 select-all font-bold tabular-nums">
            {item.uuid.substring(0, 13)}...
          </span>
          <button
            onClick={() => handleCopyUUID(item.uuid)}
            title="نسخ المعرف كاملاً"
            className="text-slate-400 hover:text-slate-800 p-1 rounded transition-colors"
          >
            {copiedUUID === item.uuid ? (
              <Check className="w-4 h-4 text-emerald-600" />
            ) : (
              <Copy className="w-4 h-4" />
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
            return <Badge variant="success" size="sm">بيع جهاز</Badge>;
          case 'RESERVATION_CREATE':
            return <Badge variant="warning" size="sm">حجز جهاز</Badge>;
          case 'RESERVATION_CANCEL':
            return <Badge variant="danger" size="sm">إلغاء حجز</Badge>;
          case 'RETURN_PROCESS':
            return <Badge variant="info" size="sm">إرجاع جهاز</Badge>;
          case 'DEVICE_ADD':
            return <Badge variant="primary" size="sm">تسجيل جهاز</Badge>;
          case 'DEVICE_TRANSFER':
            return <Badge variant="default" size="sm">نقل جهاز</Badge>;
          default:
            return <Badge variant="default" size="sm">{item.type}</Badge>;
        }
      },
    },
    {
      key: 'branch',
      header: 'الفرع',
      render: (item: OutboxOperation) => (
        <Badge variant={item.branch === 'محل 1' ? 'primary' : 'default'} size="sm">
          {item.branch}
        </Badge>
      ),
    },
    {
      key: 'client_timestamp',
      header: 'التوقيت المحلي',
      render: (item: OutboxOperation) => (
        <span className="font-mono text-sm font-medium text-slate-600 tabular-nums">
          {formatDate(item.client_timestamp)}
        </span>
      ),
    },
    {
      key: 'description',
      header: 'البيان والتفاصيل',
      render: (item: OutboxOperation) => (
        <span className="font-bold text-slate-900 text-sm max-w-xs truncate block" title={item.description}>
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
            return <Badge variant="success" size="sm">متزامن</Badge>;
          case 'PENDING':
            return <Badge variant="info" size="sm">معلق</Badge>;
          case 'SYNCING':
            return <Badge variant="warning" size="sm">جاري المزامنة</Badge>;
          case 'CONFLICT':
            return <Badge variant="danger" size="sm">تعارض</Badge>;
          case 'FAILED':
            return <Badge variant="default" size="sm">فشل</Badge>;
          default:
            return <Badge variant="default" size="sm">{item.status}</Badge>;
        }
      },
    },
    {
      key: 'retries',
      header: 'المحاولات',
      render: (item: OutboxOperation) => (
        <span className="font-mono text-sm text-slate-700 font-bold tabular-nums">
          {item.retries}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="المزامنة السحابية  "
        subtitle=""
        actions={
          <div className="flex items-center gap-2.5">
            <Button
              variant="outline"
              size="md"
              onClick={() => triggerRefresh(loadData, 'جارٍ تحديث حالة المزامنة  ...')}
              disabled={isRefreshing || isLoading}
              leftIcon={<RefreshCw className={`w-4.5 h-4.5 text-slate-600 ${isRefreshing ? 'animate-spin' : ''}`} />}
              className="border-slate-300 font-semibold"
            >
              Refresh
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={handleManualSync}
              disabled={isSyncing}
              className="font-bold"
              leftIcon={isSyncing ? <Spinner size="sm" /> : <RefreshCw className="w-4.5 h-4.5" />}
            >
              {isSyncing ? 'جاري المزامنة...' : 'بدء مزامنة فورية الآن'}
            </Button>
          </div>
        }
      />


      {/* 4 Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 bg-white border border-slate-300 shadow-2xs">
          <p className="text-sm text-slate-600 font-semibold mb-1">حالة الاتصال بالسحابة</p>
          <div className="flex items-baseline justify-between">
            <span
              className={`text-2xl font-bold ${
                summary?.is_online ? 'text-emerald-700' : 'text-amber-700'
              }`}
            >
              {summary?.is_online ? 'متصل ' : 'وضع عدم الاتصال'}
            </span>
            <Cloud
              className={`w-5 h-5 ${
                summary?.is_online ? 'text-emerald-600' : 'text-amber-600'
              }`}
            />
          </div>
          <span className="text-xs text-slate-500 mt-1 block">
            {summary?.is_online ? '  متاح' : 'يتم الحفظ   محليا'}
          </span>
        </Card>

        <Card className="p-4 bg-white border border-slate-300 shadow-2xs">
          <p className="text-sm text-slate-600 font-semibold mb-1">العمليات المعلقة </p>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-900 font-mono tabular-nums">{summary?.pending_count || 0}</span>
            <Clock className="w-5 h-5 text-slate-500" />
          </div>
        </Card>

        <Card className="p-4 bg-white border border-slate-300 shadow-2xs">
          <p className="text-sm text-slate-600 font-semibold mb-1">العمليات المكتملة </p>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-900 font-mono tabular-nums">{summary?.synced_count || 0}</span>
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          </div>
        </Card>

        <Card className="p-4 bg-white border border-slate-300 shadow-2xs">
          <p className="text-sm text-slate-600 font-semibold mb-1">التعارضات المسجلة</p>
          <div className="flex items-baseline justify-between">
            <span
              className={`text-2xl font-bold font-mono tabular-nums ${
                (summary?.conflict_count || 0) > 0 ? 'text-rose-600' : 'text-slate-900'
              }`}
            >
              {summary?.conflict_count || 0}
            </span>
            <AlertTriangle
              className={`w-5 h-5 ${
                (summary?.conflict_count || 0) > 0 ? 'text-rose-600' : 'text-slate-400'
              }`}
            />
          </div>
          <span className="text-xs text-slate-500 mt-1 block">
            {(summary?.conflict_count || 0) > 0 ? 'تتطلب مزامنة ' : 'لا توجد تعارضات معلقة'}
          </span>
        </Card>
      </div>

      {/* ========================================================================= */}
      {/* SECTION: Pending Conflicts (If Any) */}
      {/* ========================================================================= */}
      {conflicts.filter(c => c.resolution_status === 'PENDING').length > 0 && (
        <Card className="p-4 bg-white border-amber-300 shadow-2xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-amber-600" />
              <h3 className="text-sm font-bold text-slate-900">
                تعارضات   تم رصدها بحاجة  لمزامنة 
              </h3>
            </div>
            <span className="text-xs font-mono font-bold text-amber-800 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-300">
              {conflicts.filter(c => c.resolution_status === 'PENDING').length} تعارض
            </span>
          </div>

          <div className="space-y-3">
            {conflicts
              .filter(c => c.resolution_status === 'PENDING')
              .map(cnf => (
                <div
                  key={cnf.id}
                  className="p-4 bg-slate-50 border border-slate-300 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-sm"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <Badge variant="danger" size="sm">{cnf.conflict_type}</Badge>
                      <span className="font-mono text-xs font-bold bg-slate-100 text-slate-900 px-2.5 py-1 rounded-md border border-slate-300 tabular-nums">
                        {cnf.serial_number}
                      </span>
                      <span className="text-slate-600 font-semibold text-xs">تم في: {cnf.branch}</span>
                    </div>
                    <p className="font-bold text-slate-900 text-sm">{cnf.conflict_description}</p>
                  </div>

                  <Button
                    variant="primary"
                    size="md"
                    onClick={() => {
                      setSelectedConflict(cnf);
                      setResolutionNotes('تمت التسوية والمراجعة المباشرة مع العميل');
                    }}
                    className="shrink-0 font-bold"
                    leftIcon={<ArrowRightLeft className="w-4 h-4" />}
                  >
                    مراجعة ومزامنة التعارض
                  </Button>
                </div>
              ))}
          </div>
        </Card>
      )}

      {/* ========================================================================= */}
      {/* SECTION: Outbox Queue Table */}
      {/* ========================================================================= */}
      <Card className="bg-white border-slate-300 shadow-2xs overflow-hidden">
        <div className="p-4 bg-slate-100/90 border-b border-slate-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-slate-600" />
            <h3 className="text-sm font-bold text-slate-900">
               العمليات الصادرة  
            </h3>
          </div>
          <span className="text-xs text-slate-600 font-mono font-bold tabular-nums">
            {outbox.length} عملية مسجلة محلياً
          </span>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-sm font-medium text-slate-600">
            <Spinner size="lg" className="mx-auto mb-3" />
            جاري تحميل السجلات ...
          </div>
        ) : (
          <div className="overflow-hidden">
            <Table
              columns={outboxColumns}
              data={outbox}
              keyExtractor={(item: OutboxOperation) => item.uuid}
            />
          </div>
        )}
      </Card>

      {/* ========================================================================= */}
      {/* MODAL: Conflict Resolution Dialog */}
      {/* ========================================================================= */}
      <Modal
        isOpen={!!selectedConflict}
        onClose={() => !isResolving && setSelectedConflict(null)}
        title="مراجعة ومزامنة التعارض الناتج عن وضع عدم الاتصال"
        subtitle={`تسوية تعارض السيريال (${selectedConflict?.serial_number}) المسجل بفرع (${selectedConflict?.branch})`}
        size="lg"
        footer={
          <div className="flex items-center justify-between w-full">
            <Button
              variant="outline"
              size="md"
              onClick={() => setSelectedConflict(null)}
              disabled={isResolving}
            >
              إلغاء
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={() => handleResolveConflict('RESOLVED_MANUALLY')}
              disabled={isResolving}
              className="font-bold"
              leftIcon={isResolving ? <Spinner size="sm" /> : <CheckCircle2 className="w-4.5 h-4.5" />}
            >
              {isResolving ? 'جاري المزامنة...' : 'اعتماد المزامنة اليدوية'}
            </Button>
          </div>
        }
      >
        {selectedConflict && (
          <div className="space-y-4 text-sm font-sans">


            {/* Side-by-side comparison */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Local state */}
              <div className="p-4 bg-slate-50 border border-slate-300 rounded-xl space-y-2">
                <span className="font-bold text-slate-900 text-sm block border-b border-slate-200 pb-1.5">
                  1. العملية المحلية بفرع ({selectedConflict.branch}):
                </span>
                <pre className="font-mono text-xs bg-white p-3 rounded-lg border border-slate-300 overflow-x-auto text-slate-900">
                  {JSON.stringify(selectedConflict.local_payload, null, 2)}
                </pre>
              </div>

              {/* Remote conflicting state */}
              <div className="p-4 bg-slate-50 border border-slate-300 rounded-xl space-y-2">
                <span className="font-bold text-slate-900 text-sm block border-b border-slate-200 pb-1.5">
                  2. السجل  المتعارض:
                </span>
                <pre className="font-mono text-xs bg-white p-3 rounded-lg border border-slate-300 overflow-x-auto text-slate-900">
                  {JSON.stringify(selectedConflict.remote_state || 'لا توجد بيانات سحابية إضافية', null, 2)}
                </pre>
              </div>
            </div>

            {/* Resolution Notes Input */}
            <div>
              <label className="block text-sm font-semibold text-slate-800 mb-1.5">
                بيان المزامنة والإجراء المتخذ  <span className="text-rose-500">*</span>
              </label>
              <textarea
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900 transition-colors"
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
