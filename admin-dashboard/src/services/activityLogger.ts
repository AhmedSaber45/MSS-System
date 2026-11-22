import { getServerSupabase } from '../lib/supabase.ts';
import type { AdminAuditLog, AuditTargetType } from '../types/admin.ts';

export type ActivityEventType =
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILURE'
  | 'LOGIN_REJECTED'
  | 'LOGOUT'
  | 'INACTIVITY_TIMEOUT'
  | 'SESSION_EXPIRED'
  | 'USER_CREATE'
  | 'USER_UPDATE'
  | 'USER_PERMISSIONS_CHANGE'
  | 'USER_ROLE_CHANGE'
  | 'USER_STATUS_CHANGE'
  | 'USER_ACCESS_CODE_CHANGE'
  | 'USER_SESSION_REVOKE'
  | 'USER_DELETE'
  | 'STORE_CREATE'
  | 'STORE_UPDATE'
  | 'STORE_STATUS_CHANGE'
  | 'STORE_MERGE_COMPLETED'
  | 'INVENTORY_TRANSFER_COMPLETED'
  | string;

export interface ActivityLogInput {
  actorId: string;
  actorUsername: string;
  eventType: ActivityEventType;
  targetType?: AuditTargetType;
  targetId?: string;
  targetUsername?: string;
  description?: string;
  status?: 'SUCCESS' | 'FAILURE';
  failureReason?: string;
  metadata?: Record<string, unknown>;
}

export interface ActivityFilterOptions {
  search?: string;
  eventType?: string;
  status?: 'ALL' | 'SUCCESS' | 'FAILURE';
  targetType?: string;
  limit?: number;
  offset?: number;
}

// In-memory fallback and diagnostic buffer (keeps last 500 events)
const activityBuffer: AdminAuditLog[] = [];
const MAX_BUFFER_SIZE = 500;

/**
 * Sanitizes metadata to ensure zero leakage of passwords, hashes, tokens, or secret keys.
 */
function sanitizeMetadata(metadata?: Record<string, unknown>): Record<string, unknown> {
  if (!metadata || typeof metadata !== 'object') return {};
  const clean: Record<string, unknown> = {};

  for (const [key, val] of Object.entries(metadata)) {
    const lowerKey = key.toLowerCase();
    if (
      lowerKey.includes('password') ||
      lowerKey.includes('access_code') ||
      lowerKey.includes('accesscode') ||
      lowerKey.includes('token') ||
      lowerKey.includes('hash') ||
      lowerKey.includes('secret') ||
      lowerKey.includes('salt')
    ) {
      clean[key] = '[REDACTED_SENSITIVE]';
    } else if (val && typeof val === 'object' && !Array.isArray(val)) {
      clean[key] = sanitizeMetadata(val as Record<string, unknown>);
    } else {
      clean[key] = val;
    }
  }

  return clean;
}

/**
 * Generates an accurate, human-readable Arabic description for an activity event.
 */
export function formatArabicDescription(input: ActivityLogInput): string {
  const actor = input.actorUsername || 'المستخدم';
  const target = input.targetUsername || input.targetId || '';
  const status = input.status || 'SUCCESS';

  if (input.description && input.description.trim()) {
    return input.description.trim();
  }

  switch (input.eventType) {
    case 'LOGIN_SUCCESS':
      return `قام ${actor} بتسجيل الدخول`;
    case 'LOGIN_FAILURE':
      return `محاولة تسجيل دخول فاشلة للمستخدم ${target || actor}`;
    case 'LOGIN_REJECTED':
      return `تم رفض محاولة تسجيل الدخول للمستخدم ${target || actor} لأن الحساب معطل أو غير مصرح له`;
    case 'LOGOUT':
      return `قام ${actor} بتسجيل الخروج`;
    case 'INACTIVITY_TIMEOUT':
      return `تم إنهاء جلسة المستخدم ${target || actor} تلقائياً لعدم وجود نشاط لمدة 7 أيام (168 ساعة)`;
    case 'SESSION_EXPIRED':
      return `انتهت صلاحية جلسة المستخدم ${target || actor}`;
    case 'USER_CREATE':
      return `قام ${actor} بإنشاء مستخدم جديد باسم ${target}`;
    case 'USER_UPDATE':
      return `قام ${actor} بتعديل بيانات المستخدم ${target}`;
    case 'USER_PERMISSIONS_CHANGE':
      return `قام ${actor} بتعديل صلاحيات المستخدم ${target}`;
    case 'USER_ROLE_CHANGE':
      return `قام ${actor} بتعديل دور المستخدم ${target}`;
    case 'USER_STATUS_CHANGE': {
      const isNowActive = input.metadata?.newStatus === 'ACTIVE' || input.metadata?.isActive === true;
      return `قام ${actor} بـ${isNowActive ? 'تفعيل' : 'تعطيل'} حساب المستخدم ${target}`;
    }
    case 'USER_ACCESS_CODE_CHANGE':
      return `قام ${actor} بتغيير رمز الدخول للمستخدم ${target} وإبطال جلساته النشطة`;
    case 'USER_SESSION_REVOKE':
      return `قام ${actor} بإبطال كافة الجلسات النشطة للمستخدم ${target}`;
    case 'USER_DELETE':
      return `قام ${actor} بحذف المستخدم ${target}`;
    case 'STORE_CREATE':
      return `قام ${actor} بإنشاء فرع / مخزن جديد باسم ${input.metadata?.name || target}`;
    case 'STORE_UPDATE':
      return `قام ${actor} بتعديل بيانات الفرع / المخزن ${input.metadata?.name || target}`;
    case 'STORE_STATUS_CHANGE':
      return `قام ${actor} بتغيير حالة الفرع / المخزن ${target}`;
    case 'STORE_MERGE_COMPLETED':
      return `قام ${actor} بدمج الفرع ${input.metadata?.sourceStoreName || ''} في ${input.metadata?.destinationStoreName || target}`;
    case 'INVENTORY_TRANSFER_COMPLETED':
      return `قام ${actor} بإتمام تحويل مخزون برقم #${target}`;
    default:
      if (status === 'FAILURE') {
        return `فشلت عملية ${input.eventType} المنفذة بواسطة ${actor}`;
      }
      return `قام ${actor} بتنفيذ عملية ${input.eventType} على ${target}`;
  }
}

/**
 * Centralized Activity Logger Service
 */
export const activityLogger = {
  /**
   * Records an activity event synchronously to memory buffer and persists to Supabase.
   */
  async logActivity(input: ActivityLogInput): Promise<string> {
    const eventId = `act-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const nowIso = new Date().toISOString();
    const cleanMeta = sanitizeMetadata(input.metadata);
    const description = formatArabicDescription(input);
    const status = input.status || 'SUCCESS';
    const targetType = input.targetType || 'system';
    const targetId = input.targetId || input.targetUsername || 'system';

    const memoryRecord: AdminAuditLog = {
      id: eventId,
      actorId: input.actorId,
      actorUsername: input.actorUsername,
      eventType: input.eventType,
      targetType,
      targetId,
      metadata: {
        ...cleanMeta,
        description,
        status,
        failureReason: input.failureReason || null,
        targetUsername: input.targetUsername || null,
      },
      createdAt: nowIso,
    };

    // 1. Maintain in-memory buffer (always available immediately)
    activityBuffer.unshift(memoryRecord);
    if (activityBuffer.length > MAX_BUFFER_SIZE) {
      activityBuffer.length = MAX_BUFFER_SIZE;
    }

    // 2. Persist to Supabase
    try {
      const supabase = getServerSupabase();

      // Attempt secure RPC admin_log_activity first
      const { data: rpcId, error: rpcErr } = await supabase.rpc('admin_log_activity', {
        p_actor_id: input.actorId,
        p_actor_username: input.actorUsername,
        p_event_type: input.eventType,
        p_target_type: targetType,
        p_target_id: targetId,
        p_description: description,
        p_metadata: {
          ...cleanMeta,
          targetUsername: input.targetUsername || null,
        },
        p_status: status,
        p_failure_reason: input.failureReason || null,
      });

      if (!rpcErr && rpcId) {
        memoryRecord.id = rpcId;
        return rpcId;
      }

      // Fallback to direct INSERT into admin_audit_logs
      const { data: insertData, error: insErr } = await supabase
        .from('admin_audit_logs')
        .insert({
          actor_id: input.actorId,
          actor_username: input.actorUsername,
          event_type: input.eventType,
          target_type: ['user', 'store', 'system', 'auth', 'inventory', 'session', 'role'].includes(targetType)
            ? targetType
            : 'system',
          target_id: targetId,
          metadata: {
            ...cleanMeta,
            description,
            status,
            failureReason: input.failureReason || null,
            targetUsername: input.targetUsername || null,
          },
        })
        .select('id')
        .single();

      if (!insErr && insertData?.id) {
        memoryRecord.id = insertData.id;
        return insertData.id;
      }

      if (insErr) {
        console.warn('[ActivityLogger] Direct insert warning:', insErr.message);
      }
    } catch (err: any) {
      // Never let logging failure crash business transaction, but emit warning
      console.warn('[ActivityLogger] Persistence failure warning:', err?.message || err);
    }

    return eventId;
  },

  /**
   * Retrieves activity logs with full filtering, search, and pagination.
   */
  async getLogs(options?: ActivityFilterOptions): Promise<{ logs: AdminAuditLog[]; total: number }> {
    const limit = Math.min(options?.limit || 50, 200);
    const offset = options?.offset || 0;
    const search = options?.search?.trim().toLowerCase();
    const eventType = options?.eventType && options.eventType !== 'ALL' ? options.eventType : undefined;
    const status = options?.status && options.status !== 'ALL' ? options.status : undefined;
    const targetType = options?.targetType && options.targetType !== 'ALL' ? options.targetType : undefined;

    let cloudLogs: AdminAuditLog[] = [];
    let cloudTotal: number | null = null;

    try {
      const supabase = getServerSupabase();
      let query = supabase.from('vw_admin_audit_logs').select('*', { count: 'exact' });

      if (eventType) {
        query = query.eq('event_type', eventType);
      }

      if (targetType) {
        query = query.eq('target_type', targetType);
      }

      if (search) {
        query = query.or(`actor_username.ilike.%${search}%,target_id.ilike.%${search}%,event_type.ilike.%${search}%`);
      }

      query = query.order('created_at', { ascending: false });

      const { data, count, error } = await query.range(offset, offset + limit - 1);

      if (!error && data) {
        cloudTotal = count;
        cloudLogs = data.map((row: any) => ({
          id: row.id,
          actorId: row.actor_id,
          actorUsername: row.actor_username,
          eventType: row.event_type,
          targetType: row.target_type,
          targetId: row.target_id,
          metadata: row.metadata || {},
          createdAt: row.created_at,
        }));
      }
    } catch {
      // Fall back to memory buffer
    }

    // Combine in-memory buffer with cloud logs (preferring immediate in-memory state for fresh events)
    const combined = [...activityBuffer, ...cloudLogs];
    const seen = new Set<string>();
    const deduplicated: AdminAuditLog[] = [];

    // Sort descending by date
    combined.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    for (const log of combined) {
      if (!seen.has(log.id)) {
        seen.add(log.id);
        deduplicated.push(log);
      }
    }

    // Apply in-memory filtering if cloud query was empty or offline
    let filtered = deduplicated;

    if (search) {
      filtered = filtered.filter(
        l =>
          l.actorUsername.toLowerCase().includes(search) ||
          l.targetId.toLowerCase().includes(search) ||
          l.eventType.toLowerCase().includes(search) ||
          (typeof l.metadata?.description === 'string' && l.metadata.description.toLowerCase().includes(search))
      );
    }

    if (eventType) {
      filtered = filtered.filter(l => l.eventType === eventType);
    }

    if (targetType) {
      filtered = filtered.filter(l => l.targetType === targetType);
    }

    if (status) {
      filtered = filtered.filter(l => {
        const itemStatus = l.metadata?.status || 'SUCCESS';
        return itemStatus === status;
      });
    }

    const total = cloudTotal !== null && cloudTotal > filtered.length ? cloudTotal : filtered.length;
    const paged = filtered.slice(offset, offset + limit);

    return {
      logs: paged,
      total,
    };
  },

  /**
   * Resets in-memory buffer (primarily for test isolation).
   */
  _clearMemoryBuffer() {
    activityBuffer.length = 0;
  },

  /**
   * Access in-memory buffer directly (for tests).
   */
  _getMemoryBuffer(): AdminAuditLog[] {
    return [...activityBuffer];
  },
};
