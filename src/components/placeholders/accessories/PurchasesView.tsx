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
        <span className="font-mono text-sm font-bold text-slate-900 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-300 tabular-nums">
          {item.purchase_number}
        </span>
      ),
    },
    {
      key: 'purchase_date',
      header: 'تاريخ الشراء',
      render: item => <span className="font-mono text-slate-700 text-sm font-medium tabular-nums">{item.purchase_date}</span>,
    },
    {
      key: 'supplier_name',
      header: 'المورد',
      render: item => (
        <div>
          <span className="font-bold text-slate-900 text-sm">{item.supplier_name || 'مورد عام'}</span>
          {item.supplier_phone && (
            <span className="block text-xs text-slate-500 font-mono font-medium tabular-nums mt-0.5">{item.supplier_phone}</span>
          )}
        </div>
      ),
    },
    {
      key: 'items_count',
      header: 'عدد الأصناف',
      render: item => <span className="tabular-nums text-sm font-semibold text-slate-800">{item.items_count} أصناف</span>,
    },
    {
      key: 'total_amount',
      header: 'إجمالي الفاتورة',
      render: item => (
        <span className="font-bold text-slate-900 text-sm font-mono tabular-nums">{formatCurrency(item.total_amount)}</span>
      ),
    },
    {
      key: 'status',
      header: 'حالة القيد',
      render: () => <Badge variant="success" size="sm" className="font-semibold">مكتملة ومضافة</Badge>,
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
          leftIcon={<Eye className="w-4 h-4" />}
          className="h-8 text-xs font-bold px-3 border-slate-300 text-slate-800"
        >
          عرض الفاتورة
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="المشتريات والوارد "
        subtitle=""
        actions={
          <div className="flex items-center gap-2.5">
            <Button
              variant="outline"
              size="md"
              onClick={loadData}
              isLoading={isLoading}
              leftIcon={<RefreshCw className="w-4 h-4 text-slate-600" />}
              className="border-slate-300 text-slate-800 font-semibold"
            >
              Refresh
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={handleOpenAddModal}
              leftIcon={<Plus className="w-4.5 h-4.5" />}
              className="font-bold"
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
          subtitle=""
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
          subtitle=""
          icon={Package}
        />
      </div>

      {/* Filter and Search Bar */}
      <Card className="p-3.5 border-slate-300">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="w-full md:w-96">
            <Input
              placeholder="ابحث برقم الفاتورة، أو اسم المورد، أو الهاتف..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onClear={() => setSearchQuery('')}
              leftIcon={<Search className="w-4.5 h-4.5 text-slate-500" />}
            />
          </div>
          <div className="text-sm font-medium text-slate-600 tabular-nums">
            عدد الفواتير: <strong className="text-slate-900 font-bold">{filteredPurchases.length}</strong>
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
        subtitle=""
        size="xl"
        footer={
          <div className="flex items-center justify-between w-full">
            <div className="text-sm font-semibold text-slate-800">
              إجمالي الفاتورة: <span className="text-slate-900 font-bold font-mono tabular-nums text-base">{formatCurrency(cartTotalAmount)}</span>
            </div>
            <div className="flex items-center gap-2.5">
              <Button
                variant="outline"
                size="md"
                onClick={() => setIsAddModalOpen(false)}
                disabled={isSubmitting}
                className="border-slate-300 font-semibold"
              >
                إلغاء
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={handleSubmitPurchase}
                isLoading={isSubmitting}
                leftIcon={<CheckCircle2 className="w-4.5 h-4.5" />}
                disabled={cartItems.length === 0}
                className="font-bold"
              >
                تأكيد الفاتورة وإضافة البضاعة
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-4 text-sm text-slate-700">
          {/* Header Info: Number, Date, Supplier */}
          <div className="p-3.5 bg-slate-50/90 rounded-xl border border-slate-300 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
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
              leftIcon={<User className="w-4 h-4 text-slate-500" />}
            />

            <Input
              label="هاتف المورد (اختياري)"
              placeholder="01xxxxxxxxx"
              value={supplierPhone}
              onChange={e => setSupplierPhone(e.target.value)}
              leftIcon={<Phone className="w-4 h-4 text-slate-500" />}
              isMonospace
            />
          </div>

          {/* Add Item Row */}
          <div className="p-3.5 bg-slate-50/90 rounded-xl border border-slate-300 space-y-3">
            <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <Boxes className="w-4.5 h-4.5 text-slate-600" />
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
                className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400 cursor-pointer"
              />
              <label htmlFor="updateCostCheck" className="text-slate-700 cursor-pointer text-xs font-semibold">
                تحديث سعر التكلفة الافتراضي في بطاقة الصنف بهذا السعر الجديد
              </label>
            </div>
          </div>

          {/* Cart Items Table */}
          <div className="space-y-2">
            <h4 className="font-bold text-sm text-slate-900">
              الأصناف المضافة في الفاتورة ({cartItems.length})
            </h4>

            {cartItems.length === 0 ? (
              <div className="p-6 text-center bg-slate-50 rounded-xl border border-slate-300 text-slate-500 text-sm">
                لم يتم إضافة أي أصناف بعد. اختر الصنف والكمية من الأعلى واضغط على زر "إضافة".
              </div>
            ) : (
              <div className="border border-slate-300 rounded-xl overflow-hidden">
                <table className="w-full text-right text-sm">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300 select-none">
                    <tr>
                      <th className="px-3.5 py-2.5">#</th>
                      <th className="px-3.5 py-2.5">الصنف</th>
                      <th className="px-3.5 py-2.5">الكود</th>
                      <th className="px-3.5 py-2.5 text-center">الكمية</th>
                      <th className="px-3.5 py-2.5">سعر الشراء</th>
                      <th className="px-3.5 py-2.5">الإجمالي</th>
                      <th className="px-3.5 py-2.5 text-center">حذف</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {cartItems.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/80">
                        <td className="px-3.5 py-2.5 font-mono text-slate-500 tabular-nums">{idx + 1}</td>
                        <td className="px-3.5 py-2.5 font-bold text-slate-900">{item.product_name}</td>
                        <td className="px-3.5 py-2.5 font-mono font-semibold text-slate-600 tabular-nums">{item.product_code}</td>
                        <td className="px-3.5 py-2.5 text-center font-bold text-slate-900 tabular-nums">+{item.quantity}</td>
                        <td className="px-3.5 py-2.5 font-mono font-semibold tabular-nums">{formatCurrency(item.unit_cost)}</td>
                        <td className="px-3.5 py-2.5 font-mono font-bold text-slate-900 tabular-nums">
                          {formatCurrency(item.quantity * item.unit_cost)}
                        </td>
                        <td className="px-3.5 py-2.5 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveFromCart(idx)}
                            className="p-1.5 text-slate-400 hover:text-rose-700 hover:bg-slate-100 rounded-md transition-colors"
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
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              ملاحظات الفاتورة (اختياري)
            </label>
            <textarea
              rows={2}
              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-800 focus:ring-1 focus:ring-slate-800 transition-colors"
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
          <Button variant="primary" size="md" onClick={() => setIsDetailsModalOpen(false)} className="font-semibold">
            إغلاق
          </Button>
        }
      >
        {selectedPurchase && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-slate-50/90 rounded-xl border border-slate-300">
              <div>
                <span className="text-slate-500 block mb-1 text-xs font-semibold">رقم الفاتورة:</span>
                <span className="font-mono font-bold text-slate-900 tabular-nums text-sm">{selectedPurchase.purchase_number}</span>
              </div>
              <div>
                <span className="text-slate-500 block mb-1 text-xs font-semibold">تاريخ الشراء:</span>
                <span className="font-mono tabular-nums text-slate-800 font-semibold text-sm">{selectedPurchase.purchase_date}</span>
              </div>
              <div>
                <span className="text-slate-500 block mb-1 text-xs font-semibold">المورد:</span>
                <span className="font-bold text-slate-900 text-sm">{selectedPurchase.supplier_name || 'مورد عام'}</span>
              </div>
              <div>
                <span className="text-slate-500 block mb-1 text-xs font-semibold">إجمالي المبلغ:</span>
                <span className="font-bold text-slate-900 font-mono tabular-nums text-sm">{formatCurrency(selectedPurchase.total_amount)}</span>
              </div>
            </div>

            {selectedPurchase.notes && (
              <div className="p-3 bg-white rounded-xl border border-slate-300 text-slate-700 text-sm">
                <strong className="text-slate-900 font-bold">ملاحظات: </strong>
                {selectedPurchase.notes}
              </div>
            )}

            <div className="space-y-2">
              <h5 className="font-bold text-sm text-slate-900">الأصناف المشتراة في هذه الفاتورة:</h5>

              {isLoadingDetails ? (
                <div className="p-8 text-center text-slate-500 text-sm">جاري تحميل أصناف الفاتورة...</div>
              ) : (
                <div className="border border-slate-300 rounded-xl overflow-hidden">
                  <table className="w-full text-right text-sm">
                    <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300 select-none">
                      <tr>
                        <th className="px-3.5 py-2.5">#</th>
                        <th className="px-3.5 py-2.5">اسم الصنف</th>
                        <th className="px-3.5 py-2.5">كود الصنف</th>
                        <th className="px-3.5 py-2.5 text-center">الكمية المشتراة</th>
                        <th className="px-3.5 py-2.5">سعر الشراء للقطعة</th>
                        <th className="px-3.5 py-2.5">إجمالي الصنف</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {selectedPurchaseItems.map((item, idx) => (
                        <tr key={item.id} className="hover:bg-slate-50/80">
                          <td className="px-3.5 py-2.5 font-mono text-slate-500 tabular-nums">{idx + 1}</td>
                          <td className="px-3.5 py-2.5 font-bold text-slate-900">{item.product_name}</td>
                          <td className="px-3.5 py-2.5 font-mono font-semibold text-slate-600 tabular-nums">{item.product_code}</td>
                          <td className="px-3.5 py-2.5 text-center font-bold text-emerald-800 tabular-nums">+{item.quantity}</td>
                          <td className="px-3.5 py-2.5 font-mono font-semibold tabular-nums">{formatCurrency(item.unit_cost)}</td>
                          <td className="px-3.5 py-2.5 font-mono font-bold text-slate-900 tabular-nums">{formatCurrency(item.total_cost)}</td>
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
