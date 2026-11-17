# ProofTrade — screenshot inventory

All screenshots were captured from the production build (`npm start`, no dev server, no proxy) against
the real FastAPI backend, driving real CSV uploads. Device pixel ratio 1; sizes are the true pixel
dimensions of each file, not CSS sizes.

Archive: `documents/prooftrade-phase311-screenshots.zip` (14 files).
Unpacked working copies: `/tmp/prooftrade-phase311-final/` (scratch, not part of the repository).

| File | Viewport | Shows |
| --- | --- | --- |
| `desktop-overview.png` | 1440 × 900 | Overview: product framing, what it measures, what it flags, metallic primary CTA into New Audit. |
| `desktop-new-audit.png` | 1440 × 900 | Upload workspace: drop zone, disabled-state primary button (muted slate, legible label), required-CSV strip, **Download sample**. |
| `desktop-completed-results.png` | 1440 × 900 | Results destination after a real 10-row upload: six-card grid (Net P&L, win rate, profit factor, Sharpe "not available", max drawdown, Findings 13 / 1 high · 12 medium · 0 low). |
| `desktop-expanded-finding.png` | 1440 × 900 | A finding expanded via **Details**: evidence, limitations, remediation in labelled blocks, chevron rotated, button label now **Hide details**. |
| `desktop-methodology.png` | 1440 × 900 | Methodology: pipeline stages and the ten checks as bordered cards with severity badges. |
| `desktop-settings.png` | 1440 × 900 | Settings: timezone assumption toggle and persistence reset controls with real button chrome. |
| `desktop-empty-results.png` | 1440 × 900 | Empty results state in a tab with no audit: no fabricated metrics, links back to New Audit. |
| `mobile-overview.png` | 390 × 844 | Overview at phone width: two-row header (brand + gear, then Overview/Audit/Results/Method), no horizontal overflow. |
| `mobile-upload.png` | 390 × 844 | Upload workspace at 390 px: stacked controls, full-width primary button. |
| `mobile-results.png` | 390 × 844 | Results at 390 px: metric cards stack; findings summary wraps without clipping. |
| `mobile-expanded-finding.png` | 390 × 844 | Expanded finding at 390 px: evidence/limitations/remediation remain readable, no truncation. |
| `mobile-methodology.png` | 390 × 844 | Methodology at 390 px: single-column check cards. |
| `mobile-settings.png` | 390 × 844 | Settings at 390 px. |
| `verification.json` | — | Machine-readable results of the acceptance run (34 checks, all passing) including `scrollWidth`/`innerWidth` overflow measurements. |

## What the screenshots demonstrate

- A completed audit is a distinct page (`/audit/results`), never merged into the upload workspace.
- The empty state is real: no placeholder metrics, no invented findings.
- Findings expansion is genuine and stateful (label, chevron, and panel change together).
- The dark graphite/icy-cyan visual system holds at both viewports, with no horizontal overflow at
  390 px.
- Metrics shown are the ones the engine produces for the uploaded fixture (Net P&L +520.29,
  win rate 80.00%, profit factor 4.66, Sharpe n/a, max drawdown +100.00, 13 findings).

## Not included

- No screenshots of a hosted deployment, because none exists.
- No mocked or edited results; each results screenshot came from a real upload in the same session.
