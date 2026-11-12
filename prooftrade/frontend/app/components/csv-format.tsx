import { useState } from "react";

const COLUMNS = [
  { name: "trade_id", description: "Unique identifier for each trade record.", required: true },
  {
    name: "timestamp",
    description:
      "ISO-8601 datetime of the trade, e.g. 2023-01-01T10:00:00Z. The engine parses these to order trades chronologically.",
    required: true,
  },
  {
    name: "symbol",
    description: "Ticker or instrument identifier, e.g. AAPL, EURUSD, BTCUSD.",
    required: true,
  },
  {
    name: "side",
    description: 'Direction of the trade: "buy" or "sell". Determines sign of position.',
    required: true,
  },
  {
    name: "quantity",
    description: "Number of units traded. Positive integers; fractional shares supported.",
    required: true,
  },
  {
    name: "price",
    description: "Entry price per unit. Used to compute gross PnL and returns.",
    required: true,
  },
  {
    name: "pnl",
    description:
      "Realized profit or loss for the trade. The engine uses this directly; it is not recomputed from price and quantity.",
    required: true,
  },
  {
    name: "fees",
    description: "Total transaction costs for the trade, including commissions.",
    required: true,
  },
  {
    name: "slippage",
    description: "Estimated slippage cost for the trade.",
    required: true,
  },
  {
    name: "strategy_name",
    description:
      "Optional label identifying the strategy or signal that produced the trade.",
    required: false,
  },
  {
    name: "notes",
    description: "Optional free-text notes. Not analyzed; stored for context only.",
    required: false,
  },
];

const EXAMPLE_CSV = `trade_id,timestamp,symbol,side,quantity,price,pnl,fees,slippage,strategy_name,notes
t001,2023-01-01T10:00:00Z,AAPL,buy,100,150.00,50.00,1.00,0.00,stratA,clean buy trade
t002,2023-01-01T10:05:00Z,AAPL,sell,100,152.10,62.10,1.00,0.00,stratA,clean sell trade
t003,2023-01-01T10:10:00Z,AAPL,buy,75,151.20,-10.50,1.00,0.50,stratB,small loss
t004,2023-01-01T10:15:00Z,AAPL,sell,75,152.80,12.00,1.00,0.25,stratB,recovered`;

const SAMPLE_CSV_URL = "/sample-trade-history.csv";

function downloadSampleCsv() {
  const blob = new Blob([EXAMPLE_CSV], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "sample-trade-history.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function CSVFormat() {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(EXAMPLE_CSV).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-5">
      <div className="mb-4 flex items-center gap-2">
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4 text-[var(--color-text-muted)]"
          aria-hidden="true"
        >
          <path
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
          Required CSV format
        </h3>
      </div>

      <p className="mb-4 text-xs text-[var(--color-text-secondary)]">
        Your CSV must include these columns. All are required except the last two;
        the engine will report missing fields as findings.
      </p>

      {/* Code block */}
      <div className="relative overflow-hidden rounded-md border border-[var(--color-border)] bg-[var(--color-bg-primary)]">
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-3 py-2">
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500/60" />
            <span className="h-2.5 w-2.5 rounded-full bg-yellow-500/60" />
            <span className="h-2.5 w-2.5 rounded-full bg-green-500/60" />
          </div>
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-secondary)]"
          >
            {copied ? (
              <>
                <svg
                  viewBox="0 0 24 24"
                  className="h-3.5 w-3.5 text-green-400"
                  aria-hidden="true"
                >
                  <path
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                Copied
              </>
            ) : (
              <>
                <svg
                  viewBox="0 0 24 24"
                  className="h-3.5 w-3.5"
                  aria-hidden="true"
                >
                  <path
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
                Copy
              </>
            )}
          </button>
        </div>
        <pre className="overflow-x-auto px-4 py-3 text-xs font-mono text-[var(--color-text-secondary)]">
          <code>{EXAMPLE_CSV}</code>
        </pre>
      </div>

      {/* Download sample */}
      <div className="mt-3 flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
        <svg
          viewBox="0 0 24 24"
          className="h-3.5 w-3.5"
          aria-hidden="true"
        >
          <path
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5m0 0l-5 5m5-5V3"
          />
        </svg>
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            downloadSampleCsv();
          }}
          className="font-medium text-[var(--color-accent-blue)] hover:underline"
        >
          Download a sample CSV
        </a>
        <span>to try the audit.</span>
      </div>

      {/* Column docs */}
      <div className="mt-4 grid gap-2.5 border-t border-[var(--color-border)] pt-4 lg:grid-cols-2">
        {COLUMNS.map((col) => (
          <div
            key={col.name}
            className="flex items-start gap-3 rounded-md px-3 py-2 text-xs"
          >
            <code className="mt-0.5 flex h-5 min-w-0 flex-shrink-0 items-center justify-center rounded border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-2 font-mono text-[10px] text-[var(--color-accent-blue)]">
              {col.name}
            </code>
            <div className="min-w-0">
              <p className="text-[var(--color-text-secondary)]">{col.description}</p>
              {!col.required && (
                <span className="mt-0.5 inline-block rounded-full bg-[var(--color-bg-tertiary)] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-[var(--color-text-muted)]">
                  Optional
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
