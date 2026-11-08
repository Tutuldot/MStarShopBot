import { NextRequest, NextResponse } from 'next/server';
import { getWebhookLogs, clearWebhookLogs } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const searchParams = req.nextUrl.searchParams;
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));
  const offset = Math.max(0, parseInt(searchParams.get('offset') || '0', 10));

  try {
    const { logs, total } = await getWebhookLogs(limit, offset);
    return NextResponse.json({ success: true, logs, total });
  } catch (err: any) {
    console.error('Fetch webhook logs error:', err);
    return NextResponse.json({ error: err.message || 'Failed to fetch logs' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden. Admin role required.' }, { status: 403 });
  }

  try {
    await clearWebhookLogs();
    return NextResponse.json({ success: true, message: 'Webhook logs cleared' });
  } catch (err: any) {
    console.error('Clear webhook logs error:', err);
    return NextResponse.json({ error: err.message || 'Failed to clear logs' }, { status: 500 });
  }
}

