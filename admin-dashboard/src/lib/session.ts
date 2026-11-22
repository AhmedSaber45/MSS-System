import crypto from 'crypto';
import { createRequire } from 'module';
import type { AdminUser, ModulePermission } from '../types/admin';

export const SESSION_COOKIE_NAME = 'mss_admin_session';
export const INACTIVITY_TIMEOUT_DAYS = 7;
export const INACTIVITY_TIMEOUT_SECONDS = INACTIVITY_TIMEOUT_DAYS * 24 * 60 * 60; // 7 days (168 hours = 604,800 seconds)
export const INACTIVITY_TIMEOUT_MS = INACTIVITY_TIMEOUT_SECONDS * 1000;

function getCookieStore(): any {
  try {
    const req = typeof require !== 'undefined' ? require : createRequire(import.meta.url);
    const mod = req('next/headers');
    return mod.cookies();
  } catch {
    return null;
  }
}

function getSecretKey(): string {
  return (
    process.env.ADMIN_SESSION_SECRET ||
    'fallback_mss_admin_development_secret_key_32_bytes_safe_default_key'
  );
}

export interface SessionPayload {
  adminId: string;
  username: string;
  displayName: string;
  role: string;
  allowedModules?: ModulePermission;
  createdAt?: number;
  lastActivityAt?: number;
  exp: number;
}

/**
 * Signs a payload with HMAC SHA-256
 */
export function signSessionToken(payload: SessionPayload): string {
  const serialized = JSON.stringify(payload);
  const base64Payload = Buffer.from(serialized, 'utf-8').toString('base64url');
  const hmac = crypto.createHmac('sha256', getSecretKey());
  hmac.update(base64Payload);
  const signature = hmac.digest('base64url');
  return `${base64Payload}.${signature}`;
}

/**
 * Detailed inspection of session token verifying signature, expiry and 7-day inactivity
 */
export function inspectSessionToken(token: string): {
  valid: boolean;
  reason?: 'VALID' | 'SIGNATURE_INVALID' | 'EXPIRED' | 'INACTIVITY_TIMEOUT';
  payload?: SessionPayload;
} {
  if (!token || !token.includes('.')) {
    return { valid: false, reason: 'SIGNATURE_INVALID' };
  }
  const [base64Payload, signature] = token.split('.');
  if (!base64Payload || !signature) {
    return { valid: false, reason: 'SIGNATURE_INVALID' };
  }

  const hmac = crypto.createHmac('sha256', getSecretKey());
  hmac.update(base64Payload);
  const expectedSignature = hmac.digest('base64url');

  if (
    signature.length !== expectedSignature.length ||
    !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))
  ) {
    return { valid: false, reason: 'SIGNATURE_INVALID' };
  }

  try {
    const json = Buffer.from(base64Payload, 'base64url').toString('utf-8');
    const payload: SessionPayload = JSON.parse(json);

    const now = Date.now();

    // 1. Inactivity timeout check (168 hours since last recorded activity)
    const lastActive = payload.lastActivityAt || payload.createdAt || payload.exp - INACTIVITY_TIMEOUT_MS;
    if (now - lastActive >= INACTIVITY_TIMEOUT_MS) {
      return { valid: false, reason: 'INACTIVITY_TIMEOUT', payload };
    }

    // 2. Absolute expiration check
    if (now > payload.exp) {
      return { valid: false, reason: 'EXPIRED', payload };
    }

    return { valid: true, reason: 'VALID', payload };
  } catch {
    return { valid: false, reason: 'SIGNATURE_INVALID' };
  }
}

/**
 * Verifies and decodes a session token. Returns null if invalid or expired due to inactivity.
 */
export function verifySessionToken(token: string): SessionPayload | null {
  const result = inspectSessionToken(token);
  return result.valid && result.payload ? result.payload : null;
}

/**
 * Sets persistent session cookie on HTTP response (7-day inactivity window)
 */
export function setAdminSession(user: AdminUser, existingPayload?: Partial<SessionPayload>): void {
  const now = Date.now();
  const payload: SessionPayload = {
    adminId: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    allowedModules: user.allowedModules || (user.role === 'superadmin' ? 'both' : undefined),
    createdAt: existingPayload?.createdAt || now,
    lastActivityAt: now,
    exp: now + INACTIVITY_TIMEOUT_MS,
  };

  const token = signSessionToken(payload);
  const cookieStore = getCookieStore();
  if (cookieStore) {
    cookieStore.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: INACTIVITY_TIMEOUT_SECONDS,
      path: '/',
    });
  }
}

/**
 * Touches session timestamp on meaningful user interaction and extends the inactivity window
 */
export function touchAdminSession(): SessionPayload | null {
  const session = getAdminSession();
  if (!session) return null;

  const now = Date.now();
  const updated: SessionPayload = {
    ...session,
    lastActivityAt: now,
    exp: now + INACTIVITY_TIMEOUT_MS,
  };

  const token = signSessionToken(updated);
  const cookieStore = getCookieStore();
  if (cookieStore) {
    cookieStore.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: INACTIVITY_TIMEOUT_SECONDS,
      path: '/',
    });
  }

  return updated;
}

/**
 * Reads and validates admin session from cookies
 */
export function getAdminSession(): SessionPayload | null {
  const cookieStore = getCookieStore();
  if (!cookieStore) return null;
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);
  if (!sessionCookie || !sessionCookie.value) return null;
  return verifySessionToken(sessionCookie.value);
}

/**
 * Clears the session cookie (logout)
 */
export function clearAdminSession(): void {
  const cookieStore = getCookieStore();
  if (cookieStore) {
    cookieStore.delete(SESSION_COOKIE_NAME);
  }
}
