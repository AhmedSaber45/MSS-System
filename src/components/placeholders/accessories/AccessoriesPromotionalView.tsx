import React, { useState, useEffect, useRef } from 'react';
import {
  Laptop,
  Plus,
  Check,
  X,
  Trash2,
  Edit3,
  RotateCcw,
  Megaphone,
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
import { AlertModal } from '@/components/common/AlertModal';
import { LaptopSpecQuickSelect } from '@/components/common/LaptopSpecQuickSelect';
import { useNotification } from '@/context/NotificationContext';
import { MSSPromotionalGenerator } from '@/components/placeholders/mss/MSSPromotionalGenerator';
import {
  accessoriesPromotionalService,
  ACCESSORIES_PROMOTIONAL_HEADERS,
  AccessoriesHeaderOptionId,
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
  const formCardRef = useRef<HTMLDivElement | null>(null);
  const [formData, setFormData] = useState<ManualDeviceInput>(INITIAL_FORM);
  const [customBrand, setCustomBrand] = useState<string>('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState<boolean>(false);
  const [selectedHeaderId, setSelectedHeaderId] = useState<AccessoriesHeaderOptionId>(() =>
    accessoriesPromotionalService.loadSelectedHeaderId()
  );

  const selectedHeaderOption = accessoriesPromotionalService.getAccessoriesHeaderOption(selectedHeaderId);

  useEffect(() => {
    accessoriesPromotionalService.saveSelectedHeaderId(selectedHeaderId);
  }, [selectedHeaderId]);

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

    // Wait for React to commit the loaded device data, then smoothly scroll the form into view
    // Works across both window scrolling and internal scrollable layout containers.
    const scrollToForm = () => {
      const formEl = formCardRef.current;
      if (formEl) {
        if (typeof formEl.scrollIntoView === 'function') {
          formEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        let parent: HTMLElement | null = formEl.parentElement;
        while (parent) {
          const style = window.getComputedStyle(parent);
          const isScrollable =
            (style.overflowY === 'auto' || style.overflowY === 'scroll') &&
            parent.scrollHeight > parent.clientHeight;
          if (isScrollable) {
            const parentRect = parent.getBoundingClientRect();
            const elRect = formEl.getBoundingClientRect();
            const targetTop = Math.max(0, parent.scrollTop + (elRect.top - parentRect.top) - 24);
            parent.scrollTo({ top: targetTop, behavior: 'smooth' });
            break;
          }
          parent = parent.parentElement;
        }
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    };

    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(scrollToForm);
      });
    } else {
      scrollToForm();
    }
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

  // Clear all items with confirmation modal
  const handleClearAllItems = () => {
    if (manualItems.length === 0) return;
    setIsClearConfirmOpen(true);
  };

  const handleConfirmClearAll = () => {
    setManualItems([]);
    handleResetForm();
    setIsClearConfirmOpen(false);
    showNotification({
      type: 'info',
      title: 'تم مسح القائمة الدعائية',
      message: 'تم إفراغ كافة الأجهزة المدخلة يدوياً.',
    });
  };

  return (
    <div className="space-y-6 pb-12 select-none" dir="rtl">
      {/* 1. Page Header */}
      <div className="flex items-center justify-between flex-wrap gap-4 bg-white p-5 rounded-2xl border border-slate-300 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-blue-600/10 border border-blue-200 text-blue-700 flex items-center justify-center shrink-0">
            <Megaphone className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900">الصورة الدعائية</h1>

            </div>
  
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
      <div ref={formCardRef} className="scroll-mt-6">
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
                  {editingId ? 'تعديل بيانات الجهاز المحدد' : 'إضافة جهاز جديد  '}
                </h3>
  
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
                  اسم الموديل / الجهاز 
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
                  المعالج 
                </label>
                <input
                  type="text"
                  placeholder="مثال: Core i7-1165G7"
                  value={formData.processor}
                  onChange={e => handleFieldChange('processor', e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 focus:ring-2 focus:ring-blue-500 font-mono"
                />
                <LaptopSpecQuickSelect
                  specType="processor"
                  value={formData.processor}
                  onSelect={val => handleFieldChange('processor', val)}
                />
              </div>

              {/* Generation */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">
                  الجيل  <span className="text-[10px] text-slate-400 font-normal">(اختياري)</span>
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
                  الرام  
                </label>
                <input
                  type="text"
                  placeholder="مثال: 16GB DDR4"
                  value={formData.ram}
                  onChange={e => handleFieldChange('ram', e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 focus:ring-2 focus:ring-blue-500 font-mono"
                />
                <LaptopSpecQuickSelect
                  specType="ram"
                  value={formData.ram}
                  onSelect={val => handleFieldChange('ram', val)}
                />
              </div>

              {/* Storage */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">
                 الهارد
                </label>
                <input
                  type="text"
                  placeholder="مثال: 512GB SSD NVMe"
                  value={formData.storage}
                  onChange={e => handleFieldChange('storage', e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 focus:ring-2 focus:ring-blue-500 font-mono"
                />
                <LaptopSpecQuickSelect
                  specType="storage"
                  value={formData.storage}
                  onSelect={val => handleFieldChange('storage', val)}
                />
              </div>

              {/* GPU */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">
                  كارت الشاشة (اختياري)
                </label>
                <input
                  type="text"
                  placeholder="مثال: Intel Iris Xe أو RTX 3050"
                  value={formData.gpu}
                  onChange={e => handleFieldChange('gpu', e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 focus:ring-2 focus:ring-blue-500"
                />
                <LaptopSpecQuickSelect
                  specType="gpu"
                  value={formData.gpu}
                  onSelect={val => handleFieldChange('gpu', val)}
                />
              </div>

              {/* Screen / Display */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">
                    الشاشة 
                </label>
                <input
                  type="text"
                  placeholder="مثال: 14.0 FHD IPS"
                  value={formData.screen}
                  onChange={e => handleFieldChange('screen', e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 focus:ring-2 focus:ring-blue-500"
                />
                <LaptopSpecQuickSelect
                  specType="screen"
                  value={formData.screen}
                  onSelect={val => handleFieldChange('screen', val)}
                />
              </div>
            </div>

            {/* Row 3: Price, Quantity, Notes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Price */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">
                  السعر  <span className="text-[10px] text-slate-400 font-normal">(اختياري)</span>
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
                  الكمية المتاحة 
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
                  ملاحظات  إضافية  <span className="text-[10px] text-slate-400 font-normal">(اختياري)</span>
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
      </div>

      {/* 2.5 Accessories-Only Static Header Design Selector */}
      <Card className="bg-white border border-slate-300 shadow-2xs overflow-hidden">
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-slate-900">تصميم الهيدر   </h2>
    
          </div>

        </div>
        <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {ACCESSORIES_PROMOTIONAL_HEADERS.map(option => {
            const isActive = selectedHeaderOption.id === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setSelectedHeaderId(option.id)}
                aria-pressed={isActive}
                className={`group flex flex-col gap-2 p-2.5 rounded-xl border text-right transition-all cursor-pointer ${
                  isActive
                    ? 'border-blue-600 bg-blue-50/70 ring-2 ring-blue-500/20 shadow-xs'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div className="w-full h-16 rounded-lg overflow-hidden bg-[#040e24] border border-slate-200 flex items-center justify-center">
                  <img
                    src={option.imageSrc}
                    alt={option.label}
                    className="w-full h-full object-contain"
                    loading="eager"
                  />
                </div>
                <div className="flex items-center justify-between w-full px-0.5">
                  <span className={`text-xs font-bold ${isActive ? 'text-blue-900' : 'text-slate-800'}`}>
                    {option.label}
                  </span>
                  {isActive && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
                      <Check className="w-3 h-3" />
                      مفعّل
                    </span>
                  )}
                </div>
              </button>
            );
          })}
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
        headerImageSrc={selectedHeaderOption.imageSrc}
        headerId={selectedHeaderOption.id}
      />

      <AlertModal
        isOpen={isClearConfirmOpen}
        onClose={() => setIsClearConfirmOpen(false)}
        type="confirm"
        title="تأكيد مسح القائمة "
        message="هل أنت متأكد من رغبتك في مسح كافة الأجهزة ؟   لا يمكن التراجع عن هذا الإجراء."
        confirmLabel="مسح الكل"
        cancelLabel="إلغاء"
        confirmVariant="danger"
        onConfirm={handleConfirmClearAll}
      />
    </div>
  );
};
