export default function BulkActions({ selectedCount, onDeleteSelected }) {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 md:static md:mt-4 z-50 animate-slide-up">
      <div className="bg-white border-t md:border md:rounded-xl shadow-lg md:shadow-sm p-4 flex items-center justify-between gap-4">
        <span className="text-sm font-medium text-gray-700">
          {selectedCount} client{selectedCount !== 1 ? 's' : ''} selected
        </span>
        <button
          onClick={onDeleteSelected}
          className="px-5 py-2 rounded-lg bg-red-600 text-white font-medium text-sm hover:bg-red-700 transition-colors"
        >
          Delete Selected
        </button>
      </div>
    </div>
  );
}
