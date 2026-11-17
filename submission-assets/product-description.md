# ProofTrade — product description

## One-liner

ProofTrade runs a deterministic audit over a trade-history CSV and returns performance metrics plus
rule-based findings, each with its evidence, its limitations, and a remediation step.

## Short description (≤ 300 characters, submission form)

ProofTrade audits a trade-history CSV in seconds. It computes net P&L, win rate, profit factor,
Sharpe and drawdown, and flags integrity risks — duplicate IDs, PnL sign mismatches, impossible fees,
100% win rates, overlapping fills — with the evidence and limits behind every finding. No LLM, no
randomness: same file, same result.

## Medium description (≈ 100 words)

Backtests and broker exports are usually trusted on their face, even when they contain an
inconsistent PnL sign, a timezone-less timestamp, a fee that could not be real, or a win rate of
exactly 100%. ProofTrade makes that first integrity pass mechanical and repeatable. Upload a CSV;
the engine validates the file, computes net P&L, win rate, profit factor, Sharpe (when the sample
supports it) and peak-to-trough drawdown, and reports findings from ten deterministic checks. Every
finding shows the row, the evidence, the reason the rule can be wrong, and what to fix. A CSV cannot
prove the absence of look-ahead or survivorship bias, and ProofTrade says so instead of implying
otherwise.

## Long description

### The problem

A strategy that reports a 4.66 profit factor looks impressive until you notice one buy with negative
PnL, a fee of 0.01% of notional, and a fill that shares an exact timestamp with the next one. Those
signals are cheap to check and expensive to miss, yet today the check is manual, inconsistent, and
usually skipped under time pressure.

### The product

ProofTrade is a local-first web application with two layers:

1. **A deterministic engine.** A pure Python module that parses a trade-history CSV, validates it,
   runs ten fixed rules, and computes seven metrics. There are no model calls, no sampling, no
   network access, and no hidden randomness. The same CSV and settings always produce the same
   output.
2. **A focused interface.** An overview that explains the product, an upload workspace, a separate
   results destination with a metric grid and expandable findings, a methodology page documenting
   every check, and a settings page for the timezone assumption.

### Why it is credible

- **Explainable by construction.** Every finding carries `evidence`, `limitations`, and
  `remediation`, so a reviewer can check the claim against the raw row instead of trusting a score.
- **Honest about scope.** Look-ahead and survivorship bias cannot be proven absent from a CSV alone,
  so the engine emits an explicit high-severity scope finding on every audit rather than passing
  silently. Profit factor with no losing trades is reported as `"inf"`, not as a large number.
- **Reproducible.** Determinism is asserted by tests that run the same CSV twice and compare
  metrics and finding sets; engine tests use hand-calculated expectations.
- **Failures are legible.** Empty files, missing columns, oversized uploads, and an unreachable
  backend each produce a specific, actionable message — including the names of the missing columns.

### Audience

Individual quant researchers, systematic traders, and reviewers who need a fast, explainable
integrity check on a trade-history file before drawing conclusions from it.

### Scope boundaries

ProofTrade is a research and data-integrity tool, not financial advice, not a strategy validator, and
not a trading system. It has no accounts, no server-side storage, and no hosted demo.
