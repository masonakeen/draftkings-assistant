"use client";

import { useState } from "react";

interface SyncResult {
  imported: number;
  skipped: number;
  total: number;
  parseErrors: string[];
}

export function SyncDraftHistoryButton({ onSynced }: { onSynced: () => void }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sync = async () => {
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const res = await fetch("/api/draft-history", { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Sync failed");
        return;
      }
      setResult(json);
      onSynced();
    } catch {
      setError("Network error — is the dev server running?");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button
        onClick={sync}
        disabled={loading}
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
        style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
      >
        {loading ? (
          <span className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
        ) : (
          <span>↻</span>
        )}
        Sync draft_history.json
      </button>

      {error && (
        <p className="mt-2 text-xs text-red-400">{error}</p>
      )}

      {result && (
        <div className="mt-2 text-xs" style={{ color: "var(--text-secondary)" }}>
          ✓ {result.imported} new draft{result.imported !== 1 ? "s" : ""} imported
          {result.skipped > 0 && `, ${result.skipped} already existed`}
          {result.parseErrors.length > 0 && (
            <details className="mt-1">
              <summary className="cursor-pointer text-yellow-400">{result.parseErrors.length} warning{result.parseErrors.length !== 1 ? "s" : ""}</summary>
              <ul className="mt-1 space-y-0.5 pl-2">
                {result.parseErrors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
