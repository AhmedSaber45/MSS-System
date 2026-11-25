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
import { useMSSLocations } from '@/hooks/useMSSLocations';
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

  const { locations } = useMSSLocations();
  const [sellingBranch, setSellingBranch] = useState<MSSStockLocation>(() => locations[0] || '');

  useEffect(() => {
    if (locations.length > 0 && !locations.includes(sellingBranch)) {
      setSellingBranch(locations[0]);
    }
  }, [locations, sellingBranch]);
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
    } catch (err: any) {
      console.error('Failed to load available devices:', err);
    } finally {
      setIsLoadingDevices(false);
    }
  }, []);

  useEffect(() => {
    loadDevices();
  }, [loadDevices]);

  // Handle toggling device selection via checkboxes (Multi-Device Selection)
  const handleToggleDevice = (device: MSSDevice, isSelected: boolean) => {
    if (isSelected) {
      const isSerialized = Boolean(device.is_serialized && device.serial_number);
      const availableStock = device.quantity && device.quantity > 0 ? device.quantity : 1;

      // Prevent duplicate serialized device selection
      if (isSerialized && cartItems.some(it => it.device_id === device.id)) {
        return;
      }

      // If already in cart, do nothing
      if (cartItems.some(it => it.device_id === device.id)) {
        return;
      }

      const newItem: SaleCartItem = {
        id: `cart-item-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        device_id: device.id,
        device,
        is_serialized: isSerialized,
        serial_number: device.serial_number,
        model_name: device.model_name,
        brand: device.brand,
        category: device.category,
        processor: device.model?.processor,
        gpu: device.model?.gpu,
        ram: device.model?.ram,
        storage: device.model?.storage,
        screen_size: device.model?.screen_size,
        physical_condition: device.physical_condition,
        source_branch: device.stock_location,
        available_stock: availableStock,
        quantity: 1,
        unit_cost: device.purchase_cost,
        unit_list_price: device.list_price,
        unit_price: device.list_price,
        discount: 0,
        line_total: device.list_price,
      };

      setCartItems(prev => [...prev, newItem]);
      setItemError('');
    } else {
      setCartItems(prev => prev.filter(it => it.device_id !== device.id));
      setItemError('');
    }
  };

  // Handle bulk selection sync (e.g., Select Displayed / Deselect Displayed)
  const handleMultiSelectDevices = (nextSelectedIds: string[]) => {
    const nextSet = new Set(nextSelectedIds);
    const deviceMap = new Map(availableDevices.map(d => [d.id, d]));

    setCartItems(prev => {
      const kept = prev.filter(it => nextSet.has(it.device_id));
      const keptIds = new Set(kept.map(it => it.device_id));
      const added: SaleCartItem[] = [];

      for (const devId of nextSelectedIds) {
        if (keptIds.has(devId)) continue;
        const device = deviceMap.get(devId);
        if (!device || device.status !== 'AVAILABLE') continue;
        const availableStock = device.quantity && device.quantity > 0 ? device.quantity : 1;
        if (availableStock <= 0) continue;

        const isSerialized = Boolean(device.is_serialized && device.serial_number);
        added.push({
          id: `cart-item-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          device_id: device.id,
          device,
          is_serialized: isSerialized,
          serial_number: device.serial_number,
          model_name: device.model_name,
          brand: device.brand,
          category: device.category,
          processor: device.model?.processor,
          gpu: device.model?.gpu,
          ram: device.model?.ram,
          storage: device.model?.storage,
          screen_size: device.model?.screen_size,
          physical_condition: device.physical_condition,
          source_branch: device.stock_location,
          available_stock: availableStock,
          quantity: 1,
          unit_cost: device.purchase_cost,
          unit_list_price: device.list_price,
          unit_price: device.list_price,
          discount: 0,
          line_total: device.list_price,
        });
      }

      return [...kept, ...added];
    });
    setItemError('');
  };

  // Update quantity for bulk/non-serialized stock
  const handleUpdateItemQuantity = (deviceId: string, rawVal: string, maxAvailable: number) => {
    if (rawVal === '') {
      setItemError('يرجى إدخال كمية صحيحة');
      setCartItems(prev =>
        prev.map(it => (it.device_id === deviceId ? { ...it, quantity: ('' as any), line_total: 0 } : it))
      );
      return;
    }

    const val = Number(rawVal);
    if (isNaN(val) || val <= 0) {
      setItemError('الكمية يجب أن تكون عدداً صحيحاً موجباً أكبر من الصفر');
      setCartItems(prev =>
        prev.map(it => (it.device_id === deviceId ? { ...it, quantity: (val as any), line_total: 0 } : it))
      );
      return;
    }

    if (!Number.isInteger(val)) {
      setItemError('الكمية لا يمكن أن تحتوي على كسور عشرية');
      setCartItems(prev =>
        prev.map(it => (it.device_id === deviceId ? { ...it, quantity: (val as any), line_total: 0 } : it))
      );
      return;
    }

    if (val > maxAvailable) {
      setItemError(`الكمية المطلوبة (${val}) تتجاوز المخزون المتاح (${maxAvailable})`);
      setCartItems(prev =>
        prev.map(it => (it.device_id === deviceId ? { ...it, quantity: val, line_total: val * it.unit_price } : it))
      );
      return;
    }

    setItemError('');
    setCartItems(prev =>
      prev.map(it =>
        it.device_id === deviceId
          ? {
              ...it,
              quantity: val,
              line_total: val * it.unit_price,
            }
          : it
      )
    );
  };

  // Update unit price for a cart item
  const handleUpdateItemPrice = (deviceId: string, rawPrice: string | number) => {
    const p = Math.max(0, Number(rawPrice) || 0);
    setCartItems(prev =>
      prev.map(it => {
        if (it.device_id !== deviceId) return it;
        const discount = Math.max(0, it.unit_list_price - p);
        const qty = Number(it.quantity) || 1;
        return {
          ...it,
          unit_price: p,
          discount,
          line_total: qty * p,
        };
      })
    );
  };

  // Update discount for a cart item
  const handleUpdateItemDiscount = (deviceId: string, rawDiscount: string | number) => {
    const d = Math.max(0, Number(rawDiscount) || 0);
    setCartItems(prev =>
      prev.map(it => {
        if (it.device_id !== deviceId) return it;
        const price = Math.max(0, it.unit_list_price - d);
        const qty = Number(it.quantity) || 1;
        return {
          ...it,
          unit_price: price,
          discount: d,
          line_total: qty * price,
        };
      })
    );
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
        subtitle=""
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
            Refresh 
          </Button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left Columns (2 cols): Device Selection, Cart List, Customer Info */}
        <div className="lg:col-span-2 space-y-4">
          {/* Card 1: Select Devices & Quantities (Checkboxes & Multi-Select) */}
          <Card className="p-4 bg-white border-slate-300 shadow-2xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Laptop className="w-4.5 h-4.5 text-slate-600" />
                <span>1. اختيار الأجهزة وإضافتها إلى الفاتورة     </span>
              </span>
              <span className="text-xs font-semibold text-slate-500">
                المتاح: {availableDevices.length} جهاز/موديل
              </span>
            </h3>

            {/* Searchable multi-select with Checkboxes */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                اختر الأجهزة والموديلات المراد إدراجها في الفاتورة    :
              </label>
              <SearchableItemSelect<MSSDevice>
                items={availableDevices}
                isMulti={true}
                selectedIds={cartItems.map(i => i.device_id)}
                onMultiSelectChange={handleMultiSelectDevices}
                isItemDisabled={d => d.status !== 'AVAILABLE' || (d.quantity !== undefined && d.quantity <= 0)}
                getKey={d => d.id}
                getSearchableText={d =>
                  `${d.serial_number || ''} ${d.brand || ''} ${d.model_name || ''} ${d.model?.processor || ''} ${d.model?.gpu || ''} ${d.stock_location}`
                }
                placeholder="ابحث بالاسم، الموديل، الماركة، المعالج أو السيريال..."
                emptyMessage="لا توجد أجهزة متوفرة مطابقة للبحث"
                maxHeight="max-h-72"
                renderItem={(d, isSelected) => {
                  const isSerialized = Boolean(d.is_serialized && d.serial_number);
                  const maxStock = d.quantity && d.quantity > 0 ? d.quantity : 1;
                  const cartItem = cartItems.find(i => i.device_id === d.id);

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
                        <p className="text-[11px] text-slate-500 truncate mt-0.5 font-mono">
                          {[d.model?.processor, d.model?.gpu, d.model?.ram].filter(Boolean).join(' • ') ||
                            d.physical_condition}
                        </p>
                      </div>

                      {/* Right controls: Quantity input for bulk + Branch & Price */}
                      <div className="flex items-center gap-2.5 shrink-0">
                        {!isSerialized && isSelected && (
                          <div
                            className="flex items-center gap-1 bg-blue-50 px-2 py-1 rounded-lg border border-blue-200"
                            onClick={e => e.stopPropagation()}
                          >
                            <label className="text-[11px] font-bold text-blue-900 whitespace-nowrap ml-1">
                              الكمية:
                            </label>
                            <button
                              type="button"
                              aria-label="إنقاص الكمية"
                              onClick={() =>
                                handleUpdateItemQuantity(
                                  d.id,
                                  String(Math.max(1, (Number(cartItem?.quantity) || 1) - 1)),
                                  maxStock
                                )
                              }
                              disabled={(Number(cartItem?.quantity) || 1) <= 1}
                              className="w-7 h-7 rounded-md bg-white hover:bg-blue-100 border border-blue-300 text-blue-900 font-bold flex items-center justify-center cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed text-sm leading-none transition-colors"
                            >
                              −
                            </button>
                            <input
                              type="number"
                              min="1"
                              max={maxStock}
                              value={cartItem?.quantity ?? 1}
                              onChange={e => handleUpdateItemQuantity(d.id, e.target.value, maxStock)}
                              className="w-12 h-7 text-center font-mono font-bold text-xs bg-white rounded-md border border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              title={`أدخل كمية بين 1 و ${maxStock}`}
                            />
                            <button
                              type="button"
                              aria-label="زيادة الكمية"
                              onClick={() =>
                                handleUpdateItemQuantity(
                                  d.id,
                                  String(Math.min(maxStock, (Number(cartItem?.quantity) || 1) + 1)),
                                  maxStock
                                )
                              }
                              disabled={(Number(cartItem?.quantity) || 1) >= maxStock}
                              className="w-7 h-7 rounded-md bg-white hover:bg-blue-100 border border-blue-300 text-blue-900 font-bold flex items-center justify-center cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed text-sm leading-none transition-colors"
                            >
                              +
                            </button>
                            <span className="text-[10px] text-slate-500 whitespace-nowrap mr-0.5">
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
              <Alert type="danger" title="تنبيه بالكميات" message={itemError} className="py-2" />
            )}
          </Card>

          {/* Card 2: Items in Cart (Invoice Line Items Table) */}
          <Card className="p-4 bg-white border-slate-300 shadow-2xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Layers className="w-4.5 h-4.5 text-slate-600" />
                <span>
                  2. قائمة الأجهزة بالفاتورة  {totalUnits} جهاز
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
                <p className="text-sm font-semibold text-slate-700">لم يتم اختيار أي جهاز للفاتورة بعد</p>

              </div>
            ) : (
              <div className="space-y-3">
                <div className="overflow-x-auto rounded-xl border border-slate-300">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-100 text-slate-800 border-b border-slate-300 font-bold">
                      <tr>
                        <th className="p-2.5">#</th>
                        <th className="p-2.5">الجهاز والمواصفات</th>
                        <th className="p-2.5">السيريال / الحالة</th>
                        <th className="p-2.5">الفرع المصدر</th>
                        <th className="p-2.5 text-center">الكمية</th>
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
                                بدون سيريال (مخزون مجمع)
                              </Badge>
                            )}
                          </td>
                          <td className="p-2.5">
                            <Badge
                              variant="default"
                              size="sm"
                            >
                              {item.source_branch}
                            </Badge>
                          </td>
                          <td className="p-2.5 text-center">
                            {item.is_serialized ? (
                              <span className="font-mono text-xs font-bold bg-slate-100 text-slate-800 px-2 py-0.5 rounded border border-slate-200">
                                1 وحدة
                              </span>
                            ) : (
                              <div className="flex flex-col items-center gap-1">
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    aria-label="إنقاص الكمية"
                                    onClick={() =>
                                      handleUpdateItemQuantity(
                                        item.device_id,
                                        String(Math.max(1, (Number(item.quantity) || 1) - 1)),
                                        item.available_stock
                                      )
                                    }
                                    className="w-7 h-7 rounded-md bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 font-bold flex items-center justify-center cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed text-sm leading-none transition-colors"
                                    disabled={Number(item.quantity) <= 1}
                                  >
                                    −
                                  </button>
                                  <input
                                    type="number"
                                    min="1"
                                    max={item.available_stock}
                                    value={item.quantity}
                                    onChange={e =>
                                      handleUpdateItemQuantity(item.device_id, e.target.value, item.available_stock)
                                    }
                                    className="w-12 h-7 text-center font-mono font-bold text-xs rounded-md border border-slate-300 bg-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                  />
                                  <button
                                    type="button"
                                    aria-label="زيادة الكمية"
                                    onClick={() =>
                                      handleUpdateItemQuantity(
                                        item.device_id,
                                        String(Math.min(item.available_stock, (Number(item.quantity) || 1) + 1)),
                                        item.available_stock
                                      )
                                    }
                                    className="w-7 h-7 rounded-md bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 font-bold flex items-center justify-center cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed text-sm leading-none transition-colors"
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
                          <td className="p-2.5">
                            <input
                              type="number"
                              min="0"
                              step="50"
                              value={item.unit_price}
                              onChange={e => handleUpdateItemPrice(item.device_id, e.target.value)}
                              className="w-24 h-7 text-center font-mono font-bold text-xs rounded border border-slate-300 bg-white"
                            />
                          </td>
                          <td className="p-2.5">
                            <input
                              type="number"
                              min="0"
                              step="50"
                              value={item.discount}
                              onChange={e => handleUpdateItemDiscount(item.device_id, e.target.value)}
                              className="w-20 h-7 text-center font-mono text-rose-600 font-bold text-xs rounded border border-slate-300 bg-white"
                            />
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
                  options={locations.map(loc => ({
                    value: loc,
                    label: loc,
                  }))}
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
          size="2xl"
          footer={
            <div className="flex items-center justify-between w-full flex-wrap gap-2">
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
