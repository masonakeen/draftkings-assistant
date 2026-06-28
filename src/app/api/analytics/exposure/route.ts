import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { calculateExposure } from "@/lib/analytics/exposure";
import type { NormalizedDraft, NormalizedPlayer, Position, PortfolioStats } from "@/types";

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

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const positionFilter = searchParams.get("position");

    // Exclude auto-saved live drafts — they aren't "entered" drafts
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

    const allPlayers = drafts.flatMap((d) => d.players);
    const filtered = positionFilter ? allPlayers.filter((p) => p.position === positionFilter) : allPlayers;

    const exposure = calculateExposure(filtered, drafts.length);
    const stats = calculatePortfolioStats(drafts);

    return NextResponse.json({ exposure, stats });
  } catch (err) {
    console.error("Analytics error:", err);
    return NextResponse.json({ error: "Analytics failed" }, { status: 500 });
  }
}