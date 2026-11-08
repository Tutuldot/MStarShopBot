import { NextRequest, NextResponse } from 'next/server';
import { queryOne, execute } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const conv = await queryOne<{ ai_enabled: number }>('SELECT ai_enabled FROM conversations WHERE id = ?', [Number(id)]);
  if (!conv) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
  }

  const newStatus = conv.ai_enabled === 1 ? 0 : 1;
  await execute('UPDATE conversations SET ai_enabled = ? WHERE id = ?', [newStatus, Number(id)]);

  return NextResponse.json({ success: true, ai_enabled: newStatus });
}
