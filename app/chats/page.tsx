'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { 
  MessageSquare, 
  Send, 
  Bot, 
  User, 
  Sparkles, 
  ShoppingBag, 
  RefreshCw, 
  ExternalLink,
  ShieldAlert,
  Headphones,
  Search,
  CheckCircle,
  Plus
} from 'lucide-react';

interface Conversation {
  id: number;
  psid: string;
  customer_name: string;
  customer_profile_pic: string | null;
  ai_enabled: number;
  last_message: string;
  last_message_at: string;
  unread: number;
}

interface Message {
  id: number;
  conversation_id: number;
  sender_type: 'customer' | 'bot' | 'agent';
  text: string;
  product_url?: string | null;
  created_at: string;
}

interface Product {
  id: number;
  name: string;
  price: number;
  price_max?: number | null;
  currency: string;
  description: string;
  image_url: string;
  product_url: string;
}

function ChatConsole() {
  const searchParams = useSearchParams();
  const initialId = searchParams.get('id') ? Number(searchParams.get('id')) : null;

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConvId, setSelectedConvId] = useState<number | null>(initialId);
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputReply, setInputReply] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Active basket products for quick send
  const [activeProducts, setActiveProducts] = useState<Product[]>([]);
  const [showProductDrawer, setShowProductDrawer] = useState(false);

  // Simulation test modal
  const [showSimulateModal, setShowSimulateModal] = useState(false);
  const [simName, setSimName] = useState('Sarah Jenkins');
  const [simText, setSimText] = useState('Hi! Do you have any recommendations for gifts or popular items?');
  const [simLoading, setSimLoading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Fetch all conversations
  const fetchConversations = async (keepSelection = true) => {
    try {
      const res = await fetch('/api/chats');
      const data = await res.json();
      if (data.conversations) {
        setConversations(data.conversations);
        if (!keepSelection || !selectedConvId) {
          if (data.conversations.length > 0) {
            setSelectedConvId(data.conversations[0].id);
          }
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch messages for active conversation
  const fetchMessages = async (convId: number) => {
    try {
      const res = await fetch(`/api/chats/${convId}`);
      const data = await res.json();
      if (data.messages) {
        setMessages(data.messages);
      }
      if (data.conversation) {
        setSelectedConv(data.conversation);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Fetch active basket products to allow 1-click product card sending
  const fetchActiveBasket = async () => {
    try {
      const res = await fetch('/api/baskets');
      const data = await res.json();
      const active = data.sets?.find((s: any) => s.is_active === 1);
      if (active) {
        const prodRes = await fetch(`/api/baskets/${active.id}`);
        const prodData = await prodRes.json();
        if (prodData.products) {
          setActiveProducts(prodData.products);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchConversations(false);
    fetchActiveBasket();

    // Auto-refresh conversations every 4 seconds to capture incoming Facebook messages in real-time
    const interval = setInterval(() => {
      fetchConversations(true);
      if (selectedConvId) {
        fetchMessages(selectedConvId);
      }
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (selectedConvId) {
      fetchMessages(selectedConvId);
    }
  }, [selectedConvId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Handle agent manual reply
  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputReply.trim() || !selectedConvId || sending) return;

    setSending(true);
    const textToSend = inputReply.trim();
    setInputReply('');

    try {
      const res = await fetch(`/api/chats/${selectedConvId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: textToSend }),
      });

      if (res.ok) {
        await fetchMessages(selectedConvId);
        await fetchConversations(true);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSending(false);
    }
  };

  // Toggle AI auto-reply for this conversation
  const handleToggleAi = async () => {
    if (!selectedConvId) return;
    try {
      const res = await fetch(`/api/chats/${selectedConvId}/toggle-ai`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setSelectedConv((prev) => prev ? { ...prev, ai_enabled: data.ai_enabled } : null);
        await fetchConversations(true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Send product card directly to customer
  const handleSendProductCard = async (productId: number) => {
    if (!selectedConvId) return;
    try {
      const res = await fetch(`/api/chats/${selectedConvId}/send-product`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId }),
      });
      if (res.ok) {
        setShowProductDrawer(false);
        await fetchMessages(selectedConvId);
        await fetchConversations(true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Simulate customer message
  const handleSimulate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSimLoading(true);
    try {
      const res = await fetch('/api/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: simName,
          text: simText,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setShowSimulateModal(false);
        await fetchConversations(false);
        if (data.conversationId) {
          setSelectedConvId(data.conversationId);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSimLoading(false);
    }
  };

  const filteredConversations = conversations.filter((c) =>
    c.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.last_message.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex-1 flex overflow-hidden bg-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full flex-1 flex flex-col">
        {/* Top Chat Bar */}
        <div className="flex items-center justify-between pb-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-brand-600" />
              <span>Facebook Messenger Chat Monitor</span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Live customer feed with Google Gemini auto-responses and live agent takeover.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSimulateModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 text-xs font-semibold rounded-xl shadow-sm transition-all"
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-600" />
              <span>Simulate Inbound Message</span>
            </button>
          </div>
        </div>

        {/* Chat Layout: Left List & Right Active View */}
        <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm flex overflow-hidden min-h-[620px]">
          {/* Left Column: Conversations List */}
          <div className="w-80 border-r border-slate-200 flex flex-col bg-slate-50/50 shrink-0">
            {/* Search Box */}
            <div className="p-3 border-b border-slate-200 bg-white">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search customer or message..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-100 rounded-lg text-xs outline-none focus:bg-white focus:ring-1 focus:ring-brand-500 transition-all"
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              </div>
            </div>

            {/* Conversation Items */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
              {filteredConversations.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400">
                  No conversations found. Click &quot;Simulate Inbound Message&quot; above to test.
                </div>
              ) : (
                filteredConversations.map((c) => {
                  const isSelected = c.id === selectedConvId;
                  const isAiActive = c.ai_enabled === 1;

                  return (
                    <div
                      key={c.id}
                      onClick={() => setSelectedConvId(c.id)}
                      className={`p-3.5 cursor-pointer transition-colors relative flex items-start gap-3 ${
                        isSelected ? 'bg-brand-50/70 border-r-2 border-brand-600' : 'hover:bg-slate-100/70'
                      }`}
                    >
                      {/* Avatar */}
                      <div className="relative shrink-0">
                        {c.customer_profile_pic ? (
                          <img
                            src={c.customer_profile_pic}
                            alt={c.customer_name}
                            className="w-10 h-10 rounded-full object-cover border border-slate-200"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-xs">
                            {c.customer_name.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        {/* Status dot */}
                        <div
                          className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${
                            isAiActive ? 'bg-purple-500' : 'bg-amber-500'
                          }`}
                          title={isAiActive ? 'AI Auto-Pilot On' : 'Human Takeover'}
                        />
                      </div>

                      {/* Content */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold text-slate-900 truncate">{c.customer_name}</h4>
                          <span className="text-[10px] text-slate-400 shrink-0">
                            {new Date(c.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 truncate mt-0.5">
                          {c.last_message || 'New conversation'}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1.5">
                          <span className={`text-[10px] px-1.5 py-0.2 rounded font-medium ${
                            isAiActive ? 'bg-purple-100 text-purple-700' : 'bg-amber-100 text-amber-700'
                          }`}>
                            {isAiActive ? 'AI Bot' : 'Human'}
                          </span>
                          {c.unread > 0 && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-red-500 text-white font-bold">
                              {c.unread}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Chat History & Interaction Console */}
          <div className="flex-1 flex flex-col bg-slate-50/30">
            {selectedConv ? (
              <>
                {/* Chat Header */}
                <div className="px-6 py-3.5 border-b border-slate-200 bg-white flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-xs">
                      {selectedConv.customer_name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <span>{selectedConv.customer_name}</span>
                        <span className="text-[10px] font-mono text-slate-400 font-normal">
                          (PSID: {selectedConv.psid.slice(0, 12)}...)
                        </span>
                      </h3>
                      <div className="text-[11px] text-slate-500 flex items-center gap-1">
                        <span>Status:</span>
                        <span className={`font-semibold ${selectedConv.ai_enabled ? 'text-purple-600' : 'text-amber-600'}`}>
                          {selectedConv.ai_enabled ? 'AI Auto-Pilot Enabled' : 'Human Takeover (AI Paused)'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Header Actions */}
                  <div className="flex items-center gap-2">
                    {/* Send Product Drawer Button */}
                    <button
                      onClick={() => setShowProductDrawer(!showProductDrawer)}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5"
                    >
                      <ShoppingBag className="w-3.5 h-3.5 text-brand-600" />
                      <span>Send Active Product</span>
                    </button>

                    {/* Toggle AI Takeover button */}
                    <button
                      onClick={handleToggleAi}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 ${
                        selectedConv.ai_enabled
                          ? 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'
                          : 'bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100'
                      }`}
                    >
                      {selectedConv.ai_enabled ? (
                        <>
                          <Headphones className="w-3.5 h-3.5 text-amber-600" />
                          <span>Take Over as Human</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                          <span>Resume Gemini AI</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Product Drawer (Quick Send) */}
                {showProductDrawer && (
                  <div className="p-4 bg-indigo-50/60 border-b border-indigo-100">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                        <ShoppingBag className="w-3.5 h-3.5 text-brand-600" />
                        Click to send a product card directly to this customer:
                      </span>
                      <button
                        onClick={() => setShowProductDrawer(false)}
                        className="text-xs text-indigo-600 hover:underline"
                      >
                        Close
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      {activeProducts.map((p) => (
                        <div
                          key={p.id}
                          className="bg-white p-2.5 rounded-xl border border-indigo-200 shadow-sm flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-slate-800 truncate">{p.name}</div>
                            <div className="text-[11px] text-brand-600 font-semibold">
                              {p.price_max && p.price_max > p.price
                                ? `${p.currency || '$'}${Number(p.price).toLocaleString()} – ${p.currency || '$'}${Number(p.price_max).toLocaleString()}`
                                : `${p.currency || '$'}${Number(p.price).toLocaleString()}`}
                            </div>
                          </div>
                          <button
                            onClick={() => handleSendProductCard(p.id)}
                            className="px-2 py-1 bg-brand-600 hover:bg-brand-700 text-white text-[11px] font-semibold rounded-lg shrink-0"
                          >
                            Send Card
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Messages Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  {messages.map((m) => {
                    const isCustomer = m.sender_type === 'customer';
                    const isBot = m.sender_type === 'bot';
                    const isAgent = m.sender_type === 'agent';

                    return (
                      <div
                        key={m.id}
                        className={`flex flex-col ${isCustomer ? 'items-start' : 'items-end'}`}
                      >
                        {/* Sender Label */}
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mb-1 px-1">
                          {isCustomer && (
                            <>
                              <User className="w-3 h-3 text-slate-400" />
                              <span>{selectedConv.customer_name}</span>
                            </>
                          )}
                          {isBot && (
                            <>
                              <Sparkles className="w-3 h-3 text-purple-600" />
                              <span className="text-purple-600 font-semibold">Gemini AI Auto-Reply</span>
                            </>
                          )}
                          {isAgent && (
                            <>
                              <Headphones className="w-3 h-3 text-indigo-600" />
                              <span className="text-indigo-600 font-semibold">Human Agent</span>
                            </>
                          )}
                          <span>•</span>
                          <span>{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>

                        {/* Bubble */}
                        <div
                          className={`max-w-lg rounded-2xl px-4 py-2.5 text-xs shadow-sm ${
                            isCustomer
                              ? 'bg-white border border-slate-200 text-slate-800 rounded-tl-sm'
                              : isBot
                              ? 'bg-purple-600 text-white rounded-tr-sm'
                              : 'bg-indigo-600 text-white rounded-tr-sm'
                          }`}
                        >
                          <div className="whitespace-pre-wrap leading-relaxed">{m.text}</div>

                          {m.product_url && (
                            <div className="mt-2 pt-2 border-t border-white/20">
                              <a
                                href={m.product_url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] underline font-semibold text-white/90 hover:text-white"
                              >
                                <ExternalLink className="w-3 h-3" />
                                <span>View Linked Product on Store</span>
                              </a>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>

                {/* Message Input Box */}
                <div className="p-4 bg-white border-t border-slate-200">
                  <form onSubmit={handleSendReply} className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder={`Reply as human agent to ${selectedConv.customer_name}...`}
                      value={inputReply}
                      onChange={(e) => setInputReply(e.target.value)}
                      className="flex-1 px-4 py-2.5 bg-slate-100 rounded-xl text-xs outline-none focus:bg-white focus:ring-2 focus:ring-brand-500 transition-all"
                    />
                    <button
                      type="submit"
                      disabled={sending || !inputReply.trim()}
                      className="px-4 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-40 text-white text-xs font-semibold rounded-xl shadow-sm transition-all flex items-center gap-1.5 shrink-0"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{sending ? 'Sending...' : 'Send Message'}</span>
                    </button>
                  </form>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400">
                <MessageSquare className="w-12 h-12 text-slate-300 mb-3" />
                <h3 className="text-sm font-semibold text-slate-700">No chat selected</h3>
                <p className="text-xs text-slate-400 max-w-sm mt-1">
                  Choose a customer conversation from the left sidebar or click Simulate Inbound Message to start a conversation.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal: Simulate Customer Message */}
      {showSimulateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-1 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-600" />
              <span>Simulate Customer Inbound Chat</span>
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Test how Google Gemini AI responds using your active product basket without waiting for a live Facebook message.
            </p>

            <form onSubmit={handleSimulate} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Customer Name
                </label>
                <input
                  type="text"
                  required
                  value={simName}
                  onChange={(e) => setSimName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Customer Message
                </label>
                <textarea
                  rows={3}
                  required
                  value={simText}
                  onChange={(e) => setSimText(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowSimulateModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={simLoading}
                  className="px-4 py-2 text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white rounded-xl shadow-sm flex items-center gap-1.5"
                >
                  {simLoading ? 'Simulating...' : 'Send Message'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ChatsPage() {
  return (
    <Suspense fallback={
      <div className="flex-1 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <ChatConsole />
    </Suspense>
  );
}

