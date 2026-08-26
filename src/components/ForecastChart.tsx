import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface ForecastChartProps {
  data: { label: string; actual: number | null; planned: number | null }[];
}

export default function ForecastChart({ data }: ForecastChartProps) {
  const tickInterval = Math.max(0, Math.ceil(data.length / 8) - 1);

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-neutral-200 dark:stroke-neutral-800" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={tickInterval} stroke="currentColor" />
          <YAxis tick={{ fontSize: 11 }} stroke="currentColor" width={36} allowDecimals={false} />
          <Tooltip
            formatter={(value, name) => [
              value == null ? '—' : `${value} mi`,
              name === 'actual' ? 'Actual (7-day total)' : 'Planned (7-day total)',
            ]}
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
          />
          <Bar dataKey="actual" fill="#7c3aed" radius={[2, 2, 0, 0]} />
          <Line dataKey="planned" stroke="#7c3aed" strokeWidth={2} strokeDasharray="6 4" dot={false} connectNulls />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
