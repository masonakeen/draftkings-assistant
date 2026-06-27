import { NextResponse } from "next/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildPlayerNameIndex } from "@/lib/parsers/playerIdentity";
import { parseDraftJSON } from "@/lib/parsers/draft-json";
import { prisma } from "@/lib/db/client";

const DRAFT_HISTORY_PATH = join(process.cwd(), "data", "draft_history.json");

/**
 * GET /api/draft-history
 * Reads data/draft_history.json, deduplicates against what's already in
 * SQLite by draftId, and upserts only new drafts. Returns a summary.
 *
 * This replaces the upload-based import for personal draft history.
 * To add a new draft: append its object to data/draft_history.json and
 * call this endpoint (the dashboard "Sync" button does this automatically).
 */
export async function POST() {
  try {
    let jsonText: string;
    try {
      jsonText = readFileSync(DRAFT_HISTORY_PATH, "utf8");
    } catch {
      return NextResponse.json(
        { error: `data/draft_history.json not found at ${DRAFT_HISTORY_PATH}` },
        { status: 404 }
      );
    }

    // Build name index from master players for resolution
    const masterPlayers = await prisma.masterPlayer.findMany({
      select: { name: true, team: true, position: true },
    });
    const nameIndex = buildPlayerNameIndex(masterPlayers);

    const { drafts, errors } = parseDraftJSON(jsonText, nameIndex);

    if (drafts.length === 0) {
      return NextResponse.json({ error: "No drafts found in draft_history.json", parseErrors: errors }, { status: 422 });
    }

    // Deduplicate: only insert drafts whose ID doesn't already exist
    const existingIds = new Set(
      (await prisma.draft.findMany({ select: { id: true } })).map((d: { id: string }) => d.id)
    );

    let imported = 0;
    let skipped = 0;

    for (const draft of drafts) {
      if (existingIds.has(draft.id)) {
        skipped++;
        continue;
      }

      await prisma.draft.create({
        data: {
          id: draft.id,
          contestName: draft.contestName,
          entryFee: draft.entryFee,
          draftedAt: draft.draftedAt,
          startingPick: draft.startingPick,
          totalTeams: draft.totalTeams,
          source: "json",
          players: {
            create: draft.players.map((p) => ({
              id: p.id,
              name: p.name,
              rawName: p.rawName,
              team: p.team,
              position: p.position,
              draftedPick: p.draftedPick,
              draftedRound: p.draftedRound,
              adpAtDraft: p.adpAtDraft,
              currentAdp: p.currentAdp,
            })),
          },
        },
      });
      imported++;
    }

    return NextResponse.json({
      success: true,
      imported,
      skipped,
      total: drafts.length,
      parseErrors: errors,
    });
  } catch (err) {
    console.error("Draft history sync error:", err);
    return NextResponse.json({ error: "Sync failed", detail: String(err) }, { status: 500 });
  }
}

export async function GET() {
  try {
    const count = await prisma.draft.count();
    return NextResponse.json({ totalDrafts: count });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
