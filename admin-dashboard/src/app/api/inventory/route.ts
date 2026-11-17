import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/session';
import { adminService } from '@/services/adminService';

export async function GET(req: NextRequest) {
  const session = getAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'غير مصرح: يجب تسجيل الدخول كمدير نظام' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const search = searchParams.get('search') || undefined;
  const stockLocation = searchParams.get('location') || searchParams.get('stockLocation') || undefined;
  const status = searchParams.get('status') || undefined;
  const category = searchParams.get('category') || undefined;
  const modelId = searchParams.get('modelId') || undefined;
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '50', 10);
  const mode = searchParams.get('mode') || 'full';

  try {
    if (mode === 'foundation_only') {
      const inventory = await adminService.getInventoryFoundation();
      return NextResponse.json({ inventory });
    }

    const data = await adminService.getInventoryOverview({
      search,
      stockLocation,
      status,
      category,
      modelId,
      page,
      limit,
    });

    return NextResponse.json({
      success: true,
      devices: data.devices,
      summary: data.summary,
      total: data.total,
      page: data.page,
      limit: data.limit,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'فشل في جلب بيانات المخزون' }, { status: 500 });
  }
}
