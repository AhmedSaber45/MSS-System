import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Eye, EyeOff, Lock, User, AlertCircle, ShieldCheck, Loader2 } from 'lucide-react';

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
      setLocalError('حدث خطأ غير متوقع أثناء تسجيل الدخول');
    } finally {
      setIsSubmitting(false);
    }
  };

  const displayError = localError || errorMessage;

  return (
    <div
      dir="rtl"
      className="min-h-screen w-screen bg-slate-950 flex flex-col justify-center items-center p-4 selection:bg-blue-600 selection:text-white"
    >
      {/* Background Subtle Ambience */}
      <div className="absolute inset-0 bg-radial from-slate-900 via-slate-950 to-slate-950 pointer-events-none opacity-80" />

      <div className="w-full max-w-md relative z-10">
        {/* Brand Card Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-600/10 border border-blue-500/20 text-blue-500 mb-4 shadow-inner">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight font-mono">Compu MSS</h1>
          <p className="text-sm text-slate-400 mt-1.5 font-medium">
            نظام إدارة المبيعات والمخزون الموحد
          </p>
        </div>

        {/* Login Form Box */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-sm">
          <div className="border-b border-slate-800/80 pb-4 mb-6">
            <h2 className="text-base font-semibold text-slate-200">تسجيل الدخول للمنظومة</h2>
            <p className="text-xs text-slate-400 mt-1">
              أدخل اسم المستخدم ورمز الدخول المصرح به من مسؤول النظام
            </p>
          </div>

          {/* Error Banner */}
          {displayError && (
            <div className="mb-6 p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-start gap-3 text-rose-300 text-sm animate-in fade-in">
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-400 mt-0.5" />
              <span className="leading-relaxed font-medium">{displayError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Username Input */}
            <div>
              <label
                htmlFor="username"
                className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider"
              >
                اسم المستخدم
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-500">
                  <User className="w-5 h-5" />
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
                  placeholder="مثال: cashier_alex"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pr-11 pl-4 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:opacity-50"
                />
              </div>
            </div>

            {/* Access Code Input */}
            <div>
              <label
                htmlFor="accessCode"
                className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider"
              >
                رمز الدخول (Access Code)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-5 h-5" />
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
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pr-11 pl-11 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all font-mono disabled:opacity-50"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowAccessCode(!showAccessCode)}
                  className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500 hover:text-slate-300 transition-colors focus:outline-none"
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
              className="w-full h-11 mt-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-semibold text-sm rounded-xl transition-all shadow-md shadow-blue-950/50 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>جارٍ التحقق من الهوية...</span>
                </>
              ) : (
                <span>دخول النظام</span>
              )}
            </button>

            {/* Quick Fill Default Credentials */}
            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => {
                  setUsername('ahmed');
                  setAccessCode('1234');
                  clearError();
                  setLocalError(null);
                }}
                className="text-xs text-blue-400 hover:text-blue-300 transition-colors inline-flex items-center gap-1.5 py-1 px-3 rounded-lg hover:bg-blue-950/40 border border-blue-500/20 cursor-pointer"
              >
                <span>⚡ تعبئة بيانات الدخول الافتراضية (ahmed / 1234)</span>
              </button>
            </div>
          </form>

          {/* Security Notice */}
          <div className="mt-6 pt-5 border-t border-slate-800/80 text-center">
            <p className="text-[11px] text-slate-500 font-medium">
              الوصول مقتصر على الموظفين المصرح لهم فقط • يتم تشفير الجلسات محلياً عبر Windows DPAPI
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
