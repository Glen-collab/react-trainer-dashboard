import { computePRs, progressionTrends, streakWeeks } from '../../utils/progress';
import { formatDate } from '../../utils/helpers';

// Surfaces what the data alone won't shout at the trainer: new PRs, lifts
// that have moved up, and consecutive-week streaks. All derived from the
// existing /get-client-details.php payload.
export default function ProgressHighlights({ details }) {
  const prs        = computePRs(details?.recent_workouts);
  const trends     = progressionTrends(details?.recent_workouts);
  const streak     = streakWeeks(details?.weekly_progress);

  const nothing = !prs.length && !trends.length && streak < 2;
  if (nothing) return null;

  return (
    <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl border border-emerald-200 p-5 lg:col-span-2">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-gray-700">Progress Highlights</h4>
        {streak >= 2 && (
          <span className="px-3 py-1 rounded-full bg-emerald-600 text-white text-xs font-bold flex items-center gap-1">
            <span>🔥</span> {streak}-week streak
          </span>
        )}
      </div>

      {prs.length > 0 && (
        <div className="mb-3">
          <p className="text-xs font-semibold text-emerald-800 uppercase tracking-wide mb-1.5">New PRs</p>
          <div className="flex flex-wrap gap-2">
            {prs.map((pr) => (
              <div
                key={`${pr.name}-${pr.date}`}
                className="bg-white border border-emerald-200 rounded-lg px-3 py-2 flex items-center gap-2 shadow-sm"
              >
                <span className="text-base">🏆</span>
                <div className="text-xs leading-tight">
                  <div className="font-semibold text-gray-900">{pr.name}</div>
                  <div className="text-gray-500">
                    {pr.weight} lbs{pr.reps ? ` × ${pr.reps}` : ''}
                    <span className="text-emerald-600 font-semibold"> · +{pr.gainLbs} lbs</span>
                  </div>
                  {pr.date && <div className="text-[10px] text-gray-400">{formatDate(pr.date)}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {trends.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-emerald-800 uppercase tracking-wide mb-1.5">Trending Up</p>
          <div className="flex flex-wrap gap-2">
            {trends.map((t) => (
              <div
                key={t.name}
                className="bg-white border border-emerald-200 rounded-lg px-3 py-2 flex items-center gap-2 shadow-sm"
              >
                <span className="text-base">📈</span>
                <div className="text-xs leading-tight">
                  <div className="font-semibold text-gray-900">{t.name}</div>
                  <div className="text-gray-500">
                    {t.fromWeight} → <span className="text-emerald-700 font-semibold">{t.toWeight} lbs</span>
                    <span className="text-emerald-600 font-semibold"> (+{t.deltaLbs})</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
