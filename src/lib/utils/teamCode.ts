/**
 * Different data sources spell team names differently — the FantasyPros
 * rankings CSV and the live draft board both use standard codes (DET, LAR),
 * but the Vegas team-totals CSV uses full nicknames ("49ers", "LA Chargers").
 * Everything funnels through here so the rest of the app only ever deals in
 * standard 2–3 letter codes.
 */

const TEAM_CODE_MAP: Record<string, string> = {
  // Full nicknames (Vegas CSV)
  "49ERS": "SF", "BEARS": "CHI", "BENGALS": "CIN", "BILLS": "BUF",
  "BRONCOS": "DEN", "BROWNS": "CLE", "BUCCANEERS": "TB", "CARDINALS": "ARI",
  "CHIEFS": "KC", "COLTS": "IND", "COMMANDERS": "WAS", "COWBOYS": "DAL",
  "DOLPHINS": "MIA", "EAGLES": "PHI", "FALCONS": "ATL", "JAGUARS": "JAX",
  "LA CHARGERS": "LAC", "LA RAMS": "LAR", "LIONS": "DET", "NY GIANTS": "NYG",
  "NY JETS": "NYJ", "PACKERS": "GB", "PANTHERS": "CAR", "PATRIOTS": "NE",
  "RAIDERS": "LV", "RAVENS": "BAL", "SAINTS": "NO", "SEAHAWKS": "SEA",
  "STEELERS": "PIT", "TEXANS": "HOU", "TITANS": "TEN", "VIKINGS": "MIN",

  // Already-standard codes, including known alternate spellings
  "SF": "SF", "CHI": "CHI", "CIN": "CIN", "BUF": "BUF", "DEN": "DEN",
  "CLE": "CLE", "TB": "TB", "ARI": "ARI", "KC": "KC", "IND": "IND",
  "WAS": "WAS", "WSH": "WAS", "DAL": "DAL", "MIA": "MIA", "PHI": "PHI",
  "ATL": "ATL", "JAX": "JAX", "JAC": "JAX", "LAC": "LAC", "LAR": "LAR",
  "DET": "DET", "NYG": "NYG", "NYJ": "NYJ", "GB": "GB", "GBP": "GB",
  "CAR": "CAR", "NE": "NE", "NEP": "NE", "LV": "LV", "LVR": "LV",
  "OAK": "LV", "BAL": "BAL", "NO": "NO", "NOS": "NO", "SEA": "SEA",
  "PIT": "PIT", "HOU": "HOU", "TEN": "TEN", "MIN": "MIN",
};

export function normalizeTeamCode(raw: string | null | undefined): string {
  if (!raw) return "";
  const key = raw.trim().toUpperCase();
  return TEAM_CODE_MAP[key] ?? key;
}
