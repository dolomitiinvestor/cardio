import { useEffect, useMemo, useRef, useState } from 'react';
import { CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis } from 'recharts';
import type { DailyHoursPoint, DailyLoadPoint } from '../lib/stats';

interface RollingLoadChartProps {
  mpwData: DailyLoadPoint[];
  hoursData: DailyHoursPoint[];
}

type Metric = 'mpw' | 'hours';

interface ChartPoint {
  label: string;
  acute7: number;
  chronic28: number;
}

const PX_PER_DAY = 8;
const MIN_WIDTH = 320;
const AXIS_WIDTH = 44;
const X_AXIS_HEIGHT = 22;
const CHART_HEIGHT = 224;
// How many days are visible without scrolling — the chart can hold more days of
// history than this (scroll left to reach them), but the on-screen footprint
// never grows past what this many days would take up.
const VISIBLE_DAYS = 180;

export default function RollingLoadChart({ mpwData, hoursData }: RollingLoadChartProps) {
  const [metric, setMetric] = useState<Metric>('mpw');
  const scrollRef = useRef<HTMLDivElement>(null);

  const data: ChartPoint[] = useMemo(() => {
    if (metric === 'mpw') {
      return mpwData.map((d) => ({ label: d.label, acute7: d.acute7MPW, chronic28: d.chronic28MPW }));
    }
    return hoursData.map((d) => ({ label: d.label, acute7: d.acute7Hours, chronic28: d.chronic28Hours }));
  }, [metric, mpwData, hoursData]);

  const unit = metric === 'mpw' ? 'mi/wk' : 'hrs/wk';
  const acuteLabel = metric === 'mpw' ? '7-day rolling MPW' : '7-day rolling hours';
  const chronicLabel = metric === 'mpw' ? '28-day rolling MPW' : '28-day rolling hours';

  const chartWidth = Math.max(MIN_WIDTH, data.length * PX_PER_DAY);
  const visibleWidth = VISIBLE_DAYS * PX_PER_DAY;

  // Space x-axis labels about 70px apart so they don't overlap, however wide the chart gets.
  const desiredLabelCount = Math.max(1, Math.round(chartWidth / 70));
  const tickInterval = Math.max(0, Math.ceil(data.length / desiredLabelCount) - 1);

  const yTicks = useMemo(() => {
    const maxValue = data.reduce((m, d) => Math.max(m, d.acute7, d.chronic28), 0);
    const step = metric === 'mpw' ? 10 : 2;
    const axisMax = Math.max(step, Math.ceil(maxValue / step) * step);
    return Array.from({ length: axisMax / step + 1 }, (_, i) => i * step);
  }, [data, metric]);
  const axisMax = yTicks[yTicks.length - 1];

  // Default to showing the most recent data (scrolled all the way right).
  useEffect(() => {
    scrollRef.current?.scrollTo({ left: chartWidth });
  }, [chartWidth]);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-end gap-1">
        <MetricToggleButton active={metric === 'mpw'} onClick={() => setMetric('mpw')}>
          MPW
        </MetricToggleButton>
        <MetricToggleButton active={metric === 'hours'} onClick={() => setMetric('hours')}>
          Hours
        </MetricToggleButton>
      </div>

      <div className="flex">
        {/* Pinned y-axis, kept out of the scrolling area so it's always visible. */}
        <LineChart
          width={AXIS_WIDTH + 8}
          height={CHART_HEIGHT}
          data={data}
          margin={{ top: 8, right: 0, bottom: 0, left: 8 }}
        >
          <YAxis
            tick={{ fontSize: 11 }}
            stroke="currentColor"
            className="text-neutral-500"
            width={AXIS_WIDTH}
            domain={[0, axisMax]}
            ticks={yTicks}
          />
          <XAxis dataKey="label" height={X_AXIS_HEIGHT} tick={false} axisLine={false} tickLine={false} />
          {/* Invisible series: recharts won't generate y-axis ticks for a chart with zero graphical children. */}
          <Line dataKey="acute7" stroke="none" dot={false} isAnimationActive={false} />
        </LineChart>

        <div ref={scrollRef} className="overflow-x-auto flex-1" style={{ maxWidth: visibleWidth }}>
          <LineChart
            width={chartWidth}
            height={CHART_HEIGHT}
            data={data}
            margin={{ top: 8, right: 12, bottom: 0, left: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-neutral-200 dark:stroke-neutral-800" />
            <XAxis
              dataKey="label"
              height={X_AXIS_HEIGHT}
              tick={{ fontSize: 11 }}
              interval={tickInterval}
              stroke="currentColor"
              className="text-neutral-500"
            />
            <YAxis hide domain={[0, axisMax]} ticks={yTicks} />
            <Tooltip
              formatter={(value, name) => [
                `${value} ${unit}`,
                name === 'acute7' ? acuteLabel : chronicLabel,
              ]}
              contentStyle={{ fontSize: 12, borderRadius: 8 }}
            />
            <Line dataKey="acute7" stroke="#7c3aed" strokeWidth={2} dot={false} />
            <Line dataKey="chronic28" stroke="#f59e0b" strokeWidth={2} dot={false} />
          </LineChart>
        </div>
      </div>

      <div className="flex items-center gap-4 justify-center text-xs text-neutral-500 dark:text-neutral-400">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-violet-600 inline-block" />
          {acuteLabel}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
          {chronicLabel}
        </span>
      </div>

      {metric === 'hours' && (
        <p className="text-center text-xs text-neutral-400 dark:text-neutral-600">
          All cardio types, regardless of the filter above
        </p>
      )}

      {data.length > VISIBLE_DAYS && (
        <p className="text-center text-xs text-neutral-400 dark:text-neutral-600">
          Scroll left to see older data
        </p>
      )}
    </div>
  );
}

function MetricToggleButton({
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
      className={`rounded-full px-2.5 py-1 text-xs font-medium border transition-colors ${
        active
          ? 'bg-violet-600 border-violet-600 text-white'
          : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-300'
      }`}
    >
      {children}
    </button>
  );
}
