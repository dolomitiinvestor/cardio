import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { DailyLoadPoint } from '../lib/stats';

interface RollingLoadChartProps {
  data: DailyLoadPoint[];
}

export default function RollingLoadChart({ data }: RollingLoadChartProps) {
  // Show roughly one x-axis label per week so daily data doesn't overlap.
  const tickInterval = Math.max(0, Math.floor(data.length / 12) - 1);

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-neutral-200 dark:stroke-neutral-800" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11 }}
            interval={tickInterval}
            stroke="currentColor"
            className="text-neutral-500"
          />
          <YAxis
            tick={{ fontSize: 11 }}
            stroke="currentColor"
            className="text-neutral-500"
            width={40}
            allowDecimals={false}
          />
          <Tooltip
            formatter={(value, name) => [
              `${value} mi/wk`,
              name === 'acute7MPW' ? '7-day rolling MPW' : '28-day rolling MPW',
            ]}
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
          />
          <Legend
            formatter={(value) => (value === 'acute7MPW' ? '7-day rolling MPW' : '28-day rolling MPW')}
            wrapperStyle={{ fontSize: 12 }}
          />
          <Line dataKey="acute7MPW" stroke="#7c3aed" strokeWidth={2} dot={false} />
          <Line dataKey="chronic28MPW" stroke="#f59e0b" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
