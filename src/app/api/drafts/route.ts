import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";

export async function GET() {
  try {
    const drafts = await prisma.draft.findMany({
      orderBy: { draftedAt: "desc" },
      include: { _count: { select: { players: true } } },
    });
    return NextResponse.json({ drafts });
  } catch (err) {
    return NextResponse.json({ error: "Failed to fetch drafts" }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    await prisma.player.deleteMany();
    await prisma.draft.deleteMany();
    await prisma.rawImport.deleteMany();
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: "Failed to clear data" }, { status: 500 });
  }
}
