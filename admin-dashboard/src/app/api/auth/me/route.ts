import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  SESSION_COOKIE_NAME,
  inspectSessionToken,
  touchAdminSession,
  clearAdminSession,
} from '@/lib/session';
import { adminService } from '@/services/adminService';

export async function GET(req: NextRequest) {
  const cookieStore = cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);

  if (!sessionCookie || !sessionCookie.value) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const inspection = inspectSessionToken(sessionCookie.value);

  if (!inspection.valid || !inspection.payload) {
    clearAdminSession();
    const isTimeout = inspection.reason === 'INACTIVITY_TIMEOUT';
    return NextResponse.json(
      {
        authenticated: false,
        reason: inspection.reason || 'UNAUTHENTICATED',
        error: isTimeout
          ? 'انتهت صلاحية الجلسة لعدم وجود أي نشاط لمدة 7 أيام متتالية (168 ساعة)'
          : 'جلسة الدخول غير صالحة',
      },
      { status: 401 }
    );
  }

  const session = inspection.payload;

  // Touch session if caller indicated meaningful active user action (e.g. startup or active navigation)
  const isUserAction =
    req.headers.get('x-user-action') === 'true' || req.nextUrl.searchParams.get('touch') === 'true';

  let currentLastActivity = session.lastActivityAt;
  if (isUserAction) {
    const touched = touchAdminSession();
    if (touched?.lastActivityAt) {
      currentLastActivity = touched.lastActivityAt;
    }
  }

  // Refresh user's effective permissions from database
  const effectiveModules = await adminService.getUserEffectiveModulePermission(
    session.adminId,
    session.role
  );

  return NextResponse.json({
    authenticated: true,
    admin: {
      id: session.adminId,
      username: session.username,
      displayName: session.displayName,
      role: session.role,
      allowedModules: effectiveModules,
      lastActivityAt: currentLastActivity,
    },
  });
}
