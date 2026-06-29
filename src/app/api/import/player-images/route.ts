import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import Papa from "papaparse";

/**
 * Imports the DraftKings player image mapping CSV:
 *   Player, UID, ImageURL
 *   "Bijan Robinson","693112","https://dkn.gs/sports/images/nfl/players/50/693112.png"
 *
 * Writes playerUid and imageUrl to PlayerUniverse.
 * Matching is by player name (case-insensitive). Near-misses are logged as warnings.
 */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });

    const csvText = await file.text();
    const { data, errors: parseErrors } = Papa.parse<Record<string, string>>(csvText, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
    });

    const errors: string[] = parseErrors.map(e => `Row ${e.row}: ${e.message}`);

    await prisma.rawImport.create({
      data: {
        filename: file.name,
        rowCount: data.length,
        rawData: JSON.stringify(data.slice(0, 100)),
        importType: "player_images",
      },
    });

    let updated = 0;
    let notFound = 0;

    for (const row of data) {
      // Handle both "Player" and "Name" column headers
      const playerName = (row["Player"] ?? row["Name"] ?? "").trim();
      const uid = (row["UID"] ?? row["PlayerId"] ?? "").trim();
      const imageUrl = (row["ImageURL"] ?? row["Image"] ?? row["Url"] ?? "").trim();

      if (!playerName || !uid) continue;

      // Construct URL from UID if not explicitly provided
      const resolvedUrl = imageUrl || `https://dkn.gs/sports/images/nfl/players/50/${uid}.png`;

      const result = await (prisma as any).playerUniverse.updateMany({
        where: { name: { equals: playerName, mode: "insensitive" } },
        data: { playerUid: uid, imageUrl: resolvedUrl },
      });

      if (result.count > 0) {
        updated++;
      } else {
        notFound++;
        if (notFound <= 10) errors.push(`No match for "${playerName}"`);
      }
    }

    return NextResponse.json({ success: true, updated, notFound, total: data.length, parseErrors: errors });
  } catch (err) {
    console.error("Player image import error:", err);
    return NextResponse.json({ error: "Import failed", detail: String(err) }, { status: 500 });
  }
}
