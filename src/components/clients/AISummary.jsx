import { useEffect, useState } from 'react';

// Coach-facing AI summary card. Two modes:
//   - Weekly: friendly + motivational, client-tone, ~4-6 sentences
//   - Monthly: data-heavy report with tonnage/calories/wins/areas to focus
// Both produce text the coach can edit, then send to the client via mailto.
//
// Voice: defaults to Glen, but if the coach who owns this client has a
// chatbot_config set in bsa-coach-platform (via /chatbot-voice page),
// we fetch it and pass it as coach_config context so the bot speaks in
// THEIR voice with THEIR business link / sign-off.

const CHAT_API_BASE =
  (typeof window !== 'undefined' && window.tdConfig?.chatApiBase) ||
  'https://chat.bestrongagain.com';

const PLATFORM_API_BASE =
  (typeof window !== 'undefined' && window.tdConfig?.apiBase) ||
  'https://app.bestrongagain.com/api';

function compactWorkouts(recent, days) {
  if (!Array.isArray(recent) || !recent.length) return [];
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return recent
    .filter((w) => {
      const t = w.logged_at ? new Date(w.logged_at).getTime() : null;
      return t && t >= cutoff;
    })
    .map((w) => {
      const stats = w.volume_stats || {};
      return {
        date:     w.logged_at?.slice(0, 10),
        day:      w.day_label || `Week ${w.week} Day ${w.day}`,
        tonnage:  stats.tonnage,
        calories: stats.est_calories,
        cardio_min: stats.cardio_minutes,
        notes:    (w.chatbot_data?.messages?.length
                    ? w.chatbot_data.messages.map((m) => m.text).filter(Boolean).slice(-2).join(' / ')
                    : null)
      };
    })
    .slice(0, days === 7 ? 8 : 25);
}

function buildPrompt(period, data, voice) {
  const header = `You are ${voice} writing a ${period} progress message for ${data.name}.`;

  const factBlock =
    `Program: ${data.program || '(no program loaded)'}\n` +
    `Current week: ${data.current_week ?? '?'}\n` +
    `Workouts completed: ${data.workouts_logged ?? 0}${data.expected_workouts ? ' of ' + data.expected_workouts + ' expected' : ''}\n` +
    `Completion rate: ${data.completion_pct ?? 0}%\n` +
    (data.total_tonnage    ? `Total tonnage: ${data.total_tonnage.toLocaleString()} lbs\n` : '') +
    (data.total_calories   ? `Total calories burned: ${data.total_calories.toLocaleString()}\n` : '') +
    (data.cardio_minutes   ? `Cardio minutes: ${data.cardio_minutes}\n` : '');

  const sessionLines = (data.sessions || [])
    .map((s) => {
      const bits = [];
      if (s.tonnage)    bits.push(`${Math.round(s.tonnage).toLocaleString()} lbs tonnage`);
      if (s.calories)   bits.push(`${Math.round(s.calories)} cal`);
      if (s.cardio_min) bits.push(`${s.cardio_min} min cardio`);
      const notes = s.notes ? `  notes: "${s.notes}"` : '';
      return `  ${s.date} (${s.day}): ${bits.join(', ') || 'logged'}${notes}`;
    }).join('\n') || '  (no sessions in this window)';

  if (period === 'weekly') {
    return [
      header,
      '',
      'CONTEXT (last 7 days):',
      factBlock + '\nSessions:\n' + sessionLines,
      '',
      'TASK:',
      `Write a 4-6 sentence weekly check-in to the client. Warm, direct, motivational. Call out a specific win from the data, point to ONE thing to focus on next week, end with energy. No corporate fluff, no bullet lists, no headings. Address the client by their first name. Sign off as the coach on a new line.`,
      'Output ONLY the email body. No subject line. No preamble.'
    ].join('\n');
  }

  // monthly
  return [
    header,
    '',
    'CONTEXT (last 30 days):',
    factBlock + '\nSessions:\n' + sessionLines,
    '',
    'TASK:',
    "Write a monthly progress report for the client. Include:",
    "  1. A short opening paragraph (2-3 sentences) framing the month and any pattern you see.",
    "  2. A 'BY THE NUMBERS' section with each metric on its own line: tonnage, calories burned, workouts completed, cardio minutes, completion %.",
    "  3. A 'WINS' paragraph naming the most notable progress this month.",
    "  4. A 'FOCUS NEXT MONTH' paragraph pointing to 2-3 things to dial in.",
    "  5. Sign off as the coach on a new line.",
    "More clinical than the weekly version — the numbers should be visible. Address the client by first name. Output ONLY the email body."
  ].join('\n');
}

export default function AISummary({ client, details }) {
  const [period, setPeriod]   = useState(null);   // null | 'weekly' | 'monthly'
  const [busy, setBusy]       = useState(false);
  const [error, setError]     = useState(null);
  const [summary, setSummary] = useState('');
  const [coachConfig, setCoachConfig] = useState(null);

  const firstName = (client?.user_name || '').split(' ')[0] || 'Athlete';

  // If we know which coach owns this client, fetch their chatbot voice config
  // so the summary speaks in their voice. Public read endpoint — safe to call
  // from any origin.
  const coachId =
    client?.referred_by_id ||
    client?.coach_id ||
    (typeof window !== 'undefined' && window.tdConfig?.coachId) ||
    null;

  useEffect(() => {
    if (!coachId) { setCoachConfig(null); return; }
    let cancelled = false;
    fetch(`${PLATFORM_API_BASE}/coaches/chatbot-config/${coachId}`, { credentials: 'omit' })
      .then((r) => r.ok ? r.json() : null)
      .then((c) => { if (!cancelled) setCoachConfig(c || null); })
      .catch(() => { if (!cancelled) setCoachConfig(null); });
    return () => { cancelled = true; };
  }, [coachId]);

  const voiceName = coachConfig?.coach_voice_name || 'Coach Glen';

  async function generate(p) {
    setPeriod(p);
    setBusy(true);
    setError(null);
    setSummary('');

    const days = p === 'weekly' ? 7 : 30;
    const data = {
      name: client?.user_name || client?.user_email || 'Athlete',
      program: client?.program_name,
      current_week: client?.current_week,
      completion_pct: Math.min(Math.round(details?.completion_rate || 0), 100),
      workouts_logged: details?.total_logged || 0,
      expected_workouts: details?.expected_workouts || 0,
      total_tonnage: details?.total_volume_stats?.tonnage,
      total_calories: details?.total_volume_stats?.est_calories,
      cardio_minutes: details?.total_volume_stats?.cardio_minutes,
      sessions: compactWorkouts(details?.recent_workouts, days)
    };

    try {
      const res = await fetch(`${CHAT_API_BASE}/api/embed-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: buildPrompt(p, data, voiceName),
          context: {
            source: 'trainer_dashboard',
            user_first_name: firstName,
            coach_config: coachConfig || undefined
          }
        })
      });
      if (!res.ok) {
        const t = await res.text().catch(() => '');
        throw new Error(t || `${res.status} ${res.statusText}`);
      }
      const json = await res.json();
      setSummary(json.response || '(no response)');
    } catch (e) {
      setError(e.message || 'Could not generate summary.');
    } finally {
      setBusy(false);
    }
  }

  function emailToClient() {
    if (!client?.user_email || !summary) return;
    const subject = period === 'weekly'
      ? `Your weekly check-in — ${client?.program_name || 'Training'}`
      : `Your monthly progress report — ${client?.program_name || 'Training'}`;
    const url = `mailto:${encodeURIComponent(client.user_email)}` +
      `?subject=${encodeURIComponent(subject)}` +
      `&body=${encodeURIComponent(summary)}`;
    window.location.href = url;
  }

  function copyToClipboard() {
    if (!summary) return;
    navigator.clipboard?.writeText(summary).catch(() => {});
  }

  return (
    <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl border border-amber-200 p-5 lg:col-span-2">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div>
          <h4 className="text-sm font-semibold text-gray-700">AI Coach Summary</h4>
          <p className="text-xs text-gray-500">Generate, edit, and email to {firstName}.</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        <button
          onClick={() => generate('weekly')}
          disabled={busy}
          className={`flex-1 min-w-[140px] px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
            period === 'weekly'
              ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white'
              : 'bg-white border border-amber-300 text-amber-700 hover:bg-amber-50'
          } ${busy ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {busy && period === 'weekly' ? 'Writing…' : '📝 Weekly Summary'}
        </button>
        <button
          onClick={() => generate('monthly')}
          disabled={busy}
          className={`flex-1 min-w-[140px] px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
            period === 'monthly'
              ? 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white'
              : 'bg-white border border-purple-300 text-purple-700 hover:bg-purple-50'
          } ${busy ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {busy && period === 'monthly' ? 'Writing…' : '📊 Monthly Report'}
        </button>
      </div>

      {error && (
        <div className="mb-3 p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
          {error}
        </div>
      )}

      {(busy || summary) && (
        <>
          <textarea
            value={busy ? 'Coach Glen is writing…' : summary}
            onChange={(e) => setSummary(e.target.value)}
            disabled={busy}
            rows={10}
            className="w-full px-3 py-2.5 rounded-lg border border-gray-300 bg-white text-sm text-gray-800 leading-relaxed font-sans resize-y focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
          {!busy && summary && (
            <div className="flex flex-wrap gap-2 mt-3">
              <button
                onClick={emailToClient}
                disabled={!client?.user_email}
                className="flex-1 min-w-[140px] px-4 py-2.5 rounded-lg bg-gradient-to-r from-[#667eea] to-[#764ba2] text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                📧 Email to {firstName}
              </button>
              <button
                onClick={copyToClipboard}
                className="px-4 py-2.5 rounded-lg bg-white border border-gray-300 text-gray-700 text-sm font-semibold hover:bg-gray-50"
              >
                Copy
              </button>
              <button
                onClick={() => generate(period)}
                className="px-4 py-2.5 rounded-lg bg-white border border-amber-300 text-amber-700 text-sm font-semibold hover:bg-amber-50"
              >
                Regenerate
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
