import mysql from 'mysql2/promise';
import type { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import crypto from 'crypto';

// Global pool singleton for Next.js dev server hot reload
declare global {
  var __mysql_pool: Pool | undefined;
  var __db_initialized: boolean | undefined;
}

export function getPool(): Pool {
  if (!global.__mysql_pool) {
    global.__mysql_pool = mysql.createPool({
      host: process.env.MYSQL_HOST || '72.60.86.124',
      port: Number(process.env.MYSQL_PORT) || 3306,
      user: process.env.MYSQL_USER || 'u817456591_mstarbot',
      password: process.env.MYSQL_PASSWORD || 'ZeUQCm&9',
      database: process.env.MYSQL_DATABASE || 'u817456591_mstarbot',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000,
    });
  }
  return global.__mysql_pool;
}

export const getDb = getPool;

// Convenient query helper functions
export async function query<T = any>(sql: string, params: any[] = []): Promise<[T, any]> {
  const pool = getPool();
  return (await pool.query(sql, params)) as [T, any];
}

export async function queryOne<T = any>(sql: string, params: any[] = []): Promise<T | null> {
  const pool = getPool();
  const [rows] = (await pool.query(sql, params)) as [RowDataPacket[], any];
  return (rows[0] as T) || null;
}

export async function queryAll<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const pool = getPool();
  const [rows] = (await pool.query(sql, params)) as [RowDataPacket[], any];
  return rows as T[];
}

export async function execute(sql: string, params: any[] = []): Promise<ResultSetHeader> {
  const pool = getPool();
  const [result] = (await pool.query(sql, params)) as [ResultSetHeader, any];
  return result;
}

// Ensure database schema and seed default records
export async function ensureDbInitialized() {
  if (global.__db_initialized) return;

  const pool = getPool();

  // Create tables if not exists
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      salt VARCHAR(255) NOT NULL,
      role VARCHAR(50) NOT NULL DEFAULT 'admin',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS basket_sets (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      is_active TINYINT DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS products (
      id INT AUTO_INCREMENT PRIMARY KEY,
      basket_set_id INT NOT NULL,
      name VARCHAR(255) NOT NULL,
      price DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
      price_max DECIMAL(12, 2) DEFAULT NULL,
      currency VARCHAR(10) DEFAULT '$',
      description TEXT,
      image_url TEXT,
      product_url TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (basket_set_id) REFERENCES basket_sets(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS conversations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      psid VARCHAR(128) NOT NULL UNIQUE,
      customer_name VARCHAR(255) DEFAULT 'Facebook User',
      customer_profile_pic TEXT,
      ai_enabled TINYINT DEFAULT 1,
      last_message TEXT,
      last_message_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      unread INT DEFAULT 0
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id INT AUTO_INCREMENT PRIMARY KEY,
      conversation_id INT NOT NULL,
      sender_type VARCHAR(50) NOT NULL,
      text TEXT NOT NULL,
      product_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS settings (
      \`key\` VARCHAR(128) PRIMARY KEY,
      \`value\` TEXT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS webhook_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      method VARCHAR(20) NOT NULL,
      source VARCHAR(50) DEFAULT 'facebook',
      headers TEXT,
      query_params TEXT,
      raw_payload MEDIUMTEXT,
      status VARCHAR(50) DEFAULT 'RECEIVED',
      error_message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_webhook_logs_created_at (created_at DESC)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // Seed default admin user if none exists
  const [userRows]: any = await pool.query('SELECT COUNT(*) as count FROM users');
  if (userRows[0]?.count === 0) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync('admin123', salt, 64).toString('hex');
    await pool.query(
      'INSERT INTO users (name, email, password_hash, salt, role) VALUES (?, ?, ?, ?, ?)',
      ['Administrator', 'admin@mstar.com', hash, salt, 'admin']
    );
  }

  // Seed default settings if empty
  const defaultSettings: Record<string, string> = {
    fb_page_access_token: '',
    fb_verify_token: 'mstar_bot_token_secret',
    fb_page_id: '104217771726746',
    fb_app_secret: '',
    gemini_api_key: '',
    gemini_model: 'gemini-2.5-flash',
    system_prompt: 'You are MStar Assistant, a helpful, polite, and enthusiastic sales assistant for our online store. Help customers find products, answer their questions, and share the exact product URLs so they can view and checkout on our website. Always be professional, concise, and friendly.',
    ai_auto_reply: '1',
    store_url: 'https://www.missmorningstar.com',
  };

  for (const [k, v] of Object.entries(defaultSettings)) {
    await pool.query(
      'INSERT IGNORE INTO settings (`key`, `value`) VALUES (?, ?)',
      [k, v]
    );
  }

  // Seed a sample basket set if empty
  const [basketRows]: any = await pool.query('SELECT COUNT(*) as count FROM basket_sets');
  if (basketRows[0]?.count === 0) {
    const [bResult]: any = await pool.query(
      'INSERT INTO basket_sets (name, description, is_active) VALUES (?, ?, 1)',
      ['Hot Deals & Best Sellers', 'Featured active promotional collection for Messenger customers']
    );
    const setId = bResult.insertId;

    await pool.query(
      `INSERT INTO products (basket_set_id, name, price, currency, description, image_url, product_url) VALUES 
       (?, 'Premium Cotton Crewneck T-Shirt', 24.99, '$', '100% organic breathable cotton, available in black, navy, and white.', 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=500&auto=format&fit=crop', 'https://mstarshop.example.com/products/premium-cotton-tee.php'),
       (?, 'Wireless Noise Cancelling Earbuds', 59.99, '$', 'Crystal clear audio with 28-hour battery life and fast USB-C charging.', 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=500&auto=format&fit=crop', 'https://mstarshop.example.com/products/wireless-earbuds.php'),
       (?, 'Minimalist Leather Cardholder Wallet', 19.50, '$', 'Slim RFID-blocking genuine leather wallet with 6 card slots.', 'https://images.unsplash.com/photo-1627123424574-724758594e93?w=500&auto=format&fit=crop', 'https://mstarshop.example.com/products/leather-wallet.php')
      `,
      [setId, setId, setId]
    );
  }

  global.__db_initialized = true;
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

export async function getActiveBasketProducts(): Promise<{ activeSet: any | null; products: any[] }> {
  await ensureDbInitialized();
  const pool = getPool();
  const [setRows]: any = await pool.query('SELECT * FROM basket_sets WHERE is_active = 1 LIMIT 1');
  const activeSet = setRows[0] || null;
  if (!activeSet) {
    return { activeSet: null, products: [] };
  }
  const [products]: any = await pool.query('SELECT * FROM products WHERE basket_set_id = ? ORDER BY id ASC', [activeSet.id]);
  return { activeSet, products };
}

export async function activateBasketSet(setId: number): Promise<void> {
  await ensureDbInitialized();
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('UPDATE basket_sets SET is_active = 0');
    await conn.query('UPDATE basket_sets SET is_active = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [setId]);
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function logRawWebhook(data: {
  method: string;
  source?: string;
  headers?: Record<string, string> | string;
  queryParams?: Record<string, string> | string;
  rawPayload?: string;
  status?: string;
  errorMessage?: string;
}): Promise<number> {
  try {
    await ensureDbInitialized();
    const pool = getPool();
    const headersStr = typeof data.headers === 'object' ? JSON.stringify(data.headers) : (data.headers || null);
    const queryStr = typeof data.queryParams === 'object' ? JSON.stringify(data.queryParams) : (data.queryParams || null);

    const [result]: any = await pool.query(
      `INSERT INTO webhook_logs (method, source, headers, query_params, raw_payload, status, error_message)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        data.method,
        data.source || 'facebook',
        headersStr,
        queryStr,
        data.rawPayload || null,
        data.status || 'RECEIVED',
        data.errorMessage || null,
      ]
    );

    return Number(result.insertId);
  } catch (err) {
    console.error('[MySQL] Failed to log raw webhook:', err);
    return -1;
  }
}

export async function updateWebhookLogStatus(id: number, status: string, errorMessage?: string): Promise<void> {
  if (id <= 0) return;
  try {
    const pool = getPool();
    await pool.query(
      `UPDATE webhook_logs
       SET status = ?, error_message = COALESCE(?, error_message)
       WHERE id = ?`,
      [status, errorMessage || null, id]
    );
  } catch (err) {
    console.error('[MySQL] Failed to update webhook log status:', err);
  }
}

export async function getWebhookLogs(limit = 50, offset = 0): Promise<{ logs: any[]; total: number }> {
  await ensureDbInitialized();
  const pool = getPool();
  const [logs]: any = await pool.query(
    'SELECT * FROM webhook_logs ORDER BY id DESC LIMIT ? OFFSET ?',
    [Number(limit), Number(offset)]
  );

  const [countRows]: any = await pool.query('SELECT COUNT(*) as count FROM webhook_logs');
  return { logs, total: Number(countRows[0]?.count || 0) };
}

export async function clearWebhookLogs(): Promise<void> {
  await ensureDbInitialized();
  const pool = getPool();
  await pool.query('DELETE FROM webhook_logs');
}
