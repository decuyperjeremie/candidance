import { NextResponse } from "next/server";
import { isStatus, setStatus, STATUSES } from "@/lib/tracking/store";

// Writes SQLite — Node runtime, always dynamic.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/applications/<offerId>/status  { "status": "envoyée" }
 * Validates against the lifecycle, updates the application + logs a status
 * event. 422 if the status is invalid; 404 if the offer has no application.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ offerId: string }> },
) {
  const { offerId: offerIdRaw } = await params;
  const offerId = Number(offerIdRaw);
  if (!offerId || Number.isNaN(offerId)) {
    return NextResponse.json({ error: "offerId invalide." }, { status: 400 });
  }

  let status: unknown;
  try {
    status = ((await request.json()) as { status?: unknown }).status;
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
  }
  if (!isStatus(status)) {
    return NextResponse.json(
      { error: `Statut invalide. Attendu l'un de : ${STATUSES.join(", ")}.` },
      { status: 422 },
    );
  }

  try {
    setStatus(offerId, status);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 404 },
    );
  }
  return NextResponse.json({ ok: true, status });
}
