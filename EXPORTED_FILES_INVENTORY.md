# Exported Files Inventory — Comprehensive System Audit

This document provides a complete and verified inventory of every file generated, exported, or downloaded by the application across both modules (**Compu MSS** and **Accessories**), as well as cross-module executive dashboards.

Every entry has been audited directly against the production codebase implementations (`mssWholesaleExportService.ts`, `mssPromotionalService.ts`, `documentPrintService.ts`, `backupService.ts`, and corresponding view components).

---

## 1. Quick Master Inventory Table

| # | Module | File Type | Generated File Name | Export Source / Section |
|---|---|---|---|---|
| 1 | Compu MSS | XLSX | `${baseTitle}${categorySuffix}${brandSuffix}${branchSuffix}_${dateStr}.xlsx`<br>*(e.g., `الاجهزة_المتاحة_2026-11-21.xlsx`)* | تقارير الأجهزة — تصدير مخزون الجملة (Wholesale Export) |
| 2 | Compu MSS | PNG | `${prefix}_${dateStr}.png`<br>*(e.g., `أجهزة_لابتوب_متاحة_2026-11-21.png` / `عروض_لابتوبات_Dell_2026-11-21.png` / `عرض_Apple_MacBook_Air_M2_2026-11-21.png`)* | تقارير الأجهزة — صانع الصور الترويجية (Single-Page Promotional Image) |
| 3 | Compu MSS | PNG | `${baseName} - ${pageIndex + 1} من ${totalPages}.png`<br>*(e.g., `أجهزة_Compu_MSS_2026-11-21 - 01 من 03.png`)* | تقارير الأجهزة — صانع الصور الترويجية (Multi-Page Paginated PNG Export) |
| 4 | Compu MSS | PDF | `${customTitle || prefix}_${dateStr}.pdf`<br>*(e.g., `تقرير_دعائي_للأجهزة_2026-11-21.pdf` / `عروض_لابتوبات_Dell_2026-11-21.pdf`)* | تقارير الأجهزة — صانع الصور الترويجية (Multi-Page Promotional PDF Catalog) |
| 5 | Compu MSS | PDF | `فاتورة_${invoice.invoice_number}_${dateStr}.pdf`<br>*(e.g., `فاتورة_MSS-INV-202611-0001_2026-11-21.pdf`)* | مبيعات وفواتير Compu MSS (MSS Sales Invoices & POS) |
| 6 | Compu MSS | PDF | `تقرير_مبيعات_الأجهزة_${warehouse}_${dateLabel}_${dateStr}.pdf`<br>*(e.g., `تقرير_مبيعات_الأجهزة_محل_1_هذا_الشهر_2026-11-21.pdf`)* | تقارير الأجهزة — تقرير الأجهزة المباعة (Sold Devices Report) |
| 7 | Compu MSS | PDF | `تقرير_أرباح_Compu_MSS_${dateLabel}_${dateStr}.pdf`<br>*(e.g., `تقرير_أرباح_Compu_MSS_هذا_الشهر_2026-11-21.pdf`)* | تقارير المبيعات والأرباح (MSS Financial & Profit Reports) |
| 8 | Compu MSS | PDF | `تقرير_مبيعات_الأجهزة_حسب_الموديل_${warehouse}_${dateLabel}_${dateStr}.pdf`<br>*(e.g., `تقرير_مبيعات_الأجهزة_حسب_الموديل_محل_1_فترة_2026-11-21.pdf`)* | تقارير المبيعات والأرباح — تفصيل المبيعات حسب الموديل (Model Sales Report) |
| 9 | Accessories | PDF | `فاتورة_${invoice.invoice_number}.pdf` أو `فاتورة_مبيعات_${invoice.invoice_number}.pdf`<br>*(e.g., `فاتورة_INV-202611-0005.pdf`)* | مبيعات وفواتير الإكسسوارات (Accessories Sales Invoices & POS) |
| 10 | Accessories | PDF | `تقرير_الأرباح_${dateStr}.pdf`<br>*(e.g., `تقرير_الأرباح_2026-11-21.pdf`)* | التقارير المالية والأرباح (Accessories Financial Reports) |
| 11 | Accessories | DB / JSON | `MSS_Backup_${YYYY-MM-DD_HH-mm-ss}.db` أو `Export-${filename}`<br>*(Fallback: `accessories_backup_${timestamp}_${type}.db` / `backup_${timestamp}.json`)* | إدارة النسخ الاحتياطي (Backup Management & Export) |
| 12 | Unified Dashboard | PDF | `تقرير_تنفيذي_موحد_${dateStr}.pdf`<br>*(e.g., `تقرير_تنفيذي_موحد_2026-11-21.pdf`)* | النظرة العامة الموحدة (Unified Cross-Module Executive Overview) |
| 13 | Accessories | PDF | `تقرير_مصروفات_المحل_${periodLabel}_${dateStr}.pdf`<br>*(e.g., `تقرير_مصروفات_المحل_هذا_الشهر_2026-11-21.pdf`)* | مصروفات المحل (Accessories Operating Expenses Report) |
| 14 | Compu MSS | PDF | `تقرير_مصروفات_MSS_${periodLabel}_${dateStr}.pdf`<br>*(e.g., `تقرير_مصروفات_MSS_هذا_الشهر_2026-11-21.pdf`)* | مصروفات MSS (Compu MSS Operating Expenses Report) |

---

## 2. Detailed Technical Breakdown by Module

### A. Compu MSS Module (8 Export Implementations)

1. **Wholesale Device Inventory Excel Spreadsheet (`.xlsx`)**
   - **Service / Handler:** `src/services/mssWholesaleExportService.ts` (`exportWholesaleDevices`)
   - **Trigger UI:** `src/components/placeholders/mss/MSSDeviceReportsView.tsx` (Tab 1: Wholesale Export)
   - **Filename Pattern:** `${baseTitle}${categorySuffix}${brandSuffix}${branchSuffix}_${dateStr}.xlsx`
   - **Sanitization & Formatting:** `formatArabicExportFilename()` ensures a single sanitized `_YYYY-MM-DD.xlsx` date suffix.
   - **Examples:**
     - `الاجهزة_المتاحة_2026-11-21.xlsx` (All categories, brands, branches)
     - `الاجهزة_المتاحة_Laptops_Dell_محل_1_2026-11-21.xlsx` (Filtered)

2. **Single-Page Promotional Poster Image (`.png`)**
   - **Service / Handler:** `src/services/mssPromotionalService.ts` (`exportPromotionalAsPng`)
   - **Trigger UI:** `src/components/placeholders/mss/MSSPromotionalGenerator.tsx` (Single Image Download Button)
   - **Filename Pattern:** Formatted via `generatePromotionalArabicFilename(items, 'png')`:
     - General / Mixed brands: `أجهزة_Compu_MSS_YYYY-MM-DD.png` or `أجهزة_لابتوب_متاحة_YYYY-MM-DD.png`
     - Single Brand: `عروض_لابتوبات_${brandName}_YYYY-MM-DD.png` (e.g., `عروض_لابتوبات_Dell_2026-11-21.png`)
     - Single Model: `عرض_${brandName}_${modelName}_YYYY-MM-DD.png` (e.g., `عرض_Apple_MacBook_Air_M2_2026-11-21.png`)
     - Custom Title: `${customTitle}_YYYY-MM-DD.png`

3. **Multi-Page Promotional Poster Batch (`.png`)**
   - **Service / Handler:** `src/services/mssPromotionalService.ts` (`exportPromotionalAllPagesAsPng`)
   - **Trigger UI:** `src/components/placeholders/mss/MSSPromotionalGenerator.tsx` (Export All Pages Button)
   - **Filename Pattern:** `${baseName} - ${pageIndex + 1} من ${totalPages}.png`
   - **Example:** `أجهزة_Compu_MSS_2026-11-21 - 01 من 03.png`

4. **Multi-Page Promotional Catalog Document (`.pdf`)**
   - **Service / Handler:** `src/services/mssPromotionalService.ts` (`exportPromotionalAsPdf` using `jsPDF`)
   - **Trigger UI:** `src/components/placeholders/mss/MSSPromotionalGenerator.tsx` (Export PDF Button)
   - **Filename Pattern:** `${customTitle || prefix}_${dateStr}.pdf` via `generatePromotionalArabicFilename(items, 'pdf')`
   - **Examples:**
     - `تقرير_دعائي_للأجهزة_2026-11-21.pdf`
     - `عروض_لابتوبات_HP_2026-11-21.pdf`

5. **Sales Invoice Document (`.pdf`)**
   - **Service / Handler:** `src/lib/documentPrintService.ts` (`exportToPdf`)
   - **Trigger UI:** `src/components/placeholders/mss/MSSPrintableInvoice.tsx`, `MSSInvoicesView.tsx`, `MSSSalesView.tsx`
   - **Filename Pattern:** `formatArabicExportFilename("فاتورة_${invoice.invoice_number}", 'pdf')`
   - **Example:** `فاتورة_MSS-INV-202611-0001_2026-11-21.pdf`
   - **Formats:** A4 & 80mm Thermal Receipt

6. **Sold Devices Performance Report (`.pdf`)**
   - **Service / Handler:** `src/lib/documentPrintService.ts` (`printElement` / `handleExportSoldReportPdf`)
   - **Trigger UI:** `src/components/placeholders/mss/MSSDeviceReportsView.tsx` (Tab 3: Sold Devices)
   - **Filename Pattern:** `formatArabicExportFilename("تقرير_مبيعات_الأجهزة_${soldWarehouse}_${soldDateLabel || 'فترة'}")`
   - **Example:** `تقرير_مبيعات_الأجهزة_محل_1_هذا_الشهر_2026-11-21.pdf`

7. **Financial Sales & Profit Summary Report (`.pdf`)**
   - **Service / Handler:** `src/lib/documentPrintService.ts` (`exportToPdf`)
   - **Trigger UI:** `src/components/placeholders/mss/MSSReportsView.tsx` (Export PDF Button)
   - **Filename Pattern:** `formatArabicExportFilename("تقرير_أرباح_Compu_MSS_${dateLabel || 'فترة'}", 'pdf')`
   - **Example:** `تقرير_أرباح_Compu_MSS_هذا_الشهر_2026-11-21.pdf`

8. **Device Sales by Model Breakdown Report (`.pdf`)**
   - **Service / Handler:** `src/lib/documentPrintService.ts` (`printElement` / `handleExportSoldLaptopsPdf`)
   - **Trigger UI:** `src/components/placeholders/mss/MSSReportsView.tsx` (Sold by Model Section)
   - **Filename Pattern:** `formatArabicExportFilename("تقرير_مبيعات_الأجهزة_حسب_الموديل_${selectedWarehouse}_${dateLabel || 'فترة'}")`
   - **Example:** `تقرير_مبيعات_الأجهزة_حسب_الموديل_محل_1_فترة_2026-11-21.pdf`

---

### B. Accessories Module (3 Export Implementations)

9. **Sales Invoice Document (`.pdf`)**
   - **Service / Handler:** `src/lib/documentPrintService.ts` (`exportToPdf`)
   - **Trigger UI:** `src/components/placeholders/accessories/InvoicesView.tsx`, `SalesView.tsx`, `src/components/sales/PrintableInvoice.tsx`
   - **Filename Pattern:**
     - From Invoices List: `فاتورة_${selectedInvoice.invoice_number}.pdf`
     - From Sales Completion: `فاتورة_${completedInvoice.invoice_number}.pdf`
     - From Printable Component: `فاتورة_مبيعات_${invoice.invoice_number}.pdf`
   - **Example:** `فاتورة_INV-202611-0005.pdf`
   - **Formats:** A4 & 80mm Thermal Receipt

10. **Financial Profit Report (`.pdf`)**
    - **Service / Handler:** `src/lib/documentPrintService.ts` (`exportToPdf`)
    - **Trigger UI:** `src/components/placeholders/accessories/ReportsView.tsx` (Export PDF Button)
    - **Filename Pattern:** `تقرير_الأرباح_${getTodayLocalDateString()}.pdf`
    - **Example:** `تقرير_الأرباح_2026-11-21.pdf`

11. **System Database Backup Export (`.db` / `.json`)**
    - **Service / Handler:** `src/services/backupService.ts` (`exportBackup`) & Tauri Rust Backend (`src-tauri/src/db.rs`)
    - **Trigger UI:** `src/components/placeholders/accessories/BackupView.tsx` (Export Backup Button)
    - **Filename Pattern:**
      - Native Tauri SQLite Backup: `MSS_Backup_${YYYY-MM-DD_HH-mm-ss}.db`
      - User File Export: `Export-${item.filename}`
      - Browser Web Fallback: `accessories_backup_${timestampStr}_${type}.db` or `backup_${timestamp}.json`
    - **Example:** `Export-MSS_Backup_2026-11-21_17-30-00.db`

---

### C. Cross-Module / Unified Overview (1 Export Implementation)

12. **Unified Executive Overview Report (`.pdf`)**
    - **Service / Handler:** `src/lib/documentPrintService.ts` (`exportToPdf`)
    - **Trigger UI:** `src/components/dashboard/UnifiedDashboardView.tsx` (Export PDF Button)
    - **Filename Pattern:** `تقرير_تنفيذي_موحد_${new Date().toISOString().slice(0, 10)}.pdf`
    - **Example:** `تقرير_تنفيذي_موحد_2026-11-21.pdf`

---

## 3. Discovered File Types Summary

| File Extension | Format Name | Total Discovered Export Implementations | Primary Engine / Library |
|---|---|:---:|---|
| `.pdf` | Portable Document Format | **8** | `jsPDF` (promotional) & `documentPrintService` (iframe print engine) |
| `.png` | Portable Network Graphics | **2** | HTML5 Canvas 2D Context & `html-to-image` |
| `.xlsx` | Microsoft Excel Spreadsheet | **1** | `xlsx-js-style` |
| `.db` / `.json` | Database Backup / Data File | **1** | Tauri SQLite Backend & Browser Blob / LocalStorage |
| **Total** | | **12** | |
