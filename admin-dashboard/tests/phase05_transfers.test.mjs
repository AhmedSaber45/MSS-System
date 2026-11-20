import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { adminService } from '../src/services/adminService.ts';
import { getServerSupabase } from '../src/lib/supabase.ts';

describe('Admin Service Phase 5: Inventory Management, Stock Transfers & Concurrency', () => {
  const dummyActor = {
    adminId: 'admin-001',
    username: 'superadmin',
    displayName: 'Super Admin',
    role: 'superadmin',
    exp: Date.now() + 3600000,
  };

  after(async () => {
    // Restore seed device location so mss_inventory tests retain expected per-shop seeds
    try {
      const supabase = getServerSupabase();
      await supabase.from('mss_devices').update({ stock_location: 'محل 2' }).eq('id', 'b0000000-0000-0000-0000-000000000002');
    } catch {
      // Non-critical in offline mode
    }
  });

  it('calculates inventory overview, status breakdowns, and transfer eligibility accurately', async () => {
    const overview = await adminService.getInventoryOverview();
    assert.ok(overview.devices.length >= 6);
    assert.ok(overview.summary);

    // Verify status counts
    assert.ok(overview.summary.totalCount >= 6);
    assert.ok(overview.summary.availableCount >= 3);
    assert.ok(overview.summary.reservedCount >= 1);
    assert.ok(overview.summary.soldCount >= 1);
    assert.ok(overview.summary.totalCostValue > 0);

    // Verify eligibility rules
    const availableDev = overview.devices.find(d => d.status === 'AVAILABLE');
    assert.ok(availableDev);
    assert.equal(availableDev.isEligibleForTransfer, true);
    assert.equal(availableDev.ineligibilityReason, undefined);

    const soldDev = overview.devices.find(d => d.status === 'SOLD');
    assert.ok(soldDev);
    assert.equal(soldDev.isEligibleForTransfer, false);
    assert.ok(soldDev.ineligibilityReason?.includes('بيع'));

    const reservedDev = overview.devices.find(d => d.status === 'RESERVED');
    assert.ok(reservedDev);
    assert.equal(reservedDev.isEligibleForTransfer, false);
    assert.ok(reservedDev.ineligibilityReason?.includes('محجوز'));
  });

  it('filters inventory by location, status, and search query', async () => {
    // Filter by location
    const shop1Res = await adminService.getInventoryOverview({ stockLocation: 'محل 1' });
    assert.ok(shop1Res.devices.every(d => d.stockLocation === 'محل 1'));

    // Filter by status
    const availableRes = await adminService.getInventoryOverview({ status: 'AVAILABLE' });
    assert.ok(availableRes.devices.every(d => d.status === 'AVAILABLE'));

    // Search by serial
    const searchRes = await adminService.getInventoryOverview({ search: 'PF1K892' });
    assert.equal(searchRes.devices.length, 1);
    assert.equal(searchRes.devices[0].serialNumber, 'PF1K892-LEN');
  });

  it('previews transfer impact and rejects invalid source/destination or ineligible devices', async () => {
    // 1. Reject source === destination
    const sameLocPreview = await adminService.previewInventoryTransfer({
      sourceLocation: 'محل 1',
      destinationLocation: 'محل 1',
      transferType: 'ALL_ELIGIBLE',
    });
    assert.equal(sameLocPreview.canTransfer, false);
    assert.ok(sameLocPreview.validationErrors?.some(e => e.includes('نفس الموقع')));

    // 2. Reject transfer of a SOLD device
    const soldDev = (await adminService.getInventoryOverview()).devices.find(d => d.status === 'SOLD');
    assert.ok(soldDev);

    const soldPreview = await adminService.previewInventoryTransfer({
      sourceLocation: soldDev.stockLocation,
      destinationLocation: 'محل 1',
      transferType: 'INDIVIDUAL',
      deviceIds: [soldDev.id],
    });
    assert.equal(soldPreview.canTransfer, false);
    assert.ok(soldPreview.ineligibleDevices.length > 0);
    assert.ok(soldPreview.validationErrors?.some(e => e.includes('غير متاحة')));

    // 3. Valid preview works and calculates total cost
    const validPreview = await adminService.previewInventoryTransfer({
      sourceLocation: 'محل 2',
      destinationLocation: 'محل 1',
      transferType: 'ALL_ELIGIBLE',
    });
    assert.equal(validPreview.canTransfer, true);
    assert.ok(validPreview.totalEligibleCount >= 1);
    assert.ok(validPreview.totalEligibleCost > 0);
    assert.ok(validPreview.historicalNotice.includes('تكاليف الشراء الأصلية'));
  });

  it('executes individual device transfer atomically, preserving purchase cost and serial number', async () => {
    const overview = await adminService.getInventoryOverview();
    const candidate = overview.devices.find(d => d.status === 'AVAILABLE');
    assert.ok(candidate, 'Must have at least one available device');

    const srcLoc = candidate.stockLocation;
    const destLoc = srcLoc === 'محل 2' ? 'محل 1' : 'محل 2';

    const originalCost = candidate.purchaseCost;
    const originalSerial = candidate.serialNumber;
    const originalPurchaseDate = candidate.purchaseDate;
    const originalModelId = candidate.modelId;

    const res = await adminService.executeInventoryTransfer(
      {
        sourceLocation: srcLoc,
        destinationLocation: destLoc,
        transferType: 'INDIVIDUAL',
        deviceIds: [candidate.id],
        notes: 'نقل فردي تجريبي',
        confirmed: true,
      },
      dummyActor
    );

    assert.equal(res.success, true);
    assert.equal(res.itemCount, 1);
    assert.ok(res.referenceNumber.startsWith('TRF-'));

    // Verify device location updated
    const after = await adminService.getInventoryOverview();
    const updatedDev = after.devices.find(d => d.id === candidate.id);
    assert.ok(updatedDev);
    assert.equal(updatedDev.stockLocation, destLoc);

    // CRITICAL: Financial & Data Integrity (Rule C & D)
    assert.equal(updatedDev.purchaseCost, originalCost, 'Purchase cost must remain identical');
    assert.equal(updatedDev.serialNumber, originalSerial, 'Serial number must remain identical');
    assert.equal(updatedDev.purchaseDate, originalPurchaseDate, 'Purchase date must remain identical');
    assert.equal(updatedDev.modelId, originalModelId, 'Model ID must remain identical');
  });

  it('executes multi-device transfer and preserves company-wide stock totals (Rule D)', async () => {
    const beforeOverview = await adminService.getInventoryOverview();
    const totalCompanyStockBefore = beforeOverview.summary.totalCount;

    // Group available devices by stock location
    const byLoc = {};
    for (const d of beforeOverview.devices) {
      if (d.status === 'AVAILABLE') {
        byLoc[d.stockLocation] = byLoc[d.stockLocation] || [];
        byLoc[d.stockLocation].push(d);
      }
    }

    let srcLoc = Object.keys(byLoc).find(loc => byLoc[loc].length >= 2);
    // If no single location has 2 available devices, consolidate 1 device to create a group
    if (!srcLoc) {
      const avail = beforeOverview.devices.filter(d => d.status === 'AVAILABLE');
      assert.ok(avail.length >= 2, 'Must have at least 2 available devices across locations');
      srcLoc = avail[0].stockLocation;
      const otherDev = avail.find(d => d.stockLocation !== srcLoc);
      if (otherDev) {
        await adminService.executeInventoryTransfer(
          {
            sourceLocation: otherDev.stockLocation,
            destinationLocation: srcLoc,
            transferType: 'INDIVIDUAL',
            deviceIds: [otherDev.id],
            confirmed: true,
          },
          dummyActor
        );
      }
    }

    const currentOverview = await adminService.getInventoryOverview();
    const candidates = currentOverview.devices.filter(d => d.status === 'AVAILABLE' && d.stockLocation === srcLoc);
    assert.ok(candidates.length >= 2, `Must have at least 2 available devices in ${srcLoc}`);

    const destLoc = srcLoc === 'محل 1' ? 'محل 2' : 'محل 1';
    const selectedIds = candidates.slice(0, 2).map(d => d.id);

    const res = await adminService.executeInventoryTransfer(
      {
        sourceLocation: srcLoc,
        destinationLocation: destLoc,
        transferType: 'SELECTED',
        deviceIds: selectedIds,
        notes: 'نقل متعدد للأجهزة',
        confirmed: true,
      },
      dummyActor
    );

    assert.equal(res.success, true);
    assert.equal(res.itemCount, 2);

    // Verify company-wide stock is conserved (Rule D: No stock created or destroyed)
    const afterOverview = await adminService.getInventoryOverview();
    const totalCompanyStockAfter = afterOverview.summary.totalCount;
    assert.equal(totalCompanyStockAfter, totalCompanyStockBefore, 'Total company stock must remain unchanged');

    // Verify transferred devices are now at destLoc
    for (const devId of selectedIds) {
      const d = afterOverview.devices.find(dev => dev.id === devId);
      assert.ok(d);
      assert.equal(d.stockLocation, destLoc);
    }
  });

  it('enforces all-or-nothing atomicity when a requested device is ineligible', async () => {
    const overview = await adminService.getInventoryOverview();
    const availableDev = overview.devices.find(d => d.status === 'AVAILABLE');
    const soldDev = overview.devices.find(d => d.status === 'SOLD');
    assert.ok(availableDev, 'Must have an available device');
    assert.ok(soldDev, 'Must have a sold device');

    const devInitialLocation = availableDev.stockLocation;
    const destLoc = devInitialLocation === 'محل 1' ? 'محل 2' : 'محل 1';

    // Attempt transfer with 1 available and 1 sold device
    await assert.rejects(
      async () => {
        await adminService.executeInventoryTransfer(
          {
            sourceLocation: devInitialLocation,
            destinationLocation: destLoc,
            transferType: 'SELECTED',
            deviceIds: [availableDev.id, soldDev.id],
            confirmed: true,
          },
          dummyActor
        );
      },
      /غير متاح|لا يمكن تنفيذ|أجهزة|متواجد في/
    );

    // Verify the available device was NOT transferred (all-or-nothing rollback)
    const after = await adminService.getInventoryOverview();
    const devAfter = after.devices.find(d => d.id === availableDev.id);
    assert.equal(devAfter?.stockLocation, devInitialLocation, 'Device must not move when batch fails');
  });

  it('enforces idempotency protection against duplicate transfer submissions', async () => {
    const key = `idemp_test_${Date.now()}`;
    const overview = await adminService.getInventoryOverview();
    const avail = overview.devices.find(d => d.status === 'AVAILABLE');
    const srcLoc = avail?.stockLocation || 'محل 2';
    const destLoc = srcLoc === 'محل 2' ? 'محل 1' : 'محل 2';

    // Transfer all eligible from srcLoc to destLoc
    const res1 = await adminService.executeInventoryTransfer(
      {
        sourceLocation: srcLoc,
        destinationLocation: destLoc,
        transferType: 'ALL_ELIGIBLE',
        idempotencyKey: key,
        confirmed: true,
      },
      dummyActor
    );
    assert.equal(res1.success, true);

    // Re-send exact same request with same idempotency key
    const res2 = await adminService.executeInventoryTransfer(
      {
        sourceLocation: srcLoc,
        destinationLocation: destLoc,
        transferType: 'ALL_ELIGIBLE',
        idempotencyKey: key,
        confirmed: true,
      },
      dummyActor
    );

    // Must return the exact same transfer record without re-transferring or throwing
    assert.equal(res2.success, true);
    assert.equal(res2.transferId, res1.transferId);
    assert.equal(res2.referenceNumber, res1.referenceNumber);
    assert.equal(res2.itemCount, res1.itemCount);
  });

  it('records complete transfer history, itemized snapshots, and audit trail', async () => {
    const history = await adminService.getTransferHistory();
    assert.ok(history.transfers.length >= 1);

    const latest = history.transfers[0];
    assert.ok(latest.referenceNumber);
    assert.ok(latest.itemCount >= 1);

    // Fetch transfer details with itemized devices
    const details = await adminService.getTransferDetails(latest.id);
    assert.ok(details);
    assert.ok(details.items && details.items.length >= 1);

    const firstItem = details.items[0];
    assert.ok(firstItem.serialNumber);
    assert.ok(firstItem.purchaseCostSnapshot >= 0);
    assert.equal(firstItem.itemStatus, 'COMPLETED');

    // Verify audit logs recorded the transfer
    const auditLogs = await adminService.getAuditLogs(10);
    const transferAudit = auditLogs.find(l => l.eventType === 'INVENTORY_TRANSFER_COMPLETED');
    assert.ok(transferAudit, 'Audit log must record INVENTORY_TRANSFER_COMPLETED');
  });
});
