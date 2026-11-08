import { NextRequest, NextResponse } from 'next/server';
import { queryAll, execute } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rows = await queryAll<{ key: string; value: string }>('SELECT `key`, `value` FROM settings');
  const settings: Record<string, string> = {};
  for (const r of rows) {
    settings[r.key] = r.value || '';
  }

  return NextResponse.json({ settings });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden. Admin role required.' }, { status: 403 });
  }

  try {
    const body = await req.json();

    for (const [key, value] of Object.entries(body)) {
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        await execute(
          'INSERT INTO settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)',
          [key, String(value)]
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Update settings error:', err);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}
