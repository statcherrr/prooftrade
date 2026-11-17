# ProofTrade — methodology summary

This summary mirrors `prooftrade/engine/__init__.py`. If the two ever disagree, the engine is the
implementation and the discrepancy is a bug.

## Pipeline

1. **Parse.** `pandas.read_csv` over the uploaded text; `row_count` records the original row count.
2. **Validate.** Required-field presence, per-row nulls, trade-id uniqueness, timestamp parsing,
   PnL sign, transaction costs, look-ahead scope note, overlapping fills, survivorship markers,
   round-trip frequency.
3. **Drop.** Rows with unusable required fields or unparseable/rejected timestamps are removed
   before metrics.
4. **Measure.** Net P&L, win rate, profit factor, Sharpe (sample-gated), max drawdown.
5. **Report.** One finding per matched rule, each with evidence, limitations, and remediation.

## Metric definitions

| Metric | Formula / rule |
| --- | --- |
| `total_trades` | Rows after drops. |
| `valid_trades` | Same value: drops happen before measurement. |
| `net_pnl` | `sum(pnl) − sum(fees) − sum(slippage)`; absent cost columns = 0. |
| `win_rate` | `count(pnl > 0) / count(pnl ≠ 0)`; `0.0` if every PnL is zero. |
| `profit_factor` | `sum(wins) / abs(sum(losses))`; `"inf"` if no losses and wins exist; `0.0` otherwise. |
| `sharpe_ratio` | `null` if < 30 valid rows; else `√252 × mean(log returns) / std(log returns)` from `price` sorted by timestamp (fallback `log1p(abs(pnl))`), `null` if std = 0. |
| `max_drawdown` | Peak-to-trough of cumulative `pnl`, in currency units, `null` if no valid rows. |

## The ten checks

| `check_name` | Severity | Rule | False-positive mode (stated in the product) |
| --- | --- | --- | --- |
| `missing_required_field` | medium | A required column is missing from the header; all rows dropped. | None: the contract is explicit (7 required columns). |
| `null_required_field` | medium | A required field is null/empty on a row; that row dropped. | Empty strings that are meaningful in the source system are still treated as missing. |
| `duplicate_trade_ids` | low | `trade_id` repeats. | Legitimate re-use of an ID across accounts/exports. |
| `missing_invalid_timestamps` | medium / low | Unparseable timestamp (medium, dropped); timezone-naive timestamp assumed UTC (low) or rejected when `assume_utc=false` (medium). | A non-UTC source timezone silently shifts time-ordered checks. |
| `pnl_sign_inconsistency` | medium | `buy` with negative PnL, or `sell` with positive PnL. | **Assumes PnL is signed by position direction.** A sell that closes a profitable long is flagged; review context before acting. |
| `unrealistic_transaction_costs` | medium | Fees negative, or fees < 0.01% of notional (`price × quantity`). | Crypto maker tiers and institutional schedules can legitimately sit below 0.01%. High fees are never flagged. |
| `look_ahead_bias` | high | Emitted on **every** audit as a scope statement. | Not a data defect; it is a statement that CSV data cannot prove the absence of look-ahead bias. |
| `overlapping_trades` | medium | Adjacent same-symbol rows after timestamp sort share an exact timestamp. | Scaling in/out produces legitimate same-timestamp fills. |
| `survivorship_bias_marker` | medium / low | 100% win rate (medium), or PnL std < 10% of `abs(mean)` with `n > 10` (low). | Genuinely low-volatility strategies can trip the low-severity variant. |
| `excessive_round_trip_frequency` | medium | > 100 buy-sell cycles per symbol within a 30-day wall-clock window; cycles = `min(buys, sells)`. | Scalping/HFT can legitimately exceed the threshold. |

## Determinism

Every check is a pure function of the CSV and the timezone assumption. No LLM, no network, no
randomness, no clock reads. `dataset_id` is a per-run UUID and the only non-reproducible field;
metrics and finding sets are stable across runs (asserted by tests at both engine and HTTP level).

## What a CSV cannot establish

- **Look-ahead bias** — requires external historical prices (VWAP/close at each timestamp).
- **Survivorship bias** — requires knowledge of the full instrument universe, including delisted
  or failed instruments absent from the export.
- **Strategy validity** — no statistical significance testing, no out-of-sample evaluation, no
  benchmark comparison, no transaction-cost model beyond the columns provided.

ProofTrade therefore reports markers and limitations, never a verdict on a strategy.
