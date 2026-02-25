export default function StatsCards({ stats }) {
  const cards = [
    { label: 'Active Clients', value: stats.active_clients, icon: '👥', gradient: 'from-purple-500 to-indigo-600' },
    { label: 'Workouts This Week', value: stats.workouts_this_week, icon: '📅', gradient: 'from-blue-500 to-cyan-500' },
    { label: 'Total Workouts', value: stats.total_workouts, icon: '🏋️', gradient: 'from-green-500 to-emerald-600' },
    { label: 'Avg Completion', value: `${stats.avg_completion}%`, icon: '📊', gradient: 'from-orange-500 to-amber-500' },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="bg-white rounded-xl shadow-md p-4 flex items-center gap-4"
        >
          <div
            className={`bg-gradient-to-br ${card.gradient} w-14 h-14 rounded-full flex items-center justify-center text-2xl shrink-0`}
          >
            {card.icon}
          </div>
          <div>
            <div className="text-3xl font-bold text-gray-900">{card.value}</div>
            <div className="text-sm text-gray-500">{card.label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
