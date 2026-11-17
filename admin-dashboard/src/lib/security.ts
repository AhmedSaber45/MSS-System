import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const BCRYPT_SALT_ROUNDS = 10;

/**
 * Normalizes username (lowercase, trimmed)
 */
export function normalizeUsername(username: string): string {
  if (!username) return '';
  return username.trim().toLowerCase();
}

/**
 * Validates username format
 */
export function validateUsername(username: string): { valid: boolean; error?: string } {
  const normalized = normalizeUsername(username);
  if (!normalized || normalized.length < 3) {
    return { valid: false, error: 'اسم المستخدم يجب ألا يقل عن 3 أحرف' };
  }
  if (!/^[a-zA-Z0-9_\u0600-\u06FF.-]+$/.test(normalized)) {
    return { valid: false, error: 'اسم المستخدم يحتوي على رموز غير مسموح بها' };
  }
  return { valid: true };
}

/**
 * Validates access code requirements
 */
export function validateAccessCode(code: string): { valid: boolean; error?: string } {
  if (!code || typeof code !== 'string') {
    return { valid: false, error: 'رمز الدخول مطلوب' };
  }
  const trimmed = code.trim();
  if (trimmed.length < 4) {
    return { valid: false, error: 'رمز الدخول يجب ألا يقل عن 4 خانات' };
  }
  return { valid: true };
}

/**
 * Server-side secure hashing for desktop user access code using bcrypt
 */
export async function hashAccessCode(accessCode: string): Promise<string> {
  const validation = validateAccessCode(accessCode);
  if (!validation.valid) {
    throw new Error(validation.error || 'رمز الدخول غير صالح');
  }
  return bcrypt.hash(accessCode.trim(), BCRYPT_SALT_ROUNDS);
}

/**
 * Verifies access code against bcrypt hash
 */
export async function verifyAccessCode(accessCode: string, hash: string): Promise<boolean> {
  if (!accessCode || !hash) return false;
  try {
    return await bcrypt.compare(accessCode.trim(), hash);
  } catch {
    return false;
  }
}

/**
 * Server-side hashing for admin login password
 */
export async function hashPassword(password: string): Promise<string> {
  if (!password || password.length < 6) {
    throw new Error('كلمة المرور يجب ألا تقل عن 6 أحرف');
  }
  return bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
}

/**
 * Verifies admin password
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (!password || !hash) return false;
  try {
    return await bcrypt.compare(password, hash);
  } catch {
    return false;
  }
}

/**
 * Strips sensitive hashes from any user object before returning to client or logging
 */
export function sanitizeUser<T extends object>(user: T): Omit<T, 'access_code_hash' | 'password_hash'> {
  const copy = { ...user } as Record<string, unknown>;
  delete copy.access_code_hash;
  delete copy.password_hash;
  return copy as unknown as Omit<T, 'access_code_hash' | 'password_hash'>;
}

// In-memory brute-force protection tracker (per IP or username)
interface AttemptRecord {
  attempts: number;
  lastAttempt: number;
  blockedUntil?: number;
}

const loginAttempts = new Map<string, AttemptRecord>();
const MAX_ATTEMPTS = 5;
const BLOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes lockout

export function checkRateLimit(key: string): { allowed: boolean; remainingMs?: number } {
  const now = Date.now();
  const record = loginAttempts.get(key);

  if (!record) {
    return { allowed: true };
  }

  if (record.blockedUntil && record.blockedUntil > now) {
    return { allowed: false, remainingMs: record.blockedUntil - now };
  }

  // Reset if last attempt was longer than block duration ago
  if (now - record.lastAttempt > BLOCK_DURATION_MS) {
    loginAttempts.delete(key);
    return { allowed: true };
  }

  return { allowed: true };
}

export function recordFailedAttempt(key: string): void {
  const now = Date.now();
  const record = loginAttempts.get(key) || { attempts: 0, lastAttempt: now };
  record.attempts += 1;
  record.lastAttempt = now;

  if (record.attempts >= MAX_ATTEMPTS) {
    record.blockedUntil = now + BLOCK_DURATION_MS;
  }

  loginAttempts.set(key, record);
}

export function clearRateLimit(key: string): void {
  loginAttempts.delete(key);
}

/**
 * Generates a cryptographically secure random session token for desktop app sessions
 */
export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Hashes a session token with SHA-256 for secure database lookup
 */
export function hashSessionToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
