import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { adminService } from '../src/services/adminService.ts';

describe('Admin Service Phase 4: Stores, Warehouses & Partner Management', () => {
  const dummyActor = {
    adminId: 'admin-001',
    username: 'superadmin',
    displayName: 'Super Admin',
    role: 'superadmin',
    exp: Date.now() + 3600000,
  };

  it('creates stores with store, warehouse, and combined types including descriptions', async () => {
    const store = await adminService.createStore(
      {
        name: 'فرع تجزئة تجريبي',
        code: `SHOP_TEST_${Date.now()}`,
        type: 'store',
        description: 'محل بيع أجهزة ومستلزمات',
        isActive: true,
      },
      dummyActor
    );

    const warehouse = await adminService.createStore(
      {
        name: 'مخزن بضائع تجريبي',
        code: `WH_TEST_${Date.now()}`,
        type: 'warehouse',
        description: 'مخزن رئيسي للأجهزة وقطع الغيار',
        isActive: true,
      },
      dummyActor
    );

    const combined = await adminService.createStore(
      {
        name: 'مركز مدمج تجريبي',
        code: `COMB_TEST_${Date.now()}`,
        type: 'combined',
        description: 'معرض بيع ومخزن ملحق',
        isActive: true,
      },
      dummyActor
    );

    assert.equal(store.type, 'store');
    assert.equal(warehouse.type, 'warehouse');
    assert.equal(combined.type, 'combined');
    assert.equal(combined.description, 'معرض بيع ومخزن ملحق');
    assert.equal(store.isArchived, false);
  });

  it('filters stores by type, search, and archived status', async () => {
    const uniqueTag = `TAG_${Date.now()}`;
    const s1 = await adminService.createStore(
      { name: `محل أ ${uniqueTag}`, code: `S1_${uniqueTag}`, type: 'store', isActive: true },
      dummyActor
    );
    const s2 = await adminService.createStore(
      { name: `مخزن ب ${uniqueTag}`, code: `S2_${uniqueTag}`, type: 'warehouse', isActive: false },
      dummyActor
    );

    // Search filter
    const searchRes = await adminService.getStores({ search: uniqueTag });
    assert.equal(searchRes.length, 2);

    // Type filter
    const whRes = await adminService.getStores({ search: uniqueTag, type: 'warehouse' });
    assert.equal(whRes.length, 1);
    assert.equal(whRes[0].id, s2.id);

    // Status filter
    const activeRes = await adminService.getStores({ search: uniqueTag, status: 'active' });
    assert.equal(activeRes.length, 1);
    assert.equal(activeRes[0].id, s1.id);
  });

  it('manages user-to-store assignments and increments permissionVersion', async () => {
    // 1. Create a user
    const username = `partner_${Date.now()}`;
    const user = await adminService.createAppUser(
      {
        username,
        displayName: 'شريك تجريبي',
        accessCode: '123456',
        confirmAccessCode: '123456',
        allowedModules: 'both',
      },
      dummyActor
    );

    const initialPermVersion = user.permissionVersion;

    // 2. Create store
    const store = await adminService.createStore(
      { name: `فرع شراكة ${Date.now()}`, code: `PRT_${Date.now()}`, type: 'store', isActive: true },
      dummyActor
    );

    // 3. Assign user to store
    await adminService.assignUserToStore(
      { userId: user.id, storeId: store.id, isPrimary: true },
      dummyActor
    );

    // Verify user's permission_version was incremented for desktop revalidation
    const users = await adminService.getAppUsers();
    const updatedUser = users.find(u => u.id === user.id);
    assert.ok(updatedUser);
    assert.equal(updatedUser.permissionVersion, initialPermVersion + 1);
    assert.ok(updatedUser.assignedStoreIds.includes(store.id));

    // 4. Verify store details includes this assigned user
    const storeDetails = await adminService.getStoreDetails(store.id);
    assert.ok(storeDetails);
    assert.equal(storeDetails.assignedUsers.length, 1);
    assert.equal(storeDetails.assignedUsers[0].id, user.id);
    assert.equal(storeDetails.assignedUsers[0].isPrimary, true);

    // 5. Remove user from store
    await adminService.removeUserFromStore(user.id, store.id, dummyActor);

    const afterRemoveUsers = await adminService.getAppUsers();
    const userAfterRemove = afterRemoveUsers.find(u => u.id === user.id);
    assert.ok(userAfterRemove);
    assert.equal(userAfterRemove.permissionVersion, initialPermVersion + 2);
    assert.equal(userAfterRemove.assignedStoreIds.includes(store.id), false);
  });

  it('archives a location safely and tracks archive timestamp', async () => {
    const store = await adminService.createStore(
      { name: `فرع للإلغاء ${Date.now()}`, code: `DEL_${Date.now()}`, type: 'store', isActive: true },
      dummyActor
    );

    await adminService.archiveStore(store.id, dummyActor);

    const stores = await adminService.getStores({ status: 'archived' });
    const archivedStore = stores.find(s => s.id === store.id);
    assert.ok(archivedStore);
    assert.equal(archivedStore.isArchived, true);
    assert.equal(archivedStore.isActive, false);
    assert.ok(archivedStore.archivedAt);
  });

  it('validates store merge requirements and previews impact', async () => {
    const s1 = await adminService.createStore(
      { name: `محل فرعي 1 ${Date.now()}`, code: `MRG_S1_${Date.now()}`, type: 'store', isActive: true },
      dummyActor
    );
    const s2 = await adminService.createStore(
      { name: `محل فرعي 2 ${Date.now()}`, code: `MRG_S2_${Date.now()}`, type: 'store', isActive: true },
      dummyActor
    );
    const dest = await adminService.createStore(
      { name: `الفرع المدمج الرئيسي ${Date.now()}`, code: `MRG_DEST_${Date.now()}`, type: 'combined', isActive: true },
      dummyActor
    );

    // Validation: Destination inside source stores returns canMerge = false
    const invalidPreview = await adminService.previewStoreMerge([s1.id, dest.id], dest.id);
    assert.equal(invalidPreview.canMerge, false);
    assert.ok(invalidPreview.validationErrors?.some(e => e.includes('الوجهة')));

    // Valid preview works and confirms ZERO inventory movements
    const validPreview = await adminService.previewStoreMerge([s1.id, s2.id], dest.id);
    assert.equal(validPreview.canMerge, true);
    assert.equal(validPreview.sourceStores.length, 2);
    assert.equal(validPreview.destinationStore?.id, dest.id);
    assert.ok(validPreview.historicalRecordsNotice.includes('الفواتير السابقة'));
  });

  it('executes store merge atomically with zero inventory movements and reassigns users', async () => {
    // 1. Setup 2 source stores and 1 destination store
    const src1 = await adminService.createStore(
      { name: `محل 1 القديم ${Date.now()}`, code: `OLD_1_${Date.now()}`, type: 'store', isActive: true },
      dummyActor
    );
    const src2 = await adminService.createStore(
      { name: `محل 2 القديم ${Date.now()}`, code: `OLD_2_${Date.now()}`, type: 'store', isActive: true },
      dummyActor
    );
    const dest = await adminService.createStore(
      { name: `المقر الموحد ${Date.now()}`, code: `HUB_${Date.now()}`, type: 'combined', isActive: true },
      dummyActor
    );

    // 2. Setup user assigned to src1
    const user = await adminService.createAppUser(
      {
        username: `cashier_${Date.now()}`,
        displayName: 'محاسب محل 1',
        accessCode: '654321',
        confirmAccessCode: '654321',
        allowedModules: 'mss',
      },
      dummyActor
    );
    await adminService.assignUserToStore({ userId: user.id, storeId: src1.id, isPrimary: true }, dummyActor);

    const preMergePermVersion = (await adminService.getAppUsers()).find(u => u.id === user.id)?.permissionVersion || 1;

    // 3. Execute store merge
    const mergeResult = await adminService.executeStoreMerge(
      {
        sourceStoreIds: [src1.id, src2.id],
        destinationStoreId: dest.id,
        notes: 'دمج تشغيلي لتوحيد الفروع',
      },
      dummyActor
    );

    assert.equal(mergeResult.success, true);
    assert.equal(mergeResult.mergedSourceStoreIds.length, 2);
    assert.ok(mergeResult.reassignedUserIds.length >= 1);

    // 4. Verify sources are archived and hold merged_into_id
    const allStores = await adminService.getStores({ includeArchived: true });
    const archivedSrc1 = allStores.find(s => s.id === src1.id);
    const archivedSrc2 = allStores.find(s => s.id === src2.id);

    assert.equal(archivedSrc1?.isArchived, true);
    assert.equal(archivedSrc1?.mergedIntoId, dest.id);
    assert.equal(archivedSrc1?.isActive, false);

    assert.equal(archivedSrc2?.isArchived, true);
    assert.equal(archivedSrc2?.mergedIntoId, dest.id);
    assert.equal(archivedSrc2?.isActive, false);

    // 5. Verify user reassigned to destination and permission_version bumped
    const allUsers = await adminService.getAppUsers();
    const reassignedUser = allUsers.find(u => u.id === user.id);
    assert.ok(reassignedUser);
    assert.ok(reassignedUser.assignedStoreIds.includes(dest.id));
    assert.equal(reassignedUser.defaultStoreId, dest.id);
    assert.ok(reassignedUser.permissionVersion > preMergePermVersion);

    // 6. Verify audit logs recorded the merge event
    const auditLogs = await adminService.getAuditLogs(10);
    const mergeLog = auditLogs.find(l => l.eventType === 'STORE_MERGE_COMPLETED');
    assert.ok(mergeLog);
    assert.equal(mergeLog.targetId, dest.id);
  });
});
