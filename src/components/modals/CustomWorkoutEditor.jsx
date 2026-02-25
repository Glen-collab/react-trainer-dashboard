import { useState } from 'react';

export default function CustomWorkoutEditor({
  client,
  onSave,
  onRevert,
  onLoadProgram,
  onLoadOverride,
  onSaveOverride,
  onDeleteOverride,
}) {
  const [selectedWeek, setSelectedWeek] = useState('');
  const [selectedDay, setSelectedDay] = useState('');
  const [workoutData, setWorkoutData] = useState(null);

  const daysPerWeek = client?.days_per_week || 5;
  const totalWeeks = client?.total_weeks || 12;

  const handleLoadWorkout = () => {
    if (selectedWeek && selectedDay && onLoadProgram) {
      onLoadProgram(selectedWeek, selectedDay);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      {/* Heading */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">Custom Workout Editor</h2>
        {client?.access_code && (
          <span className="font-mono text-sm bg-purple-100 text-purple-700 px-3 py-1 rounded-full">
            {client.access_code}
          </span>
        )}
      </div>

      {/* Selectors Row */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">Week</label>
          <select
            value={selectedWeek}
            onChange={(e) => setSelectedWeek(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          >
            <option value="">Select week…</option>
            {Array.from({ length: totalWeeks }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                Week {i + 1}
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">Day</label>
          <select
            value={selectedDay}
            onChange={(e) => setSelectedDay(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          >
            <option value="">Select day…</option>
            {Array.from({ length: daysPerWeek }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                Day {i + 1}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-end">
          <button
            onClick={handleLoadWorkout}
            disabled={!selectedWeek || !selectedDay}
            className="w-full sm:w-auto px-5 py-2 rounded-lg bg-gradient-to-r from-[#667eea] to-[#764ba2] text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Load Workout
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="min-h-[200px] border border-dashed border-gray-300 rounded-lg flex items-center justify-center mb-6">
        {workoutData ? (
          <div className="w-full p-4">
            {/* Future workout display */}
          </div>
        ) : (
          <p className="text-gray-400 text-center px-4">
            Select a week and day, then click Load Workout
          </p>
        )}
      </div>

      {/* Bottom Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          disabled
          className="flex-1 px-4 py-2.5 rounded-lg bg-green-600 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Save Custom Workout
        </button>
        <button
          disabled
          className="flex-1 px-4 py-2.5 rounded-lg bg-blue-600 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Copy to Weeks
        </button>
        <button
          disabled
          className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Revert to Base
        </button>
      </div>
    </div>
  );
}
