"use client";

import { useCallback, useRef } from "react";

interface UploadZoneProps {
  csvFile: File | null;
  onError: (error: { detail: string } | null) => void;
  onFileChange: (file: File | null) => void;
  onSubmit: () => void;
  isPending: boolean;
}

export function UploadZone({
  csvFile,
  onError,
  onFileChange,
  onSubmit,
  isPending,
}: UploadZoneProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0] ?? null;
      if (file) {
        onFileChange(file);
        onError(null);
      }
    },
    [onFileChange, onError],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file && (file.type === "text/csv" || file.name.endsWith(".csv"))) {
        onFileChange(file);
        onError(null);
      } else if (file) {
        onError({ detail: "Please drop a CSV file." });
      }
    },
    [onFileChange, onError],
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  }, []);

  const triggerFileInput = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return (
    <div className="flex flex-col gap-4">
      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onClick={triggerFileInput}
        className="group relative cursor-pointer rounded-lg border border-dashed border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-8 py-10 text-center transition-colors hover:border-[var(--color-border)]/80 hover:bg-[var(--color-bg-tertiary)]"
      >
        {csvFile ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] text-sm font-medium text-[var(--color-text-secondary)]">
                <svg
                  viewBox="0 0 24 24"
                  className="h-5 w-5"
                  aria-hidden="true"
                >
                  <path
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"
                  />
                  <path
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M14 2v6h6"
                  />
                  <path
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 15h6"
                  />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-[var(--color-text-primary)]">
                  {csvFile.name}
                </p>
                <p className="text-xs text-[var(--color-text-muted)]">
                  {(csvFile.size / 1024).toFixed(1)} KB
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                triggerFileInput();
              }}
              className="rounded-md px-3 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-primary)] hover:text-[var(--color-text-primary)]"
            >
              Change
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)]">
              <svg
                viewBox="0 0 24 24"
                className="h-6 w-6"
                aria-hidden="true"
              >
                <path
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-[var(--color-text-secondary)]">
                Drag your trade-history CSV here, or{" "}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    triggerFileInput();
                  }}
                  className="font-medium text-[var(--color-accent-blue)] hover:underline"
                >
                  select a file
                </button>
              </p>
              <p className="mt-1.5 text-xs text-[var(--color-text-muted)]">
                CSV files only. Max 10 MB, ~10,000 rows.
              </p>
            </div>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>


      {/* Submit */}
      <button
        type="button"
        onClick={onSubmit}
        disabled={!csvFile || isPending}
        className="w-full rounded-lg bg-[var(--color-accent-blue)] px-6 py-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[var(--color-accent-blue)]/90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? (
          <span className="inline-flex items-center gap-2">
            <svg
              className="h-4 w-4 animate-spin text-white"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            Analyzing...
          </span>
        ) : (
          `Analyze ${csvFile?.name ?? "your trades"}`
        )}
      </button>
      <p className="text-xs text-center text-[var(--color-text-muted)]">
        No data is stored. Analysis runs on the backend; your CSV is not persisted.
      </p>
    </div>
  );
}
