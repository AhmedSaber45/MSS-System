'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Lock, User, Eye, EyeOff, ShieldCheck, AlertCircle, RefreshCw, Zap } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const performLogin = async (usr: string, pwd: string) => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: usr, password: pwd }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'فشل في تسجيل الدخول');
      }

      router.push('/');
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء تسجيل الدخول');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await performLogin(username, password);
  };

  const handleQuickLogin = async () => {
    setUsername('admin');
    setPassword('adminMSS@2026');
    await performLogin('admin', 'adminMSS@2026');
  };

  return (
    <div className="min-h-screen bg-brand-bg flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Brand Card */}
        <div className="bg-brand-card border border-brand-border rounded-2xl p-6 sm:p-7 shadow-sm space-y-5">
          {/* Logo & Header */}
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center text-white mx-auto shadow-sm">
              <Building2 className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold text-white tracking-wide">Compu MSS</h1>
            <p className="text-xs text-slate-400 font-medium">لوحة تحكم الإدارة المركزية</p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-rose-950/40 border border-rose-900/50 rounded-xl text-rose-300 text-xs flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-300 font-semibold mb-1.5">اسم مستخدم المدير (Admin Username)</label>
              <div className="relative">
                <input
                  type="text"
                  required
                  placeholder="admin"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full p-2.5 bg-brand-surface border border-brand-border rounded-lg text-slate-200 placeholder-slate-500 font-mono pr-9 focus:outline-none focus:border-blue-500 transition-colors"
                />
                <User className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1.5">كلمة المرور (Password)</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full p-2.5 bg-brand-surface border border-brand-border rounded-lg text-slate-200 font-mono pr-9 pl-9 focus:outline-none focus:border-blue-500 transition-colors"
                />
                <Lock className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-semibold text-xs rounded-lg shadow-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50 mt-1 cursor-pointer"
            >
              {loading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <ShieldCheck className="w-4 h-4" />
              )}
              <span>تسجيل الدخول للنظام</span>
            </button>

            {/* Quick 1-Click Login Option */}
            <div className="pt-2">
              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-brand-border"></div>
                <span className="flex-shrink mx-2 text-[10px] text-slate-500 font-medium">أو الدخول المباشر بنقرة واحدة</span>
                <div className="flex-grow border-t border-brand-border"></div>
              </div>
              <button
                type="button"
                onClick={handleQuickLogin}
                disabled={loading}
                className="w-full mt-1.5 py-2 bg-brand-surface hover:bg-slate-800 text-blue-400 hover:text-blue-300 border border-blue-500/20 hover:border-blue-500/40 font-semibold text-xs rounded-lg flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
              >
                <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400/20" />
                <span>دخول سريع كمدير (نقرة واحدة بدون كتابة كلمة المرور)</span>
              </button>
            </div>
          </form>

          {/* Security & Access Info */}
          <div className="pt-3 border-t border-brand-border text-center space-y-1 text-[11px] text-slate-500">
            <p>لوحة تحكم إدارية خاصة — الوصول مقصور على المشرفين المصرح لهم فقط</p>
            <p className="text-[10px] text-slate-600">
              © 2026 Ahmed Saber • 01030137635
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
