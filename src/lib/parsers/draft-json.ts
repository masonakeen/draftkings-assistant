import { v4 as uuidv4 } from "uuid";
import { resolvePlayerName, type PlayerNameIndex } from "./playerIdentity";
import { normalizeTeamCode } from "../utils/teamCode";
import type { NormalizedDraft, NormalizedPlayer, Position } from "@/types";

interface RawJsonPlayer {
  playerId?: string;
  roundPick: string; // "1.9"
  pick: number;
  player: string;    // "J. Jefferson"
  position: string;
  team: string;
  byeWeek?: number;
}

interface RawJsonDraft {
  draftId: string;
  draftDate: string;
  site?: string;
  username?: string;
  totalPlayers?: number;
  players: RawJsonPlayer[];
}

const VALID_POSITIONS: Position[] = ["QB", "RB", "WR", "TE", "FLEX", "K", "DST"];
function normalizePosition(raw: string): Position {
  const upper = (raw ?? "").toUpperCase().trim();
  if (VALID_POSITIONS.includes(upper as Position)) return upper as Position;
  if (upper === "DEF" || upper === "D/ST") return "DST";
  return "FLEX";
}

/**
 * Infers { totalTeams, startingPick } from snake-draft round-pick notation.
 * Round 1's slot IS your starting pick (no reversal yet). For any later
 * round, slot1 + slot2 = totalTeams + 1 in a standard snake draft — so two
 * rounds of data is enough to solve for totalTeams exactly. Falls back to a
 * 12-team default if only one round is present.
 */
function inferDraftShape(players: RawJsonPlayer[]): { totalTeams: number; startingPick: number } {
  const round1 = players.find((p) => p.roundPick.startsWith("1."));
  const round2 = players.find((p) => p.roundPick.startsWith("2."));

  const slot1 = round1 ? parseInt(round1.roundPick.split(".")[1]) : null;
  const slot2 = round2 ? parseInt(round2.roundPick.split(".")[1]) : null;

  if (slot1 !== null && slot2 !== null && !isNaN(slot1) && !isNaN(slot2)) {
    return { totalTeams: slot1 + slot2 - 1, startingPick: slot1 };
  }
  return { totalTeams: 12, startingPick: slot1 ?? 1 };
}

function parseOneDraft(raw: RawJsonDraft, nameIndex: PlayerNameIndex, errors: string[]): NormalizedDraft | null {
  if (!raw.draftId || !Array.isArray(raw.players) || raw.players.length === 0) {
    errors.push(`Draft missing draftId or players array — skipped`);
    return null;
  }

  const { totalTeams, startingPick } = inferDraftShape(raw.players);
  const draftedAt = raw.draftDate ? new Date(raw.draftDate) : new Date();

  const players: NormalizedPlayer[] = raw.players.map((p) => {
    const team = normalizeTeamCode(p.team);
    const resolved = resolvePlayerName(nameIndex, p.player, team);
    if (!resolved) {
      errors.push(`Couldn't confidently resolve "${p.player}" (${team}) to a canonical name — kept raw name as-is`);
    }

    const round = parseInt(p.roundPick?.split(".")[0]) || Math.ceil(p.pick / totalTeams);

    return {
      id: p.playerId ?? uuidv4(),
      name: resolved ?? p.player,
      rawName: p.player,
      team,
      position: normalizePosition(p.position),
      draftedPick: p.pick,
      draftedRound: round,
      adpAtDraft: null,
      currentAdp: null,
      draftId: raw.draftId,
    };
  });

  const dateLabel = draftedAt.toLocaleDateString();
  const contestName = `${raw.site ?? "Best Ball"} Draft (${dateLabel})`;

  return {
    id: raw.draftId,
    contestName,
    entryFee: 0, // not present in this export format
    draftedAt,
    startingPick,
    totalTeams,
    source: "json",
    players,
  };
}

/**
 * Accepts either a single draft object or an array of them — so re-uploading
 * the same export shape later (one file per draft, or a combined array) both
 * work without the user needing to manually merge files.
 */
export function parseDraftJSON(
  jsonText: string,
  nameIndex: PlayerNameIndex
): { drafts: NormalizedDraft[]; errors: string[] } {
  const errors: string[] = [];
  let parsed: unknown;

  try {
    parsed = JSON.parse(jsonText);
  } catch (err) {
    return { drafts: [], errors: [`Invalid JSON: ${String(err)}`] };
  }

  const rawDrafts: RawJsonDraft[] = Array.isArray(parsed) ? parsed : [parsed as RawJsonDraft];

  const drafts: NormalizedDraft[] = [];
  for (const raw of rawDrafts) {
    const draft = parseOneDraft(raw, nameIndex, errors);
    if (draft) drafts.push(draft);
  }

  return { drafts, errors };
}
