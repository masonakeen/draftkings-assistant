import Papa from "papaparse";

export interface PositionalValueRow {
  playerName: string;
  position: string;
  value: number;
}

function buildHeaderNormalizer(map: Record<string, string>) {
  return (row: Record<string, string>): Record<string, string> => {
    const out: Record<string, string> = {};
    for (const [rawKey, value] of Object.entries(row)) {
      const key = rawKey.trim().toLowerCase().replace(/\s+/g, "_");
      out[map[key] ?? key] = (value ?? "").trim();
    }
    return out;
  };
}

function numOrUndefined(raw: string | undefined): number | undefined {
  if (raw === undefined || raw === "") return undefined;
  const n = parseFloat(raw.replace(/[,%]/g, ""));
  return isNaN(n) ? undefined : n;
}

// Expected columns: player_name, position, value
const POS_VALUE_MAP: Record<string, string> = {
  "player_name": "player_name", "player": "player_name", "name": "player_name",
  "position": "position", "pos": "position",
  "value": "value", "beersheets_value": "value", "remaining_value": "value",
};

export function parsePositionalValueCSV(csvText: string): { rows: PositionalValueRow[]; errors: string[] } {
  const errors: string[] = [];
  const normalize = buildHeaderNormalizer(POS_VALUE_MAP);
  const { data, errors: parseErrors } = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });
  parseErrors.forEach((e) => errors.push(`Row ${e.row}: ${e.message}`));

  const rows: PositionalValueRow[] = [];
  data.forEach((raw, i) => {
    const row = normalize(raw);
    const value = numOrUndefined(row.value);
    if (!row.player_name || value === undefined) {
      errors.push(`Row ${i + 2}: missing player_name or value`);
      return;
    }
    rows.push({
      playerName: row.player_name,
      position: (row.position ?? "FLEX").toUpperCase(),
      value,
    });
  });

  return { rows, errors };
}
