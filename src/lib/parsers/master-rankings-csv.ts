import Papa from "papaparse";
import { normalizeTeamCode } from "../utils/teamCode";

export interface MasterPlayerRow {
  name: string;
  team: string;
  position: string;
  bye: number | null;
  fpRank: number | null;
  underdogAdp: number | null;
  draftkingsAdp: number | null;
  avgAdp: number | null;
  adpDelta: number | null; // draftkingsAdp - underdogAdp
}

function num(raw: string | undefined): number | null {
  if (!raw || raw.trim() === "") return null;
  const n = parseFloat(raw.replace(/[",]/g, ""));
  return isNaN(n) ? null : n;
}

// Strips trailing rank digits from position strings like "RB23" -> "RB"
function normalizePosition(raw: string): string {
  const cleaned = raw.replace(/\d+$/, "").toUpperCase().trim();
  return cleaned || "FLEX";
}

/**
 * Parses a FantasyPros-style "Overall ADP Rankings" export:
 * Rank, Player, Team, Bye, POS, BB10, RTSports, Underdog, Drafters, DraftKings, AVG
 *
 * Column order/casing is matched loosely via header normalization so minor
 * export variations (extra columns, reordering) don't break the import —
 * only "Player", "Team", "Underdog", and "DraftKings" are load-bearing.
 */
export function parseMasterRankingsCSV(csvText: string): { rows: MasterPlayerRow[]; errors: string[] } {
  const errors: string[] = [];

  const { data, errors: parseErrors } = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });
  parseErrors.forEach((e) => errors.push(`Row ${e.row}: ${e.message}`));

  const rows: MasterPlayerRow[] = [];

  data.forEach((raw) => {
    const player = raw["Player"]?.trim();
    if (!player) return; // blank trailer rows are common in these exports

    const team = normalizeTeamCode(raw["Team"]);
    const position = normalizePosition(raw["POS"] ?? "");
    const bye = num(raw["Bye"]);
    const fpRank = num(raw["Rank"]);
    const underdogAdp = num(raw["Underdog"]);
    const draftkingsAdp = num(raw["DraftKings"]);
    const avgAdp = num(raw["AVG"]);

    const adpDelta =
      draftkingsAdp !== null && underdogAdp !== null
        ? Math.round((draftkingsAdp - underdogAdp) * 10) / 10
        : null;

    rows.push({ name: player, team, position, bye, fpRank, underdogAdp, draftkingsAdp, avgAdp, adpDelta });
  });

  if (rows.length === 0) {
    errors.push("No player rows found — check that the CSV has a 'Player' column.");
  }

  return { rows, errors };
}
