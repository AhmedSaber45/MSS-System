import React, { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { Select } from '@/components/common/Select';
import { Table, Column } from '@/components/common/Table';
import { Badge } from '@/components/common/Badge';
import { Card } from '@/components/common/Card';
import { Modal } from '@/components/common/Modal';
import { Alert } from '@/components/common/Alert';
import { Spinner } from '@/components/common/Spinner';
import { useNotification } from '@/context/NotificationContext';
import { mssInventoryService } from '@/services/mssInventoryService';
import { formatDate } from '@/lib/utils';
import type { MSSDeviceMovement, MSSDevice, MSSStockLocation } from '@/types/mssInventory';
import {
  Plus,
  Search,
  ArrowLeftRight,
  Store,
  History,
  CheckCircle2,
  RotateCcw,
} from 'lucide-react';

export const MovementsView: React.FC = () => {
  const { showNotification } = useNotification();

  const [movements, setMovements] = useState<MSSDeviceMovement[]>([]);
  const [availableDevices, setAvailableDevices] = useState<MSSDevice[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [locationFilter, setLocationFilter] = useState<'ALL' | MSSStockLocation>('ALL');

  // Transfer Modal State
  const [isTransferModalOpen, setIsTransferModalOpen] = useState<boolean>(false);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [transferTargetLocation, setTransferTargetLocation] = useState<MSSStockLocation>('محل 2');
  const [transferNotes, setTransferNotes] = useState<string>('');
  const [transferError, setTransferError] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Load Data
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [movList, devList] = await Promise.all([
        mssInventoryService.getMovements(),
        mssInventoryService.getDevices(),
      ]);
      setMovements(movList);
      // Filter devices eligible for transfer (AVAILABLE or RESERVED or MAINTENANCE)
      setAvailableDevices(devList.filter(d => d.status !== 'SOLD'));
    } catch (err: any) {
      console.error('Failed to load movements:', err);
      showNotification({
        type: 'error',
        title: 'خطأ في جلب السجلات',
        message: err.message || 'تعذر تحميل سجلات حركات الأجهزة',
      });
    } finally {
      setIsLoading(false);
    }
  }, [showNotification]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Open Transfer Modal
  const handleOpenTransfer = () => {
    if (availableDevices.length === 0) {
      showNotification({
        type: 'warning',
        title: 'لا توجد أجهزة متاحة',
        message: 'لا توجد أجهزة جاهزة للنقل حالياً',
      });
      return;
    }

    const firstDevice = availableDevices[0];
    setSelectedDeviceId(firstDevice.id);
    setTransferTargetLocation(firstDevice.stock_location === 'محل 1' ? 'محل 2' : 'محل 1');
    setTransferNotes('نقل فعلي لتلبية احتياجات الفرع');
    setTransferError('');
    setIsTransferModalOpen(true);
  };

  // When device selection changes in modal, auto-update target location
  const handleDeviceSelect = (deviceId: string) => {
    setSelectedDeviceId(deviceId);
    const dev = availableDevices.find(d => d.id === deviceId);
    if (dev) {
      setTransferTargetLocation(dev.stock_location === 'محل 1' ? 'محل 2' : 'محل 1');
    }
  };

  // Submit Transfer
  const handleSaveTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDeviceId || isSubmitting) return;

    const dev = availableDevices.find(d => d.id === selectedDeviceId);
    if (!dev) {
      setTransferError('الجهاز المختار غير موجود');
      return;
    }

    if (dev.stock_location === transferTargetLocation) {
      setTransferError('الجهاز موجود بالفعل في هذا الفرع. يرجى اختيار الفرع الآخر.');
      return;
    }

    setIsSubmitting(true);
    setTransferError('');
    try {
      await mssInventoryService.transferDevice({
        device_id: dev.id,
        to_location: transferTargetLocation,
        notes: transferNotes.trim() || undefined,
      });

      showNotification({
        type: 'success',
        title: 'تم نقل الجهاز بنجاح',
        message: `تم تحويل الجهاز (${dev.serial_number}) من ${dev.stock_location} إلى ${transferTargetLocation}`,
      });

      setIsTransferModalOpen(false);
      await loadData();
    } catch (err: any) {
      setTransferError(err.message || 'فشلت عملية النقل');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtered movements
  const filteredMovements = movements.filter(m => {
    if (locationFilter !== 'ALL' && m.from_location !== locationFilter && m.to_location !== locationFilter) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const matchSerial = m.serial_number.toLowerCase().includes(q);
      const matchModel = m.model_name?.toLowerCase().includes(q);
      const matchBrand = m.brand?.toLowerCase().includes(q);
      const matchNotes = m.notes?.toLowerCase().includes(q);
      const matchId = m.id.toLowerCase().includes(q);
      if (!matchSerial && !matchModel && !matchBrand && !matchNotes && !matchId) {
        return false;
      }
    }
    return true;
  });

  // Table Columns
  const columns: Column<MSSDeviceMovement>[] = [
    {
      key: 'serial_number',
      header: 'سيريال الجهاز المنقول',
      render: (item: MSSDeviceMovement) => (
        <span className="font-mono font-bold text-xs bg-slate-900 text-teal-300 px-2.5 py-1 rounded-md tracking-wider border border-slate-700 select-all">
          {item.serial_number}
        </span>
      ),
    },
    {
      key: 'model_name',
      header: 'الموديل المرتبط',
      render: (item: MSSDeviceMovement) => (
        <span className="font-bold text-slate-800 text-sm">
          {item.brand ? `${item.brand} ` : ''}
          {item.model_name || 'جهاز لابتوب / شاشة'}
        </span>
      ),
    },
    {
      key: 'from_location',
      header: 'المحل المصدر',
      render: (item: MSSDeviceMovement) => (
        <div className="flex items-center gap-1.5 font-semibold">
          <Store className="w-3.5 h-3.5 text-slate-400" />
          <Badge variant={item.from_location === 'محل 1' ? 'primary' : 'purple'}>
            {item.from_location}
          </Badge>
        </div>
      ),
    },
    {
      key: 'to_location',
      header: 'المحل المستلم',
      render: (item: MSSDeviceMovement) => (
        <div className="flex items-center gap-1.5 font-semibold">
          <Store className="w-3.5 h-3.5 text-slate-400" />
          <Badge variant={item.to_location === 'محل 1' ? 'primary' : 'purple'}>
            {item.to_location}
          </Badge>
        </div>
      ),
    },
    {
      key: 'movement_date',
      header: 'تاريخ ووقت النقل',
      render: (item: MSSDeviceMovement) => (
        <span className="font-mono text-xs text-slate-600">
          {formatDate(item.movement_date)}
        </span>
      ),
    },
    {
      key: 'notes',
      header: 'البيان والسبب',
      render: (item: MSSDeviceMovement) => (
        <span className="text-xs text-slate-600">
          {item.notes || 'نقل مادي بين المحلين'}
        </span>
      ),
    },
    {
      key: 'movement_status',
      header: 'الحالة',
      render: (item: MSSDeviceMovement) => (
        <Badge variant={item.movement_status === 'COMPLETED' ? 'success' : 'warning'}>
          {item.movement_status === 'COMPLETED' ? 'تم الاستلام والتسليم' : item.movement_status}
        </Badge>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="حركة ونقل الأجهزة بين المحلين (Device Movements)"
        subtitle="توثيق التحويلات الفيزيائية الفعلية لأجهزة اللابتوب والشاشات بين محل 1 ومحل 2 وتحديث المخزون"
        actions={
          <Button
            variant="primary"
            size="sm"
            onClick={handleOpenTransfer}
            className="bg-teal-700 hover:bg-teal-800"
            leftIcon={<Plus className="w-4 h-4" />}
          >
            إنشاء إذن نقل جهاز جديد
          </Button>
        }
      />

      {/* Strict Business Rule Alert (Rule 9 & 20) */}
      <Alert
        type="info"
        title="توضيح لقاعدة النقل الفعلي (Rule 9 & 20)"
        message="لا يلزم إنشاء إذن نقل إذا قام أحد المحلين ببيع جهاز متواجد في المحل الآخر دون تحريكه مسبقاً. يُستخدم هذا السجل فقط عند النقل الفعلي الحقيقي للأجهزة بين مقري المحلين."
      />

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 bg-white border border-slate-200">
          <p className="text-xs text-slate-500 font-semibold mb-1">إجمالي أذونات النقل</p>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-slate-800">{movements.length}</span>
            <History className="w-5 h-5 text-slate-400" />
          </div>
          <span className="text-xs text-slate-400">حركة موثقة بالسيريال</span>
        </Card>

        <Card className="p-4 bg-blue-50/60 border border-blue-200">
          <p className="text-xs text-blue-800 font-semibold mb-1">محولة إلى محل 1</p>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-blue-900">
              {movements.filter(m => m.to_location === 'محل 1').length}
            </span>
            <Store className="w-5 h-5 text-blue-600" />
          </div>
          <span className="text-xs text-blue-600">استلمها الفرع الأول</span>
        </Card>

        <Card className="p-4 bg-purple-50/60 border border-purple-200">
          <p className="text-xs text-purple-800 font-semibold mb-1">محولة إلى محل 2</p>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-purple-900">
              {movements.filter(m => m.to_location === 'محل 2').length}
            </span>
            <Store className="w-5 h-5 text-purple-600" />
          </div>
          <span className="text-xs text-purple-600">استلمها الفرع الثاني</span>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <Card className="p-4 space-y-3">
        <div className="flex flex-col md:flex-row items-center gap-3">
          <div className="flex-1 w-full">
            <Input
              placeholder="ابحث بالسيريال، الموديل، السبب، أو التاريخ..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onClear={() => setSearchQuery('')}
              leftIcon={<Search className="w-4 h-4" />}
            />
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={loadData}
            title="تحديث البيانات"
            leftIcon={<RotateCcw className="w-4 h-4 text-slate-500" />}
          >
            تحديث
          </Button>
        </div>

        {/* Location Filter Pills */}
        <div className="flex items-center gap-2 pt-2 border-t border-slate-100 text-xs">
          <span className="font-semibold text-slate-500">تصفية الفرع المنقول إليه أو منه:</span>
          <button
            onClick={() => setLocationFilter('ALL')}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
              locationFilter === 'ALL'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            الكل ({movements.length})
          </button>
          <button
            onClick={() => setLocationFilter('محل 1')}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
              locationFilter === 'محل 1'
                ? 'bg-blue-700 text-white shadow-sm'
                : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
            }`}
          >
            محل 1 ({movements.filter(m => m.from_location === 'محل 1' || m.to_location === 'محل 1').length})
          </button>
          <button
            onClick={() => setLocationFilter('محل 2')}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
              locationFilter === 'محل 2'
                ? 'bg-purple-700 text-white shadow-sm'
                : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
            }`}
          >
            محل 2 ({movements.filter(m => m.from_location === 'محل 2' || m.to_location === 'محل 2').length})
          </button>
        </div>
      </Card>

      {/* Table */}
      {isLoading ? (
        <Card className="p-12 text-center">
          <Spinner size="lg" className="mx-auto mb-3 text-teal-600" />
          <p className="text-sm font-semibold text-slate-600">جاري تحميل سجلات حركات الأجهزة...</p>
        </Card>
      ) : filteredMovements.length === 0 ? (
        <Card className="p-12 text-center space-y-3">
          <ArrowLeftRight className="w-12 h-12 mx-auto text-slate-300" />
          <h3 className="text-base font-bold text-slate-700">لا توجد حركات نقل مسجلة</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            تُسجل التحويلات الفعلية للأجهزة بين المحلين لتحديث أماكن تخزينها بالسيريال تلقائياً.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={handleOpenTransfer}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            إنشاء إذن نقل جديد
          </Button>
        </Card>
      ) : (
        <Table
          columns={columns}
          data={filteredMovements}
          keyExtractor={(item: MSSDeviceMovement) => item.id}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL: New Physical Transfer */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isTransferModalOpen}
        onClose={() => !isSubmitting && setIsTransferModalOpen(false)}
        title="إنشاء إذن تحويل جهاز بين المحلين"
        subtitle="توثيق حركة النقل الفعلي وتحديث موقع التخزين في المخزون تلقائياً"
        size="md"
        footer={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsTransferModalOpen(false)}
              disabled={isSubmitting}
            >
              إلغاء
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSaveTransfer}
              disabled={isSubmitting}
              className="bg-teal-700 hover:bg-teal-800"
              leftIcon={isSubmitting ? <Spinner size="sm" /> : <CheckCircle2 className="w-4 h-4" />}
            >
              {isSubmitting ? 'جاري توثيق النقل...' : 'تأكيد إذن النقل'}
            </Button>
          </div>
        }
      >
        <form onSubmit={handleSaveTransfer} className="space-y-4">
          {transferError && (
            <Alert type="danger" title="خطأ في النقل" message={transferError} />
          )}

          {/* Select Device */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              اختر الجهاز المراد نقله (بالسيريال والموديل) *
            </label>
            <Select
              value={selectedDeviceId}
              onChange={e => handleDeviceSelect(e.target.value)}
              required
            >
              {availableDevices.map(d => (
                <option key={d.id} value={d.id}>
                  [{d.serial_number}] - {d.brand} {d.model_name} (الموقع الحالي: {d.stock_location})
                </option>
              ))}
            </Select>
          </div>

          {/* Destination Location */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              المحل المستلم (Target Location) *
            </label>
            <Select
              value={transferTargetLocation}
              onChange={e => setTransferTargetLocation(e.target.value as MSSStockLocation)}
              required
            >
              <option value="محل 1">محل 1</option>
              <option value="محل 2">محل 2</option>
            </Select>
          </div>

          {/* Reason / Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              سبب النقل وملاحظات البيان *
            </label>
            <textarea
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600"
              rows={2}
              placeholder="مثال: نقل بناء على طلب الفرع، عرض في الواجهة، أو تجميعة طلب..."
              value={transferNotes}
              onChange={e => setTransferNotes(e.target.value)}
              required
            />
          </div>
        </form>
      </Modal>
    </div>
  );
};
