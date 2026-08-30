// Sync backups across devices via a private GitHub Gist. Uses a user-supplied
// personal access token (scope: "gist") talking directly to the GitHub REST
// API from the browser — no backend involved, consistent with the rest of
// this app's local-only storage model. The token and gist id are kept in
// localStorage only.

const CONFIG_KEY = 'cardio-tracker:gistsync:v1';
const GIST_FILENAME = 'cardio-tracker-backup.json';

export interface GistSyncConfig {
  token: string;
  gistId: string;
  lastSyncedAt?: string;
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

export function saveGistConfig(config: GistSyncConfig): void {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
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
