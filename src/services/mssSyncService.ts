import { supabase } from '../lib/supabase.ts';
import { desktopAuthService } from './desktopAuthService.ts';
import { generateUUID, safeStorage } from '../lib/utils.ts';
import type {
  OutboxOperation,
  SyncOperationType,
  MSSConflict,
  SyncStateSummary,
  ConflictType,
  ConflictResolutionStatus,
} from '../types/mssSync.ts';
import type { MSSStockLocation } from '../types/mssInventory.ts';

const MSS_OUTBOX_CACHE_KEY = 'shop_mss_outbox_queue_v1';
const MSS_CONFLICTS_CACHE_KEY = 'shop_mss_conflicts_v1';
const MSS_SYNC_STATE_KEY = 'shop_mss_sync_state_v1';

function getLocalDevices(): any[] {
  try {
    const raw = safeStorage.getItem('shop_mss_devices_cache_v1');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function getLocalInvoices(): any[] {
  try {
    const raw = safeStorage.getItem('shop_mss_invoices_cache_v1');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

let isSyncRunning = false;
let syncQueued = false;

function getCachedOutbox(): OutboxOperation[] {
  try {
    const raw = safeStorage.getItem(MSS_OUTBOX_CACHE_KEY);
    if (!raw) {
      safeStorage.setItem(MSS_OUTBOX_CACHE_KEY, JSON.stringify([]));
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveCachedOutbox(outbox: OutboxOperation[]): void {
  safeStorage.setItem(MSS_OUTBOX_CACHE_KEY, JSON.stringify(outbox));
}

function getCachedConflicts(): MSSConflict[] {
  try {
    const raw = safeStorage.getItem(MSS_CONFLICTS_CACHE_KEY);
    if (!raw) {
      safeStorage.setItem(MSS_CONFLICTS_CACHE_KEY, JSON.stringify([]));
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveCachedConflicts(conflicts: MSSConflict[]): void {
  safeStorage.setItem(MSS_CONFLICTS_CACHE_KEY, JSON.stringify(conflicts));
}

export const mssSyncService = {
  /**
   * Queue a local business operation into the Outbox with a stable UUID
   */
  async queueOperation(
    type: SyncOperationType,
    payload: any,
    description: string,
    branch: MSSStockLocation
  ): Promise<OutboxOperation> {
    const uuid = generateUUID();
    const now = new Date().toISOString();

    const op: OutboxOperation = {
      uuid,
      type,
      branch,
      payload,
      description,
      client_timestamp: now,
      status: 'PENDING',
      retries: 0,
      last_error: null,
    };

    const outbox = getCachedOutbox();
    outbox.unshift(op);
    saveCachedOutbox(outbox);

    // Attempt automatic background sync if online
    this.syncOutbox().catch(err => {
      console.warn('Background sync deferred (offline/error):', err.message);
    });

    return op;
  },

  /**
   * Fetch all outbox operations (sorted latest first)
   */
  async getOutbox(): Promise<OutboxOperation[]> {
    const outbox = getCachedOutbox();
    const conflicts = getCachedConflicts();

    // Ensure every conflict is permanently represented in the outbox (Rule 10 & 25)
    let updated = false;
    for (const c of conflicts) {
      if (!outbox.some(o => o.uuid === c.operation_uuid)) {
        outbox.unshift({
          uuid: c.operation_uuid,
          type: (c.conflict_type === 'DOUBLE_SALE'
            ? 'SALE_CREATE'
            : c.conflict_type === 'DOUBLE_RESERVATION'
            ? 'RESERVATION_CREATE'
            : 'DEVICE_TRANSFER'),
          branch: c.branch,
          payload: c.local_payload,
          description: c.conflict_description,
          client_timestamp: c.created_at,
          status: 'CONFLICT',
          retries: 0,
          conflict_id: c.id,
        });
        updated = true;
      }
    }
    if (updated) {
      saveCachedOutbox(outbox);
    }
    return outbox;
  },

  /**
   * Fetch pending or failed operations
   */
  async getPendingOperations(): Promise<OutboxOperation[]> {
    const outbox = getCachedOutbox();
    return outbox.filter(op => op.status === 'PENDING' || op.status === 'FAILED');
  },

  /**
   * Fetch all recorded conflicts
   */
  async getConflicts(): Promise<MSSConflict[]> {
    let conflicts: MSSConflict[] = [];
    let isCloudFetched = false;

    try {
      const { data, error } = await supabase
        .from('mss_conflicts')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(data)) {
        const cloudConflicts = data.map((row: any) => ({
          id: row.id,
          operation_uuid: row.operation_uuid,
          device_id: row.device_id,
          serial_number: row.serial_number,
          branch: row.branch,
          conflict_type: row.conflict_type,
          conflict_description: row.conflict_description,
          local_payload: row.local_payload,
          remote_state: row.remote_state,
          resolution_status: row.resolution_status,
          resolution_notes: row.resolution_notes,
          resolved_by: row.resolved_by,
          resolved_at: row.resolved_at,
          created_at: row.created_at,
        }));
        const cached = getCachedConflicts();
        const localOnly = cached.filter(
          lc => !cloudConflicts.some(cc => cc.operation_uuid === lc.operation_uuid)
        );
        conflicts = [...localOnly, ...cloudConflicts];
        saveCachedConflicts(conflicts);
        isCloudFetched = true;
      }
    } catch (err) {
      console.warn('Supabase fetch conflicts failed, using cache:', err);
    }

    if (!isCloudFetched) {
      conflicts = getCachedConflicts();
    }

    return conflicts;
  },

  /**
   * Check connection to Supabase
   */
  async checkConnectivity(): Promise<boolean> {
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean' && !navigator.onLine) {
        return false;
      }
      // Simple lightweight probe to Supabase PostgREST
      const { error } = await supabase.from('mss_models').select('id').limit(1);
      return !error;
    } catch {
      return false;
    }
  },

  /**
   * Synchronize the Outbox queue with Supabase:
   * - Serialized to prevent concurrent overlapping executions
   * - Enforces Idempotency by Operation UUID
   * - Detects Conflicts (e.g. Double Sales / Double Reservations during offline disconnections)
   * - Never silently discards conflicting transactions (Rule 10 & 25)
   * - Handles retries with backoff
   */
  async syncOutbox(): Promise<{ synced: number; conflicts: number; failed: number }> {
    if (isSyncRunning) {
      syncQueued = true;
      while (isSyncRunning) {
        await new Promise(r => setTimeout(r, 50));
      }
      return { synced: 0, conflicts: 0, failed: 0 };
    }

    isSyncRunning = true;
    try {
      let result = await this._executeSync();
      while (syncQueued) {
        syncQueued = false;
        const extra = await this._executeSync();
        result = {
          synced: result.synced + extra.synced,
          conflicts: result.conflicts + extra.conflicts,
          failed: result.failed + extra.failed,
        };
      }
      return result;
    } finally {
      isSyncRunning = false;
    }
  },

  async _executeSync(): Promise<{ synced: number; conflicts: number; failed: number }> {
    // Phase 3 Auth Guard: When a session is active, verify user has MSS permission before cloud sync
    const currentSession = await desktopAuthService.loadSecureSession();
    if (
      currentSession &&
      currentSession.user.allowedModules !== 'mss' &&
      currentSession.user.allowedModules !== 'both'
    ) {
      // Preserve pending outbox records safely without syncing
      return { synced: 0, conflicts: 0, failed: 0 };
    }

    const isOnline = await this.checkConnectivity();
    if (!isOnline) {
      return { synced: 0, conflicts: 0, failed: 0 };
    }

    // Pre-sync: push any pending models and pending devices to satisfy FK dependencies
    try {
      const { mssCatalogService } = await import('./mssCatalogService.ts');
      await mssCatalogService.syncPendingModels();
    } catch (e) {
      console.warn('Pre-sync pending models warning:', e);
    }
    try {
      const { mssInventoryService } = await import('./mssInventoryService.ts');
      await mssInventoryService.syncPendingDevices();
    } catch (e) {
      console.warn('Pre-sync pending devices warning:', e);
    }

    const outbox = getCachedOutbox();
    const pendingOps = outbox.filter(op => op.status === 'PENDING' || op.status === 'FAILED');

    let syncedCount = 0;
    let conflictCount = 0;
    let failedCount = 0;

    for (const op of pendingOps) {
      op.status = 'SYNCING';
      saveCachedOutbox(outbox);

      try {
        // 1. Idempotency Check: check if operation_uuid already exists in cloud mss_sync_log
        const { data: existingSync } = await supabase
          .from('mss_sync_log')
          .select('id, status')
          .eq('operation_uuid', op.uuid)
          .maybeSingle();

        if (existingSync) {
          // Already synchronized previously! (Idempotent replay)
          op.status = 'SYNCED';
          op.synced_at = new Date().toISOString();
          syncedCount++;
          continue;
        }

        // 2. Process Operation with Conflict Detection
        let detectedConflict: { type: ConflictType; description: string; remoteState?: any } | null = null;

        if (op.type === 'SALE_CREATE') {
          const serial = op.payload.serial_number;
          if (serial) {
            // Check remote device state in Supabase
            let remoteDev: any = null;
            try {
              const { data } = await supabase
                .from('mss_devices')
                .select('*')
                .eq('serial_number', serial)
                .maybeSingle();
              remoteDev = data;
            } catch {
              // ignore
            }

            if (!remoteDev) {
              const localDevs = getLocalDevices();
              remoteDev = localDevs.find((d: any) => d.serial_number === serial);
            }

            // Check if sold by a different invoice (remote or local)
            let existingInv: any = null;
            try {
              const { data } = await supabase
                .from('mss_invoices')
                .select('id, invoice_number, selling_branch, sale_date')
                .eq('serial_number', serial)
                .maybeSingle();
              existingInv = data;
            } catch {
              // ignore
            }

            if (!existingInv) {
              const localInvs = getLocalInvoices();
              existingInv = localInvs.find((inv: any) => inv.serial_number === serial);
            }

            if (existingInv && existingInv.invoice_number !== op.payload.invoice_number) {
              // CRITICAL CONFLICT: Both shops sold the same unit while disconnected!
              detectedConflict = {
                type: 'DOUBLE_SALE',
                description: `تعارض بيع مزدوج: تم بيع الجهاز بالسيريال (${serial}) مسبقاً في (${existingInv.selling_branch || 'الفرع'}) بفاتورة رقم (${existingInv.invoice_number}) أثناء انقطاع الاتصال.`,
                remoteState: existingInv,
              };
            } else if (remoteDev && remoteDev.status === 'SOLD' && (!existingInv || existingInv.invoice_number !== op.payload.invoice_number)) {
              detectedConflict = {
                type: 'DOUBLE_SALE',
                description: `تعارض بيع مزدوج: الجهاز بالسيريال (${serial}) مسجل كمباع مسبقاً في قاعدة البيانات.`,
                remoteState: remoteDev,
              };
            } else if (op.branch) {
              let branchDev: any = null;
              try {
                const { data } = await supabase
                  .from('mss_devices')
                  .select('id, stock_location, status')
                  .eq('serial_number', serial)
                  .maybeSingle();
                branchDev = data;
              } catch {
                // ignore
              }
              if (branchDev && branchDev.stock_location !== op.branch) {
                detectedConflict = {
                  type: 'STALE_STOCK_TRANSFER',
                  description: `تعارض بيع لجهاز تم نقله: الجهاز بالسيريال (${serial}) تم نقله إدارياً إلى موقع (${branchDev.stock_location}) بينما تمت محاولة بيعه من (${op.branch}) أوفلاين.`,
                  remoteState: branchDev,
                };
              }
            }
          }
        } else if (op.type === 'RESERVATION_CREATE') {
          const serial = op.payload.serial_number;
          if (serial) {
            let remoteDev: any = null;
            try {
              const { data } = await supabase
                .from('mss_devices')
                .select('*')
                .eq('serial_number', serial)
                .maybeSingle();
              remoteDev = data;
            } catch {
              // ignore
            }

            if (!remoteDev) {
              const localDevs = getLocalDevices();
              remoteDev = localDevs.find((d: any) => d.serial_number === serial);
            }

            if (remoteDev && (remoteDev.status === 'SOLD' || remoteDev.status === 'RESERVED')) {
              detectedConflict = {
                type: 'DOUBLE_RESERVATION',
                description: `تعارض حجز: الجهاز بالسيريال (${serial}) محجوز أو مباع بالفعل في السحابة بحالة (${remoteDev.status}).`,
                remoteState: remoteDev,
              };
            } else if (remoteDev && op.branch && remoteDev.stock_location !== op.branch) {
              detectedConflict = {
                type: 'STALE_STOCK_TRANSFER',
                description: `تعارض حجز لجهاز تم نقله: الجهاز بالسيريال (${serial}) تم نقله إدارياً إلى (${remoteDev.stock_location}) بينما تمت محاولة حجزه من (${op.branch}).`,
                remoteState: remoteDev,
              };
            }
          }
        } else if (op.type === 'DEVICE_TRANSFER') {
          const serial = op.payload.serial_number;
          if (serial) {
            let remoteDev: any = null;
            try {
              const { data } = await supabase
                .from('mss_devices')
                .select('*')
                .eq('serial_number', serial)
                .maybeSingle();
              remoteDev = data;
            } catch {
              // ignore
            }

            if (!remoteDev) {
              const localDevs = getLocalDevices();
              remoteDev = localDevs.find((d: any) => d.serial_number === serial);
            }

            if (remoteDev && remoteDev.status === 'SOLD') {
              detectedConflict = {
                type: 'STALE_STOCK_TRANSFER',
                description: `تعارض نقل مخزون قديم: الجهاز بالسيريال (${serial}) تم بيعه بالفعل في الفرع الآخر ولا يمكن نقله.`,
                remoteState: remoteDev,
              };
            } else if (remoteDev && op.payload.from_location && remoteDev.stock_location !== op.payload.from_location) {
              detectedConflict = {
                type: 'STALE_STOCK_TRANSFER',
                description: `تعارض نقل مخزون: موقع الجهاز بالسيريال (${serial}) في السحابة هو (${remoteDev.stock_location}) وليس (${op.payload.from_location}).`,
                remoteState: remoteDev,
              };
            }
          }
        }

        // 3. Handle Detected Conflict or Apply Synchronized Operation
        if (detectedConflict) {
          // Rule 10 & 25: Never silently discard conflicting operations!
          const conflictId = 'cnf-' + Math.random().toString(36).substring(2, 9);
          const newConflict: MSSConflict = {
            id: conflictId,
            operation_uuid: op.uuid,
            serial_number: op.payload.serial_number || 'UNKNOWN',
            branch: op.branch,
            conflict_type: detectedConflict.type,
            conflict_description: detectedConflict.description,
            local_payload: op.payload,
            remote_state: detectedConflict.remoteState,
            resolution_status: 'PENDING',
            created_at: new Date().toISOString(),
          };

          // Save conflict in Supabase and local cache
          try {
            await supabase.from('mss_sync_log').insert({
              operation_uuid: op.uuid,
              operation_type: op.type,
              branch: op.branch,
              payload: op.payload,
              client_timestamp: op.client_timestamp,
              status: 'CONFLICT',
              conflict_reason: detectedConflict.description,
            });

            await supabase.from('mss_conflicts').insert({
              operation_uuid: op.uuid,
              serial_number: newConflict.serial_number,
              branch: newConflict.branch,
              conflict_type: newConflict.conflict_type,
              conflict_description: newConflict.conflict_description,
              local_payload: newConflict.local_payload,
              remote_state: newConflict.remote_state,
              resolution_status: 'PENDING',
            });
          } catch (err) {
            console.warn('Failed to insert conflict remotely:', err);
          }

          const conflicts = getCachedConflicts();
          conflicts.unshift(newConflict);
          saveCachedConflicts(conflicts);

          op.status = 'CONFLICT';
          op.conflict_id = conflictId;
          conflictCount++;
        } else {
          // No Conflict: Apply to cloud tables if applicable
          if (op.type === 'DEVICE_ADD' && op.payload) {
            const dev = op.payload;
            if (dev && dev.id && dev.model_id) {
              const { error: devErr } = await supabase.from('mss_devices').upsert({
                id: dev.id,
                serial_number: dev.serial_number || null,
                model_id: dev.model_id,
                purchase_cost: dev.purchase_cost,
                list_price: dev.list_price,
                purchase_date: dev.purchase_date,
                physical_condition: dev.physical_condition,
                stock_location: dev.stock_location,
                status: dev.status || 'AVAILABLE',
                notes: dev.notes || null,
              }, { onConflict: 'id' });

              if (devErr) {
                console.error('DEVICE_ADD sync failed:', devErr);
                throw new Error(`فشلت مزامنة الجهاز (${dev.serial_number || dev.id}): ${devErr.message}`);
              }
            }
          } else if (op.type === 'DEVICE_TRANSFER' && op.payload) {
            const mov = op.payload;
            if (mov && mov.device_id && mov.to_location) {
              const { error: trErr } = await supabase.from('mss_devices').update({
                stock_location: mov.to_location,
                updated_at: mov.movement_date || new Date().toISOString(),
              }).eq('id', mov.device_id);

              if (trErr) {
                console.error('DEVICE_TRANSFER sync failed:', trErr);
                throw new Error(`فشلت مزامنة نقل الجهاز: ${trErr.message}`);
              }

              if (mov.id) {
                await supabase.from('mss_device_movements').upsert({
                  id: mov.id,
                  device_id: mov.device_id,
                  serial_number: mov.serial_number || null,
                  from_location: mov.from_location,
                  to_location: mov.to_location,
                  movement_date: mov.movement_date,
                  movement_status: mov.movement_status || 'COMPLETED',
                  notes: mov.notes || null,
                }, { onConflict: 'id' });
              }
            }
          } else if (op.type === 'SALE_CREATE' && op.payload) {
            const inv = op.payload;
            if (inv && inv.id) {
              const { error: invErr } = await supabase.from('mss_invoices').upsert({
                id: inv.id,
                invoice_number: inv.invoice_number,
                device_id: inv.device_id,
                model_id: inv.model_id,
                serial_number: inv.serial_number || null,
                selling_branch: inv.selling_branch,
                source_branch: inv.source_branch,
                list_price_snapshot: inv.list_price_snapshot,
                discount_amount: inv.discount_amount || 0,
                actual_sale_price: inv.actual_sale_price,
                cost_snapshot: inv.cost_snapshot || 0,
                gross_profit: inv.gross_profit || 0,
                customer_name: inv.customer_name || 'عميل نقدي',
                customer_phone: inv.customer_phone || null,
                customer_national_id: inv.customer_national_id || null,
                warranty_period_months: inv.warranty_period_months || 3,
                warranty_terms: inv.warranty_terms || null,
                sale_date: inv.sale_date,
                notes: inv.notes || null,
                is_returned: Boolean(inv.is_returned),
              }, { onConflict: 'id' });

              if (invErr) {
                console.error('SALE_CREATE sync failed:', invErr);
                throw new Error(`فشلت مزامنة فاتورة البيع (${inv.invoice_number}): ${invErr.message}`);
              }

              if (inv.device_id) {
                await supabase.from('mss_devices').update({
                  status: 'SOLD',
                  updated_at: new Date().toISOString(),
                }).eq('id', inv.device_id);
              }
            }
          } else if (op.type === 'PAYMENT_RECORD' && op.payload?.payment) {
            const p = op.payload.payment;
            try {
              await supabase.from('mss_payments').insert({
                id: p.id,
                invoice_id: p.invoice_id,
                amount: p.amount,
                payment_date: p.payment_date,
                payment_method: p.payment_method,
                notes: p.notes,
                recorded_by: p.recorded_by,
                is_reversal: false,
              });
              if (op.payload.balances && op.payload.invoice_id) {
                await supabase.from('mss_invoices').update({
                  paid_amount: op.payload.balances.paidAmount,
                  remaining_balance: op.payload.balances.remainingBalance,
                  payment_status: op.payload.balances.paymentStatus,
                }).eq('id', op.payload.invoice_id);
              }
            } catch (err) {
              console.warn('Sync PAYMENT_RECORD to Supabase warning:', err);
            }
          } else if (op.type === 'PAYMENT_REVERSE' && op.payload?.reversal) {
            const r = op.payload.reversal;
            try {
              await supabase.from('mss_payments').insert({
                id: r.id,
                invoice_id: r.invoice_id,
                amount: r.amount,
                payment_date: r.payment_date,
                payment_method: r.payment_method,
                notes: r.notes,
                recorded_by: r.recorded_by,
                is_reversal: true,
                reversal_of_id: r.reversal_of_id,
                reversal_reason: r.reversal_reason,
              });
              if (op.payload.balances && op.payload.invoice_id) {
                await supabase.from('mss_invoices').update({
                  paid_amount: op.payload.balances.paidAmount,
                  remaining_balance: op.payload.balances.remainingBalance,
                  payment_status: op.payload.balances.paymentStatus,
                }).eq('id', op.payload.invoice_id);
              }
            } catch (err) {
              console.warn('Sync PAYMENT_REVERSE to Supabase warning:', err);
            }
          } else if (op.type === 'INSTALLMENT_SCHEDULE_UPDATE' && op.payload?.schedules) {
            try {
              await supabase.from('mss_installment_schedules').delete().eq('invoice_id', op.payload.invoice_id);
              for (const sch of op.payload.schedules) {
                await supabase.from('mss_installment_schedules').insert({
                  id: sch.id,
                  invoice_id: sch.invoice_id,
                  installment_number: sch.installment_number,
                  due_date: sch.due_date,
                  expected_amount: sch.expected_amount,
                  notes: sch.notes,
                });
              }
              if (op.payload.due_date !== undefined && op.payload.invoice_id) {
                await supabase.from('mss_invoices').update({
                  due_date: op.payload.due_date,
                  installments_count: op.payload.installments_count,
                }).eq('id', op.payload.invoice_id);
              }
            } catch (err) {
              console.warn('Sync INSTALLMENT_SCHEDULE_UPDATE warning:', err);
            }
          } else if (op.type === 'EXPENSE_CREATE' && op.payload) {
            const exp = op.payload;
            try {
              await supabase.from('mss_expenses').upsert({
                id: exp.id,
                title: exp.title,
                category: exp.category,
                amount: exp.amount,
                branch: exp.branch,
                expense_date: exp.expense_date,
                payment_source: exp.payment_source,
                payment_method: exp.payment_method,
                description: exp.description,
                created_by: exp.created_by,
                created_at: exp.created_at,
                updated_at: exp.updated_at,
              }, { onConflict: 'id' });
            } catch (err) {
              console.warn('Sync EXPENSE_CREATE warning:', err);
            }
          } else if (op.type === 'EXPENSE_UPDATE' && op.payload) {
            const exp = op.payload;
            try {
              await supabase.from('mss_expenses').update({
                title: exp.title,
                category: exp.category,
                amount: exp.amount,
                branch: exp.branch,
                expense_date: exp.expense_date,
                payment_source: exp.payment_source,
                payment_method: exp.payment_method,
                description: exp.description,
                updated_at: exp.updated_at,
              }).eq('id', exp.id);
            } catch (err) {
              console.warn('Sync EXPENSE_UPDATE warning:', err);
            }
          } else if (op.type === 'EXPENSE_DELETE' && op.payload?.id) {
            try {
              await supabase.from('mss_expenses').delete().eq('id', op.payload.id);
            } catch (err) {
              console.warn('Sync EXPENSE_DELETE warning:', err);
            }
          }

          // Log to mss_sync_log
          try {
            await supabase.from('mss_sync_log').insert({
              operation_uuid: op.uuid,
              operation_type: op.type,
              branch: op.branch,
              payload: op.payload,
              client_timestamp: op.client_timestamp,
              status: 'SYNCED',
            });
          } catch {
            // ignore
          }

          op.status = 'SYNCED';
          op.synced_at = new Date().toISOString();
          op.last_error = null;
          syncedCount++;
        }
      } catch (err: any) {
        console.error(`Failed to sync operation ${op.uuid}:`, err);
        op.retries = (op.retries || 0) + 1;
        op.last_error = err.message || 'خطأ أثناء المزامنة';
        op.status = op.retries >= 5 ? 'FAILED' : 'PENDING';
        failedCount++;
      }

      saveCachedOutbox(outbox);
    }

    // Save final state
    saveCachedOutbox(outbox);
    localStorage.setItem(MSS_SYNC_STATE_KEY, new Date().toISOString());

    return { synced: syncedCount, conflicts: conflictCount, failed: failedCount };
  },

  /**
   * Manual Conflict Resolution Workflow (Rule 10 & 25)
   */
  async resolveConflict(
    conflictId: string,
    resolution: ConflictResolutionStatus,
    notes?: string,
    resolvedBy: string = 'مدير النظام'
  ): Promise<void> {
    const conflicts = getCachedConflicts();
    const index = conflicts.findIndex(c => c.id === conflictId);
    if (index < 0) throw new Error('التعارض غير موجود');

    const conflict = conflicts[index];
    const now = new Date().toISOString();

    conflict.resolution_status = resolution;
    conflict.resolution_notes = notes || `تمت التسوية بنجاح: ${resolution}`;
    conflict.resolved_by = resolvedBy;
    conflict.resolved_at = now;

    // Try remote update
    try {
      await supabase
        .from('mss_conflicts')
        .update({
          resolution_status: resolution,
          resolution_notes: conflict.resolution_notes,
          resolved_by: resolvedBy,
          resolved_at: now,
        })
        .eq('operation_uuid', conflict.operation_uuid);

      await supabase
        .from('mss_sync_log')
        .update({ status: 'RESOLVED' })
        .eq('operation_uuid', conflict.operation_uuid);
    } catch (err) {
      console.warn('Supabase resolve conflict failed:', err);
    }

    conflicts[index] = conflict;
    saveCachedConflicts(conflicts);

    // Update outbox operation status
    const outbox = getCachedOutbox();
    const op = outbox.find(o => o.uuid === conflict.operation_uuid);
    if (op) {
      op.status = 'SYNCED';
      op.synced_at = now;
      saveCachedOutbox(outbox);
    }
  },

  /**
   * Get live synchronization state summary
   */
  async getSyncSummary(): Promise<SyncStateSummary> {
    const isOnline = await this.checkConnectivity();
    const outbox = getCachedOutbox();
    const conflicts = getCachedConflicts();

    const pending_count = outbox.filter(o => o.status === 'PENDING' || o.status === 'SYNCING').length;
    const synced_count = outbox.filter(o => o.status === 'SYNCED').length;
    const conflict_count = conflicts.filter(c => c.resolution_status === 'PENDING').length;
    const failed_count = outbox.filter(o => o.status === 'FAILED').length;
    const last_sync_time = localStorage.getItem(MSS_SYNC_STATE_KEY) || null;

    return {
      is_online: isOnline,
      pending_count,
      synced_count,
      conflict_count,
      failed_count,
      last_sync_time,
    };
  },
};
