import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/session';
import { adminService } from '@/services/adminService';

export async function GET() {
  const session = getAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'غير مصرح: يجب تسجيل الدخول كمدير نظام' }, { status: 401 });
  }

  try {
    const stats = await adminService.getOverviewStats();
    return NextResponse.json({ stats });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'فشل في جلب إحصائيات النظام' }, { status: 500 });
  }
}
