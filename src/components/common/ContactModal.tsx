import React, { useState } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import {
  Phone,
  Copy,
  Check,
  ShieldCheck,
  MessageCircle,
  User,
  Share2,
} from 'lucide-react';
import { useNotification } from '../../context/NotificationContext';

export interface ContactModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ContactModal: React.FC<ContactModalProps> = ({ isOpen, onClose }) => {
  const { showNotification } = useNotification();
  const [copiedPhone, setCopiedPhone] = useState<boolean>(false);
  const [copiedCard, setCopiedCard] = useState<boolean>(false);

  const phoneNumber = '01030137635';
  const ownerName = 'Ahmed Saber';

  const handleCopyPhone = async () => {
    try {
      await navigator.clipboard.writeText(phoneNumber);
      setCopiedPhone(true);
      showNotification({
        type: 'success',
        title: 'تم نسخ رقم الهاتف',
        message: `تم نسخ الرقم (${phoneNumber}) إلى الحافظة بنجاح.`,
      });
      setTimeout(() => setCopiedPhone(false), 2500);
    } catch {
      // ignore
    }
  };

  const handleCopyContactCard = async () => {
    const text = `نظام Compu MSS\nالمالك والمطور: ${ownerName}\nرقم التواصل: ${phoneNumber}\nجميع الحقوق محفوظة © 2026`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedCard(true);
      showNotification({
        type: 'success',
        title: 'تم نسخ بطاقة التواصل',
        message: 'تم نسخ بيانات المالك وحقوق الملكية بالكامل.',
      });
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
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="بيانات التواصل وحقوق الملكية"
      subtitle="Compu MSS — التواصل المباشر مع مطور النظام والدعم الفني"
      size="md"
      footer={
        <div className="flex justify-end w-full">
          <Button
            variant="outline"
            size="md"
            onClick={onClose}
            className="border-slate-300 font-bold"
          >
            إغلاق
          </Button>
        </div>
      }
    >
      <div className="space-y-4 text-sm select-none">
        {/* Contact Info Card */}
        <div className="p-4 bg-slate-50/90 rounded-xl border border-slate-300 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
              <User className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">{ownerName}</h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                مطور ومؤسس نظام Compu MSS
              </p>
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-lg border border-slate-200 space-y-3">
            {/* Phone Row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
                <Phone className="w-4 h-4 text-blue-600" />
                <span>رقم الهاتف المباشر:</span>
              </div>
              <span className="font-mono text-base font-bold text-slate-900 tracking-wider">
                {phoneNumber}
              </span>
            </div>

            {/* Quick Actions Row */}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={handleCopyPhone}
                leftIcon={
                  copiedPhone ? (
                    <Check className="w-4 h-4 text-white" />
                  ) : (
                    <Copy className="w-4 h-4 text-white" />
                  )
                }
                className="font-bold text-xs"
              >
                {copiedPhone ? 'تم النسخ!' : 'نسخ الرقم'}
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleOpenWhatsApp}
                leftIcon={<MessageCircle className="w-4 h-4 text-emerald-600" />}
                className="font-bold text-xs border-emerald-300 hover:bg-emerald-50 text-emerald-800"
              >
                محادثة واتساب
              </Button>
            </div>
          </div>

          {/* Full Card Copy Action */}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleCopyContactCard}
            leftIcon={
              copiedCard ? (
                <Check className="w-4 h-4 text-emerald-600" />
              ) : (
                <Share2 className="w-4 h-4 text-slate-600" />
              )
            }
            className="w-full text-xs font-semibold"
          >
            {copiedCard ? 'تم نسخ البطاقة كاملة' : 'نسخ بطاقة التواصل الكاملة'}
          </Button>
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
            Compu MSS v1.0.4
          </span>
        </div>
      </div>
    </Modal>
  );
};
