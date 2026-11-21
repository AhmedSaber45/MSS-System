import { useState, useEffect, useCallback } from 'react';
import { mssOperationalService } from '../services/mssOperationalService.ts';
import type { SystemStore } from '../types/mssOperational.ts';

export interface UseMSSLocationsResult {
  locations: string[];
  stores: SystemStore[];
  isLoading: boolean;
  refresh: () => Promise<void>;
}

/**
 * Custom React hook that connects to the single dynamic source of truth for Compu MSS
 * branches, stores, and warehouses (public.system_stores).
 *
 * Automatically re-renders whenever a branch is added, edited, archived, or merged.
 */
export function useMSSLocations(): UseMSSLocationsResult {
  const [locations, setLocations] = useState<string[]>(() =>
    mssOperationalService.getActiveLocationNamesSync()
  );
  const [stores, setStores] = useState<SystemStore[]>(() =>
    mssOperationalService.getActiveStoresSync()
  );
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const active = await mssOperationalService.getActiveStores();
      setStores(active);
      const names = active.map(s => s.name.trim()).filter(Boolean);
      setLocations(names);
    } catch {
      setLocations(mssOperationalService.getActiveLocationNamesSync());
      setStores(mssOperationalService.getActiveStoresSync());
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const handleStoresChanged = () => {
      refresh();
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('mss-stores-changed', handleStoresChanged);
      return () => {
        window.removeEventListener('mss-stores-changed', handleStoresChanged);
      };
    }
  }, [refresh]);

  return { locations, stores, isLoading, refresh };
}
