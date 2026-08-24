import type { Activity, NewActivity } from './types';

const STORAGE_KEY = 'cardio-tracker:activities:v1';
const PLAN_KEY = 'cardio-tracker:plan:v1';
const DAILY_PLAN_KEY = 'cardio-tracker:dailyplan:v1';

export interface PlanEntry {
  weekStart: string; // yyyy-MM-dd, Monday
  miles: number;
}

export interface DailyPlanEntry {
  date: string; // yyyy-MM-dd
  miles: number;
}

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

// ---- Weekly plan (used by the Forecast planner) ----

function readPlan(): PlanEntry[] {
  try {
    const raw = localStorage.getItem(PLAN_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writePlan(plan: PlanEntry[]) {
  localStorage.setItem(PLAN_KEY, JSON.stringify(plan));
}

export function getPlan(): PlanEntry[] {
  return readPlan();
}

export function setPlanWeek(weekStart: string, miles: number): void {
  const plan = readPlan().filter((p) => p.weekStart !== weekStart);
  if (miles > 0) plan.push({ weekStart, miles });
  writePlan(plan);
}

export function clearPlan(): void {
  writePlan([]);
}

// ---- Daily plan (near-term, day-by-day planning within the Forecast planner) ----

function readDailyPlan(): DailyPlanEntry[] {
  try {
    const raw = localStorage.getItem(DAILY_PLAN_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeDailyPlan(plan: DailyPlanEntry[]) {
  localStorage.setItem(DAILY_PLAN_KEY, JSON.stringify(plan));
}

export function getDailyPlan(): DailyPlanEntry[] {
  return readDailyPlan();
}

export function setDailyPlanDay(date: string, miles: number): void {
  const plan = readDailyPlan().filter((p) => p.date !== date);
  if (miles > 0) plan.push({ date, miles });
  writeDailyPlan(plan);
}

export function clearDailyPlan(): void {
  writeDailyPlan([]);
}

// ---- Backup ----

export function exportActivitiesJson(): string {
  return JSON.stringify({ activities: readAll(), plan: readPlan(), dailyPlan: readDailyPlan() }, null, 2);
}

export function importActivitiesJson(json: string): void {
  const parsed = JSON.parse(json);
  if (Array.isArray(parsed)) {
    // Legacy backup format: a plain array of activities.
    writeAll(parsed);
    return;
  }
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.activities)) {
    throw new Error('Invalid backup file');
  }
  writeAll(parsed.activities);
  if (Array.isArray(parsed.plan)) writePlan(parsed.plan);
  if (Array.isArray(parsed.dailyPlan)) writeDailyPlan(parsed.dailyPlan);
}
