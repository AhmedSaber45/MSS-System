import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();

test('Print & PDF Output Verification Suite', async (t) => {
  await t.test('1. PrintableInvoice provides 4 output options and print-safe design', () => {
    const invoiceFilePath = path.join(projectRoot, 'src/components/sales/PrintableInvoice.tsx');
    assert.ok(fs.existsSync(invoiceFilePath), 'PrintableInvoice.tsx must exist');
    const content = fs.readFileSync(invoiceFilePath, 'utf-8');

    // 4 Output / Action Options
    assert.ok(content.includes('فاتورة قياسية A4'), 'Must have A4 Invoice option');
    assert.ok(content.includes('إيصال حراري (POS 80mm)'), 'Must have Thermal Receipt option');
    assert.ok(content.includes('حفظ كـ PDF'), 'Must have Save as PDF option');
    assert.ok(content.includes('طباعة الفاتورة الآن'), 'Must have Print Now option');

    // Print-safe savings section (no dark green muddy background)
    assert.ok(!content.includes('bg-emerald-100'), 'Must not use muddy bg-emerald-100 in customer savings section');
    assert.ok(content.includes('إجمالي وفر العميل:'), 'Must display customer savings amount');

    // Thermal receipt layout specifications (80mm width, not 100% A4 stretch)
    assert.ok(content.includes('printable-invoice-thermal'), 'Must have thermal receipt container id');
    assert.ok(content.includes('w-[80mm]'), 'Thermal receipt must specify 80mm width');
    assert.ok(content.includes('max-w-[80mm]'), 'Thermal receipt must enforce max-width of 80mm');

    // A4 layout specifications and multi-page repeat headers
    assert.ok(content.includes('printable-invoice-a4'), 'Must have A4 invoice container id');
    assert.ok(content.includes('table-header-group'), 'A4 invoice table thead must use table-header-group for pagination');
    assert.ok(content.includes('breakInside') || content.includes('pageBreakInside'), 'Must specify avoid-break for invoice rows/totals');
  });

  await t.test('2. InvoicesView & SalesView integrate documentPrintService for both Print & PDF', () => {
    const invoicesViewPath = path.join(projectRoot, 'src/components/placeholders/accessories/InvoicesView.tsx');
    const salesViewPath = path.join(projectRoot, 'src/components/placeholders/accessories/SalesView.tsx');

    const invoicesContent = fs.readFileSync(invoicesViewPath, 'utf-8');
    const salesContent = fs.readFileSync(salesViewPath, 'utf-8');

    // InvoicesView modal footer integration
    assert.ok(invoicesContent.includes('documentPrintService'), 'InvoicesView must import and use documentPrintService');
    assert.ok(!invoicesContent.includes('onClick={() => window.print()}'), 'InvoicesView must not invoke bare window.print() in modal footer');
    assert.ok(invoicesContent.includes('exportToPdf'), 'InvoicesView modal footer must support exportToPdf');

    // SalesView post-sale modal footer integration
    assert.ok(salesContent.includes('documentPrintService'), 'SalesView must import and use documentPrintService');
    assert.ok(!salesContent.includes('onClick={() => window.print()}'), 'SalesView must not invoke bare window.print() in modal footer');
    assert.ok(salesContent.includes('exportToPdf'), 'SalesView modal footer must support exportToPdf');
  });

  await t.test('3. Profit Reports & Unified Executive Dashboard have dedicated PDF Export & Print', () => {
    const reportsViewPath = path.join(projectRoot, 'src/components/placeholders/accessories/ReportsView.tsx');
    const unifiedDashboardPath = path.join(projectRoot, 'src/components/dashboard/UnifiedDashboardView.tsx');

    const reportsContent = fs.readFileSync(reportsViewPath, 'utf-8');
    const unifiedContent = fs.readFileSync(unifiedDashboardPath, 'utf-8');

    // ReportsView
    assert.ok(reportsContent.includes('استخراج PDF'), 'ReportsView must have dedicated "استخراج PDF" button');
    assert.ok(reportsContent.includes('طباعة كشف الأرباح'), 'ReportsView must have "طباعة كشف الأرباح" button');
    assert.ok(reportsContent.includes('PrintableProfitReport'), 'ReportsView must embed PrintableProfitReport');
    assert.ok(reportsContent.includes('profit-report-document-root'), 'ReportsView must have document root for profit report');

    // UnifiedDashboardView
    assert.ok(unifiedContent.includes('استخراج PDF'), 'UnifiedDashboardView must have dedicated "استخراج PDF" button');
    assert.ok(unifiedContent.includes('PrintableUnifiedReport'), 'UnifiedDashboardView must embed PrintableUnifiedReport');
    assert.ok(unifiedContent.includes('unified-report-document-root'), 'UnifiedDashboardView must have document root for unified report');
    assert.ok(unifiedContent.includes('documentPrintService'), 'UnifiedDashboardView must use documentPrintService');
  });

  await t.test('4. Dedicated Printable Report layouts are formal financial statements', () => {
    const profitReportPath = path.join(projectRoot, 'src/components/reports/PrintableProfitReport.tsx');
    const unifiedReportPath = path.join(projectRoot, 'src/components/reports/PrintableUnifiedReport.tsx');

    assert.ok(fs.existsSync(profitReportPath), 'PrintableProfitReport.tsx must exist');
    assert.ok(fs.existsSync(unifiedReportPath), 'PrintableUnifiedReport.tsx must exist');

    const profitContent = fs.readFileSync(profitReportPath, 'utf-8');
    const unifiedContent = fs.readFileSync(unifiedReportPath, 'utf-8');

    // Profit report formal components
    assert.ok(profitContent.includes('كشف الأرباح'), 'Profit report must have formal title');
    assert.ok(profitContent.includes('table-header-group'), 'Profit report tables must repeat headers across pages');
    assert.ok(profitContent.includes('توقيع المحاسب المسئول') || profitContent.includes('اعتماد الإدارة المالية'), 'Profit report must include signature / approval block');

    // Unified report formal components
    assert.ok(unifiedContent.includes('تقرير الأداء المالي المجمع'), 'Unified report must have formal header');
    assert.ok(unifiedContent.includes('branchOperationalSales'), 'Unified report must support operational branch breakdown');
    assert.ok(unifiedContent.includes('locationStockValuation'), 'Unified report must support location stock valuation');
  });

  await t.test('5. documentPrintService isolates output via clean iframe', () => {
    const servicePath = path.join(projectRoot, 'src/lib/documentPrintService.ts');
    assert.ok(fs.existsSync(servicePath), 'documentPrintService.ts must exist');

    const serviceContent = fs.readFileSync(servicePath, 'utf-8');
    assert.ok(serviceContent.includes('createElement(\'iframe\')'), 'Must use hidden iframe for isolation');
    assert.ok(serviceContent.includes('@page { size: 80mm auto; margin: 0; }'), 'Must set exact 80mm auto rule for thermal receipts');
    assert.ok(serviceContent.includes('A4 portrait'), 'Must set A4 portrait rule for standard documents');
    assert.ok(serviceContent.includes('document.title ='), 'Must set document.title for auto PDF filename');
  });

  await t.test('6. Global index.css print rules hide application chrome and reset flex containers', () => {
    const cssPath = path.join(projectRoot, 'src/index.css');
    const cssContent = fs.readFileSync(cssPath, 'utf-8');

    assert.ok(cssContent.includes('@media print'), 'Must include @media print section');
    assert.ok(cssContent.includes('.no-print'), 'Must hide .no-print elements');
    assert.ok(cssContent.includes('aside'), 'Must hide sidebar (aside)');
    assert.ok(cssContent.includes('table-header-group'), 'Must set table-header-group on thead');
  });
});
