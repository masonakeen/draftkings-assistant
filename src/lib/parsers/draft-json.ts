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
  entryFee?: number;
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
    entryFee: typeof raw.entryFee === "number" ? raw.entryFee : 0,
    draftedAt,
    startingPick,
    totalTeams,
    source: "json",
    players,
  };
}

function splitConcatenatedJsonObjects(text: string): string[] {
  const objects: string[] = [];
  let depth = 0;
  let start = -1;
  let inString = false;
  let escapeNext = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (escapeNext) { escapeNext = false; continue; }
    if (ch === "\\" && inString) { escapeNext = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;

    if (ch === "{") {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0 && start !== -1) {
        objects.push(text.slice(start, i + 1));
        start = -1;
      }
    }
  }

  return objects;
}

function extractRawDrafts(parsed: unknown): RawJsonDraft[] {
  if (Array.isArray(parsed)) return parsed as RawJsonDraft[];

  if (parsed && typeof parsed === "object") {
    const obj = parsed as Record<string, unknown>;
    for (const key of ["drafts", "draftHistory", "sessions", "data"]) {
      if (Array.isArray(obj[key])) return obj[key] as RawJsonDraft[];
    }
    return [obj as unknown as RawJsonDraft];
  }

  return [];
}

export function parseDraftJSON(
  jsonText: string,
  nameIndex: PlayerNameIndex
): { drafts: NormalizedDraft[]; errors: string[] } {
  const errors: string[] = [];
  let rawDrafts: RawJsonDraft[] = [];

  try {
    rawDrafts = extractRawDrafts(JSON.parse(jsonText));
  } catch {
    const chunks = splitConcatenatedJsonObjects(jsonText);
    if (chunks.length === 0) {
      return { drafts: [], errors: ["Couldn't parse this as JSON at all — check the file isn't corrupted or truncated."] };
    }
    for (const chunk of chunks) {
      try {
        rawDrafts.push(JSON.parse(chunk) as RawJsonDraft);
      } catch (err) {
        errors.push(`Skipped one block that wasn't valid JSON on its own: ${String(err)}`);
      }
    }
  }

  if (rawDrafts.length === 0) {
    errors.push("Couldn't find any draft objects in this file.");
  }

  const drafts: NormalizedDraft[] = [];
  for (const raw of rawDrafts) {
    const draft = parseOneDraft(raw, nameIndex, errors);
    if (draft) drafts.push(draft);
  }

  return { drafts, errors };
}