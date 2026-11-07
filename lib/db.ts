import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

const DATA_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'mstarshopbot.db');

// Global singleton to avoid multiple instances across hot reloads in Next.js dev mode
declare global {
  var __mstar_db: DatabaseSync | undefined;
}

export function getDb(): DatabaseSync {
  if (!global.__mstar_db) {
    const db = new DatabaseSync(DB_PATH);
    
    // Enable foreign keys and WAL mode for reliability
    db.exec('PRAGMA foreign_keys = ON;');
    db.exec('PRAGMA journal_mode = WAL;');

    // Initialize tables
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        salt TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'admin',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS basket_sets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        is_active INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        basket_set_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        price REAL NOT NULL DEFAULT 0.0,
        price_max REAL DEFAULT NULL,
        currency TEXT DEFAULT '$',
        description TEXT,
        image_url TEXT,
        product_url TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (basket_set_id) REFERENCES basket_sets(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS conversations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        psid TEXT UNIQUE NOT NULL,
        customer_name TEXT DEFAULT 'Facebook User',
        customer_profile_pic TEXT,
        ai_enabled INTEGER DEFAULT 1,
        last_message TEXT,
        last_message_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        unread INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id INTEGER NOT NULL,
        sender_type TEXT NOT NULL, -- 'customer' | 'bot' | 'agent'
        text TEXT NOT NULL,
        product_url TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
      );

      CREATE TABLE IF NOT EXISTS webhook_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        method TEXT NOT NULL,
        source TEXT DEFAULT 'facebook',
        headers TEXT,
        query_params TEXT,
        raw_payload TEXT,
        status TEXT DEFAULT 'RECEIVED',
        error_message TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_webhook_logs_created_at ON webhook_logs(created_at DESC);
    `);

    // Ensure price_max column exists in products table for existing databases
    try {
      db.exec('ALTER TABLE products ADD COLUMN price_max REAL DEFAULT NULL;');
    } catch {
      // Column already exists
    }

    // Seed default admin if none exists
    const userCountRow = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
    if (userCountRow.count === 0) {
      const salt = crypto.randomBytes(16).toString('hex');
      const hash = crypto.scryptSync('admin123', salt, 64).toString('hex');
      db.prepare(`
        INSERT INTO users (name, email, password_hash, salt, role)
        VALUES (?, ?, ?, ?, ?)
      `).run('Administrator', 'admin@mstar.com', hash, salt, 'admin');
    }

    // Seed default settings if empty
    const settingsMap: Record<string, string> = {
      fb_page_access_token: '',
      fb_verify_token: 'mstar_bot_token_secret',
      fb_page_id: '',
      fb_app_secret: '',
      gemini_api_key: '',
      gemini_model: 'gemini-2.5-flash',
      system_prompt: 'You are MStar Assistant, a helpful, polite, and enthusiastic sales assistant for our online store. Help customers find products, answer their questions, and share the exact product URLs so they can view and checkout on our website. Always be professional, concise, and friendly.',
      ai_auto_reply: '1',
      store_url: 'https://mstarshop.example.com',
    };

    const insertSetting = db.prepare(`
      INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)
    `);
    for (const [key, val] of Object.entries(settingsMap)) {
      insertSetting.run(key, val);
    }

    // Seed a sample basket set if empty
    const basketCount = db.prepare('SELECT COUNT(*) as count FROM basket_sets').get() as { count: number };
    if (basketCount.count === 0) {
      const resultSet = db.prepare(`
        INSERT INTO basket_sets (name, description, is_active)
        VALUES (?, ?, 1)
      `).run('Hot Deals & Best Sellers', 'Featured active promotional collection for Messenger customers');

      const setId = resultSet.lastInsertRowid;

      const insertProduct = db.prepare(`
        INSERT INTO products (basket_set_id, name, price, currency, description, image_url, product_url)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      insertProduct.run(
        setId,
        'Premium Cotton Crewneck T-Shirt',
        24.99,
        '$',
        '100% organic breathable cotton, available in black, navy, and white.',
        'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=500&auto=format&fit=crop',
        'https://mstarshop.example.com/products/premium-cotton-tee.php'
      );

      insertProduct.run(
        setId,
        'Wireless Noise Cancelling Earbuds',
        59.99,
        '$',
        'Crystal clear audio with 28-hour battery life and fast USB-C charging.',
        'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=500&auto=format&fit=crop',
        'https://mstarshop.example.com/products/wireless-earbuds.php'
      );

      insertProduct.run(
        setId,
        'Minimalist Leather Cardholder Wallet',
        19.50,
        '$',
        'Slim RFID-blocking genuine leather wallet with 6 card slots.',
        'https://images.unsplash.com/photo-1627123424574-724758594e93?w=500&auto=format&fit=crop',
        'https://mstarshop.example.com/products/leather-wallet.php'
      );
    }

    global.__mstar_db = db;
  }

  return global.__mstar_db;
}

export function formatProductPrice(price: number, priceMax?: number | null, currency = '$'): string {
  const pMin = Number(price) || 0;
  const pMax = priceMax != null ? Number(priceMax) : null;
  const curr = currency || '$';

  if (pMax && pMax > pMin) {
    return `${curr}${pMin.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} – ${curr}${pMax.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return `${curr}${pMin.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function getActiveBasketProducts() {
  const db = getDb();
  const activeSet = db.prepare('SELECT * FROM basket_sets WHERE is_active = 1 LIMIT 1').get() as { id: number; name: string } | undefined;
  if (!activeSet) {
    return { activeSet: null, products: [] };
  }
  const products = db.prepare('SELECT * FROM products WHERE basket_set_id = ? ORDER BY id ASC').all(activeSet.id);
  return { activeSet, products };
}

export function activateBasketSet(setId: number) {
  const db = getDb();
  // Constraint: Only 1 basket set can be activated at a time
  db.exec('BEGIN TRANSACTION;');
  try {
    db.prepare('UPDATE basket_sets SET is_active = 0').run();
    db.prepare('UPDATE basket_sets SET is_active = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(setId);
    db.exec('COMMIT;');
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }
}

export function logRawWebhook(data: {
  method: string;
  source?: string;
  headers?: Record<string, string> | string;
  queryParams?: Record<string, string> | string;
  rawPayload?: string;
  status?: string;
  errorMessage?: string;
}): number {
  try {
    const db = getDb();
    const headersStr = typeof data.headers === 'object' ? JSON.stringify(data.headers) : (data.headers || null);
    const queryStr = typeof data.queryParams === 'object' ? JSON.stringify(data.queryParams) : (data.queryParams || null);

    const stmt = db.prepare(`
      INSERT INTO webhook_logs (method, source, headers, query_params, raw_payload, status, error_message)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      data.method,
      data.source || 'facebook',
      headersStr,
      queryStr,
      data.rawPayload || null,
      data.status || 'RECEIVED',
      data.errorMessage || null
    );

    return Number(result.lastInsertRowid);
  } catch (err) {
    console.error('[DB] Failed to log raw webhook:', err);
    return -1;
  }
}

export function updateWebhookLogStatus(id: number, status: string, errorMessage?: string) {
  if (id <= 0) return;
  try {
    const db = getDb();
    db.prepare(`
      UPDATE webhook_logs
      SET status = ?, error_message = coalesce(?, error_message)
      WHERE id = ?
    `).run(status, errorMessage || null, id);
  } catch (err) {
    console.error('[DB] Failed to update webhook log status:', err);
  }
}

export function getWebhookLogs(limit = 50, offset = 0) {
  const db = getDb();
  const logs = db.prepare(`
    SELECT * FROM webhook_logs
    ORDER BY id DESC
    LIMIT ? OFFSET ?
  `).all(limit, offset);

  const total = db.prepare('SELECT COUNT(*) as count FROM webhook_logs').get() as { count: number };
  return { logs, total: total.count };
}

export function clearWebhookLogs() {
  const db = getDb();
  db.exec('DELETE FROM webhook_logs;');
}
