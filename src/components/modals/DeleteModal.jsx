import { useRef } from 'react';

export default function DeleteModal({ isOpen, onClose, onConfirm, clients = [], loading }) {
  const modalRef = useRef(null);

  if (!isOpen) return null;

  const isBulk = clients.length > 1;

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        className="bg-white rounded-xl max-w-md w-full p-6 animate-[slide-up_0.2s_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Warning Icon + Heading */}
        <div className="text-center mb-4">
          <span className="text-5xl">⚠️</span>
          <h2 className="text-xl font-bold text-gray-900 mt-2">Confirm Deletion</h2>
        </div>

        {/* Message */}
        <div className="text-gray-600 text-center mb-6">
          {isBulk ? (
            <>
              <p className="mb-3">
                Delete data for <span className="font-semibold text-red-600">{clients.length} clients</span>?
              </p>
              <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-2 text-left text-sm">
                {clients.map((c, i) => (
                  <div key={i} className="py-1 px-2 even:bg-gray-50 rounded">
                    {c.user_name}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p>
              Are you sure you want to delete all data for{' '}
              <span className="font-semibold text-gray-900">{clients[0]?.user_name}</span>{' '}
              <span className="text-gray-500">({clients[0]?.user_email})</span>?
            </p>
          )}
        </div>

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Deleting…
              </>
            ) : (
              'Delete'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
