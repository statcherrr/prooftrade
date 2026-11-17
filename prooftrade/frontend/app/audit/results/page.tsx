"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Navbar } from "@/app/components/navbar";
import { FindingsWorkspace } from "@/app/components/findings-workspace";
import { Disclaimer } from "@/app/components/disclaimer";
import {
  clearAuditResult,
  readAuditResult,
  type AuditResponse,
} from "@/app/lib/audit";

function formatMoney(value: number | null): string {
  if (value === null) return "n/a";
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)} USD`;
}

function formatProfitFactor(value: AuditResponse["summary"]["profit_factor"]): string {
  if (value === "inf") return "inf";
  return value.toFixed(2);
}

export default function AuditResultsPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "ready">("loading");
  const [auditResult, setAuditResult] = useState<AuditResponse | null>(null);

  // Results are read from sessionStorage on the client, so the initial render
  // shows a neutral loading state instead of flashing an empty state.
  useEffect(() => {
    setAuditResult(readAuditResult());
    setStatus("ready");
  }, []);

  const startNewAudit = () => {
    clearAuditResult();
    router.push("/audit");
  };

  if (status === "loading") {
    return (
      <div className="relative min-h-screen overflow-hidden bg-[var(--color-bg-primary)]">
        <Navbar />
        <main className="relative z-10 mx-auto w-full max-w-5xl px-6 py-16">
          <div
            className="h-40 animate-pulse rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)]/60"
            aria-hidden="true"
          />
          <p className="sr-only">Loading audit results…</p>
        </main>
      </div>
    );
  }

  if (!auditResult) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-[var(--color-bg-primary)]">
        <Navbar />
        <main className="relative z-10 mx-auto flex w-full max-w-5xl items-center justify-center px-6 pb-16 pt-16">
          <div className="glass-panel flex w-full max-w-xl flex-col items-center justify-center gap-5 rounded-2xl px-6 py-12 text-center sm:px-8 sm:py-14">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
              <svg
                viewBox="0 0 24 24"
                className="h-7 w-7 text-[var(--color-accent-blue)]"
                aria-hidden="true"
              >
                <path
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3.75 7.5h16.5M3.75 12h10.5M3.75 16.5h6.75"
                />
                <circle cx="20.25" cy="16.5" r="1.25" fill="currentColor" />
              </svg>
            </div>
            <h1 className="w-full text-center text-2xl font-semibold tracking-tight text-[var(--color-text-primary)]">
              No audit results yet
            </h1>
            <p className="w-full text-center text-sm leading-relaxed text-[var(--color-text-secondary)]">
              Run an audit from the New Audit workspace to see deterministic
              results from the ProofTrade engine.
            </p>
            <Link
              href="/audit"
              className="btn-primary mt-2 inline-flex min-w-[180px] items-center justify-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                <path
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                />
              </svg>
              New audit
            </Link>
            <p className="mt-1 text-xs leading-relaxed text-[var(--color-text-muted)]">
              Results are kept in this browser tab only, so a direct visit or a
              fresh tab starts here until you run an audit.
            </p>
          </div>
        </main>
      </div>
    );
  }

  const findingCounts = {
    high: auditResult.findings.filter((f) => f.severity === "high").length,
    medium: auditResult.findings.filter((f) => f.severity === "medium").length,
    low: auditResult.findings.filter((f) => f.severity === "low").length,
  };

  const totalFindings = auditResult.findings.length;

  const metrics = [
    {
      label: "Net P&L",
      value: formatMoney(auditResult.summary.net_pnl),
      hint: "Sum of trade PnL minus fees and slippage.",
    },
    {
      label: "Win rate",
      value: `${((auditResult.summary.win_rate ?? 0) * 100).toFixed(2)}%`,
      hint: "Trades with PnL > 0 divided by trades with PnL != 0.",
    },
    {
      label: "Profit factor",
      value: formatProfitFactor(auditResult.summary.profit_factor),
      hint:
        auditResult.summary.profit_factor === "inf"
          ? "No losing trades: gross losses are zero, so the ratio is unbounded (inf)."
          : "Gross wins divided by |gross losses|.",
    },
    {
      label: "Sharpe ratio",
      value:
        auditResult.summary.sharpe_ratio === null
          ? "n/a"
          : auditResult.summary.sharpe_ratio.toFixed(2),
      hint:
        auditResult.summary.sharpe_ratio === null
          ? "Needs at least 30 valid trades; reported as n/a below that."
          : "Annualized Sharpe from log returns of trade prices (252 days/year).",
    },
    {
      label: "Max drawdown",
      value: formatMoney(auditResult.summary.max_drawdown),
      hint: "Peak-to-trough decline in cumulative PnL across the trade sequence.",
    },
  ];

  return (
    <div className="relative min-h-screen overflow-hidden bg-[var(--color-bg-primary)]">
      <Navbar />

      <main className="relative z-10 mx-auto w-full max-w-5xl px-6 pb-16 pt-10 sm:pt-12">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-[var(--color-text-primary)]">
              Audit results
            </h1>
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
              {auditResult.row_count} record{auditResult.row_count === 1 ? "" : "s"}{" "}
              analyzed · deterministic engine output
            </p>
          </div>
          <button
            type="button"
            onClick={startNewAudit}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)]"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
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
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {/* five metric cards below + findings card = full 3-column grid */}
          {metrics.map((metric) => (
            <div key={metric.label} className="glass-card rounded-xl p-5">
              <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-muted)]">
                {metric.label}
              </p>
              <p className="mt-2 font-mono text-2xl font-semibold text-[var(--color-text-primary)]">
                {metric.value}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-[var(--color-text-muted)]">
                {metric.hint}
              </p>
            </div>
          ))}

          {/* Sixth card completes the 3-column metric grid. */}
          <div className="glass-card rounded-xl p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-muted)]">
              Findings
            </p>
            <p className="mt-2 font-mono text-2xl font-semibold text-[var(--color-text-primary)]">
              {totalFindings}
            </p>
            <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--color-text-muted)]">
              <span className="text-[var(--color-high-severity)]">
                {findingCounts.high} high
              </span>
              <span className="text-[var(--color-medium-severity)]">
                {findingCounts.medium} medium
              </span>
              <span className="text-[var(--color-low-severity)]">
                {findingCounts.low} low
              </span>
            </p>
          </div>
        </div>

        {/* Trade summary */}
        <div className="glass-card mt-3 rounded-xl p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-muted)]">
              Trade summary
            </p>
            <code className="break-all font-mono text-xs text-[var(--color-accent-blue)]">
              {auditResult.dataset_id}
            </code>
          </div>
          <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border)]/60 pb-2">
              <dt className="text-[var(--color-text-secondary)]">Total records</dt>
              <dd className="font-mono text-[var(--color-text-primary)]">
                {auditResult.row_count}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border)]/60 pb-2">
              <dt className="text-[var(--color-text-secondary)]">Valid trades</dt>
              <dd className="font-mono text-[var(--color-text-primary)]">
                {auditResult.summary.valid_trades}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-[var(--color-text-secondary)]">High severity</dt>
              <dd className="font-mono text-[var(--color-high-severity)]">
                {findingCounts.high}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-[var(--color-text-secondary)]">Medium severity</dt>
              <dd className="font-mono text-[var(--color-medium-severity)]">
                {findingCounts.medium}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-[var(--color-text-secondary)]">Low severity</dt>
              <dd className="font-mono text-[var(--color-low-severity)]">
                {findingCounts.low}
              </dd>
            </div>
          </dl>
        </div>

        {/* Findings */}
        <div className="mt-6">
          <FindingsWorkspace findings={auditResult.findings} />
        </div>

        <div className="mt-6">
          <Disclaimer />
        </div>

        <p className="mt-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4 text-xs leading-relaxed text-[var(--color-text-muted)]">
          These results are held in this browser tab only (session storage).
          Refreshing keeps them; closing the tab or starting a new audit clears
          them. The CSV itself is never stored on the server.
        </p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/audit"
            className="btn-primary inline-flex items-center justify-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold"
          >
            Run another audit
          </Link>
          <Link
            href="/methodology"
            className="inline-flex items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-6 py-3 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)]"
          >
            How findings are produced
          </Link>
        </div>
      </main>
    </div>
  );
}
