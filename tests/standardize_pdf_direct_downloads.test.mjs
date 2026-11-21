import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Mock localStorage and window
const storage = new Map();
globalThis.localStorage = {
  getItem: (k) => storage.get(k) || null,
  setItem: (k, v) => storage.set(k, String(v)),
  removeItem: (k) => storage.delete(k),
  clear: () => storage.clear(),
};

globalThis.HTMLCanvasElement = class HTMLCanvasElement {};
globalThis.XMLSerializer = class XMLSerializer {
  serializeToString() {
    return '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1100"></svg>';
  }
};
globalThis.HTMLImageElement = class HTMLImageElement {};
globalThis.HTMLVideoElement = class HTMLVideoElement {};
globalThis.HTMLIFrameElement = class HTMLIFrameElement {};
globalThis.HTMLStyleElement = class HTMLStyleElement {};
globalThis.SVGElement = class SVGElement {};
globalThis.Element = class Element {};
globalThis.HTMLElement = class HTMLElement {};
globalThis.Node = class Node {};
globalThis.Image = class Image {
  constructor() {
    this._src = '';
    this.complete = true;
    this.width = 800;
    this.height = 1100;
    this.onload = null;
    this.onerror = null;
  }
  set src(val) {
    this._src = val;
    this.complete = true;
    if (typeof this.onload === 'function') {
      setTimeout(() => this.onload && this.onload(), 0);
    }
  }
  get src() {
    return this._src;
  }
};
let directDownloads = [];
globalThis.window = {
  localStorage: globalThis.localStorage,
  dispatchEvent: () => true,
  atob: (str) => Buffer.from(str, 'base64').toString('binary'),
  btoa: (str) => Buffer.from(str, 'binary').toString('base64'),
  getComputedStyle: (node) => {
    const d = node?.style?.display || (node?.classList?.contains?.('hidden') ? 'none' : 'block');
    const w = node?.style?.width || '794px';
    const h = node?.style?.height || '1123px';
    return {
      display: d,
      width: w,
      height: h,
      fontFamily: 'sans-serif',
      getPropertyValue: (prop) => {
        if (prop === 'display') return d;
        if (prop === 'width') return w;
        if (prop === 'height') return h;
        if (prop === 'font-family') return 'sans-serif';
        return '';
      },
    };
  },
};

globalThis.document = {
  defaultView: globalThis.window,
  styleSheets: [],
  createElementNS: (ns, tag) => ({
    setAttribute: () => {},
    appendChild: () => {},
    removeChild: () => {},
  }),
  getElementById: (id) => {
    if (id === 'non-existent') return null;
    const div = {
      id,
      style: { display: '' },
      classList: {
        _classes: new Set(['hidden']),
        contains(c) { return this._classes.has(c); },
        add(c) { this._classes.add(c); },
        remove(c) { this._classes.delete(c); },
      },
      offsetWidth: 794,
      offsetHeight: 1123,
      scrollHeight: 1123,
      children: [],
      childNodes: [],
      cloneNode() {
        const c = { ...this, children: [], childNodes: [] };
        c.cloneNode = this.cloneNode;
        return c;
      },
      ownerDocument: globalThis.document,
      parentElement: {
        style: { display: 'none' },
        classList: {
          _classes: new Set(['hidden']),
          contains(c) { return this._classes.has(c); },
          add(c) { this._classes.add(c); },
          remove(c) { this._classes.delete(c); },
        },
        parentElement: null,
        ownerDocument: globalThis.document,
        children: [],
        childNodes: [],
        cloneNode() {
        const c = { ...this, children: [], childNodes: [] };
        c.cloneNode = this.cloneNode;
        return c;
      },
      },
      getBoundingClientRect: () => ({ width: 794, height: 1123, top: 0, left: 0 }),
      querySelectorAll: () => [],
    };
    return div;
  },
  fonts: { ready: Promise.resolve() },
  createElement: (tag) => {
    if (tag === 'a') {
      const anchor = {
        href: '',
        download: '',
        style: {},
        click() {
          directDownloads.push({ href: this.href, download: this.download });
        },
      };
      return anchor;
    }
    return {
      width: 800,
      height: 600,
      getContext: () => ({
        fillStyle: '',
        fillRect: () => {},
        drawImage: () => {},
      }),
      toDataURL: () => 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    };
  },
  body: {
    appendChild: () => {},
    removeChild: () => {},
  },
};

globalThis.URL = {
  createObjectURL: (blob) => 'blob:mock-url',
  revokeObjectURL: () => {},
};
globalThis.getComputedStyle = globalThis.window.getComputedStyle;

// Import services under test
const { exportStorageService } = await import('../src/services/exportStorageService.ts');
const { documentPrintService } = await import('../src/lib/documentPrintService.ts');

describe('Standardize All PDF Exports — Direct Download Instead of Print Dialog', () => {
  beforeEach(() => {
    storage.clear();
    directDownloads = [];
    exportStorageService.setEnvironmentOverrideForTesting('browser');
  });

  test('1. exportElementToPdf generates a valid PDF binary buffer', async () => {
    const result = await exportStorageService.exportElementToPdf({
      elementId: 'unified-report-document-root',
      filename: 'تقرير_اختبار',
      exportType: 'accessories_reports',
      format: 'report',
      orientation: 'portrait',
    });

    assert.ok(result.success, 'Export must succeed');
    assert.ok(result.filename.endsWith('.pdf'), 'Filename must end with .pdf');

    // Verify browser direct download was triggered
    assert.equal(directDownloads.length, 1, 'Exactly one browser download must be triggered');
    assert.equal(directDownloads[0].download, 'تقرير_اختبار.pdf');
  });

  test('2. Hidden ancestors are safely unhidden offscreen and restored after PDF generation', async () => {
    const el = document.getElementById('unified-report-document-root');
    const parent = el.parentElement;

    // Initially parent has display: none and class 'hidden'
    assert.equal(parent.style.display, 'none');
    assert.ok(parent.classList.contains('hidden'));

    await exportStorageService.exportElementToPdf({
      elementId: 'unified-report-document-root',
      filename: 'تقرير_الحالات_المخفية',
      exportType: 'mss_reports',
    });

    // After export completes, parent must be restored to its original hidden state
    assert.equal(parent.style.display, 'none', 'Parent display must be restored to none');
    assert.ok(parent.classList.contains('hidden'), 'Parent must still have hidden class');
  });

  test('3. documentPrintService.exportToPdf does NOT call printElement or window.print', async () => {
    let printElementCalled = false;
    let windowPrintCalled = false;

    // Spy on printElement
    const originalPrintElement = documentPrintService.printElement;
    documentPrintService.printElement = async () => {
      printElementCalled = true;
    };
    window.print = () => {
      windowPrintCalled = true;
    };

    try {
      await documentPrintService.exportToPdf('unified-report-document-root', {
        title: 'تقرير_تجريبي',
        format: 'report',
        exportType: 'accessories_reports',
      });

      assert.equal(printElementCalled, false, 'printElement must NOT be called by exportToPdf');
      assert.equal(windowPrintCalled, false, 'window.print must NOT be called by exportToPdf');
      assert.equal(directDownloads.length, 1, 'Direct download must occur instead of printing');
    } finally {
      documentPrintService.printElement = originalPrintElement;
    }
  });

  test('4. Obsolete print dialog notifications are completely removed from all PDF export buttons', () => {
    const filesToCheck = [
      'src/components/dashboard/UnifiedDashboardView.tsx',
      'src/components/placeholders/accessories/ReportsView.tsx',
      'src/components/placeholders/accessories/InvoicesView.tsx',
      'src/components/placeholders/accessories/SalesView.tsx',
      'src/components/sales/PrintableInvoice.tsx',
      'src/components/placeholders/mss/MSSPrintableInvoice.tsx',
      'src/components/placeholders/mss/MSSReportsView.tsx',
      'src/components/placeholders/mss/MSSDeviceReportsView.tsx',
      'src/components/expenses/PrintExpenseReportModal.tsx',
    ];

    for (const relPath of filesToCheck) {
      const fullPath = path.resolve(relPath);
      assert.ok(fs.existsSync(fullPath), `File must exist: ${relPath}`);
      const content = fs.readFileSync(fullPath, 'utf8');

      // Obsolete text patterns that must NOT appear
      assert.ok(
        !content.includes('تم فتح نافذة الطباعة'),
        `${relPath} must NOT contain obsolete message "تم فتح نافذة الطباعة"`
      );
      assert.ok(
        !content.includes('(Save as PDF)'),
        `${relPath} must NOT contain "(Save as PDF)" instruction in PDF export handlers`
      );
    }
  });

  test('5. Multi-page document slicing in jsPDF produces valid multi-page PDF', async () => {
    // Mock tall element (2500px height > 2 pages)
    const tallEl = {
      id: 'tall-document',
      style: { display: 'block' },
      classList: {
        contains: () => false,
        add: () => {},
        remove: () => {},
      },
      offsetWidth: 794,
      offsetHeight: 2500,
      scrollHeight: 2500,
      getBoundingClientRect: () => ({ width: 794, height: 2500, top: 0, left: 0 }),
      querySelectorAll: () => [],
      children: [],
      childNodes: [],
      cloneNode() {
        const c = { ...this, children: [], childNodes: [] };
        c.cloneNode = this.cloneNode;
        return c;
      },
      parentElement: null,
      ownerDocument: globalThis.document,
    };

    const prevGetElementById = document.getElementById;
    document.getElementById = (id) => (id === 'tall-document' ? tallEl : prevGetElementById(id));

    try {
      const res = await exportStorageService.exportElementToPdf({
        elementId: 'tall-document',
        filename: 'تقرير_متعدد_الصفحات',
        exportType: 'accessories_reports',
        format: 'report',
      });

      assert.ok(res.success, 'Multi-page export must succeed');
      assert.equal(directDownloads.length, 1);
      assert.equal(directDownloads[0].download, 'تقرير_متعدد_الصفحات.pdf');
    } finally {
      document.getElementById = prevGetElementById;
    }
  });

  test('6. Thermal receipt export produces continuous single roll without multi-page slicing', async () => {
    const thermalEl = {
      id: 'thermal-receipt',
      style: { display: 'block' },
      classList: {
        contains: () => false,
        add: () => {},
        remove: () => {},
      },
      offsetWidth: 300,
      offsetHeight: 1500,
      scrollHeight: 1500,
      getBoundingClientRect: () => ({ width: 300, height: 1500, top: 0, left: 0 }),
      querySelectorAll: () => [],
      children: [],
      childNodes: [],
      cloneNode() {
        const c = { ...this, children: [], childNodes: [] };
        c.cloneNode = this.cloneNode;
        return c;
      },
      parentElement: null,
      ownerDocument: globalThis.document,
    };

    const prevGetElementById = document.getElementById;
    document.getElementById = (id) => (id === 'thermal-receipt' ? thermalEl : prevGetElementById(id));

    try {
      const res = await exportStorageService.exportElementToPdf({
        elementId: 'thermal-receipt',
        filename: 'إيصال_حراري',
        exportType: 'accessories_invoices',
        format: 'thermal',
      });

      assert.ok(res.success, 'Thermal receipt export must succeed');
      assert.equal(directDownloads.length, 1);
      assert.equal(directDownloads[0].download, 'إيصال_حراري.pdf');
    } finally {
      document.getElementById = prevGetElementById;
    }
  });
});
