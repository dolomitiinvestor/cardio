import { useCallback, useState } from 'react';
import Dashboard from './components/Dashboard';
import LogForm from './components/LogForm';
import ForecastView from './components/ForecastView';
import ImportView from './components/ImportView';
import HistoryList from './components/HistoryList';
import SettingsView from './components/SettingsView';
import type { Activity, NewActivity } from './lib/types';
import {
  addActivitiesDeduped,
  addActivity,
  deleteActivity,
  deleteAllActivities,
  exportActivitiesJson,
  getActivities,
  importActivitiesJson,
} from './lib/storage';

type Tab = 'dashboard' | 'log' | 'forecast' | 'import' | 'history' | 'settings';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'log', label: 'Log', icon: '➕' },
  { id: 'forecast', label: 'Forecast', icon: '🔮' },
  { id: 'import', label: 'Import', icon: '⬆️' },
  { id: 'history', label: 'History', icon: '📋' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
];

export default function App() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [activities, setActivities] = useState<Activity[]>(() => getActivities());

  const refresh = useCallback(() => {
    setActivities(getActivities());
  }, []);

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
        <h1 className="text-base font-bold text-neutral-900 dark:text-neutral-50">🏃 Cardio Tracker</h1>
      </header>

      <main className="flex-1 overflow-y-auto">
        {tab === 'dashboard' && <Dashboard activities={activities} />}
        {tab === 'log' && <LogForm onSave={handleSave} />}
        {tab === 'forecast' && <ForecastView activities={activities} />}
        {tab === 'import' && <ImportView onImport={handleImport} />}
        {tab === 'history' && <HistoryList activities={activities} onDelete={handleDelete} />}
        {tab === 'settings' && (
          <SettingsView
            activityCount={activities.length}
            onExport={exportActivitiesJson}
            onImport={handleRestore}
            onClearAll={handleClearAll}
          />
        )}
      </main>

      <nav
        className="fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-neutral-900/95 backdrop-blur border-t border-neutral-200 dark:border-neutral-800 flex"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-xs font-medium ${
              tab === t.id ? 'text-violet-600 dark:text-violet-400' : 'text-neutral-400 dark:text-neutral-500'
            }`}
          >
            <span className="text-lg leading-none">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
