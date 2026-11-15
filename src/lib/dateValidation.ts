/**
 * MSS Global Date Filter Validation Utility
 * Enforces local date formatting, prevents future date selection,
 * validates date ranges (From <= To), and provides reactive hooks for UI filters.
 */

import { useState, useCallback, useMemo } from 'react';

/**
 * Returns the current local date formatted as YYYY-MM-DD
 * using the user's local timezone (never UTC ISO slice which drifts across midnight).
 */
export function getTodayLocalDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Validates whether a date string is in YYYY-MM-DD format
 */
export function isValidDateString(str: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return false;
  const d = new Date(str);
  return !isNaN(d.getTime());
}

/**
 * Checks if a given date string is in the future compared to local today
 */
export function isFutureDate(dateStr: string): boolean {
  if (!dateStr) return false;
  const today = getTodayLocalDateString();
  return dateStr > today;
}

export interface DateValidationResult {
  isValid: boolean;
  error?: string;
  sanitizedStart?: string;
  sanitizedEnd?: string;
}

export interface DateValidationOptions {
  allowFuture?: boolean;
}

/**
 * Validates a date range [startDate, endDate]
 * 1. Disallows future dates (unless allowFuture: true)
 * 2. Enforces startDate <= endDate
 * 3. Handles empty or single-ended filters safely
 */
export function validateDateRange(
  startDate?: string,
  endDate?: string,
  options: DateValidationOptions = {}
): DateValidationResult {
  const { allowFuture = false } = options;
  const today = getTodayLocalDateString();

  const cleanStart = startDate?.trim() || undefined;
  const cleanEnd = endDate?.trim() || undefined;

  // 1. Check start date format
  if (cleanStart && !isValidDateString(cleanStart)) {
    return {
      isValid: false,
      error: 'تاريخ البداية غير صالح. يرجى استخدام صيغة سنة-شهر-يوم (YYYY-MM-DD).',
    };
  }

  // 2. Check end date format
  if (cleanEnd && !isValidDateString(cleanEnd)) {
    return {
      isValid: false,
      error: 'تاريخ النهاية غير صالح. يرجى استخدام صيغة سنة-شهر-يوم (YYYY-MM-DD).',
    };
  }

  // 3. Disallow future dates if not allowed
  if (!allowFuture) {
    if (cleanStart && cleanStart > today) {
      return {
        isValid: false,
        error: `لا يمكن اختيار تاريخ بداية في المستقبل (${cleanStart}). أقصى تاريخ مسموح هو اليوم (${today}).`,
        sanitizedStart: today,
        sanitizedEnd: cleanEnd,
      };
    }
    if (cleanEnd && cleanEnd > today) {
      return {
        isValid: false,
        error: `لا يمكن اختيار تاريخ نهاية في المستقبل (${cleanEnd}). أقصى تاريخ مسموح هو اليوم (${today}).`,
        sanitizedStart: cleanStart,
        sanitizedEnd: today,
      };
    }
  }

  // 4. Validate range ordering: startDate <= endDate
  if (cleanStart && cleanEnd && cleanStart > cleanEnd) {
    return {
      isValid: false,
      error: `تاريخ البداية (${cleanStart}) لا يمكن أن يكون لاحقاً لتاريخ النهاية (${cleanEnd}).`,
      sanitizedStart: cleanEnd,
      sanitizedEnd: cleanStart,
    };
  }

  return {
    isValid: true,
    sanitizedStart: cleanStart,
    sanitizedEnd: cleanEnd,
  };
}

export interface UseDateRangeFilterOptions extends DateValidationOptions {
  initialStart?: string;
  initialEnd?: string;
  onFilterChange?: (start?: string, end?: string) => void;
}

export interface UseDateRangeFilterReturn {
  startDate: string;
  endDate: string;
  error: string;
  isValid: boolean;
  today: string;
  maxStartDate: string;
  minEndDate?: string;
  maxEndDate: string;
  setStartDate: (val: string) => void;
  setEndDate: (val: string) => void;
  setDateRange: (start: string, end: string) => void;
  clearDateRange: () => void;
  reset: () => void;
  validateAndGetDates: () => { start?: string; end?: string; isValid: boolean };
}

/**
 * Reusable React Hook for Date-Range filtering across all modules
 */
export function useDateRangeFilter(
  options: UseDateRangeFilterOptions = {}
): UseDateRangeFilterReturn {
  const { allowFuture = false, initialStart = '', initialEnd = '', onFilterChange } = options;

  const today = useMemo(() => getTodayLocalDateString(), []);

  const [startDate, setRawStartDate] = useState<string>(initialStart);
  const [endDate, setRawEndDate] = useState<string>(initialEnd);
  const [error, setError] = useState<string>('');

  // Validate on the fly
  const validation = useMemo(() => {
    return validateDateRange(startDate, endDate, { allowFuture });
  }, [startDate, endDate, allowFuture]);

  const isValid = validation.isValid;

  const setStartDate = useCallback(
    (val: string) => {
      const trimmed = val.trim();
      if (!allowFuture && trimmed && trimmed > today) {
        setError(`لا يمكن اختيار تاريخ في المستقبل. تم الضبط على اليوم (${today}).`);
        setRawStartDate(today);
        if (onFilterChange) onFilterChange(today, endDate || undefined);
        return;
      }

      if (endDate && trimmed && trimmed > endDate) {
        setError('تاريخ البداية لا يمكن أن يتجاوز تاريخ النهاية.');
      } else {
        setError('');
      }

      setRawStartDate(trimmed);
      if (onFilterChange) {
        const nextValidation = validateDateRange(trimmed, endDate, { allowFuture });
        if (nextValidation.isValid) {
          onFilterChange(trimmed || undefined, endDate || undefined);
        }
      }
    },
    [allowFuture, today, endDate, onFilterChange]
  );

  const setEndDate = useCallback(
    (val: string) => {
      const trimmed = val.trim();
      if (!allowFuture && trimmed && trimmed > today) {
        setError(`لا يمكن اختيار تاريخ في المستقبل. تم الضبط على اليوم (${today}).`);
        setRawEndDate(today);
        if (onFilterChange) onFilterChange(startDate || undefined, today);
        return;
      }

      if (startDate && trimmed && trimmed < startDate) {
        setError('تاريخ النهاية لا يمكن أن يكون قبل تاريخ البداية.');
      } else {
        setError('');
      }

      setRawEndDate(trimmed);
      if (onFilterChange) {
        const nextValidation = validateDateRange(startDate, trimmed, { allowFuture });
        if (nextValidation.isValid) {
          onFilterChange(startDate || undefined, trimmed || undefined);
        }
      }
    },
    [allowFuture, today, startDate, onFilterChange]
  );

  const setDateRange = useCallback(
    (start: string, end: string) => {
      const res = validateDateRange(start, end, { allowFuture });
      if (!res.isValid) {
        setError(res.error || 'نطاق التاريخ غير صالح');
      } else {
        setError('');
      }
      setRawStartDate(start);
      setRawEndDate(end);
      if (res.isValid && onFilterChange) {
        onFilterChange(start || undefined, end || undefined);
      }
    },
    [allowFuture, onFilterChange]
  );

  const clearDateRange = useCallback(() => {
    setRawStartDate('');
    setRawEndDate('');
    setError('');
    if (onFilterChange) onFilterChange(undefined, undefined);
  }, [onFilterChange]);

  const validateAndGetDates = useCallback(() => {
    const res = validateDateRange(startDate, endDate, { allowFuture });
    if (!res.isValid) {
      setError(res.error || 'نطاق التاريخ غير صالح');
      return { isValid: false };
    }
    setError('');
    return {
      isValid: true,
      start: startDate || undefined,
      end: endDate || undefined,
    };
  }, [startDate, endDate, allowFuture]);

  // Derived input bounds
  const maxStartDate = useMemo(() => {
    if (allowFuture) return endDate || '';
    if (endDate && endDate < today) return endDate;
    return today;
  }, [allowFuture, endDate, today]);

  const minEndDate = useMemo(() => {
    return startDate || undefined;
  }, [startDate]);

  const maxEndDate = useMemo(() => {
    return allowFuture ? '' : today;
  }, [allowFuture, today]);

  return {
    startDate,
    endDate,
    error: error || (validation.error ?? ''),
    isValid,
    today,
    maxStartDate,
    minEndDate,
    maxEndDate,
    setStartDate,
    setEndDate,
    setDateRange,
    clearDateRange,
    reset: clearDateRange,
    validateAndGetDates,
  };
}
