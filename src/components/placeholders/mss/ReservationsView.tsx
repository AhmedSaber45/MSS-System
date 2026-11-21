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
import { usePageRefresh } from '@/context/PageRefreshContext';
import { mssCommerceService } from '@/services/mssCommerceService';
import { mssInventoryService } from '@/services/mssInventoryService';
import { formatCurrency, formatDate } from '@/lib/utils';
import { getTodayLocalDateString, useDateRangeFilter } from '@/lib/dateValidation';
import { DateRangeInputs } from '@/components/common/DateRangeInputs';
import { SearchableItemSelect } from '@/components/common/SearchableItemSelect';
import type {
  MSSReservation,
  MSSReservationItem,
  MSSStockLocation,
  MSSReservationStatus,
  NewMSSReservationItemInput,
} from '@/types/mssCommerce';
import type { MSSDevice } from '@/types/mssInventory';
import { useMSSLocations } from '@/hooks/useMSSLocations';
import {
  Plus,
  Search,
  BookmarkCheck,
  CheckCircle2,
  XCircle,
  Calendar,
  RotateCcw,
  RefreshCw,
  Phone,
  User,
  Trash2,
  Layers,
  Laptop,
  Pencil,
} from 'lucide-react';

export interface ReservationModalItem {
  id: string;
  device_id: string;
  device?: MSSDevice;
  is_serialized: boolean;
  serial_number?: string | null;
  model_name: string;
  brand: string;
  quantity: number;
  available_stock: number;
  agreed_price: number;
  total_agreed_price: number;
  branch: MSSStockLocation;
}

export const ReservationsView: React.FC = () => {
  const { showNotification } = useNotification();
  const { isRefreshing, triggerRefresh } = usePageRefresh();

  const [reservations, setReservations] = useState<MSSReservation[]>([]);
  const [availableDevices, setAvailableDevices] = useState<MSSDevice[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | MSSReservationStatus>('ALL');
  const [branchFilter, setBranchFilter] = useState<'ALL' | MSSStockLocation>('ALL');
  const dateFilter = useDateRangeFilter();

  // New/Edit Reservation Modal State (Multi-Device Support)
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [editingReservation, setEditingReservation] = useState<MSSReservation | null>(null);
  const [reservationItems, setReservationItems] = useState<ReservationModalItem[]>([]);
  const [pendingDevice, setPendingDevice] = useState<MSSDevice | null>(null);
  const [pendingQuantity, setPendingQuantity] = useState<number>(1);
  const [pendingAgreedPrice, setPendingAgreedPrice] = useState<number | ''>(0);
  const [itemError, setItemError] = useState<string>('');

  const { locations } = useMSSLocations();
  const [branch, setBranch] = useState<MSSStockLocation>(() => locations[0] || '');

  useEffect(() => {
    if (locations.length > 0 && !locations.includes(branch)) {
      setBranch(locations[0]);
    }
  }, [locations, branch]);
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [depositAmount, setDepositAmount] = useState<number | ''>(500);
  const [expiryDate, setExpiryDate] = useState<string>(
    new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0]
  );
  const [notes, setNotes] = useState<string>('حجز مؤقت مع عربون');
  const [formError, setFormError] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Fulfill / Cancel Modal State
  const [activeReservation, setActiveReservation] = useState<MSSReservation | null>(null);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState<boolean>(false);
  const [isFulfillModalOpen, setIsFulfillModalOpen] = useState<boolean>(false);
  const [cancelReason, setCancelReason] = useState<string>('رغبة العميل في إلغاء الحجز');

  // Load Data
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [resList, devList] = await Promise.all([
        mssCommerceService.getReservations(),
        mssInventoryService.getDevices({ status: 'AVAILABLE' }),
      ]);
      setReservations(resList);
      setAvailableDevices(devList);
    } catch (err: any) {
      console.error('Failed to load reservations:', err);
      showNotification({
        type: 'error',
        title: 'خطأ',
        message: err.message || 'تعذر تحميل بيانات الحجوزات',
      });
    } finally {
      setIsLoading(false);
    }
  }, [showNotification]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Open Add Modal (Starts with empty items list and no pre-selected device)
  const handleOpenAdd = () => {
    if (availableDevices.length === 0) {
      showNotification({
        type: 'warning',
        title: 'لا توجد أجهزة متوفرة',
        message: 'لا توجد أجهزة بحالة (متاح للبيع) في المخزون حالياً لحجزها',
      });
      return;
    }

    setEditingReservation(null);
    setReservationItems([]);
    setPendingDevice(null);
    setPendingQuantity(1);
    setPendingAgreedPrice(0);
    setBranch(locations[0] || '');
    setDepositAmount(500);
    setCustomerName('');
    setCustomerPhone('');
    setExpiryDate(new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0]);
    setNotes('حجز مؤقت مع عربون');
    setFormError('');
    setItemError('');
    setIsAddModalOpen(true);
  };

  // Open Edit Modal for existing reservation (Loads actual saved items)
  const handleOpenEdit = (res: MSSReservation) => {
    setEditingReservation(res);
    setBranch(res.branch);
    setCustomerName(res.customer_name);
    setCustomerPhone(res.customer_phone);
    setDepositAmount(res.deposit_amount);
    setExpiryDate(res.expiry_date);
    setNotes(res.notes || '');
    setPendingDevice(null);
    setPendingQuantity(1);
    setPendingAgreedPrice(0);
    setFormError('');
    setItemError('');

    // Load actual saved items
    if (res.items && res.items.length > 0) {
      const mappedItems: ReservationModalItem[] = res.items.map(it => ({
        id: it.id,
        device_id: it.device_id || it.id,
        device: undefined,
        is_serialized: it.is_serialized ?? Boolean(it.serial_number),
        serial_number: it.serial_number,
        model_name: it.model_name || 'جهاز محجوز',
        brand: it.brand || '',
        quantity: it.quantity,
        available_stock: it.quantity,
        agreed_price: (it.agreed_price || 0) / (it.quantity || 1),
        total_agreed_price: it.agreed_price,
        branch: it.source_branch || res.branch,
      }));
      setReservationItems(mappedItems);
    } else {
      const singleItem: ReservationModalItem = {
        id: 'res-item-' + res.id,
        device_id: res.device_id,
        device: undefined,
        is_serialized: Boolean(res.serial_number),
        serial_number: res.serial_number,
        model_name: res.model_name || 'جهاز محجوز',
        brand: res.brand || '',
        quantity: 1,
        available_stock: 1,
        agreed_price: res.agreed_price,
        total_agreed_price: res.agreed_price,
        branch: res.branch,
      };
      setReservationItems([singleItem]);
    }

    setIsAddModalOpen(true);
  };

  // Device pick in modal
  const handlePendingDevicePick = (d: MSSDevice) => {
    setPendingDevice(d);
    setPendingQuantity(1);
    setPendingAgreedPrice(d.list_price);
    setItemError('');
  };

  // Add Item to reservation (for manual add & backward compatibility)
  const handleAddItemToReservation = () => {
    if (!pendingDevice) {
      setItemError('يرجى اختيار جهاز لإضافته للحجز');
      return;
    }
    handleToggleReservationDevice(pendingDevice, true);
    setPendingDevice(null);
    setPendingQuantity(1);
    setPendingAgreedPrice(0);
    setItemError('');
  };

  // Handle toggling reservation device via checkboxes (Multi-Device Support)
  const handleToggleReservationDevice = (device: MSSDevice, isSelected: boolean) => {
    if (isSelected) {
      const isSerialized = Boolean(device.is_serialized && device.serial_number);
      const availableStock = device.quantity && device.quantity > 0 ? device.quantity : 1;

      // Prevent duplicate serialized device selection
      if (isSerialized && reservationItems.some(it => it.device_id === device.id)) {
        return;
      }

      if (reservationItems.some(it => it.device_id === device.id)) {
        return;
      }

      const newItem: ReservationModalItem = {
        id: `res-item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        device_id: device.id,
        device,
        is_serialized: isSerialized,
        serial_number: device.serial_number,
        model_name: device.model_name,
        brand: device.brand,
        quantity: 1,
        available_stock: availableStock,
        agreed_price: device.list_price,
        total_agreed_price: device.list_price,
        branch: device.stock_location,
      };

      setReservationItems(prev => [...prev, newItem]);
      setItemError('');
    } else {
      setReservationItems(prev => prev.filter(it => it.device_id !== device.id));
      setItemError('');
    }
  };

  // Update quantity for non-serialized stock in reservation
  const handleUpdateReservationQuantity = (deviceId: string, rawVal: string, maxAvailable: number) => {
    if (rawVal === '') {
      setItemError('يرجى إدخال كمية صحيحة');
      setReservationItems(prev =>
        prev.map(it => (it.device_id === deviceId ? { ...it, quantity: ('' as any), total_agreed_price: 0 } : it))
      );
      return;
    }

    const val = Number(rawVal);
    if (isNaN(val) || val <= 0) {
      setItemError('الكمية يجب أن تكون عدداً صحيحاً موجباً أكبر من الصفر');
      setReservationItems(prev =>
        prev.map(it => (it.device_id === deviceId ? { ...it, quantity: (val as any), total_agreed_price: 0 } : it))
      );
      return;
    }

    if (!Number.isInteger(val)) {
      setItemError('الكمية لا يمكن أن تحتوي على كسور عشرية');
      setReservationItems(prev =>
        prev.map(it => (it.device_id === deviceId ? { ...it, quantity: (val as any), total_agreed_price: 0 } : it))
      );
      return;
    }

    if (val > maxAvailable) {
      setItemError(`الكمية المطلوبة (${val}) تتجاوز المخزون المتاح (${maxAvailable})`);
      setReservationItems(prev =>
        prev.map(it =>
          it.device_id === deviceId
            ? { ...it, quantity: val, total_agreed_price: val * it.agreed_price }
            : it
        )
      );
      return;
    }

    setItemError('');
    setReservationItems(prev =>
      prev.map(it =>
        it.device_id === deviceId
          ? {
              ...it,
              quantity: val,
              total_agreed_price: val * it.agreed_price,
            }
          : it
      )
    );
  };

  // Update agreed unit price for reservation item
  const handleUpdateReservationPrice = (deviceId: string, rawPrice: string | number) => {
    const p = Math.max(0, Number(rawPrice) || 0);
    setReservationItems(prev =>
      prev.map(it => {
        if (it.device_id !== deviceId) return it;
        const qty = Number(it.quantity) || 1;
        return {
          ...it,
          agreed_price: p,
          total_agreed_price: qty * p,
        };
      })
    );
  };

  // Remove Item from reservation
  const handleRemoveItemFromReservation = (id: string) => {
    setReservationItems(prev => prev.filter(it => it.id !== id));
  };

  // Total agreed price for all items in reservation
  const totalAgreedPrice = reservationItems.reduce((sum, it) => sum + it.total_agreed_price, 0);

  // Save new or edited reservation
  const handleSaveAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (reservationItems.length === 0) {
      setFormError('يرجى إضافة جهاز واحد على الأقل للحجز قبل التأكيد');
      return;
    }
    if (!customerName.trim()) {
      setFormError('اسم العميل مطلوب');
      return;
    }
    if (!customerPhone.trim()) {
      setFormError('رقم هاتف العميل مطلوب');
      return;
    }
    if (Number(depositAmount) < 0) {
      setFormError('مبلغ العربون لا يمكن أن يكون سالباً');
      return;
    }
    if (totalAgreedPrice < 0) {
      setFormError('السعر المتفق عليه لا يمكن أن يكون سالباً');
      return;
    }

    // Strict quantity validation
    for (const it of reservationItems) {
      if (!it.is_serialized) {
        const q = Number(it.quantity);
        if (isNaN(q) || q <= 0 || !Number.isInteger(q)) {
          setFormError(`كمية الموديل (${it.model_name}) غير صالحة (${it.quantity}). يجب إدخال عدد صحيح موجب.`);
          return;
        }
        if (q > it.available_stock) {
          setFormError(`الكمية المطلوب حجزها (${q}) أكبر من المخزون المتاح (${it.available_stock}) للموديل (${it.model_name}).`);
          return;
        }
      }
    }

    setIsSubmitting(true);
    setFormError('');

    try {
      const itemsPayload: NewMSSReservationItemInput[] = reservationItems.map(it => ({
        device_id: it.device_id,
        quantity: it.quantity,
        agreed_price: it.total_agreed_price,
        source_branch: it.branch,
      }));

      if (editingReservation) {
        await mssCommerceService.updateReservation(editingReservation.id, {
          customer_name: customerName.trim(),
          customer_phone: customerPhone.trim(),
          deposit_amount: Number(depositAmount),
          agreed_price: Number(totalAgreedPrice),
          expiry_date: expiryDate,
          notes: notes.trim() || undefined,
          branch,
          items: itemsPayload,
        });

        showNotification({
          type: 'success',
          title: 'تم تحديث الحجز بنجاح',
          message: `تم تحديث الحجز رقم ${editingReservation.reservation_number} للعميل (${customerName.trim()})`,
        });
      } else {
        const firstItem = reservationItems[0];
        const res = await mssCommerceService.createReservation({
          device_id: firstItem.device_id,
          branch,
          customer_name: customerName.trim(),
          customer_phone: customerPhone.trim(),
          deposit_amount: Number(depositAmount),
          agreed_price: Number(totalAgreedPrice),
          expiry_date: expiryDate,
          notes: notes.trim() || undefined,
          items: itemsPayload,
        });

        showNotification({
          type: 'success',
          title: 'تم إنشاء الحجز بنجاح',
          message: `تم حجز (${reservationItems.length}) أجهزة للعميل (${res.customer_name}) بحجز رقم ${res.reservation_number}`,
        });
      }

      setIsAddModalOpen(false);
      setEditingReservation(null);
      await loadData();
    } catch (err: any) {
      setFormError(err.message || (editingReservation ? 'فشلت عملية تحديث الحجز' : 'فشلت عملية إنشاء الحجز'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Cancel reservation
  const handleConfirmCancel = async () => {
    if (!activeReservation || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await mssCommerceService.cancelReservation(activeReservation.id, cancelReason);
      showNotification({
        type: 'info',
        title: 'تم إلغاء الحجز',
        message: `تم إلغاء الحجز (${activeReservation.reservation_number}) وإعادة الجهاز ${activeReservation.serial_number ? `(${activeReservation.serial_number}) ` : ''}إلى المخزون المتاح للبيع.`,
      });
      setIsCancelModalOpen(false);
      await loadData();
    } catch (err: any) {
      showNotification({
        type: 'error',
        title: 'خطأ في الإلغاء',
        message: err.message || 'تعذر إلغاء الحجز',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Fulfill reservation (Sell)
  const handleConfirmFulfill = async () => {
    if (!activeReservation || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const saleItems =
        activeReservation.items && activeReservation.items.length > 0
          ? activeReservation.items.map(it => ({
              device_id: it.device_id,
              quantity: it.quantity || 1,
              unit_price: (it.agreed_price || 0) / (it.quantity || 1),
              actual_sale_price: it.agreed_price,
              source_branch: it.source_branch || activeReservation.branch,
            }))
          : [
              {
                device_id: activeReservation.device_id,
                quantity: 1,
                unit_price: activeReservation.agreed_price,
                actual_sale_price: activeReservation.agreed_price,
                source_branch: activeReservation.branch,
              },
            ];

      const invoice = await mssCommerceService.confirmSale({
        device_id: activeReservation.device_id,
        selling_branch: activeReservation.branch,
        actual_sale_price: activeReservation.agreed_price,
        customer_name: activeReservation.customer_name,
        customer_phone: activeReservation.customer_phone,
        notes: `إتمام حجز رقم ${activeReservation.reservation_number} - مسدد عربون: ${formatCurrency(activeReservation.deposit_amount)}`,
        items: saleItems,
      });

      showNotification({
        type: 'success',
        title: 'تم إتمام البيع بنجاح',
        message: `تم تحويل الحجز إلى فاتورة بيع رسمية رقم (${invoice.invoice_number}) بعدد (${saleItems.length}) أجهزة`,
      });

      setIsFulfillModalOpen(false);
      await loadData();
    } catch (err: any) {
      showNotification({
        type: 'error',
        title: 'خطأ في إتمام البيع',
        message: err.message || 'تعذر إتمام عملية البيع للحجز',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter reservations
  const filteredReservations = reservations.filter(r => {
    if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
    if (branchFilter !== 'ALL' && r.branch !== branchFilter) return false;
    if (dateFilter.startDate && r.created_at < dateFilter.startDate) return false;
    if (dateFilter.endDate && r.created_at.split('T')[0] > dateFilter.endDate) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const matchNum = r.reservation_number.toLowerCase().includes(q);
      const matchSerial = Boolean(r.serial_number?.toLowerCase().includes(q));
      const matchCust = r.customer_name.toLowerCase().includes(q);
      const matchPhone = r.customer_phone.includes(q);
      const matchModel = r.model_name?.toLowerCase().includes(q);
      if (!matchNum && !matchSerial && !matchCust && !matchPhone && !matchModel) {
        return false;
      }
    }
    return true;
  });

  // Table Columns
  const columns: Column<MSSReservation>[] = [
    {
      key: 'reservation_number',
      header: 'رقم الحجز',
      align: 'center',
      nowrap: true,
      className: 'w-24 min-w-[85px] max-w-[95px] text-center px-1.5',
      render: (item: MSSReservation) => (
        <span className="font-mono font-bold text-slate-900 text-xs sm:text-sm tabular-nums whitespace-nowrap block text-center">
          {item.reservation_number}
        </span>
      ),
    },
    {
      key: 'serial_number',
      header: 'السيريال المحجوز',
      align: 'center',
      nowrap: true,
      className: 'w-36 min-w-[125px] max-w-[150px] text-center px-1.5',
      render: (item: MSSReservation) => {
        const isMulti = (item.items && item.items.length > 1) || (item.items_count && item.items_count > 1);
        const count = item.items?.length || item.items_count || 1;
        if (isMulti) {
          return (
            <Badge variant="primary" size="sm" className="font-bold text-xs whitespace-nowrap">
              متعدد ({count} أجهزة)
            </Badge>
          );
        }
        return item.serial_number ? (
          <span
            className="font-mono text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200/70 px-2 py-0.5 rounded border border-slate-300 tracking-tight select-all tabular-nums truncate max-w-[135px] inline-block"
            title={item.serial_number}
          >
            {item.serial_number}
          </span>
        ) : (
          <Badge variant="outline" size="sm" className="text-xs text-slate-500 bg-slate-50 whitespace-nowrap">
            بدون سيريال
          </Badge>
        );
      },
    },
    {
      key: 'model_name',
      header: 'الموديل',
      align: 'right',
      nowrap: false,
      className: 'w-full min-w-[145px] px-2.5',
      render: (item: MSSReservation) => {
        const isMulti = (item.items && item.items.length > 1) || (item.items_count && item.items_count > 1);
        if (isMulti) {
          return (
            <div className="min-w-[130px] space-y-0.5">
              <span className="font-bold text-slate-900 text-xs sm:text-sm block leading-snug">
                {item.brand ? `${item.brand} ` : ''}
                {item.model_name || 'أجهزة متعددة'}
              </span>
              <span className="text-[10px] text-slate-500 font-mono block truncate max-w-[180px]">
                {item.items?.map(it => it.serial_number || it.model_name).filter(Boolean).slice(0, 2).join(' • ')}
                {item.items && item.items.length > 2 ? ' ...' : ''}
              </span>
            </div>
          );
        }
        return (
          <div className="min-w-[130px] space-y-0.5">
            <span className="font-bold text-slate-900 text-xs sm:text-sm block leading-snug">
              {item.brand ? `${item.brand} ` : ''}
              {item.model_name || 'جهاز لابتوب / شاشة'}
            </span>
          </div>
        );
      },
    },
    {
      key: 'customer_name',
      header: 'العميل وبيانات التواصل',
      align: 'right',
      nowrap: true,
      className: 'w-36 min-w-[125px] max-w-[145px] px-2',
      render: (item: MSSReservation) => (
        <div className="space-y-0.5 text-right">
          <div className="flex items-center gap-1 font-bold text-slate-900 text-xs truncate max-w-[130px]" title={item.customer_name}>
            <User className="w-3 h-3 text-slate-400 shrink-0" />
            <span className="truncate">{item.customer_name}</span>
          </div>
          <div className="flex items-center gap-1 text-[11px] font-mono text-slate-500 tabular-nums">
            <Phone className="w-3 h-3 text-slate-400 shrink-0" />
            <span>{item.customer_phone}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'deposit_amount',
      header: 'العربون',
      align: 'left',
      nowrap: true,
      className: 'w-24 min-w-[75px] max-w-[90px] text-left px-2',
      render: (item: MSSReservation) => (
        <span className="font-mono text-xs sm:text-sm font-bold text-emerald-700 tabular-nums whitespace-nowrap block text-left">
          {formatCurrency(item.deposit_amount)}
        </span>
      ),
    },
    {
      key: 'agreed_price',
      header: 'السعر المتفق عليه',
      align: 'left',
      nowrap: true,
      className: 'w-28 min-w-[85px] max-w-[105px] text-left px-2',
      render: (item: MSSReservation) => (
        <span className="font-mono text-xs sm:text-sm font-bold text-slate-900 tabular-nums whitespace-nowrap block text-left">
          {formatCurrency(item.agreed_price)}
        </span>
      ),
    },
    {
      key: 'branch',
      header: 'فرع الحجز',
      align: 'center',
      nowrap: true,
      className: 'w-20 min-w-[65px] max-w-[80px] text-center px-1',
      render: (item: MSSReservation) => (
        <Badge variant="default" size="sm" className="font-semibold text-xs whitespace-nowrap">
          {item.branch}
        </Badge>
      ),
    },
    {
      key: 'expiry_date',
      header: 'تاريخ الانتهاء',
      align: 'center',
      nowrap: true,
      className: 'w-24 min-w-[80px] max-w-[95px] text-center px-1.5',
      render: (item: MSSReservation) => (
        <span className="font-mono text-xs font-semibold text-rose-700 tabular-nums whitespace-nowrap block text-center">
          {item.expiry_date}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'الحالة',
      align: 'center',
      nowrap: true,
      className: 'w-24 min-w-[80px] max-w-[95px] text-center px-1',
      render: (item: MSSReservation) => {
        switch (item.status) {
          case 'ACTIVE':
            return <Badge variant="success" size="sm" className="font-semibold text-xs whitespace-nowrap">ساري ومؤكد</Badge>;
          case 'FULFILLED':
            return <Badge variant="default" size="sm" className="font-semibold text-xs whitespace-nowrap">تم البيع</Badge>;
          case 'CANCELLED':
            return <Badge variant="danger" size="sm" className="font-semibold text-xs whitespace-nowrap">ملغي</Badge>;
          case 'EXPIRED':
            return <Badge variant="warning" size="sm" className="font-semibold text-xs whitespace-nowrap">منتهي</Badge>;
          default:
            return <Badge variant="default" size="sm" className="font-semibold text-xs whitespace-nowrap">{item.status}</Badge>;
        }
      },
    },
    {
      key: 'actions',
      header: 'إجراءات',
      align: 'center',
      nowrap: true,
      className: 'w-48 min-w-[185px] max-w-[205px] text-center px-1',
      render: (item: MSSReservation) => (
        <div className="flex items-center justify-center gap-1">
          {item.status === 'ACTIVE' ? (
            <>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setActiveReservation(item);
                  setIsFulfillModalOpen(true);
                }}
                className="h-7 px-2 text-xs font-bold whitespace-nowrap bg-emerald-600 hover:bg-emerald-700 text-white"
                leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
                title="إتمام البيع وتحويل الحجز إلى فاتورة مبيعات"
              >
                إتمام البيع
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => handleOpenEdit(item)}
                className="h-7 px-2 text-xs font-semibold border-slate-300 hover:bg-slate-50 text-slate-700 whitespace-nowrap"
                leftIcon={<Pencil className="w-3.5 h-3.5 text-blue-600" />}
                title="تعديل بيانات الحجز"
              >
                تعديل
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setActiveReservation(item);
                  setIsCancelModalOpen(true);
                }}
                className="h-7 px-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 text-xs font-semibold whitespace-nowrap"
                leftIcon={<XCircle className="w-3.5 h-3.5" />}
                title="إلغاء الحجز وإعادة الأجهزة للمخزون"
              >
                إلغاء
              </Button>
            </>
          ) : (
            <span className="text-slate-300 font-mono text-xs select-none">-</span>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="حجوزات أجهزة Compu MSS"
        subtitle=""
        actions={
          <Button
            variant="primary"
            size="md"
            onClick={handleOpenAdd}
            className="font-bold"
            leftIcon={<Plus className="w-4.5 h-4.5" />}
          >
            إنشاء حجز جديد 
          </Button>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 bg-white border border-slate-300 shadow-2xs">
          <p className="text-sm text-slate-600 font-semibold mb-1">إجمالي الحجوزات</p>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-900 font-mono tabular-nums">{reservations.length}</span>
            <BookmarkCheck className="w-5 h-5 text-slate-500" />
          </div>

        </Card>

        <Card className="p-4 bg-white border border-slate-300 shadow-2xs">
          <p className="text-sm text-slate-600 font-semibold mb-1">الحجوزات الحالية </p>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-emerald-700 font-mono tabular-nums">
              {reservations.filter(r => r.status === 'ACTIVE').length}
            </span>
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          </div>
        </Card>

        <Card className="p-4 bg-white border border-slate-300 shadow-2xs">
          <p className="text-sm text-slate-600 font-semibold mb-1">إجمالي العربون المسدد</p>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
              {formatCurrency(
                reservations
                  .filter(r => r.status === 'ACTIVE')
                  .reduce((sum, r) => sum + r.deposit_amount, 0)
              )}
            </span>
            <Calendar className="w-5 h-5 text-slate-500" />
          </div>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <Card className="p-4 bg-white border-slate-300 shadow-2xs space-y-4">
        <div className="flex flex-col md:flex-row items-center gap-3">
          <div className="flex-1 w-full">
            <Input
              placeholder="ابحث برقم الحجز، السيريال، اسم العميل، الهاتف، أو الموديل..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onClear={() => setSearchQuery('')}
              leftIcon={<Search className="w-4.5 h-4.5" />}
            />
          </div>

          <Button
            variant="outline"
            size="md"
            onClick={() => triggerRefresh(loadData, 'جارٍ تحديث قائمة حجوزات الأجهزة...')}
            disabled={isRefreshing || isLoading}
            title="إعادة تحميل البيانات"
            className="font-semibold"
            leftIcon={<RefreshCw className={`w-4.5 h-4.5 ${isRefreshing ? 'animate-spin' : ''}`} />}
          >
            Refresh
          </Button>
        </div>

        {/* Date Filter & Branch Pills */}
        <div className="pt-3 border-t border-slate-200 space-y-3">
          <DateRangeInputs
            startDate={dateFilter.startDate}
            endDate={dateFilter.endDate}
            onStartDateChange={dateFilter.setStartDate}
            onEndDateChange={dateFilter.setEndDate}
            error={dateFilter.error}
            onClear={dateFilter.reset}
          />

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 text-sm">
            <div className="flex items-center gap-2.5">
              <span className="font-semibold text-slate-700 text-sm">حالة الحجز:</span>
              <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-300">
                {(
                  [
                    { id: 'ALL', label: 'الكل' },
                    { id: 'ACTIVE', label: 'ساري' },
                    { id: 'FULFILLED', label: 'تم البيع' },
                    { id: 'CANCELLED', label: 'ملغي' },
                  ] as const
                ).map(st => (
                  <button
                    key={st.id}
                    onClick={() => setStatusFilter(st.id)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                      statusFilter === st.id
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <span className="font-semibold text-slate-700 text-sm">فرع الحجز:</span>
              <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-300">
                <button
                  onClick={() => setBranchFilter('ALL')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                    branchFilter === 'ALL'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  كافة الفروع
                </button>
                {locations.map(loc => (
                  <button
                    key={loc}
                    onClick={() => setBranchFilter(loc)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                      branchFilter === loc
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {loc}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Table */}
      {isLoading ? (
        <Card className="p-12 text-center bg-white border-slate-300">
          <Spinner size="lg" className="mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-600">جاري تحميل سجلات الحجوزات...</p>
        </Card>
      ) : filteredReservations.length === 0 ? (
        <Card className="p-12 text-center space-y-3 bg-white border-slate-300">
          <BookmarkCheck className="w-12 h-12 mx-auto text-slate-400" />
          <h3 className="text-base font-bold text-slate-800">لا توجد حجوزات مطابقة</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            يمكنك إنشاء حجز جديد  لأي جهاز متاح في المخزون     .
          </p>
          <Button
            variant="outline"
            size="md"
            onClick={handleOpenAdd}
            className="font-semibold"
            leftIcon={<Plus className="w-4.5 h-4.5" />}
          >
            إنشاء حجز جديد الآن
          </Button>
        </Card>
      ) : (
        <div className="bg-white rounded-xl border border-slate-300 overflow-hidden shadow-2xs">
          <Table
            columns={columns}
            data={filteredReservations}
            keyExtractor={(item: MSSReservation) => item.id}
            pagination={{ pageSize: 9 }}
            density="compact"
            className="w-full text-right"
          />
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: Create New Reservation (Multi-Device Support) */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => !isSubmitting && setIsAddModalOpen(false)}
        title={editingReservation ? `تعديل الحجز رقم ${editingReservation.reservation_number}` : 'إنشاء حجز أجهزة جديد'}
        subtitle={
          editingReservation
            ? `تعديل بيانات وأجهزة حجز العميل (${editingReservation.customer_name})`
            : 'حجز جهاز واحد أو عدة أجهزة لعميل مع توثيق العربون والأجهزة'
        }
        size="lg"
        footer={
          <div className="flex items-center justify-between w-full">
            <Button
              variant="outline"
              size="md"
              onClick={() => setIsAddModalOpen(false)}
              disabled={isSubmitting}
            >
              إلغاء
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={handleSaveAdd}
              disabled={isSubmitting || reservationItems.length === 0}
              className="font-bold"
              leftIcon={isSubmitting ? <Spinner size="sm" /> : <Plus className="w-4.5 h-4.5" />}
            >
              {isSubmitting
                ? editingReservation
                  ? 'جاري حفظ تعديلات الحجز...'
                  : 'جاري إنشاء الحجز...'
                : editingReservation
                ? `حفظ التعديلات (${reservationItems.length} أجهزة - ${formatCurrency(totalAgreedPrice)})`
                : `تأكيد الحجز (${reservationItems.length} أجهزة - ${formatCurrency(totalAgreedPrice)})`}
            </Button>
          </div>
        }
      >
        <form onSubmit={handleSaveAdd} className="space-y-4 text-sm">
          {formError && (
            <Alert type="danger" title="خطأ في البيانات" message={formError} />
          )}

          {/* Section 1: Device Selection and Add to Reservation (Checkboxes & Multi-Select) */}
          <div className="p-3.5 bg-slate-50 border border-slate-300 rounded-xl space-y-3">
            <h4 className="text-xs font-bold text-slate-900 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Laptop className="w-4 h-4 text-slate-600" />
                <span>اختيار الأجهزة للحجز (تحديد متعدد عبر مربعات الاختيار):</span>
              </span>
              <span className="text-[11px] font-semibold text-slate-500">
                المتاح: {availableDevices.length} جهاز/موديل
              </span>
            </h4>

            <div>
              <SearchableItemSelect<MSSDevice>
                items={availableDevices}
                isMulti={true}
                selectedIds={reservationItems.map(it => it.device_id)}
                onItemToggle={handleToggleReservationDevice}
                getKey={d => d.id}
                getSearchableText={d =>
                  `${d.serial_number || ''} ${d.brand || ''} ${d.model_name || ''} ${d.stock_location}`
                }
                placeholder="اختر جهازاً لإضافته للحجز (بحث بالاسم، الموديل، السيريال)..."
                emptyMessage="لا توجد أجهزة متوفرة مطابقة للبحث"
                maxHeight="max-h-56"
                renderItem={(d, isSelected) => {
                  const isSerialized = Boolean(d.is_serialized && d.serial_number);
                  const maxStock = d.quantity && d.quantity > 0 ? d.quantity : 1;
                  const resItem = reservationItems.find(it => it.device_id === d.id);

                  return (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-0.5">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-900 text-xs sm:text-sm">
                            {d.brand} {d.model_name}
                          </span>
                          {isSerialized ? (
                            <span className="font-mono text-[11px] bg-slate-100 text-slate-900 font-bold px-1.5 py-0.5 rounded border border-slate-300">
                              {d.serial_number}
                            </span>
                          ) : (
                            <Badge variant="outline" size="sm" className="text-[10px] font-semibold">
                              مخزون مجمع ({maxStock} متاح)
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Right controls: Quantity input for bulk + Branch & Price */}
                      <div className="flex items-center gap-2.5 shrink-0">
                        {!isSerialized && isSelected && (
                          <div
                            className="flex items-center gap-1.5 bg-blue-50 px-2 py-1 rounded-lg border border-blue-200"
                            onClick={e => e.stopPropagation()}
                          >
                            <label className="text-[11px] font-bold text-blue-900 whitespace-nowrap">
                              الكمية:
                            </label>
                            <input
                              type="number"
                              min="1"
                              max={maxStock}
                              value={resItem?.quantity ?? 1}
                              onChange={e => handleUpdateReservationQuantity(d.id, e.target.value, maxStock)}
                              className="w-16 h-7 text-center font-mono font-bold text-xs bg-white rounded border border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                              title={`أدخل كمية بين 1 و ${maxStock}`}
                            />
                            <span className="text-[10px] text-slate-500 whitespace-nowrap">
                              / {maxStock}
                            </span>
                          </div>
                        )}

                        <Badge variant="default" size="sm">
                          {d.stock_location}
                        </Badge>
                        <strong className="text-slate-900 font-mono text-xs font-bold tabular-nums">
                          {formatCurrency(d.list_price)}
                        </strong>
                      </div>
                    </div>
                  );
                }}
              />
            </div>

            {itemError && (
              <Alert type="danger" title="تنبيه" message={itemError} className="py-1 text-xs" />
            )}
          </div>

          {/* Section 2: Items currently in this reservation */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-800">
              الأجهزة المشمولة بالحجز ({reservationItems.length} أجهزة / {reservationItems.reduce((s, it) => s + (Number(it.quantity) || 1), 0)} وحدة):
            </label>

            {reservationItems.length === 0 ? (
              <div className="p-4 text-center bg-slate-50 rounded-xl border border-dashed border-slate-300 text-xs text-slate-500">
                لم يتم تحديد أي أجهزة للحجز بعد. حدد مربعات الاختيار بجانب الأجهزة أعلاه لتضمينها في الحجز.
              </div>
            ) : (
              <div className="border border-slate-300 rounded-xl overflow-hidden">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
                    <tr>
                      <th className="p-2">#</th>
                      <th className="p-2">الجهاز</th>
                      <th className="p-2">السيريال / الحالة</th>
                      <th className="p-2">الفرع</th>
                      <th className="p-2 text-center">الكمية</th>
                      <th className="p-2">السعر المتفق عليه</th>
                      <th className="p-2">الإجمالي</th>
                      <th className="p-2 text-center">إجراء</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {reservationItems.map((item, idx) => (
                      <tr key={item.id} className="hover:bg-slate-50">
                        <td className="p-2 font-mono text-slate-500">{idx + 1}</td>
                        <td className="p-2 font-bold text-slate-900">
                          {item.brand} {item.model_name}
                        </td>
                        <td className="p-2">
                          {item.serial_number ? (
                            <span className="font-mono text-[11px] font-bold bg-slate-100 px-1.5 py-0.5 rounded border border-slate-300">
                              {item.serial_number}
                            </span>
                          ) : (
                            <Badge variant="outline" size="sm">
                              مخزون مجمع
                            </Badge>
                          )}
                        </td>
                        <td className="p-2">
                          <Badge variant="default" size="sm">
                            {item.branch}
                          </Badge>
                        </td>
                        <td className="p-2 text-center">
                          {item.is_serialized ? (
                            <span className="font-mono text-xs font-bold bg-slate-100 text-slate-800 px-2 py-0.5 rounded border border-slate-200">
                              1 وحدة
                            </span>
                          ) : (
                            <div className="flex flex-col items-center gap-1">
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleUpdateReservationQuantity(
                                      item.device_id,
                                      String(Math.max(1, (Number(item.quantity) || 1) - 1)),
                                      item.available_stock
                                    )
                                  }
                                  className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center cursor-pointer text-xs"
                                  disabled={Number(item.quantity) <= 1}
                                >
                                  -
                                </button>
                                <input
                                  type="number"
                                  min="1"
                                  max={item.available_stock}
                                  value={item.quantity}
                                  onChange={e =>
                                    handleUpdateReservationQuantity(item.device_id, e.target.value, item.available_stock)
                                  }
                                  className="w-14 h-7 text-center font-mono font-bold text-xs rounded border border-slate-300 bg-white"
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleUpdateReservationQuantity(
                                      item.device_id,
                                      String(Math.min(item.available_stock, (Number(item.quantity) || 1) + 1)),
                                      item.available_stock
                                    )
                                  }
                                  className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center cursor-pointer text-xs"
                                  disabled={Number(item.quantity) >= item.available_stock}
                                >
                                  +
                                </button>
                              </div>
                              <span className="text-[10px] text-slate-500 font-mono">
                                من أصل {item.available_stock}
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            min="0"
                            step="50"
                            value={item.agreed_price}
                            onChange={e => handleUpdateReservationPrice(item.device_id, e.target.value)}
                            className="w-20 h-7 text-center font-mono font-bold text-xs rounded border border-slate-300 bg-white"
                          />
                        </td>
                        <td className="p-2 font-mono font-bold text-slate-900">
                          {formatCurrency(item.total_agreed_price)}
                        </td>
                        <td className="p-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveItemFromReservation(item.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                            title="حذف من الحجز"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="p-2.5 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-xs font-bold text-slate-900">
                  <span>إجمالي السعر المتفق عليه:</span>
                  <span className="font-mono text-sm">{formatCurrency(totalAgreedPrice)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Section 3: Customer and Reservation Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200">
            <Input
              label="اسم العميل *"
              placeholder="مثال: أحمد..."
              value={customerName}
              onChange={e => setCustomerName(e.target.value)}
              required
            />

            <Input
              label="رقم هاتف العميل *"
              placeholder="مثال: 01012345678..."
              value={customerPhone}
              onChange={e => setCustomerPhone(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              label="العربون المدفوع (EGP) *"
              type="number"
              min="0"
              placeholder="0.00"
              value={depositAmount}
              onChange={e => setDepositAmount(e.target.value === '' ? '' : Number(e.target.value))}
              required
            />

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                إجمالي السعر المتفق عليه
              </label>
              <div className="w-full h-10 px-3 bg-slate-100 border border-slate-300 rounded-lg text-sm text-slate-900 font-mono font-bold flex items-center">
                {formatCurrency(totalAgreedPrice)}
              </div>
            </div>

            <Input
              label="تاريخ انتهاء الحجز *"
              type="date"
              min={getTodayLocalDateString()}
              value={expiryDate}
              onChange={e => setExpiryDate(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              فرع الحجز <span className="text-rose-500">*</span>
            </label>
            <Select
              value={branch}
              onChange={e => setBranch(e.target.value as MSSStockLocation)}
              options={locations.map(loc => ({
                value: loc,
                label: loc,
              }))}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              ملاحظات الحجز
            </label>
            <textarea
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900 transition-colors"
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 2: Fulfill Reservation (Convert to Sale) */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isFulfillModalOpen}
        onClose={() => !isSubmitting && setIsFulfillModalOpen(false)}
        title="إتمام بيع أجهزة محجوزة"
        subtitle={`تحويل الحجز (${activeReservation?.reservation_number}) إلى فاتورة بيع نهائية`}
        size="md"
        footer={
          <div className="flex items-center justify-between w-full">
            <Button
              variant="outline"
              size="md"
              onClick={() => setIsFulfillModalOpen(false)}
              disabled={isSubmitting}
            >
              إلغاء
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={handleConfirmFulfill}
              disabled={isSubmitting}
              className="font-bold"
              leftIcon={isSubmitting ? <Spinner size="sm" /> : <CheckCircle2 className="w-4.5 h-4.5" />}
            >
              {isSubmitting ? 'جاري إتمام البيع...' : 'تأكيد البيع النهائي'}
            </Button>
          </div>
        }
      >
        {activeReservation && (
          <div className="space-y-4 text-sm">
            <p className="text-slate-700 font-medium text-xs">
              سيتم تسجيل الفاتورة للعميل وتحديث حالة كافة الأجهزة المحجوزة إلى (تم البيع) بالسعر المتفق عليه:
            </p>

            <div className="p-4 bg-slate-50 border border-slate-300 rounded-xl space-y-2.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-600 font-medium">العميل:</span>
                <strong className="text-slate-900 font-bold">{activeReservation.customer_name}</strong>
              </div>

              {/* Items breakdown if multi-device */}
              {activeReservation.items && activeReservation.items.length > 1 ? (
                <div className="space-y-1.5 py-1.5 border-y border-slate-200">
                  <span className="text-slate-600 font-bold block">الأجهزة المشمولة بالحجز:</span>
                  {activeReservation.items.map((it, idx) => (
                    <div key={it.id || idx} className="flex justify-between text-slate-800">
                      <span>
                        {idx + 1}. {it.brand} {it.model_name}{' '}
                        {it.serial_number ? `(${it.serial_number})` : `(${it.quantity || 1} وحدات)`}
                      </span>
                      <strong className="font-mono">{formatCurrency(it.agreed_price)}</strong>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex justify-between">
                  <span className="text-slate-600 font-medium">الجهاز والسيريال:</span>
                  <strong className="font-mono text-slate-900 font-bold tabular-nums">
                    {activeReservation.brand} {activeReservation.model_name}{' '}
                    {activeReservation.serial_number ? `(${activeReservation.serial_number})` : 'بدون سيريال'}
                  </strong>
                </div>
              )}

              <div className="flex justify-between">
                <span className="text-slate-600 font-medium">إجمالي السعر المتفق عليه:</span>
                <strong className="text-slate-900 font-mono font-bold tabular-nums text-sm">
                  {formatCurrency(activeReservation.agreed_price)}
                </strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600 font-medium">العربون السابق دفعه:</span>
                <span className="font-bold text-emerald-700 font-mono tabular-nums">
                  {formatCurrency(activeReservation.deposit_amount)}
                </span>
              </div>
              <div className="border-t border-slate-200 pt-2 flex justify-between font-bold">
                <span className="text-slate-900">المتبقي المطلوب تحصيله:</span>
                <span className="text-slate-900 font-mono text-sm tabular-nums">
                  {formatCurrency(activeReservation.agreed_price - activeReservation.deposit_amount)}
                </span>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 3: Cancel Reservation */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isCancelModalOpen}
        onClose={() => !isSubmitting && setIsCancelModalOpen(false)}
        title="تأكيد إلغاء الحجز"
        subtitle={`إلغاء حجز رقم (${activeReservation?.reservation_number}) وإعادة كافة الأجهزة للمخزون المتاح`}
        size="sm"
        footer={
          <div className="flex items-center justify-between w-full">
            <Button
              variant="outline"
              size="md"
              onClick={() => setIsCancelModalOpen(false)}
              disabled={isSubmitting}
            >
              تراجع
            </Button>
            <Button
              variant="danger"
              size="md"
              onClick={handleConfirmCancel}
              disabled={isSubmitting}
              className="font-bold"
              leftIcon={isSubmitting ? <Spinner size="sm" /> : <XCircle className="w-4.5 h-4.5" />}
            >
              {isSubmitting ? 'جاري الإلغاء...' : 'تأكيد الإلغاء'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4 text-sm">
          <p className="text-slate-700 font-medium text-xs">
            هل أنت متأكد من إلغاء هذا الحجز؟ ستصبح كافة الأجهزة المشمولة متاحة للبيع فوراً:
          </p>
          <div className="p-3.5 bg-slate-50 border border-slate-300 rounded-xl space-y-1.5 text-xs">
            {activeReservation?.items && activeReservation.items.length > 1 ? (
              <div className="space-y-1">
                <p className="font-bold text-slate-900">الأجهزة التي ستعاد للمخزون:</p>
                {activeReservation.items.map((it, idx) => (
                  <p key={it.id || idx} className="text-slate-700 font-mono">
                    • {it.brand} {it.model_name}{' '}
                    {it.serial_number ? `(${it.serial_number})` : `(${it.quantity || 1} وحدات)`}
                  </p>
                ))}
              </div>
            ) : (
              <div>
                <p className="font-bold text-slate-900">
                  {activeReservation?.brand} {activeReservation?.model_name}
                </p>
                <p className="font-mono font-medium text-slate-700">
                  السيريال: {activeReservation?.serial_number || 'بدون سيريال'}
                </p>
              </div>
            )}
            <p className="text-slate-600 pt-1 border-t border-slate-200">العميل: {activeReservation?.customer_name}</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-800 mb-1.5">
              سبب الإلغاء (اختياري)
            </label>
            <Input
              value={cancelReason}
              onChange={e => setCancelReason(e.target.value)}
              placeholder="مثال: لم يحضر العميل خلال المدة..."
              className="h-8 text-xs"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};
