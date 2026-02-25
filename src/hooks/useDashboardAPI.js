import { useState, useCallback } from 'react';

const getAjaxUrl = () => window.trainerDashboard?.ajaxUrl || '/wp-admin/admin-ajax.php';
const getNonce = () => window.trainerDashboard?.nonce || '';
const getApiBase = () => {
  // Use Netlify proxy to avoid CORS issues
  if (window.location.hostname !== 'localhost') {
    return '/api';
  }
  return window.trainerDashboard?.apiBase || 'https://bestrongagain.com/workout-programs/api/general';
};

export default function useDashboardAPI() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const wpAjax = useCallback(async (action, data = {}) => {
    const form = new FormData();
    form.append('action', action);
    form.append('nonce', getNonce());
    Object.entries(data).forEach(([k, v]) => form.append(k, v));
    const res = await fetch(getAjaxUrl(), { method: 'POST', body: form });
    const json = await res.json();
    if (!json.success) throw new Error(json.data?.message || 'Request failed');
    return json.data;
  }, []);

  const externalApi = useCallback(async (endpoint, payload) => {
    const res = await fetch(`${getApiBase()}/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message || 'API request failed');
    return json.data || json;
  }, []);

  const fetchClients = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (window.location.hostname === 'localhost') return getMockClients();
      return await externalApi('get-clients.php', {});
    } catch (err) {
      setError(err.message);
      if (window.location.hostname === 'localhost') return getMockClients();
      return [];
    } finally {
      setLoading(false);
    }
  }, [externalApi]);

  const fetchStats = useCallback(async () => {
    try {
      if (window.location.hostname === 'localhost') {
        return { active_clients: 12, workouts_this_week: 34, total_workouts: 892, avg_completion: 78 };
      }
      return await externalApi('get-dashboard-stats.php', {});
    } catch {
      return { active_clients: 0, workouts_this_week: 0, total_workouts: 0, avg_completion: 0 };
    }
  }, [externalApi]);

  const fetchClientDetails = useCallback(
    async (accessCode, userEmail) => {
      setLoading(true);
      try {
        if (window.location.hostname === 'localhost') return getMockClientDetails();
        return await externalApi('get-client-details.php', {
          access_code: accessCode,
          user_email: userEmail,
        });
      } catch (err) {
        setError(err.message);
        if (window.location.hostname === 'localhost') return getMockClientDetails();
        return null;
      } finally {
        setLoading(false);
      }
    },
    [externalApi],
  );

  const deleteClient = useCallback(
    async (accessCode, userEmail) => {
      return await externalApi('delete-client.php', {
        access_code: accessCode,
        user_email: userEmail,
      });
    },
    [externalApi],
  );

  const loadProgram = useCallback(
    async (code, email, week, day) => {
      return await externalApi('load-program.php', {
        code,
        email,
        requested_week: week,
        requested_day: day,
      });
    },
    [externalApi],
  );

  const loadUserOverride = useCallback(
    async (accessCode, userEmail, week, day) => {
      return await externalApi(`load-user-override.php?t=${Date.now()}`, {
        accessCode,
        userEmail,
        week,
        day,
      });
    },
    [externalApi],
  );

  const saveUserOverride = useCallback(
    async (accessCode, userEmail, week, day, workoutData, reason) => {
      return await externalApi('save-user-override.php', {
        accessCode,
        userEmail,
        week,
        day,
        workoutData,
        overrideReason: reason,
      });
    },
    [externalApi],
  );

  const deleteUserOverride = useCallback(
    async (accessCode, userEmail, week, day) => {
      return await externalApi('delete-user-override.php', {
        accessCode,
        userEmail,
        week,
        day,
      });
    },
    [externalApi],
  );

  const updateClientMaxes = useCallback(
    async (accessCode, userEmail, maxes) => {
      return await externalApi('update-client-maxes.php', {
        access_code: accessCode,
        user_email: userEmail,
        bench_max: maxes.bench || null,
        squat_max: maxes.squat || null,
        deadlift_max: maxes.deadlift || null,
        clean_max: maxes.clean || null,
      });
    },
    [externalApi],
  );

  return {
    loading,
    error,
    fetchClients,
    fetchStats,
    fetchClientDetails,
    deleteClient,
    loadProgram,
    loadUserOverride,
    saveUserOverride,
    deleteUserOverride,
    updateClientMaxes,
  };
}

// ── Mock data for localhost development ──
function getMockClients() {
  return [
    {
      access_code: 'ABCDE-12345',
      user_email: 'john@example.com',
      user_name: 'John Smith',
      program_name: '12-Week Strength',
      program_nickname: 'Johns Program',
      current_week: 4,
      current_day: 2,
      last_logged_date: new Date().toISOString(),
      total_workouts: 11,
      completion_rate: 92,
      days_per_week: 3,
    },
    {
      access_code: 'FGHIJ-67890',
      user_email: 'sarah@example.com',
      user_name: 'Sarah Johnson',
      program_name: '8-Week Hypertrophy',
      program_nickname: '',
      current_week: 2,
      current_day: 3,
      last_logged_date: new Date(Date.now() - 86400000).toISOString(),
      total_workouts: 6,
      completion_rate: 75,
      days_per_week: 4,
    },
    {
      access_code: 'KLMNO-11111',
      user_email: 'mike@example.com',
      user_name: 'Mike Davis',
      program_name: '6-Week Athletic',
      program_nickname: 'Mikes Athletic Build',
      current_week: 6,
      current_day: 1,
      last_logged_date: new Date(Date.now() - 86400000 * 3).toISOString(),
      total_workouts: 17,
      completion_rate: 94,
      days_per_week: 3,
    },
    {
      access_code: 'PQRST-22222',
      user_email: 'emma@example.com',
      user_name: 'Emma Wilson',
      program_name: '12-Week Strength',
      program_nickname: '',
      current_week: 1,
      current_day: 1,
      last_logged_date: null,
      total_workouts: 0,
      completion_rate: 0,
      days_per_week: 3,
    },
    {
      access_code: 'UVWXY-33333',
      user_email: 'alex@example.com',
      user_name: 'Alex Turner',
      program_name: '4-Week Conditioning',
      program_nickname: '',
      current_week: 3,
      current_day: 2,
      last_logged_date: new Date(Date.now() - 86400000 * 7).toISOString(),
      total_workouts: 8,
      completion_rate: 67,
      days_per_week: 4,
    },
    {
      access_code: 'ZZZZZ-44444',
      user_email: 'lisa@example.com',
      user_name: 'Lisa Chen',
      program_name: '12-Week Strength',
      program_nickname: 'Lisas Comeback',
      current_week: 8,
      current_day: 3,
      last_logged_date: new Date(Date.now() - 86400000).toISOString(),
      total_workouts: 23,
      completion_rate: 96,
      days_per_week: 3,
    },
  ];
}

function getMockClientDetails() {
  return {
    weekly_progress: [
      { week_number: 1, workouts_completed: 3 },
      { week_number: 2, workouts_completed: 3 },
      { week_number: 3, workouts_completed: 2 },
      { week_number: 4, workouts_completed: 3 },
    ],
    recent_workouts: [
      {
        week_number: 4,
        day_number: 2,
        workout_date: new Date().toISOString(),
        parsed_data: {
          blocks: [
            {
              type: 'straight-set',
              exercises: [
                {
                  name: 'Barbell Bench Press',
                  sets: 4,
                  reps: '8',
                  weights: [185, 195, 205, 205],
                  actualReps: [8, 8, 7, 6],
                },
                {
                  name: 'Incline Dumbbell Press',
                  sets: 3,
                  reps: '10',
                  weights: [60, 60, 60],
                  actualReps: [10, 10, 9],
                },
              ],
            },
            {
              type: 'superset',
              exercises: [
                {
                  name: 'Cable Flyes',
                  sets: 3,
                  reps: '12',
                  weights: [30, 30, 30],
                  actualReps: [12, 12, 11],
                },
                { name: 'Push-Ups', sets: 3, reps: '15', actualReps: [15, 15, 12] },
              ],
            },
          ],
          trainerNotes: 'Focus on controlled eccentric on bench.',
          clientNotes: 'Felt strong today, shoulder felt good.',
        },
      },
      {
        week_number: 4,
        day_number: 1,
        workout_date: new Date(Date.now() - 86400000 * 2).toISOString(),
        parsed_data: {
          blocks: [
            {
              type: 'straight-set',
              exercises: [
                {
                  name: 'Back Squat',
                  sets: 5,
                  reps: '5',
                  weights: [225, 235, 245, 245, 245],
                  actualReps: [5, 5, 5, 4, 3],
                },
                {
                  name: 'Romanian Deadlift',
                  sets: 3,
                  reps: '10',
                  weights: [185, 185, 185],
                  actualReps: [10, 10, 10],
                },
              ],
            },
          ],
        },
      },
      {
        week_number: 3,
        day_number: 3,
        workout_date: new Date(Date.now() - 86400000 * 5).toISOString(),
        parsed_data: {
          blocks: [
            {
              type: 'straight-set',
              exercises: [
                {
                  name: 'Overhead Press',
                  sets: 4,
                  reps: '6',
                  weights: [115, 120, 125, 125],
                  actualReps: [6, 6, 5, 4],
                },
              ],
            },
          ],
        },
      },
    ],
    completion_rate: 92,
    exercise_volume: {
      'Bench Press': {
        total: 14400,
        weekly: { 'Week 1': 3200, 'Week 2': 3600, 'Week 3': 3600, 'Week 4': 4000 },
      },
      'Back Squat': {
        total: 18000,
        weekly: { 'Week 1': 4000, 'Week 2': 4500, 'Week 3': 4500, 'Week 4': 5000 },
      },
    },
    total_logged: 11,
    expected_workouts: 12,
    days_per_week: 3,
  };
}
