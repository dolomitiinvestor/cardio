import type { RiskTone } from '../lib/stats';

interface RiskBannerProps {
  label: string;
  detail: string;
  tone: RiskTone;
  acwr: number | null;
  cumulativeOverload: number | null;
}

const TONE_STYLES: Record<RiskTone, string> = {
  good: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200',
  caution: 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200',
  high: 'bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-700 text-red-900 dark:text-red-200',
  low: 'bg-sky-50 dark:bg-sky-950/40 border-sky-300 dark:border-sky-700 text-sky-900 dark:text-sky-200',
};

const TONE_ICON: Record<RiskTone, string> = {
  good: '✅',
  caution: '⚠️',
  high: '🚩',
  low: 'ℹ️',
};

export default function RiskBanner({ label, detail, tone, acwr, cumulativeOverload }: RiskBannerProps) {
  return (
    <div className={`rounded-xl border p-3 flex flex-col gap-1 ${TONE_STYLES[tone]}`}>
      <div className="flex items-center gap-2">
        <span className="text-lg leading-none">{TONE_ICON[tone]}</span>
        <span className="font-semibold text-sm">Injury risk: {label}</span>
      </div>
      <p className="text-xs opacity-90">{detail}</p>
      <p className="text-[11px] opacity-75 tabular-nums">
        ACWR (7d:28d): {acwr === null ? '—' : acwr.toFixed(2)} · Cumulative overload (4wk:13wk):{' '}
        {cumulativeOverload === null ? '—' : cumulativeOverload.toFixed(2)}
      </p>
    </div>
  );
}
