import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { WeekSummary } from '../lib/stats';

interface WeeklyChartProps {
  weeks: WeekSummary[];
}

export default function WeeklyChart({ weeks }: WeeklyChartProps) {
  const data = weeks.map((w) => ({
    label: w.label,
    miles: Math.round(w.miles * 10) / 10,
  }));

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-neutral-200 dark:stroke-neutral-800" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11 }}
            interval="preserveStartEnd"
            stroke="currentColor"
            className="text-neutral-500"
          />
          <YAxis tick={{ fontSize: 11 }} stroke="currentColor" className="text-neutral-500" width={32} />
          <Tooltip
            formatter={(value) => [`${value} mi`, 'Distance']}
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
          />
          <Bar dataKey="miles" fill="#7c3aed" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
