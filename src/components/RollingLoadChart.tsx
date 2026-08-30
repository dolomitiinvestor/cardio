import { useEffect, useMemo, useRef } from 'react';
import { CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis } from 'recharts';
import type { DailyLoadPoint } from '../lib/stats';

interface RollingLoadChartProps {
  data: DailyLoadPoint[];
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

export default function RollingLoadChart({ data }: RollingLoadChartProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const chartWidth = Math.max(MIN_WIDTH, data.length * PX_PER_DAY);
  const visibleWidth = VISIBLE_DAYS * PX_PER_DAY;

  // Space x-axis labels about 70px apart so they don't overlap, however wide the chart gets.
  const desiredLabelCount = Math.max(1, Math.round(chartWidth / 70));
  const tickInterval = Math.max(0, Math.ceil(data.length / desiredLabelCount) - 1);

  const yTicks = useMemo(() => {
    const maxValue = data.reduce((m, d) => Math.max(m, d.acute7MPW, d.chronic28MPW), 0);
    const axisMax = Math.max(10, Math.ceil(maxValue / 10) * 10);
    return Array.from({ length: axisMax / 10 + 1 }, (_, i) => i * 10);
  }, [data]);
  const axisMax = yTicks[yTicks.length - 1];

  // Default to showing the most recent data (scrolled all the way right).
  useEffect(() => {
    scrollRef.current?.scrollTo({ left: chartWidth });
  }, [chartWidth]);

  return (
    <div className="flex flex-col gap-1">
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
          <Line dataKey="acute7MPW" stroke="none" dot={false} isAnimationActive={false} />
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
                `${value} mi/wk`,
                name === 'acute7MPW' ? '7-day rolling MPW' : '28-day rolling MPW',
              ]}
              contentStyle={{ fontSize: 12, borderRadius: 8 }}
            />
            <Line dataKey="acute7MPW" stroke="#7c3aed" strokeWidth={2} dot={false} />
            <Line dataKey="chronic28MPW" stroke="#f59e0b" strokeWidth={2} dot={false} />
          </LineChart>
        </div>
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
      </div>

      {data.length > VISIBLE_DAYS && (
        <p className="text-center text-xs text-neutral-400 dark:text-neutral-600">
          Scroll left to see older data
        </p>
      )}
    </div>
  );
}
