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
  Plus,
  Minus,
  CheckCircle2,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Tag,
  DollarSign,
  Package,
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
        outCount++;
      } else if (p.stock <= p.low_stock_threshold) {
        lowCount++;
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

  // Filtered Products for Levels Tab
  const filteredProducts = useMemo(() => {
    let result = products;

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(
        p =>
          p.name.toLowerCase().includes(q) ||
          p.code.toLowerCase().includes(q) ||
          (p.barcode && p.barcode.toLowerCase().includes(q))
      );
    }

    if (selectedCategory !== 'all') {
      result = result.filter(p => p.category === selectedCategory);
    }

    if (selectedStatus === 'out_of_stock') {
      result = result.filter(p => p.stock === 0);
    } else if (selectedStatus === 'low_stock') {
      result = result.filter(p => p.stock > 0 && p.stock <= p.low_stock_threshold);
    } else if (selectedStatus === 'in_stock') {
      result = result.filter(p => p.stock > p.low_stock_threshold);
    }

    return result;
  }, [products, searchQuery, selectedCategory, selectedStatus]);

  // Filtered Movements for Movements Tab
  const filteredMovements = useMemo(() => {
    let result = movements;

    if (movementSearchQuery.trim()) {
      const q = movementSearchQuery.trim().toLowerCase();
      result = result.filter(
        m =>
          m.product_name.toLowerCase().includes(q) ||
          m.product_code.toLowerCase().includes(q) ||
          m.reason.toLowerCase().includes(q)
      );
    }

    if (selectedMovementType !== 'all') {
      result = result.filter(m => m.movement_type === selectedMovementType);
    }

    return result;
  }, [movements, movementSearchQuery, selectedMovementType]);

  // Open adjustment modal for a specific product
  const handleOpenAdjustmentModal = (product?: Product) => {
    if (product) {
      setSelectedProduct(product);
    } else if (products.length > 0) {
      setSelectedProduct(products[0]);
    } else {
      showNotification({
        type: 'warning',
        title: 'تنبيه',
        message: 'لا توجد أصناف مسجلة بالمحل لإجراء تسوية جردية عليها',
      });
      return;
    }

    setAdjustmentType('ADD');
    setAdjustmentQuantity('1');
    setAdjustmentReason('جرد دوري ومطابقة فعلية');
    setCustomReasonNotes('');
    setIsAdjustmentModalOpen(true);
  };

  // Calculate resulting stock for preview
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
    if (isNaN(qty) || qty < 0) {
      showNotification({
        type: 'warning',
        title: 'تنبيه',
        message: 'الكمية يجب أن تكون رقماً صحيحاً غير سالب',
      });
      return;
    }

    if (adjustmentType !== 'SET' && qty === 0) {
      showNotification({
        type: 'warning',
        title: 'تنبيه',
        message: 'الكمية يجب أن تكون أكبر من صفر في حركات الإضافة والخصم',
      });
      return;
    }

    if (adjustmentType === 'SUBTRACT' && selectedProduct.stock < qty) {
      showNotification({
        type: 'error',
        title: 'قيمة غير صالحة',
        message: `لا يمكن خصم ${qty} قطع لأن الرصيد الحالي ${selectedProduct.stock} فقط`,
      });
      return;
    }

    setIsSubmittingAdjustment(true);
    try {
      const input: StockAdjustmentInput = {
        product_id: selectedProduct.id,
        adjustment_type: adjustmentType,
        quantity: qty,
        reason: adjustmentReason,
        notes: customReasonNotes.trim() || null,
      };

      const mov = await inventoryService.adjustStock(input);
      showNotification({
        type: 'success',
        title: 'تمت التسوية الجردية بنجاح',
        message: `تم تحديث رصيد "${mov.product_name}" من (${mov.previous_stock}) إلى (${mov.new_stock}) قطعة وتسجيل حركة التتبع.`,
      });

      setIsAdjustmentModalOpen(false);
      await loadData();
    } catch (err: any) {
      showNotification({
        type: 'error',
        title: 'فشل إجراء التسوية',
        message: err?.message || 'حدث خطأ أثناء إجراء التسوية الجردية',
      });
    } finally {
      setIsSubmittingAdjustment(false);
    }
  };

  // Stock Levels Columns
  const stockColumns: Column<Product>[] = [
    {
      key: 'code',
      header: 'كود الصنف',
      render: item => (
        <span className="font-mono font-semibold text-slate-800 bg-slate-100/80 px-2 py-0.5 rounded text-xs border border-slate-200">
          {item.code}
        </span>
      ),
    },
    {
      key: 'name',
      header: 'اسم الصنف',
      render: item => (
        <div>
          <span className="font-bold text-slate-900">{item.name}</span>
          {item.barcode && (
            <span className="block text-[11px] text-slate-400 font-mono">باركود: {item.barcode}</span>
          )}
        </div>
      ),
    },
    {
      key: 'category',
      header: 'التصنيف',
      render: item => <Badge variant="default" size="sm">{item.category || 'عام'}</Badge>,
    },
    {
      key: 'stock',
      header: 'الرصيد الفعلي الحالي',
      render: item => (
        <div className="flex items-center gap-1.5">
          <span className="font-mono font-black text-base text-slate-900">{item.stock}</span>
          <span className="text-[11px] text-slate-400">قطعة</span>
        </div>
      ),
    },
    {
      key: 'low_stock_threshold',
      header: 'حد تنبيه النواقص',
      render: item => <span className="font-mono text-slate-500 text-xs">{item.low_stock_threshold}</span>,
    },
    {
      key: 'status',
      header: 'حالة المخزون',
      render: item => {
        if (item.stock === 0) return <Badge variant="danger">نفد الرصيد (0)</Badge>;
        if (item.stock <= item.low_stock_threshold) return <Badge variant="warning">مخزون منخفض ({item.stock})</Badge>;
        return <Badge variant="success">متوفر بالرصيد</Badge>;
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
          leftIcon={<ArrowUpDown className="w-3.5 h-3.5" />}
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
        <div className="font-mono text-xs text-slate-600">
          <div>{formatDate(item.created_at)}</div>
          <div className="text-[10px] text-slate-400">
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
          <span className="font-bold text-slate-800">{item.product_name}</span>
          <span className="block font-mono text-[11px] text-slate-400">{item.product_code}</span>
        </div>
      ),
    },
    {
      key: 'movement_type',
      header: 'نوع الحركة',
      render: item => {
        if (item.movement_type === 'PURCHASE') {
          return <Badge variant="primary">وارد مشتريات</Badge>;
        }
        if (item.movement_type === 'ADJUSTMENT_ADD') {
          return <Badge variant="success">تسوية بالزيادة</Badge>;
        }
        if (item.movement_type === 'ADJUSTMENT_SUBTRACT') {
          return <Badge variant="danger">تسوية بالخصم</Badge>;
        }
        return <Badge variant="default">{item.movement_type}</Badge>;
      },
    },
    {
      key: 'quantity_change',
      header: 'مقدار التغيير',
      render: item => (
        <span
          className={`font-mono font-bold text-sm ${
            item.quantity_change > 0
              ? 'text-emerald-600'
              : item.quantity_change < 0
              ? 'text-rose-600'
              : 'text-slate-600'
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
        <div className="flex items-center gap-1.5 font-mono text-xs">
          <span className="text-slate-400">{item.previous_stock}</span>
          <span className="text-slate-300">&larr;</span>
          <span className="font-bold text-slate-800">{item.new_stock}</span>
        </div>
      ),
    },
    {
      key: 'reason',
      header: 'السبب والبيان التوضيحي',
      render: item => <span className="text-xs text-slate-700">{item.reason}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="إدارة المخزون والتسويات الجردية"
        subtitle="متابعة الأرصدة الحالية، تنبيهات النواقص، والتسويات الجردية مع سجل تتبع كامل للحركات"
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
              onClick={() => handleOpenAdjustmentModal()}
              leftIcon={<ArrowUpDown className="w-4 h-4" />}
            >
              تسوية جردية يدوية
            </Button>
          </div>
        }
      />

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="إجمالي القطع في المخزن"
          value={`${metrics.totalUnits} قطعة`}
          subtitle={`موزعة على ${metrics.totalProducts} صنف مختلف`}
          icon={Boxes}
          accentColor="blue"
        />
        <StatsCard
          title="قيمة المخزون الإجمالية (بالتكلفة)"
          value={formatCurrency(metrics.totalCostVal)}
          subtitle="رأس المال القائم في بضاعة المحل"
          icon={DollarSign}
          accentColor="indigo"
        />
        <StatsCard
          title="أصناف منخفضة الرصيد"
          value={`${metrics.lowCount} صنف`}
          subtitle="وصلت للحد الأدنى ويجب طلبها"
          icon={AlertTriangle}
          accentColor="amber"
        />
        <StatsCard
          title="أصناف نفدت بالكامل (رصيد 0)"
          value={`${metrics.outCount} صنف`}
          subtitle="غير متوفرة حالياً بالمحل"
          icon={AlertTriangle}
          accentColor={metrics.outCount > 0 ? 'rose' : 'emerald'}
        />
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab('levels')}
          className={`py-3 px-5 font-bold text-sm border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'levels'
              ? 'border-blue-600 text-blue-700 bg-blue-50/50'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Boxes className="w-4 h-4" />
          <span>أرصدة المخزون والتنبيهات</span>
          <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-mono">
            {products.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('movements')}
          className={`py-3 px-5 font-bold text-sm border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'movements'
              ? 'border-blue-600 text-blue-700 bg-blue-50/50'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <History className="w-4 h-4" />
          <span>سجل حركات المخزون (Traceable Ledger)</span>
          <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-mono">
            {movements.length}
          </span>
        </button>
      </div>

      {/* ---------------- TAB 1: STOCK LEVELS ---------------- */}
      {activeTab === 'levels' && (
        <div className="space-y-4">
          <Card className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
              <div className="md:col-span-6">
                <Input
                  placeholder="ابحث باسم الصنف، أو كود الصنف، أو الباركود..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onClear={() => setSearchQuery('')}
                  leftIcon={<Search className="w-4 h-4" />}
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
        <div className="space-y-4">
          <Card className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
              <div className="md:col-span-8">
                <Input
                  placeholder="ابحث باسم الصنف، كود الصنف، أو سبب الحركة..."
                  value={movementSearchQuery}
                  onChange={e => setMovementSearchQuery(e.target.value)}
                  onClear={() => setMovementSearchQuery('')}
                  leftIcon={<Search className="w-4 h-4" />}
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
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAdjustmentModalOpen(false)}
              disabled={isSubmittingAdjustment}
            >
              إلغاء
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSubmitAdjustment}
              isLoading={isSubmittingAdjustment}
              leftIcon={<CheckCircle2 className="w-4 h-4" />}
            >
              تأكيد وحفظ التسوية
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmitAdjustment} className="space-y-4 text-xs text-slate-700">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
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
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
              <div>
                <span className="text-slate-400 block mb-0.5">الرصيد الفعلي الحالي:</span>
                <span className="text-base font-black font-mono text-slate-800">
                  {selectedProduct.stock} قطعة
                </span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">حد تنبيه النواقص:</span>
                <span className="font-mono text-slate-600 font-bold">
                  {selectedProduct.low_stock_threshold} قطعة
                </span>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              نوع التسوية الجردية *
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setAdjustmentType('ADD')}
                className={`p-2.5 rounded-lg border font-bold text-center transition-all ${
                  adjustmentType === 'ADD'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-800 shadow-xs'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                }`}
              >
                + زيادة رصيد
              </button>
              <button
                type="button"
                onClick={() => setAdjustmentType('SUBTRACT')}
                className={`p-2.5 rounded-lg border font-bold text-center transition-all ${
                  adjustmentType === 'SUBTRACT'
                    ? 'border-rose-500 bg-rose-50 text-rose-800 shadow-xs'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                }`}
              >
                - خصم رصيد
              </button>
              <button
                type="button"
                onClick={() => setAdjustmentType('SET')}
                className={`p-2.5 rounded-lg border font-bold text-center transition-all ${
                  adjustmentType === 'SET'
                    ? 'border-blue-500 bg-blue-50 text-blue-800 shadow-xs'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-600'
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

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-center">
              <span className="text-slate-400 block text-[11px] mb-0.5">الرصيد بعد التسوية:</span>
              <span
                className={`text-lg font-black font-mono ${
                  calculatedNewStock < 0
                    ? 'text-rose-600'
                    : calculatedNewStock === 0
                    ? 'text-amber-600'
                    : 'text-emerald-700'
                }`}
              >
                {calculatedNewStock} قطعة
              </span>
            </div>
          </div>

          {calculatedNewStock < 0 && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs font-bold">
              تنبيه: لا يمكن تنفيذ هذه العملية لأن الرصيد الناتج سيكون سالباً ({calculatedNewStock}).
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
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
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              ملاحظات إضافية على سبب التسوية (اختياري)
            </label>
            <textarea
              rows={2}
              className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
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
