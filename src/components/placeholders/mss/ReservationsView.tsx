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
} from 'lucide-react';

export interface ReservationModalItem {
  id: string;
  device_id: string;
  device: MSSDevice;
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

  // New Reservation Modal State (Multi-Device Support)
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [reservationItems, setReservationItems] = useState<ReservationModalItem[]>([]);
  const [pendingDevice, setPendingDevice] = useState<MSSDevice | null>(null);
  const [pendingQuantity, setPendingQuantity] = useState<number>(1);
  const [pendingAgreedPrice, setPendingAgreedPrice] = useState<number>(0);
  const [itemError, setItemError] = useState<string>('');

  const [branch, setBranch] = useState<MSSStockLocation>('محل 1');
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [depositAmount, setDepositAmount] = useState<number>(500);
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

  // Open Add Modal
  const handleOpenAdd = () => {
    if (availableDevices.length === 0) {
      showNotification({
        type: 'warning',
        title: 'لا توجد أجهزة متوفرة',
        message: 'لا توجد أجهزة بحالة (متاح للبيع) في المخزون حالياً لحجزها',
      });
      return;
    }

    const first = availableDevices[0];
    setPendingDevice(first);
    setPendingQuantity(1);
    setPendingAgreedPrice(first.list_price);
    setReservationItems([]);
    setBranch(first.stock_location);
    setDepositAmount(500);
    setCustomerName('');
    setCustomerPhone('');
    setExpiryDate(new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0]);
    setNotes('حجز مؤقت مع عربون');
    setFormError('');
    setItemError('');
    setIsAddModalOpen(true);
  };

  // Device pick in modal
  const handlePendingDevicePick = (d: MSSDevice) => {
    setPendingDevice(d);
    setPendingQuantity(1);
    setPendingAgreedPrice(d.list_price);
    setItemError('');
  };

  // Add Item to reservation
  const handleAddItemToReservation = () => {
    if (!pendingDevice) {
      setItemError('يرجى اختيار جهاز لإضافته للحجز');
      return;
    }

    const isSerialized = Boolean(pendingDevice.is_serialized && pendingDevice.serial_number);
    const availableStock =
      pendingDevice.quantity && pendingDevice.quantity > 0 ? pendingDevice.quantity : 1;

    // Check duplicate serialized device
    if (isSerialized) {
      const exists = reservationItems.some(it => it.device_id === pendingDevice.id);
      if (exists) {
        setItemError(`الجهاز بالسيريال (${pendingDevice.serial_number}) مضاف بالفعل في الحجز`);
        return;
      }
    }

    const qtyToAdd = isSerialized ? 1 : Math.max(1, Math.floor(pendingQuantity));
    const existing = reservationItems.find(it => it.device_id === pendingDevice.id);
    const currentQty = existing ? existing.quantity : 0;

    if (currentQty + qtyToAdd > availableStock) {
      setItemError(
        `الكمية المطلوبة (${currentQty + qtyToAdd}) تتجاوز المخزون المتاح (${availableStock}) لهذا الموديل.`
      );
      return;
    }

    if (pendingAgreedPrice < 0) {
      setItemError('السعر المتفق عليه لا يمكن أن يكون سالباً');
      return;
    }

    if (existing && !isSerialized) {
      setReservationItems(prev =>
        prev.map(it =>
          it.device_id === pendingDevice.id
            ? {
                ...it,
                quantity: it.quantity + qtyToAdd,
                agreed_price: pendingAgreedPrice,
                total_agreed_price: (it.quantity + qtyToAdd) * pendingAgreedPrice,
              }
            : it
        )
      );
    } else {
      const newItem: ReservationModalItem = {
        id: `res-item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        device_id: pendingDevice.id,
        device: pendingDevice,
        is_serialized: isSerialized,
        serial_number: pendingDevice.serial_number,
        model_name: pendingDevice.model_name,
        brand: pendingDevice.brand,
        quantity: qtyToAdd,
        available_stock: availableStock,
        agreed_price: pendingAgreedPrice,
        total_agreed_price: qtyToAdd * pendingAgreedPrice,
        branch: pendingDevice.stock_location,
      };
      setReservationItems(prev => [...prev, newItem]);
    }

    setItemError('');
    showNotification({
      type: 'success',
      title: 'تمت إضافة الجهاز للحجز',
      message: `${pendingDevice.brand} ${pendingDevice.model_name}`,
    });
  };

  // Remove Item from reservation
  const handleRemoveItemFromReservation = (id: string) => {
    setReservationItems(prev => prev.filter(it => it.id !== id));
  };

  // Total agreed price for all items in reservation
  const totalAgreedPrice = reservationItems.reduce((sum, it) => sum + it.total_agreed_price, 0);

  // Save new reservation
  const handleSaveAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (reservationItems.length === 0) {
      setFormError('يرجى إضافة جهاز واحد على الأقل إلى الحجز');
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
    if (depositAmount < 0) {
      setFormError('مبلغ العربون لا يمكن أن يكون سالباً');
      return;
    }
    if (totalAgreedPrice < 0) {
      setFormError('السعر المتفق عليه لا يمكن أن يكون سالباً');
      return;
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

      setIsAddModalOpen(false);
      await loadData();
    } catch (err: any) {
      setFormError(err.message || 'فشلت عملية إنشاء الحجز');
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
      render: (item: MSSReservation) => (
        <span className="font-mono font-bold text-slate-900 text-sm tabular-nums">
          {item.reservation_number}
        </span>
      ),
    },
    {
      key: 'serial_number',
      header: 'السيريال المحجوز',
      render: (item: MSSReservation) => {
        const isMulti = (item.items && item.items.length > 1) || (item.items_count && item.items_count > 1);
        const count = item.items?.length || item.items_count || 1;
        if (isMulti) {
          return (
            <Badge variant="primary" size="sm" className="font-bold">
              متعدد ({count} أجهزة)
            </Badge>
          );
        }
        return item.serial_number ? (
          <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-300 tabular-nums">
            {item.serial_number}
          </span>
        ) : (
          <Badge variant="outline" size="sm">
            بدون سيريال
          </Badge>
        );
      },
    },
    {
      key: 'model_name',
      header: 'الموديل',
      render: (item: MSSReservation) => {
        const isMulti = (item.items && item.items.length > 1) || (item.items_count && item.items_count > 1);
        if (isMulti) {
          return (
            <div className="space-y-0.5">
              <span className="font-bold text-slate-900 text-sm block">
                {item.brand ? `${item.brand} ` : ''}
                {item.model_name || 'أجهزة متعددة'}
              </span>
              <span className="text-[11px] text-slate-500 font-mono block">
                {item.items?.map(it => it.serial_number || it.model_name).filter(Boolean).slice(0, 2).join(' • ')}
                {item.items && item.items.length > 2 ? ' ...' : ''}
              </span>
            </div>
          );
        }
        return (
          <span className="font-bold text-slate-900 text-sm">
            {item.brand ? `${item.brand} ` : ''}
            {item.model_name || 'جهاز لابتوب / شاشة'}
          </span>
        );
      },
    },
    {
      key: 'customer_name',
      header: 'العميل وبيانات التواصل',
      render: (item: MSSReservation) => (
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 font-bold text-slate-900 text-sm">
            <User className="w-4 h-4 text-slate-500" />
            <span>{item.customer_name}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-mono font-medium text-slate-600 tabular-nums">
            <Phone className="w-3.5 h-3.5 text-slate-400" />
            <span>{item.customer_phone}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'deposit_amount',
      header: 'العربون',
      render: (item: MSSReservation) => (
        <span className="font-mono text-sm font-bold text-slate-900 tabular-nums">
          {formatCurrency(item.deposit_amount)}
        </span>
      ),
    },
    {
      key: 'agreed_price',
      header: 'السعر المتفق عليه',
      render: (item: MSSReservation) => (
        <span className="font-mono text-sm font-bold text-slate-900 tabular-nums">
          {formatCurrency(item.agreed_price)}
        </span>
      ),
    },
    {
      key: 'branch',
      header: 'فرع الحجز',
      render: (item: MSSReservation) => (
        <Badge variant={item.branch === 'محل 1' ? 'primary' : 'default'} size="sm">
          {item.branch}
        </Badge>
      ),
    },
    {
      key: 'expiry_date',
      header: 'تاريخ الانتهاء',
      render: (item: MSSReservation) => (
        <span className="font-mono text-sm font-bold text-rose-700 tabular-nums">
          {item.expiry_date}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'الحالة',
      render: (item: MSSReservation) => {
        switch (item.status) {
          case 'ACTIVE':
            return <Badge variant="success" size="sm">ساري ومؤكد</Badge>;
          case 'FULFILLED':
            return <Badge variant="default" size="sm">تم البيع</Badge>;
          case 'CANCELLED':
            return <Badge variant="danger" size="sm">ملغي</Badge>;
          case 'EXPIRED':
            return <Badge variant="warning" size="sm">منتهي</Badge>;
          default:
            return <Badge variant="default" size="sm">{item.status}</Badge>;
        }
      },
    },
    {
      key: 'actions',
      header: 'إجراءات',
      align: 'center',
      render: (item: MSSReservation) => (
        <div className="flex items-center gap-1.5">
          {item.status === 'ACTIVE' && (
            <>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setActiveReservation(item);
                  setIsFulfillModalOpen(true);
                }}
                className="h-8 px-2.5 text-xs font-bold"
                leftIcon={<CheckCircle2 className="w-4 h-4" />}
              >
                إتمام البيع
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setActiveReservation(item);
                  setIsCancelModalOpen(true);
                }}
                className="h-8 px-2.5 text-slate-500 hover:text-rose-600 text-xs font-bold"
                leftIcon={<XCircle className="w-4 h-4" />}
              >
                إلغاء
              </Button>
            </>
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
                  كلا الفرعين
                </button>
                <button
                  onClick={() => setBranchFilter('محل 1')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                    branchFilter === 'محل 1'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  محل 1
                </button>
                <button
                  onClick={() => setBranchFilter('محل 2')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                    branchFilter === 'محل 2'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  محل 2
                </button>
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
          />
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: Create New Reservation (Multi-Device Support) */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => !isSubmitting && setIsAddModalOpen(false)}
        title="إنشاء حجز أجهزة جديد"
        subtitle="حجز جهاز واحد أو عدة أجهزة لعميل مع توثيق العربون والأجهزة"
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
                ? 'جاري إنشاء الحجز...'
                : `تأكيد الحجز (${reservationItems.length} أجهزة - ${formatCurrency(totalAgreedPrice)})`}
            </Button>
          </div>
        }
      >
        <form onSubmit={handleSaveAdd} className="space-y-4 text-sm">
          {formError && (
            <Alert type="danger" title="خطأ في البيانات" message={formError} />
          )}

          {/* Section 1: Device Selection and Add to Reservation */}
          <div className="p-3.5 bg-slate-50 border border-slate-300 rounded-xl space-y-3">
            <h4 className="text-xs font-bold text-slate-900 flex items-center gap-2">
              <Laptop className="w-4 h-4 text-slate-600" />
              <span>اختيار وإضافة جهاز للحجز:</span>
            </h4>

            <div>
              <SearchableItemSelect<MSSDevice>
                items={availableDevices}
                selectedId={pendingDevice?.id || null}
                onSelect={handlePendingDevicePick}
                getKey={d => d.id}
                getSearchableText={d =>
                  `${d.serial_number || ''} ${d.brand || ''} ${d.model_name || ''} ${d.stock_location}`
                }
                placeholder="ابحث بالاسم، الموديل، الماركة أو السيريال..."
                emptyMessage="لا توجد أجهزة متوفرة مطابقة للبحث"
                maxHeight="max-h-48"
                renderItem={d => (
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 truncate">
                      <span className="font-bold text-slate-900">
                        {d.brand} {d.model_name}
                      </span>
                      {d.serial_number ? (
                        <span className="font-mono text-[11px] bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded border border-slate-300">
                          {d.serial_number}
                        </span>
                      ) : (
                        <Badge variant="outline" size="sm" className="text-[10px]">
                          بدون سيريال {d.quantity && d.quantity > 1 ? `(${d.quantity} وحدات)` : ''}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="default" size="sm">
                        {d.stock_location}
                      </Badge>
                      <span className="font-mono text-xs font-bold text-slate-900">
                        {formatCurrency(d.list_price)}
                      </span>
                    </div>
                  </div>
                )}
              />
            </div>

            {pendingDevice && (
              <div className="pt-2 border-t border-slate-200 space-y-2.5">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {!pendingDevice.is_serialized && (
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        الكمية المطلوبة (المتاح: {pendingDevice.quantity || 1})
                      </label>
                      <Input
                        type="number"
                        min="1"
                        max={pendingDevice.quantity || 1}
                        value={pendingQuantity}
                        onChange={e => {
                          const val = parseInt(e.target.value, 10) || 1;
                          setPendingQuantity(Math.max(1, Math.min(pendingDevice.quantity || 1, val)));
                        }}
                        className="h-8 text-xs font-mono font-bold"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      السعر المتفق عليه للوحدة (EGP)
                    </label>
                    <Input
                      type="number"
                      min="0"
                      value={pendingAgreedPrice}
                      onChange={e => setPendingAgreedPrice(Number(e.target.value) || 0)}
                      className="h-8 text-xs font-mono font-bold"
                    />
                  </div>

                  <div className="flex items-end">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddItemToReservation}
                      leftIcon={<Plus className="w-4 h-4" />}
                      className="w-full font-bold border-slate-300 bg-white hover:bg-slate-100"
                    >
                      إضافة الجهاز للحجز
                    </Button>
                  </div>
                </div>

                {itemError && (
                  <Alert type="danger" title="تنبيه" message={itemError} className="py-1 text-xs" />
                )}
              </div>
            )}
          </div>

          {/* Section 2: Items currently in this reservation */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-800">
              الأجهزة المشمولة بالحجز ({reservationItems.length} أجهزة):
            </label>

            {reservationItems.length === 0 ? (
              <div className="p-4 text-center bg-slate-50 rounded-xl border border-dashed border-slate-300 text-xs text-slate-500">
                لم يتم إضافة أي أجهزة للحجز بعد. اختر جهازاً واضغط (إضافة الجهاز للحجز).
              </div>
            ) : (
              <div className="border border-slate-300 rounded-xl overflow-hidden">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
                    <tr>
                      <th className="p-2">#</th>
                      <th className="p-2">الجهاز</th>
                      <th className="p-2">السيريال / الكمية</th>
                      <th className="p-2">الفرع</th>
                      <th className="p-2">السعر المتفق عليه</th>
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
                              بدون سيريال ({item.quantity} وحدات)
                            </Badge>
                          )}
                        </td>
                        <td className="p-2">
                          <Badge variant="default" size="sm">
                            {item.branch}
                          </Badge>
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
              value={depositAmount}
              onChange={e => setDepositAmount(Number(e.target.value))}
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
              options={[
                { value: 'محل 1', label: 'محل 1' },
                { value: 'محل 2', label: 'محل 2' },
              ]}
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
