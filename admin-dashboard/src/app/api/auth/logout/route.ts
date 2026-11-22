import { NextResponse } from 'next/server';
import { clearAdminSession, getAdminSession } from '@/lib/session';
import { activityLogger } from '@/services/activityLogger';

export async function POST() {
  const session = getAdminSession();
  if (session) {
    await activityLogger.logActivity({
      actorId: session.adminId,
      actorUsername: session.username,
      eventType: 'LOGOUT',
      targetType: 'auth',
      targetId: session.adminId,
      targetUsername: session.username,
      status: 'SUCCESS',
    });
  }
  clearAdminSession();
  return NextResponse.json({ success: true });
}
