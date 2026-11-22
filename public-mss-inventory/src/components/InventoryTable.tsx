import React from 'react';
import { Store, Laptop, Monitor, Box, Cpu, HardDrive } from 'lucide-react';
import type { PublicInventoryItem } from '../types/inventory';
import { formatEGP } from '../lib/utils';

interface InventoryTableProps {
  items: PublicInventoryItem[];
}

export const InventoryTable: React.FC<InventoryTableProps> = ({ items }) => {
  return (
    <div className="hidden md:block overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-right text-sm text-slate-800 border-collapse">
          <thead>
            <tr className="bg-slate-100/90 text-xs sm:text-sm font-semibold text-slate-700 border-b border-slate-300 select-none">
              <th className="py-3 px-4">الجهاز والموديل</th>
              <th className="py-3 px-4 min-w-[260px]">المواصفات الفنية</th>
              <th className="py-3 px-4 text-center">الفرع</th>
              <th className="py-3 px-4 text-center">الحالة</th>
              <th className="py-3 px-4 text-center">الكمية</th>
              <th className="py-3 px-4 text-left">السعر (ج.م)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-sm">
            {items.map((item) => (
              <tr
                key={item.id}
                className="hover:bg-slate-50 transition-colors"
              >
                {/* Model & Brand */}
                <td className="py-3.5 px-4 align-top">
                  <div className="flex items-center gap-2">
                    {item.category === 'لابتوب' ? (
                      <Laptop className="w-4 h-4 text-slate-500 shrink-0" />
                    ) : item.category === 'شاشة' ? (
                      <Monitor className="w-4 h-4 text-slate-500 shrink-0" />
                    ) : (
                      <Box className="w-4 h-4 text-slate-500 shrink-0" />
                    )}
                    <span className="font-bold text-slate-900 text-sm">
                      {item.brand} {item.model_name}
                    </span>
                    <span className="inline-block px-1.5 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                      {item.category}
                    </span>
                  </div>
                </td>

                {/* Specs */}
                <td className="py-3.5 px-4 align-top">
                  <div className="space-y-1 text-xs text-slate-600">
                    <div className="flex flex-wrap items-center gap-1.5 font-medium">
                      {item.processor && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200">
                          <Cpu className="w-3 h-3 text-slate-500" />
                          <span>{item.processor}</span>
                        </span>
                      )}
                      {item.ram && (
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200">
                          {item.ram}
                        </span>
                      )}
                      {item.storage && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200">
                          <HardDrive className="w-3 h-3 text-slate-500" />
                          <span>{item.storage}</span>
                        </span>
                      )}
                      {item.screen_size && (
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200">
                          {item.screen_size}
                        </span>
                      )}
                    </div>

                    {item.gpu && (
                      <div className="text-[11px] text-teal-800 font-medium">
                        كرت الشاشة: {item.gpu}
                      </div>
                    )}

                    {item.specifications && (
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        {item.specifications}
                      </p>
                    )}
                  </div>
                </td>

                {/* Branch */}
                <td className="py-3.5 px-4 align-top text-center">
                  <div className="inline-flex items-center justify-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-100 text-slate-800 border border-slate-300">
                    <Store className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span>{item.branch_name}</span>
                  </div>
                </td>

                {/* Status */}
                <td className="py-3.5 px-4 align-top text-center">
                  {item.status === 'AVAILABLE' ? (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-50 text-emerald-900 border border-emerald-300">
                      متاح للبيع
                    </span>
                  ) : item.status === 'RESERVED' ? (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-amber-50 text-amber-950 border border-amber-300">
                      محجوز
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-slate-100 text-slate-800 border border-slate-300">
                      تم البيع
                    </span>
                  )}
                </td>

                {/* Quantity */}
                <td className="py-3.5 px-4 align-top text-center">
                  <span className="inline-block font-mono font-bold text-sm px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-800 border border-slate-200 tabular-nums">
                    {item.quantity}
                  </span>
                </td>

                {/* Selling Price */}
                <td className="py-3.5 px-4 align-top text-left">
                  <span className="font-bold text-slate-900 text-sm font-mono tabular-nums block text-left whitespace-nowrap">
                    {formatEGP(item.selling_price)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
