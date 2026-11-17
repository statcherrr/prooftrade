# ProofTrade frontend

Next.js 16 (App Router) client for the ProofTrade deterministic audit engine.

## Architecture

The browser only ever talks to this Next.js server, on the same origin:

```
browser  ──POST /api/audit (multipart CSV)──▶  Next.js route handler
                                                   │
                                                   │ server-side fetch
                                                   ▼
                                     FastAPI  POST /api/audit
```

* `app/api/audit/route.ts` is the single server-side hop to the backend. It
  reads `PROOFTRADE_API_ORIGIN` **at request time**, so the same production
  build can point at any backend without a rebuild.
* The backend origin is never exposed to the browser bundle, and no CORS
  configuration is needed for the normal flow (the browser request stays
  same-origin).
* Failures are translated into readable JSON `detail` messages: unreachable
  backend (`502`), upstream timeout (`504`), and any error status/detail the
  API returns (for example `422` for a CSV with missing columns).

## Configuration

Server-side environment variables (see `.env.example`):

| Variable | Default | Purpose |
| --- | --- | --- |
| `PROOFTRADE_API_ORIGIN` | `http://127.0.0.1:8000` | Origin of the FastAPI service the route handler forwards to. |
| `PORT` | `3000` | Port for `next start`. |

Create `.env.local` for local work:

```bash
PROOFTRADE_API_ORIGIN=http://127.0.0.1:8000
```

## Running locally

Terminal 1 — backend (from the repository root):

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt && pip install -e .
uvicorn prooftrade.api.app:app --host 127.0.0.1 --port 8000
```

Terminal 2 — frontend:

```bash
npm run dev          # http://localhost:3000
# or a production build:
npm run build -- --webpack && npm start
```

Open <http://localhost:3000>, go to **New Audit**, upload a CSV, and the app
redirects to **/audit/results** with the engine output.

## CSV input

Required columns: `trade_id, timestamp, symbol, side, quantity, price, pnl`.
`fees` and `slippage` are optional: when they are absent, costs count as zero and every metric is
unchanged. The New Audit page offers a downloadable sample CSV.

## Results and persistence

Audit results are held in `sessionStorage` (`prooftrade.last-audit.v1`) for the
current browser tab only. Refreshing keeps them; starting a new audit or
closing the tab clears them. Nothing about the CSV or the results is stored on
the server.
