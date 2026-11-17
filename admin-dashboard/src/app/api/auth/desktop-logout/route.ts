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
      return NextResponse.json({ success: true }, { headers: corsHeaders });
    }

    await adminService.logoutDesktopSession({ sessionToken });

    return NextResponse.json({ success: true }, { headers: corsHeaders });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'خطأ في معالجة طلب تسجيل الخروج' },
      { status: 500, headers: corsHeaders }
    );
  }
}
