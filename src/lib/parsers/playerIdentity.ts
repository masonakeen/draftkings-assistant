import Fuse from "fuse.js";
import { normalizeTeamCode } from "../utils/teamCode";

export interface MasterPlayerLite {
  name: string; // canonical full name
  team: string;
  position: string;
}

interface IndexEntry extends MasterPlayerLite {
  lastNameKey: string;
  firstInitial: string;
}

export interface PlayerNameIndex {
  byExactName: Map<string, MasterPlayerLite>;
  byLastNameTeam: Map<string, IndexEntry[]>; // "lastname|TEAM" -> candidates
  fuse: Fuse<IndexEntry>;
  entries: IndexEntry[];
}

const SUFFIXES = new Set(["jr", "sr", "ii", "iii", "iv", "v"]);

function stripSuffix(lastNameRaw: string): string {
  const parts = lastNameRaw.trim().split(/\s+/);
  const last = parts[parts.length - 1].toLowerCase().replace(/\./g, "");
  if (SUFFIXES.has(last) && parts.length > 1) {
    return parts[parts.length - 2].toLowerCase();
  }
  return parts[parts.length - 1].toLowerCase();
}

/** Splits "J. Jefferson" or "Justin Jefferson" into { firstInitial, lastNameKey }. */
function parseNameParts(name: string): { firstInitial: string; lastNameKey: string } {
  const cleaned = name.trim().replace(/\s+/g, " ");
  const parts = cleaned.split(" ");
  const firstInitial = parts[0]?.replace(/\./g, "").charAt(0).toLowerCase() ?? "";
  const lastNameKey = stripSuffix(parts.slice(1).join(" ") || parts[0]);
  return { firstInitial, lastNameKey };
}

export function buildPlayerNameIndex(masterPlayers: MasterPlayerLite[]): PlayerNameIndex {
  const byExactName = new Map<string, MasterPlayerLite>();
  const byLastNameTeam = new Map<string, IndexEntry[]>();
  const entries: IndexEntry[] = [];

  for (const mp of masterPlayers) {
    const team = normalizeTeamCode(mp.team);
    const { firstInitial, lastNameKey } = parseNameParts(mp.name);
    const entry: IndexEntry = { ...mp, team, lastNameKey, firstInitial };
    entries.push(entry);

    byExactName.set(mp.name.toLowerCase(), { ...mp, team });

    const key = `${lastNameKey}|${team}`;
    if (!byLastNameTeam.has(key)) byLastNameTeam.set(key, []);
    byLastNameTeam.get(key)!.push(entry);
  }

  const fuse = new Fuse(entries, {
    keys: ["name"],
    threshold: 0.3, // fairly strict — we want confidence, not loose guesses
    includeScore: true,
  });

  return { byExactName, byLastNameTeam, fuse, entries };
}

/**
 * Resolves a raw name (possibly abbreviated, e.g. "J. Jefferson") to the
 * canonical full name from the master player list. Returns null if no
 * confident match is found — callers should fall back to the raw name
 * rather than guessing.
 */
export function resolvePlayerName(
  index: PlayerNameIndex,
  rawName: string,
  team?: string | null
): string | null {
  if (!rawName) return null;

  // 1. Exact full-name match (cheap, common for DK CSV exports which use full names)
  const exact = index.byExactName.get(rawName.toLowerCase());
  if (exact) return exact.name;

  // 2. First-initial + last-name (+ team if given) — handles "J. Jefferson"
  const { firstInitial, lastNameKey } = parseNameParts(rawName);
  const normalizedTeam = team ? normalizeTeamCode(team) : null;

  if (normalizedTeam) {
    const candidates = index.byLastNameTeam.get(`${lastNameKey}|${normalizedTeam}`) ?? [];
    const matches = candidates.filter((c) => c.firstInitial === firstInitial);
    if (matches.length === 1) return matches[0].name;
    if (candidates.length === 1) return candidates[0].name; // team matched, initial mismatch (e.g. nickname) — still confident
  }

  // No team given, or team didn't narrow it down — search by last name across all teams
  const allWithLastName = index.entries.filter(
    (e) => e.lastNameKey === lastNameKey && e.firstInitial === firstInitial
  );
  if (allWithLastName.length === 1) return allWithLastName[0].name;

  // 3. Fuzzy fallback — only accept a high-confidence single result
  const fuzzy = index.fuse.search(rawName, { limit: 3 });
  if (fuzzy.length > 0 && (fuzzy[0].score ?? 1) < 0.25) {
    if (normalizedTeam) {
      const teamMatch = fuzzy.find((f) => f.item.team === normalizedTeam);
      if (teamMatch) return teamMatch.item.name;
    }
    if (fuzzy.length === 1 || (fuzzy[1]?.score ?? 1) - (fuzzy[0].score ?? 0) > 0.15) {
      return fuzzy[0].item.name;
    }
  }

  return null;
}
