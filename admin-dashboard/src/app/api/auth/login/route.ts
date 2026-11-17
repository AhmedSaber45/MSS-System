import { NextRequest, NextResponse } from 'next/server';
import { adminService } from '@/services/adminService';
import { setAdminSession } from '@/lib/session';
import { checkRateLimit, recordFailedAttempt, clearRateLimit } from '@/lib/security';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json({ error: 'اسم المستخدم وكلمة المرور مطلوبان' }, { status: 400 });
    }

    // Rate-limiting check
    const rateCheck = checkRateLimit(username.toLowerCase());
    if (!rateCheck.allowed) {
      const waitMinutes = Math.ceil((rateCheck.remainingMs || 0) / (60 * 1000));
      return NextResponse.json(
        { error: `تم تجاوز محاولات الدخول الخاطئة. يرجى الانتظار ${waitMinutes} دقيقة قبل المحاولة مرة أخرى` },
        { status: 429 }
      );
    }

    const admin = await adminService.authenticateAdmin(username, password);

    if (!admin) {
      recordFailedAttempt(username.toLowerCase());
      return NextResponse.json({ error: 'بيانات الدخول غير صحيحة' }, { status: 401 });
    }

    clearRateLimit(username.toLowerCase());

    // Set secure HTTP-only cookie
    setAdminSession(admin);

    await adminService.logAdminAudit(
      { adminId: admin.id, username: admin.username, displayName: admin.displayName, role: admin.role, exp: 0 },
      'ADMIN_LOGIN_SUCCESS',
      'auth',
      admin.id,
      { role: admin.role }
    );

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
