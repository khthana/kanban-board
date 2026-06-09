// Helpers for the YYYY-MM-DD strings used for card due dates.
// Dates are treated as local calendar days (no time component / timezone shift).

export function fromYMD(str) {
  if (!str) return null;
  const [y, m, d] = str.split('-').map(Number);
  if (isNaN(y) || isNaN(m) || isNaN(d)) return null;
  return new Date(y, m - 1, d);
}

export function toYMD(date) {
  if (!date) return null;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatDueDate(str, locale = 'th-TH') {
  const date = fromYMD(str);
  if (!date) return null;
  return date.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function isOverdue(str) {
  const date = fromYMD(str);
  if (!date) return false;
  return date < new Date(new Date().toDateString());
}
