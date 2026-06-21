"use client";

import { useCallback, useState } from "react";

interface ImportResult {
  imported?: number;
  upserted?: number;
  skipped?: number;
  total: number;
  parseErrors: string[];
}

interface ImportDropzoneProps {
  endpoint: string;
  label: string;
  hint?: string;
  accept?: string; // defaults to .csv
  onImportComplete: () => void;
}

export function ImportDropzone({ endpoint, label, hint, accept = ".csv", onImportComplete }: ImportDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const acceptedExtensions = accept.split(",").map((e) => e.trim().toLowerCase());

  const handleFile = useCallback(
    async (file: File) => {
      const matches = acceptedExtensions.some((ext) => file.name.toLowerCase().endsWith(ext));
      if (!matches) {
        setError(`Please upload a ${accept} file`);
        return;
      }
      setIsLoading(true);
      setError(null);
      setResult(null);

      const formData = new FormData();
      formData.append("file", file);

      try {
        const res = await fetch(endpoint, { method: "POST", body: formData });
        const json = await res.json();
        if (!res.ok) {
          setError(json.error ?? "Import failed");
          return;
        }
        setResult(json);
        onImportComplete();
      } catch {
        setError("Network error — is the dev server running?");
      } finally {
        setIsLoading(false);
      }
    },
    [endpoint, onImportComplete]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const onFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
      e.target.value = "";
    },
    [handleFile]
  );

  return (
    <div className="w-full">
      <label
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        className={`relative flex flex-col items-center justify-center w-full h-28 rounded-xl border-2 border-dashed cursor-pointer transition-all ${
          isDragging
            ? "border-[#53d08a] bg-[#53d08a]/10 scale-[1.01]"
            : "border-[#2a2a3a] bg-[#12121c] hover:border-[#53d08a]/50 hover:bg-[#1a1a28]"
        }`}
      >
        <input type="file" accept={accept} className="absolute inset-0 opacity-0 cursor-pointer" onChange={onFileInput} />
        {isLoading ? (
          <div className="flex flex-col items-center gap-2">
            <div className="h-6 w-6 rounded-full border-2 border-[#53d08a] border-t-transparent animate-spin" />
            <span className="text-xs text-[#888]">Importing…</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1 pointer-events-none text-center px-3">
            <p className="text-sm font-medium text-[#ccc]">{label}</p>
            {hint && <p className="text-xs text-[#555]">{hint}</p>}
          </div>
        )}
      </label>

      {error && (
        <div className="mt-2 rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2">
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}

      {result && (
        <div className="mt-2 rounded-lg bg-[#53d08a]/10 border border-[#53d08a]/30 px-3 py-2 space-y-1">
          <p className="text-xs font-semibold text-[#53d08a]">
            ✓ {result.imported ?? result.upserted ?? 0} of {result.total} rows loaded
          </p>
          {result.parseErrors.length > 0 && (
            <details>
              <summary className="text-xs text-yellow-400 cursor-pointer">
                {result.parseErrors.length} warning{result.parseErrors.length !== 1 ? "s" : ""}
              </summary>
              <ul className="mt-1 text-xs text-[#888] space-y-0.5 max-h-24 overflow-y-auto">
                {result.parseErrors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
