import React from 'react';

export type LaptopSpecFieldKind = 'ram' | 'storage' | 'screen' | 'processor' | 'gpu';

export const LAPTOP_SPEC_QUICK_OPTIONS: Record<LaptopSpecFieldKind, readonly string[]> = {
  ram: ['4 GB', '8 GB', '16 GB', '32 GB'],
  storage: ['SSD 128 GB', 'SSD 256 GB', 'SSD 512 GB', 'HDD 500 GB', 'HDD 1 TB'],
  screen: ['14.1', '15.6'],
  processor: ['CI 3', 'CI 5', 'CI 7', 'CI 9', 'RYZEN 3', 'RYZEN 5', 'RYZEN 7'],
  gpu: ['AMD', 'NVIDIA', 'INTEL'],
};

export interface LaptopSpecQuickSelectProps {
  specType: LaptopSpecFieldKind;
  value?: string | null;
  onSelect: (value: string) => void;
  className?: string;
}

/**
 * Reusable compact quick-select pills placed directly beneath laptop specification inputs.
 * Clicking an option inserts it into the controlled input while keeping it freely editable.
 */
export const LaptopSpecQuickSelect: React.FC<LaptopSpecQuickSelectProps> = ({
  specType,
  value,
  onSelect,
  className = '',
}) => {
  const options = LAPTOP_SPEC_QUICK_OPTIONS[specType];
  const normalizedCurrent = (value || '').trim().toUpperCase();

  return (
    <div
      className={`flex flex-wrap items-center gap-1 mt-1.5 ${className}`}
      dir="ltr"
      role="group"
      aria-label={`Quick select ${specType}`}
    >
      {options.map(option => {
        const isSelected = normalizedCurrent === option.toUpperCase();
        return (
          <button
            key={option}
            type="button"
            onClick={() => onSelect(option)}
            aria-pressed={isSelected}
            className={`px-2 py-0.5 rounded-md border text-[11px] font-semibold font-mono transition-colors cursor-pointer ${
              isSelected
                ? 'bg-blue-50 border-blue-400 text-blue-800'
                : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-800'
            }`}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
};
