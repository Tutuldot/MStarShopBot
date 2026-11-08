import { queryAll, formatProductPrice } from './db';

export async function getMetaSettings() {
  const rows = await queryAll<{ key: string; value: string }>("SELECT `key`, `value` FROM settings WHERE `key` LIKE 'fb_%' OR `key` LIKE 'webhook_%'");
  const map: Record<string, string> = {};
  for (const r of rows) {
    map[r.key] = r.value || '';
  }
  return {
    pageAccessToken: map.fb_page_access_token || process.env.FB_PAGE_ACCESS_TOKEN || '',
    verifyToken: map.fb_verify_token || process.env.FB_VERIFY_TOKEN || 'mstar_bot_token_secret',
    pageId: map.fb_page_id || process.env.FB_PAGE_ID || '',
    appSecret: map.fb_app_secret || process.env.FB_APP_SECRET || '',
    callbackUrl: map.webhook_callback_url || '',
  };
}

export async function sendMetaTextMessage(psid: string, text: string): Promise<{ success: boolean; error?: string }> {
  const { pageAccessToken } = await getMetaSettings();
  if (!pageAccessToken) {
    return { success: false, error: 'Facebook Page Access Token is not configured in Settings.' };
  }

  try {
    const response = await fetch(`https://graph.facebook.com/v21.0/me/messages?access_token=${encodeURIComponent(pageAccessToken)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: { id: psid },
        messaging_type: 'RESPONSE',
        message: { text },
      }),
    });

    const data = await response.json();
    if (!response.ok || data.error) {
      console.error('Meta API Error:', data.error);
      return { success: false, error: data.error?.message || 'Meta API request failed' };
    }

    return { success: true };
  } catch (err: any) {
    console.error('Failed to send Meta message:', err);
    return { success: false, error: err.message || 'Network error' };
  }
}

export async function sendMetaProductCard(psid: string, product: {
  name: string;
  price: number;
  price_max?: number | null;
  currency?: string;
  description?: string;
  image_url?: string;
  product_url: string;
}): Promise<{ success: boolean; error?: string }> {
  const { pageAccessToken } = await getMetaSettings();
  if (!pageAccessToken) {
    return { success: false, error: 'Facebook Page Access Token is not configured in Settings.' };
  }

  const formattedPrice = formatProductPrice(product.price, product.price_max, product.currency);

  const buttons: any[] = [
    {
      type: 'web_url',
      url: product.product_url,
      title: 'Buy on Store 🛒',
    },
  ];

  const element: any = {
    title: `${product.name} (${formattedPrice})`,
    subtitle: product.description || 'Check out this product on our store!',
    default_action: {
      type: 'web_url',
      url: product.product_url,
      webview_height_ratio: 'tall',
    },
    buttons,
  };

  if (product.image_url) {
    element.image_url = product.image_url;
  }

  try {
    const response = await fetch(`https://graph.facebook.com/v21.0/me/messages?access_token=${encodeURIComponent(pageAccessToken)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: { id: psid },
        messaging_type: 'RESPONSE',
        message: {
          attachment: {
            type: 'template',
            payload: {
              template_type: 'generic',
              elements: [element],
            },
          },
        },
      }),
    });

    const data = await response.json();
    if (!response.ok || data.error) {
      // Fallback: send text with URL if generic template fails
      return sendMetaTextMessage(psid, `Check out ${product.name} (${formattedPrice}):\n${product.product_url}`);
    }

    return { success: true };
  } catch (err: any) {
    console.error('Failed to send Meta product card:', err);
    return { success: false, error: err.message };
  }
}

export async function fetchMetaUserProfile(psid: string): Promise<{ name: string; profile_pic?: string } | null> {
  const { pageAccessToken } = await getMetaSettings();
  if (!pageAccessToken) {
    console.warn('[Meta Profile] Cannot fetch profile: Facebook Page Access Token is not set in Settings.');
    return null;
  }

  // Skip simulation PSIDs
  if (psid.startsWith('sim_') || psid.startsWith('customer_test_')) {
    return null;
  }

  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${encodeURIComponent(psid)}?fields=name,first_name,last_name,profile_pic&access_token=${encodeURIComponent(pageAccessToken)}`
    );
    const data = await res.json();
    if (res.ok && !data.error) {
      const fullName = data.name || [data.first_name, data.last_name].filter(Boolean).join(' ') || 'Facebook User';
      return { name: fullName, profile_pic: data.profile_pic || undefined };
    } else {
      console.warn('[Meta Profile] Graph API returned error for PSID', psid, data.error);
    }
  } catch (err) {
    console.error('[Meta Profile] Error fetching user profile:', err);
  }
  return null;
}
