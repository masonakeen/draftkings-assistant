import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { parseMasterRankingsCSV } from "@/lib/parsers/master-rankings-csv";

/**
 * Imports the FantasyPros-style multi-site ADP CSV.
 * Populates: name, team, position, bye, fpRank, udAdp, dkAdp, avgAdp, adpDelta.
 * Also denormalizes any existing TeamWeekProjection data into PlayerUniverse
 * so Vegas fields are available immediately after import.
 */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });

    const { rows, errors } = parseMasterRankingsCSV(await file.text());
    if (rows.length === 0) {
      return NextResponse.json({ error: "No valid rows found", parseErrors: errors }, { status: 422 });
    }

    // Pre-load Vegas data so we can denormalize in the same upsert pass
    const teamProjections = await prisma.teamWeekProjection.findMany();
    const vegasByTeam = new Map(teamProjections.map((t: any) => [t.team.toUpperCase(), t]));

    await prisma.rawImport.create({
      data: { filename: file.name, rowCount: rows.length, rawData: JSON.stringify(rows.slice(0, 100)), importType: "master_rankings" },
    });

    let upserted = 0;
    for (const row of rows) {
      const vegas = vegasByTeam.get(row.team.toUpperCase()) as any;
      const playoffOUs = [vegas?.week15OU, vegas?.week16OU, vegas?.week17OU].filter((v: any): v is number => v != null);
      const teamTotals = [vegas?.week15TeamTotal, vegas?.week16TeamTotal, vegas?.week17TeamTotal].filter((v: any): v is number => v != null);

      await (prisma as any).playerUniverse.upsert({
        where: { name: row.name },
        create: {
          name: row.name, team: row.team, position: row.position, bye: row.bye,
          fpRank: row.fpRank, udAdp: row.underdogAdp, dkAdp: row.draftkingsAdp,
          avgAdp: row.avgAdp, adpDelta: row.adpDelta,
          ...(vegas ? {
            week15Opp: vegas.week15Opp, week15TeamTotal: vegas.week15TeamTotal, week15OU: vegas.week15OU,
            week16Opp: vegas.week16Opp, week16TeamTotal: vegas.week16TeamTotal, week16OU: vegas.week16OU,
            week17Opp: vegas.week17Opp, week17TeamTotal: vegas.week17TeamTotal, week17OU: vegas.week17OU,
            week18Opp: vegas.week18Opp, week18TeamTotal: vegas.week18TeamTotal, week18OU: vegas.week18OU,
            playoffTotalOU: playoffOUs.length ? playoffOUs.reduce((s: number, v: number) => s + v, 0) / playoffOUs.length : null,
            impliedTeamTotal: teamTotals.length ? teamTotals.reduce((s: number, v: number) => s + v, 0) / teamTotals.length : null,
          } : {}),
        },
        update: {
          team: row.team, position: row.position, bye: row.bye,
          fpRank: row.fpRank, udAdp: row.underdogAdp, dkAdp: row.draftkingsAdp,
          avgAdp: row.avgAdp, adpDelta: row.adpDelta,
          ...(vegas ? {
            week15Opp: vegas.week15Opp, week15TeamTotal: vegas.week15TeamTotal, week15OU: vegas.week15OU,
            week16Opp: vegas.week16Opp, week16TeamTotal: vegas.week16TeamTotal, week16OU: vegas.week16OU,
            week17Opp: vegas.week17Opp, week17TeamTotal: vegas.week17TeamTotal, week17OU: vegas.week17OU,
            week18Opp: vegas.week18Opp, week18TeamTotal: vegas.week18TeamTotal, week18OU: vegas.week18OU,
            playoffTotalOU: playoffOUs.length ? playoffOUs.reduce((s: number, v: number) => s + v, 0) / playoffOUs.length : null,
            impliedTeamTotal: teamTotals.length ? teamTotals.reduce((s: number, v: number) => s + v, 0) / teamTotals.length : null,
          } : {}),
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
