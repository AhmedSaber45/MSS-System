/**
 * Compu MSS — Unified Document Printing & PDF Export Service
 * 
 * Provides isolated, clean document printing and PDF export for:
 * 1. A4 Formal Invoices (with multi-page flow and table header repetition)
 * 2. Thermal Receipts (80mm POS width with dynamic auto height)
 * 3. Formal Profit & Financial Reports (multi-page financial statements with zero app-shell pollution)
 */

import { exportStorageService, type ExportType, EXPORT_SUBFOLDERS } from '../services/exportStorageService.ts';

export interface PrintDocumentOptions {
  title: string;
  format: 'a4' | 'thermal' | 'report' | 'promotional';
  orientation?: 'portrait' | 'landscape';
  exportType?: ExportType;
  onBeforePrint?: () => void;
  onAfterPrint?: () => void;
}

export const documentPrintService = {
  /**
   * Print an isolated HTML fragment using a clean hidden iframe.
   * Eliminates all app shell, sidebar, modal backdrops, and flex centering artifacts.
   */
  async printHtml(htmlContent: string, options: PrintDocumentOptions): Promise<void> {
    if (options.onBeforePrint) {
      options.onBeforePrint();
    }

    // Set document title temporarily so browser print-to-pdf suggests the exact filename
    const originalTitle = document.title;
    if (options.title) {
      document.title = options.title;
    }

    return new Promise((resolve) => {
      // 1. Create isolated hidden iframe with offscreen render viewport
      const iframe = document.createElement('iframe');
      iframe.setAttribute('style', 'position:fixed;left:0;top:0;width:210mm;height:1000px;border:none;opacity:0;pointer-events:none;z-index:-9999;');
      document.body.appendChild(iframe);

      const iframeDoc = iframe.contentWindow?.document;
      if (!iframeDoc) {
        document.body.removeChild(iframe);
        document.title = originalTitle;
        resolve();
        return;
      }

      // 2. Collect existing application stylesheet links & inline styles for exact styling
      const styleSheets = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
        .map(el => el.outerHTML)
        .join('\n');

      // 3. Define page setup rules based on document format
      let pageRule = '@page { size: A4 portrait; margin: 10mm 12mm; }';
      let bodyStyles = 'background: #ffffff; color: #0f172a; margin: 0; padding: 0; font-family: "Cairo", "Segoe UI", Tahoma, Arial, sans-serif;';
      let containerStyles = 'width: 100%; max-width: 210mm; margin: 0 auto;';

      if (options.format === 'thermal') {
        pageRule = '@page { size: 80mm auto; margin: 0; }';
        bodyStyles = 'background: #ffffff; color: #000000; margin: 0; padding: 0; font-family: "JetBrains Mono", Consolas, Monaco, monospace; font-size: 11px;';
        containerStyles = 'width: 80mm; max-width: 80mm; margin: 0 auto; padding: 0;';
      } else if (options.format === 'promotional') {
        // High-fidelity A4 promotional poster format:
        // Scaled to fit A4 page width with comfortable margins, avoiding any horizontal or vertical clipping
        const orient = options.orientation || 'portrait';
        pageRule = `@page { size: A4 ${orient}; margin: 6mm 8mm; }`;
        bodyStyles = 'background: #ffffff; color: #0f172a; margin: 0; padding: 0; font-family: "Cairo", "Segoe UI", Tahoma, Arial, sans-serif;';
        containerStyles = 'width: 100%; margin: 0 auto; direction: rtl;';
      } else if (options.format === 'report') {
        const orient = options.orientation || 'portrait';
        pageRule = `@page { size: A4 ${orient}; margin: 12mm 15mm; }`;
        bodyStyles = 'background: #ffffff; color: #0f172a; margin: 0; padding: 0; font-family: "Cairo", "Segoe UI", Tahoma, Arial, sans-serif;';
        containerStyles = 'width: 100%; margin: 0 auto;';
      }

      // 4. Assemble pristine document
      const completeHtml = `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>${options.title}</title>
  ${styleSheets}
  <style>
    ${pageRule}
    *, *::before, *::after {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    html, body {
      ${bodyStyles}
      height: auto !important;
      min-height: 100% !important;
      overflow: visible !important;
    }
    .print-document-wrapper {
      ${containerStyles}
      direction: rtl;
    }
    table {
      border-collapse: collapse;
      width: 100%;
    }
    thead {
      display: table-header-group !important;
    }
    tfoot {
      display: table-footer-group !important;
    }
    tr, .avoid-break, .print-card {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    .page-break {
      page-break-before: always !important;
      break-before: always !important;
    }
    .tabular-nums {
      font-variant-numeric: tabular-nums;
    }
    /* Hide all browser headers/footers hints where possible */
    @media print {
      body {
        margin: 0 !important;
        padding: 0 !important;
      }
      /* Promotional Poster Clean Layout & Pagination for Print */
      .promotional-poster-container, [id^="mss-promotional-page-container"], [id^="mss-promotional-poster"] {
        width: 100% !important;
        max-width: 100% !important;
        box-sizing: border-box !important;
        margin: 0 auto !important;
        box-shadow: none !important;
        border: 1px solid #cbd5e1 !important;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }
      .promotional-page-wrapper {
        page-break-after: always !important;
        break-after: page !important;
        margin: 0 auto !important;
        padding: 0 !important;
        width: 100% !important;
        display: flex !important;
        justify-content: center !important;
      }
      .promotional-page-wrapper:last-child {
        page-break-after: auto !important;
        break-after: auto !important;
      }
    }
  </style>
</head>
<body>
  <div class="print-document-wrapper">
    ${htmlContent}
  </div>
</body>
</html>
      `;

      iframeDoc.open();
      iframeDoc.write(completeHtml);
      iframeDoc.close();

      // 5. Trigger print after fonts and assets are ready
      const triggerPrint = () => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch (e) {
          console.error('Error invoking print inside iframe:', e);
          // Fallback to window.print if iframe print fails
          window.print();
        } finally {
          setTimeout(() => {
            try {
              if (document.body.contains(iframe)) {
                document.body.removeChild(iframe);
              }
            } catch { }
            document.title = originalTitle;
            if (options.onAfterPrint) {
              options.onAfterPrint();
            }
            resolve();
          }, 1000);
        }
      };

      if (iframeDoc.readyState === 'complete') {
        if ((iframeDoc as any).fonts && (iframeDoc as any).fonts.ready) {
          (iframeDoc as any).fonts.ready.then(triggerPrint).catch(triggerPrint);
        } else {
          setTimeout(triggerPrint, 250);
        }
      } else {
        iframe.onload = () => {
          setTimeout(triggerPrint, 250);
        };
      }
    });
  },

  /**
   * Print an element directly by its ID using the isolated print engine
   */
  async printElement(elementId: string, options: PrintDocumentOptions): Promise<void> {
    const el = document.getElementById(elementId);
    if (!el) {
      console.warn(`Print element #${elementId} not found, falling back to window.print()`);
      window.print();
      return;
    }

    const clone = el.cloneNode(true) as HTMLElement;
    clone.classList.remove('hidden');
    clone.style.display = 'block';
    clone.style.visibility = 'visible';
    clone.style.position = 'static';
    clone.style.left = 'auto';
    clone.style.top = 'auto';
    clone.style.opacity = '1';
    clone.style.zIndex = 'auto';
    clone.style.pointerEvents = 'auto';
    const content = clone.outerHTML;
    await this.printHtml(content, options);
  },

  /**
   * Dedicated Save as PDF / Export PDF handler:
   * Captures the document and saves/downloads it directly to the assigned subfolder or default Downloads directory.
   * Does NOT open the browser print dialog or system print window.
   */
  async exportToPdf(elementId: string, options: PrintDocumentOptions): Promise<void> {
    const finalTitle = options.title.endsWith('.pdf') ? options.title : `${options.title}.pdf`;

    // Deduce exportType if omitted
    let exportType = options.exportType;
    if (!exportType) {
      if (elementId.includes('mss') || options.title.includes('MSS') || options.title.includes('أجهزة')) {
        exportType = elementId.includes('invoice') ? 'mss_invoices' : 'mss_reports';
      } else {
        exportType = elementId.includes('invoice') ? 'accessories_invoices' : 'accessories_reports';
      }
    }

    const result = await exportStorageService.exportElementToPdf({
      elementId,
      filename: finalTitle,
      exportType,
      orientation: options.orientation,
      format: options.format as any,
    });

    if (!result.success) {
      throw new Error(result.error || 'تعذر استخراج وتحميل ملف PDF.');
    }
  },
};
