import { useEffect, useRef } from 'react';

interface UseBarcodeScannerOptions {
  onScan: (barcode: string) => void;
  minChars?: number;
  maxIntervalMs?: number;
  enabled?: boolean;
}

/**
 * Hook to capture input from standard USB / Wireless keyboard-emulating barcode scanners.
 * 
 * Hardware scanners send alphanumeric keystrokes at very high speed (< 40ms interval)
 * followed by an 'Enter' key.
 */
export function useBarcodeScanner({
  onScan,
  minChars = 4,
  maxIntervalMs = 50,
  enabled = true,
}: UseBarcodeScannerOptions) {
  const bufferRef = useRef<string>('');
  const lastKeyTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing with modifier keys
      if (e.ctrlKey || e.altKey || e.metaKey) {
        return;
      }

      const now = Date.now();
      const timeSinceLastKey = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      // When Enter is pressed
      if (e.key === 'Enter') {
        if (bufferRef.current.length >= minChars) {
          const barcode = bufferRef.current;
          bufferRef.current = '';
          e.preventDefault();
          onScan(barcode);
          return;
        }
        bufferRef.current = '';
        return;
      }

      // Check if character is single printable char
      if (e.key.length === 1) {
        // If elapsed time is too long between characters, reset buffer (user is typing slowly by hand)
        if (timeSinceLastKey > maxIntervalMs && bufferRef.current.length > 0) {
          bufferRef.current = '';
        }

        bufferRef.current += e.key;

        // Auto-clean buffer after 500ms of inactivity to prevent stale garbage
        setTimeout(() => {
          if (Date.now() - lastKeyTimeRef.current > 400) {
            bufferRef.current = '';
          }
        }, 450);
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [onScan, minChars, maxIntervalMs, enabled]);
}
