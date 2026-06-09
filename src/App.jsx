import { useState, useEffect, useCallback, useMemo } from 'react';
import useDashboardAPI from './hooks/useDashboardAPI';
import StatsCards from './components/dashboard/StatsCards';
import SearchBar from './components/dashboard/SearchBar';
import TriageFilters from './components/dashboard/TriageFilters';
import ClientTable from './components/clients/ClientTable';
import BulkActions from './components/clients/BulkActions';
import BulkWeeklySummary from './components/clients/BulkWeeklySummary';
import DeleteModal from './components/modals/DeleteModal';
import LoginGate, { useAuth } from './components/auth/LoginGate';
import { triageBucket } from './utils/progress';

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

  const [sendCodeModal, setSendCodeModal] = useState(null); // { client, programs }
  const [sendCodeLoading, setSendCodeLoading] = useState(false);
  const [myPrograms, setMyPrograms] = useState([]);

  // Load coach's programs for the send code picker
  useEffect(() => {
    if (!authUser?.email) return;
    (async () => {
      try {
        const res = await fetch(`https://app.bestrongagain.com/api/workout/list-programs.php`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: authUser.email }),
        });
        const data = await res.json();
        if (data.success && data.data?.programs) {
          setMyPrograms(data.data.programs);
        }
      } catch {}
    })();
  }, [authUser?.email]);

  const handleSendCode = useCallback((client) => {
    setSendCodeModal({ client, selectedCode: client.access_code || '' });
  }, []);

  const handleSendCodeConfirm = useCallback(async (code) => {
    if (!sendCodeModal) return;
    const { client } = sendCodeModal;
    const coachName = authUser?.first_name || 'Your Coach';
    setSendCodeLoading(true);
    try {
      await sendCodeToClient(code, client.user_email, client.user_name || client.name, coachName);
      setSendCodeModal(null);
      alert(`Code ${code} sent to ${client.user_email}`);
    } catch (err) {
      alert('Failed to send: ' + err.message);
    }
    setSendCodeLoading(false);
  }, [sendCodeModal, sendCodeToClient, authUser]);

  const [clients, setClients] = useState([]);
  const [stats, setStats] = useState({
    active_clients: 0,
    workouts_this_week: 0,
    total_workouts: 0,
    avg_completion: 0,
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('recent');
  const [triageFilter, setTriageFilter] = useState('all');
  // Tracker-only ($5.99) clients live in their own segment so they don't
  // clutter the coaching roster. Default = coaching (the people Glen actually
  // works with day to day). The tracker segment is the upsell radar.
  const [tierSegment, setTierSegment] = useState('coaching'); // 'coaching' | 'tracker'
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [expandedClient, setExpandedClient] = useState(null);
  const [clientDetails, setClientDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, clients: [] });
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [bulkSummaryOpen, setBulkSummaryOpen] = useState(false);

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

  // Collapse multiple program rows for the same user into one consolidated
  // card. Primary = most-recently-active program; the rest get attached as
  // other_programs[] for the View Details panel. Triage chips + filters use
  // this grouped list too, so counts reflect unique people not programs.
  const groupedClients = useMemo(() => {
    const lastActiveTs = (c) => {
      const d = c.last_logged_date || c.last_workout || c.lastWorkout || c.updated_at || 0;
      const t = new Date(d).getTime();
      return Number.isFinite(t) ? t : 0;
    };
    const byEmail = new Map();
    for (const c of clients) {
      const key = (c.user_email || '').toLowerCase();
      if (!key) continue;
      const existing = byEmail.get(key);
      if (!existing) {
        byEmail.set(key, { primary: c, others: [] });
        continue;
      }
      if (lastActiveTs(c) > lastActiveTs(existing.primary)) {
        existing.others.push(existing.primary);
        existing.primary = c;
      } else {
        existing.others.push(c);
      }
    }
    return [...byEmail.values()].map(({ primary, others }) => {
      const primaryLogs = Number(primary.workout_count ?? primary.workoutCount ?? primary.total_workouts) || 0;
      const otherLogs = others.reduce(
        (sum, p) => sum + (Number(p.workout_count ?? p.workoutCount ?? p.total_workouts) || 0),
        0,
      );
      return {
        ...primary,
        // user_workout_count = total across ALL programs (primary + others).
        // Used by triageBucket so "Not Started" catches users with zero
        // logs anywhere, not just zero on their primary program.
        user_workout_count: primaryLogs + otherLogs,
        other_programs: others.map((p) => ({
          access_code:   p.access_code || p.accessCode,
          user_email:    p.user_email,
          user_name:     p.user_name || p.name,
          program_name:  p.program_nickname || p.program_name || '(unnamed)',
          current_week:  p.current_week || p.currentWeek || 1,
          current_day:   p.current_day  || p.currentDay  || 1,
          workout_count: p.workout_count || p.workoutCount || p.total_workouts || 0,
          last_workout:  p.last_logged_date || p.last_workout || p.lastWorkout,
          completion_rate: p.completion_rate || 0,
        })),
      };
    });
  }, [clients]);

  // Split the roster into coaching vs tracker-only ($5.99) segments. A client
  // is "tracker-only" purely by their Stripe tier. Everyone else (coached,
  // elite, basic, or access-code-only members) is a coaching client.
  const isTrackerOnly = (c) => (c.plan_tier || '').toLowerCase() === 'tracker';
  const trackerCount = useMemo(() => groupedClients.filter(isTrackerOnly).length, [groupedClients]);
  const coachingCount = groupedClients.length - trackerCount;
  const segmentClients = useMemo(
    () => groupedClients.filter((c) => (tierSegment === 'tracker' ? isTrackerOnly(c) : !isTrackerOnly(c))),
    [groupedClients, tierSegment],
  );

  // Filtered + sorted clients
  const filteredClients = useMemo(() => {
    let result = [...segmentClients].filter((c) => {
      const term = searchTerm.toLowerCase();
      const matchesSearch =
        (c.user_name || '').toLowerCase().includes(term) ||
        (c.user_email || '').toLowerCase().includes(term);
      if (!matchesSearch) return false;
      if (triageFilter !== 'all' && triageBucket(c) !== triageFilter) return false;
      return true;
    });

    // Paid clients always sort to the top regardless of secondary sort —
    // they're paying money, they deserve the eyeballs first.
    const isPaid = (c) => c.plan_status === 'active';
    const secondary = (a, b) => {
      switch (sortBy) {
        case 'name':
          return (a.user_name || a.user_email || '').localeCompare(b.user_name || b.user_email || '');
        case 'completion':
          return (b.completion_rate || 0) - (a.completion_rate || 0);
        case 'recent':
        default: {
          // Real API returns last_workout / lastWorkout; mock uses last_logged_date.
          const ad = a.last_logged_date || a.last_workout || a.lastWorkout || 0;
          const bd = b.last_logged_date || b.last_workout || b.lastWorkout || 0;
          return new Date(bd) - new Date(ad);
        }
      }
    };

    result.sort((a, b) => {
      const ap = isPaid(a), bp = isPaid(b);
      if (ap !== bp) return ap ? -1 : 1;
      return secondary(a, b);
    });

    return result;
  }, [segmentClients, searchTerm, sortBy, triageFilter]);

  // View details. With one-card-per-user grouping, a user's card has the
  // SAME user_email but may host multiple program access codes (primary +
  // others). Toggle-collapse fires only when the same email is being
  // re-clicked from the table — switching to a different PROGRAM under
  // the same email passes skipToggle=true to bypass the collapse path.
  const handleViewDetails = useCallback(
    async (client, opts = {}) => {
      const skipToggle = !!opts.skipToggle;
      if (
        !skipToggle &&
        expandedClient &&
        expandedClient.user_email === client.user_email
      ) {
        setExpandedClient(null);
        setClientDetails(null);
        return;
      }

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

  // X button on the details panel — smarter than a hard close. If the
  // user is currently looking at a non-primary program (they navigated via
  // Other Programs), X takes them BACK to their primary program first.
  // A second X closes the whole card. Matches the back-stack intuition.
  const handleCloseDetails = useCallback(() => {
    if (!expandedClient) return;
    const userCard = groupedClients.find(
      (c) => (c.user_email || '').toLowerCase() === (expandedClient.user_email || '').toLowerCase(),
    );
    // Already on the primary (or user not found in grouped list) → close.
    if (!userCard || userCard.access_code === expandedClient.access_code) {
      setExpandedClient(null);
      setClientDetails(null);
      return;
    }
    // Otherwise hop back to the primary, keeping the card open.
    handleViewDetails(userCard, { skipToggle: true });
  }, [expandedClient, groupedClients, handleViewDetails]);

  // Swap the expanded-detail focus to one of the user's other programs.
  // Direct call into handleViewDetails — the toggle-collapse check compares
  // access_codes, and since the target program's code differs from the
  // currently-expanded one, it doesn't collapse, just swaps focus.
  const handleSwitchProgram = useCallback((program) => {
    if (!expandedClient) return;
    const prevAsProgram = {
      access_code:   expandedClient.access_code,
      user_email:    expandedClient.user_email,
      user_name:     expandedClient.user_name,
      program_name:  expandedClient.program_nickname || expandedClient.program_name,
      current_week:  expandedClient.current_week,
      current_day:   expandedClient.current_day,
      workout_count: expandedClient.workout_count || expandedClient.total_workouts,
      last_workout:  expandedClient.last_logged_date || expandedClient.last_workout,
      completion_rate: expandedClient.completion_rate,
    };
    const newOthers = (expandedClient.other_programs || [])
      .filter((p) => p.access_code !== program.access_code)
      .concat([prevAsProgram]);
    const newPrimary = {
      user_email: expandedClient.user_email,
      email:      expandedClient.user_email,
      user_name:  expandedClient.user_name,
      name:       expandedClient.user_name,
      access_code:   program.access_code,
      program_name:  program.program_name,
      current_week:  program.current_week,
      current_day:   program.current_day,
      workout_count: program.workout_count,
      total_workouts: program.workout_count,
      completion_rate: program.completion_rate,
      last_workout:  program.last_workout,
      last_logged_date: program.last_workout,
      // plan is per-user, not per-program, so carry it
      plan_tier:         expandedClient.plan_tier,
      plan_amount_cents: expandedClient.plan_amount_cents,
      plan_status:       expandedClient.plan_status,
      other_programs:    newOthers,
    };
    // skipToggle=true — same user but a different program, don't collapse.
    handleViewDetails(newPrimary, { skipToggle: true });
  }, [expandedClient, handleViewDetails]);

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
          <div className="flex items-center gap-2">
            {/* Same-tab return to the coach platform so you can get back to
                the app without hunting for a browser tab. */}
            <a
              href="https://app.bestrongagain.com"
              className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg text-sm font-semibold transition no-underline"
              title="Back to app.bestrongagain.com"
            >
              ← My App
            </a>
            <button
              onClick={onLogout}
              className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg text-sm font-semibold transition"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <StatsCards stats={stats} />

        {/* Segment toggle: coaching roster vs tracker-only ($5.99) upsell radar.
            Only shows the tracker tab once at least one $5.99 client exists. */}
        {trackerCount > 0 && (
          <div className="flex gap-2 bg-white rounded-xl shadow-sm p-1.5 w-fit">
            {[
              { key: 'coaching', label: 'Coaching', count: coachingCount },
              { key: 'tracker', label: 'Tracker-only · $5.99', count: trackerCount },
            ].map((seg) => {
              const active = tierSegment === seg.key;
              return (
                <button
                  key={seg.key}
                  onClick={() => { setTierSegment(seg.key); setTriageFilter('all'); }}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                    active
                      ? 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow'
                      : 'text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  {seg.label}
                  <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${active ? 'bg-white/25' : 'bg-gray-200 text-gray-600'}`}>
                    {seg.count}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {tierSegment === 'tracker' && (
          <p className="text-sm text-gray-500 -mt-2">
            Self-serve members on the $5.99 tracker. Sorted by most recent activity —
            the ones logging workouts are the warm upsell candidates for a $20+ plan.
          </p>
        )}

        <SearchBar
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          sortBy={sortBy}
          onSortChange={setSortBy}
          onRefresh={handleRefresh}
        />

        <TriageFilters
          clients={segmentClients}
          activeFilter={triageFilter}
          onChange={setTriageFilter}
        />

        {/* Bulk weekly summaries — generate a draft for everyone in view, review,
            then post to dashboards. Hidden on the tracker-only segment (those
            $5.99 clients have no dashboard). */}
        {tierSegment !== 'tracker' && filteredClients.length > 0 && (
          <div className="flex justify-end -mt-2">
            <button
              onClick={() => setBulkSummaryOpen(true)}
              className="px-4 py-2 rounded-lg bg-white shadow-sm text-sm font-semibold text-indigo-600 hover:bg-indigo-50 border border-indigo-100"
            >
              📝 Weekly summaries → all ({filteredClients.length})
            </button>
          </div>
        )}

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
          onCloseDetails={handleCloseDetails}
          onUpdateMaxes={handleUpdateMaxes}
          onSendCode={handleSendCode}
          onSwitchProgram={handleSwitchProgram}
        />

        <BulkActions
          selectedCount={selectedIds.size}
          onDeleteSelected={handleDeleteSelected}
        />
      </main>

      {/* Bulk weekly summaries — review & post to all clients in view */}
      {bulkSummaryOpen && (
        <BulkWeeklySummary
          clients={filteredClients}
          fetchClientDetails={fetchClientDetails}
          onClose={() => setBulkSummaryOpen(false)}
        />
      )}

      {/* Delete Modal */}
      <DeleteModal
        isOpen={deleteModal.isOpen}
        onClose={handleCloseDeleteModal}
        onConfirm={handleConfirmDelete}
        clients={deleteModal.clients}
        loading={deleteLoading}
      />

      {/* Send Code Modal */}
      {sendCodeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4" onClick={() => setSendCodeModal(null)}>
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-purple-500 to-indigo-600 px-6 py-4">
              <h3 className="text-white text-lg font-bold m-0">Send Program Code</h3>
              <p className="text-white/70 text-sm mt-1 m-0">To: {sendCodeModal.client.user_name || sendCodeModal.client.name} ({sendCodeModal.client.user_email})</p>
            </div>
            <div className="p-6">
              <label className="block text-sm font-semibold text-gray-600 mb-2">Select Program</label>
              <div className="max-h-64 overflow-y-auto mb-4 border border-gray-200 rounded-xl">
                {myPrograms.length === 0 ? (
                  <div className="p-4 text-center text-gray-400 text-sm">No programs found</div>
                ) : (
                  myPrograms.map((p) => (
                    <button
                      key={p.accessCode}
                      onClick={() => setSendCodeModal(prev => ({ ...prev, selectedCode: p.accessCode }))}
                      className={`w-full text-left px-4 py-3 border-b border-gray-100 transition-colors ${
                        sendCodeModal.selectedCode === p.accessCode
                          ? 'bg-purple-50 border-l-4 border-l-purple-500'
                          : 'hover:bg-gray-50 border-l-4 border-l-transparent'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <div className="font-semibold text-gray-900 text-sm">{p.name}</div>
                          <div className="text-xs text-gray-500 mt-0.5">{p.daysPerWeek} days/wk &middot; {p.totalWeeks} weeks</div>
                        </div>
                        <div className="text-right">
                          <div className="font-mono font-bold text-purple-600 text-base">{p.accessCode}</div>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => handleSendCodeConfirm(sendCodeModal.selectedCode)}
                  disabled={!sendCodeModal.selectedCode || sendCodeLoading}
                  className="flex-1 py-3 bg-gradient-to-r from-purple-500 to-indigo-600 text-white font-semibold rounded-xl disabled:opacity-50"
                >
                  {sendCodeLoading ? 'Sending...' : `Send Code ${sendCodeModal.selectedCode || ''}`}
                </button>
                <button
                  onClick={() => setSendCodeModal(null)}
                  className="py-3 px-5 border-2 border-gray-200 text-gray-600 font-semibold rounded-xl hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
