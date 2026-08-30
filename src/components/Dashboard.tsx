import { useMemo, useState } from 'react';
import type { Activity, CardioType } from '../lib/types';
import { CARDIO_TYPES } from '../lib/types';
import {
  combinedRiskStatus,
  computeCumulativeOverload,
  computeRollingStats,
  dailyRollingSeries,
  filterByTypes,
  formatDuration,
  formatPace,
  loadRatioZone,
} from '../lib/stats';
import StatCard from './StatCard';
import RollingLoadChart from './RollingLoadChart';
import RiskBanner from './RiskBanner';

const CHART_DAYS = 365;

interface DashboardProps {
  activities: Activity[];
}

type TypeFilter = 'run' | 'all' | CardioType;

export default function Dashboard({ activities }: DashboardProps) {
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('run');

  const filtered = useMemo(() => {
    if (typeFilter === 'all') return activities;
    if (typeFilter === 'run') return filterByTypes(activities, ['Run']);
    return filterByTypes(activities, [typeFilter]);
  }, [activities, typeFilter]);

  const stats = useMemo(() => computeRollingStats(filtered), [filtered]);
  const rollingLoad = useMemo(() => dailyRollingSeries(filtered, CHART_DAYS), [filtered]);
  const overload = useMemo(() => computeCumulativeOverload(filtered), [filtered]);
  const zone = loadRatioZone(stats.acwr);
  const overloadZone = loadRatioZone(overload.ratio);
  const risk = combinedRiskStatus(stats.acwr, overload.ratio);

  const recentActivities = activities.slice(0, 8);

  if (activities.length === 0) {
    return (
      <div className="p-6 text-center text-neutral-500 dark:text-neutral-400">
        <p className="text-lg font-medium mb-1">No activities yet</p>
        <p className="text-sm">Log a workout or import from Strava to see your stats.</p>
      </div>
    );
  }

  return (
    <div className="p-4 flex flex-col gap-4 pb-24">
      <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-4 px-4">
        <FilterChip active={typeFilter === 'run'} onClick={() => setTypeFilter('run')}>
          Run
        </FilterChip>
        <FilterChip active={typeFilter === 'all'} onClick={() => setTypeFilter('all')}>
          All cardio
        </FilterChip>
        {CARDIO_TYPES.filter((t) => t !== 'Run').map((t) => (
          <FilterChip key={t} active={typeFilter === t} onClick={() => setTypeFilter(t)}>
            {t}
          </FilterChip>
        ))}
      </div>

      <RiskBanner
        label={risk.label}
        detail={risk.detail}
        tone={risk.tone}
        acwr={stats.acwr}
        cumulativeOverload={overload.ratio}
      />

      <section>
        <h2 className="text-sm font-semibold text-neutral-500 dark:text-neutral-400 mb-2 uppercase tracking-wide">
          This week
        </h2>
        <div className="grid grid-cols-2 gap-2">
          <StatCard label="Miles L7D (MPW)" value={stats.acuteMiles.toFixed(1)} sublabel="mi" />
          <StatCard
            label="4-wk avg MPW"
            value={stats.last4WeeksAvgMiles.toFixed(1)}
            sublabel="mi/week"
          />
          <StatCard
            label="Vs. last week"
            value={stats.weekOverWeekPct === null ? '—' : `${stats.weekOverWeekPct > 0 ? '+' : ''}${stats.weekOverWeekPct.toFixed(0)}%`}
            sublabel={
              stats.weekOverWeekPct !== null && Math.abs(stats.weekOverWeekPct) > 10
                ? 'Keep increases under ~10%'
                : undefined
            }
            tone={
              stats.weekOverWeekPct !== null && stats.weekOverWeekPct > 10
                ? 'caution'
                : 'default'
            }
          />
          <StatCard
            label="Vs. prior 7 days"
            value={
              stats.rollingWeekOverWeekPct === null
                ? '—'
                : `${stats.rollingWeekOverWeekPct > 0 ? '+' : ''}${stats.rollingWeekOverWeekPct.toFixed(0)}%`
            }
            sublabel={
              stats.rollingWeekOverWeekPct !== null && Math.abs(stats.rollingWeekOverWeekPct) > 10
                ? 'Keep increases under ~10%'
                : 'Last 7 days vs the 7 before'
            }
            tone={
              stats.rollingWeekOverWeekPct !== null && stats.rollingWeekOverWeekPct > 10
                ? 'caution'
                : 'default'
            }
          />
          <StatCard
            label="ACWR (7d:28d)"
            value={stats.acwr === null ? '—' : stats.acwr.toFixed(2)}
            sublabel={zone.label}
            tone={zone.tone}
          />
          <StatCard
            label="Cumulative overload (4wk:13wk)"
            value={overload.ratio === null ? '—' : overload.ratio.toFixed(2)}
            sublabel={overloadZone.label}
            tone={overloadZone.tone}
          />
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-neutral-500 dark:text-neutral-400 mb-2 uppercase tracking-wide">
          Training volume
        </h2>
        <div className="grid grid-cols-2 gap-2">
          <StatCard label="Longest run (4 wks)" value={`${stats.longestRunLast4Weeks.toFixed(1)} mi`} />
          <StatCard label="Longest run (all-time)" value={`${stats.longestRunAllTime.toFixed(1)} mi`} />
          <StatCard
            label="Long run % (7 days)"
            value={stats.longRunShareOfWeekPct === null ? '—' : `${stats.longRunShareOfWeekPct.toFixed(0)}%`}
            sublabel="Aim for ≤ 30-40%"
          />
          <StatCard
            label="Active days (4 wks)"
            value={`${stats.daysRunLast4Weeks}/28 (${Math.round((stats.daysRunLast4Weeks / 28) * 100)}%)`}
          />
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-neutral-500 dark:text-neutral-400 mb-2 uppercase tracking-wide">
          Pace &amp; totals
        </h2>
        <div className="grid grid-cols-3 gap-2">
          <StatCard label="Avg pace" value={formatPace(stats.avgPaceSecPerMile)} />
          <StatCard label="This month" value={`${stats.totalMilesThisMonth.toFixed(1)} mi`} />
          <StatCard label="This year" value={`${stats.totalMilesThisYear.toFixed(1)} mi`} />
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-neutral-500 dark:text-neutral-400 mb-2 uppercase tracking-wide">
          Lifetime
        </h2>
        <div className="grid grid-cols-3 gap-2">
          <StatCard label="Time exercised" value={formatDuration(stats.totalSecondsAllTime)} />
          <StatCard label="Miles logged" value={`${stats.totalMilesAllTime.toFixed(1)} mi`} />
          <StatCard label="Activities logged" value={`${stats.totalActivityCount}`} />
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-neutral-500 dark:text-neutral-400 mb-2 uppercase tracking-wide">
          Training load (last {CHART_DAYS} days, showing most recent 180)
        </h2>
        <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-2">
          <RollingLoadChart data={rollingLoad} />
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-neutral-500 dark:text-neutral-400 mb-2 uppercase tracking-wide">
          Recent activity
        </h2>
        <ul className="flex flex-col gap-1.5">
          {recentActivities.map((a) => (
            <li
              key={a.id}
              className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-3 py-2 flex items-center justify-between text-sm"
            >
              <div className="flex flex-col">
                <span className="font-medium text-neutral-900 dark:text-neutral-50">
                  {a.type} · {a.distanceMiles.toFixed(2)} mi
                </span>
                <span className="text-neutral-500 dark:text-neutral-400 text-xs">{a.date}</span>
              </div>
              <span className="text-neutral-500 dark:text-neutral-400 tabular-nums">
                {formatDuration(a.durationSeconds)}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium border transition-colors ${
        active
          ? 'bg-violet-600 border-violet-600 text-white'
          : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-300'
      }`}
    >
      {children}
    </button>
  );
}
