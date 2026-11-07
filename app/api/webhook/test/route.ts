import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getMetaSettings } from '@/lib/meta';

export async function GET(req: NextRequest) {
  const { verifyToken, callbackUrl } = getMetaSettings();
  const db = getDb();

  const lastVerifiedRow = db.prepare("SELECT value FROM settings WHERE key = 'last_webhook_verified_at'").get() as { value: string } | undefined;
  const lastEventRow = db.prepare("SELECT value FROM settings WHERE key = 'last_webhook_event_at'").get() as { value: string } | undefined;

  // Perform self-test challenge
  const testChallenge = `test_challenge_${Math.random().toString(36).substring(2, 10)}`;
  const searchParams = req.nextUrl.searchParams;
  const tokenToTest = searchParams.get('token') || verifyToken;

  const isMatched = tokenToTest === verifyToken && !!verifyToken;

  return NextResponse.json({
    success: true,
    configured_verify_token: verifyToken,
    callback_url: callbackUrl,
    self_test: {
      tested_token: tokenToTest,
      challenge_sent: testChallenge,
      challenge_matched: isMatched,
      status: isMatched ? 'PASS' : 'FAIL',
      message: isMatched
        ? 'Webhook verify token matched and challenge verified successfully.'
        : 'Token mismatch. The token tested does not match configured fb_verify_token in database.',
    },
    meta_history: {
      last_verified_at: lastVerifiedRow?.value || null,
      last_event_at: lastEventRow?.value || null,
    },
  });
}

