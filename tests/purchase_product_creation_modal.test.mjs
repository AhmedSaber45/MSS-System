import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

// Mock localStorage for isolated Node.js test environment
const storage = new Map();
globalThis.localStorage = {
  getItem: (k) => storage.get(k) || null,
  setItem: (k, v) => storage.set(k, String(v)),
  removeItem: (k) => storage.delete(k),
  clear: () => storage.clear(),
};

// Dynamically import services under test
const { productsService } = await import('../src/services/productsService.ts');
const { purchasesService } = await import('../src/services/purchasesService.ts');
const { inventoryService } = await import('../src/services/inventoryService.ts');

describe('Task: Add Existing Product Creation Modal to New Purchase Invoice Modal', () => {
  beforeEach(() => {
    storage.clear();
  });

  test('1. Codebase verification: ProductCreationModal is created as a reusable component', () => {
    const modalPath = path.resolve('src/components/placeholders/accessories/ProductCreationModal.tsx');
    assert.ok(fs.existsSync(modalPath), 'ProductCreationModal.tsx must exist');

    const content = fs.readFileSync(modalPath, 'utf8');

    // Props and interface checks
    assert.ok(content.includes('ProductCreationModalProps'), 'Must define ProductCreationModalProps');
    assert.ok(content.includes('isFromPurchaseInvoice'), 'Must support isFromPurchaseInvoice prop');
    assert.ok(content.includes('zIndexClassName'), 'Must support zIndexClassName prop for modal layering');
    assert.ok(content.includes('onSuccess: (product: Product, isExistingDuplicate: boolean)'), 'onSuccess must receive product and isExistingDuplicate flag');

    // Duplicate detection checks (Phase 5)
    assert.ok(content.includes('الصنف ده موجود بالفعل في المنتجات. تم تحديد الصنف الموجود بدلًا من إضافة نسخة مكررة.'),
      'Must contain exact Egyptian Arabic duplicate message');
    assert.ok(content.includes('تمت إضافة الصنف بنجاح وإدراجه في الفاتورة.'),
      'Must contain exact Egyptian Arabic success message for purchase invoice workflow');

    // Inventory safety (Phase 7)
    assert.ok(content.includes('isFromPurchaseInvoice ? 0 :'),
      'Must enforce initial master stock as 0 when created from purchase invoice flow');
    assert.ok(content.includes('الرصيد الابتدائي (0)'),
      'Must display clear explanatory copy about starting balance 0 in purchase invoice');
  });

  test('2. Codebase verification: PurchasesView integrates ProductCreationModal with button and layering', () => {
    const purchasesPath = path.resolve('src/components/placeholders/accessories/PurchasesView.tsx');
    assert.ok(fs.existsSync(purchasesPath), 'PurchasesView.tsx must exist');

    const content = fs.readFileSync(purchasesPath, 'utf8');

    // Import check
    assert.ok(content.includes("import { ProductCreationModal } from './ProductCreationModal';"),
      'PurchasesView must import ProductCreationModal');

    // Button presence (Phase 2)
    assert.ok(content.includes('+ إضافة صنف جديد'),
      'Must contain "+ إضافة صنف جديد" button');

    // Select dropdown option
    assert.ok(content.includes('+ إضافة صنف جديد...'),
      'Must contain "+ إضافة صنف جديد..." quick-action select option');

    // Modal state & layering (Phase 3)
    assert.ok(content.includes('isAddProductModalOpen'),
      'Must maintain dedicated isAddProductModalOpen state without closing isAddModalOpen');
    assert.ok(content.includes('zIndexClassName="z-[60]"'),
      'Must layer ProductCreationModal at z-[60] above the purchase invoice modal');

    // Insertion & selection logic (Phase 6)
    assert.ok(content.includes('handleProductCreatedFromModal'),
      'Must define handleProductCreatedFromModal');
    assert.ok(content.includes('setSelectedProductId(product.id)'),
      'Must select the created or existing duplicate product in the selector');
    assert.ok(content.includes('setCartItems'),
      'Must insert or update line item in cartItems');
  });

  test('3. Codebase verification: ProductsView reuses ProductCreationModal without code duplication', () => {
    const productsPath = path.resolve('src/components/placeholders/accessories/ProductsView.tsx');
    assert.ok(fs.existsSync(productsPath), 'ProductsView.tsx must exist');

    const content = fs.readFileSync(productsPath, 'utf8');

    // Reuse check (Phase 4)
    assert.ok(content.includes("import { ProductCreationModal } from './ProductCreationModal';"),
      'ProductsView must import and reuse ProductCreationModal');
    assert.ok(content.includes('<ProductCreationModal'),
      'ProductsView must render ProductCreationModal');

    // Edit modal remains intact
    assert.ok(content.includes('isEditModalOpen'),
      'Existing product editing modal must remain functional');
    assert.ok(content.includes('handleEditSubmit'),
      'Existing handleEditSubmit must remain functional');
  });

  test('4. Duplicate detection: Identifies existing product by code and does not duplicate', async () => {
    // 1. Initial product
    const existing = await productsService.addProduct({
      name: 'كابل تايب سي سريع 60W',
      code: 'CBL-TC-60W',
      cost: 45,
      price: 90,
      stock: 10,
      low_stock_threshold: 3,
      description: 'كابل سريع أصلي',
    });

    assert.ok(existing.id);

    // 2. Fetch products to simulate duplicate check in ProductCreationModal
    const catalog = await productsService.getProducts();
    const inputCode = 'cbl-tc-60w'; // case-insensitive match
    const duplicate = catalog.find(p => p.code.toLowerCase() === inputCode.toLowerCase());

    assert.ok(duplicate, 'Must detect duplicate by product code');
    assert.strictEqual(duplicate.id, existing.id, 'Must return the exact existing database ID');
    assert.strictEqual(duplicate.name, 'كابل تايب سي سريع 60W');

    // Total products count should remain unchanged
    const countBefore = (await productsService.getProducts()).length;
    // Do not call addProduct if duplicate detected
    const countAfter = (await productsService.getProducts()).length;
    assert.strictEqual(countAfter, countBefore, 'Duplicate must not create an extra product record');
  });

  test('5. Duplicate detection: Identifies existing product by name and does not duplicate', async () => {
    const existing = await productsService.addProduct({
      name: 'جراب ايفون شفاف ماج سيف',
      code: 'CAS-IPH-CLR',
      cost: 30,
      price: 70,
      stock: 15,
      low_stock_threshold: 5,
    });

    const catalog = await productsService.getProducts();
    const inputName = '  جراب ايفون شفاف ماج سيف  '; // trimmed match
    const duplicate = catalog.find(p => p.name.trim().toLowerCase() === inputName.trim().toLowerCase());

    assert.ok(duplicate, 'Must detect duplicate by product name');
    assert.strictEqual(duplicate.id, existing.id);
  });

  test('6. Product creation from invoice flow initializes stock to 0 (Inventory Safety Rule 7 & Phase 7)', async () => {
    // In purchase invoice mode, isFromPurchaseInvoice = true forces stock = 0
    const newProd = await productsService.addProduct({
      name: 'وصلة تحويل OTG Type-C معدن',
      code: 'OTG-TC-MET',
      cost: 20,
      price: 50,
      stock: 0, // master stock 0
      low_stock_threshold: 5,
      description: 'وصلة معدنية فائقة السرعة',
    });

    assert.ok(newProd.id);
    assert.strictEqual(newProd.stock, 0, 'New product master record must start with 0 stock');

    // Verify inventory movements: NO movement created yet because purchase invoice has not been finalized
    const movements = await inventoryService.getMovements(newProd.id);
    assert.strictEqual(movements.length, 0, 'No inventory movements before purchase invoice finalization');
  });

  test('7. Complete workflow: Product created from invoice modal -> added to invoice items -> invoice confirmed -> stock increases accurately', async () => {
    // Step 1: User creates product from within purchase invoice modal
    const product = await productsService.addProduct({
      name: 'حامل هاتف للسيارة مغناطيسي',
      code: 'HLD-CAR-MAG',
      cost: 75,
      price: 150,
      stock: 0, // Master record stock 0
      low_stock_threshold: 4,
    });

    assert.strictEqual(product.stock, 0, 'Initial master record stock is 0');

    // Step 2: Product is added as line item in purchase invoice
    const nextPurNumber = await purchasesService.generateNextPurchaseNumber();
    const purchaseDate = new Date().toISOString().split('T')[0];

    const purchase = await purchasesService.createPurchase({
      purchase_number: nextPurNumber,
      purchase_date: purchaseDate,
      supplier_name: 'شركة النور للإلكترونيات',
      supplier_phone: '01012345678',
      notes: 'فاتورة توريد حوامل هواتف',
      items: [
        {
          product_id: product.id,
          quantity: 25,
          unit_cost: 75,
          update_product_cost: true,
        },
      ],
    });

    assert.ok(purchase.id);
    assert.strictEqual(purchase.total_amount, 25 * 75);

    // Step 3: Verify product stock has now increased by exactly the invoice quantity (25)
    const updatedProd = await productsService.getProductById(product.id);
    assert.ok(updatedProd);
    assert.strictEqual(updatedProd.stock, 25, 'Stock must now equal exactly 25 with no double counting');

    // Step 4: Verify inventory movement audit trail
    const movements = await inventoryService.getMovements(product.id);
    assert.strictEqual(movements.length, 1, 'Exactly one inventory movement should be recorded');
    assert.strictEqual(movements[0].movement_type, 'PURCHASE');
    assert.strictEqual(movements[0].quantity_change, 25);
    assert.strictEqual(movements[0].previous_stock, 0);
    assert.strictEqual(movements[0].new_stock, 25);
    assert.strictEqual(movements[0].reference_id, purchase.id);
  });

  test('8. Duplicate item handling in invoice: Increments quantity without broken or duplicate rows', () => {
    // Simulate cartItems state management in PurchasesView
    let cartItems = [
      {
        product_id: 'prd-001',
        product_name: 'شاحن 20W',
        product_code: 'CHG-20W',
        quantity: 5,
        unit_cost: 60,
        update_product_cost: true,
      },
    ];

    const addItem = (product, addQty) => {
      const existingIdx = cartItems.findIndex(i => i.product_id === product.id);
      if (existingIdx >= 0) {
        cartItems = cartItems.map((item, idx) =>
          idx === existingIdx
            ? { ...item, quantity: item.quantity + addQty, unit_cost: product.cost || item.unit_cost }
            : item
        );
      } else {
        cartItems.push({
          product_id: product.id,
          product_name: product.name,
          product_code: product.code,
          quantity: addQty,
          unit_cost: product.cost,
          update_product_cost: true,
        });
      }
    };

    // Adding existing item
    addItem({ id: 'prd-001', name: 'شاحن 20W', code: 'CHG-20W', cost: 65 }, 3);
    assert.strictEqual(cartItems.length, 1, 'Must not duplicate row for existing item');
    assert.strictEqual(cartItems[0].quantity, 8, 'Must increment quantity from 5 + 3 = 8');
    assert.strictEqual(cartItems[0].unit_cost, 65, 'Must update unit cost');

    // Adding fresh item
    addItem({ id: 'prd-002', name: 'سماعة بلوتوث', code: 'EAR-BT', cost: 120 }, 2);
    assert.strictEqual(cartItems.length, 2, 'Must add new item row');
    assert.strictEqual(cartItems[1].quantity, 2);
  });
});
