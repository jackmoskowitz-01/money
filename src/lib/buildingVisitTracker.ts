const STORAGE_KEY = 'building-visit-log';

export type BuildingVisitLog = Record<string, number>; // buildingId -> timestamp

export function getVisitLog(): BuildingVisitLog {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function recordVisit(buildingId: string) {
  const log = getVisitLog();
  log[buildingId] = Date.now();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(log));
  return log;
}

export function isStale(buildingId: string, thresholdDays: number): boolean {
  const log = getVisitLog();
  const lastVisit = log[buildingId];
  if (!lastVisit) return true; // never visited = stale
  const elapsed = Date.now() - lastVisit;
  return elapsed > thresholdDays * 24 * 60 * 60 * 1000;
}

export function getLastVisitLabel(buildingId: string): string {
  const log = getVisitLog();
  const lastVisit = log[buildingId];
  if (!lastVisit) return 'Never viewed';
  const days = Math.floor((Date.now() - lastVisit) / (24 * 60 * 60 * 1000));
  if (days === 0) return 'Viewed today';
  if (days === 1) return 'Viewed yesterday';
  return `Viewed ${days}d ago`;
}

const THRESHOLD_KEY = 'territory-threshold-days';

export function getThresholdDays(): number {
  try {
    const v = localStorage.getItem(THRESHOLD_KEY);
    return v ? parseInt(v, 10) : 14;
  } catch {
    return 14;
  }
}

export function setThresholdDays(days: number) {
  localStorage.setItem(THRESHOLD_KEY, JSON.stringify(days));
}
