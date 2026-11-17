import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/session';
import { adminService } from '@/services/adminService';

export async function GET(req: NextRequest) {
  const session = getAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'غير مصرح: يجب تسجيل الدخول كمدير نظام' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const sourcesRaw = searchParams.get('sources');
  const dest = searchParams.get('dest') || undefined;
  const newDestName = searchParams.get('newDestName') || undefined;

  if (!sourcesRaw) {
    return NextResponse.json(
      { error: 'يجب تمرير معرفات الفروع المصدر في معامل sources' },
      { status: 400 }
    );
  }

  const sourceStoreIds = sourcesRaw.split(',').map(s => s.trim()).filter(Boolean);

  try {
    const preview = await adminService.previewStoreMerge(
      sourceStoreIds,
      dest,
      newDestName
    );
    return NextResponse.json({ preview });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'فشل في معاينة تأثير عملية الدمج' },
      { status: 400 }
    );
  }
}

export async function POST(req: NextRequest) {
  const session = getAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'غير مصرح: يجب تسجيل الدخول كمدير نظام' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const result = await adminService.executeStoreMerge(body, session);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'فشل في تنفيذ عملية دمج الفروع' },
      { status: 400 }
    );
  }
}
