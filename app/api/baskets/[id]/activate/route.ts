import { NextRequest, NextResponse } from 'next/server';
import { activateBasketSet } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  try {
    activateBasketSet(Number(id));
    return NextResponse.json({ success: true, message: `Basket set #${id} is now the active set` });
  } catch (err: any) {
    console.error('Activation error:', err);
    return NextResponse.json({ error: 'Failed to activate set' }, { status: 500 });
  }
}
