import React from 'react';
import { NavigationProvider } from './context/NavigationContext';
import { NotificationProvider } from './context/NotificationContext';
import { PageRefreshProvider } from './context/PageRefreshContext';
import { AppShell } from './components/layout/AppShell';

export const App: React.FC = () => {
  return (
    <NotificationProvider>
      <NavigationProvider>
        <PageRefreshProvider>
          <AppShell />
        </PageRefreshProvider>
      </NavigationProvider>
    </NotificationProvider>
  );
};

export default App;
