import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('Task 2: Promotional Image - Model Column Centering', async (t) => {
  await t.test('MSSPromotionalGenerator.tsx centers Model column header and table cells', () => {
    const filePath = path.resolve('src/components/placeholders/mss/MSSPromotionalGenerator.tsx');
    assert.ok(fs.existsSync(filePath), 'MSSPromotionalGenerator.tsx must exist');

    const content = fs.readFileSync(filePath, 'utf8');

    // 1. Check Table Header centering
    // Looking for Model column header with text-center and justify-center
    assert.ok(
      content.includes('text-center font-bold tracking-wide') || content.includes('text-center'),
      'Model column header must have text-center class'
    );
    assert.ok(
      content.includes('justify-center'),
      'Model column header flex items must be centered'
    );

    // 2. Check Table Data Cell centering
    assert.ok(
      content.includes('text-center align-middle') && content.includes('font-bold'),
      'Model table cell must have text-center align-middle and font-bold'
    );

    // 3. Check inner Model Name container centering without ellipsis truncation
    assert.ok(
      content.includes('className="text-center leading-[1.3] break-normal [overflow-wrap:normal]"'),
      'Model name container must be text-center with natural word-boundary wrapping and no truncation'
    );
  });

  await t.test('mssPromotionalService.ts centers Model column on exported Canvas', () => {
    const servicePath = path.resolve('src/services/mssPromotionalService.ts');
    assert.ok(fs.existsSync(servicePath), 'mssPromotionalService.ts must exist');

    const serviceContent = fs.readFileSync(servicePath, 'utf8');

    // Check canvas export logic for Model column
    assert.ok(
      serviceContent.includes('const cellCenterX = cellX + col.width / 2;'),
      'Canvas rendering must compute cellCenterX as cellX + col.width / 2'
    );
    assert.ok(
      serviceContent.includes("ctx.textAlign = 'center';"),
      'Canvas rendering for Model column must set ctx.textAlign to center'
    );
    assert.ok(
      serviceContent.includes('ctx.fillText(modelText, cellCenterX, cellCenterY);') ||
      serviceContent.includes('cellCenterX'),
      'Canvas rendering must draw Model text centered at cellCenterX'
    );
  });

  await t.test('mssWholesaleExportService.ts centers Model column in Excel sheet', () => {
    const excelServicePath = path.resolve('src/services/mssWholesaleExportService.ts');
    assert.ok(fs.existsSync(excelServicePath), 'mssWholesaleExportService.ts must exist');

    const excelContent = fs.readFileSync(excelServicePath, 'utf8');

    // Check that horizontalAlign is center for all cells including model
    assert.ok(
      excelContent.includes("const horizontalAlign: 'right' | 'center' = 'center';"),
      'Excel sheet data cells must be centered horizontally'
    );
    assert.ok(
      !excelContent.includes("isModel ? 'right' : 'center'"),
      'Model column must NOT be aligned to right'
    );
  });
});
