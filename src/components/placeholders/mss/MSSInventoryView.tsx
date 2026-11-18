import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
import { usePageRefresh } from '@/context/PageRefreshContext';
import { mssInventoryService } from '@/services/mssInventoryService';
import { mssCatalogService } from '@/services/mssCatalogService';
import { formatCurrency, formatDate } from '@/lib/utils';
import { getTodayLocalDateString } from '@/lib/dateValidation';
import type {
  MSSDevice,
  MSSDeviceStatus,
  MSSStockLocation,
  MSSInventorySummary,
  MSSDeviceMovement,
} from '@/types/mssInventory';
import type { MSSCatalogModel } from '@/types/mssCatalog';
import { mssOperationalService } from '@/services/mssOperationalService';
import type { SystemStore, TransferPreviewResponse, ExecuteTransferResult } from '@/types/mssOperational';
import { useAuth } from '@/context/AuthContext';
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
  RefreshCw,
  CheckSquare,
  Square,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
} from 'lucide-react';

export const MSSInventoryView: React.FC = () => {
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const { isRefreshing, triggerRefresh } = usePageRefresh();

  // Data states
  const [devices, setDevices] = useState<MSSDevice[]>([]);
  const [catalogModels, setCatalogModels] = useState<MSSCatalogModel[]>([]);
  const [systemStores, setSystemStores] = useState<SystemStore[]>([]);
  const [summary, setSummary] = useState<MSSInventorySummary | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Filter states
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [locationFilter, setLocationFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | MSSDeviceStatus>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [copiedSerial, setCopiedSerial] = useState<string | null>(null);

  // Multi-Selection State for Bulk Transfers
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<string[]>([]);
  const [isMultiTransferWizardOpen, setIsMultiTransferWizardOpen] = useState<boolean>(false);
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4 | 5 | 6>(1);
  const [wizardSource, setWizardSource] = useState<string>('محل 1');
  const [wizardDest, setWizardDest] = useState<string>('محل 2');
  const [wizardNotes, setWizardNotes] = useState<string>('تحويل مخزون محدد');
  const [wizardPreview, setWizardPreview] = useState<TransferPreviewResponse | null>(null);
  const [wizardResult, setWizardResult] = useState<ExecuteTransferResult | null>(null);
  const [isExecutingTransfer, setIsExecutingTransfer] = useState<boolean>(false);

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

  const actor = useMemo(() => {
    return {
      id: user?.id || 'admin',
      username: user?.username || 'admin',
    };
  }, [user]);

  // Load Data
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [devList, modelsList, sum, stores] = await Promise.all([
        mssInventoryService.getDevices(),
        mssCatalogService.getModels(),
        mssInventoryService.getInventorySummary(),
        mssOperationalService.getStores({ includeArchived: false }),
      ]);
      setDevices(devList);
      setCatalogModels(modelsList);
      setSummary(sum);
      setSystemStores(stores);
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

  // Dynamic location options from system stores or fallback
  const locationOptions = useMemo(() => {
    if (systemStores.length > 0) {
      return systemStores.map(s => s.name);
    }
    return ['محل 1', 'محل 2'];
  }, [systemStores]);

  // Bulk Transfer Handlers
  const handleOpenBulkTransfer = () => {
    if (selectedDeviceIds.length === 0) return;
    const selectedDevs = devices.filter(d => selectedDeviceIds.includes(d.id));
    const firstLoc = selectedDevs[0]?.stock_location || 'محل 1';
    setWizardSource(firstLoc);
    const otherStore =
      systemStores.find(s => s.name !== firstLoc)?.name || (firstLoc === 'محل 1' ? 'محل 2' : 'محل 1');
    setWizardDest(otherStore);
    setWizardNotes(`تحويل دفعة أجهزة (${selectedDeviceIds.length} جهاز)`);
    setWizardPreview(null);
    setWizardResult(null);
    setWizardStep(1);
    setIsMultiTransferWizardOpen(true);
  };

  const handlePreviewBulkTransfer = async () => {
    if (wizardSource === wizardDest) {
      showNotification({
        type: 'warning',
        title: 'تنبيه موقع التحويل',
        message: 'لا يمكن تحويل الأجهزة إلى نفس موقع المصدر الحالي',
      });
      return;
    }
    try {
      const preview = await mssOperationalService.previewInventoryTransfer({
        sourceLocation: wizardSource,
        destinationLocation: wizardDest,
        transferType: 'SELECTED',
        deviceIds: selectedDeviceIds,
      });
      setWizardPreview(preview);
      setWizardStep(2);
    } catch (err: any) {
      showNotification({
        type: 'error',
        title: 'خطأ في معاينة التحويل',
        message: err.message || 'تعذر حساب وتدقيق معاينة التحويل',
      });
    }
  };

  const handleExecuteBulkTransfer = async () => {
    if (!wizardPreview || !wizardPreview.canTransfer) return;
    setIsExecutingTransfer(true);
    try {
      const result = await mssOperationalService.executeInventoryTransfer(
        {
          sourceLocation: wizardSource,
          destinationLocation: wizardDest,
          transferType: 'SELECTED',
          deviceIds: wizardPreview.eligibleDevices.map(d => d.id),
          notes: wizardNotes.trim() || undefined,
          confirmed: true,
        },
        actor
      );
      setWizardResult(result);
      setWizardStep(3);
      setSelectedDeviceIds([]);
      showNotification({
        type: 'success',
        title: 'تم تنفيذ التحويل بنجاح',
        message: result.message,
      });
      await loadData();
    } catch (err: any) {
      showNotification({
        type: 'error',
        title: 'فشل التحويل الجماعي',
        message: err.message || 'حدث خطأ أثناء تنفيذ عملية التحويل',
      });
    } finally {
      setIsExecutingTransfer(false);
    }
  };

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
    if (categoryFilter !== 'ALL' && d.category !== categoryFilter) return false;
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
      key: 'select',
      header: 'تحديد',
      render: (item: MSSDevice) => {
        const isEligible = item.status === 'AVAILABLE';
        const isChecked = selectedDeviceIds.includes(item.id);
        return (
          <div className="flex items-center justify-center">
            <input
              type="checkbox"
              checked={isChecked}
              disabled={!isEligible}
              onChange={() => {
                setSelectedDeviceIds(prev =>
                  prev.includes(item.id) ? prev.filter(x => x !== item.id) : [...prev, item.id]
                );
              }}
              title={!isEligible ? 'غير متاح للتحويل (مباع أو محجوز)' : undefined}
              className="rounded border-slate-300 text-blue-600 disabled:opacity-30 cursor-pointer"
            />
          </div>
        );
      },
    },
    {
      key: 'serial_number',
      header: 'السيريال نمبر',
      render: (item: MSSDevice) => (
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-bold text-slate-900 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-300 tracking-wide select-all tabular-nums">
            {item.serial_number}
          </span>
          <button
            onClick={() => handleCopySerial(item.serial_number)}
            title="نسخ السيريال"
            className="text-slate-400 hover:text-slate-800 p-1 rounded hover:bg-slate-200 transition-colors"
          >
            {copiedSerial === item.serial_number ? (
              <Check className="w-4 h-4 text-emerald-600" />
            ) : (
              <Copy className="w-4 h-4" />
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
          <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
            {item.category === 'لابتوب' ? (
              <Laptop className="w-4 h-4 text-slate-500" />
            ) : item.category === 'شاشة' ? (
              <Monitor className="w-4 h-4 text-slate-500" />
            ) : (
              <Box className="w-4 h-4 text-slate-500" />
            )}
            <span>
              {item.brand} {item.model_name}
            </span>
          </div>
          {item.model && (
            <p className="text-xs text-slate-500 font-mono font-medium">
              {[item.model.processor, item.model.gpu, item.model.ram, item.model.storage, item.model.screen_size]
                .filter(x => x && x !== '-')
                .join(' • ')}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'stock_location',
      header: 'موقع التخزين',
      render: (item: MSSDevice) => (
        <div className="flex items-center gap-2">
          <Store className="w-4 h-4 text-slate-500" />
          <Badge variant={item.stock_location === 'محل 1' ? 'primary' : 'default'} size="sm" className="font-semibold">
            {item.stock_location}
          </Badge>
        </div>
      ),
    },
    {
      key: 'physical_condition',
      header: 'الحالة',
      render: (item: MSSDevice) => (
        <span className="text-xs font-medium text-slate-700">
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
            return <Badge variant="success" size="sm" className="font-semibold">متاح للبيع</Badge>;
          case 'RESERVED':
            return <Badge variant="warning" size="sm" className="font-semibold">محجوز</Badge>;
          case 'SOLD':
            return <Badge variant="default" size="sm" className="font-semibold">تم البيع</Badge>;
          case 'MAINTENANCE':
            return <Badge variant="danger" size="sm" className="font-semibold">صيانة</Badge>;
          case 'RETURNED':
            return <Badge variant="info" size="sm" className="font-semibold">مرتجع</Badge>;
          default:
            return <Badge variant="default" size="sm" className="font-semibold">{item.status}</Badge>;
        }
      },
    },
    {
      key: 'purchase_cost',
      header: 'التكلفة',
      render: (item: MSSDevice) => (
        <span className="font-mono text-sm text-slate-600 font-medium tabular-nums">
          {formatCurrency(item.purchase_cost)}
        </span>
      ),
    },
    {
      key: 'listPrice',
      header: 'سعر العرض',
      render: (item: MSSDevice) => (
        <span className="font-bold text-slate-900 text-sm font-mono tabular-nums">
          {formatCurrency(item.list_price)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'إجراءات',
      render: (item: MSSDevice) => (
        <div className="flex items-center gap-1.5">
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
            className="p-1.5 text-slate-600 hover:text-slate-900"
            disabled={item.status === 'SOLD'}
          >
            <ArrowLeftRight className="w-4 h-4" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleOpenEdit(item)}
            title="تعديل بيانات الجهاز"
            className="p-1.5 text-slate-600 hover:text-slate-900"
          >
            <Pencil className="w-4 h-4" />
          </Button>

          {item.status !== 'SOLD' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleOpenDelete(item)}
              title="حذف الجهاز من المخزون"
              className="p-1.5 text-slate-400 hover:text-rose-700"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <PageHeader
        title="المخزون الفعلي ومتابعة السيريالات"
        subtitle="تتبع دقيق لكل قطعة هاردوير بسيريالها الفريد، وحركتها وتكلفتها وحالتها في مختلف الفروع والمخازن"
        actions={
          <div className="flex items-center gap-2.5">
            {selectedDeviceIds.length > 0 && (
              <Button
                variant="primary"
                size="md"
                onClick={handleOpenBulkTransfer}
                leftIcon={<ArrowLeftRight className="w-4.5 h-4.5" />}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
              >
                تحويل الأجهزة المحددة ({selectedDeviceIds.length})
              </Button>
            )}

            <Button
              variant="outline"
              size="md"
              onClick={() => handleOpenTransfer()}
              leftIcon={<ArrowLeftRight className="w-4.5 h-4.5 text-slate-600" />}
              className="border-slate-300 font-semibold"
            >
              نقل جهاز بين المحلين
            </Button>

            <Button
              variant="primary"
              size="md"
              onClick={handleOpenAdd}
              leftIcon={<Plus className="w-4.5 h-4.5" />}
              className="font-bold"
            >
              إضافة جهاز جديد بالسيريال
            </Button>
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <Card className="p-4 bg-white border border-slate-300 shadow-2xs">
          <p className="text-xs text-slate-600 font-bold mb-1">إجمالي الأجهزة</p>
          <div className="flex items-baseline justify-between">
            <span className="text-xl font-bold text-slate-900 font-mono tabular-nums">{summary?.total_units || 0}</span>
            <Layers className="w-5 h-5 text-slate-500" />
          </div>
          <span className="text-xs text-slate-500 mt-0.5 block">سيريالات مسجلة</span>
        </Card>

        <Card className="p-4 bg-white border border-slate-300 shadow-2xs">
          <p className="text-xs text-slate-600 font-bold mb-1">متوفر بمحل 1</p>
          <div className="flex items-baseline justify-between">
            <span className="text-xl font-bold text-slate-900 font-mono tabular-nums">{summary?.available_shop1 || 0}</span>
            <Store className="w-5 h-5 text-slate-500" />
          </div>
          <span className="text-xs text-slate-500 mt-0.5 block">جاهز للبيع الفوري</span>
        </Card>

        <Card className="p-4 bg-white border border-slate-300 shadow-2xs">
          <p className="text-xs text-slate-600 font-bold mb-1">متوفر بمحل 2</p>
          <div className="flex items-baseline justify-between">
            <span className="text-xl font-bold text-slate-900 font-mono tabular-nums">{summary?.available_shop2 || 0}</span>
            <Store className="w-5 h-5 text-slate-500" />
          </div>
          <span className="text-xs text-slate-500 mt-0.5 block">جاهز للبيع الفوري</span>
        </Card>

        <Card className="p-4 bg-white border border-slate-300 shadow-2xs">
          <p className="text-xs text-slate-600 font-bold mb-1">إجمالي المتوفر</p>
          <div className="flex items-baseline justify-between">
            <span className="text-xl font-bold text-emerald-800 font-mono tabular-nums">{summary?.available_total || 0}</span>
            <Check className="w-5 h-5 text-emerald-600" />
          </div>
          <span className="text-xs text-slate-500 mt-0.5 block">بالمحلين معاً</span>
        </Card>

        <Card className="p-4 bg-white border border-slate-300 shadow-2xs">
          <p className="text-xs text-slate-600 font-bold mb-1">محجوز لعملاء</p>
          <div className="flex items-baseline justify-between">
            <span className="text-xl font-bold text-slate-900 font-mono tabular-nums">{summary?.reserved_total || 0}</span>
            <Calendar className="w-5 h-5 text-slate-500" />
          </div>
          <span className="text-xs text-slate-500 mt-0.5 block">حجز مؤقت</span>
        </Card>

        <Card className="p-4 bg-white border border-slate-300 shadow-2xs">
          <p className="text-xs text-slate-600 font-bold mb-1">صيانة أو مرتجع</p>
          <div className="flex items-baseline justify-between">
            <span className="text-xl font-bold text-slate-900 font-mono tabular-nums">
              {(summary?.maintenance_total || 0) + (summary?.returned_total || 0)}
            </span>
            <AlertTriangle className="w-5 h-5 text-slate-500" />
          </div>
          <span className="text-xs text-slate-500 mt-0.5 block">غير جاهز للبيع</span>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card className="p-3.5 bg-white border-slate-300 shadow-2xs space-y-3.5">
        <div className="flex flex-col md:flex-row items-center gap-3">
          <div className="flex-1 w-full">
            <Input
              placeholder="ابحث بالسيريال، الموديل، الماركة، الحالة..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onClear={() => setSearchQuery('')}
              leftIcon={<Search className="w-4.5 h-4.5 text-slate-500" />}
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <Button
              variant="outline"
              size="md"
              onClick={() => triggerRefresh(loadData, 'جارٍ تحديث المخزون الفعلي وأجهزة السيريال...')}
              disabled={isRefreshing || isLoading}
              title="إعادة تحميل البيانات"
              leftIcon={<RefreshCw className={`w-4 h-4 text-slate-600 ${isRefreshing ? 'animate-spin' : ''}`} />}
              className="border-slate-300 font-semibold"
            >
              Refresh
            </Button>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200 text-sm">
          {/* Location Filter */}
          <div className="flex items-center gap-2.5">
            <span className="font-bold text-slate-700 text-xs">الموقع / الفرع:</span>
            <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-300 gap-1 flex-wrap">
              <button
                onClick={() => setLocationFilter('ALL')}
                className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                  locationFilter === 'ALL'
                    ? 'bg-white text-slate-900 shadow-subtle font-bold border border-slate-300'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                الكل ({devices.length})
              </button>
              {locationOptions.map(loc => (
                <button
                  key={loc}
                  onClick={() => setLocationFilter(loc)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                    locationFilter === loc
                      ? 'bg-white text-slate-900 shadow-subtle font-bold border border-slate-300'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {loc} ({devices.filter(d => d.stock_location === loc).length})
                </button>
              ))}
            </div>
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-2.5">
            <span className="font-bold text-slate-700 text-xs">التصنيف:</span>
            <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-300 gap-1">
              {[
                { id: 'ALL', label: 'الكل' },
                { id: 'لابتوب', label: 'لابتوب' },
                { id: 'شاشة', label: 'شاشة' },
              ].map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setCategoryFilter(cat.id)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                    categoryFilter === cat.id
                      ? 'bg-white text-slate-900 shadow-subtle font-bold border border-slate-300'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2.5">
            <span className="font-bold text-slate-700 text-xs">الحالة:</span>
            <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-300 gap-1">
              {(
                [
                  { id: 'ALL', label: 'الكل' },
                  { id: 'AVAILABLE', label: 'متاح للبيع' },
                  { id: 'RESERVED', label: 'محجوز' },
                  { id: 'SOLD', label: 'تم البيع' },
                  { id: 'MAINTENANCE', label: 'صيانة' },
                  { id: 'RETURNED', label: 'مرتجع' },
                ] as const
              ).map(st => (
                <button
                  key={st.id}
                  onClick={() => setStatusFilter(st.id)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                    statusFilter === st.id
                      ? 'bg-white text-slate-900 shadow-subtle font-bold border border-slate-300'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* Bulk Selection Actions Banner */}
      {selectedDeviceIds.length > 0 && (
        <Card className="p-3.5 bg-emerald-50 border-emerald-300 text-xs shadow-2xs">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 text-emerald-900 font-bold">
              <CheckCircle2 className="w-4.5 h-4.5 text-emerald-600" />
              <span>
                تم تحديد <strong className="font-mono text-sm underline">{selectedDeviceIds.length}</strong> جهاز جاهز للتحويل الجماعي بين الفروع
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedDeviceIds([])}
                className="text-slate-600 hover:text-slate-900 text-xs"
              >
                إلغاء التحديد
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleOpenBulkTransfer}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
                leftIcon={<ArrowLeftRight className="w-3.5 h-3.5" />}
              >
                بدء تحويل الأجهزة المحددة ({selectedDeviceIds.length})
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Selection Helpers */}
      <div className="flex items-center justify-between px-1 text-xs text-slate-600">
        <div className="flex items-center gap-2">
          <span>إجمالي المعروض: <strong>{filteredDevices.length}</strong></span>
          {filteredDevices.some(d => d.status === 'AVAILABLE') && (
            <>
              <span>•</span>
              <button
                type="button"
                onClick={() => {
                  const avail = filteredDevices.filter(d => d.status === 'AVAILABLE').map(d => d.id);
                  setSelectedDeviceIds(Array.from(new Set([...selectedDeviceIds, ...avail])));
                }}
                className="text-blue-600 hover:underline font-semibold"
              >
                تحديد جميع الأجهزة المتاحة الظاهرة ({filteredDevices.filter(d => d.status === 'AVAILABLE').length})
              </button>
            </>
          )}
        </div>
        {selectedDeviceIds.length > 0 && (
          <button
            type="button"
            onClick={() => setSelectedDeviceIds([])}
            className="text-rose-600 hover:underline font-semibold"
          >
            إلغاء تحديد الكل ({selectedDeviceIds.length})
          </button>
        )}
      </div>

      {/* Main Table */}
      {isLoading ? (
        <Card className="p-16 text-center bg-white border-slate-300">
          <Spinner size="lg" className="mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-600">جاري تحميل بيانات الأجهزة والمخزون السحابي...</p>
        </Card>
      ) : filteredDevices.length === 0 ? (
        <Card className="p-16 text-center space-y-3 bg-white border-slate-300">
          <Box className="w-10 h-10 mx-auto text-slate-400" />
          <h3 className="text-base font-bold text-slate-800">لا توجد أجهزة مطابقة للبحث أو التصفية</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            يمكنك مسح كود السيريال بالماسح الضوئي مباشرة أو إضافة جهاز جديد وربطه بموديل من الكتالوج.
          </p>
          <Button
            variant="outline"
            size="md"
            onClick={handleOpenAdd}
            leftIcon={<Plus className="w-4.5 h-4.5" />}
            className="border-slate-300 font-semibold"
          >
            تسجيل جهاز جديد الآن
          </Button>
        </Card>
      ) : (
        <div className="bg-white rounded-xl border border-slate-300 overflow-hidden shadow-2xs">
          <Table
            columns={columns}
            data={filteredDevices}
            keyExtractor={(item: MSSDevice) => item.id}
          />
        </div>
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
          <div className="flex items-center justify-between w-full">
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
              leftIcon={isSubmitting ? <Spinner size="sm" /> : <Plus className="w-4 h-4" />}
            >
              {isSubmitting ? 'جاري الحفظ...' : 'تسجيل الجهاز'}
            </Button>
          </div>
        }
      >
        <form onSubmit={handleSaveAdd} className="space-y-4 text-xs">
          {formError && (
            <Alert type="danger" title="خطأ في البيانات" message={formError} />
          )}

          {/* Serial Number */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              السيريال نمبر الفريد <span className="text-rose-500">*</span>
            </label>
            <Input
              placeholder="اكتب السيريال (مثال: PF1K892-LEN)..."
              value={formSerial}
              onChange={e => setFormSerial(e.target.value.toUpperCase())}
              required
              helperText="السيريال فريد لكل جهاز ولا يمكن تكراره نهائياً في النظام"
            />
          </div>

          {/* Linked Model Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                الموديل المرتبط من الكتالوج <span className="text-rose-500">*</span>
              </label>
              <Select
                value={formModelId}
                onChange={e => handleModelChange(e.target.value)}
                options={catalogModels.map(m => ({
                  value: m.id,
                  label: `${m.brand} ${m.model_name} (${m.category}) - سعر العرض: ${m.default_list_price} EGP`,
                }))}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                المحل الفعلي للتخزين <span className="text-rose-500">*</span>
              </label>
              <Select
                value={formLocation}
                onChange={e => setFormLocation(e.target.value as MSSStockLocation)}
                options={[
                  { value: 'محل 1', label: 'محل 1 (الفرع الأول)' },
                  { value: 'محل 2', label: 'محل 2 (الفرع الثاني)' },
                ]}
                required
              />
            </div>
          </div>

          {/* Financials & Purchase Date */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                سعر التكلفة (EGP) <span className="text-rose-500">*</span>
              </label>
              <Input
                type="number"
                min="0"
                step="50"
                value={formCost}
                onChange={e => setFormCost(Number(e.target.value))}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                سعر العرض الاسترشادي (EGP) <span className="text-rose-500">*</span>
              </label>
              <Input
                type="number"
                min="0"
                step="50"
                value={formListPrice}
                onChange={e => setFormListPrice(Number(e.target.value))}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                تاريخ الشراء / الاستلام
              </label>
              <Input
                type="date"
                max={getTodayLocalDateString()}
                value={formPurchaseDate}
                onChange={e => setFormPurchaseDate(e.target.value)}
              />
            </div>
          </div>

          {/* Condition and Status */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                الحالة الظاهرية والفنية
              </label>
              <Select
                value={formCondition}
                onChange={e => setFormCondition(e.target.value)}
                options={[
                  { value: 'فرز أول ممتاز', label: 'فرز أول ممتاز (نظيف جداً بدون خدوش)' },
                  { value: 'كالجديد كرتونة كاملة', label: 'كالجديد بكرتونته وشواحنه الأصلية' },
                  { value: 'فرز أول', label: 'فرز أول (حالة ممتازة)' },
                  { value: 'فرز ثانٍ', label: 'فرز ثانٍ (خدوش سطحية طفيفة)' },
                  { value: 'يحتاج صيانة طفيفة', label: 'يحتاج صيانة طفيفة / مراجعة' },
                ]}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                حالة الجهاز في المخزون
              </label>
              <Select
                value={formStatus}
                onChange={e => setFormStatus(e.target.value as MSSDeviceStatus)}
                options={[
                  { value: 'AVAILABLE', label: 'متاح للبيع الفوري (Available)' },
                  { value: 'RESERVED', label: 'محجوز لعميل (Reserved)' },
                  { value: 'MAINTENANCE', label: 'تحت الصيانة والفحص (Under Maintenance)' },
                ]}
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              ملاحظات إضافية على هذا الجهاز
            </label>
            <textarea
              className="w-full px-3 py-2 text-xs border border-slate-200/80 rounded-lg focus:outline-none focus:border-slate-400 transition-colors"
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
          <div className="flex items-center justify-between w-full">
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
              leftIcon={isSubmitting ? <Spinner size="sm" /> : <Pencil className="w-4 h-4" />}
            >
              {isSubmitting ? 'جاري الحفظ...' : 'حفظ التعديلات'}
            </Button>
          </div>
        }
      >
        <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
          {formError && (
            <Alert type="danger" title="خطأ في التعديل" message={formError} />
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                السيريال نمبر <span className="text-rose-500">*</span>
              </label>
              <Input
                value={formSerial}
                onChange={e => setFormSerial(e.target.value.toUpperCase())}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                موقع التخزين الفعلي
              </label>
              <Select
                value={formLocation}
                onChange={e => setFormLocation(e.target.value as MSSStockLocation)}
                options={[
                  { value: 'محل 1', label: 'محل 1' },
                  { value: 'محل 2', label: 'محل 2' },
                ]}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                سعر التكلفة (EGP) <span className="text-rose-500">*</span>
              </label>
              <Input
                type="number"
                min="0"
                value={formCost}
                onChange={e => setFormCost(Number(e.target.value))}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                سعر العرض (EGP) <span className="text-rose-500">*</span>
              </label>
              <Input
                type="number"
                min="0"
                value={formListPrice}
                onChange={e => setFormListPrice(Number(e.target.value))}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                تاريخ الشراء
              </label>
              <Input
                type="date"
                max={getTodayLocalDateString()}
                value={formPurchaseDate}
                onChange={e => setFormPurchaseDate(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                الحالة الظاهرية
              </label>
              <Input
                value={formCondition}
                onChange={e => setFormCondition(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                حالة الجهاز
              </label>
              <Select
                value={formStatus}
                onChange={e => setFormStatus(e.target.value as MSSDeviceStatus)}
                options={[
                  { value: 'AVAILABLE', label: 'متاح للبيع (Available)' },
                  { value: 'RESERVED', label: 'محجوز لعميل (Reserved)' },
                  { value: 'SOLD', label: 'تم البيع (Sold)' },
                  { value: 'MAINTENANCE', label: 'تحت الصيانة (Under Maintenance)' },
                  { value: 'RETURNED', label: 'مرتجع (Returned)' },
                ]}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              ملاحظات الجهاز
            </label>
            <textarea
              className="w-full px-3 py-2 text-xs border border-slate-200/80 rounded-lg focus:outline-none focus:border-slate-400 transition-colors"
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
        title="تحويل جهاز فعلياً بين المحلين"
        subtitle="توثيق النقل الحقيقي لجهاز من موقع تخزينه الحالي إلى المحل الآخر"
        size="md"
        footer={
          <div className="flex items-center justify-between w-full">
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
              leftIcon={isSubmitting ? <Spinner size="sm" /> : <ArrowLeftRight className="w-4 h-4" />}
            >
              {isSubmitting ? 'جاري توثيق النقل...' : 'تأكيد النقل الفعلي'}
            </Button>
          </div>
        }
      >
        <form onSubmit={handleSaveTransfer} className="space-y-4 text-xs">
          {transferError && (
            <Alert type="danger" title="خطأ في النقل" message={transferError} />
          )}

          {selectedDevice && (
            <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-lg space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">الجهاز المراد نقله:</span>
                <span className="font-mono text-xs font-semibold bg-slate-100 text-slate-800 px-2 py-0.5 rounded border border-slate-200">
                  {selectedDevice.serial_number}
                </span>
              </div>
              <p className="text-xs font-medium text-slate-900">
                {selectedDevice.brand} {selectedDevice.model_name}
              </p>
            </div>
          )}

          {/* Transfer Route Visualizer */}
          <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="text-center">
                <span className="text-[11px] text-slate-500 block mb-1">الموقع الحالي</span>
                <Badge variant={selectedDevice?.stock_location === 'محل 1' ? 'primary' : 'default'}>
                  {selectedDevice?.stock_location || 'محل 1'}
                </Badge>
              </div>

              <div className="flex flex-col items-center px-4">
                <ArrowLeftRight className="w-4 h-4 text-slate-500" />
                <span className="text-[10px] text-slate-500 mt-1">تحويل فعلي</span>
              </div>

              <div className="text-center">
                <span className="text-[11px] text-slate-500 block mb-1">المحل المستلم</span>
                <Badge variant={transferTargetLocation === 'محل 1' ? 'primary' : 'default'}>
                  {transferTargetLocation}
                </Badge>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              سبب إذن النقل والبيان <span className="text-rose-500">*</span>
            </label>
            <textarea
              className="w-full px-3 py-2 text-xs border border-slate-200/80 rounded-lg focus:outline-none focus:border-slate-400 transition-colors"
              rows={2}
              placeholder="مثال: نقل للعرض في واجهة محل 1، أو تلبية طلب محجوز لعميل..."
              value={transferNotes}
              onChange={e => setTransferNotes(e.target.value)}
              required
            />
          </div>

          <p className="text-[11px] text-slate-400 leading-relaxed">
            ملاحظة: يتم حفظ سجل حركة مفصل (Movement Log) بتاريخ النقل وتحديث الموقع الفعلي للجهاز تلقائياً.
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
          <div className="space-y-4 text-xs">
            {/* Main Specs Card */}
            <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-slate-900">
                    {selectedDevice.brand} {selectedDevice.model_name}
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">{selectedDevice.category}</p>
                </div>
                <div className="text-left font-mono">
                  <span className="text-[10px] text-slate-400 block">السيريال الفريد:</span>
                  <span className="font-semibold text-xs bg-slate-100 text-slate-800 px-2.5 py-1 rounded border border-slate-200">
                    {selectedDevice.serial_number}
                  </span>
                </div>
              </div>

              {selectedDevice.model && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2 pt-2 border-t border-slate-200/80 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px]">المعالج:</span>
                    <span className="font-medium text-slate-700">{selectedDevice.model.processor || '-'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">كارت الشاشة:</span>
                    <span className="font-medium text-blue-700 font-mono">{selectedDevice.model.gpu || '-'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">الرام:</span>
                    <span className="font-medium text-slate-700">{selectedDevice.model.ram || '-'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">التخزين:</span>
                    <span className="font-medium text-slate-700">{selectedDevice.model.storage || '-'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">الشاشة:</span>
                    <span className="font-medium text-slate-700">{selectedDevice.model.screen_size || '-'}</span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200/80 text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px] mb-0.5">الموقع الحالي:</span>
                  <Badge variant={selectedDevice.stock_location === 'محل 1' ? 'primary' : 'default'}>
                    {selectedDevice.stock_location}
                  </Badge>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] mb-0.5">حالة الجهاز:</span>
                  <Badge variant={selectedDevice.status === 'AVAILABLE' ? 'success' : 'default'}>
                    {selectedDevice.status}
                  </Badge>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] mb-0.5">الحالة الظاهرية:</span>
                  <span className="text-slate-700 font-medium">{selectedDevice.physical_condition}</span>
                </div>
              </div>

              {selectedDevice.notes && (
                <div className="pt-2 border-t border-slate-200/80 text-xs">
                  <span className="text-slate-400 block text-[10px]">ملاحظات الجهاز:</span>
                  <p className="text-slate-700 mt-0.5">{selectedDevice.notes}</p>
                </div>
              )}
            </div>

            {/* Movement History Section */}
            <div>
              <div className="flex items-center gap-1.5 mb-2.5">
                <History className="w-4 h-4 text-slate-500" />
                <h5 className="font-semibold text-slate-900 text-xs">سجل التحويلات المادية بين الفروع</h5>
              </div>

              {isHistoryLoading ? (
                <div className="p-6 text-center text-xs text-slate-500">
                  <Spinner size="sm" className="mx-auto mb-2" />
                  جاري جلب سجل الحركات...
                </div>
              ) : deviceHistory.length === 0 ? (
                <div className="p-4 bg-slate-50 rounded-lg text-center text-xs text-slate-500 border border-slate-200/80">
                  لا توجد حركات نقل مسجلة لهذا الجهاز حتى الآن (موجود في موقعه الأساسي: {selectedDevice.stock_location}).
                </div>
              ) : (
                <div className="space-y-1.5">
                  {deviceHistory.map(mov => (
                    <div
                      key={mov.id}
                      className="p-2.5 bg-white border border-slate-200/80 rounded-lg flex items-center justify-between text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-500">تحويل من:</span>
                          <Badge variant="default">{mov.from_location}</Badge>
                          <span className="text-slate-400">←</span>
                          <span className="text-slate-500">إلى:</span>
                          <Badge variant="primary">{mov.to_location}</Badge>
                        </div>
                        {mov.notes && <p className="text-[11px] text-slate-500">{mov.notes}</p>}
                      </div>
                      <div className="text-left font-mono text-[11px] text-slate-400 tabular-nums">
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
          <div className="flex items-center justify-between w-full">
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
        <div className="space-y-3 text-xs">
          <p className="text-slate-700">
            هل أنت متأكد من رغبتك في حذف هذا الجهاز بسيرياله الخاص:
          </p>
          <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-lg text-xs space-y-1">
            <p className="font-medium text-slate-900">
              {selectedDevice?.brand} {selectedDevice?.model_name}
            </p>
            <p className="font-mono text-slate-600">السيريال: {selectedDevice?.serial_number}</p>
            <p className="text-slate-500">الموقع: {selectedDevice?.stock_location}</p>
          </div>
        </div>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 6: Multi-Device Guided Transfer Wizard */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isMultiTransferWizardOpen}
        onClose={() => !isExecutingTransfer && setIsMultiTransferWizardOpen(false)}
        title="معالج تحويل الأجهزة الجماعي بين الفروع والمخازن"
        subtitle={`نقل ${selectedDeviceIds.length} جهاز محدد بطريقة ذرية موثوقة`}
        size="lg"
        footer={
          <div className="flex items-center justify-between w-full">
            {wizardStep === 1 && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsMultiTransferWizardOpen(false)}
                >
                  إلغاء
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handlePreviewBulkTransfer}
                  leftIcon={<ArrowLeft className="w-4 h-4" />}
                >
                  معاينة وتدقيق التحويل
                </Button>
              </>
            )}

            {wizardStep === 2 && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setWizardStep(1)}
                  disabled={isExecutingTransfer}
                >
                  العودة للتعديل
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleExecuteBulkTransfer}
                  disabled={isExecutingTransfer || !wizardPreview?.canTransfer}
                  leftIcon={
                    isExecutingTransfer ? (
                      <Spinner size="sm" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )
                  }
                  className="bg-emerald-600 hover:bg-emerald-700 font-bold"
                >
                  {isExecutingTransfer ? 'جارٍ التحويل الذري...' : 'تأكيد وتنفيذ التحويل الآن'}
                </Button>
              </>
            )}

            {wizardStep === 3 && (
              <div className="w-full flex justify-end">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setIsMultiTransferWizardOpen(false)}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  تم، إغلاق المعالج
                </Button>
              </div>
            )}
          </div>
        }
      >
        <div className="space-y-4 text-xs">
          {/* Steps Indicator */}
          <div className="grid grid-cols-3 gap-2 pb-2 border-b border-slate-200">
            {[
              { s: 1, title: 'المواقع والملاحظات' },
              { s: 2, title: 'المعاينة والتدقيق' },
              { s: 3, title: 'إيصال النقل' },
            ].map(st => (
              <div
                key={st.s}
                className={`p-2 rounded-lg text-center font-bold text-xs flex items-center justify-center gap-1.5 ${
                  wizardStep === st.s
                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                    : wizardStep > st.s
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-slate-50 text-slate-400 border border-slate-200'
                }`}
              >
                <span
                  className={`w-4.5 h-4.5 rounded-full flex items-center justify-center text-[10px] ${
                    wizardStep === st.s
                      ? 'bg-blue-600 text-white'
                      : wizardStep > st.s
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-300 text-slate-700'
                  }`}
                >
                  {st.s}
                </span>
                <span>{st.title}</span>
              </div>
            ))}
          </div>

          {/* STEP 1 */}
          {wizardStep === 1 && (
            <div className="space-y-3">
              <Alert variant="info" title="تأكيد مواقع النقل">
                سيتم نقل الأجهزة المحددة ({selectedDeviceIds.length} جهاز) من موقعها الحالي إلى الموقع المستلم.
              </Alert>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    موقع المصدر (الموقع الحالي):
                  </label>
                  <Select
                    value={wizardSource}
                    onChange={e => setWizardSource(e.target.value)}
                    options={locationOptions.map(l => ({ value: l, label: l }))}
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    موقع الوجهة (المستلم):
                  </label>
                  <Select
                    value={wizardDest}
                    onChange={e => setWizardDest(e.target.value)}
                    options={locationOptions
                      .filter(l => l !== wizardSource)
                      .map(l => ({ value: l, label: l }))}
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">ملاحظات التحويل (اختياري):</label>
                <Input
                  value={wizardNotes}
                  onChange={e => setWizardNotes(e.target.value)}
                  placeholder="سبب النقل، أمر الصرف، أو ملاحظات التسليم..."
                />
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <span className="font-bold text-slate-800 block">الأجهزة المحددة للتحويل:</span>
                <div className="max-h-36 overflow-y-auto divide-y divide-slate-200">
                  {devices
                    .filter(d => selectedDeviceIds.includes(d.id))
                    .map(d => (
                      <div key={d.id} className="py-1.5 flex items-center justify-between">
                        <div>
                          <span className="font-medium text-slate-900">{d.brand} {d.model_name}</span>
                          <span className="text-slate-500 font-mono text-[11px] mr-2">[{d.serial_number}]</span>
                        </div>
                        <Badge variant={d.status === 'AVAILABLE' ? 'success' : 'warning'} size="sm">
                          {d.status}
                        </Badge>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 2 */}
          {wizardStep === 2 && wizardPreview && (
            <div className="space-y-3">
              {wizardPreview.canTransfer ? (
                <Alert variant="success" title="جاهز للتحويل">
                  تم فحص وتدقيق كافة الأجهزة بنجاح. الأجهزة مطابقة وجاهزة للتحويل الذري الفوري.
                </Alert>
              ) : (
                <Alert variant="danger" title="تعذر التحويل">
                  توجد قيود تمنع تنفيذ التحويل:
                  <ul className="list-disc pr-4 mt-1 space-y-0.5">
                    {wizardPreview.validationErrors?.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </Alert>
              )}

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                  <span className="text-slate-500 block text-[11px]">موقع المصدر</span>
                  <strong className="text-slate-900">{wizardSource}</strong>
                </div>
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                  <span className="text-slate-500 block text-[11px]">الموقع المستلم</span>
                  <strong className="text-blue-700">{wizardDest}</strong>
                </div>
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                  <span className="text-slate-500 block text-[11px]">الأجهزة المؤهلة</span>
                  <strong className="text-emerald-700 font-mono text-sm">
                    {wizardPreview.eligibleDevices.length} جهاز
                  </strong>
                </div>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <div className="flex justify-between text-slate-700 font-medium">
                  <span>إجمالي تكلفة الأجهزة المنقولة:</span>
                  <span className="font-mono font-bold text-slate-900">
                    {formatCurrency(wizardPreview.totalEligibleCost)}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  * التحويل لا يؤثر على تكلفة الشراء أو الأرباح التاريخية للأجهزة طبقاً لقواعد النظام (Rules C & D).
                </p>
              </div>
            </div>
          )}

          {/* STEP 3 */}
          {wizardStep === 3 && wizardResult && (
            <div className="space-y-3 text-center py-2">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h4 className="text-base font-bold text-slate-900">تم تنفيذ عملية التحويل بنجاح!</h4>
              <p className="text-slate-600">{wizardResult.message}</p>

              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-right space-y-2 max-w-md mx-auto text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">رقم مرجع التحويل:</span>
                  <span className="font-mono font-bold text-slate-900">{wizardResult.referenceNumber || wizardResult.transferId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">عدد الأجهزة المنقولة:</span>
                  <span className="font-mono font-bold text-emerald-700">{wizardResult.itemCount} جهاز</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">من موقع:</span>
                  <span className="font-bold text-slate-800">{wizardSource}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">إلى موقع:</span>
                  <span className="font-bold text-blue-700">{wizardDest}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">تاريخ ووقت التنفيذ:</span>
                  <span className="font-mono text-slate-700">{formatDate(wizardResult.transferredAt || new Date().toISOString())}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};
