import { NextResponse } from "next/server";
import { addEvent } from "@/lib/tracking/store";

// Writes SQLite — Node runtime, always dynamic.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/applications/<offerId>/events  { "type": "relance" | "note", "note"?: "…" }
 * Adds a timestamped relance or note event to the application's history.
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

  let body: { type?: unknown; note?: unknown };
  try {
    body = (await request.json()) as { type?: unknown; note?: unknown };
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
  }
  if (body.type !== "relance" && body.type !== "note") {
    return NextResponse.json(
      { error: "Type d'événement invalide. Attendu : relance ou note." },
      { status: 422 },
    );
  }
  const note = typeof body.note === "string" ? body.note : undefined;

  try {
    addEvent(offerId, body.type, note);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 422 },
    );
  }
  return NextResponse.json({ ok: true });
}
