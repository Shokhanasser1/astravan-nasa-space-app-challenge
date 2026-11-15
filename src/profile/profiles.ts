/**
 * Cadet badges: the "long-term" way in (entry spec, docs/specs/2026-11-15-entry.md). A badge keeps a child's
 * progress — the missions flown and the titles earned — so the story goes on from mission to mission.
 *
 * Hard limit (CLAUDE.md, "Children"): no name, age, face, photo, voice, e-mail or date is ever asked or stored, and
 * nothing leaves the device. A badge is a call sign picked from a list (never typed) and a patch colour; it lives
 * only in this browser's storage. Pure functions here; App.tsx reads and writes them through src/lib/storage.ts.
 */

/** Call signs the child picks from (hud-text rules: "a call sign (Lochin, Yulduz, Humo) — never a real name"). */
export const SIGNS = ['lochin', 'yulduz', 'humo', 'burgut', 'kamalak', 'shunqor'] as const;
export type Sign = (typeof SIGNS)[number];

/** Patch colours: the interface's cold family (ice, mint, blue, violet). */
export const PATCHES = ['ice', 'mint', 'blue', 'violet'] as const;
export type Patch = (typeof PATCHES)[number];

export const PATCH_HEX: Record<Patch, string> = { ice: '#7fe3ff', mint: '#5fe0c0', blue: '#8fb3ff', violet: '#b49bff' };

/** Badges made before the colours turned cold (15 Nov) keep their place in the family. */
const OLD_PATCH: Record<string, Patch> = { gold: 'ice', green: 'mint', orange: 'blue' };

/** One finished mission: the week (game data, not the child's), the engine's title, the two scores. */
export interface MissionRecord {
  weekId: string;
  titleKey: string;
  crew: number;
  science: number;
  /** The game's seed: the same mission is never written twice. */
  seed: number;
}

export interface Profile {
  id: string;
  sign: Sign;
  patch: Patch;
  missions: MissionRecord[];
}

/** One shared school laptop: room for a class table of badges, not a database. */
export const MAX_PROFILES = 6;

/** Ranks by missions flown: the story's chapters (game rule, set by the team). */
export const RANKS = [
  { key: 'cadet', from: 0 },
  { key: 'crew', from: 1 },
  { key: 'specialist', from: 3 },
  { key: 'commander', from: 5 },
] as const;
export type Rank = (typeof RANKS)[number]['key'];

export function rank(p: Pick<Profile, 'missions'>): Rank {
  const n = p.missions.length;
  let r: Rank = 'cadet';
  for (const x of RANKS) if (n >= x.from) r = x.key;
  return r;
}

/** Missions still to fly to the next rank (null at the top). */
export function toNextRank(p: Pick<Profile, 'missions'>): { next: Rank; left: number } | null {
  const n = p.missions.length;
  const up = RANKS.find((x) => x.from > n);
  return up ? { next: up.key, left: up.from - n } : null;
}

/** Call signs already worn on this device are not offered twice, so two badges never look alike. */
export function freeSigns(list: readonly Profile[]): Sign[] {
  return SIGNS.filter((s) => !list.some((p) => p.sign === s));
}

export function canCreate(list: readonly Profile[]): boolean {
  return list.length < MAX_PROFILES && freeSigns(list).length > 0;
}

/** A new badge (returns the new list), or the same list when it cannot be made. */
export function createProfile(list: readonly Profile[], sign: Sign, patch: Patch): { list: Profile[]; profile: Profile | null } {
  if (!canCreate(list) || !freeSigns(list).includes(sign) || !PATCHES.includes(patch)) return { list: [...list], profile: null };
  const profile: Profile = { id: sign, sign, patch, missions: [] };
  return { list: [...list, profile], profile };
}

export function removeProfile(list: readonly Profile[], id: string): Profile[] {
  return list.filter((p) => p.id !== id);
}

/** Adds a finished mission to a badge; the same mission (seed and week) is kept once. */
export function recordMission(list: readonly Profile[], id: string, rec: MissionRecord): Profile[] {
  return list.map((p) =>
    p.id !== id || p.missions.some((m) => m.seed === rec.seed && m.weekId === rec.weekId) ? p : { ...p, missions: [...p.missions, rec] },
  );
}

/** Whatever storage gives back (old, broken or edited by hand) becomes a valid list or an empty one. */
export function sanitize(raw: unknown): Profile[] {
  if (!Array.isArray(raw)) return [];
  const out: Profile[] = [];
  for (const p of raw) {
    if (!p || typeof p !== 'object') continue;
    const { sign, missions } = p as Partial<Profile>;
    const raw = (p as { patch?: string }).patch ?? '';
    const patch = (OLD_PATCH[raw] ?? raw) as Patch;
    if (!SIGNS.includes(sign as Sign) || !PATCHES.includes(patch) || out.some((x) => x.sign === sign)) continue;
    const ok = Array.isArray(missions)
      ? missions.filter(
          (m): m is MissionRecord =>
            !!m && typeof m.weekId === 'string' && typeof m.titleKey === 'string' && Number.isFinite(m.crew) && Number.isFinite(m.science) && Number.isFinite(m.seed),
        )
      : [];
    out.push({ id: sign as Sign, sign: sign as Sign, patch, missions: ok });
    if (out.length === MAX_PROFILES) break;
  }
  return out;
}

/** Storage keys of one badge's saved game; a guest has none (nothing is saved for a guest). */
export const saveKey = (id: string) => `game:${id}`;
export const playedKey = (id: string) => `played:${id}`;
