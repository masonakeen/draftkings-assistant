"use client";

interface StatPillProps {
  label: string;
  value: string;
  colorHex?: string;
  title?: string;
  emphasis?: boolean;
}

/**
 * Stat block — label on top, value below. Sized for easy reading at a glance.
 */
export function StatPill({ label, value, colorHex, title, emphasis }: StatPillProps) {
  const color = colorHex ?? "#9099b0";
  return (
    <div
      title={title}
      className="flex flex-col items-center justify-center rounded-lg px-3 py-2 min-w-[56px]"
      style={{ background: `${color}18`, border: `1px solid ${color}30` }}
    >
      <span className="text-[10px] font-medium uppercase tracking-wide leading-none mb-1" style={{ color: "#9099b0" }}>
        {label}
      </span>
      <span
        className={`text-sm leading-none tabular-nums ${emphasis ? "font-bold" : "font-semibold"}`}
        style={{ color }}
      >
        {value}
      </span>
    </div>
  );
}
