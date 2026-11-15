import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export interface PageRefreshContextValue {
  /** True whenever a full-page refresh operation is in flight */
  isRefreshing: boolean;
  /** Custom status message displayed under the prominent spinner */
  refreshMessage: string;
  /**
   * Triggers the full-page refresh lifecycle:
   * - Shows prominent centered loading animation over the page content
   * - Executes the asynchronous refresh function
   * - Prevents duplicate clicks
   * - Guarantees reset in finally
   */
  triggerRefresh: (refreshFn: () => Promise<any> | any, message?: string) => Promise<void>;
  /** Programmatic control to set refreshing state directly if needed */
  setIsRefreshing: (refreshing: boolean) => void;
  setRefreshMessage: (message: string) => void;
}

const PageRefreshContext = createContext<PageRefreshContextValue | undefined>(undefined);

export const PageRefreshProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [refreshMessage, setRefreshMessage] = useState<string>('جارٍ تحديث البيانات...');

  const triggerRefresh = useCallback(async (refreshFn: () => Promise<any> | any, message?: string) => {
    if (isRefreshing) return; // Prevent duplicate requests
    setIsRefreshing(true);
    if (message) {
      setRefreshMessage(message);
    } else {
      setRefreshMessage('جارٍ تحديث البيانات...');
    }

    try {
      // Execute the real asynchronous data refresh operation and guarantee a smooth visual
      // transition lifecycle (450ms) matching the natural MSS cloud refresh experience so that
      // local SQLite/memory queries in Accessories don't vanish before React can paint the animation.
      await Promise.all([
        refreshFn(),
        new Promise(resolve => setTimeout(resolve, 450)),
      ]);
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing]);

  return (
    <PageRefreshContext.Provider
      value={{
        isRefreshing,
        refreshMessage,
        triggerRefresh,
        setIsRefreshing,
        setRefreshMessage,
      }}
    >
      {children}
    </PageRefreshContext.Provider>
  );
};

export function usePageRefresh(): PageRefreshContextValue {
  const context = useContext(PageRefreshContext);
  if (!context) {
    throw new Error('usePageRefresh must be used within a PageRefreshProvider');
  }
  return context;
}
