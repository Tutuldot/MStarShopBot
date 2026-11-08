import { NextRequest, NextResponse } from 'next/server';
import { execute } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  try {
    const { name, price, price_max, currency, description, image_url, product_url } = await req.json();

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Product name is required' }, { status: 400 });
    }
    if (!product_url || !product_url.trim()) {
      return NextResponse.json({ error: 'Product URL is required' }, { status: 400 });
    }

    const minPrice = parseFloat(price) || 0.0;
    const maxPrice = price_max != null && parseFloat(price_max) > minPrice ? parseFloat(price_max) : null;

    await execute(`
      UPDATE products
      SET name = ?, price = ?, price_max = ?, currency = ?, description = ?, image_url = ?, product_url = ?
      WHERE id = ?
    `, [
      name.trim(),
      minPrice,
      maxPrice,
      currency || '$',
      description || '',
      image_url || '',
      product_url.trim(),
      Number(id)
    ]);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed to update product' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  await execute('DELETE FROM products WHERE id = ?', [Number(id)]);
  return NextResponse.json({ success: true });
}
