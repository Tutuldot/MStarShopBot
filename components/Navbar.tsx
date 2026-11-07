'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { 
  Bot, 
  ShoppingBag, 
  MessageSquare, 
  Users, 
  Settings, 
  LayoutDashboard, 
  LogOut, 
  ShieldCheck,
  Radio
} from 'lucide-react';

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
}

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [unreadCount, setUnreadCount] = useState<number>(0);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => {
        if (!res.ok) throw new Error('Not logged in');
        return res.json();
      })
      .then((data) => setUser(data.user))
      .catch(() => {
        if (pathname !== '/login') {
          router.push('/login');
        }
      });

    // Check unread chats
    const checkUnread = () => {
      fetch('/api/chats')
        .then((res) => res.json())
        .then((data) => {
          if (data.conversations) {
            const count = data.conversations.reduce((acc: number, c: any) => acc + (c.unread || 0), 0);
            setUnreadCount(count);
          }
        })
        .catch(() => {});
    };

    checkUnread();
    const interval = setInterval(checkUnread, 10000);
    return () => clearInterval(interval);
  }, [pathname, router]);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  if (pathname === '/login') return null;

  const navLinks = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/baskets', label: 'Product Baskets', icon: ShoppingBag },
    { href: '/chats', label: 'Chats Monitor', icon: MessageSquare, badge: unreadCount },
    ...(user?.role === 'admin' ? [{ href: '/users', label: 'Users', icon: Users }] : []),
    { href: '/settings', label: 'Integration & AI', icon: Settings },
  ];

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="flex items-center gap-2.5 font-bold text-xl text-slate-900 group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-brand-500/20 group-hover:scale-105 transition-transform">
                <Bot className="w-6 h-6" />
              </div>
              <div className="flex flex-col">
                <span className="leading-tight tracking-tight flex items-center gap-1.5">
                  MStar<span className="text-brand-600">ShopBot</span>
                </span>
                <span className="text-[10px] text-slate-400 font-medium tracking-wider uppercase">Meta & AI Sales Hub</span>
              </div>
            </Link>
          </div>

          {/* Navigation Items */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors relative ${
                    isActive
                      ? 'bg-brand-50 text-brand-700'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-brand-600' : 'text-slate-500'}`} />
                  <span>{link.label}</span>
                  {link.badge && link.badge > 0 ? (
                    <span className="px-1.5 py-0.5 text-xs font-semibold bg-red-500 text-white rounded-full">
                      {link.badge}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </nav>

          {/* User profile & actions */}
          <div className="flex items-center gap-3">
            {user && (
              <div className="hidden sm:flex items-center gap-2 text-right">
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-slate-800 leading-tight">{user.name}</span>
                  <span className="text-xs text-slate-400 capitalize flex items-center justify-end gap-1">
                    <ShieldCheck className="w-3 h-3 text-brand-500" />
                    {user.role}
                  </span>
                </div>
              </div>
            )}
            <button
              onClick={handleLogout}
              title="Sign Out"
              className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
