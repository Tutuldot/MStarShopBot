import { queryAll, getActiveBasketProducts, formatProductPrice } from './db';

export async function getGeminiSettings() {
  const rows = await queryAll<{ key: string; value: string }>(
    "SELECT `key`, `value` FROM settings WHERE `key` IN ('gemini_api_key', 'gemini_model', 'system_prompt', 'ai_auto_reply', 'dev_whitelist_enabled', 'dev_whitelist_names')"
  );
  const map: Record<string, string> = {};
  for (const r of rows) {
    map[r.key] = r.value || '';
  }

  return {
    apiKey: map.gemini_api_key || process.env.GEMINI_API_KEY || '',
    model: map.gemini_model || process.env.GEMINI_MODEL || 'gemini-3.5-flash',
    systemPrompt: map.system_prompt || 'You are MStar Assistant, a helpful sales representative for our store.',
    aiAutoReply: (map.ai_auto_reply ?? '1') === '1',
    devWhitelistEnabled: (map.dev_whitelist_enabled ?? '1') === '1',
    devWhitelistNames: map.dev_whitelist_names ?? 'Anthony Mashta',
  };
}

/**
 * Checks whether an incoming customer is permitted to receive automated AI replies
 * when Development Whitelist Mode is enabled. Matches exact PSID or case-insensitive name.
 */
export function isWhitelistedTester(
  customerName: string,
  senderPsid: string,
  whitelistEnabled: boolean,
  whitelistNames: string
): boolean {
  if (!whitelistEnabled) return true;

  const allowedList = (whitelistNames || '')
    .split(/[,\n;]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  if (allowedList.length === 0) return false;

  const name = (customerName || '').toLowerCase().trim();
  const psid = (senderPsid || '').toLowerCase().trim();

  return allowedList.some((allowed) => {
    if (psid && psid === allowed) return true;
    if (name && (name === allowed || name.includes(allowed))) return true;
    return false;
  });
}

export async function generateGeminiChatReply(
  userMessage: string,
  history: { sender_type: string; text: string }[] = []
): Promise<string> {
  const { apiKey, model, systemPrompt } = await getGeminiSettings();

  if (!apiKey) {
    return "Thank you for messaging us! Our automated assistant is currently getting set up. A human agent will get back to you shortly.";
  }

  // Get active product basket to inject into prompt
  const { activeSet, products } = await getActiveBasketProducts();

  let productsContext = "No active product catalog set at this moment.";
  if (activeSet && products.length > 0) {
    const basketLabel = (activeSet as any).basket_number
      ? `ACTIVE PROMOTIONAL BASKET #${(activeSet as any).basket_number}: "${(activeSet as any).name}"`
      : `ACTIVE PROMOTIONAL BASKET SET: "${(activeSet as any).name}"`;
    productsContext = `${basketLabel}\nProducts currently available to recommend:\n` +
      products.map((p: any, i: number) => {
        const formattedPrice = formatProductPrice(p.price, p.price_max, p.currency);
        const paymentLink = p.checkout_url || p.product_url;
        const itemNumLabel = p.product_number != null ? `Item #${p.product_number}` : `Item #${i + 1}`;
        return `${itemNumLabel}: ${p.name} - Price: ${formattedPrice}\n   Description: ${p.description || 'N/A'}\n   Direct Checkout / Payment Link: ${paymentLink}`;
      }).join('\n\n');
  }

  const enhancedSystemInstruction = `${systemPrompt}

You represent MStarShop. When customers ask about products, deals, recommendations, or pricing:
1. Always promote relevant items from the ACTIVE PROMOTIONAL BASKET below. If a customer refers to an item number or product number (e.g., "Item 1", "Product #2"), match and refer to that numbered item.
2. If a product has a price range (e.g. ₱41,715 – ₱42,468), mention that the price varies depending on size, weight, or selected options.
3. When the customer indicates they want to order, buy, or pay, provide the DIRECT CHECKOUT / PAYMENT LINK so they can immediately proceed to payment on WooCommerce without browsing.
4. Keep answers friendly, conversational, concise, and easy to read on mobile Messenger.
5. Do not invent products or links outside of this catalog.

${productsContext}`;

  // Format message history for Gemini multi-turn format
  const contents: any[] = [];

  // Recent 6 turns
  const recentHistory = history.slice(-6);
  for (const h of recentHistory) {
    contents.push({
      role: h.sender_type === 'customer' ? 'user' : 'model',
      parts: [{ text: h.text }],
    });
  }

  // Add the latest user message
  contents.push({
    role: 'user',
    parts: [{ text: userMessage }],
  });

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          systemInstruction: {
            parts: [{ text: enhancedSystemInstruction }],
          },
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2048,
            thinkingConfig: {
              thinkingBudget: 0,
            },
          },
        }),
      }
    );

    const data = await response.json();
    if (!response.ok || data.error) {
      console.error('Gemini API Error:', data.error);
      return "Thank you for reaching out! We are currently checking your request and will reply shortly.";
    }

    const parts = data.candidates?.[0]?.content?.parts || [];
    const textPart = parts.find((p: any) => p.text && !p.thought) || parts[0];
    if (textPart?.text) {
      return textPart.text.trim();
    }

    return "Thank you for your message! How can we assist you with our store today?";
  } catch (err) {
    console.error('Gemini request failed:', err);
    return "Thank you for your message! Our team will get back to you soon.";
  }
}
