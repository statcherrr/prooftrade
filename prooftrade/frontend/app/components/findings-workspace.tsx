import { useState } from "react";

export type Severity = "high" | "medium" | "low";

export interface Finding {
  finding_id: string;
  check_name: string;
  severity: Severity;
  trade_id: string | null;
  description: string;
  evidence: string;
  limitations: string;
  remediation: string | null;
  row_indices: number[] | null;
}

interface FindingsWorkspaceProps {
  findings: Finding[];
}

const SEVERITY_LABELS: Record<Severity, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

function SeverityBadge({ severity }: { severity: Severity }) {
  const styles: Record<Severity, string> = {
    high: "bg-red-500/10 text-red-400 border-red-500/20",
    medium: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    low: "bg-gray-500/10 text-gray-400 border-gray-500/20",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${styles[severity]}`}
    >
      <span
        className={`mr-1.5 h-1.5 w-1.5 rounded-full ${
          severity === "high"
            ? "bg-red-400"
            : severity === "medium"
            ? "bg-amber-400"
            : "bg-gray-400"
        }`}
      />
      {SEVERITY_LABELS[severity]}
    </span>
  );
}

function FindingCard({
  finding,
  index,
}: { finding: Finding; index: number }) {
  const [expanded, setExpanded] = useState(false);

  const severityIcon: Record<Severity, React.ReactNode> = {
    high: (
      <svg viewBox="0 0 24 24" className="h-4 w-4 text-red-400" aria-hidden="true">
        <path
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
        />
      </svg>
    ),
    medium: (
      <svg viewBox="0 0 24 24" className="h-4 w-4 text-amber-400" aria-hidden="true">
        <path
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
        />
      </svg>
    ),
    low: (
      <svg viewBox="0 0 24 24" className="h-4 w-4 text-gray-400" aria-hidden="true">
        <path
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
        />
      </svg>
    ),
  };

  return (
    <div
      className="group rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4 transition-colors hover:border-[var(--color-border)]/80"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <SeverityBadge severity={finding.severity} />
          <span className="text-xs font-mono text-[var(--color-text-muted)]">
            {finding.check_name.replace(/_/g, " ")}
          </span>
          {finding.trade_id && (
            <span className="text-xs text-[var(--color-text-muted)]">{finding.trade_id}</span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="ml-auto flex h-6 w-6 items-center justify-center rounded-md text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-secondary)]"
          aria-expanded={expanded}
        >
          <svg
            viewBox="0 0 24 24"
            className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`}
            aria-hidden="true"
          >
            <path
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>
      </div>

      <p className="mt-2.5 text-sm text-[var(--color-text-secondary)]">{finding.description}</p>

      {expanded && (
        <div className="mt-4 border-t border-[var(--color-border)] pt-4 space-y-4">
          {/* Evidence */}
          <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-3">
            <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-[var(--color-text-muted)]">
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" aria-hidden="true">
                <path
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
                />
                <path
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              Evidence
            </div>
            <pre className="text-xs font-mono text-[var(--color-text-secondary)] whitespace-pre-wrap">
              {finding.evidence}
            </pre>
          </div>

          {/* Limitations */}
          {finding.limitations && (
            <div className="rounded-md border border-amber-500/20 bg-amber-500/5 p-3">
              <div className="mb-1.5 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-amber-400">
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" aria-hidden="true">
                  <path
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
                  />
                </svg>
                Limitations
              </div>
              <p className="text-xs text-[var(--color-text-muted)] whitespace-pre-wrap">
                {finding.limitations}
              </p>
            </div>
          )}

          {/* Remediation */}
          {finding.remediation && (
            <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-3">
              <div className="mb-1.5 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-[var(--color-text-muted)]">
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" aria-hidden="true">
                  <path
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                Remediation
              </div>
              <p className="text-sm text-[var(--color-text-secondary)] whitespace-pre-wrap">
                {finding.remediation}
              </p>
            </div>
          )}

          {/* Row indices */}
          {finding.row_indices && finding.row_indices.length > 0 && (
            <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-3">
              <div className="mb-1.5 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-[var(--color-text-muted)]">
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" aria-hidden="true">
                  <path
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
                  />
                </svg>
                Affected row indices
              </div>
              <div className="flex flex-wrap gap-1.5 text-xs font-mono text-[var(--color-text-secondary)]">
                {finding.row_indices.map((idx) => (
                  <span
                    key={idx}
                    className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] px-2 py-0.5"
                  >
                    {idx}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function FindingsWorkspace({ findings }: FindingsWorkspaceProps) {
  const [severityFilter, setSeverityFilter] = useState<Severity | "all">("all");
  const [checkFilter, setCheckFilter] = useState("all");

  const uniqueChecks = Array.from(new Set(findings.map((f) => f.check_name)));

  const filteredFindings = findings.filter((f) => {
    if (severityFilter !== "all" && f.severity !== severityFilter) return false;
    if (checkFilter !== "all" && f.check_name !== checkFilter) return false;
    return true;
  });

  const severityCounts = {
    high: findings.filter((f) => f.severity === "high").length,
    medium: findings.filter((f) => f.severity === "medium").length,
    low: findings.filter((f) => f.severity === "low").length,
  };

  return (
    <div className="space-y-4">
      {/* Severity overview */}
      <div className="flex items-center gap-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4">
        <div className="flex items-center gap-2">
          <SeverityBadge severity="high" />
          <span className="text-sm font-medium text-[var(--color-text-primary)]">
            {severityCounts.high}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <SeverityBadge severity="medium" />
          <span className="text-sm font-medium text-[var(--color-text-primary)]">
            {severityCounts.medium}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <SeverityBadge severity="low" />
          <span className="text-sm font-medium text-[var(--color-text-primary)]">
            {severityCounts.low}
          </span>
        </div>
        <div className="ml-auto text-xs text-[var(--color-text-muted)]">
          {findings.length} finding{findings.length !== 1 ? "s" : ""} total
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <select
          value={checkFilter}
          onChange={(e) => setCheckFilter(e.target.value)}
          className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-1.5 text-xs text-[var(--color-text-secondary)] transition-colors focus:border-[var(--color-accent-blue)] focus:outline-none"
        >
          <option value="all">All checks</option>
          {uniqueChecks.map((name) => (
            <option key={name} value={name}>
              {name.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value as Severity | "all")}
          className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-1.5 text-xs text-[var(--color-text-secondary)] transition-colors focus:border-[var(--color-accent-blue)] focus:outline-none"
        >
          <option value="all">All severities</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>

      {/* Findings list */}
      {findings.length === 0 ? (
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-bg-tertiary)]">
            <svg
              viewBox="0 0 24 24"
              className="h-6 w-6 text-green-400"
              aria-hidden="true"
            >
              <path
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h4 className="text-base font-medium text-[var(--color-text-primary)]">
            No findings detected
          </h4>
          <p className="mt-1 max-w-md mx-auto text-sm text-[var(--color-text-secondary)]">
            The engine did not detect any patterns flagged by its checks. This does not mean the
            data is perfect — only that no heuristic thresholds were crossed.
          </p>
        </div>
      ) : filteredFindings.length === 0 ? (
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-6 text-center">
          <p className="text-sm text-[var(--color-text-secondary)]">
            No findings match the current filters.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredFindings.map((finding, i) => (
            <FindingCard key={finding.finding_id} finding={finding} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
