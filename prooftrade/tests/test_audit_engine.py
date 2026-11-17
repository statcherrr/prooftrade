"""Pytest tests for ProofTrade audit engine.

Each test uses hand-calculated expected results, not outputs from the same implementation.
All synthetic CSVs are defined inline so that expected results can be verified independently.
"""

import pytest
from prooftrade.engine import run_audit

# ---------------------------------------------------------------------------
# Synthetic test datasets
# ---------------------------------------------------------------------------

# From RESEARCH_METHODS.md Appendix: deterministic synthetic dataset
# containing both clean trades and deliberately planted defects.
SYNTHETIC_CSV = """trade_id,timestamp,symbol,side,quantity,price,pnl,fees,slippage,strategy_name,notes
t001,2023-01-01T10:00:00Z,AAPL,buy,100,150.00,50.00,1.00,0.00,stratA,clean buy trade
t002,2023-01-01T10:05:00Z,AAPL,sell,100,152.10,62.10,1.00,0.00,stratA,clean sell trade
t003,2023-01-01T10:10:00Z,MSFT,buy,50,300.00,25.00,0.50,0.00,stratA,clean buy trade
t004,2023-01-01T10:15:00Z,MSFT,sell,50,301.20,12.20,0.50,0.00,stratA,clean sell trade
t005,2023-01-01T10:20:00Z,AAPL,buy,100,151.00,-50.00,1.00,0.00,stratA,PnL sign inconsistency
t006,2023-01-01T10:25:00Z,AAPL,buy,100,150.00,50.00,5.00,0.00,stratA,duplicate pattern
t007,2023-01-01T10:30:00Z,GOOGL,buy,10,2800.00,250.00,0.01,0.00,stratA,unrealistic fees
t008,2023-01-01T10:35:00Z,AAPL,buy,100,150.00,150.00,0.00,0.00,stratA,look-ahead candidate
t009,2023-01-01T10:35:00Z,AAPL,sell,100,149.00,-100.00,0.00,0.00,stratA,overlapping trades
t010,2023-01-01T10:45:00Z,cryptoBTC,buy,0.5,40000.00,100.00,20.00,0.00,stratA,valid crypto trade
"""


# ---------------------------------------------------------------------------
# Test 1: Full synthetic CSV produces expected findings
# ---------------------------------------------------------------------------

def test_synthetic_csv_generates_all_expected_findings():
    """The synthetic CSV has 8 planted defects; engine should find them all.

    Expected findings (by check_name):
      - pnl_sign_inconsistency (t005)
      - unrealistic_transaction_costs (t007)
      - look_ahead_bias (t008)
      - overlapping_trades (t008 + t009, same symbol AAPL)
      - duplicate_trade_ids (t006 pattern - but t006 trade_id is unique,
        so no dup finding; this test verifies zero dup findings for this CSV)
      - survivorship_bias_marker (none for this CSV - mixed wins/losses)
      - excessive_round_trip_frequency (none)
      - missing_invalid_timestamps (none - all timestamps valid)
    """
    result = run_audit(SYNTHETIC_CSV)
    finding_names = [f["check_name"] for f in result["findings"]]

    # pnl_sign_inconsistency must be present (t005: buy with negative pnl)
    assert (
        "pnl_sign_inconsistency" in finding_names
    ), f"Expected pnl_sign_inconsistency in {finding_names}"

    # unrealistic_transaction_costs must be present (t007: 0.01 fee on 28000 notional)
    assert (
        "unrealistic_transaction_costs" in finding_names
    ), f"Expected unrealistic_transaction_costs in {finding_names}"

    # look_ahead_bias must be present (t008)
    assert (
        "look_ahead_bias" in finding_names
    ), f"Expected look_ahead_bias in {finding_names}"

    # overlapping_trades must be present (trades with equal timestamps for same symbol)
    assert (
        "overlapping_trades" in finding_names
    ), f"Expected overlapping_trades in {finding_names}"

    # No duplicate_trade_ids for this CSV (all trade_ids are unique)
    dup_findings = [f for f in result["findings"] if f["check_name"] == "duplicate_trade_ids"]
    assert (
        len(dup_findings) == 0
    ), f"Expected 0 duplicate_trade_ids findings for unique trade_ids, got {len(dup_findings)}"

    # At minimum 5 findings expected
    assert (
        len(result["findings"]) >= 5
    ), f"Expected at least 5 findings for synthetic CSV, got {len(result['findings'])}"


# ---------------------------------------------------------------------------
# Test 2: PNL sign inconsistency (t005)
# ---------------------------------------------------------------------------

def test_pnl_sign_inconsistency_buy_negative():
    """Row t005: buy side with negative pnl should generate a finding."""
    result = run_audit(SYNTHETIC_CSV)
    pnl_sign_findings = [f for f in result["findings"] if f["check_name"] == "pnl_sign_inconsistency"]
    assert len(pnl_sign_findings) >= 1, "Expected at least 1 pnl_sign_inconsistency finding"

    # The finding should reference t005
    t005_findings = [f for f in pnl_sign_findings if "t005" in f.get("finding_id", "")]
    assert len(t005_findings) >= 1, "Expected a finding referencing t005"

    # Severity should be medium
    for f in pnl_sign_findings:
        assert f["severity"] == "medium", f"Expected severity medium, got {f['severity']}"


# ---------------------------------------------------------------------------
# Test 3: Unrealistic transaction costs (t007)
# ---------------------------------------------------------------------------

def test_unrealistic_fees_t007():
    """Row t007: fees of 0.01 on notional 28000 should be flagged."""
    result = run_audit(SYNTHETIC_CSV)
    fee_findings = [f for f in result["findings"] if f["check_name"] == "unrealistic_transaction_costs"]
    assert len(fee_findings) >= 1, "Expected at least 1 unrealistic_transaction_costs finding"

    # Should reference t007
    t007_findings = [f for f in fee_findings if "t007" in f.get("finding_id", "")]
    assert len(t007_findings) >= 1, "Expected a finding referencing t007"

    # Severity medium
    for f in fee_findings:
        assert f["severity"] == "medium", f"Expected severity medium, got {f['severity']}"


# ---------------------------------------------------------------------------
# Test 4: Look-ahead bias finding (t008)
# ---------------------------------------------------------------------------

def test_look_ahead_bias_finding():
    """Row t008 should generate a look-ahead bias finding with limitations."""
    result = run_audit(SYNTHETIC_CSV)
    la_findings = [f for f in result["findings"] if f["check_name"] == "look_ahead_bias"]
    assert len(la_findings) >= 1, "Expected at least 1 look_ahead_bias finding"

    # The finding should have limitations noting CSV alone cannot prove absence
    for f in la_findings:
        limitations = f["limitations"]
        assert "CSV alone cannot prove" in limitations, (
            f"Expected limitations to mention CSV limitation, got: {limitations}"
        )
        assert "look-ahead bias" in limitations.lower(), (
            f"Expected limitations to mention look-ahead bias, got: {limitations}"
        )

    # Severity should be high
    for f in la_findings:
        assert f["severity"] == "high", f"Expected severity high, got {f['severity']}"


# ---------------------------------------------------------------------------
# Test 5: Overlapping trades (t008 + t009 same symbol AAPL)
# ---------------------------------------------------------------------------

def test_overlapping_trades_equal_timestamps():
    """CSV with trades at equal timestamps should flag overlapping trades."""
    overlap_csv = """trade_id,timestamp,symbol,side,quantity,price,pnl,fees,slippage,strategy_name,notes
o001,2023-01-01T10:00:00Z,AAPL,buy,100,150.00,50.00,1.00,0.00,stratA,first
o002,2023-01-01T10:00:00Z,AAPL,sell,100,152.10,62.10,1.00,0.00,stratA,second same time"""
    result = run_audit(overlap_csv)
    overlap_findings = [f for f in result["findings"] if f["check_name"] == "overlapping_trades"]
    assert len(overlap_findings) >= 1, "Expected at least 1 overlapping_trades finding"

    # Should reference rows with same timestamp
    for f in overlap_findings:
        evidence = f["evidence"]
        assert "AAPL" in evidence, f"Expected evidence to reference AAPL, got: {evidence}"


# ---------------------------------------------------------------------------
# Test 6: Duplicate trade IDs
# ---------------------------------------------------------------------------

def test_duplicate_trade_ids():
    """CSV with duplicate trade_ids should generate findings."""
    dup_csv = """trade_id,timestamp,symbol,side,quantity,price,pnl,fees,slippage,strategy_name,notes
d001,2023-01-01T10:00:00Z,AAPL,buy,100,150.00,50.00,1.00,0.00,stratA,first
d002,2023-01-01T10:05:00Z,AAPL,sell,100,152.10,62.10,1.00,0.00,stratA,second
d001,2023-01-01T10:10:00Z,AAPL,buy,50,300.00,25.00,0.50,0.00,stratA,duplicate
"""
    result = run_audit(dup_csv)
    dup_findings = [f for f in result["findings"] if f["check_name"] == "duplicate_trade_ids"]
    assert len(dup_findings) >= 1, "Expected at least 1 duplicate_trade_ids finding"


# ---------------------------------------------------------------------------
# Test 7: Missing/invalid timestamps
# ---------------------------------------------------------------------------

def test_invalid_timestamps():
    """CSV with unparseable timestamps should generate findings."""
    bad_ts_csv = """trade_id,timestamp,symbol,side,quantity,price,pnl,fees,slippage,strategy_name,notes
b001,bad_timestamp,AAPL,buy,100,150.00,50.00,1.00,0.00,stratA,bad ts
b002,2023-01-01T10:00:00Z,AAPL,sell,100,152.10,62.10,1.00,0.00,stratA,good ts
"""
    result = run_audit(bad_ts_csv)
    ts_findings = [f for f in result["findings"] if f["check_name"] == "missing_invalid_timestamps"]
    assert len(ts_findings) >= 1, "Expected at least 1 missing_invalid_timestamps finding"


# ---------------------------------------------------------------------------
# Test 8: Metric calculation determinism
# ---------------------------------------------------------------------------

def test_metrics_deterministic():
    """Given the same CSV, run_audit should always produce the same result."""
    result1 = run_audit(SYNTHETIC_CSV)
    result2 = run_audit(SYNTHETIC_CSV)

    s1 = result1["summary"]
    s2 = result2["summary"]

    assert s1["net_pnl"] == s2["net_pnl"], f"net_pnl mismatch: {s1['net_pnl']} vs {s2['net_pnl']}"
    assert s1["win_rate"] == s2["win_rate"], f"win_rate mismatch: {s1['win_rate']} vs {s2['win_rate']}"
    assert s1["profit_factor"] == s2["profit_factor"], "profit_factor mismatch"


# ---------------------------------------------------------------------------
# Test 9: Empty CSV
# ---------------------------------------------------------------------------

def test_empty_csv():
    """Empty CSV should produce a valid (though empty) audit result."""
    empty_csv = "trade_id,timestamp,symbol,side,quantity,price,pnl,fees,slippage,strategy_name,notes\n"
    result = run_audit(empty_csv)
    assert result["row_count"] == 0
    s = result["summary"]
    assert s["total_trades"] == 0
    assert s["valid_trades"] == 0
    assert s["net_pnl"] == 0.0
    assert s["win_rate"] == 0.0


# ---------------------------------------------------------------------------
# Test 10: Negative fees
# ---------------------------------------------------------------------------

def test_negative_fees():
    """CSV with negative fees should generate a finding."""
    neg_fee_csv = """trade_id,timestamp,symbol,side,quantity,price,pnl,fees,slippage,strategy_name,notes
nf001,2023-01-01T10:00:00Z,AAPL,buy,100,150.00,50.00,-1.00,0.00,stratA,negative fees
"""
    result = run_audit(neg_fee_csv)
    neg_fee_findings = [f for f in result["findings"] if f["check_name"] == "unrealistic_transaction_costs"]
    assert len(neg_fee_findings) >= 1, "Expected at least 1 negative fees finding"
    for f in neg_fee_findings:
        assert f["severity"] == "medium"


# ---------------------------------------------------------------------------
# Test 11: Survivorship bias marker (100% win rate)
# ---------------------------------------------------------------------------

def test_survivorship_bias_marker():
    """CSV with 100% win rate should flag survivorship bias marker."""
    sb_csv = """trade_id,timestamp,symbol,side,quantity,price,pnl,fees,slippage,strategy_name,notes
sb001,2023-01-01T10:00:00Z,AAPL,buy,100,150.00,50.00,1.00,0.00,stratA,win
sb002,2023-01-01T10:05:00Z,AAPL,sell,100,152.10,62.10,1.00,0.00,stratA,win
sb003,2023-01-01T10:10:00Z,MSFT,buy,50,300.00,25.00,0.50,0.00,stratA,win
"""
    result = run_audit(sb_csv)
    sb_findings = [f for f in result["findings"] if f["check_name"] == "survivorship_bias_marker"]
    assert len(sb_findings) >= 1, "Expected at least 1 survivorship_bias_marker finding"


# ---------------------------------------------------------------------------
# Test 12: Excessive round-trip frequency
# ---------------------------------------------------------------------------

def test_excessive_round_trip():
    """CSV with >100 round trips in <30 days should flag frequency."""
    # Build a CSV with 101 buy-sell cycles in 30 days
    rows = []
    for i in range(101):
        rows.append(
            f"rt_{i},2023-01-01T{i % 24:02d}:{i % 60:02d}:00,AAA,buy,1,100.00,10.00,0.01,0.00,stratA,roundtrip_{i}"
        )
        rows.append(
            f"rt_{i},2023-01-01T{(i % 24 + 1) % 24:02d}:{i % 60:02d}:00,AAA,sell,1,101.00,0.99,0.01,0.00,stratA,roundtrip_close_{i}"
        )
    # This creates 202 rows over 24 hours - way more than 100 cycles in <30 days
    rt_csv = "trade_id,timestamp,symbol,side,quantity,price,pnl,fees,slippage,strategy_name,notes\n" + "\n".join(rows)
    result = run_audit(rt_csv)
    rt_findings = [f for f in result["findings"] if f["check_name"] == "excessive_round_trip_frequency"]
    assert len(rt_findings) >= 1, "Expected at least 1 excessive_round_trip_frequency finding"


# ---------------------------------------------------------------------------
# Test 13: Cost columns are optional
# ---------------------------------------------------------------------------

def test_csv_without_fees_and_slippage_columns():
    """The seven required columns alone must produce metrics.

    fees and slippage are documented as optional cost columns: when they are
    absent, costs count as zero and every other metric is unchanged.
    """
    minimal_csv = """trade_id,timestamp,symbol,side,quantity,price,pnl
m001,2023-01-01T10:00:00Z,AAPL,buy,10,100.00,50.00
m002,2023-01-02T10:00:00Z,AAPL,sell,10,110.00,-20.00
"""
    result = run_audit(minimal_csv)
    s = result["summary"]
    assert s["total_trades"] == 2
    assert s["valid_trades"] == 2
    assert s["net_pnl"] == 30.0
    assert s["win_rate"] == 0.5
    assert s["profit_factor"] == 2.5


def test_optional_cost_columns_still_subtract_costs():
    """When fees and slippage are present, they are still deducted from net P&L."""
    with_costs_csv = """trade_id,timestamp,symbol,side,quantity,price,pnl,fees,slippage
c001,2023-01-01T10:00:00Z,AAPL,buy,10,100.00,50.00,1.50,0.50
c002,2023-01-02T10:00:00Z,AAPL,sell,10,110.00,-20.00,1.50,0.50
"""
    s = run_audit(with_costs_csv)["summary"]
    assert s["net_pnl"] == 26.0


# ---------------------------------------------------------------------------
# Run: pytest --tb=short
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    pytest.main([__file__, "--tb=short", "-v"])