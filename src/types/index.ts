export type Position = "QB" | "RB" | "WR" | "TE" | "FLEX" | "K" | "DST";

export interface NormalizedDraft {
  id: string;
  contestName: string;
  entryFee: number;
  draftedAt: Date;
  startingPick: number;
  totalTeams: number;
  source?: "csv" | "json" | "live";
  players: NormalizedPlayer[];
}

export interface NormalizedPlayer {
  id: string;
  name: string;
  rawName?: string;
  team: string;
  position: Position;
  draftedPick: number;
  draftedRound: number;
  adpAtDraft: number | null;
  currentAdp: number | null;
  draftId: string;
}

export interface PlayerExposure {
  name: string;
  team: string;
  position: Position;
  imageUrl: string | null;       // from PlayerUniverse
  draftCount: number;
  exposure: number;
  avgPickWhenDrafted: number;
  avgAdp: number | null;         // avg of historical adpAtDraft values
  currentDkAdp: number | null;  // live DK ADP from PlayerUniverse
  clv: number | null;           // (avgPickWhenDrafted - currentDkAdp) / currentDkAdp — negative = value (green), positive = overpay (red)
  clvAvg: number | null;        // legacy: kept for backward compat
}

export interface StackExposure {
  qbName: string;
  partnerName: string;
  partnerPosition: Position;
  count: number;
  exposure: number;
}

export interface PortfolioStats {
  totalDrafts: number;
  totalEntryFees: number;
  avgEntryFee: number;
  uniquePlayers: number;
  dateRange: { earliest: Date; latest: Date } | null;
}

export interface RawDKRow {
  [key: string]: string;
}

export interface ParsedCSVResult {
  drafts: NormalizedDraft[];
  rawRows: RawDKRow[];
  errors: string[];
}

export interface LiveDraftPick {
  playerName: string;
  rawName?: string;
  team: string;
  position: Position;
  pickNumber: number;
  pickedByMe: boolean;
  pickedAt: string;
}

export interface LiveDraftState {
  sessionId: string;
  contestName: string | null;
  myUsername: string | null;
  totalTeams: number;
  startingPick: number;
  currentPickNumber: number;
  isOnTheClock: boolean;
  picks: LiveDraftPick[];
  myRoster: LiveDraftPick[];
  updatedAt: string;
}

export interface RecommendedPlayer {
  name: string;
  team: string;
  position: Position;

  adp: number | null;          // DK ADP from master rankings CSV
  dkAdp: number | null;        // DK ADP from new dedicated DK ADP CSV (portfolio analytics)
  adpTrend: number | null;

  playoffTotalOU: number | null;
  week17OU: number | null;
  impliedTeamTotal: number | null;

  personalExposure: number | null;
  correlationFlag: CorrelationFlag | null;

  positionalValue: number | null;

  byeWeek: number | null;
  byeConflict: boolean;

  underdogAdp: number | null;
  adpDelta: number | null;

  // Stack badge: how many of your live-draft roster are on the same team
  stackCount: number;

  // Week 17 bring-back: your W17 opponent has players on your roster
  week17BringBack: boolean;
  week17Opponent: string | null;
}

export interface CorrelationFlag {
  withPlayer: string;
  jaccardIndex: number;
  yourCoExposure: number;
}

export interface ColorScaleResult {
  value: number;
  tier: "bad" | "below" | "neutral" | "above" | "good";
  colorHex: string;
}
