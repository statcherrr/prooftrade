"use client";

import Link from "next/link";
import { Navbar } from "@/app/components/navbar";
import { designTokens, glassUnderlay } from "@/app/components/design-tokens";
import type { Finding } from "@/app/components/findings-workspace";

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
}// ── Overview landing page ───────────────────────────────────────────────────
// Polished ProofTrade overview landing page with liquid-glass design,
// navigation, key-value highlights, and a CTA to start a new audit.

export default function Home() {
 const { bgPrimary, bgSecondary, bgTertiary, glassBase, glassElevated, glassSubtle, glassFrosted, borderBase, textPrimary, textSecondary, textMuted, accentBlue, accentCyan, radiusMd, radiusLg, radiusXl, spaceMd, spaceLg, blurMd } = designTokens;

 return (
 <div
 className="relative min-h-screen overflow-hidden bg-[var(--color-bg-primary)]"
 style={{
 background: `radial-gradient(120% 80% at 50% 0%, rgba(14, 26, 42, 0.45) 0%, rgba(7, 9, 13, 0.85) 60%, transparent 100%)`,
 }}
 >
 {/* Liquid-glass underlay for the whole page */}
 <div style={glassUnderlay} />

 <Navbar />

 <main className="relative z-10 mx-auto max-w-5xl px-6 pb-16 pt-12">
 {/* Lockup / eyebrow */}
 <div className="flex items-center gap-3">
 <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] p-1.5">
 <svg
 viewBox="0 0 24 24"
 className="h-5 w-5 text-[var(--color-accent-blue)]"
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
 <span className="text-xs font-medium uppercase tracking-widest text-[var(--color-text-muted)]">
 Deterministic audit engine
 </span>
 </div>

 {/* Headline */}
 <div className="mt-8 text-center">
 <h1 className="text-4xl font-semibold tracking-tight text-[var(--color-text-primary)] leading-[1.1]">
 Audit your trade history
 <span className="block text-[var(--color-accent-blue)]">
 with deterministic precision
 </span>
 </h1>
 <p className="mt-4 max-w-xl text-lg text-[var(--color-text-secondary)] leading-relaxed text-balance">
 Upload a CSV of your trades and get a deterministic analysis of net P&amp;L, win rate,
 profit factor, Sharpe ratio, maximum drawdown, and pattern-based risk findings.
 No LLM calls. No external services. No hidden randomness.
 </p>
 </div>

 {/* Metric highlights */}
 <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">        {[
          { label: "Deterministic", value: "No LLMs", desc: "Pure rule-based engine" },
          { label: "Transparent", value: "Documented", desc: "Every finding carries evidence" },
          { label: "Private", value: "Not stored", desc: "CSV is analyzed, never persisted" },
          { label: "Repeatable", value: "Identical", desc: "Same CSV and settings, same output" },
        ].map((stat) => (
          <div key={stat.label} className="glass-card rounded-xl p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-muted)]">
                {stat.label}
              </span>
            </div>
            <p className="mt-2 text-2xl font-semibold font-mono text-[var(--color-text-primary)]">
              {stat.value}
            </p>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">{stat.desc}</p>
          </div>
        ))}
 </div>

 {/* CTA row - start a new audit */}      <div className="glass-panel mt-10 flex flex-col items-center gap-4 rounded-2xl p-6 sm:p-8">
        <p className="text-sm font-medium text-[var(--color-text-primary)]">
          Ready to run an audit?
        </p>
        <Link
          href="/audit"
          className="btn-primary inline-flex items-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold"
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
 d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
 />
 </svg>          New audit
        </Link>
      </div>

      {/* Footer links */}
      <div className="mt-10 flex flex-wrap items-center justify-center gap-6 text-xs text-[var(--color-text-muted)]">
        <Link href="/methodology" className="transition-colors hover:text-[var(--color-text-primary)]">
          Audit methodology
        </Link>
        <Link href="/settings" className="transition-colors hover:text-[var(--color-text-primary)]">
          Settings
        </Link>
      </div>
 </main>

 {/* Footer */}
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
