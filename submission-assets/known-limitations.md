# ProofTrade — known limitations

Grouped by whether they block the submission, affect interpretation, or are simply scoped out.

## Interpretation limits (by design, stated in the product)

1. **Look-ahead bias cannot be proven absent from a CSV.** The engine reports this on every audit at
   high severity. A conclusive check needs external historical prices.
2. **Survivorship bias cannot be proven absent from a CSV.** Delisted or failed instruments are
   invisible to the file; only markers (100% win rate, tight PnL distribution) are detectable.
3. **`pnl_sign_inconsistency` assumes PnL is signed by position direction.** A `sell` with positive
   PnL is flagged. In a long-only export, every profitable closing sell will be flagged; the finding
   is a prompt to review, not an error verdict.
4. **`unrealistic_transaction_costs` uses a 0.01% of notional fee floor.** Fees below that floor are
   flagged even when legitimate (crypto maker tiers, institutional schedules). Fees above the floor
   are never flagged.
5. **`overlapping_trades` only detects exact timestamp equality** between adjacent same-symbol rows.
   Genuine position overlap with distinct timestamps is not modelled.
6. **`excessive_round_trip_frequency` is a fixed 100-cycles-in-30-days heuristic.** Scalping and
   high-frequency strategies can exceed it legitimately.
7. **Metrics trust the file.** `pnl`, `fees`, and `slippage` are taken as provided; PnL is not
   reconstructed from `price` and `quantity`, and nothing is reconciled against market data.
8. **Sharpe is a price-series statistic, sample-gated.** Fewer than 30 valid rows → `null`. It is not
   the Sharpe ratio of a strategy equity curve.
9. **Max drawdown is a currency amount**, not a percentage, and has no starting-capital notion.
10. **`total_trades` equals `valid_trades`.** Row dropping happens before measurement, so both report
    the surviving population.

## Product limits (scoped out for the MVP)

11. **No persistence.** Results live in `sessionStorage` for one tab. No database, no accounts, no
    shareable result URLs, no audit history. A shared link shows the empty state by design.
12. **No authentication or multi-tenancy.** Single-user local tool; the API has no auth layer.
13. **Fixed caps.** 10,000 rows / 10 MB by default (`413` above the cap). Large exports are rejected
    rather than streamed or chunked.
14. **Rate limiting is only row/size based.** No per-IP throttling.
15. **No deployment.** There is no hosted demo; nothing in the project claims one exists.
16. **Single-file, synchronous audit.** One CSV per request; no batch or multi-file comparison.

## Operational notes

17. **The frontend build must use `--webpack`.** `npm run build` alone (Turbopack) is not the verified
    path.
18. **The results page is client-rendered from `sessionStorage`**, so it intentionally renders a
    loading skeleton before the empty state.
19. **Repository packaging carries one stale duplicate manifest.** The canonical manifest is the root
    `pyproject.toml`; the nested `prooftrade/pyproject.toml` is kept only so `pytest api/` works from
    inside `prooftrade/`. Removing it is recommended once the working tree is committed.

## Not limitations

- No mock or fabricated audit data exists anywhere in the product or the documentation.
- No LLM or external service participates in an audit; results are deterministic.
