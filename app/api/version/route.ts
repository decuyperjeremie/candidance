import { NextResponse } from "next/server";
import { refuseIfNotLocal } from "@/lib/local-ops/localhost";
import { getVersionInfo } from "@/lib/local-ops/version";

// Reads git state (and optionally the network) — never cache.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/version[?remote=0]
 * Returns the running commit and, unless `remote=0`, whether origin is ahead.
 * Localhost-only. `remote=0` skips the network fetch for cheap local polling
 * (used by the update UI while waiting for the server to come back).
 */
export async function GET(request: Request) {
  const blocked = refuseIfNotLocal(request);
  if (blocked) return blocked;

  const checkRemote = new URL(request.url).searchParams.get("remote") !== "0";
  return NextResponse.json(await getVersionInfo({ checkRemote }));
}
