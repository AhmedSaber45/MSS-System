import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AS System Admin Dashboard',
  description: 'نظام إدارة الحسابات، الصلاحيات، الفروع وسجل التدقيق لشركة Compu MSS',
  icons: {
    icon: '/favicon.ico',
    apple: '/assets/branding/as_icon_512.png',
  },
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
