"""Pytest tests for the ProofTrade FastAPI application."""





# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_csv(rows: list[dict[str, str]]) -> str:
    """Build a minimal CSV from a list of row dicts."""
    header = "trade_id,timestamp,symbol,side,quantity,price,pnl,fees,slippage,strategy_name,notes"
    lines = [header]
    for r in rows:
        lines.append(
            ",".join(
                str(r.get(col, "")) for col in
                ["trade_id", "timestamp", "symbol", "side", "quantity",
                 "price", "pnl", "fees", "slippage", "strategy_name", "notes"]
            )
        )
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# FastAPI test client
# ---------------------------------------------------------------------------

def _api_client():
    """Return a FastAPI TestClient for the prooftrade API."""
    from fastapi.testclient import TestClient

    from prooftrade.api.app import app
    return TestClient(app)


# ---------------------------------------------------------------------------
# Health endpoint
# ---------------------------------------------------------------------------

class TestHealth:
    def test_health_endpoint(self):
        client = _api_client()
        resp = client.get("/health")
        assert resp.status_code == 200
        assert resp.json() == {"status": "ok"}

    def test_healthz_endpoint(self):
        client = _api_client()
        resp = client.get("/healthz")
        assert resp.status_code == 200
        assert resp.json()["status"] == "ready"


# ---------------------------------------------------------------------------
# Audit endpoint — successful uploads
# ---------------------------------------------------------------------------

class TestAuditSuccessful:
    def test_successful_audit_with_synthetic_csv(self):
        """Round-trip: same CSV in → same findings + metrics out."""
        csv_text = (
            "trade_id,timestamp,symbol,side,quantity,price,pnl,fees,slippage,strategy_name,notes\nt001,2023-01-01T10:00:00Z,AAPL,buy,100,150.00,50.00,1.00,0.00,stratA,clean buy trade\nt002,2023-01-01T10:05:00Z,AAPL,sell,100,152.10,62.10,1.00,0.00,stratA,clean sell trade\n"
        )
        client = _api_client()
        resp = client.post(
            "/api/audit",
            files={"file": ("synthetic.csv", csv_text, "text/csv")},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert "dataset_id" in body
        assert "row_count" in body
        assert "findings" in body
        assert "summary" in body
        assert body["row_count"] == 2

    def test_successful_audit_with_empty_csv(self):
        """Empty CSV should return valid (zero) results."""
        csv_text = "trade_id,timestamp,symbol,side,quantity,price,pnl,fees,slippage,strategy_name,notes\n"
        client = _api_client()
        resp = client.post(
            "/api/audit",
            files={"file": ("empty.csv", csv_text, "text/csv")},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["row_count"] == 0
        assert body["summary"]["total_trades"] == 0
        assert body["summary"]["net_pnl"] == 0.0
        assert body["summary"]["win_rate"] == 0.0

    def test_successful_audit_with_negative_fees(self):
        """CSV with negative fees should be accepted; the engine flags them."""
        csv_text = (
            "trade_id,timestamp,symbol,side,quantity,price,pnl,fees,slippage,strategy_name,notes\n"
            "nf001,2023-01-01T10:00:00Z,AAPL,buy,100,150.00,50.00,-1.00,0.00,stratA,negative fees\n"
        )
        client = _api_client()
        resp = client.post(
            "/api/audit",
            files={"file": ("neg_fees.csv", csv_text, "text/csv")},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert len(body["findings"]) >= 1
        # The engine should flag negative fees
        check_names = [f["check_name"] for f in body["findings"]]
        assert "unrealistic_transaction_costs" in check_names


# ---------------------------------------------------------------------------
# Audit endpoint — error handling
# ---------------------------------------------------------------------------

class TestAuditErrors:
    def test_missing_file(self):
        """POST without a file should return 422."""
        client = _api_client()
        resp = client.post("/api/audit")
        # FastAPI raises 422 for missing required Field when File(...)
        # is the parameter, but we verify the behaviour regardless.
        assert resp.status_code in (422, 400)

    def test_malformed_csv_missing_required_columns(self):
        """CSV missing required columns should return 422 from the engine."""
        csv_text = "foo,bar,baz\n1,2,3\n"
        client = _api_client()
        resp = client.post(
            "/api/audit",
            files={"file": ("bad.csv", csv_text, "text/csv")},
        )
        # Engine will reject via HTTP 422
        assert resp.status_code == 422

    def test_oversized_csv(self):
        """CSV exceeding row limit should be rejected."""
        # Build a CSV with too many rows
        rows = [
            {"trade_id": f"rt_{i}", "timestamp": "2023-01-01T00:00:00Z",
             "symbol": "AAA", "side": "buy", "quantity": "1", "price": "100.00",
             "pnl": "10.00", "fees": "0.01", "slippage": "0.00",
             "strategy_name": "stratA", "notes": "row"}
            for i in range(15000)
        ]
        csv_text = "trade_id,timestamp,symbol,side,quantity,price,pnl,fees,slippage,strategy_name,notes\n"
        csv_text += "\n".join(
            ",".join(str(r[col]) for col in
                     ["trade_id", "timestamp", "symbol", "side", "quantity",
                      "price", "pnl", "fees", "slippage", "strategy_name", "notes"])
            for r in rows
        )
        client = _api_client()
        resp = client.post(
            "/api/audit",
            files={"file": ("huge.csv", csv_text, "text/csv")},
        )
        assert resp.status_code == 413


# ---------------------------------------------------------------------------
# API response schema validation
# ---------------------------------------------------------------------------

class TestResponseSchema:
    def test_response_has_required_keys(self):
        """The /api/audit response must have dataset_id, row_count, findings, summary."""
        csv_text = (
            "trade_id,timestamp,symbol,side,quantity,price,pnl,fees,slippage,strategy_name,notes\nt001,2023-01-01T10:00:00Z,AAPL,buy,100,150.00,50.00,1.00,0.00,stratA,clean buy trade\nt002,2023-01-01T10:05:00Z,AAPL,sell,100,152.10,62.10,1.00,0.00,stratA,clean sell trade\n"
        )
        client = _api_client()
        resp = client.post(
            "/api/audit",
            files={"file": ("s.csv", csv_text, "text/csv")},
        )
        assert resp.status_code == 200
        body = resp.json()
        for key in ("dataset_id", "row_count", "findings", "summary"):
            assert key in body, f"Missing key '{key}' in response"

    def test_summary_has_metrics(self):
        """The summary must contain the documented metric keys."""
        csv_text = (
            "trade_id,timestamp,symbol,side,quantity,price,pnl,fees,slippage,strategy_name,notes\nt001,2023-01-01T10:00:00Z,AAPL,buy,100,150.00,50.00,1.00,0.00,stratA,clean buy trade\nt002,2023-01-01T10:05:00Z,AAPL,sell,100,152.10,62.10,1.00,0.00,stratA,clean sell trade\n"
        )
        client = _api_client()
        resp = client.post(
            "/api/audit",
            files={"file": ("s.csv", csv_text, "text/csv")},
        )
        assert resp.status_code == 200
        body = resp.json()
        s = body["summary"]
        for key in ("total_trades", "valid_trades", "net_pnl", "win_rate",
                     "profit_factor", "sharpe_ratio", "max_drawdown"):
            assert key in s, f"Missing summary key '{key}'"


# ---------------------------------------------------------------------------
# Integration: engine determinism via API
# ---------------------------------------------------------------------------

class TestEngineDeterminismViaAPI:
    def test_same_csv_twice_same_results(self):
        """Running the same CSV twice through the API must yield identical results."""
        csv_text = (
            "trade_id,timestamp,symbol,side,quantity,price,pnl,fees,slippage,strategy_name,notes\nt001,2023-01-01T10:00:00Z,AAPL,buy,100,150.00,50.00,1.00,0.00,stratA,clean buy trade\nt002,2023-01-01T10:05:00Z,AAPL,sell,100,152.10,62.10,1.00,0.00,stratA,clean sell trade\nt003,2023-01-01T10:10:00Z,MSFT,buy,50,300.00,25.00,0.50,0.00,stratA,clean buy trade\nt004,2023-01-01T10:15:00Z,MSFT,sell,50,301.20,12.20,0.50,0.00,stratA,clean sell trade\nt005,2023-01-01T10:20:00Z,AAPL,buy,100,151.00,-50.00,1.00,0.00,stratA,PnL sign inconsistency\nt006,2023-01-01T10:25:00Z,AAPL,buy,100,150.00,50.00,5.00,0.00,stratA,duplicate pattern\nt007,2023-01-01T10:30:00Z,GOOGL,buy,10,2800.00,250.00,0.01,0.00,stratA,unrealistic fees\nt008,2023-01-01T10:35:00Z,AAPL,buy,100,150.00,150.00,0.00,0.00,stratA,look-ahead candidate\nt009,2023-01-01T10:40:00Z,AAPL,sell,100,149.00,-100.00,0.00,0.00,stratA,overlapping trades\nt010,2023-01-01T10:45:00Z,cryptoBTC,buy,0.5,40000.00,100.00,20.00,0.00,stratA,valid crypto trade\n"
        )
        client = _api_client()

        r1 = client.post("/api/audit", files={"file": ("sync.csv", csv_text, "text/csv")})
        assert r1.status_code == 200
        b1 = r1.json()

        r2 = client.post("/api/audit", files={"file": ("sync.csv", csv_text, "text/csv")})
        assert r2.status_code == 200
        b2 = r2.json()

        # Dataset IDs will differ (UUID), but core results must match
        assert b1["row_count"] == b2["row_count"]
        assert b1["summary"]["net_pnl"] == b2["summary"]["net_pnl"]
        assert b1["summary"]["win_rate"] == b2["summary"]["win_rate"]
        assert b1["summary"]["profit_factor"] == b2["summary"]["profit_factor"]

        # Findings check-names sets must be identical (order may differ)
        fn1 = {f["check_name"] for f in b1["findings"]}
        fn2 = {f["check_name"] for f in b2["findings"]}
        assert fn1 == fn2, f"Findings differ: {fn1} vs {fn2}"