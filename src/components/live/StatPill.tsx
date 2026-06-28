"use client";

interface StatPillProps {
  label: string;
  value: string;
  colorHex?: string;
  title?: string;
  emphasis?: boolean;
}

/** Compact vertical pill — label above, value below. Used in the right column of PlayerCard. */
export function StatPill({ label, value, colorHex, title, emphasis }: StatPillProps) {
  const color = colorHex ?? "#9099b0";
  return (
    <div
      title={title}
      className="flex flex-col items-center justify-center rounded-md px-2 py-1.5 w-full"
      style={{ background: `${color}14`, border: `1px solid ${color}28` }}
    >
      <span className="text-[9px] font-semibold uppercase tracking-wider leading-none mb-0.5" style={{ color: "#6b7280" }}>
        {label}
      </span>
      <span
        className={`text-xs leading-none tabular-nums ${emphasis ? "font-bold" : "font-semibold"}`}
        style={{ color }}
      >
        {value}
      </span>
    </div>
  );
}
