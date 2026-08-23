import {
  addWeeks,
  differenceInCalendarDays,
  eachWeekOfInterval,
  endOfWeek,
  format,
  isAfter,
  isBefore,
  parseISO,
  startOfWeek,
  subDays,
} from 'date-fns';
import type { Activity, CardioType } from './types';
import { RUN_LIKE_TYPES } from './types';

const WEEK_OPTS = { weekStartsOn: 1 as const }; // Monday

export function toDate(dateStr: string): Date {
  return parseISO(dateStr);
}

export function weekStartKey(dateStr: string): string {
  return format(startOfWeek(toDate(dateStr), WEEK_OPTS), 'yyyy-MM-dd');
}

export function filterByTypes(activities: Activity[], types: CardioType[] | 'all'): Activity[] {
  if (types === 'all') return activities;
  const set = new Set(types);
  return activities.filter((a) => set.has(a.type));
}

export interface WeekSummary {
  weekStart: string; // yyyy-MM-dd, Monday
  weekEnd: string;
  label: string;
  miles: number;
  seconds: number;
  activityCount: number;
  longestRunMiles: number;
}

/** Buckets activities into ISO (Mon-start) weeks and sums distance/duration. */
export function summarizeByWeek(activities: Activity[]): Map<string, WeekSummary> {
  const map = new Map<string, WeekSummary>();
  for (const a of activities) {
    const key = weekStartKey(a.date);
    const start = toDate(key);
    const end = endOfWeek(start, WEEK_OPTS);
    const existing = map.get(key) ?? {
      weekStart: key,
      weekEnd: format(end, 'yyyy-MM-dd'),
      label: format(start, 'MMM d'),
      miles: 0,
      seconds: 0,
      activityCount: 0,
      longestRunMiles: 0,
    };
    existing.miles += a.distanceMiles;
    existing.seconds += a.durationSeconds;
    existing.activityCount += 1;
    if (a.type === 'Run') {
      existing.longestRunMiles = Math.max(existing.longestRunMiles, a.distanceMiles);
    }
    map.set(key, existing);
  }
  return map;
}

/** Returns a contiguous array of the last `numWeeks` weeks ending with the current week, filling gaps with zero. */
export function recentWeeks(activities: Activity[], numWeeks: number, referenceDate = new Date()): WeekSummary[] {
  const byWeek = summarizeByWeek(activities);
  const currentWeekStart = startOfWeek(referenceDate, WEEK_OPTS);
  const firstWeekStart = addWeeks(currentWeekStart, -(numWeeks - 1));
  const weekStarts = eachWeekOfInterval(
    { start: firstWeekStart, end: currentWeekStart },
    WEEK_OPTS,
  );

  return weekStarts.map((start) => {
    const key = format(start, 'yyyy-MM-dd');
    const existing = byWeek.get(key);
    if (existing) return existing;
    return {
      weekStart: key,
      weekEnd: format(endOfWeek(start, WEEK_OPTS), 'yyyy-MM-dd'),
      label: format(start, 'MMM d'),
      miles: 0,
      seconds: 0,
      activityCount: 0,
      longestRunMiles: 0,
    };
  });
}

export interface RollingStats {
  thisWeekMiles: number;
  last4WeeksAvgMiles: number;
  last4WeeksTotalMiles: number;
  prevWeekMiles: number;
  weekOverWeekPct: number | null;
  acuteMiles: number; // trailing 7 days
  chronicWeeklyAvgMiles: number; // trailing 28 days, avg per week
  acwr: number | null;
  longestRunLast4Weeks: number;
  longestRunAllTime: number;
  longRunShareOfWeekPct: number | null; // this week's longest run as % of this week's total
  avgPaceSecPerMile: number | null; // overall, filtered set
  daysRunLast4Weeks: number; // distinct calendar days with an activity, last 28 days
  totalMilesAllTime: number;
  totalSecondsAllTime: number;
  totalMilesThisMonth: number;
  totalMilesThisYear: number;
}

function paceSecPerMile(seconds: number, miles: number): number | null {
  if (miles <= 0) return null;
  return seconds / miles;
}

export function computeRollingStats(
  allActivitiesForType: Activity[],
  referenceDate = new Date(),
): RollingStats {
  const weeks4 = recentWeeks(allActivitiesForType, 4, referenceDate);
  const thisWeek = weeks4[weeks4.length - 1];
  const prevWeek = weeks4.length >= 2 ? weeks4[weeks4.length - 2] : undefined;

  const last4WeeksTotalMiles = weeks4.reduce((sum, w) => sum + w.miles, 0);
  const last4WeeksAvgMiles = last4WeeksTotalMiles / 4;

  const sevenDaysAgo = subDays(referenceDate, 6);
  const acuteMiles = allActivitiesForType
    .filter((a) => {
      const d = toDate(a.date);
      return !isBefore(d, startOfDay(sevenDaysAgo)) && !isAfter(d, endOfDay(referenceDate));
    })
    .reduce((sum, a) => sum + a.distanceMiles, 0);

  const twentyEightDaysAgo = subDays(referenceDate, 27);
  const chronicTotalMiles = allActivitiesForType
    .filter((a) => {
      const d = toDate(a.date);
      return !isBefore(d, startOfDay(twentyEightDaysAgo)) && !isAfter(d, endOfDay(referenceDate));
    })
    .reduce((sum, a) => sum + a.distanceMiles, 0);
  const chronicWeeklyAvgMiles = chronicTotalMiles / 4;

  const acwr = chronicWeeklyAvgMiles > 0 ? acuteMiles / chronicWeeklyAvgMiles : null;

  const runsLast4Weeks = allActivitiesForType.filter((a) => {
    const d = toDate(a.date);
    return a.type === 'Run' && !isBefore(d, startOfDay(twentyEightDaysAgo)) && !isAfter(d, endOfDay(referenceDate));
  });
  const longestRunLast4Weeks = runsLast4Weeks.reduce((max, a) => Math.max(max, a.distanceMiles), 0);
  const longestRunAllTime = allActivitiesForType
    .filter((a) => a.type === 'Run')
    .reduce((max, a) => Math.max(max, a.distanceMiles), 0);

  const longRunShareOfWeekPct =
    thisWeek.miles > 0 && thisWeek.longestRunMiles > 0
      ? (thisWeek.longestRunMiles / thisWeek.miles) * 100
      : null;

  const totalSecondsAllTime = allActivitiesForType.reduce((s, a) => s + a.durationSeconds, 0);
  const totalMilesAllTime = allActivitiesForType.reduce((s, a) => s + a.distanceMiles, 0);
  const avgPaceSecPerMile = paceSecPerMile(totalSecondsAllTime, totalMilesAllTime);

  const daysRunLast4Weeks = new Set(
    allActivitiesForType
      .filter((a) => {
        const d = toDate(a.date);
        return !isBefore(d, startOfDay(twentyEightDaysAgo)) && !isAfter(d, endOfDay(referenceDate));
      })
      .map((a) => a.date),
  ).size;

  const monthStart = format(referenceDate, 'yyyy-MM-01');
  const yearStart = format(referenceDate, 'yyyy-01-01');
  const totalMilesThisMonth = allActivitiesForType
    .filter((a) => a.date >= monthStart)
    .reduce((s, a) => s + a.distanceMiles, 0);
  const totalMilesThisYear = allActivitiesForType
    .filter((a) => a.date >= yearStart)
    .reduce((s, a) => s + a.distanceMiles, 0);

  const weekOverWeekPct =
    prevWeek && prevWeek.miles > 0 ? ((thisWeek.miles - prevWeek.miles) / prevWeek.miles) * 100 : null;

  return {
    thisWeekMiles: thisWeek.miles,
    last4WeeksAvgMiles,
    last4WeeksTotalMiles,
    prevWeekMiles: prevWeek?.miles ?? 0,
    weekOverWeekPct,
    acuteMiles,
    chronicWeeklyAvgMiles,
    acwr,
    longestRunLast4Weeks,
    longestRunAllTime,
    longRunShareOfWeekPct,
    avgPaceSecPerMile,
    daysRunLast4Weeks,
    totalMilesAllTime,
    totalSecondsAllTime,
    totalMilesThisMonth,
    totalMilesThisYear,
  };
}

function startOfDay(d: Date): Date {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}
function endOfDay(d: Date): Date {
  const c = new Date(d);
  c.setHours(23, 59, 59, 999);
  return c;
}

export function formatPace(secPerMile: number | null): string {
  if (secPerMile === null || !isFinite(secPerMile) || secPerMile <= 0) return '—';
  const min = Math.floor(secPerMile / 60);
  const sec = Math.round(secPerMile % 60);
  return `${min}:${sec.toString().padStart(2, '0')}/mi`;
}

export function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.round(totalSeconds % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function daysSince(dateStr: string, referenceDate = new Date()): number {
  return differenceInCalendarDays(referenceDate, toDate(dateStr));
}

export const DEFAULT_MPW_TYPES = RUN_LIKE_TYPES;

export function acwrZone(acwr: number | null): { label: string; tone: 'low' | 'good' | 'caution' | 'high' } {
  if (acwr === null) return { label: 'Not enough data', tone: 'low' };
  if (acwr < 0.8) return { label: 'Undertraining risk', tone: 'low' };
  if (acwr <= 1.3) return { label: 'Sweet spot', tone: 'good' };
  if (acwr <= 1.5) return { label: 'Caution', tone: 'caution' };
  return { label: 'High injury risk', tone: 'high' };
}
