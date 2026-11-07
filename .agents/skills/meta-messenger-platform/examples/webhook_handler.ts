import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

interface MetaWebhookEvent {
  sender: { id: string };
  recipient: { id: string };
  timestamp: number;
  message?: {
    mid: string;
    text?: string;
    is_echo?: boolean;
    quick_reply?: { payload: string };
  };
  postback?: {
    title: string;
    payload: string;
  };
}

// 1. Verify GET Challenge
export async function handleWebhookChallenge(req: NextRequest, expectedVerifyToken: string) {
  const searchParams = req.nextUrl.searchParams;
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === expectedVerifyToken) {
    return new NextResponse(challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  return new NextResponse('Forbidden', { status: 403 });
}

// 2. Validate HMAC SHA256 Signature
export function verifySignature(rawBody: string, appSecret: string, signatureHeader: string | null): boolean {
  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) return false;
  const signature = signatureHeader.slice(7);
  const hash = crypto.createHmac('sha256', appSecret).update(rawBody, 'utf8').digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(hash, 'hex'));
}

// 3. Process Inbound Events
export async function processWebhookEvents(
  body: any,
  onIncomingMessage: (psid: string, text: string) => Promise<void>,
  onPostback?: (psid: string, payload: string) => Promise<void>
) {
  if (body.object !== 'page') return;

  for (const entry of body.entry || []) {
    for (const event of (entry.messaging || []) as MetaWebhookEvent[]) {
      // Ignore echoes
      if (event.message?.is_echo) continue;

      const psid = event.sender?.id;
      if (!psid) continue;

      if (event.message?.text) {
        await onIncomingMessage(psid, event.message.text.trim());
      } else if (event.postback?.payload && onPostback) {
        await onPostback(psid, event.postback.payload);
      }
    }
  }
}

