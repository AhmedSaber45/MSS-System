import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/session';
import { adminService } from '@/services/adminService';

export async function GET(req: NextRequest) {
  const session = getAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'غير مصرح: يجب تسجيل الدخول كمدير نظام' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const limitParam = searchParams.get('limit');
  const limit = limitParam ? parseInt(limitParam, 10) : 100;

  try {
    const logs = await adminService.getAuditLogs(limit);
    return NextResponse.json({ logs });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'فشل في جلب سجل التدقيق' }, { status: 500 });
  }
}
