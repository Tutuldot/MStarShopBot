import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { generateGeminiChatReply, getGeminiSettings } from '@/lib/gemini';

// GET all conversations
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const conversations = db.prepare(`
    SELECT 
      c.*,
      (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) as message_count
    FROM conversations c
    ORDER BY c.last_message_at DESC
  `).all();

  return NextResponse.json({ conversations });
}

// POST: Simulate or inject a message (useful for local testing without live Meta webhook)
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { psid, customerName, text } = await req.json();

    if (!text || !text.trim()) {
      return NextResponse.json({ error: 'Message text is required' }, { status: 400 });
    }

    const testPsid = psid || `sim_${Date.now()}`;
    const name = customerName || 'Alex (Test Customer)';
    const db = getDb();
    const { aiAutoReply } = getGeminiSettings();

    let conv = db.prepare('SELECT * FROM conversations WHERE psid = ?').get(testPsid) as any;

    if (!conv) {
      const res = db.prepare(`
        INSERT INTO conversations (psid, customer_name, last_message, unread)
        VALUES (?, ?, ?, 1)
      `).run(testPsid, name, text.trim());
      conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(res.lastInsertRowid) as any;
    } else {
      db.prepare(`
        UPDATE conversations
        SET last_message = ?, last_message_at = CURRENT_TIMESTAMP, unread = unread + 1
        WHERE id = ?
      `).run(text.trim(), conv.id);
    }

    // Insert customer message
    db.prepare(`
      INSERT INTO messages (conversation_id, sender_type, text)
      VALUES (?, 'customer', ?)
    `).run(conv.id, text.trim());

    // If AI auto-reply is enabled and AI not paused for this conversation
    if (aiAutoReply && conv.ai_enabled === 1) {
      const history = db.prepare(`
        SELECT sender_type, text FROM messages
        WHERE conversation_id = ?
        ORDER BY id DESC LIMIT 6
      `).all(conv.id) as { sender_type: string; text: string }[];

      const botReply = await generateGeminiChatReply(text.trim(), history.reverse());

      db.prepare(`
        INSERT INTO messages (conversation_id, sender_type, text)
        VALUES (?, 'bot', ?)
      `).run(conv.id, botReply);

      db.prepare(`
        UPDATE conversations
        SET last_message = ?, last_message_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(botReply, conv.id);
    }

    return NextResponse.json({ success: true, conversationId: conv.id });
  } catch (err: any) {
    console.error('Chat simulation error:', err);
    return NextResponse.json({ error: 'Failed to process message' }, { status: 500 });
  }
}
