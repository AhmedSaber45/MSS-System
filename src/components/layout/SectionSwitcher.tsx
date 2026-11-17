import React from 'react';
import { useNavigation } from '../../context/NavigationContext';
import { useAuth } from '../../context/AuthContext';
import { AppSection } from '../../types/navigation';
import { Store, Laptop, Lock } from 'lucide-react';
import { cn } from '../../lib/utils';

export const SectionSwitcher: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { currentSection, setSection } = useNavigation();
  const { canAccess } = useAuth();

  const canAccessAccessories = canAccess('accessories');
  const canAccessMss = canAccess('mss');

  const handleSelect = (section: AppSection) => {
    if (section === 'accessories' && !canAccessAccessories) return;
    if (section === 'mss' && !canAccessMss) return;
    if (section !== currentSection) {
      setSection(section);
    }
  };

  return (
    <div className={cn('p-1.5 bg-slate-100 rounded-xl border border-slate-300 select-none shadow-sm')}>
      <div className={cn('grid gap-1.5', compact ? 'grid-cols-1' : 'grid-cols-2')}>
        {/* Accessories Shop Button */}
        <button
          type="button"
          disabled={!canAccessAccessories}
          onClick={() => handleSelect('accessories')}
          className={cn(
            'flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-colors',
            currentSection === 'accessories'
              ? 'bg-white text-slate-900 shadow-sm border border-slate-300 font-bold'
              : canAccessAccessories
              ? 'text-slate-600 hover:text-slate-900 hover:bg-white/70 cursor-pointer'
              : 'text-slate-400 opacity-50 cursor-not-allowed'
          )}
          title={canAccessAccessories ? 'قسم محل الإكسسوارات' : 'غير مصرح لحسابك بالوصول للإكسسوارات'}
        >
          {canAccessAccessories ? (
            <Store className={cn('w-4.5 h-4.5', currentSection === 'accessories' ? 'text-blue-700' : 'text-slate-500')} />
          ) : (
            <Lock className="w-3.5 h-3.5 text-slate-400" />
          )}
          {!compact && <span>الإكسسوارات</span>}
        </button>

        {/* MSS Business Button */}
        <button
          type="button"
          disabled={!canAccessMss}
          onClick={() => handleSelect('mss')}
          className={cn(
            'flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-colors',
            currentSection === 'mss'
              ? 'bg-white text-slate-900 shadow-sm border border-slate-300 font-bold'
              : canAccessMss
              ? 'text-slate-600 hover:text-slate-900 hover:bg-white/70 cursor-pointer'
              : 'text-slate-400 opacity-50 cursor-not-allowed'
          )}
          title={canAccessMss ? 'قسم Compu MSS للأجهزة' : 'غير مصرح لحسابك بالوصول لـ Compu MSS'}
        >
          {canAccessMss ? (
            <Laptop className={cn('w-4.5 h-4.5', currentSection === 'mss' ? 'text-teal-700' : 'text-slate-500')} />
          ) : (
            <Lock className="w-3.5 h-3.5 text-slate-400" />
          )}
          {!compact && <span>Compu MSS</span>}
        </button>
      </div>
    </div>
  );
};
