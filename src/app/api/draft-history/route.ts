import { NextResponse } from "next/server";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { buildPlayerNameIndex } from "@/lib/parsers/playerIdentity";
import { parseDraftJSON } from "@/lib/parsers/draft-json";
import { prisma } from "@/lib/db/client";

const DRAFT_HISTORY_PATH = join(process.cwd(), "data", "draft_history.json");

export async function POST() {
  try {
    // Clear error if file doesn't exist
    if (!existsSync(DRAFT_HISTORY_PATH)) {
      return NextResponse.json(
        {
          error: `draft_history.json not found`,
          detail: `Create the file at: ${DRAFT_HISTORY_PATH}\n\nFormat: a JSON array of draft objects, e.g. [{\"draftId\":\"...\", \"players\":[...]}]`,
        },
        { status: 404 }
      );
    }

    let jsonText: string;
    try {
      jsonText = readFileSync(DRAFT_HISTORY_PATH, "utf8");
    } catch (e) {
      return NextResponse.json({ error: `Could not read draft_history.json: ${String(e)}` }, { status: 500 });
    }

    // Name resolution — optional, skip gracefully if master players not yet imported
    const masterPlayers = await (prisma as any).playerUniverse.findMany({
      select: { name: true, team: true, position: true },
    });
    const nameIndex = buildPlayerNameIndex(masterPlayers);

    const { drafts, errors } = parseDraftJSON(jsonText, nameIndex);

    if (drafts.length === 0) {
      return NextResponse.json({ error: "No drafts found in draft_history.json", parseErrors: errors }, { status: 422 });
    }

    // Wipe all previously-synced JSON drafts so stale/removed drafts don't persist.
    // Players cascade-delete via Prisma's referential actions.
    await prisma.draft.deleteMany({ where: { source: "json" } });

    let imported = 0;

    for (const draft of drafts) {
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
              rawName: p.rawName ?? null,
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

    return NextResponse.json({ success: true, imported, skipped: 0, total: drafts.length, parseErrors: errors });
  } catch (err) {
    console.error("Draft history sync error:", err);
    return NextResponse.json({ error: "Sync failed", detail: String(err) }, { status: 500 });
  }
}

export async function GET() {
  try {
    // Only count "real" drafts — exclude auto-saved live sessions
    const count = await prisma.draft.count({
      where: { source: { not: "live" } },
    });
    return NextResponse.json({ totalDrafts: count });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
