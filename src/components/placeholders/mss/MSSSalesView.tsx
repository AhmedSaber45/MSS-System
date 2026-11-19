import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { Select } from '@/components/common/Select';
import { Badge } from '@/components/common/Badge';
import { Alert } from '@/components/common/Alert';
import { Modal } from '@/components/common/Modal';
import { Spinner } from '@/components/common/Spinner';
import {
  Laptop,
  Store,
  ArrowRightLeft,
  Search,
  ShieldCheck,
  RefreshCw,
  Banknote,
  Tag,
  Clock,
  Calendar,
  CheckCircle,
  Plus,
  Trash2,
  AlertCircle,
  Layers,
} from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useNotification } from '@/context/NotificationContext';
import { usePageRefresh } from '@/context/PageRefreshContext';
import { mssInventoryService } from '@/services/mssInventoryService';
import { mssCommerceService } from '@/services/mssCommerceService';
import { InstallmentScheduleBuilder, PlannedInstallmentItem } from '@/components/common/InstallmentScheduleBuilder';
import { SearchableItemSelect } from '@/components/common/SearchableItemSelect';
import { MSSPrintableInvoice } from '@/components/placeholders/mss/MSSPrintableInvoice';
import type { MSSDevice, MSSStockLocation } from '@/types/mssInventory';
import type { MSSInvoice, MSSPaymentType, NewMSSSaleItemInput } from '@/types/mssCommerce';

export interface SaleCartItem {
  id: string;
  device_id: string;
  device: MSSDevice;
  is_serialized: boolean;
  serial_number?: string | null;
  model_name: string;
  brand: string;
  category: string;
  processor?: string | null;
  gpu?: string | null;
  ram?: string | null;
  storage?: string | null;
  screen_size?: string | null;
  physical_condition?: string | null;
  source_branch: MSSStockLocation;
  available_stock: number;
  quantity: number;
  unit_cost: number;
  unit_list_price: number;
  unit_price: number;
  discount: number;
  line_total: number;
}

export const MSSSalesView: React.FC = () => {
  const { showNotification } = useNotification();
  const { isRefreshing, triggerRefresh } = usePageRefresh();

  const [availableDevices, setAvailableDevices] = useState<MSSDevice[]>([]);
  const [isLoadingDevices, setIsLoadingDevices] = useState<boolean>(true);

  // Cart State (Multi-Device Support)
  const [cartItems, setCartItems] = useState<SaleCartItem[]>([]);

  // Selection / Pending Item State
  const [selectedDevice, setSelectedDevice] = useState<MSSDevice | null>(null);
  const [pendingQuantity, setPendingQuantity] = useState<number>(1);
  const [pendingUnitPrice, setPendingUnitPrice] = useState<number>(0);
  const [pendingDiscount, setPendingDiscount] = useState<number>(0);
  const [itemError, setItemError] = useState<string>('');

  // Invoice & Customer Info
  const [sellingBranch, setSellingBranch] = useState<MSSStockLocation>('محل 1');
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

  // Success Modal with Multi-Format Printable Invoice
  const [completedInvoice, setCompletedInvoice] = useState<MSSInvoice | null>(null);
  const [invoicePrintFormat, setInvoicePrintFormat] = useState<'a4' | 'thermal'>('a4');

  // Load available devices
  const loadDevices = useCallback(async () => {
    setIsLoadingDevices(true);
    try {
      const devices = await mssInventoryService.getDevices({ status: 'AVAILABLE' });
      setAvailableDevices(devices);
      if (devices.length > 0 && !selectedDevice) {
        handlePickDevice(devices[0]);
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

  // Handle picking a device in the selector
  const handlePickDevice = (device: MSSDevice) => {
    setSelectedDevice(device);
    setPendingQuantity(1);
    setPendingUnitPrice(device.list_price);
    setPendingDiscount(0);
    setItemError('');
  };

  // Add selected device to cart
  const handleAddToCart = () => {
    if (!selectedDevice) {
      setItemError('يرجى اختيار جهاز أولاً لإضافته للفاتورة');
      return;
    }

    const isSerialized = Boolean(selectedDevice.is_serialized && selectedDevice.serial_number);
    const availableStock =
      selectedDevice.quantity && selectedDevice.quantity > 0 ? selectedDevice.quantity : 1;

    // 1. Prevent duplicate serialized device
    if (isSerialized) {
      const alreadyInCart = cartItems.some(item => item.device_id === selectedDevice.id);
      if (alreadyInCart) {
        setItemError(`الجهاز بالسيريال (${selectedDevice.serial_number}) مضاف بالفعل في الفاتورة.`);
        return;
      }
    }

    // 2. Validate quantity for non-serialized
    const qtyToAdd = isSerialized ? 1 : Math.max(1, Math.floor(pendingQuantity));
    const existingInCart = cartItems.find(item => item.device_id === selectedDevice.id);
    const currentQtyInCart = existingInCart ? existingInCart.quantity : 0;

    if (currentQtyInCart + qtyToAdd > availableStock) {
      setItemError(
        `الكمية المطلوبة (${currentQtyInCart + qtyToAdd}) تتجاوز المخزون المتاح (${availableStock}) لهذا الموديل.`
      );
      return;
    }

    if (pendingUnitPrice < 0) {
      setItemError('سعر بيع الوحدة لا يمكن أن يكون سالباً');
      return;
    }

    if (existingInCart && !isSerialized) {
      // Update quantity of existing bulk item
      setCartItems(prev =>
        prev.map(item =>
          item.device_id === selectedDevice.id
            ? {
                ...item,
                quantity: item.quantity + qtyToAdd,
                unit_price: pendingUnitPrice,
                discount: pendingDiscount,
                line_total: (item.quantity + qtyToAdd) * pendingUnitPrice,
              }
            : item
        )
      );
    } else {
      // Add as new cart item
      const newItem: SaleCartItem = {
        id: `cart-item-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        device_id: selectedDevice.id,
        device: selectedDevice,
        is_serialized: isSerialized,
        serial_number: selectedDevice.serial_number,
        model_name: selectedDevice.model_name,
        brand: selectedDevice.brand,
        category: selectedDevice.category,
        processor: selectedDevice.model?.processor,
        gpu: selectedDevice.model?.gpu,
        ram: selectedDevice.model?.ram,
        storage: selectedDevice.model?.storage,
        screen_size: selectedDevice.model?.screen_size,
        physical_condition: selectedDevice.physical_condition,
        source_branch: selectedDevice.stock_location,
        available_stock: availableStock,
        quantity: qtyToAdd,
        unit_cost: selectedDevice.purchase_cost,
        unit_list_price: selectedDevice.list_price,
        unit_price: pendingUnitPrice,
        discount: pendingDiscount,
        line_total: qtyToAdd * pendingUnitPrice,
      };

      setCartItems(prev => [...prev, newItem]);
    }

    // Reset pending error
    setItemError('');
    showNotification({
      type: 'success',
      title: 'تمت إضافة الجهاز للفاتورة',
      message: `${selectedDevice.brand} ${selectedDevice.model_name} ${
        selectedDevice.serial_number ? `(${selectedDevice.serial_number})` : `(كمية: ${qtyToAdd})`
      }`,
    });
  };

  // Remove an item from the cart
  const handleRemoveFromCart = (cartItemId: string) => {
    setCartItems(prev => prev.filter(item => item.id !== cartItemId));
  };

  // Clear all items from cart
  const handleClearCart = () => {
    setCartItems([]);
  };

  // Calculations for all items in the cart
  const {
    totalUnits,
    subtotalListPrice,
    totalDiscount,
    grandTotal,
    totalCost,
    grossProfit,
    hasCrossBranch,
  } = useMemo(() => {
    let units = 0;
    let subtotal = 0;
    let discount = 0;
    let total = 0;
    let cost = 0;
    let crossBranch = false;

    for (const item of cartItems) {
      units += item.quantity;
      subtotal += item.unit_list_price * item.quantity;
      discount += item.discount * item.quantity;
      total += item.line_total;
      cost += item.unit_cost * item.quantity;
      if (item.source_branch !== sellingBranch) {
        crossBranch = true;
      }
    }

    return {
      totalUnits: units,
      subtotalListPrice: subtotal,
      totalDiscount: discount,
      grandTotal: total,
      totalCost: cost,
      grossProfit: total - cost,
      hasCrossBranch: crossBranch,
    };
  }, [cartItems, sellingBranch]);

  const remainingBalance =
    paymentType === 'FULL' ? 0 : Math.max(0, grandTotal - initialPayment);

  // Submit sale with multi-device support
  const handleConfirmSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (cartItems.length === 0) {
      setFormError('يرجى إضافة جهاز واحد على الأقل إلى الفاتورة قبل التأكيد.');
      return;
    }

    if (grandTotal < 0) {
      setFormError('إجمالي سعر البيع الفعلي لا يمكن أن يكون سالباً.');
      return;
    }

    if (paymentType === 'DEFERRED') {
      if (initialPayment > grandTotal) {
        setFormError('الدفعة المقدمة لا يمكن أن تتجاوز إجمالي سعر بيع الفاتورة.');
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
      const itemsPayload: NewMSSSaleItemInput[] = cartItems.map(item => ({
        device_id: item.device_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        discount_amount: item.discount,
        actual_sale_price: item.line_total,
        source_branch: item.source_branch,
      }));

      const firstItem = cartItems[0];
      const invoice = await mssCommerceService.confirmSale({
        device_id: firstItem.device_id,
        selling_branch: sellingBranch,
        actual_sale_price: Number(grandTotal),
        discount_amount: Number(totalDiscount),
        customer_name: customerName.trim() || undefined,
        customer_phone: customerPhone.trim() || undefined,
        warranty_period: warrantyPeriod.trim() || undefined,
        notes: notes.trim() || undefined,
        payment_type: paymentType,
        initial_payment: paymentType === 'DEFERRED' ? initialPayment : Number(grandTotal),
        due_date: paymentType === 'DEFERRED' ? dueDate || undefined : undefined,
        installments:
          paymentType === 'DEFERRED' && installmentSchedule.length > 0
            ? installmentSchedule
            : undefined,
        items: itemsPayload,
      });

      showNotification({
        type: 'success',
        title: 'تم تأكيد البيع وإصدار الفاتورة',
        message: `تم تسجيل الفاتورة (${invoice.invoice_number}) بنجاح لصالح (${sellingBranch}) بعدد (${totalUnits}) أجهزة وإجمالي ${formatCurrency(invoice.actual_sale_price)}.`,
      });

      setCompletedInvoice(invoice);
      await loadDevices();
    } catch (err: any) {
      setFormError(err.message || 'فشلت عملية تأكيد البيع');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartNewSale = () => {
    setCompletedInvoice(null);
    setCartItems([]);
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
        title="بيع أجهزة Compu MSS"
        subtitle="إصدار فواتير بيع وضمان (تدعم بيع جهاز واحد أو أجهزة متعددة ومخزون مجمع في فاتورة واحدة)"
        actions={
          <Button
            variant="outline"
            size="md"
            onClick={() => triggerRefresh(loadDevices, 'جارٍ تحديث الأجهزة المتوفرة...')}
            disabled={isRefreshing || isLoadingDevices}
            leftIcon={
              <RefreshCw className={`w-4.5 h-4.5 text-slate-600 ${isRefreshing ? 'animate-spin' : ''}`} />
            }
            className="border-slate-300 font-semibold"
          >
            تحديث المخزون
          </Button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left Columns (2 cols): Device Selection, Cart List, Customer Info */}
        <div className="lg:col-span-2 space-y-4">
          {/* Card 1: Select & Add Device */}
          <Card className="p-4 bg-white border-slate-300 shadow-2xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Laptop className="w-4.5 h-4.5 text-slate-600" />
                <span>1. اختيار الأجهزة وإضافتها إلى الفاتورة</span>
              </span>
              <span className="text-xs font-semibold text-slate-500">
                الأجهزة المتاحة: {availableDevices.length} جهاز
              </span>
            </h3>

            {/* Searchable selector for available devices */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                اختر الجهاز أو الموديل المراد إضافته:
              </label>
              <SearchableItemSelect<MSSDevice>
                items={availableDevices}
                selectedId={selectedDevice?.id || null}
                onSelect={handlePickDevice}
                getKey={d => d.id}
                getSearchableText={d =>
                  `${d.serial_number || ''} ${d.brand || ''} ${d.model_name || ''} ${d.model?.processor || ''} ${d.model?.gpu || ''} ${d.stock_location}`
                }
                placeholder="ابحث بالاسم، الموديل، الماركة، المعالج أو السيريال..."
                emptyMessage="لا توجد أجهزة متوفرة مطابقة للبحث"
                maxHeight="max-h-56"
                renderItem={d => (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 truncate">
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
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">
                        {[d.model?.processor, d.model?.gpu, d.model?.ram].filter(Boolean).join(' • ') ||
                          d.physical_condition}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 text-left">
                      <Badge variant="default" size="sm">
                        {d.stock_location}
                      </Badge>
                      <strong className="text-slate-900 font-mono text-xs font-bold">
                        {formatCurrency(d.list_price)}
                      </strong>
                    </div>
                  </div>
                )}
              />
            </div>

            {/* Selected Device Preview & Config before Add */}
            {selectedDevice && (
              <div className="p-4 bg-slate-50/90 rounded-xl border border-slate-300 text-sm space-y-3">
                <div className="flex items-center justify-between pb-2.5 border-b border-slate-200">
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">
                      {selectedDevice.brand} {selectedDevice.model_name}
                    </h4>
                    <p className="text-slate-500 font-mono font-medium text-xs mt-0.5">
                      {[
                        selectedDevice.model?.processor,
                        selectedDevice.model?.gpu,
                        selectedDevice.model?.ram,
                        selectedDevice.model?.storage,
                      ]
                        .filter(Boolean)
                        .join(' • ')}
                    </p>
                  </div>
                  {selectedDevice.serial_number ? (
                    <span className="font-mono font-bold text-xs bg-slate-100 text-slate-900 px-2.5 py-1 rounded-md border border-slate-300 tabular-nums">
                      {selectedDevice.serial_number}
                    </span>
                  ) : (
                    <Badge variant="outline">
                      بدون سيريال (المتاح: {selectedDevice.quantity || 1} وحدة)
                    </Badge>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1 text-slate-700">
                  <div>
                    <span className="text-slate-500 block text-xs font-semibold mb-0.5">سعر العرض:</span>
                    <strong className="text-slate-900 text-sm font-mono font-bold tabular-nums">
                      {formatCurrency(selectedDevice.list_price)}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-xs font-semibold mb-0.5">التكلفة:</span>
                    <strong className="font-mono text-slate-700 text-sm font-semibold tabular-nums">
                      {formatCurrency(selectedDevice.purchase_cost)}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-xs font-semibold mb-0.5">الحالة:</span>
                    <strong className="text-slate-800 text-sm font-medium">
                      {selectedDevice.physical_condition || 'ممتازة'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-xs font-semibold mb-0.5">الموقع الفعلي:</span>
                    <Badge
                      variant={selectedDevice.stock_location === 'محل 1' ? 'primary' : 'default'}
                      size="sm"
                      className="font-semibold"
                    >
                      {selectedDevice.stock_location}
                    </Badge>
                  </div>
                </div>

                {/* Pricing and Quantity Inputs for adding item */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-200">
                  {!selectedDevice.is_serialized && (
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        الكمية المطلوبة (المتاح: {selectedDevice.quantity || 1})
                      </label>
                      <Input
                        type="number"
                        min="1"
                        max={selectedDevice.quantity || 1}
                        value={pendingQuantity}
                        onChange={e => {
                          const val = parseInt(e.target.value, 10) || 1;
                          setPendingQuantity(Math.max(1, Math.min(selectedDevice.quantity || 1, val)));
                        }}
                        className="h-9 font-mono font-bold"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      سعر بيع الوحدة (EGP)
                    </label>
                    <Input
                      type="number"
                      min="0"
                      step="50"
                      value={pendingUnitPrice}
                      onChange={e => {
                        const val = parseFloat(e.target.value) || 0;
                        setPendingUnitPrice(val);
                        setPendingDiscount(Math.max(0, selectedDevice.list_price - val));
                      }}
                      className="h-9 font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      خصم الوحدة (EGP)
                    </label>
                    <Input
                      type="number"
                      min="0"
                      step="50"
                      value={pendingDiscount}
                      onChange={e => {
                        const d = parseFloat(e.target.value) || 0;
                        setPendingDiscount(d);
                        setPendingUnitPrice(Math.max(0, selectedDevice.list_price - d));
                      }}
                      className="h-9 font-mono font-semibold"
                    />
                  </div>
                </div>

                {itemError && (
                  <Alert type="danger" title="تنبيه" message={itemError} className="py-2" />
                )}

                <div className="flex justify-end pt-2">
                  <Button
                    type="button"
                    variant="primary"
                    size="md"
                    onClick={handleAddToCart}
                    leftIcon={<Plus className="w-4 h-4" />}
                    className="font-bold shadow-xs"
                  >
                    إضافة الجهاز إلى الفاتورة
                  </Button>
                </div>
              </div>
            )}
          </Card>

          {/* Card 2: Items in Cart */}
          <Card className="p-4 bg-white border-slate-300 shadow-2xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Layers className="w-4.5 h-4.5 text-slate-600" />
                <span>
                  2. قائمة الأجهزة بالفاتورة ({cartItems.length} بند / {totalUnits} جهاز)
                </span>
              </h3>
              {cartItems.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleClearCart}
                  leftIcon={<Trash2 className="w-3.5 h-3.5 text-rose-600" />}
                  className="text-xs text-rose-700 border-rose-200 hover:bg-rose-50"
                >
                  تفريغ الفاتورة
                </Button>
              )}
            </div>

            {cartItems.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-300 space-y-2">
                <Laptop className="w-10 h-10 text-slate-400 mx-auto" />
                <p className="text-sm font-semibold text-slate-700">لم يتم إضافة أجهزة للفاتورة بعد</p>
                <p className="text-xs text-slate-500">
                  اختر جهازاً من القائمة أعلاه واضغط (إضافة الجهاز إلى الفاتورة) لدعم البيع الفردي أو المتعدد.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="overflow-x-auto rounded-xl border border-slate-300">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-100 text-slate-800 border-b border-slate-300 font-bold">
                      <tr>
                        <th className="p-2.5">#</th>
                        <th className="p-2.5">الجهاز والمواصفات</th>
                        <th className="p-2.5">السيريال / الكمية</th>
                        <th className="p-2.5">الفرع المصدر</th>
                        <th className="p-2.5">سعر الوحدة</th>
                        <th className="p-2.5">الخصم</th>
                        <th className="p-2.5">الإجمالي</th>
                        <th className="p-2.5 text-center">إجراء</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {cartItems.map((item, idx) => (
                        <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-2.5 font-mono text-slate-500">{idx + 1}</td>
                          <td className="p-2.5">
                            <span className="font-bold text-slate-900 block">
                              {item.brand} {item.model_name}
                            </span>
                            <span className="text-[11px] text-slate-500 block truncate max-w-xs font-mono">
                              {[item.processor, item.gpu, item.ram, item.storage]
                                .filter(Boolean)
                                .join(' • ') || item.physical_condition}
                            </span>
                          </td>
                          <td className="p-2.5">
                            {item.serial_number ? (
                              <span className="font-mono text-[11px] font-bold bg-slate-100 text-slate-900 px-2 py-0.5 rounded border border-slate-300 tabular-nums">
                                {item.serial_number}
                              </span>
                            ) : (
                              <Badge variant="outline" size="sm">
                                بدون سيريال ({item.quantity} وحدات)
                              </Badge>
                            )}
                          </td>
                          <td className="p-2.5">
                            <Badge
                              variant={item.source_branch === 'محل 1' ? 'primary' : 'default'}
                              size="sm"
                            >
                              {item.source_branch}
                            </Badge>
                          </td>
                          <td className="p-2.5 font-mono font-bold tabular-nums text-slate-900">
                            {formatCurrency(item.unit_price)}
                          </td>
                          <td className="p-2.5 font-mono text-rose-700 tabular-nums">
                            {item.discount > 0 ? `-${formatCurrency(item.discount)}` : '—'}
                          </td>
                          <td className="p-2.5 font-mono font-bold text-slate-900 tabular-nums text-sm">
                            {formatCurrency(item.line_total)}
                          </td>
                          <td className="p-2.5 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveFromCart(item.id)}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 transition-colors cursor-pointer"
                              title="إزالة من الفاتورة"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Subtotals bar */}
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                  <span className="text-slate-600 font-semibold">
                    المجموع الفرعي ({totalUnits} أجهزة):
                  </span>
                  <div className="flex items-center gap-4">
                    {totalDiscount > 0 && (
                      <span className="text-rose-700 font-bold font-mono">
                        إجمالي الخصم: -{formatCurrency(totalDiscount)}
                      </span>
                    )}
                    <span className="text-slate-900 font-bold font-mono text-sm">
                      الصافي: {formatCurrency(grandTotal)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </Card>

          {/* Card 3: Branch Attribution & Customer Details */}
          <Card className="p-4 bg-white border-slate-300 shadow-2xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Store className="w-4.5 h-4.5 text-slate-600" />
              <span>3. تحديد فرع البيع وبيانات العميل والضمان</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  فرع البيع (الفرع الذي يسجل الفاتورة) <span className="text-rose-500">*</span>
                </label>
                <Select
                  value={sellingBranch}
                  onChange={e => setSellingBranch(e.target.value as MSSStockLocation)}
                  options={[
                    { value: 'محل 1', label: 'محل 1 (الفرع الأول)' },
                    { value: 'محل 2', label: 'محل 2 (الفرع الثاني)' },
                  ]}
                />
                <p className="text-xs text-slate-500 mt-1">تُنسب الفاتورة والأرباح لهذا الفرع</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  فروع المخزون للأجهزة
                </label>
                <div className="w-full h-10 px-3 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-800 font-semibold flex items-center justify-between">
                  <span>
                    {cartItems.length > 0
                      ? Array.from(new Set(cartItems.map(i => i.source_branch))).join(' و ')
                      : sellingBranch}
                  </span>
                  <Badge variant="default" size="sm">
                    {cartItems.length} أجهزة محددة
                  </Badge>
                </div>
                <p className="text-xs text-slate-500 mt-1">يُخصم كل جهاز تلقائياً من فرع مخزنه الأصلي</p>
              </div>
            </div>

            {/* Cross-Branch Alert */}
            {hasCrossBranch && (
              <div className="p-3.5 bg-slate-50/90 rounded-xl border border-slate-300 text-xs text-slate-700 flex items-center gap-2.5">
                <ArrowRightLeft className="w-4.5 h-4.5 text-slate-600 shrink-0" />
                <span>
                  <strong className="text-slate-900 font-bold">تنبيه عملية بيع مشتركة بين الفروع:</strong>{' '}
                  تحتوي الفاتورة على أجهزة مسحوبة من مخزن فرع آخر غير فرع البيع المختار ({sellingBranch}). يتم
                  تسجيل حركة السحب والأرباح بدقة طبقاً لقواعد النظام.
                </span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-200">
              <Input
                label={paymentType === 'DEFERRED' ? 'اسم العميل (مطلوب للآجل) *' : 'اسم العميل (اختياري)'}
                placeholder="مثال: م. أحمد..."
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
              <label className="text-xs font-bold text-slate-700 block mb-1.5">
                نوع البيع وطريقة التحصيل:
              </label>
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
                    if (initialPayment === 0 && grandTotal > 0) {
                      setInitialPayment(Math.round(grandTotal / 2));
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
                    المتبقي:{' '}
                    <strong className="text-rose-700 font-mono text-sm">
                      {formatCurrency(remainingBalance)}
                    </strong>
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
                          onClick={() => setInitialPayment(Math.round(grandTotal / 2))}
                          className="text-[10px] bg-white border border-slate-300 px-1.5 py-0.5 rounded text-slate-700 hover:bg-slate-100 font-bold"
                        >
                          50%
                        </button>
                      </div>
                    </div>
                    <Input
                      type="number"
                      min="0"
                      max={grandTotal}
                      value={initialPayment || ''}
                      placeholder="0"
                      onChange={e => {
                        const val = parseFloat(e.target.value) || 0;
                        setInitialPayment(Math.max(0, Math.min(grandTotal, val)));
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
                    <span>
                      {showScheduleBuilder
                        ? 'إخفاء تفاصيل جدول الأقساط'
                        : 'تحديد وتوزيع جدول الأقساط بالتفصيل'}
                    </span>
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
                label="ملاحظات الفاتورة"
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
              <CardTitle className="text-sm font-bold text-slate-900">
                ملخص التسعير والأرباح للفاتورة
              </CardTitle>
            </CardHeader>

            <CardContent className="p-4 space-y-4">
              {formError && <Alert type="danger" title="خطأ" message={formError} />}

              {/* Items summary counter */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                <span className="text-slate-600 font-semibold">عدد البنود في الفاتورة:</span>
                <Badge variant="primary" size="md">
                  {cartItems.length} بند ({totalUnits} جهاز)
                </Badge>
              </div>

              {/* Financial Snapshot Summary */}
              <div className="p-4 bg-slate-50/90 rounded-xl space-y-2.5 text-sm border border-slate-300">
                <div className="flex justify-between">
                  <span className="text-slate-600 font-medium">المجموع الفرعي (قبل الخصم):</span>
                  <span className="font-bold text-slate-800 font-mono tabular-nums">
                    {formatCurrency(subtotalListPrice)}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-slate-600 font-medium">إجمالي الخصم المطبق:</span>
                  <span className="font-bold text-rose-700 font-mono tabular-nums">
                    {totalDiscount > 0 ? `-${formatCurrency(totalDiscount)}` : '0.00 EGP'}
                  </span>
                </div>

                <div className="flex justify-between font-bold pt-2.5 border-t border-slate-300">
                  <span className="text-slate-900">إجمالي الفاتورة المطلوب:</span>
                  <span className="text-slate-900 font-mono text-base tabular-nums">
                    {formatCurrency(grandTotal)}
                  </span>
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
                  <span>إجمالي تكلفة الأجهزة:</span>
                  <span className="font-mono tabular-nums">{formatCurrency(totalCost)}</span>
                </div>

                <div className="flex justify-between font-bold text-sm pt-2.5 border-t border-slate-300">
                  <span className="text-slate-900">مجمل ربح الفاتورة:</span>
                  <span
                    className={`font-mono text-base tabular-nums ${
                      grossProfit >= 0 ? 'text-emerald-800' : 'text-rose-700'
                    }`}
                  >
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
                disabled={isSubmitting || cartItems.length === 0}
                className="w-full font-bold"
                leftIcon={isSubmitting ? <Spinner size="sm" /> : <CheckCircle className="w-5 h-5" />}
              >
                {isSubmitting
                  ? 'جاري تأكيد الفاتورة...'
                  : paymentType === 'DEFERRED'
                  ? `تأكيد البيع الآجل (${formatCurrency(initialPayment)} مقدم)`
                  : `تأكيد الفاتورة (${formatCurrency(grandTotal)})`}
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SUCCESS MODAL: Multi-Format Printable Invoice Preview */}
      {/* ========================================================================= */}
      {completedInvoice && (
        <Modal
          isOpen={!!completedInvoice}
          onClose={handleStartNewSale}
          title={`تمت عملية البيع بنجاح - فاتورة رقم ${completedInvoice.invoice_number}`}
          subtitle={`تحتوي الفاتورة على (${completedInvoice.items_count || completedInvoice.items?.length || 1}) جهاز/بند`}
          size="lg"
          footer={
            <div className="flex items-center justify-between w-full">
              <Button
                variant="outline"
                size="md"
                onClick={handleStartNewSale}
                className="border-slate-300 font-semibold"
              >
                تسجيل عملية بيع أخرى
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={handleStartNewSale}
                className="font-bold shadow-xs"
              >
                تم والعودة
              </Button>
            </div>
          }
        >
          <MSSPrintableInvoice
            invoice={completedInvoice}
            items={completedInvoice.items}
            format={invoicePrintFormat}
            onFormatChange={setInvoicePrintFormat}
            onClose={handleStartNewSale}
          />
        </Modal>
      )}
    </div>
  );
};
