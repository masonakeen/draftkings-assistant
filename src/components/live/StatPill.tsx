"use client";

interface StatPillProps {
  label: string;
  value: string;
  colorHex?: string;
  title?: string;
  emphasis?: boolean;
}

export function StatPill({ label, value, colorHex, title, emphasis }: StatPillProps) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] leading-none whitespace-nowrap ${
        emphasis ? "font-bold" : "font-medium"
      }`}
      style={{
        color: colorHex ?? "#888",
        background: colorHex ? `${colorHex}1a` : "#1e1e2e",
      }}
    >
      <span className="opacity-60">{label}</span>
      <span>{value}</span>
    </span>
  );
}
