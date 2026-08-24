import { useMemo, useState } from 'react';
import type { Activity } from '../lib/types';
import {
  dailyPlanCeilings,
  filterByTypes,
  loadRatioZone,
  projectPlanRisk,
  recentWeeks,
  suggestProgression,
  upcomingWeekStarts,
} from '../lib/stats';
import { getDailyPlan, getPlan, setDailyPlanDay, setPlanWeek } from '../lib/storage';
import ForecastChart from './ForecastChart';

interface ForecastViewProps {
  activities: Activity[];
}

const PAST_WEEKS = 8;
const FUTURE_WEEKS = 6;
const NEXT_DAYS = 7;

export default function ForecastView({ activities }: ForecastViewProps) {
  const runActivities = useMemo(() => filterByTypes(activities, ['Run']), [activities]);
  const pastWeeks = useMemo(() => recentWeeks(runActivities, PAST_WEEKS), [runActivities]);
  const future = useMemo(() => upcomingWeekStarts(FUTURE_WEEKS), []);

  const baselineMiles = pastWeeks.length > 0 ? pastWeeks[pastWeeks.length - 1].miles : 0;
  const suggested = useMemo(() => suggestProgression(baselineMiles, FUTURE_WEEKS), [baselineMiles]);

  const [plan, setPlan] = useState<Record<string, number>>(() => {
    const stored = getPlan();
    const map: Record<string, number> = {};
    stored.forEach((p) => {
      map[p.weekStart] = p.miles;
    });
    return map;
  });

  const [dailyPlan, setDailyPlan] = useState<Record<string, number>>(() => {
    const stored = getDailyPlan();
    const map: Record<string, number> = {};
    stored.forEach((p) => {
      map[p.date] = p.miles;
    });
    return map;
  });
  const dailyCeilings = useMemo(
    () => dailyPlanCeilings(runActivities, dailyPlan, NEXT_DAYS),
    [runActivities, dailyPlan],
  );

  function updateDay(date: string, miles: number) {
    setDailyPlan((prev) => ({ ...prev, [date]: miles }));
    setDailyPlanDay(date, miles);
  }

  const [showReturnPlanner, setShowReturnPlanner] = useState(false);
  const [returnCurrent, setReturnCurrent] = useState(String(Math.round(baselineMiles || 5)));
  const [returnTarget, setReturnTarget] = useState(String(Math.round((baselineMiles || 5) * 1.5)));
  const [returnWeeks, setReturnWeeks] = useState(String(FUTURE_WEEKS));

  function plannedMilesFor(weekStart: string, index: number): number {
    return plan[weekStart] ?? suggested[index];
  }

  function updateWeek(weekStart: string, miles: number) {
    setPlan((prev) => ({ ...prev, [weekStart]: miles }));
    setPlanWeek(weekStart, miles);
  }

  function applySuggested() {
    future.forEach((w, i) => updateWeek(w.weekStart, suggested[i]));
  }

  function applyReturnPlan() {
    const current = parseFloat(returnCurrent) || 0;
    const target = parseFloat(returnTarget) || undefined;
    const weeks = Math.min(Math.max(parseInt(returnWeeks, 10) || FUTURE_WEEKS, 1), FUTURE_WEEKS);
    const ramp = suggestProgression(current, weeks, target);
    future.slice(0, weeks).forEach((w, i) => updateWeek(w.weekStart, ramp[i]));
    setShowReturnPlanner(false);
  }

  const plannedMilesArray = future.map((w, i) => plannedMilesFor(w.weekStart, i));
  const pastMilesArray = pastWeeks.map((w) => w.miles);
  const projectedRatios = projectPlanRisk(pastMilesArray, plannedMilesArray);

  const chartData = [
    ...pastWeeks.map((w) => ({ label: w.label, actual: Math.round(w.miles * 10) / 10, planned: null as number | null })),
    ...future.map((w, i) => ({ label: w.label, actual: null as number | null, planned: Math.round(plannedMilesArray[i] * 10) / 10 })),
  ];

  return (
    <div className="p-4 flex flex-col gap-4 pb-24 max-w-md mx-auto w-full">
      <div>
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">Forecast &amp; planner</h2>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
          Plan day-by-day for the week ahead and by the week further out, and see how the load
          compares to your recent baseline — before you run it.
        </p>
      </div>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
          Next {NEXT_DAYS} days
        </h3>
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
          {dailyCeilings.map((d) => {
            const value = dailyPlan[d.date] ?? '';
            const overMax =
              d.suggestedMaxMiles !== null && typeof value === 'number' && value > d.suggestedMaxMiles;
            return (
              <div
                key={d.date}
                className={`shrink-0 w-20 rounded-lg border bg-white dark:bg-neutral-900 px-2 py-2 flex flex-col items-center gap-1.5 ${
                  d.isToday ? 'border-violet-400 dark:border-violet-600' : 'border-neutral-200 dark:border-neutral-800'
                }`}
              >
                <span
                  className={`text-[11px] font-semibold ${d.isToday ? 'text-violet-600 dark:text-violet-400' : 'text-neutral-500 dark:text-neutral-400'}`}
                >
                  {d.label}
                </span>
                <span className="text-[10px] text-neutral-400 tabular-nums">
                  max {d.suggestedMaxMiles === null ? '—' : d.suggestedMaxMiles}
                </span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  placeholder="0"
                  value={value}
                  onChange={(e) => updateDay(d.date, e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                  className={`w-full rounded-md border bg-transparent px-1.5 py-1 text-sm font-semibold text-center tabular-nums ${
                    overMax
                      ? 'border-amber-400 dark:border-amber-600 text-amber-700 dark:text-amber-400'
                      : 'border-neutral-300 dark:border-neutral-700'
                  }`}
                />
              </div>
            );
          })}
        </div>
        <p className="text-[11px] text-neutral-400">
          "Max" is the most that day can hold while keeping your trailing 7-day load at or under
          1.3x your recent baseline — it updates as you fill in other days.
        </p>
      </section>

      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-2">
        <ForecastChart data={chartData} />
      </div>

      <div className="flex gap-2">
        <button
          onClick={applySuggested}
          className="flex-1 rounded-lg border border-neutral-300 dark:border-neutral-700 py-2 text-xs font-semibold text-neutral-900 dark:text-neutral-50"
        >
          Suggest ~10%/week ramp
        </button>
        <button
          onClick={() => setShowReturnPlanner((v) => !v)}
          className="flex-1 rounded-lg border border-neutral-300 dark:border-neutral-700 py-2 text-xs font-semibold text-neutral-900 dark:text-neutral-50"
        >
          Return-to-running plan
        </button>
      </div>

      {showReturnPlanner && (
        <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-3 flex flex-col gap-3">
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Coming back from time off or injury? Enter what feels comfortable now, your target
            weekly mileage, and how many weeks to build over — this fills in a conservative ramp
            that stays close to the sweet spot.
          </p>
          <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700 dark:text-neutral-300">
            Comfortable weekly mileage now
            <input
              type="number"
              inputMode="decimal"
              value={returnCurrent}
              onChange={(e) => setReturnCurrent(e.target.value)}
              className="rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-base"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700 dark:text-neutral-300">
            Target weekly mileage
            <input
              type="number"
              inputMode="decimal"
              value={returnTarget}
              onChange={(e) => setReturnTarget(e.target.value)}
              className="rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-base"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700 dark:text-neutral-300">
            Weeks to build (max {FUTURE_WEEKS})
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={FUTURE_WEEKS}
              value={returnWeeks}
              onChange={(e) => setReturnWeeks(e.target.value)}
              className="rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-base"
            />
          </label>
          <button
            onClick={applyReturnPlan}
            className="rounded-lg bg-violet-600 text-white font-semibold py-2.5 text-sm"
          >
            Fill in plan
          </button>
        </div>
      )}

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
          Planned weeks
        </h3>
        {future.map((w, i) => {
          const ratio = projectedRatios[i];
          const zone = loadRatioZone(ratio);
          const value = plannedMilesFor(w.weekStart, i);
          return (
            <div
              key={w.weekStart}
              className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-3 py-2.5 flex items-center gap-3"
            >
              <div className="flex-1">
                <p className="text-xs text-neutral-500 dark:text-neutral-400">Week of {w.label}</p>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  value={value}
                  onChange={(e) => updateWeek(w.weekStart, parseFloat(e.target.value) || 0)}
                  className="w-full mt-0.5 rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-2 py-1 text-sm font-semibold tabular-nums"
                />
              </div>
              <div className="text-right shrink-0">
                <span
                  className={`inline-block rounded-full px-2 py-1 text-[11px] font-semibold ${
                    zone.tone === 'good'
                      ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300'
                      : zone.tone === 'caution'
                        ? 'bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300'
                        : zone.tone === 'high'
                          ? 'bg-red-100 dark:bg-red-950/50 text-red-800 dark:text-red-300'
                          : 'bg-sky-100 dark:bg-sky-950/50 text-sky-800 dark:text-sky-300'
                  }`}
                >
                  {zone.label}
                </span>
                <p className="text-[11px] text-neutral-400 mt-0.5 tabular-nums">
                  {ratio === null ? '—' : `${ratio.toFixed(2)}x`}
                </p>
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
