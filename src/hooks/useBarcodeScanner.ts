/**
 * Deprecated: Barcode functionality has been completely removed from MSS.
 * This hook is retained as a safe no-op to ensure backwards compatibility.
 */
export interface UseBarcodeScannerOptions {
  onScan?: (barcode: string) => void;
  minChars?: number;
  maxIntervalMs?: number;
  enabled?: boolean;
}

export function useBarcodeScanner(_options?: UseBarcodeScannerOptions) {
  // Safe no-op: barcode scanning is removed.
}
