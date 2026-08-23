interface StatCardProps {
  label: string;
  value: string;
  sublabel?: string;
  tone?: 'default' | 'good' | 'caution' | 'high' | 'low';
}

const TONE_CLASSES: Record<NonNullable<StatCardProps['tone']>, string> = {
  default: 'border-neutral-200 dark:border-neutral-800',
  good: 'border-emerald-300 dark:border-emerald-700',
  caution: 'border-amber-300 dark:border-amber-700',
  high: 'border-red-300 dark:border-red-700',
  low: 'border-sky-300 dark:border-sky-700',
};

export default function StatCard({ label, value, sublabel, tone = 'default' }: StatCardProps) {
  return (
    <div
      className={`rounded-xl border bg-white dark:bg-neutral-900 p-3 flex flex-col gap-0.5 ${TONE_CLASSES[tone]}`}
    >
      <span className="text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
        {label}
      </span>
      <span className="text-xl font-semibold text-neutral-900 dark:text-neutral-50 tabular-nums">
        {value}
      </span>
      {sublabel && <span className="text-xs text-neutral-500 dark:text-neutral-400">{sublabel}</span>}
    </div>
  );
}
