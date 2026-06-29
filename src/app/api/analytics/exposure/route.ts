import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { calculateExposure } from "@/lib/analytics/exposure";
import type { NormalizedDraft, NormalizedPlayer, Position, PortfolioStats } from "@/types";

// ─── Portfolio stats ──────────────────────────────────────────────────────────

function calculatePortfolioStats(drafts: NormalizedDraft[]): PortfolioStats {
  if (drafts.length === 0) {
    return { totalDrafts: 0, totalEntryFees: 0, avgEntryFee: 0, uniquePlayers: 0, dateRange: null };
  }
  const totalEntryFees = drafts.reduce((s, d) => s + d.entryFee, 0);
  const allPlayers = drafts.flatMap((d) => d.players);
  const uniqueNames = new Set(allPlayers.map((p) => p.name.toLowerCase()));
  const dates = drafts.map((d) => d.draftedAt).sort((a, b) => a.getTime() - b.getTime());
  return {
    totalDrafts: drafts.length,
    totalEntryFees: Math.round(totalEntryFees * 100) / 100,
    avgEntryFee: Math.round((totalEntryFees / drafts.length) * 100) / 100,
    uniquePlayers: uniqueNames.size,
    dateRange: { earliest: dates[0], latest: dates[dates.length - 1] },
  };
}

// ─── 1. Draft position histogram ──────────────────────────────────────────────
// Counts how many times you drafted from each seat (1-12) based on startingPick.

export interface DraftPositionBucket {
  pick: number;   // seat number 1-12
  count: number;
  pct: number;    // percentage of all drafts
}

function calculateDraftPositionDistribution(drafts: NormalizedDraft[]): DraftPositionBucket[] {
  if (drafts.length === 0) return [];
  const counts = new Map<number, number>();
  for (const d of drafts) {
    const seat = d.startingPick;
    counts.set(seat, (counts.get(seat) ?? 0) + 1);
  }
  // Return all seats 1-12, filling zeros for unoccupied seats
  const maxSeat = Math.max(12, ...counts.keys());
  return Array.from({ length: maxSeat }, (_, i) => {
    const pick = i + 1;
    const count = counts.get(pick) ?? 0;
    return { pick, count, pct: Math.round((count / drafts.length) * 1000) / 10 };
  });
}

// ─── 2. Roster archetype breakdown ───────────────────────────────────────────
// Groups drafts by their QB/RB/WR/TE counts, e.g. "3QB 6RB 7WR 4TE"

export interface RosterArchetype {
  label: string;   // e.g. "3QB 6RB 7WR 4TE"
  qb: number; rb: number; wr: number; te: number;
  count: number;
  pct: number;
}

function calculateRosterArchetypes(drafts: NormalizedDraft[]): RosterArchetype[] {
  if (drafts.length === 0) return [];
  const counts = new Map<string, { qb: number; rb: number; wr: number; te: number; count: number }>();

  for (const draft of drafts) {
    const qb = draft.players.filter(p => p.position === "QB").length;
    const rb = draft.players.filter(p => p.position === "RB").length;
    const wr = draft.players.filter(p => p.position === "WR").length;
    const te = draft.players.filter(p => p.position === "TE").length;
    const key = `${qb}QB ${rb}RB ${wr}WR ${te}TE`;
    const existing = counts.get(key);
    if (existing) existing.count++;
    else counts.set(key, { qb, rb, wr, te, count: 1 });
  }

  return Array.from(counts.entries())
    .map(([label, v]) => ({ label, ...v, pct: Math.round((v.count / drafts.length) * 1000) / 10 }))
    .sort((a, b) => b.count - a.count);
}

// ─── 3. Top QB stacks ────────────────────────────────────────────────────────
// A stack = QB + at least 1 skill player from the same team.

export interface QBStack {
  qbName: string;
  team: string;
  draftCount: number;       // drafts where this QB appears
  stackCount: number;       // drafts where QB + ≥1 teammate skill player
  stackPct: number;         // stackCount / draftCount
  avgStackSize: number;     // avg number of teammates when stacked
  partners: Array<{ name: string; count: number }>; // most frequent stack partners
}

function calculateQBStacks(drafts: NormalizedDraft[]): QBStack[] {
  if (drafts.length === 0) return [];

  // Map: QB name → stats
  const qbMap = new Map<string, {
    team: string;
    draftCount: number;
    stackSizes: number[];
    partnerCounts: Map<string, number>;
  }>();

  for (const draft of drafts) {
    const qbs = draft.players.filter(p => p.position === "QB");
    const skillPlayers = draft.players.filter(p => ["RB", "WR", "TE"].includes(p.position));

    for (const qb of qbs) {
      if (!qbMap.has(qb.name)) {
        qbMap.set(qb.name, { team: qb.team, draftCount: 0, stackSizes: [], partnerCounts: new Map() });
      }
      const entry = qbMap.get(qb.name)!;
      entry.draftCount++;

      const teammates = skillPlayers.filter(p =>
        p.team.toUpperCase() === qb.team.toUpperCase()
      );
      if (teammates.length > 0) {
        entry.stackSizes.push(teammates.length);
        for (const t of teammates) {
          entry.partnerCounts.set(t.name, (entry.partnerCounts.get(t.name) ?? 0) + 1);
        }
      }
    }
  }

  return Array.from(qbMap.entries())
    .map(([qbName, v]) => ({
      qbName,
      team: v.team,
      draftCount: v.draftCount,
      stackCount: v.stackSizes.length,
      stackPct: v.draftCount > 0 ? Math.round((v.stackSizes.length / v.draftCount) * 1000) / 10 : 0,
      avgStackSize: v.stackSizes.length > 0
        ? Math.round((v.stackSizes.reduce((s, n) => s + n, 0) / v.stackSizes.length) * 10) / 10
        : 0,
      partners: Array.from(v.partnerCounts.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5),
    }))
    .filter(s => s.draftCount > 0)
    .sort((a, b) => b.draftCount - a.draftCount);
}

// ─── 4. Top offenses (teams by player selections) ─────────────────────────────

export interface TeamOffenseCount {
  team: string;
  totalSelections: number;    // total player-draft instances across all drafts
  avgPerDraft: number;        // avg players from this team per draft
  uniquePlayers: number;      // distinct players drafted from this team
  pct: number;                // % of all player selections
}

function calculateTopOffenses(drafts: NormalizedDraft[]): TeamOffenseCount[] {
  if (drafts.length === 0) return [];

  const teamMap = new Map<string, { total: number; players: Set<string> }>();
  let grandTotal = 0;

  for (const draft of drafts) {
    for (const p of draft.players) {
      if (p.position === "DST" || p.position === "K") continue; // skill only
      const team = p.team.toUpperCase();
      if (!teamMap.has(team)) teamMap.set(team, { total: 0, players: new Set() });
      const entry = teamMap.get(team)!;
      entry.total++;
      entry.players.add(p.name.toLowerCase());
      grandTotal++;
    }
  }

  return Array.from(teamMap.entries())
    .map(([team, v]) => ({
      team,
      totalSelections: v.total,
      avgPerDraft: Math.round((v.total / drafts.length) * 100) / 100,
      uniquePlayers: v.players.size,
      pct: Math.round((v.total / grandTotal) * 1000) / 10,
    }))
    .sort((a, b) => b.totalSelections - a.totalSelections)
    .slice(0, 16); // top 16 teams is plenty
}

// ─── Route handler ────────────────────────────────────────────────────────────

// ─── 5. Draft strategy analyzer ──────────────────────────────────────────────

export interface DraftStrategyResult {
  strategy: string;
  category: "RB" | "QB" | "TE";
  description: string;
  count: number;
  pct: number;
}

// Elite TE names — update this list as the meta shifts
const ELITE_TE_NAMES = new Set([
  "brock bowers", "trey mcbride", "sam laporta", "tucker kraft", "dalton kincaid",
]);

function calculateDraftStrategies(drafts: NormalizedDraft[]): DraftStrategyResult[] {
  if (drafts.length === 0) return [];

  const counters = {
    // RB strategies
    zeroRB: 0,
    heroRB: 0,
    doubleAnchor: 0,

    // QB strategies
    eliteQB: 0,
    coreQB: 0,
    lateQB: 0,

    // TE strategies
    eliteTE: 0,
    anchorTE: 0,
    lateTE: 0,
  };

  for (const draft of drafts) {
    const players = draft.players.slice().sort((a, b) => a.draftedRound - b.draftedRound);

    const rbs = players.filter(p => p.position === "RB");
    const qbs = players.filter(p => p.position === "QB");
    const tes = players.filter(p => p.position === "TE");

    const rbRounds = rbs.map(p => p.draftedRound).sort((a, b) => a - b);
    const qbRounds = qbs.map(p => p.draftedRound).sort((a, b) => a - b);
    const teRounds = tes.map(p => p.draftedRound).sort((a, b) => a - b);

    const firstRbRound = rbRounds[0] ?? 999;
    const secondRbRound = rbRounds[1] ?? 999;
    const firstQbRound = qbRounds[0] ?? 999;
    const firstTeRound = teRounds[0] ?? 999;
    const firstTeName = tes[0]?.name.toLowerCase() ?? "";

    // ── RB strategies (mutually exclusive, evaluated in priority order) ──
    if (firstRbRound > 4) {
      // No RB in rounds 1-4
      counters.zeroRB++;
    } else if (firstRbRound === 1 && secondRbRound > 6) {
      // First-round RB then nothing for 5+ rounds
      counters.heroRB++;
    } else if (firstRbRound <= 2 && secondRbRound <= 2) {
      // Two RBs in first two rounds
      counters.doubleAnchor++;
    }

    // ── QB strategies (mutually exclusive) ──
    if (firstQbRound <= 5) {
      counters.eliteQB++;
    } else if (firstQbRound <= 9) {
      counters.coreQB++;
    } else {
      counters.lateQB++;
    }

    // ── TE strategies (mutually exclusive, evaluated in priority order) ──
    if (ELITE_TE_NAMES.has(firstTeName)) {
      counters.eliteTE++;
    } else if (firstTeRound >= 3 && firstTeRound <= 7) {
      counters.anchorTE++;
    } else if (firstTeRound >= 10 || firstTeRound === 999) {
      counters.lateTE++;
    }
    // Rounds 1-2 non-elite TE or round 8-9 TE fall through (no label) — intentional
  }

  const pct = (n: number) => Math.round((n / drafts.length) * 1000) / 10;

  return [
    // RB strategies
    { strategy: "Zero RB",      category: "RB", description: "No RB drafted in rounds 1–4",                           count: counters.zeroRB,      pct: pct(counters.zeroRB) },
    { strategy: "Hero RB",      category: "RB", description: "R1 RB, then no RB for 5+ rounds",                       count: counters.heroRB,      pct: pct(counters.heroRB) },
    { strategy: "Double Anchor",category: "RB", description: "Two RBs in the first two rounds",                       count: counters.doubleAnchor,pct: pct(counters.doubleAnchor) },

    // QB strategies
    { strategy: "Elite QB",     category: "QB", description: "First QB taken rounds 1–5",                             count: counters.eliteQB,     pct: pct(counters.eliteQB) },
    { strategy: "Core QB",      category: "QB", description: "First QB taken rounds 6–9",                             count: counters.coreQB,      pct: pct(counters.coreQB) },
    { strategy: "Late Round QB",category: "QB", description: "First QB taken round 10+",                              count: counters.lateQB,      pct: pct(counters.lateQB) },

    // TE strategies
    { strategy: "Elite TE",     category: "TE", description: "Bowers / McBride / top-tier TEs",                       count: counters.eliteTE,     pct: pct(counters.eliteTE) },
    { strategy: "Anchor TE",    category: "TE", description: "First TE in rounds 3–7",                                count: counters.anchorTE,    pct: pct(counters.anchorTE) },
    { strategy: "Late TE",      category: "TE", description: "No TE until round 10+",                                 count: counters.lateTE,      pct: pct(counters.lateTE) },
  ];
}


export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const positionFilter = searchParams.get("position");

    const dbDrafts = await prisma.draft.findMany({
      where: { source: { not: "live" } },
      include: { players: true },
    });

    const drafts: NormalizedDraft[] = dbDrafts.map((d: any) => ({
      id: d.id,
      contestName: d.contestName,
      entryFee: d.entryFee,
      draftedAt: d.draftedAt,
      startingPick: d.startingPick,
      totalTeams: d.totalTeams,
      players: d.players.map((p: any): NormalizedPlayer => ({
        id: p.id, name: p.name, team: p.team, position: p.position as Position,
        draftedPick: p.draftedPick, draftedRound: p.draftedRound,
        adpAtDraft: p.adpAtDraft, currentAdp: p.currentAdp, draftId: p.draftId,
      })),
    }));

    // Fetch current DK ADP + image URLs from PlayerUniverse for CLV calculation
    const universeRows = await (prisma as any).playerUniverse.findMany({
      select: { name: true, dkAdp: true, imageUrl: true },
    });
    const currentDkAdpMap = new Map<string, { dkAdp: number | null; imageUrl: string | null }>(
      universeRows.map((r: any) => [r.name.toLowerCase(), { dkAdp: r.dkAdp, imageUrl: r.imageUrl }])
    );

    const allPlayers = drafts.flatMap((d) => d.players);
    const filtered = positionFilter ? allPlayers.filter((p) => p.position === positionFilter) : allPlayers;

    return NextResponse.json({
      exposure: calculateExposure(filtered, drafts.length, currentDkAdpMap),
      stats: calculatePortfolioStats(drafts),
      draftPositions: calculateDraftPositionDistribution(drafts),
      rosterArchetypes: calculateRosterArchetypes(drafts),
      qbStacks: calculateQBStacks(drafts),
      topOffenses: calculateTopOffenses(drafts),
      draftStrategies: calculateDraftStrategies(drafts),
    });
  } catch (err) {
    console.error("Analytics error:", err);
    return NextResponse.json({ error: "Analytics failed" }, { status: 500 });
  }
}
