'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ShieldCheck,
  Lock,
  User,
  Eye,
  EyeOff,
  AlertCircle,
  RefreshCw,
  KeyRound,
  Clock,
} from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inactivityNotice, setInactivityNotice] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('reason') === 'inactivity') {
        setInactivityNotice(true);
      }
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('يرجى إدخال اسم المستخدم وكلمة المرور');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'بيانات الدخول غير صحيحة');
      }

      if (typeof window !== 'undefined') {
        localStorage.setItem('mss_admin_last_activity_at', String(Date.now()));
      }

      router.push('/');
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء محاولة تسجيل الدخول');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#090d16] flex flex-col items-center justify-center p-4 selection:bg-sky-500/20 selection:text-sky-200">
      <div className="w-full max-w-[380px]">
        {/* Main Authentication Card */}
        <div className="bg-[#101625] border border-slate-800/90 rounded-2xl p-7 shadow-2xl space-y-6">
          {/* Brand Header */}
          <div className="text-center space-y-2.5">
            <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-700/80 flex items-center justify-center p-2 text-slate-200 mx-auto shadow-inner">
              <img
                src="/assets/branding/as_logo_gold.png"
                alt="AS System"
                className="w-full h-full object-contain select-none"
              />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-slate-100 tracking-tight">AS System</h1>
              <p className="text-xs text-slate-400 mt-0.5">لوحة تحكم الإدارة المركزية</p>
            </div>
          </div>

          {/* Inactivity Timeout Banner */}
          {inactivityNotice && (
            <div className="p-3 bg-amber-950/30 border border-amber-900/50 rounded-xl text-amber-200 text-xs flex items-start gap-2.5 animate-in fade-in duration-200">
              <Clock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span className="leading-relaxed">
                تم تسجيل الخروج تلقائياً لعدم وجود أي نشاط لمدة 7 أيام متتالية (168 ساعة). يرجى تسجيل الدخول مجدداً للمتابعة.
              </span>
            </div>
          )}

          {/* Error Message Alert */}
          {error && (
            <div className="p-3 bg-rose-950/30 border border-rose-900/50 rounded-xl text-rose-300 text-xs flex items-start gap-2.5 animate-in fade-in duration-200">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-300 font-medium mb-1.5">
                اسم المستخدم <span className="text-slate-500 font-normal">(Admin Username)</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  autoFocus
                  autoComplete="username"
                  placeholder="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full py-2.5 px-3 bg-[#0b0f19] border border-slate-800 rounded-lg text-slate-200 placeholder-slate-600 font-mono pr-9 focus:outline-none focus:border-sky-500/80 focus:ring-1 focus:ring-sky-500/20 transition-colors"
                />
                <User className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1.5">
                كلمة المرور <span className="text-slate-500 font-normal">(Password)</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full py-2.5 px-3 bg-[#0b0f19] border border-slate-800 rounded-lg text-slate-200 font-mono pr-9 pl-9 focus:outline-none focus:border-sky-500/80 focus:ring-1 focus:ring-sky-500/20 transition-colors"
                />
                <Lock className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2" />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                  aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-slate-100 hover:bg-white active:bg-slate-200 text-slate-900 font-semibold text-xs rounded-lg shadow-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 mt-2 cursor-pointer"
            >
              {loading ? (
                <RefreshCw className="w-4 h-4 animate-spin text-slate-900" />
              ) : (
                <KeyRound className="w-4 h-4 text-slate-800" />
              )}
              <span>{loading ? 'جاري التحقق...' : 'تسجيل الدخول الآمن'}</span>
            </button>
          </form>

          {/* Security Notice */}
          <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500 font-mono">
            <span>AS System v1.0.2</span>
            <span>جلسة نشطة 7 أيام</span>
          </div>
        </div>

        {/* Footer info */}
        <p className="text-center text-[11px] text-slate-600 mt-5">
          نظام الإدارة المركزي لشركة ومحلات Compu MSS
        </p>
      </div>
    </div>
  );
}
