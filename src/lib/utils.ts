import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a number as currency in standard EGP format:
 * Examples: 1,500 EGP, 250 EGP, 75.50 EGP
 */
export function formatCurrency(amount: number, currency: string = 'EGP'): string {
  const safeAmount = typeof amount === 'number' && !isNaN(amount) ? amount : 0;
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(safeAmount);
  return `${formatted} ${currency}`;
}

/**
 * Format date in clear Arabic format
 */
export function formatDate(date: Date | string = new Date()): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('ar-EG', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(d);
}

/**
 * Format time in Arabic format
 */
export function formatTime(date: Date | string = new Date()): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('ar-EG', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(d);
}

/**
 * Format piece / unit count grammatically in Arabic:
 * - 0: نفد (أو النص المخصص)
 * - 1: 1 قطعة
 * - 2: 2 قطعة
 * - 3-10: X قطع (جمع تكسير)
 * - 11+: X قطعة (مفرد منصوب)
 */
export function formatPieceCount(
  count: number,
  optionsOrSuffix?: string | { zeroText?: string; suffix?: string }
): string {
  let zeroText = 'نفد';
  let suffix = '';

  if (typeof optionsOrSuffix === 'string') {
    suffix = optionsOrSuffix ? ` ${optionsOrSuffix}` : '';
  } else if (optionsOrSuffix) {
    if (optionsOrSuffix.zeroText !== undefined) zeroText = optionsOrSuffix.zeroText;
    if (optionsOrSuffix.suffix) suffix = ` ${optionsOrSuffix.suffix}`;
  }

  const safeCount = isNaN(count) ? 0 : Math.floor(count);

  if (safeCount <= 0) {
    return zeroText ? `${zeroText}${suffix}` : `0 قطعة${suffix}`;
  }
  if (safeCount === 1) return `1 قطعة${suffix}`;
  if (safeCount === 2) return `2 قطعة${suffix}`;

  const remainder = Math.abs(safeCount) % 100;
  if (remainder >= 3 && remainder <= 10) {
    return `${safeCount} قطع${suffix}`;
  }
  return `${safeCount} قطعة${suffix}`;
}

/**
 * Cross-platform safe storage wrapper (browser, webview, node, test environments)
 */
const memoryStore = new Map<string, string>();

export const safeStorage = {
  getItem(key: string): string | null {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(key);
      }
      if (typeof localStorage !== 'undefined') {
        return localStorage.getItem(key);
      }
    } catch {}
    return memoryStore.get(key) || null;
  },
  setItem(key: string, value: string): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
        return;
      }
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(key, value);
        return;
      }
    } catch {}
    memoryStore.set(key, value);
  },
  removeItem(key: string): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
        return;
      }
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(key);
        return;
      }
    } catch {}
    memoryStore.delete(key);
  },
};
export function generateUUID(): string {
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
