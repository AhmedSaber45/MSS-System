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
} from 'lucide-react';
import { formatCurrency, formatPieceCount } from '@/lib/utils';
import { useNotification } from '@/context/NotificationContext';
import { usePageRefresh } from '@/context/PageRefreshContext';
import { productsService } from '@/services/productsService.ts';
import { salesService } from '@/services/salesService.ts';
import { PrintableInvoice } from '@/components/sales/PrintableInvoice.tsx';
import { documentPrintService } from '@/lib/documentPrintService';
import type { Product } from '@/types/product.ts';
import type { CartItem, Invoice, InvoiceItem } from '@/types/sale.ts';

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
            <Input
              placeholder="   ابحث باسم الصنف أو الكود..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onClear={() => setSearchQuery('')}
              leftIcon={<Search className="w-4.5 h-4.5 text-slate-500" />}
              autoFocus
            />

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
              <p className="text-xs text-slate-500">تأكد من كتابة الاسم أو الكود   بشكل صحيح</p>
            </div>
          ) : (
            <div className="space-y-3.5">
              {/* Product Cards Container with padding so quantity badges are never cropped */}
              <div className="p-3.5 bg-slate-50/50 rounded-xl border border-slate-300">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
                  {paginatedProducts.map(p => {
                    const isOutOfStock = p.stock <= 0;
                    const inCart = cart.find(c => c.product.id === p.id);

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
                    {cart.length} أصناف
                  </Badge>
                </div>
                {cart.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearCart}
                    className="text-xs text-rose-700 hover:text-rose-900 flex items-center gap-1.5 font-semibold transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    إفراغ السلة
                  </button>
                )}
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
                      اختر من القائمة لبدء الفاتورة
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-0.5">
                  {cart.map(item => (
                    <div
                      key={item.product.id}
                      className="p-3 bg-slate-50/90 rounded-lg border border-slate-300 space-y-2 text-sm"
                    >
                      {/* Top: Name, Code & Delete */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <p className="font-bold text-slate-900 leading-snug">{item.product.name}</p>
                          <p className="text-xs text-slate-500 font-mono font-semibold tabular-nums mt-0.5">{item.product.code}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.product.id)}
                          className="text-slate-500 hover:text-rose-700 p-1 rounded hover:bg-slate-200 transition-colors"
                          title="حذف من السلة"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Controls Row: Quantity, Unit Price, Item Discount, Line Total */}
                      <div className="grid grid-cols-12 gap-2 items-center pt-2 border-t border-slate-200">
                        {/* Qty controls */}
                        <div className="col-span-5 flex items-center gap-1 bg-white border border-slate-300 rounded-lg p-0.5">
                          <button
                            type="button"
                            onClick={() => handleUpdateQuantity(item.product.id, item.quantity - 1)}
                            className="p-1.5 rounded text-slate-600 hover:bg-slate-100 transition-colors"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <input
                            type="number"
                            min="1"
                            max={item.product.stock}
                            value={item.quantity}
                            onChange={e => handleUpdateQuantity(item.product.id, parseInt(e.target.value, 10) || 1)}
                            className="w-12 text-center font-bold font-mono text-sm bg-transparent focus:outline-none tabular-nums"
                          />
                          <button
                            type="button"
                            onClick={() => handleUpdateQuantity(item.product.id, item.quantity + 1)}
                            disabled={item.quantity >= item.product.stock}
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
                            max={item.product.price}
                            value={item.discount || ''}
                            placeholder="خصم"
                            onChange={e => handleUpdateItemDiscount(item.product.id, parseFloat(e.target.value) || 0)}
                            className="w-full text-center text-xs font-semibold py-1.5 px-1 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-slate-800 font-mono tabular-nums"
                            title="خصم على الصنف"
                          />
                        </div>

                        {/* Line Total */}
                        <div className="col-span-4 text-left font-mono font-bold text-slate-900 text-sm tabular-nums">
                          {formatCurrency(item.line_total)}
                        </div>
                      </div>

                      {item.discount > 0 && (
                        <div className="text-xs text-emerald-800 font-semibold tabular-nums">
                          سعر القطعة بعد الخصم: {formatCurrency(item.actual_price)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Customer Details & Payment Fields */}
              <div className="mt-4 pt-3.5 border-t border-slate-200 space-y-3">
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">اسم العميل (اختياري):</label>
                    <Input
                      placeholder="الاسم "
                      value={customerName}
                      onChange={e => setCustomerName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">هاتف العميل:</label>
                    <Input
                      placeholder="010xxxxxxxx"
                      value={customerPhone}
                      onChange={e => setCustomerPhone(e.target.value)}
                      isMonospace
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">طريقة السداد:</label>
                  <div className="grid grid-cols-2 gap-2">
                    {PAYMENT_METHODS.map(m => {
                      const Icon = m.icon;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setPaymentMethod(m.id)}
                          className={`flex items-center gap-2 p-2.5 rounded-lg text-sm font-semibold border transition-colors text-right ${paymentMethod === m.id
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
                  <span className="text-sm">الصافي النهائي المستحق:</span>
                  <span className="text-xl text-slate-900 font-mono font-bold tabular-nums">{formatCurrency(finalTotal)}</span>
                </div>
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
