import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type {
  AppModule,
  AuthenticatedUser,
  StoredSession,
  AuthStatus,
  LoginCredentials,
  LoginResult,
  AuthContextType,
} from '../types/auth.ts';
import { desktopAuthService } from '../services/desktopAuthService.ts';
import { supabase } from '../lib/supabase.ts';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [session, setSession] = useState<StoredSession | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [offlineDaysRemaining, setOfflineDaysRemaining] = useState<number>(7);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Authoritative permission check
  const canAccess = useCallback(
    (module: 'accessories' | 'mss'): boolean => {
      if (!user) return false;
      if (status !== 'authenticated' && status !== 'offline_authorized') return false;
      return desktopAuthService.canAccess(module, user.allowedModules);
    },
    [user, status]
  );

  const requireAccess = useCallback(
    (module: 'accessories' | 'mss'): boolean => {
      const allowed = canAccess(module);
      if (!allowed) {
        throw new Error(`وصول غير مصرح: لا تملك صلاحية الوصول إلى قسم ${module}`);
      }
      return true;
    },
    [canAccess]
  );

  const clearError = useCallback(() => {
    setErrorMessage(null);
  }, []);

  // Revalidate session with backend
  // Note: Passive background revalidation does NOT reset inactivity timer
  const revalidate = useCallback(async (isUserAction: boolean = false): Promise<boolean> => {
    const currentSession = session || (await desktopAuthService.loadSecureSession());
    if (!currentSession) {
      setUser(null);
      setSession(null);
      setStatus('unauthenticated');
      return false;
    }

    // Check inactivity timeout first
    const inactivity = desktopAuthService.checkInactivityTimeout(currentSession);
    if (inactivity.expired) {
      await desktopAuthService.clearSecureSession();
      setUser(null);
      setSession(null);
      setStatus('inactivity_expired');
      setErrorMessage(
        'انتهت صلاحية الجلسة لعدم وجود أي نشاط لمدة 7 أيام متتالية (168 ساعة). يرجى تسجيل الدخول مجدداً.'
      );
      return false;
    }

    const res = await desktopAuthService.revalidateSession(currentSession.sessionToken, isUserAction);

    if (res.success && res.user) {
      // Case A & B: Session valid or permissions updated
      const updatedSession: StoredSession = {
        ...currentSession,
        user: res.user,
        expiresAt: res.expiresAt || currentSession.expiresAt,
        lastOnlineValidationAt: new Date().toISOString(),
        lastActivityAt: isUserAction ? new Date().toISOString() : currentSession.lastActivityAt,
      };
      await desktopAuthService.saveSecureSession(updatedSession);
      setUser(res.user);
      setSession(updatedSession);
      setStatus('authenticated');
      setOfflineDaysRemaining(updatedSession.offlineMaxDays || 7);
      return true;
    }

    if (res.reason === 'ACCOUNT_DISABLED') {
      // Case C: Account disabled
      await desktopAuthService.clearSecureSession();
      setUser(null);
      setSession(null);
      setStatus('account_disabled');
      setErrorMessage('تم تعطيل حسابك بواسطة مسؤول النظام');
      return false;
    }

    if (res.reason === 'CREDENTIAL_CHANGED') {
      // Case D: Access code changed
      await desktopAuthService.clearSecureSession();
      setUser(null);
      setSession(null);
      setStatus('credential_changed');
      setErrorMessage('تم تغيير رمز الدخول، يرجى إعادة تسجيل الدخول بالرمز الجديد');
      return false;
    }

    if (res.reason === 'SESSION_REVOKED' || res.reason === 'SESSION_EXPIRED') {
      // Case E: Session revoked or expired
      await desktopAuthService.clearSecureSession();
      setUser(null);
      setSession(null);
      setStatus('revoked');
      setErrorMessage(res.error || 'تم إبطال الجلسة، يرجى تسجيل الدخول مجدداً');
      return false;
    }

    // Case F: Network error while attempting online revalidation
    const offlineCheck = desktopAuthService.validateOfflineSession(currentSession);
    if (offlineCheck.valid) {
      setUser(currentSession.user);
      setSession(currentSession);
      setStatus('offline_authorized');
      setOfflineDaysRemaining(offlineCheck.daysRemaining);
      return true;
    } else {
      setStatus('offline_expired');
      setErrorMessage(
        'انتهت فترة السماح بالعمل بدون اتصال (7 أيام). يرجى الاتصال بالإنترنت لتأكيد الجلسة.'
      );
      return false;
    }
  }, [session]);

  // Initial startup restoration: check 7-day inactivity before restoring
  useEffect(() => {
    let isMounted = true;

    async function initAuth() {
      try {
        const stored = await desktopAuthService.loadSecureSession();
        if (!isMounted) return;

        if (!stored) {
          setStatus('unauthenticated');
          return;
        }

        // Evaluate 7-day inactivity before restoring session
        const inactivity = desktopAuthService.checkInactivityTimeout(stored);
        if (inactivity.expired) {
          await desktopAuthService.clearSecureSession();
          if (!isMounted) return;
          setUser(null);
          setSession(null);
          setStatus('inactivity_expired');
          setErrorMessage(
            'انتهت صلاحية الجلسة لعدم وجود أي نشاط لمدة 7 أيام متتالية (168 ساعة). يرجى تسجيل الدخول مجدداً.'
          );
          return;
        }

        // Active session within 7-day window: restore and touch activity
        const nowIso = new Date().toISOString();
        const activeSession: StoredSession = {
          ...stored,
          lastActivityAt: nowIso,
        };
        await desktopAuthService.saveSecureSession(activeSession);
        if (!isMounted) return;

        setUser(activeSession.user);
        setSession(activeSession);

        const online = typeof navigator !== 'undefined' ? navigator.onLine : true;
        setIsOnline(online);

        if (online) {
          // Attempt online revalidation
          const res = await desktopAuthService.revalidateSession(activeSession.sessionToken, true);
          if (!isMounted) return;

          if (res.success && res.user) {
            const updated: StoredSession = {
              ...activeSession,
              user: res.user,
              expiresAt: res.expiresAt || activeSession.expiresAt,
              lastOnlineValidationAt: new Date().toISOString(),
            };
            await desktopAuthService.saveSecureSession(updated);
            setUser(res.user);
            setSession(updated);
            setStatus('authenticated');
            setOfflineDaysRemaining(updated.offlineMaxDays || 7);
          } else if (res.reason === 'NETWORK_ERROR') {
            // Server down, fallback to offline policy
            const off = desktopAuthService.validateOfflineSession(activeSession);
            if (off.valid) {
              setUser(activeSession.user);
              setSession(activeSession);
              setStatus('offline_authorized');
              setOfflineDaysRemaining(off.daysRemaining);
            } else {
              setStatus('offline_expired');
              setErrorMessage('انتهت فترة السماح بالعمل بدون اتصال (7 أيام). يرجى الاتصال بالإنترنت.');
            }
          } else if (res.reason === 'ACCOUNT_DISABLED') {
            await desktopAuthService.clearSecureSession();
            setStatus('account_disabled');
            setErrorMessage('تم تعطيل حسابك بواسطة مسؤول النظام');
          } else if (res.reason === 'CREDENTIAL_CHANGED') {
            await desktopAuthService.clearSecureSession();
            setStatus('credential_changed');
            setErrorMessage('تم تغيير رمز الدخول، يرجى إعادة تسجيل الدخول بالرمز الجديد');
          } else {
            await desktopAuthService.clearSecureSession();
            setStatus('revoked');
            setErrorMessage(res.error || 'تم إبطال الجلسة');
          }
        } else {
          // Offline startup
          const off = desktopAuthService.validateOfflineSession(activeSession);
          if (off.valid) {
            setUser(activeSession.user);
            setSession(activeSession);
            setStatus('offline_authorized');
            setOfflineDaysRemaining(off.daysRemaining);
          } else {
            setStatus('offline_expired');
            setErrorMessage('انتهت فترة السماح بالعمل بدون اتصال (7 أيام). يرجى الاتصال بالإنترنت.');
          }
        }
      } catch (err) {
        console.error('Error during auth initialization:', err);
        if (isMounted) setStatus('unauthenticated');
      }
    }

    initAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  // Meaningful user interaction tracking & inactivity watchdog
  useEffect(() => {
    if (status !== 'authenticated' && status !== 'offline_authorized') return;

    // Meaningful user actions reset the activity timestamp
    const handleUserInteraction = () => {
      desktopAuthService.recordUserActivity().then((recorded) => {
        if (recorded) {
          setSession((prev) =>
            prev ? { ...prev, lastActivityAt: new Date().toISOString() } : null
          );
        }
      });
    };

    const events = ['mousedown', 'keydown', 'touchstart'];
    events.forEach((evt) => window.addEventListener(evt, handleUserInteraction, { passive: true }));

    // Watchdog: evaluate elapsed inactivity time every 30 seconds
    const watchdogInterval = setInterval(() => {
      if (!session) return;
      const check = desktopAuthService.checkInactivityTimeout(session);
      if (check.expired) {
        desktopAuthService.clearSecureSession().then(() => {
          setUser(null);
          setSession(null);
          setStatus('inactivity_expired');
          setErrorMessage(
            'انتهت صلاحية الجلسة لعدم وجود أي نشاط لمدة 7 أيام متتالية (168 ساعة). يرجى تسجيل الدخول مجدداً.'
          );
        });
      }
    }, 30000);

    // Watchdog on window focus or visibility change (e.g. computer wakes after 7 days)
    const handleFocusCheck = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible' && session) {
        const check = desktopAuthService.checkInactivityTimeout(session);
        if (check.expired) {
          desktopAuthService.clearSecureSession().then(() => {
            setUser(null);
            setSession(null);
            setStatus('inactivity_expired');
            setErrorMessage(
              'انتهت صلاحية الجلسة لعدم وجود أي نشاط لمدة 7 أيام متتالية (168 ساعة). يرجى تسجيل الدخول مجدداً.'
            );
          });
        }
      }
    };

    window.addEventListener('focus', handleFocusCheck);
    document.addEventListener('visibilitychange', handleFocusCheck);

    return () => {
      events.forEach((evt) => window.removeEventListener(evt, handleUserInteraction));
      clearInterval(watchdogInterval);
      window.removeEventListener('focus', handleFocusCheck);
      document.removeEventListener('visibilitychange', handleFocusCheck);
    };
  }, [status, session]);

  // Online / Offline window listeners & reconnection auto-revalidation
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      revalidate(false);
    };

    const handleOffline = () => {
      setIsOnline(false);
      if (session) {
        const off = desktopAuthService.validateOfflineSession(session);
        if (off.valid) {
          setStatus('offline_authorized');
          setOfflineDaysRemaining(off.daysRemaining);
        } else {
          setStatus('offline_expired');
        }
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [revalidate, session]);

  // Periodic passive background revalidation (every 30s)
  // Note: does NOT pass isUserAction, preserving the inactivity timer
  useEffect(() => {
    if (status !== 'authenticated' || !session) return;

    const interval = setInterval(() => {
      if (typeof navigator !== 'undefined' ? navigator.onLine : true) {
        revalidate(false);
      }
    }, 30000);

    return () => {
      clearInterval(interval);
    };
  }, [status, session, revalidate]);

  // Real-time permission & status synchronization via Supabase Realtime
  useEffect(() => {
    if (!user?.id || status !== 'authenticated') return;

    let channel: any = null;
    try {
      channel = supabase
        .channel(`user-sync-${user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'app_users',
            filter: `id=eq.${user.id}`,
          },
          () => {
            revalidate(false);
          }
        )
        .subscribe();
    } catch (err) {
      console.warn('Realtime sync subscription unavailable, relying on polling:', err);
    }

    return () => {
      if (channel) {
        try {
          supabase.removeChannel(channel);
        } catch {}
      }
    };
  }, [user?.id, status, revalidate]);

  // Login handler
  const login = async (credentials: LoginCredentials): Promise<LoginResult> => {
    setErrorMessage(null);
    const result = await desktopAuthService.login(credentials);
    if (result.success) {
      const stored = await desktopAuthService.loadSecureSession();
      if (stored) {
        setUser(stored.user);
        setSession(stored);
        setStatus('authenticated');
        setOfflineDaysRemaining(stored.offlineMaxDays || 7);
      }
    } else {
      setErrorMessage(result.error || 'بيانات الدخول غير صحيحة أو الحساب معطل');
    }
    return result;
  };

  // Logout handler
  const logout = async (): Promise<void> => {
    const token = session?.sessionToken;
    await desktopAuthService.logout(token);
    setUser(null);
    setSession(null);
    setStatus('unauthenticated');
    setErrorMessage(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        status,
        isOnline,
        isOfflineAuthorized: status === 'offline_authorized',
        offlineDaysRemaining,
        errorMessage,
        canAccess,
        requireAccess,
        login,
        logout,
        revalidate,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
