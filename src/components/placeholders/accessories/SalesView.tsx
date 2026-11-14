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
  Barcode,
  ShoppingBag,
  CreditCard,
  Banknote,
  RotateCcw,
  Tag,
  AlertCircle,
  FileCheck2,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { useNotification } from '@/context/NotificationContext';
import { productsService } from '@/services/productsService.ts';
import { salesService } from '@/services/salesService.ts';
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner.ts';
import { PrintableInvoice } from '@/components/sales/PrintableInvoice.tsx';
import type { Product } from '@/types/product.ts';
import type { CartItem, Invoice, InvoiceItem } from '@/types/sale.ts';

const PAYMENT_METHODS = [
  { id: 'نقدي', label: 'نقدي (كاش)', icon: Banknote },
  { id: 'بطاقة / فيزا', label: 'بطاقة / فيزا', icon: CreditCard },
  { id: 'تحويل بنكي / محفظة', label: 'تحويل بنكي / فودافون كاش', icon: CreditCard },
  { id: 'آجل', label: 'آجل (حساب عميل)', icon: Tag },
];

export const SalesView: React.FC = () => {
  const { showNotification } = useNotification();

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
  const [saleNotes, setSaleNotes] = useState<string>('');

  // Checkout submission lock
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

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
        p.code.toLowerCase().includes(q) ||
        (p.barcode && p.barcode.toLowerCase().includes(q))
      );
    });
  }, [products, selectedCategory, searchQuery]);

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
      const existingIndex = prevCart.findIndex(item => item.product.id === product.id);

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

  // Hardware barcode scanner integration
  useBarcodeScanner({
    onScan: (scannedCode) => {
      const cleaned = scannedCode.trim();
      const matched = products.find(
        p => (p.barcode && p.barcode === cleaned) || p.code.toLowerCase() === cleaned.toLowerCase()
      );

      if (matched) {
        handleAddToCart(matched);
        showNotification({
          type: 'success',
          title: 'تم مسح الباركود بنجاح',
          message: `أضيف الصنف: ${matched.name}`,
        });
      } else {
        showNotification({
          type: 'warning',
          title: 'باركود غير مسجل',
          message: `الباركود "${cleaned}" غير مرتبط بأي صنف في النظام.`,
        });
      }
    },
  });

  // Modify item quantity
  const handleUpdateQuantity = (productId: string, newQty: number) => {
    if (newQty <= 0) {
      handleRemoveItem(productId);
      return;
    }

    setCart(prevCart => {
      return prevCart.map(item => {
        if (item.product.id === productId) {
          if (newQty > item.product.stock) {
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
  const handleUpdateItemDiscount = (productId: string, discountAmount: number) => {
    setCart(prevCart => {
      return prevCart.map(item => {
        if (item.product.id === productId) {
          const validDiscount = Math.max(0, Math.min(item.product.price, discountAmount));
          const actualPrice = item.product.price - validDiscount;
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
  const handleRemoveItem = (productId: string) => {
    setCart(prev => prev.filter(i => i.product.id !== productId));
  };

  // Clear entire cart
  const handleClearCart = () => {
    setCart([]);
    setInvoiceDiscount(0);
    setSaleNotes('');
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

  // Submit sale with double-submission protection
  const handleCheckout = async () => {
    if (isSubmitting) return;

    if (cart.length === 0) {
      showNotification({
        type: 'warning',
        title: 'السلة فارغة',
        message: 'يرجى اختيار صنف واحد على الأقل لإتمام البيع.',
      });
      return;
    }

    if (invoiceDiscount > subtotal) {
      showNotification({
        type: 'error',
        title: 'قيمة الخصم غير صالحة',
        message: 'خصم الفاتورة الإجمالي لا يمكن أن يتجاوز مجموع الأصناف.',
      });
      return;
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
        items: cart.map(item => ({
          product_id: item.product.id,
          quantity: item.quantity,
          discount: item.discount,
        })),
      };

      const invoice = await salesService.createSale(saleInput);
      const items = await salesService.getInvoiceItems(invoice.id);

      showNotification({
        type: 'success',
        title: 'تم تسجيل عملية البيع بنجاح',
        message: `فاتورة رقم ${invoice.invoice_number} بقيمة ${formatCurrency(invoice.total_amount)}`,
      });

      // Prepare print modal
      setCompletedInvoice(invoice);
      setCompletedItems(items);

      // Refresh product list and next invoice number
      await loadData();

      // Reset cart and customer fields
      handleClearCart();
      setCustomerName('');
      setCustomerPhone('');
    } catch (err: any) {
      showNotification({
        type: 'error',
        title: 'فشل إتمام البيع',
        message: err.message || 'حدث خطأ أثناء حفظ الفاتورة وخصم المخزون',
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
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="نقطة البيع والمبيعات (POS)"
        subtitle="مسح سريع للباركود، تجهيز سلة المبيعات، تطبيق الخصومات، والطباعة الفورية"
        actions={
          <div className="flex items-center gap-3">
            <Badge variant="primary" size="md" className="font-mono px-3 py-1 text-xs">
              رقم الفاتورة القادمة: {nextInvoiceNumber || '...'}
            </Badge>
            <div className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>القارئ جاهز للباركود</span>
            </div>
          </div>
        }
      />

      {/* Main 2-Column POS Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Right 7 Cols: Product Catalog & Search */}
        <div className="lg:col-span-7 space-y-4">
          {/* Search & Barcode Input Card */}
          <Card className="p-3 bg-white border-blue-200 shadow-sm">
            <div className="relative">
              <Input
                placeholder="امسح الباركود بالقارئ، أو اكتب اسم الصنف / الكود / الباركود..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                leftIcon={<Search className="w-5 h-5 text-blue-600" />}
                scannerReady
                className="py-2.5 text-sm"
                autoFocus
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute left-10 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
                >
                  مسح
                </button>
              )}
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-1.5 mt-3 overflow-x-auto pb-1 text-xs">
              <button
                type="button"
                onClick={() => setSelectedCategory('ALL')}
                className={`px-3 py-1 rounded-lg font-bold transition-all whitespace-nowrap ${
                  selectedCategory === 'ALL'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                جميع الأصناف ({products.length})
              </button>
              {categories.map(cat => {
                const count = products.filter(p => p.category === cat).length;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1 rounded-lg font-bold transition-all whitespace-nowrap ${
                      selectedCategory === cat
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {cat} ({count})
                  </button>
                );
              })}
            </div>
          </Card>

          {/* Product Grid / List */}
          {isLoading ? (
            <div className="p-12 flex flex-col items-center justify-center bg-white rounded-xl border border-slate-200">
              <Spinner size="lg" />
              <p className="text-xs text-slate-500 mt-3">جارٍ تحميل قائمة الأصناف والأسعار...</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-xl border border-slate-200 space-y-2">
              <ShoppingBag className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="text-sm font-bold text-slate-700">لا توجد أصناف مطابقة للبحث</p>
              <p className="text-xs text-slate-400">تأكد من كتابة الاسم أو الكود أو الباركود بشكل صحيح</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[580px] overflow-y-auto p-1">
              {filteredProducts.map(p => {
                const isOutOfStock = p.stock <= 0;
                const inCart = cart.find(c => c.product.id === p.id);

                return (
                  <div
                    key={p.id}
                    onClick={() => !isOutOfStock && handleAddToCart(p)}
                    className={`p-3 rounded-xl border transition-all text-right flex flex-col justify-between relative select-none ${
                      isOutOfStock
                        ? 'bg-slate-50 border-slate-200 opacity-60 cursor-not-allowed'
                        : 'bg-white hover:bg-blue-50/60 border-slate-200 hover:border-blue-300 shadow-2xs hover:shadow-sm cursor-pointer'
                    }`}
                  >
                    {inCart && (
                      <span className="absolute -top-2 -left-2 w-6 h-6 bg-blue-600 text-white text-xs font-bold rounded-full flex items-center justify-center shadow">
                        {inCart.quantity}
                      </span>
                    )}

                    <div>
                      <div className="flex items-center justify-between gap-1 mb-1.5">
                        <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded truncate max-w-[120px]">
                          {p.code}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            isOutOfStock
                              ? 'bg-rose-100 text-rose-700'
                              : p.stock <= p.low_stock_threshold
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {isOutOfStock ? 'نفد' : `${p.stock} قط.`}
                        </span>
                      </div>

                      <h4 className="text-xs font-bold text-slate-900 line-clamp-2 leading-relaxed">
                        {p.name}
                      </h4>
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-xs font-black text-blue-700 font-mono">
                        {formatCurrency(p.price)}
                      </span>
                      <Button
                        size="sm"
                        variant={isOutOfStock ? 'outline' : 'primary'}
                        disabled={isOutOfStock}
                        onClick={e => {
                          e.stopPropagation();
                          if (!isOutOfStock) handleAddToCart(p);
                        }}
                      >
                        <Plus className="w-3 h-3 ml-0.5" />
                        إضافة
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Left 5 Cols: Active Cart & Checkout Panel */}
        <div className="lg:col-span-5 space-y-4">
          <Card className="border-slate-300 shadow-md bg-white">
            <CardHeader className="bg-slate-50/90 py-3 px-4 flex flex-row items-center justify-between border-b border-slate-200">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-bold text-slate-900">سلة البيع الحالية</CardTitle>
                <Badge variant="primary" size="sm">
                  {cart.length} أصناف
                </Badge>
              </div>
              {cart.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearCart}
                  className="text-xs text-rose-600 hover:text-rose-800 flex items-center gap-1 font-bold"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  إفراغ السلة
                </button>
              )}
            </CardHeader>

            <CardContent className="p-3">
              {cart.length === 0 ? (
                <div className="py-12 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-500 mx-auto flex items-center justify-center">
                    <Barcode className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-700">السلة فارغة</p>
                    <p className="text-[11px] text-slate-400 mt-1 max-w-xs mx-auto">
                      امسح الباركود باستخدام الماسح الضوئي أو اختر الأصناف من القائمة للبدء
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                  {cart.map(item => (
                    <div
                      key={item.product.id}
                      className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs"
                    >
                      {/* Top: Name, Code & Delete */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <p className="font-bold text-slate-900 leading-tight">{item.product.name}</p>
                          <p className="text-[10px] text-slate-400 font-mono mt-0.5">{item.product.code}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.product.id)}
                          className="text-slate-400 hover:text-rose-600 p-1 rounded-md hover:bg-rose-50 transition-colors"
                          title="حذف من السلة"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Controls Row: Quantity, Unit Price, Item Discount, Line Total */}
                      <div className="grid grid-cols-12 gap-2 items-center pt-1 border-t border-slate-200/80">
                        {/* Qty controls */}
                        <div className="col-span-5 flex items-center gap-1 bg-white border border-slate-300 rounded-lg p-0.5">
                          <button
                            type="button"
                            onClick={() => handleUpdateQuantity(item.product.id, item.quantity - 1)}
                            className="p-1 rounded text-slate-600 hover:bg-slate-100"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <input
                            type="number"
                            min="1"
                            max={item.product.stock}
                            value={item.quantity}
                            onChange={e => handleUpdateQuantity(item.product.id, parseInt(e.target.value, 10) || 1)}
                            className="w-10 text-center font-bold text-xs bg-transparent focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => handleUpdateQuantity(item.product.id, item.quantity + 1)}
                            disabled={item.quantity >= item.product.stock}
                            className="p-1 rounded text-slate-600 hover:bg-slate-100 disabled:opacity-30"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        {/* Item discount input */}
                        <div className="col-span-3">
                          <div className="relative">
                            <input
                              type="number"
                              min="0"
                              max={item.product.price}
                              value={item.discount || ''}
                              placeholder="خصم"
                              onChange={e => handleUpdateItemDiscount(item.product.id, parseFloat(e.target.value) || 0)}
                              className="w-full text-center text-[11px] py-1 px-1 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 font-mono"
                              title="خصم على الصنف"
                            />
                          </div>
                        </div>

                        {/* Line Total */}
                        <div className="col-span-4 text-left font-mono font-bold text-slate-900 text-xs">
                          {formatCurrency(item.line_total)}
                        </div>
                      </div>

                      {item.discount > 0 && (
                        <div className="text-[10px] text-emerald-700 font-medium">
                          سعر القطعة بعد الخصم: {formatCurrency(item.actual_price)} (وفر {formatCurrency(item.discount)})
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Customer Details & Payment Fields (Collapsible / Compact) */}
              <div className="mt-4 pt-3 border-t border-slate-200 space-y-2.5">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">اسم العميل (اختياري):</label>
                    <Input
                      placeholder="عميل نقدي"
                      value={customerName}
                      onChange={e => setCustomerName(e.target.value)}
                      className="py-1 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">هاتف العميل:</label>
                    <Input
                      placeholder="010xxxxxxxx"
                      value={customerPhone}
                      onChange={e => setCustomerPhone(e.target.value)}
                      className="py-1 text-xs font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">طريقة السداد:</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {PAYMENT_METHODS.map(m => {
                      const Icon = m.icon;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setPaymentMethod(m.id)}
                          className={`flex items-center gap-1.5 p-2 rounded-lg text-xs font-bold border transition-all text-right ${
                            paymentMethod === m.id
                              ? 'bg-blue-50 border-blue-600 text-blue-700 shadow-2xs'
                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{m.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </CardContent>

            {/* Financial Summary & Checkout Button */}
            <CardFooter className="flex-col gap-3 bg-slate-50 p-4 border-t border-slate-200">
              <div className="w-full space-y-2 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>المجموع الفرعي:</span>
                  <span className="font-mono font-bold">{formatCurrency(subtotal)}</span>
                </div>

                {/* Overall Invoice Discount */}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-600">خصم إضافي على الفاتورة:</span>
                  <div className="w-24">
                    <Input
                      type="number"
                      min="0"
                      max={subtotal}
                      value={invoiceDiscount || ''}
                      placeholder="0"
                      onChange={e => setInvoiceDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="py-1 text-center font-bold text-xs font-mono"
                    />
                  </div>
                </div>

                {totalDiscount > 0 && (
                  <div className="flex justify-between text-emerald-700 bg-emerald-50 px-2 py-1 rounded text-[11px] font-bold">
                    <span>إجمالي الخصومات الممنوحة:</span>
                    <span className="font-mono">{formatCurrency(totalDiscount)}</span>
                  </div>
                )}

                <div className="border-t-2 border-slate-300 pt-2 flex justify-between items-baseline text-slate-950 font-black">
                  <span className="text-sm">الصافي النهائي المستحق:</span>
                  <span className="text-lg text-blue-800 font-mono">{formatCurrency(finalTotal)}</span>
                </div>
              </div>

              {/* Confirm Sale Button */}
              <Button
                variant="primary"
                size="lg"
                onClick={handleCheckout}
                disabled={cart.length === 0 || isSubmitting}
                className="w-full shadow-md font-bold text-sm py-3"
                leftIcon={isSubmitting ? <Spinner size="sm" /> : <CheckCircle className="w-4 h-4" />}
              >
                {isSubmitting
                  ? 'جارٍ تسجيل الفاتورة وخصم المخزون...'
                  : `تأكيد وطباعة الفاتورة (${formatCurrency(finalTotal)})`}
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>

      {/* Sale Completed Print Modal */}
      {completedInvoice && (
        <Modal
          isOpen={!!completedInvoice}
          onClose={handleStartNewSale}
          title={`تم إصدار الفاتورة رقم ${completedInvoice.invoice_number}`}
          subtitle="تم حفظ عملية البيع وخصم المخزون بنجاح"
          size="xl"
          footer={
            <div className="flex items-center justify-between w-full">
              <Button variant="outline" size="sm" onClick={handleStartNewSale} leftIcon={<Plus className="w-4 h-4" />}>
                بدء عملية بيع جديدة
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => window.print()}
                  leftIcon={<FileCheck2 className="w-4 h-4" />}
                  className="font-bold"
                >
                  طباعة الإيصال فوراً
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
