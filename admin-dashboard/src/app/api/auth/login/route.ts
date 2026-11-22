import { NextRequest, NextResponse } from 'next/server';
import { adminService } from '@/services/adminService';
import { activityLogger } from '@/services/activityLogger';
import { setAdminSession } from '@/lib/session';
import { checkRateLimit, recordFailedAttempt, clearRateLimit } from '@/lib/security';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json({ error: 'اسم المستخدم وكلمة المرور مطلوبان' }, { status: 400 });
    }

    const normUsername = username.toLowerCase();

    // Rate-limiting check
    const rateCheck = checkRateLimit(normUsername);
    if (!rateCheck.allowed) {
      const waitMinutes = Math.ceil((rateCheck.remainingMs || 0) / (60 * 1000));
      await activityLogger.logActivity({
        actorId: 'anonymous',
        actorUsername: normUsername,
        eventType: 'LOGIN_FAILURE',
        targetType: 'auth',
        targetId: normUsername,
        targetUsername: normUsername,
        status: 'FAILURE',
        failureReason: `تم تجاوز الحد المسموح للمحاولات الخاطئة (انتظار ${waitMinutes} دقيقة)`,
      });
      return NextResponse.json(
        { error: `تم تجاوز محاولات الدخول الخاطئة. يرجى الانتظار ${waitMinutes} دقيقة قبل المحاولة مرة أخرى` },
        { status: 429 }
      );
    }

    const admin = await adminService.authenticateAdmin(username, password);

    if (!admin) {
      recordFailedAttempt(normUsername);
      await activityLogger.logActivity({
        actorId: 'anonymous',
        actorUsername: normUsername,
        eventType: 'LOGIN_FAILURE',
        targetType: 'auth',
        targetId: normUsername,
        targetUsername: normUsername,
        status: 'FAILURE',
        failureReason: 'بيانات الدخول غير صحيحة',
      });
      return NextResponse.json({ error: 'بيانات الدخول غير صحيحة' }, { status: 401 });
    }

    clearRateLimit(normUsername);

    // Set secure HTTP-only cookie
    setAdminSession(admin);

    await activityLogger.logActivity({
      actorId: admin.id,
      actorUsername: admin.username,
      eventType: 'LOGIN_SUCCESS',
      targetType: 'auth',
      targetId: admin.id,
      targetUsername: admin.username,
      status: 'SUCCESS',
      metadata: { role: admin.role, displayName: admin.displayName },
    });

    return NextResponse.json({
      success: true,
      admin: {
        id: admin.id,
        username: admin.username,
        displayName: admin.displayName,
        role: admin.role,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'خطأ داخلي في الخادم' }, { status: 500 });
  }
}
