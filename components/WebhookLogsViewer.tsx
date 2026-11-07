'use client';

import { useState, useEffect } from 'react';
import { 
  FileText, 
  RefreshCw, 
  Trash2, 
  Copy, 
  Check, 
  ChevronDown, 
  ChevronRight, 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  Code2, 
  Layers,
  Sparkles
} from 'lucide-react';

interface WebhookLog {
  id: number;
  method: string;
  source: string;
  headers: string | null;
  query_params: string | null;
  raw_payload: string | null;
  status: string;
  error_message: string | null;
  created_at: string;
}

export default function WebhookLogsViewer() {
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [clearing, setClearing] = useState(false);

  const fetchLogs = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch('/api/webhook/logs?limit=50');
      const data = await res.json();
      if (data.success) {
        setLogs(data.logs || []);
        setTotal(data.total || 0);
        // Automatically expand the first log if none expanded
        if (expandedId === null && data.logs?.length > 0) {
          setExpandedId(data.logs[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load webhook logs:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  // Auto-refresh interval
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchLogs(true);
    }, 4000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const handleClear = async () => {
    if (!confirm('Are you sure you want to clear all raw webhook logs?')) return;
    setClearing(true);
    try {
      const res = await fetch('/api/webhook/logs', { method: 'DELETE' });
      if (res.ok) {
        setLogs([]);
        setTotal(0);
        setExpandedId(null);
      }
    } catch (err) {
      console.error('Failed to clear logs:', err);
    } finally {
      setClearing(false);
    }
  };

  const handleCopy = (text: string, id: number) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatJson = (str: string | null) => {
    if (!str) return 'null';
    try {
      const parsed = JSON.parse(str);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return str;
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-violet-50 text-violet-600">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900">
                Raw Facebook Webhook Ingestion Logs
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-200 text-slate-700">
                {total} total
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Captures every inbound byte (GET challenges &amp; POST event payloads) verbatim from Meta.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer select-none px-2 py-1 bg-white border border-slate-200 rounded-lg">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded text-brand-600 focus:ring-brand-500 w-3.5 h-3.5"
            />
            <span>Auto-poll (4s)</span>
          </label>

          <button
            type="button"
            onClick={() => fetchLogs()}
            disabled={loading}
            className="p-1.5 border border-slate-200 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors"
            title="Refresh logs"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-brand-600' : ''}`} />
          </button>

          {logs.length > 0 && (
            <button
              type="button"
              onClick={handleClear}
              disabled={clearing}
              className="p-1.5 border border-rose-200 hover:bg-rose-50 rounded-lg text-rose-600 transition-colors"
              title="Clear all logs"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Logs List */}
      {logs.length === 0 ? (
        <div className="p-12 text-center text-slate-400">
          <Code2 className="w-10 h-10 mx-auto text-slate-300 mb-3" />
          <p className="text-sm font-medium text-slate-600">No webhook events logged yet</p>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
            When Facebook pings your endpoint (verification or incoming message), the entire raw payload will be preserved and displayed here.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
          {logs.map((log) => {
            const isExpanded = expandedId === log.id;
            const isGet = log.method === 'GET';
            const isSuccess = log.status === 'VERIFICATION_SUCCESS' || log.status === 'PROCESSED';

            return (
              <div key={log.id} className="transition-colors hover:bg-slate-50/50">
                {/* Summary Row */}
                <div 
                  onClick={() => setExpandedId(isExpanded ? null : log.id)}
                  className="px-6 py-3.5 flex items-center justify-between cursor-pointer select-none gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <button className="text-slate-400 hover:text-slate-600">
                      {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>

                    {/* Method Badge */}
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider font-mono ${
                      isGet ? 'bg-purple-100 text-purple-800' : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {log.method}
                    </span>

                    {/* Status Badge */}
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      isSuccess 
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                        : log.status === 'VERIFICATION_FAILED' || log.status === 'ERROR' || log.status === 'PARSE_ERROR'
                        ? 'bg-rose-50 text-rose-700 border border-rose-200'
                        : 'bg-slate-100 text-slate-700'
                    }`}>
                      {log.status}
                    </span>

                    {/* Quick Preview Text */}
                    <span className="text-xs text-slate-600 truncate font-mono hidden sm:inline">
                      {log.raw_payload ? log.raw_payload.substring(0, 70) + (log.raw_payload.length > 70 ? '...' : '') : log.query_params}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 text-[11px] text-slate-400">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{new Date(log.created_at).toLocaleTimeString()}</span>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="px-6 pb-4 pt-1 bg-slate-900 text-slate-200 text-xs font-mono rounded-b-lg mx-4 mb-3 border border-slate-800">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-800 mb-3 text-slate-400">
                      <span>Log ID #{log.id} • Method: {log.method} • {new Date(log.created_at).toLocaleString()}</span>
                      
                      <button
                        type="button"
                        onClick={() => handleCopy(log.raw_payload || log.query_params || '', log.id)}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[11px] flex items-center gap-1 transition-colors"
                      >
                        {copiedId === log.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedId === log.id ? 'Copied' : 'Copy Raw Data'}</span>
                      </button>
                    </div>

                    {/* Raw Payload Block */}
                    {log.raw_payload && (
                      <div className="mb-3">
                        <div className="text-[11px] text-emerald-400 font-semibold mb-1">RAW BODY PAYLOAD:</div>
                        <pre className="bg-black/60 p-3 rounded-lg overflow-x-auto text-[11px] leading-relaxed text-emerald-300 max-h-64 whitespace-pre-wrap">
                          {formatJson(log.raw_payload)}
                        </pre>
                      </div>
                    )}

                    {/* Query Params (for GET) */}
                    {log.query_params && (
                      <div className="mb-3">
                        <div className="text-[11px] text-purple-400 font-semibold mb-1">QUERY PARAMETERS:</div>
                        <pre className="bg-black/60 p-2.5 rounded-lg overflow-x-auto text-[11px] text-purple-300 whitespace-pre-wrap">
                          {formatJson(log.query_params)}
                        </pre>
                      </div>
                    )}

                    {/* Headers Block */}
                    {log.headers && (
                      <div className="mb-2">
                        <div className="text-[11px] text-slate-400 font-semibold mb-1">HTTP HEADERS:</div>
                        <pre className="bg-black/60 p-2.5 rounded-lg overflow-x-auto text-[11px] text-slate-300 max-h-36 whitespace-pre-wrap">
                          {formatJson(log.headers)}
                        </pre>
                      </div>
                    )}

                    {/* Error Message if any */}
                    {log.error_message && (
                      <div className="mt-2 p-2 bg-rose-950/60 border border-rose-800/80 rounded text-rose-300 text-[11px]">
                        <strong>Error:</strong> {log.error_message}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

