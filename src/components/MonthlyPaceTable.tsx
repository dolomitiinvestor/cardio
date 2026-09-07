import type { MonthlyPaceSummary } from '../lib/stats';
import { formatPace } from '../lib/stats';

interface MonthlyPaceTableProps {
  months: MonthlyPaceSummary[];
}

export default function MonthlyPaceTable({ months }: MonthlyPaceTableProps) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          <th className="py-1 font-medium">Month</th>
          <th className="py-1 font-medium text-right">Avg pace</th>
          <th className="py-1 font-medium text-right">Miles</th>
        </tr>
      </thead>
      <tbody>
        {months.map((m) => (
          <tr key={m.monthKey} className="border-t border-neutral-100 dark:border-neutral-800">
            <td className="py-1.5 text-neutral-900 dark:text-neutral-50">{m.label}</td>
            <td className="py-1.5 text-right tabular-nums text-neutral-900 dark:text-neutral-50">
              {formatPace(m.avgPaceSecPerMile)}
            </td>
            <td className="py-1.5 text-right tabular-nums text-neutral-500 dark:text-neutral-400">
              {m.miles.toFixed(1)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
