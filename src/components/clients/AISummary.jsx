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

// Pull the client's own notes out of a logged workout so the AI can see them.
// Three sources, in priority order:
//   - per-exercise clientNote (what they typed on a specific exercise)
//   - per-block clientNotes (what they typed on a superset / conditioning block)
//   - skipped exercises (completed=false) — listed by name so the AI knows
//     what they swapped or saved for another day
function extractWorkoutNotes(parsedData) {
  if (!parsedData || typeof parsedData !== 'object') return null;
  const blocks = parsedData.blocks || [];
  const pieces = [];
  const skipped = [];

  for (const block of blocks) {
    if (!block || typeof block !== 'object') continue;
    const type = block.type || '';
    if (type === 'theme' || type === 'warmup' || type === 'cooldown' || type === 'mobility') continue;

    if (block.clientNotes) {
      pieces.push(`[${type || 'block'} note] ${block.clientNotes}`);
    }
    for (const ex of (block.exercises || [])) {
      if (!ex || typeof ex !== 'object') continue;
      if (ex.clientNote) {
        pieces.push(`${ex.name || 'exercise'}: ${ex.clientNote}`);
      }
      if (ex.completed === false && ex.name) {
        skipped.push(ex.name);
      }
    }
  }

  if (skipped.length) {
    pieces.push(`Skipped this session: ${skipped.join(', ')}`);
  }

  return pieces.length ? pieces.join(' | ') : null;
}

function compactWorkouts(recent, days) {
  if (!Array.isArray(recent) || !recent.length) return [];
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return recent
    .filter((w) => {
      const raw = w.workout_date || w.workoutDate || w.logged_at;
      const t = raw ? new Date(raw).getTime() : null;
      return t && t >= cutoff;
    })
    .map((w) => {
      const stats = w.parsed_data?.volume_stats || w.volume_stats || {};
      const workoutNotes = extractWorkoutNotes(w.parsed_data);
      const chatbotNotes = w.chatbot_data?.messages?.length
        ? w.chatbot_data.messages.map((m) => m.text).filter(Boolean).slice(-2).join(' / ')
        : null;
      const combined = [workoutNotes, chatbotNotes].filter(Boolean).join(' || ') || null;
      const rawDate = w.workout_date || w.workoutDate || w.logged_at || '';

      return {
        date:     typeof rawDate === 'string' ? rawDate.slice(0, 10) : '',
        day:      w.day_label || `Week ${w.week_number ?? w.week} Day ${w.day_number ?? w.day}`,
        tonnage:  stats.tonnage,
        calories: stats.est_calories,
        cardio_min: stats.cardio_minutes,
        notes:    combined
      };
    })
    .slice(0, days === 7 ? 8 : 25);
}

function buildJourneyBlock(lifetime) {
  if (!lifetime || !lifetime.programs?.length || lifetime.programs.length < 2) return '';
  const progLines = lifetime.programs.map((p) => {
    const tag = p.is_current ? ' [CURRENT]' : '';
    const range = (p.first_logged && p.last_logged)
      ? `${p.first_logged} → ${p.last_logged}`
      : (p.is_current ? 'just assigned — no logs yet' : 'no logs');
    return `  - ${p.name}${tag} — ${p.sessions} session(s), ${range}`;
  }).join('\n');
  return [
    '',
    'TRAINING JOURNEY (every program this client has been on):',
    progLines,
    `\nCross-program totals: ${lifetime.sessions} workouts, ${(lifetime.tonnage || 0).toLocaleString()} lbs tonnage, ${(lifetime.calories || 0).toLocaleString()} calories.`,
    '',
    'HOW TO USE THIS:',
    '  - If the CURRENT program is recently assigned (no logs or only 1–2), this is a transition. Acknowledge what they just finished (the most-recent past program with sessions) and frame what is new about the current one.',
    '  - If past programs ended weeks ago and they\'re mid-stride on the current one, don\'t belabor history — keep the focus on now.',
    '  - The cross-program totals are useful for showing scale across their journey, not for replacing the current-period numbers.',
  ].join('\n');
}

function buildPrompt(period, data, voice) {
  const header = `You are ${voice} writing a ${period} progress message for ${data.name}.`;
  const journeyBlock = buildJourneyBlock(data.lifetime);

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
      journeyBlock,
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
    journeyBlock,
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
  const [coachNotes, setCoachNotes] = useState('');
  const [expanding, setExpanding]   = useState(false);

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
      // Cross-program journey — lets the LLM recognize program transitions
      // and ground the summary in the user's broader training history,
      // not just the current program.
      lifetime: details?.lifetime ? {
        program_count: details.lifetime.program_count,
        sessions:      details.lifetime.sessions,
        tonnage:       details.lifetime.tonnage,
        calories:      details.lifetime.calories,
        cardio_min:    details.lifetime.cardio_min,
        programs:      (details.lifetime.programs || []).map((p) => ({
          name:         p.program_name,
          sessions:     p.sessions,
          first_logged: p.first_logged,
          last_logged:  p.last_logged,
          is_current:   p.is_current,
        })),
      } : null,
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

  // Push the current summary (as edited in the textarea) to the member's
  // dashboard. Coached members see monthly summaries here; Elite members
  // see weekly + monthly. Auth: coach JWT from the existing dashboard login.
  const [sharing, setSharing] = useState(false);
  const [shareMsg, setShareMsg] = useState('');
  async function sendToDashboard() {
    if (!summary || !period || !client?.user_email) return;
    setSharing(true);
    setShareMsg('');
    try {
      let token = '';
      try {
        const raw = window.localStorage.getItem('bsa_dashboard_auth');
        if (raw) token = (JSON.parse(raw) || {}).token || '';
      } catch { /* missing or corrupt — request will 401 below */ }

      const res = await fetch(`${PLATFORM_API_BASE}/coaches/share-summary`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          client_email: client.user_email,
          period,
          body: summary,
        }),
      });
      if (!res.ok) {
        const t = await res.text().catch(() => '');
        throw new Error(t || `${res.status} ${res.statusText}`);
      }
      setShareMsg(`Sent to ${firstName}'s dashboard ✓`);
      setTimeout(() => setShareMsg(''), 4000);
    } catch (e) {
      setShareMsg(`Failed: ${e.message || 'try again'}`);
      setTimeout(() => setShareMsg(''), 5000);
    } finally {
      setSharing(false);
    }
  }

  // Take the current summary + the coach's freeform observations, ask the
  // LLM to rewrite the summary so it incorporates those observations and
  // adds expanded coaching guidance on them. Stays in the same voice and
  // keeps the same tone profile as the original (weekly = warm, monthly =
  // clinical).
  async function expandWithNotes() {
    const notes = coachNotes.trim();
    if (!notes || !summary) return;
    setExpanding(true);
    setError(null);

    const toneRules = period === 'weekly'
      ? 'Stay warm and encouraging. Address the client by their first name. End with energy. Sign off as the coach on a new line.'
      : 'Stay clinical but constructive. Keep the BY THE NUMBERS section if there is one. Address the client by first name. Sign off as the coach on a new line.';

    const prompt = [
      `You are ${voiceName} revising a ${period || 'progress'} message you wrote for ${firstName}.`,
      '',
      'Here is the current draft you wrote:',
      '"""',
      summary,
      '"""',
      '',
      "The coach has added these PERSONAL observations from this week's training that the data alone doesn't capture:",
      '"""',
      notes,
      '"""',
      '',
      'TASK: Rewrite the message so it naturally weaves in the coach\'s observations and provides expanded, specific coaching guidance on them.',
      ' - Reference the observations directly (e.g. nutrition habits, recovery, mindset, life stressors, what was discussed in person) so the client knows the coach has been paying attention to the bigger picture.',
      ' - Give actionable, concrete advice on the observations — not generic platitudes. If they ate garbage on the weekend, say what to swap or how to plan; if they\'re not sleeping enough, name the change.',
      ' - Keep the workout-data parts of the original, but the message can grow longer to accommodate the new content.',
      toneRules,
      '',
      'Output ONLY the new message body. No preamble.',
    ].join('\n');

    try {
      const res = await fetch(`${CHAT_API_BASE}/api/embed-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: prompt,
          context: {
            source: 'trainer_dashboard',
            user_first_name: firstName,
            coach_config: coachConfig || undefined,
          },
        }),
      });
      if (!res.ok) {
        const t = await res.text().catch(() => '');
        throw new Error(t || `${res.status} ${res.statusText}`);
      }
      const json = await res.json();
      setSummary(json.response || summary);
      setCoachNotes('');   // clear the input — observations are now baked in
    } catch (e) {
      setError(e.message || 'Could not expand the summary.');
    } finally {
      setExpanding(false);
    }
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
                onClick={sendToDashboard}
                disabled={sharing || !client?.user_email}
                className="flex-1 min-w-[160px] px-4 py-2.5 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {sharing ? 'Sending…' : '📌 Send to Dashboard'}
              </button>
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
          {shareMsg && (
            <div className={`mt-2 text-xs ${shareMsg.startsWith('Failed') ? 'text-red-600' : 'text-emerald-700'}`}>
              {shareMsg}
            </div>
          )}

          {!busy && summary && (
            <div className="mt-4 p-3 rounded-lg bg-white border border-amber-200">
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Add your own observations to expand the summary
              </label>
              <p className="text-[11px] text-gray-500 mb-2 leading-snug">
                The data only tells part of the story. Drop in anything {firstName} told you, what you saw in person,
                nutrition / sleep / mood / life stuff — Coach Glen rewrites the message to weave it in with concrete advice.
              </p>
              <textarea
                value={coachNotes}
                onChange={(e) => setCoachNotes(e.target.value)}
                disabled={expanding}
                rows={3}
                placeholder={`e.g. "${firstName} says they're eating great M-F but binging junk Sat/Sun and feeling stuck on weight. Sleep has been 5-6 hrs."`}
                className="w-full px-3 py-2 rounded-md border border-gray-300 bg-white text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
              <div className="flex justify-end mt-2">
                <button
                  onClick={expandWithNotes}
                  disabled={expanding || !coachNotes.trim()}
                  className="px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50"
                >
                  {expanding ? 'Expanding…' : '✨ Expand summary with my notes'}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
