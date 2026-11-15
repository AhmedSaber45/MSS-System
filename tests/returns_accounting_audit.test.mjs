import test from 'node:test';
import assert from 'node:assert/strict';

// Test the core accounting formulas and logic
import {
  roundMoney,
  calculateNetSales,
  calculateNetCogs,
  calculateGrossProfit,
  calculateProfitMarginPercent,
  computeAccountingMetrics,
} from '../src/lib/accounting.ts';

import { formatPieceCount } from '../src/lib/utils.ts';

test('Accounting Engine - Basic Precision & Math', () => {
  assert.equal(roundMoney(10.005), 10.01);
  assert.equal(roundMoney(10.004), 10);
  assert.equal(roundMoney(0.1 + 0.2), 0.3);
  assert.equal(calculateNetSales(100, 20), 80);
  assert.equal(calculateNetSales(100, 150), 0); // No negative net sales
  assert.equal(calculateNetCogs(50, 10), 40);
  assert.equal(calculateNetCogs(50, 60), 0); // No negative net COGS
  assert.equal(calculateGrossProfit(100, 70), 30);
  assert.equal(calculateProfitMarginPercent(30, 100), 30);
  assert.equal(calculateProfitMarginPercent(30, 0), 0);
});

test('Section 9 - Example 1: Full Restocked Return (Sellable Device / Restocked Item)', () => {
  // Gross Sales: 10,000
  // Returns: 2,000
  // Original COGS: 7,000
  // Reversed COGS: 1,400 (item is sellable / RESTOCKED)
  const metrics = computeAccountingMetrics({
    grossSales: 10000,
    totalReturns: 2000,
    originalCogs: 7000,
    reversedCogs: 1400,
  });

  assert.equal(metrics.grossSales, 10000, 'Gross sales must be preserved as 10,000');
  assert.equal(metrics.totalReturns, 2000, 'Total returns must be 2,000');
  assert.equal(metrics.netSales, 8000, 'Net Sales = Gross Sales (10,000) - Total Returns (2,000) = 8,000');
  assert.equal(metrics.originalCogs, 7000, 'Original COGS must be 7,000');
  assert.equal(metrics.reversedCogs, 1400, 'Reversed COGS must be 1,400');
  assert.equal(metrics.netCogs, 5600, 'Net COGS = Original COGS (7,000) - Reversed COGS (1,400) = 5,600');
  assert.equal(metrics.grossProfit, 2400, 'Gross Profit = Net Sales (8,000) - Net COGS (5,600) = 2,400');
  assert.equal(metrics.profitMarginPercent, 30, 'Margin = (2,400 / 8,000) * 100 = 30.0%');
});

test('Section 9 - Example 2: Damaged / Non-sellable Return (No COGS Reversal)', () => {
  // Gross Sales: 10,000
  // Returns: 2,000
  // Original COGS: 7,000
  // Reversed COGS: 0 (item is DAMAGED / defective / non-sellable)
  const metrics = computeAccountingMetrics({
    grossSales: 10000,
    totalReturns: 2000,
    originalCogs: 7000,
    reversedCogs: 0,
  });

  assert.equal(metrics.grossSales, 10000, 'Gross sales must be 10,000');
  assert.equal(metrics.totalReturns, 2000, 'Total returns must be 2,000');
  assert.equal(metrics.netSales, 8000, 'Net Sales = 10,000 - 2,000 = 8,000');
  assert.equal(metrics.originalCogs, 7000, 'Original COGS must be 7,000');
  assert.equal(metrics.reversedCogs, 0, 'Reversed COGS must be 0 for damaged return');
  assert.equal(metrics.netCogs, 7000, 'Net COGS remains 7,000 because defective unit cost is absorbed');
  assert.equal(metrics.grossProfit, 1000, 'Gross Profit = Net Sales (8,000) - Net COGS (7,000) = 1,000');
  assert.equal(metrics.profitMarginPercent, 12.5, 'Margin = (1,000 / 8,000) * 100 = 12.5%');
});

test('Piece Count Scalability - Arabic Grammar Rules for قطع vs قطعة', () => {
  // 0 -> 'نفد'
  assert.equal(formatPieceCount(0), 'نفد');
  assert.equal(formatPieceCount(-5), 'نفد');
  assert.equal(formatPieceCount(0, { zeroText: '0 قطعة' }), '0 قطعة');

  // 1 -> '1 قطعة'
  assert.equal(formatPieceCount(1), '1 قطعة');

  // 2 -> '2 قطعة'
  assert.equal(formatPieceCount(2), '2 قطعة');

  // 3-10 -> 'قطع' (جمع تكسير)
  assert.equal(formatPieceCount(3), '3 قطع');
  assert.equal(formatPieceCount(4), '4 قطع');
  assert.equal(formatPieceCount(5), '5 قطع');
  assert.equal(formatPieceCount(9), '9 قطع');
  assert.equal(formatPieceCount(10), '10 قطع');

  // 11-99 -> 'قطعة' (مفرد منصوب)
  assert.equal(formatPieceCount(11), '11 قطعة');
  assert.equal(formatPieceCount(12), '12 قطعة');
  assert.equal(formatPieceCount(35), '35 قطعة');
  assert.equal(formatPieceCount(50), '50 قطعة');
  assert.equal(formatPieceCount(99), '99 قطعة');

  // Hundreds:
  assert.equal(formatPieceCount(100), '100 قطعة');
  assert.equal(formatPieceCount(104), '104 قطع'); // 104 -> 4 قطع
  assert.equal(formatPieceCount(114), '114 قطعة'); // 114 -> 14 قطعة

  // Suffix support:
  assert.equal(formatPieceCount(4, 'متوفرة'), '4 قطع متوفرة');
  assert.equal(formatPieceCount(35, 'متوفرة'), '35 قطعة متوفرة');
  assert.equal(formatPieceCount(1, 'متوفرة'), '1 قطعة متوفرة');
  assert.equal(formatPieceCount(0, { zeroText: 'لا توجد قطع', suffix: 'متوفرة' }), 'لا توجد قطع متوفرة');
});
