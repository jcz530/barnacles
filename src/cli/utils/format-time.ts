import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime.js';

// Configure dayjs
dayjs.extend(relativeTime);

/**
 * Format a date to a relative time string like "2 weeks ago"
 */
export function formatTimeAgo(date: Date | null | undefined): string {
  if (!date) return 'never';
  return dayjs(date).fromNow();
}
