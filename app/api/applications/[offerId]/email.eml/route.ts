import { NextResponse } from "next/server";
import { getOffer } from "@/lib/aggregation/store";
import { getApplication } from "@/lib/generation/store";
import { buildDraft } from "@/lib/email/draft";
import { buildEml } from "@/lib/email/eml";

// Renders files + assembles a MIME message — Node runtime, always dynamic.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/applications/<offerId>/email.eml
 * Returns a downloadable .eml (pre-filled subject/body + the 4 generated files
 * attached) for opening in a mail client. Clear 404 if no application exists.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ offerId: string }> },
) {
  const { offerId: offerIdRaw } = await params;
  const offerId = Number(offerIdRaw);
  if (!offerId || Number.isNaN(offerId)) {
    return NextResponse.json({ error: "offerId invalide." }, { status: 400 });
  }

  const offer = getOffer(offerId);
  if (!offer) {
    return NextResponse.json({ error: `Offre #${offerId} introuvable.` }, { status: 404 });
  }
  const app = getApplication(offerId);
  if (!app) {
    return NextResponse.json(
      { error: `Aucune candidature générée pour l'offre #${offerId}. Génère-la d'abord.` },
      { status: 404 },
    );
  }

  const draft = buildDraft(offer, app.content.cv.contact.fullName);
  const eml = await buildEml({ offerId, draft, content: app.content });

  return new NextResponse(eml, {
    status: 200,
    headers: {
      "Content-Type": "message/rfc822; charset=utf-8",
      "Content-Disposition": `attachment; filename="candidature-${offerId}.eml"`,
    },
  });
}
