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

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export default function WeeklyProgressChart({ weeklyProgress = [], daysPerWeek = 5 }) {
  if (!weeklyProgress.length) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">
          Weekly Progress
        </h3>
        <p className="text-gray-400 text-sm text-center py-8">No progress data yet</p>
      </div>
    );
  }

  const labels = weeklyProgress.map((w) => `Week ${w.week_number}`);
  const values = weeklyProgress.map((w) => w.workouts_completed);

  const data = {
    labels,
    datasets: [
      {
        label: 'Workouts Completed',
        data: values,
        borderColor: '#667eea',
        backgroundColor: 'rgba(102, 126, 234, 0.15)',
        fill: true,
        tension: 0.3,
        pointBackgroundColor: '#ffffff',
        pointBorderColor: '#667eea',
        pointBorderWidth: 2,
        pointRadius: 6,
        pointHoverRadius: 8,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => `${ctx.parsed.y} / ${daysPerWeek} workouts`,
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
        min: 0,
        max: daysPerWeek,
        ticks: {
          stepSize: 1,
          color: '#9ca3af',
          font: { size: 11 },
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
        Weekly Progress
      </h3>
      <Line data={data} options={options} />
    </div>
  );
}
