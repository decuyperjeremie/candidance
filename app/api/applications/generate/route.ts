import { NextResponse } from "next/server";
import { generateApplication, GenerationError } from "@/lib/generation/generate";

// Calls the LLM + writes SQLite — Node runtime, always dynamic.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * POST /api/applications/generate  { "offerId": 42 }
 * Generates (and persists) an adapted, verified application for the offer.
 * Returns the run summary; per-step failures are reported with a clear message.
 */
export async function POST(request: Request) {
  let offerId: number;
  try {
    const body = (await request.json()) as { offerId?: number };
    offerId = Number(body.offerId);
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide ; attendu { offerId }." }, { status: 400 });
  }
  if (!offerId || Number.isNaN(offerId)) {
    return NextResponse.json({ error: "offerId manquant ou invalide." }, { status: 400 });
  }

  try {
    const { summary } = await generateApplication(offerId);
    return NextResponse.json({ summary });
  } catch (err) {
    const status = err instanceof GenerationError ? 422 : 500;
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status },
    );
  }
}
