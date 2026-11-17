"use client";

import { useState } from "react";

interface SettingsToggleProps {
  assumeUtc: boolean;
  onToggle: (value: boolean) => void;
}

export function SettingsToggle({ assumeUtc, onToggle }: SettingsToggleProps) {
  return (
    <label className="relative inline-flex cursor-pointer items-center gap-3">
      <input
        type="checkbox"
        checked={assumeUtc}
        onChange={(e) => onToggle(e.target.checked)}
        className="peer h-4 w-4 cursor-pointer rounded border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-accent-blue)] focus:ring-[var(--color-accent-blue)] focus:ring-offset-1 focus:ring-offset-[var(--color-bg-primary)]"
      />
      <span className="text-sm text-[var(--color-text-secondary)]">
        Assume UTC
      </span>
    </label>
  );
}
