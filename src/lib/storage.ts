import type { Activity, NewActivity } from './types';

const STORAGE_KEY = 'cardio-tracker:activities:v1';

function readAll(): Activity[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

function writeAll(activities: Activity[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(activities));
}

export function getActivities(): Activity[] {
  return readAll().sort((a, b) => b.date.localeCompare(a.date));
}

export function addActivity(activity: NewActivity): Activity {
  const full: Activity = {
    ...activity,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  const all = readAll();
  all.push(full);
  writeAll(all);
  return full;
}

export function addActivities(activities: NewActivity[]): Activity[] {
  const all = readAll();
  const created: Activity[] = activities.map((a) => ({
    ...a,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  }));
  writeAll([...all, ...created]);
  return created;
}

export function updateActivity(id: string, patch: Partial<NewActivity>): void {
  const all = readAll();
  const idx = all.findIndex((a) => a.id === id);
  if (idx === -1) return;
  all[idx] = { ...all[idx], ...patch };
  writeAll(all);
}

export function deleteActivity(id: string): void {
  const all = readAll().filter((a) => a.id !== id);
  writeAll(all);
}

export function deleteAllActivities(): void {
  writeAll([]);
}

// Dedupe key used to avoid re-importing the same Strava activity twice:
// same date + type + distance (rounded) + duration (rounded to nearest 5s).
function dedupeKey(a: Pick<Activity, 'date' | 'type' | 'distanceMiles' | 'durationSeconds'>): string {
  return [
    a.date,
    a.type,
    a.distanceMiles.toFixed(2),
    Math.round(a.durationSeconds / 5) * 5,
  ].join('|');
}

export function addActivitiesDeduped(activities: NewActivity[]): {
  added: Activity[];
  skipped: number;
} {
  const all = readAll();
  const existingKeys = new Set(all.map(dedupeKey));
  const toAdd: Activity[] = [];
  let skipped = 0;

  for (const a of activities) {
    const key = dedupeKey(a);
    if (existingKeys.has(key)) {
      skipped++;
      continue;
    }
    existingKeys.add(key);
    toAdd.push({
      ...a,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    });
  }

  writeAll([...all, ...toAdd]);
  return { added: toAdd, skipped };
}

export function exportActivitiesJson(): string {
  return JSON.stringify(readAll(), null, 2);
}

export function importActivitiesJson(json: string): void {
  const parsed = JSON.parse(json);
  if (!Array.isArray(parsed)) throw new Error('Invalid backup file');
  writeAll(parsed);
}
