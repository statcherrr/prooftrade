# ProofTrade — Implementation Plan (Phase 1)

## Overview

Small, ordered milestones with explicit acceptance criteria. Each milestone must be fully completed (including tests) before the next begins. No overlapping work.

Milestones are designed for one developer and a ~2-month deadline.

---

## Milestone 0: Repository and Tooling Setup

| ID | Task | Acceptance Criteria |
|----|------|---------------------|
| 0.1 | Initialize Python package structure | `prooftrade/` directory with `__init__.py`, `setup.py` or `pyproject.toml`; `pip install -e .` works |
| 0.2 | Add FastAPI and dependencies | `fastapi`, `uvicorn[standard]`, `pydantic` installed; `python -m uvicorn prooftrade.api:app --reload` starts server |
| 0.3 | Add Next.js scaffold | `npx create-next-app@latest prooftrade-frontend --typescript --tailwind --app`; `npm run dev` starts Next.js dev server |
| 0.4 | Configure CORS and basic routing | FastAPI allows requests from `localhost:3000`; Next.js can reach `http://localhost:8000/docs` |

**Done when:** All four sub-tasks pass; `curl http://localhost:8000/api/v1/audit` returns 400 (no file) and 200 with valid file format.

---

## Milestone 1: CSV Ingest and Core Validation

| ID | Task | Acceptance Criteria |
|----|------|---------------------|
| 1.1 | Define Pydantic models for CSV upload request | Model validates `file` is present; rejects missing `file` with 400. |
| 1.2 | Implement CSV parser using pandas | Parser reads CSV into DataFrame; required columns present; optional columns default appropriately. |
| 1.3 | Implement row-level validation (required fields, type checks, pnl sign consistency) | Validation generates finding records for each failure type; invalid rows excluded from metrics. |
| 1.4 | Implement dataset-level summary metrics (total_trades, net_pnl, win_rate, profit_factor) | Metrics computed only from valid rows; matches deterministic formulas in ENGINEERING_SPEC.md. |

**Done when:** Upload of a valid CSV returns 200 with correct `summary` and empty `findings` list; upload of an invalid CSV returns findings and partial or zeroed metrics.

---

## Milestone 2: Eight Core Audit Checks

| ID | Check | Acceptance Criteria |
|----|-------|---------------------|
| 2.1 | Duplicate Trade IDs | CSV with duplicate `trade_id` → finding with `severity: "low"`, `check_name: "duplicate_trade_ids"`. |
| 2.2 | Missing/Invalid Timestamps | CSV with unparseable `timestamp` → finding; CSV with timezone-naive timestamps → warning finding. |
| 2.3 | PNL Sign Inconsistency | `buy` side with `pnl < 0` → finding; `sell` side with `pnl > 0` → finding. |
| 2.4 | Unrealistic Transaction Costs | `fees` < 0.01% of `price * quantity` → finding with `severity: "medium"`. |
| 2.5 | Look-Ahead Bias | **Not conclusive in MVP** — finding with `limitations: "Requires external historical price data for conclusive determination"` when price seems forward-looking; no false positives. |
| 2.6 | Overlapping Trades | For same symbol, trades with overlapping time intervals → finding. |
| 2.7 | Survivorship-Biased Return Indicators | CSV missing losing trades or instruments → finding with `check_name: "survivorship_bias_marker"`. |
| 2.8 | Excessive Round-Trip Frequency | > 100 round-trip cycles in < 30 days → finding with `severity: "medium"`. |

**Done when:** All 8 checks are implemented as pure functions; each check has `pytest` tests with synthetic CSVs covering positive and negative cases.

---

## Milestone 3: API and End-to-End Flow

| ID | Task | Acceptance Criteria |
|----|-------|---------------------|
| 3.1 | POST /api/v1/audit endpoint | Accepts `multipart/form-data` with CSV file; returns JSON with `dataset_id`, `findings`, `summary`. |
| 3.2 | GET /api/v1/audit/{dataset_id} endpoint | Retrieves previously computed results; returns same structure as POST. |
| 3.3 | Error handling for invalid uploads | 400 for missing/file-type errors; 415 for non-CSV; descriptive JSON error messages. |
| 3.4 | Frontend upload page | Next.js page at `/` with file input and strategy name; on submit, redirects to `/results/[dataset_id]`. |
| 3.5 | Results page | Page at `/results/[dataset_id]` displays findings table and summary metrics; download links for JSON/CSV. |

**Done when:** Full upload → results flow works; a valid CSV with no issues shows empty findings and correct metrics; a CSV with planted defects shows the expected findings.

---

## Milestone 4: Testing, Reproducibility, and Polish

| ID | Task | Acceptance Criteria |
|----|-------|---------------------|
| 4.1 | Unit test suite (pytest) | >= 80% branch coverage on quant engine; all 8 audit checks have dedicated tests; all metric formulas have tests. |
| 4.2 | Deterministic synthetic dataset | CSV defined in `tests/synthetic_dataset.csv` containing both clean trades and planted defects; a test script verifies expected findings are generated. |
| 4.3 | Linting with ruff | `ruff check` passes with no errors across `prooftrade/` and `prooftrade-frontend/`. |
| 4.4 | Type checking with mypy | `mypy prooftrade/` passes (or suppressions only where unavoidable, documented). |
| 4.5 | Produce ENGINEERING_SPEC.md, IMPLEMENTATION_PLAN.md, RESEARCH_METHODS.md | All three files exist under `docs/` and are consistent with code. |

**Done when:** `make test` (or `pytest`) passes; `ruff check .` passes; all three docs are present and reviewed.

---

## Milestone 5: Release Candidate

| ID | Task | Acceptance Criteria |
|----|-------|---------------------|
| 5.1 | `docker` not required — single-process uvicorn + next.js | `python -m uvicorn prooftrade.api:app --host 0.0.0.0 --port 8000 & npx next start -p 3000` runs both services. |
| 5.2 | Final manual verification | User uploads synthetic dataset; all expected findings appear; metrics match; no crashes on edge cases (empty CSV, single row, all-invalid). |

**Done when:** No blockers; the system is ready for the Arbiter Hacks demo.

---

## Milestone Summary

| Milestone | Key Deliverables |
|-----------|------------------|
| 0 | Repository, tooling, basic CORS |
| 1 | CSV ingest + core validation |
| 2 | 8 audit checks |
| 3 | API + frontend flow |
| 4 | Tests, synthetic dataset, lint/type check |
| 5 | Release candidate + manual verification |

---
*Plan version 1.0 — aligned with ENGINEERING_SPEC.md v1.0.*