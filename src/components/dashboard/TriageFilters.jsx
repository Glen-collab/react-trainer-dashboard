import { triageBucket } from '../../utils/progress';

const CHIPS = [
  { id: 'all',      label: 'All',            inactive: 'bg-white text-gray-700 border-gray-200',   active: 'bg-gray-900 text-white border-gray-900' },
  { id: 'check_in', label: 'Needs Check-In', inactive: 'bg-red-50 text-red-700 border-red-200',    active: 'bg-red-600 text-white border-red-600' },
  { id: 'quiet',    label: 'Quiet',          inactive: 'bg-amber-50 text-amber-700 border-amber-200', active: 'bg-amber-500 text-white border-amber-500' },
  { id: 'active',   label: 'Active',         inactive: 'bg-emerald-50 text-emerald-700 border-emerald-200', active: 'bg-emerald-600 text-white border-emerald-600' },
  { id: 'new',      label: 'New',            inactive: 'bg-blue-50 text-blue-700 border-blue-200', active: 'bg-blue-600 text-white border-blue-600' },
];

export default function TriageFilters({ clients, activeFilter, onChange }) {
  const counts = { all: clients.length, check_in: 0, quiet: 0, active: 0, new: 0 };
  for (const c of clients) counts[triageBucket(c)]++;

  return (
    <div className="flex flex-wrap gap-2">
      {CHIPS.map((chip) => {
        const isActive = activeFilter === chip.id;
        const count = counts[chip.id];
        if (chip.id !== 'all' && count === 0) return null;
        return (
          <button
            key={chip.id}
            onClick={() => onChange(chip.id)}
            className={`px-3 py-1.5 rounded-full border text-xs font-semibold transition-colors flex items-center gap-1.5 ${
              isActive ? chip.active : chip.inactive
            }`}
          >
            <span>{chip.label}</span>
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
              isActive ? 'bg-white/20 text-white' : 'bg-white/80 text-gray-600'
            }`}>{count}</span>
          </button>
        );
      })}
    </div>
  );
}
