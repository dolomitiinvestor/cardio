import { useState } from 'react';
import { format } from 'date-fns';
import type { CardioType, NewActivity } from '../lib/types';
import { CARDIO_TYPES } from '../lib/types';

interface LogFormProps {
  onSave: (activity: NewActivity) => void;
}

export default function LogForm({ onSave }: LogFormProps) {
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [type, setType] = useState<CardioType>('Run');
  const [minutes, setMinutes] = useState('');
  const [seconds, setSeconds] = useState('');
  const [distance, setDistance] = useState('');
  const [notes, setNotes] = useState('');
  const [savedFlash, setSavedFlash] = useState(false);

  const durationSeconds = (parseInt(minutes || '0', 10) || 0) * 60 + (parseInt(seconds || '0', 10) || 0);
  const distanceMiles = parseFloat(distance || '0') || 0;
  const canSave = date && (durationSeconds > 0 || distanceMiles > 0);

  const paceLabel = (() => {
    if (durationSeconds <= 0 || distanceMiles <= 0) return null;
    const secPerMile = durationSeconds / distanceMiles;
    const m = Math.floor(secPerMile / 60);
    const s = Math.round(secPerMile % 60);
    return `${m}:${s.toString().padStart(2, '0')} /mi pace`;
  })();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    onSave({
      date,
      type,
      durationSeconds,
      distanceMiles,
      notes: notes.trim() || undefined,
      source: 'manual',
    });
    setMinutes('');
    setSeconds('');
    setDistance('');
    setNotes('');
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1500);
  }

  return (
    <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-4 pb-24 max-w-md mx-auto w-full">
      <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">Log a workout</h2>

      <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700 dark:text-neutral-300">
        Date
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2.5 text-base text-neutral-900 dark:text-neutral-50"
          required
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700 dark:text-neutral-300">
        Type
        <select
          value={type}
          onChange={(e) => setType(e.target.value as CardioType)}
          className="rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2.5 text-base text-neutral-900 dark:text-neutral-50"
        >
          {CARDIO_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>

      <div className="flex flex-col gap-1 text-sm font-medium text-neutral-700 dark:text-neutral-300">
        Duration
        <div className="flex gap-2 items-center">
          <input
            type="number"
            inputMode="numeric"
            min={0}
            placeholder="0"
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2.5 text-base text-neutral-900 dark:text-neutral-50"
          />
          <span className="text-neutral-500 text-sm shrink-0">min</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={59}
            placeholder="0"
            value={seconds}
            onChange={(e) => setSeconds(e.target.value)}
            className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2.5 text-base text-neutral-900 dark:text-neutral-50"
          />
          <span className="text-neutral-500 text-sm shrink-0">sec</span>
        </div>
      </div>

      <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700 dark:text-neutral-300">
        Distance (miles)
        <input
          type="number"
          inputMode="decimal"
          step="0.01"
          min={0}
          placeholder="0.00"
          value={distance}
          onChange={(e) => setDistance(e.target.value)}
          className="rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2.5 text-base text-neutral-900 dark:text-neutral-50"
        />
      </label>

      {paceLabel && <p className="text-sm text-neutral-500 dark:text-neutral-400 -mt-2">{paceLabel}</p>}

      <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700 dark:text-neutral-300">
        Notes (optional)
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2.5 text-base text-neutral-900 dark:text-neutral-50 resize-none"
        />
      </label>

      <button
        type="submit"
        disabled={!canSave}
        className="rounded-lg bg-violet-600 disabled:bg-neutral-300 dark:disabled:bg-neutral-700 text-white font-semibold py-3 text-base active:scale-[0.98] transition-transform"
      >
        {savedFlash ? 'Saved ✓' : 'Save workout'}
      </button>
    </form>
  );
}
