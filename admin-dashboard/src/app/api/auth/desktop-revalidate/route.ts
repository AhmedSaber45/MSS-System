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
    const { sessionToken } = body;

    if (!sessionToken) {
      return NextResponse.json(
        { success: false, reason: 'SESSION_REVOKED', error: 'رمز الجلسة مطلوب' },
        { status: 400, headers: corsHeaders }
      );
    }

    const result = await adminService.revalidateDesktopSession({ sessionToken });

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          reason: result.reason,
          error: result.error || 'بيانات الجلسة غير صالحة أو تم إبطالها',
        },
        { status: 401, headers: corsHeaders }
      );
    }

    return NextResponse.json(
      {
        success: true,
        reason: 'VALID',
        user: result.user,
        expiresAt: result.expiresAt,
      },
      { headers: corsHeaders }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'خطأ في معالجة طلب إعادة التحقق من الجلسة' },
      { status: 500, headers: corsHeaders }
    );
  }
}
