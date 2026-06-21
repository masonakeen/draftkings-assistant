import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { parseMasterRankingsCSV } from "@/lib/parsers/master-rankings-csv";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });

    const csvText = await file.text();
    const { rows, errors } = parseMasterRankingsCSV(csvText);

    if (rows.length === 0) {
      return NextResponse.json({ error: "No valid rows found", parseErrors: errors }, { status: 422 });
    }

    await prisma.rawImport.create({
      data: { filename: file.name, rowCount: rows.length, rawData: JSON.stringify(rows), importType: "master_rankings" },
    });

    let upserted = 0;
    for (const row of rows) {
      await prisma.masterPlayer.upsert({
        where: { name: row.name },
        create: {
          name: row.name, team: row.team, position: row.position, bye: row.bye,
          fpRank: row.fpRank, underdogAdp: row.underdogAdp, draftkingsAdp: row.draftkingsAdp,
          avgAdp: row.avgAdp, adpDelta: row.adpDelta,
        },
        update: {
          team: row.team, position: row.position, bye: row.bye,
          fpRank: row.fpRank, underdogAdp: row.underdogAdp, draftkingsAdp: row.draftkingsAdp,
          avgAdp: row.avgAdp, adpDelta: row.adpDelta,
        },
      });
      upserted++;
    }

    return NextResponse.json({ success: true, upserted, total: rows.length, parseErrors: errors });
  } catch (err) {
    console.error("Master rankings import error:", err);
    return NextResponse.json({ error: "Import failed", detail: String(err) }, { status: 500 });
  }
}
