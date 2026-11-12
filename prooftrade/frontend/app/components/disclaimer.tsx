export function Disclaimer() {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4">
      <div className="flex items-start gap-3">
        <svg
          viewBox="0 0 24 24"
          className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-warning)]"
          aria-hidden="true"
        >
          <path
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
          />
        </svg>
        <div>
          <p className="text-sm text-[var(--color-text-secondary)]">
            <strong className="text-[var(--color-text-primary)]">Disclaimer:</strong> This audit is
            deterministic and based solely on the CSV you provided. It does not guarantee future
            performance, prove the absence of all forms of bias (including look-ahead bias or
            survivorship bias), or validate the accuracy of your recorded data. Findings highlight
            patterns and potential issues based on heuristic thresholds; they are not definitive
            judgments. Review the limitations and evidence for each finding before drawing conclusions
            about your strategy.
          </p>
        </div>
      </div>
    </div>
  );
}
