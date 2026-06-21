"use client";

import { useState, useMemo } from "react";
import {
  useReactTable, getCoreRowModel, getSortedRowModel, getFilteredRowModel,
  flexRender, createColumnHelper, type SortingState,
} from "@tanstack/react-table";
import type { PlayerExposure, Position } from "@/types";

const columnHelper = createColumnHelper<PlayerExposure>();

const POSITION_COLORS: Record<Position, string> = {
  QB: "#ef4444", RB: "#22c55e", WR: "#3b82f6", TE: "#f59e0b", FLEX: "#a855f7", K: "#6b7280", DST: "#14b8a6",
};
const POSITIONS: Position[] = ["QB", "RB", "WR", "TE", "FLEX", "DST", "K"];

export function ExposureTable({ data, totalDrafts }: { data: PlayerExposure[]; totalDrafts: number }) {
  const [sorting, setSorting] = useState<SortingState>([{ id: "exposure", desc: true }]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [posFilter, setPosFilter] = useState<Position | "ALL">("ALL");

  const filtered = useMemo(() => (posFilter === "ALL" ? data : data.filter((d) => d.position === posFilter)), [data, posFilter]);

  const columns = useMemo(() => [
    columnHelper.accessor("name", { header: "Player", cell: (i) => <span className="font-medium text-white">{i.getValue()}</span> }),
    columnHelper.accessor("team", { header: "Team", cell: (i) => <span className="text-[#888] uppercase text-xs tracking-wide">{i.getValue()}</span> }),
    columnHelper.accessor("position", {
      header: "Pos",
      cell: (i) => { const pos = i.getValue(); return <span className="inline-block px-2 py-0.5 rounded text-xs font-bold" style={{ color: POSITION_COLORS[pos], background: `${POSITION_COLORS[pos]}20` }}>{pos}</span>; },
    }),
    columnHelper.accessor("exposure", {
      header: "Exposure",
      cell: (i) => { const val = i.getValue(); return (
        <div className="flex items-center gap-2 min-w-[120px]">
          <div className="flex-1 h-1.5 rounded-full bg-[#1e1e2e]"><div className="h-1.5 rounded-full bg-[#53d08a]" style={{ width: `${Math.min(val, 100)}%` }} /></div>
          <span className="text-sm tabular-nums text-[#53d08a] font-medium w-12 text-right">{val.toFixed(1)}%</span>
        </div>
      ); },
      sortDescFirst: true,
    }),
    columnHelper.accessor("draftCount", { header: "Drafts", cell: (i) => <span className="tabular-nums text-[#888]">{i.getValue()}</span> }),
    columnHelper.accessor("avgPickWhenDrafted", { header: "Avg Pick", cell: (i) => <span className="tabular-nums text-[#888]">{i.getValue().toFixed(1)}</span> }),
    columnHelper.accessor("avgAdp", { header: "Avg ADP", cell: (i) => { const v = i.getValue(); return <span className="tabular-nums text-[#888]">{v !== null ? v.toFixed(1) : "—"}</span>; } }),
    columnHelper.accessor("clvAvg", {
      header: "Avg CLV",
      cell: (i) => { const v = i.getValue(); if (v === null) return <span className="text-[#555]">—</span>; return <span className={`tabular-nums font-medium ${v > 0 ? "text-[#53d08a]" : v < 0 ? "text-red-400" : "text-[#888]"}`}>{v > 0 ? "+" : ""}{v.toFixed(1)}</span>; },
    }),
  ], []);

  const table = useReactTable({
    data: filtered, columns, state: { sorting, globalFilter },
    onSortingChange: setSorting, onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel(), getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input type="text" placeholder="Search players…" value={globalFilter} onChange={(e) => setGlobalFilter(e.target.value)}
          className="flex-1 min-w-[180px] rounded-lg bg-[#12121c] border border-[#1e1e2e] px-3 py-2 text-sm text-white placeholder:text-[#555] focus:outline-none focus:border-[#53d08a]/50" />
        <div className="flex gap-1">
          <button onClick={() => setPosFilter("ALL")} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${posFilter === "ALL" ? "bg-[#53d08a] text-black" : "bg-[#12121c] border border-[#1e1e2e] text-[#888] hover:text-white"}`}>All</button>
          {POSITIONS.map((pos) => (
            <button key={pos} onClick={() => setPosFilter(pos)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${posFilter === pos ? "text-black" : "bg-[#12121c] border border-[#1e1e2e] text-[#888] hover:text-white"}`} style={posFilter === pos ? { background: POSITION_COLORS[pos] } : {}}>{pos}</button>
          ))}
        </div>
        <span className="text-xs text-[#555] ml-auto">{table.getRowModel().rows.length} players · {totalDrafts} drafts</span>
      </div>

      <div className="rounded-xl border border-[#1e1e2e] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id} className="border-b border-[#1e1e2e] bg-[#0d0d18]">
                  {hg.headers.map((header) => (
                    <th key={header.id} onClick={header.column.getToggleSortingHandler()} className="px-4 py-3 text-left text-xs uppercase tracking-wider text-[#555] font-medium select-none cursor-pointer hover:text-[#888] transition-colors whitespace-nowrap">
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
                <tr><td colSpan={columns.length} className="px-4 py-12 text-center text-[#555] text-sm">No players found. Import a CSV to get started.</td></tr>
              ) : (
                table.getRowModel().rows.map((row, i) => (
                  <tr key={row.id} className={`border-b border-[#1e1e2e]/50 transition-colors hover:bg-[#1a1a28] ${i % 2 === 0 ? "bg-[#12121c]" : "bg-[#0f0f1a]"}`}>
                    {row.getVisibleCells().map((cell) => <td key={cell.id} className="px-4 py-3">{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}
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
