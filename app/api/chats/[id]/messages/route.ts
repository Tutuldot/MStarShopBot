import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { sendMetaTextMessage } from '@/lib/meta';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  try {
    const { text } = await req.json();

    if (!text || !text.trim()) {
      return NextResponse.json({ error: 'Message text is required' }, { status: 400 });
    }

    const db = getDb();
    const conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(Number(id)) as any;
    if (!conv) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    // 1. Record agent message in database
    const res = db.prepare(`
      INSERT INTO messages (conversation_id, sender_type, text)
      VALUES (?, 'agent', ?)
    `).run(conv.id, text.trim());

    // Update conversation last message
    db.prepare(`
      UPDATE conversations
      SET last_message = ?, last_message_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(text.trim(), conv.id);

    // 2. Deliver message to Facebook Messenger if not a local test simulation
    let metaResult = { success: true, delivered: false };
    if (!conv.psid.startsWith('sim_')) {
      const sendResult = await sendMetaTextMessage(conv.psid, text.trim());
      metaResult = { success: sendResult.success, delivered: sendResult.success };
      if (!sendResult.success) {
        console.warn('Meta delivery warning:', sendResult.error);
      }
    }

    return NextResponse.json({
      success: true,
      messageId: res.lastInsertRowid,
      metaDelivery: metaResult,
    });
  } catch (err: any) {
    console.error('Send message error:', err);
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
}
