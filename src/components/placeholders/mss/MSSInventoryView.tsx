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
import { mssCatalogService } from '@/services/mssCatalogService';
import { formatCurrency, formatDate } from '@/lib/utils';
import type {
  MSSDevice,
  MSSDeviceStatus,
  MSSStockLocation,
  MSSInventorySummary,
  MSSDeviceMovement,
} from '@/types/mssInventory';
import type { MSSCatalogModel } from '@/types/mssCatalog';
import {
  Plus,
  Search,
  Store,
  ArrowLeftRight,
  Eye,
  Pencil,
  Trash2,
  Laptop,
  Monitor,
  Box,
  Copy,
  Check,
  Calendar,
  Layers,
  History,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';

export const MSSInventoryView: React.FC = () => {
  const { showNotification } = useNotification();

  // Data states
  const [devices, setDevices] = useState<MSSDevice[]>([]);
  const [catalogModels, setCatalogModels] = useState<MSSCatalogModel[]>([]);
  const [summary, setSummary] = useState<MSSInventorySummary | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Filter states
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [locationFilter, setLocationFilter] = useState<'ALL' | MSSStockLocation>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | MSSDeviceStatus>('ALL');
  const [copiedSerial, setCopiedSerial] = useState<string | null>(null);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState<boolean>(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState<boolean>(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);

  // Active / Selected device
  const [selectedDevice, setSelectedDevice] = useState<MSSDevice | null>(null);
  const [deviceHistory, setDeviceHistory] = useState<MSSDeviceMovement[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState<boolean>(false);

  // Add / Edit Form State
  const [formSerial, setFormSerial] = useState<string>('');
  const [formModelId, setFormModelId] = useState<string>('');
  const [formCost, setFormCost] = useState<number>(0);
  const [formListPrice, setFormListPrice] = useState<number>(0);
  const [formPurchaseDate, setFormPurchaseDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [formCondition, setFormCondition] = useState<string>('فرز أول ممتاز');
  const [formLocation, setFormLocation] = useState<MSSStockLocation>('محل 1');
  const [formStatus, setFormStatus] = useState<MSSDeviceStatus>('AVAILABLE');
  const [formNotes, setFormNotes] = useState<string>('');
  const [formError, setFormError] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Transfer Form State
  const [transferTargetLocation, setTransferTargetLocation] = useState<MSSStockLocation>('محل 2');
  const [transferNotes, setTransferNotes] = useState<string>('');
  const [transferError, setTransferError] = useState<string>('');

  // Load Data
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [devList, modelsList, sum] = await Promise.all([
        mssInventoryService.getDevices(),
        mssCatalogService.getModels(),
        mssInventoryService.getInventorySummary(),
      ]);
      setDevices(devList);
      setCatalogModels(modelsList);
      setSummary(sum);
    } catch (err: any) {
      console.error('Failed to load inventory data:', err);
      showNotification({
        type: 'error',
        title: 'خطأ في جلب بيانات المخزون',
        message: err.message || 'تعذر تحميل بيانات الأجهزة والمخزون',
      });
    } finally {
      setIsLoading(false);
    }
  }, [showNotification]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Copy Serial Number to Clipboard
  const handleCopySerial = (serial: string) => {
    navigator.clipboard.writeText(serial);
    setCopiedSerial(serial);
    setTimeout(() => setCopiedSerial(null), 2000);
    showNotification({
      type: 'info',
      title: 'تم النسخ',
      message: `تم نسخ السيريال (${serial}) إلى الحافظة بنجاح`,
    });
  };

  // Open Add Modal
  const handleOpenAdd = () => {
    setFormSerial('');
    const defaultModel = catalogModels[0];
    setFormModelId(defaultModel ? defaultModel.id : '');
    setFormCost(0);
    setFormListPrice(defaultModel ? defaultModel.default_list_price : 0);
    setFormPurchaseDate(new Date().toISOString().split('T')[0]);
    setFormCondition('فرز أول ممتاز');
    setFormLocation('محل 1');
    setFormStatus('AVAILABLE');
    setFormNotes('');
    setFormError('');
    setIsAddModalOpen(true);
  };

  // When model selection changes in Add modal, auto-fill list price
  const handleModelChange = (modelId: string) => {
    setFormModelId(modelId);
    const m = catalogModels.find(x => x.id === modelId);
    if (m && (!formListPrice || formListPrice === 0)) {
      setFormListPrice(m.default_list_price);
    }
  };

  // Submit Add Device
  const handleSaveAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!formSerial.trim()) {
      setFormError('يرجى إدخال أو مسح السيريال نمبر الفريد للجهاز');
      return;
    }
    if (!formModelId) {
      setFormError('يرجى اختيار الموديل المرتبط من الكتالوج');
      return;
    }
    if (formCost < 0) {
      setFormError('سعر التكلفة لا يمكن أن يكون سالباً');
      return;
    }
    if (formListPrice < 0) {
      setFormError('سعر العرض لا يمكن أن يكون سالباً');
      return;
    }

    setIsSubmitting(true);
    setFormError('');
    try {
      await mssInventoryService.createDevice({
        serial_number: formSerial.trim(),
        model_id: formModelId,
        purchase_cost: Number(formCost) || 0,
        list_price: Number(formListPrice) || 0,
        purchase_date: formPurchaseDate,
        physical_condition: formCondition.trim() || 'فرز أول',
        stock_location: formLocation,
        status: formStatus,
        notes: formNotes.trim() || undefined,
      });

      showNotification({
        type: 'success',
        title: 'تم تسجيل الجهاز بنجاح',
        message: `تم إضافة الجهاز بالسيريال (${formSerial.trim().toUpperCase()}) إلى مخزون ${formLocation}`,
      });

      setIsAddModalOpen(false);
      await loadData();
    } catch (err: any) {
      setFormError(err.message || 'فشلت عملية حفظ الجهاز');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (device: MSSDevice) => {
    setSelectedDevice(device);
    setFormSerial(device.serial_number);
    setFormModelId(device.model_id);
    setFormCost(device.purchase_cost);
    setFormListPrice(device.list_price);
    setFormPurchaseDate(device.purchase_date);
    setFormCondition(device.physical_condition);
    setFormLocation(device.stock_location);
    setFormStatus(device.status);
    setFormNotes(device.notes || '');
    setFormError('');
    setIsEditModalOpen(true);
  };

  // Submit Edit Device
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDevice || isSubmitting) return;

    if (!formSerial.trim()) {
      setFormError('السيريال نمبر مطلوب');
      return;
    }
    if (formCost < 0 || formListPrice < 0) {
      setFormError('الأسعار لا يمكن أن تكون سالبة');
      return;
    }

    setIsSubmitting(true);
    setFormError('');
    try {
      await mssInventoryService.updateDevice(selectedDevice.id, {
        serial_number: formSerial.trim(),
        model_id: formModelId,
        purchase_cost: Number(formCost) || 0,
        list_price: Number(formListPrice) || 0,
        purchase_date: formPurchaseDate,
        physical_condition: formCondition.trim(),
        stock_location: formLocation,
        status: formStatus,
        notes: formNotes.trim() || undefined,
      });

      showNotification({
        type: 'success',
        title: 'تم التحديث',
        message: `تم تحديث بيانات الجهاز (${selectedDevice.serial_number}) بنجاح`,
      });

      setIsEditModalOpen(false);
      await loadData();
    } catch (err: any) {
      setFormError(err.message || 'فشلت عملية تعديل الجهاز');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Transfer Modal
  const handleOpenTransfer = (device?: MSSDevice) => {
    const dev = device || devices.find(d => d.status === 'AVAILABLE') || devices[0];
    if (!dev) {
      showNotification({
        type: 'warning',
        title: 'لا توجد أجهزة',
        message: 'لا يوجد أجهزة في المخزون لنقلها حالياً',
      });
      return;
    }

    setSelectedDevice(dev);
    // Suggest the other shop
    setTransferTargetLocation(dev.stock_location === 'محل 1' ? 'محل 2' : 'محل 1');
    setTransferNotes('نقل فعلي لتلبية طلبات الفرع');
    setTransferError('');
    setIsTransferModalOpen(true);
  };

  // Submit Transfer
  const handleSaveTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDevice || isSubmitting) return;

    if (selectedDevice.stock_location === transferTargetLocation) {
      setTransferError('الجهاز موجود بالفعل في هذا الفرع. اختر فرعاً مختلفاً.');
      return;
    }

    setIsSubmitting(true);
    setTransferError('');
    try {
      await mssInventoryService.transferDevice({
        device_id: selectedDevice.id,
        to_location: transferTargetLocation,
        notes: transferNotes.trim() || undefined,
      });

      showNotification({
        type: 'success',
        title: 'تم نقل الجهاز بنجاح',
        message: `تم تحويل الجهاز (${selectedDevice.serial_number}) من ${selectedDevice.stock_location} إلى ${transferTargetLocation}`,
      });

      setIsTransferModalOpen(false);
      await loadData();
    } catch (err: any) {
      setTransferError(err.message || 'فشلت عملية النقل');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Details & History Modal
  const handleOpenDetails = async (device: MSSDevice) => {
    setSelectedDevice(device);
    setIsDetailsModalOpen(true);
    setIsHistoryLoading(true);
    try {
      const history = await mssInventoryService.getDeviceHistory(device.id);
      setDeviceHistory(history);
    } catch (err) {
      console.warn('Failed to load device history:', err);
      setDeviceHistory([]);
    } finally {
      setIsHistoryLoading(false);
    }
  };

  // Open Delete Modal
  const handleOpenDelete = (device: MSSDevice) => {
    setSelectedDevice(device);
    setIsDeleteModalOpen(true);
  };

  // Confirm Delete
  const handleConfirmDelete = async () => {
    if (!selectedDevice || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await mssInventoryService.deleteDevice(selectedDevice.id);
      showNotification({
        type: 'success',
        title: 'تم الحذف',
        message: `تم حذف الجهاز (${selectedDevice.serial_number}) من سجلات المخزون`,
      });
      setIsDeleteModalOpen(false);
      await loadData();
    } catch (err: any) {
      showNotification({
        type: 'error',
        title: 'تعذر الحذف',
        message: err.message || 'حدث خطأ أثناء محاولة حذف الجهاز',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtered devices
  const filteredDevices = devices.filter(d => {
    if (locationFilter !== 'ALL' && d.stock_location !== locationFilter) return false;
    if (statusFilter !== 'ALL' && d.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const matchSerial = d.serial_number.toLowerCase().includes(q);
      const matchModel = d.model_name?.toLowerCase().includes(q);
      const matchBrand = d.brand?.toLowerCase().includes(q);
      const matchCondition = d.physical_condition.toLowerCase().includes(q);
      const matchNotes = d.notes?.toLowerCase().includes(q);
      if (!matchSerial && !matchModel && !matchBrand && !matchCondition && !matchNotes) {
        return false;
      }
    }
    return true;
  });

  // Table Columns
  const columns: Column<MSSDevice>[] = [
    {
      key: 'serial_number',
      header: 'السيريال نمبر الفريد',
      render: (item: MSSDevice) => (
        <div className="flex items-center gap-1.5">
          <span className="font-mono font-bold text-xs bg-slate-900 text-teal-300 px-2.5 py-1 rounded-md tracking-wider border border-slate-700 select-all shadow-sm">
            {item.serial_number}
          </span>
          <button
            onClick={() => handleCopySerial(item.serial_number)}
            title="نسخ السيريال"
            className="text-slate-400 hover:text-slate-700 p-1 rounded hover:bg-slate-100 transition-colors"
          >
            {copiedSerial === item.serial_number ? (
              <Check className="w-3.5 h-3.5 text-emerald-600" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      ),
    },
    {
      key: 'model_name',
      header: 'الموديل والمواصفات',
      render: (item: MSSDevice) => (
        <div className="space-y-0.5">
          <div className="flex items-center gap-1.5 font-bold text-slate-800 text-sm">
            {item.category === 'لابتوب' ? (
              <Laptop className="w-4 h-4 text-teal-600" />
            ) : item.category === 'شاشة' ? (
              <Monitor className="w-4 h-4 text-blue-600" />
            ) : (
              <Box className="w-4 h-4 text-purple-600" />
            )}
            <span>
              {item.brand} {item.model_name}
            </span>
          </div>
          {item.model && (
            <p className="text-xs text-slate-500 font-mono">
              {[item.model.processor, item.model.ram, item.model.storage, item.model.screen_size]
                .filter(x => x && x !== '-')
                .join(' • ')}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'stock_location',
      header: 'موقع التخزين الفعلي',
      render: (item: MSSDevice) => (
        <div className="flex items-center gap-1.5 font-semibold">
          <Store className="w-3.5 h-3.5 text-slate-400" />
          <Badge variant={item.stock_location === 'محل 1' ? 'primary' : 'purple'}>
            {item.stock_location}
          </Badge>
        </div>
      ),
    },
    {
      key: 'physical_condition',
      header: 'الحالة الظاهرية',
      render: (item: MSSDevice) => (
        <span className="text-xs font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
          {item.physical_condition}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'حالة الجهاز',
      render: (item: MSSDevice) => {
        switch (item.status) {
          case 'AVAILABLE':
            return <Badge variant="success">متاح للبيع</Badge>;
          case 'RESERVED':
            return <Badge variant="warning">محجوز لعميل</Badge>;
          case 'SOLD':
            return <Badge variant="default">تم البيع</Badge>;
          case 'MAINTENANCE':
            return <Badge variant="danger">تحت الصيانة</Badge>;
          case 'RETURNED':
            return <Badge variant="info">مرتجع</Badge>;
          default:
            return <Badge variant="default">{item.status}</Badge>;
        }
      },
    },
    {
      key: 'purchase_cost',
      header: 'التكلفة',
      render: (item: MSSDevice) => (
        <span className="font-mono text-xs text-slate-600">
          {formatCurrency(item.purchase_cost)}
        </span>
      ),
    },
    {
      key: 'listPrice',
      header: 'سعر العرض',
      render: (item: MSSDevice) => (
        <span className="font-bold text-teal-800 text-sm font-mono">
          {formatCurrency(item.list_price)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'إجراءات',
      render: (item: MSSDevice) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleOpenDetails(item)}
            title="تفاصيل الجهاز وسجل التنقلات"
            className="p-1.5 text-slate-600 hover:text-slate-900"
          >
            <Eye className="w-4 h-4" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleOpenTransfer(item)}
            title="نقل الجهاز للفرع الآخر"
            className="p-1.5 text-teal-700 hover:text-teal-900 hover:bg-teal-50"
            disabled={item.status === 'SOLD'}
          >
            <ArrowLeftRight className="w-4 h-4" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleOpenEdit(item)}
            title="تعديل بيانات الجهاز"
            className="p-1.5 text-blue-600 hover:text-blue-900"
          >
            <Pencil className="w-4 h-4" />
          </Button>

          {item.status !== 'SOLD' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleOpenDelete(item)}
              title="حذف الجهاز من المخزون"
              className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="المخزون الفعلي بالسيريال (MSS Physical Inventory)"
        subtitle="تتبع دقيق لكل قطعة لابتوب وشاشة بسيريالها الخاص المنفصل وموقعها المادي الحقيقي (محل 1 ومحل 2)"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleOpenTransfer()}
              leftIcon={<ArrowLeftRight className="w-4 h-4 text-teal-700" />}
            >
              نقل جهاز بين المحلين
            </Button>

            <Button
              variant="primary"
              size="sm"
              onClick={handleOpenAdd}
              className="bg-teal-700 hover:bg-teal-800"
              leftIcon={<Plus className="w-4 h-4" />}
            >
              إضافة جهاز جديد بالسيريال
            </Button>
          </div>
        }
      />

      {/* KPI Cards (Accurate Breakdown per Rule 9) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="p-3.5 bg-white border border-slate-200">
          <p className="text-xs text-slate-500 font-semibold mb-1">إجمالي الأجهزة</p>
          <div className="flex items-baseline justify-between">
            <span className="text-xl font-black text-slate-800">{summary?.total_units || 0}</span>
            <Layers className="w-4 h-4 text-slate-400" />
          </div>
          <span className="text-[11px] text-slate-400">سيريالات مسجلة</span>
        </Card>

        <Card className="p-3.5 bg-blue-50/60 border border-blue-200">
          <p className="text-xs text-blue-800 font-semibold mb-1">متوفر بمحل 1</p>
          <div className="flex items-baseline justify-between">
            <span className="text-xl font-black text-blue-900">{summary?.available_shop1 || 0}</span>
            <Store className="w-4 h-4 text-blue-600" />
          </div>
          <span className="text-[11px] text-blue-600">جاهز للبيع الفوري</span>
        </Card>

        <Card className="p-3.5 bg-purple-50/60 border border-purple-200">
          <p className="text-xs text-purple-800 font-semibold mb-1">متوفر بمحل 2</p>
          <div className="flex items-baseline justify-between">
            <span className="text-xl font-black text-purple-900">{summary?.available_shop2 || 0}</span>
            <Store className="w-4 h-4 text-purple-600" />
          </div>
          <span className="text-[11px] text-purple-600">جاهز للبيع الفوري</span>
        </Card>

        <Card className="p-3.5 bg-emerald-50/60 border border-emerald-200">
          <p className="text-xs text-emerald-800 font-semibold mb-1">إجمالي المتوفر</p>
          <div className="flex items-baseline justify-between">
            <span className="text-xl font-black text-emerald-900">{summary?.available_total || 0}</span>
            <Check className="w-4 h-4 text-emerald-600" />
          </div>
          <span className="text-[11px] text-emerald-600">بالمحلين معاً</span>
        </Card>

        <Card className="p-3.5 bg-amber-50/60 border border-amber-200">
          <p className="text-xs text-amber-800 font-semibold mb-1">محجوز لعملاء</p>
          <div className="flex items-baseline justify-between">
            <span className="text-xl font-black text-amber-900">{summary?.reserved_total || 0}</span>
            <Calendar className="w-4 h-4 text-amber-600" />
          </div>
          <span className="text-[11px] text-amber-600">حجز مؤقت</span>
        </Card>

        <Card className="p-3.5 bg-rose-50/60 border border-rose-200">
          <p className="text-xs text-rose-800 font-semibold mb-1">صيانة أو مرتجع</p>
          <div className="flex items-baseline justify-between">
            <span className="text-xl font-black text-rose-900">
              {(summary?.maintenance_total || 0) + (summary?.returned_total || 0)}
            </span>
            <AlertTriangle className="w-4 h-4 text-rose-600" />
          </div>
          <span className="text-[11px] text-rose-600">غير جاهز للبيع</span>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card className="p-4 space-y-3">
        <div className="flex flex-col md:flex-row items-center gap-3">
          <div className="flex-1 w-full">
            <Input
              placeholder="امسح بالباركود أو اكتب السيريال نمبر، الموديل، الماركة، الحالة..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onClear={() => setSearchQuery('')}
              leftIcon={<Search className="w-4 h-4" />}
              scannerReady
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <Button
              variant="ghost"
              size="sm"
              onClick={loadData}
              title="إعادة تحميل البيانات"
              leftIcon={<RotateCcw className="w-4 h-4 text-slate-500" />}
            >
              تحديث
            </Button>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 text-xs">
          {/* Location Filter */}
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-slate-500">المحل:</span>
            <button
              onClick={() => setLocationFilter('ALL')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                locationFilter === 'ALL'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              الكل ({devices.length})
            </button>
            <button
              onClick={() => setLocationFilter('محل 1')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                locationFilter === 'محل 1'
                  ? 'bg-blue-700 text-white shadow-sm'
                  : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
              }`}
            >
              محل 1 ({devices.filter(d => d.stock_location === 'محل 1').length})
            </button>
            <button
              onClick={() => setLocationFilter('محل 2')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                locationFilter === 'محل 2'
                  ? 'bg-purple-700 text-white shadow-sm'
                  : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
              }`}
            >
              محل 2 ({devices.filter(d => d.stock_location === 'محل 2').length})
            </button>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-slate-500">الحالة:</span>
            {(
              [
                { id: 'ALL', label: 'الكل' },
                { id: 'AVAILABLE', label: 'متاح للبيع' },
                { id: 'RESERVED', label: 'محجوز' },
                { id: 'SOLD', label: 'تم البيع' },
                { id: 'MAINTENANCE', label: 'تحت الصيانة' },
                { id: 'RETURNED', label: 'مرتجع' },
              ] as const
            ).map(st => (
              <button
                key={st.id}
                onClick={() => setStatusFilter(st.id)}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                  statusFilter === st.id
                    ? 'bg-teal-700 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Main Table */}
      {isLoading ? (
        <Card className="p-12 text-center">
          <Spinner size="lg" className="mx-auto mb-3 text-teal-600" />
          <p className="text-sm font-semibold text-slate-600">جاري تحميل بيانات الأجهزة والمخزون السحابي...</p>
        </Card>
      ) : filteredDevices.length === 0 ? (
        <Card className="p-12 text-center space-y-3">
          <Box className="w-12 h-12 mx-auto text-slate-300" />
          <h3 className="text-base font-bold text-slate-700">لا توجد أجهزة مطابقة للبحث أو التصفية</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            يمكنك مسح كود السيريال بالماسح الضوئي مباشرة أو إضافة جهاز جديد وربطه بموديل من الكتالوج.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={handleOpenAdd}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            تسجيل جهاز جديد الآن
          </Button>
        </Card>
      ) : (
        <Table
          columns={columns}
          data={filteredDevices}
          keyExtractor={(item: MSSDevice) => item.id}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: Add New Device */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => !isSubmitting && setIsAddModalOpen(false)}
        title="تسجيل جهاز لابتوب / شاشة جديد بالسيريال"
        subtitle="إدخال قطعة فعلية جديدة وتخصيص سيريال فريد وموقع تخزين مادي محدد"
        size="lg"
        footer={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAddModalOpen(false)}
              disabled={isSubmitting}
            >
              إلغاء
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSaveAdd}
              disabled={isSubmitting}
              className="bg-teal-700 hover:bg-teal-800"
              leftIcon={isSubmitting ? <Spinner size="sm" /> : <Plus className="w-4 h-4" />}
            >
              {isSubmitting ? 'جاري الحفظ...' : 'تسجيل الجهاز'}
            </Button>
          </div>
        }
      >
        <form onSubmit={handleSaveAdd} className="space-y-4">
          {formError && (
            <Alert type="danger" title="خطأ في البيانات" message={formError} />
          )}

          {/* Serial Number (Scanner Ready) */}
          <div>
            <Input
              label="السيريال نمبر الفريد (Unique Serial Number) *"
              placeholder="امسح بالباركود أو اكتب السيريال (مثال: PF1K892-LEN)..."
              value={formSerial}
              onChange={e => setFormSerial(e.target.value.toUpperCase())}
              scannerReady
              required
              helperText="السيريال فريد لكل جهاز ولا يمكن تكراره نهائياً في النظام"
            />
          </div>

          {/* Linked Model Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                الموديل المرتبط من الكتالوج *
              </label>
              <Select
                value={formModelId}
                onChange={e => handleModelChange(e.target.value)}
                required
              >
                {catalogModels.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.brand} {m.model_name} ({m.category}) - سعر العرض: {m.default_list_price} ج.م
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                المحل الفعلي للتخزين (Stock Location) *
              </label>
              <Select
                value={formLocation}
                onChange={e => setFormLocation(e.target.value as MSSStockLocation)}
                required
              >
                <option value="محل 1">محل 1 (الفرع الأول)</option>
                <option value="محل 2">محل 2 (الفرع الثاني)</option>
              </Select>
            </div>
          </div>

          {/* Financials & Purchase Date */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Input
                label="سعر التكلفة (ج.م) *"
                type="number"
                min="0"
                step="50"
                value={formCost}
                onChange={e => setFormCost(Number(e.target.value))}
                required
              />
            </div>

            <div>
              <Input
                label="سعر العرض الاسترشادي (ج.م) *"
                type="number"
                min="0"
                step="50"
                value={formListPrice}
                onChange={e => setFormListPrice(Number(e.target.value))}
                required
              />
            </div>

            <div>
              <Input
                label="تاريخ الشراء / الاستلام"
                type="date"
                value={formPurchaseDate}
                onChange={e => setFormPurchaseDate(e.target.value)}
              />
            </div>
          </div>

          {/* Condition and Status */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                الحالة الظاهرية والفنية
              </label>
              <Select
                value={formCondition}
                onChange={e => setFormCondition(e.target.value)}
              >
                <option value="فرز أول ممتاز">فرز أول ممتاز (نظيف جداً بدون خدوش)</option>
                <option value="كالجديد كرتونة كاملة">كالجديد بكرتونته وشواحنه الأصلية</option>
                <option value="فرز أول">فرز أول (حالة ممتازة)</option>
                <option value="فرز ثانٍ">فرز ثانٍ (خدوش سطحية طفيفة)</option>
                <option value="يحتاج صيانة طفيفة">يحتاج صيانة طفيفة / مراجعة</option>
              </Select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                حالة الجهاز في المخزون
              </label>
              <Select
                value={formStatus}
                onChange={e => setFormStatus(e.target.value as MSSDeviceStatus)}
              >
                <option value="AVAILABLE">متاح للبيع الفوري (Available)</option>
                <option value="RESERVED">محجوز لعميل (Reserved)</option>
                <option value="MAINTENANCE">تحت الصيانة والفحص (Under Maintenance)</option>
              </Select>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              ملاحظات إضافية على هذا الجهاز تحديداً
            </label>
            <textarea
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600"
              rows={2}
              placeholder="مثال: صحة البطارية 96%، كيبورد مضيئة، شاحن أصلي 65W..."
              value={formNotes}
              onChange={e => setFormNotes(e.target.value)}
            />
          </div>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 2: Edit Existing Device */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => !isSubmitting && setIsEditModalOpen(false)}
        title={`تعديل بيانات الجهاز (${selectedDevice?.serial_number})`}
        subtitle="تعديل السعر، الحالة الظاهرية، أو الملاحظات الخاصة بهذا الجهاز"
        size="lg"
        footer={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditModalOpen(false)}
              disabled={isSubmitting}
            >
              إلغاء
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSaveEdit}
              disabled={isSubmitting}
              className="bg-blue-700 hover:bg-blue-800"
              leftIcon={isSubmitting ? <Spinner size="sm" /> : <Pencil className="w-4 h-4" />}
            >
              {isSubmitting ? 'جاري الحفظ...' : 'حفظ التعديلات'}
            </Button>
          </div>
        }
      >
        <form onSubmit={handleSaveEdit} className="space-y-4">
          {formError && (
            <Alert type="danger" title="خطأ في التعديل" message={formError} />
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input
              label="السيريال نمبر *"
              value={formSerial}
              onChange={e => setFormSerial(e.target.value.toUpperCase())}
              required
            />

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                موقع التخزين الفعلي
              </label>
              <Select
                value={formLocation}
                onChange={e => setFormLocation(e.target.value as MSSStockLocation)}
              >
                <option value="محل 1">محل 1</option>
                <option value="محل 2">محل 2</option>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Input
              label="سعر التكلفة (ج.م) *"
              type="number"
              min="0"
              value={formCost}
              onChange={e => setFormCost(Number(e.target.value))}
              required
            />
            <Input
              label="سعر العرض (ج.م) *"
              type="number"
              min="0"
              value={formListPrice}
              onChange={e => setFormListPrice(Number(e.target.value))}
              required
            />
            <Input
              label="تاريخ الشراء"
              type="date"
              value={formPurchaseDate}
              onChange={e => setFormPurchaseDate(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                الحالة الظاهرية
              </label>
              <Input
                value={formCondition}
                onChange={e => setFormCondition(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                حالة الجهاز
              </label>
              <Select
                value={formStatus}
                onChange={e => setFormStatus(e.target.value as MSSDeviceStatus)}
              >
                <option value="AVAILABLE">متاح للبيع (Available)</option>
                <option value="RESERVED">محجوز لعميل (Reserved)</option>
                <option value="SOLD">تم البيع (Sold)</option>
                <option value="MAINTENANCE">تحت الصيانة (Under Maintenance)</option>
                <option value="RETURNED">مرتجع (Returned)</option>
              </Select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              ملاحظات الجهاز
            </label>
            <textarea
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
              rows={2}
              value={formNotes}
              onChange={e => setFormNotes(e.target.value)}
            />
          </div>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 3: Transfer Device Between Shops */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isTransferModalOpen}
        onClose={() => !isSubmitting && setIsTransferModalOpen(false)}
        title="تحويل جهاز فعلياً بين المحلين (Physical Transfer)"
        subtitle="توثيق النقل الحقيقي لجهاز من موقع تخزينه الحالي إلى المحل الآخر"
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
              leftIcon={isSubmitting ? <Spinner size="sm" /> : <ArrowLeftRight className="w-4 h-4" />}
            >
              {isSubmitting ? 'جاري توثيق النقل...' : 'تأكيد النقل الفعلي'}
            </Button>
          </div>
        }
      >
        <form onSubmit={handleSaveTransfer} className="space-y-4">
          {transferError && (
            <Alert type="danger" title="خطأ في النقل" message={transferError} />
          )}

          {selectedDevice && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">الجهاز المراد نقله:</span>
                <span className="font-mono text-xs font-bold bg-slate-900 text-teal-300 px-2 py-0.5 rounded">
                  {selectedDevice.serial_number}
                </span>
              </div>
              <p className="text-sm font-bold text-slate-800">
                {selectedDevice.brand} {selectedDevice.model_name}
              </p>
            </div>
          )}

          {/* Transfer Route Visualizer */}
          <div className="p-4 bg-teal-50/60 border border-teal-200 rounded-xl">
            <div className="flex items-center justify-between">
              <div className="text-center">
                <span className="text-xs text-slate-500 font-semibold block mb-1">الموقع الحالي</span>
                <Badge variant={selectedDevice?.stock_location === 'محل 1' ? 'primary' : 'purple'}>
                  {selectedDevice?.stock_location || 'محل 1'}
                </Badge>
              </div>

              <div className="flex flex-col items-center px-4">
                <ArrowLeftRight className="w-5 h-5 text-teal-700 animate-pulse" />
                <span className="text-[10px] text-teal-700 font-bold mt-1">تحويل فيزيائي</span>
              </div>

              <div className="text-center">
                <span className="text-xs text-slate-500 font-semibold block mb-1">المحل المستلم</span>
                <Badge variant={transferTargetLocation === 'محل 1' ? 'primary' : 'purple'}>
                  {transferTargetLocation}
                </Badge>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              سبب إذن النقل والبيان *
            </label>
            <textarea
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600"
              rows={2}
              placeholder="مثال: نقل للعرض في واجهة محل 1، أو تلبية طلب محجوز لعميل..."
              value={transferNotes}
              onChange={e => setTransferNotes(e.target.value)}
              required
            />
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            * ملاحظة: يتم حفظ سجل حركة مفصل (Movement Log) بتاريخ النقل وتحديث الموقع الفعلي للجهاز تلقائياً.
          </p>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 4: Unit Details & Full Movement History */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        title={`بطاقة الجهاز وسجل التنقلات (${selectedDevice?.serial_number})`}
        subtitle="كافة المواصفات وسجل الحركة المادية الفعلي بين مقرات العمل"
        size="lg"
        footer={
          <Button variant="outline" size="sm" onClick={() => setIsDetailsModalOpen(false)}>
            إغلاق
          </Button>
        }
      >
        {selectedDevice && (
          <div className="space-y-5">
            {/* Main Specs Card */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-base font-bold text-slate-800">
                    {selectedDevice.brand} {selectedDevice.model_name}
                  </h4>
                  <p className="text-xs text-slate-500">{selectedDevice.category}</p>
                </div>
                <div className="text-left font-mono">
                  <span className="text-xs text-slate-400 block">السيريال الفريد:</span>
                  <span className="font-bold text-sm bg-slate-900 text-teal-300 px-2.5 py-1 rounded">
                    {selectedDevice.serial_number}
                  </span>
                </div>
              </div>

              {selectedDevice.model && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-2 border-t border-slate-200 text-xs">
                  <div>
                    <span className="text-slate-400 block">المعالج:</span>
                    <span className="font-semibold text-slate-700">{selectedDevice.model.processor || '-'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">الرام:</span>
                    <span className="font-semibold text-slate-700">{selectedDevice.model.ram || '-'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">التخزين:</span>
                    <span className="font-semibold text-slate-700">{selectedDevice.model.storage || '-'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">الشاشة:</span>
                    <span className="font-semibold text-slate-700">{selectedDevice.model.screen_size || '-'}</span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200 text-xs">
                <div>
                  <span className="text-slate-400 block">الموقع الحالي:</span>
                  <Badge variant={selectedDevice.stock_location === 'محل 1' ? 'primary' : 'purple'}>
                    {selectedDevice.stock_location}
                  </Badge>
                </div>
                <div>
                  <span className="text-slate-400 block">حالة الجهاز:</span>
                  <Badge variant={selectedDevice.status === 'AVAILABLE' ? 'success' : 'default'}>
                    {selectedDevice.status}
                  </Badge>
                </div>
                <div>
                  <span className="text-slate-400 block">الحالة الظاهرية:</span>
                  <span className="font-semibold text-slate-700">{selectedDevice.physical_condition}</span>
                </div>
              </div>

              {selectedDevice.notes && (
                <div className="pt-2 border-t border-slate-200 text-xs">
                  <span className="text-slate-400 block">ملاحظات الجهاز:</span>
                  <p className="text-slate-700 mt-0.5">{selectedDevice.notes}</p>
                </div>
              )}
            </div>

            {/* Movement History Section */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <History className="w-4 h-4 text-teal-700" />
                <h5 className="font-bold text-slate-800 text-sm">سجل التحويلات المادية بين الفروع</h5>
              </div>

              {isHistoryLoading ? (
                <div className="p-6 text-center text-xs text-slate-500">
                  <Spinner size="sm" className="mx-auto mb-2 text-teal-600" />
                  جاري جلب سجل الحركات...
                </div>
              ) : deviceHistory.length === 0 ? (
                <div className="p-4 bg-slate-50 rounded-lg text-center text-xs text-slate-500 border border-slate-100">
                  لا توجد حركات نقل مسجلة لهذا الجهاز حتى الآن. (موجود في موقعه الأساسي: {selectedDevice.stock_location}).
                </div>
              ) : (
                <div className="space-y-2">
                  {deviceHistory.map(mov => (
                    <div
                      key={mov.id}
                      className="p-3 bg-white border border-slate-200 rounded-lg flex items-center justify-between text-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-700">تحويل من:</span>
                          <Badge variant="outline">{mov.from_location}</Badge>
                          <span className="text-slate-400">⬅</span>
                          <span className="font-semibold text-slate-700">إلى:</span>
                          <Badge variant="primary">{mov.to_location}</Badge>
                        </div>
                        {mov.notes && <p className="text-slate-500">{mov.notes}</p>}
                      </div>
                      <div className="text-left font-mono text-slate-400">
                        {formatDate(mov.movement_date)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 5: Delete Confirmation */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => !isSubmitting && setIsDeleteModalOpen(false)}
        title="تأكيد حذف الجهاز من المخزون"
        subtitle="تحذير: هذا الإجراء يحذف سجل الجهاز وسيرياله نهائياً من النظام"
        size="sm"
        footer={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsDeleteModalOpen(false)}
              disabled={isSubmitting}
            >
              إلغاء
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleConfirmDelete}
              disabled={isSubmitting}
              leftIcon={isSubmitting ? <Spinner size="sm" /> : <Trash2 className="w-4 h-4" />}
            >
              {isSubmitting ? 'جاري الحذف...' : 'حذف الجهاز نهائياً'}
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-700">
            هل أنت متأكد من رغبتك في حذف هذا الجهاز بسيرياله الخاص:
          </p>
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs space-y-1">
            <p className="font-bold text-rose-900">
              {selectedDevice?.brand} {selectedDevice?.model_name}
            </p>
            <p className="font-mono text-rose-700">السيريال: {selectedDevice?.serial_number}</p>
            <p className="text-rose-600">الموقع: {selectedDevice?.stock_location}</p>
          </div>
        </div>
      </Modal>
    </div>
  );
};
