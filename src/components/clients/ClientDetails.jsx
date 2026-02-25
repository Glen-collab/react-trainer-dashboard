import { useState } from 'react';
import { completionColor, completionBg } from '../../utils/helpers';
import WeeklyProgressChart from '../charts/WeeklyProgressChart';
import VolumeChart from '../charts/VolumeChart';
import RecentWorkouts from './RecentWorkouts';

export default function ClientDetails({ client, details, loading, onClose, onUpdateMaxes }) {
  const [showMaxesEditor, setShowMaxesEditor] = useState(false);
  const [maxes, setMaxes] = useState({
    bench: client?.bench_max || '',
    squat: client?.squat_max || '',
    deadlift: client?.deadlift_max || '',
    clean: client?.clean_max || '',
  });
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  const handleSaveMaxes = async () => {
    if (!onUpdateMaxes) return;
    setSaving(true);
    setSaveMessage('');
    const success = await onUpdateMaxes(client, maxes);
    setSaving(false);
    if (success) {
      setSaveMessage('Saved!');
      setTimeout(() => setSaveMessage(''), 2000);
    } else {
      setSaveMessage('Error saving');
    }
  };
  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 text-lg transition-colors"
          aria-label="Close"
        >
          &times;
        </button>
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="w-10 h-10 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin" />
          <p className="text-gray-500 text-sm">Loading client details...</p>
        </div>
      </div>
    );
  }

  if (!details) return null;

  const {
    total_logged = 0,
    expected_workouts = 0,
    completion_rate = 0,
    weekly_progress = [],
    recent_workouts = [],
    days_per_week,
    total_volume_stats = {},
    weekly_volume_stats = [],
  } = details;

  const daysPerWeek = days_per_week || client?.days_per_week || 5;
  const pct = Math.min(Math.round(completion_rate), 100);

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-4 sm:p-6 relative">
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-3 right-3 sm:top-4 sm:right-4 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 text-lg transition-colors z-10"
        aria-label="Close"
      >
        &times;
      </button>

      {/* Client header */}
      <div className="mb-5 pr-10">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {client?.user_name || client?.user_email || 'Client'}
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">{client?.program_name}</p>
            <p className="text-xs text-gray-400 mt-0.5">
              Week {client?.current_week} &middot; {daysPerWeek} days/week
            </p>
          </div>
          {client?.access_code && (
            <button
              onClick={() => {
                const isLocal = window.location.hostname === 'localhost';
                const base = isLocal
                  ? 'http://localhost:5173'
                  : (window.tdConfig?.builderUrl || 'https://workoutbuild.netlify.app');
                const url = `${base}/?accessCode=${encodeURIComponent(client.access_code)}&email=${encodeURIComponent(client.user_email)}&mode=override`;
                window.open(url, '_blank');
              }}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-[#667eea] to-[#764ba2] text-white text-sm font-semibold hover:opacity-90 transition-opacity whitespace-nowrap flex-shrink-0"
            >
              Edit Program
            </button>
          )}
        </div>
      </div>

      {/* Grid layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
        {/* Stats Summary Card */}
        <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl p-5 border border-purple-100 flex items-center gap-5">
          {/* Circular progress indicator */}
          <div className="relative w-20 h-20 flex-shrink-0">
            <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
              <circle
                cx="40"
                cy="40"
                r="34"
                fill="none"
                className="stroke-gray-200"
                strokeWidth="8"
              />
              <circle
                cx="40"
                cy="40"
                r="34"
                fill="none"
                className="stroke-purple-500"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${(pct / 100) * 213.6} 213.6`}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className={`text-lg font-bold ${completionColor(pct)}`}>{pct}%</span>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
              Completion
            </h3>
            <p className="text-2xl font-bold text-gray-900">
              {total_logged}{' '}
              <span className="text-base font-normal text-gray-400">
                / {expected_workouts}
              </span>
            </p>
            <p className="text-xs text-gray-500">workouts logged</p>
            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden mt-1">
              <div
                className={`h-full rounded-full ${completionBg(pct)}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Weekly Progress Chart */}
        <WeeklyProgressChart
          weeklyProgress={weekly_progress}
          daysPerWeek={daysPerWeek}
        />

        {/* Total Volume Stats */}
        {(total_volume_stats.tonnage > 0 || total_volume_stats.est_calories > 0) && (
          <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl p-5 border border-indigo-100">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">Total Volume Stats</h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {total_volume_stats.tonnage > 0 && (
                <div className="bg-white rounded-lg p-3 text-center shadow-sm">
                  <p className="text-xs text-gray-500 mb-1">Tonnage</p>
                  <p className="text-lg font-bold text-indigo-600">{total_volume_stats.tonnage.toLocaleString()}</p>
                  <p className="text-xs text-gray-400">lbs</p>
                </div>
              )}
              {total_volume_stats.est_calories > 0 && (
                <div className="bg-white rounded-lg p-3 text-center shadow-sm">
                  <p className="text-xs text-gray-500 mb-1">Calories</p>
                  <p className="text-lg font-bold text-red-500">{total_volume_stats.est_calories.toLocaleString()}</p>
                  <p className="text-xs text-gray-400">burned</p>
                </div>
              )}
              {total_volume_stats.core_crunches > 0 && (
                <div className="bg-white rounded-lg p-3 text-center shadow-sm">
                  <p className="text-xs text-gray-500 mb-1">Core</p>
                  <p className="text-lg font-bold text-green-600">{total_volume_stats.core_crunches.toLocaleString()}</p>
                  <p className="text-xs text-gray-400">reps</p>
                </div>
              )}
              {total_volume_stats.cardio_minutes > 0 && (
                <div className="bg-white rounded-lg p-3 text-center shadow-sm">
                  <p className="text-xs text-gray-500 mb-1">Cardio</p>
                  <p className="text-lg font-bold text-orange-500">{total_volume_stats.cardio_minutes}</p>
                  <p className="text-xs text-gray-400">minutes</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Volume Chart */}
        <VolumeChart weeklyVolumeStats={weekly_volume_stats} />

        {/* Recent Workouts */}
        <RecentWorkouts workouts={recent_workouts} />

        {/* Edit Program CTA */}
        {client?.access_code && (
          <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl border border-purple-200 p-6 flex flex-col items-center justify-center gap-3 lg:col-span-2">
            <p className="text-gray-600 text-sm font-medium text-center">
              Need to adjust this client's program mid-cycle?
            </p>
            <button
              onClick={() => {
                const isLocal = window.location.hostname === 'localhost';
                const base = isLocal
                  ? 'http://localhost:5173'
                  : (window.tdConfig?.builderUrl || 'https://workoutbuild.netlify.app');
                const url = `${base}/?accessCode=${encodeURIComponent(client.access_code)}&email=${encodeURIComponent(client.user_email)}&mode=override`;
                window.open(url, '_blank');
              }}
              className="px-6 py-3 rounded-lg bg-gradient-to-r from-[#667eea] to-[#764ba2] text-white font-semibold hover:opacity-90 transition-opacity"
            >
              Open in Workout Builder
            </button>
            <p className="text-xs text-gray-400">
              Opens the builder with this client's program. Changes save as overrides per week/day.
            </p>
          </div>
        )}

        {/* Update Client Maxes (Trainer Only) */}
        {client?.access_code && (
          <div className="bg-white rounded-xl border border-gray-200 p-4 lg:col-span-2">
            <button
              onClick={() => setShowMaxesEditor(!showMaxesEditor)}
              className="w-full flex items-center justify-between text-left"
            >
              <span className="text-sm font-semibold text-gray-700">
                Update 1RM Values
              </span>
              <span className="text-gray-400 text-lg">
                {showMaxesEditor ? '−' : '+'}
              </span>
            </button>

            {showMaxesEditor && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs text-gray-500 mb-3">
                  Set estimated maxes for clients who don't know their 1RM. These values are used for percentage-based exercises.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Bench (lbs)</label>
                    <input
                      type="number"
                      value={maxes.bench}
                      onChange={(e) => setMaxes({ ...maxes, bench: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Squat (lbs)</label>
                    <input
                      type="number"
                      value={maxes.squat}
                      onChange={(e) => setMaxes({ ...maxes, squat: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Deadlift (lbs)</label>
                    <input
                      type="number"
                      value={maxes.deadlift}
                      onChange={(e) => setMaxes({ ...maxes, deadlift: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Clean (lbs)</label>
                    <input
                      type="number"
                      value={maxes.clean}
                      onChange={(e) => setMaxes({ ...maxes, clean: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                      placeholder="0"
                    />
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      console.log('Save Maxes clicked', { client, maxes, onUpdateMaxes: !!onUpdateMaxes });
                      handleSaveMaxes();
                    }}
                    disabled={saving}
                    className="px-4 py-2 rounded-lg bg-gradient-to-r from-[#667eea] to-[#764ba2] text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer"
                  >
                    {saving ? 'Saving...' : 'Save Maxes'}
                  </button>
                  {saveMessage && (
                    <span className={`text-sm font-medium ${saveMessage === 'Saved!' ? 'text-green-600' : 'text-red-500'}`}>
                      {saveMessage}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
