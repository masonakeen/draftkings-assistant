"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { PlayerCard } from "./PlayerCard";
import type { LiveDraftState, RecommendedPlayer, Position } from "@/types";

const BRIDGE_HTTP = "http://localhost:4001";
const BRIDGE_WS = "ws://localhost:4001";

const POSITIONS: Position[] = ["QB", "RB", "WR", "TE", "FLEX", "DST", "K"];
const POS_COLORS: Record<Position, string> = { QB: "#ef4444", RB: "#22c55e", WR: "#3b82f6", TE: "#f59e0b", FLEX: "#a855f7", K: "#6b7280", DST: "#14b8a6" };

type ConnectionStatus = "connecting" | "connected" | "disconnected";

export function LiveBoard() {
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [state, setState] = useState<LiveDraftState | null>(null);
  const [recommended, setRecommended] = useState<RecommendedPlayer[]>([]);
  const [posFilter, setPosFilter] = useState<Position | "ALL">("ALL");
  const [search, setSearch] = useState("");

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    setStatus((s) => (s === "connected" ? s : "connecting"));
    const ws = new WebSocket(BRIDGE_WS);
    wsRef.current = ws;

    ws.onopen = () => setStatus("connected");

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "state_update") {
          setState(msg.state);
          setRecommended(msg.recommended);
        }
      } catch {
        /* ignore malformed payloads */
      }
    };

    ws.onclose = () => {
      setStatus("disconnected");
      reconnectTimer.current = setTimeout(connect, 2000);
    };

    ws.onerror = () => ws.close();
  }, []);

  useEffect(() => {
    fetch(`${BRIDGE_HTTP}/state`)
      .then((r) => r.json())
      .then((msg) => {
        if (msg.type === "state_update") {
          setState(msg.state);
          setRecommended(msg.recommended);
        }
      })
      .catch(() => {});

    connect();

    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const filtered = useMemo(() => {
    let list = recommended;
    if (posFilter !== "ALL") list = list.filter((p) => p.position === posFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q) || p.team.toLowerCase().includes(q));
    }
    return list;
  }, [recommended, posFilter, search]);

  const showPositionalValue = recommended.some((p) => p.positionalValue !== null);

  const sendReset = () => {
    wsRef.current?.send(JSON.stringify({ type: "reset_session" }));
  };

  return (
    <div className="flex flex-col h-full">
      <div className="shrink-0 px-3 py-2 border-b border-[#1e1e2e] bg-[#0d0d18]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                status === "connected" ? "bg-[#53d08a] animate-pulse" : status === "connecting" ? "bg-amber-400" : "bg-red-500"
              }`}
            />
            <span className="text-[10px] text-[#888]">
              {status === "connected" ? "Bridge connected" : status === "connecting" ? "Connecting…" : "Bridge offline"}
            </span>
          </div>
          {state && state.picks.length > 0 && (
            <button onClick={sendReset} className="text-[10px] text-[#555] hover:text-red-400 transition-colors">
              Reset session
            </button>
          )}
        </div>

        {status === "disconnected" && (
          <p className="text-[10px] text-amber-400 mt-1">
            Run <code className="text-[#888]">npm run bridge</code> in the project folder.
          </p>
        )}

        {state && (
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-xs font-medium text-white truncate">
              {state.contestName ?? "No draft detected yet"}
            </span>
            {state.isOnTheClock && (
              <span className="text-[10px] font-bold text-[#0a0a14] bg-[#53d08a] px-1.5 py-0.5 rounded">
                ON THE CLOCK
              </span>
            )}
          </div>
        )}
      </div>

      <div className="shrink-0 px-3 py-2 border-b border-[#1e1e2e] space-y-2">
        <input
          type="text"
          placeholder="Search…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-md bg-[#12121c] border border-[#1e1e2e] px-2.5 py-1.5 text-xs text-white placeholder:text-[#555] focus:outline-none focus:border-[#53d08a]/50"
        />
        <div className="flex gap-1 overflow-x-auto pb-0.5">
          <button
            onClick={() => setPosFilter("ALL")}
            className={`shrink-0 px-2 py-1 rounded text-[10px] font-bold transition-colors ${
              posFilter === "ALL" ? "bg-[#53d08a] text-black" : "bg-[#12121c] border border-[#1e1e2e] text-[#888]"
            }`}
          >
            ALL
          </button>
          {POSITIONS.map((pos) => (
            <button
              key={pos}
              onClick={() => setPosFilter(pos)}
              className={`shrink-0 px-2 py-1 rounded text-[10px] font-bold transition-colors ${
                posFilter === pos ? "text-black" : "bg-[#12121c] border border-[#1e1e2e] text-[#888]"
              }`}
              style={posFilter === pos ? { background: POS_COLORS[pos] } : {}}
            >
              {pos}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-center px-4">
            <p className="text-xs text-[#555]">
              {status !== "connected"
                ? "Waiting for bridge connection…"
                : recommended.length === 0
                ? "No live draft detected. Open the DK best ball draft board in your browser."
                : "No players match your filters."}
            </p>
          </div>
        ) : (
          filtered.map((p) => <PlayerCard key={`${p.name}-${p.team}`} player={p} showPositionalValue={showPositionalValue} />)
        )}
      </div>

      <div className="shrink-0 px-3 py-1.5 border-t border-[#1e1e2e] text-center">
        <span className="text-[10px] text-[#555]">{filtered.length} available · sorted by ADP</span>
      </div>
    </div>
  );
}
