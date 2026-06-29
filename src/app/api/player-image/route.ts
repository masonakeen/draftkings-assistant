import { NextRequest, NextResponse } from "next/server";

/**
 * Proxies DraftKings player images to avoid CORS/mixed-content issues.
 * Usage: <img src="/api/player-image?uid=693112" />
 * Falls back to a transparent 1x1 PNG if the image isn't found.
 */
export async function GET(req: NextRequest) {
  const uid = new URL(req.url).searchParams.get("uid");
  if (!uid || !/^\d+$/.test(uid)) {
    return new NextResponse(TRANSPARENT_PNG, {
      headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=86400" },
    });
  }

  const url = `https://dkn.gs/sports/images/nfl/players/50/${uid}.png`;

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(3000),
    });

    if (!res.ok) {
      return new NextResponse(TRANSPARENT_PNG, {
        headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=3600" },
      });
    }

    const buffer = await res.arrayBuffer();
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": res.headers.get("Content-Type") ?? "image/png",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch {
    return new NextResponse(TRANSPARENT_PNG, {
      headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=3600" },
    });
  }
}

// Transparent 1×1 PNG fallback
const TRANSPARENT_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64"
);
