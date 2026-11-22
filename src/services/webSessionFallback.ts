import type { StoredSession } from '../types/auth.ts';

const BROWSER_SESSION_KEY = 'mss_desktop_session_fallback_v1';

/**
 * Web session fallback for non-Tauri / browser environments (e.g. npm run dev).
 * Persists session token and metadata across browser reloads without storing plain passwords.
 */
export const webSessionFallback = {
  save(session: StoredSession): void {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(BROWSER_SESSION_KEY, JSON.stringify(session));
    } catch {
      // LocalStorage unavailable or quota exceeded
    }
  },

  load(): StoredSession | null {
    if (typeof window === 'undefined') return null;
    try {
      const raw = window.localStorage.getItem(BROWSER_SESSION_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed && parsed.sessionToken && parsed.user) {
        return parsed as StoredSession;
      }
      return null;
    } catch {
      return null;
    }
  },

  clear(): void {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.removeItem(BROWSER_SESSION_KEY);
    } catch {
      // LocalStorage unavailable
    }
  },
};
