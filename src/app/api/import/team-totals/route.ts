import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { parseTeamTotalsCSV } from "@/lib/parsers/team-totals-csv";

/**
 * Imports Vegas team totals CSV.
 * 1. Writes to TeamWeekProjection (authoritative Vegas store).
 * 2. Denormalizes into PlayerUniverse so every player row has Vegas fields inline.
 */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });

    const { rows, errors } = parseTeamTotalsCSV(await file.text());
    if (rows.length === 0) {
      return NextResponse.json({ error: "No valid rows found", parseErrors: errors }, { status: 422 });
    }

    await prisma.rawImport.create({
      data: { filename: file.name, rowCount: rows.length, rawData: JSON.stringify(rows), importType: "team_totals" },
    });

    let upserted = 0;
    for (const row of rows) {
      // 1. Write authoritative Vegas record
      await prisma.teamWeekProjection.upsert({
        where: { team: row.team },
        create: { ...row },
        update: { ...row },
      });

      // 2. Compute derived fields
      const playoffOUs = [row.week15OU, row.week16OU, row.week17OU].filter((v): v is number => v != null);
      const teamTotals = [row.week15TeamTotal, row.week16TeamTotal, row.week17TeamTotal].filter((v): v is number => v != null);
      const playoffTotalOU = playoffOUs.length ? playoffOUs.reduce((s, v) => s + v, 0) / playoffOUs.length : null;
      const impliedTeamTotal = teamTotals.length ? teamTotals.reduce((s, v) => s + v, 0) / teamTotals.length : null;

      // 3. Denormalize into every player on this team
      await (prisma as any).playerUniverse.updateMany({
        where: { team: row.team },
        data: {
          week15Opp: row.week15Opp, week15TeamTotal: row.week15TeamTotal, week15OU: row.week15OU,
          week16Opp: row.week16Opp, week16TeamTotal: row.week16TeamTotal, week16OU: row.week16OU,
          week17Opp: row.week17Opp, week17TeamTotal: row.week17TeamTotal, week17OU: row.week17OU,
          week18Opp: row.week18Opp, week18TeamTotal: row.week18TeamTotal, week18OU: row.week18OU,
          playoffTotalOU,
          impliedTeamTotal,
        },
      });
      upserted++;
    }

    return NextResponse.json({ success: true, upserted, total: rows.length, parseErrors: errors });
  } catch (err) {
    console.error("Team totals import error:", err);
    return NextResponse.json({ error: "Import failed", detail: String(err) }, { status: 500 });
  }
}
