"use client";

import { useState, useCallback, useRef, useTransition } from "react";

// ── Types ──────────────────────────────────────────────────────────────────

interface Finding {
  finding_id: string;
  check_name: string;
  severity: "low" | "medium" | "high";
  trade_id: string | null;
  description: string;
  evidence: string;
  limitations: string;
  remediation: string | null;
  row_indices: number[] | null;
}

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

// ── Utility ────────────────────────────────────────────────────────────────

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function severityClass(severity: string): string {
  switch (severity) {
    case "high":
      return "badge-high";
    case "medium":
      return "badge-medium";
    default:
      return "badge-low";
  }
}

function severityLabel(severity: string): string {
  return severity.charAt(0).toUpperCase() + severity.slice(1);
}

// ── Component ──────────────────────────────────────────────────────────────

export default function Home() {
  const [phase, setPhase] = useState<"upload" | "results">("upload");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [assumeUtc, setAssumeUtc] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [auditResult, setAuditResult] = useState<AuditResponse | null>(null);
  const [error, setError] = useState<{ detail: string } | null>(null);
  const [filteredSeverity, setFilteredSeverity] = useState("all");
  const [filteredCheck, setFilteredCheck] = useState("all");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (file) {
      setCsvFile(file);
      setError(null);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file && (file.type === "text/csv" || file.name.endsWith(".csv"))) {
        setCsvFile(file);
        setError(null);
      }
    },
    []
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  }, []);

  const handleReset = useCallback(() => {
    setPhase("upload");
    setCsvFile(null);
    setAuditResult(null);
    setError(null);
    setFilteredSeverity("all");
    setFilteredCheck("all");
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
            throw new Error(`Upload failed with status ${res.status}`);
          }
          return res.json();
        })
        .then((data: AuditResponse) => {
          setAuditResult(data);
          setPhase("results");
        })
        .catch((err) => {
          setError({ detail: err.message });
        });
    });
  }, [csvFile]);

  // ── Derived state ───────────────────────────────────────────────────────

  const summary = auditResult?.summary;
  const findings = auditResult?.findings ?? [];
  const totalTrades = summary?.total_trades ?? 0;
  const netPnl = summary?.net_pnl ?? 0;
  const winRate = summary?.win_rate ?? 0;
  const profitFactor = summary?.profit_factor ?? 0;
  const sharpe = summary?.sharpe_ratio ?? null;
  const maxDrawdown = summary?.max_drawdown ?? null;

  const highFindings = findings.filter((f) => f.severity === "high");
  const mediumFindings = findings.filter((f) => f.severity === "medium");
  const lowFindings = findings.filter((f) => f.severity === "low");
  const uniqueCheckNames = Array.from(new Set(findings.map((f) => f.check_name)));

  const filteredFindings =
    filteredCheck === "all"
      ? findings.filter((f) => filteredSeverity === "all" || f.severity === filteredSeverity)
      : findings.filter(
          (f) => f.check_name === filteredCheck && (filteredSeverity === "all" || f.severity === filteredSeverity)
        );

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]/80 backdrop-blur sticky top-0 z-50">
        <div className="mx-auto max-w-6xl px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--color-bg-tertiary)] text-sm font-semibold text-[var(--color-accent-blue)]">
                PT
              </div>
              <div>
                <h1 className="text-lg font-semibold tracking-tight">ProofTrade</h1>
                <p className="text-xs text-[var(--color-text-muted)]">Deterministic audit of trade history</p>
              </div>
            </div>
            {phase === "results" && (
              <button
                onClick={handleReset}
                className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)]"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                New audit
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto max-w-6xl px-6 py-8">
        {phase === "upload" && (
          <>
            {/* Hero */}
            <section className="mb-12">
              <h2 className="mb-3 text-3xl font-bold tracking-tight">Audit your trade history</h2>
              <p className="max-w-2xl text-lg text-[var(--color-text-secondary)]">
                Upload a CSV of your trades and get a deterministic analysis of net P&L, win rate, profit
                factor, Sharpe ratio, maximum drawdown, and pattern-based risk findings.
              </p>
            </section>

            {/* CSV format info */}
            <section className="mb-8 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-6">
              <h3 className="mb-3 font-semibold">Required CSV format</h3>
              <p className="mb-4 text-sm text-[var(--color-text-secondary)]">
                Your CSV must include these columns. All are required; the engine will report missing fields as
                findings.
              </p>
              <div className="rounded-lg bg-[var(--color-bg-primary)] p-4">
                <pre className="text-xs text-[var(--color-text-secondary)]">
trade_id,timestamp,symbol,side,quantity,price,pnl,fees,slippage,strategy_name,notes
t001,2023-01-01T10:00:00Z,AAPL,buy,100,150.00,50.00,1.00,0.00,stratA,clean buy trade
t002,2023-01-01T10:05:00Z,AAPL,sell,100,152.10,62.10,1.00,0.00,stratA,clean sell trade
                </pre>
              </div>
              <ul className="mt-3 list-disc pl-5 text-xs text-[var(--color-text-muted)] space-y-1">
                <li><code className="text-[var(--color-accent-blue)]">trade_id</code> — Unique identifier</li>
                <li><code className="text-[var(--color-accent-blue)]">timestamp</code> — ISO-8601 datetime (e.g. 2023-01-01T10:00:00Z)</li>
                <li><code className="text-[var(--color-accent-blue)]">symbol</code> — Ticker or instrument</li>
                <li><code className="text-[var(--color-accent-blue)]">side</code> — "buy" or "sell"</li>
                <li><code className="text-[var(--color-accent-blue)]">quantity</code> — Units traded</li>
                <li><code className="text-[var(--color-accent-blue)]">price</code> — Price per unit</li>
                <li><code className="text-[var(--color-accent-blue)]">pnl</code> — Profit/loss (used as-is by engine)</li>
                <li><code className="text-[var(--color-accent-blue)]">fees</code> — Transaction costs</li>
                <li><code className="text-[var(--color-accent-blue)]">slippage</code> — Slippage cost</li>
                <li><code className="text-[var(--color-accent-blue)]">strategy_name</code> — Optional</li>
                <li><code className="text-[var(--color-accent-blue)]">notes</code> — Optional</li>
              </ul>
            </section>

            {/* Upload */}
            <section className="mb-8">
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                className="relative cursor-pointer rounded-xl border-2 border-dashed border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-12 transition-colors hover:border-[var(--color-accent-blue)]/50"
              >
                {csvFile ? (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{csvFile.name}</p>
                      <p className="text-sm text-[var(--color-text-muted)]">
                        {(csvFile.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--color-accent-blue)]/90"
                    >
                      Change file
                    </button>
                  </div>
                ) : (
                  <div>
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)]">
                      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                      </svg>
                    </div>
                    <p className="mt-4 text-center text-[var(--color-text-secondary)]">
                      Drag your trade-history CSV here, or{" "}
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="font-medium text-[var(--color-accent-blue)] hover:underline"
                      >
                        select a file
                      </button>
                    </p>
                    <p className="mt-2 text-xs text-[var(--color-text-muted)]">
                      CSV files only. Max 10 MB, ~10,000 rows.
                    </p>
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
            </section>

            {/* Options */}
            <section className="mb-8 flex items-center gap-4">
              <label className="flex items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4 py-3 transition-colors hover:border-[var(--color-border)]">
                <input
                  type="checkbox"
                  checked={assumeUtc}
                  onChange={(e) => setAssumeUtc(e.target.checked)}
                  className="h-4 w-4 rounded border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-accent-blue)] focus:ring-[var(--color-accent-blue)]"
                />
                <div>
                  <p className="text-sm font-medium">Assume timezone-naive timestamps are UTC</p>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    Enable to interpret naive timestamps as UTC. Disabling rejects them.
                  </p>
                </div>
              </label>
            </section>

            {/* Error */}
            {error && (
              <div className="mb-8 rounded-xl border border-red-500/30 bg-red-500/10 p-4">
                <p className="text-sm text-red-400">{error.detail}</p>
              </div>
            )}

            {/* Submit */}
            <section className="mb-8">
              <button
                onClick={handleSubmit}
                disabled={!csvFile || isPending}
                className="w-full rounded-xl bg-[var(--color-accent-blue)] px-6 py-4 text-lg font-semibold text-white shadow-lg transition-all hover:bg-[var(--color-accent-blue)]/90 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isPending ? "Analyzing..." : `Analyze ${csvFile?.name ?? "your trades"}`}
              </button>
              <p className="mt-3 text-center text-xs text-[var(--color-text-muted)]">
                No data is stored. Analysis runs in your browser and on the backend; your CSV is not persisted.
              </p>
            </section>
          </>
        )}

        {phase === "results" && auditResult && (
          <>
            {/* Results header */}
            <section className="mb-8">
              <div className="flex items-center justify-between">
                <div><h2 className="text-2xl font-bold tracking-tight">
                  Audit results
                  <span className="ml-2 font-normal text-[var(--color-text-muted)] text-lg">
                    {auditResult.row_count} record{auditResult.row_count !== 1 ? "s" : ""} analyzed
                  </span>
                </h2>
                </div>
                <button
                  onClick={handleReset}
                  className="rounded-lg px-4 py-2 text-sm text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)]"
                >
                  New audit
                </button>
              </div>
              <div className="mt-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4 text-sm text-[var(--color-text-muted)]">
                <span className="font-mono text-xs text-[var(--color-text-secondary)]">
                  Dataset ID: {auditResult.dataset_id}
                </span>
              </div>
            </section>

            {/* Metrics grid */}
            <section className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-5">
                <div className="mb-2 text-xs uppercase tracking-wider text-[var(--color-text-muted)]">
                  Net P&L
                </div>
                <div className="text-3xl font-bold mono text-[var(--color-text-primary)]">
                  {formatCurrency(netPnl)}
                </div>
                <div className="mt-1 text-xs text-[var(--color-text-muted)]">
                  Gross PnL minus fees and slippage
                </div>
              </div>

              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-5">
                <div className="mb-2 text-xs uppercase tracking-wider text-[var(--color-text-muted)]">
                  Win rate
                </div>
                <div className="text-3xl font-bold mono text-[var(--color-text-primary)]">
                  {formatPercent(winRate)}
                </div>
                <div className="mt-1 text-xs text-[var(--color-text-muted)]">
                  Trades with PnL &gt; 0 / trades with PnL != 0
                </div>
              </div>

              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-5">
                <div className="mb-2 text-xs uppercase tracking-wider text-[var(--color-text-muted)]">
                  Profit factor
                </div>
                <div className="text-3xl font-bold mono text-[var(--color-text-primary)]">
                  {typeof profitFactor === "string" ? profitFactor : profitFactor.toFixed(2)}
                </div>
                <div className="mt-1 text-xs text-[var(--color-text-muted)]">
                  {typeof profitFactor === "string" && profitFactor === "inf"
                    ? "No gross losses under engine definition; ∞ is a marker, not a guarantee."
                    : "Gross wins / |gross losses|"}
                </div>
              </div>

              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-5">
                <div className="mb-2 text-xs uppercase tracking-wider text-[var(--color-text-muted)]">
                  Sharpe ratio (annualized)
                </div>
                <div className="text-3xl font-bold mono text-[var(--color-text-primary)]">
                  {typeof sharpe === "number" ? sharpe.toFixed(2) : "—"}
                </div>
                <div className="mt-1 text-xs text-[var(--color-text-muted)]">
                  Based on log returns of trade prices, 252 trading days/year
                </div>
              </div>

              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-5">
                <div className="mb-2 text-xs uppercase tracking-wider text-[var(--color-text-muted)]">
                  Maximum drawdown
                </div>
                <div className="text-3xl font-bold mono text-[var(--color-text-primary)]">
                  {typeof maxDrawdown === "number" ? formatCurrency(maxDrawdown) : "—"}
                </div>
                <div className="mt-1 text-xs text-[var(--color-text-muted)]">
                  Peak-to-trough decline in cumulative P&L
                </div>
              </div>

              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-5">
                <div className="mb-2 text-xs uppercase tracking-wider text-[var(--color-text-muted)]">
                  Trade summary
                </div>
                <div className="mt-2 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-[var(--color-text-secondary)]">Total records</span>
                    <span className="font-mono text-[var(--color-text-primary)]">{totalTrades}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--color-text-secondary)]">Valid trades</span>
                    <span className="font-mono text-[var(--color-text-primary)]">{summary?.valid_trades ?? 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--color-text-secondary)]">High severity</span>
                    <span className="font-mono text-[var(--color-high-severity)]">{highFindings.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--color-text-secondary)]">Medium severity</span>
                    <span className="font-mono text-[var(--color-medium-severity)]">{mediumFindings.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--color-text-secondary)]">Low severity</span>
                    <span className="font-mono text-[var(--color-low-severity)]">{lowFindings.length}</span>
                  </div>
                </div>
              </div>
            </section>

            {/* Disclaimer */}
            <section className="mb-8 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4">
              <p className="text-sm text-[var(--color-text-secondary)]">
                <strong>Disclaimer:</strong> This audit is deterministic and based solely on the CSV you
                provided. It does not guarantee future performance, prove the absence of all forms of bias
                (including look-ahead bias or survivorship bias), or validate the accuracy of your recorded
                data. Findings highlight patterns and potential issues based on heuristic thresholds; they
                are not definitive judgments. Review the limitations and evidence for each finding.
              </p>
            </section>

            {/* Findings */}
            <section className="mb-8">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold">Findings</h3>
                {findings.length > 0 && (
                  <div className="flex items-center gap-3">
                    <select
                      value={filteredCheck}
                      onChange={(e) => setFilteredCheck(e.target.value)}
                      className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-1.5 text-sm text-[var(--color-text-secondary)] transition-colors focus:border-[var(--color-accent-blue)]"
                    >
                      <option value="all">All checks</option>
                      {uniqueCheckNames.map((name) => (
                        <option key={name} value={name}>
                          {name.replace(/_/g, " ")}
                        </option>
                      ))}
                    </select>
                    <select
                      value={filteredSeverity}
                      onChange={(e) => setFilteredSeverity(e.target.value)}
                      className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-1.5 text-sm text-[var(--color-text-secondary)] transition-colors focus:border-[var(--color-accent-blue)]"
                    >
                      <option value="all">All severities</option>
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  </div>
                )}
              </div>

              {findings.length === 0 ? (
                <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-8 text-center">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-bg-tertiary)]">
                    <svg className="h-6 w-6 text-[var(--color-success)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h4 className="text-lg font-medium">No findings detected</h4>
                  <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                    The engine did not detect any patterns flagged by its checks. This does not mean the data is
                    perfect — only that no heuristic thresholds were crossed.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredFindings.map((finding) => (
                    <div
                      key={finding.finding_id}
                      className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-5 finding-card"
                    >
                      <div className="mb-3 flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${severityClass(finding.severity)}`}>
                            {severityLabel(finding.severity)}
                          </span>
                          <span className="text-sm font-mono text-[var(--color-text-muted)]">
                            {finding.check_name.replace(/_/g, " ")}
                          </span>
                          {finding.trade_id && (
                            <span className="text-xs text-[var(--color-text-muted)]">
                              {finding.trade_id}
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="mb-3 text-sm text-[var(--color-text-secondary)]">
                        {finding.description}
                      </p>
                      <div className="mb-3 rounded-lg bg-[var(--color-bg-primary)] p-3">
                        <div className="mb-1 text-xs uppercase tracking-wider text-[var(--color-text-muted)]">
                          Evidence
                        </div>
                        <pre className="text-xs mono text-[var(--color-text-secondary)] whitespace-pre-wrap">
                          {finding.evidence}
                        </pre>
                      </div>
                      {finding.limitations && (
                        <div className="mb-2 rounded-lg bg-amber-500/5 p-3">
                          <div className="mb-1 text-xs uppercase tracking-wider text-amber-400">
                            Limitations
                          </div>
                          <p className="text-xs text-[var(--color-text-muted)] whitespace-pre-wrap">
                            {finding.limitations}
                          </p>
                        </div>
                      )}
                      {finding.remediation && (
                        <div className="rounded-lg bg-[var(--color-bg-primary)] p-3">
                          <div className="mb-1 text-xs uppercase tracking-wider text-[var(--color-text-muted)]">
                            Remediation
                          </div>
                          <p className="text-sm text-[var(--color-text-secondary)] whitespace-pre-wrap">
                            {finding.remediation}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--color-border)] mt-16">
        <div className="mx-auto max-w-6xl px-6 py-6 text-center text-xs text-[var(--color-text-muted)]">
          ProofTrade — Deterministic audit engine for trade-history CSV data.
          <br />
          This tool is for research and analysis purposes only; it is not financial advice.
        </div>
      </footer>
    </div>
  );
}