// Pure computations over the existing /get-client-details.php payload + the
// client list payload. No backend changes required — all of this is derived
// client-side so the trainer can see signal at a glance.

const DAY_MS = 86400000;

export function daysSince(dateStr) {
  if (!dateStr) return null;
  const t = new Date(dateStr).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.floor((Date.now() - t) / DAY_MS);
}

// Bucket a client into one of the triage filter chips.
// Order of checks matters — first match wins.
// "Not started" runs FIRST so a 0-logs user doesn't get tagged as "New" —
// "New" is for people getting started (1-2 logs in week 1); "Not Started"
// is for people who never tapped in despite being assigned a program.
export function triageBucket(client) {
  if (!client) return 'active';
  const d = daysSince(client.last_logged_date || client.last_workout || client.lastWorkout);
  // user_workout_count is the sum across ALL programs (attached during
  // grouping). Falls back to the primary program's total_workouts for
  // any caller that hasn't grouped yet.
  const userLogs = Number(client.user_workout_count ?? client.total_workouts) || 0;
  const totalWorkouts = Number(client.total_workouts) || 0;
  const currentWeek = Number(client.current_week) || 0;

  if (userLogs === 0 && d == null) return 'not_started';
  if (currentWeek <= 1 && totalWorkouts < 3) return 'new';
  if (d == null || d >= 7) return 'check_in';
  if (d >= 3) return 'quiet';
  return 'active';
}

export const TRIAGE_LABELS = {
  all:         { label: 'All',             color: 'gray'   },
  not_started: { label: 'Not Started',     color: 'orange' },
  check_in:    { label: 'Needs Check-In',  color: 'red'    },
  quiet:       { label: 'Quiet',           color: 'amber'  },
  active:      { label: 'Active',          color: 'green'  },
  new:         { label: 'New',             color: 'blue'   },
};

export function triageCounts(clients) {
  const counts = { all: clients.length, not_started: 0, check_in: 0, quiet: 0, active: 0, new: 0 };
  for (const c of clients) counts[triageBucket(c)]++;
  return counts;
}

// --- weekly rollups ---------------------------------------------------------

// Sessions logged in the last 7 days, from get-client-details.recent_workouts.
export function thisWeekRollup(recentWorkouts) {
  const cutoff = Date.now() - 7 * DAY_MS;
  const sessions = [];
  let tonnage = 0, calories = 0, cardio = 0;
  for (const w of recentWorkouts || []) {
    const t = new Date(w.workout_date || w.logged_at || 0).getTime();
    if (!Number.isFinite(t) || t < cutoff) continue;
    sessions.push(w);
    const vs = w.parsed_data?.volume_stats || w.volume_stats || {};
    tonnage  += vs.tonnage || 0;
    calories += vs.est_calories || 0;
    cardio   += vs.cardio_minutes || 0;
  }
  return { sessions: sessions.length, tonnage, calories, cardio };
}

// Tonnage / calories THIS week vs prior week, from weekly_volume_stats[].
// Shape assumed: [{ week_number, tonnage, est_calories, cardio_minutes }, ...].
// If missing, returns nulls and callers should hide trend chips.
export function weekTrend(weeklyVolumeStats) {
  const stats = Array.isArray(weeklyVolumeStats) ? [...weeklyVolumeStats] : [];
  if (stats.length < 1) return { current: null, previous: null };
  stats.sort((a, b) => (a.week_number || 0) - (b.week_number || 0));
  const current  = stats[stats.length - 1] || null;
  const previous = stats[stats.length - 2] || null;
  return { current, previous };
}

function pctDelta(current, previous) {
  if (!previous) return null;
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

export function trendBadge(metric, weekly) {
  const cur = weekly.current?.[metric];
  const prev = weekly.previous?.[metric];
  if (cur == null && prev == null) return null;
  return { current: cur || 0, previous: prev || 0, deltaPct: pctDelta(cur || 0, prev || 0) };
}

// --- PRs and progression ----------------------------------------------------

// Walk every set of every exercise across recent_workouts. For each exercise
// name, track the heaviest single set (by weight). If the most recent
// occurrence equals that max AND beats any prior occurrence, flag as a new PR.
//
// Returns array sorted by date desc, limited to `limit` PRs.
export function computePRs(recentWorkouts, limit = 5) {
  const byName = new Map();

  const visit = (workout) => {
    const date = workout.workout_date || workout.logged_at;
    const t = new Date(date || 0).getTime();
    const blocks = workout.parsed_data?.blocks || [];
    for (const block of blocks) {
      if (!['straight-set', 'superset', 'triset'].includes(block.type)) continue;
      for (const ex of (block.exercises || [])) {
        if (!ex.name) continue;
        const weights = Array.isArray(ex.weights) ? ex.weights : (ex.weight != null ? [ex.weight] : []);
        const reps    = Array.isArray(ex.actualReps) ? ex.actualReps : (ex.actualReps != null ? [ex.actualReps] : []);
        let heaviest = 0, heaviestReps = 0;
        weights.forEach((w, i) => {
          const wv = Number(w);
          if (!Number.isFinite(wv) || wv <= 0) return;
          if (wv > heaviest) {
            heaviest = wv;
            heaviestReps = Number(reps[i]) || Number(ex.reps) || 0;
          }
        });
        if (heaviest === 0) continue;

        const prior = byName.get(ex.name);
        if (!prior || heaviest > prior.bestWeight) {
          byName.set(ex.name, {
            name: ex.name,
            bestWeight: heaviest,
            bestReps: heaviestReps,
            bestDate: t,
            occurrences: (prior?.occurrences || 0) + 1,
            priorBest: prior?.bestWeight || 0,
          });
        } else {
          byName.set(ex.name, {
            ...prior,
            occurrences: prior.occurrences + 1,
          });
        }
      }
    }
  };

  // Walk oldest-first so priorBest tracks correctly.
  [...(recentWorkouts || [])]
    .sort((a, b) => new Date(a.workout_date || a.logged_at || 0) - new Date(b.workout_date || b.logged_at || 0))
    .forEach(visit);

  return [...byName.values()]
    .filter((r) => r.priorBest > 0 && r.bestWeight > r.priorBest) // only real PRs (had to beat a prior)
    .sort((a, b) => b.bestDate - a.bestDate)
    .slice(0, limit)
    .map((r) => ({
      name: r.name,
      weight: r.bestWeight,
      reps: r.bestReps,
      date: r.bestDate ? new Date(r.bestDate).toISOString() : null,
      gainLbs: r.bestWeight - r.priorBest,
    }));
}

// For exercises seen 2+ times, return the top-weight progression from first
// to most-recent occurrence. Filters to interesting deltas only (gain >= 5 lbs).
export function progressionTrends(recentWorkouts, limit = 4) {
  const byName = new Map();

  const all = [...(recentWorkouts || [])].sort(
    (a, b) => new Date(a.workout_date || a.logged_at || 0) - new Date(b.workout_date || b.logged_at || 0),
  );
  for (const workout of all) {
    const date = workout.workout_date || workout.logged_at;
    const blocks = workout.parsed_data?.blocks || [];
    for (const block of blocks) {
      if (!['straight-set', 'superset', 'triset'].includes(block.type)) continue;
      for (const ex of (block.exercises || [])) {
        if (!ex.name) continue;
        const weights = Array.isArray(ex.weights) ? ex.weights : (ex.weight != null ? [ex.weight] : []);
        let top = 0;
        for (const w of weights) {
          const wv = Number(w);
          if (Number.isFinite(wv) && wv > top) top = wv;
        }
        if (top === 0) continue;

        const prior = byName.get(ex.name);
        if (!prior) {
          byName.set(ex.name, { name: ex.name, firstWeight: top, firstDate: date, lastWeight: top, lastDate: date });
        } else {
          prior.lastWeight = top;
          prior.lastDate = date;
        }
      }
    }
  }

  return [...byName.values()]
    .filter((r) => r.lastWeight - r.firstWeight >= 5 && r.firstDate !== r.lastDate)
    .sort((a, b) => (b.lastWeight - b.firstWeight) - (a.lastWeight - a.firstWeight))
    .slice(0, limit)
    .map((r) => ({
      name: r.name,
      fromWeight: r.firstWeight,
      toWeight: r.lastWeight,
      deltaLbs: r.lastWeight - r.firstWeight,
    }));
}

// Consecutive weeks ending at most recent, with workouts_completed >= 1.
export function streakWeeks(weeklyProgress) {
  if (!Array.isArray(weeklyProgress) || !weeklyProgress.length) return 0;
  const sorted = [...weeklyProgress].sort((a, b) => (b.week_number || 0) - (a.week_number || 0));
  let streak = 0;
  for (const w of sorted) {
    if ((w.workouts_completed || 0) >= 1) streak++;
    else break;
  }
  return streak;
}
