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
  Package,
  AlertTriangle,
  Boxes,
  TrendingUp,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useNavigation } from '@/context/NavigationContext';
import { productsService } from '@/services/productsService';
import { Product, NewProductInput, UpdateProductInput, StockStatusFilter } from '@/types/product';
import { generateNextProductCode } from '@/lib/productCodeGenerator';
import { useNotification } from '@/context/NotificationContext';

interface FormState {
  name: string;
  code: string;
  barcode?: string;
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
  const { routeParams, clearRouteParams } = useNavigation();

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
  const [isCodeManuallyEdited, setIsCodeManuallyEdited] = useState<boolean>(false);

  // Consume routeParams when navigating with low_and_out filter
  useEffect(() => {
    if (routeParams?.filter === 'low_and_out') {
      setSelectedStockFilter('low_and_out');
      clearRouteParams();
    }
  }, [routeParams, clearRouteParams]);

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

  // Filtered products list
  const filteredProducts = useMemo(() => {
    const list = products.filter(product => {
      // 1. Text Search (Name, Code)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = product.name.toLowerCase().includes(q);
        const matchesCode = product.code.toLowerCase().includes(q);
        if (!matchesName && !matchesCode) return false;
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
      } else if (selectedStockFilter === 'low_and_out') {
        if (product.stock > product.low_stock_threshold) return false;
      }

      return true;
    });

    // Ascending sort priority when combined low-stock filter is active:
    // 0 first, then 1, 2, 3... up to threshold
    if (selectedStockFilter === 'low_and_out') {
      list.sort((a, b) => {
        if (a.stock !== b.stock) {
          return a.stock - b.stock;
        }
        return a.name.localeCompare(b.name, 'ar');
      });
    }

    return list;
  }, [products, searchQuery, selectedCategory, selectedStockFilter]);

  // Product Name & Code Handlers
  const handleProductNameChange = (newName: string) => {
    setFormData(prev => {
      if (!isCodeManuallyEdited) {
        const nextCode = generateNextProductCode(newName, products);
        return { ...prev, name: newName, code: nextCode };
      }
      return { ...prev, name: newName };
    });
    if (formErrors.name) {
      setFormErrors(prev => ({ ...prev, name: '' }));
    }
  };

  const handleProductCodeChange = (newCode: string) => {
    setIsCodeManuallyEdited(true);
    setFormData(prev => ({ ...prev, code: newCode }));
    const trimmed = newCode.trim();
    const isDup = products.some(
      p => p.id !== selectedProduct?.id && p.code.toLowerCase() === trimmed.toLowerCase()
    );
    if (isDup) {
      setFormErrors(prev => ({
        ...prev,
        code: `كود الصنف "${trimmed}" مسجل مسبقاً لصنف آخر. يرجى اختيار كود فريد.`,
      }));
    } else if (formErrors.code) {
      setFormErrors(prev => ({ ...prev, code: '' }));
    }
  };

  const handleRegenerateCode = () => {
    const nextCode = generateNextProductCode(formData.name, products);
    setFormData(prev => ({ ...prev, code: nextCode }));
    setIsCodeManuallyEdited(false);
    if (formErrors.code) {
      setFormErrors(prev => ({ ...prev, code: '' }));
    }
    showNotification({
      type: 'info',
      title: 'تم توليد كود الصنف',
      message: `تم توليد الكود التلقائي: ${nextCode}`,
    });
  };

  // Form Validation
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.name.trim()) {
      errors.name = 'اسم المنتج مطلوب ولا يمكن تركه فارغاً';
    }

    const codeTrim = formData.code.trim();
    if (!codeTrim) {
      errors.code = 'كود الصنف مطلوب ولا يمكن أن يكون فارغاً';
    } else {
      const isDup = products.some(
        p => p.id !== selectedProduct?.id && p.code.toLowerCase() === codeTrim.toLowerCase()
      );
      if (isDup) {
        errors.code = `كود الصنف "${codeTrim}" مسجل مسبقاً لصنف آخر. يرجى اختيار كود فريد.`;
      }
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
    setIsCodeManuallyEdited(false);
    const suggestedCode = generateNextProductCode('', products);

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
    setIsCodeManuallyEdited(true); // Preserve existing product code unless regenerated
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
        barcode: null,
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
        barcode: selectedProduct.barcode || null,
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
        <span className="font-mono text-sm font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-300 tabular-nums">
          {item.code}
        </span>
      ),
    },
    {
      key: 'name',
      header: 'اسم المنتج',
      render: item => (
        <div className="flex flex-col">
          <span className="font-bold text-slate-900 text-sm">{item.name}</span>
          {item.description && (
            <span className="text-xs text-slate-500 truncate max-w-xs font-medium mt-0.5">{item.description}</span>
          )}
        </div>
      ),
    },
    {
      key: 'category',
      header: 'التصنيف',
      render: item =>
        item.category ? (
          <Badge variant="default" size="md">
            {item.category}
          </Badge>
        ) : (
          <span className="text-slate-500 text-sm font-medium">عام</span>
        ),
    },
    {
      key: 'cost',
      header: 'سعر التكلفة',
      render: item => <span className="font-mono tabular-nums text-slate-700 text-sm font-medium">{formatCurrency(item.cost)}</span>,
    },
    {
      key: 'price',
      header: 'سعر البيع',
      render: item => <span className="font-bold text-slate-900 font-mono tabular-nums text-sm">{formatCurrency(item.price)}</span>,
    },
    {
      key: 'stock',
      header: 'الرصيد المتاح',
      render: item => {
        if (item.stock === 0) {
          return <Badge variant="danger" size="md">نفد الرصيد (0)</Badge>;
        }
        if (item.stock <= item.low_stock_threshold) {
          return (
            <Badge variant="warning" size="md">
              منخفض ({item.stock}) / الحد: {item.low_stock_threshold}
            </Badge>
          );
        }
        return <Badge variant="success" size="md">{item.stock} قطعة</Badge>;
      },
    },
    {
      key: 'actions',
      header: 'إجراءات',
      align: 'center',
      render: item => (
        <div className="flex items-center justify-center gap-1.5" onClick={e => e.stopPropagation()}>
          <button
            onClick={() => handleOpenViewModal(item)}
            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-200/80 rounded-lg transition-colors"
            title="عرض التفاصيل"
          >
            <Eye className="w-4.5 h-4.5" />
          </button>
          <button
            onClick={() => handleOpenEditModal(item)}
            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-200/80 rounded-lg transition-colors"
            title="تعديل الصنف"
          >
            <Edit className="w-4.5 h-4.5" />
          </button>
          <button
            onClick={() => handleOpenDeleteModal(item)}
            className="p-1.5 text-slate-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
            title="حذف الصنف"
          >
            <Trash2 className="w-4.5 h-4.5" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="إدارة منتجات وأسعار الإكسسوارات"
        subtitle=""
        actions={
          <div className="flex items-center gap-2.5">
            <Button
              variant="outline"
              size="md"
              onClick={loadData}
              isLoading={isLoading}
              leftIcon={<RefreshCw className="w-4 h-4 text-slate-600" />}
            >
              Refresh 
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={handleOpenAddModal}
              leftIcon={<Plus className="w-4.5 h-4.5" />}
            >
              إضافة صنف جديد
            </Button>
          </div>
        }
      />

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="إجمالي عدد الأصناف"
          value={`${metrics.totalProducts} صنف`}
          subtitle={`إجمالي المخزون: ${metrics.totalUnits} قطعة`}
          icon={Package}
        />
        <StatsCard
          title="قيمة المخزون بالتكلفة"
          value={formatCurrency(metrics.totalCostValue)}
          subtitle=""
          icon={Boxes}
        />
        <StatsCard
          title="القيمة السوقية للبيع"
          value={formatCurrency(metrics.totalSalesValue)}
          subtitle={`ربح مقدر: ${formatCurrency(Math.max(0, metrics.totalSalesValue - metrics.totalCostValue))}`}
          icon={TrendingUp}
        />
        <div
          onClick={() => setSelectedStockFilter('low_and_out')}
          className="cursor-pointer transition-transform active:scale-[0.99]"
          title="انقر لتصفية كافة النواقص والمنعدم"
        >
          <StatsCard
            title="تنبيهات النواقص والنفاد"
            value={`${metrics.lowStockCount + metrics.outOfStockCount} صنف`}
            subtitle={`نافد: ${metrics.outOfStockCount} | حد أدنى: ${metrics.lowStockCount} (انقر للعرض)`}
            icon={AlertTriangle}
          />
        </div>
      </div>

      {/* Filter and Search Panel */}
      <Card className="p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Search Box */}
          <div className="md:col-span-6">
            <Input
              placeholder="ابحث بالاسم، أو كود الصنف،..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onClear={() => setSearchQuery('')}
              leftIcon={<Search className="w-4.5 h-4.5 text-slate-500" />}
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
              <option value="low_and_out">كافة النواقص والمنعدم (تنبيه + رصيد 0)</option>
              <option value="low_stock">المخزون المنخفض (تحت حد الطلب)</option>
              <option value="out_of_stock">المنعدم تماماً (رصيد 0)</option>
              <option value="in_stock">المتوفر بكميات كافية</option>
            </Select>
          </div>
        </div>

        {/* Active Combined Low-Stock Filter Banner */}
        {selectedStockFilter === 'low_and_out' && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 bg-amber-50 border border-amber-300 rounded-xl text-amber-950 text-sm shadow-xs animate-in fade-in">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0" />
              <div>
                <span className="font-bold">تصفية النواقص والنفاد نشطة: </span>
                <span className="text-amber-900">
                  يتم الآن عرض الأصناف المنعدمة والمنخفضة فقط ({filteredProducts.length} صنف) مرتبة تصاعدياً من الأقل رصيداً إلى حد التنبيه.
                </span>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setSelectedStockFilter('all')}
              className="shrink-0 bg-white border-amber-300 hover:bg-amber-100 text-amber-900 text-xs font-bold"
            >
              إلغاء التصفية وعرض الكل
            </Button>
          </div>
        )}

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
        subtitle=""
        size="lg"
        footer={
          <>
            <Button
              variant="outline"
              size="md"
              onClick={() => setIsAddModalOpen(false)}
              disabled={isSubmitting}
            >
              إلغاء
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={handleAddSubmit}
              isLoading={isSubmitting}
              leftIcon={<Plus className="w-4 h-4" />}
            >
              حفظ المنتج الجديد
            </Button>
          </>
        }
      >
        <form onSubmit={handleAddSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <Input
              label="اسم المنتج *"
              placeholder="مثال: شاحن سريع 20 واط Type-C"
              value={formData.name}
              onChange={e => handleProductNameChange(e.target.value)}
              error={formErrors.name}
              autoFocus
            />

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-semibold text-slate-800">
                  كود الصنف الداخلي <span className="text-rose-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={handleRegenerateCode}
                  className="text-xs text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 hover:underline cursor-pointer"
                  title="إعادة توليد الكود التلقائي بناءً على اسم الصنف"
                >
                  <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                  <span>توليد كود تلقائي</span>
                </button>
              </div>
              <Input
                placeholder="مثال: CHG-001 أو MO-001"
                value={formData.code}
                onChange={e => handleProductCodeChange(e.target.value.toUpperCase())}
                error={formErrors.code}
                isMonospace
              />
              <span className="text-[11px] text-slate-500 mt-1 block">
                {isCodeManuallyEdited
                  ? 'تم تعديل الكود يدوياً (لن يتغير تلقائياً مع الاسم إلا عند النقر على "توليد كود تلقائي")'
                  : 'كود مقترح تلقائياً بناءً على اسم الصنف (يمكنك تعديله يدوياً في أي وقت)'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">

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

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5 p-4 bg-slate-50 rounded-xl border border-slate-300">
            <Input
              label="سعر التكلفة (EGP) *"
              type="number"
              step="0.5"
              min="0"
              placeholder="0.00"
              value={formData.cost}
              onChange={e => setFormData({ ...formData, cost: e.target.value })}
              error={formErrors.cost}
            />

            <Input
              label="سعر البيع (EGP) *"
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
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-300 text-sm text-slate-800">
              <span className="flex items-center gap-1.5 font-bold">
                <TrendingUp className="w-4 h-4 text-slate-600" />
                هامش الربح المتوقع للقطعة:
              </span>
              <span className="font-bold font-mono tabular-nums text-emerald-800">
                +{formatCurrency(Number(formData.price) - Number(formData.cost))} (
                {Math.round(
                  ((Number(formData.price) - Number(formData.cost)) / Number(formData.cost)) * 100
                )}
                % نسبة زيادة)
              </span>
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-slate-800 mb-1.5">
              ملاحظات أو وصف إضافي (اختياري)
            </label>
            <textarea
              rows={2}
              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-colors hover:border-slate-400"
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
              size="md"
              onClick={() => setIsEditModalOpen(false)}
              disabled={isSubmitting}
            >
              إلغاء
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={handleEditSubmit}
              isLoading={isSubmitting}
            >
              حفظ التعديلات
            </Button>
          </>
        }
      >
        <form onSubmit={handleEditSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <Input
              label="اسم المنتج *"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              error={formErrors.name}
            />

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-semibold text-slate-800">
                  كود الصنف الداخلي <span className="text-rose-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={handleRegenerateCode}
                  className="text-xs text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 hover:underline cursor-pointer"
                  title="إعادة توليد الكود التلقائي بناءً على اسم الصنف"
                >
                  <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                  <span>توليد كود تلقائي</span>
                </button>
              </div>
              <Input
                value={formData.code}
                onChange={e => handleProductCodeChange(e.target.value.toUpperCase())}
                error={formErrors.code}
                isMonospace
              />
              <span className="text-[11px] text-slate-500 mt-1 block">
                كود الصنف المحفوظ (يمكنك تعديله يدوياً أو الضغط على "توليد كود تلقائي" لاقتراح كود جديد).
              </span>
            </div>
          </div>

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

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5 p-4 bg-slate-50 rounded-xl border border-slate-300">
            <Input
              label="سعر التكلفة (EGP) *"
              type="number"
              step="0.5"
              min="0"
              value={formData.cost}
              onChange={e => setFormData({ ...formData, cost: e.target.value })}
              error={formErrors.cost}
            />

            <Input
              label="سعر البيع (EGP) *"
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
            <label className="block text-sm font-semibold text-slate-800 mb-1.5">
              ملاحظات أو وصف إضافي
            </label>
            <textarea
              rows={2}
              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-colors hover:border-slate-400"
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
              size="md"
              onClick={() => {
                setIsViewModalOpen(false);
                if (selectedProduct) handleOpenEditModal(selectedProduct);
              }}
              leftIcon={<Edit className="w-4 h-4" />}
            >
              تعديل بيانات الصنف
            </Button>
            <Button variant="primary" size="md" onClick={() => setIsViewModalOpen(false)}>
              إغلاق
            </Button>
          </div>
        }
      >
        {selectedProduct && (
          <div className="space-y-4 text-sm">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-300 space-y-2.5">
              <div className="flex justify-between items-center py-1.5 border-b border-slate-200">
                <span className="text-slate-600 font-medium">اسم المنتج:</span>
                <span className="font-bold text-slate-900 text-sm">{selectedProduct.name}</span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-slate-200">
                <span className="text-slate-600 font-medium">كود الصنف:</span>
                <span className="font-mono font-bold text-slate-900 bg-white border border-slate-300 px-2.5 py-0.5 rounded-md tabular-nums text-sm">
                  {selectedProduct.code}
                </span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-slate-200">
                <span className="text-slate-600 font-medium">التصنيف:</span>
                <Badge variant="default" size="md">{selectedProduct.category || 'عام'}</Badge>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-slate-200">
                <span className="text-slate-600 font-medium">سعر التكلفة:</span>
                <span className="font-mono text-slate-800 tabular-nums font-semibold text-sm">
                  {formatCurrency(selectedProduct.cost)}
                </span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-slate-200">
                <span className="text-slate-600 font-medium">سعر البيع الافتراضي:</span>
                <span className="font-mono text-slate-900 font-bold tabular-nums text-sm">
                  {formatCurrency(selectedProduct.price)}
                </span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-slate-200">
                <span className="text-slate-600 font-medium">هامش الربح للقطعة:</span>
                <span className="font-bold text-emerald-800 font-mono tabular-nums text-sm">
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
              <div className="flex justify-between items-center py-1.5 border-b border-slate-200">
                <span className="text-slate-600 font-medium">الرصيد الفعلي الحالي:</span>
                <div>
                  {selectedProduct.stock === 0 ? (
                    <Badge variant="danger" size="md">نفد الرصيد (0)</Badge>
                  ) : selectedProduct.stock <= selectedProduct.low_stock_threshold ? (
                    <Badge variant="warning" size="md">
                      رصيد منخفض ({selectedProduct.stock}) / الحد الأدنى:{' '}
                      {selectedProduct.low_stock_threshold}
                    </Badge>
                  ) : (
                    <Badge variant="success" size="md">{selectedProduct.stock} قطعة متوفرة</Badge>
                  )}
                </div>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-slate-200">
                <span className="text-slate-600 font-medium">تاريخ الإضافة:</span>
                <span className="text-slate-700 font-mono tabular-nums font-medium text-sm">{formatDate(selectedProduct.created_at)}</span>
              </div>
              <div className="flex justify-between items-center py-1.5">
                <span className="text-slate-600 font-medium">آخر تحديث:</span>
                <span className="text-slate-700 font-mono tabular-nums font-medium text-sm">{formatDate(selectedProduct.updated_at)}</span>
              </div>
            </div>

            {selectedProduct.description && (
              <div className="p-4 bg-white rounded-xl border border-slate-300">
                <h5 className="font-bold text-slate-800 mb-1 text-sm">ملاحظات الصنف:</h5>
                <p className="text-slate-700 leading-relaxed text-sm">{selectedProduct.description}</p>
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
              size="md"
              onClick={() => setIsDeleteModalOpen(false)}
              disabled={isSubmitting}
            >
              إلغاء
            </Button>
            <Button
              variant="danger"
              size="md"
              onClick={handleDeleteConfirm}
              isLoading={isSubmitting}
            >
              تأكيد الحذف نهائياً
            </Button>
          </>
        }
      >
        {selectedProduct && (
          <div className="space-y-3.5 text-sm text-slate-800">
            <p className="leading-relaxed">
              هل أنت متأكد من رغبتك في حذف الصنف التالي نهائياً من قاعدة بيانات الإكسسوارات؟
            </p>
            <div className="p-3.5 bg-slate-50 rounded-xl font-bold text-slate-900 space-y-1.5 border border-slate-300">
              <div className="text-base">{selectedProduct.name}</div>
              <div className="text-slate-600 font-mono text-xs font-semibold tabular-nums">
                الكود: {selectedProduct.code} | الرصيد: {selectedProduct.stock} قطعة
              </div>
            </div>
            {selectedProduct.stock > 0 && (
              <p className="text-rose-900 font-semibold bg-rose-50 p-3 rounded-xl border border-rose-300 text-sm leading-relaxed">
                تنبيه: هذا الصنف يحتوي حالياً على رصيد ({selectedProduct.stock} قطعة) في المحل.
              </p>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};
