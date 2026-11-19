import React, { useState } from 'react';
import { useNavigation } from '../../context/NavigationContext';
import { Sidebar } from './Sidebar';
import { TopHeader } from './TopHeader';
import { AppFooter } from './AppFooter';
import { ToastContainer } from '../common/Toast';
import { NotificationDrawer } from '../common/NotificationDrawer';
import { ComponentShowcaseModal } from '../common/ComponentShowcaseModal';
import { SystemSettingsModal } from '../common/SystemSettingsModal';
import { PageRefreshOverlay } from '../common/PageRefreshOverlay';
import { ModuleGuard } from '../auth/ModuleGuard';

// Accessories Views
import { AccessoriesDashboardView } from '../placeholders/accessories/AccessoriesDashboardView';
import { ProductsView } from '../placeholders/accessories/ProductsView';
import { PurchasesView } from '../placeholders/accessories/PurchasesView';
import { InventoryView } from '../placeholders/accessories/InventoryView';
import { SalesView } from '../placeholders/accessories/SalesView';
import { InvoicesView } from '../placeholders/accessories/InvoicesView';
import { ReturnsView } from '../placeholders/accessories/ReturnsView';
import { ReportsView } from '../placeholders/accessories/ReportsView';
import { HistoryView } from '../placeholders/accessories/HistoryView';
import { BackupView } from '../placeholders/accessories/BackupView';

// MSS Views
import { MSSDashboardView } from '../placeholders/mss/MSSDashboardView';
import { CatalogView } from '../placeholders/mss/CatalogView';
import { MSSInventoryView } from '../placeholders/mss/MSSInventoryView';
import { MSSSalesView } from '../placeholders/mss/MSSSalesView';
import { ReservationsView } from '../placeholders/mss/ReservationsView';
import { MSSInvoicesView } from '../placeholders/mss/MSSInvoicesView';
import { MSSReturnsView } from '../placeholders/mss/MSSReturnsView';
import { MovementsView } from '../placeholders/mss/MovementsView';
import { MSSStoresView } from '../placeholders/mss/MSSStoresView';
import { MSSAuditLogView } from '../placeholders/mss/MSSAuditLogView';
import { MSSReportsView } from '../placeholders/mss/MSSReportsView';
import { MSSDeviceReportsView } from '../placeholders/mss/MSSDeviceReportsView';
import { SyncStatusView } from '../placeholders/mss/SyncStatusView';

export const AppShell: React.FC = () => {
  const { currentSection, currentRoute } = useNavigation();
  const [isShowcaseOpen, setShowcaseOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Render content dynamically based on currentSection and currentRoute
  const renderContent = () => {
    if (currentSection === 'accessories') {
      switch (currentRoute) {
        case 'dashboard':
          return <AccessoriesDashboardView />;
        case 'products':
          return <ProductsView />;
        case 'purchases':
          return <PurchasesView />;
        case 'inventory':
          return <InventoryView />;
        case 'sales':
          return <SalesView />;
        case 'invoices':
          return <InvoicesView />;
        case 'returns':
          return <ReturnsView />;
        case 'reports':
          return <ReportsView />;
        case 'history':
          return <HistoryView />;
        case 'backup':
          return <BackupView />;
        default:
          return <AccessoriesDashboardView />;
      }
    } else {
      switch (currentRoute) {
        case 'dashboard':
          return <MSSDashboardView />;
        case 'catalog':
          return <CatalogView />;
        case 'inventory':
          return <MSSInventoryView />;
        case 'sales':
          return <MSSSalesView />;
        case 'reservations':
          return <ReservationsView />;
        case 'invoices':
          return <MSSInvoicesView />;
        case 'returns':
          return <MSSReturnsView />;
        case 'movements':
          return <MovementsView />;
        case 'stores':
          return <MSSStoresView />;
        case 'audit':
          return <MSSAuditLogView />;
        case 'reports':
          return <MSSReportsView />;
        case 'device-reports':
          return <MSSDeviceReportsView />;
        case 'sync':
          return <SyncStatusView />;
        default:
          return <MSSDashboardView />;
      }
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 select-none">
      {/* Permanent Right Sidebar (RTL) */}
      <Sidebar onOpenSettings={() => setIsSettingsOpen(true)} />

      {/* Main Content Area */}
      <div className="flex flex-col flex-1 h-screen overflow-hidden relative">
        {/* Top Header */}
        <TopHeader
          onOpenShowcase={() => setShowcaseOpen(true)}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />

        {/* Scrollable Viewport */}
        <main className="flex-1 overflow-y-auto p-5 md:p-6 pb-2">
          <div className="max-w-7xl mx-auto pb-6">
            <ModuleGuard module={currentSection}>
              {renderContent()}
            </ModuleGuard>
          </div>
        </main>

        {/* Centralized Shared Application Footer with Copyright and Contact Notice */}
        <AppFooter />

        {/* Centralized Full-Page Refresh Loading Animation */}
        <PageRefreshOverlay className="top-16" />
      </div>

      {/* Toast Notifications Overlay */}
      <ToastContainer />

      {/* Slide-out Notification Drawer */}
      <NotificationDrawer />

      {/* Reusable Component Showcase Dialog */}
      <ComponentShowcaseModal
        isOpen={isShowcaseOpen}
        onClose={() => setShowcaseOpen(false)}
      />

      {/* System Settings & Startup with Windows Modal */}
      <SystemSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
};
