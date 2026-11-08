import { NextRequest, NextResponse } from 'next/server';
import { queryOne, queryAll, execute } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const conversation = await queryOne('SELECT * FROM conversations WHERE id = ?', [Number(id)]);
  if (!conversation) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
  }

  // Mark unread as 0 when viewed
  await execute('UPDATE conversations SET unread = 0 WHERE id = ?', [Number(id)]);

  const messages = await queryAll(`
    SELECT * FROM messages
    WHERE conversation_id = ?
    ORDER BY id ASC
  `, [Number(id)]);

  return NextResponse.json({ conversation, messages });
}
