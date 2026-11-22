import Link from 'next/link';
import { Store } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <div className="text-center max-w-md bg-[#12151D] border border-[#212735] p-8 rounded-2xl shadow-xl">
        <div className="w-16 h-16 rounded-2xl bg-[#1B202D] border border-[#2A3245] flex items-center justify-center mx-auto text-[#C5A059] mb-4">
          <Store className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">الصفحة غير موجودة</h2>
        <p className="text-sm text-gray-400 mb-6">
          الصفحة المطلوبة غير متوفرة. يمكنك العودة إلى قائمة المخزون المتاح في الفروع.
        </p>
        <Link
          href="/"
          className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg bg-[#C5A059] hover:bg-[#B08842] text-black font-bold text-sm transition-colors"
        >
          العودة لقائمة الأجهزة
        </Link>
      </div>
    </div>
  );
}
