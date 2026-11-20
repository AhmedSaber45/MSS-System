import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/session';
import { adminService } from '@/services/adminService';
import type { ModulePermission } from '@/types/admin';

export async function GET(req: NextRequest) {
  const session = getAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'غير مصرح: يجب تسجيل الدخول كمدير نظام' }, { status: 401 });
  }

  // 1. Resolve user's actual saved module permission from source of truth
  const effectiveModules = await adminService.getUserEffectiveModulePermission(
    session.adminId,
    session.role
  );

  // 2. Allow Super Admin to optionally preview a specific scope via ?scope=
  const { searchParams } = new URL(req.url);
  const requestedScope = searchParams.get('scope') || searchParams.get('module');
  let finalScope: ModulePermission | 'none' = effectiveModules;

  if (session.role === 'superadmin' && requestedScope && ['accessories', 'mss', 'both'].includes(requestedScope)) {
    finalScope = requestedScope as ModulePermission;
  }

  try {
    const stats = await adminService.getOverviewStats(finalScope);
    return NextResponse.json({ stats, moduleScope: finalScope });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'فشل في جلب إحصائيات النظام' }, { status: 500 });
  }
}
