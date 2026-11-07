---
name: meta-messenger-platform
description: >-
  Build, configure, debug, and maintain Meta (Facebook) Messenger Platform integrations,
  including webhook verification, event ingestion, Send API message types (text, generic templates,
  quick replies), 24-hour messaging window compliance, message tags, and security validation.
---

# Meta Messenger Platform Skill

This skill provides step-by-step procedures, payload specifications, and troubleshooting runbooks for implementing and operating business chat integrations on the **Meta Messenger Platform** (Graph API v21.0+).

---

## 1. Architecture & Core Concepts

```
┌─────────────────┐       Inbound Webhook (POST)       ┌────────────────────────┐
│  Facebook User  │ ─────────────────────────────────> │  Your App (/webhook)   │
│ (via Messenger) │ <───────────────────────────────── │ (Node/Next.js/Python)  │
└─────────────────┘      Send API (POST /me/messages)  └────────────────────────┘
```

* **PSID (Page-Scoped ID):** Every user is identified by a unique ID scoped exclusively to your Facebook Page. PSIDs cannot be shared across different Facebook Pages.
* **Page Access Token (PAT):** Bearer token required for all Graph API calls to `/me/messages` and `/<PSID>`.
* **24-Hour Messaging Window:** When a customer sends a message to your Page, a 24-hour window opens. You can send free-form promotional and automated replies inside this window.
* **Message Tags (`tag`):** To message a user *outside* the 24-hour window, you must supply an approved tag (`CONFIRMED_EVENT_UPDATE`, `POST_PURCHASE_UPDATE`, `ACCOUNT_UPDATE`, or `HUMAN_AGENT`). Promotional content is strictly prohibited in tagged messages.
* **HUMAN_AGENT Tag:** Extends the response window up to **7 days** when a live human representative is responding to a customer inquiry.

---

## 2. Webhook Implementation Procedure

### Step 1: Webhook Challenge Verification (HTTP GET)
Meta sends a GET request when you configure the webhook in the Meta App Dashboard:

* **Endpoint:** `GET /api/webhook`
* **Query Parameters:**
  * `hub.mode`: Expected to be `'subscribe'`
  * `hub.verify_token`: Custom secret token matching your app's configuration
  * `hub.challenge`: Plain text random challenge string
* **Response:** Return `hub.challenge` as plain text with HTTP status `200`.

### Step 2: Inbound Event Ingestion (HTTP POST)
* **Response Speed:** Always return HTTP `200 OK` immediately (within 3 seconds) to prevent Meta from retrying or disabling the webhook.
* **Ignore Echos:** Ignore events where `entry[].messaging[].message.is_echo === true` to avoid processing messages sent by your own page or bot.
* **Signature Verification:** Verify the `X-Hub-Signature-256` header on incoming POST requests using your `FB_APP_SECRET`.

---

## 3. Send API Procedures & Payloads

Base URL:
`POST https://graph.facebook.com/v21.0/me/messages?access_token=<PAGE_ACCESS_TOKEN>`

### 3.1 Send Text Message
```json
{
  "recipient": { "id": "<PSID>" },
  "messaging_type": "RESPONSE",
  "message": {
    "text": "Hello! How can I assist you today?"
  }
}
```

### 3.2 Send Generic Template (Product Card / Carousel)
Supports up to 10 horizontal cards:
```json
{
  "recipient": { "id": "<PSID>" },
  "messaging_type": "RESPONSE",
  "message": {
    "attachment": {
      "type": "template",
      "payload": {
        "template_type": "generic",
        "elements": [
          {
            "title": "Product Name (₱1,500.00)",
            "image_url": "https://example.com/product.jpg",
            "subtitle": "Short product description or features",
            "default_action": {
              "type": "web_url",
              "url": "https://example.com/products/123",
              "webview_height_ratio": "tall"
            },
            "buttons": [
              {
                "type": "web_url",
                "url": "https://example.com/products/123",
                "title": "View Product 🛒"
              },
              {
                "type": "postback",
                "title": "Ask Question 💬",
                "payload": "INQUIRE_PROD_123"
              }
            ]
          }
        ]
      }
    }
  }
}
```

### 3.3 Send Quick Replies
Prompt the customer with selectable pill buttons:
```json
{
  "recipient": { "id": "<PSID>" },
  "messaging_type": "RESPONSE",
  "message": {
    "text": "What are you looking for today?",
    "quick_replies": [
      {
        "content_type": "text",
        "title": "Browse Deals 🔥",
        "payload": "CATEGORY_DEALS"
      },
      {
        "content_type": "text",
        "title": "Talk to Human 👤",
        "payload": "TALK_TO_HUMAN"
      }
    ]
  }
}
```

### 3.4 Send with Message Tag (Outside 24h Window)
```json
{
  "recipient": { "id": "<PSID>" },
  "messaging_type": "MESSAGE_TAG",
  "tag": "HUMAN_AGENT",
  "message": {
    "text": "Hello! I am a human agent following up on your question from yesterday."
  }
}
```

---

## 4. User Profile Retrieval

To fetch the user's name and avatar using their PSID:
```http
GET https://graph.facebook.com/v21.0/<PSID>?fields=first_name,last_name,profile_pic&access_token=<PAGE_ACCESS_TOKEN>
```
*Note: In production, requires `pages_messaging` App Review permission.*

---

## 5. Security Checklist & Signature Verification

Compute the HMAC-SHA256 signature of the raw request payload:
```typescript
import crypto from 'crypto';

export function verifyMetaSignature(rawBody: string, appSecret: string, signatureHeader: string | null): boolean {
  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) {
    return false;
  }
  const signature = signatureHeader.replace('sha256=', '');
  const expectedSignature = crypto
    .createHmac('sha256', appSecret)
    .update(rawBody, 'utf8')
    .digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expectedSignature, 'hex'));
}
```

---

## 6. Troubleshooting Common Meta Errors

| Error Code | Error Message / Subcode | Cause & Resolution |
| :--- | :--- | :--- |
| **190** | `Invalid OAuth access token` | The Page Access Token expired, page password changed, or permissions were revoked. Generate a new long-lived token. |
| **10** | `(#10) This message is sent outside of allowed window` | The 24-hour standard window expired. Use an approved `tag` (e.g. `HUMAN_AGENT` or `CONFIRMED_EVENT_UPDATE`) with `messaging_type: "MESSAGE_TAG"`. |
| **200** | `(#200) Requires pages_messaging permission` | App is in Development mode and recipient is not an App Tester, or the app has not passed Meta App Review. |
| **100** | `Param recipient[id] must be a valid ID` | Invalid or malformed PSID, or PSID was generated from a different Facebook Page. |

---

## References

* [Webhook Events & Payloads Reference](./references/webhook_events.md)
* [Send API Templates & Payloads Reference](./references/send_api_templates.md)
* [Production Verification Handler Example](./examples/webhook_handler.ts)

