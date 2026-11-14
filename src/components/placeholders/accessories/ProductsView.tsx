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
  Edit,
  Trash2,
  Eye,
  ScanBarcode,
  Package,
  AlertTriangle,
  Boxes,
  TrendingUp,
  Barcode,
  RefreshCw,
} from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
import { productsService } from '@/services/productsService';
import { Product, NewProductInput, UpdateProductInput, StockStatusFilter } from '@/types/product';
import { useNotification } from '@/context/NotificationContext';
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner';

interface FormState {
  name: string;
  code: string;
  barcode: string;
  category: string;
  newCategory: string;
  cost: string;
  price: string;
  stock: string;
  low_stock_threshold: string;
  description: string;
}

const emptyFormState: FormState = {
  name: '',
  code: '',
  barcode: '',
  category: '',
  newCategory: '',
  cost: '',
  price: '',
  stock: '0',
  low_stock_threshold: '5',
  description: '',
};

export const ProductsView: React.FC = () => {
  const { showNotification } = useNotification();

  // Data states
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [metrics, setMetrics] = useState({
    totalProducts: 0,
    totalUnits: 0,
    totalCostValue: 0,
    totalSalesValue: 0,
    lowStockCount: 0,
    outOfStockCount: 0,
  });

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStockFilter, setSelectedStockFilter] = useState<StockStatusFilter>('all');

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState<boolean>(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);

  // Active items in modal
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState<FormState>(emptyFormState);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Barcode scanner indicator feedback
  const [lastScannedBarcode, setLastScannedBarcode] = useState<string | null>(null);

  // Load products & categories from local database
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [prods, cats, mets] = await Promise.all([
        productsService.getProducts(),
        productsService.getCategories(),
        productsService.getMetrics(),
      ]);

      setProducts(prods);
      setCategories(cats);
      setMetrics(mets);
    } catch (err: any) {
      showNotification({
        type: 'error',
        title: 'خطأ في تحميل المنتجات',
        message: err?.message || 'تعذر جلب قائمة الأصناف من قاعدة البيانات المحلية',
      });
    } finally {
      setIsLoading(false);
    }
  }, [showNotification]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Barcode scanner integration for rapid lookups
  useBarcodeScanner({
    onScan: scannedCode => {
      setLastScannedBarcode(scannedCode);

      // If Add Modal is open, populate the barcode field directly
      if (isAddModalOpen) {
        setFormData(prev => ({ ...prev, barcode: scannedCode }));
        showNotification({
          type: 'info',
          title: 'تم مسح الباركود',
          message: `تم إدراج الباركود (${scannedCode}) في بطاقة الصنف الجديد`,
        });
        return;
      }

      // If Edit Modal is open, populate barcode
      if (isEditModalOpen) {
        setFormData(prev => ({ ...prev, barcode: scannedCode }));
        showNotification({
          type: 'info',
          title: 'تم مسح الباركود',
          message: `تم تحديث الباركود (${scannedCode}) للصنف الحالي`,
        });
        return;
      }

      // Otherwise, filter table by the scanned barcode
      setSearchQuery(scannedCode);
      showNotification({
        type: 'info',
        title: 'بحث فوري بالباركود',
        message: `جاري البحث عن الصنف المطابق للرمز: ${scannedCode}`,
      });
    },
    enabled: true,
  });

  // Filtered products list
  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      // 1. Text Search (Name, Code, Barcode)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = product.name.toLowerCase().includes(q);
        const matchesCode = product.code.toLowerCase().includes(q);
        const matchesBarcode = product.barcode ? product.barcode.toLowerCase().includes(q) : false;
        if (!matchesName && !matchesCode && !matchesBarcode) return false;
      }

      // 2. Category Filter
      if (selectedCategory !== 'all') {
        if (product.category !== selectedCategory) return false;
      }

      // 3. Stock Status Filter
      if (selectedStockFilter === 'in_stock') {
        if (product.stock <= product.low_stock_threshold) return false;
      } else if (selectedStockFilter === 'low_stock') {
        if (product.stock === 0 || product.stock > product.low_stock_threshold) return false;
      } else if (selectedStockFilter === 'out_of_stock') {
        if (product.stock > 0) return false;
      }

      return true;
    });
  }, [products, searchQuery, selectedCategory, selectedStockFilter]);

  // Form Validation
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.name.trim()) {
      errors.name = 'اسم المنتج مطلوب ولا يمكن تركه فارغاً';
    }

    if (!formData.code.trim()) {
      errors.code = 'كود الصنف مطلوب';
    }

    const costNum = Number(formData.cost);
    if (formData.cost === '' || isNaN(costNum) || costNum < 0) {
      errors.cost = 'سعر التكلفة يجب أن يكون رقماً مساوياً أو أكبر من صفر';
    }

    const priceNum = Number(formData.price);
    if (formData.price === '' || isNaN(priceNum) || priceNum < 0) {
      errors.price = 'سعر البيع يجب أن يكون رقماً مساوياً أو أكبر من صفر';
    }

    const stockNum = Number(formData.stock);
    if (formData.stock === '' || isNaN(stockNum) || stockNum < 0) {
      errors.stock = 'الكمية يجب أن تكون رقماً صحيحاً مساوياً أو أكبر من صفر';
    }

    const thresholdNum = Number(formData.low_stock_threshold);
    if (formData.low_stock_threshold === '' || isNaN(thresholdNum) || thresholdNum < 0) {
      errors.low_stock_threshold = 'حد التنبيه يجب أن يكون رقماً موجباً';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Open Add Modal
  const handleOpenAddModal = () => {
    const nextCodeNumber = products.length + 1;
    const suggestedCode = `PRD-${String(nextCodeNumber).padStart(3, '0')}`;

    setFormData({
      ...emptyFormState,
      code: suggestedCode,
    });
    setFormErrors({});
    setIsAddModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (product: Product) => {
    setSelectedProduct(product);
    setFormData({
      name: product.name,
      code: product.code,
      barcode: product.barcode || '',
      category: product.category || '',
      newCategory: '',
      cost: String(product.cost),
      price: String(product.price),
      stock: String(product.stock),
      low_stock_threshold: String(product.low_stock_threshold),
      description: product.description || '',
    });
    setFormErrors({});
    setIsEditModalOpen(true);
  };

  // Open View Modal
  const handleOpenViewModal = (product: Product) => {
    setSelectedProduct(product);
    setIsViewModalOpen(true);
  };

  // Open Delete Modal
  const handleOpenDeleteModal = (product: Product) => {
    setSelectedProduct(product);
    setIsDeleteModalOpen(true);
  };

  // Submit Add Product
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      const finalCategory =
        formData.category === '__NEW__'
          ? formData.newCategory.trim()
          : formData.category.trim();

      const input: NewProductInput = {
        name: formData.name,
        code: formData.code,
        barcode: formData.barcode || null,
        category: finalCategory || null,
        cost: Number(formData.cost),
        price: Number(formData.price),
        stock: Math.floor(Number(formData.stock)),
        low_stock_threshold: Math.floor(Number(formData.low_stock_threshold)),
        description: formData.description || null,
      };

      const created = await productsService.addProduct(input);
      showNotification({
        type: 'success',
        title: 'تمت إضافة المنتج بنجاح',
        message: `تم حفظ الصنف "${created.name}" في قاعدة بيانات الإكسسوارات المحلية.`,
      });

      setIsAddModalOpen(false);
      await loadData();
    } catch (err: any) {
      showNotification({
        type: 'error',
        title: 'فشل حفظ الصنف',
        message: err?.message || 'حدث خطأ أثناء حفظ الصنف في قاعدة البيانات',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Edit Product
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      const finalCategory =
        formData.category === '__NEW__'
          ? formData.newCategory.trim()
          : formData.category.trim();

      const input: UpdateProductInput = {
        name: formData.name,
        code: formData.code,
        barcode: formData.barcode || null,
        category: finalCategory || null,
        cost: Number(formData.cost),
        price: Number(formData.price),
        stock: Math.floor(Number(formData.stock)),
        low_stock_threshold: Math.floor(Number(formData.low_stock_threshold)),
        description: formData.description || null,
      };

      const updated = await productsService.updateProduct(selectedProduct.id, input);
      showNotification({
        type: 'success',
        title: 'تم تعديل المنتج بنجاح',
        message: `تم تحديث بيانات الصنف "${updated.name}".`,
      });

      setIsEditModalOpen(false);
      await loadData();
    } catch (err: any) {
      showNotification({
        type: 'error',
        title: 'فشل تعديل الصنف',
        message: err?.message || 'حدث خطأ أثناء تعديل الصنف',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Confirm Delete Product
  const handleDeleteConfirm = async () => {
    if (!selectedProduct) return;

    setIsSubmitting(true);
    try {
      await productsService.deleteProduct(selectedProduct.id);
      showNotification({
        type: 'success',
        title: 'تم حذف الصنف',
        message: `تم حذف "${selectedProduct.name}" نهائياً من قاعدة البيانات المحلية.`,
      });
      setIsDeleteModalOpen(false);
      await loadData();
    } catch (err: any) {
      showNotification({
        type: 'error',
        title: 'فشل حذف الصنف',
        message: err?.message || 'حدث خطأ أثناء محاولة حذف الصنف',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Table Columns definition
  const columns: Column<Product>[] = [
    {
      key: 'code',
      header: 'كود الصنف',
      render: item => (
        <span className="font-mono text-xs text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200/70 tabular-nums">
          {item.code}
        </span>
      ),
    },
    {
      key: 'name',
      header: 'اسم المنتج',
      render: item => (
        <div className="flex flex-col">
          <span className="font-medium text-slate-900 text-xs">{item.name}</span>
          {item.description && (
            <span className="text-[11px] text-slate-400 truncate max-w-xs">{item.description}</span>
          )}
        </div>
      ),
    },
    {
      key: 'barcode',
      header: 'الباركود',
      render: item =>
        item.barcode ? (
          <span className="barcode-value text-xs text-slate-600 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200/70 font-mono tabular-nums">
            {item.barcode}
          </span>
        ) : (
          <span className="text-slate-300 text-xs">-</span>
        ),
    },
    {
      key: 'category',
      header: 'التصنيف',
      render: item =>
        item.category ? (
          <Badge variant="default" size="sm">
            {item.category}
          </Badge>
        ) : (
          <span className="text-slate-400 text-xs">عام</span>
        ),
    },
    {
      key: 'cost',
      header: 'سعر التكلفة',
      render: item => <span className="font-mono tabular-nums text-slate-600 text-xs">{formatCurrency(item.cost)}</span>,
    },
    {
      key: 'price',
      header: 'سعر البيع',
      render: item => <span className="font-semibold text-slate-900 font-mono tabular-nums text-xs">{formatCurrency(item.price)}</span>,
    },
    {
      key: 'stock',
      header: 'الرصيد المتاح',
      render: item => {
        if (item.stock === 0) {
          return <Badge variant="danger" size="sm">نفد الرصيد (0)</Badge>;
        }
        if (item.stock <= item.low_stock_threshold) {
          return (
            <Badge variant="warning" size="sm">
              منخفض ({item.stock}) / الحد: {item.low_stock_threshold}
            </Badge>
          );
        }
        return <Badge variant="success" size="sm">{item.stock} قطعة</Badge>;
      },
    },
    {
      key: 'actions',
      header: 'إجراءات',
      align: 'center',
      render: item => (
        <div className="flex items-center justify-center gap-1" onClick={e => e.stopPropagation()}>
          <button
            onClick={() => handleOpenViewModal(item)}
            className="p-1 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded transition-colors"
            title="عرض التفاصيل"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => handleOpenEditModal(item)}
            className="p-1 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded transition-colors"
            title="تعديل الصنف"
          >
            <Edit className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => handleOpenDeleteModal(item)}
            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
            title="حذف الصنف"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="إدارة منتجات وأسعار الإكسسوارات"
        subtitle="قاعدة بيانات SQLite المحلية المستقلة — إدارة الأصناف، الأسعار، الباركود وتنبيهات النواقص"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadData}
              isLoading={isLoading}
              leftIcon={<RefreshCw className="w-3.5 h-3.5 text-slate-500" />}
            >
              تحديث البيانات
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleOpenAddModal}
              leftIcon={<Plus className="w-3.5 h-3.5" />}
            >
              إضافة صنف جديد
            </Button>
          </div>
        }
      />

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <StatsCard
          title="إجمالي عدد الأصناف"
          value={`${metrics.totalProducts} صنف`}
          subtitle={`إجمالي المخزون: ${metrics.totalUnits} قطعة`}
          icon={Package}
        />
        <StatsCard
          title="قيمة المخزون بالتكلفة"
          value={formatCurrency(metrics.totalCostValue)}
          subtitle="رأس المال المستثمر في البضاعة"
          icon={Boxes}
        />
        <StatsCard
          title="القيمة السوقية للبيع"
          value={formatCurrency(metrics.totalSalesValue)}
          subtitle={`ربح مقدر: ${formatCurrency(Math.max(0, metrics.totalSalesValue - metrics.totalCostValue))}`}
          icon={TrendingUp}
        />
        <StatsCard
          title="تنبيهات النواقص والنفاد"
          value={`${metrics.lowStockCount + metrics.outOfStockCount} صنف`}
          subtitle={`منها ${metrics.outOfStockCount} أصناف منعدمة تماماً`}
          icon={AlertTriangle}
        />
      </div>

      {/* Hardware Scanner & Search Alert */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 p-2.5 bg-slate-50 rounded-lg border border-slate-200/90 text-xs text-slate-700">
        <div className="flex items-center gap-2">
          <ScanBarcode className="w-4 h-4 text-slate-600 shrink-0" />
          <span>
            <strong>الماسح الضوئي (Barcode Scanner) نشط:</strong> يمكنك مسح أي باركود للبحث الفوري أو لإدراجه في بطاقة الصنف.
          </span>
        </div>
        {lastScannedBarcode && (
          <span className="font-mono tabular-nums bg-white border border-slate-200 text-slate-800 px-2 py-0.5 rounded text-xs font-medium">
            آخر مسح: {lastScannedBarcode}
          </span>
        )}
      </div>

      {/* Filter and Search Panel */}
      <Card className="p-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5">
          {/* Search Box */}
          <div className="md:col-span-6">
            <Input
              placeholder="ابحث بالاسم، أو كود الصنف، أو امسح الباركود..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onClear={() => setSearchQuery('')}
              leftIcon={<Search className="w-3.5 h-3.5" />}
              scannerReady
            />
          </div>

          {/* Category Dropdown */}
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

          {/* Stock Status Dropdown */}
          <div className="md:col-span-3">
            <Select
              value={selectedStockFilter}
              onChange={e => setSelectedStockFilter(e.target.value as StockStatusFilter)}
            >
              <option value="all">جميع حالات المخزون</option>
              <option value="in_stock">المتوفر بكميات كافية</option>
              <option value="low_stock">المخزون المنخفض (تحت حد الطلب)</option>
              <option value="out_of_stock">المنعدم تماماً (رصيد 0)</option>
            </Select>
          </div>
        </div>

        {/* Active Filters Summary */}
        {(searchQuery || selectedCategory !== 'all' || selectedStockFilter !== 'all') && (
          <div className="flex items-center justify-between pt-2.5 mt-2.5 border-t border-slate-100 text-xs text-slate-500">
            <div>
              تم العثور على <strong className="tabular-nums text-slate-800">{filteredProducts.length}</strong> صنف مطابق للبحث.
            </div>
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('all');
                setSelectedStockFilter('all');
              }}
              className="text-slate-700 hover:text-slate-900 font-medium underline"
            >
              إلغاء التصفية
            </button>
          </div>
        )}
      </Card>

      {/* Products Table */}
      <Table
        columns={columns}
        data={filteredProducts}
        keyExtractor={item => item.id}
        isLoading={isLoading}
        onRowClick={item => handleOpenViewModal(item)}
        emptyMessage="لم يتم العثور على أصناف مطابقة"
        emptySubMessage="تأكد من كتابة الكلمات بشكل صحيح أو قم بإضافة أصناف جديدة إلى قاعدة البيانات."
      />

      {/* ---------------- MODAL 1: ADD PRODUCT ---------------- */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => !isSubmitting && setIsAddModalOpen(false)}
        title="إضافة منتج إكسسوار جديد"
        subtitle="حفظ بطاقة صنف جديدة في قاعدة بيانات SQLite المحلية"
        size="lg"
        footer={
          <>
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
              onClick={handleAddSubmit}
              isLoading={isSubmitting}
              leftIcon={<Plus className="w-3.5 h-3.5" />}
            >
              حفظ المنتج الجديد
            </Button>
          </>
        }
      >
        <form onSubmit={handleAddSubmit} className="space-y-3.5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input
              label="اسم المنتج *"
              placeholder="مثال: شاحن سريع 20 واط Type-C"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              error={formErrors.name}
              autoFocus
            />

            <Input
              label="كود الصنف الداخلي *"
              placeholder="مثال: CHG-20W"
              value={formData.code}
              onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
              error={formErrors.code}
              isMonospace
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input
              label="الباركود (اختياري)"
              placeholder="امسح بالماسح الضوئي أو اكتب الباركود..."
              value={formData.barcode}
              onChange={e => setFormData({ ...formData, barcode: e.target.value })}
              scannerReady
              isMonospace
              leftIcon={<Barcode className="w-3.5 h-3.5" />}
              onClear={() => setFormData({ ...formData, barcode: '' })}
              helperText="يمكن مسحه مباشرة باستخدام قارئ الباركود"
            />

            <div>
              <Select
                label="تصنيف الصنف"
                value={formData.category}
                onChange={e => setFormData({ ...formData, category: e.target.value })}
              >
                <option value="">-- بدون تصنيف (عام) --</option>
                {categories.map(c => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
                <option value="__NEW__">+ إضافة تصنيف جديد...</option>
              </Select>

              {formData.category === '__NEW__' && (
                <div className="mt-2">
                  <Input
                    placeholder="اكتب اسم التصنيف الجديد..."
                    value={formData.newCategory}
                    onChange={e => setFormData({ ...formData, newCategory: e.target.value })}
                  />
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
            <Input
              label="سعر التكلفة (ج.م) *"
              type="number"
              step="0.5"
              min="0"
              placeholder="0.00"
              value={formData.cost}
              onChange={e => setFormData({ ...formData, cost: e.target.value })}
              error={formErrors.cost}
            />

            <Input
              label="سعر البيع (ج.م) *"
              type="number"
              step="0.5"
              min="0"
              placeholder="0.00"
              value={formData.price}
              onChange={e => setFormData({ ...formData, price: e.target.value })}
              error={formErrors.price}
            />

            <Input
              label="الكمية المتوفرة *"
              type="number"
              min="0"
              placeholder="0"
              value={formData.stock}
              onChange={e => setFormData({ ...formData, stock: e.target.value })}
              error={formErrors.stock}
            />

            <Input
              label="حد تنبيه النواقص *"
              type="number"
              min="0"
              placeholder="5"
              value={formData.low_stock_threshold}
              onChange={e => setFormData({ ...formData, low_stock_threshold: e.target.value })}
              error={formErrors.low_stock_threshold}
            />
          </div>

          {Number(formData.price) > 0 && Number(formData.cost) > 0 && (
            <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-700">
              <span className="flex items-center gap-1 font-medium">
                <TrendingUp className="w-3.5 h-3.5 text-slate-500" />
                هامش الربح المتوقع للقطعة:
              </span>
              <span className="font-semibold font-mono tabular-nums text-emerald-800">
                +{formatCurrency(Number(formData.price) - Number(formData.cost))} (
                {Math.round(
                  ((Number(formData.price) - Number(formData.cost)) / Number(formData.cost)) * 100
                )}
                % نسبة زيادة)
              </span>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              ملاحظات أو وصف إضافي (اختياري)
            </label>
            <textarea
              rows={2}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-800 focus:ring-1 focus:ring-slate-800 transition-colors"
              placeholder="أي تفاصيل تخص اللون، التوافق، أو الموديل..."
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
            />
          </div>
        </form>
      </Modal>

      {/* ---------------- MODAL 2: EDIT PRODUCT ---------------- */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => !isSubmitting && setIsEditModalOpen(false)}
        title={`تعديل الصنف: ${selectedProduct?.name || ''}`}
        subtitle="تحديث بيانات الصنف وأسعاره في قاعدة بيانات SQLite المحلية"
        size="lg"
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditModalOpen(false)}
              disabled={isSubmitting}
            >
              إلغاء
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleEditSubmit}
              isLoading={isSubmitting}
            >
              حفظ التعديلات
            </Button>
          </>
        }
      >
        <form onSubmit={handleEditSubmit} className="space-y-3.5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input
              label="اسم المنتج *"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              error={formErrors.name}
            />

            <Input
              label="كود الصنف الداخلي *"
              value={formData.code}
              onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
              error={formErrors.code}
              isMonospace
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input
              label="الباركود (اختياري)"
              value={formData.barcode}
              onChange={e => setFormData({ ...formData, barcode: e.target.value })}
              scannerReady
              isMonospace
              leftIcon={<Barcode className="w-3.5 h-3.5" />}
              onClear={() => setFormData({ ...formData, barcode: '' })}
            />

            <div>
              <Select
                label="تصنيف الصنف"
                value={formData.category}
                onChange={e => setFormData({ ...formData, category: e.target.value })}
              >
                <option value="">-- بدون تصنيف (عام) --</option>
                {categories.map(c => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
                <option value="__NEW__">+ إضافة تصنيف جديد...</option>
              </Select>

              {formData.category === '__NEW__' && (
                <div className="mt-2">
                  <Input
                    placeholder="اكتب اسم التصنيف الجديد..."
                    value={formData.newCategory}
                    onChange={e => setFormData({ ...formData, newCategory: e.target.value })}
                  />
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
            <Input
              label="سعر التكلفة (ج.م) *"
              type="number"
              step="0.5"
              min="0"
              value={formData.cost}
              onChange={e => setFormData({ ...formData, cost: e.target.value })}
              error={formErrors.cost}
            />

            <Input
              label="سعر البيع (ج.م) *"
              type="number"
              step="0.5"
              min="0"
              value={formData.price}
              onChange={e => setFormData({ ...formData, price: e.target.value })}
              error={formErrors.price}
            />

            <Input
              label="الكمية المتوفرة *"
              type="number"
              min="0"
              value={formData.stock}
              onChange={e => setFormData({ ...formData, stock: e.target.value })}
              error={formErrors.stock}
            />

            <Input
              label="حد تنبيه النواقص *"
              type="number"
              min="0"
              value={formData.low_stock_threshold}
              onChange={e => setFormData({ ...formData, low_stock_threshold: e.target.value })}
              error={formErrors.low_stock_threshold}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              ملاحظات أو وصف إضافي
            </label>
            <textarea
              rows={2}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-800 focus:ring-1 focus:ring-slate-800 transition-colors"
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
            />
          </div>
        </form>
      </Modal>

      {/* ---------------- MODAL 3: VIEW PRODUCT DETAILS ---------------- */}
      <Modal
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        title="تفاصيل بطاقة الصنف"
        subtitle={selectedProduct?.name}
        size="md"
        footer={
          <div className="flex items-center justify-between w-full">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIsViewModalOpen(false);
                if (selectedProduct) handleOpenEditModal(selectedProduct);
              }}
              leftIcon={<Edit className="w-3.5 h-3.5" />}
            >
              تعديل بيانات الصنف
            </Button>
            <Button variant="primary" size="sm" onClick={() => setIsViewModalOpen(false)}>
              إغلاق
            </Button>
          </div>
        }
      >
        {selectedProduct && (
          <div className="space-y-3 text-xs">
            <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200/90 space-y-2">
              <div className="flex justify-between items-center py-1 border-b border-slate-200">
                <span className="text-slate-500">اسم المنتج:</span>
                <span className="font-semibold text-slate-900 text-xs">{selectedProduct.name}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-200">
                <span className="text-slate-500">كود الصنف:</span>
                <span className="font-mono font-medium text-slate-900 bg-white border border-slate-200 px-2 py-0.5 rounded tabular-nums">
                  {selectedProduct.code}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-200">
                <span className="text-slate-500">الباركود:</span>
                <span className="font-mono text-slate-700 font-medium tabular-nums">
                  {selectedProduct.barcode || 'غير مسجل'}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-200">
                <span className="text-slate-500">التصنيف:</span>
                <Badge variant="default">{selectedProduct.category || 'عام'}</Badge>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-200">
                <span className="text-slate-500">سعر التكلفة:</span>
                <span className="font-mono text-slate-700 tabular-nums">
                  {formatCurrency(selectedProduct.cost)}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-200">
                <span className="text-slate-500">سعر البيع الافتراضي:</span>
                <span className="font-mono text-slate-900 font-semibold tabular-nums">
                  {formatCurrency(selectedProduct.price)}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-200">
                <span className="text-slate-500">هامش الربح للقطعة:</span>
                <span className="font-semibold text-emerald-800 font-mono tabular-nums">
                  +{formatCurrency(selectedProduct.price - selectedProduct.cost)} (
                  {selectedProduct.cost > 0
                    ? Math.round(
                        ((selectedProduct.price - selectedProduct.cost) / selectedProduct.cost) *
                          100
                      )
                    : 100}
                  %)
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-200">
                <span className="text-slate-500">الرصيد الفعلي الحالي:</span>
                <div>
                  {selectedProduct.stock === 0 ? (
                    <Badge variant="danger" size="sm">نفد الرصيد (0)</Badge>
                  ) : selectedProduct.stock <= selectedProduct.low_stock_threshold ? (
                    <Badge variant="warning" size="sm">
                      رصيد منخفض ({selectedProduct.stock}) / الحد الأدنى:{' '}
                      {selectedProduct.low_stock_threshold}
                    </Badge>
                  ) : (
                    <Badge variant="success" size="sm">{selectedProduct.stock} قطعة متوفرة</Badge>
                  )}
                </div>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-200">
                <span className="text-slate-500">تاريخ الإضافة:</span>
                <span className="text-slate-600 font-mono tabular-nums">{formatDate(selectedProduct.created_at)}</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-500">آخر تحديث:</span>
                <span className="text-slate-600 font-mono tabular-nums">{formatDate(selectedProduct.updated_at)}</span>
              </div>
            </div>

            {selectedProduct.description && (
              <div className="p-3 bg-white rounded-lg border border-slate-200">
                <h5 className="font-medium text-slate-700 mb-1">ملاحظات الصنف:</h5>
                <p className="text-slate-600 leading-relaxed">{selectedProduct.description}</p>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ---------------- MODAL 4: DELETE CONFIRMATION ---------------- */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => !isSubmitting && setIsDeleteModalOpen(false)}
        title="تأكيد حذف الصنف"
        subtitle="تحذير: لا يمكن التراجع عن هذا الإجراء"
        size="sm"
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsDeleteModalOpen(false)}
              disabled={isSubmitting}
            >
              إلغاء
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleDeleteConfirm}
              isLoading={isSubmitting}
            >
              تأكيد الحذف نهائياً
            </Button>
          </>
        }
      >
        {selectedProduct && (
          <div className="space-y-3 text-xs text-slate-700">
            <p>
              هل أنت متأكد من رغبتك في حذف الصنف التالي نهائياً من قاعدة بيانات الإكسسوارات؟
            </p>
            <div className="p-3 bg-slate-50 rounded-lg font-medium text-slate-800 space-y-1 border border-slate-200">
              <div>{selectedProduct.name}</div>
              <div className="text-slate-500 font-mono text-[11px] tabular-nums">
                الكود: {selectedProduct.code} | الرصيد: {selectedProduct.stock} قطعة
              </div>
            </div>
            {selectedProduct.stock > 0 && (
              <p className="text-rose-800 font-medium bg-rose-50 p-2.5 rounded-lg border border-rose-200">
                تنبيه: هذا الصنف يحتوي حالياً على رصيد ({selectedProduct.stock} قطعة) في المحل.
              </p>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};
