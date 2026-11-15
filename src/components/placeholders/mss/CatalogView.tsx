import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { Select } from '@/components/common/Select';
import { Card } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { Modal } from '@/components/common/Modal';
import { Spinner } from '@/components/common/Spinner';
import {
  Plus,
  Search,
  Laptop,
  Monitor,
  Store,
  Layers,
  Edit,
  Trash2,
  Cpu,
  Tv,
  CheckCircle,
  LayoutGrid,
  List,
  RefreshCw,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { useNotification } from '@/context/NotificationContext';
import { mssCatalogService } from '@/services/mssCatalogService.ts';
import type {
  MSSCatalogModel,
  NewMSSModelInput,
  MSSModelAvailability,
  MSSCategory,
} from '@/types/mssCatalog.ts';

const CATEGORIES: { id: string; label: string }[] = [
  { id: 'ALL', label: 'جميع الموديلات' },
  { id: 'لابتوب', label: 'لابتوب' },
  { id: 'شاشة', label: 'شاشات' },
  { id: 'أخرى', label: 'أخرى / ملحقات' },
];

export const CatalogView: React.FC = () => {
  const { showNotification } = useNotification();

  const [models, setModels] = useState<MSSCatalogModel[]>([]);
  const [availability, setAvailability] = useState<Record<string, MSSModelAvailability>>({});
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  // Add / Edit Modal state
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingModel, setEditingModel] = useState<MSSCatalogModel | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Form Fields
  const [brand, setBrand] = useState<string>('');
  const [modelName, setModelName] = useState<string>('');
  const [category, setCategory] = useState<MSSCategory>('لابتوب');
  const [processor, setProcessor] = useState<string>('');
  const [ram, setRam] = useState<string>('');
  const [storage, setStorage] = useState<string>('');
  const [screenSize, setScreenSize] = useState<string>('');
  const [specifications, setSpecifications] = useState<string>('');
  const [defaultListPrice, setDefaultListPrice] = useState<number>(0);

  // Delete Confirmation
  const [modelToDelete, setModelToDelete] = useState<MSSCatalogModel | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [modelsList, availMap] = await Promise.all([
        mssCatalogService.getModels(searchQuery, selectedCategory),
        mssCatalogService.getAvailabilityMap(),
      ]);
      setModels(modelsList);
      setAvailability(availMap);
    } catch (err) {
      console.warn('Failed to load catalog data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, selectedCategory]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Open modal for new model
  const handleOpenAddModal = () => {
    setEditingModel(null);
    setBrand('');
    setModelName('');
    setCategory('لابتوب');
    setProcessor('');
    setRam('');
    setStorage('');
    setScreenSize('');
    setSpecifications('');
    setDefaultListPrice(0);
    setIsModalOpen(true);
  };

  // Open modal for editing model
  const handleOpenEditModal = (model: MSSCatalogModel) => {
    setEditingModel(model);
    setBrand(model.brand);
    setModelName(model.model_name);
    setCategory(model.category);
    setProcessor(model.processor || '');
    setRam(model.ram || '');
    setStorage(model.storage || '');
    setScreenSize(model.screen_size || '');
    setSpecifications(model.specifications || '');
    setDefaultListPrice(model.default_list_price);
    setIsModalOpen(true);
  };

  // Submit form (Create or Update)
  const handleSubmitModel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!brand.trim()) {
      showNotification({
        type: 'warning',
        title: 'الماركة مطلوبة',
        message: 'يرجى كتابة ماركة الجهاز (مثل: Dell, HP, Lenovo)',
      });
      return;
    }

    if (!modelName.trim()) {
      showNotification({
        type: 'warning',
        title: 'اسم الموديل مطلوب',
        message: 'يرجى كتابة اسم الموديل (مثل: ThinkPad T480)',
      });
      return;
    }

    if (defaultListPrice < 0) {
      showNotification({
        type: 'warning',
        title: 'السعر غير صالح',
        message: 'السعر الاسترشادي لا يمكن أن يكون سالباً',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const inputData: NewMSSModelInput = {
        brand: brand.trim(),
        model_name: modelName.trim(),
        category,
        processor: processor.trim() || undefined,
        ram: ram.trim() || undefined,
        storage: storage.trim() || undefined,
        screen_size: screenSize.trim() || undefined,
        specifications: specifications.trim() || undefined,
        default_list_price: defaultListPrice,
      };

      if (editingModel) {
        await mssCatalogService.updateModel(editingModel.id, inputData);
        showNotification({
          type: 'success',
          title: 'تم تحديث الموديل بنجاح',
          message: `تم حفظ تعديلات موديل ${inputData.brand} ${inputData.model_name}`,
        });
      } else {
        await mssCatalogService.createModel(inputData);
        showNotification({
          type: 'success',
          title: 'تمت إضافة الموديل للكتالوج',
          message: `تم تسجيل الموديل ${inputData.brand} ${inputData.model_name} بنجاح`,
        });
      }

      setIsModalOpen(false);
      await loadData();
    } catch (err: any) {
      showNotification({
        type: 'error',
        title: 'فشل حفظ الموديل',
        message: err.message || 'حدث خطأ أثناء الاتصال بقاعدة البيانات',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete model
  const handleConfirmDelete = async () => {
    if (!modelToDelete) return;
    try {
      await mssCatalogService.deleteModel(modelToDelete.id);
      showNotification({
        type: 'success',
        title: 'تم حذف الموديل',
        message: `تم حذف الموديل ${modelToDelete.brand} ${modelToDelete.model_name} من الكتالوج`,
      });
      setModelToDelete(null);
      await loadData();
    } catch (err: any) {
      showNotification({
        type: 'error',
        title: 'فشل حذف الموديل',
        message: err.message || 'لا يمكن حذف الموديل لارتباطه بأجهزة في المخزن',
      });
    }
  };

  // KPI stats
  const stats = useMemo(() => {
    const totalCount = models.length;
    const laptops = models.filter(m => m.category === 'لابتوب').length;
    const monitors = models.filter(m => m.category === 'شاشة').length;

    let totalAvailShop1 = 0;
    let totalAvailShop2 = 0;
    Object.values(availability).forEach(a => {
      totalAvailShop1 += a.available_shop1;
      totalAvailShop2 += a.available_shop2;
    });

    return { totalCount, laptops, monitors, totalAvailShop1, totalAvailShop2 };
  }, [models, availability]);

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <PageHeader
        title="كتالوج موديلات الأجهزة"
        subtitle="المواصفات الفنية الموحدة والأسعار الاسترشادية المشتركة والأرصدة المتوفرة بين المحلين"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="md"
              onClick={loadData}
              isLoading={isLoading}
              leftIcon={<RefreshCw className="w-4.5 h-4.5 text-slate-600" />}
              className="border-slate-300 font-semibold"
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
              إضافة موديل جديد
            </Button>
          </div>
        }
      />

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 bg-white border-slate-300 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600">إجمالي الموديلات</span>
            <Layers className="w-5 h-5 text-slate-500" />
          </div>
          <p className="text-xl font-bold text-slate-900 font-mono tabular-nums mt-2.5">{stats.totalCount}</p>
          <p className="text-xs text-slate-500 mt-1">موديل مسجل بالكتالوج</p>
        </Card>

        <Card className="p-4 bg-white border-slate-300 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600">موديلات اللابتوب</span>
            <Laptop className="w-5 h-5 text-slate-500" />
          </div>
          <p className="text-xl font-bold text-slate-900 font-mono tabular-nums mt-2.5">{stats.laptops}</p>
          <p className="text-xs text-slate-500 mt-1">موديلات أجهزة محمولة</p>
        </Card>

        <Card className="p-4 bg-white border-slate-300 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600">موديلات الشاشات</span>
            <Monitor className="w-5 h-5 text-slate-500" />
          </div>
          <p className="text-xl font-bold text-slate-900 font-mono tabular-nums mt-2.5">{stats.monitors}</p>
          <p className="text-xs text-slate-500 mt-1">شاشات عرض احترافية</p>
        </Card>

        <Card className="p-4 bg-white border-slate-300 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600">الأجهزة المتاحة بالمحلين</span>
            <Store className="w-5 h-5 text-slate-500" />
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-xs font-mono tabular-nums font-bold text-slate-800 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-300">
              محل 1: {stats.totalAvailShop1}
            </span>
            <span className="text-xs font-mono tabular-nums font-bold text-slate-800 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-300">
              محل 2: {stats.totalAvailShop2}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">جاهزة للبيع فوراً</p>
        </Card>
      </div>

      {/* Filter & Search Toolbar */}
      <Card className="p-3.5 bg-white border-slate-300 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Search Input */}
          <div className="w-full md:w-96">
            <Input
              placeholder="ابحث بالماركة، الموديل، المعالج، الرام، أو المواصفات..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onClear={() => setSearchQuery('')}
              leftIcon={<Search className="w-4.5 h-4.5 text-slate-500" />}
            />
          </div>

          {/* Category Filter Segmented Control */}
          <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-300 text-sm gap-1">
            {CATEGORIES.map(c => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedCategory(c.id)}
                className={`px-3.5 py-1.5 rounded-lg font-semibold transition-all whitespace-nowrap ${
                  selectedCategory === c.id
                    ? 'bg-white text-slate-900 shadow-subtle font-bold border border-slate-300'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          {/* View Toggle */}
          <div className="inline-flex rounded-xl border border-slate-300 bg-slate-100 p-1 gap-1">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`p-2 rounded-lg transition-all ${
                viewMode === 'table' ? 'bg-white text-slate-900 shadow-subtle border border-slate-300' : 'text-slate-500 hover:text-slate-900'
              }`}
              title="عرض كجدول"
            >
              <List className="w-4.5 h-4.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`p-2 rounded-lg transition-all ${
                viewMode === 'cards' ? 'bg-white text-slate-900 shadow-subtle border border-slate-300' : 'text-slate-500 hover:text-slate-900'
              }`}
              title="عرض كبطاقات"
            >
              <LayoutGrid className="w-4.5 h-4.5" />
            </button>
          </div>
        </div>
      </Card>

      {/* Models Listing */}
      {isLoading ? (
        <div className="p-16 flex flex-col items-center justify-center bg-white rounded-xl border border-slate-300">
          <Spinner size="lg" />
          <p className="text-sm font-medium text-slate-600 mt-3">جارٍ تحميل كتالوج الموديلات السحابي...</p>
        </div>
      ) : models.length === 0 ? (
        <div className="p-16 text-center bg-white rounded-xl border border-slate-300 space-y-2.5">
          <Layers className="w-10 h-10 text-slate-400 mx-auto" />
          <p className="text-sm font-bold text-slate-800">لا توجد موديلات مطابقة في الكتالوج</p>
          <p className="text-xs text-slate-500">
            يمكنك إضافة موديل لابتوب أو شاشة جديد بالضغط على زر الإضافة أعلاه
          </p>
        </div>
      ) : viewMode === 'table' ? (
        /* ==================== TABLE VIEW ==================== */
        <div className="bg-white rounded-xl border border-slate-300 overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead className="bg-slate-100 text-xs font-bold text-slate-700 border-b border-slate-300">
                <tr>
                  <th className="py-3 px-3.5">الماركة والموديل</th>
                  <th className="py-3 px-3.5">النوع</th>
                  <th className="py-3 px-3.5">المعالج والرام</th>
                  <th className="py-3 px-3.5">الهارد والشاشة</th>
                  <th className="py-3 px-3.5 text-left">السعر الاسترشادي</th>
                  <th className="py-3 px-3.5 text-center">الرصيد الفعلي (محل 1 / محل 2)</th>
                  <th className="py-3 px-3.5 text-center w-24">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {models.map(m => {
                  const avail = availability[m.id] || {
                    available_shop1: 0,
                    available_shop2: 0,
                    total_available: 0,
                  };

                  return (
                    <tr key={m.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-3.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-300">
                            {m.brand}
                          </span>
                          <span className="font-bold text-slate-900 text-sm">{m.model_name}</span>
                        </div>
                        {m.specifications && (
                          <p className="text-xs text-slate-500 mt-1 line-clamp-1 max-w-xs">
                            {m.specifications}
                          </p>
                        )}
                      </td>

                      <td className="py-3 px-3.5">
                        <Badge variant="default" size="sm" className="font-semibold">
                          {m.category}
                        </Badge>
                      </td>

                      <td className="py-3 px-3.5">
                        <div className="space-y-0.5">
                          {m.processor && m.processor !== '-' && (
                            <p className="font-mono font-semibold text-slate-900 text-xs">{m.processor}</p>
                          )}
                          {m.ram && m.ram !== '-' && (
                            <p className="font-mono text-slate-600 text-xs">{m.ram}</p>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-3.5">
                        <div className="space-y-0.5">
                          {m.storage && m.storage !== '-' && (
                            <p className="font-mono font-semibold text-slate-900 text-xs">{m.storage}</p>
                          )}
                          {m.screen_size && m.screen_size !== '-' && (
                            <p className="text-slate-600 text-xs font-medium">{m.screen_size}</p>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-3.5 text-left font-mono font-bold text-slate-900 text-sm tabular-nums">
                        {formatCurrency(m.default_list_price)}
                      </td>

                      {/* Separate shop availability display */}
                      <td className="py-3 px-3.5 text-center">
                        <div className="inline-flex items-center gap-1.5 font-bold text-xs font-mono tabular-nums">
                          <span className="px-2.5 py-1 rounded border bg-slate-100 text-slate-800 border-slate-300">
                            محل 1: {avail.available_shop1}
                          </span>
                          <span className="px-2.5 py-1 rounded border bg-slate-100 text-slate-800 border-slate-300">
                            محل 2: {avail.available_shop2}
                          </span>
                          <span className="text-slate-500 text-xs font-semibold">
                            (إجمالي {avail.total_available})
                          </span>
                        </div>
                      </td>

                      <td className="py-3 px-3.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(m)}
                            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
                            title="تعديل الموديل والسعر"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setModelToDelete(m)}
                            className="p-1.5 text-slate-400 hover:text-rose-700 hover:bg-rose-50 rounded-md transition-colors"
                            title="حذف من الكتالوج"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* ==================== CARD VIEW ==================== */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {models.map(m => {
            const avail = availability[m.id] || {
              available_shop1: 0,
              available_shop2: 0,
              total_available: 0,
            };

            return (
              <Card key={m.id} className="bg-white border-slate-300 shadow-2xs p-4 space-y-3.5">
                <div className="flex items-start justify-between gap-2 border-b border-slate-200 pb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-300">
                        {m.brand}
                      </span>
                      <Badge variant="default" size="sm" className="font-semibold">
                        {m.category}
                      </Badge>
                    </div>
                    <h4 className="font-bold text-slate-900 text-sm">{m.model_name}</h4>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(m)}
                      className="p-1.5 text-slate-500 hover:text-slate-900 rounded-md transition-colors"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setModelToDelete(m)}
                      className="p-1.5 text-slate-400 hover:text-rose-700 rounded-md transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Specs Box */}
                <div className="space-y-2 text-sm">
                  {m.processor && m.processor !== '-' && (
                    <div className="flex items-center gap-2 text-slate-700">
                      <Cpu className="w-4 h-4 text-slate-500 shrink-0" />
                      <span className="font-mono font-semibold text-xs truncate">{m.processor}</span>
                    </div>
                  )}
                  {m.ram && m.ram !== '-' && (
                    <div className="flex items-center gap-2 text-slate-700">
                      <Layers className="w-4 h-4 text-slate-500 shrink-0" />
                      <span className="font-mono text-xs font-medium">{m.ram}</span>
                      {m.storage && m.storage !== '-' && (
                        <span className="font-mono text-slate-500 text-xs">| {m.storage}</span>
                      )}
                    </div>
                  )}
                  {m.screen_size && m.screen_size !== '-' && (
                    <div className="flex items-center gap-2 text-slate-700">
                      <Tv className="w-4 h-4 text-slate-500 shrink-0" />
                      <span className="text-xs font-medium">{m.screen_size}</span>
                    </div>
                  )}
                  {m.specifications && (
                    <p className="text-xs text-slate-500 pt-1.5 border-t border-slate-200 line-clamp-2">
                      {m.specifications}
                    </p>
                  )}
                </div>

                {/* Availability and Price footer */}
                <div className="pt-2.5 border-t border-slate-200 flex items-center justify-between">
                  <div>
                    <span className="text-xs text-slate-500 block mb-0.5 font-semibold">السعر الاسترشادي:</span>
                    <span className="font-mono font-bold text-slate-900 text-sm tabular-nums">
                      {formatCurrency(m.default_list_price)}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs font-mono font-bold tabular-nums">
                    <span className="px-2 py-0.5 rounded border bg-slate-100 text-slate-800 border-slate-300">
                      م1: {avail.available_shop1}
                    </span>
                    <span className="px-2 py-0.5 rounded border bg-slate-100 text-slate-800 border-slate-300">
                      م2: {avail.available_shop2}
                    </span>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add / Edit Model Modal */}
      {isModalOpen && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => !isSubmitting && setIsModalOpen(false)}
          title={editingModel ? `تعديل الموديل: ${editingModel.brand} ${editingModel.model_name}` : 'إضافة موديل جديد للكتالوج المشترك'}
          subtitle="المواصفات الفنية الموحدة والأسعار الاسترشادية لأجهزة اللابتوب والشاشات"
          size="lg"
          footer={
            <div className="flex items-center justify-between w-full">
              <Button
                variant="outline"
                size="md"
                onClick={() => setIsModalOpen(false)}
                disabled={isSubmitting}
                className="border-slate-300 font-semibold"
              >
                إلغاء
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={handleSubmitModel}
                disabled={isSubmitting}
                leftIcon={isSubmitting ? <Spinner size="sm" /> : <CheckCircle className="w-4.5 h-4.5" />}
                className="font-bold"
              >
                {isSubmitting ? 'جارٍ الحفظ...' : editingModel ? 'حفظ التعديلات' : 'إضافة الموديل للكتالوج'}
              </Button>
            </div>
          }
        >
          <form onSubmit={handleSubmitModel} className="space-y-4 text-sm">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1 text-xs">
                  الماركة (Brand) <span className="text-rose-500">*</span>
                </label>
                <Input
                  placeholder="مثال: Lenovo, Dell, HP..."
                  value={brand}
                  onChange={e => setBrand(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1 text-xs">
                  اسم الموديل (Model Name) <span className="text-rose-500">*</span>
                </label>
                <Input
                  placeholder="مثال: ThinkPad T480..."
                  value={modelName}
                  onChange={e => setModelName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1 text-xs">النوع</label>
                <Select
                  value={category}
                  onChange={e => setCategory(e.target.value as MSSCategory)}
                  options={[
                    { value: 'لابتوب', label: 'لابتوب' },
                    { value: 'شاشة', label: 'شاشة' },
                    { value: 'أخرى', label: 'أخرى / ملحقات' },
                  ]}
                />
              </div>
            </div>

            {/* Hardware Specs Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3 border-t border-slate-200">
              <div>
                <label className="font-bold text-slate-700 block mb-1 text-xs">المعالج (CPU)</label>
                <Input
                  placeholder="مثال: Intel Core i5-8350U, i7-1185G7..."
                  value={processor}
                  onChange={e => setProcessor(e.target.value)}
                  className="font-mono text-sm"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1 text-xs">الذاكرة العشوائية (RAM)</label>
                <Input
                  placeholder="مثال: 16 GB DDR4, 32 GB..."
                  value={ram}
                  onChange={e => setRam(e.target.value)}
                  className="font-mono text-sm"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1 text-xs">سعة التخزين (Storage)</label>
                <Input
                  placeholder="مثال: 512 GB NVMe SSD, 1 TB..."
                  value={storage}
                  onChange={e => setStorage(e.target.value)}
                  className="font-mono text-sm"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1 text-xs">حجم ومواصفات الشاشة</label>
                <Input
                  placeholder='مثال: 14" FHD IPS, 24" 144Hz...'
                  value={screenSize}
                  onChange={e => setScreenSize(e.target.value)}
                />
              </div>
            </div>

            {/* Price and Details */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3 border-t border-slate-200">
              <div>
                <label className="font-bold text-slate-700 block mb-1 text-xs">
                  السعر الاسترشادي المشترك
                </label>
                <Input
                  type="number"
                  min="0"
                  step="50"
                  value={defaultListPrice}
                  onChange={e => setDefaultListPrice(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="font-mono font-bold"
                  required
                />
                <p className="text-xs text-slate-500 mt-1">سعر العرض المعتمد بين المحلين</p>
              </div>

              <div className="md:col-span-2">
                <label className="font-bold text-slate-700 block mb-1 text-xs">
                  مواصفات وتجهيزات إضافية
                </label>
                <Input
                  placeholder="مثال: كيبورد مضيئة، بصمة إصبع، شاحن تايب سي 65 واط أصلي..."
                  value={specifications}
                  onChange={e => setSpecifications(e.target.value)}
                />
              </div>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      {modelToDelete && (
        <Modal
          isOpen={!!modelToDelete}
          onClose={() => setModelToDelete(null)}
          title="تأكيد حذف الموديل من الكتالوج"
          subtitle="هل أنت متأكد من رغبتك في حذف هذا الموديل؟"
          size="sm"
          footer={
            <div className="flex items-center justify-between w-full">
              <Button variant="outline" size="md" onClick={() => setModelToDelete(null)} className="border-slate-300 font-semibold">
                إلغاء
              </Button>
              <Button
                variant="danger"
                size="md"
                onClick={handleConfirmDelete}
                className="font-bold"
              >
                تأكيد الحذف
              </Button>
            </div>
          }
        >
          <div className="text-sm space-y-2">
            <p className="text-slate-800">
              سيتم حذف الموديل <strong>{modelToDelete.brand} {modelToDelete.model_name}</strong> من الكتالوج.
            </p>
            <p className="text-slate-500 text-xs">
              ملاحظة: تمنع قاعدة البيانات حذف أي موديل إذا كان مسجلاً له أجهزة فعلية في المخزن لحماية سلامة البيانات.
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
};
