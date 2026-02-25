export default function SearchBar({ searchTerm, onSearchChange, sortBy, onSortChange, onRefresh }) {
  return (
    <div className="flex flex-col md:flex-row gap-3">
      {/* Search input */}
      <div className="relative flex-1">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg">🔍</span>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search clients..."
          className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white text-gray-900"
        />
      </div>

      {/* Sort + Refresh row */}
      <div className="flex gap-3">
        <select
          value={sortBy}
          onChange={(e) => onSortChange(e.target.value)}
          className="flex-1 md:flex-none md:w-48 px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white text-gray-900"
        >
          <option value="recent">Most Recent</option>
          <option value="name">Name (A-Z)</option>
          <option value="completion">Completion Rate</option>
        </select>

        <button
          type="button"
          onClick={() => onRefresh && onRefresh()}
          className="w-11 h-11 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 text-white flex items-center justify-center shrink-0 hover:opacity-90 transition-opacity cursor-pointer"
          title="Refresh"
        >
          🔄
        </button>
      </div>
    </div>
  );
}
