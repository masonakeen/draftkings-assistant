import type { NormalizedPlayer, PlayerExposure, Position } from "@/types";

/**
 * currentDkAdpMap: name.toLowerCase() -> { dkAdp, imageUrl }
 * Populated by the exposure route from PlayerUniverse so CLV uses the
 * live DK ADP rather than the stale adpAtDraft stored on historical picks.
 *
 * CLV = (avgPickWhenDrafted - currentDkAdp) / currentDkAdp
 * Negative = you drafted them at a lower pick number than ADP = value (green)
 * Positive = you paid more picks than ADP = overpay (red)
 */
export function calculateExposure(
  players: NormalizedPlayer[],
  totalDrafts: number,
  currentDkAdpMap: Map<string, { dkAdp: number | null; imageUrl: string | null }> = new Map()
): PlayerExposure[] {
  if (totalDrafts === 0) return [];

  const byName = new Map<string, NormalizedPlayer[]>();
  for (const p of players) {
    const key = p.name.toLowerCase();
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key)!.push(p);
  }

  const exposures: PlayerExposure[] = [];

  for (const [nameKey, instances] of byName) {
    const first = instances[0];
    const draftCount = instances.length;
    const exposure = (draftCount / totalDrafts) * 100;

    const avgPickWhenDrafted =
      instances.reduce((sum, p) => sum + p.draftedPick, 0) / draftCount;

    const adpValues = instances.map(p => p.adpAtDraft).filter((v): v is number => v !== null);
    const avgAdp = adpValues.length > 0
      ? adpValues.reduce((s, v) => s + v, 0) / adpValues.length
      : null;

    // Legacy CLV from historical adpAtDraft (often null for JSON imports)
    const clvValues = instances
      .filter(p => p.adpAtDraft !== null)
      .map(p => p.adpAtDraft! - p.draftedPick);
    const clvAvg = clvValues.length > 0
      ? clvValues.reduce((s, v) => s + v, 0) / clvValues.length
      : null;

    // Current DK ADP from PlayerUniverse — the authoritative live number
    const universe = currentDkAdpMap.get(nameKey);
    const currentDkAdp = universe?.dkAdp ?? null;
    const imageUrl = universe?.imageUrl ?? null;

    // True CLV: (avgPickWhenDrafted - currentDkAdp) / currentDkAdp
    // Negative = you got value (drafted later ADP than they currently sit)
    // Positive = you overpaid (drafted earlier than their current ADP)
    const clv = currentDkAdp != null && currentDkAdp > 0
      ? Math.round(((avgPickWhenDrafted - currentDkAdp) / currentDkAdp) * 1000) / 10
      : null;

    exposures.push({
      name: first.name,
      team: first.team,
      position: first.position as Position,
      imageUrl,
      draftCount,
      exposure: Math.round(exposure * 10) / 10,
      avgPickWhenDrafted: Math.round(avgPickWhenDrafted * 10) / 10,
      avgAdp: avgAdp !== null ? Math.round(avgAdp * 10) / 10 : null,
      currentDkAdp,
      clv,
      clvAvg: clvAvg !== null ? Math.round(clvAvg * 10) / 10 : null,
    });
  }

  return exposures.sort((a, b) => b.exposure - a.exposure);
}
