import { useRef, useState } from 'react';
import type { ColumnMapping, ParsedCsv } from '../lib/csvImport';
import { buildActivitiesFromRows, guessMapping, parseCsvFile } from '../lib/csvImport';
import type { NewActivity } from '../lib/types';
import { clearGistConfig, getGistConfig, pullFromGist, pushToGist, saveGistConfig } from '../lib/gistSync';

interface SettingsViewProps {
  activityCount: number;
  onExport: () => string;
  onRestoreBackup: (json: string) => void;
  onClearAll: () => void;
  onImportCsv: (activities: NewActivity[]) => { added: number; skipped: number };
}

export default function SettingsView({
  activityCount,
  onExport,
  onRestoreBackup,
  onClearAll,
  onImportCsv,
}: SettingsViewProps) {
  const backupFileInputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const csvFileInputRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<ParsedCsv | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping | null>(null);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [csvResult, setCsvResult] = useState<{ added: number; skipped: number; failed: number } | null>(null);

  const gistConfig = getGistConfig();
  const [gistToken, setGistToken] = useState(gistConfig?.token ?? '');
  const [gistId, setGistId] = useState(gistConfig?.gistId ?? '');
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(gistConfig?.lastSyncedAt ?? null);
  const [gistBusy, setGistBusy] = useState<'push' | 'pull' | null>(null);
  const [gistError, setGistError] = useState<string | null>(null);
  const [gistMessage, setGistMessage] = useState<string | null>(null);
  const [confirmPull, setConfirmPull] = useState(false);

  function handleExport() {
    const json = onExport();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cardio-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleRestoreFile(file: File) {
    try {
      const text = await file.text();
      onRestoreBackup(text);
      setMessage('Backup restored.');
    } catch {
      setMessage('Could not read that backup file.');
    }
    if (backupFileInputRef.current) backupFileInputRef.current.value = '';
  }

  async function handleCsvFile(file: File) {
    setCsvError(null);
    setCsvResult(null);
    try {
      const csv = await parseCsvFile(file);
      if (csv.headers.length === 0 || csv.rows.length === 0) {
        setCsvError('No rows found in that file.');
        return;
      }
      setParsed(csv);
      setMapping(guessMapping(csv.headers));
    } catch {
      setCsvError('Could not read that CSV file.');
    }
  }

  function handleImportCsv() {
    if (!parsed || !mapping) return;
    const results = buildActivitiesFromRows(parsed.rows, mapping, 'all');
    const activities: NewActivity[] = results.filter((r) => r.activity).map((r) => r.activity!);
    const failed = results.filter((r) => !r.activity && r.error).length;
    const { added, skipped } = onImportCsv(activities);
    setCsvResult({ added, skipped, failed });
    setParsed(null);
    setMapping(null);
    if (csvFileInputRef.current) csvFileInputRef.current.value = '';
  }

  async function handleGistPush() {
    setGistError(null);
    setGistMessage(null);
    const token = gistToken.trim();
    if (!token) {
      setGistError('Paste a GitHub token first.');
      return;
    }
    setGistBusy('push');
    try {
      const json = onExport();
      const id = await pushToGist(token, gistId.trim() || null, json);
      const now = new Date().toISOString();
      setGistId(id);
      setLastSyncedAt(now);
      saveGistConfig({ token, gistId: id, lastSyncedAt: now });
      setGistMessage('Pushed this device\'s data to the Gist.');
    } catch (e) {
      setGistError(e instanceof Error ? e.message : 'Push failed.');
    } finally {
      setGistBusy(null);
    }
  }

  async function handleGistPull() {
    setGistError(null);
    setGistMessage(null);
    const token = gistToken.trim();
    const id = gistId.trim();
    if (!token || !id) {
      setGistError('A token and Gist ID are both required to pull.');
      return;
    }
    setGistBusy('pull');
    try {
      const json = await pullFromGist(token, id);
      onRestoreBackup(json);
      const now = new Date().toISOString();
      setLastSyncedAt(now);
      saveGistConfig({ token, gistId: id, lastSyncedAt: now });
      setGistMessage('Pulled from the Gist and restored on this device.');
    } catch (e) {
      setGistError(e instanceof Error ? e.message : 'Pull failed.');
    } finally {
      setGistBusy(null);
      setConfirmPull(false);
    }
  }

  function handleForgetGistConfig() {
    clearGistConfig();
    setGistToken('');
    setGistId('');
    setLastSyncedAt(null);
    setGistMessage('Forgot saved token and Gist ID on this device.');
    setGistError(null);
  }

  const preview = parsed && mapping ? buildActivitiesFromRows(parsed.rows.slice(0, 5), mapping, 'all') : [];

  return (
    <div className="p-4 flex flex-col gap-4 pb-24 max-w-md mx-auto w-full">
      <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">Settings</h2>

      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-3 flex flex-col gap-1 text-sm">
        <span className="text-neutral-500 dark:text-neutral-400">Activities stored on this device</span>
        <span className="text-2xl font-semibold text-neutral-900 dark:text-neutral-50 tabular-nums">
          {activityCount}
        </span>
      </div>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">Import from Strava</h3>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          On strava.com go to Settings → My Account → Download or Delete Your Account → Download Request.
          You'll get an export with an <code className="px-1 rounded bg-neutral-100 dark:bg-neutral-800">activities.csv</code> file
          — upload that here. Re-importing the same file is safe, duplicates are skipped automatically.
        </p>

        <label className="rounded-xl border-2 border-dashed border-neutral-300 dark:border-neutral-700 p-6 flex flex-col items-center gap-2 text-center cursor-pointer active:bg-neutral-50 dark:active:bg-neutral-900">
          <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Tap to choose activities.csv</span>
          <span className="text-xs text-neutral-500">Any CSV with a date, type, distance and duration column works</span>
          <input
            ref={csvFileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleCsvFile(file);
            }}
          />
        </label>

        {csvError && <p className="text-sm text-red-600 dark:text-red-400">{csvError}</p>}

        {csvResult && (
          <div className="rounded-lg border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 p-3 text-sm text-emerald-800 dark:text-emerald-300">
            Imported {csvResult.added} activities.
            {csvResult.skipped > 0 && ` Skipped ${csvResult.skipped} duplicates.`}
            {csvResult.failed > 0 && ` ${csvResult.failed} rows couldn't be parsed.`}
          </div>
        )}

        {parsed && mapping && (
          <div className="flex flex-col gap-3 rounded-xl border border-neutral-200 dark:border-neutral-800 p-3">
            <h4 className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">
              Map columns ({parsed.rows.length} rows found)
            </h4>

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
              onClick={handleImportCsv}
              className="rounded-lg bg-violet-600 text-white font-semibold py-2.5 text-sm active:scale-[0.98] transition-transform"
            >
              Import {parsed.rows.length} rows
            </button>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">Backup</h3>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          Your data lives only in this browser. Export a backup occasionally, especially before deleting
          the app or clearing Safari data.
        </p>
        <button
          onClick={handleExport}
          className="rounded-lg border border-neutral-300 dark:border-neutral-700 py-2.5 text-sm font-semibold text-neutral-900 dark:text-neutral-50"
        >
          Export backup (.json)
        </button>
        <label className="rounded-lg border border-neutral-300 dark:border-neutral-700 py-2.5 text-sm font-semibold text-neutral-900 dark:text-neutral-50 text-center cursor-pointer">
          Restore from backup
          <input
            ref={backupFileInputRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleRestoreFile(file);
            }}
          />
        </label>
        {message && <p className="text-xs text-emerald-600 dark:text-emerald-400">{message}</p>}
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">Sync across devices (GitHub Gist)</h3>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          Push your data to a private Gist on your GitHub account, then pull it down on another device.
          Create a token at{' '}
          <code className="px-1 rounded bg-neutral-100 dark:bg-neutral-800">
            github.com/settings/tokens/new?scopes=gist
          </code>{' '}
          (classic token, <code className="px-1 rounded bg-neutral-100 dark:bg-neutral-800">gist</code> scope
          only) and paste it below. The token and Gist ID are stored only in this browser.
        </p>

        <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700 dark:text-neutral-300">
          Personal access token
          <input
            type="password"
            value={gistToken}
            onChange={(e) => setGistToken(e.target.value)}
            placeholder="ghp_..."
            autoComplete="off"
            className="rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700 dark:text-neutral-300">
          Gist ID
          <input
            type="text"
            value={gistId}
            onChange={(e) => setGistId(e.target.value)}
            placeholder="Leave blank to create a new one on first push"
            autoComplete="off"
            className="rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm"
          />
        </label>

        <div className="flex gap-2">
          <button
            onClick={handleGistPush}
            disabled={gistBusy !== null}
            className="flex-1 rounded-lg bg-violet-600 text-white font-semibold py-2.5 text-sm active:scale-[0.98] transition-transform disabled:opacity-50"
          >
            {gistBusy === 'push' ? 'Pushing…' : 'Push to Gist'}
          </button>
          {confirmPull ? (
            <button
              onClick={handleGistPull}
              disabled={gistBusy !== null}
              className="flex-1 rounded-lg bg-red-600 text-white font-semibold py-2.5 text-sm disabled:opacity-50"
            >
              {gistBusy === 'pull' ? 'Pulling…' : 'Confirm overwrite'}
            </button>
          ) : (
            <button
              onClick={() => setConfirmPull(true)}
              disabled={gistBusy !== null}
              className="flex-1 rounded-lg border border-neutral-300 dark:border-neutral-700 py-2.5 text-sm font-semibold text-neutral-900 dark:text-neutral-50 disabled:opacity-50"
            >
              Pull from Gist
            </button>
          )}
        </div>
        {confirmPull && (
          <p className="text-xs text-red-600 dark:text-red-400">
            This replaces all data on this device with what's in the Gist.{' '}
            <button onClick={() => setConfirmPull(false)} className="underline">
              Cancel
            </button>
          </p>
        )}

        {lastSyncedAt && (
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Last synced {new Date(lastSyncedAt).toLocaleString()}
          </p>
        )}
        {gistMessage && <p className="text-xs text-emerald-600 dark:text-emerald-400">{gistMessage}</p>}
        {gistError && <p className="text-xs text-red-600 dark:text-red-400">{gistError}</p>}

        {gistConfig && (
          <button
            onClick={handleForgetGistConfig}
            className="self-start text-xs text-neutral-500 dark:text-neutral-400 underline"
          >
            Forget saved token on this device
          </button>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">Danger zone</h3>
        {confirmClear ? (
          <div className="flex gap-2">
            <button
              onClick={() => {
                onClearAll();
                setConfirmClear(false);
                setMessage('All activities deleted.');
              }}
              className="flex-1 rounded-lg bg-red-600 text-white py-2.5 text-sm font-semibold"
            >
              Confirm delete all
            </button>
            <button
              onClick={() => setConfirmClear(false)}
              className="flex-1 rounded-lg border border-neutral-300 dark:border-neutral-700 py-2.5 text-sm font-semibold"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmClear(true)}
            className="rounded-lg border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 py-2.5 text-sm font-semibold"
          >
            Delete all activities
          </button>
        )}
      </section>
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
