import { invoke, isTauri } from '@tauri-apps/api/core';
import type {
  AppModule,
  AuthenticatedUser,
  StoredSession,
  LoginCredentials,
  LoginResult,
} from '../types/auth.ts';
import { webSessionFallback } from './webSessionFallback.ts';

const DEFAULT_OFFLINE_DAYS = 7;
export const INACTIVITY_TIMEOUT_DAYS = 7;
export const INACTIVITY_TIMEOUT_MS = INACTIVITY_TIMEOUT_DAYS * 24 * 60 * 60 * 1000; // 168 hours = 604,800,000 ms

const PRODUCTION_ADMIN_API_URL = 'https://assystemadmindashboard.vercel.app';
const ADMIN_API_URL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_ADMIN_API_URL) ||
  ((typeof import.meta !== 'undefined' && import.meta.env?.PROD)
    ? PRODUCTION_ADMIN_API_URL
    : 'http://localhost:3000');

// In-memory session store fallback for non-Tauri / test environments
let memorySession: StoredSession | null = null;
let lastRecordedUserActivity = 0;

/**
 * Checks whether persistent session data has genuinely changed
 * (identity, roles, module permissions, store assignments, versioning, or token/expiration).
 */
export function hasSessionDataChanged(
  current: StoredSession,
  newUser: AuthenticatedUser,
  newExpiresAt?: string,
  newToken?: string
): boolean {
  if (newToken && newToken !== current.sessionToken) return true;
  if (newExpiresAt && newExpiresAt !== current.expiresAt) return true;

  const curUser = current.user;
  if (!curUser) return true;
  if (curUser.id !== newUser.id) return true;
  if (curUser.username !== newUser.username) return true;
  if (curUser.displayName !== newUser.displayName) return true;
  if (curUser.allowedModules !== newUser.allowedModules) return true;
  if (curUser.defaultStoreId !== newUser.defaultStoreId) return true;
  if (curUser.credentialVersion !== newUser.credentialVersion) return true;
  if (curUser.permissionVersion !== newUser.permissionVersion) return true;

  const curStores = curUser.assignedStoreIds || [];
  const newStores = newUser.assignedStoreIds || [];
  if (curStores.length !== newStores.length) return true;
  for (let i = 0; i < curStores.length; i++) {
    if (curStores[i] !== newStores[i]) return true;
  }

  return false;
}

export const desktopAuthService = {
  /**
   * Check whether running in native desktop environment
   */
  isDesktop(): boolean {
    return isTauri();
  },

  /**
   * Update memory session without touching disk/DPAPI
   */
  updateMemorySession(session: StoredSession): void {
    memorySession = session;
  },

  /**
   * Get current in-memory session if loaded
   */
  getMemorySession(): StoredSession | null {
    return memorySession;
  },

  /**
   * Securely save session using Windows DPAPI (or web / memory fallback)
   */
  async saveSecureSession(session: StoredSession): Promise<void> {
    const json = JSON.stringify(session);
    if (this.isDesktop()) {
      try {
        await invoke('save_secure_session', { sessionJson: json });
        memorySession = session;
        return;
      } catch (err) {
        console.warn('DPAPI save_secure_session failed, using memory store:', err);
      }
    }
    memorySession = session;
    webSessionFallback.save(session);
  },

  /**
   * Securely load session from Windows DPAPI (or web / memory fallback)
   */
  async loadSecureSession(): Promise<StoredSession | null> {
    if (this.isDesktop()) {
      try {
        const raw = await invoke<string | null>('load_secure_session');
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (parsed && parsed.sessionToken && parsed.user) {
          const loaded = parsed as StoredSession;
          memorySession = loaded;
          return loaded;
        }
        return null;
      } catch (err) {
        console.warn('DPAPI load_secure_session failed or corrupted:', err);
        return null;
      }
    }
    if (memorySession) return memorySession;
    const fallback = webSessionFallback.load();
    if (fallback) {
      memorySession = fallback;
      return fallback;
    }
    return null;
  },

  /**
   * Securely clear session from Windows DPAPI and fallbacks
   */
  async clearSecureSession(): Promise<void> {
    if (this.isDesktop()) {
      try {
        await invoke('clear_secure_session');
      } catch (err) {
        console.warn('DPAPI clear_secure_session failed:', err);
      }
    }
    memorySession = null;
    webSessionFallback.clear();
  },

  /**
   * Authoritative check if user's assigned permissions permit access to module
   */
  canAccess(module: 'accessories' | 'mss', allowed: AppModule): boolean {
    if (allowed === 'both') return true;
    return allowed === module;
  },

  /**
   * Check 7-day inactivity timeout (168 hours) based on stored last activity timestamp
   */
  checkInactivityTimeout(session: StoredSession): {
    expired: boolean;
    reason?: 'INACTIVITY_TIMEOUT' | 'CLOCK_TAMPERING';
    elapsedMs: number;
    remainingMs: number;
  } {
    if (!session) {
      return { expired: true, elapsedMs: 0, remainingMs: 0 };
    }

    const now = Date.now();
    const lastActiveIso = session.lastActivityAt || session.lastOnlineValidationAt;
    if (!lastActiveIso) {
      return { expired: false, elapsedMs: 0, remainingMs: INACTIVITY_TIMEOUT_MS };
    }

    const lastActive = new Date(lastActiveIso).getTime();

    // Anti-tampering check: clock moved backward by more than 1 minute
    if (now < lastActive - 60000) {
      return { expired: true, reason: 'CLOCK_TAMPERING', elapsedMs: 0, remainingMs: 0 };
    }

    const elapsed = now - lastActive;
    const remaining = INACTIVITY_TIMEOUT_MS - elapsed;

    if (elapsed >= INACTIVITY_TIMEOUT_MS || remaining <= 0) {
      return { expired: true, reason: 'INACTIVITY_TIMEOUT', elapsedMs: elapsed, remainingMs: 0 };
    }

    return { expired: false, elapsedMs: elapsed, remainingMs: remaining };
  },

  /**
   * Validate local session against offline policy (7-day default window, anti-tampering, inactivity)
   */
  validateOfflineSession(session: StoredSession): {
    valid: boolean;
    daysRemaining: number;
    reason?: 'EXPIRED' | 'OFFLINE_MAX_EXCEEDED' | 'CLOCK_TAMPERING';
  } {
    if (!session || !session.expiresAt || !session.lastOnlineValidationAt) {
      return { valid: false, daysRemaining: 0, reason: 'EXPIRED' };
    }

    const now = Date.now();
    const expiresAt = new Date(session.expiresAt).getTime();
    if (now >= expiresAt) {
      return { valid: false, daysRemaining: 0, reason: 'EXPIRED' };
    }

    // Inactivity check
    const inactivity = this.checkInactivityTimeout(session);
    if (inactivity.expired) {
      if (inactivity.reason === 'CLOCK_TAMPERING') {
        return { valid: false, daysRemaining: 0, reason: 'CLOCK_TAMPERING' };
      }
      return { valid: false, daysRemaining: 0, reason: 'OFFLINE_MAX_EXCEEDED' };
    }

    const lastOnline = new Date(session.lastOnlineValidationAt).getTime();

    // Anti-tampering check on last online validation: clock moved backward by more than 1 minute
    if (now < lastOnline - 60000) {
      return { valid: false, daysRemaining: 0, reason: 'CLOCK_TAMPERING' };
    }

    const maxDays = session.offlineMaxDays || DEFAULT_OFFLINE_DAYS;
    const maxElapsedMs = maxDays * 24 * 60 * 60 * 1000;
    const elapsed = now - lastOnline;
    const remainingMs = maxElapsedMs - elapsed;

    if (remainingMs <= 0) {
      return { valid: false, daysRemaining: 0, reason: 'OFFLINE_MAX_EXCEEDED' };
    }

    const daysRemaining = Math.max(1, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)));
    return { valid: true, daysRemaining };
  },

  /**
   * Record meaningful user activity (clicks, keys, navigation)
   * Throttled to prevent excessive DPAPI disk I/O operations
   */
  async recordUserActivity(): Promise<boolean> {
    const now = Date.now();
    if (now - lastRecordedUserActivity < 15000) {
      return false; // Throttled
    }
    lastRecordedUserActivity = now;

    const current = memorySession || (await this.loadSecureSession());
    if (!current) return false;

    const updated: StoredSession = {
      ...current,
      lastActivityAt: new Date(now).toISOString(),
    };
    await this.saveSecureSession(updated);
    return true;
  },

  /**
   * Login with username and access code against Admin backend
   */
  async login(credentials: LoginCredentials): Promise<LoginResult> {
    const { username, accessCode } = credentials;
    if (!username || !accessCode) {
      return { success: false, error: 'اسم المستخدم ورمز الدخول مطلوبان' };
    }

    try {
      const res = await fetch(`${ADMIN_API_URL}/api/auth/desktop-verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          accessCode,
          deviceInfo: 'Compu MSS Desktop Application (Windows)',
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        return {
          success: false,
          error: data.error || 'بيانات الدخول غير صحيحة أو الحساب معطل',
        };
      }

      // Establish authenticated session with 7-day inactivity baseline
      const nowIso = new Date().toISOString();
      const storedSession: StoredSession = {
        sessionToken: data.sessionToken,
        user: {
          id: data.user.id,
          username: data.user.username,
          displayName: data.user.displayName,
          allowedModules: data.user.allowedModules,
          defaultStoreId: data.user.defaultStoreId,
          assignedStoreIds: data.user.assignedStoreIds || [],
          credentialVersion: data.user.credentialVersion || 1,
          permissionVersion: data.user.permissionVersion || 1,
        },
        expiresAt: data.expiresAt || new Date(Date.now() + 30 * 86400000).toISOString(),
        lastOnlineValidationAt: nowIso,
        lastActivityAt: nowIso,
        offlineMaxDays: DEFAULT_OFFLINE_DAYS,
        deviceInfo: 'Compu MSS Desktop Application (Windows)',
      };

      await this.saveSecureSession(storedSession);

      return {
        success: true,
        status: 'authenticated',
      };
    } catch (err: any) {
      // 1. If Admin API is offline, try direct Supabase RPC verification if available
      try {
        const { supabase } = await import('../lib/supabase.ts');
        const { data: rpcUser, error: rpcError } = await supabase.rpc('verify_desktop_credentials', {
          p_username: username.trim().toLowerCase(),
          p_access_code: accessCode,
        });

        if (!rpcError && rpcUser && rpcUser.length > 0 && rpcUser[0].user_id) {
          const u = rpcUser[0];
          const nowIso = new Date().toISOString();
          const sessionToken = `sess_rpc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
          const storedSession: StoredSession = {
            sessionToken,
            user: {
              id: u.user_id,
              username: u.username,
              displayName: u.display_name,
              allowedModules: u.allowed_modules,
              defaultStoreId: u.default_store_id,
              assignedStoreIds: u.default_store_id ? [u.default_store_id] : [],
              credentialVersion: u.credential_version || 1,
              permissionVersion: u.permission_version || 1,
            },
            expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
            lastOnlineValidationAt: nowIso,
            lastActivityAt: nowIso,
            offlineMaxDays: DEFAULT_OFFLINE_DAYS,
            deviceInfo: 'Compu MSS Desktop Application (Direct RPC)',
          };

          await this.saveSecureSession(storedSession);
          return { success: true, status: 'authenticated' };
        }
      } catch {
        // Fallback to local offline admin setup
      }

      // Network or connection failure
      return {
        success: false,
        error: 'تعذر الاتصال بخادم المصادقة. يرجى التحقق من اتصال الإنترنت أو تشغيل الخادم.',
      };
    }
  },

  /**
   * Revalidate an existing session with the server
   * Note: Passive background revalidations pass isUserAction = false so inactivity timer is NOT reset
   */
  async revalidateSession(sessionToken: string, isUserAction: boolean = false): Promise<{
    success: boolean;
    reason?: 'VALID' | 'SESSION_REVOKED' | 'SESSION_EXPIRED' | 'ACCOUNT_DISABLED' | 'CREDENTIAL_CHANGED' | 'NETWORK_ERROR';
    user?: AuthenticatedUser;
    expiresAt?: string;
    error?: string;
  }> {
    try {
      const res = await fetch(`${ADMIN_API_URL}/api/auth/desktop-revalidate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionToken, isUserAction }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        return {
          success: false,
          reason: data.reason || 'SESSION_REVOKED',
          error: data.error || 'تم إبطال الجلسة أو انتهت صلاحيتها',
        };
      }

      return {
        success: true,
        reason: 'VALID',
        user: data.user,
        expiresAt: data.expiresAt,
      };
    } catch {
      return {
        success: false,
        reason: 'NETWORK_ERROR',
        error: 'تعذر الاتصال بالخادم للتحقق من الجلسة',
      };
    }
  },

  /**
   * Terminate session remotely and locally
   */
  async logout(sessionToken?: string): Promise<void> {
    if (sessionToken) {
      try {
        await fetch(`${ADMIN_API_URL}/api/auth/desktop-logout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionToken }),
        });
      } catch {
        // Safe offline logout continues
      }
    }
    await this.clearSecureSession();
  },
};
