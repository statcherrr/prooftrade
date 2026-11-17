// Browser-local preferences. These never leave the device and are not sent to
// the API; they only pre-fill the audit form.

export interface Preferences {
  assumeUtc: boolean;
}

export const PREFERENCES_KEY = "prooftrade.preferences";

export const DEFAULT_PREFERENCES: Preferences = { assumeUtc: true };

export function readPreferences(): Preferences {
  try {
    const raw = window.localStorage.getItem(PREFERENCES_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return DEFAULT_PREFERENCES;
    const assumeUtc = (parsed as { assumeUtc?: unknown }).assumeUtc;
    return { assumeUtc: typeof assumeUtc === "boolean" ? assumeUtc : DEFAULT_PREFERENCES.assumeUtc };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function writePreferences(preferences: Preferences): void {
  try {
    window.localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
  } catch {
    // Preferences are a convenience; failing to persist must not break the app.
  }
}

export function clearPreferences(): void {
  try {
    window.localStorage.removeItem(PREFERENCES_KEY);
  } catch {
    // Ignore.
  }
}
