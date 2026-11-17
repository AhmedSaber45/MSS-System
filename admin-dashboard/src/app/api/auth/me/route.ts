import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/session';

export async function GET() {
  const session = getAdminSession();
  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  return NextResponse.json({
    authenticated: true,
    admin: {
      id: session.adminId,
      username: session.username,
      displayName: session.displayName,
      role: session.role,
    },
  });
}
