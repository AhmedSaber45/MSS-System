'use client';

import React, { useState } from 'react';
import { Phone, Copy, Check } from 'lucide-react';
import { ContactModal } from './ContactModal';

export const Footer: React.FC = () => {
  const [copied, setCopied] = useState<boolean>(false);
  const [isContactModalOpen, setIsContactModalOpen] = useState<boolean>(false);

  const handleCopyPhone = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText('01030137635');
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // ignore
    }
  };

  return (
    <>
      <footer
        dir="ltr"
        className="min-h-8 bg-white border-t border-slate-200/90 px-4 md:px-6 py-2 sm:py-0 sm:h-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 shrink-0 z-10 select-none shadow-xs gap-1.5 sm:gap-2"
      >
        {/* Copyright Notice */}
        <div className="flex items-center gap-1.5 font-medium text-[11px] md:text-xs text-slate-600">
          <span>© 2026 Ahmed Saber. All rights reserved.</span>
        </div>

        {/* Contact & Phone Notice (Opens Modal on click, no browser alert/protocol prompt) */}
        <div className="flex items-center gap-2 text-[11px] md:text-xs">
          <span className="text-slate-500 font-medium">Contact:</span>
          <div className="flex items-center gap-1.5 font-mono">
            <button
              type="button"
              onClick={() => setIsContactModalOpen(true)}
              className="text-slate-800 hover:text-blue-700 font-bold transition-colors inline-flex items-center gap-1 cursor-pointer hover:underline"
              title="انقر لفتح نافذة التواصل والدعم الفني"
            >
              <Phone className="w-3 h-3 text-slate-400" />
              <span>01030137635</span>
            </button>

            <button
              type="button"
              onClick={handleCopyPhone}
              className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors cursor-pointer relative"
              title="نسخ رقم الهاتف إلى الحافظة"
              aria-label="نسخ رقم الهاتف"
            >
              {copied ? (
                <Check className="w-3 h-3 text-emerald-600" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
            </button>
          </div>
        </div>
      </footer>

      {/* Dedicated Contact & Ownership Modal */}
      <ContactModal
        isOpen={isContactModalOpen}
        onClose={() => setIsContactModalOpen(false)}
      />
    </>
  );
};
