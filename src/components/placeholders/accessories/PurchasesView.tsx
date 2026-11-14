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
  User,
  Phone,
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
    } catch {
      setPurchaseNumber(`PUR-${new Date().getFullYear()}-001`);
    }

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
        title: 'خطأ في تحميل تفاصيل الفاتورة',
        message: err?.message || 'تعذر جلب أصناف الفاتورة',
      });
    } finally {
      setIsLoadingDetails(false);
    }
  };

  // On Product select change in cart adder
  const handleProductSelectChange = (prodId: string) => {
    setSelectedProductId(prodId);
    const prod = products.find(p => p.id === prodId);
    if (prod) {
      setItemCost(String(prod.cost));
    } else {
      setItemCost('');
    }
  };

  // Add Item to Cart
  const handleAddItemToCart = () => {
    if (!selectedProductId) {
      showNotification({
        type: 'warning',
        title: 'اختر الصنف أولاً',
        message: 'يرجى اختيار صنف لإضافته إلى الفاتورة',
      });
      return;
    }

    const prod = products.find(p => p.id === selectedProductId);
    if (!prod) return;

    const qty = parseInt(itemQty, 10);
    if (isNaN(qty) || qty <= 0) {
      showNotification({
        type: 'warning',
        title: 'الكمية غير صالحة',
        message: 'يجب أن تكون الكمية عدداً صحيحاً أكبر من صفر',
      });
      return;
    }

    const cost = parseFloat(itemCost);
    if (isNaN(cost) || cost < 0) {
      showNotification({
        type: 'warning',
        title: 'سعر التكلفة غير صالح',
        message: 'يجب أن يكون سعر التكلفة رقماً موجباً',
      });
      return;
    }

    // Check if already in cart
    const existingIndex = cartItems.findIndex(i => i.product_id === selectedProductId);
    if (existingIndex >= 0) {
      const updated = [...cartItems];
      updated[existingIndex].quantity += qty;
      updated[existingIndex].unit_cost = cost;
      updated[existingIndex].update_product_cost = itemUpdateCost;
      setCartItems(updated);
    } else {
      setCartItems(prev => [
        ...prev,
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
    setItemUpdateCost(true);
  };

  // Remove item from cart
  const handleRemoveFromCart = (index: number) => {
    setCartItems(prev => prev.filter((_, idx) => idx !== index));
  };

  // Cart total
  const cartTotalAmount = useMemo(() => {
    return cartItems.reduce((sum, item) => sum + item.quantity * item.unit_cost, 0);
  }, [cartItems]);

  // Submit Purchase
  const handleSubmitPurchase = async () => {
    if (!purchaseNumber.trim()) {
      showNotification({
        type: 'error',
        title: 'رقم الفاتورة مطلوب',
        message: 'يرجى إدخال رقم الفاتورة أو تركه بالتسلسل المقترح',
      });
      return;
    }

    if (cartItems.length === 0) {
      showNotification({
        type: 'warning',
        title: 'الفاتورة فارغة',
        message: 'يرجى إضافة صنف واحد على الأقل إلى فاتورة الشراء',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const inputItems: NewPurchaseItemInput[] = cartItems.map(i => ({
        product_id: i.product_id,
        quantity: i.quantity,
        unit_cost: i.unit_cost,
        update_product_cost: i.update_product_cost,
      }));

      const input: NewPurchaseInput = {
        purchase_number: purchaseNumber.trim(),
        purchase_date: purchaseDate,
        supplier_name: supplierName.trim() || null,
        supplier_phone: supplierPhone.trim() || null,
        notes: notes.trim() || null,
        items: inputItems,
      };

      const created = await purchasesService.createPurchase(input);
      showNotification({
        type: 'success',
        title: 'تم تسجيل فاتورة الشراء بنجاح',
        message: `تم إضافة بضاعة الفاتورة (${created.purchase_number}) إلى المخزون وتحديث التكاليف.`,
      });

      setIsAddModalOpen(false);
      await loadData();
    } catch (err: any) {
      showNotification({
        type: 'error',
        title: 'فشل حفظ الفاتورة',
        message: err?.message || 'حدث خطأ أثناء حفظ فاتورة الشراء',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtered purchases
  const filteredPurchases = useMemo(() => {
    if (!searchQuery.trim()) return purchases;
    const q = searchQuery.toLowerCase().trim();
    return purchases.filter(p => {
      const matchNum = p.purchase_number.toLowerCase().includes(q);
      const matchSupplier = p.supplier_name ? p.supplier_name.toLowerCase().includes(q) : false;
      const matchPhone = p.supplier_phone ? p.supplier_phone.toLowerCase().includes(q) : false;
      return matchNum || matchSupplier || matchPhone;
    });
  }, [purchases, searchQuery]);

  // Overall financial metrics
  const totalExpenditure = useMemo(() => {
    return purchases.reduce((sum, p) => sum + p.total_amount, 0);
  }, [purchases]);

  // Purchases Table Columns
  const columns: Column<Purchase>[] = [
    {
      key: 'purchase_number',
      header: 'رقم الفاتورة',
      render: item => (
        <span className="font-mono text-xs font-medium text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200/70 tabular-nums">
          {item.purchase_number}
        </span>
      ),
    },
    {
      key: 'purchase_date',
      header: 'تاريخ الشراء',
      render: item => <span className="font-mono text-slate-600 text-xs tabular-nums">{item.purchase_date}</span>,
    },
    {
      key: 'supplier_name',
      header: 'المورد',
      render: item => (
        <div>
          <span className="font-medium text-slate-800 text-xs">{item.supplier_name || 'مورد عام'}</span>
          {item.supplier_phone && (
            <span className="block text-[11px] text-slate-400 font-mono tabular-nums">{item.supplier_phone}</span>
          )}
        </div>
      ),
    },
    {
      key: 'items_count',
      header: 'عدد الأصناف',
      render: item => <span className="tabular-nums text-xs font-medium">{item.items_count} أصناف</span>,
    },
    {
      key: 'total_amount',
      header: 'إجمالي الفاتورة',
      render: item => (
        <span className="font-semibold text-slate-900 text-xs font-mono tabular-nums">{formatCurrency(item.total_amount)}</span>
      ),
    },
    {
      key: 'status',
      header: 'حالة القيد',
      render: () => <Badge variant="success" size="sm">مكتملة ومضافة</Badge>,
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
          className="h-7 text-xs px-2"
        >
          عرض الفاتورة
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-5">
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
              leftIcon={<RefreshCw className="w-3.5 h-3.5 text-slate-500" />}
            >
              تحديث
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleOpenAddModal}
              leftIcon={<Plus className="w-3.5 h-3.5" />}
            >
              تسجيل فاتورة شراء جديدة
            </Button>
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <StatsCard
          title="إجمالي فواتير المشتريات"
          value={`${purchases.length} فاتورة`}
          subtitle="مسجلة في قاعدة البيانات المحلية"
          icon={ShoppingCart}
        />
        <StatsCard
          title="إجمالي المبالغ المنصرفة في المشتريات"
          value={formatCurrency(totalExpenditure)}
          subtitle="تكلفة بضاعة الوارد الإجمالية"
          icon={DollarSign}
        />
        <StatsCard
          title="الأصناف المتاحة للطلب"
          value={`${products.length} صنف`}
          subtitle="بطاقات أصناف مسجلة بالمحل"
          icon={Package}
        />
      </div>

      {/* Filter and Search Bar */}
      <Card className="p-3">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="w-full md:w-96">
            <Input
              placeholder="ابحث برقم الفاتورة، أو اسم المورد، أو الهاتف..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onClear={() => setSearchQuery('')}
              leftIcon={<Search className="w-3.5 h-3.5" />}
            />
          </div>
          <div className="text-xs text-slate-500 tabular-nums">
            عدد الفواتير: <strong className="text-slate-800">{filteredPurchases.length}</strong>
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
            <div className="text-xs font-medium text-slate-800">
              إجمالي الفاتورة: <span className="text-slate-900 font-semibold font-mono tabular-nums text-sm">{formatCurrency(cartTotalAmount)}</span>
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
                leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
                disabled={cartItems.length === 0}
              >
                تأكيد الفاتورة وإضافة البضاعة
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-4 text-xs text-slate-700">
          {/* Header Info: Number, Date, Supplier */}
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
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
              leftIcon={<User className="w-3.5 h-3.5" />}
            />

            <Input
              label="هاتف المورد (اختياري)"
              placeholder="01xxxxxxxxx"
              value={supplierPhone}
              onChange={e => setSupplierPhone(e.target.value)}
              leftIcon={<Phone className="w-3.5 h-3.5" />}
              isMonospace
            />
          </div>

          {/* Add Item Row */}
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2.5">
            <h4 className="font-semibold text-xs text-slate-900 flex items-center gap-1.5">
              <Boxes className="w-3.5 h-3.5 text-slate-500" />
              إضافة صنف إلى الفاتورة
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-end">
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
                  className="w-full"
                  leftIcon={<Plus className="w-3.5 h-3.5" />}
                >
                  إضافة
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-0.5">
              <input
                type="checkbox"
                id="updateCostCheck"
                checked={itemUpdateCost}
                onChange={e => setItemUpdateCost(e.target.checked)}
                className="rounded border-slate-300 text-slate-900 focus:ring-slate-400 cursor-pointer"
              />
              <label htmlFor="updateCostCheck" className="text-slate-600 cursor-pointer text-xs">
                تحديث سعر التكلفة الافتراضي في بطاقة الصنف بهذا السعر الجديد
              </label>
            </div>
          </div>

          {/* Cart Items Table */}
          <div className="space-y-1.5">
            <h4 className="font-semibold text-xs text-slate-800">
              الأصناف المضافة في الفاتورة ({cartItems.length})
            </h4>

            {cartItems.length === 0 ? (
              <div className="p-6 text-center bg-slate-50 rounded-lg border border-slate-200 text-slate-400 text-xs">
                لم يتم إضافة أي أصناف بعد. اختر الصنف والكمية من الأعلى واضغط على زر "إضافة".
              </div>
            ) : (
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200 select-none">
                    <tr>
                      <th className="px-3 py-2">#</th>
                      <th className="px-3 py-2">الصنف</th>
                      <th className="px-3 py-2">الكود</th>
                      <th className="px-3 py-2 text-center">الكمية</th>
                      <th className="px-3 py-2">سعر الشراء</th>
                      <th className="px-3 py-2">الإجمالي</th>
                      <th className="px-3 py-2 text-center">حذف</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {cartItems.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/60">
                        <td className="px-3 py-2 font-mono text-slate-400 tabular-nums">{idx + 1}</td>
                        <td className="px-3 py-2 font-medium text-slate-900">{item.product_name}</td>
                        <td className="px-3 py-2 font-mono text-slate-600 tabular-nums">{item.product_code}</td>
                        <td className="px-3 py-2 text-center font-semibold text-slate-900 tabular-nums">+{item.quantity}</td>
                        <td className="px-3 py-2 font-mono tabular-nums">{formatCurrency(item.unit_cost)}</td>
                        <td className="px-3 py-2 font-mono font-semibold text-slate-900 tabular-nums">
                          {formatCurrency(item.quantity * item.unit_cost)}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveFromCart(idx)}
                            className="p-1 text-slate-400 hover:text-rose-700 hover:bg-slate-100 rounded transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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
            <label className="block text-xs font-medium text-slate-700 mb-1">
              ملاحظات الفاتورة (اختياري)
            </label>
            <textarea
              rows={2}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-800 focus:ring-1 focus:ring-slate-800 transition-colors"
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
          <div className="space-y-3.5 text-xs">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div>
                <span className="text-slate-400 block mb-0.5">رقم الفاتورة:</span>
                <span className="font-mono font-medium text-slate-900 tabular-nums">{selectedPurchase.purchase_number}</span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">تاريخ الشراء:</span>
                <span className="font-mono tabular-nums text-slate-700">{selectedPurchase.purchase_date}</span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">المورد:</span>
                <span className="font-medium text-slate-800">{selectedPurchase.supplier_name || 'مورد عام'}</span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">إجمالي المبلغ:</span>
                <span className="font-semibold text-slate-900 font-mono tabular-nums">{formatCurrency(selectedPurchase.total_amount)}</span>
              </div>
            </div>

            {selectedPurchase.notes && (
              <div className="p-2.5 bg-white rounded-lg border border-slate-200 text-slate-600">
                <strong className="text-slate-800">ملاحظات: </strong>
                {selectedPurchase.notes}
              </div>
            )}

            <div className="space-y-1.5">
              <h5 className="font-semibold text-xs text-slate-800">الأصناف المشتراة في هذه الفاتورة:</h5>

              {isLoadingDetails ? (
                <div className="p-6 text-center text-slate-400">جاري تحميل أصناف الفاتورة...</div>
              ) : (
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200 select-none">
                      <tr>
                        <th className="px-3 py-2">#</th>
                        <th className="px-3 py-2">اسم الصنف</th>
                        <th className="px-3 py-2">كود الصنف</th>
                        <th className="px-3 py-2 text-center">الكمية المشتراة</th>
                        <th className="px-3 py-2">سعر الشراء للقطعة</th>
                        <th className="px-3 py-2">إجمالي الصنف</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {selectedPurchaseItems.map((item, idx) => (
                        <tr key={item.id} className="hover:bg-slate-50/60">
                          <td className="px-3 py-2 font-mono text-slate-400 tabular-nums">{idx + 1}</td>
                          <td className="px-3 py-2 font-medium text-slate-900">{item.product_name}</td>
                          <td className="px-3 py-2 font-mono text-slate-600 tabular-nums">{item.product_code}</td>
                          <td className="px-3 py-2 text-center font-semibold text-emerald-800 tabular-nums">+{item.quantity}</td>
                          <td className="px-3 py-2 font-mono tabular-nums">{formatCurrency(item.unit_cost)}</td>
                          <td className="px-3 py-2 font-mono font-semibold text-slate-900 tabular-nums">{formatCurrency(item.total_cost)}</td>
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
