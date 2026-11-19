import test, { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';

describe('COMPU MSS — QUICK MODEL CREATION & INVENTORY ACTIONS', () => {
  const modelModalPath = path.resolve('src/components/placeholders/mss/MSSModelModal.tsx');
  const deviceModalPath = path.resolve('src/components/placeholders/mss/MSSDeviceCreationModal.tsx');
  const catalogViewPath = path.resolve('src/components/placeholders/mss/CatalogView.tsx');
  const inventoryViewPath = path.resolve('src/components/placeholders/mss/MSSInventoryView.tsx');

  describe('1. Add New Model Directly From Add Device Modal', () => {
    it('MSSDeviceCreationModal exists and contains Add Model trigger near model selection', () => {
      assert.ok(fs.existsSync(deviceModalPath), 'MSSDeviceCreationModal.tsx must exist');
      const content = fs.readFileSync(deviceModalPath, 'utf8');

      // Check for Add New Model button next to model selection
      assert.ok(content.includes('إضافة موديل جديد'), 'Must contain Arabic button for adding new model');
      assert.ok(content.includes('setIsAddModelOpen(true)'), 'Must open Add Model modal without resetting parent modal');
      assert.ok(content.includes('SearchableItemSelect'), 'Must use SearchableItemSelect for model search');
    });

    it('MSSDeviceCreationModal renders MSSModelModal as an overlay with zIndexClassName="z-[60]"', () => {
      const content = fs.readFileSync(deviceModalPath, 'utf8');
      assert.ok(content.includes('<MSSModelModal'), 'Must embed MSSModelModal');
      assert.ok(content.includes('zIndexClassName="z-[60]"'), 'Must layer child modal above parent with z-[60]');
      assert.ok(content.includes('isOpen={isAddModelOpen}'), 'Child modal state must be tracked independently');
    });

    it('Preserves Add Device form state and auto-selects newly created model upon creation', () => {
      const content = fs.readFileSync(deviceModalPath, 'utf8');
      
      // Verification of handler
      assert.ok(content.includes('handleModelCreated'), 'Must define handleModelCreated callback');
      assert.ok(content.includes('setFormModelId(newModel.id)'), 'Must auto-select newly created model ID');
      assert.ok(content.includes('setIsAddModelOpen(false)'), 'Must close ONLY the child model modal');
      assert.ok(content.includes('setFormListPrice(newModel.default_list_price)'), 'Must populate default list price if needed');

      // Verification of preserved fields
      assert.ok(content.includes('formSerial'), 'Preserves serial state');
      assert.ok(content.includes('formCost'), 'Preserves cost state');
      assert.ok(content.includes('formLocation'), 'Preserves location state');
      assert.ok(content.includes('formCondition'), 'Preserves condition state');
      assert.ok(content.includes('formNotes'), 'Preserves notes state');
      assert.ok(content.includes('stockRegistrationMode'), 'Preserves registration mode');
    });
  });

  describe('2. Add New Device & Add New Model Buttons on Both Pages', () => {
    it('Inventory Page (MSSInventoryView) provides both Add New Device and Add New Model actions', () => {
      assert.ok(fs.existsSync(inventoryViewPath), 'MSSInventoryView.tsx must exist');
      const content = fs.readFileSync(inventoryViewPath, 'utf8');

      // Check header buttons
      assert.ok(content.includes('إضافة جهاز جديد'), 'Inventory must have Add Device button');
      assert.ok(content.includes('إضافة موديل جديد'), 'Inventory must have Add Model button');
      assert.ok(content.includes('setIsAddModelModalOpen(true)'), 'Add Model button opens model modal');
      assert.ok(content.includes('handleOpenAdd()'), 'Add Device button opens device modal');

      // Check modals rendered
      assert.ok(content.includes('<MSSDeviceCreationModal'), 'Inventory renders unified MSSDeviceCreationModal');
      assert.ok(content.includes('<MSSModelModal'), 'Inventory renders unified MSSModelModal');
    });

    it('Devices Page (CatalogView) provides both Add New Device and Add New Model actions', () => {
      assert.ok(fs.existsSync(catalogViewPath), 'CatalogView.tsx must exist');
      const content = fs.readFileSync(catalogViewPath, 'utf8');

      // Check header buttons
      assert.ok(content.includes('إضافة جهاز جديد'), 'Devices/Catalog page must have Add Device button');
      assert.ok(content.includes('إضافة موديل جديد'), 'Devices/Catalog page must have Add Model button');
      assert.ok(content.includes('setIsAddDeviceModalOpen(true)'), 'Add Device button opens device creation modal');
      assert.ok(content.includes('handleOpenAddModal'), 'Add Model button opens model modal');

      // Check modals rendered
      assert.ok(content.includes('<MSSDeviceCreationModal'), 'Devices page renders unified MSSDeviceCreationModal');
      assert.ok(content.includes('<MSSModelModal'), 'Devices page renders unified MSSModelModal');
    });

    it('Actions reuse shared components without duplicating creation forms', () => {
      const invContent = fs.readFileSync(inventoryViewPath, 'utf8');
      const catContent = fs.readFileSync(catalogViewPath, 'utf8');

      // Both views import the unified modals
      assert.ok(invContent.includes("from './MSSModelModal'"), 'Inventory imports MSSModelModal');
      assert.ok(invContent.includes("from './MSSDeviceCreationModal'"), 'Inventory imports MSSDeviceCreationModal');
      assert.ok(catContent.includes("from './MSSModelModal'"), 'Catalog imports MSSModelModal');
      assert.ok(catContent.includes("from './MSSDeviceCreationModal'"), 'Catalog imports MSSDeviceCreationModal');
    });
  });

  describe('3. UI & UX Layering, Validation and Catalog Services', () => {
    it('MSSModelModal validates mandatory fields and provides comprehensive hardware spec inputs', () => {
      assert.ok(fs.existsSync(modelModalPath), 'MSSModelModal.tsx must exist');
      const content = fs.readFileSync(modelModalPath, 'utf8');

      // Validation
      assert.ok(content.includes('الماركة مطلوبة') || content.includes('اسم الموديل مطلوب'), 'Validates required fields');
      assert.ok(content.includes('default_list_price') || content.includes('defaultListPrice'), 'Includes default list price field');

      // Hardware spec inputs
      assert.ok(content.includes('processor'), 'Includes processor field');
      assert.ok(content.includes('gpu'), 'Includes GPU field');
      assert.ok(content.includes('ram'), 'Includes RAM field');
      assert.ok(content.includes('storage'), 'Includes storage field');
      assert.ok(content.includes('screenSize'), 'Includes screen size field');
    });

    it('Strict isolation: Accessories module is completely untouched', () => {
      const accDir = path.resolve('src/components/placeholders/accessories');
      const files = fs.readdirSync(accDir);
      for (const file of files) {
        const filePath = path.join(accDir, file);
        if (fs.statSync(filePath).isFile()) {
          const content = fs.readFileSync(filePath, 'utf8');
          assert.ok(!content.includes('MSSDeviceCreationModal'), `Accessories file ${file} must not reference MSSDeviceCreationModal`);
          assert.ok(!content.includes('MSSModelModal'), `Accessories file ${file} must not reference MSSModelModal`);
        }
      }
    });
  });
});
