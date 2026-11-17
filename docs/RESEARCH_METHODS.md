# ProofTrade — Research Methods

## Purpose

This document documents the proposed audit checks, their assumptions, what evidence they require, and what they **cannot** establish. The goal is to distinguish confirmed data errors, suspicious patterns, and checks that cannot be performed with available evidence.

All calculations are deterministic and come from code (no LLM-generated financial claims).

---

## Check 1: Duplicate Trade IDs

### Assumptions
- Each trade should have a unique `trade_id`.
- `trade_id` is a string field in the CSV.

### Evidence Required
- Presence of duplicate values in the `trade_id` column.

### What It Can Establish
- Whether the dataset contains non-unique trade identifiers.

### What It Cannot Establish
- **Why** duplicates exist (intentional vs. data processing artifact).
- Whether the duplicate trades represent look-ahead bias, survivorship bias, or simple data entry errors.
- The financial impact of the duplicates.

### Limitations
- A CSV alone cannot distinguish intentional duplicate entries from errors.
- Finding: `check_name: "duplicate_trade_ids"`, `severity: "low"`, `limitations: "CSV cannot distinguish intentional from unintentional duplicates."`

---

## Check 2: Missing/Invalid Timestamps

### Assumptions
- All trades should have a parseable `timestamp`.
- If timezone is omitted, UTC is assumed (with a warning).

### Evidence Required
- `timestamp` column parseable as ISO-8601 datetime.
- Whether timezone info is present.

### What It Can Establish
- Which rows have unparseable timestamps.
- Whether timestamps are timezone-naive (and UTC is assumed).

### What It Cannot Establish
- The **true** timezone of timezone-naive timestamps.
- Whether look-ahead bias is present (timestamps could be correct but prices used forward-looking).
- Corruption of timestamp order that only external data could reveal.

### Limitations
- Timezone-naive timestamps are assumed UTC — the user must verify this.
- Finding: `check_name: "missing_invalid_timestamps"`, `severity: "medium"`, `limitations: "Timezone assumed UTC; user must verify."`

---

## Check 3: PNL Sign Inconsistency

### Assumptions
- For a `buy` side trade, `pnl` should be positive (profit) if the price rose above entry, negative (loss) if price fell.
- For a `sell` side trade, `pnl` should be positive if the price fell below entry, negative if price rose.
- **Simplified convention in MVP:** `pnl` sign should be consistent with `side` in the sense that `buy` does not have consistently negative `pnl` without offsetting context, and `sell` does not have consistently positive `pnl` without offsetting context.

### Evidence Required
- `side` and `pnl` fields per row.

### What It Can Establish
- Rows where `pnl` sign is clearly inconsistent with `side` under the MVP convention:
  - `buy` side with `pnl < 0` flagged as potentially inconsistent.
  - `sell` side with `pnl > 0` flagged as potentially inconsistent.

### What It Cannot Establish
- Whether the inconsistency is intentional (e.g., a hedging trade, a complex multi-leg strategy).
- The magnitude or reason for the inconsistency.
- Any context beyond the single-row sign check.

### Limitations
- This is a **per-row sign check**, not a multi-trade P&L attribution.
- Finding: `check_name: "pnl_sign_inconsistency"`, `severity: "medium"`, `limitations: "Per-row sign check only; does not account for multi-trade strategies or hedging."`

---

## Check 4: Unrealistic Transaction Costs

### Assumptions
- Transaction fees should be non-negative and reasonable relative to the notional value of the trade.
- For equities, typical bid-ask spreads are 0.01%–0.1% of notional; fees below 0.01% are suspicious if not explicitly justified.
- For crypto, typical fees are 0.1%–0.5% of notional.

### Evidence Required
- `fees`, `price`, and `quantity` fields per row.
- Knowledge of the asset class (equity vs. crypto) for appropriate threshold.

### What It Can Establish
- Rows where `fees < 0.01% * price * quantity` for equity-like notional values.
- Rows where `fees` is negative (which is always suspicious).

### What It Cannot Establish
- Whether the strategy explicitly uses a privileged fee structure (e.g., institutional broker).
- Whether fees were omitted entirely and are represented by a different field.
- The actual bid-ask spread for the instrument at the trade timestamp.

### Limitations
- Threshold of 0.01% is a rule-of-thumb; the user must contextually validate.
- Finding: `check_name: "unrealistic_transaction_costs"`, `severity: "medium"`, `limitations: "0.01% threshold is a rule-of-thumb; user must validate for asset class."`

---

## Check 5: Look-Ahead Bias

### Assumptions
- Prices or data used in the trade must have been available **at** the `timestamp` of the trade.
- Any price, signal, or reference point that comes from **after** the `timestamp` constitutes look-ahead bias.

### Evidence Required
- **External historical price data** for the same symbol and timestamp range.
- Comparison between the `price` in the CSV and the historical price at the same `timestamp`.

### What It Can Establish
- **Nothing conclusive** without external price data.
- If the CSV `price` column is labeled as "entry price at signal time" and the user cannot provide external data, the check generates a **cautious finding** with full limitations disclosure.

### What It Cannot Establish
- Look-ahead bias **from the CSV alone**. A CSV cannot prove the absence of look-ahead bias.
- Finding: `check_name: "look_ahead_bias"`, `severity: "high"` (when evidence suggests bias), but `limitations: "Requires external historical price data for conclusive determination. CSV alone cannot prove absence of look-ahead bias."`

### Critical Principle (from ENGINEERING_SPEC.md)
> Never claim a CSV alone proves the absence of look-ahead bias or survivorship bias.

---

## Check 6: Overlapping Trades

### Assumptions
- For a given symbol, no two trades should have overlapping time intervals.
- A `buy` trade followed by a `sell` trade for the same symbol should not have overlapping timestamps.

### Evidence Required
- `symbol`, `timestamp`, and `side` fields per row.
- Logic: for each symbol, sort trades by `timestamp`; check if any trade's `timestamp` overlaps with the next trade's `timestamp`.

### What It Can Establish
- Pairs of trades for the same symbol with overlapping timestamps.
- Which `row_indices` contributed to the finding.

### What It Cannot Establish
- Whether the overlap is intentional (e.g., scaling in/out of a position, a single position split across multiple executions).
- Whether the overlap resulted from a data processing error (e.g., duplicate entries with different `trade_id`s).

### Limitations
- Some strategies intentionally have overlapping executions.
- Finding: `check_name: "overlapping_trades"`, `severity: "medium"`, `limitations: "Some strategies intentionally overlap executions; user must verify strategy intent."`

---

## Check 7: Survivorship-Biased Return Indicators

### Assumptions
- A strategy's reported returns may survivorship-bias if only winning trades/instruments are shown.
- Markers of survivorship bias include: all trades in the CSV are winners, all instruments are from a known-surviving universe, or the CSV lacks any instruments that went to zero or were delisted.

### Evidence Required
- `symbol` and `pnl` fields across the dataset.
- Ability to compare against a universe of all instruments (not available in CSV alone).

### What It Can Establish
- **Markers** of potential survivorship bias:
  - 100% win rate across all rows.
  - All `symbol` values belong to a small, well-known surviving universe (e.g., S&P 500 tickers only, without delisted names).
  - PnL distribution that is tightly clustered without outliers.

### What It Cannot Establish
- **Whether** survivorship bias actually occurred. The CSV alone cannot confirm or deny this.
- The actual universe of instruments the strategy traded.
- The performance of delisted/winners.

### Limitations
- **CSV alone cannot prove the absence of survivorship bias** (per required principle).
- Finding: `check_name: "survivorship_bias_marker"`, `severity: "medium"`, `limitations: "CSV alone cannot prove absence of survivorship bias. External universe data required for conclusive determination."`

---

## Check 8: Excessive Round-Trip Frequency

### Assumptions
- An unusually high number of buy/sell cycles in a short window may indicate churning or data artifacts.
- Heuristic: > 100 round-trip cycles (buy + sell for same symbol) in < 30 days.

### Evidence Required
- `symbol`, `timestamp`, and `side` fields per row.

### What It Can Establish
- Whether the dataset exceeds the heuristic threshold.
- `row_indices` of trades contributing to the high frequency.

### What It Cannot Establish
- Whether the frequency is intentional (e.g., a scalping strategy, a mean-reversion strategy with high turnover).
- The risk-adjusted appropriateness of the frequency.

### Limitations
- Heuristic threshold (100 in 30 days) is arbitrary; user must validate for strategy type.
- Finding: `check_name: "excessive_round_trip_frequency"`, `severity: "medium"`, `limitations: "Heuristic threshold is strategy-dependent; user must validate."`

---

## Summary of Checks That Cannot Be Performed with CSV Alone

| Check | Cannot Prove |
|-------|-------------|
| Look-ahead bias | Absence of look-ahead bias |
| Survivorship bias | Absence of survivorship bias |
| Overlapping trades | Intentional vs. unintentional overlap |
| Unrealistic transaction costs | Privileged fee structures or omitted fees |
| Duplicate trade IDs | Intent vs. error |

---
*Research methods version 1.0 — aligned with ENGINEERING_SPEC.md v1.0 and IMPLEMENTATION_PLAN.md v1.0.*

---

## Appendix: Deterministic Synthetic Dataset

The following CSV defines a synthetic dataset containing both clean trades and deliberately planted defects. Each row is numbered for reference.

```csv
trade_id,timestamp,symbol,side,quantity,price,pnl,fees,slippage,strategy_name,notes
t001,2023-01-01T10:00:00Z,AAPL,buy,100,150.00,50.00,1.00,0.00,stratA,clean buy trade
t002,2023-01-01T10:05:00Z,AAPL,sell,100,152.10,62.10,1.00,0.00,stratA,clean sell trade
t003,2023-01-01T10:10:00Z,MSFT,buy,50,300.00,25.00,0.50,0.00,stratA,clean buy trade
t004,2023-01-01T10:15:00Z,MSFT,sell,50,301.20,12.20,0.50,0.00,stratA,clean sell trade
t005,2023-01-01T10:20:00Z,AAPL,buy,100,151.00,-50.00,1.00,0.00,stratA,PnL sign inconsistency: buy side with negative pnl
t006,2023-01-01T10:25:00Z,AAPL,buy,100,150.00,50.00,5.00,0.00,stratA,duplicate trade id pattern (will be caught by dup check if trade_id repeats)
t007,2023-01-01T10:30:00Z,GOOGL,buy,10,2800.00,250.00,0.01,0.00,stratA,unrealistic fees: 0.01/2800/10 = 0.0000004% << 0.01%
t008,2023-01-01T10:35:00Z,AAPL,buy,100,150.00,150.00,0.00,0.00,stratA,look-ahead bias candidate: pnl = price * quantity (entry = exit, no movement)
t009,2023-01-01T10:40:00Z,AAPL,sell,100,149.00,-100.00,0.00,0.00,stratA,overlapping trades: t008 and t009 same symbol, adjacent timestamps
t010,2023-01-01T10:45:00Z,cryptoBTC,buy,0.5,40000.00,100.00,20.00,0.00,stratA,valid crypto trade
```

### Expected Results per Test Case

| Row | Expected Findings |
|-----|-------------------|
| t001 | None (clean trade) |
| t002 | None (clean trade) |
| t003 | None (clean trade) |
| t004 | None (clean trade) |
| t005 | `pnl_sign_inconsistency`: `severity: "medium"`, `description: "PNL sign inconsistent with side: buy side has negative pnl"` |
| t006 | **Depends**: if `trade_id` is unique, no dup finding. If duplicated with another row, `duplicate_trade_ids` finding. |
| t007 | `unrealistic_transaction_costs`: `severity: "medium"`, `description: "Fees of 0.01 on notional 28000.00 = 0.00004%, well below 0.01% threshold"` |
| t008 | `look_ahead_bias`: `severity: "high"` (if conclusive), but `limitations: "Requires external historical price data for conclusive determination. CSV alone cannot prove absence of look-ahead bias."` |
| t009 | `overlapping_trades`: `severity: "medium"`, referencing rows t008 and t009 for same symbol AAPL with adjacent timestamps. |
| t010 | None (valid crypto trade; fees 20.00 on notional 20000.00 = 0.1%, within typical crypto range) |

### Test Script Expectation

A pytest test script should:
1. Load the synthetic CSV.
2. Run the full audit engine.
3. Assert that findings match the expected results above (or near-equivalently).
4. Assert that summary metrics (net_pnl, win_rate, profit_factor) are deterministic given the same CSV.

---
*Research methods version 1.0 — this document defines the "what, how, and why-not" of each audit check, and must be read alongside ENGINEERING_SPEC.md (contracts) and IMPLEMENTATION_PLAN.md (milestones).*