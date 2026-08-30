import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import type { Activity } from '../lib/types';
import {
  combinedRiskStatus,
  dailyPlanProjection,
  dailyRollingSeries,
  filterByTypes,
  suggestReturnToRunningPlan,
  suggestSafeMaxPlan,
  toDate,
} from '../lib/stats';
import { clearDailyPlan, getDailyPlan, setDailyPlanDays } from '../lib/storage';
import ForecastChart from './ForecastChart';
import type { ForecastChartPoint } from './ForecastChart';

interface ForecastViewProps {
  activities: Activity[];
}

const PAST_DAYS = 14;
const FUTURE_DAYS = 42;
const DAYS_PER_WEEK_GROUP = 7;

export default function ForecastView({ activities }: ForecastViewProps) {
  const runActivities = useMemo(() => filterByTypes(activities, ['Run']), [activities]);

  // Trailing 7-day and 28-day totals as of each day, not that single day's mileage. The last
  // entry is today, so it doubles as the boundary where the planned (dashed) lines pick up.
  const pastDaily = useMemo(() => dailyRollingSeries(runActivities, PAST_DAYS), [runActivities]);

  const [dailyPlan, setDailyPlan] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    getDailyPlan().forEach((p) => {
      map[p.date] = p.miles;
    });
    return map;
  });

  function updateDay(date: string, miles: number) {
    setDailyPlan((prev) => ({ ...prev, [date]: miles }));
    setDailyPlanDays({ [date]: miles });
  }

  function applyPlan(entries: Record<string, number>) {
    setDailyPlan((prev) => ({ ...prev, ...entries }));
    setDailyPlanDays(entries);
  }

  function fillSafeMax() {
    applyPlan(suggestSafeMaxPlan(runActivities, FUTURE_DAYS));
  }

  function handleClear() {
    setDailyPlan({});
    clearDailyPlan();
  }

  const [showReturnPlanner, setShowReturnPlanner] = useState(false);
  const lastPastMiles = pastDaily[pastDaily.length - 1]?.acute7MPW ?? 0;
  const [returnCurrent, setReturnCurrent] = useState(String(Math.round(lastPastMiles || 10)));
  const [returnTarget, setReturnTarget] = useState(String(Math.round((lastPastMiles || 10) * 1.5)));
  const [returnWeeks, setReturnWeeks] = useState('6');

  function applyReturnPlan() {
    const current = parseFloat(returnCurrent) || 0;
    const target = parseFloat(returnTarget) || undefined;
    const weeks = Math.min(Math.max(parseInt(returnWeeks, 10) || 6, 1), FUTURE_DAYS / 7);
    applyPlan(suggestReturnToRunningPlan(runActivities, current, target, weeks));
    setShowReturnPlanner(false);
  }

  const projection = useMemo(
    () => dailyPlanProjection(runActivities, dailyPlan, FUTURE_DAYS),
    [runActivities, dailyPlan],
  );

  // Today shows up once, as the last point of the history line — its rolling values are
  // repeated onto the planned line too, so the dashed segment picks up right where the solid
  // one ends instead of leaving a gap.
  const chartData: ForecastChartPoint[] = [
    ...pastDaily.map((d, i) => {
      const isToday = i === pastDaily.length - 1;
      return {
        label: isToday ? 'Today' : d.label,
        l7Actual: d.acute7MPW,
        l7Planned: isToday ? d.acute7MPW : null,
        l28Actual: d.chronic28MPW,
        l28Planned: isToday ? d.chronic28MPW : null,
      };
    }),
    // projection[0] is today, already represented above, so future days start at index 1.
    ...projection.slice(1).map((d) => {
      const hasPlan = dailyPlan[d.date] !== undefined;
      return {
        label: d.label,
        l7Actual: null,
        l7Planned: hasPlan ? d.rollingWeeklyMiles : null,
        l28Actual: null,
        l28Planned: hasPlan ? d.rollingChronicMiles : null,
      };
    }),
  ];

  const weekGroups = useMemo(() => {
    const groups: { label: string; totalMiles: number; days: typeof projection }[] = [];
    for (let i = 0; i < projection.length; i += DAYS_PER_WEEK_GROUP) {
      const days = projection.slice(i, i + DAYS_PER_WEEK_GROUP);
      const start = toDate(days[0].date);
      const end = toDate(days[days.length - 1].date);
      groups.push({
        label: `${format(start, 'MMM d')} – ${format(end, 'MMM d')}`,
        totalMiles: Math.round(days.reduce((s, d) => s + d.plannedMiles, 0) * 10) / 10,
        days,
      });
    }
    return groups;
  }, [projection]);

  return (
    <div className="p-4 flex flex-col gap-4 pb-24 max-w-md mx-auto w-full">
      <div>
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">Forecast &amp; planner</h2>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
          Plan your next {FUTURE_DAYS / 7} weeks day by day. The chart tracks your rolling 7-day
          and 28-day totals, not single-day mileage, so you can see your training load build over
          time — solid through today, then dashed wherever you've planned ahead. Each day below
          shows a suggested max — the most it can hold while keeping that 7-day load at or under
          1.3x your recent baseline — and updates live as you fill in other days.
        </p>
      </div>

      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-2">
        <ForecastChart data={chartData} />
      </div>

      <div className="flex gap-2">
        <button
          onClick={fillSafeMax}
          className="flex-1 rounded-lg border border-neutral-300 dark:border-neutral-700 py-2 text-xs font-semibold text-neutral-900 dark:text-neutral-50"
        >
          Fill with safe daily max
        </button>
        <button
          onClick={() => setShowReturnPlanner((v) => !v)}
          className="flex-1 rounded-lg border border-neutral-300 dark:border-neutral-700 py-2 text-xs font-semibold text-neutral-900 dark:text-neutral-50"
        >
          Return-to-running plan
        </button>
      </div>
      <button onClick={handleClear} className="text-xs font-medium text-neutral-400 self-start -mt-2">
        Clear plan
      </button>

      {showReturnPlanner && (
        <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-3 flex flex-col gap-3">
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Coming back from time off or injury? Enter what feels comfortable now, your target
            weekly mileage, and how many weeks to build over — this spreads a conservative ramp
            across your usual running days.
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
            Weeks to build (max {FUTURE_DAYS / 7})
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={FUTURE_DAYS / 7}
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

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
          Planned days
        </h3>
        {weekGroups.map((group, gi) => (
          <div key={gi} className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between px-1">
              <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">{group.label}</span>
              <span className="text-xs text-neutral-400 tabular-nums">{group.totalMiles} mi</span>
            </div>
            {group.days.map((d) => {
              const risk = combinedRiskStatus(d.ratio, d.cumulativeOverloadRatio);
              const value = dailyPlan[d.date] ?? '';
              return (
                <div
                  key={d.date}
                  className={`rounded-lg border bg-white dark:bg-neutral-900 px-3 py-2 flex flex-col gap-1.5 ${
                    d.isToday ? 'border-violet-400 dark:border-violet-600' : 'border-neutral-200 dark:border-neutral-800'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-16 shrink-0">
                      <p className={`text-xs font-semibold ${d.isToday ? 'text-violet-600 dark:text-violet-400' : 'text-neutral-700 dark:text-neutral-300'}`}>
                        {d.label}
                      </p>
                      <p className="text-[10px] text-neutral-400 tabular-nums">
                        max {d.suggestedMaxMiles === null ? '—' : d.suggestedMaxMiles}
                      </p>
                    </div>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.1"
                      placeholder="0"
                      value={value}
                      onChange={(e) => updateDay(d.date, e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                      className="flex-1 min-w-0 rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-2 py-1 text-sm font-semibold tabular-nums"
                    />
                    <span
                      className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold text-center ${
                        risk.tone === 'good'
                          ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300'
                          : risk.tone === 'caution'
                            ? 'bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300'
                            : risk.tone === 'high'
                              ? 'bg-red-100 dark:bg-red-950/50 text-red-800 dark:text-red-300'
                              : 'bg-sky-100 dark:bg-sky-950/50 text-sky-800 dark:text-sky-300'
                      }`}
                    >
                      {risk.label}
                    </span>
                  </div>
                  <div className="flex items-center justify-end gap-2.5 text-[10px] text-neutral-400 tabular-nums pr-0.5">
                    <span>L7D {d.rollingWeeklyMiles}</span>
                    <span>L28D {d.rollingChronicMiles}</span>
                    <span>ACWR {d.ratio === null ? '—' : d.ratio.toFixed(2)}</span>
                    <span>Overload {d.cumulativeOverloadRatio === null ? '—' : d.cumulativeOverloadRatio.toFixed(2)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </section>
    </div>
  );
}
