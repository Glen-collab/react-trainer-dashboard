import { useState, useEffect, useCallback, useMemo } from 'react';
import useDashboardAPI from './hooks/useDashboardAPI';
import StatsCards from './components/dashboard/StatsCards';
import SearchBar from './components/dashboard/SearchBar';
import ClientTable from './components/clients/ClientTable';
import BulkActions from './components/clients/BulkActions';
import DeleteModal from './components/modals/DeleteModal';

export default function App() {
  const { fetchClients, fetchStats, fetchClientDetails, deleteClient, updateClientMaxes } = useDashboardAPI();

  const [clients, setClients] = useState([]);
  const [stats, setStats] = useState({
    active_clients: 0,
    workouts_this_week: 0,
    total_workouts: 0,
    avg_completion: 0,
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('recent');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [expandedClient, setExpandedClient] = useState(null);
  const [clientDetails, setClientDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, clients: [] });
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Initial fetch
  useEffect(() => {
    (async () => {
      const [clientsData, statsData] = await Promise.all([fetchClients(), fetchStats()]);
      if (clientsData) setClients(clientsData);
      if (statsData) setStats(statsData);
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRefresh = useCallback(async () => {
    const [clientsData, statsData] = await Promise.all([fetchClients(), fetchStats()]);
    if (clientsData) setClients(clientsData);
    if (statsData) setStats(statsData);
  }, [fetchClients, fetchStats]);

  // Filtered + sorted clients
  const filteredClients = useMemo(() => {
    let result = [...clients].filter((c) => {
      const term = searchTerm.toLowerCase();
      return (
        (c.user_name || '').toLowerCase().includes(term) ||
        (c.user_email || '').toLowerCase().includes(term)
      );
    });

    switch (sortBy) {
      case 'name':
        result.sort((a, b) => (a.user_name || '').localeCompare(b.user_name || ''));
        break;
      case 'completion':
        result.sort((a, b) => (b.completion_rate || 0) - (a.completion_rate || 0));
        break;
      case 'recent':
      default:
        result.sort(
          (a, b) =>
            new Date(b.last_logged_date || 0) - new Date(a.last_logged_date || 0),
        );
        break;
    }

    return result;
  }, [clients, searchTerm, sortBy]);

  // View details
  const handleViewDetails = useCallback(
    async (client) => {
      // If clicking same client, collapse
      if (
        expandedClient &&
        expandedClient.access_code === client.access_code &&
        expandedClient.user_email === client.user_email
      ) {
        setExpandedClient(null);
        setClientDetails(null);
        return;
      }

      // Expand new client
      setExpandedClient(client);
      setClientDetails(null);
      setDetailsLoading(true);
      try {
        const details = await fetchClientDetails(client.access_code, client.user_email);
        setClientDetails(details);
      } finally {
        setDetailsLoading(false);
      }
    },
    [expandedClient, fetchClientDetails],
  );

  // Selection helpers
  const clientKey = (c) => `${c.access_code || ''}|${c.user_email}`;

  const handleToggleSelect = useCallback((client) => {
    const key = `${client.access_code || ''}|${client.user_email}`;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const handleToggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      if (prev.size === filteredClients.length && filteredClients.length > 0) {
        return new Set();
      }
      return new Set(filteredClients.map((c) => `${c.access_code || ''}|${c.user_email}`));
    });
  }, [filteredClients]);

  // Delete handlers
  const handleDeleteClient = useCallback((client) => {
    setDeleteModal({
      isOpen: true,
      clients: [
        {
          user_name: client.user_name,
          user_email: client.user_email,
          access_code: client.access_code,
        },
      ],
    });
  }, []);

  const handleDeleteSelected = useCallback(() => {
    const toDelete = filteredClients
      .filter((c) => selectedIds.has(`${c.access_code || ''}|${c.user_email}`))
      .map((c) => ({
        user_name: c.user_name,
        user_email: c.user_email,
        access_code: c.access_code,
      }));
    if (toDelete.length === 0) return;
    setDeleteModal({ isOpen: true, clients: toDelete });
  }, [filteredClients, selectedIds]);

  const handleConfirmDelete = useCallback(async () => {
    setDeleteLoading(true);
    try {
      const isLocal = window.location.hostname === 'localhost';

      for (const c of deleteModal.clients) {
        if (isLocal) {
          // Mock delete: remove from local state
          setClients((prev) =>
            prev.filter(
              (cl) => !(cl.access_code === c.access_code && cl.user_email === c.user_email),
            ),
          );
        } else {
          await deleteClient(c.access_code, c.user_email);
        }
      }

      setDeleteModal({ isOpen: false, clients: [] });
      setSelectedIds(new Set());
      setExpandedClient(null);
      setClientDetails(null);

      if (!isLocal) await handleRefresh();
    } catch (err) {
      console.error('Delete failed:', err);
    } finally {
      setDeleteLoading(false);
    }
  }, [deleteModal.clients, deleteClient, handleRefresh]);

  const handleCloseDeleteModal = useCallback(() => {
    if (!deleteLoading) {
      setDeleteModal({ isOpen: false, clients: [] });
    }
  }, [deleteLoading]);

  const handleUpdateMaxes = useCallback(
    async (client, maxes) => {
      try {
        await updateClientMaxes(client.access_code, client.user_email, maxes);
        // Refresh clients to get updated data
        const clientsData = await fetchClients();
        if (clientsData) setClients(clientsData);
        return true;
      } catch (err) {
        console.error('Failed to update maxes:', err);
        return false;
      }
    },
    [updateClientMaxes, fetchClients],
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-[#667eea] to-[#764ba2] text-white px-4 py-6 sm:py-8 shadow-lg">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl sm:text-3xl font-bold">Trainer Dashboard</h1>
          <p className="text-white/80 mt-1 text-sm sm:text-base">
            Manage your clients and programs
          </p>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <StatsCards stats={stats} />

        <SearchBar
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          sortBy={sortBy}
          onSortChange={setSortBy}
          onRefresh={handleRefresh}
        />

        <ClientTable
          clients={filteredClients}
          selectedIds={selectedIds}
          expandedClient={expandedClient}
          clientDetails={clientDetails}
          detailsLoading={detailsLoading}
          onToggleSelect={handleToggleSelect}
          onToggleSelectAll={handleToggleSelectAll}
          onViewDetails={handleViewDetails}
          onDeleteClient={handleDeleteClient}
          onCloseDetails={() => {
            setExpandedClient(null);
            setClientDetails(null);
          }}
          onUpdateMaxes={handleUpdateMaxes}
        />

        <BulkActions
          selectedCount={selectedIds.size}
          onDeleteSelected={handleDeleteSelected}
        />
      </main>

      {/* Delete Modal */}
      <DeleteModal
        isOpen={deleteModal.isOpen}
        onClose={handleCloseDeleteModal}
        onConfirm={handleConfirmDelete}
        clients={deleteModal.clients}
        loading={deleteLoading}
      />
    </div>
  );
}
