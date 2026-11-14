import React from 'react';
import { NavigationProvider } from './context/NavigationContext';
import { NotificationProvider } from './context/NotificationContext';
import { AppShell } from './components/layout/AppShell';

export const App: React.FC = () => {
  return (
    <NotificationProvider>
      <NavigationProvider>
        <AppShell />
      </NavigationProvider>
    </NotificationProvider>
  );
};

export default App;
