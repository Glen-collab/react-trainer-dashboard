import { useState } from 'react';
import { getBlockTypeName, getBlockIcon, formatDate } from '../../utils/helpers';

export default function RecentWorkouts({ workouts = [] }) {
  // Group by week, most recent first
  const grouped = {};
  workouts.forEach((w) => {
    const wk = w.week_number || 0;
    if (!grouped[wk]) grouped[wk] = [];
    grouped[wk].push(w);
  });
  const weekKeys = Object.keys(grouped)
    .map(Number)
    .sort((a, b) => b - a);

  const [openWeeks, setOpenWeeks] = useState(() => {
    // Default: first (most recent) week open
    return weekKeys.length ? new Set([weekKeys[0]]) : new Set();
  });

  const toggleWeek = (wk) => {
    setOpenWeeks((prev) => {
      const next = new Set(prev);
      next.has(wk) ? next.delete(wk) : next.add(wk);
      return next;
    });
  };

  if (!workouts.length) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">
          Recent Workouts
        </h3>
        <p className="text-gray-400 text-sm text-center py-8">No workouts logged yet</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
      <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">
        Recent Workouts
      </h3>

      <div className="flex flex-col gap-2">
        {weekKeys.map((wk) => {
          const isOpen = openWeeks.has(wk);
          const weekWorkouts = grouped[wk];

          return (
            <div key={wk} className="border border-gray-100 rounded-lg overflow-hidden">
              {/* Week header */}
              <button
                onClick={() => toggleWeek(wk)}
                className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-800 text-sm">Week {wk}</span>
                  <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 text-xs font-medium">
                    {weekWorkouts.length}
                  </span>
                </div>
                <svg
                  className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Week content */}
              {isOpen && (
                <div className="p-3 sm:p-4 flex flex-col gap-4">
                  {weekWorkouts.map((workout, wi) => (
                    <WorkoutCard key={wi} workout={workout} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WorkoutCard({ workout }) {
  const { day_number, workout_date, parsed_data } = workout;
  const allBlocks = parsed_data?.blocks || [];
  // Filter to only show workout blocks (exclude warmup, mobility, cooldown, theme)
  const blocks = allBlocks.filter(b =>
    ['straight-set', 'superset', 'triset', 'circuit', 'conditioning'].includes(b.type)
  );

  return (
    <div className="border border-gray-100 rounded-lg p-3 sm:p-4 bg-white">
      {/* Day header */}
      <div className="flex items-center gap-2 mb-3">
        <span className="px-2 py-0.5 rounded bg-purple-600 text-white text-xs font-bold">
          Day {day_number}
        </span>
        <span className="text-xs text-gray-500">{formatDate(workout_date)}</span>
      </div>

      {/* Blocks */}
      <div className="flex flex-col gap-3">
        {blocks.map((block, bi) => (
          <BlockSection key={bi} block={block} />
        ))}
      </div>
    </div>
  );
}

function BlockSection({ block }) {
  const blockType = block.type || 'straight-set';
  const exercises = block.exercises || [];
  const blockClientNotes = block.clientNotes;

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        <span className="text-sm">{getBlockIcon(blockType)}</span>
        <span className="text-xs font-semibold text-gray-700">{getBlockTypeName(blockType)}</span>
      </div>

      <div className="flex flex-col gap-1.5 pl-5">
        {exercises.map((ex, ei) => (
          <ExerciseRow key={ei} exercise={ex} />
        ))}
      </div>

      {blockClientNotes && (
        <div className="mt-1.5 ml-5 px-2 py-1.5 rounded bg-orange-50 border border-orange-200 text-xs text-orange-700 flex items-start gap-1.5">
          <span className="flex-shrink-0">💬</span>
          <span>{blockClientNotes}</span>
        </div>
      )}
    </div>
  );
}

function ExerciseRow({ exercise }) {
  const {
    name,
    prescribedName,
    swappedExercise,
    sets,
    reps,
    targetReps,
    actualReps,
    weights,
    weight,
    completed,
    notes,
    clientNote,
    qualifier,
    recommendation,
    targetDuration,
    actualDuration,
    durationUnit,
    targetDistance,
    actualDistance,
    distanceUnit,
    intensity,
    duration,
    miles,
    distance,
  } = exercise;

  const isCardio = targetDuration || actualDuration || targetDistance || actualDistance || duration || miles || distance;

  // Build the per-set string the same way the email does — keeps the two surfaces in sync
  let displayStr = '';
  if (isCardio) {
    if (actualDuration) {
      displayStr = `${actualDuration} ${durationUnit || 'min'}`;
      if (actualDistance) displayStr += ` / ${actualDistance} ${distanceUnit || 'mi'}`;
    } else if (targetDuration) {
      displayStr = `${targetDuration} ${durationUnit || 'min'}`;
    } else if (duration) {
      displayStr = `${duration} ${durationUnit || 'min'}`;
    }
    if (intensity) displayStr += displayStr ? ` · ${intensity}` : intensity;
    if (!displayStr) displayStr = '—';
  } else {
    const w = Array.isArray(weights) ? weights : (weights != null && weights !== '' ? [weights] : (weight != null && weight !== '' ? [weight] : []));
    const r = Array.isArray(actualReps) ? actualReps : (actualReps != null && actualReps !== '' ? [actualReps] : []);
    const setCount = Math.max(w.length, r.length);
    const parts = [];
    for (let i = 0; i < setCount; i++) {
      const wi = w[i];
      const ri = r[i];
      if ((wi !== undefined && wi !== '') || (ri !== undefined && ri !== '')) {
        parts.push(`${wi || '-'} x ${ri || '-'}`);
      }
    }
    displayStr = parts.join(' | ');
    if (!displayStr) {
      const tr = targetReps || reps;
      if (sets && tr) displayStr = `${sets}x${tr}`;
    }
    if (qualifier) displayStr += ` ${qualifier}`;
  }

  const recIcon =
    recommendation === 'up' ? ' ⬆️' :
    recommendation === 'down' ? ' ⬇️' :
    recommendation === 'same' ? ' ➡️' : '';

  // Match email styling: completed = ✅ + dark + semibold, skipped = gray + faded
  const nameClass = completed ? 'font-semibold text-gray-800' : 'text-gray-400';
  const valueClass = completed ? 'text-gray-600' : 'text-gray-400';

  // Did the client swap this lift for a different one? Flag it in yellow with
  // what was originally prescribed, so the coach sees the substitution at a glance.
  const isSwapped = swappedExercise && prescribedName &&
    swappedExercise.trim().toLowerCase() !== prescribedName.trim().toLowerCase();

  return (
    <div className="flex flex-col gap-0.5 text-xs">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        {isSwapped ? (
          <span className={nameClass}>
            {completed && <span className="mr-1">✅</span>}
            <span className="bg-yellow-100 text-yellow-900 rounded px-1 font-semibold">
              🔄 {name}
            </span>
            <span className="ml-1 text-[11px] text-yellow-700 italic">(swapped from {prescribedName})</span>
          </span>
        ) : (
          <span className={nameClass}>
            {completed && <span className="mr-1">✅</span>}
            {name}
          </span>
        )}
        <span className={`${valueClass} ml-auto whitespace-nowrap`}>
          {displayStr}{recIcon}
        </span>
      </div>
      {notes && (
        <div className="pl-5 text-[11px] text-gray-400 italic">📝 {notes}</div>
      )}
      {clientNote && (
        <div className="pl-5 text-[11px] text-orange-700">💬 {clientNote}</div>
      )}
    </div>
  );
}
