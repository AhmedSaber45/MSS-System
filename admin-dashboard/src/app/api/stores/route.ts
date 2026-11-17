import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/session';
import { adminService } from '@/services/adminService';

export async function GET(req: NextRequest) {
  const session = getAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'غير مصرح: يجب تسجيل الدخول كمدير نظام' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  const search = searchParams.get('search') || undefined;
  const type = (searchParams.get('type') as any) || undefined;
  const status = searchParams.get('status') || undefined;
  const includeArchived = searchParams.get('includeArchived') !== 'false';

  try {
    if (id) {
      const store = await adminService.getStoreDetails(id);
      if (!store) {
        return NextResponse.json({ error: 'الفرع أو المخزن غير موجود' }, { status: 404 });
      }
      return NextResponse.json({ store });
    }

    const stores = await adminService.getStores({
      search,
      type,
      status,
      includeArchived,
    });
    return NextResponse.json({ stores });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'فشل في جلب الفروع والمخازن' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = getAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'غير مصرح: يجب تسجيل الدخول كمدير نظام' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { action } = body;

    if (action === 'assign_user') {
      const { storeId, userId, isPrimary } = body;
      if (!storeId || !userId) {
        return NextResponse.json({ error: 'معرف الفرع والمستخدم مطلوبان' }, { status: 400 });
      }
      await adminService.assignUserToStore({ storeId, userId, isPrimary }, session);
      return NextResponse.json({ success: true, message: 'تم تعيين المستخدم بالفرع بنجاح' });
    }

    if (action === 'remove_user') {
      const { storeId, userId } = body;
      if (!storeId || !userId) {
        return NextResponse.json({ error: 'معرف الفرع والمستخدم مطلوبان' }, { status: 400 });
      }
      await adminService.removeUserFromStore(storeId, userId, session);
      return NextResponse.json({ success: true, message: 'تم إزالة المستخدم من الفرع بنجاح' });
    }

    const newStore = await adminService.createStore(body, session);
    return NextResponse.json({ success: true, store: newStore }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'فشل في إضافة الفرع/المخزن' }, { status: 400 });
  }
}

export async function PATCH(req: NextRequest) {
  const session = getAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'غير مصرح: يجب تسجيل الدخول كمدير نظام' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { action, id } = body;

    if (!id) {
      return NextResponse.json({ error: 'معرف الفرع/المخزن مطلوب' }, { status: 400 });
    }

    if (action === 'toggle_status') {
      await adminService.toggleStoreStatus(id, Boolean(body.isActive), session);
      return NextResponse.json({ success: true, message: 'تم تحديث حالة الفرع بنجاح' });
    }

    if (action === 'archive') {
      await adminService.archiveStore(id, session);
      return NextResponse.json({ success: true, message: 'تم أرشفة الفرع بنجاح مع الحفاظ على السجلات' });
    }

    const updated = await adminService.updateStore(body, session);
    return NextResponse.json({ success: true, store: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'فشل في تحديث بيانات الفرع' }, { status: 400 });
  }
}
