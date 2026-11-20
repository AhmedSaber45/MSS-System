import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { adminService } from '../src/services/adminService.ts';

describe('Admin Service Phase 6: Permission-Based Overview Statistics & Data Isolation', () => {
  const dummyActor = {
    adminId: 'admin-001',
    username: 'superadmin',
    displayName: 'Super Admin',
    role: 'superadmin',
    exp: Date.now() + 3600000,
  };

  describe('1. Accessories-Only Scope Overview Data Isolation', () => {
    it('returns accessories-only metrics and strictly hides all Compu MSS metrics and components', async () => {
      const stats = await adminService.getOverviewStats('accessories');

      assert.equal(stats.moduleScope, 'accessories');
      assert.ok(stats.accessoriesMetrics, 'accessoriesMetrics must be defined');
      assert.equal(stats.mssMetrics, undefined, 'mssMetrics must be strictly undefined for Accessories-only scope');
      assert.equal(stats.totalWarehouses, 0, 'Warehouses must be 0 for Accessories-only users (stores only)');
      
      // Breakdown assertions
      assert.equal(stats.modulesBreakdown.mssOnly, 0, 'MSS user count in breakdown must be 0');
      assert.ok(stats.modulesBreakdown.accessoriesOnly >= 0, 'Accessories user count must be non-negative');

      // Verify audit logs isolation: no MSS events or device/transfer actions
      for (const log of stats.recentAuditLogs) {
        const action = (log.eventType || '').toUpperCase();
        const target = (log.targetType || '').toLowerCase();
        assert.ok(
          !action.includes('TRANSFER') && !action.includes('DEVICE') && target !== 'inventory',
          `Audit log "${log.eventType}" from Compu MSS should not be exposed to Accessories-only user`
        );
      }
    });
  });

  describe('2. Compu MSS-Only Scope Overview Data Isolation', () => {
    it('returns Compu MSS-only metrics and strictly hides all Accessories metrics and components', async () => {
      const stats = await adminService.getOverviewStats('mss');

      assert.equal(stats.moduleScope, 'mss');
      assert.ok(stats.mssMetrics, 'mssMetrics must be defined');
      assert.equal(stats.accessoriesMetrics, undefined, 'accessoriesMetrics must be strictly undefined for MSS-only scope');
      
      // MSS metrics details
      assert.ok(typeof stats.mssMetrics.availableDevices === 'number');
      assert.ok(typeof stats.mssMetrics.modelsCount === 'number');
      assert.ok(typeof stats.mssMetrics.totalLocations === 'number' || typeof stats.mssMetrics.totalStores === 'number');

      // Breakdown assertions
      assert.equal(stats.modulesBreakdown.accessoriesOnly, 0, 'Accessories user count in breakdown must be 0');
      assert.ok(stats.modulesBreakdown.mssOnly >= 0, 'MSS user count must be non-negative');

      // Verify audit logs isolation: no accessories events
      for (const log of stats.recentAuditLogs) {
        const action = (log.eventType || '').toUpperCase();
        assert.ok(
          !action.includes('ACCESSORIES'),
          `Audit log "${log.eventType}" from Accessories should not be exposed to MSS-only user`
        );
      }
    });
  });

  describe('3. Users with Access to Both Modules', () => {
    it('preserves combined overview metrics for both Accessories and Compu MSS', async () => {
      const stats = await adminService.getOverviewStats('both');

      assert.equal(stats.moduleScope, 'both');
      assert.ok(stats.accessoriesMetrics, 'accessoriesMetrics must be defined for users with both permissions');
      assert.ok(stats.mssMetrics, 'mssMetrics must be defined for users with both permissions');
      assert.ok(stats.totalAppUsers >= 0);
      assert.ok(stats.totalStores >= 0);
      assert.ok(stats.modulesBreakdown.both >= 0);
    });
  });

  describe('4. Users with No Module Permissions', () => {
    it('returns empty/zero metrics and exposes no module-specific data', async () => {
      const stats = await adminService.getOverviewStats('none');

      assert.equal(stats.moduleScope, 'none');
      assert.equal(stats.totalAppUsers, 0);
      assert.equal(stats.activeAppUsers, 0);
      assert.equal(stats.totalStores, 0);
      assert.equal(stats.totalWarehouses, 0);
      assert.equal(stats.accessoriesMetrics, undefined);
      assert.equal(stats.mssMetrics, undefined);
      assert.equal(stats.recentAuditLogs.length, 0);
      assert.deepEqual(stats.modulesBreakdown, {
        accessoriesOnly: 0,
        mssOnly: 0,
        both: 0,
      });
    });
  });

  describe('5. Dynamic Permission Changes & Real-Time Resolution', () => {
    it('resolves updated effective permissions immediately from the source of truth', async () => {
      // Create user with accessories permission
      const username = `dyn_perm_${Date.now()}`;
      const user = await adminService.createAppUser(
        {
          username,
          displayName: 'مستخدم الصلاحيات المتغيرة',
          accessCode: 'perm1234',
          confirmAccessCode: 'perm1234',
          allowedModules: 'accessories',
        },
        dummyActor
      );

      // Verify effective permission is 'accessories'
      const perm1 = await adminService.getUserEffectiveModulePermission(user.id, 'user');
      assert.equal(perm1, 'accessories');

      // Change permission to 'mss'
      await adminService.updateAppUser(
        {
          id: user.id,
          allowedModules: 'mss',
        },
        dummyActor
      );

      // Verify effective permission immediately reflects 'mss'
      const perm2 = await adminService.getUserEffectiveModulePermission(user.id, 'user');
      assert.equal(perm2, 'mss');

      // Fetch overview using this user's effective permission
      const mssStats = await adminService.getOverviewStats(perm2);
      assert.equal(mssStats.moduleScope, 'mss');
      assert.equal(mssStats.accessoriesMetrics, undefined);
      assert.ok(mssStats.mssMetrics);

      // Change permission to 'both'
      await adminService.updateAppUser(
        {
          id: user.id,
          allowedModules: 'both',
        },
        dummyActor
      );

      const perm3 = await adminService.getUserEffectiveModulePermission(user.id, 'user');
      assert.equal(perm3, 'both');
      const bothStats = await adminService.getOverviewStats(perm3);
      assert.equal(bothStats.moduleScope, 'both');
      assert.ok(bothStats.accessoriesMetrics);
      assert.ok(bothStats.mssMetrics);
    });
  });

  describe('6. Super Admin Privilege Preservation', () => {
    it('always resolves superadmin to both modules by default', async () => {
      const superadminPerm = await adminService.getUserEffectiveModulePermission('superadmin-id', 'superadmin');
      assert.equal(superadminPerm, 'both');
    });
  });
});
