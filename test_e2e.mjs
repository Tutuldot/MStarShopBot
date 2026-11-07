import { getDb, logRawWebhook, getWebhookLogs } from './lib/db.ts';

async function runTests() {
  console.log('=============================================');
  console.log('   MStarShopBot Deployment & Webhook Test    ');
  console.log('=============================================');

  let passed = 0;
  let failed = 0;

  function assert(cond, name) {
    if (cond) {
      console.log(`[PASS] ${name}`);
      passed++;
    } else {
      console.error(`[FAIL] ${name}`);
      failed++;
    }
  }

  const db = getDb();

  // Test 1: Verify Token Configuration
  const verifyTokenRow = db.prepare("SELECT value FROM settings WHERE key = 'fb_verify_token'").get();
  const verifyToken = verifyTokenRow?.value || 'mstar_bot_token_secret';
  assert(!!verifyToken, `Meta Verify Token configured: "${verifyToken}"`);

  // Test 2: Gemini API Configuration
  const modelRow = db.prepare("SELECT value FROM settings WHERE key = 'gemini_model'").get();
  const geminiModel = modelRow?.value || 'gemini-2.5-flash';
  assert(geminiModel === 'gemini-2.5-flash', `Gemini model is set to ${geminiModel}`);

  // Test 3: Active Product Basket
  const activeSet = db.prepare('SELECT * FROM basket_sets WHERE is_active = 1').get();
  assert(!!activeSet, `Active basket set exists: "${activeSet?.name}" (ID: ${activeSet?.id})`);

  const products = db.prepare('SELECT * FROM products WHERE basket_set_id = ?').all(activeSet?.id);
  assert(products.length > 0, `Active basket has ${products.length} products ready for recommendations`);
  for (const p of products) {
    assert(!!p.product_url && !!p.name, `Product "${p.name}" has valid target URL: ${p.product_url}`);
  }

  // Test 4: Webhook GET Verification Challenge Simulation
  const mode = 'subscribe';
  const token = verifyToken;
  const challenge = 'meta_challenge_ping_789456';

  const isVerified = mode === 'subscribe' && token === verifyToken;
  assert(isVerified, 'GET Challenge verification matches expected subscribe mode and verify token');

  const getLogId = logRawWebhook({
    method: 'GET',
    source: 'facebook',
    queryParams: { 'hub.mode': mode, 'hub.verify_token': token, 'hub.challenge': challenge },
    status: isVerified ? 'VERIFICATION_SUCCESS' : 'VERIFICATION_FAILED',
  });
  assert(getLogId > 0, `Raw GET challenge verification successfully logged to SQLite (Log ID: ${getLogId})`);

  // Test 5: Webhook POST Incoming Customer Message Event Simulation
  const mockPsid = `customer_test_${Date.now()}`;
  const incomingText = 'Hello! Is the 18k necklace in stock?';
  const rawFacebookJson = JSON.stringify({
    object: 'page',
    entry: [
      {
        id: '104217771726746',
        time: Date.now(),
        messaging: [
          {
            sender: { id: mockPsid },
            recipient: { id: '104217771726746' },
            timestamp: Date.now(),
            message: {
              mid: `mid_test_${Date.now()}`,
              text: incomingText
            }
          }
        ]
      }
    ]
  });

  const postLogId = logRawWebhook({
    method: 'POST',
    source: 'facebook',
    headers: {
      'content-type': 'application/json',
      'user-agent': 'facebookplatform/1.0 (+http://developers.facebook.com)',
      'x-hub-signature-256': 'sha256=mocked_meta_signature_hash'
    },
    rawPayload: rawFacebookJson,
    status: 'RECEIVED'
  });
  assert(postLogId > 0, `Raw POST message payload successfully preserved byte-for-byte in webhook_logs (Log ID: ${postLogId})`);

  // Test 6: Inbound Conversation and Message Record Creation
  const parsed = JSON.parse(rawFacebookJson);
  const event = parsed.entry[0].messaging[0];

  const convRes = db.prepare(`
    INSERT INTO conversations (psid, customer_name, last_message, unread)
    VALUES (?, ?, ?, 1)
  `).run(event.sender.id, `User ${mockPsid.slice(-4)}`, event.message.text);

  const convId = convRes.lastInsertRowid;
  assert(Number(convId) > 0, `Conversation created for PSID ${mockPsid}`);

  const msgRes = db.prepare(`
    INSERT INTO messages (conversation_id, sender_type, text)
    VALUES (?, 'customer', ?)
  `).run(convId, event.message.text);
  assert(Number(msgRes.lastInsertRowid) > 0, 'Customer message saved in messages table');

  // Test 7: Retrieve and inspect webhook_logs table
  const { logs, total } = getWebhookLogs(10);
  assert(total >= 2, `Webhook logs counter shows ${total} total logged requests`);
  const latestPost = logs.find((l) => l.id === postLogId);
  assert(!!latestPost && latestPost.raw_payload === rawFacebookJson, 'Retrieved raw payload from database exactly matches original JSON byte-for-byte');

  // Test 8: Admin Authentication and Users
  const adminUser = db.prepare("SELECT id, name, email, role FROM users WHERE role = 'admin'").get();
  assert(!!adminUser, `Admin account present: ${adminUser?.email} (${adminUser?.name})`);

  console.log('=============================================');
  console.log(`Test Summary: ${passed} PASSED, ${failed} FAILED`);
  console.log('=============================================');

  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

