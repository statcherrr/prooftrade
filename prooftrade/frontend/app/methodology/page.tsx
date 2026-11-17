"use client";

import Link from "next/link";
import { useState } from "react";
import { Navbar } from "@/app/components/navbar";
import { designTokens, glassUnderlay } from "@/app/components/design-tokens";

export default function AuditMethodologyPage() {
 const [activeCheck, setActiveCheck] = useState<string | null>(null);
 const { bgPrimary, bgSecondary, bgTertiary, glassBase, glassElevated, glassSubtle, glassFrosted, borderBase, textPrimary, textSecondary, textMuted, accentBlue, accentCyan, accentGreen, accentRed, radiusMd, radiusLg, spaceSm, spaceMd, blurMd } = designTokens;
 const glassUnderlayRef = glassUnderlay;

 const checks = [
  // This list mirrors the engine exactly (prooftrade/engine/__init__.py).
  // Each entry uses the engine's check_name and severity.
  {
    id: "missing_required_field",
    name: "Missing required field",
    description: "A required column is absent from the CSV header.",
    evidence: "The missing column names are listed; every row is excluded from metrics.",
    limitations:
      "Structural check only. Per-row nulls in a present column are reported separately as null_required_field.",
    remediation: "Add the missing column(s) to the CSV header.",
    severity: "medium" as const,
    docs: "The API rejects a CSV that omits required columns with HTTP 422 and names the columns.",
  },
  {
    id: "null_required_field",
    name: "Null required field",
    description: "A required field is null or empty on an individual row.",
    evidence: "The row index and the empty column are reported in the finding evidence.",
    limitations:
      "Null required fields make the row unusable for validation, so the row is excluded from metrics.",
    remediation: "Provide a value for every required field on the row.",
    severity: "medium" as const,
    docs: "Rows are dropped before PnL, win-rate and drawdown calculations.",
  },
  {
    id: "duplicate_trade_ids",
    name: "Duplicate trade IDs",
    description: "The same trade_id appears on more than one row.",
    evidence: "The duplicated trade_id is reported with its row indices.",
    limitations:
      "The CSV cannot distinguish an intentional duplicate from a deduplication failure in the source system.",
    remediation: "Ensure each trade_id is unique, or consolidate the duplicate rows.",
    severity: "low" as const,
    docs: "Duplicates are reported; the engine does not delete rows for this check.",
  },
  {
    id: "missing_invalid_timestamps",
    name: "Missing / invalid timestamps",
    description:
      "A timestamp cannot be parsed as ISO-8601, or it is timezone-naive and the timezone assumption was disabled.",
    evidence:
      "The row index and the raw timestamp value are reported for each affected row.",
    limitations:
      "Unparseable rows are dropped. Timezone-naive rows are assumed UTC (low severity) when the assumption is enabled, or rejected (medium severity) when it is not. If the real timezone was not UTC, time-ordered checks may be wrong.",
    remediation:
      "Use ISO-8601 timestamps with an explicit offset, e.g. 2023-01-01T10:00:00Z.",
    severity: "medium" as const,
    docs: "This is the check that reports timezone assumptions, so it can appear as low or medium severity.",
  },
  {
    id: "pnl_sign_inconsistency",
    name: "PnL sign inconsistency",
    description: "The PnL sign does not match the trade side.",
    evidence: "A buy with negative PnL, or a sell with positive PnL, is reported per row.",
    limitations:
      "Assumes PnL is signed by position direction, so a sell that closes a profitable long is flagged; it also does not model multi-trade strategies, hedging, or cost-basis adjustments. Review context before acting.",
    remediation:
      "Review the trade context. If the result is intentional, document it; if it is erroneous, correct the PnL value.",
    severity: "medium" as const,
    docs: "A deterministic heuristic, not a definitive verdict on the strategy.",
  },
  {
    id: "unrealistic_transaction_costs",
    name: "Unrealistic transaction costs",
    description:
      "Fees are negative, or fees are below 0.01% of notional (a typical bid-ask spread floor).",
    evidence:
      "Fees, price, quantity, notional and the fee percentage are reported for the row.",
    limitations:
      "The 0.01% threshold is a rule of thumb. Crypto maker-taker tiers and institutional fee schedules can legitimately sit below it.",
    remediation:
      "Validate fees against the expected fee structure for the asset class, and document genuinely low fees.",
    severity: "medium" as const,
    docs: "Only negative fees and fees below the threshold are flagged; high fees are not.",
  },
  {
    id: "look_ahead_bias",
    name: "Look-ahead bias",
    description:
      "The CSV alone cannot prove the absence of look-ahead bias, so this check always reports the limitation.",
    evidence:
      "CSV data only; no external price comparison is performed in this MVP.",
    limitations:
      "A CSV cannot prove the absence of look-ahead or survivorship bias. External historical price data is required for a conclusive determination.",
    remediation:
      "Compare trade prices against historical VWAP or closing prices at each timestamp and re-run the audit with that data.",
    severity: "high" as const,
    docs: "Reported on every audit as an explicit scope limitation, not as a defect found in your data.",
  },
  {
    id: "overlapping_trades",
    name: "Overlapping trades",
    description:
      "Two adjacent trades for the same symbol share the exact same timestamp.",
    evidence:
      "Both trade IDs, timestamps and sides are reported, with their row indices.",
    limitations:
      "Scaling in or out of a position can legitimately produce simultaneous executions; the check flags equal timestamps only.",
    remediation:
      "Review the position-management logic. Document intentional overlap, or correct accidental duplicate entries.",
    severity: "medium" as const,
    docs: "Compared per symbol after sorting by timestamp.",
  },
  {
    id: "survivorship_bias_marker",
    name: "Survivorship bias marker",
    description:
      "A 100% win rate, or an unusually tight PnL distribution relative to its mean, across more than ten trades.",
    evidence: "Win rate, PnL standard deviation, mean and trade count are reported.",
    limitations:
      "A marker, not a proof. Tight distributions can also come from genuinely low-volatility strategies; universe data is needed for a conclusive determination.",
    remediation:
      "Check that losing trades and delisted or failed instruments are present in the dataset.",
    severity: "medium" as const,
    docs: "The 100% win-rate marker is medium severity; the tight-distribution marker is low.",
  },
  {
    id: "excessive_round_trip_frequency",
    name: "Excessive round-trip frequency",
    description:
      "More than 100 buy-sell cycles for one symbol inside a 30-day wall-clock window.",
    evidence: "Buy count, sell count, date range and cycle count are reported.",
    limitations:
      "The threshold is strategy-dependent; scalping and high-frequency mean reversion can legitimately exceed it.",
    remediation:
      "Confirm the strategy's turnover is intentional, or investigate a data-quality or signal issue.",
    severity: "medium" as const,
    docs: "Cycles are counted per symbol as the smaller of the buy and sell counts.",
  },
];

 const summary = [
 { key: "total_trades", label: "Total records", icon: "∑" },
 { key: "valid_trades", label: "Valid trades", icon: "✓" },
 { key: "net_pnl", label: "Net P&L", icon: "▾" },
 { key: "win_rate", label: "Win rate", icon: "%" },
 { key: "profit_factor", label: "Profit factor", icon: "∝" },
 { key: "sharpe_ratio", label: "Sharpe", icon: "σ" },
 { key: "max_drawdown", label: "Drawdown", icon: "↓" },
 ];

 return (
 <div className="relative min-h-screen overflow-hidden bg-[var(--color-bg-primary)]">
 <div style={glassUnderlay} />
 <Navbar />

 <main className="relative z-10 mx-auto max-w-6xl px-6 pb-16 pt-12">
 {/* Header */}
 <div className="mb-10">
 <p className="text-xs font-medium uppercase tracking-widest text-[var(--color-accent-cyan)]">
 Documentation
 </p>
 <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--color-text-primary)]">
 Audit methodology
 </h1>
 <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
 How the ProofTrade deterministic audit engine parses trade-history CSVs and produces findings.
 </p>
 </div>

 {/* Pipeline overview - interactive steps */}
 <div className="mb-10">
 <h2 className="mb-4 text-xl font-semibold text-[var(--color-text-primary)]">
 Pipeline
 </h2>
 <div className="space-y-0">
 {[
 { step: "1", label: "Parse & order", desc: "Timestamps are normalized; rows are sorted chronologically. When assume_utc is enabled (the default), naive timestamps are treated as UTC." },
 { step: "2", label: "Validate", desc: "Required fields are checked, timestamps parsed, duplicate trade IDs detected, and rows with unusable required fields removed before metrics are computed." },
 { step: "3", label: "Metric", desc: "Net PnL (including fees and slippage), win rate, profit factor, Sharpe ratio, and maximum drawdown are computed over valid rows." },
 { step: "4", label: "Findings", desc: "Each heuristic check produces one finding with evidence, limitations, and remediation guidance." },
 ].map((stage) => (
 <div
 key={stage.step}
 className={`flex gap-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4 transition-colors hover:border-[var(--color-border)]/80`}
 >
 <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--color-bg-tertiary)] text-sm font-semibold text-[var(--color-accent-blue)]">
 {stage.step}
 </div>
 <div>
 <p className="text-sm font-semibold text-[var(--color-text-primary)]">{stage.label}</p>
 <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">{stage.desc}</p>
 </div>
 </div>
 ))}
 </div>
 </div>

 {/* Checks - interactive list */}
 <div>
 <h2 className="mb-4 text-xl font-semibold text-[var(--color-text-primary)]">
 Checks <span className="text-sm font-normal text-[var(--color-text-muted)]">(click any check to inspect)</span>
 </h2>
 <div className="grid gap-3 md:grid-cols-2">
 {checks.map((check) => (
 <button
 key={check.id}
 onClick={() => setActiveCheck(activeCheck === check.id ? null : check.id)}
 className={`rounded-xl border p-4 text-left transition-all duration-200 ${
 activeCheck === check.id
 ? "border-[var(--color-accent-blue)] bg-[var(--color-bg-secondary)] shadow-lg shadow-[var(--color-accent-blue)]/5"
 : `border-[var(--color-border)] bg-[var(--color-bg-secondary)] hover:border-[var(--color-border)]/80`
 }`}
 >
 <div className="flex items-center justify-between">
 <span className="text-sm font-semibold text-[var(--color-text-primary)]">{check.name}</span>          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${
            check.severity === "high" ? "border-red-500/20 bg-red-500/10 text-red-400" :
            check.severity === "medium" ? "border-amber-500/20 bg-amber-500/10 text-amber-400" :
            "border-gray-500/20 bg-gray-500/10 text-gray-400"
          }`}>
            {check.severity}
          </span>
 </div>
 <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{check.description}</p>
 </button>
 ))}
 </div>
 </div>

 {/* Active check detail */}
 {activeCheck && (
 <div className={`mt-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-5 transition-all`}>
 {(() => {
 const c = checks.find((x) => x.id === activeCheck)!;
 return (
 <div className="space-y-4">
 <div className="flex items-center justify-between gap-3">
 <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">{c.name}</h3>
 <button
 type="button"
 onClick={() => setActiveCheck(null)}
 className="text-xs text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-primary)]"
 >
 Close
 </button>
 </div>
 <p className="text-sm text-[var(--color-text-secondary)]">{c.description}</p>
 <div className="rounded-lg bg-[var(--color-bg-tertiary)] p-3">
 <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-muted)]">Evidence</p>
 <pre className="mt-1 text-xs font-mono text-[var(--color-text-secondary)] whitespace-pre-wrap">{c.evidence}</pre>
 </div>
 <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] p-3">
 <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-muted)]">Limitations</p>
 <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{c.limitations}</p>
 </div>
 <div className="rounded-lg bg-[var(--color-bg-tertiary)] p-3">
 <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-muted)]">Remediation</p>
 <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{c.remediation}</p>
 </div>
 <p className="text-xs text-[var(--color-text-muted)]">{c.docs}</p>
 </div>
 );
 })()}
 </div>
 )}

 {/* Determinism statement */}
 <section className={`mt-10 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-5`}>
 <h2 className="mb-2 text-lg font-semibold text-[var(--color-text-primary)]">Determinism</h2>
 <p className="text-sm text-[var(--color-text-secondary)]">
 All checks are pure functions of the CSV input and the timezone assumption. There are no LLM calls,
 no external services, and no hidden randomness. The same CSV and settings always produce the same
 findings and metrics.
 </p>
 </section>

 {/* Summary philosophy */}
 <section className={`mt-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-5`}>
 <h2 className="mb-2 text-lg font-semibold text-[var(--color-text-primary)]">Summary philosophy</h2>
 <p className="text-sm text-[var(--color-text-secondary)]">
 ProofTrade is designed to answer one question first: is there anything in this trade history that a
 deterministic rule flags as a risk worth checking? Findings are always displayed with their evidence
 so you can inspect the raw data behind each claim before deciding what to do.
 </p>
 </section>
 </main>

 <footer className="relative z-10 border-t border-[var(--color-border)]">
 <div className="mx-auto max-w-5xl px-6 py-6 text-center text-xs text-[var(--color-text-muted)]">
 ProofTrade - Deterministic audit engine for trade-history CSV data.
 <br />
 This tool is for research and analysis purposes only; it is not financial advice.
 </div>
 </footer>
 </div>
 );
}
