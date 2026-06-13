// Best-run replay storage (local only — replays are personal and chunky, so
// they never touch Convex). One best replay is kept per difficulty, keyed by
// kills. A replay is { seed, w, h, frames }; summary is the run's headline stats.
const KEY = "sdg_replays";

export function loadReplays() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch {
    return {};
  }
}

// Store a run's replay if it beats the saved best for its difficulty. Returns
// true if it became the new best (so the UI can crow about it).
export function saveReplayIfBest(replay, summary) {
  if (!replay || !replay.frames?.length) return false;
  const all = loadReplays();
  const diff = summary.difficulty || "survival";
  const prev = all[diff];
  if (prev && (prev.summary?.kills ?? 0) >= summary.kills) return false;
  all[diff] = { summary, replay };
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
    return true;
  } catch {
    // Out of quota — keep only this replay and try once more.
    try {
      localStorage.setItem(KEY, JSON.stringify({ [diff]: { summary, replay } }));
      return true;
    } catch {
      return false;
    }
  }
}

// Saved replays, best first.
export function listReplays() {
  return Object.values(loadReplays()).sort(
    (a, b) => (b.summary?.kills ?? 0) - (a.summary?.kills ?? 0)
  );
}

export function deleteReplay(difficulty) {
  const all = loadReplays();
  delete all[difficulty];
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* ignore */
  }
}
