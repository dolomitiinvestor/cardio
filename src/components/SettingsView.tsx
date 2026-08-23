import { useRef, useState } from 'react';

interface SettingsViewProps {
  activityCount: number;
  onExport: () => string;
  onImport: (json: string) => void;
  onClearAll: () => void;
}

export default function SettingsView({ activityCount, onExport, onImport, onClearAll }: SettingsViewProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

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

  async function handleImportFile(file: File) {
    try {
      const text = await file.text();
      onImport(text);
      setMessage('Backup restored.');
    } catch {
      setMessage('Could not read that backup file.');
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

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
            ref={fileInputRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImportFile(file);
            }}
          />
        </label>
        {message && <p className="text-xs text-emerald-600 dark:text-emerald-400">{message}</p>}
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
