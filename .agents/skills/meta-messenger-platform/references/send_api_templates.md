# Meta Send API Templates Reference

This reference covers the structured templates available in Meta Graph API `/me/messages`.

---

## 1. Button Template
Use when presenting text accompanied by up to 3 action buttons:

```json
{
  "recipient": { "id": "<PSID>" },
  "messaging_type": "RESPONSE",
  "message": {
    "attachment": {
      "type": "template",
      "payload": {
        "template_type": "button",
        "text": "Need help with your order?",
        "buttons": [
          {
            "type": "web_url",
            "url": "https://example.com/track",
            "title": "Track Order"
          },
          {
            "type": "postback",
            "title": "Speak to Support",
            "payload": "SUPPORT_REQUEST"
          }
        ]
      }
    }
  }
}
```

---

## 2. Generic Template (Carousel)
Multi-item horizontal card slider (supports 1 to 10 cards):

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
            "title": "Classic Leather Bag",
            "image_url": "https://example.com/bag.jpg",
            "subtitle": "₱2,499.00 - Genuine leather",
            "buttons": [
              {
                "type": "web_url",
                "url": "https://example.com/bag",
                "title": "View Item"
              }
            ]
          },
          {
            "title": "Urban Backpack",
            "image_url": "https://example.com/backpack.jpg",
            "subtitle": "₱1,899.00 - Water resistant",
            "buttons": [
              {
                "type": "web_url",
                "url": "https://example.com/backpack",
                "title": "View Item"
              }
            ]
          }
        ]
      }
    }
  }
}
```

---

## 3. Message Tags Specification

To send messages outside the 24-hour standard window, pass `messaging_type: "MESSAGE_TAG"` and one of the following tags:

| Tag | Permitted Purpose | Restrictions |
| :--- | :--- | :--- |
| `HUMAN_AGENT` | Allows manual responses from a human agent to a customer inquiry up to **7 days** after the user's message. | Must be human-typed; cannot contain promotions, discounts, or upselling. |
| `CONFIRMED_EVENT_UPDATE` | Reminders or updates for events user registered for. | No promotional offers. |
| `POST_PURCHASE_UPDATE` | Invoices, receipts, shipping confirmations, delivery status updates. | Cannot cross-sell or recommend other products. |
| `ACCOUNT_UPDATE` | Security alerts, fraud alerts, or changes to account settings. | Non-promotional only. |

