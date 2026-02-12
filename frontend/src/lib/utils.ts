/**
 * Converts an ISO date string to a human-readable relative time string.
 * Examples: "just now", "2m ago", "5h ago", "3d ago", "2mo ago", "1y ago"
 */
export function timeAgo(date: string): string {
  const now = Date.now();
  const then = new Date(date).getTime();
  const seconds = Math.floor((now - then) / 1000);

  if (seconds < 60) return 'just now';

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;

  const years = Math.floor(months / 12);
  return `${years}y ago`;
}

/**
 * Formats a number into a compact human-readable string.
 * Examples: 0 -> "0", 999 -> "999", 1200 -> "1.2k", 3400000 -> "3.4M"
 */
export function formatNumber(n: number): string {
  if (n < 0) return `-${formatNumber(-n)}`;

  if (n < 1000) return String(n);

  if (n < 1_000_000) {
    const val = n / 1000;
    return val % 1 === 0 ? `${val}k` : `${parseFloat(val.toFixed(1))}k`;
  }

  if (n < 1_000_000_000) {
    const val = n / 1_000_000;
    return val % 1 === 0 ? `${val}M` : `${parseFloat(val.toFixed(1))}M`;
  }

  const val = n / 1_000_000_000;
  return val % 1 === 0 ? `${val}B` : `${parseFloat(val.toFixed(1))}B`;
}
