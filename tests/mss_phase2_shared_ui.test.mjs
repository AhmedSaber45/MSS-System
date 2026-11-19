import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('PHASE 2 - Pagination Logic: Page size, counts and slicing', () => {
  const pageSize = 9;

  // 1. Total pages calculation
  const calcTotalPages = (total, size = pageSize) => Math.max(1, Math.ceil(total / size));
  assert.equal(calcTotalPages(0), 1, 'Empty list has 1 page');
  assert.equal(calcTotalPages(9), 1, '9 items fit in 1 page');
  assert.equal(calcTotalPages(10), 2, '10 items split into 2 pages');
  assert.equal(calcTotalPages(45), 5, '45 items split into 5 pages');
  assert.equal(calcTotalPages(46), 6, '46 items split into 6 pages');

  // 2. Data slicing
  const mockItems = Array.from({ length: 25 }, (_, i) => ({ id: `item-${i + 1}`, name: `Item ${i + 1}` }));
  const slicePage = (items, page, size = pageSize) => {
    const totalPages = calcTotalPages(items.length, size);
    const safePage = Math.max(1, Math.min(page, totalPages));
    return items.slice((safePage - 1) * size, safePage * size);
  };

  const page1 = slicePage(mockItems, 1);
  assert.equal(page1.length, 9, 'Page 1 has 9 items');
  assert.equal(page1[0].id, 'item-1');
  assert.equal(page1[8].id, 'item-9');

  const page2 = slicePage(mockItems, 2);
  assert.equal(page2.length, 9, 'Page 2 has 9 items');
  assert.equal(page2[0].id, 'item-10');
  assert.equal(page2[8].id, 'item-18');

  const page3 = slicePage(mockItems, 3);
  assert.equal(page3.length, 7, 'Page 3 has remaining 7 items');
  assert.equal(page3[0].id, 'item-19');
  assert.equal(page3[6].id, 'item-25');

  // 3. Clamping when filter narrows results
  const clamped = slicePage(mockItems.slice(0, 5), 3); // was on page 3, now only 5 items exist
  assert.equal(clamped.length, 5, 'Auto-clamped to page 1');
  assert.equal(clamped[0].id, 'item-1');
});

test('PHASE 2 - Pagination windowing and page buttons generator', () => {
  const getPageNumbers = (currentPage, totalPages) => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    if (currentPage <= 4) {
      return [1, 2, 3, 4, 5, '...', totalPages];
    }
    if (currentPage >= totalPages - 3) {
      return [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }
    return [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages];
  };

  assert.deepEqual(getPageNumbers(1, 5), [1, 2, 3, 4, 5]);
  assert.deepEqual(getPageNumbers(1, 10), [1, 2, 3, 4, 5, '...', 10]);
  assert.deepEqual(getPageNumbers(6, 10), [1, '...', 5, 6, 7, '...', 10]);
  assert.deepEqual(getPageNumbers(10, 10), [1, '...', 6, 7, 8, 9, 10]);
});

test('PHASE 2 - Table nowrap rules eliminate horizontal scrolling', () => {
  const tableFile = fs.readFileSync(path.resolve('src/components/common/Table.tsx'), 'utf-8');

  // Table.tsx must not hardcode whitespace-nowrap unconditionally on all td elements
  assert.ok(!tableFile.includes('td className="whitespace-nowrap'), 'Table.tsx should not hardcode whitespace-nowrap on every td');

  // Table.tsx must have nowrap logic supporting wrapping on long text columns
  assert.ok(tableFile.includes('whitespace-normal break-words'), 'Table.tsx should apply whitespace-normal break-words to text columns');
  assert.ok(tableFile.includes(': 9'), 'Table.tsx should default to pageSize 9');
});

test('PHASE 2 - Input numeric placeholder and zero replacement behavior', () => {
  const inputFile = fs.readFileSync(path.resolve('src/components/common/Input.tsx'), 'utf-8');

  // Input.tsx must handle numeric inputs with focusedText tracking and auto-select
  assert.ok(inputFile.includes('focusedText'), 'Input.tsx should track focusedText for number inputs');
  assert.ok(inputFile.includes('select()'), 'Input.tsx should auto-select value on focus');
});

test('PHASE 2 - A4 Printable Invoice preview and table width', () => {
  const invoiceFile = fs.readFileSync(path.resolve('src/components/placeholders/mss/MSSPrintableInvoice.tsx'), 'utf-8');

  // Default zoom scale is 85% for full width fit without cropping
  assert.ok(invoiceFile.includes('zoomScale, setZoomScale] = useState<number>(85)'), 'MSSPrintableInvoice should default to 85% zoom for width fit');

  // Table container has overflow-x-auto to protect against clipping
  assert.ok(invoiceFile.includes('overflow-x-auto print:overflow-visible'), 'Table container should have overflow-x-auto');

  // Modal has overflow-x-auto on body
  const modalFile = fs.readFileSync(path.resolve('src/components/common/Modal.tsx'), 'utf-8');
  assert.ok(modalFile.includes('overflow-x-auto'), 'Modal body should have overflow-x-auto');
});

test('PHASE 2 - All target views have pagination integrated with default 9 records', () => {
  const checkHasPagination = (filePath, fileLabel) => {
    const content = fs.readFileSync(path.resolve(filePath), 'utf-8');
    const hasPaginationProp = content.includes('pagination={{ pageSize: 9 }}') || content.includes('pageSize={9}') || content.includes('pageSize: 9');
    assert.ok(hasPaginationProp, `${fileLabel} (${filePath}) must have pagination with pageSize: 9`);
  };

  // Accessories views
  checkHasPagination('src/components/placeholders/accessories/InventoryView.tsx', 'Accessories Inventory');
  checkHasPagination('src/components/placeholders/accessories/ProductsView.tsx', 'Accessories Products');
  checkHasPagination('src/components/placeholders/accessories/InvoicesView.tsx', 'Accessories Invoices');
  checkHasPagination('src/components/placeholders/accessories/PurchasesView.tsx', 'Accessories Purchases');
  checkHasPagination('src/components/placeholders/accessories/ReturnsView.tsx', 'Accessories Returns');
  checkHasPagination('src/components/placeholders/accessories/HistoryView.tsx', 'Accessories History');
  checkHasPagination('src/components/placeholders/accessories/BackupView.tsx', 'Accessories Backup');

  // Compu MSS views
  checkHasPagination('src/components/placeholders/mss/MSSInventoryView.tsx', 'MSS Inventory');
  checkHasPagination('src/components/placeholders/mss/CatalogView.tsx', 'MSS Catalog');
  checkHasPagination('src/components/placeholders/mss/MSSInvoicesView.tsx', 'MSS Invoices');
  checkHasPagination('src/components/placeholders/mss/MSSReturnsView.tsx', 'MSS Returns');
  checkHasPagination('src/components/placeholders/mss/ReservationsView.tsx', 'MSS Reservations');
  checkHasPagination('src/components/placeholders/mss/SyncStatusView.tsx', 'MSS SyncStatus');
  checkHasPagination('src/components/placeholders/mss/MovementsView.tsx', 'MSS Movements');
  checkHasPagination('src/components/placeholders/mss/MSSAuditLogView.tsx', 'MSS AuditLog');
});
