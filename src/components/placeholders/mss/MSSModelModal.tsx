import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { Select } from '@/components/common/Select';
import { Spinner } from '@/components/common/Spinner';
import { useNotification } from '@/context/NotificationContext';
import { mssCatalogService } from '@/services/mssCatalogService';
import type { MSSCatalogModel, MSSCategory, NewMSSModelInput } from '@/types/mssCatalog';
import { CheckCircle } from 'lucide-react';

export interface MSSModelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (model: MSSCatalogModel) => void;
  modelToEdit?: MSSCatalogModel | null;
  zIndexClassName?: string;
}

export const MSSModelModal: React.FC<MSSModelModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  modelToEdit,
  zIndexClassName,
}) => {
  const { showNotification } = useNotification();
  const [brand, setBrand] = useState('');
  const [modelName, setModelName] = useState('');
  const [category, setCategory] = useState<MSSCategory>('لابتوب');
  const [processor, setProcessor] = useState('');
  const [gpu, setGpu] = useState('');
  const [ram, setRam] = useState('');
  const [storage, setStorage] = useState('');
  const [screenSize, setScreenSize] = useState('');
  const [specifications, setSpecifications] = useState('');
  const [defaultListPrice, setDefaultListPrice] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize or reset form state when modal opens or modelToEdit changes
  useEffect(() => {
    if (isOpen) {
      if (modelToEdit) {
        setBrand(modelToEdit.brand);
        setModelName(modelToEdit.model_name);
        setCategory(modelToEdit.category);
        setProcessor(modelToEdit.processor || '');
        setGpu(modelToEdit.gpu || '');
        setRam(modelToEdit.ram || '');
        setStorage(modelToEdit.storage || '');
        setScreenSize(modelToEdit.screen_size || '');
        setSpecifications(modelToEdit.specifications || '');
        setDefaultListPrice(modelToEdit.default_list_price);
      } else {
        setBrand('');
        setModelName('');
        setCategory('لابتوب');
        setProcessor('');
        setGpu('');
        setRam('');
        setStorage('');
        setScreenSize('');
        setSpecifications('');
        setDefaultListPrice(0);
      }
    }
  }, [isOpen, modelToEdit]);

  const handleSubmit = async (e: React.FormEvent) => {
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
        gpu: (category === 'لابتوب' && gpu.trim()) ? gpu.trim() : undefined,
        ram: ram.trim() || undefined,
        storage: storage.trim() || undefined,
        screen_size: screenSize.trim() || undefined,
        specifications: specifications.trim() || undefined,
        default_list_price: defaultListPrice,
      };

      let resultModel: MSSCatalogModel;

      if (modelToEdit) {
        resultModel = await mssCatalogService.updateModel(modelToEdit.id, inputData);
        showNotification({
          type: 'success',
          title: 'تم تحديث الموديل بنجاح',
          message: `تم حفظ تعديلات موديل ${inputData.brand} ${inputData.model_name}`,
        });
      } else {
        resultModel = await mssCatalogService.createModel(inputData);
        if (resultModel._synced) {
          showNotification({
            type: 'success',
            title: 'تمت إضافة الموديل بنجاح',
            message: `تم تسجيل الموديل ${inputData.brand} ${inputData.model_name} وحفظه في السحابة`,
          });
        } else {
          showNotification({
            type: 'info',
            title: 'تم حفظ الموديل محلياً (بانتظار المزامنة)',
            message: `تم حفظ الموديل ${inputData.brand} ${inputData.model_name} محلياً وسيتم مزامنته تلقائياً مع السحابة عند توفر الاتصال`,
          });
        }
      }

      onSuccess?.(resultModel);
      onClose();
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

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !isSubmitting && onClose()}
      title={modelToEdit ? `تعديل الموديل: ${modelToEdit.brand} ${modelToEdit.model_name}` : 'إضافة موديل جديد إلى الكتالوج'}
      subtitle="تسجيل مواصفات الجهاز والشاشة والمعالج في كتالوج الأجهزة المشترك"
      size="lg"
      zIndexClassName={zIndexClassName}
      footer={
        <div className="flex items-center justify-between w-full">
          <Button
            variant="outline"
            size="md"
            onClick={onClose}
            disabled={isSubmitting}
            className="border-slate-300 font-semibold"
          >
            إلغاء
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={handleSubmit}
            disabled={isSubmitting}
            leftIcon={isSubmitting ? <Spinner size="sm" /> : <CheckCircle className="w-4.5 h-4.5" />}
            className="font-bold bg-blue-600 hover:bg-blue-700"
          >
            {isSubmitting ? 'جارٍ الحفظ...' : modelToEdit ? 'حفظ التعديلات' : 'إضافة الموديل الآن'}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="font-bold text-slate-700 block mb-1">
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
            <label className="font-bold text-slate-700 block mb-1">
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
            <label className="font-bold text-slate-700 block mb-1">النوع</label>
            <Select
              value={category}
              onChange={e => setCategory(e.target.value as MSSCategory)}
              options={[
                { value: 'لابتوب', label: 'لابتوب' },
                { value: 'شاشة', label: 'شاشة' },
              ]}
            />
          </div>
        </div>

        {/* Hardware Specs Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3 border-t border-slate-200">
          <div>
            <label className="font-bold text-slate-700 block mb-1">المعالج (CPU)</label>
            <Input
              placeholder="مثال: Intel Core i5-8350U, i7-1185G7..."
              value={processor}
              onChange={e => setProcessor(e.target.value)}
              className="font-mono"
            />
          </div>

          {category === 'لابتوب' && (
            <div>
              <label className="font-bold text-slate-700 block mb-1">
                كارت الشاشة (GPU) <span className="text-slate-400 font-normal">(اختياري)</span>
              </label>
              <Input
                placeholder="مثال: Intel UHD 620, Nvidia RTX 3060 6GB..."
                value={gpu}
                onChange={e => setGpu(e.target.value)}
                className="font-mono"
              />
            </div>
          )}

          <div>
            <label className="font-bold text-slate-700 block mb-1">الذاكرة العشوائية (RAM)</label>
            <Input
              placeholder="مثال: 16 GB DDR4, 32 GB..."
              value={ram}
              onChange={e => setRam(e.target.value)}
              className="font-mono"
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">سعة التخزين (Storage)</label>
            <Input
              placeholder="مثال: 512 GB NVMe SSD, 1 TB..."
              value={storage}
              onChange={e => setStorage(e.target.value)}
              className="font-mono"
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">حجم ومواصفات الشاشة</label>
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
            <label className="font-bold text-slate-700 block mb-1">
              السعر الاسترشادي الافتراضي (EGP)
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
          </div>

          <div className="md:col-span-2">
            <label className="font-bold text-slate-700 block mb-1">
              ملاحظات ومواصفات إضافية
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
  );
};
