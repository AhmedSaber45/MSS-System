import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { ShieldAlert, ArrowRight, LogOut } from 'lucide-react';
import { useNavigation } from '../../context/NavigationContext';

interface ModuleGuardProps {
  module: 'accessories' | 'mss';
  children: React.ReactNode;
}

export const ModuleGuard: React.FC<ModuleGuardProps> = ({ module, children }) => {
  const { canAccess, user, logout } = useAuth();
  const { setSection } = useNavigation();

  const isAllowed = canAccess(module);

  if (!isAllowed) {
    const targetName = module === 'accessories' ? 'محل الإكسسوارات' : 'Compu MSS للأجهزة';
    const otherModule = module === 'accessories' ? 'mss' : 'accessories';
    const otherName = otherModule === 'accessories' ? 'قسم الإكسسوارات' : 'قسم Compu MSS';
    const hasOtherAccess = user ? canAccess(otherModule) : false;

    return (
      <div
        dir="rtl"
        className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center select-none"
      >
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-600 flex items-center justify-center mb-4">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-800">وصول غير مصرح به</h2>
        <p className="text-sm text-slate-600 max-w-md mt-2 leading-relaxed">
          حسابك الحالي (<span className="font-semibold text-slate-900 font-mono">{user?.username}</span>)
          ليس لديه صلاحية الوصول إلى <span className="font-semibold text-slate-900">{targetName}</span>.
        </p>
        <div className="mt-2 text-xs text-slate-500">
          صلاحياتك المصرحة: {user?.allowedModules === 'accessories' ? 'قسم الإكسسوارات فقط' : user?.allowedModules === 'mss' ? 'قسم Compu MSS فقط' : 'غير محدد'}
        </div>

        <div className="flex items-center gap-3 mt-6">
          {hasOtherAccess && (
            <button
              onClick={() => setSection(otherModule)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors shadow-sm cursor-pointer"
            >
              <span>الانتقال إلى {otherName}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={() => logout()}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>تسجيل الخروج</span>
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
