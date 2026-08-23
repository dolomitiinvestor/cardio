import { useRef, useState } from 'react';
import type { ColumnMapping, ParsedCsv } from '../lib/csvImport';
import { buildActivitiesFromRows, guessMapping, parseCsvFile } from '../lib/csvImport';
import type { NewActivity } from '../lib/types';

interface ImportViewProps {
  onImport: (activities: NewActivity[]) => { added: number; skipped: number };
}

export default function ImportView({ onImport }: ImportViewProps) {
  const [parsed, setParsed] = useState<ParsedCsv | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ added: number; skipped: number; failed: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setError(null);
    setResult(null);
    try {
      const csv = await parseCsvFile(file);
      if (csv.headers.length === 0 || csv.rows.length === 0) {
        setError('No rows found in that file.');
        return;
      }
      setParsed(csv);
      setMapping(guessMapping(csv.headers));
    } catch {
      setError('Could not read that CSV file.');
    }
  }

  function handleImport() {
    if (!parsed || !mapping) return;
    const results = buildActivitiesFromRows(parsed.rows, mapping, 'all');
    const activities: NewActivity[] = results.filter((r) => r.activity).map((r) => r.activity!);
    const failed = results.filter((r) => !r.activity && r.error).length;
    const { added, skipped } = onImport(activities);
    setResult({ added, skipped, failed });
    setParsed(null);
    setMapping(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  const preview = parsed && mapping ? buildActivitiesFromRows(parsed.rows.slice(0, 5), mapping, 'all') : [];

  return (
    <div className="p-4 flex flex-col gap-4 pb-24 max-w-md mx-auto w-full">
      <div>
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">Import from Strava</h2>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
          On strava.com go to Settings → My Account → Download or Delete Your Account → Download Request.
          You'll get an export with an <code className="px-1 rounded bg-neutral-100 dark:bg-neutral-800">activities.csv</code> file
          — upload that here. Re-importing the same file is safe, duplicates are skipped automatically.
        </p>
      </div>

      <label className="rounded-xl border-2 border-dashed border-neutral-300 dark:border-neutral-700 p-6 flex flex-col items-center gap-2 text-center cursor-pointer active:bg-neutral-50 dark:active:bg-neutral-900">
        <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Tap to choose activities.csv</span>
        <span className="text-xs text-neutral-500">Any CSV with a date, type, distance and duration column works</span>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
      </label>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {result && (
        <div className="rounded-lg border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 p-3 text-sm text-emerald-800 dark:text-emerald-300">
          Imported {result.added} activities.
          {result.skipped > 0 && ` Skipped ${result.skipped} duplicates.`}
          {result.failed > 0 && ` ${result.failed} rows couldn't be parsed.`}
        </div>
      )}

      {parsed && mapping && (
        <div className="flex flex-col gap-3 rounded-xl border border-neutral-200 dark:border-neutral-800 p-3">
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">
            Map columns ({parsed.rows.length} rows found)
          </h3>

          <ColumnSelect
            label="Date column"
            value={mapping.dateColumn}
            options={parsed.headers}
            onChange={(v) => setMapping({ ...mapping, dateColumn: v })}
          />
          <ColumnSelect
            label="Type column"
            value={mapping.typeColumn}
            options={parsed.headers}
            onChange={(v) => setMapping({ ...mapping, typeColumn: v })}
          />
          <ColumnSelect
            label="Distance column"
            value={mapping.distanceColumn}
            options={parsed.headers}
            onChange={(v) => setMapping({ ...mapping, distanceColumn: v })}
          />
          <div className="flex flex-col gap-1 text-sm font-medium text-neutral-700 dark:text-neutral-300">
            Distance unit
            <select
              value={mapping.distanceUnit}
              onChange={(e) => setMapping({ ...mapping, distanceUnit: e.target.value as ColumnMapping['distanceUnit'] })}
              className="rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm"
            >
              <option value="meters">Meters (Strava raw export default)</option>
              <option value="miles">Miles</option>
              <option value="km">Kilometers</option>
            </select>
          </div>
          <ColumnSelect
            label="Duration column"
            value={mapping.durationColumn}
            options={parsed.headers}
            onChange={(v) => setMapping({ ...mapping, durationColumn: v })}
          />
          <div className="flex flex-col gap-1 text-sm font-medium text-neutral-700 dark:text-neutral-300">
            Duration unit
            <select
              value={mapping.durationUnit}
              onChange={(e) => setMapping({ ...mapping, durationUnit: e.target.value as ColumnMapping['durationUnit'] })}
              className="rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm"
            >
              <option value="seconds">Seconds</option>
              <option value="minutes">Minutes</option>
              <option value="hms">h:mm:ss</option>
            </select>
          </div>

          <div className="text-xs text-neutral-500 dark:text-neutral-400">
            <p className="font-medium mb-1">Preview:</p>
            <ul className="flex flex-col gap-0.5">
              {preview.map((r, i) => (
                <li key={i}>
                  {r.activity
                    ? `${r.activity.date} · ${r.activity.type} · ${r.activity.distanceMiles.toFixed(2)} mi`
                    : `⚠ ${r.error ?? 'filtered'}`}
                </li>
              ))}
            </ul>
          </div>

          <button
            onClick={handleImport}
            className="rounded-lg bg-violet-600 text-white font-semibold py-2.5 text-sm active:scale-[0.98] transition-transform"
          >
            Import {parsed.rows.length} rows
          </button>
        </div>
      )}
    </div>
  );
}

function ColumnSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700 dark:text-neutral-300">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}
