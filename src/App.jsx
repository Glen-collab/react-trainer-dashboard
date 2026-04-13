import { useState, useEffect, useCallback, useMemo } from 'react';
import useDashboardAPI from './hooks/useDashboardAPI';
import StatsCards from './components/dashboard/StatsCards';
import SearchBar from './components/dashboard/SearchBar';
import ClientTable from './components/clients/ClientTable';
import BulkActions from './components/clients/BulkActions';
import DeleteModal from './components/modals/DeleteModal';
import LoginGate, { useAuth } from './components/auth/LoginGate';

export default function App() {
  const { user: authUser, loading: authLoading, login, logout } = useAuth();

  if (authLoading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading...</div>;
  if (!authUser) return <LoginGate onLogin={login} />;

  return <DashboardApp authUser={authUser} onLogout={logout} />;
}

function CoachWalkthrough({ onDismiss, isAdmin }) {
  const [step, setStep] = useState(0);
  const steps = isAdmin ? [
    { icon: '\uD83D\uDC4B', title: 'Welcome Back, Glen', text: "Your trainer dashboard — all clients, all programs, everything in one place." },
    { icon: '\u2709', title: 'Send Codes', text: "Hit the envelope icon next to any client to email them their access code and app link. No more texting codes." },
    { icon: '\uD83D\uDD0D', title: 'View Details', text: "Click any client to see their volume stats, weekly progress charts, recent workouts, and 1RM values." },
    { icon: '\u270F\uFE0F', title: 'Edit Programs', text: "Click 'Edit Program' on a client to open their workout in the builder. Changes only apply to THAT client." },
  ] : [
    { icon: '\uD83D\uDC4B', title: 'Welcome, Coach!', text: "This is your client dashboard. You'll see everyone who signed up through your referral link or is on a program you built." },
    { icon: '\uD83D\uDCCB', title: 'Build Programs', text: "Head to the Workout Builder to create programs. Save them, grab the access code, and send it to your client using the envelope button." },
    { icon: '\u2709', title: 'Send Codes', text: "Hit the envelope icon next to any client to email them their access code and a direct link to the app. One tap and they're training." },
    { icon: '\uD83D\uDD0D', title: 'View Details', text: "Click any client to see their workout logs, volume stats, and progress. This is how you stay on top of their training." },
    { icon: '\u270F\uFE0F', title: 'Override Programs', text: "Need to change something for one client? Click 'Edit Program' — your changes only affect that person, not the base program." },
    { icon: '\uD83D\uDCB0', title: 'Your Earnings', text: "You keep 80% of every client subscription. Log into app.bestrongagain.com to see your earnings, referral link, and recruited coaches." },
  ];
  const current = steps[step];
  const isLast = step === steps.length - 1;

  return (
    <div className="fixed inset-0 bg-black/70 z-[9999] flex items-center justify-center p-5">
      <div className="bg-white rounded-2xl max-w-[380px] w-full p-8 text-center shadow-2xl">
        <div className="text-5xl mb-3">{current.icon}</div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">{current.title}</h2>
        <p className="text-sm text-gray-600 leading-relaxed mb-6">{current.text}</p>
        <div className="flex justify-center gap-1.5 mb-5">
          {steps.map((_, i) => (
            <div key={i} className={`w-2 h-2 rounded-full ${i === step ? 'bg-purple-600' : 'bg-gray-200'}`} />
          ))}
        </div>
        <div className="flex gap-3 justify-center">
          {step > 0 && (
            <button onClick={() => setStep(step - 1)} className="px-6 py-2.5 border-2 border-gray-200 rounded-xl text-gray-600 font-semibold text-sm">Back</button>
          )}
          <button
            onClick={() => isLast ? onDismiss() : setStep(step + 1)}
            className={`px-8 py-2.5 rounded-xl text-white font-semibold text-sm ${isLast ? 'bg-green-600' : 'bg-gradient-to-r from-purple-500 to-indigo-600'}`}
          >{isLast ? "Let's Go!" : 'Next'}</button>
        </div>
        {!isLast && (
          <button onClick={onDismiss} className="mt-3 text-xs text-gray-400 bg-transparent border-none cursor-pointer">Skip</button>
        )}
      </div>
    </div>
  );
}

function DashboardApp({ authUser, onLogout }) {
  const { fetchClients, fetchStats, fetchClientDetails, deleteClient, updateClientMaxes, sendCodeToClient } = useDashboardAPI(authUser);

  // First-time walkthrough
  const walkthroughKey = `bsa_dashboard_walkthrough_${authUser.id}`;
  const [showWalkthrough, setShowWalkthrough] = useState(() => {
    try { return !localStorage.getItem(walkthroughKey); } catch { return false; }
  });
  const dismissWalkthrough = () => {
    setShowWalkthrough(false);
    try { localStorage.setItem(walkthroughKey, 'true'); } catch {}
  };

  const handleSendCode = useCallback(async (client) => {
    const coachName = authUser?.first_name || 'Your Coach';
    try {
      await sendCodeToClient(client.access_code, client.user_email, client.user_name || client.name, coachName);
      alert(`Access code sent to ${client.user_email}`);
    } catch (err) {
      alert('Failed to send: ' + err.message);
    }
  }, [sendCodeToClient, authUser]);

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

  // Initial fetch with retry on failure (first load after deploy can fail due to cold start)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const [clientsData, statsData] = await Promise.all([fetchClients(), fetchStats()]);
          if (cancelled) return;
          if (clientsData) setClients(clientsData);
          if (statsData) setStats(statsData);
          return; // success, stop retrying
        } catch {
          if (cancelled) return;
          if (attempt < 2) await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
        }
      }
    })();
    return () => { cancelled = true; };
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
      {showWalkthrough && <CoachWalkthrough onDismiss={dismissWalkthrough} isAdmin={authUser.role === 'admin'} />}
      {/* Header */}
      <header className="bg-gradient-to-r from-[#667eea] to-[#764ba2] text-white px-4 py-6 sm:py-8 shadow-lg">
        <div className="max-w-7xl mx-auto flex justify-between items-start">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">
              {authUser.role === 'coach' ? 'Coach Dashboard' : 'Trainer Dashboard'}
            </h1>
            <p className="text-white/80 mt-1 text-sm sm:text-base">
              {authUser.first_name ? `Welcome, ${authUser.first_name}` : 'Manage your clients and programs'}
            </p>
          </div>
          <button
            onClick={onLogout}
            className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg text-sm font-semibold transition"
          >
            Logout
          </button>
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
          onSendCode={handleSendCode}
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
