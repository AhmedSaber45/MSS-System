import { NextRequest, NextResponse } from 'next/server';
import { adminService } from '@/services/adminService';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-device-info',
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { username, accessCode, deviceInfo } = body;

    if (!username || !accessCode) {
      return NextResponse.json(
        { success: false, error: 'اسم المستخدم ورمز الدخول مطلوبان' },
        { status: 400, headers: corsHeaders }
      );
    }

    const result = await adminService.verifyDesktopCredentials({
      username,
      accessCode,
      deviceInfo,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'بيانات الدخول غير صحيحة أو الحساب معطل' },
        { status: 401, headers: corsHeaders }
      );
    }

    return NextResponse.json(
      {
        success: true,
        user: result.user,
        sessionToken: result.sessionToken,
        expiresAt: result.expiresAt,
      },
      { headers: corsHeaders }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'خطأ في معالجة طلب المصادقة' },
      { status: 500, headers: corsHeaders }
    );
  }
}
