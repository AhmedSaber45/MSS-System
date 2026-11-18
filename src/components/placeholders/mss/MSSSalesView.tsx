import React, { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { Select } from '@/components/common/Select';
import { Badge } from '@/components/common/Badge';
import { Alert } from '@/components/common/Alert';
import { Modal } from '@/components/common/Modal';
import { Spinner } from '@/components/common/Spinner';
import { CheckCircle, Laptop, Store, ArrowRightLeft, Search, Printer, FileDown, ShieldCheck, RefreshCw, Banknote, Tag, Clock, Calendar } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useNotification } from '@/context/NotificationContext';
import { usePageRefresh } from '@/context/PageRefreshContext';
import { mssInventoryService } from '@/services/mssInventoryService';
import { mssCommerceService } from '@/services/mssCommerceService';
import { documentPrintService } from '@/lib/documentPrintService';
import { InstallmentScheduleBuilder, PlannedInstallmentItem } from '@/components/common/InstallmentScheduleBuilder';
import type { MSSDevice, MSSStockLocation } from '@/types/mssInventory';
import type { MSSInvoice, MSSPaymentType } from '@/types/mssCommerce';

export const MSSSalesView: React.FC = () => {
  const { showNotification } = useNotification();
  const { isRefreshing, triggerRefresh } = usePageRefresh();

  const [availableDevices, setAvailableDevices] = useState<MSSDevice[]>([]);
  const [isLoadingDevices, setIsLoadingDevices] = useState<boolean>(true);
  const [selectedDevice, setSelectedDevice] = useState<MSSDevice | null>(null);

  // Form State
  const [searchSerialQuery, setSearchSerialQuery] = useState<string>('');
  const [sellingBranch, setSellingBranch] = useState<MSSStockLocation>('محل 1');
  const [actualPrice, setActualPrice] = useState<number>(0);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [paymentType, setPaymentType] = useState<MSSPaymentType>('FULL');
  const [initialPayment, setInitialPayment] = useState<number>(0);
  const [dueDate, setDueDate] = useState<string>(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return d.toISOString().substring(0, 10);
  });
  const [installmentSchedule, setInstallmentSchedule] = useState<PlannedInstallmentItem[]>([]);
  const [showScheduleBuilder, setShowScheduleBuilder] = useState<boolean>(false);
  const [warrantyPeriod, setWarrantyPeriod] = useState<string>('ضمان شهر كامل من تاريخ الشراء');
  const [notes, setNotes] = useState<string>('حالة ممتازة مع الشاحن الأصلي');
  const [formError, setFormError] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Success Modal with Invoice Preview
  const [completedInvoice, setCompletedInvoice] = useState<MSSInvoice | null>(null);

  // Load available devices
  const loadDevices = useCallback(async () => {
    setIsLoadingDevices(true);
    try {
      const devices = await mssInventoryService.getDevices({ status: 'AVAILABLE' });
      setAvailableDevices(devices);
      if (devices.length > 0 && !selectedDevice) {
        handleSelectDevice(devices[0]);
      }
    } catch (err: any) {
      console.error('Failed to load available devices:', err);
    } finally {
      setIsLoadingDevices(false);
    }
  }, [selectedDevice]);

  useEffect(() => {
    loadDevices();
  }, [loadDevices]);

  // Handle selecting a device
  const handleSelectDevice = (device: MSSDevice) => {
    setSelectedDevice(device);
    setSearchSerialQuery(device.serial_number);
    setActualPrice(device.list_price);
    setDiscountAmount(0);
    setFormError('');
  };

  // Handle searching by serial number / scanner
  const handleSearchSerial = async (serial: string) => {
    setSearchSerialQuery(serial);
    if (!serial.trim()) return;

    const match = availableDevices.find(
      d => d.serial_number.toUpperCase() === serial.trim().toUpperCase()
    );

    if (match) {
      handleSelectDevice(match);
    } else {
      // Try fetching by serial from service
      const found = await mssInventoryService.getDeviceBySerial(serial.trim());
      if (found) {
        if (found.status === 'AVAILABLE') {
          handleSelectDevice(found);
        } else {
          setFormError(`الجهاز بالسيريال (${found.serial_number}) ليس متاحاً للبيع (حالته: ${found.status})`);
        }
      }
    }
  };

  // Live calculations
  const costSnapshot = selectedDevice ? selectedDevice.purchase_cost : 0;
  const listPriceSnapshot = selectedDevice ? selectedDevice.list_price : 0;
  const grossProfit = selectedDevice ? actualPrice - costSnapshot : 0;
  const sourceBranch = selectedDevice ? selectedDevice.stock_location : 'محل 1';
  const isCrossBranch = sellingBranch !== sourceBranch;
  const remainingBalance = paymentType === 'FULL' ? 0 : Math.max(0, actualPrice - initialPayment);

  // Submit sale
  const handleConfirmSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!selectedDevice) {
      setFormError('يرجى اختيار الجهاز المراد بيعه أولاً');
      return;
    }

    if (actualPrice < 0) {
      setFormError('سعر البيع الفعلي لا يمكن أن يكون سالباً');
      return;
    }

    if (paymentType === 'DEFERRED') {
      if (initialPayment > actualPrice) {
        setFormError('الدفعة المقدمة لا يمكن أن تتجاوز سعر بيع الجهاز.');
        return;
      }
      if (initialPayment < 0) {
        setFormError('الدفعة المقدمة لا يمكن أن تكون سالبة.');
        return;
      }
    }

    setIsSubmitting(true);
    setFormError('');

    try {
      const invoice = await mssCommerceService.confirmSale({
        device_id: selectedDevice.id,
        selling_branch: sellingBranch,
        actual_sale_price: Number(actualPrice),
        discount_amount: Number(discountAmount),
        customer_name: customerName.trim() || undefined,
        customer_phone: customerPhone.trim() || undefined,
        warranty_period: warrantyPeriod.trim() || undefined,
        notes: notes.trim() || undefined,
        payment_type: paymentType,
        initial_payment: paymentType === 'DEFERRED' ? initialPayment : Number(actualPrice),
        due_date: paymentType === 'DEFERRED' ? dueDate || undefined : undefined,
        installments: paymentType === 'DEFERRED' && installmentSchedule.length > 0 ? installmentSchedule : undefined,
      });

      showNotification({
        type: 'success',
        title: 'تم تأكيد البيع وإصدار الفاتورة',
        message: `تم تسجيل الفاتورة (${invoice.invoice_number}) بنجاح لصالح (${sellingBranch}) بربح قدره ${formatCurrency(invoice.gross_profit)}.`,
      });

      setCompletedInvoice(invoice);
      // Reload inventory devices
      await loadDevices();
    } catch (err: any) {
      setFormError(err.message || 'فشلت عملية تأكيد البيع');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartNewSale = () => {
    setCompletedInvoice(null);
    setCustomerName('');
    setCustomerPhone('');
    setPaymentType('FULL');
    setInitialPayment(0);
    setInstallmentSchedule([]);
    setShowScheduleBuilder(false);
    loadDevices();
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title=" بيع أجهزة Compu MSS"
        subtitle=""
        actions={
          <Button
            variant="outline"
            size="md"
            onClick={() => triggerRefresh(loadDevices, 'جارٍ تحديث الأجهزة  ...')}
            disabled={isRefreshing || isLoadingDevices}
            leftIcon={<RefreshCw className={`w-4.5 h-4.5 text-slate-600 ${isRefreshing ? 'animate-spin' : ''}`} />}
            className="border-slate-300 font-semibold"
          >
            Refresh
          </Button>
        }
      />



      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left Column: Device selection & Branches */}
        <div className="lg:col-span-2 space-y-4">
          {/* Card 1: Select Device */}
          <Card className="p-4 bg-white border-slate-300 shadow-2xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Laptop className="w-4.5 h-4.5 text-slate-600" />
              <span>1. اختيار الجهاز بالسيريال نمبر </span>
            </h3>

            <div className="flex gap-2.5">
              <div className="flex-1">
                <Input
                  placeholder="ابحث أو اكتب السيريال نمبر..."
                  value={searchSerialQuery}
                  onChange={e => handleSearchSerial(e.target.value)}
                  leftIcon={<Search className="w-4.5 h-4.5 text-slate-500" />}
                />
              </div>
            </div>

            {/* Quick dropdown for available devices */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                أو اختر من قائمة الأجهزة المتاحة حالياً ({availableDevices.length} جهاز):
              </label>
              <Select
                value={selectedDevice?.id || ''}
                onChange={e => {
                  const dev = availableDevices.find(d => d.id === e.target.value);
                  if (dev) handleSelectDevice(dev);
                }}
                disabled={isLoadingDevices || availableDevices.length === 0}
                options={
                  availableDevices.length === 0
                    ? [{ value: '', label: 'لا توجد أجهزة متوفرة للبيع حالياً' }]
                    : availableDevices.map(d => ({
                        value: d.id,
                        label: `[${d.serial_number}] - ${d.brand} ${d.model_name} (موقع التخزين: ${d.stock_location}) - ${formatCurrency(d.list_price)}`,
                      }))
                }
              />
            </div>

            {/* Selected Device Preview Card */}
            {selectedDevice && (
              <div className="p-4 bg-slate-50/90 rounded-xl border border-slate-300 text-sm space-y-2.5">
                <div className="flex items-center justify-between pb-2.5 border-b border-slate-200">
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">
                      {selectedDevice.brand} {selectedDevice.model_name}
                    </h4>
                    <p className="text-slate-500 font-mono font-medium text-xs mt-0.5">
                      {[selectedDevice.model?.processor, selectedDevice.model?.gpu, selectedDevice.model?.ram, selectedDevice.model?.storage]
                        .filter(Boolean)
                        .join(' • ')}
                    </p>
                  </div>
                  <span className="font-mono font-bold text-xs bg-slate-100 text-slate-900 px-2.5 py-1 rounded-md border border-slate-300 tabular-nums">
                    {selectedDevice.serial_number}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1 text-slate-700">
                  <div>
                    <span className="text-slate-500 block text-xs font-semibold mb-0.5">السعر :</span>
                    <strong className="text-slate-900 text-sm font-mono font-bold tabular-nums">{formatCurrency(selectedDevice.list_price)}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-xs font-semibold mb-0.5">التكلفة :</span>
                    <strong className="font-mono text-slate-700 text-sm font-semibold tabular-nums">{formatCurrency(selectedDevice.purchase_cost)}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-xs font-semibold mb-0.5">الحالة :</span>
                    <strong className="text-slate-800 text-sm font-medium">{selectedDevice.physical_condition}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-xs font-semibold mb-0.5">موقع التخزين:</span>
                    <Badge variant={selectedDevice.stock_location === 'محل 1' ? 'primary' : 'default'} size="sm" className="font-semibold">
                      {selectedDevice.stock_location}
                    </Badge>
                  </div>
                </div>
              </div>
            )}
          </Card>

          {/* Card 2: Branch Attribution */}
          <Card className="p-4 bg-white border-slate-300 shadow-2xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Store className="w-4.5 h-4.5 text-slate-600" />
              <span>2. تحديد فروع  (البيع والمخزون)</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  فرع البيع  <span className="text-rose-500">*</span>
                </label>
                <Select
                  value={sellingBranch}
                  onChange={e => setSellingBranch(e.target.value as MSSStockLocation)}
                  options={[
                    { value: 'محل 1', label: 'محل 1 (الفرع الأول)' },
                    { value: 'محل 2', label: 'محل 2 (الفرع الثاني)' },
                  ]}
                />
                <p className="text-xs text-slate-500 mt-1">تُنسب الفاتورة  لهذا الفرع</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    الموقع الفعلي للتخزين
                </label>
                <div className="w-full h-10 px-3 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-800 font-semibold flex items-center justify-between">
                  <span>{sourceBranch}</span>
                  <Badge variant={sourceBranch === 'محل 1' ? 'primary' : 'default'} size="sm" className="font-semibold">
                    موقع الجهاز الفعلي
                  </Badge>
                </div>
                <p className="text-xs text-slate-500 mt-1">يُخصم الجهاز  من مخزون هذا المحل</p>
              </div>
            </div>

            {/* Cross-Branch Alert */}
            {isCrossBranch && (
              <div className="p-3.5 bg-slate-50/90 rounded-xl border border-slate-300 text-sm text-slate-700 flex items-center gap-2.5">
                <ArrowRightLeft className="w-4.5 h-4.5 text-slate-600 shrink-0" />
                <span>
                  <strong className="text-slate-900 font-bold">تنبيه عملية بيع مشتركة بين الفروع:</strong> الجهاز مسحوب  من مخزون{' '}
                  <strong className="text-slate-900 font-bold">({sourceBranch})</strong> وبيعه   إلى <strong className="text-slate-900 font-bold">({sellingBranch})</strong>.
                </span>
              </div>
            )}
          </Card>

          {/* Card 3: Customer & Payment Details */}
          <Card className="p-4 bg-white border-slate-300 shadow-2xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-4.5 h-4.5 text-slate-600" />
              <span>3. بيانات العميل ونوع البيع</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label={paymentType === 'DEFERRED' ? 'اسم العميل (مطلوب للآجل) *' : 'اسم العميل (اختياري)'}
                placeholder="مثال: م. أحمد ..."
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
              />

              <Input
                label={paymentType === 'DEFERRED' ? 'رقم هاتف العميل (مطلوب للآجل) *' : 'رقم هاتف العميل (اختياري)'}
                placeholder="مثال: 01012345678..."
                value={customerPhone}
                onChange={e => setCustomerPhone(e.target.value)}
                isMonospace
              />
            </div>

            {/* Payment Type Selection: Full vs Deferred */}
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">نوع البيع وطريقة التحصيل:</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setPaymentType('FULL');
                    setInitialPayment(0);
                  }}
                  className={`flex items-center justify-center gap-2 p-2.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                    paymentType === 'FULL'
                      ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                      : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Banknote className="w-4 h-4" />
                  <span>سداد فوري كامل</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPaymentType('DEFERRED');
                    if (initialPayment === 0 && actualPrice > 0) {
                      setInitialPayment(Math.round(actualPrice / 2));
                    }
                  }}
                  className={`flex items-center justify-center gap-2 p-2.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                    paymentType === 'DEFERRED'
                      ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                      : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Tag className="w-4 h-4" />
                  <span>بيع آجل / أقساط</span>
                </button>
              </div>
            </div>

            {/* Deferred Settings */}
            {paymentType === 'DEFERRED' && (
              <div className="p-3.5 bg-amber-50/70 border border-amber-300 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-amber-700" />
                    <span>بيانات البيع الآجل والأقساط</span>
                  </span>
                  <span className="text-xs font-bold text-slate-700">
                    المتبقي: <strong className="text-rose-700 font-mono text-sm">{formatCurrency(remainingBalance)}</strong>
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-[11px] font-bold text-slate-700">الدفعة المقدمة (EGP):</label>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setInitialPayment(0)}
                          className="text-[10px] bg-white border border-slate-300 px-1.5 py-0.5 rounded text-slate-700 hover:bg-slate-100 font-bold"
                        >
                          0 مقدم
                        </button>
                        <button
                          type="button"
                          onClick={() => setInitialPayment(Math.round(actualPrice / 2))}
                          className="text-[10px] bg-white border border-slate-300 px-1.5 py-0.5 rounded text-slate-700 hover:bg-slate-100 font-bold"
                        >
                          50%
                        </button>
                      </div>
                    </div>
                    <Input
                      type="number"
                      min="0"
                      max={actualPrice}
                      value={initialPayment || ''}
                      placeholder="0"
                      onChange={e => {
                        const val = parseFloat(e.target.value) || 0;
                        setInitialPayment(Math.max(0, Math.min(actualPrice, val)));
                      }}
                      className="h-8 text-xs font-bold font-mono"
                      isMonospace
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      تاريخ استحقاق أول قسط:
                    </label>
                    <Input
                      type="date"
                      value={dueDate}
                      onChange={e => setDueDate(e.target.value)}
                      className="h-8 text-xs font-semibold"
                    />
                  </div>
                </div>

                {/* Expandable Schedule Builder */}
                <div className="pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowScheduleBuilder(!showScheduleBuilder)}
                    className="w-full text-xs font-bold border-amber-300 bg-white hover:bg-amber-100/60 text-amber-900 justify-between"
                  >
                    <span>{showScheduleBuilder ? 'إخفاء تفاصيل جدول الأقساط' : 'تحديد وتوزيع جدول الأقساط بالتفصيل'}</span>
                    <Calendar className="w-3.5 h-3.5 text-amber-700" />
                  </Button>

                  {showScheduleBuilder && remainingBalance > 0 && (
                    <div className="mt-2.5">
                      <InstallmentScheduleBuilder
                        remainingBalance={remainingBalance}
                        schedule={installmentSchedule}
                        onChange={setInstallmentSchedule}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="فترة وشروط الضمان"
                value={warrantyPeriod}
                onChange={e => setWarrantyPeriod(e.target.value)}
              />

              <Input
                label="ملاحظات الفاتورة "
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="الشاحن، كابل العرض، الحقيبة..."
              />
            </div>
          </Card>
        </div>

        {/* Right Column: Pricing & Confirmation Summary */}
        <div className="space-y-4">
          <Card className="bg-white border-slate-300 shadow-2xs sticky top-4">
            <CardHeader className="bg-slate-100 border-b border-slate-300 py-3.5 px-4">
              <CardTitle className="text-sm font-bold text-slate-900">ملخص التسعير والأرباح</CardTitle>
            </CardHeader>

            <CardContent className="p-4 space-y-4">
              {formError && (
                <Alert type="danger" title="خطأ" message={formError} />
              )}

              {/* Actual Selling Price Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  سعر البيع الفعلي   (EGP) <span className="text-rose-500">*</span>
                </label>
                <Input
                  type="number"
                  min="0"
                  step="50"
                  value={actualPrice}
                  onChange={e => {
                    const p = Number(e.target.value) || 0;
                    setActualPrice(p);
                    setDiscountAmount(Math.max(0, listPriceSnapshot - p));
                  }}
                  className="font-bold text-lg text-slate-900 font-mono"
                  required
                />
   
              </div>

              {/* Discount Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  قيمة الخصم إن وجد (EGP)
                </label>
                <Input
                  type="number"
                  min="0"
                  value={discountAmount}
                  onChange={e => {
                    const d = Number(e.target.value) || 0;
                    setDiscountAmount(d);
                    setActualPrice(Math.max(0, listPriceSnapshot - d));
                  }}
                  className="font-semibold font-mono"
                />
              </div>

              {/* Financial Snapshot Summary (Rule 8) */}
              <div className="p-4 bg-slate-50/90 rounded-xl space-y-2.5 text-sm border border-slate-300">
                <div className="flex justify-between">
                  <span className="text-slate-600 font-medium">سعر العرض الأصلي:</span>
                  <span className="font-bold text-slate-800 font-mono tabular-nums">{formatCurrency(listPriceSnapshot)}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-slate-600 font-medium">الخصم المطبق:</span>
                  <span className="font-bold text-rose-700 font-mono tabular-nums">
                    {discountAmount > 0 ? `-${formatCurrency(discountAmount)}` : '0.00 EGP'}
                  </span>
                </div>

                <div className="flex justify-between font-bold pt-2.5 border-t border-slate-300">
                  <span className="text-slate-900">سعر البيع الفعلي:</span>
                  <span className="text-slate-900 font-mono text-base tabular-nums">{formatCurrency(actualPrice)}</span>
                </div>

                {paymentType === 'DEFERRED' && (
                  <div className="p-2.5 bg-amber-50/90 border border-amber-200 rounded-lg space-y-1.5 text-xs">
                    <div className="flex justify-between font-bold text-amber-950">
                      <span>المدفوع مقدماً:</span>
                      <span className="font-mono tabular-nums">{formatCurrency(initialPayment)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-rose-800 border-t border-amber-200 pt-1">
                      <span>المتبقي الآجل المطلوب:</span>
                      <span className="font-mono tabular-nums">{formatCurrency(remainingBalance)}</span>
                    </div>
                  </div>
                )}

                <div className="flex justify-between text-slate-600 font-medium">
                  <span>تكلفة الجهاز :</span>
                  <span className="font-mono tabular-nums">{formatCurrency(costSnapshot)}</span>
                </div>

                <div className="flex justify-between font-bold text-sm pt-2.5 border-t border-slate-300">
                  <span className="text-slate-900">مجمل الربح :</span>
                  <span className={`font-mono text-base tabular-nums ${grossProfit >= 0 ? 'text-emerald-800' : 'text-rose-700'}`}>
                    {grossProfit >= 0 ? `+${formatCurrency(grossProfit)}` : formatCurrency(grossProfit)}
                  </span>
                </div>
              </div>

            </CardContent>

            <CardFooter className="bg-slate-50/90 p-4 border-t border-slate-300">
              <Button
                variant="primary"
                size="lg"
                onClick={handleConfirmSale}
                disabled={isSubmitting || !selectedDevice}
                className="w-full font-bold"
                leftIcon={isSubmitting ? <Spinner size="sm" /> : <CheckCircle className="w-5 h-5" />}
              >
                {isSubmitting
                  ? 'جاري تأكيد البيع...'
                  : paymentType === 'DEFERRED'
                    ? `تأكيد البيع الآجل (المحصل: ${formatCurrency(initialPayment)})`
                    : `تأكيد بيع الجهاز (${formatCurrency(actualPrice)})`}
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SUCCESS MODAL: Printable Invoice Preview */}
      {/* ========================================================================= */}
      <Modal
        isOpen={!!completedInvoice}
        onClose={handleStartNewSale}
        title={`تمت عملية البيع بنجاح - فاتورة رقم ${completedInvoice?.invoice_number}`}
        subtitle=""
        size="lg"
        footer={
          <div className="flex items-center justify-between w-full">
            <Button variant="outline" size="md" onClick={handleStartNewSale} className="border-slate-300 font-semibold">
              تسجيل عملية بيع أخرى
            </Button>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="md"
                onClick={async () => {
                  if (!completedInvoice) return;
                  await documentPrintService.exportToPdf('mss-sale-print-root', {
                    title: `فاتورة_Compu_MSS_${completedInvoice.invoice_number}`,
                    format: 'a4',
                  });
                }}
                leftIcon={<FileDown className="w-4.5 h-4.5 text-blue-600" />}
                className="font-bold border-slate-300 hover:bg-slate-50 text-slate-800"
              >
                حفظ كـ PDF
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={async () => {
                  if (!completedInvoice) return;
                  await documentPrintService.printElement('mss-sale-print-root', {
                    title: `فاتورة_Compu_MSS_${completedInvoice.invoice_number}`,
                    format: 'a4',
                  });
                }}
                leftIcon={<Printer className="w-4.5 h-4.5" />}
                className="font-bold shadow-xs"
              >
                طباعة الفاتورة A4
              </Button>
            </div>
          </div>
        }
      >
        {completedInvoice && (
          <div id="mss-sale-print-root" className="p-5 bg-white border border-slate-300 rounded-xl space-y-4 text-sm font-sans print:p-0 print:border-none">
            {/* Header */}
            <div className="text-center pb-3.5 border-b border-slate-300">
              <h3 className="text-lg font-bold text-slate-900">Compu MSS   </h3>
            </div>

            {/* Metadata Grid */}
            <div className="grid grid-cols-2 gap-3 p-4 bg-slate-50/90 rounded-xl border border-slate-300 text-sm">
              <div>
                <span className="text-slate-500 font-medium">رقم الفاتورة: </span>
                <strong className="font-mono text-slate-900 tabular-nums font-bold">{completedInvoice.invoice_number}</strong>
              </div>
              <div>
                <span className="text-slate-500 font-medium">تاريخ البيع: </span>
                <span className="font-mono font-semibold text-slate-800 tabular-nums">{formatDate(completedInvoice.sale_date)}</span>
              </div>
              <div>
                <span className="text-slate-500 font-medium">فرع البيع: </span>
                <strong className="text-slate-900 font-bold">{completedInvoice.selling_branch}</strong>
              </div>
              <div>
                <span className="text-slate-500 font-medium">فرع مصدر الجهاز: </span>
                <strong className="text-slate-900 font-bold">{completedInvoice.source_branch}</strong>
              </div>
              {completedInvoice.customer_name && (
                <div>
                  <span className="text-slate-500 font-medium">اسم العميل: </span>
                  <strong className="text-slate-900 font-bold">{completedInvoice.customer_name}</strong>
                </div>
              )}
              {completedInvoice.customer_phone && (
                <div>
                  <span className="text-slate-500 font-medium">رقم الهاتف: </span>
                  <span className="font-mono font-semibold text-slate-800 tabular-nums">{completedInvoice.customer_phone}</span>
                </div>
              )}
            </div>

            {/* Device Info */}
            <div className="p-3.5 border border-slate-300 rounded-xl space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 text-sm">
                  {completedInvoice.brand} {completedInvoice.model_name}
                </span>
                <span className="font-mono font-bold text-xs bg-slate-100 text-slate-900 px-2.5 py-1 rounded border border-slate-300 tabular-nums">
                  {completedInvoice.serial_number}
                </span>
              </div>
              <p className="text-slate-500 font-mono text-xs font-medium">
                {[completedInvoice.processor, completedInvoice.gpu, completedInvoice.ram, completedInvoice.storage, completedInvoice.screen_size]
                  .filter(Boolean)
                  .join(' • ')}
              </p>
            </div>

            {/* Financials Table */}
            <div className="border border-slate-300 rounded-xl overflow-hidden">
              <div className="flex justify-between p-3 bg-slate-100 font-bold text-slate-800 border-b border-slate-300 text-sm">
                <span>البيان</span>
                <span>المبلغ</span>
              </div>
              <div className="p-3.5 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600 font-medium">السعر  :</span>
                  <span className="font-mono font-semibold tabular-nums">{formatCurrency(completedInvoice.list_price_snapshot)}</span>
                </div>
                {completedInvoice.discount_amount > 0 && (
                  <div className="flex justify-between text-rose-700 font-medium">
                    <span>الخصم الممنوح:</span>
                    <span className="font-mono font-bold tabular-nums">-{formatCurrency(completedInvoice.discount_amount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-sm pt-2.5 border-t border-slate-300 text-slate-900">
                  <span>إجمالي المدفوع:</span>
                  <span className="font-mono font-bold text-base tabular-nums">{formatCurrency(completedInvoice.actual_sale_price)}</span>
                </div>
              </div>
            </div>

            {/* Warranty & Terms */}
            <div className="p-3.5 bg-slate-50/90 border border-slate-300 rounded-xl space-y-1.5 text-sm">
              <span className="font-bold text-slate-900 block">شروط الضمان:</span>
              <p className="text-slate-700 text-xs leading-relaxed">{completedInvoice.warranty_period}</p>
              {completedInvoice.notes && (
                <p className="text-slate-500 text-xs pt-1.5 border-t border-slate-200">ملاحظات: {completedInvoice.notes}</p>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
