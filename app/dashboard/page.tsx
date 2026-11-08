import Link from 'next/link';
import { headers } from 'next/headers';
import { queryOne, queryAll, getActiveBasketProducts, formatProductPrice } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import WebhookQuickCard from '@/components/WebhookQuickCard';
import { 
  ShoppingBag, 
  MessageSquare, 
  Sparkles, 
  Users, 
  ArrowRight, 
  ExternalLink, 
  CheckCircle, 
  AlertCircle,
  Radio,
  Sliders,
  Store
} from 'lucide-react';

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }

  const { activeSet, products } = await getActiveBasketProducts();

  const totalConversations = (await queryOne<{ count: number }>('SELECT COUNT(*) as count FROM conversations')) || { count: 0 };
  const unreadConversations = (await queryOne<{ count: number }>('SELECT COUNT(*) as count FROM conversations WHERE unread > 0')) || { count: 0 };
  const totalBaskets = (await queryOne<{ count: number }>('SELECT COUNT(*) as count FROM basket_sets')) || { count: 0 };

  const metaTokenRow = await queryOne<{ value: string }>("SELECT `value` FROM settings WHERE `key` = 'fb_page_access_token'");
  const geminiKeyRow = await queryOne<{ value: string }>("SELECT `value` FROM settings WHERE `key` = 'gemini_api_key'");
  const aiAutoReplyRow = await queryOne<{ value: string }>("SELECT `value` FROM settings WHERE `key` = 'ai_auto_reply'");
  const verifyTokenRow = await queryOne<{ value: string }>("SELECT `value` FROM settings WHERE `key` = 'fb_verify_token'");
  const callbackUrlRow = await queryOne<{ value: string }>("SELECT `value` FROM settings WHERE `key` = 'webhook_callback_url'");
  const lastVerifiedRow = await queryOne<{ value: string }>("SELECT `value` FROM settings WHERE `key` = 'last_webhook_verified_at'");
  const lastEventRow = await queryOne<{ value: string }>("SELECT `value` FROM settings WHERE `key` = 'last_webhook_event_at'");

  const isMetaConfigured = !!metaTokenRow?.value;
  const isGeminiConfigured = !!geminiKeyRow?.value;
  const isAiAutoReplyOn = (aiAutoReplyRow?.value ?? '1') === '1';

  // Compute live host
  const headerList = await headers();
  const host = headerList.get('host') || 'localhost:3001';
  const proto = headerList.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https');
  const autoCallbackUrl = `${proto}://${host}/api/webhook`;
  const effectiveCallbackUrl = callbackUrlRow?.value?.trim()
    ? (callbackUrlRow.value.trim().endsWith('/api/webhook')
        ? callbackUrlRow.value.trim()
        : `${callbackUrlRow.value.trim().replace(/\/+$/, '')}/api/webhook`)
    : autoCallbackUrl;
  const effectiveVerifyToken = verifyTokenRow?.value || 'mstar_bot_token_secret';

  // Recent 5 conversations
  const recentChats = await queryAll(`
    SELECT * FROM conversations
    ORDER BY last_message_at DESC LIMIT 5
  `);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
      {/* Top Welcome Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-slate-200 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Dashboard Overview
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Welcome, <span className="font-semibold text-slate-700">{session.name}</span>. Monitor your Facebook Messenger bot and active store catalogs.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/chats"
            className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-xl shadow-sm transition-all"
          >
            <MessageSquare className="w-4 h-4" />
            <span>Open Chat Console</span>
            {unreadConversations.count > 0 && (
              <span className="px-1.5 py-0.2 bg-red-500 text-white rounded-full text-xs">
                {unreadConversations.count}
              </span>
            )}
          </Link>
        </div>
      </div>

      {/* Meta Webhook Quick Connect Link Banner */}
      <div className="mt-6">
        <WebhookQuickCard
          callbackUrl={effectiveCallbackUrl}
          verifyToken={effectiveVerifyToken}
          lastVerifiedAt={lastVerifiedRow?.value}
          lastEventAt={lastEventRow?.value}
        />
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mt-6">
        {/* Metric 1: Active Product Basket */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Active Basket Set
            </span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <ShoppingBag className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-lg font-bold text-slate-900 truncate" title={activeSet ? (activeSet as any).name : 'None'}>
              {activeSet ? (activeSet as any).name : 'No Active Set'}
            </div>
            <div className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>{products.length} live product{products.length === 1 ? '' : 's'} linked</span>
            </div>
          </div>
          <Link
            href="/baskets"
            className="mt-4 text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1"
          >
            Manage baskets ({totalBaskets.count} total) <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {/* Metric 2: Total Conversations */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Customer Chats
            </span>
            <div className="p-2 bg-indigo-50 text-brand-600 rounded-xl">
              <MessageSquare className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900">
              {totalConversations.count}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              {unreadConversations.count > 0 ? (
                <span className="text-amber-600 font-semibold">{unreadConversations.count} unread messages</span>
              ) : (
                <span className="text-slate-400">All caught up</span>
              )}
            </div>
          </div>
          <Link
            href="/chats"
            className="mt-4 text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1"
          >
            View live conversations <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {/* Metric 3: AI Auto-Reply Status */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Gemini AI Status
            </span>
            <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
              <Sparkles className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                isAiAutoReplyOn ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'
              }`}>
                {isAiAutoReplyOn ? 'Auto-Pilot Active' : 'Paused (Manual Only)'}
              </span>
            </div>
            <div className="text-xs text-slate-500 mt-2">
              {isGeminiConfigured ? (
                <span className="text-emerald-600 flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5" /> API Key Connected
                </span>
              ) : (
                <span className="text-amber-600 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" /> API Key Missing
                </span>
              )}
            </div>
          </div>
          <Link
            href="/settings"
            className="mt-4 text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1"
          >
            Configure AI model <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {/* Metric 4: Meta Webhook Status */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Meta Webhook
            </span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <Radio className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-base font-bold text-slate-900 flex items-center gap-1.5">
              {isMetaConfigured ? (
                <span className="text-emerald-600 flex items-center gap-1 text-sm font-semibold">
                  <CheckCircle className="w-4 h-4" /> Ready for Traffic
                </span>
              ) : (
                <span className="text-amber-600 flex items-center gap-1 text-sm font-semibold">
                  <AlertCircle className="w-4 h-4" /> Pending Token Setup
                </span>
              )}
            </div>
            <div className="text-xs text-slate-400 mt-2">
              Page-Scoped Messenger API
            </div>
          </div>
          <Link
            href="/settings"
            className="mt-4 text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1"
          >
            View Webhook credentials <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {/* Main Grid: Active Products & Recent Chats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
        {/* Left 2 Cols: Currently Active Basket Products */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800">
                  ACTIVE BASKET SET
                </span>
                <h2 className="text-lg font-bold text-slate-900">
                  {activeSet ? (activeSet as any).name : 'No Set Active'}
                </h2>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                These are the products that Google Gemini AI and human staff pitch directly to customers in Messenger chats with direct links to your PHP store.
              </p>
            </div>
            <Link
              href="/baskets"
              className="text-xs font-semibold px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors flex items-center gap-1"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Change Set</span>
            </Link>
          </div>

          <div className="mt-4 divide-y divide-slate-100">
            {products.length === 0 ? (
              <div className="py-8 text-center text-sm text-slate-400">
                No products inside this basket yet. Add products with URLs to your PHP store.
              </div>
            ) : (
              products.map((p: any) => (
                <div key={p.id} className="py-3.5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    {p.image_url ? (
                      <img
                        src={p.image_url}
                        alt={p.name}
                        className="w-12 h-12 rounded-xl object-cover border border-slate-200 shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                        <ShoppingBag className="w-5 h-5" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <h4 className="text-sm font-semibold text-slate-900 truncate">{p.name}</h4>
                      <p className="text-xs text-slate-500 truncate max-w-md">{p.description || 'No description'}</p>
                      <a
                        href={p.product_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-brand-600 hover:underline flex items-center gap-1 mt-0.5 truncate"
                      >
                        <ExternalLink className="w-3 h-3 shrink-0" />
                        <span className="truncate">{p.product_url}</span>
                      </a>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-sm font-bold text-slate-900">
                      {formatProductPrice(p.price, p.price_max, p.currency)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right 1 Col: Recent Customer Chats */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 flex flex-col">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-brand-600" />
              <span>Recent Activity</span>
            </h3>
            <Link href="/chats" className="text-xs font-semibold text-brand-600 hover:underline">
              View All
            </Link>
          </div>

          <div className="mt-4 space-y-3 flex-1">
            {recentChats.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-400">
                No chats recorded yet. Send a test message from the Chats tab!
              </div>
            ) : (
              recentChats.map((c) => (
                <Link
                  key={c.id}
                  href={`/chats?id=${c.id}`}
                  className="block p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors border border-slate-100"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">{c.customer_name}</span>
                    <span className="text-[10px] text-slate-400">
                      {new Date(c.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 truncate mt-1">
                    {c.last_message || 'Started conversation'}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                      c.ai_enabled ? 'bg-purple-100 text-purple-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {c.ai_enabled ? 'AI Auto-Pilot' : 'Human Takeover'}
                    </span>
                    {c.unread > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500 text-white font-bold">
                        {c.unread} New
                      </span>
                    )}
                  </div>
                </Link>
              ))
            )}
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100">
            <Link
              href="/chats"
              className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-colors"
            >
              <span>Test Bot & Simulate Chats</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
