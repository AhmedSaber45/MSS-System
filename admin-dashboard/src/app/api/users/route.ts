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
  const moduleParam = searchParams.get('module') || undefined;
  const statusParam = searchParams.get('status') || undefined;
  const storeIdParam = searchParams.get('storeId') || undefined;

  try {
    const users = await adminService.getAppUsers({
      search,
      module: moduleParam,
      status: statusParam,
      storeId: storeIdParam,
    });
    return NextResponse.json({ users });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'فشل في جلب المستخدمين' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = getAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'غير مصرح: يجب تسجيل الدخول كمدير نظام' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const newUser = await adminService.createAppUser(body, session);
    return NextResponse.json({ success: true, user: newUser }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'فشل في إنشاء المستخدم' }, { status: 400 });
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
      return NextResponse.json({ error: 'معرف المستخدم مطلوب' }, { status: 400 });
    }

    if (action === 'toggle_status') {
      await adminService.toggleUserStatus(id, Boolean(body.isActive), session);
      return NextResponse.json({
        success: true,
        message: body.isActive
          ? 'تم إعادة تفعيل حساب المستخدم بنجاح'
          : 'تم تعطيل الحساب وإبطال كافة الجلسات النشطة',
      });
    }

    if (action === 'change_access_code') {
      if (!body.newAccessCode) {
        return NextResponse.json({ error: 'رمز الدخول الجديد مطلوب' }, { status: 400 });
      }
      await adminService.changeUserAccessCode(
        id,
        body.newAccessCode,
        session,
        body.confirmNewAccessCode
      );
      return NextResponse.json({
        success: true,
        message: 'تم تغيير وتشفير رمز الدخول بنجاح وتحديث إصدار الأمان وإبطال الجلسات السابقة',
      });
    }

    if (action === 'revoke_sessions') {
      await adminService.revokeUserSessions(id, session);
      return NextResponse.json({
        success: true,
        message: 'تم إبطال كافة جلسات المستخدم النشطة بنجاح',
      });
    }

    // General update
    const updated = await adminService.updateAppUser(body, session);
    return NextResponse.json({ success: true, user: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'فشل في تحديث المستخدم' }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = getAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'غير مصرح: يجب تسجيل الدخول كمدير نظام' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'معرف المستخدم مطلوب للحذف' }, { status: 400 });
  }

  try {
    await adminService.deleteAppUser(id, session);
    return NextResponse.json({
      success: true,
      message: 'تم حذف حساب المستخدم نهائياً وإلغاء كافة صلاحياته وجلساته بنجاح',
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'فشل في حذف المستخدم' }, { status: 400 });
  }
}
