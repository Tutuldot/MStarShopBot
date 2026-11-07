import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSession, hashPassword } from '@/lib/auth';

// GET all users
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getDb();
  const users = db.prepare('SELECT id, name, email, role, created_at FROM users ORDER BY id ASC').all();
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
    const db = getDb();

    // Check if email already exists
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(cleanEmail);
    if (existing) {
      return NextResponse.json({ error: 'A user with this email already exists' }, { status: 400 });
    }

    const { hash, salt } = hashPassword(password);
    const assignedRole = role === 'staff' ? 'staff' : 'admin';

    const result = db.prepare(`
      INSERT INTO users (name, email, password_hash, salt, role)
      VALUES (?, ?, ?, ?, ?)
    `).run(name.trim(), cleanEmail, hash, salt, assignedRole);

    return NextResponse.json({
      success: true,
      user: {
        id: result.lastInsertRowid,
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

  const db = getDb();
  // Ensure we don't delete the last admin
  const adminCount = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin'").get() as { count: number };
  const targetUser = db.prepare('SELECT role FROM users WHERE id = ?').get(id) as { role: string } | undefined;

  if (targetUser?.role === 'admin' && adminCount.count <= 1) {
    return NextResponse.json({ error: 'Cannot delete the only remaining admin' }, { status: 400 });
  }

  db.prepare('DELETE FROM users WHERE id = ?').run(id);
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

    const db = getDb();
    if (password && password.trim().length > 0) {
      const { hash, salt } = hashPassword(password);
      db.prepare('UPDATE users SET name = ?, role = ?, password_hash = ?, salt = ? WHERE id = ?')
        .run(name, role, hash, salt, id);
    } else {
      db.prepare('UPDATE users SET name = ?, role = ? WHERE id = ?')
        .run(name, role, id);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}
