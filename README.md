# ProofTrade

**A deterministic audit of a trade history.** Upload a CSV of executed trades and ProofTrade
returns computed performance metrics plus rule-based findings, each carrying its evidence, its
limitations, and a remediation step.

ProofTrade does not predict returns, score strategies, or call anything "profitable". It answers a
narrower question: *is there anything in this trade history that a deterministic rule flags as a
risk worth checking before I trust these numbers?*

- [What problem it addresses](#what-problem-it-addresses)
- [How the audit workflow operates](#how-the-audit-workflow-operates)
- [What the engine measures](#what-the-engine-measures)
- [The ten implemented checks](#the-ten-implemented-checks)
- [How findings are produced](#how-findings-are-produced)
- [What ProofTrade cannot prove](#what-prooftrade-cannot-prove)
- [Architecture](#architecture)
- [Repository layout](#repository-layout)
- [Install and run](#install-and-run)
- [CSV format](#csv-format)
- [HTTP API](#http-api)
- [Tests and checks](#tests-and-checks)
- [Data handling and persistence](#data-handling-and-persistence)
- [Known limitations](#known-limitations)
- [Documentation](#documentation)

---

## What problem it addresses

Backtest and trade-history exports are usually trusted on their face. A strategy that shows a
4.66 profit factor is not obviously wrong — but the same export often contains an inconsistent PnL
sign, a timestamp without a timezone, a fee that is economically impossible, or a win rate of
exactly 100%. Those are data-integrity signals, and today they are found by hand, if at all.

ProofTrade makes that first pass mechanical and repeatable: the same CSV always produces the same
metrics and the same findings, with no model calls, no randomness, and no network dependencies.

**Designed for:** individual quant researchers, systematic traders, and hackathon or research
reviewers who need a fast, explainable integrity check on a trade-history file before drawing
conclusions from it.

**Not designed for:** live trading decisions, portfolio management, regulatory reporting, or any
use that requires a statistically validated verdict on a strategy. See
[What ProofTrade cannot prove](#what-prooftrade-cannot-prove).

## How the audit workflow operates

1. **Overview (`/`)** explains the product and links into the workflow.
2. **New Audit (`/audit`)** is the upload workspace. You pick a CSV (or download the built-in
   sample), choose whether timezone-naive timestamps should be assumed UTC, and run the audit.
3. The browser sends a `multipart/form-data` request to the Next.js route handler at
   `POST /api/audit`, which forwards it server-side to the FastAPI engine.
4. **Results (`/audit/results`)** is a separate destination page. It shows the metric grid and the
   findings list. Each finding expands to reveal evidence, limitations, and remediation.
5. **Methodology (`/methodology`)** documents the ten checks and the limitations of each.
6. **Settings (`/settings`)** stores the timezone-assumption preference and can reset it.

Starting an audit and viewing a result are deliberately distinct states: `/audit` never renders
results, and `/audit/results` never fabricates them. If no audit has been run in the current tab,
the results page shows an empty state that links back to the upload workspace.

## What the engine measures

All metrics are computed from the rows that survive validation, in the units present in the CSV
(typically account currency). They are plain arithmetic — there is no fitting, sampling, or
optimisation anywhere in the pipeline.

| Metric | Definition |
| --- | --- |
| `total_trades` | Number of rows remaining after rows with unusable required fields are dropped. |
| `valid_trades` | Same value as `total_trades`: row dropping happens before metrics, so both fields report the surviving population. |
| `net_pnl` | `sum(pnl) − sum(fees) − sum(slippage)`. Missing `fees`/`slippage` columns count as zero. |
| `win_rate` | `count(pnl > 0) / count(pnl ≠ 0)`, so break-even trades are excluded from the denominator and reported as `0.0` when every PnL is zero. |
| `profit_factor` | `sum(winning pnl) / abs(sum(losing pnl))`. When there are no losing trades it is the string `"inf"` if there are wins, and `0.0` otherwise. |
| `sharpe_ratio` | `null` unless there are at least 30 valid rows. Otherwise `√252 × mean(log returns) / std(log returns)`, computed from the `price` column sorted by timestamp (falling back to `log1p(abs(pnl))` when prices are unusable). |
| `max_drawdown` | Peak-to-trough of the cumulative `pnl` series in currency units — a drawdown **amount**, not a percentage. `null` when there are no valid rows. |

The Sharpe figure is a price-series statistic, not the Sharpe ratio of a strategy equity curve; it
is omitted entirely below 30 rows rather than reported on an unstable sample.

## The ten implemented checks

Each check is a pure function of the CSV. `check_name` is the exact string the API returns.

| # | `check_name` | Severity | Trigger |
| --- | --- | --- | --- |
| 1 | `missing_required_field` | medium | A required column is absent from the header. All rows are excluded from metrics. |
| 2 | `null_required_field` | medium | A required field is null or empty on a row. That row is excluded from metrics. |
| 3 | `duplicate_trade_ids` | low | A `trade_id` appears on more than one row. Rows are reported, never deleted, for this check. |
| 4 | `missing_invalid_timestamps` | medium / low | A timestamp cannot be parsed (medium, row dropped), or is timezone-naive: assumed UTC with a **low**-severity finding, or rejected with a **medium**-severity finding when the UTC assumption is disabled. |
| 5 | `pnl_sign_inconsistency` | medium | A `buy` has negative PnL, or a `sell` has positive PnL. |
| 6 | `unrealistic_transaction_costs` | medium | Fees are negative, or fees are below **0.01%** of notional (`price × quantity`). High fees are not flagged. |
| 7 | `look_ahead_bias` | high | Always reported, once per audit. A CSV cannot prove the absence of look-ahead bias, so the check states the limitation instead of passing silently. |
| 8 | `overlapping_trades` | medium | Two rows for the same symbol, adjacent after sorting by timestamp, have the **exact same** timestamp. |
| 9 | `survivorship_bias_marker` | medium / low | A 100% win rate (medium), or a PnL standard deviation below 10% of `abs(mean pnl)` across more than 10 trades (low). |
| 10 | `excessive_round_trip_frequency` | medium | More than **100** buy-sell cycles for one symbol inside a **30-day** wall-clock window, where cycles are the smaller of the buy and sell counts. |

The methodology page at `/methodology` renders this same list from the same definitions and adds
per-check evidence, limitation, and remediation text.

## How findings are produced

The pipeline runs in a fixed order — required fields, trade-id uniqueness, timestamps, PnL sign,
transaction costs, look-ahead note, overlapping trades, survivorship marker, round-trip frequency —
then computes metrics on the surviving rows.

A finding is emitted only when its rule matches, except for `look_ahead_bias`, which is always
emitted as a scope statement. Every finding contains:

- `finding_id` — stable identifier derived from the check and the row(s) involved.
- `check_name` and `severity` (`low`, `medium`, `high`).
- `trade_id` and `row_indices` — the rows the finding refers to, when applicable.
- `description` — what the rule matched.
- `evidence` — the concrete values behind the claim (fees, notional, timestamps, counts, …).
- `limitations` — why the rule can be wrong or is insufficient on its own.
- `remediation` — the next step for a human reviewer.

Severity describes how much the finding threatens the *interpretation* of the data, not whether a
strategy is good or bad.

## What ProofTrade cannot prove

These are load-bearing limitations, stated in the product and not only here:

- **A CSV cannot prove the absence of look-ahead bias.** Prices in the file may reflect data that
  was unavailable at the trade timestamp. Confirmation requires external historical price data
  (VWAP or close at each timestamp) that this MVP does not fetch.
- **A CSV cannot prove the absence of survivorship bias.** Delisted or failed instruments that never
  reached the export are invisible. The engine can only flag suspicious win-rate and PnL-distribution
  markers.
- **Findings are heuristics, not verdicts.** The 0.01% fee floor, the 100-cycle turnover threshold,
  and the same-timestamp overlap test are rules of thumb. Legitimate strategies can trip all three.
- **Metrics are only as good as the file.** The engine trusts the `pnl`, `fees`, and `slippage`
  columns as given; it does not reconstruct PnL from `price` and `quantity`, and it does not validate
  against market data.
- **Not investment advice, and no claim of profitability or validation.**

## Architecture

```
browser  ──POST /api/audit (multipart CSV)──▶  Next.js route handler (server)
                                                   │  PROOFTRADE_API_ORIGIN, read per request
                                                   ▼
                                     FastAPI  POST /api/audit
                                                   │
                                                   ▼
                                deterministic engine: run_audit(csv_text, assume_utc)
```

- The browser only ever talks to the Next.js origin; the backend origin and any server-side
  configuration are never shipped in the client bundle.
- The route handler translates upstream failures into readable `detail` messages: `502` when the
  backend is unreachable, `504` on timeout (60 s), and the API's own status and detail otherwise.
- The engine is a pure Python module (`prooftrade/engine/__init__.py`) with no I/O; the API layer
  owns upload limits and HTTP semantics.

## Repository layout

```
prooftrade/                      repository root
├── prooftrade/
│   ├── engine/__init__.py       deterministic audit engine (pure functions)
│   ├── api/app.py               FastAPI app: POST /api/audit, GET /health, /healthz
│   ├── api/test_app.py          API contract and integration tests
│   ├── tests/                   engine tests with hand-calculated expectations
│   └── frontend/                Next.js 16 app (App Router, Tailwind v4)
│       ├── app/                 pages and components
│       │   ├── api/audit/route.ts   server-side proxy to the FastAPI service
│       │   ├── lib/             audit client + preference storage
│       │   ├── audit/           upload workspace and results destination
│       │   ├── methodology/     the ten checks, documented
│       │   └── settings/        timezone-assumption preference
│       └── scripts/verify-phase311.mjs   Playwright acceptance script
├── docs/                        engineering spec, implementation plan, research methods
├── submission-assets/           product description, demo script, architecture summary
├── pyproject.toml               canonical Python packaging manifest
├── requirements.txt             backend runtime dependencies
├── requirements-dev.txt         test/lint dependencies
└── .gitignore
```

## Install and run

Requirements: **Python ≥ 3.10**, **Node.js ≥ 20** (verified on Node 26.11.1 / npm 11.20.0).

### Backend

```bash
# from the repository root
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt      # or requirements.txt for runtime only
pip install -e .                         # makes `prooftrade` importable

uvicorn prooftrade.api.app:app --host 127.0.0.1 --port 8000
```

Health check: `curl http://127.0.0.1:8000/health` → `{"status":"ok"}`.

You can also run the tests without installing the package, because `pyproject.toml` puts the
repository root on `sys.path` for pytest.

### Frontend

```bash
cd prooftrade/frontend
npm ci
cp .env.example .env.local     # optional; the default origin is http://127.0.0.1:8000
npm run dev                    # development, http://localhost:3000
# production build:
npm run build -- --webpack && npm start
```

### Environment variables

| Variable | Where | Default | Purpose |
| --- | --- | --- | --- |
| `PROOFTRADE_API_ORIGIN` | frontend (server-side) | `http://127.0.0.1:8000` | Backend origin used by the route handler, read per request so no rebuild is needed. Never exposed to the browser. |
| `PORT` | frontend | `3000` | Port used by `next start`. |
| `PROOFTRADE_CORS_ORIGINS` | backend | `http://localhost:3000,http://127.0.0.1:3000` | Comma-separated allowed origins. Only relevant if a browser calls the API directly; the normal flow is same-origin. |
| `PROOFTRADE_MAX_CSV_ROWS` | backend | `10000` | Maximum row count accepted. |
| `PROOFTRADE_MAX_CSV_SIZE` | backend | `10000000` | Maximum upload size in bytes (10 MB). |

No secrets are required to run ProofTrade locally.

## CSV format

Required columns (7): `trade_id`, `timestamp`, `symbol`, `side`, `quantity`, `price`, `pnl`.

Optional columns: `fees`, `slippage`, `strategy_name`, `notes`. Missing cost columns are treated as
zero, so a minimal export audits without modification.

```csv
trade_id,timestamp,symbol,side,quantity,price,pnl,fees,slippage,strategy_name,notes
t001,2023-01-01T10:00:00Z,AAPL,buy,100,150.00,50.00,1.00,0.00,stratA,clean buy trade
t002,2023-01-01T10:05:00Z,AAPL,sell,100,152.10,62.10,1.00,0.00,stratA,clean sell trade
```

`timestamp` should be ISO-8601 with an explicit offset (`Z` or `+HH:MM`). Timezone-naive values are
handled according to the `assume_utc` setting. A downloadable sample lives in the New Audit page.

## HTTP API

`POST /api/audit` — `multipart/form-data` with `file` (CSV) and optional `assume_utc`
(`true`/`false`, default `true`).

Response `200`:

```json
{
  "dataset_id": "uuid for this run",
  "row_count": 10,
  "findings": [
    {
      "finding_id": "lb_bias_note",
      "check_name": "look_ahead_bias",
      "severity": "high",
      "trade_id": null,
      "description": "...",
      "evidence": "...",
      "limitations": "...",
      "remediation": "...",
      "row_indices": null
    }
  ],
  "summary": {
    "total_trades": 10, "valid_trades": 10, "net_pnl": 520.29, "win_rate": 0.8,
    "profit_factor": 4.662, "sharpe_ratio": null, "max_drawdown": 100.0
  }
}
```

Errors carry a human-readable `detail`:

| Status | Cause |
| --- | --- |
| `400` | Empty upload, or a request that is not a multipart form. |
| `413` | More rows than `PROOFTRADE_MAX_CSV_ROWS`, or a file larger than `PROOFTRADE_MAX_CSV_SIZE`. |
| `422` | Required columns missing (the message names them), or the engine could not process the data. |
| `502` | Reached through the Next.js route handler when the backend is unreachable. |
| `504` | Reached through the Next.js route handler when the backend exceeds the 60 s timeout. |

Interactive API docs are available at `http://127.0.0.1:8000/docs` while the backend runs.

## Tests and checks

Backend (from `prooftrade/`):

```bash
ruff check .              # lint
pytest api/ -q            # API contract, input handling, determinism (15 tests)
pytest tests/ -q          # engine rules and metrics (14 tests)
```

Frontend (from `prooftrade/frontend/`):

```bash
npm run type-check                 # tsc --noEmit
npm run build -- --webpack         # production build
```

Optional end-to-end acceptance run (needs both servers up and a Playwright Chromium):

```bash
node scripts/verify-phase311.mjs   # 34 checks: upload, results, findings, navigation, mobile
```

## Data handling and persistence

- The CSV is sent to the backend, parsed in memory, and audited. **Nothing is written to disk or to
  a database**, and no request content is logged.
- The result is held in the browser tab's `sessionStorage` under `prooftrade.last-audit.v1`.
  A refresh keeps the result; closing the tab, opening a new tab, or starting a new audit clears it.
- The settings page stores the timezone preference in `localStorage` under `prooftrade.preferences`.
- There is no account system, no authentication, and no server-side history. A shared or bookmarkable
  results URL does not exist by design; the results page shows an empty state instead of pretending
  to have data.

## Known limitations

1. **No persistence.** Results live in one browser tab (`sessionStorage`). Reloading a different tab
   or returning the next day loses them. A database or signed result tokens would be required for
   durable, shareable audits.
2. **Sharpe is price-based and sample-gated.** It needs ≥30 valid rows, uses the `price` column
   rather than an equity curve, and is `null` rather than approximated below that threshold.
3. **No external market data.** Look-ahead and survivorship checks state their limitations instead of
   measuring them; nothing is compared against historical VWAP or delisted instruments.
4. **`total_trades` equals `valid_trades`.** Rows are dropped during validation, so the two fields
   report the same surviving population.
5. **The PnL-sign rule assumes PnL is signed by position direction.** A sell that closes a profitable
   long is flagged as an inconsistency, which will fire on most long-only exports. The finding is a
   prompt to review the row, not a verdict.
6. **Drawdown is a currency amount, not a percentage.** It has no notion of starting capital.
7. **Heuristic thresholds are fixed.** The 0.01% fee floor, 100-cycle turnover limit, and
   same-timestamp overlap rule are constants, not configurable policy.
8. **Single-user, local-first.** No multi-tenancy, rate limiting (beyond row/size caps), or audit log.
9. **Row and size caps** are 10,000 rows / 10 MB by default; larger exports are rejected rather than
   streamed.

## Documentation

- `docs/ENGINEERING_SPEC.md` — engine specification and data contract.
- `docs/RESEARCH_METHODS.md` — research framing, check rationale, and bias discussion.
- `docs/IMPLEMENTATION_PLAN.md` — phased build history.
- `submission-assets/` — product description, architecture overview, demo script, methodology
  summary, install/run instructions, limitations, and screenshot inventory.

## License

See [LICENSE](LICENSE).
