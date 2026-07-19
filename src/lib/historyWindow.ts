// History is a permanent archive. An item leaves its main page and moves into
// History once 24 hours have passed since it finished (was done / delivered /
// resolved / archived). The 24h is the *entry condition* — not a max age; once
// in History an item stays forever.
export const HISTORY_AGE_MS = 24 * 60 * 60 * 1000;

// Completed-at timestamps at or before this belong in History.
export function agedCutoffISO(): string {
  return new Date(Date.now() - HISTORY_AGE_MS).toISOString();
}

// True once 24h have passed since the given completion time.
export function isAged(iso: string | null | undefined): boolean {
  if (!iso) return false;
  return new Date(iso).getTime() <= Date.now() - HISTORY_AGE_MS;
}
