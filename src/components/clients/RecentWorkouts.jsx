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
    ['straight-set', 'superset', 'triset', 'conditioning'].includes(b.type)
  );
  const trainerNotes = parsed_data?.trainerNotes;
  const clientNotes = parsed_data?.clientNotes;

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

      {/* Trainer Notes */}
      {trainerNotes && (
        <div className="mt-3 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <span className="text-sm flex-shrink-0">{'\uD83D\uDCDD'}</span>
            <div>
              <p className="text-xs font-semibold text-yellow-800 mb-0.5">Trainer Notes</p>
              <p className="text-xs text-yellow-700">{trainerNotes}</p>
            </div>
          </div>
        </div>
      )}

      {/* Client Notes */}
      {clientNotes && (
        <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <span className="text-sm flex-shrink-0">{'\uD83D\uDCAC'}</span>
            <div>
              <p className="text-xs font-semibold text-blue-800 mb-0.5">Client Notes</p>
              <p className="text-xs text-blue-700">{clientNotes}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BlockSection({ block }) {
  const blockType = block.type || 'straight-set';
  const exercises = block.exercises || [];

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
    </div>
  );
}

function ExerciseRow({ exercise }) {
  const { name, sets, reps, actualReps, weights, weight, notes, duration, durationUnit, intensity, miles, distance } = exercise;

  // Check if this is a conditioning/cardio exercise (has duration or distance)
  const isCardio = duration || miles || distance;

  // Format weight display (supports both weights array and single weight)
  let weightDisplay = '';
  const w = weights || weight;
  if (w && !isCardio) {
    if (Array.isArray(w)) {
      const filtered = w.filter((v) => v != null && v !== '');
      if (filtered.length > 1) {
        const min = Math.min(...filtered);
        const max = Math.max(...filtered);
        weightDisplay = min === max ? `${min} lbs` : `${min}-${max} lbs`;
      } else if (filtered.length === 1) {
        weightDisplay = `${filtered[0]} lbs`;
      }
    } else {
      weightDisplay = `${w} lbs`;
    }
  }

  // Format reps display (supports actualReps array vs target reps)
  const actualTotal = Array.isArray(actualReps) ? actualReps.join('-') : actualReps;
  const targetNum = Number(reps);
  const missedReps = Array.isArray(actualReps) && actualReps.some((r) => r < targetNum);

  // Format duration for cardio exercises
  let durationDisplay = '';
  if (duration) {
    const unit = durationUnit || 'min';
    durationDisplay = `${duration} ${unit}`;
  }

  // Format distance
  let distanceDisplay = '';
  if (miles) {
    distanceDisplay = `${miles} mi`;
  } else if (distance) {
    distanceDisplay = `${distance}`;
  }

  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs">
      <span className="font-medium text-gray-800">{name}</span>
      {isCardio ? (
        <>
          {durationDisplay && (
            <span className="text-orange-600 font-medium">{durationDisplay}</span>
          )}
          {distanceDisplay && (
            <span className="text-blue-600 font-medium">{distanceDisplay}</span>
          )}
          {intensity && (
            <span className="text-gray-500 italic">{intensity}</span>
          )}
        </>
      ) : (
        <>
          <span className="text-gray-500">
            {sets && `${sets}x`}
            {actualTotal ? (
              <span className={missedReps ? 'text-red-500 font-semibold' : ''}>
                {actualTotal}
                {reps && <span className="text-gray-400">/{reps}</span>}
              </span>
            ) : (
              reps && <span>{reps}</span>
            )}
          </span>
          {weightDisplay && (
            <span className="text-purple-600 font-medium">{weightDisplay}</span>
          )}
        </>
      )}
      {notes && <span className="text-gray-400 italic">{notes}</span>}
    </div>
  );
}
