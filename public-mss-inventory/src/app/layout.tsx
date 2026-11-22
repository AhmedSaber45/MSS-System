import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Footer } from '../components/Footer';

export const metadata: Metadata = {
  title: 'Compu MSS — قائمة الأجهزة المتوفرة بالفروع',
  description: 'عرض فوري ومباشر لجميع الأجهزة واللابتوبات والشاشات في فروع Compu MSS مع المواصفات والأسعار والكميات الفعلية.',
  icons: {
    icon: '/favicon.ico',
    apple: '/as_icon_512.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl">
      <body className="bg-slate-50 text-slate-900 min-h-screen flex flex-col antialiased overflow-x-hidden selection:bg-slate-900 selection:text-white">
        <div className="flex-1 w-full max-w-full overflow-x-hidden flex flex-col">
          {children}
        </div>
        <Footer />
      </body>
    </html>
  );
}
