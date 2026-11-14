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
  ScanBarcode,
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

      // Open print modal
      setCompletedInvoice(invoice);
      setCompletedItems(items);

      showNotification({
        type: 'success',
        title: 'تم تسجيل الفاتورة بنجاح',
        message: `تم إصدار الفاتورة (${invoice.invoice_number}) وخصم الكميات من المخزن.`,
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
        title="نقطة البيع وإصدار الفواتير (POS)"
        subtitle="نظام كاشير سريع — مسح الباركود، حساب الخصومات الفورية، والطباعة الحرارية"
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="outline" size="md" className="font-mono tabular-nums text-xs">
              الفاتورة: {nextInvoiceNumber || '...'}
            </Badge>
            <div className="flex items-center gap-1.5 text-xs text-slate-600 bg-slate-50 px-2.5 h-8 rounded-lg border border-slate-200">
              <ScanBarcode className="w-3.5 h-3.5 text-slate-500" />
              <span>القارئ جاهز</span>
            </div>
          </div>
        }
      />

      {/* Main 2-Column POS Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Right 7 Cols: Product Catalog & Search */}
        <div className="lg:col-span-7 space-y-3.5">
          {/* Search & Barcode Input Card */}
          <Card className="p-3">
            <Input
              placeholder="امسح الباركود، أو ابحث باسم الصنف أو الكود..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onClear={() => setSearchQuery('')}
              leftIcon={<Search className="w-3.5 h-3.5" />}
              scannerReady
              autoFocus
            />

            {/* Category Filter Buttons */}
            <div className="flex items-center gap-1.5 mt-2.5 overflow-x-auto pb-0.5 text-xs">
              <button
                type="button"
                onClick={() => setSelectedCategory('ALL')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                  selectedCategory === 'ALL'
                    ? 'bg-slate-900 text-white font-semibold'
                    : 'bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
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
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                      selectedCategory === cat
                        ? 'bg-slate-900 text-white font-semibold'
                        : 'bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
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
            <div className="p-12 flex flex-col items-center justify-center bg-white rounded-xl border border-slate-200">
              <Spinner size="lg" />
              <p className="text-xs text-slate-500 mt-2.5">جارٍ تحميل الأصناف والأسعار...</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-xl border border-slate-200 space-y-1.5">
              <ShoppingBag className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-xs font-medium text-slate-700">لا توجد أصناف مطابقة للبحث</p>
              <p className="text-[11px] text-slate-400">تأكد من كتابة الاسم أو الكود أو الباركود بشكل صحيح</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-[580px] overflow-y-auto pr-0.5">
              {filteredProducts.map(p => {
                const isOutOfStock = p.stock <= 0;
                const inCart = cart.find(c => c.product.id === p.id);

                return (
                  <div
                    key={p.id}
                    onClick={() => !isOutOfStock && handleAddToCart(p)}
                    className={`p-3 rounded-lg border transition-colors text-right flex flex-col justify-between relative select-none ${
                      isOutOfStock
                        ? 'bg-slate-50 border-slate-200 opacity-60 cursor-not-allowed'
                        : 'bg-white hover:bg-slate-50 border-slate-200/90 hover:border-slate-300 shadow-subtle cursor-pointer'
                    }`}
                  >
                    {inCart && (
                      <span className="absolute -top-1.5 -left-1.5 w-5 h-5 bg-slate-900 text-white text-[11px] font-mono font-medium rounded-full flex items-center justify-center shadow-subtle">
                        {inCart.quantity}
                      </span>
                    )}

                    <div>
                      <div className="flex items-center justify-between gap-1 mb-1.5">
                        <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded truncate max-w-[100px] tabular-nums">
                          {p.code}
                        </span>
                        <span
                          className={`text-[10px] font-medium px-1.5 py-0.5 rounded tabular-nums ${
                            isOutOfStock
                              ? 'bg-rose-50 text-rose-700'
                              : p.stock <= p.low_stock_threshold
                              ? 'bg-amber-50 text-amber-800'
                              : 'bg-emerald-50 text-emerald-800'
                          }`}
                        >
                          {isOutOfStock ? 'نفد' : `${p.stock} قط.`}
                        </span>
                      </div>

                      <h4 className="text-xs font-medium text-slate-900 line-clamp-2 leading-snug">
                        {p.name}
                      </h4>
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-900 font-mono tabular-nums">
                        {formatCurrency(p.price)}
                      </span>
                      <Button
                        size="sm"
                        variant={isOutOfStock ? 'outline' : 'secondary'}
                        disabled={isOutOfStock}
                        onClick={e => {
                          e.stopPropagation();
                          if (!isOutOfStock) handleAddToCart(p);
                        }}
                        className="h-7 text-xs px-2"
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
        <div className="lg:col-span-5 space-y-3.5">
          <Card>
            <CardHeader className="py-2.5 px-4 bg-slate-50/70 border-b border-slate-100">
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-xs font-semibold text-slate-900">سلة البيع الحالية</CardTitle>
                  <Badge variant="outline" size="sm">
                    {cart.length} أصناف
                  </Badge>
                </div>
                {cart.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearCart}
                    className="text-xs text-rose-700 hover:text-rose-900 flex items-center gap-1 font-medium transition-colors"
                  >
                    <RotateCcw className="w-3 h-3" />
                    إفراغ السلة
                  </button>
                )}
              </div>
            </CardHeader>

            <CardContent className="p-3">
              {cart.length === 0 ? (
                <div className="py-10 text-center space-y-2">
                  <div className="w-10 h-10 rounded-lg bg-slate-50 border border-slate-100 text-slate-400 mx-auto flex items-center justify-center">
                    <ShoppingBag className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-700">السلة فارغة</p>
                    <p className="text-[11px] text-slate-400 mt-0.5 max-w-xs mx-auto">
                      امسح الباركود باستخدام الماسح أو اختر من القائمة لبدء الفاتورة
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-0.5">
                  {cart.map(item => (
                    <div
                      key={item.product.id}
                      className="p-2.5 bg-slate-50/70 rounded-lg border border-slate-200/90 space-y-1.5 text-xs"
                    >
                      {/* Top: Name, Code & Delete */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <p className="font-medium text-slate-900 leading-tight">{item.product.name}</p>
                          <p className="text-[10px] text-slate-400 font-mono tabular-nums mt-0.5">{item.product.code}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.product.id)}
                          className="text-slate-400 hover:text-rose-700 p-0.5 rounded hover:bg-slate-100 transition-colors"
                          title="حذف من السلة"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Controls Row: Quantity, Unit Price, Item Discount, Line Total */}
                      <div className="grid grid-cols-12 gap-1.5 items-center pt-1 border-t border-slate-200/60">
                        {/* Qty controls */}
                        <div className="col-span-5 flex items-center gap-1 bg-white border border-slate-200 rounded-md p-0.5">
                          <button
                            type="button"
                            onClick={() => handleUpdateQuantity(item.product.id, item.quantity - 1)}
                            className="p-1 rounded text-slate-500 hover:bg-slate-100 transition-colors"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <input
                            type="number"
                            min="1"
                            max={item.product.stock}
                            value={item.quantity}
                            onChange={e => handleUpdateQuantity(item.product.id, parseInt(e.target.value, 10) || 1)}
                            className="w-10 text-center font-medium font-mono text-xs bg-transparent focus:outline-none tabular-nums"
                          />
                          <button
                            type="button"
                            onClick={() => handleUpdateQuantity(item.product.id, item.quantity + 1)}
                            disabled={item.quantity >= item.product.stock}
                            className="p-1 rounded text-slate-500 hover:bg-slate-100 disabled:opacity-30 transition-colors"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        {/* Item discount input */}
                        <div className="col-span-3">
                          <input
                            type="number"
                            min="0"
                            max={item.product.price}
                            value={item.discount || ''}
                            placeholder="خصم"
                            onChange={e => handleUpdateItemDiscount(item.product.id, parseFloat(e.target.value) || 0)}
                            className="w-full text-center text-xs py-1 px-1 bg-white border border-slate-200 rounded-md focus:outline-none focus:border-slate-800 font-mono tabular-nums"
                            title="خصم على الصنف"
                          />
                        </div>

                        {/* Line Total */}
                        <div className="col-span-4 text-left font-mono font-semibold text-slate-900 text-xs tabular-nums">
                          {formatCurrency(item.line_total)}
                        </div>
                      </div>

                      {item.discount > 0 && (
                        <div className="text-[10px] text-emerald-800 font-medium tabular-nums">
                          سعر القطعة بعد الخصم: {formatCurrency(item.actual_price)} (وفر {formatCurrency(item.discount)})
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Customer Details & Payment Fields */}
              <div className="mt-3.5 pt-3 border-t border-slate-100 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-medium text-slate-600 block mb-1">اسم العميل (اختياري):</label>
                    <Input
                      placeholder="عميل نقدي"
                      value={customerName}
                      onChange={e => setCustomerName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-slate-600 block mb-1">هاتف العميل:</label>
                    <Input
                      placeholder="010xxxxxxxx"
                      value={customerPhone}
                      onChange={e => setCustomerPhone(e.target.value)}
                      isMonospace
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-medium text-slate-600 block mb-1">طريقة السداد:</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {PAYMENT_METHODS.map(m => {
                      const Icon = m.icon;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setPaymentMethod(m.id)}
                          className={`flex items-center gap-1.5 p-2 rounded-md text-xs font-medium border transition-colors text-right ${
                            paymentMethod === m.id
                              ? 'bg-slate-900 text-white border-slate-900'
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
            <CardFooter className="flex-col gap-3 bg-slate-50/70 p-3.5 border-t border-slate-100">
              <div className="w-full space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>المجموع الفرعي:</span>
                  <span className="font-mono font-medium tabular-nums">{formatCurrency(subtotal)}</span>
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
                      isMonospace
                    />
                  </div>
                </div>

                {totalDiscount > 0 && (
                  <div className="flex justify-between text-emerald-800 bg-emerald-50 px-2 py-1 rounded text-[11px] font-medium">
                    <span>إجمالي الخصومات:</span>
                    <span className="font-mono tabular-nums">{formatCurrency(totalDiscount)}</span>
                  </div>
                )}

                <div className="border-t border-slate-200 pt-2 flex justify-between items-baseline text-slate-900 font-semibold">
                  <span className="text-xs">الصافي النهائي المستحق:</span>
                  <span className="text-base text-slate-900 font-mono tabular-nums">{formatCurrency(finalTotal)}</span>
                </div>
              </div>

              {/* Confirm Sale Button */}
              <Button
                variant="primary"
                size="md"
                onClick={handleCheckout}
                disabled={cart.length === 0 || isSubmitting}
                className="w-full font-medium"
                leftIcon={isSubmitting ? <Spinner size="sm" /> : <CheckCircle className="w-4 h-4" />}
              >
                {isSubmitting
                  ? 'جارٍ تسجيل الفاتورة...'
                  : `تأكيد الفاتورة (${formatCurrency(finalTotal)})`}
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
              <Button variant="outline" size="sm" onClick={handleStartNewSale} leftIcon={<Plus className="w-3.5 h-3.5" />}>
                بدء عملية بيع جديدة
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => window.print()}
                leftIcon={<FileCheck2 className="w-3.5 h-3.5" />}
              >
                طباعة الإيصال فوراً
              </Button>
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
