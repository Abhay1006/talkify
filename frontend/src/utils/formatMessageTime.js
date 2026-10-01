const timeFormat = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" });
const dayFormat = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" });
const dayYearFormat = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" });

const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * "14:05" today, "Yesterday 14:05", "3 Mar 14:05" this year, "3 Mar 2025 14:05"
 * otherwise. Showing only the time made yesterday's messages look like today's.
 */
export function formatMessageTime(value, now = new Date()) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const time = timeFormat.format(date);
  const daysAgo = Math.round((startOfDay(now) - startOfDay(date)) / DAY_MS);

  if (daysAgo === 0) return time;
  if (daysAgo === 1) return `Yesterday ${time}`;
  if (date.getFullYear() === now.getFullYear()) return `${dayFormat.format(date)} ${time}`;
  return `${dayYearFormat.format(date)} ${time}`;
}
