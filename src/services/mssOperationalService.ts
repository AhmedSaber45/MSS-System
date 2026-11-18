import { supabase } from '../lib/supabase';
import type {
  SystemStore,
  StoreType,
  CreateStoreInput,
  UpdateStoreInput,
  AssignUserToStoreInput,
  StoreMergeImpactPreview,
  ExecuteStoreMergeInput,
  StoreMergeResult,
  AdminAuditLog,
  AuditTargetType,
  InventoryTransfer,
  InventoryTransferItem,
  TransferPreviewRequest,
  TransferPreviewResponse,
  ExecuteTransferRequest,
  ExecuteTransferResult,
} from '../types/mssOperational';
import { mssInventoryService } from './mssInventoryService';
import { mssCatalogService } from './mssCatalogService';

const STORES_CACHE_KEY = 'shop_mss_stores_cache_v1';
const AUDIT_CACHE_KEY = 'shop_mss_audit_cache_v1';
const TRANSFERS_CACHE_KEY = 'shop_mss_transfers_cache_v1';

// Initial seed stores for offline preview
const DEFAULT_SEED_STORES: SystemStore[] = [
  {
    id: 'store-00000000-0000-0000-0000-000000000001',
    code: 'SH01',
    name: 'محل 1',
    type: 'store',
    description: 'الفرع الرئيسي - المبيعات والأجهزة',
    address: 'القاهرة - وسط البلد',
    phone: '01030137635',
    isActive: true,
    isArchived: false,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    deviceCount: 0,
    assignedUsersCount: 1,
  },
  {
    id: 'store-00000000-0000-0000-0000-000000000002',
    code: 'SH02',
    name: 'محل 2',
    type: 'store',
    description: 'الفرع الثاني - صالة العرض والمخزن',
    address: 'الجيزة - الدقي',
    phone: '01030137636',
    isActive: true,
    isArchived: false,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    deviceCount: 0,
    assignedUsersCount: 1,
  },
  {
    id: 'store-00000000-0000-0000-0000-000000000003',
    code: 'WH01',
    name: 'المخزن المركزي',
    type: 'warehouse',
    description: 'مستودع الأجهزة الواردة والشاشات',
    address: 'مدينة نصر - المنطقة الصناعية',
    phone: '01030137637',
    isActive: true,
    isArchived: false,
    createdAt: '2024-02-01T00:00:00Z',
    updatedAt: '2024-02-01T00:00:00Z',
    deviceCount: 0,
    assignedUsersCount: 1,
  },
];

function getCachedStores(): SystemStore[] {
  try {
    const raw = localStorage.getItem(STORES_CACHE_KEY);
    if (!raw) {
      localStorage.setItem(STORES_CACHE_KEY, JSON.stringify(DEFAULT_SEED_STORES));
      return DEFAULT_SEED_STORES;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_SEED_STORES;
  } catch {
    return DEFAULT_SEED_STORES;
  }
}

function saveCachedStores(stores: SystemStore[]): void {
  try {
    localStorage.setItem(STORES_CACHE_KEY, JSON.stringify(stores));
  } catch {
    // Non-blocking
  }
}

export const mssOperationalService = {
  // ==========================================================================
  // 1. STORES & WAREHOUSES
  // ==========================================================================

  async getStores(options?: {
    search?: string;
    type?: StoreType;
    status?: string;
    includeArchived?: boolean;
  }): Promise<SystemStore[]> {
    let stores: SystemStore[] = [];
    let isCloudFetched = false;

    try {
      let query = supabase.from('system_stores').select('*').order('created_at', { ascending: false });

      if (options?.includeArchived === false) {
        query = query.eq('is_archived', false);
      }

      const { data, error } = await query;
      if (!error && Array.isArray(data) && data.length > 0) {
        stores = data.map((row: any) => ({
          id: row.id,
          code: row.code,
          name: row.name,
          type: row.type as StoreType,
          description: row.description || undefined,
          address: row.address || undefined,
          phone: row.phone || undefined,
          isActive: Boolean(row.is_active),
          isArchived: Boolean(row.is_archived),
          archivedAt: row.archived_at || undefined,
          mergedIntoId: row.merged_into_id || undefined,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        }));
        saveCachedStores(stores);
        isCloudFetched = true;
      }
    } catch (err) {
      console.warn('Failed to fetch stores from Supabase, using cache:', err);
    }

    if (!isCloudFetched) {
      stores = getCachedStores();
    }

    // Apply client filters
    if (options?.search && options.search.trim()) {
      const q = options.search.trim().toLowerCase();
      stores = stores.filter(
        s =>
          s.name.toLowerCase().includes(q) ||
          s.code.toLowerCase().includes(q) ||
          (s.address && s.address.toLowerCase().includes(q)) ||
          (s.phone && s.phone.includes(q))
      );
    }

    if (options?.type && (options.type as string) !== 'all') {
      stores = stores.filter(s => s.type === options.type);
    }

    if (options?.status && options.status !== 'all') {
      if (options.status === 'active') {
        stores = stores.filter(s => s.isActive && !s.isArchived);
      } else if (options.status === 'inactive') {
        stores = stores.filter(s => !s.isActive && !s.isArchived);
      } else if (options.status === 'archived') {
        stores = stores.filter(s => s.isArchived);
      }
    }

    return stores;
  },

  async getStoreDetails(storeId: string): Promise<SystemStore | null> {
    const stores = await this.getStores({ includeArchived: true });
    const store = stores.find(s => s.id === storeId);
    if (!store) return null;

    // Fetch assigned users from user_store_assignments
    try {
      const { data: assignments, error } = await supabase
        .from('user_store_assignments')
        .select('user_id, is_primary, assigned_at, app_users:user_id(id, username, display_name, allowed_modules)')
        .eq('store_id', storeId);

      if (!error && Array.isArray(assignments)) {
        store.assignedUsers = assignments.map((row: any) => ({
          id: row.app_users?.id || row.user_id,
          username: row.app_users?.username || 'مستخدم',
          displayName: row.app_users?.display_name || 'موظف',
          allowedModules: row.app_users?.allowed_modules || 'both',
          isPrimary: Boolean(row.is_primary),
          assignedAt: row.assigned_at,
        }));
        store.assignedUsersCount = store.assignedUsers.length;
      }
    } catch {
      // Offline fallback
    }

    // Count physical devices currently stored in this location
    try {
      const devices = await mssInventoryService.getDevices();
      store.deviceCount = devices.filter(
        d => d.stock_location === store.name || d.stock_location === store.code
      ).length;
    } catch {
      store.deviceCount = 0;
    }

    return store;
  },

  async createStore(
    input: CreateStoreInput,
    actor: { id: string; username: string }
  ): Promise<SystemStore> {
    const code = input.code.trim().toUpperCase();
    const name = input.name.trim();

    if (!code) throw new Error('رمز الفرع/المخزن مطلوب (Code)');
    if (!name) throw new Error('اسم الفرع/المخزن مطلوب (Name)');

    const newStore: SystemStore = {
      id: `store-${Date.now()}`,
      code,
      name,
      type: input.type || 'store',
      description: input.description?.trim() || undefined,
      address: input.address?.trim() || undefined,
      phone: input.phone?.trim() || undefined,
      isActive: input.isActive ?? true,
      isArchived: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deviceCount: 0,
      assignedUsersCount: 0,
    };

    try {
      const { data, error } = await supabase
        .from('system_stores')
        .insert({
          code: newStore.code,
          name: newStore.name,
          type: newStore.type,
          description: newStore.description || null,
          address: newStore.address || null,
          phone: newStore.phone || null,
          is_active: newStore.isActive,
        })
        .select()
        .single();

      if (!error && data) {
        newStore.id = data.id;
        newStore.createdAt = data.created_at;
        newStore.updatedAt = data.updated_at;
      }
    } catch (err: any) {
      console.warn('Supabase store insert failed, stored in local cache:', err);
    }

    const cached = getCachedStores();
    cached.unshift(newStore);
    saveCachedStores(cached);

    await this.logAudit({
      actorId: actor.id,
      actorUsername: actor.username,
      eventType: 'STORE_CREATE',
      targetType: 'store',
      targetId: newStore.id,
      metadata: { code: newStore.code, name: newStore.name, type: newStore.type },
    });

    return newStore;
  },

  async updateStore(
    input: UpdateStoreInput,
    actor: { id: string; username: string }
  ): Promise<SystemStore> {
    const cached = getCachedStores();
    const index = cached.findIndex(s => s.id === input.id);
    if (index < 0) throw new Error('الفرع أو المخزن غير موجود');

    const current = cached[index];
    const updated: SystemStore = {
      ...current,
      name: input.name?.trim() || current.name,
      type: input.type || current.type,
      description: input.description !== undefined ? input.description.trim() || undefined : current.description,
      address: input.address !== undefined ? input.address.trim() || undefined : current.address,
      phone: input.phone !== undefined ? input.phone.trim() || undefined : current.phone,
      isActive: input.isActive !== undefined ? input.isActive : current.isActive,
      isArchived: input.isArchived !== undefined ? input.isArchived : current.isArchived,
      updatedAt: new Date().toISOString(),
    };

    try {
      await supabase
        .from('system_stores')
        .update({
          name: updated.name,
          type: updated.type,
          description: updated.description || null,
          address: updated.address || null,
          phone: updated.phone || null,
          is_active: updated.isActive,
          is_archived: updated.isArchived,
          updated_at: updated.updatedAt,
        })
        .eq('id', input.id);
    } catch (err) {
      console.warn('Supabase store update failed, cached locally:', err);
    }

    cached[index] = updated;
    saveCachedStores(cached);

    await this.logAudit({
      actorId: actor.id,
      actorUsername: actor.username,
      eventType: 'STORE_UPDATE',
      targetType: 'store',
      targetId: updated.id,
      metadata: { name: updated.name, type: updated.type, isActive: updated.isActive },
    });

    return updated;
  },

  async toggleStoreStatus(
    storeId: string,
    isActive: boolean,
    actor: { id: string; username: string }
  ): Promise<void> {
    await this.updateStore({ id: storeId, isActive }, actor);
  },

  async archiveStore(
    storeId: string,
    actor: { id: string; username: string }
  ): Promise<void> {
    const nowIso = new Date().toISOString();
    try {
      await supabase
        .from('system_stores')
        .update({
          is_archived: true,
          is_active: false,
          archived_at: nowIso,
          updated_at: nowIso,
        })
        .eq('id', storeId);
    } catch {
      // Fallback handled
    }

    const cached = getCachedStores();
    const st = cached.find(s => s.id === storeId);
    if (st) {
      st.isArchived = true;
      st.isActive = false;
      st.archivedAt = nowIso;
      saveCachedStores(cached);
    }

    await this.logAudit({
      actorId: actor.id,
      actorUsername: actor.username,
      eventType: 'STORE_STATUS_CHANGE',
      targetType: 'store',
      targetId: storeId,
      metadata: { action: 'ARCHIVE', isArchived: true },
    });
  },

  async assignUserToStore(
    input: AssignUserToStoreInput,
    actor: { id: string; username: string }
  ): Promise<void> {
    try {
      await supabase.from('user_store_assignments').upsert({
        user_id: input.userId,
        store_id: input.storeId,
        is_primary: Boolean(input.isPrimary),
        assigned_at: new Date().toISOString(),
      });
    } catch (err: any) {
      console.warn('Assign user to store Supabase error:', err);
    }

    await this.logAudit({
      actorId: actor.id,
      actorUsername: actor.username,
      eventType: 'USER_UPDATE',
      targetType: 'store',
      targetId: input.storeId,
      metadata: { action: 'ASSIGN_USER', userId: input.userId, isPrimary: input.isPrimary },
    });
  },

  async removeUserFromStore(
    storeId: string,
    userId: string,
    actor: { id: string; username: string }
  ): Promise<void> {
    try {
      await supabase
        .from('user_store_assignments')
        .delete()
        .eq('store_id', storeId)
        .eq('user_id', userId);
    } catch (err: any) {
      console.warn('Remove user from store Supabase error:', err);
    }

    await this.logAudit({
      actorId: actor.id,
      actorUsername: actor.username,
      eventType: 'USER_UPDATE',
      targetType: 'store',
      targetId: storeId,
      metadata: { action: 'REMOVE_USER', userId },
    });
  },

  async previewStoreMerge(
    sourceStoreIds: string[],
    destinationStoreId: string
  ): Promise<StoreMergeImpactPreview> {
    const stores = await this.getStores({ includeArchived: true });
    const sourceStores = stores.filter(s => sourceStoreIds.includes(s.id));
    const destinationStore = stores.find(s => s.id === destinationStoreId);

    const validationErrors: string[] = [];
    if (sourceStores.length === 0) {
      validationErrors.push('يجب تحديد فرع أو مخزن واحد على الأقل للدمج');
    }
    if (sourceStoreIds.includes(destinationStoreId)) {
      validationErrors.push('لا يمكن دمج الفرع في نفسه أو اختياره كفرع مصدر ووجهة في آن واحد');
    }
    if (destinationStore?.isArchived) {
      validationErrors.push('الفرع الوجهة مؤرشف، لا يمكن الدمج في فرع مؤرشف');
    }

    const devices = await mssInventoryService.getDevices();
    const inventorySummary = sourceStores.map(s => {
      const count = devices.filter(
        d => d.stock_location === s.name || d.stock_location === s.code
      ).length;
      return {
        storeId: s.id,
        storeName: s.name,
        storeCode: s.code,
        deviceCount: count,
        notice: 'تظل الأجهزة مرتبطة بهذا الموقع بأمان دون أي نقل للمخزون أو تعديل فواتير',
      };
    });

    return {
      sourceStores,
      destinationStore,
      affectedUsers: [],
      inventorySummary,
      historicalRecordsNotice:
        'وفقاً لقواعد النظام (Rule A & B): الأجهزة والعمليات المالية تظل منسوبة تاريخياً للفروع المصدر، وعملية الدمج تعيد تعيين الموظفين والشركاء فقط وتؤرشف الفرع المصدر.',
      canMerge: validationErrors.length === 0,
      validationErrors: validationErrors.length > 0 ? validationErrors : undefined,
    };
  },

  async executeStoreMerge(
    input: ExecuteStoreMergeInput,
    actor: { id: string; username: string }
  ): Promise<StoreMergeResult> {
    const { sourceStoreIds, destinationStoreId, newDestination, notes } = input;

    if (!sourceStoreIds || sourceStoreIds.length === 0) {
      throw new Error('يجب تحديد فرع أو مخزن واحد على الأقل للدمج');
    }

    let targetDest: SystemStore;
    if (newDestination) {
      targetDest = await this.createStore(newDestination, actor);
    } else if (destinationStoreId) {
      const stores = await this.getStores({ includeArchived: true });
      const found = stores.find(s => s.id === destinationStoreId);
      if (!found) throw new Error('الفرع الوجهة غير موجود');
      targetDest = found;
    } else {
      throw new Error('يجب تحديد فرع وجهة للدمج');
    }

    // Call atomic stored procedure execute_store_merge
    try {
      const { data: rpcRes, error: rpcErr } = await supabase.rpc('execute_store_merge', {
        p_source_store_ids: sourceStoreIds,
        p_destination_store_id: targetDest.id,
        p_admin_id: actor.id,
        p_admin_username: actor.username,
        p_notes: notes || null,
      });

      if (rpcErr) {
        throw new Error(rpcErr.message);
      }
    } catch (err: any) {
      console.warn('execute_store_merge RPC error:', err);
    }

    // Soft-archive source stores in local cache
    const nowIso = new Date().toISOString();
    const cached = getCachedStores();
    for (const srcId of sourceStoreIds) {
      const st = cached.find(s => s.id === srcId);
      if (st) {
        st.isArchived = true;
        st.isActive = false;
        st.archivedAt = nowIso;
        st.mergedIntoId = targetDest.id;
        st.mergedIntoName = targetDest.name;
        st.updatedAt = nowIso;
      }
    }
    saveCachedStores(cached);

    await this.logAudit({
      actorId: actor.id,
      actorUsername: actor.username,
      eventType: 'STORE_STATUS_CHANGE',
      targetType: 'store',
      targetId: targetDest.id,
      metadata: {
        action: 'MERGE_STORES',
        mergedSourceStoreIds: sourceStoreIds,
        destinationStoreId: targetDest.id,
      },
    });

    return {
      success: true,
      mergeId: `mrg-${Date.now()}`,
      destinationStore: targetDest,
      mergedSourceStoreIds: sourceStoreIds,
      reassignedUserIds: [],
      message: `تم دمج ${sourceStoreIds.length} فرع/مخزن في (${targetDest.name}) بنجاح مع الحفاظ الكامل على المخزون والسجلات التاريخية.`,
    };
  },

  // ==========================================================================
  // 2. INVENTORY TRANSFERS
  // ==========================================================================

  async previewInventoryTransfer(req: TransferPreviewRequest): Promise<TransferPreviewResponse> {
    const cleanSource = req.sourceLocation?.trim();
    const cleanDest = req.destinationLocation?.trim();
    const validationErrors: string[] = [];

    if (!cleanSource) validationErrors.push('يجب تحديد موقع المصدر');
    if (!cleanDest) validationErrors.push('يجب تحديد موقع الوجهة');
    if (cleanSource && cleanDest && cleanSource === cleanDest) {
      validationErrors.push('لا يمكن نقل المخزون إلى نفس الموقع الحالي');
    }

    const allDevices = await mssInventoryService.getDevices();
    const models = await mssCatalogService.getModels();
    const modelMap = new Map(models.map(m => [m.id, m]));

    const sourceDevices = allDevices.filter(d => d.stock_location === cleanSource);

    let candidates: typeof allDevices = [];
    if (req.transferType === 'INDIVIDUAL' || req.transferType === 'SELECTED') {
      const requestedIds = req.deviceIds || [];
      if (requestedIds.length === 0) {
        validationErrors.push('يجب تحديد جهاز واحد على الأقل للنقل');
      }
      for (const reqId of requestedIds) {
        const found = allDevices.find(d => d.id === reqId || d.serial_number === reqId);
        if (!found) {
          validationErrors.push(`الجهاز بالمعرف أو السيريال (${reqId}) غير موجود في النظام`);
        } else if (found.stock_location !== cleanSource) {
          validationErrors.push(
            `الجهاز بالسيريال (${found.serial_number}) متواجد في (${found.stock_location}) وليس في موقع المصدر المحدد (${cleanSource})`
          );
        } else {
          candidates.push(found);
        }
      }
    } else if (req.transferType === 'MODEL_GROUP') {
      if (!req.modelId) {
        validationErrors.push('يجب تحديد الموديل المراد نقل أجهزته');
      } else {
        candidates = sourceDevices.filter(d => d.model_id === req.modelId);
      }
    } else if (req.transferType === 'ALL_ELIGIBLE') {
      candidates = sourceDevices;
    }

    const eligibleDevices: TransferPreviewResponse['eligibleDevices'] = [];
    const ineligibleDevices: TransferPreviewResponse['ineligibleDevices'] = [];

    for (const d of candidates) {
      const m = modelMap.get(d.model_id);
      const devName = d.model_name || m?.model_name || 'جهاز لابتوب';
      const devBrand = d.brand || m?.brand || '';

      if (d.status === 'AVAILABLE') {
        eligibleDevices.push({
          id: d.id,
          serial_number: d.serial_number,
          model_name: devName,
          brand: devBrand,
          purchase_cost: d.purchase_cost,
          stock_location: d.stock_location,
          status: d.status,
        });
      } else {
        let reason = 'الجهاز غير متاح للنقل';
        if (d.status === 'SOLD') reason = 'الجهاز تم بيعه وتسجيل فاتورته';
        if (d.status === 'RESERVED') reason = 'الجهاز محجوز لعميل حالياً';
        if (d.status === 'MAINTENANCE') reason = 'الجهاز قيد الصيانة';
        if (d.status === 'RETURNED') reason = 'الجهاز مرتجع قيد الفحص';

        ineligibleDevices.push({
          id: d.id,
          serial_number: d.serial_number,
          model_name: devName,
          brand: devBrand,
          stock_location: d.stock_location,
          status: d.status,
          reason,
        });
      }
    }

    // All-or-Nothing policy for individual / selected items
    if (
      (req.transferType === 'INDIVIDUAL' || req.transferType === 'SELECTED') &&
      ineligibleDevices.length > 0
    ) {
      validationErrors.push(
        `لا يمكن تنفيذ النقل لأن بعض الأجهزة المحددة (${ineligibleDevices.map(d => d.serial_number).join(', ')}) غير متاحة للتحويل`
      );
    }

    if (eligibleDevices.length === 0 && validationErrors.length === 0) {
      validationErrors.push(`لا توجد أجهزة مؤهلة ومتاحة للنقل في الموقع (${cleanSource})`);
    }

    const totalEligibleCost = eligibleDevices.reduce((sum, d) => sum + d.purchase_cost, 0);

    return {
      canTransfer: validationErrors.length === 0 && eligibleDevices.length > 0,
      sourceLocation: cleanSource || '',
      destinationLocation: cleanDest || '',
      transferType: req.transferType,
      eligibleDevices,
      ineligibleDevices,
      totalEligibleCount: eligibleDevices.length,
      totalIneligibleCount: ineligibleDevices.length,
      totalEligibleCost,
      validationErrors: validationErrors.length > 0 ? validationErrors : undefined,
      historicalNotice:
        'عملية النقل تحدث الموقع التشغيلي للأجهزة فقط، ولا تؤثر إطلاقاً على تكاليف الشراء الأصلية أو فواتير المبيعات أو الأرباح السابقة.',
    };
  },

  async executeInventoryTransfer(
    req: ExecuteTransferRequest,
    actor: { id: string; username: string }
  ): Promise<ExecuteTransferResult> {
    const cleanSource = req.sourceLocation?.trim();
    const cleanDest = req.destinationLocation?.trim();

    if (!cleanSource || !cleanDest) {
      throw new Error('موقع المصدر وموقع الوجهة مطلوبان');
    }
    if (cleanSource === cleanDest) {
      throw new Error('لا يمكن نقل المخزون إلى نفس الموقع الحالي');
    }

    const preview = await this.previewInventoryTransfer(req);
    if (!preview.canTransfer || preview.eligibleDevices.length === 0) {
      throw new Error(
        preview.validationErrors?.join(' • ') || 'لا توجد أجهزة مؤهلة للتحويل'
      );
    }

    const nowIso = new Date().toISOString();
    const datePrefix = nowIso.slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    const generatedRef = `TRF-${datePrefix}-${randomSuffix}`;
    const idempotencyKey = req.idempotencyKey || `trf_key_${Date.now()}_${randomSuffix}`;

    // 1. Attempt Atomic Supabase RPC execution
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('execute_inventory_transfer', {
        p_source_location: cleanSource,
        p_destination_location: cleanDest,
        p_transfer_type: req.transferType,
        p_device_ids: preview.eligibleDevices.map(d => d.id),
        p_model_id: req.modelId || null,
        p_all_eligible: req.allEligible || false,
        p_notes: req.notes || null,
        p_admin_id: actor.id,
        p_admin_username: actor.username,
        p_idempotency_key: idempotencyKey,
      });

      if (!rpcError && rpcData && rpcData.length > 0) {
        const row = rpcData[0];
        // Refresh devices and movements in local cache
        for (const dev of preview.eligibleDevices) {
          try {
            await mssInventoryService.transferDevice({
              device_id: dev.id,
              to_location: cleanDest as any,
              notes: req.notes || `تحويل دفعي رقم ${row.reference_number}`,
            });
          } catch {
            // Non-critical local update
          }
        }

        await this.logAudit({
          actorId: actor.id,
          actorUsername: actor.username,
          eventType: 'INVENTORY_TRANSFER_COMPLETED',
          targetType: 'inventory',
          targetId: row.transfer_id,
          metadata: {
            referenceNumber: row.reference_number,
            sourceLocation: cleanSource,
            destinationLocation: cleanDest,
            itemCount: row.item_count,
            totalCost: Number(row.total_cost),
          },
        });

        return {
          success: true,
          transferId: row.transfer_id,
          referenceNumber: row.reference_number,
          itemCount: row.item_count,
          totalCost: Number(row.total_cost),
          sourceLocation: cleanSource,
          destinationLocation: cleanDest,
          transferredAt: nowIso,
          message: `تم تحويل ${row.item_count} جهاز بنجاح من (${cleanSource}) إلى (${cleanDest})`,
        };
      }
    } catch (err) {
      console.warn('execute_inventory_transfer RPC failed, using service fallback:', err);
    }

    // 2. Client-side sequential fallback if RPC unavailable
    let transferredCount = 0;
    for (const dev of preview.eligibleDevices) {
      try {
        await mssInventoryService.transferDevice({
          device_id: dev.id,
          to_location: cleanDest as any,
          notes: req.notes || `تحويل دفعي رقم ${generatedRef}`,
        });
        transferredCount++;
      } catch (err: any) {
        console.warn(`Failed to transfer device ${dev.serial_number}:`, err);
      }
    }

    // Record local transfer record
    const localTransfer: InventoryTransfer = {
      id: `trf-${Date.now()}`,
      referenceNumber: generatedRef,
      sourceLocation: cleanSource,
      destinationLocation: cleanDest,
      transferType: req.transferType,
      status: 'COMPLETED',
      itemCount: transferredCount,
      totalCost: preview.totalEligibleCost,
      notes: req.notes,
      idempotencyKey,
      createdByAdminId: actor.id,
      createdByUsername: actor.username,
      createdAt: nowIso,
      completedAt: nowIso,
    };

    try {
      const raw = localStorage.getItem(TRANSFERS_CACHE_KEY);
      const list: InventoryTransfer[] = raw ? JSON.parse(raw) : [];
      list.unshift(localTransfer);
      localStorage.setItem(TRANSFERS_CACHE_KEY, JSON.stringify(list));
    } catch {
      // Non-blocking
    }

    await this.logAudit({
      actorId: actor.id,
      actorUsername: actor.username,
      eventType: 'INVENTORY_TRANSFER_COMPLETED',
      targetType: 'inventory',
      targetId: localTransfer.id,
      metadata: {
        referenceNumber: localTransfer.referenceNumber,
        sourceLocation: cleanSource,
        destinationLocation: cleanDest,
        itemCount: localTransfer.itemCount,
        totalCost: localTransfer.totalCost,
      },
    });

    return {
      success: true,
      transferId: localTransfer.id,
      referenceNumber: localTransfer.referenceNumber,
      itemCount: localTransfer.itemCount,
      totalCost: localTransfer.totalCost,
      sourceLocation: cleanSource,
      destinationLocation: cleanDest,
      transferredAt: nowIso,
      message: `تم تحويل ${localTransfer.itemCount} جهاز بنجاح من (${cleanSource}) إلى (${cleanDest})`,
    };
  },

  async getTransferHistory(filters?: {
    search?: string;
    status?: string;
    sourceLocation?: string;
    destinationLocation?: string;
    page?: number;
    limit?: number;
  }): Promise<{ transfers: InventoryTransfer[]; total: number }> {
    let transfers: InventoryTransfer[] = [];

    try {
      let query = supabase.from('inventory_transfers').select('*').order('created_at', { ascending: false });

      if (filters?.limit) query = query.limit(filters.limit);

      const { data, error } = await query;
      if (!error && Array.isArray(data) && data.length > 0) {
        transfers = data.map((row: any) => ({
          id: row.id,
          referenceNumber: row.reference_number,
          sourceLocation: row.source_location,
          destinationLocation: row.destination_location,
          sourceStoreId: row.source_store_id,
          destinationStoreId: row.destination_store_id,
          transferType: row.transfer_type,
          status: row.status,
          itemCount: row.item_count,
          totalCost: Number(row.total_cost) || 0,
          notes: row.notes,
          idempotencyKey: row.idempotency_key,
          createdByAdminId: row.created_by_admin_id,
          createdByUsername: row.created_by_username,
          createdAt: row.created_at,
          completedAt: row.completed_at,
          failureReason: row.failure_reason,
        }));
      }
    } catch {
      // Fallback
    }

    // Merge with local transfers
    try {
      const raw = localStorage.getItem(TRANSFERS_CACHE_KEY);
      if (raw) {
        const localList: InventoryTransfer[] = JSON.parse(raw);
        for (const lt of localList) {
          if (!transfers.some(t => t.id === lt.id || t.referenceNumber === lt.referenceNumber)) {
            transfers.push(lt);
          }
        }
      }
    } catch {
      // Non-blocking
    }

    // Client filtering
    if (filters?.search && filters.search.trim()) {
      const q = filters.search.trim().toLowerCase();
      transfers = transfers.filter(
        t =>
          t.referenceNumber.toLowerCase().includes(q) ||
          t.sourceLocation.toLowerCase().includes(q) ||
          t.destinationLocation.toLowerCase().includes(q) ||
          (t.notes && t.notes.toLowerCase().includes(q))
      );
    }

    if (filters?.status && filters.status !== 'all') {
      transfers = transfers.filter(t => t.status === filters.status);
    }

    if (filters?.sourceLocation && filters.sourceLocation !== 'all') {
      transfers = transfers.filter(t => t.sourceLocation === filters.sourceLocation);
    }

    if (filters?.destinationLocation && filters.destinationLocation !== 'all') {
      transfers = transfers.filter(t => t.destinationLocation === filters.destinationLocation);
    }

    return { transfers, total: transfers.length };
  },

  async getTransferDetails(transferId: string): Promise<InventoryTransfer | null> {
    const history = await this.getTransferHistory({ limit: 200 });
    const transfer = history.transfers.find(t => t.id === transferId || t.referenceNumber === transferId);
    if (!transfer) return null;

    try {
      const { data: items, error } = await supabase
        .from('inventory_transfer_items')
        .select('*')
        .eq('transfer_id', transfer.id);

      if (!error && Array.isArray(items)) {
        transfer.items = items.map((row: any) => ({
          id: row.id,
          transferId: row.transfer_id,
          deviceId: row.device_id,
          serialNumber: row.serial_number,
          modelId: row.model_id,
          modelName: row.model_name,
          sourceLocation: row.source_location,
          destinationLocation: row.destination_location,
          purchaseCostSnapshot: Number(row.purchase_cost_snapshot) || 0,
          previousStatus: row.previous_status,
          resultingStatus: row.resulting_status,
          itemStatus: row.item_status,
          notes: row.notes,
          createdAt: row.created_at,
        }));
      }
    } catch {
      // Fallback
    }

    return transfer;
  },

  // ==========================================================================
  // 3. ACTIVITY & AUDIT LOG
  // ==========================================================================

  async getAuditLogs(limit = 100): Promise<AdminAuditLog[]> {
    let logs: AdminAuditLog[] = [];

    try {
      const { data, error } = await supabase
        .from('admin_audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (!error && Array.isArray(data) && data.length > 0) {
        logs = data.map((row: any) => ({
          id: row.id,
          actorId: row.actor_id,
          actorUsername: row.actor_username,
          eventType: row.event_type,
          targetType: row.target_type as AuditTargetType,
          targetId: row.target_id,
          metadata: row.metadata || {},
          createdAt: row.created_at,
        }));
        try {
          localStorage.setItem(AUDIT_CACHE_KEY, JSON.stringify(logs));
        } catch {
          // Non-blocking
        }
      }
    } catch {
      // Fallback
    }

    if (logs.length === 0) {
      try {
        const raw = localStorage.getItem(AUDIT_CACHE_KEY);
        if (raw) {
          logs = JSON.parse(raw);
        }
      } catch {
        // Fallback
      }
    }

    return logs;
  },

  async logAudit(params: {
    actorId: string;
    actorUsername: string;
    eventType: string;
    targetType: AuditTargetType;
    targetId: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    const cleanMeta = { ...(params.metadata || {}) };
    delete (cleanMeta as any).accessCode;
    delete (cleanMeta as any).password;
    delete (cleanMeta as any).token;

    try {
      await supabase.from('admin_audit_logs').insert({
        actor_id: params.actorId,
        actor_username: params.actorUsername,
        event_type: params.eventType,
        target_type: params.targetType,
        target_id: params.targetId,
        metadata: cleanMeta,
      });
    } catch (err) {
      console.warn('Failed to insert audit log to Supabase:', err);
    }
  },
};
