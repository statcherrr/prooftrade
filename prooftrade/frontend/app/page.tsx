"use client";

import { useState, useCallback, useTransition } from "react";
import { Navbar } from "@/app/components/navbar";
import { UploadZone } from "@/app/components/upload-zone";
import { CSVFormat } from "@/app/components/csv-format";
import { SettingsPanel } from "@/app/components/settings-panel";
import { MetricsGrid } from "@/app/components/metrics-grid";
import { FindingsWorkspace, type Finding } from "@/app/components/findings-workspace";
import { Disclaimer } from "@/app/components/disclaimer";
import { ErrorBanner } from "@/app/components/error-banner";
import { LoadingState } from "@/app/components/loading-state";

// ── Types ──────────────────────────────────────────────────────────────────

interface Summary {
  total_trades: number;
  valid_trades: number;
  net_pnl: number;
  win_rate: number;
  profit_factor: string | number;
  sharpe_ratio: number | null;
  max_drawdown: number | null;
}

interface AuditResponse {
  dataset_id: string;
  row_count: number;
  findings: Finding[];
  summary: Summary;
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function Home() {
  const [phase, setPhase] = useState<"upload" | "results">("upload");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [assumeUtc, setAssumeUtc] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [auditResult, setAuditResult] = useState<AuditResponse | null>(null);
  const [error, setError] = useState<{ detail: string } | null>(null);

  const handleFileChange = useCallback((file: File | null) => {
    setCsvFile(file);
    setError(null);
  }, []);

  const handleReset = useCallback(() => {
    setPhase("upload");
    setCsvFile(null);
    setAuditResult(null);
    setError(null);
  }, []);

  const handleSubmit = useCallback(() => {
    if (!csvFile) return;

    startTransition(() => {
      const formData = new FormData();
      formData.append("file", csvFile);

      fetch("/api/audit", {
        method: "POST",
        body: formData,
      })
        .then((res) => {
          if (!res.ok) {
            return res.json().then((data) => {
              throw new Error(data.detail ?? `Upload failed with status ${res.status}`);
            });
          }
          return res.json();
        })
        .then((data: AuditResponse) => {
          setAuditResult(data);
          setPhase("results");
        })
        .catch((err) => {
          setError({ detail: err instanceof Error ? err.message : "An unexpected error occurred." });
        });
    });
  }, [csvFile]);

  const findingCounts = auditResult
    ? {
        high: auditResult.findings.filter((f) => f.severity === "high").length,
        medium: auditResult.findings.filter((f) => f.severity === "medium").length,
        low: auditResult.findings.filter((f) => f.severity === "low").length,
      }
    : { high: 0, medium: 0, low: 0 };

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)]">
      <Navbar />

      <main className="mx-auto max-w-5xl px-6 pb-16 pt-8">
        {phase === "upload" && (
          <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="mb-2">
              <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-text-primary)]">
                Audit your trade history
              </h1>
              <p className="mt-1.5 text-sm text-[var(--color-text-secondary)]">
                Upload a CSV of your trades and get a deterministic analysis of net P&L, win rate,
                profit factor, Sharpe ratio, maximum drawdown, and pattern-based risk findings.
              </p>
            </div>

            {/* CSV format */}
            <CSVFormat />

            {/* Upload + settings in a two-column layout */}
            <div className="grid gap-4 lg:grid-cols-5">
              {/* Upload zone spans most of the width */}
              <div className="lg:col-span-3">
                <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-5">
                  <h2 className="mb-4 text-sm font-semibold text-[var(--color-text-primary)]">
                    Upload trade history
                  </h2>
                  <UploadZone
                    csvFile={csvFile}
                    onError={setError}
                    onFileChange={handleFileChange}
                    onSubmit={handleSubmit}
                    isPending={isPending}
                  />
                </div>
              </div>

              {/* Settings panel */}
              <div className="lg:col-span-2">
                <SettingsPanel assumeUtc={assumeUtc} onChange={setAssumeUtc} />
              </div>
            </div>

            {/* Error */}
            {error && <ErrorBanner detail={error.detail} onDismiss={() => setError(null)} />}

            {/* Spacer for fixed header */}
            <div className="h-4" />
          </div>
        )}

        {phase === "results" && auditResult && (
          <div className="space-y-6 animate-fade-in">
            {/* Results header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-text-primary)]">
                  Audit results
                  <span className="ml-2 font-normal text-[var(--color-text-muted)]">
                    {auditResult.row_count} record{auditResult.row_count !== 1 ? "s" : ""} analyzed
                  </span>
                </h1>
                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                  Deterministic audit of your trade history using the ProofTrade engine.
                </p>
              </div>
              <button
                type="button"
                onClick={handleReset}
                className="flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)]"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  aria-hidden="true"
                >
                  <path
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                New audit
              </button>
            </div>

            {/* Metrics */}
            <MetricsGrid
              summary={auditResult.summary}
              findingCounts={findingCounts}
              datasetId={auditResult.dataset_id}
            />

            {/* Disclaimer */}
            <Disclaimer />

            {/* Findings */}
            <div>
              <h2 className="mb-1 text-lg font-semibold text-[var(--color-text-primary)]">
                Findings
              </h2>
              <p className="mb-4 text-sm text-[var(--color-text-secondary)]">
                Issues detected by the engine, grouped by severity. Expand each to see evidence,
                limitations, and remediation guidance.
              </p>
              <FindingsWorkspace findings={auditResult.findings} />
            </div>

            <div className="h-4" />
          </div>
        )}

        {phase === "results" && !auditResult && (
          <LoadingState />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--color-border)]">
        <div className="mx-auto max-w-5xl px-6 py-6 text-center text-xs text-[var(--color-text-muted)]">
          ProofTrade — Deterministic audit engine for trade-history CSV data.
          <br />
          This tool is for research and analysis purposes only; it is not financial advice.
        </div>
      </footer>
    </div>
  );
}
