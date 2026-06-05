import { useState } from 'react';
import { buildSummaryData, buildPrompt, CHAT_API_BASE, PLATFORM_API_BASE } from './AISummary';

// Bulk weekly summaries: generate a draft for every client in one pass, let the
// coach review/edit/skip, then post all to dashboards (each post also pings the
// member's chat via the backend share-summary). Review-first by design — nothing
// reaches a client until the coach hits "Post".

function coachToken() {
  try {
    const raw = window.localStorage.getItem('bsa_dashboard_auth');
    return raw ? (JSON.parse(raw) || {}).token || '' : '';
  } catch { return ''; }
}

export default function BulkWeeklySummary({ clients, fetchClientDetails, voiceName = 'Coach Glen', onClose }) {
  // rows: [{ client, status: 'pending'|'generating'|'ready'|'error'|'posting'|'posted', draft, include, error }]
  const eligible = (clients || []).filter((c) => c.user_email && c.access_code);
  const [rows, setRows] = useState(() => eligible.map((c) => ({
    client: c, status: 'pending', draft: '', include: true, error: '',
  })));
  const [phase, setPhase] = useState('idle');   // 'idle' | 'generating' | 'review' | 'posting' | 'done'
  const [progress, setProgress] = useState(0);

  const firstName = (c) => (c.user_name || c.user_email || 'Athlete').split(' ')[0];

  async function generateOne(client) {
    const details = await fetchClientDetails(client.access_code, client.user_email);
    const data = buildSummaryData(client, details, 'weekly');
    const res = await fetch(`${CHAT_API_BASE}/api/embed-chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: buildPrompt('weekly', data, voiceName),
        context: { source: 'trainer_dashboard_bulk', user_first_name: firstName(client) },
      }),
    });
    if (!res.ok) throw new Error((await res.text().catch(() => '')) || `${res.status}`);
    const json = await res.json();
    return json.response || '(no response)';
  }

  async function runGenerate() {
    setPhase('generating');
    setProgress(0);
    // Sequential so we don't hammer the AI endpoint; review step makes the wait OK.
    for (let i = 0; i < eligible.length; i++) {
      const client = eligible[i];
      setRows((rs) => rs.map((r) => (r.client === client ? { ...r, status: 'generating' } : r)));
      try {
        const draft = await generateOne(client);
        setRows((rs) => rs.map((r) => (r.client === client ? { ...r, status: 'ready', draft } : r)));
      } catch (e) {
        setRows((rs) => rs.map((r) => (r.client === client ? { ...r, status: 'error', include: false, error: e.message || 'failed' } : r)));
      }
      setProgress(i + 1);
    }
    setPhase('review');
  }

  async function postAll() {
    setPhase('posting');
    const token = coachToken();
    const targets = rows.filter((r) => r.include && r.draft.trim() && r.status !== 'posted');
    for (const r of targets) {
      setRows((rs) => rs.map((x) => (x.client === r.client ? { ...x, status: 'posting' } : x)));
      try {
        const res = await fetch(`${PLATFORM_API_BASE}/coaches/share-summary`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({ client_email: r.client.user_email, period: 'weekly', body: r.draft }),
        });
        if (!res.ok) throw new Error((await res.text().catch(() => '')) || `${res.status}`);
        setRows((rs) => rs.map((x) => (x.client === r.client ? { ...x, status: 'posted' } : x)));
      } catch (e) {
        setRows((rs) => rs.map((x) => (x.client === r.client ? { ...x, status: 'error', error: e.message || 'post failed' } : x)));
      }
    }
    setPhase('done');
  }

  const setDraft = (client, draft) => setRows((rs) => rs.map((r) => (r.client === client ? { ...r, draft } : r)));
  const toggle = (client) => setRows((rs) => rs.map((r) => (r.client === client ? { ...r, include: !r.include } : r)));

  const readyCount   = rows.filter((r) => r.status === 'ready' || r.status === 'posted').length;
  const includeCount = rows.filter((r) => r.include && r.draft.trim() && r.status !== 'posted').length;
  const postedCount  = rows.filter((r) => r.status === 'posted').length;

  return (
    <div className="fixed inset-0 z-[9999] bg-black/60 flex items-start justify-center p-3 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-2xl my-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Weekly summaries — all clients</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {eligible.length} client{eligible.length === 1 ? '' : 's'} in view · review &amp; edit before posting · each post also pings their chat
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">✕</button>
        </div>

        <div className="px-5 py-4">
          {phase === 'idle' && (
            <div className="text-center py-8">
              <p className="text-sm text-gray-600 mb-4">
                Drafts a warm, finish-the-week weekly check-in for each client. Nothing is sent until you review and post.
              </p>
              <button onClick={runGenerate} disabled={!eligible.length}
                className="px-5 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 text-white font-bold disabled:opacity-50">
                Generate {eligible.length} draft{eligible.length === 1 ? '' : 's'}
              </button>
              {!eligible.length && <p className="text-xs text-gray-400 mt-3">No clients with a program + email in the current view.</p>}
            </div>
          )}

          {phase === 'generating' && (
            <div className="py-6">
              <div className="text-sm text-gray-600 mb-2 text-center">Generating {progress} / {eligible.length}…</div>
              <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-500 transition-all" style={{ width: `${(progress / eligible.length) * 100}%` }} />
              </div>
            </div>
          )}

          {(phase === 'review' || phase === 'posting' || phase === 'done') && (
            <>
              <div className="text-xs text-gray-500 mb-3">
                {postedCount > 0 ? `${postedCount} posted · ` : ''}{readyCount} draft{readyCount === 1 ? '' : 's'} ready
              </div>
              <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1">
                {rows.map((r) => (
                  <div key={(r.client.access_code || '') + r.client.user_email}
                    className={`rounded-xl border p-3 ${r.status === 'posted' ? 'border-green-200 bg-green-50' : r.status === 'error' ? 'border-red-200 bg-red-50' : 'border-gray-200'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-semibold text-sm text-gray-800">
                        {r.client.user_name || r.client.user_email}
                        {r.status === 'posted' && <span className="ml-2 text-xs text-green-700 font-bold">✓ posted</span>}
                        {r.status === 'posting' && <span className="ml-2 text-xs text-gray-500">posting…</span>}
                        {r.status === 'error' && <span className="ml-2 text-xs text-red-600">{r.error}</span>}
                      </div>
                      {r.status !== 'posted' && r.status !== 'error' && (
                        <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                          <input type="checkbox" checked={r.include} onChange={() => toggle(r.client)} className="accent-indigo-600" />
                          Include
                        </label>
                      )}
                    </div>
                    {r.status === 'error' && !r.draft ? null : (
                      <textarea
                        value={r.draft}
                        onChange={(e) => setDraft(r.client, e.target.value)}
                        disabled={r.status === 'posted' || r.status === 'posting'}
                        rows={5}
                        className="w-full text-sm border border-gray-200 rounded-lg p-2 disabled:bg-gray-50 disabled:text-gray-500"
                      />
                    )}
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-gray-100">
                <button onClick={onClose} className="px-4 py-2 rounded-lg text-gray-600 font-medium hover:bg-gray-100">
                  {phase === 'done' ? 'Close' : 'Cancel'}
                </button>
                {phase !== 'done' && (
                  <button onClick={postAll} disabled={phase === 'posting' || includeCount === 0}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold disabled:opacity-50">
                    {phase === 'posting' ? 'Posting…' : `Post all (${includeCount})`}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
