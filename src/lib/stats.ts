import {
  addDays,
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
  prior7DaysMiles: number; // the 7 days before that (days 8-14 back)
  rollingWeekOverWeekPct: number | null; // acuteMiles vs prior7DaysMiles
  chronicWeeklyAvgMiles: number; // trailing 28 days, avg per week
  acwr: number | null;
  longestRunLast4Weeks: number;
  longestRunAllTime: number;
  longRunShareOfWeekPct: number | null; // longest run in the trailing 7 days, as % of that 7-day total
  avgPaceSecPerMile: number | null; // overall, filtered set
  daysRunLast4Weeks: number; // distinct calendar days with an activity, last 28 days
  totalMilesAllTime: number;
  totalSecondsAllTime: number;
  totalMilesThisMonth: number;
  totalMilesThisYear: number;
  totalActivityCount: number;
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
  const last7DaysActivities = allActivitiesForType.filter((a) => {
    const d = toDate(a.date);
    return !isBefore(d, startOfDay(sevenDaysAgo)) && !isAfter(d, endOfDay(referenceDate));
  });
  const acuteMiles = last7DaysActivities.reduce((sum, a) => sum + a.distanceMiles, 0);

  const prior7Start = subDays(referenceDate, 13);
  const prior7End = subDays(referenceDate, 7);
  const prior7DaysMiles = allActivitiesForType
    .filter((a) => {
      const d = toDate(a.date);
      return !isBefore(d, startOfDay(prior7Start)) && !isAfter(d, endOfDay(prior7End));
    })
    .reduce((sum, a) => sum + a.distanceMiles, 0);
  const rollingWeekOverWeekPct =
    prior7DaysMiles > 0 ? ((acuteMiles - prior7DaysMiles) / prior7DaysMiles) * 100 : null;

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

  const longestRunLast7Days = last7DaysActivities
    .filter((a) => a.type === 'Run')
    .reduce((max, a) => Math.max(max, a.distanceMiles), 0);
  const longRunShareOfWeekPct =
    acuteMiles > 0 && longestRunLast7Days > 0 ? (longestRunLast7Days / acuteMiles) * 100 : null;

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
    prior7DaysMiles,
    rollingWeekOverWeekPct,
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
    totalActivityCount: allActivitiesForType.length,
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

// ---- Forecast / planner (daily) ----

export interface DailyPlanDay {
  date: string; // yyyy-MM-dd
  label: string; // 'Today', 'Mon 24', ...
  isToday: boolean;
  plannedMiles: number; // the override in effect for this day, or 0
  rollingWeeklyMiles: number; // trailing 7-day total (the 6 days before this one, plus plannedMiles)
  suggestedMaxMiles: number | null; // most this day can hold and keep the 7d:28d ratio at/under 1.3x
  ratio: number | null; // this day's implied 7-day-load : 28-day-baseline ratio, given plannedMiles
}

/** The next `numDays` days starting today. */
export function upcomingDayStarts(numDays: number, referenceDate = new Date()): { date: string; label: string }[] {
  return Array.from({ length: numDays }, (_, i) => {
    const day = addDays(referenceDate, i);
    return { date: format(day, 'yyyy-MM-dd'), label: i === 0 ? 'Today' : format(day, 'EEE d') };
  });
}

/**
 * Projects, for each of the next `numDays` days, the most that day can hold (a "sweet spot"
 * ceiling of 1.3x the trailing 28-day baseline) and the load ratio the current plan implies for
 * that day — recomputed day by day so an entry on an earlier day affects every later day's
 * numbers, the same way ACWR itself rolls forward.
 */
export function dailyPlanProjection(
  activities: Activity[],
  plannedOverrides: Record<string, number>,
  numDays: number,
  referenceDate = new Date(),
): DailyPlanDay[] {
  const actualByDate = new Map<string, number>();
  for (const a of activities) {
    actualByDate.set(a.date, (actualByDate.get(a.date) ?? 0) + a.distanceMiles);
  }

  const milesOn = (dateStr: string): number =>
    plannedOverrides[dateStr] !== undefined ? plannedOverrides[dateStr] : (actualByDate.get(dateStr) ?? 0);

  const results: DailyPlanDay[] = [];
  for (let i = 0; i < numDays; i++) {
    const day = addDays(referenceDate, i);
    const dateStr = format(day, 'yyyy-MM-dd');

    let trailing6 = 0;
    for (let k = 1; k <= 6; k++) trailing6 += milesOn(format(subDays(day, k), 'yyyy-MM-dd'));

    let trailing28 = 0;
    for (let k = 1; k <= 28; k++) trailing28 += milesOn(format(subDays(day, k), 'yyyy-MM-dd'));

    const chronicBaseline = trailing28 / 4;
    const plannedMiles = plannedOverrides[dateStr] ?? 0;
    const suggestedMaxMiles =
      chronicBaseline > 0 ? Math.max(0, Math.round((1.3 * chronicBaseline - trailing6) * 10) / 10) : null;
    const ratio = chronicBaseline > 0 ? (trailing6 + plannedMiles) / chronicBaseline : null;

    results.push({
      date: dateStr,
      label: i === 0 ? 'Today' : format(day, 'EEE d'),
      isToday: i === 0,
      plannedMiles,
      rollingWeeklyMiles: Math.round((trailing6 + plannedMiles) * 10) / 10,
      suggestedMaxMiles,
      ratio,
    });
  }
  return results;
}

/**
 * Fills the next `numDays` days at each day's safe ("sweet spot") ceiling — the most that day
 * could hold without pushing the rolling 7-day load past 1.3x the 28-day baseline, computed
 * sequentially so each day's suggestion already accounts for the ones before it.
 */
export function suggestSafeMaxPlan(
  activities: Activity[],
  numDays: number,
  referenceDate = new Date(),
): Record<string, number> {
  const overrides: Record<string, number> = {};
  for (let i = 0; i < numDays; i++) {
    const [day] = dailyPlanProjection(activities, overrides, 1, addDays(referenceDate, i));
    overrides[day.date] = day.suggestedMaxMiles ?? 0;
  }
  return overrides;
}

/** The weekdays (0=Sun..6=Sat) the athlete has actually run on in the last `lookbackDays`. */
export function typicalActiveWeekdays(activities: Activity[], lookbackDays = 28, referenceDate = new Date()): number[] {
  const cutoff = startOfDay(subDays(referenceDate, lookbackDays));
  const counts = new Array(7).fill(0);
  for (const a of activities) {
    const d = toDate(a.date);
    if (!isBefore(d, cutoff)) counts[d.getDay()]++;
  }
  const active = counts.map((c, i) => (c > 0 ? i : -1)).filter((i) => i >= 0);
  return active.length > 0 ? active : [2, 4, 6, 0]; // default: Tue/Thu/Sat/Sun
}

/**
 * Builds a return-to-running ramp: grows from `currentWeeklyMiles` toward `targetWeeklyMiles`
 * (or ~10%/week if no target given) over `weeks` weeks, spreading each week's total evenly
 * across the athlete's typical running days (falling back to Tue/Thu/Sat/Sun with no history).
 */
export function suggestReturnToRunningPlan(
  activities: Activity[],
  currentWeeklyMiles: number,
  targetWeeklyMiles: number | undefined,
  weeks: number,
  referenceDate = new Date(),
): Record<string, number> {
  const weeklyTotals = suggestProgression(currentWeeklyMiles, weeks, targetWeeklyMiles);
  const activeDays = typicalActiveWeekdays(activities, 28, referenceDate);
  const overrides: Record<string, number> = {};
  for (let w = 0; w < weeks; w++) {
    const perDay = Math.round((weeklyTotals[w] / activeDays.length) * 10) / 10;
    for (let d = 0; d < 7; d++) {
      const day = addDays(referenceDate, w * 7 + d);
      if (activeDays.includes(day.getDay())) {
        overrides[format(day, 'yyyy-MM-dd')] = perDay;
      }
    }
  }
  return overrides;
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
