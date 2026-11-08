import { NextRequest, NextResponse } from 'next/server';
import { queryAll, queryOne, execute } from '@/lib/db';
import { getSession, hashPassword } from '@/lib/auth';

// GET all users
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const users = await queryAll('SELECT id, name, email, role, created_at FROM users ORDER BY id ASC');
  return NextResponse.json({ users });
}

// POST create new user
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden. Admin role required.' }, { status: 403 });
  }

  try {
    const { name, email, password, role } = await req.json();

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Name, email, and password are required' }, { status: 400 });
    }

    const cleanEmail = email.toLowerCase().trim();

    // Check if email already exists
    const existing = await queryOne('SELECT id FROM users WHERE email = ?', [cleanEmail]);
    if (existing) {
      return NextResponse.json({ error: 'A user with this email already exists' }, { status: 400 });
    }

    const { hash, salt } = hashPassword(password);
    const assignedRole = role === 'staff' ? 'staff' : 'admin';

    const result = await execute(`
      INSERT INTO users (name, email, password_hash, salt, role)
      VALUES (?, ?, ?, ?, ?)
    `, [name.trim(), cleanEmail, hash, salt, assignedRole]);

    return NextResponse.json({
      success: true,
      user: {
        id: result.insertId,
        name: name.trim(),
        email: cleanEmail,
        role: assignedRole,
      },
    });
  } catch (err: any) {
    console.error('Create user error:', err);
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
}

// DELETE user
export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden. Admin role required.' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const id = Number(searchParams.get('id'));

  if (!id) {
    return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
  }

  if (id === session.id) {
    return NextResponse.json({ error: 'You cannot delete your own account' }, { status: 400 });
  }

  // Ensure we don't delete the last admin
  const adminCount = await queryOne<{ count: number }>("SELECT COUNT(*) as count FROM users WHERE role = 'admin'");
  const targetUser = await queryOne<{ role: string }>('SELECT role FROM users WHERE id = ?', [id]);

  if (targetUser?.role === 'admin' && (adminCount?.count ?? 0) <= 1) {
    return NextResponse.json({ error: 'Cannot delete the only remaining admin' }, { status: 400 });
  }

  await execute('DELETE FROM users WHERE id = ?', [id]);
  return NextResponse.json({ success: true });
}

// PUT update user (role or password)
export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden. Admin role required.' }, { status: 403 });
  }

  try {
    const { id, name, role, password } = await req.json();
    if (!id) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    if (password && password.trim().length > 0) {
      const { hash, salt } = hashPassword(password);
      await execute('UPDATE users SET name = ?, role = ?, password_hash = ?, salt = ? WHERE id = ?', [name, role, hash, salt, id]);
    } else {
      await execute('UPDATE users SET name = ?, role = ? WHERE id = ?', [name, role, id]);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}
