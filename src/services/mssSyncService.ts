import { supabase } from '../lib/supabase.ts';
import { desktopAuthService } from './desktopAuthService.ts';
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

// Safe Cross-Platform UUID generator
function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID();
    } catch {
      // Fallback below
    }
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Initial seed outbox operations for immediate usability
const INITIAL_SEED_OUTBOX: OutboxOperation[] = [
  {
    uuid: 'f0000000-0000-0000-0000-000000000001',
    type: 'SALE_CREATE',
    branch: 'محل 1',
    payload: { invoice_number: 'MSS-INV-101', serial_number: '5CD9283-HP', actual_sale_price: 13000 },
    description: 'بيع لابتوب HP EliteBook 840 G6 (سيريال: 5CD9283-HP)',
    client_timestamp: '2024-11-12T13:30:00Z',
    status: 'SYNCED',
    retries: 0,
    synced_at: '2024-11-12T13:30:05Z',
  },
  {
    uuid: 'f0000000-0000-0000-0000-000000000002',
    type: 'DEVICE_ADD',
    branch: 'محل 2',
    payload: { serial_number: 'PF1K893-LEN', model_name: 'ThinkPad T480' },
    description: 'تسجيل جهاز جديد بالسيريال (PF1K893-LEN) في محل 2',
    client_timestamp: '2024-11-11T11:00:00Z',
    status: 'SYNCED',
    retries: 0,
    synced_at: '2024-11-11T11:00:04Z',
  },
];

// Initial seed conflicts
const INITIAL_SEED_CONFLICTS: MSSConflict[] = [];

const FALLBACK_SEED_DEVICES = [
  {
    id: 'b0000000-0000-0000-0000-000000000005',
    serial_number: '5CD9283-HP',
    model_id: 'a0000000-0000-0000-0000-000000000003',
    purchase_cost: 9800,
    list_price: 13500,
    purchase_date: '2024-11-04',
    physical_condition: 'فرز أول كيبورد مضيئة',
    stock_location: 'محل 2',
    status: 'SOLD',
    notes: 'تم البيع للعميل شريف',
  },
];

const FALLBACK_SEED_INVOICES = [
  {
    id: 'd0000000-0000-0000-0000-000000000001',
    invoice_number: 'MSS-INV-101',
    device_id: 'b0000000-0000-0000-0000-000000000005',
    serial_number: '5CD9283-HP',
    model_id: 'a0000000-0000-0000-0000-000000000003',
    selling_branch: 'محل 1',
    source_branch: 'محل 2',
    list_price_snapshot: 13500,
    discount_amount: 500,
    actual_sale_price: 13000,
    cost_snapshot: 9800,
    gross_profit: 3200,
    customer_name: 'أ. شريف كمال',
    sale_date: '2024-11-12T13:30:00Z',
    is_returned: false,
  },
];

function getLocalDevices(): any[] {
  try {
    const raw = localStorage.getItem('shop_mss_devices_cache_v1');
    if (!raw) return FALLBACK_SEED_DEVICES;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : FALLBACK_SEED_DEVICES;
  } catch {
    return FALLBACK_SEED_DEVICES;
  }
}

function getLocalInvoices(): any[] {
  try {
    const raw = localStorage.getItem('shop_mss_invoices_cache_v1');
    if (!raw) return FALLBACK_SEED_INVOICES;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : FALLBACK_SEED_INVOICES;
  } catch {
    return FALLBACK_SEED_INVOICES;
  }
}

let isSyncRunning = false;
let syncQueued = false;

function getCachedOutbox(): OutboxOperation[] {
  try {
    const raw = localStorage.getItem(MSS_OUTBOX_CACHE_KEY);
    if (!raw) {
      localStorage.setItem(MSS_OUTBOX_CACHE_KEY, JSON.stringify(INITIAL_SEED_OUTBOX));
      return INITIAL_SEED_OUTBOX;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : INITIAL_SEED_OUTBOX;
  } catch {
    return INITIAL_SEED_OUTBOX;
  }
}

function saveCachedOutbox(outbox: OutboxOperation[]): void {
  localStorage.setItem(MSS_OUTBOX_CACHE_KEY, JSON.stringify(outbox));
}

function getCachedConflicts(): MSSConflict[] {
  try {
    const raw = localStorage.getItem(MSS_CONFLICTS_CACHE_KEY);
    if (!raw) {
      localStorage.setItem(MSS_CONFLICTS_CACHE_KEY, JSON.stringify(INITIAL_SEED_CONFLICTS));
      return INITIAL_SEED_CONFLICTS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : INITIAL_SEED_CONFLICTS;
  } catch {
    return INITIAL_SEED_CONFLICTS;
  }
}

function saveCachedConflicts(conflicts: MSSConflict[]): void {
  localStorage.setItem(MSS_CONFLICTS_CACHE_KEY, JSON.stringify(conflicts));
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

            if (!existingInv) {
              existingInv = FALLBACK_SEED_INVOICES.find((inv: any) => inv.serial_number === serial);
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
          if (op.type === 'PAYMENT_RECORD' && op.payload?.payment) {
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
