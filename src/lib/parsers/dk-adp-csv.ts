import Papa from "papaparse";
import { normalizeTeamCode } from "../utils/teamCode";

/**
 * Format: Player,Pos,Team,Bye,ADP,ADP Round,ADP LW,ADP Open,ADP LW Change,ADP Open Change
 * We only care about Player, Team, and ADP.
 * This is kept separate from master-rankings-csv.ts — it populates dkAdp on
 * MasterPlayer for portfolio analytics without touching underdogAdp or adpDelta.
 */
export interface DKAdpRow {
  name: string;
  team: string;
  adp: number;
}

export function parseDKAdpCSV(csvText: string): { rows: DKAdpRow[]; errors: string[] } {
  const errors: string[] = [];

  const { data, errors: parseErrors } = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });
  parseErrors.forEach((e) => errors.push(`Row ${e.row}: ${e.message}`));

  const rows: DKAdpRow[] = [];

  data.forEach((raw, i) => {
    const name = raw["Player"]?.trim();
    const adpRaw = raw["ADP"]?.trim();
    if (!name) return;
    const adp = parseFloat(adpRaw ?? "");
    if (isNaN(adp)) {
      errors.push(`Row ${i + 2}: "${name}" has no valid ADP value`);
      return;
    }
    rows.push({ name, team: normalizeTeamCode(raw["Team"]), adp });
  });

  if (rows.length === 0) {
    errors.push("No rows found — check that the CSV has 'Player' and 'ADP' columns.");
  }

  return { rows, errors };
}
