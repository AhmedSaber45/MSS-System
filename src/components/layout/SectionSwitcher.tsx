import React from 'react';
import { useNavigation } from '../../context/NavigationContext';
import { useAuth } from '../../context/AuthContext';
import { AppSection } from '../../types/navigation';
import { Store, Laptop } from 'lucide-react';
import { cn } from '../../lib/utils';

export const SectionSwitcher: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { currentSection, setSection } = useNavigation();
  const { canAccess } = useAuth();

  const canAccessAccessories = canAccess('accessories');
  const canAccessMss = canAccess('mss');

  const hasMultipleModules = canAccessAccessories && canAccessMss;

  if (!canAccessAccessories && !canAccessMss) {
    return null;
  }

  const handleSelect = (section: AppSection) => {
    if (section === 'accessories' && !canAccessAccessories) return;
    if (section === 'mss' && !canAccessMss) return;
    if (section !== currentSection) {
      setSection(section);
    }
  };

  return (
    <div className={cn('p-1.5 bg-slate-100 rounded-xl border border-slate-300 select-none shadow-sm')}>
      <div className={cn('grid gap-1.5', !hasMultipleModules || compact ? 'grid-cols-1' : 'grid-cols-2')}>
        {/* Accessories Shop Button (Only visible if authorized) */}
        {canAccessAccessories && (
          <button
            type="button"
            onClick={() => handleSelect('accessories')}
            className={cn(
              'flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-colors',
              currentSection === 'accessories'
                ? 'bg-white text-slate-900 shadow-sm border border-slate-300 font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/70 cursor-pointer'
            )}
            title="قسم محل الإكسسوارات"
          >
            <Store className={cn('w-4.5 h-4.5', currentSection === 'accessories' ? 'text-blue-700' : 'text-slate-500')} />
            {!compact && <span>الإكسسوارات</span>}
          </button>
        )}

        {/* MSS Business Button (Only visible if authorized) */}
        {canAccessMss && (
          <button
            type="button"
            onClick={() => handleSelect('mss')}
            className={cn(
              'flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-colors',
              currentSection === 'mss'
                ? 'bg-white text-slate-900 shadow-sm border border-slate-300 font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/70 cursor-pointer'
            )}
            title="قسم Compu MSS للأجهزة"
          >
            <Laptop className={cn('w-4.5 h-4.5', currentSection === 'mss' ? 'text-teal-700' : 'text-slate-500')} />
            {!compact && <span>Compu MSS</span>}
          </button>
        )}
      </div>
    </div>
  );
};
