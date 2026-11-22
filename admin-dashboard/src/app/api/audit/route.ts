import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/session';
import { activityLogger } from '@/services/activityLogger';

export async function GET(req: NextRequest) {
  const session = getAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'غير مصرح: يجب تسجيل الدخول كمدير نظام' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const search = searchParams.get('search') || undefined;
  const eventType = searchParams.get('eventType') || undefined;
  const statusParam = searchParams.get('status') || undefined;
  const targetType = searchParams.get('targetType') || undefined;
  const limitParam = searchParams.get('limit');
  const offsetParam = searchParams.get('offset');

  const limit = limitParam ? parseInt(limitParam, 10) : 50;
  const offset = offsetParam ? parseInt(offsetParam, 10) : 0;
  const status = statusParam === 'SUCCESS' || statusParam === 'FAILURE' ? statusParam : 'ALL';

  try {
    const { logs, total } = await activityLogger.getLogs({
      search,
      eventType,
      status,
      targetType,
      limit,
      offset,
    });
    return NextResponse.json({ success: true, logs, total });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'فشل في جلب سجل النشاط والتدقيق' }, { status: 500 });
  }
}
