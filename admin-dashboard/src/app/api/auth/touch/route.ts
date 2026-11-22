import { NextResponse } from 'next/server';
import { getAdminSession, touchAdminSession } from '@/lib/session';

export async function POST() {
  const session = getAdminSession();
  if (!session) {
    return NextResponse.json({ success: false, error: 'جلسة غير صالحة' }, { status: 401 });
  }

  const updated = touchAdminSession();
  return NextResponse.json({
    success: true,
    lastActivityAt: updated?.lastActivityAt,
  });
}
