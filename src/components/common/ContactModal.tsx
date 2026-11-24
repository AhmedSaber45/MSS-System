import React, { useState, useEffect } from 'react';
import {
  Phone,
  Copy,
  Check,
  ShieldCheck,
  MessageCircle,
  X,
} from 'lucide-react';
import { useNotification } from '../../context/NotificationContext';
import { FULL_APP_VERSION } from '../../config/appVersion';

export interface ContactModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ContactModal: React.FC<ContactModalProps> = ({ isOpen, onClose }) => {
  const { showNotification } = useNotification();
  const [copiedPhone, setCopiedPhone] = useState<boolean>(false);
  const [, setCopiedCard] = useState<boolean>(false);

  const phoneNumber = '01030137635';
  const ownerName = 'Ahmed Saber';

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleCopyPhone = async () => {
    try {
      await navigator.clipboard.writeText(phoneNumber);
      setCopiedPhone(true);
      if (showNotification) {
        showNotification({
          type: 'success',
          title: 'تم نسخ رقم الهاتف',
          message: `تم نسخ الرقم (${phoneNumber}) إلى الحافظة بنجاح.`,
        });
      }
      setTimeout(() => setCopiedPhone(false), 2500);
    } catch {
      // ignore
    }
  };

  const handleCopyContactCard = async () => {
    const text = `نظام AS System\n${ownerName} — Founder of AS System\nرقم التواصل: ${phoneNumber}\nجميع الحقوق محفوظة © 2026`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedCard(true);
      if (showNotification) {
        showNotification({
          type: 'success',
          title: 'تم نسخ بطاقة التواصل',
          message: 'تم نسخ بيانات المالك وحقوق الملكية بالكامل.',
        });
      }
      setTimeout(() => setCopiedCard(false), 2500);
    } catch {
      // ignore
    }
  };

  const handleOpenWhatsApp = () => {
    const whatsappUrl = `https://wa.me/201030137635?text=${encodeURIComponent(
      'مرحباً أستاذ أحمد، أتواصل معك بخصوص نظام AS System'
    )}`;
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs select-none"
      onClick={onClose}
      dir="rtl"
    >
      <div
        className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="contact-modal-title"
      >
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 id="contact-modal-title" className="text-base font-bold text-slate-900">
              بيانات التواصل وحقوق الملكية
            </h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              AS System — التواصل المباشر مع مطور النظام والدعم الفني
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            aria-label="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 text-sm">
          {/* Contact Info Card */}
          <div className="p-4 bg-slate-50/90 rounded-xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3">
              {/* Official AS System Logo Symbol Badge */}
              <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center p-2 shadow-sm shrink-0">
                <img
                  src="/as_logo_gold.png"
                  alt="AS System"
                  width={32}
                  height={32}
                  className="w-full h-full object-contain select-none"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = '/assets/branding/as_logo_gold.png';
                  }}
                />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">{ownerName}</h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Founder of AS System
                </p>
              </div>
            </div>

            <div className="bg-white p-3.5 rounded-lg border border-slate-200 space-y-3">
              {/* Phone Row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
                  <Phone className="w-4 h-4 text-blue-600" />
                  <span>رقم الهاتف :</span>
                </div>
                <span className="font-mono text-base font-bold text-slate-900 tracking-wider">
                  {phoneNumber}
                </span>
              </div>

              {/* Quick Actions Row */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleCopyPhone}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs transition-colors cursor-pointer"
                >
                  {copiedPhone ? (
                    <Check className="w-4 h-4 text-white" />
                  ) : (
                    <Copy className="w-4 h-4 text-white" />
                  )}
                  <span>{copiedPhone ? 'تم النسخ!' : 'نسخ الرقم'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleOpenWhatsApp}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-lg font-bold text-xs transition-colors cursor-pointer"
                >
                  <MessageCircle className="w-4 h-4 text-emerald-600" />
                  <span>محادثة واتساب</span>
                </button>
              </div>
            </div>
          </div>

          {/* Legal Copyright Box */}
          <div className="p-3 bg-white rounded-lg border border-slate-200 flex items-center justify-between text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-medium font-mono text-[12px] text-slate-800">
                © 2026 Ahmed Saber. All rights reserved.
              </span>
            </div>
            <span className="font-mono text-[11px] text-slate-400 font-bold">
              {FULL_APP_VERSION}
            </span>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-bold text-slate-700 hover:bg-white hover:border-slate-400 transition-colors cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
