import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { parseDKAdpCSV } from "@/lib/parsers/dk-adp-csv";

/**
 * Updates dkAdp only on PlayerUniverse.
 * Also recomputes adpDelta = dkAdp - udAdp.
 * Does NOT touch udAdp, fpRank, Vegas fields, or anything else.
 *
 * To manually update DK ADP outside the UI:
 *   1. Export DK ADP CSV from DraftKings (Best Ball rankings page → Export)
 *   2. Drop it on the "DK ADP" import tile on the dashboard
 *   OR directly edit PlayerUniverse rows in: npx prisma studio
 */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });

    const { rows, errors } = parseDKAdpCSV(await file.text());
    if (rows.length === 0) {
      return NextResponse.json({ error: "No valid rows found", parseErrors: errors }, { status: 422 });
    }

    await prisma.rawImport.create({
      data: { filename: file.name, rowCount: rows.length, rawData: JSON.stringify(rows.slice(0, 200)), importType: "dk_adp" },
    });

    let updated = 0;
    let notFound = 0;

    for (const row of rows) {
      // Fetch current udAdp to recompute delta
      const existing = await (prisma as any).playerUniverse.findUnique({
        where: { name: row.name },
        select: { udAdp: true },
      });

      if (!existing) { notFound++; continue; }

      const adpDelta = existing.udAdp != null
        ? Math.round((row.adp - existing.udAdp) * 10) / 10
        : null;

      await (prisma as any).playerUniverse.update({
        where: { name: row.name },
        data: { dkAdp: row.adp, adpDelta },
      });
      updated++;
    }

    return NextResponse.json({ success: true, updated, notFound, total: rows.length, parseErrors: errors });
  } catch (err) {
    console.error("DK ADP import error:", err);
    return NextResponse.json({ error: "Import failed", detail: String(err) }, { status: 500 });
  }
}
