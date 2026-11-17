import React, { useState, useEffect, useCallback } from 'react';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { Select } from '@/components/common/Select';
import { Plus, TrendingUp, Sparkles, RefreshCw, AlertCircle } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { productsService } from '@/services/productsService';
import { Product, NewProductInput } from '@/types/product';
import { generateNextProductCode } from '@/lib/productCodeGenerator';
import { useNotification } from '@/context/NotificationContext';

export interface ProductCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
  /**
   * Called when a product is either created freshly or resolved as an existing duplicate.
   * @param product The product master record.
   * @param isExistingDuplicate True if the product already existed in the catalog, False if it was newly created.
   */
  onSuccess: (product: Product, isExistingDuplicate: boolean) => void | Promise<void>;
  /**
   * Set to true when opened from the Purchase Invoice workflow.
   * - Ensures stock starts at 0 so inventory increases ONLY via the finalized purchase invoice (Rule 7 & Phase 7).
   * - Enables Egyptian Arabic duplicate notification and auto-selection instead of rejecting duplicates.
   */
  isFromPurchaseInvoice?: boolean;
  /**
   * Optional custom zIndex class for modal layering (e.g. 'z-[60]' over invoice modal's 'z-50').
   */
  zIndexClassName?: string;
}

interface FormState {
  name: string;
  code: string;
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

export const ProductCreationModal: React.FC<ProductCreationModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  isFromPurchaseInvoice = false,
  zIndexClassName = 'z-[60]',
}) => {
  const { showNotification } = useNotification();

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [formData, setFormData] = useState<FormState>(emptyFormState);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isCodeManuallyEdited, setIsCodeManuallyEdited] = useState<boolean>(false);

  // Initialize or reset form state whenever modal opens
  const initModalData = useCallback(async () => {
    try {
      const [prods, cats] = await Promise.all([
        productsService.getProducts(),
        productsService.getCategories(),
      ]);
      setProducts(prods);
      setCategories(cats);

      const suggestedCode = generateNextProductCode('', prods);
      setFormData({
        ...emptyFormState,
        code: suggestedCode,
        stock: '0',
      });
      setIsCodeManuallyEdited(false);
      setFormErrors({});
    } catch (err: any) {
      console.error('Failed to initialize product modal data:', err);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      initModalData();
    }
  }, [isOpen, initModalData]);

  // Product Name Handler: Auto-generate code if code hasn't been manually edited
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

  // Product Code Handler
  const handleProductCodeChange = (newCode: string) => {
    setIsCodeManuallyEdited(true);
    const upper = newCode.toUpperCase();
    setFormData(prev => ({ ...prev, code: upper }));

    const trimmed = upper.trim();
    if (!isFromPurchaseInvoice && trimmed) {
      const isDup = products.some(p => p.code.toLowerCase() === trimmed.toLowerCase());
      if (isDup) {
        setFormErrors(prev => ({
          ...prev,
          code: `كود الصنف "${trimmed}" مسجل مسبقاً لصنف آخر. يرجى اختيار كود فريد.`,
        }));
      } else if (formErrors.code) {
        setFormErrors(prev => ({ ...prev, code: '' }));
      }
    } else if (formErrors.code) {
      setFormErrors(prev => ({ ...prev, code: '' }));
    }
  };

  // Force regenerate code
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

  // Validation
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    const nameTrim = formData.name.trim();
    if (!nameTrim) {
      errors.name = 'اسم المنتج مطلوب ولا يمكن تركه فارغاً';
    }

    const codeTrim = formData.code.trim();
    if (!codeTrim) {
      errors.code = 'كود الصنف مطلوب ولا يمكن أن يكون فارغاً';
    } else if (!isFromPurchaseInvoice) {
      // In standalone Products View, warn about duplicate code upfront
      const isDup = products.some(p => p.code.toLowerCase() === codeTrim.toLowerCase());
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

    const lowStockNum = Number(formData.low_stock_threshold);
    if (formData.low_stock_threshold === '' || isNaN(lowStockNum) || lowStockNum < 0) {
      errors.low_stock_threshold = 'حد تنبيه النواقص يجب أن يكون رقماً صحيحاً مساوياً أو أكبر من صفر';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Submission with Automatic Duplicate Detection & Safe Insertion
  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      const nameTrim = formData.name.trim();
      const codeTrim = formData.code.trim().toUpperCase();

      // Fetch fresh products from DB to ensure atomic detection
      const currentProducts = await productsService.getProducts();

      // Check duplicates by code, name, or barcode
      const matchByCode = currentProducts.find(
        p => p.code.trim().toLowerCase() === codeTrim.toLowerCase()
      );
      const matchByName = currentProducts.find(
        p => p.name.trim().toLowerCase() === nameTrim.toLowerCase()
      );

      const existingProduct = matchByCode || matchByName;

      // Handle duplicate detection (Phase 5)
      if (existingProduct) {
        if (isFromPurchaseInvoice) {
          // Inform user in Egyptian Arabic as required
          showNotification({
            type: 'info',
            title: 'الصنف موجود بالفعل',
            message: 'الصنف ده موجود بالفعل في المنتجات. تم تحديد الصنف الموجود بدلًا من إضافة نسخة مكررة.',
          });

          await onSuccess(existingProduct, true);
          onClose();
          return;
        } else {
          // Standalone products view: reject duplicate
          setFormErrors(prev => ({
            ...prev,
            code: matchByCode ? `كود الصنف "${codeTrim}" مسجل مسبقاً لصنف آخر (${matchByCode.name}).` : prev.code,
            name: (!matchByCode && matchByName) ? `يوجد صنف آخر مسجل بنفس الاسم (${matchByName.name}).` : prev.name,
          }));
          showNotification({
            type: 'warning',
            title: 'صنف مسجل مسبقاً',
            message: `الصنف موجود بالفعل: "${existingProduct.name}" (كود: ${existingProduct.code}). يرجى اختيار كود واسم فريدين.`,
          });
          return;
        }
      }

      // No duplicate: Proceed with product creation
      const finalCategory =
        formData.category === '__NEW__'
          ? formData.newCategory.trim()
          : formData.category.trim();

      const input: NewProductInput = {
        name: nameTrim,
        code: codeTrim,
        barcode: null,
        category: finalCategory || null,
        cost: Number(formData.cost),
        price: Number(formData.price),
        // In purchase invoice flow, stock starts at 0 Master record only.
        // Stock increases when the purchase invoice is finalized (Rule 7 & Phase 7).
        stock: isFromPurchaseInvoice ? 0 : Math.floor(Number(formData.stock)),
        low_stock_threshold: Math.floor(Number(formData.low_stock_threshold)),
        description: formData.description.trim() || null,
      };

      const created = await productsService.addProduct(input);

      showNotification({
        type: 'success',
        title: 'تمت إضافة الصنف بنجاح',
        message: isFromPurchaseInvoice
          ? 'تمت إضافة الصنف بنجاح وإدراجه في الفاتورة.'
          : `تم حفظ الصنف "${created.name}" في قاعدة بيانات الإكسسوارات المحلية.`,
      });

      await onSuccess(created, false);
      onClose();
    } catch (err: any) {
      const errMsg: string = err?.message || String(err);
      // Concurrent duplicate safety: if DB rejected duplicate code
      if (
        isFromPurchaseInvoice &&
        (errMsg.toLowerCase().includes('unique') || errMsg.includes('مسجل مسبقاً'))
      ) {
        try {
          const fresh = await productsService.getProducts();
          const codeTrim = formData.code.trim().toUpperCase();
          const nameTrim = formData.name.trim();
          const fallbackMatch = fresh.find(
            p =>
              p.code.trim().toLowerCase() === codeTrim.toLowerCase() ||
              p.name.trim().toLowerCase() === nameTrim.toLowerCase()
          );
          if (fallbackMatch) {
            showNotification({
              type: 'info',
              title: 'الصنف موجود بالفعل',
              message: 'الصنف ده موجود بالفعل في المنتجات. تم تحديد الصنف الموجود بدلًا من إضافة نسخة مكررة.',
            });
            await onSuccess(fallbackMatch, true);
            onClose();
            return;
          }
        } catch {
          // ignore fallback error and show standard notification
        }
      }

      showNotification({
        type: 'error',
        title: 'فشل حفظ الصنف',
        message: errMsg || 'حدث خطأ أثناء حفظ الصنف في قاعدة البيانات',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !isSubmitting && onClose()}
      title={isFromPurchaseInvoice ? 'إضافة صنف جديد للفاتورة' : 'إضافة منتج إكسسوار جديد'}
      subtitle={
        isFromPurchaseInvoice
          ? 'تسجيل بطاقة صنف جديدة في المنتجات وإدراجها مباشرة في فاتورة الشراء الحالية'
          : 'إضافة صنف جديد إلى كتالوج إكسسوارات المحل وقاعدة البيانات المحلية'
      }
      size="lg"
      zIndexClassName={zIndexClassName}
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="text-xs text-slate-500">
            {isFromPurchaseInvoice && (
              <span className="text-blue-700 font-medium">
                * سيتم إدراج الصنف تلقائياً في فاتورة الشراء بعد حفظه
              </span>
            )}
          </div>
          <div className="flex items-center gap-2.5">
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
              isLoading={isSubmitting}
              leftIcon={<Plus className="w-4 h-4" />}
              className="font-bold"
            >
              {isFromPurchaseInvoice ? 'حفظ الصنف وإدراجه بالفاتورة' : 'حفظ المنتج الجديد'}
            </Button>
          </div>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Row 1: Name and Code */}
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
                <span>توليد كود تلقائي</span>
              </button>
            </div>
            <Input
              placeholder="مثال: CHG-001 أو MO-001"
              value={formData.code}
              onChange={e => handleProductCodeChange(e.target.value)}
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

        {/* Row 2: Category */}
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

        {/* Row 3: Financial & Inventory Details */}
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

          <div>
            <Input
              label="الكمية المتوفرة *"
              type="number"
              min="0"
              placeholder="0"
              value={isFromPurchaseInvoice ? '0' : formData.stock}
              disabled={isFromPurchaseInvoice}
              onChange={e => setFormData({ ...formData, stock: e.target.value })}
              error={formErrors.stock}
            />
            {isFromPurchaseInvoice && (
              <span className="text-[10px] text-blue-700 font-semibold mt-1 block">
                الرصيد الابتدائي (0) — ستتم إضافة الكمية تلقائياً عبر فاتورة الشراء.
              </span>
            )}
          </div>

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

        {/* Margin Preview */}
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

        {/* Description / Notes */}
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
  );
};
