'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AdminSidebar, NavTab } from '@/components/layout/AdminSidebar';
import { AdminHeader } from '@/components/layout/AdminHeader';
import { OverviewView } from '@/components/overview/OverviewView';
import { UsersView } from '@/components/users/UsersView';
import { RefreshCw } from 'lucide-react';

export default function AdminDashboardPage() {
  const router = useRouter();
  const [currentTab, setCurrentTab] = useState<NavTab>('overview');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [adminUser, setAdminUser] = useState<{ id: string; username: string; displayName: string; role: string } | null>(
    null
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/auth/me');
        if (!res.ok) {
          router.push('/login');
          return;
        }
        const data = await res.json();
        setAdminUser(data.admin);
      } catch {
        router.push('/login');
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, [router]);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Handled
    }
    router.push('/login');
    router.refresh();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center text-slate-400 gap-3">
        <RefreshCw className="w-8 h-8 animate-spin text-brand-primary" />
        <p className="text-sm">جاري التحقق من الصلاحيات الإدارية...</p>
      </div>
    );
  }

  if (!adminUser) return null;

  return (
    <div className="min-h-screen bg-brand-bg flex text-slate-100 selection:bg-brand-primary selection:text-white">
      {/* Sidebar Navigation */}
      <AdminSidebar
        currentTab={currentTab}
        onTabChange={(tab) => setCurrentTab(tab)}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 lg:mr-72">
        {/* Sticky Header */}
        <AdminHeader
          currentTab={currentTab}
          adminName={adminUser.displayName}
          adminRole={adminUser.role}
          onLogout={handleLogout}
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        />

        {/* Dynamic View Container */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {currentTab === 'overview' && <OverviewView onNavigate={(tab) => setCurrentTab(tab)} />}
          {currentTab === 'users' && <UsersView />}
        </main>
      </div>
    </div>
  );
}
