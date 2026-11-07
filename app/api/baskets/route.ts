import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSession } from '@/lib/auth';

// GET all basket sets
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getDb();
  const sets = db.prepare(`
    SELECT 
      bs.id,
      bs.name,
      bs.description,
      bs.is_active,
      bs.created_at,
      bs.updated_at,
      COUNT(p.id) AS product_count
    FROM basket_sets bs
    LEFT JOIN products p ON bs.id = p.basket_set_id
    GROUP BY bs.id
    ORDER BY bs.is_active DESC, bs.id DESC
  `).all();

  return NextResponse.json({ sets });
}

// POST create new basket set
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { name, description, activateImmediately } = await req.json();
    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Basket set name is required' }, { status: 400 });
    }

    const db = getDb();

    if (activateImmediately) {
      db.exec('BEGIN TRANSACTION;');
      db.prepare('UPDATE basket_sets SET is_active = 0').run();
      const res = db.prepare(`
        INSERT INTO basket_sets (name, description, is_active)
        VALUES (?, ?, 1)
      `).run(name.trim(), description || '');
      db.exec('COMMIT;');
      return NextResponse.json({ success: true, id: res.lastInsertRowid });
    } else {
      const res = db.prepare(`
        INSERT INTO basket_sets (name, description, is_active)
        VALUES (?, ?, 0)
      `).run(name.trim(), description || '');
      return NextResponse.json({ success: true, id: res.lastInsertRowid });
    }
  } catch (err: any) {
    console.error('Create basket set error:', err);
    return NextResponse.json({ error: 'Failed to create basket set' }, { status: 500 });
  }
}
