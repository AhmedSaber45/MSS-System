import React, { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { Table, Column } from '@/components/common/Table';
import { Badge } from '@/components/common/Badge';
import { Card } from '@/components/common/Card';
import { Modal } from '@/components/common/Modal';
import { Spinner } from '@/components/common/Spinner';
import { Eye, Printer, Search, Store, FileText, DollarSign, TrendingUp, RotateCcw } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
import { mssCommerceService } from '@/services/mssCommerceService';
import type { MSSInvoice, MSSStockLocation } from '@/types/mssCommerce';

export const MSSInvoicesView: React.FC = () => {
  const [invoices, setInvoices] = useState<MSSInvoice[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sellingBranchFilter, setSellingBranchFilter] = useState<'ALL' | MSSStockLocation>('ALL');
  const [selectedInvoice, setSelectedInvoice] = useState<MSSInvoice | null>(null);

  // Load Invoices
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const list = await mssCommerceService.getInvoices();
      setInvoices(list);
    } catch (err) {
      console.error('Failed to load invoices:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Aggregated KPIs
  const totalInvoices = invoices.length;
  const activeInvoices = invoices.filter(i => !i.is_returned);
  const totalRevenue = activeInvoices.reduce((sum, i) => sum + i.actual_sale_price, 0);
  const totalProfit = activeInvoices.reduce((sum, i) => sum + i.gross_profit, 0);

  // Filtered Invoices
  const filteredInvoices = invoices.filter(inv => {
    if (sellingBranchFilter !== 'ALL' && inv.selling_branch !== sellingBranchFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const matchNum = inv.invoice_number.toLowerCase().includes(q);
      const matchSerial = inv.serial_number.toLowerCase().includes(q);
      const matchModel = inv.model_name?.toLowerCase().includes(q);
      const matchBrand = inv.brand?.toLowerCase().includes(q);
      const matchCustomer = inv.customer_name?.toLowerCase().includes(q);
      if (!matchNum && !matchSerial && !matchModel && !matchBrand && !matchCustomer) {
        return false;
      }
    }
    return true;
  });

  // Table Columns
  const columns: Column<MSSInvoice>[] = [
    {
      key: 'invoice_number',
      header: 'رقم الفاتورة',
      render: (item: MSSInvoice) => (
        <span className="font-mono font-bold text-slate-900 text-sm tabular-nums">
          {item.invoice_number}
        </span>
      ),
    },
    {
      key: 'sale_date',
      header: 'التاريخ',
      render: (item: MSSInvoice) => (
        <span className="font-mono text-sm font-medium text-slate-600 tabular-nums">
          {formatDate(item.sale_date)}
        </span>
      ),
    },
    {
      key: 'model_name',
      header: 'الموديل والسيريال',
      render: (item: MSSInvoice) => (
        <div className="space-y-1">
          <span className="font-bold text-slate-900 text-sm block">
            {item.brand ? `${item.brand} ` : ''}
            {item.model_name}
          </span>
          <span className="inline-block font-mono text-xs font-bold text-slate-900 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-300 tabular-nums">
            {item.serial_number}
          </span>
        </div>
      ),
    },
    {
      key: 'selling_branch',
      header: 'فرع البيع',
      render: (item: MSSInvoice) => (
        <Badge variant={item.selling_branch === 'محل 1' ? 'primary' : 'default'} size="sm">
          {item.selling_branch}
        </Badge>
      ),
    },
    {
      key: 'source_branch',
      header: 'مصدر المخزون',
      render: (item: MSSInvoice) => (
        <div className="flex items-center gap-1.5 font-semibold text-sm">
          <Store className="w-4 h-4 text-slate-500" />
          <Badge variant={item.source_branch === 'محل 1' ? 'primary' : 'default'} size="sm">
            {item.source_branch}
          </Badge>
        </div>
      ),
    },
    {
      key: 'actual_sale_price',
      header: 'سعر البيع الفعلي',
      render: (item: MSSInvoice) => (
        <span className="font-bold text-slate-900 font-mono text-sm tabular-nums">
          {formatCurrency(item.actual_sale_price)}
        </span>
      ),
    },
    {
      key: 'gross_profit',
      header: 'مجمل الربح',
      render: (item: MSSInvoice) => (
        <span
          className={`font-bold font-mono text-sm tabular-nums ${
            item.gross_profit >= 0 ? 'text-emerald-700' : 'text-rose-700'
          }`}
        >
          {item.gross_profit >= 0 ? `+${formatCurrency(item.gross_profit)}` : formatCurrency(item.gross_profit)}
        </span>
      ),
    },
    {
      key: 'is_returned',
      header: 'الحالة',
      render: (item: MSSInvoice) =>
        item.is_returned ? (
          <Badge variant="danger" size="sm">مرتجع</Badge>
        ) : (
          <Badge variant="success" size="sm">سارية</Badge>
        ),
    },
    {
      key: 'actions',
      header: 'معاينة وطباعة',
      align: 'center',
      render: (item: MSSInvoice) => (
        <Button
          size="sm"
          variant="outline"
          onClick={() => setSelectedInvoice(item)}
          className="h-8 px-3 text-xs font-semibold"
          leftIcon={<Eye className="w-4 h-4 text-slate-500" />}
        >
          عرض الفاتورة
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="فواتير مبيعات أجهزة MSS"
        subtitle="سجل فواتير مبيعات اللابتوب والشاشات موثقة بالسيريال ولقطات الأسعار مع إسناد فرع البيع ومصدر المخزون"
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 bg-white border border-slate-300 shadow-2xs">
          <p className="text-sm text-slate-600 font-semibold mb-1">إجمالي الفواتير الصادرة</p>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-900 font-mono tabular-nums">{totalInvoices}</span>
            <FileText className="w-5 h-5 text-slate-500" />
          </div>
          <span className="text-xs text-slate-500 mt-1 block">عملية بيع موثقة بالسيريال</span>
        </Card>

        <Card className="p-4 bg-white border border-slate-300 shadow-2xs">
          <p className="text-sm text-slate-600 font-semibold mb-1">إجمالي الإيراد الفعلي (Revenue)</p>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
              {formatCurrency(totalRevenue)}
            </span>
            <DollarSign className="w-5 h-5 text-slate-500" />
          </div>
          <span className="text-xs text-slate-500 mt-1 block">للفواتير السارية</span>
        </Card>

        <Card className="p-4 bg-white border border-slate-300 shadow-2xs">
          <p className="text-sm text-slate-600 font-semibold mb-1">إجمالي مجمل الربح المشترك</p>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-emerald-700 font-mono tabular-nums">
              {formatCurrency(totalProfit)}
            </span>
            <TrendingUp className="w-5 h-5 text-emerald-600" />
          </div>
          <span className="text-xs text-slate-500 mt-1 block">   MSS </span>
        </Card>
      </div>

      {/* Search and Filter */}
      <Card className="p-4 bg-white border-slate-300 shadow-2xs space-y-4">
        <div className="flex flex-col md:flex-row items-center gap-3">
          <div className="flex-1 w-full">
            <Input
              placeholder="ابحث برقم الفاتورة، السيريال، اسم العميل، الهاتف، أو الموديل..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onClear={() => setSearchQuery('')}
              leftIcon={<Search className="w-4.5 h-4.5" />}
            />
          </div>

          <Button
            variant="outline"
            size="md"
            onClick={loadData}
            title="تحديث البيانات"
            className="font-semibold"
            leftIcon={<RotateCcw className="w-4.5 h-4.5" />}
          >
            تحديث
          </Button>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-3 pt-3 border-t border-slate-200 text-sm">
          <span className="font-semibold text-slate-700 text-sm">تصفية فرع البيع:</span>
          <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-300">
            <button
              onClick={() => setSellingBranchFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                sellingBranchFilter === 'ALL'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              كلا الفرعين ({invoices.length})
            </button>
            <button
              onClick={() => setSellingBranchFilter('محل 1')}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                sellingBranchFilter === 'محل 1'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              محل 1 ({invoices.filter(i => i.selling_branch === 'محل 1').length})
            </button>
            <button
              onClick={() => setSellingBranchFilter('محل 2')}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                sellingBranchFilter === 'محل 2'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              محل 2 ({invoices.filter(i => i.selling_branch === 'محل 2').length})
            </button>
          </div>
        </div>
      </Card>

      {/* Table */}
      {isLoading ? (
        <Card className="p-12 text-center bg-white border-slate-300">
          <Spinner size="lg" className="mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-600">جاري تحميل سجلات الفواتير...</p>
        </Card>
      ) : filteredInvoices.length === 0 ? (
        <Card className="p-12 text-center space-y-3 bg-white border-slate-300">
          <FileText className="w-12 h-12 mx-auto text-slate-400" />
          <h3 className="text-base font-bold text-slate-800">لا توجد فواتير مطابقة</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            تظهر هنا فواتير المبيعات الصادرة لكل جهاز بالسيريال وتفاصيل فروع البيع والتخزين.
          </p>
        </Card>
      ) : (
        <div className="bg-white rounded-xl border border-slate-300 overflow-hidden shadow-2xs">
          <Table
            columns={columns}
            data={filteredInvoices}
            keyExtractor={(item: MSSInvoice) => item.id}
          />
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: Printable Invoice Preview */}
      {/* ========================================================================= */}
      <Modal
        isOpen={!!selectedInvoice}
        onClose={() => setSelectedInvoice(null)}
        title={`معاينة فاتورة مبيعات جهاز (${selectedInvoice?.invoice_number})`}
        subtitle="فاتورة بيع وضمان رسمية تتضمن السيريال والشروط وتفاصيل العملية"
        size="lg"
        footer={
          <div className="flex items-center justify-between w-full">
            <Button variant="outline" size="md" onClick={() => setSelectedInvoice(null)}>
              إغلاق
            </Button>
            <Button
              variant="primary"
              size="md"
              className="font-bold"
              onClick={() => window.print()}
              leftIcon={<Printer className="w-4.5 h-4.5" />}
            >
              طباعة الفاتورة A4
            </Button>
          </div>
        }
      >
        {selectedInvoice && (
          <div className="p-6 bg-white border border-slate-300 rounded-xl space-y-4 text-sm font-sans print:p-0 print:border-none">
            {/* Header */}
            <div className="text-center pb-4 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-900">MSS للحلول التقنية واللابتوب</h3>
              <p className="text-slate-500 text-xs mt-0.5">فاتورة بيع وضمان أجهزة رسمية</p>
            </div>

            {/* Status Banner if Returned */}
            {selectedInvoice.is_returned && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-lg text-center text-sm font-semibold text-rose-700">
                هذه الفاتورة تم إرجاعها وعكس أثرها المالي وإعادة الجهاز إلى المخزون.
              </div>
            )}

            {/* Metadata Grid */}
            <div className="grid grid-cols-2 gap-3 p-4 bg-slate-50 rounded-xl border border-slate-300 text-sm">
              <div>
                <span className="text-slate-500">رقم الفاتورة: </span>
                <strong className="font-mono text-slate-900 font-bold tabular-nums">{selectedInvoice.invoice_number}</strong>
              </div>
              <div>
                <span className="text-slate-500">تاريخ البيع: </span>
                <span className="font-mono font-medium text-slate-800 tabular-nums">{formatDate(selectedInvoice.sale_date)}</span>
              </div>
              <div>
                <span className="text-slate-500">فرع البيع: </span>
                <strong className="text-slate-900 font-bold">{selectedInvoice.selling_branch}</strong>
              </div>
              <div>
                <span className="text-slate-500">فرع مصدر الجهاز: </span>
                <strong className="text-slate-900 font-bold">{selectedInvoice.source_branch}</strong>
              </div>
              {selectedInvoice.customer_name && (
                <div>
                  <span className="text-slate-500">اسم العميل: </span>
                  <strong className="text-slate-900 font-bold">{selectedInvoice.customer_name}</strong>
                </div>
              )}
              {selectedInvoice.customer_phone && (
                <div>
                  <span className="text-slate-500">رقم الهاتف: </span>
                  <span className="font-mono font-medium text-slate-800 tabular-nums">{selectedInvoice.customer_phone}</span>
                </div>
              )}
            </div>

            {/* Device Info */}
            <div className="p-4 border border-slate-300 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 text-base">
                  {selectedInvoice.brand} {selectedInvoice.model_name}
                </span>
                <span className="font-mono font-bold text-xs bg-slate-100 text-slate-900 px-3 py-1 rounded-md border border-slate-300 tabular-nums">
                  {selectedInvoice.serial_number}
                </span>
              </div>
              <p className="text-slate-500 font-mono text-xs">
                {[selectedInvoice.processor, selectedInvoice.ram, selectedInvoice.storage, selectedInvoice.screen_size]
                  .filter(Boolean)
                  .join(' • ')}
              </p>
            </div>

            {/* Financials Table */}
            <div className="border border-slate-300 rounded-xl overflow-hidden">
              <div className="flex justify-between p-3 bg-slate-100/90 font-bold text-slate-800 border-b border-slate-300 text-xs">
                <span>البيان</span>
                <span>المبلغ</span>
              </div>
              <div className="p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-600 font-medium">سعر العرض الأصلي:</span>
                  <span className="font-mono font-medium tabular-nums">{formatCurrency(selectedInvoice.list_price_snapshot)}</span>
                </div>
                {selectedInvoice.discount_amount > 0 && (
                  <div className="flex justify-between text-rose-600 font-semibold">
                    <span>الخصم الممنوح:</span>
                    <span className="font-mono tabular-nums">-{formatCurrency(selectedInvoice.discount_amount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-sm pt-2.5 border-t border-slate-200 text-slate-900">
                  <span>إجمالي المدفوع:</span>
                  <span className="font-mono text-base tabular-nums">{formatCurrency(selectedInvoice.actual_sale_price)}</span>
                </div>
              </div>
            </div>

            {/* Warranty & Terms */}
            <div className="p-4 bg-slate-50 border border-slate-300 rounded-xl space-y-1.5">
              <span className="font-bold text-slate-900 block text-sm">شروط الضمان:</span>
              <p className="text-slate-700 text-xs leading-relaxed">{selectedInvoice.warranty_period}</p>
              {selectedInvoice.notes && (
                <p className="text-slate-500 text-xs pt-2 border-t border-slate-200">ملاحظات: {selectedInvoice.notes}</p>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
