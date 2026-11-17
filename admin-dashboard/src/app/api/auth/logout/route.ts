import { NextResponse } from 'next/server';
import { clearAdminSession, getAdminSession } from '@/lib/session';
import { adminService } from '@/services/adminService';

export async function POST() {
  const session = getAdminSession();
  if (session) {
    await adminService.logAdminAudit(
      session,
      'ADMIN_LOGOUT',
      'auth',
      session.adminId,
      { username: session.username }
    );
  }
  clearAdminSession();
  return NextResponse.json({ success: true });
}
