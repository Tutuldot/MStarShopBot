import { NextRequest, NextResponse } from 'next/server';
import { queryAll, queryOne, execute, getPool } from '@/lib/db';
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
      bs.basket_number,
      bs.name,
      bs.description,
      bs.is_active,
      bs.created_at,
      bs.updated_at,
      COUNT(p.id) AS product_count
    FROM basket_sets bs
    LEFT JOIN products p ON bs.id = p.basket_set_id
    GROUP BY bs.id, bs.basket_number, bs.name, bs.description, bs.is_active, bs.created_at, bs.updated_at
    ORDER BY bs.is_active DESC, COALESCE(bs.basket_number, 999999) ASC, bs.id DESC
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
    const { name, description, basketNumber, activateImmediately } = await req.json();
    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Basket set name is required' }, { status: 400 });
    }

    let parsedNumber: number | null = basketNumber ? Number(basketNumber) : null;
    if (parsedNumber == null || isNaN(parsedNumber)) {
      const maxRow = await queryOne<{ max_num: number }>('SELECT MAX(basket_number) as max_num FROM basket_sets');
      parsedNumber = (maxRow?.max_num || 0) + 1;
    }

    if (activateImmediately) {
      const pool = getPool();
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        await conn.query('UPDATE basket_sets SET is_active = 0');
        const [res]: any = await conn.query(
          'INSERT INTO basket_sets (name, basket_number, description, is_active) VALUES (?, ?, ?, 1)',
          [name.trim(), parsedNumber, description || '']
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
        'INSERT INTO basket_sets (name, basket_number, description, is_active) VALUES (?, ?, ?, 0)',
        [name.trim(), parsedNumber, description || '']
      );
      return NextResponse.json({ success: true, id: res.insertId });
    }
  } catch (err: any) {
    console.error('Create basket set error:', err);
    return NextResponse.json({ error: 'Failed to create basket set' }, { status: 500 });
  }
}
