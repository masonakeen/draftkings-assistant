import "dotenv/config";
import http from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { PrismaClient } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";

import { draftSession } from "../src/lib/bridge/draftState";
import { buildCoOccurrenceIndex, checkCorrelationFlag } from "../src/lib/analytics/correlation";
import { checkByeWeekConflict, type RosterSlot } from "../src/lib/analytics/byeConflict";
import { getPositionalValue } from "../src/lib/analytics/positionalValue";
import { buildPlayerNameIndex, resolvePlayerName, type PlayerNameIndex, type MasterPlayerLite } from "../src/lib/parsers/playerIdentity";
import { normalizeTeamCode } from "../src/lib/utils/teamCode";
import type { LiveDraftPick, NormalizedDraft, NormalizedPlayer, Position, RecommendedPlayer } from "../src/types";

const PORT = Number(process.env.BRIDGE_WS_PORT ?? 4001);
const POSITIONAL_VALUE_ENABLED = process.env.POSITIONAL_VALUE_ENABLED === "true";
const REFRESH_MS = 60_000;

const prisma = new PrismaClient();

const VALID_POSITIONS: Position[] = ["QB", "RB", "WR", "TE", "FLEX", "K", "DST"];
function normalizePosition(raw: string): Position {
  const upper = (raw ?? "").toUpperCase().trim();
  if (VALID_POSITIONS.includes(upper as Position)) return upper as Position;
  if (upper === "DEF" || upper === "D/ST") return "DST";
  return "FLEX";
}

// ─── Cached player universe ───────────────────────────────────────────────────

type UniverseRow = {
  name: string; team: string; position: string; bye: number | null;
  dkAdp: number | null; udAdp: number | null; adpDelta: number | null;
  playoffTotalOU: number | null; week17OU: number | null;
  impliedTeamTotal: number | null; week17Opp: number | null;
};

let universe: UniverseRow[] = [];
let nameIndex: PlayerNameIndex = buildPlayerNameIndex([]);
let week17MatchupMap = new Map<string, string>(); // "DAL" -> "NYG"

async function refreshUniverse() {
  universe = await (prisma as any).playerUniverse.findMany();

  const masterLite: MasterPlayerLite[] = universe.map((p: UniverseRow) => ({
    name: p.name, team: p.team, position: p.position,
  }));
  nameIndex = buildPlayerNameIndex(masterLite);

  // Rebuild W17 matchup map — uppercase both sides to prevent silent mismatches
  week17MatchupMap = new Map();
  for (const p of universe) {
    if ((p as any).week17Opp) {
      week17MatchupMap.set(
        p.team.toUpperCase(),
        normalizeTeamCode((p as any).week17Opp).toUpperCase()
      );
    }
  }

  console.log(`[bridge] ${universe.length} players loaded, ${week17MatchupMap.size} W17 matchups`);
  // Debug: confirm DAL matchup is present
  const dalOpp = week17MatchupMap.get("DAL");
  if (dalOpp) console.log(`[bridge] DAL W17 opponent: ${dalOpp}`);
}

// ─── Recommendation engine ────────────────────────────────────────────────────

async function computeRecommendedPlayers(): Promise<RecommendedPlayer[]> {
  const draftedNames = draftSession.getDraftedPlayerNames();
  const myRosterNames = draftSession.getMyRosterNames();
  const myRoster = draftSession.getState().myRoster;

  const myTeamCounts = new Map<string, number>();
  const myTeams = new Set<string>();
  for (const pick of myRoster) {
    const t = pick.team.toUpperCase();
    myTeamCounts.set(t, (myTeamCounts.get(t) ?? 0) + 1);
    myTeams.add(t);
  }

  // Debug log every recompute so stack/bringback issues are traceable
  if (myRoster.length > 0) {
    console.log(`[bridge] roster (${myRoster.length}):`, myRoster.map((p: any) => `${p.playerName}(${p.team})`).join(", "));
    console.log(`[bridge] team counts:`, Object.fromEntries(myTeamCounts));
  }

  const [dbDrafts, positionalValues] = await Promise.all([
    prisma.draft.findMany({
      where: { source: { not: "live" } },
      include: { players: true },
    }),
    prisma.positionalValue.findMany(),
  ]);

  const normalizedDrafts: NormalizedDraft[] = dbDrafts.map((d: any) => ({
    id: d.id, contestName: d.contestName, entryFee: d.entryFee,
    draftedAt: d.draftedAt, startingPick: d.startingPick, totalTeams: d.totalTeams,
    players: d.players.map((p: any): NormalizedPlayer => ({
      id: p.id, name: p.name, team: p.team, position: p.position as Position,
      draftedPick: p.draftedPick, draftedRound: p.draftedRound,
      adpAtDraft: p.adpAtDraft, currentAdp: p.currentAdp, draftId: p.draftId,
    })),
  }));

  const totalDrafts = normalizedDrafts.length;
  const coIndex = buildCoOccurrenceIndex(normalizedDrafts);

  const exposureByName = new Map<string, number>();
  if (totalDrafts > 0) {
    const counts = new Map<string, number>();
    for (const d of normalizedDrafts)
      for (const p of d.players)
        counts.set(p.name.toLowerCase(), (counts.get(p.name.toLowerCase()) ?? 0) + 1);
    for (const [key, count] of counts)
      exposureByName.set(key, Math.round((count / totalDrafts) * 1000) / 10);
  }

  const posValueByName = positionalValues.map((v: any) => ({
    playerName: v.playerName, position: v.position as Position, value: v.value,
  }));

  const myRosterSlots: RosterSlot[] = myRoster.map((p: any) => ({
    name: p.playerName, team: p.team, position: p.position,
    byeWeek: universe.find((u: UniverseRow) => u.name === p.playerName)?.bye ?? null,
  }));

  const recommended: RecommendedPlayer[] = [];

  for (const p of universe) {
    if (draftedNames.has(p.name.toLowerCase())) continue;

    const position = normalizePosition(p.position);
    const { conflict } = checkByeWeekConflict(
      { team: p.team, position, byeWeek: p.bye },
      myRosterSlots
    );

    const stackCount = myTeamCounts.get(p.team.toUpperCase()) ?? 0;
    const w17Opp = week17MatchupMap.get(p.team.toUpperCase()) ?? null;
    const week17BringBack = w17Opp !== null && myTeams.has(w17Opp);

    recommended.push({
      name: p.name,
      team: p.team,
      position,
      adp: p.dkAdp,
      dkAdp: p.dkAdp,
      adpTrend: null,
      playoffTotalOU: p.playoffTotalOU,
      week17OU: p.week17OU,
      impliedTeamTotal: p.impliedTeamTotal,
      personalExposure: exposureByName.get(p.name.toLowerCase()) ?? null,
      correlationFlag: checkCorrelationFlag(coIndex, p.name, myRosterNames),
      positionalValue: getPositionalValue(posValueByName, p.name, POSITIONAL_VALUE_ENABLED),
      byeWeek: p.bye,
      byeConflict: conflict,
      underdogAdp: p.udAdp,
      adpDelta: p.adpDelta,
      stackCount,
      week17BringBack,
      week17Opponent: w17Opp,
    });
  }

  recommended.sort((a, b) => {
    const aVal = a.adp ?? a.underdogAdp ?? 999;
    const bVal = b.adp ?? b.underdogAdp ?? 999;
    return aVal - bVal;
  });

  return recommended;
}

// ─── Auto-save completed live drafts ─────────────────────────────────────────

async function saveCompletedDraftToHistory() {
  const state = draftSession.getState();
  if (state.picks.length === 0) return;
  const draftId = `live_${state.sessionId}`;
  const existing = await prisma.draft.findUnique({ where: { id: draftId } });
  if (existing) return;

  await prisma.draft.create({
    data: {
      id: draftId, contestName: state.contestName ?? "Live Draft", entryFee: 0,
      draftedAt: new Date(), startingPick: state.startingPick, totalTeams: state.totalTeams,
      source: "live",
      players: {
        create: state.picks.filter((p: any) => p.pickedByMe).map((p: any) => ({
          id: uuidv4(), name: p.playerName, rawName: p.rawName ?? null,
          team: p.team, position: p.position, draftedPick: p.pickNumber,
          draftedRound: Math.ceil(p.pickNumber / state.totalTeams),
          adpAtDraft: null, currentAdp: null,
        })),
      },
    },
  });
  console.log(`[bridge] auto-saved live draft ${draftId}`);
}

// ─── HTTP + WebSocket server ──────────────────────────────────────────────────

const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ ok: true, players: universe.length }));
  }
  if (req.url === "/state") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(lastPayload ?? JSON.stringify({ type: "state_update", state: draftSession.getState(), recommended: [] }));
  }
  res.writeHead(404); res.end();
});

const wss = new WebSocketServer({ server });
const clients = new Set<WebSocket>();
let lastPayload: string | null = null;

async function broadcastState() {
  const recommended = await computeRecommendedPlayers();
  const payload = JSON.stringify({ type: "state_update", state: draftSession.getState(), recommended });
  lastPayload = payload;
  for (const client of clients)
    if (client.readyState === WebSocket.OPEN) client.send(payload);
}

function resolveIncomingPicks(picks: any[]): LiveDraftPick[] {
  return picks.map((p) => {
    const team = normalizeTeamCode(p.team);
    const resolved = resolvePlayerName(nameIndex, p.rawName, team);
    return {
      playerName: resolved ?? p.rawName, rawName: p.rawName,
      team, position: normalizePosition(p.position),
      pickNumber: p.pickNumber, pickedByMe: p.isMine,
      pickedAt: new Date().toISOString(),
    };
  });
}

wss.on("connection", async (ws) => {
  clients.add(ws);
  console.log(`[bridge] client connected (${clients.size} total)`);
  ws.send(JSON.stringify({ type: "state_update", state: draftSession.getState(), recommended: await computeRecommendedPlayers() }));

  ws.on("message", async (raw) => {
    let msg: any;
    try { msg = JSON.parse(raw.toString()); } catch { return; }

    switch (msg.type) {
      case "board_snapshot":
        draftSession.applySnapshot({
          contestName: msg.contestName ?? null, totalTeams: msg.totalTeams ?? 12,
          myUsername: msg.myUsername ?? null, rosterSize: msg.rosterSize,
          picks: resolveIncomingPicks(msg.picks ?? []),
        });
        if (draftSession.isComplete()) await saveCompletedDraftToHistory();
        break;
      case "on_the_clock": draftSession.setOnTheClock(Boolean(msg.isOnTheClock)); break;
      case "reset_session": draftSession.reset(); break;
      case "refresh_universe": await refreshUniverse(); break;
      default: return;
    }
    await broadcastState();
  });

  ws.on("close", () => { clients.delete(ws); });
});

server.listen(PORT, async () => {
  await refreshUniverse();
  console.log(`[bridge] listening on ws://localhost:${PORT}`);
  setInterval(refreshUniverse, REFRESH_MS);
});

process.on("SIGINT", async () => { await prisma.$disconnect(); process.exit(0); });
