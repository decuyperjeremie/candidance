/**
 * Hand-rolled RFC822 `.eml` builder (no dependency, no SMTP). Produces a
 * `multipart/mixed` message: a text/plain body part plus one base64 attachment
 * per generated file. Opening the `.eml` in a mail client yields a ready draft
 * with the documents already attached. mailto: remains the always-works
 * fallback (it cannot carry attachments — see FONDATIONS §9).
 */

import type { ApplicationContent } from "@/lib/generation/content";
import { APPLICATION_FILES, CONTENT_TYPES, renderFile } from "@/lib/render";
import type { EmailDraft } from "./draft";

/** Friendly attachment filenames for each rendered file. */
const ATTACHMENT_NAMES: Record<(typeof APPLICATION_FILES)[number], string> = {
  "cv.pdf": "CV.pdf",
  "cv.docx": "CV.docx",
  "lettre.pdf": "Lettre-de-motivation.pdf",
  "lettre.docx": "Lettre-de-motivation.docx",
};

const CRLF = "\r\n";

/** Fold a base64 string into 76-char lines separated by CRLF (RFC 2045). */
function foldBase64(b64: string): string {
  return (b64.match(/.{1,76}/g) ?? []).join(CRLF);
}

/** Encode a header value as a UTF-8 encoded-word if it contains non-ASCII. */
function encodeHeader(value: string): string {
  // eslint-disable-next-line no-control-regex
  if (/^[\x00-\x7F]*$/.test(value)) return value;
  return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

/**
 * Build a `.eml` for an offer's application: the draft subject/body as the
 * message, with the 4 rendered files attached. Returns the raw message text.
 */
export async function buildEml(params: {
  offerId: number;
  draft: EmailDraft;
  content: ApplicationContent;
}): Promise<string> {
  const { offerId, draft, content } = params;
  const boundary = `=_tatiana_${offerId}_boundary_`;
  const from = content.cv.contact.email;

  const headers = [
    from ? `From: ${from}` : null,
    `To: ${draft.recipient ?? ""}`,
    `Subject: ${encodeHeader(draft.subject)}`,
    `Date: ${new Date().toUTCString()}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
  ].filter(Boolean);

  const bodyPart = [
    `--${boundary}`,
    'Content-Type: text/plain; charset="utf-8"',
    "Content-Transfer-Encoding: base64",
    "",
    foldBase64(Buffer.from(draft.body, "utf8").toString("base64")),
  ].join(CRLF);

  const attachmentParts: string[] = [];
  for (const file of APPLICATION_FILES) {
    const buffer = await renderFile(content, file);
    attachmentParts.push(
      [
        `--${boundary}`,
        `Content-Type: ${CONTENT_TYPES[file]}; name="${ATTACHMENT_NAMES[file]}"`,
        "Content-Transfer-Encoding: base64",
        `Content-Disposition: attachment; filename="${ATTACHMENT_NAMES[file]}"`,
        "",
        foldBase64(buffer.toString("base64")),
      ].join(CRLF),
    );
  }

  return [
    headers.join(CRLF),
    "",
    bodyPart,
    ...attachmentParts,
    `--${boundary}--`,
    "",
  ].join(CRLF);
}
