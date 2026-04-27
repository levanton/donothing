export function timerDisplay(seconds: number): string {
  // Always render as MM:SS — slider tops out at 60 min so the hours
  // form was never reachable in the running screen, and "60:00"
  // reads more cleanly than "1:00:00".
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function formatTimeShort(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;

  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  if (h > 0) {
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

/** For stats display — returns { value, unit } for split rendering */
export function formatTimeStat(seconds: number): { value: string; unit: string } {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);

  if (d > 0) {
    if (h === 0) return { value: `${d}`, unit: d === 1 ? 'day' : 'days' };
    return { value: `${d}d ${h}h`, unit: '' };
  }
  if (h === 0) return { value: `${m}`, unit: 'min' };
  if (m === 0) return { value: `${h}`, unit: 'hr' };
  return { value: `${h}:${String(m).padStart(2, '0')}`, unit: 'hr' };
}
