import React from 'react';
import { useNavigation } from '../../context/NavigationContext';
import { AppSection } from '../../types/navigation';
import { Store, Laptop, Wifi, WifiOff } from 'lucide-react';
import { cn } from '../../lib/utils';

export const SectionSwitcher: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { currentSection, setSection } = useNavigation();

  const handleSelect = (section: AppSection) => {
    if (section !== currentSection) {
      setSection(section);
    }
  };

  return (
    <div className={cn('p-2 bg-slate-100/90 rounded-xl border border-slate-200', compact && 'p-1')}>
      <div className="grid grid-cols-2 gap-1.5">
        {/* Accessories Shop Button */}
        <button
          onClick={() => handleSelect('accessories')}
          className={cn(
            'flex flex-col items-center justify-center p-2 rounded-lg text-xs font-semibold transition-all relative',
            currentSection === 'accessories'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
          )}
        >
          <div className="flex items-center gap-1.5 mb-1">
            <Store className={cn('w-4 h-4', currentSection === 'accessories' ? 'text-white' : 'text-blue-600')} />
            <span className="font-bold">الإكسسوارات</span>
          </div>
          {!compact && (
            <div className="flex items-center gap-1 text-[10px] opacity-85">
              <WifiOff className="w-2.5 h-2.5" />
              <span>محلي 100%</span>
            </div>
          )}
        </button>

        {/* MSS Business Button */}
        <button
          onClick={() => handleSelect('mss')}
          className={cn(
            'flex flex-col items-center justify-center p-2 rounded-lg text-xs font-semibold transition-all relative',
            currentSection === 'mss'
              ? 'bg-teal-700 text-white shadow-md'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
          )}
        >
          <div className="flex items-center gap-1.5 mb-1">
            <Laptop className={cn('w-4 h-4', currentSection === 'mss' ? 'text-white' : 'text-teal-600')} />
            <span className="font-bold">أجهزة MSS</span>
          </div>
          {!compact && (
            <div className="flex items-center gap-1 text-[10px] opacity-85">
              <Wifi className="w-2.5 h-2.5" />
              <span>سحابي ومشترك</span>
            </div>
          )}
        </button>
      </div>
    </div>
  );
};
