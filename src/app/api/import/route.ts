import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { parseDKCSV } from "@/lib/parsers/dk-csv";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const csvText = await file.text();
    const { drafts, rawRows, errors } = parseDKCSV(csvText);

    if (drafts.length === 0) {
      return NextResponse.json(
        { error: "No valid drafts found in CSV", parseErrors: errors },
        { status: 422 }
      );
    }

    await prisma.rawImport.create({
      data: { filename: file.name, rowCount: rawRows.length, rawData: JSON.stringify(rawRows), importType: "dk_draft" },
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
          source: "csv",
          players: {
            create: draft.players.map((p) => ({
              id: p.id,
              name: p.name,
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
    console.error("Import error:", err);
    return NextResponse.json({ error: "Import failed", detail: String(err) }, { status: 500 });
  }
}
