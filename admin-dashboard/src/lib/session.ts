import crypto from 'crypto';
import { cookies } from 'next/headers';
import type { AdminUser, ModulePermission } from '../types/admin';

const SESSION_COOKIE_NAME = 'mss_admin_session';
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12; // 12 hours

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
 * Verifies and decodes a session token
 */
export function verifySessionToken(token: string): SessionPayload | null {
  if (!token || !token.includes('.')) return null;
  const [base64Payload, signature] = token.split('.');
  if (!base64Payload || !signature) return null;

  const hmac = crypto.createHmac('sha256', getSecretKey());
  hmac.update(base64Payload);
  const expectedSignature = hmac.digest('base64url');

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
    return null;
  }

  try {
    const json = Buffer.from(base64Payload, 'base64url').toString('utf-8');
    const payload: SessionPayload = JSON.parse(json);

    if (Date.now() > payload.exp) {
      return null; // Expired
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Sets session cookie on HTTP response
 */
export function setAdminSession(user: AdminUser): void {
  const payload: SessionPayload = {
    adminId: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    allowedModules: user.allowedModules || (user.role === 'superadmin' ? 'both' : undefined),
    exp: Date.now() + SESSION_MAX_AGE_SECONDS * 1000,
  };

  const token = signSessionToken(payload);
  const cookieStore = cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: '/',
  });
}

/**
 * Reads and validates admin session from cookies
 */
export function getAdminSession(): SessionPayload | null {
  const cookieStore = cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);
  if (!sessionCookie || !sessionCookie.value) return null;
  return verifySessionToken(sessionCookie.value);
}

/**
 * Clears the session cookie (logout)
 */
export function clearAdminSession(): void {
  const cookieStore = cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}
