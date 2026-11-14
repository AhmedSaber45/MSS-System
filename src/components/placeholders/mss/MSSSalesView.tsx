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
import { CheckCircle, Laptop, Store, ArrowRightLeft, Search, Eye, Printer, ShieldCheck } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useNotification } from '@/context/NotificationContext';
import { mssInventoryService } from '@/services/mssInventoryService';
import { mssCommerceService } from '@/services/mssCommerceService';
import type { MSSDevice, MSSStockLocation } from '@/types/mssInventory';
import type { MSSInvoice } from '@/types/mssCommerce';

export const MSSSalesView: React.FC = () => {
  const { showNotification } = useNotification();

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
    loadDevices();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="نقطة بيع أجهزة MSS (Device Sales POS)"
        subtitle="توثيق بيع الأجهزة بالسيريال الفردي مع تثبيت فرع البيع ومصدر المخزون وحساب الربح الفعلي الدقيق"
      />

      {/* Attribution & Stock Source Alert (Rule 9 & 16) */}
      <Alert
        type="info"
        title="قاعدة إسناد البيع ومصدر المخزون (Attribution & Stock Source — Rule 9 & 16)"
        message="يمكن لمحل 1 بيع جهاز متواجد فعلياً في مخزن محل 2 مباشرة دون الحاجة لنقل مادي مسبق. يسجل البيع لصالح فرع البيع، ويخصم الجهاز تلقائياً من مخزون المحل المتواجد به."
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Device selection & Branches */}
        <div className="lg:col-span-2 space-y-4">
          {/* Card 1: Select Device */}
          <Card className="p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Laptop className="w-4 h-4 text-teal-600" />
              1. اختيار الجهاز بالسيريال نمبر الفريد
            </h3>

            <div className="flex gap-2">
              <div className="flex-1">
                <Input
                  placeholder="امسح بالباركود أو اكتب السيريال نمبر..."
                  value={searchSerialQuery}
                  onChange={e => handleSearchSerial(e.target.value)}
                  scannerReady
                  leftIcon={<Search className="w-4 h-4" />}
                />
              </div>
            </div>

            {/* Quick dropdown for available devices */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                أو اختر من قائمة الأجهزة المتاحة حالياً ({availableDevices.length} جهاز):
              </label>
              <Select
                value={selectedDevice?.id || ''}
                onChange={e => {
                  const dev = availableDevices.find(d => d.id === e.target.value);
                  if (dev) handleSelectDevice(dev);
                }}
                disabled={isLoadingDevices || availableDevices.length === 0}
              >
                {availableDevices.length === 0 ? (
                  <option value="">لا توجد أجهزة متوفرة للبيع حالياً</option>
                ) : (
                  availableDevices.map(d => (
                    <option key={d.id} value={d.id}>
                      [{d.serial_number}] - {d.brand} {d.model_name} (موقع التخزين: {d.stock_location}) -{' '}
                      {formatCurrency(d.list_price)}
                    </option>
                  ))
                )}
              </Select>
            </div>

            {/* Selected Device Preview Card */}
            {selectedDevice && (
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2.5">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">
                      {selectedDevice.brand} {selectedDevice.model_name}
                    </h4>
                    <p className="text-slate-500 font-mono">
                      {[selectedDevice.model?.processor, selectedDevice.model?.ram, selectedDevice.model?.storage]
                        .filter(Boolean)
                        .join(' • ')}
                    </p>
                  </div>
                  <span className="font-mono font-bold text-xs bg-slate-900 text-teal-300 px-2.5 py-1 rounded">
                    {selectedDevice.serial_number}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-slate-600">
                  <div>
                    <span className="text-slate-400 block">سعر العرض:</span>
                    <strong className="text-slate-800 text-sm">{formatCurrency(selectedDevice.list_price)}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block">التكلفة المسجلة:</span>
                    <strong className="font-mono text-slate-700">{formatCurrency(selectedDevice.purchase_cost)}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block">الحالة الظاهرية:</span>
                    <strong className="text-slate-700">{selectedDevice.physical_condition}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block">موقع التخزين الحالي:</span>
                    <Badge variant={selectedDevice.stock_location === 'محل 1' ? 'primary' : 'purple'}>
                      {selectedDevice.stock_location}
                    </Badge>
                  </div>
                </div>
              </div>
            )}
          </Card>

          {/* Card 2: Branch Attribution */}
          <Card className="p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Store className="w-4 h-4 text-teal-600" />
              2. تحديد فروع العملية (البيع والمخزون)
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  فرع البيع (المحل القائم بالبيع للعميل) *
                </label>
                <Select
                  value={sellingBranch}
                  onChange={e => setSellingBranch(e.target.value as MSSStockLocation)}
                >
                  <option value="محل 1">محل 1 (الفرع الأول)</option>
                  <option value="محل 2">محل 2 (الفرع الثاني)</option>
                </Select>
                <p className="text-[11px] text-slate-400 mt-1">تُنسب الفاتورة والأداء التشغيلي لهذا الفرع</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  فرع مصدر المخزون (الموقع الفعلي للتخزين)
                </label>
                <div className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-300 rounded-lg text-sm text-slate-700 font-semibold flex items-center justify-between">
                  <span>{sourceBranch}</span>
                  <Badge variant={sourceBranch === 'محل 1' ? 'primary' : 'purple'}>
                    موقع الجهاز الفعلي
                  </Badge>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">يُخصم الجهاز مباشرة من مخزون هذا المحل</p>
              </div>
            </div>

            {/* Cross-Branch Alert */}
            {isCrossBranch && (
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 flex items-center gap-2.5">
                <ArrowRightLeft className="w-5 h-5 text-amber-600 shrink-0" />
                <span>
                  <strong>تنبيه عملية بيع مشتركة بين الفروع:</strong> الجهاز مسحوب ومخصوم من مخزون{' '}
                  <strong>({sourceBranch})</strong> وبيعه منسوب تشغيلياً إلى <strong>({sellingBranch})</strong>.
                </span>
              </div>
            )}
          </Card>

          {/* Card 3: Customer & Warranty Details */}
          <Card className="p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-teal-600" />
              3. بيانات العميل والضمان
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="اسم العميل (اختياري)"
                placeholder="مثال: م. أحمد كمال..."
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
              />

              <Input
                label="رقم هاتف العميل (اختياري)"
                placeholder="مثال: 01012345678..."
                value={customerPhone}
                onChange={e => setCustomerPhone(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="فترة وشروط الضمان"
                value={warrantyPeriod}
                onChange={e => setWarrantyPeriod(e.target.value)}
              />

              <Input
                label="ملاحظات الفاتورة والملحقات"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="الشاحن، كابل العرض، الحقيبة..."
              />
            </div>
          </Card>
        </div>

        {/* Right Column: Pricing & Confirmation Summary */}
        <div className="space-y-4">
          <Card className="border-teal-200 shadow-lg sticky top-4">
            <CardHeader className="bg-teal-50/70 border-b border-teal-100">
              <CardTitle className="text-sm text-teal-950">ملخص التسعير والأرباح</CardTitle>
            </CardHeader>

            <CardContent className="p-5 space-y-4">
              {formError && (
                <Alert type="danger" title="خطأ" message={formError} />
              )}

              {/* Actual Selling Price Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  سعر البيع الفعلي المتفق عليه (ج.م) *
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
                  className="font-bold text-lg text-teal-900"
                  required
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  يمكن التفاوض وتعديل السعر الفعلي لكل عملية
                </p>
              </div>

              {/* Discount Input */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  قيمة الخصم إن وجد (ج.م)
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
                />
              </div>

              {/* Financial Snapshot Summary (Rule 8) */}
              <div className="p-4 bg-slate-50 rounded-xl space-y-2.5 text-xs border border-slate-200">
                <div className="flex justify-between">
                  <span className="text-slate-500">سعر العرض الأصلي:</span>
                  <span className="font-bold text-slate-700">{formatCurrency(listPriceSnapshot)}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-slate-500">الخصم المطبق:</span>
                  <span className="font-semibold text-rose-600">
                    {discountAmount > 0 ? `-${formatCurrency(discountAmount)}` : '0.00 ج.م'}
                  </span>
                </div>

                <div className="flex justify-between font-bold pt-2 border-t border-slate-200">
                  <span className="text-slate-800">سعر البيع الفعلي:</span>
                  <span className="text-teal-900 text-sm">{formatCurrency(actualPrice)}</span>
                </div>

                <div className="flex justify-between text-slate-500">
                  <span>تكلفة الجهاز المحفوظة:</span>
                  <span className="font-mono">{formatCurrency(costSnapshot)}</span>
                </div>

                <div className="flex justify-between font-bold text-sm pt-2 border-t border-slate-200">
                  <span className="text-slate-800">مجمل الربح الفعلي:</span>
                  <span className={grossProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
                    {grossProfit >= 0 ? `+${formatCurrency(grossProfit)}` : formatCurrency(grossProfit)}
                  </span>
                </div>
              </div>

              <p className="text-[11px] text-slate-400 leading-relaxed">
                * ملاحظة: يتم حفظ لقطات الأسعار والتكلفة بشكل دائم، ولا تتأثر الفاتورة مستقبلاً بأي تعديل في أسعار الكتالوج.
              </p>
            </CardContent>

            <CardFooter className="bg-slate-50 p-4 border-t border-slate-100">
              <Button
                variant="primary"
                size="lg"
                onClick={handleConfirmSale}
                disabled={isSubmitting || !selectedDevice}
                className="w-full bg-teal-700 hover:bg-teal-800 font-bold text-sm shadow-md"
                leftIcon={isSubmitting ? <Spinner size="sm" /> : <CheckCircle className="w-5 h-5" />}
              >
                {isSubmitting ? 'جاري تأكيد البيع...' : `تأكيد بيع الجهاز (${formatCurrency(actualPrice)})`}
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
        subtitle="فاتورة بيع جهاز MSS رسمية مع السيريال والضمان ولقطات الأسعار"
        size="lg"
        footer={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleStartNewSale}>
              تسجيل عملية بيع أخرى
            </Button>
            <Button
              variant="primary"
              size="sm"
              className="bg-teal-700 hover:bg-teal-800"
              onClick={() => window.print()}
              leftIcon={<Printer className="w-4 h-4" />}
            >
              طباعة الفاتورة A4
            </Button>
          </div>
        }
      >
        {completedInvoice && (
          <div className="p-6 bg-white border border-slate-200 rounded-2xl space-y-4 text-xs font-sans print:p-0 print:border-none">
            {/* Header */}
            <div className="text-center pb-4 border-b border-slate-200">
              <h3 className="text-lg font-black text-teal-900 tracking-wide">MSS للحلول التقنية واللابتوب</h3>
              <p className="text-slate-500 mt-0.5">فاتورة بيع وضمان أجهزة رسمية</p>
            </div>

            {/* Metadata Grid */}
            <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
              <div>
                <span className="text-slate-500">رقم الفاتورة: </span>
                <strong className="font-mono text-teal-800 font-bold">{completedInvoice.invoice_number}</strong>
              </div>
              <div>
                <span className="text-slate-500">تاريخ البيع: </span>
                <span className="font-mono">{formatDate(completedInvoice.sale_date)}</span>
              </div>
              <div>
                <span className="text-slate-500">فرع البيع: </span>
                <strong>{completedInvoice.selling_branch}</strong>
              </div>
              <div>
                <span className="text-slate-500">فرع مصدر الجهاز: </span>
                <strong>{completedInvoice.source_branch}</strong>
              </div>
              {completedInvoice.customer_name && (
                <div>
                  <span className="text-slate-500">اسم العميل: </span>
                  <strong>{completedInvoice.customer_name}</strong>
                </div>
              )}
              {completedInvoice.customer_phone && (
                <div>
                  <span className="text-slate-500">رقم الهاتف: </span>
                  <span className="font-mono">{completedInvoice.customer_phone}</span>
                </div>
              )}
            </div>

            {/* Device Info */}
            <div className="p-3 border border-slate-200 rounded-xl space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 text-sm">
                  {completedInvoice.brand} {completedInvoice.model_name}
                </span>
                <span className="font-mono font-bold text-xs bg-slate-900 text-teal-300 px-2.5 py-1 rounded">
                  {completedInvoice.serial_number}
                </span>
              </div>
              <p className="text-slate-500 font-mono text-[11px]">
                {[completedInvoice.processor, completedInvoice.ram, completedInvoice.storage, completedInvoice.screen_size]
                  .filter(Boolean)
                  .join(' • ')}
              </p>
            </div>

            {/* Financials Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="flex justify-between p-2.5 bg-slate-100 font-bold text-slate-700">
                <span>البيان</span>
                <span>المبلغ</span>
              </div>
              <div className="p-3 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-600">سعر العرض الأصلي:</span>
                  <span>{formatCurrency(completedInvoice.list_price_snapshot)}</span>
                </div>
                {completedInvoice.discount_amount > 0 && (
                  <div className="flex justify-between text-rose-600">
                    <span>الخصم الممنوح:</span>
                    <span>-{formatCurrency(completedInvoice.discount_amount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-sm pt-2 border-t border-slate-200 text-teal-900">
                  <span>إجمالي المدفوع:</span>
                  <span>{formatCurrency(completedInvoice.actual_sale_price)}</span>
                </div>
              </div>
            </div>

            {/* Warranty & Terms */}
            <div className="p-3 bg-teal-50/60 border border-teal-100 rounded-xl space-y-1">
              <span className="font-bold text-teal-900 block">شروط الضمان:</span>
              <p className="text-slate-700 text-[11px]">{completedInvoice.warranty_period}</p>
              {completedInvoice.notes && (
                <p className="text-slate-500 text-[11px] pt-1">ملاحظات: {completedInvoice.notes}</p>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
