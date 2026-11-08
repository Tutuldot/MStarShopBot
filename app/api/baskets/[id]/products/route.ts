import { NextRequest, NextResponse } from 'next/server';
import { execute } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function POST(
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

    const result = await execute(`
      INSERT INTO products (basket_set_id, name, price, price_max, currency, description, image_url, product_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      Number(id),
      name.trim(),
      minPrice,
      maxPrice,
      currency || '$',
      description || '',
      image_url || '',
      product_url.trim()
    ]);

    return NextResponse.json({ success: true, id: result.insertId });
  } catch (err: any) {
    console.error('Add product error:', err);
    return NextResponse.json({ error: 'Failed to add product' }, { status: 500 });
  }
}
