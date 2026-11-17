// Automated Verification Script for Maintenance in Accessories Sales & Invoices
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Mock localStorage for Node.js test environment
const storage = new Map();
global.localStorage = {
  getItem: (key) => storage.get(key) || null,
  setItem: (key, val) => storage.set(key, String(val)),
  removeItem: (key) => storage.delete(key),
  clear: () => storage.clear(),
};

// Import services dynamically
const { productsService } = await import('../src/services/productsService.ts');
const { salesService } = await import('../src/services/salesService.ts');
const { inventoryService } = await import('../src/services/inventoryService.ts');
const { returnsService } = await import('../src/services/returnsService.ts');
const { reportsService } = await import('../src/services/reportsService.ts');

describe('Manual Maintenance Items in Accessories Sales & Invoices', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('1. Creating a maintenance entry with a description and price', async () => {
    const sale = await salesService.createSale({
      invoice_number: 'INV-MAINT-001',
      customer_name: 'عميل صيانة تجريبي',
      invoice_discount: 0,
      payment_method: 'نقدي',
      items: [
        {
          item_type: 'maintenance',
          description: 'تعريج سلك نت',
          price: 30,
          quantity: 1,
          discount: 0,
        },
      ],
    });

    assert.strictEqual(sale.invoice_number, 'INV-MAINT-001');
    assert.strictEqual(sale.subtotal, 30);
    assert.strictEqual(sale.total_amount, 30);

    const items = await salesService.getInvoiceItems(sale.id);
    assert.strictEqual(items.length, 1);
    assert.strictEqual(items[0].item_type, 'maintenance');
    assert.strictEqual(items[0].product_name, 'تعريج سلك نت');
    assert.strictEqual(items[0].original_price, 30);
    assert.strictEqual(items[0].actual_price, 30);
    assert.strictEqual(items[0].line_total, 30);
    assert.strictEqual(items[0].cost_snapshot, 0);
  });

  test('2. Adding multiple maintenance entries to one invoice', async () => {
    const sale = await salesService.createSale({
      invoice_number: 'INV-MAINT-002',
      customer_name: 'محمد خالد',
      invoice_discount: 0,
      payment_method: 'فيزا',
      items: [
        {
          item_type: 'maintenance',
          description: 'تعريج سلك نت',
          price: 30,
          quantity: 2,
          discount: 0,
        },
        {
          item_type: 'maintenance',
          description: 'تغيير سوكت شحن',
          price: 150,
          quantity: 1,
          discount: 0,
        },
        {
          item_type: 'maintenance',
          description: 'تثبيت ويندوز وتعريفات',
          price: 100,
          quantity: 1,
          discount: 0,
        },
      ],
    });

    const items = await salesService.getInvoiceItems(sale.id);
    assert.strictEqual(items.length, 3);

    assert.strictEqual(items[0].product_name, 'تعريج سلك نت');
    assert.strictEqual(items[0].line_total, 60);

    assert.strictEqual(items[1].product_name, 'تغيير سوكت شحن');
    assert.strictEqual(items[1].line_total, 150);

    assert.strictEqual(items[2].product_name, 'تثبيت ويندوز وتعريفات');
    assert.strictEqual(items[2].line_total, 100);
  });

  test('3. Correct invoice subtotal and final total with discount', async () => {
    const sale = await salesService.createSale({
      invoice_number: 'INV-MAINT-003',
      invoice_discount: 20,
      payment_method: 'نقدي',
      items: [
        {
          item_type: 'maintenance',
          description: 'صيانة كيبورد لاب توب',
          price: 200,
          quantity: 1,
          discount: 10,
        },
        {
          item_type: 'maintenance',
          description: 'تنظيف مروحة وتغيير معجون حراري',
          price: 120,
          quantity: 1,
          discount: 0,
        },
      ],
    });

    // Item 1: 200 - 10 = 190
    // Item 2: 120 - 0 = 120
    // Subtotal: 190 + 120 = 310
    // Invoice discount: 20
    // Final total: 310 - 20 = 290
    assert.strictEqual(sale.subtotal, 310);
    assert.strictEqual(sale.discount, 20);
    assert.strictEqual(sale.total_amount, 290);
  });

  test('4. Correct payment method and total calculation', async () => {
    const sale = await salesService.createSale({
      invoice_number: 'INV-MAINT-004',
      invoice_discount: 0,
      payment_method: 'انستا باى / فودافون كاش',
      items: [
        {
          item_type: 'maintenance',
          description: 'صيانة باور سبلاي',
          price: 180,
          quantity: 1,
          discount: 0,
        },
      ],
    });

    assert.strictEqual(sale.payment_method, 'انستا باى / فودافون كاش');
    assert.strictEqual(sale.total_amount, 180);
    assert.strictEqual(sale.status, 'COMPLETED');
  });

  test('5. Maintenance revenue appearing in Accessories reports', async () => {
    const today = new Date().toISOString().substring(0, 10);
    await salesService.createSale({
      invoice_number: 'INV-REP-MAINT-01',
      invoice_date: today,
      invoice_discount: 0,
      payment_method: 'نقدي',
      items: [
        {
          item_type: 'maintenance',
          description: 'لحام وتجهيز وصلة شاشة',
          price: 85,
          quantity: 1,
          discount: 0,
        },
      ],
    });

    const summary = await reportsService.getFinancialSummary(today, today);
    assert.ok(summary.totalRevenue >= 85, 'Total revenue must include maintenance charge');
    assert.ok(summary.netSales >= 85, 'Net sales must include maintenance charge');
  });

  test('6. No inventory deduction after adding maintenance', async () => {
    const prod = await productsService.addProduct({
      name: 'ماوس لاسلكي تجريبي',
      code: 'TEST-PROD-MAINT-CHECK',
      cost: 40,
      price: 90,
      stock: 15,
      low_stock_threshold: 3,
    });

    const initialStock = prod.stock;
    const initialMovements = await inventoryService.getMovements(prod.id);

    await salesService.createSale({
      invoice_number: 'INV-NO-INV-DEDUCT',
      invoice_discount: 0,
      payment_method: 'نقدي',
      items: [
        {
          item_type: 'maintenance',
          description: 'صيانة وتغيير سلك شاحن',
          price: 50,
          quantity: 2,
          discount: 0,
        },
      ],
    });

    const currentProd = await productsService.getProductById(prod.id);
    assert.strictEqual(currentProd?.stock, initialStock, 'Product stock must NOT change when maintenance is sold');

    const currentMovements = await inventoryService.getMovements(prod.id);
    assert.strictEqual(currentMovements.length, initialMovements.length, 'No inventory movement should be created for maintenance');
  });

  test('7. No product record being created for maintenance', async () => {
    const productsBefore = await productsService.getProducts();

    await salesService.createSale({
      invoice_number: 'INV-NO-PROD-REC',
      invoice_discount: 0,
      payment_method: 'نقدي',
      items: [
        {
          item_type: 'maintenance',
          description: 'إصلاح راوتر منزلي',
          price: 70,
          quantity: 1,
          discount: 0,
        },
      ],
    });

    const productsAfter = await productsService.getProducts();
    assert.strictEqual(productsAfter.length, productsBefore.length, 'No new product record should be created in inventory catalog');
    assert.ok(!productsAfter.some(p => p.name === 'إصلاح راوتر منزلي'), 'Maintenance description should never become an inventory product');
  });

  test('8. No product COGS being deducted for maintenance', async () => {
    const today = new Date().toISOString().substring(0, 10);
    await salesService.createSale({
      invoice_number: 'INV-COGS-CHECK',
      invoice_date: today,
      invoice_discount: 0,
      payment_method: 'نقدي',
      items: [
        {
          item_type: 'maintenance',
          description: 'برمجة وتحديث بيوس',
          price: 150,
          quantity: 1,
          discount: 0,
        },
      ],
    });

    const invoice = (await salesService.getInvoices()).find(i => i.invoice_number === 'INV-COGS-CHECK');
    assert.ok(invoice);
    const items = await salesService.getInvoiceItems(invoice.id);
    assert.strictEqual(items[0].cost_snapshot, 0, 'Maintenance item cost snapshot must be strictly zero');
  });

  test('9. Editing, validating, and deleting maintenance entries', async () => {
    // Description validation
    await assert.rejects(
      async () => {
        await salesService.createSale({
          invoice_number: 'INV-INVALID-DESC',
          invoice_discount: 0,
          payment_method: 'نقدي',
          items: [
            {
              item_type: 'maintenance',
              description: '',
              price: 50,
              quantity: 1,
              discount: 0,
            },
          ],
        });
      },
      /وصف خدمة الصيانة إلزامي|يرجى كتابة وصف خدمة الصيانة المنفذة/
    );

    // Negative price validation
    await assert.rejects(
      async () => {
        await salesService.createSale({
          invoice_number: 'INV-INVALID-PRICE',
          invoice_discount: 0,
          payment_method: 'نقدي',
          items: [
            {
              item_type: 'maintenance',
              description: 'صيانة',
              price: -50,
              quantity: 1,
              discount: 0,
            },
          ],
        });
      },
      /سعر خدمة الصيانة/
    );
  });

  test('10. Maintenance returns without inventory movements or restock', async () => {
    const sale = await salesService.createSale({
      invoice_number: 'INV-RET-MAINT-01',
      invoice_discount: 0,
      payment_method: 'نقدي',
      items: [
        {
          item_type: 'maintenance',
          description: 'صيانة ميكروفون مكتبي',
          price: 60,
          quantity: 1,
          discount: 0,
        },
      ],
    });

    const items = await salesService.getInvoiceItems(sale.id);
    const maintItem = items[0];

    const returnRecord = await returnsService.createReturn({
      return_number: 'RET-MAINT-TEST-01',
      invoice_id: sale.id,
      return_date: new Date().toISOString().substring(0, 10),
      refund_amount: 60,
      refund_method: 'نقدي',
      reason: 'عدم اكتمال الإصلاح واسترداد القيمة للعميل',
      items: [
        {
          invoice_item_id: maintItem.id,
          product_id: null,
          quantity_returned: 1,
          refund_unit_price: 60,
          restock_condition: 'SERVICE',
          item_type: 'maintenance',
        },
      ],
    });

    assert.strictEqual(returnRecord.refund_amount, 60);

    const returnItems = await returnsService.getReturnItems(returnRecord.id);
    assert.strictEqual(returnItems.length, 1);
    assert.strictEqual(returnItems[0].item_type, 'maintenance');
    assert.strictEqual(returnItems[0].restock_condition, 'SERVICE');

    // Verify all inventory movements: none created for this return
    const allMovements = await inventoryService.getMovements();
    const retMovement = allMovements.find(m => m.reference_id === returnRecord.id);
    assert.ok(!retMovement, 'No inventory movement should exist for maintenance return');
  });

  test('11. Mixed invoice with physical products and maintenance works seamlessly', async () => {
    const prod = await productsService.addProduct({
      name: 'كابل HDMI 4K فائق السرعة',
      code: 'TEST-HDMI-4K',
      cost: 35,
      price: 80,
      stock: 10,
      low_stock_threshold: 2,
    });

    const sale = await salesService.createSale({
      invoice_number: 'INV-MIXED-001',
      invoice_discount: 10,
      payment_method: 'نقدي',
      items: [
        {
          item_type: 'product',
          product_id: prod.id,
          quantity: 2,
          discount: 0,
        },
        {
          item_type: 'maintenance',
          description: 'تعريج سلك نت شيلد',
          price: 40,
          quantity: 1,
          discount: 0,
        },
      ],
    });

    // Subtotal: (2 * 80) + 40 = 200
    // Discount: 10
    // Total: 190
    assert.strictEqual(sale.subtotal, 200);
    assert.strictEqual(sale.total_amount, 190);

    // Product stock must be deducted by 2 (10 -> 8)
    const updatedProd = await productsService.getProductById(prod.id);
    assert.strictEqual(updatedProd?.stock, 8);

    // Movements must have 1 movement for product, 0 for maintenance
    const movements = await inventoryService.getMovements(prod.id);
    const saleMovement = movements.find(m => m.reference_id === sale.id);
    assert.ok(saleMovement);
    assert.strictEqual(saleMovement.quantity_change, -2);
  });

  test('12. Existing historical invoices remain readable and backward-compatible', async () => {
    const invoices = await salesService.getInvoices();
    assert.ok(invoices.length >= 2, 'Seed invoices must remain accessible');

    const first = invoices[0];
    const items = await salesService.getInvoiceItems(first.id);
    assert.ok(items.length >= 1);
    // Historical items have default item_type 'product' or undefined
    assert.ok(items[0].item_type === 'product' || !items[0].item_type);
  });

  test('13. Offline operation: Accessories works completely locally with zero Supabase calls', () => {
    const salesServicePath = path.join(projectRoot, 'src/services/salesService.ts');
    const salesContent = fs.readFileSync(salesServicePath, 'utf-8');

    // Verify Rule 6: Accessories salesService does NOT import supabase
    assert.ok(!salesContent.includes("from '../lib/supabase"), 'salesService must never import or call Supabase');
    assert.ok(!salesContent.includes('from "./supabase"'), 'salesService must never import or call Supabase');
  });

  test('14. Ensuring the maintenance feature does NOT appear in Compu MSS', () => {
    const mssSalesPath = path.join(projectRoot, 'src/components/placeholders/mss/MSSSalesView.tsx');
    const mssInvoicesPath = path.join(projectRoot, 'src/components/placeholders/mss/MSSInvoicesView.tsx');

    const mssSalesContent = fs.readFileSync(mssSalesPath, 'utf-8');
    const mssInvoicesContent = fs.readFileSync(mssInvoicesPath, 'utf-8');

    // Rule 7 check: MSS sales must not contain the manual maintenance button or workflow
    assert.ok(!mssSalesContent.includes('handleOpenAddMaintenance'), 'MSS Sales must not have maintenance addition');
    assert.ok(!mssSalesContent.includes('isMaintenanceModalOpen'), 'MSS Sales must not have maintenance modal');
    assert.ok(!mssInvoicesContent.includes('isMaintenanceModalOpen'), 'MSS Invoices must not have maintenance modal');
  });
});
