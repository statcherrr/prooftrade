interface SettingsPanelProps {
  assumeUtc: boolean;
  onChange: (assumeUtc: boolean) => void;
}

export function SettingsPanel({ assumeUtc, onChange }: SettingsPanelProps) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-[var(--color-text-primary)]">
            Timezone assumption
          </p>
          <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
            How to interpret timestamps that omit a timezone offset.
          </p>
        </div>
        <label className="relative inline-flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            checked={assumeUtc}
            onChange={(e) => onChange(e.target.checked)}
            className="peer h-4 w-4 cursor-pointer rounded border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-accent-blue)] focus:ring-[var(--color-accent-blue)] focus:ring-offset-1 focus:ring-offset-[var(--color-bg-primary)]"
          />
          <span className="text-xs text-[var(--color-text-secondary)]">
            Assume UTC
          </span>
        </label>
      </div>
      <p className="mt-3 text-xs text-[var(--color-text-muted)] leading-relaxed">
        When enabled, timestamps like "2023-01-01T10:00:00" (without a Z or offset)
        are interpreted as UTC. When disabled, such timestamps are rejected and reported
        as findings. Most trading systems record UTC or local time; confirm which applies
        to your export.
      </p>
    </div>
  );
}
