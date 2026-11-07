import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const db = getDb();

  const conversation = db.prepare('SELECT * FROM conversations WHERE id = ?').get(Number(id));
  if (!conversation) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
  }

  // Mark unread as 0 when viewed
  db.prepare('UPDATE conversations SET unread = 0 WHERE id = ?').run(Number(id));

  const messages = db.prepare(`
    SELECT * FROM messages
    WHERE conversation_id = ?
    ORDER BY id ASC
  `).all(Number(id));

  return NextResponse.json({ conversation, messages });
}
