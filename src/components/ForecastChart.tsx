import { useMemo } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export interface ForecastChartPoint {
  label: string;
  l7Actual: number | null;
  l7Planned: number | null;
  l28Actual: number | null;
  l28Planned: number | null;
}

interface ForecastChartProps {
  data: ForecastChartPoint[];
}

const SERIES_NAMES: Record<string, string> = {
  l7Actual: '7-day rolling MPW',
  l7Planned: '7-day rolling MPW (planned)',
  l28Actual: '28-day rolling MPW',
  l28Planned: '28-day rolling MPW (planned)',
};

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: any[]; label?: string }) {
  if (!active || !payload?.length) return null;

  // Collapse the actual/planned pair for each metric into one row when they land on the
  // same point (the "Today" boundary, where the solid line ends and the dashed one begins).
  const seen = new Map<string, number>();
  for (const entry of payload) {
    if (entry.value == null) continue;
    const metric = entry.dataKey.startsWith('l7') ? '7-day rolling MPW' : '28-day rolling MPW';
    seen.set(metric, entry.value);
  }
  if (seen.size === 0) return null;

  return (
    <div className="rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 px-3 py-2 text-xs shadow-sm">
      <p className="font-medium text-neutral-900 dark:text-neutral-50 mb-1">{label}</p>
      {[...seen.entries()].map(([metric, value]) => (
        <p key={metric} className="text-neutral-500 dark:text-neutral-400">
          {metric}: <span className="font-medium text-neutral-900 dark:text-neutral-50">{value} mi/wk</span>
        </p>
      ))}
    </div>
  );
}

export default function ForecastChart({ data }: ForecastChartProps) {
  const tickInterval = Math.max(0, Math.ceil(data.length / 8) - 1);

  const yTicks = useMemo(() => {
    const maxValue = data.reduce(
      (m, d) => Math.max(m, d.l7Actual ?? 0, d.l7Planned ?? 0, d.l28Actual ?? 0, d.l28Planned ?? 0),
      0,
    );
    const axisMax = Math.max(10, Math.ceil(maxValue / 10) * 10);
    return Array.from({ length: axisMax / 10 + 1 }, (_, i) => i * 10);
  }, [data]);
  const axisMax = yTicks[yTicks.length - 1];

  const todayLabel = data.find((d) => d.l7Planned !== null && d.l7Actual !== null)?.label;

  return (
    <div className="flex flex-col gap-1">
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-neutral-200 dark:stroke-neutral-800" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={tickInterval} stroke="currentColor" />
            <YAxis
              tick={{ fontSize: 11 }}
              stroke="currentColor"
              width={36}
              domain={[0, axisMax]}
              ticks={yTicks}
            />
            <Tooltip content={<ChartTooltip />} />
            {todayLabel && (
              <ReferenceLine x={todayLabel} stroke="currentColor" className="text-neutral-300 dark:text-neutral-700" />
            )}
            <Line dataKey="l7Actual" name={SERIES_NAMES.l7Actual} stroke="#7c3aed" strokeWidth={2} dot={false} />
            <Line
              dataKey="l7Planned"
              name={SERIES_NAMES.l7Planned}
              stroke="#7c3aed"
              strokeWidth={2}
              strokeDasharray="6 4"
              dot={false}
              connectNulls
            />
            <Line dataKey="l28Actual" name={SERIES_NAMES.l28Actual} stroke="#f59e0b" strokeWidth={2} dot={false} />
            <Line
              dataKey="l28Planned"
              name={SERIES_NAMES.l28Planned}
              stroke="#f59e0b"
              strokeWidth={2}
              strokeDasharray="6 4"
              dot={false}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center gap-4 justify-center text-xs text-neutral-500 dark:text-neutral-400">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-violet-600 inline-block" />
          7-day rolling MPW
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
          28-day rolling MPW
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-4 border-t-2 border-dashed border-neutral-400 dark:border-neutral-600 inline-block" />
          Planned
        </span>
      </div>
    </div>
  );
}
