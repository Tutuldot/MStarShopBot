import { NextRequest, NextResponse } from 'next/server';
import { queryOne, execute } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { sendMetaProductCard } from '@/lib/meta';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  try {
    const { productId } = await req.json();

    const conv = await queryOne<any>('SELECT * FROM conversations WHERE id = ?', [Number(id)]);
    if (!conv) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    const product = await queryOne<any>('SELECT * FROM products WHERE id = ?', [Number(productId)]);
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const cardSummaryText = `Recommended Product: ${product.name} (${product.currency || '$'}${product.price})\n${product.product_url}`;

    // Record agent action in chat history
    await execute(`
      INSERT INTO messages (conversation_id, sender_type, text, product_url)
      VALUES (?, 'agent', ?, ?)
    `, [conv.id, cardSummaryText, product.product_url]);

    await execute(`
      UPDATE conversations
      SET last_message = ?, last_message_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [cardSummaryText, conv.id]);

    // Send Facebook Generic Template Card to customer
    if (!conv.psid.startsWith('sim_')) {
      await sendMetaProductCard(conv.psid, product);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Send product error:', err);
    return NextResponse.json({ error: 'Failed to send product card' }, { status: 500 });
  }
}
