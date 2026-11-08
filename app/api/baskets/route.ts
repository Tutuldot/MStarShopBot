import { NextRequest, NextResponse } from 'next/server';
import { queryAll, execute, getPool } from '@/lib/db';
import { getSession } from '@/lib/auth';

// GET all basket sets
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sets = await queryAll(`
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
    GROUP BY bs.id, bs.name, bs.description, bs.is_active, bs.created_at, bs.updated_at
    ORDER BY bs.is_active DESC, bs.id DESC
  `);

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

    if (activateImmediately) {
      const pool = getPool();
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        await conn.query('UPDATE basket_sets SET is_active = 0');
        const [res]: any = await conn.query(
          'INSERT INTO basket_sets (name, description, is_active) VALUES (?, ?, 1)',
          [name.trim(), description || '']
        );
        await conn.commit();
        return NextResponse.json({ success: true, id: res.insertId });
      } catch (err) {
        await conn.rollback();
        throw err;
      } finally {
        conn.release();
      }
    } else {
      const res = await execute(
        'INSERT INTO basket_sets (name, description, is_active) VALUES (?, ?, 0)',
        [name.trim(), description || '']
      );
      return NextResponse.json({ success: true, id: res.insertId });
    }
  } catch (err: any) {
    console.error('Create basket set error:', err);
    return NextResponse.json({ error: 'Failed to create basket set' }, { status: 500 });
  }
}
