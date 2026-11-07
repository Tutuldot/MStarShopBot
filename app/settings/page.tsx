'use client';

import { useState, useEffect } from 'react';
import { 
  Settings, 
  Sparkles, 
  Radio, 
  Copy, 
  Check, 
  Save, 
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  Activity,
  CheckCircle2,
  XCircle,
  HelpCircle,
  KeyRound,
  Globe,
  SlidersHorizontal,
  FileText
} from 'lucide-react';
import WebhookLogsViewer from '@/components/WebhookLogsViewer';

export default function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({
    fb_page_access_token: '',
    fb_verify_token: 'mstar_bot_token_secret',
    fb_page_id: '',
    fb_app_secret: '',
    webhook_callback_url: '',
    gemini_api_key: '',
    gemini_model: 'gemini-2.5-flash',
    system_prompt: '',
    ai_auto_reply: '1',
    store_url: '',
    last_webhook_verified_at: '',
    last_webhook_event_at: '',
  });

  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [detectedOrigin, setDetectedOrigin] = useState('');
  const [customUrlMode, setCustomUrlMode] = useState(false);

  // Self-test states
  const [testingWebhook, setTestingWebhook] = useState(false);
  const [testResult, setTestResult] = useState<{
    status: 'PASS' | 'FAIL';
    message: string;
    verifiedAt?: string | null;
    eventAt?: string | null;
  } | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setDetectedOrigin(window.location.origin);
    }

    fetch('/api/settings')
      .then((res) => res.json())
      .then((data) => {
        if (data.settings) {
          setSettings((prev) => ({ ...prev, ...data.settings }));
          if (data.settings.webhook_callback_url) {
            setCustomUrlMode(true);
          }
        }
      })
      .catch(console.error);

    // Initial check of webhook status
    fetch('/api/webhook/test')
      .then((res) => res.json())
      .then((data) => {
        if (data?.meta_history) {
          setSettings((prev) => ({
            ...prev,
            last_webhook_verified_at: data.meta_history.last_verified_at || '',
            last_webhook_event_at: data.meta_history.last_event_at || '',
          }));
        }
      })
      .catch(() => {});
  }, []);

  // Compute the live callback URL to display
  const effectiveCallbackUrl = (() => {
    if (settings.webhook_callback_url && settings.webhook_callback_url.trim()) {
      const clean = settings.webhook_callback_url.trim();
      return clean.endsWith('/api/webhook') ? clean : `${clean.replace(/\/+$/, '')}/api/webhook`;
    }
    return detectedOrigin ? `${detectedOrigin}/api/webhook` : 'https://your-domain.com/api/webhook';
  })();

  const isLocalhost = effectiveCallbackUrl.includes('localhost') || effectiveCallbackUrl.includes('127.0.0.1');
  const isHttps = effectiveCallbackUrl.startsWith('https://');

  const handleCopy = (text: string, keyName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(keyName);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const generateRandomToken = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let rand = 'mstar_sec_';
    for (let i = 0; i < 20; i++) {
      rand += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setSettings((prev) => ({ ...prev, fb_verify_token: rand }));
  };

  const handleTestWebhook = async () => {
    setTestingWebhook(true);
    setTestResult(null);
    try {
      const res = await fetch(`/api/webhook/test?token=${encodeURIComponent(settings.fb_verify_token)}`);
      const data = await res.json();
      if (data?.self_test) {
        setTestResult({
          status: data.self_test.status,
          message: data.self_test.message,
          verifiedAt: data.meta_history?.last_verified_at,
          eventAt: data.meta_history?.last_event_at,
        });
      }
    } catch (err: any) {
      setTestResult({
        status: 'FAIL',
        message: err.message || 'Failed to ping verification endpoint',
      });
    } finally {
      setTestingWebhook(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(false);

    try {
      const payload = {
        ...settings,
        webhook_callback_url: customUrlMode ? settings.webhook_callback_url : '',
      };

      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-200 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Settings className="w-6 h-6 text-brand-600" />
            <span>Integration & AI Configuration</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Configure your Facebook Messenger Webhook Callback URL, Verify Token, and Gemini AI.
          </p>
        </div>

        {saveSuccess && (
          <div className="px-3.5 py-2 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-xl border border-emerald-200 flex items-center gap-2 animate-fade-in shadow-sm">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Settings saved successfully!</span>
          </div>
        )}
      </div>

      <form onSubmit={handleSave} className="space-y-8 mt-6">
        
        {/* ======================================================== */}
        {/* SECTION 1: PROMINENT META WEBHOOK & VERIFY TOKEN CARD */}
        {/* ======================================================== */}
        <div className="bg-white rounded-2xl border border-blue-200/80 shadow-md shadow-blue-500/5 overflow-hidden">
          {/* Card Header */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-white/20 backdrop-blur-sm text-white">
                <Radio className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold">1. Meta Messenger Webhook Configuration</h2>
                <p className="text-xs text-blue-100">
                  Required credentials for Meta App Dashboard &gt; Messenger &gt; Webhooks
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleTestWebhook}
                disabled={testingWebhook}
                className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-medium border border-white/20 transition-all flex items-center gap-1.5"
              >
                <Activity className={`w-3.5 h-3.5 ${testingWebhook ? 'animate-spin' : ''}`} />
                <span>{testingWebhook ? 'Testing...' : 'Test Verification'}</span>
              </button>
            </div>
          </div>

          <div className="p-6 space-y-6">
            
            {/* Live Status Indicators */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 text-xs">
              <div className="flex items-center gap-2.5">
                <div className={`w-2.5 h-2.5 rounded-full ${settings.last_webhook_verified_at ? 'bg-emerald-500' : 'bg-amber-400 animate-pulse'}`} />
                <span className="text-slate-600 font-medium">Meta Verification:</span>
                <span className="font-semibold text-slate-800">
                  {settings.last_webhook_verified_at 
                    ? `Verified (${new Date(settings.last_webhook_verified_at).toLocaleDateString()} ${new Date(settings.last_webhook_verified_at).toLocaleTimeString()})`
                    : 'Pending Meta verification'}
                </span>
              </div>

              <div className="flex items-center gap-2.5">
                <div className={`w-2.5 h-2.5 rounded-full ${settings.last_webhook_event_at ? 'bg-blue-500' : 'bg-slate-300'}`} />
                <span className="text-slate-600 font-medium">Last Chat Event:</span>
                <span className="font-semibold text-slate-800">
                  {settings.last_webhook_event_at 
                    ? new Date(settings.last_webhook_event_at).toLocaleTimeString() 
                    : 'No incoming events yet'}
                </span>
              </div>
            </div>

            {/* Test Result Toast/Banner */}
            {testResult && (
              <div className={`p-4 rounded-xl border text-xs flex items-start gap-3 ${
                testResult.status === 'PASS' 
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}>
                {testResult.status === 'PASS' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="font-bold text-sm">
                    {testResult.status === 'PASS' ? 'Webhook Endpoint Self-Test PASSED' : 'Webhook Self-Test FAILED'}
                  </div>
                  <p className="mt-0.5">{testResult.message}</p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Tested against token: <code className="font-mono bg-white/70 px-1 py-0.5 rounded">{settings.fb_verify_token}</code>
                  </p>
                </div>
              </div>
            )}

            {/* The Two Main Fields */}
            <div className="grid grid-cols-1 gap-6">
              
              {/* Field 1: Callback URL */}
              <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                  <label className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                    <Globe className="w-4 h-4 text-blue-600" />
                    <span>Callback URL</span>
                    <span className="text-red-500">*</span>
                  </label>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setCustomUrlMode(!customUrlMode)}
                      className="text-[11px] text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                    >
                      <SlidersHorizontal className="w-3 h-3" />
                      <span>{customUrlMode ? 'Switch to Auto Host' : 'Set Custom Tunnel/Domain URL'}</span>
                    </button>
                  </div>
                </div>

                {/* Custom URL Input (if custom mode enabled) */}
                {customUrlMode && (
                  <div className="mb-3">
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Custom Public Base Domain or Tunnel URL (e.g. ngrok / Cloudflare / Production)
                    </label>
                    <input
                      type="text"
                      placeholder="https://your-tunnel.ngrok-free.app"
                      value={settings.webhook_callback_url || ''}
                      onChange={(e) => setSettings({ ...settings, webhook_callback_url: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-blue-300 rounded-lg text-xs font-mono text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}

                {/* Final Computed Callback URL Box */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      readOnly
                      value={effectiveCallbackUrl}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-mono text-slate-900 font-semibold shadow-inner outline-none select-all"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopy(effectiveCallbackUrl, 'callback_url')}
                    className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5 shrink-0"
                  >
                    {copiedKey === 'callback_url' ? (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>Copy URL</span>
                      </>
                    )}
                  </button>
                </div>

                {/* URL Status / Warning helper */}
                <div className="mt-2.5">
                  {isLocalhost ? (
                    <div className="flex items-start gap-2 p-2.5 bg-amber-50 rounded-lg border border-amber-200 text-amber-800 text-[11px]">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <strong>Notice for local development:</strong> Meta cannot connect to <code className="font-mono bg-amber-100 px-1 py-0.5 rounded">localhost</code>.
                        To test from your Mac, run <code className="font-mono bg-amber-100 px-1 py-0.5 rounded">npx ngrok http 3001</code> in a terminal, click <strong>"Set Custom Tunnel/Domain URL"</strong> above, and paste your ngrok HTTPS URL.
                      </div>
                    </div>
                  ) : isHttps ? (
                    <div className="flex items-center gap-1.5 text-emerald-700 text-[11px] font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Valid public HTTPS URL ready for Meta Messenger Webhook registration.</span>
                    </div>
                  ) : (
                    <div className="text-amber-700 text-[11px]">
                      Meta requires an <code>https://</code> URL. Ensure SSL is enabled.
                    </div>
                  )}
                </div>
              </div>

              {/* Field 2: Verify Token */}
              <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                    <KeyRound className="w-4 h-4 text-indigo-600" />
                    <span>Verify Token</span>
                    <span className="text-red-500">*</span>
                  </label>

                  <button
                    type="button"
                    onClick={generateRandomToken}
                    className="text-[11px] text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Generate New Secret</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={settings.fb_verify_token}
                    onChange={(e) => setSettings({ ...settings, fb_verify_token: e.target.value })}
                    placeholder="Enter custom verify secret token..."
                    className="flex-1 px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-mono text-slate-900 font-semibold shadow-inner outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => handleCopy(settings.fb_verify_token, 'verify_token')}
                    className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5 shrink-0"
                  >
                    {copiedKey === 'verify_token' ? (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>Copy Token</span>
                      </>
                    )}
                  </button>
                </div>

                <p className="text-[11px] text-slate-500 mt-2">
                  This secret string validates that incoming Meta webhook verification challenges originated from your specific configuration. Both this field and the <strong>Verify token</strong> field in Meta must match exactly.
                </p>
              </div>

            </div>

            {/* Quick Helper: Meta Modal Cheatsheet */}
            <div className="p-4 bg-blue-50/60 rounded-xl border border-blue-200/70 text-xs text-slate-700">
              <h4 className="font-bold text-blue-900 mb-1.5 flex items-center gap-1.5">
                <HelpCircle className="w-4 h-4 text-blue-600" />
                <span>How to Complete in Meta App Dashboard:</span>
              </h4>
              <ol className="list-decimal list-inside space-y-1 text-slate-600 text-[12px] leading-relaxed">
                <li>Go to <strong>developers.facebook.com</strong> &gt; Your App &gt; <strong>Messenger</strong> &gt; <strong>Webhooks</strong>.</li>
                <li>Click <strong>Configure / Edit Callback URL</strong>.</li>
                <li>Paste the <strong>Callback URL</strong> copied from above.</li>
                <li>Paste the <strong>Verify token</strong> copied from above.</li>
                <li>Click <strong>"Verify and save"</strong> (Meta will immediately send a verification ping).</li>
                <li>Under <strong>Edit Page Subscriptions</strong> for your page, check <strong>messages</strong> and <strong>messaging_postbacks</strong>.</li>
              </ol>
            </div>

          </div>
        </div>

        {/* Live Raw Webhook Logs Viewer */}
        <WebhookLogsViewer />

        {/* ======================================================== */}
        {/* SECTION 2: FACEBOOK PAGE CREDENTIALS */}
        {/* ======================================================== */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center gap-2 pb-4 border-b border-slate-100">
            <div className="p-2 rounded-xl bg-slate-100 text-slate-700">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">2. Facebook Page API Access</h2>
              <p className="text-xs text-slate-500">
                Credentials used by the Send API to reply to customers and dispatch product cards.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-5">
            {/* Page Access Token */}
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1.5">
                Facebook Page Access Token (PAT) *
              </label>
              <input
                type="password"
                placeholder="EAA..."
                value={settings.fb_page_access_token}
                onChange={(e) => setSettings({ ...settings, fb_page_access_token: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono text-slate-700 outline-none focus:ring-2 focus:ring-brand-500"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Generated from Meta App Dashboard &gt; Messenger &gt; API Setup &gt; Generate Token for your Page.
              </p>
            </div>

            {/* Page ID */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1.5">
                Facebook Page ID
              </label>
              <input
                type="text"
                placeholder="e.g. 104217771726746"
                value={settings.fb_page_id}
                onChange={(e) => setSettings({ ...settings, fb_page_id: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono outline-none focus:ring-2 focus:ring-brand-500"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                MsMorningstar Gold Jewelry Page ID: <code className="font-mono bg-slate-100 px-1 py-0.5 rounded">104217771726746</code>
              </p>
            </div>

            {/* App Secret */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1.5">
                Facebook App Secret (Optional)
              </label>
              <input
                type="password"
                placeholder="App Secret from Basic Settings"
                value={settings.fb_app_secret}
                onChange={(e) => setSettings({ ...settings, fb_app_secret: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono outline-none focus:ring-2 focus:ring-brand-500"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Used to verify X-Hub-Signature-256 for maximum security.
              </p>
            </div>

            {/* Main PHP Website URL */}
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1.5">
                Main Store Website Domain
              </label>
              <input
                type="url"
                placeholder="https://www.missmorningstar.com"
                value={settings.store_url}
                onChange={(e) => setSettings({ ...settings, store_url: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* SECTION 3: GOOGLE GEMINI AI CONFIGURATION */}
        {/* ======================================================== */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center gap-2 pb-4 border-b border-slate-100">
            <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">3. Google Gemini API Configuration</h2>
              <p className="text-xs text-slate-500">
                Powers conversational intelligence and automatically weaves products from the active basket into answers.
              </p>
            </div>
          </div>

          <div className="space-y-4 mt-5">
            {/* Gemini API Key */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1.5 flex items-center justify-between">
                <span>Google Gemini API Key *</span>
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-purple-600 hover:underline flex items-center gap-1 font-normal"
                >
                  <span>Get API Key on Google AI Studio</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </label>
              <input
                type="password"
                placeholder="AIzaSy..."
                value={settings.gemini_api_key}
                onChange={(e) => setSettings({ ...settings, gemini_api_key: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono text-slate-700 outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Model Choice */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1.5">
                  Gemini Model
                </label>
                <select
                  value={settings.gemini_model}
                  onChange={(e) => setSettings({ ...settings, gemini_model: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="gemini-2.5-flash">Gemini 2.5 Flash (Fast, low-cost, recommended for Messenger)</option>
                  <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                  <option value="gemini-2.5-pro">Gemini 2.5 Pro (Deep reasoning)</option>
                </select>
              </div>

              {/* Global AI Toggle */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1.5">
                  Global AI Auto-Reply
                </label>
                <div className="flex items-center gap-3 pt-1">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.ai_auto_reply === '1'}
                      onChange={(e) => setSettings({ ...settings, ai_auto_reply: e.target.checked ? '1' : '0' })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                  </label>
                  <span className="text-xs text-slate-600 font-medium">
                    {settings.ai_auto_reply === '1' ? 'Enabled (AI answers automatically)' : 'Disabled (Human replies only)'}
                  </span>
                </div>
              </div>
            </div>

            {/* System Prompt Customizer */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1.5">
                Bot Persona &amp; Sales Instructions
              </label>
              <textarea
                rows={4}
                value={settings.system_prompt}
                onChange={(e) => setSettings({ ...settings, system_prompt: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Describe how your chatbot should talk to customers..."
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Notice: The products and direct links from your currently active basket set are automatically injected into this prompt during conversation.
              </p>
            </div>
          </div>
        </div>

        {/* Save Bar */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-semibold text-xs rounded-xl shadow-md shadow-brand-500/20 transition-all flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving...' : 'Save All Settings'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
