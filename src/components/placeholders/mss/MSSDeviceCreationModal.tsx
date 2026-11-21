import React, { useState, useEffect, useCallback } from 'react';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { Select } from '@/components/common/Select';
import { Alert } from '@/components/common/Alert';
import { Badge } from '@/components/common/Badge';
import { Spinner } from '@/components/common/Spinner';
import { SearchableItemSelect } from '@/components/common/SearchableItemSelect';
import { MSSModelModal } from './MSSModelModal';
import { mssInventoryService } from '@/services/mssInventoryService';
import { mssCatalogService } from '@/services/mssCatalogService';
import { useNotification } from '@/context/NotificationContext';
import { getTodayLocalDateString } from '@/lib/dateValidation';
import type { MSSDevice, MSSDeviceStatus, MSSStockLocation } from '@/types/mssInventory';
import type { MSSCatalogModel } from '@/types/mssCatalog';
import { useMSSLocations } from '@/hooks/useMSSLocations';
import { Plus, Laptop, Box } from 'lucide-react';
const DEFAULT_LOCATIONS: MSSStockLocation[] = ['محل 1', 'محل 2'];

export interface MSSDeviceCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (device: MSSDevice) => void;
  initialMode?: 'INDIVIDUAL' | 'BULK';
  initialModelId?: string;
  locationOptions?: MSSStockLocation[];
  zIndexClassName?: string;
}

export const MSSDeviceCreationModal: React.FC<MSSDeviceCreationModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialMode = 'BULK',
  initialModelId,
  locationOptions,
  zIndexClassName,
}) => {
  const { locations: dynamicLocations } = useMSSLocations();
  const availableLocations = locationOptions && locationOptions.length > 0
    ? locationOptions
    : (dynamicLocations.length > 0 ? dynamicLocations : ['محل 1', 'محل 2']);
  const { showNotification } = useNotification();
  const [catalogModels, setCatalogModels] = useState<MSSCatalogModel[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const prevIsOpenRef = React.useRef(false);

  // Form State: Default to BULK as required
  const [stockRegistrationMode, setStockRegistrationMode] = useState<'INDIVIDUAL' | 'BULK'>(initialMode);
  const [formSerial, setFormSerial] = useState('');
  const [formQuantity, setFormQuantity] = useState<number | ''>(1);
  const [formModelId, setFormModelId] = useState('');
  const [formCost, setFormCost] = useState<number | ''>('');
  const [formListPrice, setFormListPrice] = useState<number | ''>('');
  const [formPurchaseDate, setFormPurchaseDate] = useState(getTodayLocalDateString());
  const [formCondition, setFormCondition] = useState('فرز أول ممتاز');
  const [formLocation, setFormLocation] = useState<MSSStockLocation>(availableLocations[0] || 'محل 1');
  const [formStatus, setFormStatus] = useState<MSSDeviceStatus>('AVAILABLE');
  const [formNotes, setFormNotes] = useState('');
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Child Add Model Modal State (Stacked on top)
  const [isAddModelOpen, setIsAddModelOpen] = useState(false);

  // Fetch models list
  const loadCatalogModels = useCallback(async () => {
    setIsLoadingModels(true);
    try {
      const models = await mssCatalogService.getModels();
      setCatalogModels(models);
      return models;
    } catch (err) {
      console.error('Failed to load catalog models:', err);
      return [];
    } finally {
      setIsLoadingModels(false);
    }
  }, []);

  // Initialize form state ONLY when modal transitions from closed to open
  useEffect(() => {
    if (isOpen && !prevIsOpenRef.current) {
      setStockRegistrationMode(initialMode);
      setFormSerial('');
      setFormQuantity(1);
      setFormCost('');
      setFormPurchaseDate(getTodayLocalDateString());
      setFormCondition('فرز أول ممتاز');
      setFormLocation(availableLocations[0] || 'محل 1');
      setFormStatus('AVAILABLE');
      setFormNotes('');
      setFormError('');

      loadCatalogModels().then(models => {
        if (initialModelId) {
          setFormModelId(initialModelId);
          const m = models.find(x => x.id === initialModelId);
          if (m) setFormListPrice(m.default_list_price);
        } else if (models.length > 0) {
          setFormModelId(models[0].id);
          setFormListPrice(models[0].default_list_price);
        }
      });
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen, initialMode, initialModelId, locationOptions, loadCatalogModels]);

  // When model selection changes, auto-fill default list price if currently 0
  const handleModelChange = (modelId: string) => {
    setFormModelId(modelId);
    const m = catalogModels.find(x => x.id === modelId);
    if (m && (!formListPrice || formListPrice === 0)) {
      setFormListPrice(m.default_list_price);
    }
  };

  // Callback when a new model is created from the child modal
  const handleModelCreated = async (newModel: MSSCatalogModel) => {
    // 1. Close child modal only
    setIsAddModelOpen(false);

    // 2. Refresh models list immediately
    const updatedModels = await loadCatalogModels();

    // 3. Automatically select the newly created model in the parent form
    setFormModelId(newModel.id);
    if (!formListPrice || formListPrice === 0) {
      setFormListPrice(newModel.default_list_price);
    }

    // 4. Show success notification
    showNotification({
      type: 'success',
      title: 'تم اختيار الموديل الجديد تلقائياً',
      message: `تم تحديد الموديل (${newModel.brand} ${newModel.model_name}) لمتابعة تسجيل الجهاز`,
    });
  };

  // Submit Add Device / Bulk Stock
  const handleSaveAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!formModelId) {
      setFormError('يرجى اختيار الموديل المرتبط من الكتالوج أو إضافة موديل جديد');
      return;
    }
    const costNum = Number(formCost) || 0;
    const listPriceNum = Number(formListPrice) || 0;

    if (costNum < 0) {
      setFormError('سعر التكلفة لا يمكن أن يكون سالباً');
      return;
    }
    if (listPriceNum < 0) {
      setFormError('سعر العرض لا يمكن أن يكون سالباً');
      return;
    }

    setIsSubmitting(true);
    setFormError('');
    try {
      let createdDevice: MSSDevice;

      if (stockRegistrationMode === 'BULK') {
        const qty = Math.floor(Number(formQuantity) || 0);
        if (qty <= 0) {
          setFormError('يرجى إدخال كمية صحيحة أكبر من صفر');
          setIsSubmitting(false);
          return;
        }

        createdDevice = await mssInventoryService.createBulkStock({
          model_id: formModelId,
          quantity: qty,
          purchase_cost: Number(formCost) || 0,
          list_price: Number(formListPrice) || 0,
          purchase_date: formPurchaseDate,
          physical_condition: formCondition.trim() || 'فرز أول ممتاز',
          stock_location: formLocation,
          notes: formNotes.trim() || undefined,
        });

        showNotification({
          type: 'success',
          title: 'تم تسجيل المخزون المجمع بنجاح',
          message: `تم إضافة (${qty}) وحدات غير مسلسلة في (${formLocation}).`,
        });
      } else {
        // Individual device (serial optional)
        createdDevice = await mssInventoryService.createDevice({
          serial_number: formSerial.trim() || null,
          model_id: formModelId,
          purchase_cost: Number(formCost) || 0,
          list_price: Number(formListPrice) || 0,
          purchase_date: formPurchaseDate,
          physical_condition: formCondition.trim() || 'فرز أول ممتاز',
          stock_location: formLocation,
          status: formStatus,
          notes: formNotes.trim() || undefined,
        });

        showNotification({
          type: 'success',
          title: 'تم تسجيل الجهاز بنجاح',
          message: formSerial.trim()
            ? `تم إضافة الجهاز بالسيريال (${formSerial.trim().toUpperCase()}) إلى مخزون ${formLocation}`
            : `تم إضافة جهاز (بدون سيريال) إلى مخزون ${formLocation}`,
        });
      }

      onSuccess?.(createdDevice);
      onClose();
    } catch (err: any) {
      setFormError(err.message || 'فشلت عملية حفظ الجهاز في المخزون');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={() => !isSubmitting && onClose()}
        title={stockRegistrationMode === 'BULK' ? 'إضافة مخزون مجمع بدون سيريال' : 'تسجيل جهاز جديد في المخزون'}
        subtitle={
          stockRegistrationMode === 'BULK'
            ? 'تسجيل دفعة أجهزة بالكمية والموديل مباشرة بدون سيريالات'
            : 'تسجيل جهاز فردي مع إمكانية إدخال السيريال أو تركه فارغاً'
        }
        size="lg"
        zIndexClassName={zIndexClassName}
        footer={
          <div className="flex items-center justify-between w-full">
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isSubmitting}
            >
              إلغاء
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSaveAdd}
              disabled={isSubmitting}
              leftIcon={isSubmitting ? <Spinner size="sm" /> : <Plus className="w-4 h-4" />}
            >
              {isSubmitting
                ? 'جاري الحفظ...'
                : stockRegistrationMode === 'BULK'
                ? `تسجيل الدفعة (${formQuantity} أجهزة)`
                : 'تسجيل الجهاز'}
            </Button>
          </div>
        }
      >
        <form onSubmit={handleSaveAdd} className="space-y-4 text-xs">
          {formError && (
            <Alert type="danger" title="خطأ في البيانات" message={formError} />
          )}

          {/* Mode Switcher */}
          <div className="flex items-center gap-2 p-1.5 bg-slate-100 rounded-xl border border-slate-300">
            <button
              type="button"
              onClick={() => setStockRegistrationMode('INDIVIDUAL')}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                stockRegistrationMode === 'INDIVIDUAL'
                  ? 'bg-white text-slate-900 shadow-subtle border border-slate-300'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Laptop className="w-4 h-4" />
              <span>جهاز فردي (سيريال اختياري)</span>
            </button>
            <button
              type="button"
              onClick={() => setStockRegistrationMode('BULK')}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                stockRegistrationMode === 'BULK'
                  ? 'bg-white text-slate-900 shadow-subtle border border-slate-300'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Box className="w-4 h-4" />
              <span>كمية مجمعة بدون سيريال (بالعدد)</span>
            </button>
          </div>

          {/* Model Selection with Direct Add Model Button */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-700">
                اختيار الموديل من الكتالوج <span className="text-rose-500">*</span>
              </label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsAddModelOpen(true)}
                leftIcon={<Plus className="w-3.5 h-3.5 text-blue-600" />}
                className="text-[11px] text-blue-600 border-blue-200 hover:bg-blue-50 py-0.5 px-2.5 h-6 font-bold"
              >
                إضافة موديل جديد
              </Button>
            </div>

            <SearchableItemSelect<MSSCatalogModel>
              items={catalogModels}
              selectedId={formModelId}
              onSelect={m => handleModelChange(m.id)}
              getKey={m => m.id}
              getSearchableText={m =>
                `${m.brand} ${m.model_name} ${(m as any).model_code || ''} ${m.category} ${m.processor || ''} ${m.gpu || ''}`
              }
              placeholder="ابحث بالماركة، اسم الموديل، كود الموديل أو المواصفات..."
              emptyMessage={isLoadingModels ? "جاري تحميل الموديلات..." : "لا توجد موديلات مطابقة في الكتالوج"}
              maxHeight="max-h-40"
              renderItem={m => (
                <div className="flex items-center justify-between gap-2">
                  <div className="truncate">
                    <span className="font-bold text-slate-900">{m.brand} {m.model_name}</span>
                    {(m as any).model_code && (
                      <span className="font-mono text-[10px] text-slate-500 ml-1.5 bg-slate-100 px-1 rounded border border-slate-200">
                        {(m as any).model_code}
                      </span>
                    )}
                    <p className="text-[10px] text-slate-500 truncate">
                      {[m.processor, m.gpu, m.ram, m.storage].filter(Boolean).join(' • ')}
                    </p>
                  </div>
                  <Badge variant="default" size="sm">{m.category}</Badge>
                </div>
              )}
            />
          </div>

          {/* Serial Number (Individual Mode) or Quantity (Bulk Mode) */}
          {stockRegistrationMode === 'INDIVIDUAL' ? (
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                السيريال نمبر <span className="text-slate-400 font-normal">(اختياري)</span>
              </label>
              <Input
                placeholder="اكتب السيريال (مثال: PF1K892-LEN) أو اتركه فارغاً..."
                value={formSerial}
                onChange={e => setFormSerial(e.target.value.toUpperCase())}
                helperText="يمكنك حفظ الجهاز بدون سيريال الآن وتعيين السيريال لاحقاً"
              />
            </div>
          ) : (
            <div className="p-3 bg-amber-50/80 rounded-xl border border-amber-200 space-y-1.5">
              <label className="block text-xs font-bold text-amber-900 mb-1">
                الكمية الإجمالية للدفعة (عدد الأجهزة) <span className="text-rose-500">*</span>
              </label>
              <Input
                type="number"
                min="1"
                step="1"
                value={formQuantity}
                onChange={e => setFormQuantity(e.target.value === '' ? '' : Math.max(1, parseInt(e.target.value) || 1))}
                placeholder="1"
                required
              />
              <p className="text-[11px] text-amber-700 leading-relaxed">
                سيتم حفظ هذه الكمية في المخزون المتاح بدون سيريالات، ويمكن تحويل أي عدد منها إلى أجهزة مسلسلة لاحقاً بزر &quot;تعيين سيريال&quot;.
              </p>
            </div>
          )}

          {/* Stock Location */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              مكان التخزين / الفرع <span className="text-rose-500">*</span>
            </label>
            <Select
              value={formLocation}
              onChange={e => setFormLocation(e.target.value as MSSStockLocation)}
              options={availableLocations.map(loc => ({
                value: loc,
                label: loc,
              }))}
              required
            />
          </div>

          {/* Financials & Purchase Date */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                سعر التكلفة للوحدة (EGP) <span className="text-rose-500">*</span>
              </label>
              <Input
                type="number"
                min="0"
                step="50"
                value={formCost}
                placeholder="0.00"
                onChange={e => setFormCost(e.target.value === '' ? '' : Number(e.target.value))}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                سعر العرض للوحدة (EGP) <span className="text-rose-500">*</span>
              </label>
              <Input
                type="number"
                min="0"
                step="50"
                value={formListPrice}
                placeholder="0.00"
                onChange={e => setFormListPrice(e.target.value === '' ? '' : Number(e.target.value))}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                تاريخ الشراء / الاستلام
              </label>
              <Input
                type="date"
                max={getTodayLocalDateString()}
                value={formPurchaseDate}
                onChange={e => setFormPurchaseDate(e.target.value)}
              />
            </div>
          </div>

          {/* Condition and Status */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                الحالة الفنية
              </label>
              <Select
                value={formCondition}
                onChange={e => setFormCondition(e.target.value)}
                options={[
                  { value: 'فرز أول ممتاز', label: 'فرز أول ممتاز ' },
                  { value: 'فرز ثانٍ', label: 'فرز ثانٍ ' },
                  { value: 'يحتاج صيانة ', label: 'يحتاج صيانة / مراجعة' },
                ]}
              />
            </div>

            {stockRegistrationMode === 'INDIVIDUAL' && (
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  حالة الجهاز في المخزون
                </label>
                <Select
                  value={formStatus}
                  onChange={e => setFormStatus(e.target.value as MSSDeviceStatus)}
                  options={[
                    { value: 'AVAILABLE', label: 'متاح للبيع' },
                    { value: 'RESERVED', label: 'محجوز' },
                    { value: 'MAINTENANCE', label: 'تحت الصيانة والفحص' },
                  ]}
                />
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              ملاحظات إضافية
            </label>
            <textarea
              className="w-full px-3 py-2 text-xs border border-slate-200/80 rounded-lg focus:outline-none focus:border-slate-400 transition-colors"
              rows={2}
              placeholder="مثال: صحة البطارية 96%، كيبورد مضيئة، شاحن أصلي..."
              value={formNotes}
              onChange={e => setFormNotes(e.target.value)}
            />
          </div>
        </form>
      </Modal>

      {/* Secondary Stacking Modal: Add New Model directly from Add Device */}
      <MSSModelModal
        isOpen={isAddModelOpen}
        onClose={() => setIsAddModelOpen(false)}
        onSuccess={handleModelCreated}
        zIndexClassName="z-[60]"
      />
    </>
  );
};
