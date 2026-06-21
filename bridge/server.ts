/**
 * Standalone bridge process — run alongside `npm run dev` via `npm run
 * bridge` (or `npm run dev:all` for both together).
 *
 * Protocol from the extension is intentionally simple: it sends a full
 * re-scan of the draft board grid ("board_snapshot") whenever something
 * changes. The grid tops out around 240 cells, so resending everything each
 * time is cheap and far more robust than trying to incrementally diff a
 * React-virtualized DOM.
 */
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
import type {
  LiveDraftPick,
  NormalizedDraft,
  NormalizedPlayer,
  Position,
  RecommendedPlayer,
} from "../src/types";

const PORT = Number(process.env.BRIDGE_WS_PORT ?? 4001);
const POSITIONAL_VALUE_ENABLED = process.env.POSITIONAL_VALUE_ENABLED === "true";
const MASTER_PLAYER_REFRESH_MS = 60_000;

const prisma = new PrismaClient();

const VALID_POSITIONS: Position[] = ["QB", "RB", "WR", "TE", "FLEX", "K", "DST"];
function normalizePosition(raw: string): Position {
  const upper = (raw ?? "").toUpperCase().trim();
  if (VALID_POSITIONS.includes(upper as Position)) return upper as Position;
  if (upper === "DEF" || upper === "D/ST") return "DST";
  return "FLEX";
}

// ─── Cached master player list + name index ───────────────────────────────────
// Rebuilt periodically rather than per-snapshot — name resolution doesn't
// need to be real-time-fresh, and this avoids hammering SQLite during a fast
// run of picks.

let masterPlayers: MasterPlayerLite[] = [];
let nameIndex: PlayerNameIndex = buildPlayerNameIndex([]);
let masterPlayerRaw: Awaited<ReturnType<typeof prisma.masterPlayer.findMany>> = [];

async function refreshMasterPlayers() {
  masterPlayerRaw = await prisma.masterPlayer.findMany();
  masterPlayers = masterPlayerRaw.map((m: { name: string; team: string; position: string }) => ({ name: m.name, team: m.team, position: m.position }));
  nameIndex = buildPlayerNameIndex(masterPlayers);
}

// ─── Recommendation engine ────────────────────────────────────────────────────

async function computeRecommendedPlayers(): Promise<RecommendedPlayer[]> {
  const draftedNames = draftSession.getDraftedPlayerNames();
  const myRosterNames = draftSession.getMyRosterNames();

  const [dbDrafts, teamProjections, positionalValues] = await Promise.all([
    prisma.draft.findMany({ include: { players: true } }),
    prisma.teamWeekProjection.findMany(),
    prisma.positionalValue.findMany(),
  ]);

  const normalizedDrafts: NormalizedDraft[] = dbDrafts.map((d: any) => ({
    id: d.id,
    contestName: d.contestName,
    entryFee: d.entryFee,
    draftedAt: d.draftedAt,
    startingPick: d.startingPick,
    totalTeams: d.totalTeams,
    players: d.players.map(
      (p: any): NormalizedPlayer => ({
        id: p.id,
        name: p.name,
        team: p.team,
        position: p.position as Position,
        draftedPick: p.draftedPick,
        draftedRound: p.draftedRound,
        adpAtDraft: p.adpAtDraft,
        currentAdp: p.currentAdp,
        draftId: p.draftId,
      })
    ),
  }));

  const totalDrafts = normalizedDrafts.length;
  const coIndex = buildCoOccurrenceIndex(normalizedDrafts);

  const exposureByName = new Map<string, number>();
  if (totalDrafts > 0) {
    const counts = new Map<string, number>();
    for (const d of normalizedDrafts) {
      for (const p of d.players) {
        const key = p.name.toLowerCase();
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
    for (const [key, count] of counts) {
      exposureByName.set(key, Math.round((count / totalDrafts) * 1000) / 10);
    }
  }

  const teamProjByTeam = new Map(teamProjections.map((t: any) => [t.team, t]));
  const posValueByName = positionalValues.map((v: any) => ({
    playerName: v.playerName,
    position: v.position as Position,
    value: v.value,
  }));

  const myRosterSlots: RosterSlot[] = draftSession.getState().myRoster.map((p) => ({
    name: p.playerName,
    team: p.team,
    position: p.position,
    byeWeek: masterPlayerRaw.find((m: any) => m.name === p.playerName)?.bye ?? null,
  }));

  const recommended: RecommendedPlayer[] = [];

  for (const mp of masterPlayerRaw) {
    const nameLower = mp.name.toLowerCase();
    if (draftedNames.has(nameLower)) continue;

    const team = teamProjByTeam.get(mp.team);
    const playoffOUs = [team?.week15OU, team?.week16OU, team?.week17OU].filter(
      (v): v is number => v !== null && v !== undefined
    );
    const playoffTotalOU = playoffOUs.length > 0
      ? Math.round((playoffOUs.reduce((s, v) => s + v, 0) / playoffOUs.length) * 10) / 10
      : null;

    const teamTotals = [team?.week15TeamTotal, team?.week16TeamTotal, team?.week17TeamTotal].filter(
      (v): v is number => v !== null && v !== undefined
    );
    const impliedTeamTotal = teamTotals.length > 0
      ? Math.round((teamTotals.reduce((s, v) => s + v, 0) / teamTotals.length) * 10) / 10
      : null;

    const position = normalizePosition(mp.position);
    const { conflict } = checkByeWeekConflict(
      { team: mp.team, position, byeWeek: mp.bye },
      myRosterSlots
    );

    recommended.push({
      name: mp.name,
      team: mp.team,
      position,
      adp: mp.draftkingsAdp,
      adpTrend: null, // needs ADP history over time — future upgrade once live pool panel is wired up
      playoffTotalOU,
      week17OU: team?.week17OU ?? null,
      impliedTeamTotal,
      personalExposure: exposureByName.get(nameLower) ?? null,
      correlationFlag: checkCorrelationFlag(coIndex, mp.name, myRosterNames),
      positionalValue: getPositionalValue(posValueByName, mp.name, POSITIONAL_VALUE_ENABLED),
      byeWeek: mp.bye,
      byeConflict: conflict,
      underdogAdp: mp.underdogAdp,
      adpDelta: mp.adpDelta,
    });
  }

  // Default sort: ADP ascending. Swap out later for a custom scoring function
  // without touching anything upstream.
  recommended.sort((a, b) => {
    if (a.adp === null) return 1;
    if (b.adp === null) return -1;
    return a.adp - b.adp;
  });

  return recommended;
}

// ─── Auto-save completed drafts into portfolio history ───────────────────────

async function saveCompletedDraftToHistory() {
  const state = draftSession.getState();
  if (state.picks.length === 0) return;

  const draftId = `live_${state.sessionId}`;
  const existing = await prisma.draft.findUnique({ where: { id: draftId } });
  if (existing) return;

  await prisma.draft.create({
    data: {
      id: draftId,
      contestName: state.contestName ?? "Live Draft",
      entryFee: 0,
      draftedAt: new Date(),
      startingPick: state.startingPick,
      totalTeams: state.totalTeams,
      source: "live",
      players: {
        create: state.picks
          .filter((p) => p.pickedByMe)
          .map((p) => ({
            id: uuidv4(),
            name: p.playerName,
            rawName: p.rawName,
            team: p.team,
            position: p.position,
            draftedPick: p.pickNumber,
            draftedRound: Math.ceil(p.pickNumber / state.totalTeams),
            adpAtDraft: null,
            currentAdp: null,
          })),
      },
    },
  });

  console.log(`[bridge] Auto-saved completed live draft ${draftId} to portfolio history`);
}

// ─── WebSocket hub ────────────────────────────────────────────────────────────

const server = http.createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }
  if (req.url === "/state") {
    res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
    res.end(lastPayload ?? JSON.stringify({ type: "state_update", state: draftSession.getState(), recommended: [] }));
    return;
  }
  res.writeHead(404);
  res.end();
});

const wss = new WebSocketServer({ server });
const clients = new Set<WebSocket>();
let lastPayload: string | null = null;

async function broadcastState() {
  const recommended = await computeRecommendedPlayers();
  const payload = JSON.stringify({
    type: "state_update",
    state: draftSession.getState(),
    recommended,
  });
  lastPayload = payload;
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) client.send(payload);
  }
}

interface IncomingPick {
  pickNumber: number;
  rawName: string;
  team: string;
  position: string;
  isMine: boolean;
}

function resolveIncomingPicks(picks: IncomingPick[]): LiveDraftPick[] {
  return picks.map((p) => {
    const team = normalizeTeamCode(p.team);
    const resolved = resolvePlayerName(nameIndex, p.rawName, team);
    return {
      playerName: resolved ?? p.rawName,
      rawName: p.rawName,
      team,
      position: normalizePosition(p.position),
      pickNumber: p.pickNumber,
      pickedByMe: p.isMine,
      pickedAt: new Date().toISOString(),
    };
  });
}

wss.on("connection", async (ws) => {
  clients.add(ws);
  console.log(`[bridge] client connected (${clients.size} total)`);

  ws.send(
    JSON.stringify({
      type: "state_update",
      state: draftSession.getState(),
      recommended: await computeRecommendedPlayers(),
    })
  );

  ws.on("message", async (raw) => {
    let msg: any;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    switch (msg.type) {
      case "board_snapshot": {
        const resolvedPicks = resolveIncomingPicks(msg.picks ?? []);
        draftSession.applySnapshot({
          contestName: msg.contestName ?? null,
          totalTeams: msg.totalTeams ?? 12,
          myUsername: msg.myUsername ?? null,
          rosterSize: msg.rosterSize,
          picks: resolvedPicks,
        });

        if (draftSession.isComplete()) {
          await saveCompletedDraftToHistory();
        }
        break;
      }

      case "on_the_clock": {
        draftSession.setOnTheClock(Boolean(msg.isOnTheClock));
        break;
      }

      case "reset_session": {
        draftSession.reset();
        break;
      }

      case "refresh_master_players": {
        await refreshMasterPlayers();
        break;
      }

      default:
        console.warn("[bridge] unknown message type:", msg.type);
        return;
    }

    await broadcastState();
  });

  ws.on("close", () => {
    clients.delete(ws);
    console.log(`[bridge] client disconnected (${clients.size} total)`);
  });
});

server.listen(PORT, async () => {
  await refreshMasterPlayers();
  console.log(`[bridge] listening on ws://localhost:${PORT}`);
  console.log(`[bridge] loaded ${masterPlayers.length} master players`);
  console.log(`[bridge] positional value feature flag: ${POSITIONAL_VALUE_ENABLED ? "ON" : "OFF"}`);

  setInterval(refreshMasterPlayers, MASTER_PLAYER_REFRESH_MS);
});

process.on("SIGINT", async () => {
  await prisma.$disconnect();
  process.exit(0);
});
