# ProofTrade — install and run

Verified on macOS with Python 3.15.2 and Node 26.11.1 / npm 11.20.0. Minimums: Python 3.10,
Node 20.

## 1. Backend

```bash
cd <repository root>
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt     # runtime + pytest/httpx/ruff
pip install -e .                        # installs the `prooftrade` package

uvicorn prooftrade.api.app:app --host 127.0.0.1 --port 8000
```

Checks:

```bash
curl -s http://127.0.0.1:8000/health    # {"status":"ok"}
curl -s http://127.0.0.1:8000/healthz   # {"status":"ready"}
```

Runtime-only install: `pip install -r requirements.txt`.

## 2. Frontend

```bash
cd prooftrade/frontend
npm ci
cp .env.example .env.local     # optional; default origin is http://127.0.0.1:8000
npm run dev                    # http://localhost:3000
```

Production build:

```bash
npm run build -- --webpack
npm start
```

The build must use `--webpack`; the default Turbopack build is not the verified path.

## 3. Environment variables

| Variable | Layer | Default | Notes |
| --- | --- | --- | --- |
| `PROOFTRADE_API_ORIGIN` | frontend | `http://127.0.0.1:8000` | Read per request by `app/api/audit/route.ts`; never sent to the browser. |
| `PORT` | frontend | `3000` | `next start` port. |
| `PROOFTRADE_CORS_ORIGINS` | backend | `http://localhost:3000,http://127.0.0.1:3000` | Only used if a browser calls the API directly. |
| `PROOFTRADE_MAX_CSV_ROWS` | backend | `10000` | Row cap → HTTP 413 above it. |
| `PROOFTRADE_MAX_CSV_SIZE` | backend | `10000000` | Byte cap (10 MB) → HTTP 413 above it. |

No secrets or API keys are required.

## 4. Tests and checks

From `prooftrade/`:

```bash
ruff check .        # expect: All checks passed!
pytest api/ -q      # expect: 15 passed
pytest tests/ -q    # expect: 14 passed
```

From `prooftrade/frontend/`:

```bash
npm run type-check                  # expect: exit 0
npm run build -- --webpack          # expect: exit 0, /api/audit listed as dynamic (ƒ)
```

Optional end-to-end acceptance (both servers running, Playwright Chromium installed):

```bash
node scripts/verify-phase311.mjs    # expect: 34/34 checks passed
# overrides: PT_BASE, PT_OUT, PT_CHROME
```

## 5. First run

1. Open <http://localhost:3000>.
2. **New Audit** → **Download sample** (produces `prooftrade-sample.csv`) or upload your own CSV.
3. Leave the timezone assumption enabled unless your timestamps are naive and non-UTC.
4. Click **Analyze …** — the app navigates to `/audit/results` with the engine output.
5. Expand any finding with **Details** to see evidence, limitations, and remediation.
6. **Methodology** documents all ten checks; **Settings** resets the timezone preference.

Refresh keeps the result (it lives in `sessionStorage`); a new tab or a new audit clears it.

## 6. Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| Banner: "The audit service is unreachable…" (502) | Backend not running or wrong origin | Start uvicorn; check `PROOFTRADE_API_ORIGIN`. |
| 504 from the proxy | Backend took longer than 60 s | Check the API log; the engine is CPU-bound on very large files. |
| `422 CSV is missing required column(s): …` | Header lacks a required column | Add the named columns. |
| `413` | Row or byte cap exceeded | Trim the export or raise `PROOFTRADE_MAX_CSV_ROWS` / `PROOFTRADE_MAX_CSV_SIZE`. |
| Empty results page | No audit in this tab | Run an audit from **New Audit**. |
| `ModuleNotFoundError: prooftrade` in tests | Package not installed and pytest run outside the repo root | `pip install -e .` from the repository root, or run `pytest` from `prooftrade/` (the manifest sets `pythonpath`). |
