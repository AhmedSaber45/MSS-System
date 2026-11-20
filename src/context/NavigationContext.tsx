import React, { createContext, useContext, useState, useEffect } from 'react';
import { AppSection, AccessoriesRoute, MSSRoute, ActiveRoute } from '../types/navigation';
import { useAuth } from './AuthContext';

interface NavigationContextType {
  currentSection: AppSection;
  currentRoute: ActiveRoute;
  routeParams: Record<string, any>;
  setSection: (section: AppSection) => void;
  setRoute: (route: ActiveRoute, params?: Record<string, any>) => void;
  clearRouteParams: () => void;
  isSidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export const NavigationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, canAccess } = useAuth();

  // Determine initial section based on user permissions
  const initialSection: AppSection =
    user?.allowedModules === 'mss' ? 'mss' : 'accessories';

  const [currentSection, setCurrentSectionState] = useState<AppSection>(initialSection);
  const [accessoriesRoute, setAccessoriesRoute] = useState<AccessoriesRoute>('dashboard');
  const [mssRoute, setMssRoute] = useState<MSSRoute>('dashboard');
  const [routeParams, setRouteParams] = useState<Record<string, any>>({});
  const [isSidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);

  // Sync section if user permission changes or on login
  useEffect(() => {
    if (user) {
      const hasAcc = canAccess('accessories');
      const hasMss = canAccess('mss');
      if (!hasAcc && hasMss && currentSection !== 'mss') {
        setCurrentSectionState('mss');
      } else if (!hasMss && hasAcc && currentSection !== 'accessories') {
        setCurrentSectionState('accessories');
      }
    }
  }, [user, currentSection, canAccess]);

  const currentRoute = currentSection === 'accessories' ? accessoriesRoute : mssRoute;

  const setSection = (section: AppSection) => {
    // Authoritative check before setting section
    if (!canAccess(section)) {
      console.warn(`Denied attempt to navigate to unauthorized section: ${section}`);
      return;
    }
    setCurrentSectionState(section);
  };

  const setRoute = (route: ActiveRoute, params?: Record<string, any>) => {
    if (params) {
      setRouteParams(params);
    } else {
      setRouteParams({});
    }
    if (currentSection === 'accessories') {
      setAccessoriesRoute(route as AccessoriesRoute);
    } else {
      setMssRoute(route as MSSRoute);
    }
  };

  const clearRouteParams = () => {
    setRouteParams({});
  };

  const toggleSidebar = () => {
    setSidebarCollapsed(prev => !prev);
  };

  // Keyboard shortcut support (e.g. Esc or Ctrl+B to toggle sidebar)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <NavigationContext.Provider
      value={{
        currentSection,
        currentRoute,
        routeParams,
        setSection,
        setRoute,
        clearRouteParams,
        isSidebarCollapsed,
        toggleSidebar,
        setSidebarCollapsed,
      }}
    >
      {children}
    </NavigationContext.Provider>
  );
};

export const useNavigation = (): NavigationContextType => {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  return context;
};
