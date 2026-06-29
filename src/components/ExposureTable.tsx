"use client";

import { useState, useMemo } from "react";
import {
  useReactTable, getCoreRowModel, getSortedRowModel, getFilteredRowModel,
  flexRender, createColumnHelper, type SortingState,
} from "@tanstack/react-table";
import type { PlayerExposure, Position } from "@/types";

const columnHelper = createColumnHelper<PlayerExposure>();

const POSITION_COLORS: Record<Position, string> = {
  QB: "#f87171", RB: "#4ade80", WR: "#60a5fa",
  TE: "#fbbf24", FLEX: "#c084fc", K: "#94a3b8", DST: "#2dd4bf",
};
const POSITIONS: Position[] = ["QB", "RB", "WR", "TE", "FLEX", "DST", "K"];

function PlayerAvatar({ imageUrl, name }: { imageUrl: string | null; name: string }) {
  const [failed, setFailed] = useState(false);
  const initials = name.split(" ").map(p => p[0]).slice(0, 2).join("").toUpperCase();

  if (!imageUrl || failed) {
    return (
      <div
        className="h-8 w-8 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
        style={{ background: "#1e2330", color: "#6b7280", border: "1px solid #2c3040" }}
      >
        {initials}
      </div>
    );
  }

  return (
    <img
      src={imageUrl}
      alt={name}
      className="h-8 w-8 rounded-full object-cover shrink-0"
      style={{ border: "1px solid #2c3040" }}
      onError={() => setFailed(true)}
    />
  );
}

function ClvCell({ clv }: { clv: number | null }) {
  if (clv === null) return <span style={{ color: "#555e72" }}>—</span>;

  // Negative = value (drafted before ADP = good) → GREEN, show as positive
  // Positive = overpay (drafted after ADP = bad) → RED
  const isValue = clv < 0;
  const display = isValue ? `+${Math.abs(clv).toFixed(1)}%` : `-${Math.abs(clv).toFixed(1)}%`;
  const color = isValue ? "#4ade80" : "#f87171";

  return (
    <span className="tabular-nums font-semibold text-xs" style={{ color }}>
      {display}
    </span>
  );
}

export function ExposureTable({ data, totalDrafts }: { data: PlayerExposure[]; totalDrafts: number }) {
  const [sorting, setSorting] = useState<SortingState>([{ id: "exposure", desc: true }]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [posFilter, setPosFilter] = useState<Position | "ALL">("ALL");

  const filtered = useMemo(
    () => posFilter === "ALL" ? data : data.filter(d => d.position === posFilter),
    [data, posFilter]
  );

  const columns = useMemo(() => [
    // Avatar + name combined column
    columnHelper.accessor("name", {
      header: "Player",
      cell: (i) => (
        <div className="flex items-center gap-2.5">
          <PlayerAvatar imageUrl={i.row.original.imageUrl} name={i.getValue()} />
          <span className="font-semibold text-sm" style={{ color: "#ffffff" }}>{i.getValue()}</span>
        </div>
      ),
    }),
    columnHelper.accessor("team", {
      header: "Team",
      cell: (i) => <span className="text-xs font-medium uppercase" style={{ color: "#9099b0" }}>{i.getValue()}</span>,
    }),
    columnHelper.accessor("position", {
      header: "Pos",
      cell: (i) => {
        const pos = i.getValue();
        return (
          <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ color: POSITION_COLORS[pos], background: `${POSITION_COLORS[pos]}20` }}>
            {pos}
          </span>
        );
      },
    }),
    columnHelper.accessor("exposure", {
      header: "Exposure",
      cell: (i) => {
        const val = i.getValue();
        return (
          <div className="flex items-center gap-2 min-w-[110px]">
            <div className="flex-1 h-1.5 rounded-full" style={{ background: "#1e2330" }}>
              <div className="h-1.5 rounded-full" style={{ width: `${Math.min(val, 100)}%`, background: "#4ade80" }} />
            </div>
            <span className="text-sm tabular-nums font-semibold w-11 text-right" style={{ color: "#4ade80" }}>
              {val.toFixed(1)}%
            </span>
          </div>
        );
      },
      sortDescFirst: true,
    }),
    columnHelper.accessor("draftCount", {
      header: "Drafts",
      cell: (i) => <span className="tabular-nums text-sm" style={{ color: "#9099b0" }}>{i.getValue()}</span>,
    }),
    columnHelper.accessor("avgPickWhenDrafted", {
      header: "Avg Pick",
      cell: (i) => <span className="tabular-nums text-sm" style={{ color: "#9099b0" }}>{i.getValue().toFixed(1)}</span>,
    }),
    columnHelper.accessor("currentDkAdp", {
      header: "DK ADP",
      cell: (i) => {
        const v = i.getValue();
        return <span className="tabular-nums text-sm font-medium" style={{ color: "#ffffff" }}>{v != null ? v.toFixed(1) : "—"}</span>;
      },
    }),
    columnHelper.accessor("clv", {
      header: "CLV",
      cell: (i) => <ClvCell clv={i.getValue()} />,
      sortDescFirst: false, // negative CLV (value) should sort first
    }),
  ], []);

  const table = useReactTable({
    data: filtered, columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Search players…"
          value={globalFilter}
          onChange={e => setGlobalFilter(e.target.value)}
          className="flex-1 min-w-[180px] rounded-lg px-3 py-2 text-sm outline-none"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            color: "var(--text-primary)",
          }}
        />
        <div className="flex gap-1 flex-wrap">
          <button
            onClick={() => setPosFilter("ALL")}
            className="px-3 py-1.5 rounded-lg text-xs font-medium"
            style={posFilter === "ALL"
              ? { background: "#4ade80", color: "#0a0f0a" }
              : { background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-muted)" }}
          >
            All
          </button>
          {POSITIONS.map(pos => (
            <button
              key={pos}
              onClick={() => setPosFilter(pos)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium"
              style={posFilter === pos
                ? { background: POSITION_COLORS[pos], color: "#0a0f0a" }
                : { background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-muted)" }}
            >
              {pos}
            </button>
          ))}
        </div>
        <span className="text-xs ml-auto" style={{ color: "var(--text-muted)" }}>
          {table.getRowModel().rows.length} players · {totalDrafts} drafts
        </span>
      </div>

      {/* CLV legend */}
      <div className="flex gap-4 text-xs" style={{ color: "var(--text-muted)" }}>
        <span>CLV = (Avg Pick − DK ADP) / DK ADP</span>
        <span style={{ color: "#4ade80" }}>+% = value (drafted late vs ADP)</span>
        <span style={{ color: "#f87171" }}>−% = overpaid (drafted early vs ADP)</span>
      </div>

      {/* Table */}
      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              {table.getHeaderGroups().map(hg => (
                <tr key={hg.id} style={{ borderBottom: "1px solid var(--border)", background: "var(--surface-raised)" }}>
                  {hg.headers.map(header => (
                    <th
                      key={header.id}
                      onClick={header.column.getToggleSortingHandler()}
                      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider select-none cursor-pointer whitespace-nowrap"
                      style={{ color: "var(--text-muted)" }}
                    >
                      <div className="flex items-center gap-1">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getIsSorted() === "asc" && " ↑"}
                        {header.column.getIsSorted() === "desc" && " ↓"}
                      </div>
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="px-4 py-12 text-center text-sm" style={{ color: "var(--text-muted)" }}>
                    No players found. Import your draft history and sync to get started.
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row, i) => (
                  <tr
                    key={row.id}
                    className="transition-colors"
                    style={{
                      borderBottom: "1px solid var(--border-subtle)",
                      background: i % 2 === 0 ? "var(--surface)" : "var(--surface-raised)",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#21252e")}
                    onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? "var(--surface)" : "var(--surface-raised)")}
                  >
                    {row.getVisibleCells().map(cell => (
                      <td key={cell.id} className="px-4 py-2.5">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
