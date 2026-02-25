import { Fragment } from 'react';
import { formatDate, completionBg } from '../../utils/helpers';
import ClientDetails from './ClientDetails';

export default function ClientTable({
  clients,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  onViewDetails,
  onDeleteClient,
  expandedClient,
  clientDetails,
  detailsLoading,
  onCloseDetails,
  onUpdateMaxes,
}) {
  const allSelected = clients.length > 0 && selectedIds.size === clients.length;
  const clientKey = (c) => `${c.access_code || ''}|${c.user_email}`;
  const isExpanded = (c) =>
    expandedClient?.access_code === c.access_code &&
    expandedClient?.user_email === c.user_email;

  return (
    <>
      {/* Mobile card list */}
      <div className="md:hidden flex flex-col gap-3">
        {clients.map((client) => {
          const key = clientKey(client);
          const expanded = isExpanded(client);
          const isSelected = selectedIds.has(key);

          return (
            <div key={key} className="flex flex-col gap-3">
              <div
                className={`rounded-xl shadow-sm border p-4 flex flex-col gap-2 ${
                  expanded ? 'bg-purple-50 border-purple-200' : 'bg-white border-gray-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onToggleSelect(client)}
                    className="w-4 h-4 accent-purple-600"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-gray-900 truncate">{client.user_name}</div>
                    <div className="text-sm text-gray-500 truncate">{client.user_email}</div>
                  </div>
                </div>

                <div className="text-sm text-gray-700">
                  {client.program_nickname || client.program_name}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 text-xs font-medium">
                    Week {client.current_week}, Day {client.current_day}
                  </span>
                  <span className="text-xs text-gray-500">
                    Last: {formatDate(client.last_logged_date)}
                  </span>
                </div>

                <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${completionBg(client.completion_rate)}`}
                    style={{ width: `${client.completion_rate}%` }}
                  />
                </div>
                <div className="text-xs text-gray-500">{client.completion_rate}% complete</div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => onViewDetails(client)}
                    className={`flex-1 py-2 rounded-lg border-2 font-medium text-sm transition-colors ${
                      expanded
                        ? 'border-purple-600 bg-purple-600 text-white'
                        : 'border-purple-500 text-purple-600 hover:bg-purple-50'
                    }`}
                  >
                    {expanded ? 'Hide Details' : 'View Details'}
                  </button>
                  <button
                    onClick={() => onDeleteClient(client)}
                    className="w-9 h-9 rounded-lg text-red-500 hover:bg-red-50 flex items-center justify-center text-lg transition-colors"
                    title="Delete"
                  >
                    {'\uD83D\uDDD1\uFE0F'}
                  </button>
                </div>
              </div>

              {/* Inline detail panel right under this client */}
              {expanded && (
                <ClientDetails
                  client={expandedClient}
                  details={clientDetails}
                  loading={detailsLoading}
                  onClose={onCloseDetails}
                  onUpdateMaxes={onUpdateMaxes}
                />
              )}
            </div>
          );
        })}
        {clients.length === 0 && (
          <div className="text-center text-gray-400 py-12 text-sm">No clients found</div>
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto rounded-xl shadow-sm border border-gray-200 bg-white">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="p-3 w-10">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={onToggleSelectAll}
                  className="w-4 h-4 accent-purple-600"
                />
              </th>
              <th className="p-3 text-sm font-semibold text-gray-600">Client Name</th>
              <th className="p-3 text-sm font-semibold text-gray-600">Program</th>
              <th className="p-3 text-sm font-semibold text-gray-600">Week / Day</th>
              <th className="p-3 text-sm font-semibold text-gray-600">Last Workout</th>
              <th className="p-3 text-sm font-semibold text-gray-600">Completion %</th>
              <th className="p-3 text-sm font-semibold text-gray-600">Total Workouts</th>
              <th className="p-3 text-sm font-semibold text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((client) => {
              const key = clientKey(client);
              const expanded = isExpanded(client);
              const isSelected = selectedIds.has(key);

              return (
                <Fragment key={key}>
                  <tr
                    className={`border-b border-gray-100 ${
                      expanded ? 'bg-purple-50' : 'bg-white hover:bg-gray-50'
                    }`}
                  >
                    <td className="p-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onToggleSelect(client)}
                        className="w-4 h-4 accent-purple-600"
                      />
                    </td>
                    <td className="p-3">
                      <div className="font-semibold text-gray-900">{client.user_name}</div>
                      <div className="text-xs text-gray-500">{client.user_email}</div>
                    </td>
                    <td className="p-3 text-sm text-gray-700">
                      {client.program_nickname || client.program_name}
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 text-xs font-medium">
                        W{client.current_week} D{client.current_day}
                      </span>
                    </td>
                    <td className="p-3 text-sm text-gray-600">
                      {formatDate(client.last_logged_date)}
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2.5 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${completionBg(client.completion_rate)}`}
                            style={{ width: `${client.completion_rate}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-600">{client.completion_rate}%</span>
                      </div>
                    </td>
                    <td className="p-3 text-sm text-gray-700">{client.total_workouts}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => onViewDetails(client)}
                          className={`px-3 py-1.5 rounded-lg border-2 text-xs font-medium transition-colors ${
                            expanded
                              ? 'border-purple-600 bg-purple-600 text-white'
                              : 'border-purple-500 text-purple-600 hover:bg-purple-50'
                          }`}
                        >
                          {expanded ? 'Hide' : 'View Details'}
                        </button>
                        <button
                          onClick={() => onDeleteClient(client)}
                          className="w-8 h-8 rounded-lg text-red-500 hover:bg-red-50 flex items-center justify-center text-sm transition-colors"
                          title="Delete"
                        >
                          {'\uD83D\uDDD1\uFE0F'}
                        </button>
                      </div>
                    </td>
                  </tr>
                  {/* Inline detail row */}
                  {expanded && (
                    <tr>
                      <td colSpan={8} className="p-0">
                        <div className="p-4 bg-gray-50 border-b border-gray-200">
                          <ClientDetails
                            client={expandedClient}
                            details={clientDetails}
                            loading={detailsLoading}
                            onClose={onCloseDetails}
                            onUpdateMaxes={onUpdateMaxes}
                          />
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {clients.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center text-gray-400 py-12 text-sm">
                  No clients found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
