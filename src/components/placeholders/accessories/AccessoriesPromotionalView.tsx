import React, { useState, useEffect } from 'react';
import {
  Laptop,
  Plus,
  Check,
  X,
  Trash2,
  Edit3,
  RotateCcw,
  Sparkles,
  Info,
  ShieldCheck,
  Cpu,
  Layers,
  HardDrive,
  Monitor,
  Tag,
  Hash,
} from 'lucide-react';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { useNotification } from '@/context/NotificationContext';
import { MSSPromotionalGenerator } from '@/components/placeholders/mss/MSSPromotionalGenerator';
import {
  accessoriesPromotionalService,
  ManualDeviceInput,
} from '@/services/accessoriesPromotionalService';
import type { PromotionalLaptopItem } from '@/types/mssPromotional';

const POPULAR_BRANDS = [
  'HP',
  'Dell',
  'Lenovo',
  'Apple',
  'Asus',
  'Acer',
  'MSI',
  'Microsoft',
  'Samsung',
  'Toshiba',
  'أخرى',
];

const INITIAL_FORM: ManualDeviceInput = {
  brand: 'HP',
  model_name: '',
  processor: '',
  generation: '',
  ram: '',
  storage: '',
  gpu: '',
  screen: '',
  price: '',
  quantity: '1',
  notes: '',
};

export const AccessoriesPromotionalView: React.FC = () => {
  const { showNotification } = useNotification();

  // 1. Manually entered promotional devices state (completely independent from inventory)
  const [manualItems, setManualItems] = useState<PromotionalLaptopItem[]>(() => {
    return accessoriesPromotionalService.loadManualPromotionalDevices();
  });

  // 2. Form state for adding/editing a promotional device
  const [formData, setFormData] = useState<ManualDeviceInput>(INITIAL_FORM);
  const [customBrand, setCustomBrand] = useState<string>('');
  const [editingId, setEditingId] = useState<string | null>(null);

  // Sync to local storage whenever manualItems changes
  useEffect(() => {
    accessoriesPromotionalService.saveManualPromotionalDevices(manualItems);
  }, [manualItems]);

  // Handle field change in manual form
  const handleFieldChange = (field: keyof ManualDeviceInput, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Reset form to blank template
  const handleResetForm = () => {
    setFormData(INITIAL_FORM);
    setCustomBrand('');
    setEditingId(null);
  };

  // Handle adding or updating device
  const handleSubmitDevice = (e: React.FormEvent) => {
    e.preventDefault();

    const effectiveBrand = formData.brand === 'أخرى'
      ? (customBrand.trim() || '---')
      : (formData.brand || '---');

    const modelName = (formData.model_name || '').trim();
    const processor = (formData.processor || '').trim();

    // Flexible validation: require at least a model name or processor so device is identifiable
    if (!modelName && !processor) {
      showNotification({
        type: 'warning',
        title: 'بيانات غير مكتملة',
        message: 'يرجى كتابة اسم الموديل أو المعالج على الأقل لإضافة الجهاز.',
      });
      return;
    }

    // Validate price if entered (must be a valid non-negative number)
    if (formData.price !== '' && formData.price !== undefined && formData.price !== null) {
      const p = Number(formData.price);
      if (isNaN(p) || p < 0) {
        showNotification({
          type: 'error',
          title: 'قيمة السعر غير صحيحة',
          message: 'يرجى إدخال سعر صحيح كرقم موجب.',
        });
        return;
      }
    }

    // Validate quantity if entered (must be a valid non-negative integer)
    if (formData.quantity !== '' && formData.quantity !== undefined && formData.quantity !== null) {
      const q = Number(formData.quantity);
      if (isNaN(q) || q < 0) {
        showNotification({
          type: 'error',
          title: 'الكمية غير صحيحة',
          message: 'يرجى إدخال كمية صحيحة كرقم موجب.',
        });
        return;
      }
    }

    const payload: ManualDeviceInput = {
      ...formData,
      brand: effectiveBrand,
    };

    if (editingId) {
      // Update existing item
      const updatedItem = accessoriesPromotionalService.createPromotionalItemFromManual(payload, editingId);
      setManualItems(prev => prev.map(item => (item.id === editingId ? updatedItem : item)));
      setEditingId(null);
      handleResetForm();
      showNotification({
        type: 'success',
        title: 'تم تحديث بيانات الجهاز',
        message: `تم تحديث مواصفات الجهاز (${modelName || effectiveBrand}) بنجاح في القائمة الدعائية.`,
      });
    } else {
      // Add new item
      const newItem = accessoriesPromotionalService.createPromotionalItemFromManual(payload);
      setManualItems(prev => [newItem, ...prev]);
      handleResetForm();
      showNotification({
        type: 'success',
        title: 'تمت إضافة الجهاز بنجاح',
        message: `تمت إضافة (${newItem.brand} ${newItem.model_name}) إلى القائمة الدعائية. يمكنك إضافة أجهزة أخرى أو معاينة التصميم.`,
      });
    }
  };

  // Start editing an item from the table
  const handleEditItem = (item: PromotionalLaptopItem) => {
    setEditingId(item.id);
    const isStandardBrand = POPULAR_BRANDS.includes(item.brand);
    setFormData({
      brand: isStandardBrand ? item.brand : 'أخرى',
      model_name: item.model_name !== '---' ? item.model_name : '',
      processor: item.processor !== '---' ? item.processor : '',
      generation: item.generation || '',
      ram: item.ram !== '---' ? item.ram : '',
      storage: item.storage !== '---' ? item.storage : '',
      gpu: item.gpu !== '---' ? item.gpu : '',
      screen: item.screen !== '---' ? item.screen : '',
      price: item.price !== undefined ? String(item.price) : '',
      quantity: item.quantity !== undefined ? String(item.quantity) : '1',
      notes: item.notes || '',
    });
    setCustomBrand(isStandardBrand ? '' : item.brand);

    // Scroll up smoothly to the form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Delete an item from the list
  const handleDeleteItem = (id: string) => {
    const target = manualItems.find(it => it.id === id);
    setManualItems(prev => prev.filter(it => it.id !== id));
    if (editingId === id) {
      handleResetForm();
    }
    showNotification({
      type: 'info',
      title: 'تم حذف الجهاز',
      message: `تم حذف الجهاز (${target?.model_name || target?.brand || ''}) من القائمة الدعائية.`,
    });
  };

  // Clear all items with confirmation
  const handleClearAllItems = () => {
    if (manualItems.length === 0) return;
    if (window.confirm('هل أنت متأكد من رغبتك في مسح كافة الأجهزة من القائمة الدعائية؟')) {
      setManualItems([]);
      handleResetForm();
      showNotification({
        type: 'info',
        title: 'تم مسح القائمة الدعائية',
        message: 'تم إفراغ كافة الأجهزة المدخلة يدوياً.',
      });
    }
  };

  return (
    <div className="space-y-6 pb-12 select-none" dir="rtl">
      {/* 1. Page Header */}
      <div className="flex items-center justify-between flex-wrap gap-4 bg-white p-5 rounded-2xl border border-slate-300 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-blue-600/10 border border-blue-200 text-blue-700 flex items-center justify-center shrink-0">
            <Sparkles className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900">الصورة الدعائية</h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-800 border border-blue-200">
                إكسسوارات — إدخال يدوي مخصص
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-1">
              إنشاء وتخصيص عروض وصور دعائية عالية الدقة للترويج على السوشيال ميديا وقوائم الأسعار بشكل مستقل تماماً.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200 text-xs">
            <span className="font-semibold text-slate-600">الأجهزة المضافة حالياً:</span>
            <span className="font-bold font-mono text-blue-700 text-sm tabular-nums">
              {manualItems.length}
            </span>
          </div>

          {manualItems.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearAllItems}
              leftIcon={<Trash2 className="w-3.5 h-3.5 text-red-600" />}
              className="text-xs font-semibold text-red-600 border-red-200 hover:bg-red-50"
            >
              مسح كافة الأجهزة
            </Button>
          )}
        </div>
      </div>

      {/* 2. Manual Device Entry Form Card */}
      <Card
        className={`border transition-all ${
          editingId
            ? 'border-amber-300 ring-2 ring-amber-100 bg-amber-50/20'
            : 'border-slate-300 bg-white'
        }`}
      >
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  editingId ? 'bg-amber-100 text-amber-700' : 'bg-blue-50 text-blue-700'
                }`}
              >
                {editingId ? <Edit3 className="w-4 h-4" /> : <Laptop className="w-4 h-4" />}
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900">
                  {editingId ? 'تعديل بيانات الجهاز المحدد' : 'إضافة جهاز جديد للإعلان الترويجي'}
                </h3>
                <p className="text-[11px] text-slate-500">
                  أدخل مواصفات الجهاز يدوياً؛ يتم حفظ البيانات محلياً وبشكل مستقل دون التأثير على المخزون الفعلي.
                </p>
              </div>
            </div>

            {editingId && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                جاري التعديل الآن
              </span>
            )}
          </div>

          <form onSubmit={handleSubmitDevice} className="space-y-4">
            {/* Row 1: Brand, Model, Processor, Generation */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Brand */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">
                  الماركة (Brand)
                </label>
                <select
                  value={formData.brand}
                  onChange={e => handleFieldChange('brand', e.target.value)}
                  className="w-full text-xs font-semibold px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  {POPULAR_BRANDS.map(b => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
                {formData.brand === 'أخرى' && (
                  <input
                    type="text"
                    placeholder="اكتب اسم الماركة..."
                    value={customBrand}
                    onChange={e => setCustomBrand(e.target.value)}
                    className="w-full text-xs px-3 py-1.5 mt-1 rounded-lg border border-slate-300 bg-white text-slate-800 focus:ring-2 focus:ring-blue-500"
                  />
                )}
              </div>

              {/* Model Name */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">
                  اسم الموديل / الجهاز (Model)
                </label>
                <input
                  type="text"
                  placeholder="مثال: ThinkPad T14 Gen 2"
                  value={formData.model_name}
                  onChange={e => handleFieldChange('model_name', e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Processor / CPU */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">
                  المعالج (Processor / CPU)
                </label>
                <input
                  type="text"
                  placeholder="مثال: Core i7-1165G7"
                  value={formData.processor}
                  onChange={e => handleFieldChange('processor', e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 focus:ring-2 focus:ring-blue-500 font-mono"
                />
              </div>

              {/* Generation */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">
                  الجيل (Generation) <span className="text-[10px] text-slate-400 font-normal">(اختياري)</span>
                </label>
                <input
                  type="text"
                  placeholder="مثال: الجيل الحادي عشر"
                  value={formData.generation}
                  onChange={e => handleFieldChange('generation', e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Row 2: RAM, Storage, GPU, Screen */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* RAM */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">
                  الذاكرة العشوائية (RAM)
                </label>
                <input
                  type="text"
                  placeholder="مثال: 16GB DDR4"
                  value={formData.ram}
                  onChange={e => handleFieldChange('ram', e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 focus:ring-2 focus:ring-blue-500 font-mono"
                />
              </div>

              {/* Storage */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">
                  سعة التخزين (Storage)
                </label>
                <input
                  type="text"
                  placeholder="مثال: 512GB SSD NVMe"
                  value={formData.storage}
                  onChange={e => handleFieldChange('storage', e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 focus:ring-2 focus:ring-blue-500 font-mono"
                />
              </div>

              {/* GPU */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">
                  كارت الشاشة (GPU)
                </label>
                <input
                  type="text"
                  placeholder="مثال: Intel Iris Xe أو RTX 3050"
                  value={formData.gpu}
                  onChange={e => handleFieldChange('gpu', e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Screen / Display */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">
                  مقاس ومواصفات الشاشة (Display)
                </label>
                <input
                  type="text"
                  placeholder="مثال: 14.0 FHD IPS"
                  value={formData.screen}
                  onChange={e => handleFieldChange('screen', e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Row 3: Price, Quantity, Notes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Price */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">
                  السعر المقترح (Price) <span className="text-[10px] text-slate-400 font-normal">(اختياري)</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="مثال: 17500"
                  value={formData.price}
                  onChange={e => handleFieldChange('price', e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 focus:ring-2 focus:ring-blue-500 font-mono"
                />
              </div>

              {/* Available Quantity */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">
                  الكمية المتاحة (Quantity)
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  placeholder="1"
                  value={formData.quantity}
                  onChange={e => handleFieldChange('quantity', e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 focus:ring-2 focus:ring-blue-500 font-mono"
                />
              </div>

              {/* Notes */}
              <div className="sm:col-span-2 space-y-1">
                <label className="block text-xs font-bold text-slate-700">
                  ملاحظات ومميزات إضافية (Notes) <span className="text-[10px] text-slate-400 font-normal">(اختياري)</span>
                </label>
                <input
                  type="text"
                  placeholder="مثال: حالة الزيرو كرتونة فرز أول، كيبورد مضيئة، شاحن أصلي"
                  value={formData.notes}
                  onChange={e => handleFieldChange('notes', e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Form Action Buttons */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 flex-wrap">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleResetForm}
                leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
                className="text-xs font-semibold border-slate-300 hover:bg-slate-50"
              >
                {editingId ? 'إلغاء التعديل' : 'تفريغ الحقول'}
              </Button>

              <Button
                type="submit"
                variant="primary"
                size="sm"
                leftIcon={editingId ? <Check className="w-4 h-4 text-white" /> : <Plus className="w-4 h-4 text-white" />}
                className={`text-xs font-bold shadow-2xs transition-all ${
                  editingId
                    ? 'bg-amber-600 hover:bg-amber-700 text-white'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                {editingId ? 'حفظ تعديلات الجهاز' : 'إضافة جهاز إلى القائمة'}
              </Button>
            </div>
          </form>
        </div>
      </Card>

      {/* 3. Reused Full-Featured Promotional Image Generator */}
      <MSSPromotionalGenerator
        mode="accessories_manual"
        manualItems={manualItems}
        onManualItemsChange={setManualItems}
        onEditItem={handleEditItem}
        onDeleteItem={handleDeleteItem}
        exportType="custom_images"
      />
    </div>
  );
};
