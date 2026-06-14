import { NextResponse } from "next/server";
import { getApplication } from "@/lib/generation/store";
import { CONTENT_TYPES, isApplicationFile, renderFile } from "@/lib/render";

// Renders binary files from stored content — Node runtime, always dynamic.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/applications/<offerId>/<file>
 * where <file> is cv.pdf | cv.docx | lettre.pdf | lettre.docx.
 * Re-renders the file from the stored application content and returns it as a
 * downloadable attachment with the correct content type.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ offerId: string; file: string }> },
) {
  const { offerId: offerIdRaw, file } = await params;
  const offerId = Number(offerIdRaw);

  if (!isApplicationFile(file)) {
    return NextResponse.json(
      { error: "Fichier inconnu. Attendu : cv.pdf, cv.docx, lettre.pdf, lettre.docx." },
      { status: 404 },
    );
  }
  if (!offerId || Number.isNaN(offerId)) {
    return NextResponse.json({ error: "offerId invalide." }, { status: 400 });
  }

  const app = getApplication(offerId);
  if (!app) {
    return NextResponse.json(
      { error: `Aucune candidature générée pour l'offre #${offerId}. Génère-la d'abord.` },
      { status: 404 },
    );
  }

  const buffer = await renderFile(app.content, file);
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": CONTENT_TYPES[file],
      "Content-Disposition": `attachment; filename="offre-${offerId}-${file}"`,
      "Content-Length": String(buffer.length),
    },
  });
}
