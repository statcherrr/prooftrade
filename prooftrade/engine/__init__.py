"""ProofTrade deterministic audit engine.

All functions are pure (no LLM calls, no external services, no hidden randomness).
Given the same CSV input, every call produces identical output.
"""

from __future__ import annotations

import io
import math
from dataclasses import dataclass

import numpy as np
import pandas as pd

# ===========================================================================
# Data structures
# ===========================================================================


@dataclass
class Finding:
    finding_id: str
    check_name: str
    severity: str  # "low" | "medium" | "high"
    trade_id: str | None
    description: str
    evidence: str
    limitations: str
    remediation: str | None
    row_indices: list[int] | None = None


@dataclass
class AuditSummary:
    total_trades: int
    valid_trades: int
    net_pnl: float
    win_rate: float
    profit_factor: float
    sharpe_ratio: float | None
    max_drawdown: float | None


# ===========================================================================
# Helper functions (pure, no side effects)
# ===========================================================================


def _validate_required_fields(df: pd.DataFrame) -> tuple[pd.DataFrame, list[Finding]]:
    """Validate that all required fields are present and non-null."""
    findings: list[Finding] = []
    rows_to_drop: set = set()

    required = [
        "trade_id", "timestamp", "symbol", "side", "quantity",
        "price", "pnl",
    ]

    # Check for entirely missing columns
    for col in required:
        if col not in df.columns:
            fid = f"missing_field_{col}"
            findings.append(
                Finding(
                    finding_id=fid,
                    check_name="missing_required_field",
                    severity="medium",
                    trade_id=None,
                    description=f"Required field '{col}' is absent from the CSV.",
                    evidence=f"CSV columns: {list(df.columns)}",
                    limitations=
                        "CSV structure determines which fields are available; "
                        "missing fields prevent downstream calculations.",
                    remediation=f"Add '{col}' column to the CSV.",
                )
            )
            rows_to_drop.update(range(len(df)))
            break

    if rows_to_drop:
        df = df.drop(index=df.index[list(rows_to_drop)]).copy()

    # Check per-row nulls in required columns
    for col in required:
        if col in df.columns:
            null_mask = df[col].isna() | (df[col] == "")
            if null_mask.any():
                for idx in df[null_mask].index:
                    trade_id_val = (
                        df.loc[idx, "trade_id"]
                        if "trade_id" in df.columns else None
                    )
                    # Avoid duplicate findings for the same check + trade_id combo
                    already = any(
                        f.check_name == "null_required_field"
                        and f.trade_id == trade_id_val
                        for f in findings
                    )
                    if not already:
                        findings.append(
                            Finding(
                                finding_id=f"null_{col}_{idx}",
                                check_name="null_required_field",
                                severity="medium",
                                trade_id=trade_id_val,
                                description=f"Required field '{col}' is null or empty.",
                                evidence=f"Row {idx}: column '{col}' is null.",
                                limitations=
                                    "Null required fields prevent meaningful validation "
                                    "of that row; row is excluded from metrics.",
                                remediation=f"Provide a non-null value for '{col}'.",
                            )
                        )
                    rows_to_drop.add(idx)

    if rows_to_drop:
        df = df.drop(index=df.index[list(rows_to_drop)]).copy()

    return df, findings


def _validate_trade_id_uniqueness(df: pd.DataFrame) -> list[Finding]:
    """Check that trade_id values are unique."""
    findings: list[Finding] = []
    if "trade_id" not in df.columns:
        return findings
    ids = df["trade_id"]
    dups = ids[ids.duplicated(keep=False)]
    if len(dups) > 0:
        for trade_id in dups.unique():
            indices = df[df["trade_id"] == trade_id].index.tolist()
            findings.append(
                Finding(
                    finding_id=f"dup_{trade_id}",
                    check_name="duplicate_trade_ids",
                    severity="low",
                    trade_id=trade_id,
                    description=f"Duplicate trade_id found: '{trade_id}'.",
                    evidence=f"trade_id '{trade_id}' appears at row indices {indices}.",
                    limitations=
                        "CSV cannot distinguish intentional from unintentional duplicates.",
                    remediation=
                        "Ensure each trade_id is unique or consolidate duplicate rows.",
                    row_indices=indices,
                )
            )
    return findings


def _validate_timestamps(
    df: pd.DataFrame, *, assume_utc: bool = True,
) -> tuple[pd.DataFrame, list[Finding]]:
    """Validate that timestamps are parseable.

    If assume_utc=True (default) and a timestamp is timezone-naive, we assume UTC
    but emit a finding noting the assumption. The caller can set assume_utc=False
    to reject timezone-naive timestamps entirely.

    Returns (df, findings). Rows with unparseable timestamps are dropped.
    """
    findings: list[Finding] = []
    parseable_mask = pd.Series(True, index=df.index)

    # Attempt parsing; coerce errors to NaT
    parsed = pd.to_datetime(df["timestamp"], errors="coerce")
    unparseable = parsed.isna()
    if unparseable.any():
        for idx in df[unparseable].index:
            tid = df.loc[idx, "trade_id"] if "trade_id" in df.columns else idx
            findings.append(
                Finding(
                    finding_id=f"unparseable_{idx}",
                    check_name="missing_invalid_timestamps",
                    severity="medium",
                    trade_id=tid,
                    description=
                        f"Timestamp could not be parsed: '{df.loc[idx, 'timestamp']}'.",
                    evidence=
                        f"Row {idx}: timestamp value '{df.loc[idx, 'timestamp']}' is not a valid "
                        "ISO-8601 datetime.",
                    limitations=
                        "Cannot determine the intended time of the trade without "
                        "a parseable timestamp. Row is excluded from time-dependent checks.",
                    remediation=
                        "Provide timestamps in ISO-8601 format (e.g. 2023-01-01T10:00:00Z).",
                )
            )
        parseable_mask &= ~unparseable

    df = df[parseable_mask].copy()

    # Assign parsed timestamps back so .dt accessor works preserving timezone
    df["timestamp"] = parsed[parseable_mask]

    # Now check timezone
    if "timestamp" in df.columns:
        # Use dtype to determine timezone awareness:
        # - datetime64[ns, UTC] means timezone-aware UTC
        # - datetime64[ns] means timezone-naive
        tz_naive = df["timestamp"].dt.tz is None
        tz_naive_mask = pd.Series(tz_naive, index=df.index)
        if tz_naive_mask.any():
            if assume_utc:
                # Assume UTC but report
                for idx in df[tz_naive_mask].index:
                    tid = df.loc[idx, "trade_id"] if "trade_id" in df.columns else idx
                    findings.append(
                        Finding(
                            finding_id=f"tz_naive_assumed_{idx}",
                            check_name="missing_invalid_timestamps",
                            severity="low",
                            trade_id=tid,
                            description=
                                "Timezone-naive timestamp assumed UTC. "
                                "Call with assume_utc=False to reject timezone-naive timestamps.",
                            evidence=
                                f"Row {idx}: timestamp '{df.loc[idx, 'timestamp']}' is timezone-naive; "
                                "assumed UTC.",
                            limitations=
                                "If the original timezone was not UTC, results (especially "
                                "time-ordered checks like overlapping trades) may be incorrect. "
                                "User must verify and adjust timestamps accordingly.",
                            remediation=
                                "Attach timezone info to timestamps or explicitly set the "
                                "strategy's timezone.",
                        )
                    )
            else:
                # Reject timezone-naive
                for idx in df[tz_naive_mask].index:
                    tid = df.loc[idx, "trade_id"] if "trade_id" in df.columns else idx
                    findings.append(
                        Finding(
                            finding_id=f"tz_naive_rejected_{idx}",
                            check_name="missing_invalid_timestamps",
                            severity="medium",
                            trade_id=tid,
                            description=
                                "Timezone-naive timestamp rejected. "
                                "Set assume_utc=True to assume UTC, or provide timezone-aware timestamps.",
                            evidence=
                                f"Row {idx}: timestamp '{df.loc[idx, 'timestamp']}' is timezone-naive "
                                "and assume_utc=False.",
                            limitations=
                                "Without timezone info, the true time of the trade cannot be "
                                "determined. Row is excluded from all time-dependent checks.",
                            remediation=
                                "Add timezone to timestamps or use ISO-8601 with explicit "
                                "timezone suffix (e.g. 2023-01-01T10:00:00+00:00).",
                        )
                    )
                # Drop tz-naive rows when assume_utc=False
                df = df[~tz_naive_mask].copy()

    return df, findings


def _validate_pnl_sign(df: pd.DataFrame) -> list[Finding]:
    """Check that pnl sign is consistent with side (MVP convention)."""
    findings: list[Finding] = []
    for _, row in df.iterrows():
        side = str(row.get("side", ""))
        try:
            pnl = float(row.get("pnl", 0.0))
        except (TypeError, ValueError):
            pnl = 0.0
        if side == "buy" and pnl < 0:
            findings.append(
                Finding(
                    finding_id=f"pnl_sig_buy_{row.get('trade_id', '')}",
                    check_name="pnl_sign_inconsistency",
                    severity="medium",
                    trade_id=row.get("trade_id") if "trade_id" in row.index else None,
                    description=
                        f"PNL sign inconsistent with side: buy side has negative pnl "
                        f"({pnl}). Expected positive pnl for a profitable buy, or verify "
                        "that the trade resulted in a loss for other reasons.",
                    evidence=
                        f"Row: side='buy', pnl={pnl}, price={row.get('price', '')}, "
                        f"quantity={row.get('quantity', '')}",
                    limitations=
                        "Per-row sign check only; does not account for multi-trade "
                        "strategies, hedging, or cost basis adjustments. User must verify "
                        "strategy intent.",
                    remediation=
                        "Review the trade context; if the loss is intentional, "
                        "document the rationale. If erroneous, correct the pnl value.",
                )
            )
        elif side == "sell" and pnl > 0:
            findings.append(
                Finding(
                    finding_id=f"pnl_sig_sell_{row.get('trade_id', '')}",
                    check_name="pnl_sign_inconsistency",
                    severity="medium",
                    trade_id=row.get("trade_id") if "trade_id" in row.index else None,
                    description=
                        f"PNL sign inconsistent with side: sell side has positive pnl "
                        f"({pnl}). Expected negative pnl for a profitable sell, or verify "
                        "that the trade resulted in a gain for other reasons.",
                    evidence=
                        f"Row: side='sell', pnl={pnl}, price={row.get('price', '')}, "
                        f"quantity={row.get('quantity', '')}",
                    limitations=
                        "Per-row sign check only; does not account for multi-trade "
                        "strategies, hedging, or cost basis adjustments. User must verify "
                        "strategy intent.",
                    remediation=
                        "Review the trade context; if the gain is intentional, "
                        "document the rationale. If erroneous, correct the pnl value.",
                )
            )
    return findings


def _validate_unrealistic_fees(df: pd.DataFrame) -> list[Finding]:
    """Check that fees are not unreasonably low relative to notional."""
    findings: list[Finding] = []
    for _, row in df.iterrows():
        try:
            fees = (
                float(row["fees"]) if not pd.isna(row["fees"]) else 0.0
            )
        except (KeyError, TypeError):
            fees = 0.0
        try:
            price = float(row["price"])
            quantity = float(row["quantity"])
            notional = price * quantity
        except (KeyError, TypeError, ValueError):
            notional = 0.0
        if notional == 0:
            continue
        try:
            fee_pct = abs(fees) / notional * 100.0
        except (ZeroDivisionError, ValueError):
            fee_pct = 0.0
        if fees < 0:
            findings.append(
                Finding(
                    finding_id=f"neg_fees_{row.get('trade_id', '')}",
                    check_name="unrealistic_transaction_costs",
                    severity="medium",
                    trade_id=row.get("trade_id") if "trade_id" in row.index else None,
                    description=
                        f"Negative fees of {fees} on notional {notional:.4f}. "
                        "Fees should be non-negative.",
                    evidence=
                        f"Row: fees={fees}, price={row.get('price', '')}, "
                        f"quantity={row.get('quantity', '')}",
                    limitations=
                        "Some strategies may have rebate structures; user must "
                        "validate that negative fees are intentional and not a data error.",
                    remediation=
                        "Ensure fees are non-negative; if a rebate, document the "
                        "program.",
                    row_indices=[_],
                )
            )
        elif fee_pct < 0.01:
            findings.append(
                Finding(
                    finding_id=f"low_fees_{row.get('trade_id', '')}",
                    check_name="unrealistic_transaction_costs",
                    severity="medium",
                    trade_id=row.get("trade_id") if "trade_id" in row.index else None,
                    description=
                        f"Unrealistically low transaction fees: {fee_pct:.6f}% of "
                        f"notional {notional:.4f} (threshold: 0.01%). "
                        "Typical equity bid-ask spreads are 0.01%–0.1%; fees below 0.01% "
                        "are suspicious if not explicitly justified.",
                    evidence=
                        f"Row: fees={fees}, price={row.get('price', '')}, "
                        f"quantity={row.get('quantity', '')}, "
                        f"notional={notional:.4f}, fee_pct={fee_pct:.6f}%",
                    limitations=
                        "0.01% threshold is a rule-of-thumb. Some asset classes "
                        "(e.g., crypto exchanges with maker-taker fee tiers) may have lower "
                        "effective fees. User must validate for the relevant asset class.",
                    remediation=
                        "Validate fees against the expected fee structure for the "
                        "traded asset class. If fees are genuinely low, document the reason.",
                    row_indices=[_],
                )
            )
    return findings


def _validate_look_ahead_bias(df: pd.DataFrame) -> list[Finding]:
    """Look-ahead bias check (MVP limitation)."""
    findings: list[Finding] = []
    findings.append(
        Finding(
            finding_id="lb_bias_note",
            check_name="look_ahead_bias",
            severity="high",
            trade_id=None,
            description=
                "Look-ahead bias check: the CSV alone cannot prove the absence of look-ahead bias. "
                "Prices in the CSV may reflect data that was not available at "
                "the trade timestamp. External historical price data is required for a "
                "conclusive determination.",
            evidence="CSV data; no external price comparison performed in MVP.",
            limitations=
                "Requires external historical price data for conclusive determination. "
                "CSV alone cannot prove absence of look-ahead bias. "
                "Per ProofTrade technical principle: 'Never claim a CSV alone proves the "
                "absence of look-ahead bias or survivorship bias.'",
            remediation=
                "Obtain historical market data for the same symbols and timestamp range "
                "and compare trade prices against the volume-weighted average price (VWAP) "
                "or closing price at each trade timestamp. Re-run the audit with the "
                "external data to confirm or refute look-ahead bias.",
        )
    )
    return findings


def _validate_overlapping_trades(df: pd.DataFrame) -> list[Finding]:
    """Check for overlapping trades for the same symbol."""
    findings: list[Finding] = []
    if "symbol" not in df.columns or "timestamp" not in df.columns:
        return findings
    for symbol in df["symbol"].unique():
        sym_df = (
            df[df["symbol"] == symbol]
            .sort_values("timestamp")
            .reset_index()
        )
        if len(sym_df) < 2:
            continue
        for i in range(len(sym_df) - 1):
            t1 = sym_df.loc[i, "timestamp"]
            t2 = sym_df.loc[i + 1, "timestamp"]
            overlap = (
                isinstance(t1, pd.Timestamp)
                and isinstance(t2, pd.Timestamp)
                and t1 == t2
            )
            # True overlap: timestamps are equal (same second).
            if overlap:
                findings.append(
                    Finding(
                        finding_id=f"overlap_{symbol}_{i}_{i+1}",
                        check_name="overlapping_trades",
                        severity="medium",
                        trade_id=None,
                        description=
                            f"Potential overlapping trades for symbol '{symbol}': "
                            f"row indices {sym_df.loc[i, 'trade_id']} and "
                            f"{sym_df.loc[i + 1, 'trade_id']} have adjacent/or equal "
                            f"timestamps (t1={t1}, t2={t2}).",
                        evidence=
                            f"Symbol='{symbol}', row i: trade_id={sym_df.loc[i, 'trade_id']}, "
                            f"timestamp={sym_df.loc[i, 'timestamp']}, side={sym_df.loc[i, 'side']}; "
                            f"row i+1: trade_id={sym_df.loc[i + 1, 'trade_id']}, "
                            f"timestamp={sym_df.loc[i + 1, 'timestamp']}, side={sym_df.loc[i + 1, 'side']}",
                        limitations=
                            "Some strategies intentionally have overlapping executions (e.g., "
                            "scaling in/out of a position). User must verify strategy intent. "
                            "This check flags adjacent timestamps only; deliberate overlap "
                            "per strategy design should be excluded or documented.",
                        remediation=
                            "Review the strategy's position-management logic. If overlap is "
                            "intentional, document it. If unintentional, consolidate or "
                            "correct the duplicate/adjacent entries.",
                        row_indices=[int(sym_df.loc[i, "index"]),
                                     int(sym_df.loc[i + 1, "index"])],
                    )
                )
    return findings


def _validate_survivorship_bias_marker(df: pd.DataFrame) -> list[Finding]:
    """Check for survivorship-bias markers (not proofs)."""
    findings: list[Finding] = []
    n = len(df)
    if n == 0:
        return findings

    # Check 1: 100% win rate
    winning = df["pnl"] > 0
    win_pct = float(winning.sum()) / float(n) * 100.0
    if win_pct >= 100.0:
        findings.append(
            Finding(
                finding_id="sb_100pct_winrate",
                check_name="survivorship_bias_marker",
                severity="medium",
                trade_id=None,
                description=
                    f"Survivorship-bias marker: {win_pct:.1f}% win rate across all {n} "
                    "trades. A 100% win rate is a classic marker of survivorship bias; "
                    "only winning trades/instruments may be reported.",
                evidence=f"Win rate: {win_pct:.1f}% ({winning.sum()} of {n} trades have pnl > 0).",
                limitations=
                    "CSV alone cannot prove the absence of survivorship bias. External "
                    "universe data (including delisted/failed instruments) is required "
                    "for conclusive determination. This marker flags a pattern but does "
                    "not confirm bias.",
                remediation=
                    "Compare performance against a complete universe of instruments, "
                    "including delisted/failed names. If possible, obtain full historical "
                    "data to assess whether the strategy would have survived.",
            )
        )

    # Check 2: tight PnL distribution (very loose marker)
    pnl_series = df["pnl"]
    pnl_std = pnl_series.std()
    if pnl_std > 0 and pnl_std < abs(pnl_series.mean()) * 0.1 and n > 10:
        findings.append(
                Finding(
                    finding_id="sb_tight_pnl_dist",
                    check_name="survivorship_bias_marker",
                    severity="low",
                    trade_id=None,
                    description=
                        "Survivorship-bias marker: PnL distribution is unusually tight "
                        "relative to the mean (std < 10% of |mean|). This may indicate "
                        "selection bias where only winning trades are reported.",
                    evidence=f"PnL std: {pnl_series.std():.4f}, mean: {pnl_series.mean():.4f}, "
                    f"n={n}.",
                    limitations=
                        "Very loose marker. Tight distribution may also arise from a "
                        "strategy with low-volatility signals. External universe data "
                        "required for conclusive determination.",
                    remediation=
                        "Obtain full historical universe data and compare win/loss distribution. "
                        "If only surviving instruments are included, bias may be present.",
                )
            )
    return findings


def _validate_excessive_round_trip_frequency(df: pd.DataFrame) -> list[Finding]:
    """Check for excessive round-trip frequency.

    Heuristic: > 100 round-trip cycles (buy + sell for same symbol) in < 30 days.
    """
    findings: list[Finding] = []
    n = len(df)
    if n < 2:
        return findings

    for symbol in df["symbol"].unique():
        sym_df = (
            df[df["symbol"] == symbol]
            .sort_values("timestamp")
            .reset_index(drop=True)
        )
        if len(sym_df) < 2:
            continue

        buys = sym_df[sym_df["side"] == "buy"]
        sells = sym_df[sym_df["side"] == "sell"]

        if len(buys) > 0 and len(sells) > 0:
            date_range_td = (
                sym_df["timestamp"].max() - sym_df["timestamp"].min()
            )
            if date_range_td.total_seconds() > 0 and date_range_td.total_seconds() < 30 * 24 * 3600:
                n_cycles = min(len(buys), len(sells))
                if n_cycles > 100:
                    findings.append(
                        Finding(
                            finding_id=f"rt_{symbol}",
                            check_name="excessive_round_trip_frequency",
                            severity="medium",
                            trade_id=None,
                            description=
                                f"Excessive round-trip frequency for symbol '{symbol}': "
                                f"{n_cycles} buy-sell cycles in < 30 days (wall-clock) is suspicious. "
                                "Heuristic: > 100 cycles in < 30 days (wall-clock) is suspicious, "
                                "indicating possible churn.",
                            evidence=
                                f"Symbol='{symbol}', buys={len(buys)}, sells={len(sells)}, "
                                f"date_range={date_range_td.total_seconds() // 86400} days, n_cycles={n_cycles}",
                            limitations=
                                "Heuristic threshold (100 in 30 days) is strategy-dependent. "
                                "Some legitimate strategies (scalping, high-frequency mean "
                                "reversion) may legitimately exceed this. User must validate "
                                "for the relevant strategy type.",
                            remediation=
                                "Review the strategy's turnover intent. If high-frequency "
                                "trading is intentional, document the strategy type and "
                                "expected turnover. If unintentional, investigate data "
                                "quality or signal issues.",
                        )
                    )
    return findings


# ===========================================================================
# Metric calculations (deterministic, pure)
# ===========================================================================


def compute_metrics(df: pd.DataFrame) -> dict:
    """Compute deterministic audit summary metrics from a validated DataFrame.

    The DataFrame is expected to have already passed required-field validation,
    timestamp validation, and trade-id uniqueness checks. Invalid rows should
    have been excluded prior to calling this function.

    All calculations are deterministic given the same input.
    """
    n_valid = len(df)
    if n_valid == 0:
        return {
            "total_trades": 0,
            "valid_trades": 0,
            "net_pnl": 0.0,
            "win_rate": 0.0,
            "profit_factor": 0.0,
            "sharpe_ratio": None,
            "max_drawdown": None,
        }

    total_trades = n_valid
    valid_trades = n_valid

    # Gross P&L (sum of pnl field as provided; not recomputed from price/quantity)
    gross_pnl = float(df["pnl"].sum())

    # Total fees and slippage. Both columns are optional: the audit contract only
    # requires trade_id/timestamp/symbol/side/quantity/price/pnl, so a CSV that
    # omits the cost columns must still produce metrics, with costs counted as 0.
    total_fees = float(df["fees"].fillna(0).sum()) if "fees" in df.columns else 0.0
    total_slippage = (
        float(df["slippage"].fillna(0).sum()) if "slippage" in df.columns else 0.0
    )

    # Net P&L
    net_pnl = gross_pnl - total_fees - total_slippage

    # Win rate: count(pnl > 0) / count(pnl != 0)
    pnl_nonzero = df["pnl"][df["pnl"] != 0]
    n_pnl_nonzero = len(pnl_nonzero)
    if n_pnl_nonzero > 0:
        win_rate = float((df["pnl"] > 0).sum()) / n_pnl_nonzero
    else:
        win_rate = 0.0

    # Profit factor: gross total wins / abs(gross total losses)
    gross_wins = float(df.loc[df["pnl"] > 0, "pnl"].sum())
    gross_losses = float(df.loc[df["pnl"] < 0, "pnl"].sum())
    if gross_losses != 0:
        profit_factor = gross_wins / abs(gross_losses)
    else:
        profit_factor = float("inf") if gross_wins > 0 else 0.0

    # Sharpe ratio (annualized)
    sharpe = None
    if n_valid >= 30 and "timestamp" in df.columns:
        try:
            df_sorted = df.sort_values("timestamp").reset_index(drop=True)
            if "price" in df_sorted.columns and not df_sorted["price"].isna().all():
                prices = df_sorted["price"].values.astype(float)
                if len(prices) >= 2:
                    log_returns = np.diff(np.log(prices))
                    mean_ret = float(np.mean(log_returns))
                    std_ret = float(np.std(log_returns, ddof=1))
                    if std_ret > 0:
                        sharpe = math.sqrt(252) * mean_ret / std_ret
            else:
                # Fall back from pnl series
                pnl_values = df_sorted["pnl"].values.astype(float)
                if len(pnl_values) >= 2:
                    log_returns = np.diff(np.log1p(np.abs(pnl_values)))
                    mean_ret = float(np.mean(log_returns))
                    std_ret = float(np.std(log_returns, ddof=1))
                    if std_ret > 0:
                        sharpe = math.sqrt(252) * mean_ret / std_ret
        except Exception:  # noqa: BLE001 - defensive: metric computation over arbitrary user CSV must not crash audit
            sharpe = None

    # Maximum drawdown: peak-to-trough of cumulative P&L
    max_drawdown = None
    if n_valid > 0 and "timestamp" in df.columns:
        try:
            df_sorted = df.sort_values("timestamp").reset_index(drop=True)
            cumulative = df_sorted["pnl"].cumsum()
            peak = cumulative.iloc[0]
            max_dd = 0.0
            for val in cumulative:
                peak = max(peak, val)
                dd = peak - val
                max_dd = max(max_dd, dd)
            max_drawdown = float(max_dd)
        except Exception:  # noqa: BLE001 - defensive: metric computation over arbitrary user CSV must not crash audit
            max_drawdown = None

    pf_display = (
        round(profit_factor, 4) if not math.isinf(profit_factor) else "inf"
    )
    sr_display = round(sharpe, 4) if sharpe is not None else None
    md_display = round(max_drawdown, 4) if max_drawdown is not None else None

    return {
        "total_trades": total_trades,
        "valid_trades": valid_trades,
        "net_pnl": round(net_pnl, 4),
        "win_rate": round(win_rate, 4),
        "profit_factor": pf_display,
        "sharpe_ratio": sr_display,
        "max_drawdown": md_display,
    }


# ===========================================================================
# Orchestration function
# ===========================================================================


def run_audit(
    csv_data: str,
    *,
    assume_utc: bool = True,
) -> dict:
    """Run the full audit pipeline on a CSV string.

    Parameters:
        csv_data: Raw CSV text (header + rows).
        assume_utc: If True (default), timezone-naive timestamps are assumed UTC
            with a low-severity finding. If False, timezone-naive timestamps are
            rejected with a medium-severity finding.

    Returns a dict with keys:
        - dataset_id: UUID string generated for this run
        - row_count: number of rows in the original CSV
        - findings: list of finding dicts
        - summary: metric dict
    """
    import uuid as _uuid

    dataset_id = str(_uuid.uuid4())

    # Parse CSV
    df = pd.read_csv(io.StringIO(csv_data))
    row_count = len(df)

    # Step 1: Validate required fields
    df, findings = _validate_required_fields(df)

    # Step 2: Validate trade ID uniqueness
    findings += _validate_trade_id_uniqueness(df)

    # Step 3: Validate timestamps
    df, ts_findings = _validate_timestamps(df, assume_utc=assume_utc)
    findings.extend(ts_findings)

    # Step 4: PNL sign consistency
    findings += _validate_pnl_sign(df)

    # Step 5: Unrealistic fees
    findings += _validate_unrealistic_fees(df)

    # Step 6: Look-ahead bias (MVP limitation)
    findings += _validate_look_ahead_bias(df)

    # Step 7: Overlapping trades
    findings += _validate_overlapping_trades(df)

    # Step 8: Survivorship bias marker
    findings += _validate_survivorship_bias_marker(df)

    # Step 9: Excessive round-trip frequency
    findings += _validate_excessive_round_trip_frequency(df)

    # Convert findings to dicts for JSON serialization
    findings_dicts = []
    for f in findings:
        findings_dicts.append(
            {
                "finding_id": f.finding_id,
                "check_name": f.check_name,
                "severity": f.severity,
                "trade_id": f.trade_id,
                "description": f.description,
                "evidence": f.evidence,
                "limitations": f.limitations,
                "remediation": f.remediation,
                "row_indices": f.row_indices,
            }
        )

    # Compute metrics on the remaining valid df
    summary = compute_metrics(df)

    summary_dict = {
        "total_trades": summary["total_trades"],
        "valid_trades": summary["valid_trades"],
        "net_pnl": summary["net_pnl"],
        "win_rate": summary["win_rate"],
        "profit_factor": summary["profit_factor"],
        "sharpe_ratio": summary["sharpe_ratio"],
        "max_drawdown": summary["max_drawdown"],
    }

    return {
        "dataset_id": dataset_id,
        "row_count": row_count,
        "findings": findings_dicts,
        "summary": summary_dict,
    }