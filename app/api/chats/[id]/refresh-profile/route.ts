import { NextRequest, NextResponse } from 'next/server';
import { queryOne, execute } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { fetchMetaUserProfile } from '@/lib/meta';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const conv = await queryOne<any>('SELECT * FROM conversations WHERE id = ?', [Number(id)]);

  if (!conv) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
  }

  // Attempt to fetch from Facebook
  const profile = await fetchMetaUserProfile(conv.psid);

  if (!profile) {
    return NextResponse.json({
      success: false,
      message: 'Could not retrieve profile from Meta. Ensure the Page Access Token is valid and has pages_messaging permission, and that this is a real Facebook PSID (not a test PSID).',
    });
  }

  await execute(
    'UPDATE conversations SET customer_name = ?, customer_profile_pic = ? WHERE id = ?',
    [profile.name, profile.profile_pic || null, Number(id)]
  );

  return NextResponse.json({
    success: true,
    profile: {
      name: profile.name,
      profile_pic: profile.profile_pic,
    },
  });
}
