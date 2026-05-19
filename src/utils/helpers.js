export function formatDate(dateStr) {
  if (!dateStr) return 'Never';

  // Calendar-day comparison in viewer's local TZ. "YYYY-MM-DD" strings get
  // parsed component-wise so they aren't pulled into UTC midnight (which
  // would render an evening-CT workout as "today" instead of "yesterday").
  let d;
  if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [y, m, da] = dateStr.split('-').map(Number);
    d = new Date(y, m - 1, da);
  } else {
    d = new Date(dateStr);
    if (!Number.isFinite(d.getTime())) return 'Never';
  }
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const that  = new Date(d.getFullYear(),    d.getMonth(),    d.getDate());
  const diff = Math.round((today.getTime() - that.getTime()) / 86400000);

  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7)   return `${diff} days ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function getBlockTypeName(type) {
  const names = {
    'straight-set': 'Straight Sets',
    superset: 'Superset',
    triset: 'Triset',
    circuit: 'Circuit / MetCon',
    warmup: 'Dynamic Warm-Up',
    mobility: 'Mobility & Stretching',
    movement: 'General Movement',
    conditioning: 'Conditioning',
    theme: 'Theme / Notes',
  };
  return names[type] || type;
}

export function getBlockIcon(type) {
  const icons = {
    'straight-set': '\uD83C\uDFCB\uFE0F',
    superset: '\uD83D\uDD04',
    triset: '\uD83D\uDD3A',
    circuit: '\u26A1',
    warmup: '\uD83D\uDD25',
    mobility: '\uD83E\uDDD8',
    movement: '\uD83C\uDFC3',
    conditioning: '\uD83D\uDCA8',
    theme: '\uD83D\uDCCB',
  };
  return icons[type] || '\uD83D\uDCE6';
}

export function completionColor(rate) {
  if (rate >= 80) return 'text-green-600';
  if (rate >= 50) return 'text-yellow-600';
  return 'text-red-500';
}

export function completionBg(rate) {
  if (rate >= 80) return 'bg-green-500';
  if (rate >= 50) return 'bg-yellow-500';
  return 'bg-red-500';
}
