import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/session';
import { adminService } from '@/services/adminService';

export async function GET(req: NextRequest) {
  const session = getAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'غير مصرح: يجب تسجيل الدخول كمدير نظام' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const transferId = searchParams.get('id');

  try {
    if (transferId) {
      const transfer = await adminService.getTransferDetails(transferId);
      if (!transfer) {
        return NextResponse.json({ error: 'التحويل غير موجود' }, { status: 404 });
      }
      return NextResponse.json({ success: true, transfer });
    }

    const search = searchParams.get('search') || undefined;
    const status = searchParams.get('status') || undefined;
    const sourceLocation = searchParams.get('source') || undefined;
    const destinationLocation = searchParams.get('destination') || undefined;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const result = await adminService.getTransferHistory({
      search,
      status,
      sourceLocation,
      destinationLocation,
      page,
      limit,
    });

    return NextResponse.json({
      success: true,
      transfers: result.transfers,
      total: result.total,
      page,
      limit,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'فشل في استرجاع سجل التحويلات' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = getAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'غير مصرح: يجب تسجيل الدخول كمدير نظام' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { action = 'execute' } = body;

    if (action === 'preview') {
      const preview = await adminService.previewInventoryTransfer({
        sourceLocation: body.sourceLocation,
        destinationLocation: body.destinationLocation,
        transferType: body.transferType,
        deviceIds: body.deviceIds,
        modelId: body.modelId,
        allEligible: body.allEligible,
      });

      return NextResponse.json({ success: true, preview });
    }

    if (action === 'execute') {
      const result = await adminService.executeInventoryTransfer(
        {
          sourceLocation: body.sourceLocation,
          destinationLocation: body.destinationLocation,
          transferType: body.transferType,
          deviceIds: body.deviceIds,
          modelId: body.modelId,
          allEligible: body.allEligible,
          notes: body.notes,
          idempotencyKey: body.idempotencyKey,
          confirmed: Boolean(body.confirmed),
        },
        session
      );

      return NextResponse.json({ success: true, result });
    }

    return NextResponse.json({ error: 'الإجراء المطلوب غير صالح' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'فشل في تنفيذ العملية' }, { status: 400 });
  }
}
