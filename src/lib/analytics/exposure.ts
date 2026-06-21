import type { NormalizedPlayer, PlayerExposure, Position } from "@/types";

export function calculateExposure(
  players: NormalizedPlayer[],
  totalDrafts: number
): PlayerExposure[] {
  if (totalDrafts === 0) return [];

  const byName = new Map<string, NormalizedPlayer[]>();
  for (const p of players) {
    const key = p.name.toLowerCase();
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key)!.push(p);
  }

  const exposures: PlayerExposure[] = [];

  for (const [, instances] of byName) {
    const first = instances[0];
    const draftCount = instances.length;
    const exposure = (draftCount / totalDrafts) * 100;

    const avgPickWhenDrafted =
      instances.reduce((sum, p) => sum + p.draftedPick, 0) / draftCount;

    const adpValues = instances.map((p) => p.adpAtDraft).filter((v): v is number => v !== null);
    const avgAdp = adpValues.length > 0
      ? adpValues.reduce((s, v) => s + v, 0) / adpValues.length
      : null;

    const clvValues = instances
      .filter((p) => p.adpAtDraft !== null)
      .map((p) => p.adpAtDraft! - p.draftedPick);
    const clvAvg = clvValues.length > 0
      ? clvValues.reduce((s, v) => s + v, 0) / clvValues.length
      : null;

    exposures.push({
      name: first.name,
      team: first.team,
      position: first.position as Position,
      draftCount,
      exposure: Math.round(exposure * 10) / 10,
      avgPickWhenDrafted: Math.round(avgPickWhenDrafted * 10) / 10,
      avgAdp: avgAdp !== null ? Math.round(avgAdp * 10) / 10 : null,
      clvAvg: clvAvg !== null ? Math.round(clvAvg * 10) / 10 : null,
    });
  }

  return exposures.sort((a, b) => b.exposure - a.exposure);
}
