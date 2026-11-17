// Server-side proxy for the deterministic audit engine.
//
// The browser posts multipart CSV uploads to this same-origin route; the
// handler forwards them to FastAPI. Keeping the hop server-side means:
//   * the backend origin is configured at runtime (`PROOFTRADE_API_ORIGIN`)
//     and never shipped to the browser,
//   * there is no cross-origin request in production, so no CORS coupling,
//   * upstream failures become readable JSON errors instead of opaque
//     network failures in the UI.

import { NextResponse } from "next/server";

const DEFAULT_API_ORIGIN = "http://127.0.0.1:8000";
const UPSTREAM_TIMEOUT_MS = 60_000;

export const dynamic = "force-dynamic";

function backendOrigin(): string {
  const configured = process.env.PROOFTRADE_API_ORIGIN?.trim();
  const origin = configured && configured.length > 0 ? configured : DEFAULT_API_ORIGIN;
  return origin.replace(/\/+$/, "");
}

export async function POST(request: Request): Promise<Response> {
  let incoming: FormData;
  try {
    incoming = await request.formData();
  } catch {
    return NextResponse.json(
      { detail: "Expected a multipart form upload containing a CSV file." },
      { status: 400 },
    );
  }

  const file = incoming.get("file");
  if (!file || typeof file === "string") {
    return NextResponse.json(
      { detail: "No CSV file was received. Choose a .csv file and try again." },
      { status: 400 },
    );
  }

  const upload = file as File;
  const assumeUtc = incoming.get("assume_utc");

  const forward = new FormData();
  forward.append("file", upload, upload.name || "trades.csv");
  forward.append(
    "assume_utc",
    typeof assumeUtc === "string" ? assumeUtc : "true",
  );

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    const upstream = await fetch(`${backendOrigin()}/api/audit`, {
      method: "POST",
      body: forward,
      signal: controller.signal,
      headers: { accept: "application/json" },
      cache: "no-store",
    });

    const body = await upstream.text();
    return new NextResponse(body, {
      status: upstream.status,
      headers: {
        "content-type": upstream.headers.get("content-type") ?? "application/json",
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    return NextResponse.json(
      {
        detail: aborted
          ? "The audit service timed out before returning a result. Try a smaller CSV."
          : "The audit service is unreachable. Check that the ProofTrade API is running.",
      },
      { status: aborted ? 504 : 502 },
    );
  } finally {
    clearTimeout(timeout);
  }
}
