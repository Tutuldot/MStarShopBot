# Meta Messenger Webhook Events Reference

This document outlines the standard JSON payload structures received by the webhook (`POST /api/webhook`).

---

## 1. Top-Level Webhook Envelope

```json
{
  "object": "page",
  "entry": [
    {
      "id": "<PAGE_ID>",
      "time": 1731000000000,
      "messaging": [
        {
          "sender": { "id": "<USER_PSID>" },
          "recipient": { "id": "<PAGE_ID>" },
          "timestamp": 1731000000000
        }
      ]
    }
  ]
}
```

---

## 2. Text Message Event

```json
{
  "sender": { "id": "1234567890" },
  "recipient": { "id": "9876543210" },
  "timestamp": 1731000000000,
  "message": {
    "mid": "m_123456789abcde...",
    "text": "Hello, do you have this in size Large?"
  }
}
```

---

## 3. Quick Reply Selection

When a user taps a Quick Reply pill:
```json
{
  "sender": { "id": "1234567890" },
  "recipient": { "id": "9876543210" },
  "timestamp": 1731000000000,
  "message": {
    "mid": "m_abcdef...",
    "text": "Browse Deals 🔥",
    "quick_reply": {
      "payload": "CATEGORY_DEALS"
    }
  }
}
```

---

## 4. Postback Event (Button Tap)

Triggered when a user clicks a `postback` button on a Generic Template or Persistent Menu:
```json
{
  "sender": { "id": "1234567890" },
  "recipient": { "id": "9876543210" },
  "timestamp": 1731000000000,
  "postback": {
    "title": "Ask Question 💬",
    "payload": "INQUIRE_PROD_123",
    "mid": "m_postback_..."
  }
}
```

---

## 5. Echo Message (Outbound Messages)

Dispatched when your Page sends a message. **You must ignore these in inbound loops**:
```json
{
  "sender": { "id": "9876543210" },
  "recipient": { "id": "1234567890" },
  "timestamp": 1731000000000,
  "message": {
    "is_echo": true,
    "app_id": 123456789,
    "mid": "m_echo_...",
    "text": "Response from bot or human"
  }
}
```

