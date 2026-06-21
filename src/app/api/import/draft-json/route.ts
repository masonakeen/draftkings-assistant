import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { parseDraftJSON } from "@/lib/parsers/draft-json";
import { buildPlayerNameIndex } from "@/lib/parsers/playerIdentity";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });

    const jsonText = await file.text();

    const masterPlayers = await prisma.masterPlayer.findMany({
      select: { name: true, team: true, position: true },
    });
    if (masterPlayers.length === 0) {
      return NextResponse.json(
        {
          error:
            "Import your master rankings CSV first — name resolution (e.g. \"J. Jefferson\" → \"Justin Jefferson\") needs it to work reliably.",
        },
        { status: 422 }
      );
    }
    const nameIndex = buildPlayerNameIndex(masterPlayers);

    const { drafts, errors } = parseDraftJSON(jsonText, nameIndex);

    if (drafts.length === 0) {
      return NextResponse.json({ error: "No valid drafts found in JSON", parseErrors: errors }, { status: 422 });
    }

    await prisma.rawImport.create({
      data: { filename: file.name, rowCount: drafts.length, rawData: jsonText.slice(0, 500_000), importType: "draft_json" },
    });

    let imported = 0;
    let skipped = 0;

    for (const draft of drafts) {
      const existing = await prisma.draft.findUnique({ where: { id: draft.id } });
      if (existing) { skipped++; continue; }

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

    return NextResponse.json({ success: true, imported, skipped, total: drafts.length, parseErrors: errors });
  } catch (err) {
    console.error("Draft JSON import error:", err);
    return NextResponse.json({ error: "Import failed", detail: String(err) }, { status: 500 });
  }
}
