import { NextRequest, NextResponse } from 'next/server';
import { getDb, logRawWebhook, updateWebhookLogStatus } from '@/lib/db';
import { getMetaSettings, sendMetaTextMessage, fetchMetaUserProfile } from '@/lib/meta';
import { generateGeminiChatReply, getGeminiSettings } from '@/lib/gemini';

// Webhook Verification (GET)
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  const { verifyToken } = getMetaSettings();

  const headersObj: Record<string, string> = {};
  req.headers.forEach((val, key) => {
    headersObj[key] = val;
  });

  const queryParams: Record<string, string> = {};
  searchParams.forEach((val, key) => {
    queryParams[key] = val;
  });

  const isVerified = mode === 'subscribe' && token === verifyToken;

  // Log raw GET verification attempt
  logRawWebhook({
    method: 'GET',
    source: 'facebook',
    headers: headersObj,
    queryParams,
    status: isVerified ? 'VERIFICATION_SUCCESS' : 'VERIFICATION_FAILED',
    errorMessage: isVerified ? undefined : `Mode=${mode}, Token mismatch (received="${token}", expected="${verifyToken}")`,
  });

  if (isVerified) {
    console.log('[Webhook] Verification succeeded from Meta');
    try {
      const db = getDb();
      db.prepare(`
        INSERT INTO settings (key, value) VALUES ('last_webhook_verified_at', datetime('now'))
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `).run();
    } catch (e) {
      console.error('[Webhook] Failed to record last_webhook_verified_at:', e);
    }
    return new NextResponse(challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  console.warn('[Webhook] Verification failed - mode or token mismatch', { mode, tokenReceived: token, expected: verifyToken });
  return new NextResponse('Forbidden', { status: 403 });
}

// Incoming Events (POST)
export async function POST(req: NextRequest) {
  let logId = -1;
  try {
    // 1. Read raw body as text first to preserve exact raw payload byte-for-byte
    const rawBody = await req.text();

    const headersObj: Record<string, string> = {};
    req.headers.forEach((val, key) => {
      headersObj[key] = val;
    });

    // 2. Immediately log the raw incoming payload
    logId = logRawWebhook({
      method: 'POST',
      source: 'facebook',
      headers: headersObj,
      rawPayload: rawBody,
      status: 'RECEIVED',
    });

    // 3. Parse JSON
    let body: any;
    try {
      body = JSON.parse(rawBody);
    } catch (parseErr: any) {
      updateWebhookLogStatus(logId, 'PARSE_ERROR', parseErr.message);
      return new NextResponse('Bad Request: Invalid JSON', { status: 400 });
    }

    if (body.object !== 'page') {
      updateWebhookLogStatus(logId, 'IGNORED_NON_PAGE_OBJECT', `Object received: ${body.object}`);
      return new NextResponse('Not Found', { status: 404 });
    }

    const db = getDb();
    const { aiAutoReply } = getGeminiSettings();

    // Record that we received a webhook event
    try {
      db.prepare(`
        INSERT INTO settings (key, value) VALUES ('last_webhook_event_at', datetime('now'))
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `).run();
    } catch (e) {
      console.error('[Webhook] Failed to record last_webhook_event_at:', e);
    }

    let processedCount = 0;

    for (const entry of body.entry || []) {
      for (const event of entry.messaging || []) {
        const senderPsid = event.sender?.id;

        // Skip messages sent by our own page to prevent infinite loops
        if (event.message?.is_echo) {
          continue;
        }

        if (senderPsid && event.message?.text) {
          processedCount++;
          const userText = event.message.text.trim();

          // 1. Get or create conversation record
          let conv = db.prepare('SELECT * FROM conversations WHERE psid = ?').get(senderPsid) as any;

          if (!conv) {
            // Attempt to fetch user's name from Meta Graph API
            const profile = await fetchMetaUserProfile(senderPsid);
            const customerName = profile?.name || `User ${senderPsid.slice(-4)}`;
            const profilePic = profile?.profile_pic || null;

            const res = db.prepare(`
              INSERT INTO conversations (psid, customer_name, customer_profile_pic, last_message, unread)
              VALUES (?, ?, ?, ?, 1)
            `).run(senderPsid, customerName, profilePic, userText);

            conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(res.lastInsertRowid) as any;
          } else {
            db.prepare(`
              UPDATE conversations
              SET last_message = ?, last_message_at = CURRENT_TIMESTAMP, unread = unread + 1
              WHERE id = ?
            `).run(userText, conv.id);
          }

          // 2. Store customer message
          db.prepare(`
            INSERT INTO messages (conversation_id, sender_type, text)
            VALUES (?, 'customer', ?)
          `).run(conv.id, userText);

          // 3. Automated AI Reply if enabled
          const isAiEnabledForUser = conv.ai_enabled === 1;
          if (aiAutoReply && isAiEnabledForUser) {
            // Retrieve recent conversation history
            const history = db.prepare(`
              SELECT sender_type, text FROM messages
              WHERE conversation_id = ?
              ORDER BY id DESC LIMIT 6
            `).all(conv.id) as { sender_type: string; text: string }[];

            // Generate AI response with Gemini
            const aiReply = await generateGeminiChatReply(userText, history.reverse());

            // Send to Facebook Messenger
            await sendMetaTextMessage(senderPsid, aiReply);

            // Record bot response in database
            db.prepare(`
              INSERT INTO messages (conversation_id, sender_type, text)
              VALUES (?, 'bot', ?)
            `).run(conv.id, aiReply);

            // Update conversation record
            db.prepare(`
              UPDATE conversations
              SET last_message = ?, last_message_at = CURRENT_TIMESTAMP
              WHERE id = ?
            `).run(aiReply, conv.id);
          }
        }
      }
    }

    updateWebhookLogStatus(logId, 'PROCESSED', `Processed ${processedCount} inbound message(s)`);
    return new NextResponse('EVENT_RECEIVED', { status: 200 });
  } catch (err: any) {
    console.error('[Webhook Error]:', err);
    if (logId > 0) {
      updateWebhookLogStatus(logId, 'ERROR', err.message);
    }
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
