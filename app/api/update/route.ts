import { NextResponse } from "next/server";
import { refuseIfNotLocal } from "@/lib/local-ops/localhost";
import { readUpdateStatus, startUpdate } from "@/lib/local-ops/update";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// The build can take a few minutes; the work runs detached but allow headroom.
export const maxDuration = 600;

/**
 * GET /api/update — current/last update progress (polled by the update UI).
 * Localhost-only.
 */
export async function GET(request: Request) {
  const blocked = refuseIfNotLocal(request);
  if (blocked) return blocked;
  return NextResponse.json(await readUpdateStatus());
}

/**
 * POST /api/update — start an update (fetch → reset → install? → build →
 * restart). Returns 202 once started, or 409 if one is already running.
 * Localhost-only. The actual work proceeds in the background; poll GET to
 * follow progress. Errors are surfaced verbatim in the status body.
 */
export async function POST(request: Request) {
  const blocked = refuseIfNotLocal(request);
  if (blocked) return blocked;

  const result = await startUpdate();
  return NextResponse.json(result, { status: result.started ? 202 : 409 });
}
