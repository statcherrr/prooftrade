# ProofTrade — Engineering Specification

## 1. Target User and Problem Statement

**Target user:** Quantitative researchers, portfolio managers, and compliance analysts who need to audit historical trading strategy results for data quality and integrity issues. Users typically have CSV or Excel datasets of historical trades/P&L and need automated, reproducible checks to surface problems before live deployment.

**Problem:** Manual audit of strategy results is time-consuming, inconsistent, and prone to oversight. Common issues include:
- Misaligned trade timestamps (timezone ambiguities)
- Unrealistic transaction cost assumptions
- Survivorship bias in reported performance
- Look-ahead bias in signal/execution timing
- Overlapping or duplicate trades
- Survivorship-biased return calculations
- Missing or imputed data without disclosure

ProofTrade provides deterministic, explainable audit checks that identify these problems without making predictive claims.

## 2. MVP Scope

### In Scope (MVP)
- CSV ingest with defined data contract (see Section 3)
- Eight core audit checks (see Section 5)
- Severity scoring per finding
- API for submitting audits and retrieving results (see Section 6)
- Deterministic synthetic test dataset (see Section 7)
- Basic web frontend for file upload and results display
- JSON-backed API (no auth in MVP; auth can be added post-MVP)

### Out of Scope (Explicit Non-Goals)
- Real-money or live broker integration
- Paid data services (Alphavantage, Bloomberg, etc.)
- Predictive claims, alpha generation, or trading recommendations
- User authentication or persistent accounts in MVP
- Deployment to production (Docker, CI/CD, etc.)
- Long-term data storage or database persistence
- Mobile applications
- Real-time data feeds
- Any LLM-generated financial calculations

## 3. CSV Data Contract

### Required Fields (per trade row)

| Field | Type | Unit | Description |
|-------|------|------|-------------|
| `trade_id` | string | — | Unique identifier for the trade. Must be unique within the dataset. |
| `timestamp` | datetime | UTC | Entry/exit time of the trade. Must be parseable as ISO-8601 or UTC-friendly format. |
| `symbol` | string | — | Ticker symbol (e.g., "AAPL", "ES=F"). |
| `side` | string {`buy`, `sell`} | — | Order side. |
| `quantity` | float | shares / contracts | Number of units traded. Must be > 0. |
| `price` | float | currency per unit | Execution price. Must be > 0. |
| `pnl` | float | currency | Profit and loss realized from the trade. Must be consistent with side, price, and quantity. |

### Optional Fields

| Field | Type | Unit | Description |
|-------|------|------|-------------|
| `fees` | float | currency | Transaction fees associated with the trade. Defaults to 0 if absent. |
| `slippage` | float | currency | Estimated slippage cost. Defaults to 0 if absent. |
| `strategy_name` | string | — | Identifier for the strategy that generated the trade. |
| `notes` | string | — | Free-text notes. |

### Units and Timezone Rules

- All `timestamp` values **must be** in UTC or explicitly labeled. If no timezone is present, assume UTC and log a warning.
- `price` and `fees` and `slippage` are in the **base currency** of the account (e.g., USD for US equities, USDT for crypto).
- `pnl` sign convention: positive = profit, negative = loss, consistent with `side`.

### Validation Behavior

On ingest, the following validation is performed **before** any audit checks run:
1. All required fields present and non-null.
2. `trade_id` uniqueness — duplicates are rejected with a "duplicate_trade_id" finding.
3. `quantity` > 0, `price` > 0.
4. `side` is one of `buy`/`sell`.
5. `pnl` consistency: for a `buy` side, `pnl` should generally be `price * quantity - fees` (or marked as unrealistic); for `sell`, `pnl` should generally be `price * quantity - fees`.
6. `timestamp` parseable as datetime.

Failures on these validations generate **finding** records (see Section 4) and the row is excluded from downstream calculations.

## 4. Audit Finding Schema

Each audit check produces zero or more **findings**. A finding has the following structure:

```json
{
  "finding_id": "string",           // Unique e.g. UUID
  "check_name": "string",           // Name of the check that produced this finding
  "severity": "low" | "medium" | "high", // See severity definitions below
  "trade_id": "string" | null,      // Referencing the trade, or null for dataset-level findings
  "description": "string",          // Human-readable description
  "evidence": "string",             // Reference to CSV field(s) or calculation that motivated the finding
  "limitations": "string",          // What this check cannot establish
  "remediation": "string" | null,   // Suggested remediation step
  "row_indices": [int] | null       // Which row(s) in the CSV contributed to this finding
}
```

### Severity Levels

| Severity | Code | When to Assign |
|----------|------|----------------|
| **low** | `low` | Minor data quality issue that should be noted but does not dramatically affect interpretation (e.g., missing optional field, out-of-range price that is still plausible). |
| **medium** | `medium` | Significant data quality issue that likely affects performance interpretation (e.g., inconsistent pnl/sign side, missing timestamps). |
| **high** | `high` | Confirmed data error or suspicious pattern that invalidates or strongly calls into question the strategy's reported results (e.g., overlapping trades, look-ahead bias evidence, fees not accounted for). |

### Finding Generators (Eight Core Checks)

1. **Duplicate Trade IDs** — `trade_id` not unique.
2. **Missing/Invalid Timestamps** — `timestamp` unparseable or missing; timezone ambiguity.
3. **PNL Sign Inconsistency** — `pnl` sign does not match `side` convention.
4. **Unrealistic Transaction Costs** — `fees` < 0.01% of `price * quantity` for equity, or unreasonably low relative to typical bid-ask spreads.
5. **Look-Ahead Bias** — `price` or other fields use data that was not available at `timestamp` (checked via cross-reference with external price data — **not** in MVP; flagged as `limitations: "Requires external historical price data for conclusive determination"`).
6. **Overlapping Trades** — Trade time intervals overlap for the same symbol.
7. **Survivorship-Biased Return Indicators** — Only winning trades or instruments reported; check for selection bias markers.
8. **Excessive Round-Trip Frequency** — Unusually high number of buy/sell cycles in a short window suggesting churn.

## 5. Metric Definitions and Calculation Conventions

All metrics are **deterministic** given the same input CSV. No stochastic or LLM-driven components.

### Core Calculations

| Metric | Formula | Notes |
|--------|---------|-------|
| **Total Traded Quantity** | `sum(abs(quantity))` across all valid rows | Aggregated by absolute quantity regardless of side. |
| **Total Gross P&L** | `sum(pnl)` | Gross before fees/slippage. |
| **Total Fees** | `sum(fees)` (default 0 if field absent) | |
| **Total Slippage** | `sum(slippage)` (default 0 if field absent) | |
| **Net P&L** | `Total Gross P&L - Total Fees - Total Slippage` | |
| **Win Rate** | `count(pnl > 0) / count(pnl != 0)` | Excludes zero-P&L rows. |
| **Profit Factor** | `sum(pnl > 0) / abs(sum(pnl < 0))` | Gross total wins / gross total losses. |
| **Sharpe Ratio (annualized)** | `sqrt(252) * mean(daily_returns) / std(daily_returns)` | Daily returns derived from cumulative P&L; requires at least 30 days of data. |
| **Maximum Drawdown** | `peak-to-trough trough` of cumulative P&L | Computed on rolling window of daily P&L. |

### Calculation Conventions

- All monetary values are **floating point** with **rounding to 4 decimal places** where currency precision allows; otherwise retain full float precision.
- `pnl` is calculated as `(exit_price - entry_price) * quantity - fees - slippage` for closed positions; for open-position reporting, `pnl` is the field as provided.
- Returns are **log returns**: `r_t = log(P_t / P_{t-1})`.
- Annualization assumes **252 trading days** per year for equity-like assets; for crypto, 365 may be substituted with a clear note.
- All timestamps assumed UTC unless otherwise tagged; timezone-naive datetimes trigger a warning but are processed.

## 6. API Contract

### Base URL (local development)
```
GET  http://localhost:8000/api/v1/audit
POST http://localhost:8000/api/v1/audit
```

### Endpoints

#### POST /api/v1/audit
Submit a CSV file for audit.

**Request:**
- `multipart/form-data` with field `file` containing the CSV.
- Optional field `strategy_name` (string).

**Response (200):**
```json
{
  "dataset_id": "string",          // UUID generated on server
  "row_count": int,
  "findings": [
    {
      "finding_id": "uuid",
      "check_name": "string",
      "severity": "low"|"medium"|"high",
      "trade_id": "string"|null,
      "description": "string",
      "evidence": "string",
      "limitations": "string",
      "remediation": "string"|null,
      "row_indices": [int]|null
    }
  ],
  "summary": {
    "total_trades": int,
    "valid_trades": int,
    "net_pnl": float,
    "win_rate": float,
    "profit_factor": float,
    "sharpe_ratio": float|None,
    "max_drawdown": float|None
  }
}
```

#### GET /api/v1/audit/{dataset_id}
Retrieve results of a previously processed audit.

**Query Parameters:**
- `format=json` (default) or `format=csv`.

**Response:** Same structure as POST response.

### Error Responses

| Status | Meaning |
|--------|---------|
| 400 | Invalid CSV format, missing required fields, validation failures. |
| 415 | Unsupported media type (not CSV). |
| 422 | Unprocessable entity — data passed validation but audit found critical issues. |
| 500 | Internal server error — unexpected calculation failure. |

## 7. Proposed Frontend / Backend Architecture

### Backend (Python / FastAPI)

- **Framework:** FastAPI (Python 3.9+).
- **Dependencies:** `fastapi`, `uvicorn`, `pandas`, `numpy`, `scipy` (for statistical tests), `pydantic` (for request validation).
- **Endpoints:** As defined in Section 6.
- **Audit Engine:** Pure Python functions over pandas DataFrames; no external service calls required.
- **Serialization:** Pydantic models for request/response; all numerical output rounded to 4 significant digits.
- **Testing:** `pytest` with coverage >= 80% for the quant engine.
- **Deployment:** Single-process `uvicorn`; no background workers, no message queues, no database in MVP.

### Frontend (TypeScript / Next.js)

- **Framework:** Next.js 14 with App Router.
- **Language:** TypeScript.
- **Dependencies:** `next`, `react`, `react-dom`, `axios` (for API calls), `d3` or `chart.js` (for visualizations).
- **Pages:**
  - `/` — Upload page: file input, strategy name, submit.
  - `/results/[dataset_id]` — Results page: table of findings, summary metrics, downloadable JSON/CSV.
- **Styling:** Tailwind CSS or minimal CSS — keep dependency footprint small.
- **Data fetching:** Axios GET/POST to `/api/v1/audit`; loading and error states handled.

### Full-Stack Integration

- The backend serves static HTML/JSON; the frontend calls the backend API.
- CORS configured to allow `localhost:3000` (Next.js dev) and production domain at deploy time.
- No authentication in MVP; add JWT or session auth post-MVP if needed.
- All heavy computation (audit checks, metric calculations) occurs in the backend; the frontend renders the results.

## 8. Testing and Reproducibility Strategy

### Unit Tests (pytest)

- Each audit check has a dedicated test function with a fixture CSV.
- Tests verify that findings are correctly generated for both positive and negative cases.
- Metric calculations are tested against known deterministic inputs.
- Edge cases: empty CSV, single-row CSV, all-invalid rows, mixed valid/invalid.

### Synthetic Test Dataset (Section 7)

- A deterministic CSV containing both clean trades and deliberately planted defects.
- All test cases defined with expected finding outputs.

### Reproducibility

- Given the same CSV, the audit produces identical findings and metrics (no randomness, no LLM calls).
- All randomness (e.g., Sharpe ratio std estimation) is seeded or derived deterministically from the data.
- Output JSON includes a `schema_version` field so future changes are backward-compatible.
- Data lineage: the original CSV file path/name is stored alongside the `dataset_id` for traceability.

### Continuous Integration

- `git hook` or CI runs `ruff` (lint), `pytest` (tests), and `mypy` (type checking) on every commit.
- Coverage threshold: 80% branch coverage on the quant engine.

## 9. Security, Privacy, and Data-Handling Requirements

### Security

- **No secrets hardcoded.** API keys, data paths, and configuration via environment variables.
- **CORS:** Restricted to known origins during development; open at own risk.
- **File upload limits:** Max 10MB per CSV upload to prevent DoS.
- **Input sanitization:** CSV parsed with pandas; no arbitrary code execution (no `eval`, no dynamic import of user code).
- **Error messages:** Generic messages to users; detailed traces logged server-side only (not exposed in JSON response).

### Privacy

- **No user data retained** beyond the lifespan of the process request. The uploaded CSV is kept in memory or a temporary file that is deleted after processing.
- **No uploading** of user datasets to external services (Alphavantage, OpenAI, etc.) in MVP.
- **Anonymization:** If `strategy_name` is included, it is stored as-is but not used for profiling.
- **GDPR-friendly:** No personally identifiable information (PII) collected.

### Data-Handling Requirements

- **Silent timezone conversions prevented:** All `timestamp` values explicitly handled; if timezone-naive, user is warned and UTC is assumed.
- **Silent missing-data imputation prevented:** Missing optional fields default to 0 or empty string with explicit notification in findings.
- **Ambiguous return calculations:** `pnl` sign and magnitude must follow the conventions in Section 3; otherwise a finding is generated.

---
*Specification version 1.0 — generated at initial repository setup.*