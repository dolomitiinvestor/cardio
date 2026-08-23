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
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-neutral-200 dark:stroke-neutral-800" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" stroke="currentColor" />
          <YAxis tick={{ fontSize: 11 }} stroke="currentColor" width={32} />
          <Tooltip
            formatter={(value, name) => [value == null ? '—' : `${value} mi`, name === 'actual' ? 'Actual' : 'Planned']}
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
          />
          <Bar dataKey="actual" fill="#7c3aed" radius={[4, 4, 0, 0]} />
          <Line
            dataKey="planned"
            stroke="#7c3aed"
            strokeWidth={2}
            strokeDasharray="6 4"
            dot={{ r: 3 }}
            connectNulls
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
