import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { parseTeamTotalsCSV } from "@/lib/parsers/team-totals-csv";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });

    const csvText = await file.text();
    const { rows, errors } = parseTeamTotalsCSV(csvText);

    if (rows.length === 0) {
      return NextResponse.json({ error: "No valid rows found", parseErrors: errors }, { status: 422 });
    }

    await prisma.rawImport.create({
      data: { filename: file.name, rowCount: rows.length, rawData: JSON.stringify(rows), importType: "team_totals" },
    });

    let upserted = 0;
    for (const row of rows) {
      await prisma.teamWeekProjection.upsert({
        where: { team: row.team },
        create: { ...row },
        update: { ...row },
      });
      upserted++;
    }

    return NextResponse.json({ success: true, upserted, total: rows.length, parseErrors: errors });
  } catch (err) {
    console.error("Team totals import error:", err);
    return NextResponse.json({ error: "Import failed", detail: String(err) }, { status: 500 });
  }
}
