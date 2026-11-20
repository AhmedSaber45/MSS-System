import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/session';
import { adminService } from '@/services/adminService';

export async function GET() {
  const session = getAdminSession();
  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  // Always refresh user's effective permissions from database
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
    },
  });
}
