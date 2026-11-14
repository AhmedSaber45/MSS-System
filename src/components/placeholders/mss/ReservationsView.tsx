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
import { mssCommerceService } from '@/services/mssCommerceService';
import { mssInventoryService } from '@/services/mssInventoryService';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { MSSReservation, MSSStockLocation, MSSReservationStatus } from '@/types/mssCommerce';
import type { MSSDevice } from '@/types/mssInventory';
import {
  Plus,
  Search,
  BookmarkCheck,
  CheckCircle2,
  XCircle,
  Calendar,
  Store,
  RotateCcw,
  Phone,
  User,
} from 'lucide-react';

export const ReservationsView: React.FC = () => {
  const { showNotification } = useNotification();

  const [reservations, setReservations] = useState<MSSReservation[]>([]);
  const [availableDevices, setAvailableDevices] = useState<MSSDevice[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | MSSReservationStatus>('ALL');
  const [branchFilter, setBranchFilter] = useState<'ALL' | MSSStockLocation>('ALL');

  // New Reservation Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [branch, setBranch] = useState<MSSStockLocation>('محل 1');
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [depositAmount, setDepositAmount] = useState<number>(500);
  const [agreedPrice, setAgreedPrice] = useState<number>(0);
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
    setSelectedDeviceId(first.id);
    setBranch(first.stock_location);
    setAgreedPrice(first.list_price);
    setDepositAmount(500);
    setCustomerName('');
    setCustomerPhone('');
    setExpiryDate(new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0]);
    setNotes('حجز مؤقت مع عربون');
    setFormError('');
    setIsAddModalOpen(true);
  };

  // Device change in modal
  const handleDeviceChange = (devId: string) => {
    setSelectedDeviceId(devId);
    const d = availableDevices.find(x => x.id === devId);
    if (d) {
      setAgreedPrice(d.list_price);
      setBranch(d.stock_location);
    }
  };

  // Save new reservation
  const handleSaveAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!selectedDeviceId) {
      setFormError('يرجى اختيار الجهاز المراد حجزه');
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
    if (depositAmount < 0 || agreedPrice < 0) {
      setFormError('القيم المالية لا يمكن أن تكون سالبة');
      return;
    }

    setIsSubmitting(true);
    setFormError('');

    try {
      const res = await mssCommerceService.createReservation({
        device_id: selectedDeviceId,
        branch,
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim(),
        deposit_amount: Number(depositAmount),
        agreed_price: Number(agreedPrice),
        expiry_date: expiryDate,
        notes: notes.trim() || undefined,
      });

      showNotification({
        type: 'success',
        title: 'تم إنشاء الحجز بنجاح',
        message: `تم حجز الجهاز بالسيريال (${res.serial_number}) للعميل (${res.customer_name}) بحجز رقم ${res.reservation_number}`,
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
        message: `تم إلغاء الحجز (${activeReservation.reservation_number}) وإعادة الجهاز (${activeReservation.serial_number}) إلى المخزون المتاح للبيع.`,
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
      const invoice = await mssCommerceService.confirmSale({
        device_id: activeReservation.device_id,
        selling_branch: activeReservation.branch,
        actual_sale_price: activeReservation.agreed_price,
        customer_name: activeReservation.customer_name,
        customer_phone: activeReservation.customer_phone,
        notes: `إتمام حجز رقم ${activeReservation.reservation_number} - مسدد عربون: ${formatCurrency(activeReservation.deposit_amount)}`,
      });

      showNotification({
        type: 'success',
        title: 'تم إتمام البيع بنجاح',
        message: `تم تحويل الحجز إلى فاتورة بيع رسمية رقم (${invoice.invoice_number})`,
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
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const matchNum = r.reservation_number.toLowerCase().includes(q);
      const matchSerial = r.serial_number.toLowerCase().includes(q);
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
        <span className="font-mono font-bold text-teal-800 text-xs bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
          {item.reservation_number}
        </span>
      ),
    },
    {
      key: 'serial_number',
      header: 'السيريال المحجوز',
      render: (item: MSSReservation) => (
        <span className="font-mono font-bold text-xs bg-slate-900 text-teal-300 px-2.5 py-1 rounded-md tracking-wider border border-slate-700 select-all">
          {item.serial_number}
        </span>
      ),
    },
    {
      key: 'model_name',
      header: 'الموديل',
      render: (item: MSSReservation) => (
        <span className="font-bold text-slate-800 text-sm">
          {item.brand ? `${item.brand} ` : ''}
          {item.model_name || 'جهاز لابتوب / شاشة'}
        </span>
      ),
    },
    {
      key: 'customer_name',
      header: 'العميل وبيانات التواصل',
      render: (item: MSSReservation) => (
        <div className="space-y-0.5">
          <div className="flex items-center gap-1 font-semibold text-slate-900 text-xs">
            <User className="w-3.5 h-3.5 text-slate-400" />
            <span>{item.customer_name}</span>
          </div>
          <div className="flex items-center gap-1 text-[11px] font-mono text-slate-500">
            <Phone className="w-3 h-3 text-slate-400" />
            <span>{item.customer_phone}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'deposit_amount',
      header: 'العربون',
      render: (item: MSSReservation) => (
        <span className="font-bold text-slate-900 font-mono text-xs">
          {formatCurrency(item.deposit_amount)}
        </span>
      ),
    },
    {
      key: 'agreed_price',
      header: 'السعر المتفق عليه',
      render: (item: MSSReservation) => (
        <span className="font-bold text-teal-800 font-mono text-xs">
          {formatCurrency(item.agreed_price)}
        </span>
      ),
    },
    {
      key: 'branch',
      header: 'فرع الحجز',
      render: (item: MSSReservation) => (
        <Badge variant={item.branch === 'محل 1' ? 'primary' : 'purple'}>
          {item.branch}
        </Badge>
      ),
    },
    {
      key: 'expiry_date',
      header: 'تاريخ الانتهاء',
      render: (item: MSSReservation) => (
        <span className="font-mono text-xs text-rose-600 font-semibold">
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
            return <Badge variant="success">ساري ومؤكد</Badge>;
          case 'FULFILLED':
            return <Badge variant="default">تم البيع للعميل</Badge>;
          case 'CANCELLED':
            return <Badge variant="danger">ملغي ومفرج عنه</Badge>;
          case 'EXPIRED':
            return <Badge variant="warning">منتهي الصلاحية</Badge>;
          default:
            return <Badge variant="default">{item.status}</Badge>;
        }
      },
    },
    {
      key: 'actions',
      header: 'إجراءات',
      align: 'center',
      render: (item: MSSReservation) => (
        <div className="flex items-center gap-1">
          {item.status === 'ACTIVE' && (
            <>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setActiveReservation(item);
                  setIsFulfillModalOpen(true);
                }}
                className="bg-teal-700 hover:bg-teal-800 text-xs py-1"
                leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
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
                className="text-rose-600 hover:text-rose-800 hover:bg-rose-50 text-xs py-1"
                leftIcon={<XCircle className="w-3.5 h-3.5" />}
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
        title="حجوزات أجهزة MSS (Device Reservations)"
        subtitle="حجز أجهزة محددة بالسيريال للعملاء مع تحديد العربون وتاريخ الانتهاء وتحديث حالة الجهاز في كلا المحلين فورياً"
        actions={
          <Button
            variant="primary"
            size="sm"
            onClick={handleOpenAdd}
            className="bg-teal-700 hover:bg-teal-800"
            leftIcon={<Plus className="w-4 h-4" />}
          >
            إنشاء حجز جديد بالسيريال
          </Button>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 bg-white border border-slate-200">
          <p className="text-xs text-slate-500 font-semibold mb-1">إجمالي الحجوزات</p>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-slate-800">{reservations.length}</span>
            <BookmarkCheck className="w-5 h-5 text-slate-400" />
          </div>
          <span className="text-xs text-slate-400">سجل الحجوزات الكلي</span>
        </Card>

        <Card className="p-4 bg-emerald-50/60 border border-emerald-200">
          <p className="text-xs text-emerald-800 font-semibold mb-1">الحجوزات السارية حالياً</p>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-emerald-900">
              {reservations.filter(r => r.status === 'ACTIVE').length}
            </span>
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          </div>
          <span className="text-xs text-emerald-600">محجوزة وتمنع البيع للغير</span>
        </Card>

        <Card className="p-4 bg-teal-50/60 border border-teal-200">
          <p className="text-xs text-teal-800 font-semibold mb-1">إجمالي العربون المسدد</p>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-teal-900 font-mono">
              {formatCurrency(
                reservations
                  .filter(r => r.status === 'ACTIVE')
                  .reduce((sum, r) => sum + r.deposit_amount, 0)
              )}
            </span>
            <Calendar className="w-5 h-5 text-teal-600" />
          </div>
          <span className="text-xs text-teal-600">عربيد الحجوزات السارية</span>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <Card className="p-4 space-y-3">
        <div className="flex flex-col md:flex-row items-center gap-3">
          <div className="flex-1 w-full">
            <Input
              placeholder="ابحث برقم الحجز، السيريال، اسم العميل، الهاتف، أو الموديل..."
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

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-slate-500">حالة الحجز:</span>
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

          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-slate-500">فرع الحجز:</span>
            <button
              onClick={() => setBranchFilter('ALL')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                branchFilter === 'ALL'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              كلا الفرعين
            </button>
            <button
              onClick={() => setBranchFilter('محل 1')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                branchFilter === 'محل 1'
                  ? 'bg-blue-700 text-white shadow-sm'
                  : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
              }`}
            >
              محل 1
            </button>
            <button
              onClick={() => setBranchFilter('محل 2')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                branchFilter === 'محل 2'
                  ? 'bg-purple-700 text-white shadow-sm'
                  : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
              }`}
            >
              محل 2
            </button>
          </div>
        </div>
      </Card>

      {/* Table */}
      {isLoading ? (
        <Card className="p-12 text-center">
          <Spinner size="lg" className="mx-auto mb-3 text-teal-600" />
          <p className="text-sm font-semibold text-slate-600">جاري تحميل سجلات الحجوزات...</p>
        </Card>
      ) : filteredReservations.length === 0 ? (
        <Card className="p-12 text-center space-y-3">
          <BookmarkCheck className="w-12 h-12 mx-auto text-slate-300" />
          <h3 className="text-base font-bold text-slate-700">لا توجد حجوزات مطابقة</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            يمكنك إنشاء حجز جديد بالسيريال لأي جهاز متاح في المخزون لمنع بيعه للغير وتثبيت العربون.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={handleOpenAdd}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            إنشاء حجز جديد الآن
          </Button>
        </Card>
      ) : (
        <Table
          columns={columns}
          data={filteredReservations}
          keyExtractor={(item: MSSReservation) => item.id}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: Create New Reservation */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => !isSubmitting && setIsAddModalOpen(false)}
        title="إنشاء حجز جهاز جديد بالسيريال"
        subtitle="حجز جهاز متاح لعميل مع تحديد العربون وتاريخ الانتهاء"
        size="md"
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
              {isSubmitting ? 'جاري إنشاء الحجز...' : 'تأكيد الحجز'}
            </Button>
          </div>
        }
      >
        <form onSubmit={handleSaveAdd} className="space-y-4">
          {formError && (
            <Alert type="danger" title="خطأ في البيانات" message={formError} />
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              اختر الجهاز المراد حجزه (الأجهزة المتاحة فقط) *
            </label>
            <Select
              value={selectedDeviceId}
              onChange={e => handleDeviceChange(e.target.value)}
              required
            >
              {availableDevices.map(d => (
                <option key={d.id} value={d.id}>
                  [{d.serial_number}] - {d.brand} {d.model_name} (الموقع: {d.stock_location}) -{' '}
                  {formatCurrency(d.list_price)}
                </option>
              ))}
            </Select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="اسم العميل *"
              placeholder="مثال: أحمد محمود..."
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
              label="العربون المدفوع (ج.م) *"
              type="number"
              min="0"
              value={depositAmount}
              onChange={e => setDepositAmount(Number(e.target.value))}
              required
            />

            <Input
              label="السعر المتفق عليه (ج.م) *"
              type="number"
              min="0"
              value={agreedPrice}
              onChange={e => setAgreedPrice(Number(e.target.value))}
              required
            />

            <Input
              label="تاريخ انتهاء الحجز *"
              type="date"
              value={expiryDate}
              onChange={e => setExpiryDate(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              فرع توثيق الحجز *
            </label>
            <Select
              value={branch}
              onChange={e => setBranch(e.target.value as MSSStockLocation)}
            >
              <option value="محل 1">محل 1</option>
              <option value="محل 2">محل 2</option>
            </Select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              ملاحظات الحجز
            </label>
            <textarea
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600"
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
        title="إتمام بيع جهاز محجوز"
        subtitle={`تحويل الحجز (${activeReservation?.reservation_number}) إلى فاتورة بيع نهائية`}
        size="md"
        footer={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsFulfillModalOpen(false)}
              disabled={isSubmitting}
            >
              إلغاء
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleConfirmFulfill}
              disabled={isSubmitting}
              className="bg-teal-700 hover:bg-teal-800"
              leftIcon={isSubmitting ? <Spinner size="sm" /> : <CheckCircle2 className="w-4 h-4" />}
            >
              {isSubmitting ? 'جاري إتمام البيع...' : 'تأكيد البيع النهائي'}
            </Button>
          </div>
        }
      >
        {activeReservation && (
          <div className="space-y-4">
            <p className="text-sm text-slate-700">
              سيتم تسجيل الفاتورة للعميل وتحديث حالة الجهاز إلى (تم البيع) بالسعر المتفق عليه:
            </p>

            <div className="p-4 bg-teal-50/60 border border-teal-200 rounded-xl space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">العميل:</span>
                <strong className="text-slate-900">{activeReservation.customer_name}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">السيريال:</span>
                <strong className="font-mono text-slate-900">{activeReservation.serial_number}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">السعر المتفق عليه:</span>
                <strong className="text-teal-900 text-sm font-bold">
                  {formatCurrency(activeReservation.agreed_price)}
                </strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">العربون السابق دفعه:</span>
                <span className="font-bold text-emerald-700">
                  {formatCurrency(activeReservation.deposit_amount)}
                </span>
              </div>
              <div className="border-t border-teal-200 pt-2 flex justify-between font-bold text-sm">
                <span className="text-slate-800">المتبقي المطلوب تحصيله:</span>
                <span className="text-teal-900">
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
        subtitle={`إلغاء حجز رقم (${activeReservation?.reservation_number}) وإعادة الجهاز للمخزون المتاح`}
        size="sm"
        footer={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsCancelModalOpen(false)}
              disabled={isSubmitting}
            >
              تراجع
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleConfirmCancel}
              disabled={isSubmitting}
              leftIcon={isSubmitting ? <Spinner size="sm" /> : <XCircle className="w-4 h-4" />}
            >
              {isSubmitting ? 'جاري الإلغاء...' : 'تأكيد الإلغاء والإفراج'}
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-700">
            هل أنت متأكد من إلغاء هذا الحجز؟ سيصبح الجهاز متاحاً للبيع فوراً في كلا الفرعين:
          </p>
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
            <p className="font-bold text-slate-800">
              {activeReservation?.brand} {activeReservation?.model_name}
            </p>
            <p className="font-mono text-slate-600">السيريال: {activeReservation?.serial_number}</p>
            <p className="text-slate-600">العميل: {activeReservation?.customer_name}</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              سبب الإلغاء (اختياري)
            </label>
            <Input
              value={cancelReason}
              onChange={e => setCancelReason(e.target.value)}
              placeholder="مثال: لم يحضر العميل خلال المدة..."
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};
