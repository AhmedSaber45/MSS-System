import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { Modal } from '@/components/common/Modal';
import { Spinner } from '@/components/common/Spinner';
import {
  Search,
  Plus,
  Minus,
  Trash2,
  CheckCircle,
  ShoppingBag,
  CreditCard,
  Banknote,
  RotateCcw,
  Tag,
  FileCheck2,
  FileDown,
  Printer,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Wrench,
  Edit3,
  Calendar,
  Clock,
} from 'lucide-react';
import { formatCurrency, formatPieceCount } from '@/lib/utils';
import { useNotification } from '@/context/NotificationContext';
import { usePageRefresh } from '@/context/PageRefreshContext';
import { productsService } from '@/services/productsService.ts';
import { salesService } from '@/services/salesService.ts';
import { PrintableInvoice } from '@/components/sales/PrintableInvoice.tsx';
import { documentPrintService } from '@/lib/documentPrintService';
import { InstallmentScheduleBuilder, PlannedInstallmentItem } from '@/components/common/InstallmentScheduleBuilder';
import type { Product } from '@/types/product.ts';
import type { CartItem, Invoice, InvoiceItem, PaymentType } from '@/types/sale.ts';

const PAYMENT_METHODS = [
  { id: 'نقدي', label: 'نقدي', icon: Banknote },
  { id: 'فيزا', label: 'فيزا', icon: CreditCard },
  { id: 'انستا باى / فودافون كاش', label: 'انستا باى  / فودافون كاش', icon: CreditCard },
  { id: 'آجل', label: 'آجل ', icon: Tag },
];

export const SalesView: React.FC = () => {
  const { showNotification } = useNotification();
  const { isRefreshing, triggerRefresh } = usePageRefresh();

  // Products and loading state
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // Next invoice number
  const [nextInvoiceNumber, setNextInvoiceNumber] = useState<string>('');

  // Cart state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [invoiceDiscount, setInvoiceDiscount] = useState<number>(0);
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('نقدي');
  const [paymentType, setPaymentType] = useState<PaymentType>('FULL');
  const [initialPayment, setInitialPayment] = useState<number>(0);
  const [dueDate, setDueDate] = useState<string>(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return d.toISOString().substring(0, 10);
  });
  const [installmentSchedule, setInstallmentSchedule] = useState<PlannedInstallmentItem[]>([]);
  const [showScheduleBuilder, setShowScheduleBuilder] = useState<boolean>(false);
  const [saleNotes, setSaleNotes] = useState<string>('');

  // Checkout submission lock
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Maintenance Modal State
  const [isMaintenanceModalOpen, setIsMaintenanceModalOpen] = useState<boolean>(false);
  const [editingMaintenanceId, setEditingMaintenanceId] = useState<string | null>(null);
  const [maintDescription, setMaintDescription] = useState<string>('');
  const [maintPrice, setMaintPrice] = useState<string>('');
  const [maintQuantity, setMaintQuantity] = useState<number>(1);
  const [maintDiscount, setMaintDiscount] = useState<string>('');
  const [maintError, setMaintError] = useState<string>('');

  // Success print modal state
  const [completedInvoice, setCompletedInvoice] = useState<Invoice | null>(null);
  const [completedItems, setCompletedItems] = useState<InvoiceItem[]>([]);
  const [printFormat, setPrintFormat] = useState<'a4' | 'thermal'>('thermal');

  // Load products and next invoice number
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [prods, nextNum] = await Promise.all([
        productsService.getProducts(),
        salesService.generateNextInvoiceNumber(),
      ]);
      setProducts(prods);
      setNextInvoiceNumber(nextNum);
    } catch (err: any) {
      showNotification({
        type: 'error',
        title: 'خطأ في تحميل البيانات',
        message: err.message || 'تعذر تحميل الأصناف وبيانات البيع',
      });
    } finally {
      setIsLoading(false);
    }
  }, [showNotification]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Unique categories for filtering
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => {
      if (p.category && p.category.trim()) set.add(p.category.trim());
    });
    return Array.from(set);
  }, [products]);

  // Filtered product catalog
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesCategory = selectedCategory === 'ALL' || p.category === selectedCategory;
      if (!matchesCategory) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        p.name.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q)
      );
    });
  }, [products, selectedCategory, searchQuery]);

  // Sub-pages / Pagination state (Default: 9 items per page, 3x3 grid)
  const [itemsPerPage, setItemsPerPage] = useState<number>(9);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Reset to page 1 whenever category or search query changes
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCategory, searchQuery]);

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage) || 1;
  const validCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  const paginatedProducts = useMemo(() => {
    const startIndex = (validCurrentPage - 1) * itemsPerPage;
    return filteredProducts.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredProducts, validCurrentPage, itemsPerPage]);

  // Add product to cart helper
  const handleAddToCart = useCallback((product: Product) => {
    if (product.stock <= 0) {
      showNotification({
        type: 'warning',
        title: 'الصنف نفد من المخزون',
        message: `الصنف "${product.name}" رصيده الحالي صفر ولا يمكن بيعه.`,
      });
      return;
    }

    setCart(prevCart => {
      const existingIndex = prevCart.findIndex(
        item => item.item_type !== 'maintenance' && item.product?.id === product.id
      );

      if (existingIndex >= 0) {
        const existing = prevCart[existingIndex];
        if (existing.quantity + 1 > product.stock) {
          showNotification({
            type: 'warning',
            title: 'تم بلوغ الحد الأقصى للرصيد',
            message: `الرصيد المتاح من "${product.name}" هو ${product.stock} فقط.`,
          });
          return prevCart;
        }

        const updated = [...prevCart];
        const newQty = existing.quantity + 1;
        updated[existingIndex] = {
          ...existing,
          quantity: newQty,
          line_total: existing.actual_price * newQty,
        };
        return updated;
      } else {
        const actualPrice = Math.max(0, product.price);
        return [
          ...prevCart,
          {
            id: product.id,
            item_type: 'product',
            product,
            quantity: 1,
            discount: 0,
            actual_price: actualPrice,
            line_total: actualPrice * 1,
          },
        ];
      }
    });
  }, [showNotification]);

  // Open modal to add new manual maintenance entry
  const handleOpenAddMaintenance = () => {
    setEditingMaintenanceId(null);
    setMaintDescription('');
    setMaintPrice('');
    setMaintQuantity(1);
    setMaintDiscount('');
    setMaintError('');
    setIsMaintenanceModalOpen(true);
  };

  // Open modal to edit existing maintenance entry
  const handleOpenEditMaintenance = (item: CartItem) => {
    setEditingMaintenanceId(item.id || null);
    setMaintDescription(item.description || '');
    setMaintPrice(item.price !== undefined ? String(item.price) : String(item.actual_price));
    setMaintQuantity(item.quantity || 1);
    setMaintDiscount(item.discount > 0 ? String(item.discount) : '');
    setMaintError('');
    setIsMaintenanceModalOpen(true);
  };

  // Save manual maintenance entry
  const handleSaveMaintenance = () => {
    const desc = maintDescription.trim();
    if (!desc) {
      setMaintError('يرجى إدخال وصف العمل المنفذ (خدمة الصيانة)');
      return;
    }

    const price = parseFloat(maintPrice);
    if (isNaN(price) || price < 0) {
      setMaintError('يرجى إدخال سعر صحيح غير سالب للخدمة');
      return;
    }

    const qty = Math.max(1, maintQuantity || 1);
    const discount = parseFloat(maintDiscount) || 0;
    if (discount < 0) {
      setMaintError('الخصم لا يمكن أن يكون سالباً');
      return;
    }
    if (discount > price) {
      setMaintError('قيمة الخصم لا يمكن أن تتجاوز سعر الخدمة');
      return;
    }

    const actualPrice = price - discount;
    const lineTotal = actualPrice * qty;

    if (editingMaintenanceId) {
      setCart(prev =>
        prev.map(item => {
          if (item.id === editingMaintenanceId) {
            return {
              ...item,
              description: desc,
              price,
              quantity: qty,
              discount,
              actual_price: actualPrice,
              line_total: lineTotal,
            };
          }
          return item;
        })
      );
      showNotification({
        type: 'info',
        title: 'تم تحديث بند الصيانة',
        message: `تم تعديل خدمة "${desc}" بنجاح.`,
      });
    } else {
      const newItem: CartItem = {
        id: 'maint-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 7),
        item_type: 'maintenance',
        description: desc,
        price,
        quantity: qty,
        discount,
        actual_price: actualPrice,
        line_total: lineTotal,
      };
      setCart(prev => [...prev, newItem]);
      showNotification({
        type: 'success',
        title: 'تمت إضافة بند الصيانة',
        message: `تمت إضافة خدمة "${desc}" بقيمة ${formatCurrency(lineTotal)} إلى الفاتورة.`,
      });
    }

    setIsMaintenanceModalOpen(false);
  };

  // Modify item quantity
  const handleUpdateQuantity = (itemId: string, newQty: number) => {
    if (newQty <= 0) {
      handleRemoveItem(itemId);
      return;
    }

    setCart(prevCart => {
      return prevCart.map(item => {
        const currentId = item.id || item.product?.id;
        if (currentId === itemId) {
          if (item.item_type !== 'maintenance' && item.product && newQty > item.product.stock) {
            showNotification({
              type: 'warning',
              title: 'تجاوز الرصيد المتاح',
              message: `الرصيد المتاح من "${item.product.name}" هو ${item.product.stock} فقط.`,
            });
            return item;
          }
          return {
            ...item,
            quantity: newQty,
            line_total: item.actual_price * newQty,
          };
        }
        return item;
      });
    });
  };

  // Modify item discount
  const handleUpdateItemDiscount = (itemId: string, discountAmount: number) => {
    setCart(prevCart => {
      return prevCart.map(item => {
        const currentId = item.id || item.product?.id;
        if (currentId === itemId) {
          const basePrice = item.item_type === 'maintenance' ? (item.price ?? 0) : (item.product?.price ?? 0);
          const validDiscount = Math.max(0, Math.min(basePrice, discountAmount));
          const actualPrice = basePrice - validDiscount;
          return {
            ...item,
            discount: validDiscount,
            actual_price: actualPrice,
            line_total: actualPrice * item.quantity,
          };
        }
        return item;
      });
    });
  };

  // Remove single item from cart
  const handleRemoveItem = (itemId: string) => {
    setCart(prev => prev.filter(i => (i.id || i.product?.id) !== itemId));
  };

  // Clear entire cart
  const handleClearCart = () => {
    setCart([]);
    setInvoiceDiscount(0);
    setSaleNotes('');
    setPaymentType('FULL');
    setInitialPayment(0);
    setInstallmentSchedule([]);
    setShowScheduleBuilder(false);
  };

  // Calculations
  const subtotal = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.line_total, 0);
  }, [cart]);

  const totalDiscount = useMemo(() => {
    const itemDiscountsTotal = cart.reduce(
      (acc, item) => acc + item.discount * item.quantity,
      0
    );
    return itemDiscountsTotal + invoiceDiscount;
  }, [cart, invoiceDiscount]);

  const finalTotal = useMemo(() => {
    return Math.max(0, subtotal - invoiceDiscount);
  }, [subtotal, invoiceDiscount]);

  const remainingBalance = useMemo(() => {
    if (paymentType === 'FULL') return 0;
    return Math.max(0, Math.round((finalTotal - initialPayment) * 100) / 100);
  }, [paymentType, finalTotal, initialPayment]);

  // Submit sale with double-submission protection
  const handleCheckout = async () => {
    if (isSubmitting) return;

    if (cart.length === 0) {
      showNotification({
        type: 'warning',
        title: 'السلة فارغة',
        message: 'يرجى اختيار صنف أو خدمة صيانة واحدة على الأقل لإتمام البيع.',
      });
      return;
    }

    if (invoiceDiscount > subtotal) {
      showNotification({
        type: 'error',
        title: 'قيمة الخصم غير صالحة',
        message: 'خصم الفاتورة الإجمالي لا يمكن أن يتجاوز مجموع الأصناف والخدمات.',
      });
      return;
    }

    if (paymentType === 'DEFERRED') {
      if (initialPayment > finalTotal) {
        showNotification({
          type: 'error',
          title: 'قيمة المقدم غير صحيحة',
          message: 'الدفعة المقدمة لا يمكن أن تتجاوز إجمالي الفاتورة.',
        });
        return;
      }
      if (initialPayment < 0) {
        showNotification({
          type: 'error',
          title: 'قيمة المقدم غير صحيحة',
          message: 'الدفعة المقدمة لا يمكن أن تكون سالبة.',
        });
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const saleInput = {
        invoice_number: nextInvoiceNumber,
        customer_name: customerName.trim() || undefined,
        customer_phone: customerPhone.trim() || undefined,
        invoice_discount: invoiceDiscount,
        payment_method: paymentMethod,
        notes: saleNotes.trim() || undefined,
        payment_type: paymentType,
        initial_payment: paymentType === 'DEFERRED' ? initialPayment : finalTotal,
        due_date: paymentType === 'DEFERRED' ? dueDate || undefined : undefined,
        installments: paymentType === 'DEFERRED' && installmentSchedule.length > 0 ? installmentSchedule : undefined,
        items: cart.map(item => {
          if (item.item_type === 'maintenance') {
            return {
              item_type: 'maintenance' as const,
              description: item.description,
              price: item.price,
              quantity: item.quantity,
              discount: item.discount,
            };
          }
          return {
            item_type: 'product' as const,
            product_id: item.product!.id,
            quantity: item.quantity,
            discount: item.discount,
          };
        }),
      };

      const invoice = await salesService.createSale(saleInput);
      const items = await salesService.getInvoiceItems(invoice.id);

      // Open print modal
      setCompletedInvoice(invoice);
      setCompletedItems(items);

      showNotification({
        type: 'success',
        title: 'تم تسجيل الفاتورة بنجاح',
        message: `تم إصدار الفاتورة (${invoice.invoice_number}) وتحديث الحسابات.`,
      });

      // Reset cart and reload product stock
      handleClearCart();
      setCustomerName('');
      setCustomerPhone('');
      await loadData();
    } catch (err: any) {
      showNotification({
        type: 'error',
        title: 'فشل إتمام البيع',
        message: err.message || 'حدث خطأ أثناء حفظ الفاتورة في قاعدة البيانات',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartNewSale = () => {
    setCompletedInvoice(null);
    setCompletedItems([]);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title=" البيع وإصدار الفواتير "
        subtitle=""
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="md"
              onClick={() => triggerRefresh(loadData, 'جارٍ تحديث قائمة الأصناف والمخزون...')}
              disabled={isRefreshing || isLoading}
              leftIcon={<RefreshCw className={`w-4 h-4 text-slate-600 ${isRefreshing ? 'animate-spin' : ''}`} />}
              className="border-slate-300 text-slate-800 font-semibold"
            >
              Refresh
            </Button>
            <Badge variant="outline" size="md" className="font-mono tabular-nums text-sm font-bold">
              الفاتورة: {nextInvoiceNumber || '...'}
            </Badge>
          </div>
        }
      />

      {/* Main 2-Column POS Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Right 7 Cols: Product Catalog & Search */}
        <div className="lg:col-span-7 space-y-3.5">
          {/* Search & Catalog Filter Card */}
          <Card className="p-3.5 border-slate-300">
            <div className="flex items-center gap-2.5">
              <div className="flex-1">
                <Input
                  placeholder="ابحث باسم الصنف أو الكود..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onClear={() => setSearchQuery('')}
                  leftIcon={<Search className="w-4.5 h-4.5 text-slate-500" />}
                  autoFocus
                />
              </div>
              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={handleOpenAddMaintenance}
                leftIcon={<Wrench className="w-4.5 h-4.5 text-white" />}
                className="bg-amber-600 hover:bg-amber-700 text-white font-bold shrink-0 shadow-xs"
                title="إضافة خدمة صيانة يدوية للفاتورة الحالية"
              >
                صيانة
              </Button>
            </div>

            {/* Category Filter Buttons */}
            <div className="flex items-center gap-2 mt-3 overflow-x-auto pb-1 text-sm">
              <button
                type="button"
                onClick={() => setSelectedCategory('ALL')}
                className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap ${selectedCategory === 'ALL'
                  ? 'bg-slate-900 text-white font-bold'
                  : 'bg-slate-100 border border-slate-300 text-slate-700 hover:text-slate-900 hover:bg-slate-200'
                  }`}
              >
                الكل ({products.length})
              </button>
              {categories.map(cat => {
                const count = products.filter(p => p.category === cat).length;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap ${selectedCategory === cat
                      ? 'bg-slate-900 text-white font-bold'
                      : 'bg-slate-100 border border-slate-300 text-slate-700 hover:text-slate-900 hover:bg-slate-200'
                      }`}
                  >
                    {cat} ({count})
                  </button>
                );
              })}
            </div>
          </Card>

          {/* Product Grid */}
          {isLoading ? (
            <div className="p-12 flex flex-col items-center justify-center bg-white rounded-xl border border-slate-300">
              <Spinner size="lg" />
              <p className="text-sm font-medium text-slate-600 mt-3">جارٍ تحميل الأصناف والأسعار...</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-xl border border-slate-300 space-y-2">
              <ShoppingBag className="w-10 h-10 text-slate-400 mx-auto" />
              <p className="text-sm font-bold text-slate-800">لا توجد أصناف مطابقة للبحث</p>
              <p className="text-xs text-slate-500">تأكد من كتابة الاسم أو الكود بشكل صحيح، أو استخدم زر "صيانة" لإضافة خدمة</p>
            </div>
          ) : (
            <div className="space-y-3.5">
              {/* Product Cards Container with padding so quantity badges are never cropped */}
              <div className="p-3.5 bg-slate-50/50 rounded-xl border border-slate-300">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
                  {paginatedProducts.map(p => {
                    const isOutOfStock = p.stock <= 0;
                    const inCart = cart.find(c => c.item_type !== 'maintenance' && c.product?.id === p.id);

                    return (
                      <div
                        key={p.id}
                        onClick={() => !isOutOfStock && handleAddToCart(p)}
                        className={`p-3.5 rounded-xl border transition-all text-right flex flex-col justify-between relative select-none ${isOutOfStock
                          ? 'bg-slate-50 border-slate-200 opacity-60 cursor-not-allowed'
                          : inCart
                            ? 'bg-blue-50/40 hover:bg-blue-50/60 border-blue-500 ring-1 ring-blue-500/40 shadow-xs cursor-pointer'
                            : 'bg-white hover:bg-slate-50 border-slate-300 hover:border-blue-500 hover:shadow-xs cursor-pointer'
                          }`}
                      >
                        {/* High-visibility, uncropped cart quantity badge */}
                        {inCart && (
                          <span
                            className="absolute -top-2.5 start-3 min-w-[28px] h-6 px-1.5 bg-blue-600 text-white text-xs font-mono font-bold rounded-full flex items-center justify-center gap-1 shadow-md ring-2 ring-white z-10 transition-transform animate-in zoom-in-75"
                            title={`الكمية المضافة في السلة: ${inCart.quantity}`}
                          >
                            <ShoppingBag className="w-3 h-3" />
                            <span className="tabular-nums">{inCart.quantity}</span>
                          </span>
                        )}

                        <div>
                          <div className="flex items-center justify-between gap-1 mb-2">
                            <span className="text-xs font-mono font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded truncate max-w-[110px] tabular-nums">
                              {p.code}
                            </span>
                            <span
                              className={`text-xs font-bold px-2 py-0.5 rounded tabular-nums ${isOutOfStock
                                ? 'bg-rose-100 text-rose-800'
                                : p.stock <= p.low_stock_threshold
                                  ? 'bg-amber-100 text-amber-900'
                                  : 'bg-emerald-100 text-emerald-800'
                                }`}
                            >
                              {formatPieceCount(p.stock)}
                            </span>
                          </div>

                          <h4 className="text-sm font-bold text-slate-900 line-clamp-2 leading-snug">
                            {p.name}
                          </h4>
                        </div>

                        <div className="mt-3 pt-2.5 border-t border-slate-200 flex items-center justify-between">
                          <span className="text-sm font-bold text-slate-900 font-mono tabular-nums">
                            {formatCurrency(p.price)}
                          </span>
                          <Button
                            size="sm"
                            variant={isOutOfStock ? 'outline' : inCart ? 'primary' : 'secondary'}
                            disabled={isOutOfStock}
                            onClick={e => {
                              e.stopPropagation();
                              if (!isOutOfStock) handleAddToCart(p);
                            }}
                            className="h-8 text-xs font-bold px-2.5"
                          >
                            <Plus className="w-3.5 h-3.5 ml-1" />
                            {inCart ? `إضافة (${inCart.quantity})` : 'إضافة'}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Sub-pages Pagination Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white rounded-xl border border-slate-300 text-sm">
                <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
                  <span className="font-semibold text-slate-700">
                    صفحة {validCurrentPage} من {totalPages}
                  </span>
                  <span className="text-slate-400">({filteredProducts.length} صنف)</span>

                  <span className="text-slate-300">|</span>

                  <div className="flex items-center gap-1">
                    <span>لكل صفحة:</span>
                    <select
                      value={itemsPerPage}
                      onChange={e => {
                        setItemsPerPage(Number(e.target.value));
                        setCurrentPage(1);
                      }}
                      className="px-2 py-0.5 text-xs font-bold bg-slate-100 border border-slate-300 rounded focus:outline-none focus:border-slate-800"
                    >
                      <option value={6}>6 أصناف</option>
                      <option value={9}>9 أصناف (افتراضي)</option>
                      <option value={12}>12 صنف</option>
                      <option value={18}>18 صنف</option>
                    </select>
                  </div>
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={validCurrentPage <= 1}
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      className="h-8 px-2.5 text-xs font-semibold"
                      leftIcon={<ChevronRight className="w-4 h-4" />}
                    >
                      السابق
                    </Button>

                    <div className="flex items-center gap-1">
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => {
                        if (
                          totalPages > 6 &&
                          Math.abs(page - validCurrentPage) > 1 &&
                          page !== 1 &&
                          page !== totalPages
                        ) {
                          if (Math.abs(page - validCurrentPage) === 2) {
                            return (
                              <span key={page} className="px-1 text-slate-400 font-mono text-xs">
                                ...
                              </span>
                            );
                          }
                          return null;
                        }

                        return (
                          <button
                            key={page}
                            type="button"
                            onClick={() => setCurrentPage(page)}
                            className={`w-8 h-8 rounded-lg text-xs font-bold font-mono transition-all ${validCurrentPage === page
                              ? 'bg-blue-600 text-white shadow-xs'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300'
                              }`}
                          >
                            {page}
                          </button>
                        );
                      })}
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      disabled={validCurrentPage >= totalPages}
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      className="h-8 px-2.5 text-xs font-semibold"
                      rightIcon={<ChevronLeft className="w-4 h-4" />}
                    >
                      التالي
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Left 5 Cols: Active Cart & Checkout Panel */}
        <div className="lg:col-span-5 space-y-3.5">
          <Card className="border-slate-300">
            <CardHeader className="py-3 px-4 bg-slate-100/80 border-b border-slate-300">
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-sm font-bold text-slate-900">سلة البيع الحالية</CardTitle>
                  <Badge variant="outline" size="sm" className="font-semibold">
                    {cart.length} بنود
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleOpenAddMaintenance}
                    leftIcon={<Wrench className="w-3.5 h-3.5 text-amber-700" />}
                    className="h-7 text-xs border-amber-300 bg-amber-50/60 hover:bg-amber-100 text-amber-900 font-bold"
                  >
                    + صيانة
                  </Button>
                  {cart.length > 0 && (
                    <button
                      type="button"
                      onClick={handleClearCart}
                      className="text-xs text-rose-700 hover:text-rose-900 flex items-center gap-1 font-semibold transition-colors pr-1 border-r border-slate-300"
                    >
                      <RotateCcw className="w-3 h-3" />
                      إفراغ
                    </button>
                  )}
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-3.5">
              {cart.length === 0 ? (
                <div className="py-12 text-center space-y-2.5">
                  <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-300 text-slate-500 mx-auto flex items-center justify-center">
                    <ShoppingBag className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800">السلة فارغة</p>
                    <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                      اختر أصنافاً من القائمة أو اضغط على زر "صيانة" لإضافة خدمة
                    </p>
                    <div className="mt-3">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleOpenAddMaintenance}
                        leftIcon={<Wrench className="w-3.5 h-3.5 text-amber-700" />}
                        className="text-xs font-bold border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100"
                      >
                        إضافة خدمة صيانة
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-0.5">
                  {cart.map(item => {
                    const isMaintenance = item.item_type === 'maintenance';
                    const itemId = item.id || (item.product ? item.product.id : `item-${Math.random()}`);
                    const itemName = isMaintenance ? item.description : item.product?.name;
                    const itemCode = isMaintenance ? 'خدمة صيانة يدوية' : item.product?.code;

                    return (
                      <div
                        key={itemId}
                        className={`p-3 rounded-lg border space-y-2 text-sm ${
                          isMaintenance
                            ? 'bg-amber-50/70 border-amber-200'
                            : 'bg-slate-50/90 border-slate-300'
                        }`}
                      >
                        {/* Top: Name, Code & Delete */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {isMaintenance && (
                                <span className="px-1.5 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                  صيانة
                                </span>
                              )}
                              <p className="font-bold text-slate-900 leading-snug">{itemName}</p>
                            </div>
                            <p className="text-xs text-slate-500 font-mono font-semibold tabular-nums mt-0.5">
                              {itemCode}
                            </p>
                          </div>

                          <div className="flex items-center gap-1">
                            {isMaintenance && (
                              <button
                                type="button"
                                onClick={() => handleOpenEditMaintenance(item)}
                                className="text-slate-500 hover:text-amber-800 p-1 rounded hover:bg-amber-100/80 transition-colors"
                                title="تعديل بند الصيانة"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(itemId)}
                              className="text-slate-500 hover:text-rose-700 p-1 rounded hover:bg-slate-200 transition-colors"
                              title="حذف من السلة"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Controls Row: Quantity, Unit Price, Item Discount, Line Total */}
                        <div className="grid grid-cols-12 gap-2 items-center pt-2 border-t border-slate-200">
                          {/* Qty controls */}
                          <div className="col-span-5 flex items-center gap-1 bg-white border border-slate-300 rounded-lg p-0.5">
                            <button
                              type="button"
                              onClick={() => handleUpdateQuantity(itemId, item.quantity - 1)}
                              className="p-1.5 rounded text-slate-600 hover:bg-slate-100 transition-colors"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <input
                              type="number"
                              min="1"
                              max={isMaintenance ? 9999 : item.product?.stock}
                              value={item.quantity}
                              onFocus={e => e.currentTarget.select()}
                              onChange={e => handleUpdateQuantity(itemId, parseInt(e.target.value, 10) || 1)}
                              className="w-12 text-center font-bold font-mono text-sm bg-transparent focus:outline-none tabular-nums"
                            />
                            <button
                              type="button"
                              onClick={() => handleUpdateQuantity(itemId, item.quantity + 1)}
                              disabled={!isMaintenance && (item.product?.stock !== undefined ? item.quantity >= item.product.stock : false)}
                              className="p-1.5 rounded text-slate-600 hover:bg-slate-100 disabled:opacity-30 transition-colors"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {/* Item discount input */}
                          <div className="col-span-3">
                            <input
                              type="number"
                              min="0"
                              max={isMaintenance ? (item.price || 0) : item.product?.price}
                              value={item.discount || ''}
                              placeholder="خصم"
                              onFocus={e => e.currentTarget.select()}
                              onChange={e => handleUpdateItemDiscount(itemId, parseFloat(e.target.value) || 0)}
                              className="w-full text-center text-xs font-semibold py-1.5 px-1 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-slate-800 font-mono tabular-nums"
                              title="خصم على البند"
                            />
                          </div>

                          {/* Line Total */}
                          <div className="col-span-4 text-left font-mono font-bold text-slate-900 text-sm tabular-nums">
                            {formatCurrency(item.line_total)}
                          </div>
                        </div>

                        {item.discount > 0 && (
                          <div className="text-xs text-emerald-800 font-semibold tabular-nums">
                            سعر الوحدة بعد الخصم: {formatCurrency(item.actual_price)}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Customer Details & Payment Fields */}
              <div className="mt-4 pt-3.5 border-t border-slate-200 space-y-3">
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      اسم العميل {paymentType === 'DEFERRED' ? <span className="text-amber-600 font-bold">(مطلوب للآجل) *</span> : '(اختياري):'}
                    </label>
                    <Input
                      placeholder="الاسم "
                      value={customerName}
                      onChange={e => setCustomerName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      هاتف العميل {paymentType === 'DEFERRED' ? <span className="text-amber-600 font-bold">*</span> : ''}:
                    </label>
                    <Input
                      placeholder="010xxxxxxxx"
                      value={customerPhone}
                      onChange={e => setCustomerPhone(e.target.value)}
                      isMonospace
                    />
                  </div>
                </div>

                {/* Payment Type Selection: Full vs Deferred */}
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">نوع العملية والسداد:</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setPaymentType('FULL');
                        setInitialPayment(0);
                      }}
                      className={`flex items-center justify-center gap-2 p-2.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                        paymentType === 'FULL'
                          ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                          : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <Banknote className="w-4 h-4" />
                      <span>دفع كامل فوري</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setPaymentType('DEFERRED');
                        if (initialPayment === 0 && finalTotal > 0) {
                          setInitialPayment(Math.round(finalTotal / 2));
                        }
                      }}
                      className={`flex items-center justify-center gap-2 p-2.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                        paymentType === 'DEFERRED'
                          ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                          : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <Tag className="w-4 h-4" />
                      <span>بيع آجل / أقساط</span>
                    </button>
                  </div>
                </div>

                {/* Deferred / Installment Configuration */}
                {paymentType === 'DEFERRED' && (
                  <div className="p-3.5 bg-amber-50/70 border border-amber-300 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-amber-700" />
                        <span>بيانات الدفع الآجل والأقساط</span>
                      </span>
                      <span className="text-xs font-bold text-slate-700">
                        المتبقي: <strong className="text-rose-700 font-mono text-sm">{formatCurrency(remainingBalance)}</strong>
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <label className="text-[11px] font-bold text-slate-700">الدفعة المقدمة (EGP):</label>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setInitialPayment(0)}
                              className="text-[10px] bg-white border border-slate-300 px-1.5 py-0.5 rounded text-slate-700 hover:bg-slate-100 font-bold"
                            >
                              0 مقدم
                            </button>
                            <button
                              type="button"
                              onClick={() => setInitialPayment(Math.round(finalTotal / 2))}
                              className="text-[10px] bg-white border border-slate-300 px-1.5 py-0.5 rounded text-slate-700 hover:bg-slate-100 font-bold"
                            >
                              50%
                            </button>
                          </div>
                        </div>
                        <Input
                          type="number"
                          min="0"
                          max={finalTotal}
                          value={initialPayment || ''}
                          placeholder="0"
                          onChange={e => {
                            const val = parseFloat(e.target.value) || 0;
                            setInitialPayment(Math.max(0, Math.min(finalTotal, val)));
                          }}
                          className="h-8 text-xs font-bold font-mono"
                          isMonospace
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-bold text-slate-700 block mb-1">
                          تاريخ استحقاق أول قسط:
                        </label>
                        <Input
                          type="date"
                          value={dueDate}
                          onChange={e => setDueDate(e.target.value)}
                          className="h-8 text-xs font-semibold"
                        />
                      </div>
                    </div>

                    {/* Expandable Schedule Builder */}
                    <div className="pt-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowScheduleBuilder(!showScheduleBuilder)}
                        className="w-full text-xs font-bold border-amber-300 bg-white hover:bg-amber-100/60 text-amber-900 justify-between"
                      >
                        <span>{showScheduleBuilder ? 'إخفاء جدول الأقساط المخطط' : 'تحديد وتوزيع جدول الأقساط بالتفصيل'}</span>
                        <Calendar className="w-3.5 h-3.5 text-amber-700" />
                      </Button>

                      {showScheduleBuilder && remainingBalance > 0 && (
                        <div className="mt-2.5">
                          <InstallmentScheduleBuilder
                            remainingBalance={remainingBalance}
                            schedule={installmentSchedule}
                            onChange={setInstallmentSchedule}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">
                    طريقة سداد {paymentType === 'DEFERRED' ? 'الدفعة المقدمة' : 'المبلغ'}:
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {PAYMENT_METHODS.filter(m => m.id !== 'آجل').map(m => {
                      const Icon = m.icon;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setPaymentMethod(m.id)}
                          className={`flex items-center gap-2 p-2.5 rounded-lg text-sm font-semibold border transition-colors text-right cursor-pointer ${
                            paymentMethod === m.id
                              ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                              : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <Icon className="w-4.5 h-4.5 shrink-0" />
                          <span className="truncate">{m.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </CardContent>

            {/* Financial Summary & Checkout Button */}
            <CardFooter className="flex-col gap-3.5 bg-slate-50/90 p-4 border-t border-slate-300">
              <div className="w-full space-y-2 text-sm">
                <div className="flex justify-between text-slate-700 font-medium">
                  <span>المجموع الفرعي:</span>
                  <span className="font-mono font-bold text-slate-900 tabular-nums">{formatCurrency(subtotal)}</span>
                </div>

                {/* Overall Invoice Discount */}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-700 font-medium">خصم إضافي على الفاتورة:</span>
                  <div className="w-28">
                    <Input
                      type="number"
                      min="0"
                      max={subtotal}
                      value={invoiceDiscount || ''}
                      placeholder="0"
                      onChange={e => setInvoiceDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
                      isMonospace
                    />
                  </div>
                </div>

                {totalDiscount > 0 && (
                  <div className="flex justify-between text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg text-xs font-bold">
                    <span>إجمالي الخصومات:</span>
                    <span className="font-mono tabular-nums">{formatCurrency(totalDiscount)}</span>
                  </div>
                )}

                <div className="border-t border-slate-300 pt-2.5 flex justify-between items-baseline text-slate-900 font-bold">
                  <span className="text-sm">إجمالي الفاتورة الصافي:</span>
                  <span className="text-xl text-slate-900 font-mono font-bold tabular-nums">{formatCurrency(finalTotal)}</span>
                </div>

                {paymentType === 'DEFERRED' && (
                  <div className="p-2.5 bg-amber-50/90 border border-amber-200 rounded-lg space-y-1.5 text-xs">
                    <div className="flex justify-between font-bold text-amber-950">
                      <span>المدفوع مقدماً الآن:</span>
                      <span className="font-mono tabular-nums">{formatCurrency(initialPayment)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-rose-800 border-t border-amber-200 pt-1">
                      <span>المتبقي الآجل المطلوب تحصيله:</span>
                      <span className="font-mono tabular-nums">{formatCurrency(remainingBalance)}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Confirm Sale Button */}
              <Button
                variant="primary"
                size="lg"
                onClick={handleCheckout}
                disabled={cart.length === 0 || isSubmitting}
                className="w-full font-bold"
                leftIcon={isSubmitting ? <Spinner size="sm" /> : <CheckCircle className="w-5 h-5" />}
              >
                {isSubmitting
                  ? 'جارٍ تسجيل الفاتورة...'
                  : paymentType === 'DEFERRED'
                    ? `تأكيد الفاتورة الآجلة (المحصل: ${formatCurrency(initialPayment)})`
                    : `تأكيد الفاتورة (${formatCurrency(finalTotal)})`}
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>

      {/* Maintenance Item Modal */}
      <Modal
        isOpen={isMaintenanceModalOpen}
        onClose={() => setIsMaintenanceModalOpen(false)}
        title={editingMaintenanceId ? 'تعديل  صيانة' : 'إضافة  صيانة للفاتورة'}
        subtitle=""
        size="md"
        footer={
          <div className="flex items-center justify-between w-full">
            <Button
              variant="outline"
              size="md"
              onClick={() => setIsMaintenanceModalOpen(false)}
            >
              إلغاء
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={handleSaveMaintenance}
              leftIcon={<CheckCircle className="w-4.5 h-4.5" />}
              className="bg-amber-600 hover:bg-amber-700 font-bold"
            >
              {editingMaintenanceId ? 'حفظ التعديل' : 'إضافة إلى الفاتورة'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4 py-1">
          {maintError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs font-bold">
              {maintError}
            </div>
          )}

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1.5">
              وصف العمل  <span className="text-rose-600">*</span>
            </label>
            <Input
              placeholder="صيانة: ..."
              value={maintDescription}
              onChange={e => {
                setMaintDescription(e.target.value);
                if (maintError) setMaintError('');
              }}
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">
                سعر الخدمة (جنيه) <span className="text-rose-600">*</span>
              </label>
              <Input
                type="number"
                min="0"
                step="any"
                placeholder="0.00"
                value={maintPrice}
                onChange={e => {
                  setMaintPrice(e.target.value);
                  if (maintError) setMaintError('');
                }}
                isMonospace
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">
                الكمية / العدد
              </label>
              <Input
                type="number"
                min="1"
                value={maintQuantity}
                onChange={e => {
                  const val = parseInt(e.target.value, 10);
                  setMaintQuantity(isNaN(val) ? 1 : Math.max(1, val));
                }}
                isMonospace
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1.5">
              خصم على الخدمة (اختياري)
            </label>
            <Input
              type="number"
              min="0"
              step="any"
              placeholder="0.00"
              value={maintDiscount}
              onChange={e => {
                setMaintDiscount(e.target.value);
                if (maintError) setMaintError('');
              }}
              isMonospace
            />
          </div>

          {/* Realtime Calculation Preview */}
          {parseFloat(maintPrice) > 0 && (
            <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-lg flex items-center justify-between text-xs">
              <span className="text-amber-900 font-bold">إجمالي بند الصيانة المستحق:</span>
              <span className="font-mono font-bold text-slate-900 text-sm">
                {formatCurrency(
                  Math.max(
                    0,
                    (parseFloat(maintPrice) || 0) - (parseFloat(maintDiscount) || 0)
                  ) * Math.max(1, maintQuantity || 1)
                )}
              </span>
            </div>
          )}
        </div>
      </Modal>

      {/* Sale Completed Print Modal */}
      {completedInvoice && (
        <Modal
          isOpen={!!completedInvoice}
          onClose={handleStartNewSale}
          title={`تم إصدار الفاتورة رقم ${completedInvoice.invoice_number}`}
          subtitle=""
          size="xl"
          footer={
            <div className="flex items-center justify-between w-full">
              <Button variant="outline" size="md" onClick={handleStartNewSale} leftIcon={<Plus className="w-4 h-4" />}>
                بدء عملية بيع جديدة
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="md"
                  onClick={async () => {
                    const elementId = printFormat === 'a4' ? 'printable-invoice-a4' : 'printable-invoice-thermal';
                    showNotification({
                      type: 'info',
                      title: 'حفظ الفاتورة بتنسيق PDF',
                      message: 'تم فتح نافذة الطباعة. اختر الوجهة "حفظ بتنسيق PDF" لحفظ المستند بجودة عالية.',
                    });
                    await documentPrintService.exportToPdf(elementId, {
                      title: `فاتورة_${completedInvoice.invoice_number}`,
                      format: printFormat,
                      exportType: 'accessories_invoices',
                    });
                  }}
                  leftIcon={<FileDown className="w-4.5 h-4.5 text-blue-600" />}
                  className="font-bold border-slate-300 hover:bg-slate-50 text-slate-800"
                >
                  حفظ كـ PDF
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  onClick={async () => {
                    const elementId = printFormat === 'a4' ? 'printable-invoice-a4' : 'printable-invoice-thermal';
                    await documentPrintService.printElement(elementId, {
                      title: `فاتورة_${completedInvoice.invoice_number}`,
                      format: printFormat,
                    });
                  }}
                  leftIcon={<Printer className="w-4.5 h-4.5" />}
                  className="font-bold shadow-xs"
                >
                  طباعة الفاتورة 
                </Button>
              </div>
            </div>
          }
        >
          <PrintableInvoice
            invoice={completedInvoice}
            items={completedItems}
            format={printFormat}
            onFormatChange={setPrintFormat}
          />
        </Modal>
      )}
    </div>
  );
};
