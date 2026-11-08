import { NextRequest, NextResponse } from 'next/server';
import { queryAll, queryOne, execute } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { generateGeminiChatReply, getGeminiSettings } from '@/lib/gemini';

// GET all conversations
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const conversations = await queryAll(`
    SELECT 
      c.*,
      (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) as message_count
    FROM conversations c
    ORDER BY c.last_message_at DESC
  `);

  return NextResponse.json({ conversations });
}

// POST: Simulate or inject a message (useful for local testing without live Meta webhook)
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { psid, customerName, customerProfilePic, text } = await req.json();

    if (!text || !text.trim()) {
      return NextResponse.json({ error: 'Message text is required' }, { status: 400 });
    }

    const testPsid = psid || `sim_${Date.now()}`;
    const name = customerName || 'Alex (Test Customer)';
    const { aiAutoReply } = await getGeminiSettings();

    let conv = await queryOne<any>('SELECT * FROM conversations WHERE psid = ?', [testPsid]);

    if (!conv) {
      const res = await execute(`
        INSERT INTO conversations (psid, customer_name, customer_profile_pic, last_message, unread)
        VALUES (?, ?, ?, ?, 1)
      `, [testPsid, name, customerProfilePic || null, text.trim()]);
      conv = await queryOne<any>('SELECT * FROM conversations WHERE id = ?', [res.insertId]);
    } else {
      if (customerProfilePic && !conv.customer_profile_pic) {
        await execute('UPDATE conversations SET customer_profile_pic = ? WHERE id = ?', [customerProfilePic, conv.id]);
        conv.customer_profile_pic = customerProfilePic;
      }
      await execute(`
        UPDATE conversations
        SET last_message = ?, last_message_at = CURRENT_TIMESTAMP, unread = unread + 1
        WHERE id = ?
      `, [text.trim(), conv.id]);
    }

    // Insert customer message
    await execute(`
      INSERT INTO messages (conversation_id, sender_type, text)
      VALUES (?, 'customer', ?)
    `, [conv.id, text.trim()]);

    // If AI auto-reply is enabled and AI not paused for this conversation
    if (aiAutoReply && conv.ai_enabled === 1) {
      const history = await queryAll<{ sender_type: string; text: string }>(`
        SELECT sender_type, text FROM messages
        WHERE conversation_id = ?
        ORDER BY id DESC LIMIT 6
      `, [conv.id]);

      const botReply = await generateGeminiChatReply(text.trim(), history.reverse());

      await execute(`
        INSERT INTO messages (conversation_id, sender_type, text)
        VALUES (?, 'bot', ?)
      `, [conv.id, botReply]);

      await execute(`
        UPDATE conversations
        SET last_message = ?, last_message_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [botReply, conv.id]);
    }

    return NextResponse.json({ success: true, conversationId: conv.id });
  } catch (err: any) {
    console.error('Chat simulation error:', err);
    return NextResponse.json({ error: 'Failed to process message' }, { status: 500 });
  }
}
