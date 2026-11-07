import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const db = getDb();

  const conv = db.prepare('SELECT ai_enabled FROM conversations WHERE id = ?').get(Number(id)) as { ai_enabled: number } | undefined;
  if (!conv) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
  }

  const newStatus = conv.ai_enabled === 1 ? 0 : 1;
  db.prepare('UPDATE conversations SET ai_enabled = ? WHERE id = ?').run(newStatus, Number(id));

  return NextResponse.json({ success: true, ai_enabled: newStatus });
}
