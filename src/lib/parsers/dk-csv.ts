import Papa from "papaparse";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import type { NormalizedDraft, NormalizedPlayer, ParsedCSVResult, Position, RawDKRow } from "@/types";

const DKRowSchema = z.object({
  draft_id: z.string().min(1),
  contest_name: z.string().default("Unknown Contest"),
  entry_fee: z.string().default("0"),
  drafted_at: z.string().default(""),
  pick_number: z.string().default("0"),
  total_teams: z.string().default("12"),
  player_name: z.string().min(1),
  team: z.string().default(""),
  position: z.string().default(""),
  pick: z.string().default("0"),
  round: z.string().default("0"),
  adp: z.string().optional(),
});

type DKRow = z.infer<typeof DKRowSchema>;

const COLUMN_MAP: Record<string, string> = {
  "draft_id": "draft_id", "draftid": "draft_id", "draft id": "draft_id",
  "contest_name": "contest_name", "contest name": "contest_name", "contestname": "contest_name", "tournament_name": "contest_name",
  "entry_fee": "entry_fee", "entry fee": "entry_fee", "buy_in": "entry_fee", "buyin": "entry_fee",
  "drafted_at": "drafted_at", "draft_date": "drafted_at", "draft date": "drafted_at", "draftdate": "drafted_at",
  "pick_number": "pick_number", "starting_pick": "pick_number", "your_pick": "pick_number", "draft_position": "pick_number",
  "total_teams": "total_teams", "teams": "total_teams", "league_size": "total_teams",
  "player_name": "player_name", "player": "player_name", "name": "player_name", "playername": "player_name",
  "team": "team", "nfl_team": "team", "nflteam": "team",
  "position": "position", "pos": "position",
  "pick": "pick", "overall_pick": "pick", "overall pick": "pick", "overall_pick_number": "pick",
  "round": "round", "round_number": "round", "round number": "round",
  "adp": "adp", "adp_at_draft": "adp", "draft_adp": "adp",
};

function normalizeHeaders(row: RawDKRow): DKRow {
  const normalized: Record<string, string> = {};
  for (const [rawKey, value] of Object.entries(row)) {
    const key = rawKey.trim().toLowerCase().replace(/\s+/g, "_");
    const canonical = COLUMN_MAP[key] ?? key;
    normalized[canonical] = (value ?? "").trim();
  }
  return normalized as DKRow;
}

function parseEntryFee(raw: string): number {
  const n = parseFloat(raw.replace(/[$,]/g, ""));
  return isNaN(n) ? 0 : n;
}

function parseDraftedAt(raw: string): Date {
  if (!raw) return new Date();
  const d = new Date(raw);
  return isNaN(d.getTime()) ? new Date() : d;
}

function normalizePosition(raw: string): Position {
  const upper = raw.toUpperCase().trim();
  const valid: Position[] = ["QB", "RB", "WR", "TE", "FLEX", "K", "DST"];
  if (valid.includes(upper as Position)) return upper as Position;
  if (upper === "DEF" || upper === "D/ST" || upper === "DST") return "DST";
  return "FLEX";
}

export function parseDKCSV(csvText: string): ParsedCSVResult {
  const errors: string[] = [];

  const { data: rawRows, errors: parseErrors } = Papa.parse<RawDKRow>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  if (parseErrors.length > 0) {
    parseErrors.forEach((e) => errors.push(`CSV parse error row ${e.row}: ${e.message}`));
  }

  const draftMap = new Map<string, NormalizedDraft>();

  rawRows.forEach((rawRow, rowIndex) => {
    const mapped = normalizeHeaders(rawRow);
    const result = DKRowSchema.safeParse(mapped);

    if (!result.success) {
      errors.push(`Row ${rowIndex + 2}: ${result.error.issues.map((i) => i.message).join(", ")}`);
      return;
    }

    const row = result.data;
    const draftId = row.draft_id;

    if (!draftMap.has(draftId)) {
      draftMap.set(draftId, {
        id: draftId,
        contestName: row.contest_name,
        entryFee: parseEntryFee(row.entry_fee),
        draftedAt: parseDraftedAt(row.drafted_at),
        startingPick: parseInt(row.pick_number) || 1,
        totalTeams: parseInt(row.total_teams) || 12,
        source: "csv",
        players: [],
      });
    }

    const draft = draftMap.get(draftId)!;

    draft.players.push({
      id: uuidv4(),
      name: row.player_name,
      team: row.team,
      position: normalizePosition(row.position),
      draftedPick: parseInt(row.pick) || 0,
      draftedRound: parseInt(row.round) || 0,
      adpAtDraft: row.adp ? parseFloat(row.adp) || null : null,
      currentAdp: null,
      draftId,
    });
  });

  return { drafts: Array.from(draftMap.values()), rawRows, errors };
}
