"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Navbar } from "@/app/components/navbar";
import { UploadZone } from "@/app/components/upload-zone";
import { SettingsPanel } from "@/app/components/settings-panel";
import { requestAudit, saveAuditResult } from "@/app/lib/audit";
import { readPreferences, DEFAULT_PREFERENCES } from "@/app/lib/preferences";

// ProofTrade CSV sample, offered as a download so the template is usable.
const SAMPLE_CSV = `trade_id,timestamp,symbol,side,quantity,price,pnl,fees,slippage,strategy_name,notes
t001,2023-01-01T10:00:00Z,AAPL,buy,100,150.00,50.00,1.00,0.00,stratA,clean buy trade
t002,2023-01-01T10:05:00Z,AAPL,sell,100,152.10,62.10,1.00,0.00,stratA,clean sell trade
t003,2023-01-01T10:10:00Z,MSFT,buy,50,300.00,25.00,0.50,0.00,stratA,clean buy trade
t004,2023-01-01T10:15:00Z,MSFT,sell,50,301.20,12.20,0.50,0.00,stratA,clean sell trade
t005,2023-01-01T10:20:00Z,AAPL,buy,100,151.00,-50.00,1.00,0.00,stratA,pnl sign inconsistency
t006,2023-01-01T10:30:00Z,GOOGL,buy,10,2800.00,250.00,0.01,0.00,stratA,unrealistic fees
t007,2023-01-01T10:35:00Z,AAPL,buy,100,150.00,150.00,0.00,0.00,stratA,look-ahead candidate
`;

export default function AuditPage() {
  const router = useRouter();

  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [assumeUtc, setAssumeUtc] = useState(DEFAULT_PREFERENCES.assumeUtc);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pre-fill from the persisted preference (read on the client only).
  useEffect(() => {
    setAssumeUtc(readPreferences().assumeUtc);
  }, []);

  const handleFileChange = useCallback((file: File | null) => {
    setCsvFile(file);
    setError(null);
  }, []);

  // UploadZone expects onError: (error: { detail: string } | null) => void
  const handleError = useCallback((e: { detail: string } | null) => {
    setError(e?.detail ?? null);
  }, []);

  const handleSubmit = async () => {
    if (!csvFile || isPending) return;
    setError(null);
    setIsPending(true);

    try {
      const result = await requestAudit(csvFile, { assumeUtc });
      // The results workspace reads this; see app/lib/audit.ts.
      saveAuditResult(result);
      router.push("/audit/results");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Audit failed.");
    } finally {
      setIsPending(false);
    }
  };

  const downloadSample = () => {
    const blob = new Blob([SAMPLE_CSV], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "prooftrade-sample.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[var(--color-bg-primary)]">
      <Navbar />

      <main className="relative z-10 mx-auto w-full max-w-5xl px-6 py-10 sm:py-12">
        <div className="mb-8 flex flex-col gap-4 sm:mb-10 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-[var(--color-text-primary)]">
              New audit
            </h1>
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
              Upload a trade-history CSV to run the deterministic audit engine.
            </p>
          </div>
          <Link
            href="/audit/results"
            className="inline-flex shrink-0 items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4 py-2 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)]"
          >
            View last results
          </Link>
        </div>

        <div className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-5">
            <div className="lg:col-span-3">
              <UploadZone
                csvFile={csvFile}
                onError={handleError}
                onFileChange={handleFileChange}
                onSubmit={handleSubmit}
                isPending={isPending}
              />
            </div>
            <div className="lg:col-span-2">
              <SettingsPanel assumeUtc={assumeUtc} onChange={setAssumeUtc} />
            </div>
          </div>

          <div className="flex flex-col gap-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-[var(--color-border)] bg-[var(--color-bg-tertiary)]">
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4 text-[var(--color-accent-blue)]"
                  aria-hidden="true"
                >
                  <path
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-[var(--color-text-primary)]">
                  Required CSV format
                </p>
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                  trade_id, timestamp, symbol, side, quantity, price, pnl.
                  Optional: fees, slippage, strategy_name, notes (missing costs
                  count as zero).
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={downloadSample}
              className="shrink-0 self-start rounded-md border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)] sm:self-auto"
            >
              Download sample
            </button>
          </div>

          {error && (
            <div
              role="alert"
              className="flex items-start gap-3 rounded-lg border border-red-500/20 bg-red-500/5 p-4"
            >
              <svg
                viewBox="0 0 24 24"
                className="mt-0.5 h-5 w-5 shrink-0 text-red-400"
                aria-hidden="true"
              >
                <path
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                />
              </svg>
              <div>
                <p className="text-sm font-medium text-red-400">Audit not run</p>
                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{error}</p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
