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
  Boxes,
  AlertTriangle,
  ArrowUpDown,
  History,
  Search,
  CheckCircle2,
  RefreshCw,
  DollarSign,
} from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
import { productsService } from '@/services/productsService';
import { inventoryService } from '@/services/inventoryService';
import { Product } from '@/types/product';
import { InventoryMovement, StockAdjustmentInput, AdjustmentType } from '@/types/inventory';
import { useNotification } from '@/context/NotificationContext';

export const InventoryView: React.FC = () => {
  const { showNotification } = useNotification();

  // Active Tab: 'levels' (أرصدة المخزون) | 'movements' (سجل الحركات)
  const [activeTab, setActiveTab] = useState<'levels' | 'movements'>('levels');

  // Data states
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Filters for Stock Levels Tab
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'in_stock' | 'low_stock' | 'out_of_stock'>('all');

  // Filters for Movements Tab
  const [movementSearchQuery, setMovementSearchQuery] = useState<string>('');
  const [selectedMovementType, setSelectedMovementType] = useState<string>('all');

  // Adjustment Modal State
  const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState<boolean>(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [adjustmentType, setAdjustmentType] = useState<AdjustmentType>('ADD');
  const [adjustmentQuantity, setAdjustmentQuantity] = useState<string>('1');
  const [adjustmentReason, setAdjustmentReason] = useState<string>('جرد دوري ومطابقة فعلية');
  const [customReasonNotes, setCustomReasonNotes] = useState<string>('');
  const [isSubmittingAdjustment, setIsSubmittingAdjustment] = useState<boolean>(false);

  // Load data
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [fetchedProducts, fetchedCategories, fetchedMovements] = await Promise.all([
        productsService.getProducts(),
        productsService.getCategories(),
        inventoryService.getMovements(undefined, 200),
      ]);
      setProducts(fetchedProducts);
      setCategories(fetchedCategories);
      setMovements(fetchedMovements);
    } catch (err: any) {
      showNotification({
        type: 'error',
        title: 'خطأ في جلب البيانات',
        message: err?.message || 'تعذر تحميل بيانات المخزون والحركات',
      });
    } finally {
      setIsLoading(false);
    }
  }, [showNotification]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Stock Metrics Calculations
  const metrics = useMemo(() => {
    let totalUnits = 0;
    let totalCostVal = 0;
    let lowCount = 0;
    let outCount = 0;

    for (const p of products) {
      totalUnits += p.stock;
      totalCostVal += p.stock * p.cost;
      if (p.stock === 0) {
        outCount += 1;
      } else if (p.stock <= p.low_stock_threshold) {
        lowCount += 1;
      }
    }

    return {
      totalUnits,
      totalCostVal,
      lowCount,
      outCount,
      totalProducts: products.length,
    };
  }, [products]);

  // Filtered products for stock levels tab
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const mName = p.name.toLowerCase().includes(q);
        const mCode = p.code.toLowerCase().includes(q);
        const mBar = p.barcode ? p.barcode.toLowerCase().includes(q) : false;
        if (!mName && !mCode && !mBar) return false;
      }

      if (selectedCategory !== 'all' && p.category !== selectedCategory) {
        return false;
      }

      if (selectedStatus === 'in_stock' && p.stock <= p.low_stock_threshold) return false;
      if (selectedStatus === 'low_stock' && (p.stock === 0 || p.stock > p.low_stock_threshold)) return false;
      if (selectedStatus === 'out_of_stock' && p.stock > 0) return false;

      return true;
    });
  }, [products, searchQuery, selectedCategory, selectedStatus]);

  // Filtered movements for movements log tab
  const filteredMovements = useMemo(() => {
    return movements.filter(m => {
      if (movementSearchQuery.trim()) {
        const q = movementSearchQuery.toLowerCase().trim();
        const mName = m.product_name.toLowerCase().includes(q);
        const mCode = m.product_code.toLowerCase().includes(q);
        const mReason = m.reason ? m.reason.toLowerCase().includes(q) : false;
        if (!mName && !mCode && !mReason) return false;
      }

      if (selectedMovementType !== 'all') {
        if (m.movement_type !== selectedMovementType) return false;
      }

      return true;
    });
  }, [movements, movementSearchQuery, selectedMovementType]);

  // Open adjustment modal
  const handleOpenAdjustmentModal = (product?: Product) => {
    if (product) {
      setSelectedProduct(product);
    } else if (products.length > 0) {
      setSelectedProduct(products[0]);
    }
    setAdjustmentType('ADD');
    setAdjustmentQuantity('1');
    setAdjustmentReason('جرد دوري ومطابقة فعلية');
    setCustomReasonNotes('');
    setIsAdjustmentModalOpen(true);
  };

  // Calculate prospective new stock after adjustment
  const calculatedNewStock = useMemo(() => {
    if (!selectedProduct) return 0;
    const qty = parseInt(adjustmentQuantity, 10);
    if (isNaN(qty)) return selectedProduct.stock;

    if (adjustmentType === 'ADD') {
      return selectedProduct.stock + qty;
    } else if (adjustmentType === 'SUBTRACT') {
      return selectedProduct.stock - qty;
    } else if (adjustmentType === 'SET') {
      return qty;
    }
    return selectedProduct.stock;
  }, [selectedProduct, adjustmentType, adjustmentQuantity]);

  // Submit Stock Adjustment
  const handleSubmitAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;

    const qty = parseInt(adjustmentQuantity, 10);
    if (isNaN(qty) || (adjustmentType !== 'SET' && qty <= 0) || (adjustmentType === 'SET' && qty < 0)) {
      showNotification({
        type: 'warning',
        title: 'الكمية غير صالحة',
        message: 'يرجى إدخال كمية رقمية صحيحة للتسوية',
      });
      return;
    }

    if (calculatedNewStock < 0) {
      showNotification({
        type: 'error',
        title: 'قيمة الرصيد غير مسموحة',
        message: 'لا يمكن للتسوية أن تجعل رصيد الصنف سالباً تحت أي ظرف',
      });
      return;
    }

    const finalReason = customReasonNotes.trim()
      ? `${adjustmentReason} - ${customReasonNotes.trim()}`
      : adjustmentReason;

    setIsSubmittingAdjustment(true);
    try {
      const input: StockAdjustmentInput = {
        product_id: selectedProduct.id,
        adjustment_type: adjustmentType,
        quantity: qty,
        reason: finalReason,
      };

      const result = await inventoryService.adjustStock(input);
      showNotification({
        type: 'success',
        title: 'تمت التسوية الجردية بنجاح',
        message: `تم تحديث رصيد الصنف "${result.product_name}" من (${result.previous_stock}) إلى (${result.new_stock}) قطعة وتوثيق الحركة بالسجل.`,
      });

      setIsAdjustmentModalOpen(false);
      await loadData();
    } catch (err: any) {
      showNotification({
        type: 'error',
        title: 'فشل تنفيذ التسوية',
        message: err?.message || 'حدث خطأ أثناء حفظ التسوية الجردية',
      });
    } finally {
      setIsSubmittingAdjustment(false);
    }
  };

  // Stock Levels Table Columns
  const stockColumns: Column<Product>[] = [
    {
      key: 'code',
      header: 'كود الصنف',
      render: item => (
        <span className="font-mono text-sm font-bold text-slate-900 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-300 tabular-nums">
          {item.code}
        </span>
      ),
    },
    {
      key: 'name',
      header: 'اسم المنتج والتصنيف',
      render: item => (
        <div>
          <span className="font-bold text-slate-900 text-sm">{item.name}</span>
          <span className="block text-xs font-medium text-slate-500 mt-0.5">{item.category || 'عام'}</span>
        </div>
      ),
    },
    {
      key: 'cost',
      header: 'سعر التكلفة',
      render: item => <span className="font-mono text-slate-700 text-sm font-medium tabular-nums">{formatCurrency(item.cost)}</span>,
    },
    {
      key: 'total_cost_val',
      header: 'قيمة الرصيد الإجمالية',
      render: item => (
        <span className="font-mono text-slate-900 text-sm font-bold tabular-nums">{formatCurrency(item.stock * item.cost)}</span>
      ),
    },
    {
      key: 'stock',
      header: 'الرصيد الفعلي الحالي',
      render: item => (
        <div className="flex items-baseline gap-1.5">
          <span className="font-mono font-bold text-base text-slate-900 tabular-nums">{item.stock}</span>
          <span className="text-xs text-slate-500 font-medium">قطعة</span>
        </div>
      ),
    },
    {
      key: 'low_stock_threshold',
      header: 'حد التنبيه',
      render: item => <span className="font-mono text-slate-600 text-sm font-semibold tabular-nums">{item.low_stock_threshold}</span>,
    },
    {
      key: 'status',
      header: 'حالة المخزون',
      render: item => {
        if (item.stock === 0) return <Badge variant="danger" size="sm" className="font-semibold">نفد الرصيد (0)</Badge>;
        if (item.stock <= item.low_stock_threshold) return <Badge variant="warning" size="sm" className="font-semibold">مخزون منخفض ({item.stock})</Badge>;
        return <Badge variant="success" size="sm" className="font-semibold">متوفر بالرصيد</Badge>;
      },
    },
    {
      key: 'actions',
      header: 'تسوية رصيد',
      align: 'center',
      render: item => (
        <Button
          size="sm"
          variant="outline"
          onClick={() => handleOpenAdjustmentModal(item)}
          leftIcon={<ArrowUpDown className="w-4 h-4" />}
          className="h-8 text-xs font-bold px-3 border-slate-300 text-slate-800"
        >
          تسوية
        </Button>
      ),
    },
  ];

  // Movements Log Columns
  const movementColumns: Column<InventoryMovement>[] = [
    {
      key: 'created_at',
      header: 'التاريخ والوقت',
      render: item => (
        <div className="font-mono text-sm text-slate-800 tabular-nums">
          <div className="font-semibold">{formatDate(item.created_at)}</div>
          <div className="text-xs text-slate-500 font-medium mt-0.5">
            {new Date(item.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      ),
    },
    {
      key: 'product_name',
      header: 'الصنف والكود',
      render: item => (
        <div>
          <span className="font-bold text-slate-900 text-sm">{item.product_name}</span>
          <span className="block font-mono text-xs font-semibold text-slate-500 tabular-nums mt-0.5">{item.product_code}</span>
        </div>
      ),
    },
    {
      key: 'movement_type',
      header: 'نوع الحركة',
      render: item => {
        if (item.movement_type === 'PURCHASE') {
          return <Badge variant="primary" size="sm" className="font-semibold">وارد مشتريات</Badge>;
        }
        if (item.movement_type === 'ADJUSTMENT_ADD') {
          return <Badge variant="success" size="sm" className="font-semibold">تسوية بالزيادة</Badge>;
        }
        if (item.movement_type === 'ADJUSTMENT_SUBTRACT') {
          return <Badge variant="danger" size="sm" className="font-semibold">تسوية بالخصم</Badge>;
        }
        return <Badge variant="default" size="sm" className="font-semibold">{item.movement_type}</Badge>;
      },
    },
    {
      key: 'quantity_change',
      header: 'مقدار التغيير',
      render: item => (
        <span
          className={`font-mono font-bold text-sm tabular-nums ${
            item.quantity_change > 0
              ? 'text-emerald-700'
              : item.quantity_change < 0
              ? 'text-rose-700'
              : 'text-slate-700'
          }`}
        >
          {item.quantity_change > 0 ? `+${item.quantity_change}` : item.quantity_change}
        </span>
      ),
    },
    {
      key: 'stock_change',
      header: 'تطور الرصيد',
      render: item => (
        <div className="flex items-center gap-2 font-mono text-sm tabular-nums">
          <span className="text-slate-500 font-medium">{item.previous_stock}</span>
          <span className="text-slate-400 font-bold">&larr;</span>
          <span className="font-bold text-slate-900">{item.new_stock}</span>
        </div>
      ),
    },
    {
      key: 'reason',
      header: 'السبب والبيان التوضيحي',
      render: item => <span className="text-sm font-medium text-slate-800">{item.reason}</span>,
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="إدارة المخزون والتسويات الجردية"
        subtitle="متابعة الأرصدة الحالية، تنبيهات النواقص، والتسويات الجردية مع سجل تتبع كامل للحركات"
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
              تحديث
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={() => handleOpenAdjustmentModal()}
              leftIcon={<ArrowUpDown className="w-4.5 h-4.5" />}
              className="font-bold"
            >
              تسوية جردية يدوية
            </Button>
          </div>
        }
      />

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <StatsCard
          title="إجمالي القطع في المخزن"
          value={`${metrics.totalUnits} قطعة`}
          subtitle={`موزعة على ${metrics.totalProducts} صنف مختلف`}
          icon={Boxes}
        />
        <StatsCard
          title="قيمة المخزون الإجمالية (بالتكلفة)"
          value={formatCurrency(metrics.totalCostVal)}
          subtitle="رأس المال القائم في البضاعة"
          icon={DollarSign}
        />
        <StatsCard
          title="أصناف منخفضة الرصيد"
          value={`${metrics.lowCount} صنف`}
          subtitle="وصلت للحد الأدنى للطلب"
          icon={AlertTriangle}
        />
        <StatsCard
          title="أصناف نفدت بالكامل (رصيد 0)"
          value={`${metrics.outCount} صنف`}
          subtitle="غير متوفرة حالياً بالمحل"
          icon={AlertTriangle}
        />
      </div>

      {/* Navigation Tabs */}
      <div className="inline-flex rounded-xl border border-slate-300 p-1 bg-slate-100 text-sm">
        <button
          type="button"
          onClick={() => setActiveTab('levels')}
          className={`px-4 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 ${
            activeTab === 'levels'
              ? 'bg-white shadow-subtle text-slate-900 font-bold border border-slate-300'
              : 'text-slate-600 hover:text-slate-900 font-medium'
          }`}
        >
          <Boxes className="w-4.5 h-4.5 text-slate-600" />
          <span>أرصدة المخزون والتنبيهات</span>
          <span className="text-xs font-mono font-bold text-slate-600 bg-slate-200/80 px-2 py-0.5 rounded tabular-nums">
            {products.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('movements')}
          className={`px-4 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 ${
            activeTab === 'movements'
              ? 'bg-white shadow-subtle text-slate-900 font-bold border border-slate-300'
              : 'text-slate-600 hover:text-slate-900 font-medium'
          }`}
        >
          <History className="w-4.5 h-4.5 text-slate-600" />
          <span>سجل حركات المخزون (Traceable Ledger)</span>
          <span className="text-xs font-mono font-bold text-slate-600 bg-slate-200/80 px-2 py-0.5 rounded tabular-nums">
            {movements.length}
          </span>
        </button>
      </div>

      {/* ---------------- TAB 1: STOCK LEVELS ---------------- */}
      {activeTab === 'levels' && (
        <div className="space-y-3.5">
          <Card className="p-3.5 border-slate-300">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
              <div className="md:col-span-6">
                <Input
                  placeholder="ابحث باسم الصنف، أو كود الصنف، أو الباركود..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onClear={() => setSearchQuery('')}
                  leftIcon={<Search className="w-4.5 h-4.5 text-slate-500" />}
                />
              </div>

              <div className="md:col-span-3">
                <Select
                  value={selectedCategory}
                  onChange={e => setSelectedCategory(e.target.value)}
                >
                  <option value="all">جميع التصنيفات ({categories.length})</option>
                  {categories.map(c => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="md:col-span-3">
                <Select
                  value={selectedStatus}
                  onChange={e => setSelectedStatus(e.target.value as any)}
                >
                  <option value="all">جميع حالات المخزون</option>
                  <option value="in_stock">المتوفر بكميات كافية</option>
                  <option value="low_stock">المخزون المنخفض (تنبيه الطلب)</option>
                  <option value="out_of_stock">المنعدم تماماً (رصيد 0)</option>
                </Select>
              </div>
            </div>
          </Card>

          <Table
            columns={stockColumns}
            data={filteredProducts}
            keyExtractor={item => item.id}
            isLoading={isLoading}
            emptyMessage="لم يتم العثور على أي أصناف مطابقة"
          />
        </div>
      )}

      {/* ---------------- TAB 2: MOVEMENTS LEDGER ---------------- */}
      {activeTab === 'movements' && (
        <div className="space-y-3.5">
          <Card className="p-3.5 border-slate-300">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
              <div className="md:col-span-8">
                <Input
                  placeholder="ابحث باسم الصنف، كود الصنف، أو سبب الحركة..."
                  value={movementSearchQuery}
                  onChange={e => setMovementSearchQuery(e.target.value)}
                  onClear={() => setMovementSearchQuery('')}
                  leftIcon={<Search className="w-4.5 h-4.5 text-slate-500" />}
                />
              </div>

              <div className="md:col-span-4">
                <Select
                  value={selectedMovementType}
                  onChange={e => setSelectedMovementType(e.target.value)}
                >
                  <option value="all">جميع أنواع الحركات</option>
                  <option value="PURCHASE">وارد المشتريات (PURCHASE)</option>
                  <option value="ADJUSTMENT_ADD">تسوية بالزيادة (ADD)</option>
                  <option value="ADJUSTMENT_SUBTRACT">تسوية بالخصم (SUBTRACT)</option>
                </Select>
              </div>
            </div>
          </Card>

          <Table
            columns={movementColumns}
            data={filteredMovements}
            keyExtractor={item => item.id}
            isLoading={isLoading}
            emptyMessage="لا توجد حركات مخزون مسجلة"
            emptySubMessage="تظهر هنا تلقائياً كافة حركات الوارد، التسويات الجردية، والمبيعات لضمان الشفافية والرقابة."
          />
        </div>
      )}

      {/* ---------------- MODAL: STOCK ADJUSTMENT ---------------- */}
      <Modal
        isOpen={isAdjustmentModalOpen}
        onClose={() => !isSubmittingAdjustment && setIsAdjustmentModalOpen(false)}
        title="إجراء تسوية جردية لرصيد المخزون"
        subtitle="تعديل رصيد الصنف وتوثيق السبب في سجل حركات المخزون التتبعي"
        size="md"
        footer={
          <div className="flex items-center justify-end gap-2.5 w-full">
            <Button
              variant="outline"
              size="md"
              onClick={() => setIsAdjustmentModalOpen(false)}
              disabled={isSubmittingAdjustment}
              className="border-slate-300 font-semibold"
            >
              إلغاء
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={handleSubmitAdjustment}
              isLoading={isSubmittingAdjustment}
              leftIcon={<CheckCircle2 className="w-4.5 h-4.5" />}
              className="font-bold"
            >
              تأكيد وحفظ التسوية
            </Button>
          </div>
        }
      >
        <form onSubmit={handleSubmitAdjustment} className="space-y-4 text-sm text-slate-700">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              الصنف المراد تسويته *
            </label>
            <Select
              value={selectedProduct?.id || ''}
              onChange={e => {
                const found = products.find(p => p.id === e.target.value);
                if (found) setSelectedProduct(found);
              }}
            >
              {products.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} [{p.code}] - الرصيد الحالي: {p.stock} قطعة
                </option>
              ))}
            </Select>
          </div>

          {selectedProduct && (
            <div className="p-3.5 bg-slate-50/90 rounded-xl border border-slate-300 flex items-center justify-between">
              <div>
                <span className="text-slate-500 block mb-1 text-xs font-semibold">الرصيد الفعلي الحالي:</span>
                <span className="text-base font-bold font-mono text-slate-900 tabular-nums">
                  {selectedProduct.stock} قطعة
                </span>
              </div>
              <div>
                <span className="text-slate-500 block mb-1 text-xs font-semibold">حد تنبيه النواقص:</span>
                <span className="font-mono text-slate-700 font-bold tabular-nums text-sm">
                  {selectedProduct.low_stock_threshold} قطعة
                </span>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              نوع التسوية الجردية *
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setAdjustmentType('ADD')}
                className={`p-2.5 rounded-lg border text-sm font-bold text-center transition-colors ${
                  adjustmentType === 'ADD'
                    ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                    : 'border-slate-300 bg-white hover:bg-slate-50 text-slate-700'
                }`}
              >
                + زيادة رصيد
              </button>
              <button
                type="button"
                onClick={() => setAdjustmentType('SUBTRACT')}
                className={`p-2.5 rounded-lg border text-sm font-bold text-center transition-colors ${
                  adjustmentType === 'SUBTRACT'
                    ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                    : 'border-slate-300 bg-white hover:bg-slate-50 text-slate-700'
                }`}
              >
                - خصم رصيد
              </button>
              <button
                type="button"
                onClick={() => setAdjustmentType('SET')}
                className={`p-2.5 rounded-lg border text-sm font-bold text-center transition-colors ${
                  adjustmentType === 'SET'
                    ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                    : 'border-slate-300 bg-white hover:bg-slate-50 text-slate-700'
                }`}
              >
                = ضبط رصيد فعلي
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
            <Input
              label={
                adjustmentType === 'SET'
                  ? 'الرصيد الفعلي الجديد *'
                  : 'مقدار كمية التسوية *'
              }
              type="number"
              min={adjustmentType === 'SET' ? '0' : '1'}
              value={adjustmentQuantity}
              onChange={e => setAdjustmentQuantity(e.target.value)}
              placeholder="الكمية"
            />

            <div className="p-3.5 bg-slate-50/90 rounded-xl border border-slate-300 text-center">
              <span className="text-slate-500 block text-xs font-semibold mb-1">الرصيد بعد التسوية:</span>
              <span
                className={`text-base font-bold font-mono tabular-nums ${
                  calculatedNewStock < 0
                    ? 'text-rose-700'
                    : calculatedNewStock === 0
                    ? 'text-amber-700'
                    : 'text-slate-900'
                }`}
              >
                {calculatedNewStock} قطعة
              </span>
            </div>
          </div>

          {calculatedNewStock < 0 && (
            <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-rose-800 text-sm font-bold">
              تنبيه: لا يمكن تنفيذ هذه العملية لأن الرصيد الناتج سيكون سالباً ({calculatedNewStock}).
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              سبب التسوية الجردية (إلزامي للرقابة) *
            </label>
            <Select
              value={adjustmentReason}
              onChange={e => setAdjustmentReason(e.target.value)}
            >
              <option value="جرد دوري ومطابقة فعلية">جرد دوري ومطابقة فعلية</option>
              <option value="تلف صنف أثناء التخزين">تلف صنف أثناء التخزين أو النقل</option>
              <option value="عجز جرد غير مبرر">عجز جرد فعلي في المحل</option>
              <option value="زيادة غير مسجلة بالدفاتر">زيادة بضاعة غير مسجلة تم العثور عليها</option>
              <option value="مرتجع إلى المورد">مرتجع بضاعة إلى المورد</option>
              <option value="سحب نموذج للعرض أو الاستخدام الداخلي">سحب نموذج للعرض أو التجربة</option>
              <option value="تصحيح خطأ إدخال سابق">تصحيح خطأ إدخال سابق</option>
              <option value="أخرى">أخرى (يرجى كتابة التفاصيل)</option>
            </Select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              ملاحظات إضافية على سبب التسوية (اختياري)
            </label>
            <textarea
              rows={2}
              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-800 focus:ring-1 focus:ring-slate-800 transition-colors"
              placeholder="اكتب أي توضيحات مساندة للإدارة..."
              value={customReasonNotes}
              onChange={e => setCustomReasonNotes(e.target.value)}
            />
          </div>
        </form>
      </Modal>
    </div>
  );
};
