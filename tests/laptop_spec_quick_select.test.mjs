import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('Laptop Specifications Quick-Select Component & Application-Wide Integration', async (t) => {
  const componentPath = path.resolve('src/components/common/LaptopSpecQuickSelect.tsx');
  const accPromoPath = path.resolve('src/components/placeholders/accessories/AccessoriesPromotionalView.tsx');
  const mssModelModalPath = path.resolve('src/components/placeholders/mss/MSSModelModal.tsx');
  const mssPromoGenPath = path.resolve('src/components/placeholders/mss/MSSPromotionalGenerator.tsx');
  const accProductsPath = path.resolve('src/components/placeholders/accessories/ProductsView.tsx');

  const componentContent = fs.readFileSync(componentPath, 'utf8');
  const accPromoContent = fs.readFileSync(accPromoPath, 'utf8');
  const mssModelModalContent = fs.readFileSync(mssModelModalPath, 'utf8');
  const mssPromoGenContent = fs.readFileSync(mssPromoGenPath, 'utf8');
  const accProductsContent = fs.readFileSync(accProductsPath, 'utf8');

  await t.test('1. Exact quick-select options are defined centrally', () => {
    assert.ok(componentContent.includes("ram: ['4 GB', '8 GB', '16 GB', '32 GB']"));
    assert.ok(componentContent.includes("storage: ['SSD 128 GB', 'SSD 256 GB', 'SSD 512 GB', 'HDD 500 GB', 'HDD 1 TB']"));
    assert.ok(componentContent.includes("screen: ['14.1', '15.6']"));
    assert.ok(componentContent.includes("processor: ['CI 3', 'CI 5', 'CI 7', 'CI 9', 'RYZEN 3', 'RYZEN 5', 'RYZEN 7']"));
    assert.ok(componentContent.includes("gpu: ['AMD', 'NVIDIA', 'INTEL']"));
    assert.ok(!componentContent.includes('NIVIDA'), 'Must use exact NVIDIA spelling');
  });

  await t.test('2. Quick-select buttons use type="button" and keep inputs freely editable', () => {
    assert.ok(componentContent.includes('type="button"'), 'Quick-select pills must not submit forms');
    assert.ok(componentContent.includes('onClick={() => onSelect(option)}'));
    assert.ok(!accPromoContent.includes('readOnly'), 'Accessories promotional inputs must remain editable');
    assert.ok(!mssModelModalContent.includes('readOnly'), 'MSS Model Modal inputs must remain editable');
  });

  await t.test('3. Accessories Promotional Image form includes all 4 quick-select groups', () => {
    assert.ok(accPromoContent.includes('specType="processor"'));
    assert.ok(accPromoContent.includes('specType="ram"'));
    assert.ok(accPromoContent.includes('specType="storage"'));
    assert.ok(accPromoContent.includes('specType="screen"'));
    assert.ok(accPromoContent.includes('specType="gpu"'));
  });

  await t.test('4. Compu MSS Add/Edit Model Modal includes all 5 quick-select groups for Laptops only', () => {
    assert.ok(mssModelModalContent.includes('specType="processor"'));
    assert.ok(mssModelModalContent.includes('specType="ram"'));
    assert.ok(mssModelModalContent.includes('specType="storage"'));
    assert.ok(mssModelModalContent.includes('specType="screen"'));
    assert.ok(mssModelModalContent.includes('specType="gpu"'));
  });

  await t.test('5. Promotional Image inline edit form includes quick-select groups', () => {
    assert.ok(mssPromoGenContent.includes('specType="processor"'));
    assert.ok(mssPromoGenContent.includes('specType="ram"'));
    assert.ok(mssPromoGenContent.includes('specType="storage"'));
    assert.ok(mssPromoGenContent.includes('specType="gpu"'));
  });

  await t.test('6. Non-laptop product forms are NOT modified with laptop quick-selects', () => {
    assert.ok(!accProductsContent.includes('LaptopSpecQuickSelect'));
  });
});
