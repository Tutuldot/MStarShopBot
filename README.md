# MStarShopBot 🤖🛍️

**MStarShopBot** is a Next.js fullstack e-commerce chatbot console designed for Facebook Messenger Pages and powered by Google Gemini AI. It bridges your existing PHP store with intelligent conversational commerce.

---

## 🌟 Core Features

1. **Authentication & User Maintenance (`/login`, `/users`)**
   - Secure session authentication with encrypted cookie tokens.
   - User maintenance table: create, edit roles (Admin / Staff), reset passwords, delete users.
   - Default Administrator: `admin@mstar.com` / `admin123`.

2. **Product Basket Sets (`/baskets`)**
   - Create multiple themed sets (e.g., "Holiday Mega Deals", "Summer Best Sellers").
   - **Single Active Constraint**: Exactly **one (1)** basket set can be active at any given time. Activating a set automatically deactivates all others.
   - Each product includes **Name**, **Price**, **Currency**, **Description**, **Image**, and a mandatory **Product URL** linking directly to your main PHP website/store.
   - Full CRUD: add, edit, preview links, delete products and basket sets.

3. **Live Chat Monitor & Interaction (`/chats`)**
   - Real-time customer chat stream with auto-refresh polling.
   - **AI Auto-Pilot Toggle**: Easily pause AI for a conversation to let a human agent take over without bot collisions.
   - **Send Active Product Card**: 1-click drawer to send a Facebook Generic Template card with image and direct link to your PHP store.
   - **Inbound Message Simulator**: Test the entire conversational loop and Gemini AI responses instantly without waiting for a live Facebook message.

4. **Integration Layer (`/settings`)**
   - **Meta Messenger Webhook (`/api/webhook`)**:
     - `GET`: challenge verification (`hub.mode`, `hub.verify_token`, `hub.challenge`).
     - `POST`: incoming message ingestion, user auto-profiling, and auto-reply dispatch.
   - **Google Gemini AI (`lib/gemini.ts`)**:
     - Automatically injects the **Active Product Basket** and product URLs into the system prompt.
     - Formulates natural, friendly recommendations directing customers to your PHP site.
   - **In-App Settings UI**:
     - Manage Meta Page Access Token, Verify Token, Page ID, and Gemini API Key directly from the browser.

---

## 🚀 Quick Start

```bash
cd /Users/anthonyestrada/.gemini/antigravity/scratch/MStarShopBot

# Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

- **Default Admin Email:** `admin@mstar.com`
- **Default Password:** `admin123`

---

## 📁 Directory Structure

```
MStarShopBot/
├── app/
│   ├── api/
│   │   ├── auth/           # Login, logout, session verification
│   │   ├── baskets/        # Sets, activate, products CRUD
│   │   ├── chats/          # Conversations, messages, AI toggle, simulate
│   │   ├── settings/       # Meta and Gemini configuration
│   │   ├── users/          # User maintenance
│   │   └── webhook/        # Meta Messenger GET & POST Webhook
│   ├── baskets/page.tsx    # Product Baskets & Sets UI
│   ├── chats/page.tsx      # Live Chat Monitor & Agent Console
│   ├── dashboard/page.tsx  # KPI Metrics, Active Basket, Quick Links
│   ├── login/page.tsx      # Login form with one-click demo credentials
│   ├── settings/page.tsx   # Meta & Gemini configuration UI
│   ├── users/page.tsx      # Admin User Maintenance UI
│   ├── globals.css
│   └── layout.tsx
├── components/
│   └── Navbar.tsx          # Sticky navigation with live unread chat badge
├── lib/
│   ├── auth.ts             # Password hashing (crypto.scrypt) & signed cookies
│   ├── db.ts               # Embedded SQLite database (node:sqlite)
│   ├── gemini.ts           # Google Gemini API client with basket injection
│   └── meta.ts             # Meta Graph API sender (Text & Generic Template Cards)
└── data/
    └── mstarshopbot.db     # SQLite database (auto-created & seeded)
```
