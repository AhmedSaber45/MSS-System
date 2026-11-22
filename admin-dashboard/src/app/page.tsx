'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AdminSidebar, NavTab } from '@/components/layout/AdminSidebar';
import { AdminHeader } from '@/components/layout/AdminHeader';
import { OverviewView } from '@/components/overview/OverviewView';
import { UsersView } from '@/components/users/UsersView';
import { RefreshCw } from 'lucide-react';

const INACTIVITY_TIMEOUT_MS = 7 * 24 * 60 * 60 * 1000; // 7 days (168 hours)
const STORAGE_KEY = 'mss_admin_last_activity_at';

export default function AdminDashboardPage() {
  const router = useRouter();
  const [currentTab, setCurrentTab] = useState<NavTab>('overview');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [adminUser, setAdminUser] = useState<{
    id: string;
    username: string;
    displayName: string;
    role: string;
    allowedModules?: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  const handleLogout = useCallback(
    async (reason?: string) => {
      try {
        await fetch('/api/auth/logout', { method: 'POST' });
      } catch {
        // Handled
      }
      if (typeof window !== 'undefined') {
        localStorage.removeItem(STORAGE_KEY);
      }
      if (reason === 'inactivity') {
        router.push('/login?reason=inactivity');
      } else {
        router.push('/login');
      }
      router.refresh();
    },
    [router]
  );

  useEffect(() => {
    let isMounted = true;

    const checkAuth = async () => {
      // 1. Inactivity check on initial startup
      if (typeof window !== 'undefined') {
        const storedLast = localStorage.getItem(STORAGE_KEY);
        const now = Date.now();
        if (storedLast) {
          const elapsed = now - parseInt(storedLast, 10);
          if (elapsed >= INACTIVITY_TIMEOUT_MS) {
            localStorage.removeItem(STORAGE_KEY);
            handleLogout('inactivity');
            return;
          }
        }
        localStorage.setItem(STORAGE_KEY, String(now));
      }

      try {
        const res = await fetch('/api/auth/me?touch=true', {
          headers: { 'x-user-action': 'true' },
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          if (data.reason === 'INACTIVITY_TIMEOUT') {
            handleLogout('inactivity');
          } else {
            router.push('/login');
          }
          return;
        }

        const data = await res.json();
        if (isMounted) {
          setAdminUser(data.admin);
        }
      } catch {
        if (isMounted) router.push('/login');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    checkAuth();

    return () => {
      isMounted = false;
    };
  }, [router, handleLogout]);

  // Meaningful user interaction tracking (clicks, keys, touch, scroll)
  useEffect(() => {
    if (!adminUser) return;

    let lastRecorded = Date.now();
    let lastPing = Date.now();

    const handleUserInteraction = () => {
      const current = Date.now();
      // Throttle localStorage updates to at most once every 10 seconds
      if (current - lastRecorded > 10000) {
        lastRecorded = current;
        localStorage.setItem(STORAGE_KEY, String(current));
      }

      // Throttle server session touch to at most once every 3 minutes
      if (current - lastPing > 3 * 60 * 1000) {
        lastPing = current;
        fetch('/api/auth/touch', { method: 'POST' }).catch(() => {});
      }
    };

    const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach((evt) => window.addEventListener(evt, handleUserInteraction, { passive: true }));

    // Periodic watchdog: evaluate elapsed inactivity time every 30 seconds
    const interval = setInterval(() => {
      const lastActive = parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10);
      if (lastActive > 0 && Date.now() - lastActive >= INACTIVITY_TIMEOUT_MS) {
        localStorage.removeItem(STORAGE_KEY);
        handleLogout('inactivity');
      }
    }, 30000);

    // Watchdog on window focus or visibility change (e.g. computer wakes from sleep after 7 days)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const lastActive = parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10);
        if (lastActive > 0 && Date.now() - lastActive >= INACTIVITY_TIMEOUT_MS) {
          localStorage.removeItem(STORAGE_KEY);
          handleLogout('inactivity');
        }
      }
    };

    window.addEventListener('focus', handleVisibilityChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      events.forEach((evt) => window.removeEventListener(evt, handleUserInteraction));
      clearInterval(interval);
      window.removeEventListener('focus', handleVisibilityChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [adminUser, handleLogout]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#090d16] flex items-center justify-center text-slate-400 gap-2.5 font-mono text-xs">
        <RefreshCw className="w-5 h-5 animate-spin text-sky-400" />
        <p>جاري التحقق من الصلاحيات الإدارية واستعادة الجلسة...</p>
      </div>
    );
  }

  if (!adminUser) return null;

  return (
    <div className="min-h-screen bg-[#090d16] flex text-slate-100 selection:bg-sky-500/20 selection:text-sky-200">
      {/* Sidebar Navigation */}
      <AdminSidebar
        currentTab={currentTab}
        onTabChange={(tab) => setCurrentTab(tab)}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 lg:mr-64">
        {/* Sticky Header */}
        <AdminHeader
          currentTab={currentTab}
          adminName={adminUser.displayName}
          adminRole={adminUser.role}
          onLogout={() => handleLogout()}
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        />

        {/* Dynamic View Container */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {currentTab === 'overview' && (
            <OverviewView onNavigate={(tab) => setCurrentTab(tab)} adminUser={adminUser} />
          )}
          {currentTab === 'users' && <UsersView />}
        </main>
      </div>
    </div>
  );
}
