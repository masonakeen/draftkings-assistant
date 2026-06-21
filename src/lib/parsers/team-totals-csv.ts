import Papa from "papaparse";
import { normalizeTeamCode } from "../utils/teamCode";

export interface TeamWeekProjectionRow {
  team: string;
  week15Opp: string | null;
  week15TeamTotal: number | null;
  week15OU: number | null;
  week16Opp: string | null;
  week16TeamTotal: number | null;
  week16OU: number | null;
  week17Opp: string | null;
  week17TeamTotal: number | null;
  week17OU: number | null;
  projectedPlayoffTotal: number | null;
  week18Opp: string | null;
  week18TeamTotal: number | null;
  week18OU: number | null;
}

function num(raw: string | undefined): number | null {
  if (!raw || raw.trim() === "") return null;
  const n = parseFloat(raw.replace(/[",]/g, ""));
  return isNaN(n) ? null : n;
}

function str(raw: string | undefined): string | null {
  const v = raw?.trim();
  return v ? v : null;
}

/**
 * Parses the team-level weeks 15-17 (+18) Vegas export:
 * Team, W15_Opp, W15_TeamTotal, W15_OU, W16_Opp, W16_TeamTotal, W16_OU,
 * W17_Opp, W17_TeamTotal, W17_OU, Projected_Playoff_Total, W18_Opp,
 * W18_TeamTotal, W18_OU
 *
 * Keyed by team - no player names involved, so there's nothing to fuzzy-match.
 */
export function parseTeamTotalsCSV(csvText: string): { rows: TeamWeekProjectionRow[]; errors: string[] } {
  const errors: string[] = [];

  const { data, errors: parseErrors } = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });
  parseErrors.forEach((e) => errors.push(`Row ${e.row}: ${e.message}`));

  const rows: TeamWeekProjectionRow[] = [];

  data.forEach((raw, i) => {
    const teamRaw = raw["Team"]?.trim();
    if (!teamRaw) return;

    const team = normalizeTeamCode(teamRaw);
    if (!team) {
      errors.push(`Row ${i + 2}: couldn't normalize team name "${teamRaw}"`);
      return;
    }

    rows.push({
      team,
      week15Opp: str(raw["W15_Opp"]),
      week15TeamTotal: num(raw["W15_TeamTotal"]),
      week15OU: num(raw["W15_OU"]),
      week16Opp: str(raw["W16_Opp"]),
      week16TeamTotal: num(raw["W16_TeamTotal"]),
      week16OU: num(raw["W16_OU"]),
      week17Opp: str(raw["W17_Opp"]),
      week17TeamTotal: num(raw["W17_TeamTotal"]),
      week17OU: num(raw["W17_OU"]),
      projectedPlayoffTotal: num(raw["Projected_Playoff_Total"]),
      week18Opp: str(raw["W18_Opp"]),
      week18TeamTotal: num(raw["W18_TeamTotal"]),
      week18OU: num(raw["W18_OU"]),
    });
  });

  if (rows.length === 0) {
    errors.push("No team rows found - check that the CSV has a 'Team' column.");
  }

  return { rows, errors };
}
