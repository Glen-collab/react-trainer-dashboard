import { useState } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

const METRICS = [
  { key: 'tonnage', label: 'Tonnage (lbs)', color: '#667eea', suffix: ' lbs' },
  { key: 'est_calories', label: 'Calories', color: '#ef4444', suffix: ' cal' },
  { key: 'core_crunches', label: 'Core (reps)', color: '#10b981', suffix: ' reps' },
  { key: 'cardio_minutes', label: 'Time (min)', color: '#f59e0b', suffix: ' min' },
  { key: 'cardio_miles', label: 'Distance (mi)', color: '#3b82f6', suffix: ' mi' },
];

export default function VolumeChart({ weeklyVolumeStats = [], totalWeeks = 12 }) {
  const [activeMetric, setActiveMetric] = useState('tonnage');

  // Check if we have any data
  const hasData = weeklyVolumeStats.some(w =>
    w.tonnage > 0 || w.core_crunches > 0 || w.cardio_minutes > 0 || w.cardio_miles > 0 || w.est_calories > 0
  );

  // Build week labels - if no data, show empty weeks 1-4 or up to totalWeeks
  const numWeeks = weeklyVolumeStats.length > 0
    ? Math.max(...weeklyVolumeStats.map(w => w.week), 4)
    : Math.min(totalWeeks, 4);

  // Create array of all weeks with data or zeros
  const allWeeks = [];
  for (let w = 1; w <= numWeeks; w++) {
    const existing = weeklyVolumeStats.find(s => s.week === w);
    allWeeks.push(existing || { week: w, tonnage: 0, core_crunches: 0, cardio_minutes: 0, cardio_miles: 0, est_calories: 0 });
  }

  const metric = METRICS.find(m => m.key === activeMetric) || METRICS[0];

  // Build labels and data from all weeks
  const labels = allWeeks.map(w => `Week ${w.week}`);
  const dataValues = allWeeks.map(w => w[metric.key] || 0);

  const data = {
    labels,
    datasets: [
      {
        label: metric.label,
        data: dataValues,
        borderColor: metric.color,
        backgroundColor: `${metric.color}22`,
        tension: 0.3,
        pointRadius: 5,
        pointHoverRadius: 7,
        borderWidth: 2,
        fill: true,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: (ctx) =>
            `${ctx.dataset.label}: ${ctx.parsed.y.toLocaleString()}${metric.suffix}`,
        },
        backgroundColor: '#1f2937',
        titleFont: { size: 12 },
        bodyFont: { size: 12 },
        padding: 10,
        cornerRadius: 8,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          color: '#9ca3af',
          font: { size: 11 },
          callback: (v) => v.toLocaleString(),
        },
        grid: { color: 'rgba(0,0,0,0.05)' },
      },
      x: {
        ticks: {
          color: '#9ca3af',
          font: { size: 11 },
        },
        grid: { display: false },
      },
    },
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">
        Weekly Volume
      </h3>

      {/* Metric tabs */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {METRICS.map(m => (
          <button
            key={m.key}
            onClick={() => setActiveMetric(m.key)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              activeMetric === m.key
                ? 'text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            style={activeMetric === m.key ? { backgroundColor: m.color } : {}}
          >
            {m.label}
          </button>
        ))}
      </div>

      <Line data={data} options={options} />
      {!hasData && (
        <p className="text-gray-400 text-xs text-center mt-2">
          Volume data will appear as workouts are logged
        </p>
      )}
    </div>
  );
}
