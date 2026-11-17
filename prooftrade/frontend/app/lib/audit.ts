// Client-side access to the deterministic audit engine.
//
// All browser requests are same-origin (`/api/audit`). The Next.js route
// handler in `app/api/audit/route.ts` forwards them to the FastAPI backend
// using the server-only `PROOFTRADE_API_ORIGIN` environment variable, so the
// backend origin is never baked into the browser bundle and no CORS setup is
// required for the normal flow.

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

export interface Summary {
  total_trades: number;
  valid_trades: number;
  net_pnl: number;
  win_rate: number;
  /** The engine returns the string "inf" when there are wins and no losses. */
  profit_factor: number | "inf";
  sharpe_ratio: number | null;
  max_drawdown: number | null;
}

export interface AuditResponse {
  dataset_id: string;
  row_count: number;
  findings: Finding[];
  summary: Summary;
}

/**
 * Results live in `sessionStorage` for the current browser tab only. This keeps
 * the results page honest without adding a backend store: a refresh keeps the
 * audit, closing the tab (or opening a new one) does not.
 */
export const AUDIT_STORAGE_KEY = "prooftrade.last-audit.v1";

export class AuditApiError extends Error {
  readonly status: number | null;
  readonly kind: "network" | "server" | "unexpected";

  constructor(
    message: string,
    kind: "network" | "server" | "unexpected",
    status: number | null = null,
  ) {
    super(message);
    this.name = "AuditApiError";
    this.kind = kind;
    this.status = status;
  }
}

export async function requestAudit(
  file: File,
  { assumeUtc }: { assumeUtc: boolean },
): Promise<AuditResponse> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("assume_utc", assumeUtc ? "true" : "false");

  let response: Response;
  try {
    response = await fetch("/api/audit", { method: "POST", body: formData });
  } catch {
    throw new AuditApiError(
      "Could not reach the audit service. Check that the ProofTrade API is running, then try again.",
      "network",
    );
  }

  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const detail =
      payload &&
      typeof payload === "object" &&
      "detail" in payload &&
      typeof (payload as { detail: unknown }).detail === "string"
        ? (payload as { detail: string }).detail
        : `The audit request failed (HTTP ${response.status}).`;
    throw new AuditApiError(detail, "server", response.status);
  }

  if (
    !payload ||
    typeof payload !== "object" ||
    !("summary" in payload) ||
    !("findings" in payload)
  ) {
    throw new AuditApiError(
      "The audit service returned an unexpected response.",
      "unexpected",
      response.status,
    );
  }

  return payload as AuditResponse;
}

export function saveAuditResult(result: AuditResponse): void {
  try {
    window.sessionStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(result));
  } catch {
    // Storage can be unavailable (private mode, quota). The results page then
    // falls back to its empty state, which is the documented behaviour.
  }
}

export function readAuditResult(): AuditResponse | null {
  try {
    const raw = window.sessionStorage.getItem(AUDIT_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      !parsed ||
      typeof parsed !== "object" ||
      !("summary" in parsed) ||
      !("findings" in parsed) ||
      !Array.isArray((parsed as AuditResponse).findings)
    ) {
      return null;
    }
    return parsed as AuditResponse;
  } catch {
    return null;
  }
}

export function clearAuditResult(): void {
  try {
    window.sessionStorage.removeItem(AUDIT_STORAGE_KEY);
  } catch {
    // Ignore: nothing to clear if storage is unavailable.
  }
}
