import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { Select } from '@/components/common/Select';
import { Spinner } from '@/components/common/Spinner';
import { LaptopSpecQuickSelect } from '@/components/common/LaptopSpecQuickSelect';
import { useNotification } from '@/context/NotificationContext';
import { mssCatalogService } from '@/services/mssCatalogService';
import type { MSSCatalogModel, MSSCategory, NewMSSModelInput } from '@/types/mssCatalog';
import { CheckCircle, Laptop, Monitor, Layers } from 'lucide-react';
import {
  type ParsedScreenSpecs,
  buildScreenSummary,
  buildScreenSpecifications,
  parseScreenSpecs,
} from '@/services/mssScreenSpecs';

export type { ParsedScreenSpecs };
export { buildScreenSummary, buildScreenSpecifications, parseScreenSpecs };

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

  // Common Fields
  const [brand, setBrand] = useState('');
  const [modelName, setModelName] = useState('');
  const [category, setCategory] = useState<MSSCategory>('لابتوب');
  const [defaultListPrice, setDefaultListPrice] = useState<number>(0);

  // Laptop & Generic Fields
  const [processor, setProcessor] = useState('');
  const [gpu, setGpu] = useState('');
  const [ram, setRam] = useState('');
  const [storage, setStorage] = useState('');
  const [screenSize, setScreenSize] = useState('');
  const [specifications, setSpecifications] = useState('');

  // Screen / Monitor Fields
  const [monitorSize, setMonitorSize] = useState('');
  const [monitorResolution, setMonitorResolution] = useState('');
  const [monitorPanel, setMonitorPanel] = useState('');
  const [monitorRefreshRate, setMonitorRefreshRate] = useState('');
  const [monitorResponseTime, setMonitorResponseTime] = useState('');
  const [monitorAspectRatio, setMonitorAspectRatio] = useState('');
  const [monitorPorts, setMonitorPorts] = useState('');
  const [monitorCurvature, setMonitorCurvature] = useState('مسطحة (Flat)');
  const [monitorTouch, setMonitorTouch] = useState('لا');
  const [monitorBrightness, setMonitorBrightness] = useState('');
  const [monitorNotes, setMonitorNotes] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize or reset form state when modal opens or modelToEdit changes
  useEffect(() => {
    if (isOpen) {
      if (modelToEdit) {
        setBrand(modelToEdit.brand || '');
        setModelName(modelToEdit.model_name || '');
        setCategory(modelToEdit.category || 'لابتوب');
        setDefaultListPrice(modelToEdit.default_list_price || 0);

        if (modelToEdit.category === 'شاشة') {
          // Parse monitor specifications
          const parsed = parseScreenSpecs(modelToEdit.screen_size, modelToEdit.specifications);
          setMonitorSize(parsed.size);
          setMonitorResolution(parsed.resolution);
          setMonitorPanel(parsed.panel);
          setMonitorRefreshRate(parsed.refreshRate);
          setMonitorResponseTime(parsed.responseTime);
          setMonitorAspectRatio(parsed.aspectRatio);
          setMonitorPorts(parsed.ports);
          setMonitorCurvature(parsed.curvature);
          setMonitorTouch(parsed.touch);
          setMonitorBrightness(parsed.brightness);
          setMonitorNotes(parsed.notes);

          // Clear laptop fields
          setProcessor('');
          setGpu('');
          setRam('');
          setStorage('');
          setScreenSize('');
          setSpecifications('');
        } else {
          // Laptop or Other
          setProcessor(modelToEdit.processor || '');
          setGpu(modelToEdit.gpu || '');
          setRam(modelToEdit.ram || '');
          setStorage(modelToEdit.storage || '');
          setScreenSize(modelToEdit.screen_size || '');
          setSpecifications(modelToEdit.specifications || '');

          // Clear monitor fields
          setMonitorSize('');
          setMonitorResolution('');
          setMonitorPanel('');
          setMonitorRefreshRate('');
          setMonitorResponseTime('');
          setMonitorAspectRatio('');
          setMonitorPorts('');
          setMonitorCurvature('مسطحة (Flat)');
          setMonitorTouch('لا');
          setMonitorBrightness('');
          setMonitorNotes('');
        }
      } else {
        // Reset to clean empty form
        setBrand('');
        setModelName('');
        setCategory('لابتوب');
        setDefaultListPrice(0);

        setProcessor('');
        setGpu('');
        setRam('');
        setStorage('');
        setScreenSize('');
        setSpecifications('');

        setMonitorSize('');
        setMonitorResolution('');
        setMonitorPanel('');
        setMonitorRefreshRate('');
        setMonitorResponseTime('');
        setMonitorAspectRatio('');
        setMonitorPorts('');
        setMonitorCurvature('مسطحة (Flat)');
        setMonitorTouch('لا');
        setMonitorBrightness('');
        setMonitorNotes('');
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
        message: 'يرجى كتابة اسم الموديل (مثل: ThinkPad T480 أو UltraSharp U2720Q)',
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

    // Type-specific validation
    if (category === 'شاشة' && !monitorSize.trim()) {
      showNotification({
        type: 'warning',
        title: 'حجم الشاشة مطلوب',
        message: 'يرجى كتابة حجم الشاشة بالبوصة للشاشات (مثل: 24", 27", 32")',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      let inputData: NewMSSModelInput;

      if (category === 'شاشة') {
        const constructedScreenSize = buildScreenSummary(
          monitorSize,
          monitorResolution,
          monitorPanel,
          monitorRefreshRate,
          monitorCurvature
        );
        const constructedSpecs = buildScreenSpecifications({
          responseTime: monitorResponseTime,
          aspectRatio: monitorAspectRatio,
          ports: monitorPorts,
          brightness: monitorBrightness,
          touch: monitorTouch,
          notes: monitorNotes,
        });

        inputData = {
          brand: brand.trim(),
          model_name: modelName.trim(),
          category: 'شاشة',
          // Setting incompatible hardware fields to undefined on create or empty string on update clears them in the DB
          processor: modelToEdit ? '' : undefined,
          gpu: modelToEdit ? '' : undefined,
          ram: modelToEdit ? '' : undefined,
          storage: modelToEdit ? '' : undefined,
          screen_size: constructedScreenSize || undefined,
          specifications: constructedSpecs || undefined,
          default_list_price: defaultListPrice,
        };
      } else if (category === 'لابتوب') {
        inputData = {
          brand: brand.trim(),
          model_name: modelName.trim(),
          category: 'لابتوب',
          processor: processor.trim() || (modelToEdit ? '' : undefined),
          gpu: gpu.trim() || (modelToEdit ? '' : undefined),
          ram: ram.trim() || (modelToEdit ? '' : undefined),
          storage: storage.trim() || (modelToEdit ? '' : undefined),
          screen_size: screenSize.trim() || (modelToEdit ? '' : undefined),
          specifications: specifications.trim() || (modelToEdit ? '' : undefined),
          default_list_price: defaultListPrice,
        };
      } else {
        // أخرى (Other)
        inputData = {
          brand: brand.trim(),
          model_name: modelName.trim(),
          category: 'أخرى',
          processor: processor.trim() || (modelToEdit ? '' : undefined),
          gpu: modelToEdit ? '' : undefined,
          ram: ram.trim() || (modelToEdit ? '' : undefined),
          storage: storage.trim() || (modelToEdit ? '' : undefined),
          screen_size: screenSize.trim() || (modelToEdit ? '' : undefined),
          specifications: specifications.trim() || (modelToEdit ? '' : undefined),
          default_list_price: defaultListPrice,
        };
      }

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
      title={
        modelToEdit
          ? `تعديل الموديل: ${modelToEdit.brand} ${modelToEdit.model_name}`
          : 'إضافة موديل جديد  '
      }
      subtitle=" "
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
        {/* Core Common Fields: Brand, Model Name, Category */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="font-bold text-slate-700 block mb-1">
              الماركة (Brand) <span className="text-rose-500">*</span>
            </label>
            <Input
              placeholder="مثال: Dell, Lenovo, Samsung, LG..."
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
              placeholder={category === 'شاشة' ? 'مثال: UltraSharp U2720Q, Odyssey G7...' : 'مثال: ThinkPad T480, Latitude 5490...'}
              value={modelName}
              onChange={e => setModelName(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">النوع / الفئة</label>
            <Select
              value={category}
              onChange={e => setCategory(e.target.value as MSSCategory)}
              options={[
                { value: 'لابتوب', label: 'لابتوب' },
                { value: 'شاشة', label: 'شاشة' },
                { value: 'أخرى', label: 'أخرى' },
              ]}
            />
          </div>
        </div>

        {/* DYNAMIC FORM SECTION BASED ON CATEGORY */}

        {/* 1. LAPTOP FIELDS */}
        {category === 'لابتوب' && (
          <div className="pt-3 border-t border-slate-200 space-y-3">

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">المعالج (CPU)</label>
                <Input
                  placeholder="مثال: Intel Core i5-8350U, i7-1185G7..."
                  value={processor}
                  onChange={e => setProcessor(e.target.value)}
                  className="font-mono"
                />
                <LaptopSpecQuickSelect
                  specType="processor"
                  value={processor}
                  onSelect={setProcessor}
                />
              </div>

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
                <LaptopSpecQuickSelect
                  specType="gpu"
                  value={gpu}
                  onSelect={setGpu}
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">الذاكرة العشوائية (RAM)</label>
                <Input
                  placeholder="مثال: 16 GB DDR4, 32 GB..."
                  value={ram}
                  onChange={e => setRam(e.target.value)}
                  className="font-mono"
                />
                <LaptopSpecQuickSelect
                  specType="ram"
                  value={ram}
                  onSelect={setRam}
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
                <LaptopSpecQuickSelect
                  specType="storage"
                  value={storage}
                  onSelect={setStorage}
                />
              </div>

              <div className="md:col-span-2">
                <label className="font-bold text-slate-700 block mb-1">حجم ومواصفات الشاشة</label>
                <Input
                  placeholder='مثال: 14" FHD IPS, 15.6" 144Hz...'
                  value={screenSize}
                  onChange={e => setScreenSize(e.target.value)}
                />
                <LaptopSpecQuickSelect
                  specType="screen"
                  value={screenSize}
                  onSelect={setScreenSize}
                />
              </div>
            </div>
          </div>
        )}

        {/* 2. SCREEN / MONITOR FIELDS */}
        {category === 'شاشة' && (
          <div className="pt-3 border-t border-slate-200 space-y-3">

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Screen Size */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  حجم الشاشة (بالبوصة) <span className="text-rose-500">*</span>
                </label>
                <Input
                  placeholder='مثال: 24", 27", 32", 21.5"...'
                  value={monitorSize}
                  onChange={e => setMonitorSize(e.target.value)}
                  className="font-mono"
                />
              </div>

              {/* Resolution */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">دقة الشاشة (Resolution)</label>
                <Input
                  placeholder="مثال: FHD (1920×1080), 2K QHD, 4K UHD..."
                  value={monitorResolution}
                  onChange={e => setMonitorResolution(e.target.value)}
                  className="font-mono"
                />
              </div>

              {/* Panel Type */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">نوع اللوحة (Panel Type)</label>
                <Select
                  value={monitorPanel}
                  onChange={e => setMonitorPanel(e.target.value)}
                  options={[
                    { value: '', label: 'غير محدد / افتراضي' },
                    { value: 'IPS', label: 'IPS' },
                    { value: 'VA', label: 'VA' },
                    { value: 'TN', label: 'TN' },
                    { value: 'OLED', label: 'OLED' },
                    { value: 'Mini-LED', label: 'Mini-LED' },
                    { value: 'Nano IPS', label: 'Nano IPS' },
                  ]}
                />
              </div>

              {/* Refresh Rate */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">معدل التحديث (Refresh Rate)</label>
                <Input
                  placeholder="مثال: 60Hz, 75Hz, 144Hz, 165Hz..."
                  value={monitorRefreshRate}
                  onChange={e => setMonitorRefreshRate(e.target.value)}
                  className="font-mono"
                />
              </div>

              {/* Response Time */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">زمن الاستجابة (Response Time)</label>
                <Input
                  placeholder="مثال: 1ms, 2ms, 4ms, 5ms..."
                  value={monitorResponseTime}
                  onChange={e => setMonitorResponseTime(e.target.value)}
                  className="font-mono"
                />
              </div>

              {/* Aspect Ratio */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">نسبة الأبعاد (Aspect Ratio)</label>
                <Select
                  value={monitorAspectRatio}
                  onChange={e => setMonitorAspectRatio(e.target.value)}
                  options={[
                    { value: '', label: 'غير محدد (افتراضي)' },
                    { value: '16:9', label: '16:9 (عريض قياسي)' },
                    { value: '16:10', label: '16:10' },
                    { value: '21:9', label: '21:9 (UltraWide)' },
                    { value: '32:9', label: '32:9 (Super UltraWide)' },
                    { value: '4:3', label: '4:3' },
                  ]}
                />
              </div>

              {/* Curved / Flat */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">تصميم الشاشة (Curved / Flat)</label>
                <Select
                  value={monitorCurvature}
                  onChange={e => setMonitorCurvature(e.target.value)}
                  options={[
                    { value: 'مسطحة (Flat)', label: 'مسطحة (Flat)' },
                    { value: 'منحنية (Curved)', label: 'منحنية (Curved)' },
                  ]}
                />
              </div>

              {/* Touchscreen */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">دعم اللمس (Touchscreen)</label>
                <Select
                  value={monitorTouch}
                  onChange={e => setMonitorTouch(e.target.value)}
                  options={[
                    { value: 'لا', label: 'لا (Non-Touch)' },
                    { value: 'نعم', label: 'نعم (Touchscreen)' },
                  ]}
                />
              </div>

              {/* Brightness */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">السطوع (Brightness)</label>
                <Input
                  placeholder="مثال: 250 nits, 300 nits, 350 nits..."
                  value={monitorBrightness}
                  onChange={e => setMonitorBrightness(e.target.value)}
                  className="font-mono"
                />
              </div>

              {/* Ports / Connectivity */}
              <div className="md:col-span-3">
                <label className="font-bold text-slate-700 block mb-1">
                  المنافذ والتوصيل (Ports / Connectivity)
                </label>
                <Input
                  placeholder="مثال: HDMI, DisplayPort, VGA, USB-C, Audio Out..."
                  value={monitorPorts}
                  onChange={e => setMonitorPorts(e.target.value)}
                />
              </div>
            </div>
          </div>
        )}

        {/* 3. OTHER / GENERIC FIELDS */}
        {category === 'أخرى' && (
          <div className="pt-3 border-t border-slate-200 space-y-3">
            <div className="text-xs font-bold text-amber-700 bg-amber-50 px-2.5 py-1.5 rounded flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-amber-600" />
              <span>مواصفات الجهاز العامة</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  المعالج (CPU) <span className="text-slate-400 font-normal">(اختياري)</span>
                </label>
                <Input
                  placeholder="مثال: Intel Core i5..."
                  value={processor}
                  onChange={e => setProcessor(e.target.value)}
                  className="font-mono"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  الذاكرة العشوائية (RAM) <span className="text-slate-400 font-normal">(اختياري)</span>
                </label>
                <Input
                  placeholder="مثال: 8 GB..."
                  value={ram}
                  onChange={e => setRam(e.target.value)}
                  className="font-mono"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  سعة التخزين (Storage) <span className="text-slate-400 font-normal">(اختياري)</span>
                </label>
                <Input
                  placeholder="مثال: 256 GB SSD..."
                  value={storage}
                  onChange={e => setStorage(e.target.value)}
                  className="font-mono"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  الشاشة / العرض <span className="text-slate-400 font-normal">(اختياري)</span>
                </label>
                <Input
                  placeholder='مثال: 10.1", بدون شاشة...'
                  value={screenSize}
                  onChange={e => setScreenSize(e.target.value)}
                />
              </div>
            </div>
          </div>
        )}

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
              {category === 'شاشة' ? 'ملاحظات ومواصفات إضافية للشاشة' : 'ملاحظات ومواصفات إضافية'}
            </label>
            <Input
              placeholder={
                category === 'شاشة'
                  ? 'مثال: قاعدة هيدروليك قابلة للدوران والارتفاع، سماعات مدمجة، مخرج صوت 3.5mm...'
                  : 'مثال: كيبورد مضيئة، بصمة إصبع، شاحن تايب سي 65 واط أصلي...'
              }
              value={category === 'شاشة' ? monitorNotes : specifications}
              onChange={e => {
                if (category === 'شاشة') {
                  setMonitorNotes(e.target.value);
                } else {
                  setSpecifications(e.target.value);
                }
              }}
            />
          </div>
        </div>
      </form>
    </Modal>
  );
};
