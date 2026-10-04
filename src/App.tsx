import { useCallback, useEffect, useRef, useState } from 'react';
import Dashboard from './components/Dashboard';
import LogForm from './components/LogForm';
import ForecastView from './components/ForecastView';
import HistoryList from './components/HistoryList';
import SettingsView from './components/SettingsView';
import type { Activity, NewActivity } from './lib/types';
import {
  addActivitiesDeduped,
  addActivity,
  deleteActivity,
  deleteAllActivities,
  exportActivitiesCsv,
  exportActivitiesJson,
  getActivities,
  importActivitiesJson,
  onDataChange,
} from './lib/storage';
import { autoPull, autoPush, getGistConfig, isAutoSyncReady, saveGistConfig } from './lib/gistSync';

type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error';
// Re-pull when the app comes back to the foreground, at most this often.
const RESUME_PULL_MIN_MS = 60_000;

type Tab = 'dashboard' | 'log' | 'forecast' | 'history' | 'settings';

const TABS: { id: Tab; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'log', label: 'Log' },
  { id: 'forecast', label: 'Forecast' },
  { id: 'history', label: 'History' },
  { id: 'settings', label: 'Settings' },
];

export default function App() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [activities, setActivities] = useState<Activity[]>(() => getActivities());

  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [syncError, setSyncError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setActivities(getActivities());
  }, []);

  // Gist auto-sync: pull on open (and on resume), push shortly after any change.
  const pullDone = useRef(false);
  const pullOk = useRef(false);
  const lastPullAt = useRef(0);
  const pushTimer = useRef<number | undefined>(undefined);

  const runPush = useCallback(async () => {
    if (!getGistConfig()?.autoSync) return;
    setSyncStatus('syncing');
    try {
      await autoPush();
      setSyncStatus('synced');
      setSyncError(null);
    } catch (e) {
      setSyncStatus('error');
      setSyncError(e instanceof Error ? e.message : 'Push failed.');
    }
  }, []);

  const runPull = useCallback(async () => {
    if (!isAutoSyncReady()) {
      pullDone.current = true;
      return;
    }
    lastPullAt.current = Date.now();
    setSyncStatus('syncing');
    try {
      if (await autoPull()) refresh();
      pullOk.current = true;
      setSyncStatus('synced');
      setSyncError(null);
    } catch (e) {
      setSyncStatus('error');
      setSyncError(e instanceof Error ? e.message : 'Pull failed.');
    } finally {
      pullDone.current = true;
    }
  }, [refresh]);

  useEffect(() => {
    runPull();

    const unsubscribe = onDataChange(() => {
      if (!getGistConfig()?.autoSync) return;
      saveGistConfig({ pendingPush: true });
      window.clearTimeout(pushTimer.current);
      // Wait for the opening pull so we don't push stale data over the Gist;
      // autoPull merges and pushes pending changes itself.
      if (!pullDone.current) return;
      // If the opening pull failed (e.g. offline), pull again first — with a
      // pending change that merges both sides and pushes, so nothing is lost.
      pushTimer.current = window.setTimeout(pullOk.current ? runPush : runPull, 800);
    });

    function handleVisibility() {
      if (document.visibilityState === 'visible' && Date.now() - lastPullAt.current > RESUME_PULL_MIN_MS) {
        runPull();
      }
    }
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      unsubscribe();
      window.clearTimeout(pushTimer.current);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [runPull, runPush]);

  function handleSave(activity: NewActivity) {
    addActivity(activity);
    refresh();
    setTab('dashboard');
  }

  function handleImport(newActivities: NewActivity[]) {
    const { added, skipped } = addActivitiesDeduped(newActivities);
    refresh();
    return { added: added.length, skipped };
  }

  function handleDelete(id: string) {
    deleteActivity(id);
    refresh();
  }

  function handleClearAll() {
    deleteAllActivities();
    refresh();
  }

  function handleRestore(json: string) {
    importActivitiesJson(json);
    refresh();
  }

  return (
    <div className="min-h-screen flex flex-col bg-neutral-50 dark:bg-neutral-950">
      <header className="sticky top-0 z-10 bg-white/90 dark:bg-neutral-900/90 backdrop-blur border-b border-neutral-200 dark:border-neutral-800 px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-base font-bold text-neutral-900 dark:text-neutral-50">🏃 Cardio Tracker</h1>
          {syncStatus !== 'idle' && (
            <span
              title={syncError ?? undefined}
              className={`text-xs ${
                syncStatus === 'error' ? 'text-red-600 dark:text-red-400' : 'text-neutral-500 dark:text-neutral-400'
              }`}
            >
              {syncStatus === 'syncing' ? 'Syncing…' : syncStatus === 'synced' ? 'Synced ✓' : 'Sync failed'}
            </span>
          )}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        {tab === 'dashboard' && <Dashboard activities={activities} />}
        {tab === 'log' && <LogForm onSave={handleSave} />}
        {tab === 'forecast' && <ForecastView activities={activities} />}
        {tab === 'history' && <HistoryList activities={activities} onDelete={handleDelete} />}
        {tab === 'settings' && (
          <SettingsView
            activityCount={activities.length}
            onExport={exportActivitiesJson}
            onExportCsv={exportActivitiesCsv}
            onRestoreBackup={handleRestore}
            onClearAll={handleClearAll}
            onImportCsv={handleImport}
            onSynced={refresh}
          />
        )}
      </main>

      <nav
        className="fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-neutral-900/95 backdrop-blur border-t border-neutral-200 dark:border-neutral-800 flex gap-1.5 px-1.5 pt-1.5"
        style={{ paddingBottom: 'calc(0.375rem + env(safe-area-inset-bottom))' }}
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 rounded-lg py-4 text-xs font-semibold transition-colors ${
              tab === t.id
                ? 'bg-violet-600 text-white shadow-sm'
                : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400'
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
