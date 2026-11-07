import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const db = getDb();

  const set = db.prepare('SELECT * FROM basket_sets WHERE id = ?').get(Number(id));
  if (!set) {
    return NextResponse.json({ error: 'Basket set not found' }, { status: 404 });
  }

  const products = db.prepare('SELECT * FROM products WHERE basket_set_id = ? ORDER BY id ASC').all(Number(id));

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

  const db = getDb();
  db.prepare(`
    UPDATE basket_sets
    SET name = ?, description = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(name.trim(), description || '', Number(id));

  return NextResponse.json({ success: true });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const db = getDb();

  // Check if trying to delete the only active set
  const set = db.prepare('SELECT is_active FROM basket_sets WHERE id = ?').get(Number(id)) as { is_active: number } | undefined;
  if (set?.is_active === 1) {
    const totalSets = db.prepare('SELECT COUNT(*) as count FROM basket_sets').get() as { count: number };
    if (totalSets.count > 1) {
      // Pick another set to activate if available
      const nextSet = db.prepare('SELECT id FROM basket_sets WHERE id != ? LIMIT 1').get(Number(id)) as { id: number };
      if (nextSet) {
        db.prepare('UPDATE basket_sets SET is_active = 1 WHERE id = ?').run(nextSet.id);
      }
    }
  }

  db.prepare('DELETE FROM products WHERE basket_set_id = ?').run(Number(id));
  db.prepare('DELETE FROM basket_sets WHERE id = ?').run(Number(id));

  return NextResponse.json({ success: true });
}
