import { useMemo, useState } from 'react';
import type { Activity, CardioType } from '../lib/types';
import { CARDIO_TYPES } from '../lib/types';
import { formatDuration, formatPace } from '../lib/stats';

interface HistoryListProps {
  activities: Activity[];
  onDelete: (id: string) => void;
}

export default function HistoryList({ activities, onDelete }: HistoryListProps) {
  const [filter, setFilter] = useState<CardioType | 'all'>('all');
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const filtered = useMemo(
    () => (filter === 'all' ? activities : activities.filter((a) => a.type === filter)),
    [activities, filter],
  );

  return (
    <div className="p-4 flex flex-col gap-3 pb-24 max-w-md mx-auto w-full">
      <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">History</h2>

      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <FilterChip active={filter === 'all'} onClick={() => setFilter('all')}>
          All
        </FilterChip>
        {CARDIO_TYPES.map((t) => (
          <FilterChip key={t} active={filter === t} onClick={() => setFilter(t)}>
            {t}
          </FilterChip>
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="text-sm text-neutral-500 dark:text-neutral-400 text-center py-8">No activities.</p>
      )}

      <ul className="flex flex-col gap-1.5">
        {filtered.map((a) => {
          const pace = a.distanceMiles > 0 ? a.durationSeconds / a.distanceMiles : null;
          return (
            <li
              key={a.id}
              className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-3 py-2.5 flex items-center justify-between text-sm gap-2"
            >
              <div className="flex flex-col min-w-0">
                <span className="font-medium text-neutral-900 dark:text-neutral-50">
                  {a.type} · {a.distanceMiles.toFixed(2)} mi
                </span>
                <span className="text-neutral-500 dark:text-neutral-400 text-xs">
                  {a.date} · {formatDuration(a.durationSeconds)} · {formatPace(pace)}
                  {a.source === 'strava' ? ' · Strava' : ''}
                </span>
                {a.notes && (
                  <span className="text-neutral-500 dark:text-neutral-400 text-xs truncate">{a.notes}</span>
                )}
              </div>
              {confirmId === a.id ? (
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => {
                      onDelete(a.id);
                      setConfirmId(null);
                    }}
                    className="text-xs font-semibold text-red-600 dark:text-red-400 px-2 py-1 rounded bg-red-50 dark:bg-red-950/40"
                  >
                    Delete
                  </button>
                  <button
                    onClick={() => setConfirmId(null)}
                    className="text-xs font-medium text-neutral-500 px-2 py-1"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmId(a.id)}
                  className="text-xs font-medium text-neutral-400 shrink-0 px-2 py-1"
                  aria-label="Delete activity"
                >
                  Delete
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function FilterChip({
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
      className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium border transition-colors ${
        active
          ? 'bg-violet-600 border-violet-600 text-white'
          : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-300'
      }`}
    >
      {children}
    </button>
  );
}
