// Sync backups across devices via a private GitHub Gist. Uses a user-supplied
// personal access token (scope: "gist") talking directly to the GitHub REST
// API from the browser — no backend involved, consistent with the rest of
// this app's local-only storage model. The token and gist id are kept in
// localStorage only.

import { exportActivitiesJson, importActivitiesJson, mergeActivitiesJson, withoutChangeEvents } from './storage';

const CONFIG_KEY = 'cardio-tracker:gistsync:v1';
const GIST_FILENAME = 'cardio-tracker-backup.json';

export interface GistSyncConfig {
  token: string;
  gistId: string;
  lastSyncedAt?: string;
  // Auto-sync mode: pull on app open, push after every local change.
  autoSync?: boolean;
  // Set while a local change hasn't reached the Gist yet (e.g. offline).
  pendingPush?: boolean;
}

export function getGistConfig(): GistSyncConfig | null {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.token !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
}

// Merges into the existing config so callers don't wipe fields they don't set.
export function saveGistConfig(config: Partial<GistSyncConfig>): void {
  localStorage.setItem(CONFIG_KEY, JSON.stringify({ ...getGistConfig(), ...config }));
}

export function clearGistConfig(): void {
  localStorage.removeItem(CONFIG_KEY);
}

async function githubErrorMessage(res: Response): Promise<string> {
  try {
    const body = await res.json();
    if (body?.message) return `GitHub API error (${res.status}): ${body.message}`;
  } catch {
    // fall through
  }
  return `GitHub API error (${res.status}): ${res.statusText}`;
}

// Creates a new secret gist if gistId is null/empty, otherwise updates the
// existing one. Returns the gist id (unchanged when updating).
export async function pushToGist(token: string, gistId: string | null, content: string): Promise<string> {
  const url = gistId ? `https://api.github.com/gists/${gistId}` : 'https://api.github.com/gists';
  const res = await fetch(url, {
    method: gistId ? 'PATCH' : 'POST',
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      description: 'Cardio Tracker backup (synced across devices)',
      public: false,
      files: { [GIST_FILENAME]: { content } },
    }),
  });
  if (!res.ok) throw new Error(await githubErrorMessage(res));
  const json = await res.json();
  return json.id as string;
}

export async function pullFromGist(token: string, gistId: string): Promise<string> {
  const res = await fetch(`https://api.github.com/gists/${gistId}`, {
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github+json',
    },
  });
  if (!res.ok) throw new Error(await githubErrorMessage(res));
  const json = await res.json();
  const files = json.files ?? {};
  const file = files[GIST_FILENAME] ?? Object.values(files)[0];
  if (!file) throw new Error('That Gist has no files in it.');

  // Very large files come back truncated; fetch the raw content in that case.
  if (file.truncated && file.raw_url) {
    const rawRes = await fetch(file.raw_url);
    if (!rawRes.ok) throw new Error(`Could not fetch Gist contents (${rawRes.status}).`);
    return rawRes.text();
  }
  return file.content as string;
}

// ---- Auto-sync ----

export function isAutoSyncReady(): boolean {
  const config = getGistConfig();
  return !!(config?.autoSync && config.token && config.gistId);
}

// Pull on app open. Normally the Gist replaces local data. If a local change
// never made it up (pendingPush), merge instead so it isn't lost, then push.
// Returns true if local data changed.
export async function autoPull(): Promise<boolean> {
  const config = getGistConfig();
  if (!config?.autoSync || !config.token || !config.gistId) return false;
  const json = await pullFromGist(config.token, config.gistId);
  // Re-read: a change may have been made while the request was in flight.
  if (getGistConfig()?.pendingPush) {
    withoutChangeEvents(() => mergeActivitiesJson(json));
    await autoPush();
  } else {
    withoutChangeEvents(() => importActivitiesJson(json));
    saveGistConfig({ lastSyncedAt: new Date().toISOString() });
  }
  return true;
}

export async function autoPush(): Promise<void> {
  const config = getGistConfig();
  if (!config?.autoSync || !config.token) return;
  const id = await pushToGist(config.token, config.gistId || null, exportActivitiesJson());
  saveGistConfig({ gistId: id, pendingPush: false, lastSyncedAt: new Date().toISOString() });
}

// Turning auto-sync on: merge whatever is in the Gist with this device's data
// (so neither side is lost), then push the result. Creates the Gist if no id.
export async function enableAutoSync(token: string, gistId: string): Promise<string> {
  if (gistId) {
    const json = await pullFromGist(token, gistId);
    withoutChangeEvents(() => mergeActivitiesJson(json));
  }
  const id = await pushToGist(token, gistId || null, exportActivitiesJson());
  saveGistConfig({ token, gistId: id, autoSync: true, pendingPush: false, lastSyncedAt: new Date().toISOString() });
  return id;
}

export function disableAutoSync(): void {
  saveGistConfig({ autoSync: false, pendingPush: false });
}
