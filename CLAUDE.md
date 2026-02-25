# React Trainer Dashboard

## What This Is
A dashboard for fitness trainers to view/manage clients, track their progress, edit programs, and monitor volume stats. Lives inside the `react-workout-builder` repo as a sub-project.

**Stack:** React 19, Vite 7, Tailwind 4, Chart.js 4.5
**Build:** `npm run build` -> `dist/dashboard.js` + `dist/dashboard.css`
**Mount:** `#td-react-root` (WordPress) or `#root` (standalone)
**Netlify:** `bsa-trainer-dashboard.netlify.app` — API proxy `/api/*` -> `bestrongagain.com` + SPA redirect
**Netlify config:** `netlify.toml` has both `/api/*` proxy and `/*` SPA redirect

---

## File Structure

```
src/
  App.jsx              # Main dashboard: state, search/sort, client expansion, bulk actions
  main.jsx             # Entry point
  index.css            # Tailwind imports + slide-up/fade-in animations
  App.css              # Legacy (unused Vite template CSS)

  hooks/
    useDashboardAPI.js # All API calls + localhost mock data (375 lines)

  utils/
    helpers.js         # formatDate, getBlockTypeName, getBlockIcon, completionColor/Bg

  components/
    dashboard/
      StatsCards.jsx   # 4-metric grid: active clients, workouts this week, total, avg completion
      SearchBar.jsx    # Search input + sort dropdown + refresh button
    clients/
      ClientTable.jsx  # Responsive: card list (mobile) / HTML table (desktop) with inline details
      ClientDetails.jsx # Expanded view: charts, volume stats, 1RM editor, edit program button
      RecentWorkouts.jsx # Week-grouped accordion of logged workouts with block/exercise details
      BulkActions.jsx  # Fixed bottom bar for bulk delete (visible when selection > 0)
    charts/
      WeeklyProgressChart.jsx # Line chart: workouts completed per week
      VolumeChart.jsx  # Interactive metric tabs (tonnage/calories/core/cardio time/distance)
    modals/
      DeleteModal.jsx  # Confirmation modal for single/bulk client deletion
      CustomWorkoutEditor.jsx # Partially implemented, unused
```

---

## API Endpoints (useDashboardAPI.js)

**Base URL:** Production uses Netlify proxy `/api` or `window.trainerDashboard.apiBase`. Localhost hits `bestrongagain.com` directly.

| Endpoint | Purpose | Response |
|----------|---------|----------|
| `get-clients.php` | List all clients | Array of client objects |
| `get-dashboard-stats.php` | Dashboard metrics | { active_clients, workouts_this_week, total_workouts, avg_completion } |
| `get-client-details.php` | Expanded client data | { weekly_progress, recent_workouts, volume_stats } |
| `delete-client.php` | Remove client | { success } |
| `update-client-maxes.php` | Save 1RM values | { success } (bench_max, squat_max, deadlift_max, clean_max) |

Also exports (unused in dashboard): `loadProgram`, `loadUserOverride`, `saveUserOverride`, `deleteUserOverride`

**Localhost Mock:** 6 sample clients with realistic data, mock detail objects with weekly progress.

---

## App State

```js
clients[]              // All clients array
stats{}                // Dashboard metrics
searchTerm             // Name/email filter
sortBy                 // 'recent' | 'name' | 'completion'
selectedIds            // Set of 'accessCode|email' keys for bulk actions
expandedClient         // Currently expanded client key
clientDetails          // Detailed data for expanded client
deleteModal            // { isOpen, clients[] }
```

---

## Key Interactions

1. **Initial load:** Fetches clients + stats on mount
2. **Search/Sort:** `useMemo` filters and sorts in real-time
3. **View Details:** Click -> async fetch details -> expand row/card inline
4. **Edit Program:** Opens Workout Builder in new window with `?accessCode=X&email=Y&mode=override`
5. **Bulk Delete:** Checkbox selection -> Delete Selected -> confirmation modal
6. **Update 1RM:** Collapsible editor in ClientDetails (UI exists but wiring incomplete)

---

## Window Configuration

```js
window.trainerDashboard = { ajaxUrl, nonce, apiBase }  // WordPress injection
window.tdConfig = { builderUrl: 'https://workoutbuild.netlify.app' }  // Builder link
```

---

## Design System

- **Primary gradient:** `from-purple-500 to-indigo-600` / `#667eea -> #764ba2`
- **Completion colors:** green (>=80%), yellow (>=50%), red (<50%)
- **Layout:** Responsive - 1col mobile, 2col tablet, 4col desktop (stats grid)
- **Components:** All Tailwind utility classes, no component library
