import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { PublicInventoryItem } from '../types/inventory';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format currency amount into Egyptian Pounds (EGP / ج.م)
 */
export function formatEGP(amount: number): string {
  if (typeof amount !== 'number' || isNaN(amount)) {
    return '0 ج.م';
  }
  return new Intl.NumberFormat('ar-EG', {
    style: 'decimal',
    maximumFractionDigits: 0,
  }).format(amount) + ' ج.م';
}

/**
 * Build a concise, clean specification string from item properties
 */
export function getFormattedSpecs(item: PublicInventoryItem): string {
  const parts: string[] = [];

  if (item.processor && item.processor !== '-') {
    parts.push(item.processor);
  }
  if (item.gpu && item.gpu !== '-') {
    parts.push(item.gpu);
  }
  if (item.ram && item.ram !== '-') {
    parts.push(item.ram);
  }
  if (item.storage && item.storage !== '-') {
    parts.push(item.storage);
  }
  if (item.screen_size && item.screen_size !== '-') {
    parts.push(item.screen_size);
  }
  if (item.specifications && item.specifications !== '-') {
    parts.push(item.specifications);
  }

  return parts.length > 0 ? parts.join(' • ') : 'المواصفات القياسية';
}

/**
 * Format relative time in Arabic for the last-updated indicator
 */
export function formatRelativeTime(dateInput: Date | string | null): string {
  if (!dateInput) return 'غير محدد';
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return 'غير محدد';

  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHrs = Math.floor(diffMin / 60);

  if (diffSec < 30) {
    return 'منذ لحظات';
  } else if (diffSec < 60) {
    return `منذ ${diffSec} ثانية`;
  } else if (diffMin === 1) {
    return 'منذ دقيقة';
  } else if (diffMin === 2) {
    return 'منذ دقيقتين';
  } else if (diffMin <= 10) {
    return `منذ ${diffMin} دقائق`;
  } else if (diffMin < 60) {
    return `منذ ${diffMin} دقيقة`;
  } else if (diffHrs === 1) {
    return 'منذ ساعة';
  } else if (diffHrs === 2) {
    return 'منذ ساعتين';
  } else if (diffHrs <= 10) {
    return `منذ ${diffHrs} ساعات`;
  } else {
    return date.toLocaleTimeString('ar-EG', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}
