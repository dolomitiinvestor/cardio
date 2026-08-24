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

export type RiskTone = 'low' | 'good' | 'caution' | 'high';

/** Generic interpretation of a recent:baseline training-load ratio (used for both ACWR and cumulative overload). */
export function loadRatioZone(ratio: number | null): { label: string; tone: RiskTone } {
  if (ratio === null) return { label: 'Not enough data', tone: 'low' };
  if (ratio < 0.8) return { label: 'Undertraining risk', tone: 'low' };
  if (ratio <= 1.3) return { label: 'Sweet spot', tone: 'good' };
  if (ratio <= 1.5) return { label: 'Caution', tone: 'caution' };
  return { label: 'High injury risk', tone: 'high' };
}

/** Back-compat alias. */
export const acwrZone = loadRatioZone;

const TONE_RANK: Record<RiskTone, number> = { low: 0, good: 1, caution: 2, high: 3 };

/**
 * Combines the short-term (ACWR) and long-term (cumulative overload) load ratios into a single
 * overall status, taking the more concerning of the two — mirrors the "injury risk alert" shown
 * after each run in training-load monitoring tools.
 */
export function combinedRiskStatus(
  acwr: number | null,
  cumulativeOverload: number | null,
): { label: string; tone: RiskTone; detail: string } {
  const acwrZ = loadRatioZone(acwr);
  const overloadZ = loadRatioZone(cumulativeOverload);
  const worse = TONE_RANK[overloadZ.tone] >= TONE_RANK[acwrZ.tone] ? overloadZ : acwrZ;

  if (acwr === null && cumulativeOverload === null) {
    return { label: 'Not enough data', tone: 'low', detail: 'Log a few weeks of activity to see your risk status.' };
  }

  const details: Record<RiskTone, string> = {
    high: 'Recent load is spiking well above what your body is used to. Consider an easy week.',
    caution: 'Load is trending up quickly. Keep an eye on it before adding more.',
    good: 'Your recent training load is well balanced with your recent baseline.',
    low: 'Recent load is well below your baseline — there may be room to build safely.',
  };

  return { label: worse.label, tone: worse.tone, detail: details[worse.tone] };
}

export interface CumulativeOverload {
  recentWeeklyAvgMiles: number; // trailing 28 days, avg/week
  baselineWeeklyAvgMiles: number; // the preceding ~9 weeks (days 29-91 back), avg/week
  ratio: number | null;
}

/**
 * Long-timescale companion to ACWR. ACWR's 7-day:28-day window is tuned to catch short-term
 * spikes but is too short to reflect the slower adaptation of tendon, ligament, and bone —
 * research on those tissues points to a timescale closer to ~3 months. This compares the last
 * 4 weeks against the ~9 weeks before that (a rolling ~13-week / 91-day window in total).
 */
export function computeCumulativeOverload(
  activities: Activity[],
  referenceDate = new Date(),
): CumulativeOverload {
  const recentStart = startOfDay(subDays(referenceDate, 27));
  const baselineStart = startOfDay(subDays(referenceDate, 90));
  const baselineEnd = startOfDay(subDays(referenceDate, 28));
  const end = endOfDay(referenceDate);

  const recentMiles = activities
    .filter((a) => {
      const d = toDate(a.date);
      return !isBefore(d, recentStart) && !isAfter(d, end);
    })
    .reduce((s, a) => s + a.distanceMiles, 0);

  const baselineMiles = activities
    .filter((a) => {
      const d = toDate(a.date);
      return !isBefore(d, baselineStart) && !isBefore(d, startOfDay(subDays(referenceDate, 91))) && isBefore(d, baselineEnd);
    })
    .reduce((s, a) => s + a.distanceMiles, 0);

  const recentWeeklyAvgMiles = recentMiles / 4;
  const baselineWeeklyAvgMiles = baselineMiles / 9;
  const ratio = baselineWeeklyAvgMiles > 0 ? recentWeeklyAvgMiles / baselineWeeklyAvgMiles : null;

  return { recentWeeklyAvgMiles, baselineWeeklyAvgMiles, ratio };
}

export interface DailyLoadPoint {
  date: string; // yyyy-MM-dd
  label: string;
  acute7MPW: number; // trailing 7-day mileage, i.e. that day's rolling "miles per week"
  chronic28MPW: number; // trailing 28-day mileage / 4, i.e. rolling 4-week average MPW
}

/**
 * Day-by-day (not week-bucketed) rolling training-load series: for every day in the window,
 * the trailing 7-day mileage (already a weekly rate) and the trailing 28-day mileage averaged
 * to a weekly rate. Plotting both together is the standard way to visualize ACWR over time,
 * rather than only checking it as of today.
 */
export function dailyRollingSeries(
  activities: Activity[],
  numDays: number,
  referenceDate = new Date(),
): DailyLoadPoint[] {
  const points: DailyLoadPoint[] = [];
  for (let i = numDays - 1; i >= 0; i--) {
    const day = subDays(referenceDate, i);
    const dayEnd = endOfDay(day);

    const acute7Start = startOfDay(subDays(day, 6));
    const acute7MPW = activities
      .filter((a) => {
        const d = toDate(a.date);
        return !isBefore(d, acute7Start) && !isAfter(d, dayEnd);
      })
      .reduce((s, a) => s + a.distanceMiles, 0);

    const chronic28Start = startOfDay(subDays(day, 27));
    const chronic28Total = activities
      .filter((a) => {
        const d = toDate(a.date);
        return !isBefore(d, chronic28Start) && !isAfter(d, dayEnd);
      })
      .reduce((s, a) => s + a.distanceMiles, 0);

    points.push({
      date: format(day, 'yyyy-MM-dd'),
      label: format(day, 'MMM d'),
      acute7MPW: Math.round(acute7MPW * 10) / 10,
      chronic28MPW: Math.round((chronic28Total / 4) * 10) / 10,
    });
  }
  return points;
}

// ---- Forecast / planner ----

export interface PlannedWeek {
  weekStart: string; // yyyy-MM-dd, Monday
  label: string;
  miles: number;
}

/** The Monday-start weeks after the current (in-progress) week, for planning purposes. */
export function upcomingWeekStarts(numWeeks: number, referenceDate = new Date()): { weekStart: string; label: string }[] {
  const nextWeekStart = addWeeks(startOfWeek(referenceDate, WEEK_OPTS), 1);
  return Array.from({ length: numWeeks }, (_, i) => {
    const start = addWeeks(nextWeekStart, i);
    return { weekStart: format(start, 'yyyy-MM-dd'), label: format(start, 'MMM d') };
  });
}

/** Suggests a conservative ramp (~10%/week) from a baseline weekly mileage, capped by a target. */
export function suggestProgression(baselineMiles: number, numWeeks: number, targetMiles?: number): number[] {
  const growth = 1.1;
  const plan: number[] = [];
  let current = baselineMiles > 0 ? baselineMiles : 10;
  for (let i = 0; i < numWeeks; i++) {
    current = current * growth;
    if (targetMiles !== undefined) current = Math.min(current, targetMiles);
    plan.push(Math.round(current * 10) / 10);
  }
  return plan;
}

/**
 * For a sequence of planned future weekly totals, projects the week-over-week load ratio each
 * week would produce (that week's mileage vs. the rolling average of the 4 weeks before it,
 * mixing in already-elapsed actual weeks as the window rolls forward) — i.e. "if I run this much,
 * what does my risk zone look like that week?"
 */
export function projectPlanRisk(pastWeeksMiles: number[], plannedMiles: number[]): (number | null)[] {
  const timeline = [...pastWeeksMiles];
  const ratios: (number | null)[] = [];
  for (const planned of plannedMiles) {
    const window = timeline.slice(-4);
    const baseline = window.length > 0 ? window.reduce((s, m) => s + m, 0) / window.length : 0;
    ratios.push(baseline > 0 ? planned / baseline : null);
    timeline.push(planned);
  }
  return ratios;
}
