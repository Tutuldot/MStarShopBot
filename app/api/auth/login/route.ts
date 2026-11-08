import { NextRequest, NextResponse } from 'next/server';
import { queryOne } from '@/lib/db';
import { verifyPassword, setSessionCookie } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const user = await queryOne<any>(
      'SELECT id, name, email, password_hash, salt, role FROM users WHERE email = ?',
      [email.toLowerCase().trim()]
    );

    if (!user) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    const isValid = verifyPassword(password, user.password_hash, user.salt);
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    await setSessionCookie(user.id);

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err: any) {
    console.error('Login error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
