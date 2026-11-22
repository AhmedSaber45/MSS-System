import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Eye, EyeOff, Lock, User, AlertCircle, ShieldCheck, Loader2, Clock } from 'lucide-react';

export const LoginView: React.FC = () => {
  const { login, errorMessage, clearError, status } = useAuth();
  const [username, setUsername] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [showAccessCode, setShowAccessCode] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setLocalError(null);

    const trimmedUser = username.trim();
    if (!trimmedUser) {
      setLocalError('يرجى إدخال اسم المستخدم');
      return;
    }

    if (!accessCode) {
      setLocalError('يرجى إدخال رمز الدخول');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await login({ username: trimmedUser, accessCode });
      if (!res.success) {
        // Clear sensitive field on failure
        setAccessCode('');
      } else {
        // Clear fields on success
        setUsername('');
        setAccessCode('');
      }
    } catch {
      setAccessCode('');
      setLocalError('حدث خطأ   أثناء تسجيل الدخول');
    } finally {
      setIsSubmitting(false);
    }
  };

  const displayError = localError || errorMessage;

  return (
    <div
      dir="rtl"
      className="min-h-screen w-screen bg-slate-50 flex flex-col justify-center items-center p-4 selection:bg-slate-900 selection:text-white"
    >
      <div className="w-full max-w-sm">
        {/* Brand Card Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-slate-900 text-white mb-3 shadow-sm">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight font-mono">Compu MSS</h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            نظام إدارة المبيعات
          </p>
        </div>

        {/* Login Form Box */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-7 shadow-sm">
          <div className="border-b border-slate-100 pb-3 mb-5">
            <h2 className="text-sm font-semibold text-slate-900 text-center">
              تسجيل الدخول
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 text-center">
              أدخل اسم المستخدم ورمز الدخول المصرح به
            </p>
          </div>

          {/* Inactivity Notice or Error Banner */}
          {displayError && (
            <div
              className={`mb-5 p-3 rounded-lg flex items-start gap-2.5 text-xs animate-in fade-in ${
                status === 'inactivity_expired'
                  ? 'bg-amber-50 border border-amber-200 text-amber-800'
                  : 'bg-rose-50 border border-rose-200 text-rose-700'
              }`}
            >
              {status === 'inactivity_expired' ? (
                <Clock className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
              )}
              <span className="leading-relaxed font-medium">{displayError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username Input */}
            <div>
              <label
                htmlFor="username"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                اسم المستخدم
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  id="username"
                  type="text"
                  autoComplete="username"
                  autoFocus
                  disabled={isSubmitting}
                  value={username}
                  onChange={e => {
                    setUsername(e.target.value);
                    if (localError) setLocalError(null);
                  }}
                  placeholder="أدخل اسم المستخدم المصرح به"
                  className="w-full bg-white border border-slate-300 rounded-lg pr-9 pl-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-colors disabled:opacity-50"
                />
              </div>
            </div>

            {/* Access Code Input */}
            <div>
              <label
                htmlFor="accessCode"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                رمز الدخول
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="accessCode"
                  type={showAccessCode ? 'text' : 'password'}
                  autoComplete="current-password"
                  disabled={isSubmitting}
                  value={accessCode}
                  onChange={e => {
                    setAccessCode(e.target.value);
                    if (localError) setLocalError(null);
                  }}
                  placeholder="أدخل رمز الدخول المخصص"
                  className="w-full bg-white border border-slate-300 rounded-lg pr-9 pl-9 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-colors font-mono disabled:opacity-50"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowAccessCode(!showAccessCode)}
                  className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors focus:outline-none"
                  aria-label={showAccessCode ? 'إخفاء الرمز' : 'إظهار الرمز'}
                >
                  {showAccessCode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting || !username.trim() || !accessCode}
              className="w-full h-10 mt-1 bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white font-semibold text-sm rounded-lg transition-colors shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>جارٍ التحقق من الهوية...</span>
                </>
              ) : (
                <span>دخول </span>
              )}
            </button>
          </form>

          {/* Security Notice */}
          <div className="mt-5 pt-4 border-t border-slate-100 text-center">
            <p className="text-[11px] text-slate-400 font-medium">
              جميع الحقوق محفوظة © 2026 – Compu MSS. تم التطوير بواسطة Ahmed Saber.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
