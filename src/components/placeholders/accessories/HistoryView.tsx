import React, { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Table, Column } from '@/components/common/Table';
import { Badge } from '@/components/common/Badge';
import { Card } from '@/components/common/Card';
import { Input } from '@/components/common/Input';
import { Select } from '@/components/common/Select';
import { Button } from '@/components/common/Button';
import { Spinner } from '@/components/common/Spinner';
import {
  Search,
  RotateCcw,
  History,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { historyService } from '@/services/historyService.ts';
import type { AuditLogEntry, AuditActionType } from '@/types/history.ts';

export const HistoryView: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Filters
  const [actionType, setActionType] = useState<AuditActionType | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const loadLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await historyService.getAuditLog({
        actionType,
        searchQuery,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      setLogs(data);
    } catch (err) {
      console.warn('Failed to load audit logs:', err);
    } finally {
      setIsLoading(false);
    }
  }, [actionType, searchQuery, startDate, endDate]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const handleResetFilters = () => {
    setActionType('ALL');
    setSearchQuery('');
    setStartDate('');
    setEndDate('');
  };

  const getActionBadge = (type: AuditActionType, title: string) => {
    switch (type) {
      case 'SALE':
        return <Badge variant="primary">{title}</Badge>;
      case 'RETURN':
        return <Badge variant="danger">{title}</Badge>;
      case 'PURCHASE':
        return <Badge variant="info">{title}</Badge>;
      case 'STOCK_ADJUSTMENT':
        return <Badge variant="warning">{title}</Badge>;
      case 'BACKUP':
        return <Badge variant="success">{title}</Badge>;
      default:
        return <Badge variant="default">{title}</Badge>;
    }
  };

  const columns: Column<AuditLogEntry>[] = [
    {
      key: 'referenceNumber',
      header: 'المرجع',
      render: (item: AuditLogEntry) => (
        <span className="font-mono font-semibold text-slate-800 text-xs tabular-nums">
          {item.referenceNumber || item.id}
        </span>
      ),
    },
    {
      key: 'timestamp',
      header: 'التاريخ والوقت',
      render: (item: AuditLogEntry) => (
        <span className="font-mono text-slate-500 text-xs tabular-nums">
          {item.timestamp ? item.timestamp.replace('T', ' ').substring(0, 19) : item.date}
        </span>
      ),
    },
    {
      key: 'actor',
      header: 'المستخدم',
      render: (item: AuditLogEntry) => (
        <span className="font-medium text-slate-800 text-xs">{item.actor}</span>
      ),
    },
    {
      key: 'actionType',
      header: 'نوع العملية',
      render: (item: AuditLogEntry) => getActionBadge(item.actionType, item.actionTitle),
    },
    {
      key: 'amount',
      header: 'المبلغ',
      render: (item: AuditLogEntry) => (
        <span
          className={`font-mono text-xs font-semibold tabular-nums ${
            item.amount === null || item.amount === undefined
              ? 'text-slate-400'
              : item.amount < 0
              ? 'text-rose-600'
              : 'text-slate-900'
          }`}
        >
          {item.amount !== null && item.amount !== undefined ? formatCurrency(item.amount) : '—'}
        </span>
      ),
    },
    {
      key: 'details',
      header: 'التفاصيل',
      render: (item: AuditLogEntry) => (
        <span className="text-xs text-slate-600 leading-relaxed">{item.details}</span>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="سجل العمليات والتدقيق"
        subtitle="سجل تتبعي شامل ومحمي لكافة عمليات البيع والمرتجعات والمشتريات والتسويات الجردية"
      />

      {/* Filter Toolbar */}
      <Card className="p-3 bg-white border-slate-200/80 shadow-2xs">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          {/* Search input */}
          <div className="md:col-span-4">
            <Input
              placeholder="ابحث في التفاصيل، المرجع، أو المنفذ..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              leftIcon={<Search className="w-4 h-4 text-slate-400" />}
              className="text-xs"
            />
          </div>

          {/* Action Type Dropdown */}
          <div className="md:col-span-3">
            <Select
              value={actionType}
              onChange={e => setActionType(e.target.value as any)}
              options={[
                { value: 'ALL', label: 'جميع أنواع العمليات' },
                { value: 'SALE', label: 'فواتير مبيعات (SALE)' },
                { value: 'RETURN', label: 'مرتجعات مبيعات (RETURN)' },
                { value: 'PURCHASE', label: 'وارد مشتريات (PURCHASE)' },
                { value: 'STOCK_ADJUSTMENT', label: 'تسويات جردية (ADJUSTMENT)' },
                { value: 'BACKUP', label: 'نسخ احتياطي (BACKUP)' },
              ]}
              className="text-xs font-medium"
            />
          </div>

          {/* Date range */}
          <div className="md:col-span-4 flex items-center gap-2">
            <Input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="text-xs font-mono"
              title="من تاريخ"
            />
            <span className="text-xs text-slate-400">إلى</span>
            <Input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="text-xs font-mono"
              title="إلى تاريخ"
            />
          </div>

          {/* Reset button */}
          <div className="md:col-span-1 flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetFilters}
              title="إعادة تعيين الفلاتر"
            >
              <RotateCcw className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Audit Log Table */}
      {isLoading ? (
        <div className="p-16 flex flex-col items-center justify-center bg-white rounded-xl border border-slate-200/80">
          <Spinner size="lg" />
          <p className="text-xs text-slate-500 mt-3">جارٍ جلب السجل التدقيقي للعمليات...</p>
        </div>
      ) : logs.length === 0 ? (
        <div className="p-16 text-center bg-white rounded-xl border border-slate-200/80 space-y-3">
          <History className="w-10 h-10 text-slate-300 mx-auto" />
          <p className="text-sm font-semibold text-slate-800">لا توجد عمليات مطابقة للفلاتر المحددة</p>
          <p className="text-xs text-slate-400">تأكد من خيارات البحث أو قم بإعادة تعيين الفلاتر</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200/80 overflow-hidden shadow-2xs">
          <Table
            columns={columns}
            data={logs}
            keyExtractor={(item: AuditLogEntry) => item.id}
          />
        </div>
      )}
    </div>
  );
};
