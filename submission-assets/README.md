# ProofTrade — submission assets

Everything a judge needs to understand, run, and evaluate ProofTrade without talking to the
developer. No secrets, no private data, no generated build output.

| File | Contents |
| --- | --- |
| [`product-description.md`](product-description.md) | Short and long product descriptions for a hackathon submission form. |
| [`architecture.md`](architecture.md) | Technical architecture, request flow, module responsibilities, and data contract. |
| [`demo-script.md`](demo-script.md) | 2–3 minute judge-facing walkthrough using only real functionality. |
| [`methodology-summary.md`](methodology-summary.md) | The ten checks, metric definitions, severities, and stated limitations. |
| [`install-and-run.md`](install-and-run.md) | Exact install, run, test, and configuration commands. |
| [`known-limitations.md`](known-limitations.md) | What ProofTrade does not do, and why. |
| [`screenshot-inventory.md`](screenshot-inventory.md) | Every screenshot, its viewport, and what it demonstrates. |

The root [`README.md`](../README.md) is the canonical project document. This directory is the
condensed submission bundle.

## Submission status

- The application is **fully runnable and verified locally** (see the phase report).
- There is **no public deployment**. Nothing here claims or implies a hosted demo.
- The repository's tracked files at the current `HEAD` do **not** contain the complete application;
  the engine, API tests, audit/results/methodology/settings pages, and Python packaging exist only
  in the working tree. A judge cloning the remote today would get a non-functional backend.
  Staging and committing that work requires the repository owner's approval and has not been done.
