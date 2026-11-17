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
      {/* Background radial glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-brand-bg to-brand-bg pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Brand Card */}
        <div className="bg-brand-card border border-brand-border rounded-2xl p-8 shadow-2xl space-y-6">
          {/* Logo & Header */}
          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-primary to-brand-secondary flex items-center justify-center text-white mx-auto shadow-xl shadow-brand-primary/25">
              <Building2 className="w-7 h-7" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-wide">Compu MSS</h1>
            <p className="text-xs text-slate-400 font-medium">لوحة تحكم الإدارة المركزية (Admin Dashboard)</p>
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
                  className="w-full p-3 bg-brand-surface border border-brand-border rounded-xl text-slate-200 placeholder-slate-500 font-mono pr-10 focus:outline-none focus:border-brand-primary transition-colors"
                />
                <User className="w-4 h-4 text-slate-500 absolute right-3.5 top-1/2 -translate-y-1/2" />
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
                  className="w-full p-3 bg-brand-surface border border-brand-border rounded-xl text-slate-200 font-mono pr-10 pl-10 focus:outline-none focus:border-brand-primary transition-colors"
                />
                <Lock className="w-4 h-4 text-slate-500 absolute right-3.5 top-1/2 -translate-y-1/2" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-brand-primary hover:bg-brand-secondary text-white font-semibold text-sm rounded-xl shadow-lg shadow-brand-primary/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50 mt-2 cursor-pointer"
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
                <div className="flex-grow border-t border-brand-border/60"></div>
                <span className="flex-shrink mx-3 text-[10px] text-slate-500 font-medium">أو الدخول المباشر بنقرة واحدة</span>
                <div className="flex-grow border-t border-brand-border/60"></div>
              </div>
              <button
                type="button"
                onClick={handleQuickLogin}
                disabled={loading}
                className="w-full mt-2 py-2.5 bg-brand-surface hover:bg-slate-800 text-blue-400 hover:text-blue-300 border border-blue-500/30 hover:border-blue-500/60 font-semibold text-xs rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50 shadow-sm cursor-pointer"
              >
                <Zap className="w-4 h-4 text-amber-400 fill-amber-400/20" />
                <span>دخول سريع كمدير (بدون كتابة اسم المستخدم أو كلمة المرور)</span>
              </button>
            </div>
          </form>

          {/* Security & Access Info */}
          <div className="pt-4 border-t border-brand-border/60 text-center space-y-1.5 text-[11px] text-slate-500">
            <p>لوحة تحكم إدارية خاصة — التسجيل مقصور على المشرفين المصرح لهم فقط</p>
            <p className="text-[10px] text-slate-600">
              © 2026 Ahmed Saber • 01030137635
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
