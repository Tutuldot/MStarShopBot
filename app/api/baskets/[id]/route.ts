import { NextRequest, NextResponse } from 'next/server';
import { queryOne, queryAll, execute } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const set = await queryOne('SELECT * FROM basket_sets WHERE id = ?', [Number(id)]);
  if (!set) {
    return NextResponse.json({ error: 'Basket set not found' }, { status: 404 });
  }

  const products = await queryAll('SELECT * FROM products WHERE basket_set_id = ? ORDER BY id ASC', [Number(id)]);

  return NextResponse.json({ set, products });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const { name, description } = await req.json();

  if (!name || !name.trim()) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }

  await execute(`
    UPDATE basket_sets
    SET name = ?, description = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [name.trim(), description || '', Number(id)]);

  return NextResponse.json({ success: true });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  // Check if trying to delete the only active set
  const set = await queryOne<{ is_active: number }>('SELECT is_active FROM basket_sets WHERE id = ?', [Number(id)]);
  if (set?.is_active === 1) {
    const totalSets = await queryOne<{ count: number }>('SELECT COUNT(*) as count FROM basket_sets');
    if ((totalSets?.count ?? 0) > 1) {
      // Pick another set to activate if available
      const nextSet = await queryOne<{ id: number }>('SELECT id FROM basket_sets WHERE id != ? LIMIT 1', [Number(id)]);
      if (nextSet) {
        await execute('UPDATE basket_sets SET is_active = 1 WHERE id = ?', [nextSet.id]);
      }
    }
  }

  await execute('DELETE FROM products WHERE basket_set_id = ?', [Number(id)]);
  await execute('DELETE FROM basket_sets WHERE id = ?', [Number(id)]);

  return NextResponse.json({ success: true });
}
