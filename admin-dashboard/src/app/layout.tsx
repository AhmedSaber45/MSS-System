import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Compu MSS — لوحة تحكم الإدارة المركزية',
  description: 'نظام إدارة الحسابات، الصلاحيات، الفروع وسجل التدقيق لشركة Compu MSS',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl" className="dark">
      <body className="bg-brand-bg text-slate-100 antialiased selection:bg-brand-primary selection:text-white">
        {children}
      </body>
    </html>
  );
}
