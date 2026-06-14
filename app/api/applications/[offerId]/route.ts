import { NextResponse } from "next/server";
import { ApplicationContent } from "@/lib/generation/content";
import { getApplication, saveApplication } from "@/lib/generation/store";

// Validates + writes SQLite — Node runtime, always dynamic.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PUT /api/applications/<offerId>
 * Body: an edited ApplicationContent (the user's own text — no LLM re-run).
 * Validates with the existing zod schema and upserts via saveApplication so the
 * four downloads re-render from it. Rejects invalid bodies with a clear 422; the
 * previously stored content is left untouched on rejection.
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ offerId: string }> },
) {
  const { offerId: offerIdRaw } = await params;
  const offerId = Number(offerIdRaw);
  if (!offerId || Number.isNaN(offerId)) {
    return NextResponse.json({ error: "offerId invalide." }, { status: 400 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
  }

  const parsed = ApplicationContent.safeParse(raw);
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((i) => `${i.path.join(".") || "(racine)"} : ${i.message}`)
      .join(" ; ");
    return NextResponse.json(
      { error: `Contenu invalide — ${detail}` },
      { status: 422 },
    );
  }

  // Preserve the recorded provider/model from the prior generation, if any.
  const prior = getApplication(offerId);
  saveApplication({
    offerId,
    content: parsed.data,
    provider: prior?.provider,
    model: prior?.model,
  });

  return NextResponse.json({ ok: true });
}
