export function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-accent-blue)] animate-spin" />
      <div>
        <p className="text-sm font-medium text-[var(--color-text-primary)]">Analyzing your trades...</p>
        <p className="mt-1 text-xs text-[var(--color-text-muted)]">
          This usually takes a moment. Your file is being validated and audited.
        </p>
      </div>
    </div>
  );
}
