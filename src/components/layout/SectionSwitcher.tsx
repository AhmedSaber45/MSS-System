import React from 'react';
import { useNavigation } from '../../context/NavigationContext';
import { AppSection } from '../../types/navigation';
import { Store, Laptop } from 'lucide-react';
import { cn } from '../../lib/utils';

export const SectionSwitcher: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { currentSection, setSection } = useNavigation();

  const handleSelect = (section: AppSection) => {
    if (section !== currentSection) {
      setSection(section);
    }
  };

  return (
    <div className={cn('p-1 bg-slate-100/90 rounded-lg border border-slate-200/90 select-none')}>
      <div className={cn('grid gap-1', compact ? 'grid-cols-1' : 'grid-cols-2')}>
        {/* Accessories Shop Button */}
        <button
          type="button"
          onClick={() => handleSelect('accessories')}
          className={cn(
            'flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors',
            currentSection === 'accessories'
              ? 'bg-white text-slate-900 shadow-subtle border border-slate-200/90 font-semibold'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          )}
          title="قسم محل الإكسسوارات (محلي مستقل)"
        >
          <Store className={cn('w-3.5 h-3.5', currentSection === 'accessories' ? 'text-blue-700' : 'text-slate-400')} />
          {!compact && <span>الإكسسوارات</span>}
        </button>

        {/* MSS Business Button */}
        <button
          type="button"
          onClick={() => handleSelect('mss')}
          className={cn(
            'flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors',
            currentSection === 'mss'
              ? 'bg-white text-slate-900 shadow-subtle border border-slate-200/90 font-semibold'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          )}
          title="بيزنس أجهزة MSS (مشترك وسحابي)"
        >
          <Laptop className={cn('w-3.5 h-3.5', currentSection === 'mss' ? 'text-teal-700' : 'text-slate-400')} />
          {!compact && <span>أجهزة MSS</span>}
        </button>
      </div>
    </div>
  );
};
