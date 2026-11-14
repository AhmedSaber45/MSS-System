import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { Select } from '@/components/common/Select';
import { Table, Column } from '@/components/common/Table';
import { Badge } from '@/components/common/Badge';
import { Card, StatsCard } from '@/components/common/Card';
import { Modal } from '@/components/common/Modal';
import {
  Plus,
  Search,
  ShoppingCart,
  Calendar,
  User,
  Phone,
  FileText,
  DollarSign,
  Package,
  Trash2,
  Eye,
  CheckCircle2,
  RefreshCw,
  Boxes,
} from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
import { purchasesService } from '@/services/purchasesService';
import { productsService } from '@/services/productsService';
import { Purchase, PurchaseItem, NewPurchaseInput, NewPurchaseItemInput } from '@/types/purchase';
import { Product } from '@/types/product';
import { useNotification } from '@/context/NotificationContext';

interface CartItemRow {
  product_id: string;
  product_name: string;
  product_code: string;
  quantity: number;
  unit_cost: number;
  update_product_cost: boolean;
}

export const PurchasesView: React.FC = () => {
  const { showNotification } = useNotification();

  // Data states
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState<boolean>(false);
  const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(null);
  const [selectedPurchaseItems, setSelectedPurchaseItems] = useState<PurchaseItem[]>([]);
  const [isLoadingDetails, setIsLoadingDetails] = useState<boolean>(false);

  // New Purchase Form State
  const [purchaseNumber, setPurchaseNumber] = useState<string>('');
  const [purchaseDate, setPurchaseDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [supplierName, setSupplierName] = useState<string>('');
  const [supplierPhone, setSupplierPhone] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [cartItems, setCartItems] = useState<CartItemRow[]>([]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Add Item to cart fields
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [itemQty, setItemQty] = useState<string>('1');
  const [itemCost, setItemCost] = useState<string>('');
  const [itemUpdateCost, setItemUpdateCost] = useState<boolean>(true);

  // Load purchases & products list
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [fetchedPurchases, fetchedProducts] = await Promise.all([
        purchasesService.getPurchases(),
        productsService.getProducts(),
      ]);
      setPurchases(fetchedPurchases);
      setProducts(fetchedProducts);
    } catch (err: any) {
      showNotification({
        type: 'error',
        title: 'خطأ في جلب البيانات',
        message: err?.message || 'تعذر تحميل فواتير المشتريات',
      });
    } finally {
      setIsLoading(false);
    }
  }, [showNotification]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Open Add Purchase Modal
  const handleOpenAddModal = async () => {
    try {
      const nextNum = await purchasesService.generateNextPurchaseNumber();
      setPurchaseNumber(nextNum);
      setPurchaseDate(new Date().toISOString().split('T')[0]);
      setSupplierName('');
      setSupplierPhone('');
      setNotes('');
      setCartItems([]);
      setSelectedProductId('');
      setItemQty('1');
      setItemCost('');
      setItemUpdateCost(true);
      setIsAddModalOpen(true);
    } catch (err: any) {
      showNotification({
        type: 'error',
        title: 'خطأ',
        message: err?.message || 'تعذر تهيئة الفاتورة الجديدة',
      });
    }
  };

  // Open Details Modal
  const handleOpenDetails = async (purchase: Purchase) => {
    setSelectedPurchase(purchase);
    setIsDetailsModalOpen(true);
    setIsLoadingDetails(true);
    try {
      const items = await purchasesService.getPurchaseItems(purchase.id);
      setSelectedPurchaseItems(items);
    } catch (err: any) {
      showNotification({
        type: 'error',
        title: 'خطأ في جلب تفاصيل الفاتورة',
        message: err?.message || 'تعذر تحميل أصناف الفاتورة',
      });
    } finally {
      setIsLoadingDetails(false);
    }
  };

  // When a product is selected in item row, auto-fill its default cost
  const handleProductSelectChange = (prodId: string) => {
    setSelectedProductId(prodId);
    const prod = products.find(p => p.id === prodId);
    if (prod) {
      setItemCost(String(prod.cost));
    } else {
      setItemCost('');
    }
  };

  // Add Item to cart in modal
  const handleAddItemToCart = () => {
    if (!selectedProductId) {
      showNotification({
        type: 'warning',
        title: 'تنبيه',
        message: 'يرجى اختيار الصنف أولاً من القائمة',
      });
      return;
    }

    const prod = products.find(p => p.id === selectedProductId);
    if (!prod) return;

    const qty = parseInt(itemQty, 10);
    const cost = parseFloat(itemCost);

    if (isNaN(qty) || qty <= 0) {
      showNotification({
        type: 'warning',
        title: 'تنبيه',
        message: 'الكمية يجب أن تكون رقماً صحيحاً أكبر من صفر',
      });
      return;
    }

    if (isNaN(cost) || cost < 0) {
      showNotification({
        type: 'warning',
        title: 'تنبيه',
        message: 'سعر التكلفة لا يمكن أن يكون سالباً',
      });
      return;
    }

    // Check if already in cart
    const existingIndex = cartItems.findIndex(i => i.product_id === selectedProductId);
    if (existingIndex !== -1) {
      const updated = [...cartItems];
      updated[existingIndex].quantity += qty;
      updated[existingIndex].unit_cost = cost;
      updated[existingIndex].update_product_cost = itemUpdateCost;
      setCartItems(updated);
    } else {
      setCartItems([
        ...cartItems,
        {
          product_id: prod.id,
          product_name: prod.name,
          product_code: prod.code,
          quantity: qty,
          unit_cost: cost,
          update_product_cost: itemUpdateCost,
        },
      ]);
    }

    // Reset inputs
    setSelectedProductId('');
    setItemQty('1');
    setItemCost('');
  };

  // Remove item from cart
  const handleRemoveFromCart = (index: number) => {
    setCartItems(cartItems.filter((_, idx) => idx !== index));
  };

  // Calculate cart total
  const cartTotalAmount = useMemo(() => {
    return cartItems.reduce((acc, item) => acc + item.quantity * item.unit_cost, 0);
  }, [cartItems]);

  // Submit Purchase
  const handleSubmitPurchase = async () => {
    if (!purchaseNumber.trim()) {
      showNotification({
        type: 'warning',
        title: 'تنبيه',
        message: 'رقم فاتورة الشراء مطلوب',
      });
      return;
    }

    if (cartItems.length === 0) {
      showNotification({
        type: 'warning',
        title: 'تنبيه',
        message: 'يرجى إضافة صنف واحد على الأقل في الفاتورة',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const input: NewPurchaseInput = {
        purchase_number: purchaseNumber.trim(),
        purchase_date: purchaseDate,
        supplier_name: supplierName.trim() || null,
        supplier_phone: supplierPhone.trim() || null,
        notes: notes.trim() || null,
        items: cartItems.map(item => ({
          product_id: item.product_id,
          quantity: item.quantity,
          unit_cost: item.unit_cost,
          update_product_cost: item.update_product_cost,
        })),
      };

      const created = await purchasesService.createPurchase(input);
      showNotification({
        type: 'success',
        title: 'تم تسجيل فاتورة الشراء بنجاح',
        message: `فاتورة رقم "${created.purchase_number}" بقيمة ${formatCurrency(created.total_amount)} — تم تحديث الأرصدة وتسجيل حركات المخزون.`,
      });

      setIsAddModalOpen(false);
      await loadData();
    } catch (err: any) {
      showNotification({
        type: 'error',
        title: 'فشل حفظ الفاتورة',
        message: err?.message || 'حدث خطأ أثناء حفظ الفاتورة',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtered purchases
  const filteredPurchases = useMemo(() => {
    if (!searchQuery.trim()) return purchases;
    const q = searchQuery.trim().toLowerCase();
    return purchases.filter(
      p =>
        p.purchase_number.toLowerCase().includes(q) ||
        (p.supplier_name && p.supplier_name.toLowerCase().includes(q)) ||
        (p.supplier_phone && p.supplier_phone.includes(q))
    );
  }, [purchases, searchQuery]);

  // Total expenditure calculation
  const totalExpenditure = useMemo(() => {
    return purchases.reduce((acc, p) => acc + p.total_amount, 0);
  }, [purchases]);

  // Purchases Table Columns
  const columns: Column<Purchase>[] = [
    {
      key: 'purchase_number',
      header: 'رقم الفاتورة',
      render: item => (
        <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded text-xs border border-blue-200">
          {item.purchase_number}
        </span>
      ),
    },
    {
      key: 'purchase_date',
      header: 'تاريخ الشراء',
      render: item => <span className="font-mono text-slate-600 text-xs">{item.purchase_date}</span>,
    },
    {
      key: 'supplier_name',
      header: 'المورد',
      render: item => (
        <div>
          <span className="font-bold text-slate-800">{item.supplier_name || 'مورد عام'}</span>
          {item.supplier_phone && (
            <span className="block text-[11px] text-slate-400 font-mono">{item.supplier_phone}</span>
          )}
        </div>
      ),
    },
    {
      key: 'items_count',
      header: 'عدد الأصناف',
      render: item => <span className="font-semibold">{item.items_count} أصناف</span>,
    },
    {
      key: 'total_amount',
      header: 'إجمالي الفاتورة',
      render: item => (
        <span className="font-bold text-slate-900 text-sm">{formatCurrency(item.total_amount)}</span>
      ),
    },
    {
      key: 'status',
      header: 'حالة القيد',
      render: () => <Badge variant="success">مكتملة ومضافة للمخزون</Badge>,
    },
    {
      key: 'actions',
      header: 'معاينة',
      align: 'center',
      render: item => (
        <Button
          size="sm"
          variant="outline"
          onClick={() => handleOpenDetails(item)}
          leftIcon={<Eye className="w-3.5 h-3.5" />}
        >
          عرض الفاتورة
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="المشتريات والوارد (Accessories Purchases)"
        subtitle="تسجيل فواتير الشراء، بيانات الموردين، وإضافة الكميات وتحديث التكاليف إلى المخزون تلقائياً"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadData}
              isLoading={isLoading}
              leftIcon={<RefreshCw className="w-4 h-4 text-slate-500" />}
            >
              تحديث
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleOpenAddModal}
              leftIcon={<Plus className="w-4 h-4" />}
            >
              تسجيل فاتورة شراء جديدة
            </Button>
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatsCard
          title="إجمالي فواتير المشتريات"
          value={`${purchases.length} فاتورة`}
          subtitle="مسجلة في قاعدة البيانات المحلية"
          icon={ShoppingCart}
          accentColor="blue"
        />
        <StatsCard
          title="إجمالي المبالغ المنصرفة في المشتريات"
          value={formatCurrency(totalExpenditure)}
          subtitle="تكلفة بضاعة الوارد الإجمالية"
          icon={DollarSign}
          accentColor="indigo"
        />
        <StatsCard
          title="الأصناف المتاحة للطلب"
          value={`${products.length} صنف`}
          subtitle="بطاقات أصناف مسجلة بالمحل"
          icon={Package}
          accentColor="emerald"
        />
      </div>

      {/* Filter and Search Bar */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="w-full md:w-96">
            <Input
              placeholder="ابحث برقم الفاتورة، أو اسم المورد، أو الهاتف..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onClear={() => setSearchQuery('')}
              leftIcon={<Search className="w-4 h-4" />}
            />
          </div>
          <div className="text-xs text-slate-500">
            عدد الفواتير المعروضة: <strong>{filteredPurchases.length}</strong>
          </div>
        </div>
      </Card>

      {/* Purchases Table */}
      <Table
        columns={columns}
        data={filteredPurchases}
        keyExtractor={item => item.id}
        isLoading={isLoading}
        onRowClick={item => handleOpenDetails(item)}
        emptyMessage="لا توجد فواتير مشتريات مسجلة"
        emptySubMessage="قم بالضغط على 'تسجيل فاتورة شراء جديدة' لإضافة بضاعة واردة إلى المحل."
      />

      {/* ---------------- MODAL 1: NEW PURCHASE ---------------- */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => !isSubmitting && setIsAddModalOpen(false)}
        title="تسجيل فاتورة شراء ووارد جديدة"
        subtitle="إدخال بضاعة جديدة وإضافتها تلقائياً إلى رصيد المخزون في عملية واحدة آمنة"
        size="xl"
        footer={
          <div className="flex items-center justify-between w-full">
            <div className="text-sm font-bold text-slate-800">
              إجمالي الفاتورة: <span className="text-blue-700 text-base">{formatCurrency(cartTotalAmount)}</span>
            </div>
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
                onClick={handleSubmitPurchase}
                isLoading={isSubmitting}
                leftIcon={<CheckCircle2 className="w-4 h-4" />}
                disabled={cartItems.length === 0}
              >
                تأكيد الفاتورة وإضافة البضاعة للمخزون
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-5 text-xs text-slate-700">
          {/* Header Info: Number, Date, Supplier */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <Input
              label="رقم الفاتورة *"
              value={purchaseNumber}
              onChange={e => setPurchaseNumber(e.target.value.toUpperCase())}
              isMonospace
            />

            <Input
              label="تاريخ الشراء *"
              type="date"
              value={purchaseDate}
              onChange={e => setPurchaseDate(e.target.value)}
            />

            <Input
              label="اسم المورد (اختياري)"
              placeholder="مثال: شركة الأهرام..."
              value={supplierName}
              onChange={e => setSupplierName(e.target.value)}
              leftIcon={<User className="w-4 h-4" />}
            />

            <Input
              label="هاتف المورد (اختياري)"
              placeholder="01xxxxxxxxx"
              value={supplierPhone}
              onChange={e => setSupplierPhone(e.target.value)}
              leftIcon={<Phone className="w-4 h-4" />}
              isMonospace
            />
          </div>

          {/* Add Item Row */}
          <div className="p-4 bg-blue-50/60 rounded-xl border border-blue-200 space-y-3">
            <h4 className="font-bold text-slate-800 flex items-center gap-2">
              <Boxes className="w-4 h-4 text-blue-600" />
              إضافة صنف إلى الفاتورة
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
              <div className="md:col-span-5">
                <Select
                  label="اختر الصنف *"
                  value={selectedProductId}
                  onChange={e => handleProductSelectChange(e.target.value)}
                >
                  <option value="">-- اضغط للاختيار من الأصناف ({products.length}) --</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} [{p.code}] - الرصيد الحالي: {p.stock}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="md:col-span-2">
                <Input
                  label="الكمية الواردة *"
                  type="number"
                  min="1"
                  value={itemQty}
                  onChange={e => setItemQty(e.target.value)}
                  placeholder="الكمية"
                />
              </div>

              <div className="md:col-span-3">
                <Input
                  label="سعر تكلفة الشراء للقطعة *"
                  type="number"
                  step="0.5"
                  min="0"
                  value={itemCost}
                  onChange={e => setItemCost(e.target.value)}
                  placeholder="سعر التكلفة"
                />
              </div>

              <div className="md:col-span-2">
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  onClick={handleAddItemToCart}
                  className="w-full font-bold"
                  leftIcon={<Plus className="w-4 h-4" />}
                >
                  إضافة
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="updateCostCheck"
                checked={itemUpdateCost}
                onChange={e => setItemUpdateCost(e.target.checked)}
                className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              <label htmlFor="updateCostCheck" className="text-slate-700 cursor-pointer text-xs">
                تحديث سعر التكلفة الافتراضي في بطاقة الصنف بهذا السعر الجديد
              </label>
            </div>
          </div>

          {/* Cart Items Table */}
          <div className="space-y-2">
            <h4 className="font-bold text-slate-800">
              الأصناف المضافة في الفاتورة ({cartItems.length})
            </h4>

            {cartItems.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-300 text-slate-400">
                لم يتم إضافة أي أصناف بعد. اختر الصنف والكمية من الأعلى واضغط على زر "إضافة".
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-100/80 text-slate-700 font-bold border-b">
                    <tr>
                      <th className="p-3">#</th>
                      <th className="p-3">الصنف</th>
                      <th className="p-3">الكود</th>
                      <th className="p-3 text-center">الكمية</th>
                      <th className="p-3">سعر الشراء</th>
                      <th className="p-3">الإجمالي</th>
                      <th className="p-3 text-center">حذف</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {cartItems.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="p-3 font-mono text-slate-400">{idx + 1}</td>
                        <td className="p-3 font-bold text-slate-900">{item.product_name}</td>
                        <td className="p-3 font-mono text-slate-600">{item.product_code}</td>
                        <td className="p-3 text-center font-bold text-blue-700">+{item.quantity}</td>
                        <td className="p-3 font-mono">{formatCurrency(item.unit_cost)}</td>
                        <td className="p-3 font-mono font-bold text-slate-900">
                          {formatCurrency(item.quantity * item.unit_cost)}
                        </td>
                        <td className="p-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveFromCart(idx)}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              ملاحظات الفاتورة (اختياري)
            </label>
            <textarea
              rows={2}
              className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              placeholder="مثال: رقم إذن الاستلام، طريقة الدفع، أو أي شروط مع المورد..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>
        </div>
      </Modal>

      {/* ---------------- MODAL 2: PURCHASE DETAILS ---------------- */}
      <Modal
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        title={`تفاصيل فاتورة الشراء: ${selectedPurchase?.purchase_number || ''}`}
        subtitle={`تاريخ الشراء: ${selectedPurchase?.purchase_date || ''}`}
        size="lg"
        footer={
          <Button variant="primary" size="sm" onClick={() => setIsDetailsModalOpen(false)}>
            إغلاق
          </Button>
        }
      >
        {selectedPurchase && (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <span className="text-slate-400 block mb-0.5">رقم الفاتورة:</span>
                <span className="font-mono font-bold text-blue-700">{selectedPurchase.purchase_number}</span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">تاريخ الشراء:</span>
                <span className="font-mono font-semibold">{selectedPurchase.purchase_date}</span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">المورد:</span>
                <span className="font-bold text-slate-800">{selectedPurchase.supplier_name || 'مورد عام'}</span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">إجمالي المبلغ:</span>
                <span className="font-bold text-slate-900 text-sm">{formatCurrency(selectedPurchase.total_amount)}</span>
              </div>
            </div>

            {selectedPurchase.notes && (
              <div className="p-3 bg-white rounded-lg border text-slate-600">
                <strong>ملاحظات: </strong>
                {selectedPurchase.notes}
              </div>
            )}

            <div className="space-y-2">
              <h5 className="font-bold text-slate-800">الأصناف المشتراة في هذه الفاتورة:</h5>

              {isLoadingDetails ? (
                <div className="p-6 text-center text-slate-400">جاري تحميل أصناف الفاتورة...</div>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-100/80 text-slate-700 font-bold border-b">
                      <tr>
                        <th className="p-3">#</th>
                        <th className="p-3">اسم الصنف</th>
                        <th className="p-3">كود الصنف</th>
                        <th className="p-3 text-center">الكمية المشتراة</th>
                        <th className="p-3">سعر الشراء للقطعة</th>
                        <th className="p-3">إجمالي الصنف</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {selectedPurchaseItems.map((item, idx) => (
                        <tr key={item.id} className="hover:bg-slate-50">
                          <td className="p-3 font-mono text-slate-400">{idx + 1}</td>
                          <td className="p-3 font-bold text-slate-900">{item.product_name}</td>
                          <td className="p-3 font-mono text-slate-600">{item.product_code}</td>
                          <td className="p-3 text-center font-bold text-emerald-600">+{item.quantity}</td>
                          <td className="p-3 font-mono">{formatCurrency(item.unit_cost)}</td>
                          <td className="p-3 font-mono font-bold text-slate-900">{formatCurrency(item.total_cost)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
