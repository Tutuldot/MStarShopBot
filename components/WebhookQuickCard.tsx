'use client';

import { useState } from 'react';
import Link from 'next/link';
import { 
  Radio, 
  Copy, 
  Check, 
  ExternalLink, 
  Globe, 
  KeyRound, 
  CheckCircle2, 
  AlertTriangle,
  ArrowRight
} from 'lucide-react';

interface WebhookQuickCardProps {
  callbackUrl: string;
  verifyToken: string;
  lastVerifiedAt?: string | null;
  lastEventAt?: string | null;
}

export default function WebhookQuickCard({
  callbackUrl,
  verifyToken,
  lastVerifiedAt,
  lastEventAt,
}: WebhookQuickCardProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = (text: string, keyName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(keyName);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const isLocalhost = callbackUrl.includes('localhost') || callbackUrl.includes('127.0.0.1');

  return (
    <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-blue-950 rounded-2xl p-5 text-white shadow-md relative overflow-hidden border border-indigo-900/40">
      {/* Background Accent */}
      <div className="absolute -top-12 -right-12 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
      
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-400/20">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm tracking-wide text-white">
                Meta Messenger Webhook Link
              </h3>
              {lastVerifiedAt ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Verified by Meta
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Ready for Meta Setup
                </span>
              )}
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Copy these two values directly into your Meta App Dashboard under Messenger &gt; Webhooks.
            </p>
          </div>
        </div>

        <Link
          href="/settings"
          className="text-xs font-semibold text-blue-300 hover:text-white flex items-center gap-1 self-start lg:self-center transition-colors"
        >
          <span>Webhook Settings &amp; Diagnostics</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        {/* Callback URL Box */}
        <div className="bg-black/30 rounded-xl p-3 border border-white/10 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5 font-medium">
            <span className="flex items-center gap-1 text-slate-300">
              <Globe className="w-3.5 h-3.5 text-blue-400" /> Callback URL
            </span>
            <span className="text-[10px] text-blue-300">Target Endpoint</span>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={callbackUrl}
              className="flex-1 bg-black/40 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs font-mono text-emerald-400 outline-none select-all font-semibold"
            />
            <button
              onClick={() => handleCopy(callbackUrl, 'url')}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors shrink-0"
              title="Copy Callback URL"
            >
              {copiedKey === 'url' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedKey === 'url' ? 'Copied' : 'Copy'}</span>
            </button>
          </div>

          {isLocalhost && (
            <p className="text-[10px] text-amber-300/90 mt-2 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 shrink-0" />
              <span>Localhost link. If Meta can't reach this, use an ngrok HTTPS link in Settings.</span>
            </p>
          )}
        </div>

        {/* Verify Token Box */}
        <div className="bg-black/30 rounded-xl p-3 border border-white/10 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5 font-medium">
            <span className="flex items-center gap-1 text-slate-300">
              <KeyRound className="w-3.5 h-3.5 text-indigo-400" /> Verify Token
            </span>
            <span className="text-[10px] text-indigo-300">Challenge Secret</span>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={verifyToken}
              className="flex-1 bg-black/40 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs font-mono text-indigo-300 outline-none select-all font-semibold"
            />
            <button
              onClick={() => handleCopy(verifyToken, 'token')}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors shrink-0"
              title="Copy Verify Token"
            >
              {copiedKey === 'token' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedKey === 'token' ? 'Copied' : 'Copy'}</span>
            </button>
          </div>

          <p className="text-[10px] text-slate-400 mt-2">
            Enter this exact token in Meta App Dashboard &gt; Verify token.
          </p>
        </div>
      </div>
    </div>
  );
}

