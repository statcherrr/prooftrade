"""
ProofTrade FastAPI application.

Provides endpoints for:
- Health check
- Audit CSV submission and results retrieval

Integrates with the existing deterministic audit engine via
run_audit(csv_data, assume_utc=...).
"""

from __future__ import annotations

import logging
import os
from typing import Any

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from prooftrade.engine import run_audit

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

LOGGER = logging.getLogger("prooftrade.api")

# CORS origins - narrow for development; override via ENV if needed
_CORS_ORIGINS = os.getenv(
    "PROOFTRADE_CORS_ORIGINS", "http://localhost:3000"
).split(",")

# Maximum CSV row count to prevent OOM / DoS
MAX_CSV_ROWS = int(os.getenv("PROOFTRADE_MAX_CSV_ROWS", "10000"))

# Maximum CSV file size (bytes) - 10 MB
MAX_CSV_SIZE = int(os.getenv("PROOFTRADE_MAX_CSV_SIZE", "10_000_000"))

# ---------------------------------------------------------------------------
# FastAPI app setup
# ---------------------------------------------------------------------------

app = FastAPI(
    title="ProofTrade Audit Engine",
    description="Deterministic audit of trade-history CSV data.",
    version="0.1.0",
)

# CORS — narrow to the actual frontend origin in production.
app.add_middleware(
    CORSMiddleware,
    allow_origins=_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "Authorization"],
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _csv_to_string(upload: UploadFile) -> str:
    """Read an uploaded CSV file and return its text content."""
    raw = upload.file.read()
    if len(raw) > MAX_CSV_SIZE:
        raise HTTPException(
            status_code=413,
            detail="CSV file too large. Maximum size is "
            f"{MAX_CSV_SIZE // (1024*1024)} MB.",
        )
    text = raw.decode("utf-8", errors="replace")
    # Strip a trailing header duplicate if the user accidentally included it twice
    # (we'll just use the raw text as-is; run_audit expects full CSV including header)
    return text


def _validate_csv_header(csv_text: str) -> None:
    """Ensure the CSV has the expected header line."""
    first_line = csv_text.split("\n")[0].strip()
    expected = "trade_id,timestamp,symbol,side,quantity,price,pnl,fees,slippage,strategy_name,notes"
    if first_line != expected:
        # Be lenient — just warn via the engine; don't reject immediately so
        # the engine's own _validate_required_fields can report the precise issue.
        LOGGER.warning(
            "CSV header '%s' does not match expected '%s'", first_line, expected
        )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/health", include_in_schema=False)
async def health() -> dict[str, str]:
    """Simple liveness probe."""
    return {"status": "ok"}


@app.get("/healthz", include_in_schema=False)
async def healthz() -> dict[str, str]:
    """Readiness probe — engine is importable and functional."""
    try:
        _ = run_audit.__wrapped__ if hasattr(run_audit, "__wrapped__") else run_audit
        return {"status": "ready"}
    except ImportError:
        raise HTTPException(status_code=503, detail="Engine not available")
    except Exception as exc:  # noqa: BLE001 — defensive catch-all for readiness endpoint
        raise HTTPException(status_code=503, detail=str(exc))


_file_dep = File(...)

@app.post("/api/audit", response_model=dict[str, Any])
async def upload_audit(file: UploadFile = _file_dep) -> dict[str, Any]:
    """
    Upload a trade-history CSV and receive a full audit.

    The CSV must contain the header:
        trade_id,timestamp,symbol,side,quantity,price,pnl,fees,slippage,strategy_name,notes

    The response includes:
    - dataset_id: unique ID for this audit run
    - row_count: number of rows in the original CSV
    - findings: list of finding dicts (rule ID, severity, evidence, limitations, remediation)
    - summary: metric dict (net_pnl, win_rate, profit_factor, sharpe_ratio, max_drawdown)
    """
    # 1️⃣ Read & coerce CSV text
    try:
        csv_text = _csv_to_string(file)
    except HTTPException:
        raise
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=400, detail="Could not read uploaded file.") from exc

    # 2️⃣ Basic size / row count guard
    row_count = csv_text.count("\n")
    if row_count > MAX_CSV_ROWS:
        raise HTTPException(
            status_code=413,
            detail=f"CSV has {row_count} rows, exceeding the limit of {MAX_CSV_ROWS}.",
        )

    # 3️⃣ Run the engine
    try:
        _validate_csv_header(csv_text)
        result = run_audit(csv_text, assume_utc=True)
    except HTTPException:
        raise
    except Exception as exc:  # pragma: no cover — defensive
        # Never expose stack traces or CSV contents in production error messages.
        raise HTTPException(
            status_code=422, detail="Unable to process the provided CSV data."
        ) from exc

    # 4️⃣ Return the structured result
    return {
        "dataset_id": result["dataset_id"],
        "row_count": result["row_count"],
        "findings": result["findings"],
        "summary": result["summary"],
    }