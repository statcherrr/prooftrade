# ProofTrade — architecture

## System shape

Three layers, one dependency direction:

```
┌──────────────────────────────┐
│ Browser (React 19 client)    │  pages: /, /audit, /audit/results,
│  Next.js 16 App Router       │         /methodology, /settings
└──────────────┬───────────────┘
               │  POST /api/audit   (multipart/form-data: file, assume_utc)
               │  same-origin, no backend URL in the client bundle
┌──────────────▼───────────────┐
│ Next.js route handler        │  app/api/audit/route.ts
│  reads PROOFTRADE_API_ORIGIN │  per request; 60 s timeout;
│  at request time             │  maps failures → 502 / 504 / upstream status
└──────────────┬───────────────┘
               │  server-side fetch
┌──────────────▼───────────────┐
│ FastAPI service              │  POST /api/audit, GET /health, GET /healthz
│  upload limits, HTTP errors  │  CORS configurable (defence in depth)
└──────────────┬───────────────┘
               │  run_audit(csv_text, assume_utc=...)
┌──────────────▼───────────────┐
│ Deterministic engine         │  pure functions, no I/O, no model calls
│  prooftrade/engine           │  same input → same metrics and findings
└──────────────────────────────┘
```

## Why the proxy is a route handler, not a rewrite

A `next.config` rewrite is resolved at build time, so a single build could not be pointed at a
different backend without rebuilding. `app/api/audit/route.ts` is a dynamic route (`ƒ` in the build
output) that reads `PROOFTRADE_API_ORIGIN` on every request with a fallback of
`http://127.0.0.1:8000`. One build works against any backend origin, and the origin never ships to
the browser.

## Responsibilities

| Layer | Owns | Does not do |
| --- | --- | --- |
| Browser / React client | Form state, file selection, rendering metrics and findings, session-scoped result storage, empty/loading/error UI | Compute metrics, talk to FastAPI, hold secrets |
| `app/api/audit/route.ts` | Forwarding the multipart body, timeout, error translation (`502` unreachable, `504` timeout, upstream status/detail pass-through) | Parse CSV, score findings |
| `prooftrade/api/app.py` | Upload size and row caps (`413`), empty body (`400`), required-column contract (`422`, naming the columns), `assume_utc` form field, logging unexpected engine errors server-side | Business rules about trades |
| `prooftrade/engine` | CSV parse, validation, ten checks, seven metrics, finding text (evidence / limitations / remediation) | HTTP, storage, UI, randomness |

## Data contract

**Request:** `POST /api/audit`, multipart form with `file` (CSV, UTF-8) and optional `assume_utc`
(default `true`).

**Required CSV columns:** `trade_id`, `timestamp`, `symbol`, `side`, `quantity`, `price`, `pnl`.
**Optional:** `fees`, `slippage`, `strategy_name`, `notes` — absent cost columns count as zero.

**Response `200`:**

```json
{
  "dataset_id": "<uuid per run>",
  "row_count": 10,
  "findings": [
    { "finding_id": "lb_bias_note", "check_name": "look_ahead_bias", "severity": "high",
      "trade_id": null, "description": "...", "evidence": "...", "limitations": "...",
      "remediation": "...", "row_indices": null }
  ],
  "summary": { "total_trades": 10, "valid_trades": 10, "net_pnl": 520.29, "win_rate": 0.8,
               "profit_factor": 4.662, "sharpe_ratio": null, "max_drawdown": 100.0 }
}
```

**Error contract:** `400` empty/non-multipart, `413` row or size cap, `422` missing columns (named)
or unprocessable data, `502` backend unreachable (proxy), `504` backend timeout (proxy). Every error
body carries a human-readable `detail`; no stack traces or CSV content are returned.

## Determinism

- No network calls, no LLM, no sampling, no clock-dependent logic inside the engine.
- Finding IDs are derived from check names and rows; `dataset_id` is a UUID and is intentionally the
  only non-reproducible field.
- Tests assert that running the same CSV twice yields identical metrics and identical finding sets.

## Client state

| Key | Storage | Lifetime |
| --- | --- | --- |
| `prooftrade.last-audit.v1` | `sessionStorage` | Current tab; survives refresh, cleared by a new audit or tab close |
| `prooftrade.preferences` | `localStorage` | Persistent; holds `assumeUtc` only |

No cookies, no account, no server-side session, no database.

## Tests

| Suite | Location | Covers |
| --- | --- | --- |
| API (15 tests) | `prooftrade/api/test_app.py` | Health, response schema, input contract (empty, missing columns named, `assume_utc` pass-through, minimal 7-column CSV), oversized rejection, determinism through HTTP |
| Engine (14 tests) | `prooftrade/tests/test_audit_engine.py` | Each rule against hand-calculated expectations, metric determinism, optional cost columns, empty input |
| Acceptance (34 checks) | `prooftrade/frontend/scripts/verify-phase311.mjs` | Real upload through the real proxy, results rendering, findings expand/collapse, navigation, empty state, mobile viewport, overflow |

## Stack

Python 3.10+ · pandas · numpy · FastAPI · uvicorn · pytest · ruff
Node.js 20+ · Next.js 16 (App Router) · React 19 · Tailwind CSS v4 · TypeScript · Playwright (verification only)
