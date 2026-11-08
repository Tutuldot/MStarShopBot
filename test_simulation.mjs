import { generateGeminiChatReply, getGeminiSettings } from './lib/gemini.ts';
import { queryOne, queryAll, execute } from './lib/db.ts';

async function runSimulation() {
  console.log('==============================================');
  console.log('   Simulating Live Customer & Gemini AI Chat   ');
  console.log('==============================================');

  const settings = await getGeminiSettings();
  console.log(`[Config] Model: ${settings.model}`);
  console.log(`[Config] API Key present: ${!!settings.apiKey}`);
  console.log(`[Config] AI Auto-Reply: ${settings.aiAutoReply}`);

  // Test customer message
  const customerName = 'Maria Santos';
  const customerPhoto = 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150';
  const customerQuestion = 'Hi! What are your best seller items right now and do you have free shipping?';
  const simPsid = `sim_${Date.now()}`;

  console.log(`\n[Customer] ${customerName} (PSID: ${simPsid})`);
  console.log(`[Question] "${customerQuestion}"`);

  // 1. Insert conversation into MySQL
  const convRes = await execute(`
    INSERT INTO conversations (psid, customer_name, customer_profile_pic, last_message, unread)
    VALUES (?, ?, ?, ?, 1)
  `, [simPsid, customerName, customerPhoto, customerQuestion]);
  const convId = convRes.insertId;
  console.log(`[MySQL] Conversation created with ID: ${convId}`);

  // 2. Insert customer message
  await execute(`
    INSERT INTO messages (conversation_id, sender_type, text)
    VALUES (?, 'customer', ?)
  `, [convId, customerQuestion]);
  console.log(`[MySQL] Customer message stored in messages table`);

  // 3. Generate Gemini AI Auto-Reply
  console.log('\n[Gemini] Contacting Google Gemini AI for auto-response...');
  const start = Date.now();
  const botReply = await generateGeminiChatReply(customerQuestion, [
    { sender_type: 'customer', text: customerQuestion }
  ]);
  const latency = ((Date.now() - start) / 1000).toFixed(2);
  console.log(`[Gemini] Response received in ${latency}s!`);

  // 4. Insert bot message into MySQL
  await execute(`
    INSERT INTO messages (conversation_id, sender_type, text)
    VALUES (?, 'bot', ?)
  `, [convId, botReply]);
  await execute(`
    UPDATE conversations SET last_message = ?, last_message_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [botReply, convId]);
  console.log(`[MySQL] Gemini bot reply stored in messages table`);

  // 5. Fetch and print conversation history from database
  console.log('\n==============================================');
  console.log('       Verified Conversation History in DB      ');
  console.log('==============================================');
  const storedMessages = await queryAll('SELECT sender_type, text, created_at FROM messages WHERE conversation_id = ? ORDER BY id ASC', [convId]);
  for (const msg of storedMessages) {
    const role = msg.sender_type === 'customer' ? `👤 ${customerName}` : '🤖 Gemini AI';
    console.log(`\n${role}:`);
    console.log(msg.text);
  }
  console.log('\n==============================================');
  console.log('🎉 Simulation Completed Successfully!');
  console.log('You can now see this conversation live at http://localhost:3000/chats');
  console.log('==============================================');
}

runSimulation().then(() => process.exit(0)).catch((err) => {
  console.error('Simulation Failed:', err);
  process.exit(1);
});

