/**
 * Deterministic email draft (no LLM): a subject and a short French transmittal
 * note for an offer. The persuasive content lives in the attached letter; this
 * is just the covering message. Also builds the `mailto:` URL.
 *
 * France Travail offers carry no contact address, so the recipient is normally
 * blank; the caller can pass one if the offer provides it.
 */

import type { StoredOffer } from "@/lib/aggregation/store";

export type EmailDraft = {
  recipient?: string;
  subject: string;
  body: string;
};

/** Build the subject + body for an offer, signed with the candidate's name. */
export function buildDraft(offer: StoredOffer, candidateName: string, recipient?: string): EmailDraft {
  const role = offer.title;
  const atCompany = offer.company ? ` au sein de ${offer.company}` : "";
  const body = [
    "Madame, Monsieur,",
    "",
    `Je vous adresse ma candidature au poste de ${role}${atCompany}. Vous trouverez ci-joint mon CV et ma lettre de motivation.`,
    "",
    "Je me tiens à votre disposition pour un entretien à votre convenance.",
    "",
    "Cordialement,",
    candidateName,
  ].join("\n");

  return { recipient, subject: `Candidature : ${role}`, body };
}

/** Build a `mailto:` URL from a draft (subject/body always filled; recipient optional). */
export function mailtoUrl(draft: EmailDraft): string {
  const params = new URLSearchParams();
  params.set("subject", draft.subject);
  params.set("body", draft.body);
  // URLSearchParams encodes spaces as "+"; mail clients expect %20 in mailto.
  const query = params.toString().replace(/\+/g, "%20");
  return `mailto:${encodeURIComponent(draft.recipient ?? "")}?${query}`;
}

/**
 * Build a Gmail web compose URL from a draft. Opens Gmail's compose window
 * pre-filled regardless of the OS/browser default mail handler. Like mailto, it
 * cannot carry attachments (use the .eml for that).
 */
export function gmailComposeUrl(draft: EmailDraft): string {
  const params = new URLSearchParams({
    view: "cm",
    fs: "1",
    to: draft.recipient ?? "",
    su: draft.subject,
    body: draft.body,
  });
  return `https://mail.google.com/mail/?${params.toString()}`;
}
