"use client";

import { useEffect, useState } from "react";
import { Navbar } from "@/app/components/navbar";
import { SettingsToggle } from "./settings-toggle";
import {
  DEFAULT_PREFERENCES,
  clearPreferences,
  readPreferences,
  writePreferences,
} from "@/app/lib/preferences";

export default function SettingsPage() {
  const [assumeUtc, setAssumeUtc] = useState(DEFAULT_PREFERENCES.assumeUtc);
  const [storageMessage, setStorageMessage] = useState<string | null>(null);

  useEffect(() => {
    setAssumeUtc(readPreferences().assumeUtc);
  }, []);

  const updateAssumeUtc = (value: boolean) => {
    setAssumeUtc(value);
    writePreferences({ assumeUtc: value });
    setStorageMessage("Preference saved in this browser.");
  };

  const resetToDefaults = () => {
    setAssumeUtc(DEFAULT_PREFERENCES.assumeUtc);
    writePreferences(DEFAULT_PREFERENCES);
    setStorageMessage("Preferences reset to defaults.");
  };

  const clearStorage = () => {
    clearPreferences();
    setAssumeUtc(DEFAULT_PREFERENCES.assumeUtc);
    setStorageMessage("Stored preferences cleared.");
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[var(--color-bg-primary)]">
      <Navbar />

      <main className="relative z-10 mx-auto w-full max-w-3xl px-6 pb-16 pt-12 sm:pt-14">
        <div className="mb-10">
          <p className="text-xs font-medium uppercase tracking-widest text-[var(--color-accent-cyan)]">
            Preferences
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--color-text-primary)]">
            Settings
          </h1>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            Manage your ProofTrade preferences.
          </p>
        </div>

        <section className="glass-card rounded-xl p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-medium text-[var(--color-text-primary)]">
                Timezone assumption
              </p>
              <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                How to interpret timestamps that omit a timezone offset.
              </p>
            </div>
            <SettingsToggle assumeUtc={assumeUtc} onToggle={updateAssumeUtc} />
          </div>
          <p className="mt-3 text-xs leading-relaxed text-[var(--color-text-muted)]">
            When enabled, timestamps like{" "}
            <code className="font-mono">2023-01-01T10:00:00</code> (without a Z or
            offset) are interpreted as UTC. When disabled, such timestamps are
            rejected and reported as findings. This preference pre-fills the New
            Audit form; the value used for each run is shown there.
          </p>
        </section>

        <section className="glass-card mt-6 rounded-xl p-5">
          <h2 className="mb-3 text-lg font-semibold text-[var(--color-text-primary)]">
            Stored preferences
          </h2>
          <p className="text-sm text-[var(--color-text-secondary)]">
            Preferences are stored only in this browser
            (<code className="font-mono">localStorage</code> key{" "}
            <code className="font-mono">prooftrade.preferences</code>) and are
            never sent to ProofTrade servers.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] px-4 py-2 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]"
              onClick={resetToDefaults}
            >
              Reset to defaults
            </button>
            <button
              type="button"
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] px-4 py-2 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]"
              onClick={clearStorage}
            >
              Clear stored preferences
            </button>
          </div>
          <p
            role="status"
            className="mt-3 min-h-[1rem] text-xs text-[var(--color-text-muted)]"
          >
            {storageMessage}
          </p>
        </section>
      </main>

      <footer className="relative z-10 border-t border-[var(--color-border)]">
        <div className="mx-auto max-w-5xl px-6 py-6 text-center text-xs text-[var(--color-text-muted)]">
          Settings are stored in your browser only. They are never sent to the
          ProofTrade servers.
        </div>
      </footer>
    </div>
  );
}
