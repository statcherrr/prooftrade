# ProofTrade — judge-facing demo script (2–3 minutes)

Everything below uses shipped functionality and a real CSV. Do not stage findings; the file used
here is the sample CSV the app itself offers for download.

## Before you start (30 seconds, off-camera)

```bash
# terminal 1 — backend
source .venv/bin/activate && uvicorn prooftrade.api.app:app --port 8000
# terminal 2 — frontend
cd prooftrade/frontend && npm start        # http://localhost:3000
```

Open `http://localhost:3000` and download `prooftrade-sample.csv` from **New Audit → Download sample**
so the upload is quick on camera. The numbers quoted below are what that exact file produces.

## 0:00 — Overview

> "This is ProofTrade. Every backtest and broker export comes with a story: '4.66 profit factor,
> 80% win rate.' Before anyone believes that story, someone has to check whether the file is even
> internally consistent. ProofTrade makes that check mechanical."

Point at the three panels: what it measures, what it flags, and the disclaimer that ties them
together.

## 0:20 — The problem, in one sentence

> "A file can look great and still contain a buy with negative P&L, a fee that's 0.01% of notional,
> two fills with the exact same timestamp, and a 100% win rate. Those are integrity signals, and
> they're cheap to detect — but only if you automate them."

## 0:35 — New Audit: upload a real CSV

Click **New Audit**. Show the upload zone, the "Required CSV format" strip, and the **Download
sample** button.

> "Seven required columns: trade_id, timestamp, symbol, side, quantity, price, pnl. Fees and slippage
> are optional — absent costs count as zero."

Drop the CSV in, leave the timezone assumption on (default), click **Analyze prooftrade-sample.csv**.

## 1:00 — Results: actual metrics

The app navigates to **/audit/results** — a different page, not a modal.

> "These numbers are arithmetic on the rows that survived validation. Net P&L 495.29, win rate
> 85.71%, profit factor 10.986 — and Sharpe is 'not available' because there are fewer than 30 valid
> rows. It says so instead of printing an unstable estimate."

Point at the findings card: 11 findings, 1 high, 10 medium. Then:

> "Eleven findings on a seven-row file. Three are PnL-sign flags and seven are the fee floor — these
> fees are below 0.01% of notional, which is the threshold doing exactly what it says. The point is
> not that the file is bad; it's that the flags are specific, sourced, and reviewable."

## 1:25 — Expand a finding: evidence and limits

Click **Details** on the fee finding, then on the look-ahead finding.

> "Every finding shows the row, the evidence — the actual fee percentage against notional — why the
> rule might be wrong, and what to fix. The look-ahead finding is always present, at high severity,
> because a CSV cannot prove the absence of look-ahead bias. We'd rather state that than imply the
> data is clean."

Collapse it with **Hide details**.

## 1:50 — Methodology: ten checks, no black box

Click **Methodology**. Click one check to expand it.

> "Ten deterministic rules. No model, no randomness, no network. Same file in, same findings out —
> the tests assert exactly that. Each check documents its own threshold and its own failure mode."

## 2:10 — Why it's useful

> "ProofTrade doesn't tell you a strategy is good. It tells you whether the file you're about to draw
> conclusions from is internally consistent, and it shows the evidence for every claim. That's the
> first pass every researcher does by hand and every researcher skips under deadline."

Optional 15-second close: click **Results** in the nav after a refresh — the result still shows
because it is stored per tab; open a new tab and show the empty state that links back to New Audit.

## If something breaks on stage

| Symptom | Say this |
| --- | --- |
| "Audit service is unreachable" banner | "That's the proxy's 502 — the backend isn't running. It's an honest error, not a spinner." |
| Results page is empty | "This tab hasn't run an audit; results are session-scoped by design. Let me upload again." |
| No network | Everything is local; restart both terminals above. |

## Things not to claim

- No hosted demo exists; do not imply one.
- Do not claim the audit validates a strategy, predicts returns, or proves the absence of bias.
- Do not describe the engine as AI/LLM-based. It is deterministic rule evaluation.
