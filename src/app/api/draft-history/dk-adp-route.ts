import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { parseDKAdpCSV } from "@/lib/parsers/dk-adp-csv";

/**
 * Updates only the dkAdp field on MasterPlayer.
 * Does NOT touch underdogAdp or adpDelta — those come from master-rankings.
 */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });

    const csvText = await file.text();
    const { rows, errors } = parseDKAdpCSV(csvText);

    if (rows.length === 0) {
      return NextResponse.json({ error: "No valid rows found", parseErrors: errors }, { status: 422 });
    }

    await prisma.rawImport.create({
      data: {
        filename: file.name,
        rowCount: rows.length,
        rawData: JSON.stringify(rows.slice(0, 200)), // trim for storage
        importType: "dk_adp",
      },
    });

    let updated = 0;
    let notFound = 0;

    for (const row of rows) {
      const result = await prisma.masterPlayer.updateMany({
        where: { name: row.name },
        data: { draftkingsAdp: row.adp },
      });
      if (result.count > 0) {
        updated++;
      } else {
        notFound++;
      }
    }

    return NextResponse.json({
      success: true,
      updated,
      notFound,
      total: rows.length,
      parseErrors: errors,
    });
  } catch (err) {
    console.error("DK ADP import error:", err);
    return NextResponse.json({ error: "Import failed", detail: String(err) }, { status: 500 });
  }
}
