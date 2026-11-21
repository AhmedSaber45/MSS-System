import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { Select } from '@/components/common/Select';
import { Table, Column } from '@/components/common/Table';
import { Pagination } from '@/components/common/Pagination';
import { Badge } from '@/components/common/Badge';
import { Card } from '@/components/common/Card';
import { Modal } from '@/components/common/Modal';
import { Alert } from '@/components/common/Alert';
import { Spinner } from '@/components/common/Spinner';
import { useNotification } from '@/context/NotificationContext';
import { usePageRefresh } from '@/context/PageRefreshContext';
import { mssInventoryService } from '@/services/mssInventoryService';
import { mssCatalogService } from '@/services/mssCatalogService';
import { formatCurrency, formatDate, cn } from '@/lib/utils';
import { getTodayLocalDateString } from '@/lib/dateValidation';
import type {
  MSSDevice,
  MSSDeviceStatus,
  MSSStockLocation,
  MSSInventorySummary,
  MSSDeviceMovement,
  NewMSSBulkStockInput,
  AssignSerialsInput,
  MSSModelInventorySummary,
} from '@/types/mssInventory';
import type { ModelStockQuantitySummary } from '@/types/mssReports';
import type { MSSCatalogModel } from '@/types/mssCatalog';
import { MSSModelModal } from './MSSModelModal';
import { MSSDeviceCreationModal } from './MSSDeviceCreationModal';
import { mssOperationalService } from '@/services/mssOperationalService';
import type { SystemStore, TransferPreviewResponse, ExecuteTransferResult } from '@/types/mssOperational';
import { useAuth } from '@/context/AuthContext';
import { SearchableItemSelect } from '@/components/common/SearchableItemSelect';
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
  ChevronDown,
  ChevronUp,
  Barcode,
  Tag,
  BarChart3,
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
  const [isAddModelModalOpen, setIsAddModelModalOpen] = useState<boolean>(false);
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
  const [formCost, setFormCost] = useState<number | ''>(0);
  const [formListPrice, setFormListPrice] = useState<number | ''>(0);
  const [formPurchaseDate, setFormPurchaseDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [formCondition, setFormCondition] = useState<string>('فرز أول ممتاز');
  const [formLocation, setFormLocation] = useState<MSSStockLocation>('محل 1');
  const [formStatus, setFormStatus] = useState<MSSDeviceStatus>('AVAILABLE');
  const [formNotes, setFormNotes] = useState<string>('');
  const [formError, setFormError] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // View Switcher (Units vs Model Summary)
  const [inventoryTab, setInventoryTab] = useState<'UNITS' | 'MODELS'>('UNITS');
  const [modelSummaries, setModelSummaries] = useState<MSSModelInventorySummary[]>([]);
  const [crossWarehouseSummaries, setCrossWarehouseSummaries] = useState<ModelStockQuantitySummary[]>([]);
  const [isCrossWarehouseModalOpen, setIsCrossWarehouseModalOpen] = useState<boolean>(false);
  const [modelSearchQuery, setModelSearchQuery] = useState<string>('');
  const [expandedModelKey, setExpandedModelKey] = useState<string | null>(null);
  const [modelsPage, setModelsPage] = useState<number>(1);

  // Add Stock Modal Mode (Individual vs Bulk)
  const [stockRegistrationMode, setStockRegistrationMode] = useState<'INDIVIDUAL' | 'BULK'>('INDIVIDUAL');
  const [formQuantity, setFormQuantity] = useState<number>(1);

  // Assign Serials to Bulk Stock Modal
  const [isAssignSerialsModalOpen, setIsAssignSerialsModalOpen] = useState<boolean>(false);
  const [assignStockTarget, setAssignStockTarget] = useState<MSSDevice | null>(null);
  const [assignSerialsInputText, setAssignSerialsInputText] = useState<string>('');
  const [assignSerialsNotes, setAssignSerialsNotes] = useState<string>('');
  const [assignSerialsError, setAssignSerialsError] = useState<string>('');
  const [isAssigningSerials, setIsAssigningSerials] = useState<boolean>(false);

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
      const [devList, modelsList, sum, stores, modSummaries, crossSummaries] = await Promise.all([
        mssInventoryService.getDevices(),
        mssCatalogService.getModels(),
        mssInventoryService.getInventorySummary(),
        mssOperationalService.getStores({ includeArchived: false }),
        mssInventoryService.getModelInventorySummary(),
        mssInventoryService.getModelStockQuantitySummary(),
      ]);
      setDevices(devList);
      setCatalogModels(modelsList);
      setSummary(sum);
      setSystemStores(stores);
      setModelSummaries(modSummaries);
      setCrossWarehouseSummaries(crossSummaries);
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
    const handleStoresChanged = () => {
      loadData();
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('mss-stores-changed', handleStoresChanged);
      return () => {
        window.removeEventListener('mss-stores-changed', handleStoresChanged);
      };
    }
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
  const handleOpenAdd = (defaultMode: 'INDIVIDUAL' | 'BULK' = 'BULK') => {
    setStockRegistrationMode(defaultMode);
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

  // Submit Add Device / Bulk Stock
  const handleSaveAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!formModelId) {
      setFormError('يرجى اختيار الموديل المرتبط من الكتالوج');
      return;
    }
    if (Number(formCost) < 0) {
      setFormError('سعر التكلفة لا يمكن أن يكون سالباً');
      return;
    }
    if (Number(formListPrice) < 0) {
      setFormError('سعر العرض لا يمكن أن يكون سالباً');
      return;
    }

    setIsSubmitting(true);
    setFormError('');
    try {
      if (stockRegistrationMode === 'BULK') {
        const qty = Math.floor(formQuantity);
        if (qty <= 0) {
          setFormError('يرجى إدخال كمية صحيحة أكبر من صفر');
          setIsSubmitting(false);
          return;
        }

        await mssInventoryService.createBulkStock({
          model_id: formModelId,
          quantity: qty,
          purchase_cost: Number(formCost) || 0,
          list_price: Number(formListPrice) || 0,
          purchase_date: formPurchaseDate,
          physical_condition: formCondition.trim() || 'فرز أول ممتاز',
          stock_location: formLocation,
          notes: formNotes.trim() || undefined,
        });

        showNotification({
          type: 'success',
          title: 'تم تسجيل المخزون المجمع بنجاح',
          message: `تم إضافة (${qty}) وحدات غير مسلسلة في (${formLocation}).`,
        });
      } else {
        // Individual device (serial optional)
        await mssInventoryService.createDevice({
          serial_number: formSerial.trim() || null,
          model_id: formModelId,
          purchase_cost: Number(formCost) || 0,
          list_price: Number(formListPrice) || 0,
          purchase_date: formPurchaseDate,
          physical_condition: formCondition.trim() || 'فرز أول ممتاز',
          stock_location: formLocation,
          status: formStatus,
          notes: formNotes.trim() || undefined,
        });

        showNotification({
          type: 'success',
          title: 'تم تسجيل الجهاز بنجاح',
          message: formSerial.trim()
            ? `تم إضافة الجهاز بالسيريال (${formSerial.trim().toUpperCase()}) إلى مخزون ${formLocation}`
            : `تم إضافة جهاز (بدون سيريال) إلى مخزون ${formLocation}`,
        });
      }

      setIsAddModalOpen(false);
      await loadData();
    } catch (err: any) {
      setFormError(err.message || 'فشلت عملية حفظ الجهاز في المخزون');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (device: MSSDevice) => {
    setSelectedDevice(device);
    setFormSerial(device.serial_number || '');
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

    if (Number(formCost) < 0 || Number(formListPrice) < 0) {
      setFormError('الأسعار لا يمكن أن تكون سالبة');
      return;
    }

    setIsSubmitting(true);
    setFormError('');
    try {
      await mssInventoryService.updateDevice(selectedDevice.id, {
        serial_number: formSerial.trim() || null,
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
        message: `تم تحديث بيانات الجهاز (${formSerial.trim() || selectedDevice.model_name || 'بدون سيريال'}) بنجاح`,
      });

      setIsEditModalOpen(false);
      await loadData();
    } catch (err: any) {
      setFormError(err.message || 'فشلت عملية تعديل الجهاز');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Assign Serials Modal
  const handleOpenAssignSerials = (stock: MSSDevice) => {
    setAssignStockTarget(stock);
    setAssignSerialsInputText('');
    setAssignSerialsNotes('');
    setAssignSerialsError('');
    setIsAssignSerialsModalOpen(true);
  };

  // Submit Assign Serials
  const handleSaveAssignSerials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignStockTarget || isAssigningSerials) return;

    const rawSerials = assignSerialsInputText
      .split(/[\n,;]+/)
      .map(s => s.trim().toUpperCase())
      .filter(Boolean);

    if (rawSerials.length === 0) {
      setAssignSerialsError('يرجى إدخال رقم سيريال واحد على الأقل للتعيين');
      return;
    }

    const uniqueInput = new Set(rawSerials);
    if (uniqueInput.size !== rawSerials.length) {
      setAssignSerialsError('يوجد تكرار في أرقام السيريال المدخلة في نفس العملية. يرجى التأكد من أن كل سيريال فريد.');
      return;
    }

    const availableQty = assignStockTarget.quantity && assignStockTarget.quantity > 0 ? assignStockTarget.quantity : 1;
    if (rawSerials.length > availableQty) {
      setAssignSerialsError(
        `عدد أرقام السيريال المدخلة (${rawSerials.length}) يتجاوز الكمية المتاحة غير المسلسلة (${availableQty})`
      );
      return;
    }

    setIsAssigningSerials(true);
    setAssignSerialsError('');
    try {
      const res = await mssInventoryService.assignSerialsToBulkStock({
        stock_id: assignStockTarget.id,
        serial_numbers: rawSerials,
        notes: assignSerialsNotes.trim() || undefined,
      });

      showNotification({
        type: 'success',
        title: 'تم تعيين أرقام السيريال بنجاح',
        message: `تم تحويل (${res.convertedDevices.length}) أجهزة إلى أجهزة فردية مسلسلة. المتبقي بدون سيريال: (${res.remainingStock?.quantity || 0}) وحدات.`,
      });

      setIsAssignSerialsModalOpen(false);
      setAssignStockTarget(null);
      await loadData();
    } catch (err: any) {
      setAssignSerialsError(err.message || 'فشل تعيين أرقام السيريال');
    } finally {
      setIsAssigningSerials(false);
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
    const target = locationOptions.find(l => l !== dev.stock_location) || locationOptions[0] || 'محل 2';
    setTransferTargetLocation(target);
    setTransferNotes('لتعويض النقص فى المخزون الأخر');
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

  // Filtered devices: Sold devices are visually de-emphasized and partitioned to the bottom (Requirement 1)
  const filteredDevices = useMemo(() => {
    const list = devices.filter(d => {
      if (locationFilter !== 'ALL' && d.stock_location !== locationFilter) return false;
      if (statusFilter !== 'ALL' && d.status !== statusFilter) return false;
      if (categoryFilter !== 'ALL' && d.category !== categoryFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchSerial = Boolean(d.serial_number?.toLowerCase().includes(q));
        const matchModel = d.model_name?.toLowerCase().includes(q);
        const matchBrand = d.brand?.toLowerCase().includes(q);
        const matchCondition = d.physical_condition?.toLowerCase().includes(q);
        const matchNotes = d.notes?.toLowerCase().includes(q);
        if (!matchSerial && !matchModel && !matchBrand && !matchCondition && !matchNotes) {
          return false;
        }
      }
      return true;
    });

    // Stable partition: non-sold first, sold at the bottom
    const nonSold: MSSDevice[] = [];
    const sold: MSSDevice[] = [];
    for (const d of list) {
      if (d.status === 'SOLD') {
        sold.push(d);
      } else {
        nonSold.push(d);
      }
    }
    return [...nonSold, ...sold];
  }, [devices, locationFilter, statusFilter, categoryFilter, searchQuery]);

  // Filtered model summaries
  const filteredModelSummaries = useMemo(() => {
    const q = (modelSearchQuery || searchQuery).trim().toLowerCase();
    return modelSummaries.filter(m => {
      if (locationFilter !== 'ALL' && m.branch !== locationFilter) return false;
      if (categoryFilter !== 'ALL' && m.category !== categoryFilter) return false;
      if (q) {
        const matchName = m.model_name?.toLowerCase().includes(q);
        const matchBrand = m.brand?.toLowerCase().includes(q);
        const matchCode = m.model_code?.toLowerCase().includes(q);
        const matchCategory = m.category?.toLowerCase().includes(q);
        if (!matchName && !matchBrand && !matchCode && !matchCategory) {
          return false;
        }
      }
      return true;
    });
  }, [modelSummaries, locationFilter, categoryFilter, modelSearchQuery, searchQuery]);

  // Reset models page when filters change
  useEffect(() => {
    setModelsPage(1);
  }, [locationFilter, categoryFilter, modelSearchQuery, searchQuery]);

  const pagedModelSummaries = useMemo(() => {
    const total = filteredModelSummaries.length;
    const maxPage = Math.max(1, Math.ceil(total / 9));
    const safePage = Math.min(modelsPage, maxPage);
    return filteredModelSummaries.slice((safePage - 1) * 9, safePage * 9);
  }, [filteredModelSummaries, modelsPage]);

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
        item.serial_number ? (
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-bold text-slate-900 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-300 tracking-wide select-all tabular-nums">
              {item.serial_number}
            </span>
            <button
              onClick={() => handleCopySerial(item.serial_number!)}
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
        ) : (
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge variant="outline" size="sm" className="font-semibold text-slate-600 bg-slate-50 border-dashed">
              بدون سيريال {item.quantity && item.quantity > 1 ? `(${item.quantity} وحدات)` : ''}
            </Badge>
            {item.status === 'AVAILABLE' && (
              <button
                type="button"
                onClick={() => handleOpenAssignSerials(item)}
                className="text-[10px] text-blue-600 hover:text-blue-800 hover:underline font-bold bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200 transition-colors"
                title="تعيين أرقام سيريال لهذه الوحدات غير المسلسلة"
              >
                تعيين سيريال
              </button>
            )}
          </div>
        )
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
        title="المخزون   "
        subtitle=""
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
              variant="outline"
              size="md"
              onClick={() => setIsAddModelModalOpen(true)}
              leftIcon={<Plus className="w-4.5 h-4.5 text-blue-600" />}
              className="border-slate-300 font-bold text-blue-700 hover:bg-blue-50"
            >
              إضافة موديل جديد
            </Button>

            <Button
              variant="primary"
              size="md"
              onClick={() => handleOpenAdd()}
              leftIcon={<Plus className="w-4.5 h-4.5" />}
              className="font-bold"
            >
              إضافة جهاز جديد
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
        </Card>

        {locationOptions.map(loc => {
          const count = summary?.location_breakdown?.[loc] ?? (loc === 'محل 1' ? summary?.available_shop1 : loc === 'محل 2' ? summary?.available_shop2 : 0) ?? 0;
          return (
            <Card key={loc} className="p-4 bg-white border border-slate-300 shadow-2xs">
              <p className="text-xs text-slate-600 font-bold mb-1">متوفر بـ {loc}</p>
              <div className="flex items-baseline justify-between">
                <span className="text-xl font-bold text-slate-900 font-mono tabular-nums">{count}</span>
                <Store className="w-5 h-5 text-slate-500" />
              </div>
            </Card>
          );
        })}

        <Card className="p-4 bg-white border border-slate-300 shadow-2xs">
          <p className="text-xs text-slate-600 font-bold mb-1">إجمالي المتوفر</p>
          <div className="flex items-baseline justify-between">
            <span className="text-xl font-bold text-emerald-800 font-mono tabular-nums">{summary?.available_total || 0}</span>
            <Check className="w-5 h-5 text-emerald-600" />
          </div>
        </Card>

        <Card className="p-4 bg-white border border-slate-300 shadow-2xs">
          <p className="text-xs text-slate-600 font-bold mb-1">محجوز لعملاء</p>
          <div className="flex items-baseline justify-between">
            <span className="text-xl font-bold text-slate-900 font-mono tabular-nums">{summary?.reserved_total || 0}</span>
            <Calendar className="w-5 h-5 text-slate-500" />
          </div>
        </Card>

        <Card className="p-4 bg-white border border-slate-300 shadow-2xs">
          <p className="text-xs text-slate-600 font-bold mb-1">صيانة أو مرتجع</p>
          <div className="flex items-baseline justify-between">
            <span className="text-xl font-bold text-slate-900 font-mono tabular-nums">
              {(summary?.maintenance_total || 0) + (summary?.returned_total || 0)}
            </span>
            <AlertTriangle className="w-5 h-5 text-slate-500" />
          </div>
        </Card>
      </div>

      {/* View Switcher: Units vs Model Summary */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-300 gap-1">
          <button
            type="button"
            onClick={() => setInventoryTab('UNITS')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
              inventoryTab === 'UNITS'
                ? 'bg-white text-slate-900 shadow-subtle border border-slate-300'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Laptop className="w-4 h-4" />
            <span>الأجهزة الفردية والدفعات ({devices.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setInventoryTab('MODELS')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
              inventoryTab === 'MODELS'
                ? 'bg-white text-slate-900 shadow-subtle border border-slate-300'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>ملخص المخزون حسب الموديل ({modelSummaries.length})</span>
          </button>
        </div>

        <div className="text-xs text-slate-600 font-medium">
          {summary && (
            <span>
              إجمالي المتوفر: <strong className="text-emerald-700 font-bold">{summary.available_total}</strong> (مسلسل: {summary.available_serialized_total || 0} • غير مسلسل: {summary.available_non_serialized_total || 0})
            </span>
          )}
        </div>
      </div>

      {/* Render Active View Tab */}
      {inventoryTab === 'MODELS' ? (
        <div className="space-y-4">
          {/* Model Summary Search & Branch Filter Bar */}
          <Card className="p-3.5 bg-white border-slate-300 shadow-2xs space-y-3">
            <div className="flex flex-col md:flex-row items-center gap-3">
              <div className="flex-1 w-full">
                <Input
                  placeholder="ابحث باسم الموديل، الماركة، كود الموديل أو التصنيف..."
                  value={modelSearchQuery}
                  onChange={e => setModelSearchQuery(e.target.value)}
                  onClear={() => setModelSearchQuery('')}
                  leftIcon={<Search className="w-4.5 h-4.5 text-slate-500" />}
                />
              </div>

              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="font-bold text-slate-700 text-xs">الفرع:</span>
                <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-300 gap-1 flex-wrap">
                  <button
                    onClick={() => setLocationFilter('ALL')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      locationFilter === 'ALL'
                        ? 'bg-white text-slate-900 shadow-subtle font-bold border border-slate-300'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    كافة الفروع
                  </button>
                  {locationOptions.map(loc => (
                    <button
                      key={loc}
                      onClick={() => setLocationFilter(loc)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        locationFilter === loc
                          ? 'bg-white text-slate-900 shadow-subtle font-bold border border-slate-300'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {loc}
                    </button>
                  ))}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsCrossWarehouseModalOpen(true)}
                  leftIcon={<BarChart3 className="w-4 h-4 text-blue-600" />}
                  className="border-blue-300 text-blue-900 bg-blue-50/70 hover:bg-blue-100 font-bold whitespace-nowrap text-xs shadow-2xs"
                >
                  ملخص كميات الموديلات الشامل (كافة الفروع)
                </Button>
              </div>
            </div>
          </Card>

          {/* Model Summaries Table */}
          {isLoading ? (
            <Card className="p-12 text-center bg-white border-slate-300">
              <Spinner size="lg" className="mx-auto mb-3" />
              <p className="text-xs font-medium text-slate-600">جاري تجميع وحساب ملخص المخزون حسب الموديل...</p>
            </Card>
          ) : filteredModelSummaries.length === 0 ? (
            <Card className="p-12 text-center space-y-3 bg-white border-slate-300">
              <Layers className="w-10 h-10 mx-auto text-slate-400" />
              <h3 className="text-base font-bold text-slate-800">لا توجد موديلات مطابقة للبحث</h3>
              <p className="text-xs text-slate-500">جرب البحث بكلمات أخرى أو اختر فرعاً مختلفاً.</p>
            </Card>
          ) : (
            <div className="bg-white rounded-xl border border-slate-300 overflow-hidden shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-right border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold">
                    <tr>
                      <th className="p-3">الموديل والماركة</th>
                      <th className="p-3">الفرع / الموقع</th>
                      <th className="p-3 text-center">الموجود بالمخزون (Existing)</th>
                      <th className="p-3 text-center">الوحدات المباعة (Sold)</th>
                      <th className="p-3 text-center">إجمالي الوحدات (Total)</th>
                      <th className="p-3 text-center">تفصيل المتاح</th>
                      <th className="p-3 text-center">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {pagedModelSummaries.map(m => {
                      const rowKey = `${m.model_id}:::${m.branch}`;
                      const isExpanded = expandedModelKey === rowKey;
                      const hasNonSerialized = m.available_non_serialized > 0;
                      const firstNonSerialized = m.devices.find(
                        d => (!d.serial_number || d.is_serialized === false) && d.status === 'AVAILABLE'
                      );

                      return (
                        <React.Fragment key={rowKey}>
                          <tr className={`hover:bg-slate-50/80 transition-colors ${isExpanded ? 'bg-blue-50/30' : ''}`}>
                            <td className="p-3 font-medium">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-900 text-sm">
                                  {m.brand} {m.model_name}
                                </span>
                                {m.model_code && (
                                  <span className="font-mono text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200">
                                    {m.model_code}
                                  </span>
                                )}
                                <Badge variant="default" size="sm">
                                  {m.category}
                                </Badge>
                              </div>
                            </td>

                            <td className="p-3">
                              <Badge variant={m.branch === 'محل 1' ? 'primary' : 'default'} size="sm">
                                {m.branch}
                              </Badge>
                            </td>

                            <td className="p-3 text-center">
                              <span className={`font-mono font-bold text-sm px-2.5 py-0.5 rounded-full ${
                                m.existing_units > 0
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-slate-100 text-slate-500'
                              }`}>
                                {m.existing_units}
                              </span>
                            </td>

                            <td className="p-3 text-center">
                              <span className="font-mono font-bold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded border border-slate-200">
                                {m.sold_count}
                              </span>
                            </td>

                            <td className="p-3 text-center">
                              <span className="font-mono font-bold text-slate-900 bg-blue-50 text-blue-800 px-2.5 py-0.5 rounded border border-blue-200">
                                {m.total_units}
                              </span>
                            </td>

                            <td className="p-3 text-center text-[11px] text-slate-600">
                              <span className="font-mono text-slate-800 font-semibold">{m.available_serialized} مسلسل</span>
                              <span className="mx-1">•</span>
                              <span className="font-mono text-amber-700 font-semibold">{m.available_non_serialized} مجمع</span>
                            </td>

                            <td className="p-3 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setExpandedModelKey(isExpanded ? null : rowKey)}
                                  className="text-xs h-7 px-2"
                                  leftIcon={isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                >
                                  {isExpanded ? 'إخفاء' : `الوحدات (${m.devices.length})`}
                                </Button>

                                {hasNonSerialized && firstNonSerialized && (
                                  <Button
                                    variant="primary"
                                    size="sm"
                                    onClick={() => handleOpenAssignSerials(firstNonSerialized)}
                                    className="text-xs h-7 px-2 bg-amber-600 hover:bg-amber-700 text-white font-bold"
                                    leftIcon={<Barcode className="w-3.5 h-3.5" />}
                                  >
                                    تعيين سيريال
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>

                          {/* Expanded Units Details Sub-Row */}
                          {isExpanded && (
                            <tr>
                              <td colSpan={7} className="p-4 bg-slate-50/90 border-y border-slate-200">
                                <div className="space-y-3">
                                  {/* Model Stock Invariant KPI Bar */}
                                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-white rounded-lg border border-slate-200">
                                    <div className="text-right">
                                      <span className="text-[11px] text-slate-500 block">الموجود بالمخزون (Existing)</span>
                                      <span className="font-mono font-bold text-sm text-emerald-800">{m.existing_units} وحدة</span>
                                      <span className="text-[10px] text-slate-500 block">
                                        (متاح: {m.total_available} • محجوز: {m.reserved_count} • صيانة: {m.maintenance_count})
                                      </span>
                                    </div>
                                    <div className="text-right">
                                      <span className="text-[11px] text-slate-500 block">الوحدات المباعة (Sold)</span>
                                      <span className="font-mono font-bold text-sm text-slate-700">{m.sold_count} وحدة</span>
                                      <span className="text-[10px] text-slate-500 block">مبيعات معتمدة لهذا الموديل</span>
                                    </div>
                                    <div className="text-right bg-blue-50/60 p-2 rounded border border-blue-100">
                                      <span className="text-[11px] text-blue-900 font-semibold block">إجمالي الوحدات (Total)</span>
                                      <span className="font-mono font-bold text-sm text-blue-900">{m.total_units} وحدة</span>
                                      <span className="text-[10px] text-blue-700 block font-medium">
                                        Total ({m.total_units}) = Existing ({m.existing_units}) + Sold ({m.sold_count})
                                      </span>
                                    </div>
                                  </div>

                                  <div className="flex items-center justify-between">
                                    <h5 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                                      <Laptop className="w-4 h-4 text-slate-500" />
                                      <span>قائمة الوحدات المسجلة لهذا الموديل في ({m.branch})</span>
                                    </h5>
                                    <span className="text-[11px] text-slate-500">
                                      وحدات المخزون الحالي: {m.devices.length}
                                    </span>
                                  </div>

                                  <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                                    <table className="w-full text-[11px] text-right">
                                      <thead className="bg-slate-100/70 border-b border-slate-200 text-slate-600 font-bold">
                                        <tr>
                                          <th className="p-2">السيريال نمبر</th>
                                          <th className="p-2">الحالة الفنية</th>
                                          <th className="p-2">حالة المخزون</th>
                                          <th className="p-2">سعر التكلفة</th>
                                          <th className="p-2">سعر العرض</th>
                                          <th className="p-2">الملاحظات</th>
                                          <th className="p-2 text-center">إجراء</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100">
                                        {[...m.devices]
                                          .sort((a, b) => {
                                            const aSold = a.status === 'SOLD' ? 1 : 0;
                                            const bSold = b.status === 'SOLD' ? 1 : 0;
                                            return aSold - bSold;
                                          })
                                          .map(dev => (
                                          <tr
                                            key={dev.id}
                                            className={cn(
                                              'hover:bg-slate-50 transition-opacity',
                                              dev.status === 'SOLD' && 'opacity-60 bg-slate-50/80 text-slate-500'
                                            )}
                                          >
                                            <td className="p-2">
                                              {dev.serial_number ? (
                                                <span className="font-mono font-bold text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-300">
                                                  {dev.serial_number}
                                                </span>
                                              ) : (
                                                <Badge variant="outline" size="sm" className="text-[10px]">
                                                  بدون سيريال {dev.quantity && dev.quantity > 1 ? `(${dev.quantity} وحدات)` : ''}
                                                </Badge>
                                              )}
                                            </td>
                                            <td className="p-2 text-slate-700">{dev.physical_condition}</td>
                                            <td className="p-2">
                                              <Badge
                                                variant={
                                                  dev.status === 'AVAILABLE'
                                                    ? 'success'
                                                    : dev.status === 'RESERVED'
                                                    ? 'warning'
                                                    : dev.status === 'SOLD'
                                                    ? 'default'
                                                    : 'danger'
                                                }
                                                size="sm"
                                              >
                                                {dev.status === 'AVAILABLE'
                                                  ? 'متاح'
                                                  : dev.status === 'RESERVED'
                                                  ? 'محجوز'
                                                  : dev.status === 'SOLD'
                                                  ? 'مباع'
                                                  : dev.status}
                                              </Badge>
                                            </td>
                                            <td className="p-2 font-mono text-slate-600">{formatCurrency(dev.purchase_cost)}</td>
                                            <td className="p-2 font-mono font-bold text-slate-900">{formatCurrency(dev.list_price)}</td>
                                            <td className="p-2 text-slate-500 truncate max-w-xs">{dev.notes || '-'}</td>
                                            <td className="p-2 text-center">
                                              <div className="flex items-center justify-center gap-1">
                                                <button
                                                  type="button"
                                                  onClick={() => handleOpenDetails(dev)}
                                                  className="p-1 text-slate-500 hover:text-blue-600 rounded"
                                                  title="عرض التفاصيل"
                                                >
                                                  <Eye className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() => handleOpenEdit(dev)}
                                                  className="p-1 text-slate-500 hover:text-blue-600 rounded"
                                                  title="تعديل"
                                                >
                                                  <Pencil className="w-3.5 h-3.5" />
                                                </button>
                                                {!dev.serial_number && dev.status === 'AVAILABLE' && (
                                                  <button
                                                    type="button"
                                                    onClick={() => handleOpenAssignSerials(dev)}
                                                    className="text-[10px] text-amber-700 hover:underline font-bold bg-amber-50 px-1 py-0.5 rounded border border-amber-200"
                                                    title="تعيين سيريال"
                                                  >
                                                    تعيين
                                                  </button>
                                                )}
                                              </div>
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <Pagination
                currentPage={modelsPage}
                totalItems={filteredModelSummaries.length}
                pageSize={9}
                onPageChange={setModelsPage}
              />
            </div>
          )}
        </div>
      ) : (
        /* Units & Batches View - Main Table & Filters */
        <div className="space-y-4">
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
                  onClick={() => triggerRefresh(loadData, 'جارٍ تحديث المخزون   ...')}
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
                <span className="font-bold text-slate-700 text-xs">الموقع :</span>
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
                    تم تحديد <strong className="font-mono text-sm underline">{selectedDeviceIds.length}</strong> جهاز للتحويل بين الفروع
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
                    تحديد جميع الأجهزة المتاحة ({filteredDevices.filter(d => d.status === 'AVAILABLE').length})
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
              <p className="text-sm font-medium text-slate-600">جاري تحميل بيانات الأجهزة والمخزون ...</p>
            </Card>
          ) : filteredDevices.length === 0 ? (
            <Card className="p-16 text-center space-y-3 bg-white border-slate-300">
              <Box className="w-10 h-10 mx-auto text-slate-400" />
              <h3 className="text-base font-bold text-slate-800">لا توجد أجهزة مطابقة للبحث</h3>
              <Button
                variant="outline"
                size="md"
                onClick={() => handleOpenAdd()}
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
                pagination={{ pageSize: 9 }}
                rowClassName={(item: MSSDevice) =>
                  item.status === 'SOLD'
                    ? 'opacity-60 bg-slate-50/80 text-slate-500 hover:bg-slate-100/80 transition-opacity'
                    : undefined
                }
              />
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: Unified Add Device & Add Model Modals */}
      {/* ========================================================================= */}
      <MSSDeviceCreationModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        initialMode={stockRegistrationMode}
        onSuccess={() => loadData()}
      />

      <MSSModelModal
        isOpen={isAddModelModalOpen}
        onClose={() => setIsAddModelModalOpen(false)}
        onSuccess={() => loadData()}
      />

      {/* ========================================================================= */}
      {/* MODAL 2: Edit Existing Device */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => !isSubmitting && setIsEditModalOpen(false)}
        title={
          selectedDevice?.serial_number
            ? `تعديل بيانات الجهاز (${selectedDevice.serial_number})`
            : `تعديل بيانات الجهاز (${selectedDevice?.model_name || 'بدون سيريال'})`
        }
        subtitle=""
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
                السيريال نمبر <span className="text-slate-400 font-normal">(اختياري)</span>
              </label>
              <Input
                value={formSerial}
                onChange={e => setFormSerial(e.target.value.toUpperCase())}
                placeholder="اتركه فارغاً للأجهزة بدون سيريال..."
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                موقع التخزين
              </label>
              <Select
                value={formLocation}
                onChange={e => setFormLocation(e.target.value as MSSStockLocation)}
                options={locationOptions.map(loc => ({
                  value: loc,
                  label: loc,
                }))}
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
                placeholder="0.00"
                onChange={e => setFormCost(e.target.value === '' ? '' : Number(e.target.value))}
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
                placeholder="0.00"
                onChange={e => setFormListPrice(e.target.value === '' ? '' : Number(e.target.value))}
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
                الحالة
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
                  { value: 'AVAILABLE', label: 'متاح  ' },
                  { value: 'RESERVED', label: 'محجوز  ' },
                  { value: 'SOLD', label: 'تم البيع ' },
                  { value: 'MAINTENANCE', label: 'تحت الصيانة ' },
                  { value: 'RETURNED', label: 'مرتجع ' },
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
        title="نقل جهاز من مخزون لأخر"
        subtitle=""
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
              {isSubmitting ? 'جاري  النقل...' : 'تأكيد النقل '}
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
                <span className="text-[10px] text-slate-500 mt-1">نقل </span>
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
              سبب  النقل  <span className="text-rose-500">*</span>
            </label>
            <textarea
              className="w-full px-3 py-2 text-xs border border-slate-200/80 rounded-lg focus:outline-none focus:border-slate-400 transition-colors"
              rows={2}
              placeholder=""
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
        title={`بيانات وتفاصيل الجهاز (${selectedDevice?.serial_number || 'بدون سيريال'})`}
        subtitle=""
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
                  <span className="text-[10px] text-slate-400 block">السيريال نمبر:</span>
                  <span className="font-semibold text-xs bg-slate-100 text-slate-800 px-2.5 py-1 rounded border border-slate-200">
                    {selectedDevice.serial_number || 'بدون سيريال'}
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
                  <span className="text-slate-400 block text-[10px] mb-0.5">الموقع :</span>
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
                  <span className="text-slate-400 block text-[10px] mb-0.5">الحالة :</span>
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
        subtitle=""
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
              {isSubmitting ? 'جاري الحذف...' : 'حذف الجهاز '}
            </Button>
          </div>
        }
      >
        <div className="space-y-3 text-xs">
          <p className="text-slate-700">
            هل أنت متأكد من رغبتك في حذف هذا الجهاز  :
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
        title=" نقل الأجهزة بين المخازن  "
        subtitle=""
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
                  معاينة
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
                  {isExecutingTransfer ? 'جارٍ التحويل ...' : 'تأكيد وتنفيذ التحويل الآن'}
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
                  إغلاق
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
                className={`p-2 rounded-lg text-center font-bold text-xs flex items-center justify-center gap-1.5 ${wizardStep === st.s
                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                  : wizardStep > st.s
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-slate-50 text-slate-400 border border-slate-200'
                  }`}
              >
                <span
                  className={`w-4.5 h-4.5 rounded-full flex items-center justify-center text-[10px] ${wizardStep === st.s
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


              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    الموقع الحالي:
                  </label>
                  <Select
                    value={wizardSource}
                    onChange={e => setWizardSource(e.target.value)}
                    options={locationOptions.map(l => ({ value: l, label: l }))}
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    المستلم:
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
                  <span className="text-slate-500 block text-[11px]">الأجهزة </span>
                  <strong className="text-emerald-700 font-mono text-sm">
                    {wizardPreview.eligibleDevices.length} جهاز
                  </strong>
                </div>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <div className="flex justify-between text-slate-700 font-medium">
                  <span>إجمالي تكلفة الأجهزة :</span>
                  <span className="font-mono font-bold text-slate-900">
                    {formatCurrency(wizardPreview.totalEligibleCost)}
                  </span>
                </div>
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

      {/* 7. Assign Serials to Bulk Stock Modal */}
      <Modal
        isOpen={isAssignSerialsModalOpen}
        onClose={() => {
          if (!isAssigningSerials) {
            setIsAssignSerialsModalOpen(false);
            setAssignStockTarget(null);
          }
        }}
        title="تعيين أرقام سيريال للمخزون غير المسلسل"
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIsAssignSerialsModalOpen(false);
                setAssignStockTarget(null);
              }}
              disabled={isAssigningSerials}
            >
              إلغاء
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSaveAssignSerials}
              isLoading={isAssigningSerials}
              className="bg-purple-600 hover:bg-purple-700 text-white font-bold"
            >
              تأكيد وتعيين السيريالات
            </Button>
          </div>
        }
      >
        {assignStockTarget && (
          <form onSubmit={handleSaveAssignSerials} className="space-y-4 text-xs">
            {assignSerialsError && (
              <Alert type="error" className="text-xs">
                {assignSerialsError}
              </Alert>
            )}

            {/* Target Bulk Details */}
            <div className="p-3 bg-purple-50/60 border border-purple-200 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-800 text-sm block">
                    {assignStockTarget.model_name || assignStockTarget.brand || 'موديل غير محدد'}
                  </span>
                  <span className="text-[11px] text-slate-500 font-mono">
                    {assignStockTarget.brand} • {(assignStockTarget as any).model_code || 'بدون كود'}
                  </span>
                </div>
                <div className="text-left">
                  <span className="text-[11px] text-slate-500 block">الموقع</span>
                  <Badge variant={assignStockTarget.stock_location === 'محل 1' ? 'primary' : 'default'} size="sm">
                    {assignStockTarget.stock_location}
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-purple-200/60 text-center">
                <div className="p-1.5 bg-white rounded-lg border border-purple-100">
                  <span className="text-slate-400 block text-[10px]">الكمية المتاحة</span>
                  <strong className="text-purple-700 text-sm font-mono font-bold">
                    {assignStockTarget.quantity || 1} وحدة
                  </strong>
                </div>
                <div className="p-1.5 bg-white rounded-lg border border-purple-100">
                  <span className="text-slate-400 block text-[10px]">تكلفة الوحدة</span>
                  <strong className="text-slate-800 font-mono">
                    {formatCurrency(assignStockTarget.purchase_cost || 0)}
                  </strong>
                </div>
                <div className="p-1.5 bg-white rounded-lg border border-purple-100">
                  <span className="text-slate-400 block text-[10px]">سعر البيع</span>
                  <strong className="text-emerald-700 font-mono">
                    {formatCurrency(assignStockTarget.list_price || 0)}
                  </strong>
                </div>
              </div>
            </div>

            {/* Serial Numbers Input */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="font-bold text-slate-700">
                  أرقام السيريال المراد تعيينها:
                </label>
                {(() => {
                  const enteredCount = assignSerialsInputText
                    .split(/[\n,;]+/)
                    .map(s => s.trim())
                    .filter(Boolean).length;
                  const availableQty = assignStockTarget.quantity || 1;
                  const isOver = enteredCount > availableQty;
                  return (
                    <span
                      className={`text-[11px] font-bold font-mono px-2 py-0.5 rounded ${
                        isOver
                          ? 'bg-rose-100 text-rose-700'
                          : enteredCount > 0
                          ? 'bg-purple-100 text-purple-700'
                          : 'text-slate-500'
                      }`}
                    >
                      {enteredCount} / {availableQty} سيريال
                    </span>
                  );
                })()}
              </div>
              <textarea
                value={assignSerialsInputText}
                onChange={e => setAssignSerialsInputText(e.target.value)}
                placeholder="أدخل كل سيريال في سطر منفصل، أو افصل بينها بفواصل (مثال: SN1001, SN1002)..."
                rows={5}
                className="w-full p-2.5 border border-slate-300 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-y"
                dir="ltr"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                * يمكنك تعيين سيريالات لبعض أو كل الكمية. سيتم خصم الكمية المسلسلة وإنشاء أجهزة فردية مستقلة بنفس بيانات الشراء والموقع.
              </p>
            </div>

            {/* Notes */}
            <div>
              <label className="font-bold text-slate-700 block mb-1">ملاحظات العملية (اختياري):</label>
              <Input
                value={assignSerialsNotes}
                onChange={e => setAssignSerialsNotes(e.target.value)}
                placeholder="سبب أو تفاصيل تعيين السيريالات..."
              />
            </div>
          </form>
        )}
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 6: Cross-Warehouse Model Stock Quantity Summary (Requirement 3) */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isCrossWarehouseModalOpen}
        onClose={() => setIsCrossWarehouseModalOpen(false)}
        title="ملخص كميات الموديلات الشامل — كافة الفروع والمخازن"
        subtitle="تقرير شامل يضمن تطبيق المعادلة: إجمالي الوحدات = الموجود بالمخزون + الوحدات المباعة"
        size="xl"
        footer={
          <div className="flex justify-between items-center w-full">
            <span className="text-xs text-slate-500 font-medium">
              * يتم احتساب كافة الأجهزة المسلسلة والكميات المجمعة والمبيعات المعتمدة تلقائياً
            </span>
            <Button variant="outline" size="sm" onClick={() => setIsCrossWarehouseModalOpen(false)}>
              إغلاق
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {/* Top KPI Metrics Banner */}
          {(() => {
            const grandTotal = crossWarehouseSummaries.reduce((sum, s) => sum + s.total_units, 0);
            const grandExisting = crossWarehouseSummaries.reduce((sum, s) => sum + s.existing_units, 0);
            const grandSold = crossWarehouseSummaries.reduce((sum, s) => sum + s.sold_units, 0);
            const grandSerial = crossWarehouseSummaries.reduce((sum, s) => sum + s.existing_serialized, 0);
            const grandBulk = crossWarehouseSummaries.reduce((sum, s) => sum + s.existing_non_serialized, 0);
            const isStrictMatch = grandTotal === grandExisting + grandSold;

            return (
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-300 text-xs">
                <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                  <span className="text-slate-500 block mb-0.5">الموجود بالمخزون (Existing)</span>
                  <span className="font-mono text-base font-bold text-emerald-800">{grandExisting} وحدة</span>
                  <span className="text-[10px] text-slate-500 block mt-0.5">
                    ({grandSerial} مسلسل • {grandBulk} مجمع)
                  </span>
                </div>

                <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                  <span className="text-slate-500 block mb-0.5">الوحدات المباعة (Sold)</span>
                  <span className="font-mono text-base font-bold text-slate-800">{grandSold} وحدة</span>
                  <span className="text-[10px] text-slate-500 block mt-0.5">مبيعات معتمدة من الفروع</span>
                </div>

                <div className="p-2.5 bg-blue-50/70 rounded-lg border border-blue-200">
                  <span className="text-blue-900 font-bold block mb-0.5">إجمالي الوحدات (Total)</span>
                  <span className="font-mono text-base font-bold text-blue-900">{grandTotal} وحدة</span>
                  <span className="text-[10px] text-blue-700 block mt-0.5 font-medium">
                    Total = Existing + Sold
                  </span>
                </div>

                <div className="p-2.5 bg-emerald-50/60 rounded-lg border border-emerald-200 flex flex-col justify-center">
                  <span className="text-emerald-900 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>صحة المعادلة المحاسبية</span>
                  </span>
                  <span className="text-[11px] text-emerald-800 mt-1">
                    {isStrictMatch ? '✓ المعادلة مطابقة 100% لكافة الموديلات' : 'تنبيه: يوجد فرق غير مطابق'}
                  </span>
                </div>
              </div>
            );
          })()}

          {/* Cross Warehouse Table */}
          <div className="border border-slate-300 rounded-xl overflow-hidden bg-white">
            <div className="overflow-x-auto max-h-[55vh]">
              <table className="w-full text-xs text-right border-collapse">
                <thead className="bg-slate-100 border-b border-slate-300 text-slate-800 font-bold sticky top-0 z-10">
                  <tr>
                    <th className="p-2.5">#</th>
                    <th className="p-2.5">الموديل والماركة</th>
                    <th className="p-2.5">التصنيف</th>
                    {locationOptions.map((loc, locIdx) => (
                      <th
                        key={loc}
                        className={`p-2.5 text-center ${locIdx % 2 === 0 ? 'bg-blue-50/40' : 'bg-emerald-50/40'}`}
                      >
                        {loc} (موجود / مباع / إجمالي)
                      </th>
                    ))}
                    <th className="p-2.5 text-center">الموجود الكلي</th>
                    <th className="p-2.5 text-center">المباع الكلي</th>
                    <th className="p-2.5 text-center font-bold text-blue-950">إجمالي الوحدات (Total)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {crossWarehouseSummaries.length === 0 ? (
                    <tr>
                      <td colSpan={6 + locationOptions.length} className="py-8 text-center text-slate-500">
                        لا توجد موديلات مسجلة بالمخزون حالياً
                      </td>
                    </tr>
                  ) : (
                    crossWarehouseSummaries.map((item, idx) => {
                      return (
                        <tr key={item.model_id} className="hover:bg-slate-50/80">
                          <td className="p-2.5 text-slate-500 font-mono text-[11px]">{idx + 1}</td>
                          <td className="p-2.5 font-bold text-slate-900">
                            <div>
                              <span>{item.brand} {item.model_name}</span>
                              {item.model_code && (
                                <span className="mr-1.5 font-mono text-[10px] text-slate-500 bg-slate-100 px-1 py-0.5 rounded border border-slate-200">
                                  {item.model_code}
                                </span>
                              )}
                            </div>
                            {item.specifications && (
                              <p className="text-[10px] text-slate-500 font-normal truncate max-w-xs">{item.specifications}</p>
                            )}
                          </td>
                          <td className="p-2.5">
                            <Badge variant="default" size="sm" className="text-[10px]">
                              {item.category}
                            </Badge>
                          </td>
                          {locationOptions.map((loc, locIdx) => {
                            const br = item.warehouse_breakdown[loc] || { existing_units: 0, sold_units: 0, total_units: 0 };
                            return (
                              <td
                                key={loc}
                                className={`p-2.5 text-center font-mono text-[11px] ${
                                  locIdx % 2 === 0 ? 'bg-blue-50/20' : 'bg-emerald-50/20'
                                }`}
                              >
                                <span className="text-emerald-800 font-semibold">{br.existing_units} موجود</span>
                                <span className="mx-1 text-slate-400">/</span>
                                <span className="text-slate-700 font-semibold">{br.sold_units} مباع</span>
                                <span className="mx-1 text-slate-400">=</span>
                                <span className="font-bold text-slate-900">{br.total_units}</span>
                              </td>
                            );
                          })}
                          <td className="p-2.5 text-center">
                            <span className="font-mono font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 text-xs">
                              {item.existing_units}
                            </span>
                            <span className="block text-[9px] text-slate-500 font-mono mt-0.5">
                              ({item.existing_serialized} مس / {item.existing_non_serialized} مج)
                            </span>
                          </td>
                          <td className="p-2.5 text-center">
                            <span className="font-mono font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-xs">
                              {item.sold_units}
                            </span>
                          </td>
                          <td className="p-2.5 text-center">
                            <span className="font-mono font-bold text-blue-900 bg-blue-100/70 px-2.5 py-0.5 rounded-full border border-blue-300 text-xs">
                              {item.total_units}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                {crossWarehouseSummaries.length > 0 && (
                  <tfoot className="bg-slate-100 font-bold border-t-2 border-slate-300 text-slate-900 text-xs sticky bottom-0">
                    <tr>
                      <td colSpan={3} className="p-2.5 text-right">
                        الإجمالي الكلي لكافة الموديلات والفروع ({crossWarehouseSummaries.length} موديل):
                      </td>
                      {locationOptions.map((loc, locIdx) => (
                        <td
                          key={loc}
                          className={`p-2.5 text-center font-mono ${
                            locIdx % 2 === 0 ? 'text-blue-900' : 'text-emerald-900'
                          }`}
                        >
                          {crossWarehouseSummaries.reduce(
                            (s, it) => s + (it.warehouse_breakdown[loc]?.total_units || 0),
                            0
                          )}{' '}
                          وحدة
                        </td>
                      ))}
                      <td className="p-2.5 text-center font-mono text-emerald-800">
                        {crossWarehouseSummaries.reduce((s, it) => s + it.existing_units, 0)}
                      </td>
                      <td className="p-2.5 text-center font-mono text-slate-800">
                        {crossWarehouseSummaries.reduce((s, it) => s + it.sold_units, 0)}
                      </td>
                      <td className="p-2.5 text-center font-mono text-blue-900 text-sm">
                        {crossWarehouseSummaries.reduce((s, it) => s + it.total_units, 0)}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};
