import React from 'react';
import { Store, Laptop, Monitor, Box, Cpu, HardDrive } from 'lucide-react';
import type { PublicInventoryItem } from '../types/inventory';
import { formatEGP } from '../lib/utils';

interface InventoryCardProps {
  item: PublicInventoryItem;
}

export const InventoryCard: React.FC<InventoryCardProps> = ({ item }) => {
  return (
    <div className="bg-white border border-slate-300 rounded-xl p-4 shadow-sm hover:border-slate-400 transition-colors space-y-3">
      {/* Top Header: Brand, Branch, and Category */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-800 border border-slate-300">
            {item.brand}
          </span>
          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-50 text-slate-600 border border-slate-200">
            {item.category}
          </span>
        </div>

        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-800 border border-slate-300">
          <Store className="w-3 h-3 text-slate-500" />
          <span>{item.branch_name}</span>
        </div>
      </div>

      {/* Model Name */}
      <div className="flex items-center gap-2">
        {item.category === 'لابتوب' ? (
          <Laptop className="w-4 h-4 text-slate-500 shrink-0" />
        ) : item.category === 'شاشة' ? (
          <Monitor className="w-4 h-4 text-slate-500 shrink-0" />
        ) : (
          <Box className="w-4 h-4 text-slate-500 shrink-0" />
        )}
        <h3 className="text-sm font-bold text-slate-900 leading-snug">
          {item.model_name}
        </h3>
      </div>

      {/* Technical Specs Tags */}
      <div className="flex flex-wrap gap-1.5 text-xs text-slate-700">
        {item.processor && (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200">
            <Cpu className="w-3 h-3 text-slate-500" />
            <span>{item.processor}</span>
          </span>
        )}
        {item.ram && (
          <span className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200">
            {item.ram}
          </span>
        )}
        {item.storage && (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200">
            <HardDrive className="w-3 h-3 text-slate-500" />
            <span>{item.storage}</span>
          </span>
        )}
        {item.screen_size && (
          <span className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200">
            {item.screen_size}
          </span>
        )}
      </div>

      {/* GPU Tag if exists */}
      {item.gpu && (
        <div className="text-xs text-teal-800 font-medium">
          كرت الشاشة: {item.gpu}
        </div>
      )}

      {/* Additional Details */}
      {item.specifications && (
        <p className="text-xs text-slate-500 leading-relaxed border-t border-slate-100 pt-2">
          {item.specifications}
        </p>
      )}

      {/* Bottom Footer: Price, Status & Quantity */}
      <div className="flex items-center justify-between pt-2.5 border-t border-slate-200">
        <div>
          <span className="text-[11px] text-slate-400 block">السعر</span>
          <span className="text-base font-bold text-slate-900 font-mono tabular-nums">
            {formatEGP(item.selling_price)}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {item.status === 'AVAILABLE' ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-emerald-50 text-emerald-900 border border-emerald-300">
              متاح للبيع
            </span>
          ) : item.status === 'RESERVED' ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-amber-50 text-amber-950 border border-amber-300">
              محجوز
            </span>
          ) : (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-slate-100 text-slate-800 border border-slate-300">
              تم البيع
            </span>
          )}

          <span className="inline-block font-mono font-bold text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-800 border border-slate-200 tabular-nums">
            {item.quantity} وحدة
          </span>
        </div>
      </div>
    </div>
  );
};
