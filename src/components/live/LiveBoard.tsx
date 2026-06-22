"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { PlayerCard } from "./PlayerCard";
import type { LiveDraftState, RecommendedPlayer, Position } from "@/types";

const BRIDGE_HTTP = "http://localhost:4001";
const BRIDGE_WS = "ws://localhost:4001";

const POSITIONS: Position[] = ["QB", "RB", "WR", "TE", "FLEX", "DST", "K"];

const POS_COLORS: Record<Position, string> = {
  QB: "#f87171", RB: "#4ade80", WR: "#60a5fa",
  TE: "#fbbf24", FLEX: "#c084fc", K: "#94a3b8", DST: "#2dd4bf",
};

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
      } catch { /* ignore */ }
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
      list = list.filter((p) =>
        p.name.toLowerCase().includes(q) || p.team.toLowerCase().includes(q)
      );
    }
    return list;
  }, [recommended, posFilter, search]);

  const showPositionalValue = recommended.some((p) => p.positionalValue !== null);

  const sendReset = () => {
    wsRef.current?.send(JSON.stringify({ type: "reset_session" }));
  };

  return (
    <div className="flex flex-col h-full" style={{ background: "var(--background)" }}>

      {/* ── Status bar ── */}
      <div
        className="shrink-0 px-4 py-2.5"
        style={{ borderBottom: "1px solid var(--border)", background: "var(--surface)" }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className="h-2 w-2 rounded-full"
              style={{
                background:
                  status === "connected" ? "#4ade80" :
                  status === "connecting" ? "#fbbf24" : "#f87171",
                boxShadow:
                  status === "connected" ? "0 0 6px #4ade8088" : "none",
              }}
            />
            <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
              {status === "connected" ? "Bridge connected" :
               status === "connecting" ? "Connecting…" : "Bridge offline"}
            </span>
          </div>

          {state && state.picks.length > 0 && (
            <button
              onClick={sendReset}
              className="text-xs transition-colors"
              style={{ color: "var(--text-muted)" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#f87171")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
            >
              Reset
            </button>
          )}
        </div>

        {status === "disconnected" && (
          <p className="text-xs mt-1" style={{ color: "#fbbf24" }}>
            Run <code className="font-mono">npm run bridge</code> in the project folder.
          </p>
        )}

        {state?.contestName && (
          <p className="text-sm font-semibold mt-1 truncate" style={{ color: "var(--text-primary)" }}>
            {state.contestName}
          </p>
        )}

        {state?.isOnTheClock && (
          <div
            className="mt-2 rounded-lg px-3 py-1.5 text-center text-sm font-bold tracking-wide"
            style={{ background: "#4ade8022", color: "#4ade80", border: "1px solid #4ade8044" }}
          >
            🕐 ON THE CLOCK
          </div>
        )}
      </div>

      {/* ── Search + position filter ── */}
      <div
        className="shrink-0 px-4 py-3 space-y-2.5"
        style={{ borderBottom: "1px solid var(--border)", background: "var(--surface)" }}
      >
        <input
          type="text"
          placeholder="Search players or teams…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg px-3 py-2 text-sm outline-none transition-colors"
          style={{
            background: "var(--surface-raised)",
            border: "1px solid var(--border)",
            color: "var(--text-primary)",
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = "#4ade8066")}
          onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
        />

        <div className="flex gap-1.5 overflow-x-auto pb-0.5">
          <button
            onClick={() => setPosFilter("ALL")}
            className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
            style={
              posFilter === "ALL"
                ? { background: "#4ade80", color: "#0a0f0a" }
                : { background: "var(--surface-raised)", border: "1px solid var(--border)", color: "var(--text-secondary)" }
            }
          >
            ALL
          </button>
          {POSITIONS.map((pos) => (
            <button
              key={pos}
              onClick={() => setPosFilter(pos)}
              className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
              style={
                posFilter === pos
                  ? { background: POS_COLORS[pos], color: "#0a0f0a" }
                  : { background: "var(--surface-raised)", border: "1px solid var(--border)", color: "var(--text-secondary)" }
              }
            >
              {pos}
            </button>
          ))}
        </div>
      </div>

      {/* ── Player list ── */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5">
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-center px-6">
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              {status !== "connected"
                ? "Waiting for bridge connection…"
                : recommended.length === 0
                ? "No draft data yet. Import your rankings CSV and open a DK draft room."
                : "No players match your filters."}
            </p>
          </div>
        ) : (
          filtered.map((p) => (
            <PlayerCard
              key={`${p.name}-${p.team}`}
              player={p}
              showPositionalValue={showPositionalValue}
            />
          ))
        )}
      </div>

      {/* ── Footer ── */}
      <div
        className="shrink-0 px-4 py-2 text-center"
        style={{ borderTop: "1px solid var(--border)" }}
      >
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          {filtered.length} available · sorted by ADP
        </span>
      </div>
    </div>
  );
}
