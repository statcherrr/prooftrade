interface MetricProps {
  label: string;
  value: React.ReactNode;
  description: string;
  trend?: { direction: "up" | "down"; value: number };
  accent?: "blue" | "green" | "red" | "neutral";
}

function Metric({ label, value, description, trend, accent = "neutral" }: MetricProps) {
  const accentStyles: Record<string, string> = {
    blue: "text-[var(--color-accent-blue)]",
    green: "text-[var(--color-success)]",
    red: "text-[var(--color-error)]",
    neutral: "text-[var(--color-text-primary)]",
  };

  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4 transition-colors hover:border-[var(--color-border)]/80">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-muted)]">
            {label}
          </p>
          <p
            className={`mt-1.5 text-xl font-semibold font-mono tracking-tight ${accentStyles[accent]}`}
            aria-label={label}
          >
            {value}
          </p>
        </div>
        {trend && (
          <span
            className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
              trend.direction === "up"
                ? "bg-green-500/10 text-green-400"
                : "bg-red-500/10 text-red-400"
            }`}
          >
            <svg
              viewBox="0 0 24 24"
              className={`h-3 w-3 ${trend.direction === "up" ? "" : "rotate-180"}`}
              aria-hidden="true"
            >
              <path
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 15l7-7 7 7"
              />
            </svg>
            {trend.value.toFixed(2)}
          </span>
        )}
      </div>
      <p className="mt-2 text-xs text-[var(--color-text-muted)]">{description}</p>
    </div>
  );
}

interface MetricsGridProps {
  summary: {
    total_trades: number;
    valid_trades: number;
    net_pnl: number;
    win_rate: number;
    profit_factor: string | number;
    sharpe_ratio: number | null;
    max_drawdown: number | null;
  };
  findingCounts: { high: number; medium: number; low: number };
  datasetId: string;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

export function MetricsGrid({ summary, findingCounts, datasetId }: MetricsGridProps) {
  const { total_trades, net_pnl, win_rate, profit_factor, sharpe_ratio, max_drawdown } = summary;

  const profitFactorDisplay =
    typeof profit_factor === "string" ? profit_factor : profit_factor.toFixed(2);

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <Metric
        label="Net P&L"
        value={formatCurrency(net_pnl)}
        description="Sum of trade PnL minus fees and slippage."
        accent={net_pnl >= 0 ? "green" : "red"}
      />
      <Metric
        label="Win rate"
        value={formatPercent(win_rate)}
        description="Trades with PnL > 0 divided by trades with PnL != 0."
        trend={{ direction: win_rate >= 0.5 ? "up" : "down", value: win_rate }}
      />
      <Metric
        label="Profit factor"
        value={profitFactorDisplay}
        description={
          typeof profit_factor === "string" && profit_factor === "inf"
            ? "No gross losses under engine definition; ∞ is a marker, not a guarantee."
            : "Gross wins divided by |gross losses|."
        }
        accent={typeof profit_factor === "string" ? "neutral" : profit_factor >= 1 ? "green" : "red"}
      />
      <Metric
        label="Sharpe ratio"
        value={typeof sharpe_ratio === "number" ? sharpe_ratio.toFixed(2) : "—"}
        description="Annualized Sharpe based on log returns of trade prices (252 days/year)."
        accent={typeof sharpe_ratio === "number" && sharpe_ratio >= 1 ? "green" : "neutral"}
      />
      <Metric
        label="Max drawdown"
        value={typeof max_drawdown === "number" ? formatCurrency(max_drawdown) : "—"}
        description="Peak-to-trough decline in cumulative PnL across the trade sequence."
        accent={typeof max_drawdown === "number" && max_drawdown > 1000 ? "red" : "neutral"}
      />
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4">
        <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-muted)]">
          Trade summary
        </p>
        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-[var(--color-text-secondary)]">Total records</span>
            <span className="font-mono text-[var(--color-text-primary)]">{total_trades}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[var(--color-text-secondary)]">Valid trades</span>
            <span className="font-mono text-[var(--color-text-primary)]">{summary.valid_trades}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[var(--color-text-secondary)]">High severity</span>
            <span className="font-mono text-[var(--color-high-severity)]">
              {findingCounts.high}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[var(--color-text-secondary)]">Medium severity</span>
            <span className="font-mono text-[var(--color-medium-severity)]">
              {findingCounts.medium}
            </span>
          </div>
          <div className="flex items-center justify-between col-span-2">
            <span className="text-[var(--color-text-secondary)]">Low severity</span>
            <span className="font-mono text-[var(--color-low-severity)]">
              {findingCounts.low}
            </span>
          </div>
        </div>
      </div>
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4 sm:col-span-2 lg:col-span-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-muted)]">
            Dataset
          </p>
          <code className="text-xs font-mono text-[var(--color-text-secondary)]">{datasetId}</code>
        </div>
        <p className="mt-1.5 text-xs text-[var(--color-text-muted)]">
          Share this ID to reference this exact audit run. Results are deterministic: the same CSV and settings always produce the same output.
        </p>
      </div>
    </div>
  );
}
