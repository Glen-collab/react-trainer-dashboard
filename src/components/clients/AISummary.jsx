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

  const sessionLines = (data.sessions || [])
    .map((s) => {
      const bits = [];
      if (s.tonnage)    bits.push(`${Math.round(s.tonnage).toLocaleString()} lbs tonnage`);
      if (s.calories)   bits.push(`${Math.round(s.calories)} cal`);
      if (s.cardio_min) bits.push(`${s.cardio_min} min cardio`);
      const notes = s.notes ? `  notes: "${s.notes}"` : '';
      return `  ${s.date} (${s.day}): ${bits.join(', ') || 'logged'}${notes}`;
    }).join('\n') || '  (none in this window)';

  if (period === 'weekly') {
    // THIS WEEK ONLY — not cumulative. Weekly is a check-in, not a program recap.
    const thisWeekFacts =
      `Sessions THIS week: ${data.workouts_this_week ?? 0} of ${data.days_per_week ?? '?'} planned\n` +
      (data.tonnage_this_week  ? `Tonnage this week: ${Math.round(data.tonnage_this_week).toLocaleString()} lbs\n` : '') +
      (data.calories_this_week ? `Calories this week: ${Math.round(data.calories_this_week).toLocaleString()}\n` : '') +
      (data.cardio_min_this_week ? `Cardio minutes this week: ${data.cardio_min_this_week}\n` : '') +
      `\nProgram context (background only — do NOT lead with these numbers):\n` +
      `  Program: ${data.program || '(no program)'} · Week ${data.current_week ?? '?'}\n` +
      `  Lifetime: ${data.workouts_logged ?? 0} workouts logged${data.total_tonnage ? `, ${data.total_tonnage.toLocaleString()} lbs tonnage` : ''}\n`;

    return [
      header,
      '',
      'CONTEXT (last 7 days):',
      thisWeekFacts + '\nSessions this week:\n' + sessionLines,
      '',
      'TONE RULES (these override everything else):',
      '  - This is a WEEKLY CHECK-IN, not a performance review. Be warm, encouraging, energizing.',
      '  - ALWAYS lead with what they did right. Even ONE workout this week is a win — name it.',
      '  - NEVER shame, scold, or use words like "miss", "rough", "failure", "big problem", "we need to talk".',
      '  - If they had a low or zero week, frame it as "life happens — let\'s get back at it" with hope and a small concrete next step. NOT discipline.',
      '  - Do NOT cite cumulative/lifetime program completion %. That belongs in the monthly report.',
      '  - Goal: athlete reads it and feels seen + motivated to train tomorrow.',
      '',
      'TASK:',
      'Write a 3-5 sentence weekly check-in. Address the client by first name. End with energy. Sign off as the coach on a new line. Output ONLY the email body.',
    ].join('\n');
  }

  // monthly — clinical, by-the-numbers, full program context
  const monthlyFacts =
    `Program: ${data.program || '(no program loaded)'}\n` +
    `Current week: ${data.current_week ?? '?'}\n` +
    `Workouts completed: ${data.workouts_logged ?? 0}${data.expected_workouts ? ' of ' + data.expected_workouts + ' expected' : ''}\n` +
    `Completion rate: ${data.completion_pct ?? 0}%\n` +
    (data.total_tonnage    ? `Total tonnage: ${data.total_tonnage.toLocaleString()} lbs\n` : '') +
    (data.total_calories   ? `Total calories burned: ${data.total_calories.toLocaleString()}\n` : '') +
    (data.cardio_minutes   ? `Cardio minutes: ${data.cardio_minutes}\n` : '');

  return [
    header,
    '',
    'CONTEXT (last 30 days):',
    monthlyFacts + '\nSessions:\n' + sessionLines,
    '',
    'TASK:',
    "Write a monthly progress report. Include:",
    "  1. Short opening paragraph (2-3 sentences) framing the month and any pattern.",
    "  2. A 'BY THE NUMBERS' section with each metric on its own line: tonnage, calories burned, workouts completed, cardio minutes, completion %.",
    "  3. A 'WINS' paragraph naming notable progress.",
    "  4. A 'FOCUS NEXT MONTH' paragraph with 2-3 things to dial in. Constructive — direction, not discipline.",
    "  5. Sign off as the coach on a new line.",
    "More clinical than the weekly check-in. Numbers should be visible but stay encouraging. Address the client by first name. Output ONLY the email body."
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
    const sessions = compactWorkouts(details?.recent_workouts, days);

    // For weekly, compute this-week-only rollups so the prompt can frame the
    // message as a check-in (not a program audit). 7-day window from today.
    const cutoffMs = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const thisWeekSessions = (details?.recent_workouts || []).filter((w) => {
      const d = new Date(w.workout_date || w.workoutDate || 0).getTime();
      return d >= cutoffMs;
    });
    let weekTonnage = 0, weekCals = 0, weekCardio = 0;
    for (const w of thisWeekSessions) {
      const vs = w.parsed_data?.volume_stats || w.volume_stats || {};
      weekTonnage += vs.tonnage || 0;
      weekCals    += vs.est_calories || 0;
      weekCardio  += vs.cardio_minutes || 0;
    }

    const data = {
      name: client?.user_name || client?.user_email || 'Athlete',
      program: client?.program_name,
      current_week: client?.current_week,
      days_per_week: details?.days_per_week,
      completion_pct: Math.min(Math.round(details?.completion_rate || 0), 100),
      workouts_logged: details?.total_logged || 0,
      expected_workouts: details?.expected_workouts || 0,
      total_tonnage: details?.total_volume_stats?.tonnage,
      total_calories: details?.total_volume_stats?.est_calories,
      cardio_minutes: details?.total_volume_stats?.cardio_minutes,
      // weekly-only rollups
      workouts_this_week: thisWeekSessions.length,
      tonnage_this_week:  weekTonnage,
      calories_this_week: weekCals,
      cardio_min_this_week: weekCardio,
      sessions,
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
