/**
 * Provider-agnostic apply-contact extractor.
 *
 * France Travail's `courriel` field is almost always redirect prose, not an
 * address. This helper validates the email-ish string, lifts any URL embedded
 * in it into the URL candidate list, then picks: email > first http(s) URL >
 * none. Never fabricates a contact.
 */

import type { OfferContact } from "./types";

/** Simple pragmatic regex — goal is rejecting redirect prose, not RFC 5321. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Extract the first email address from a string (e.g. a mailto: link). */
export function firstEmail(text: string): string | undefined {
  const m = text.match(/[^\s@,;<>()[\]"]+@[^\s@,;<>()[\]"]+\.[^\s@,;<>()[\]"]+/);
  return m ? m[0] : undefined;
}

/** Extract the first http(s) URL from a string. */
export function firstUrl(text: string): string | undefined {
  const m = text.match(/https?:\/\/[^\s"'<>]+/);
  return m ? m[0] : undefined;
}

/**
 * Turn raw source signals into a normalised `OfferContact`.
 *
 * @param input.emailish  The raw "email" field from the source — may be an
 *   address, may be redirect text, may be a mailto: string.
 * @param input.urls      Additional URL candidates (apply link, origin URL…).
 * @param input.name      Contact person name, when present.
 */
export function extractContact(input: {
  emailish?: string | null;
  urls?: (string | undefined | null)[];
  name?: string | null;
}): OfferContact {
  const { emailish, urls = [], name } = input;
  const contactName = name?.trim() || undefined;

  // Candidate URLs: start with the provided list.
  const urlCandidates: string[] = urls.filter((u): u is string => !!u?.trim());

  // Process the emailish field.
  let validEmail: string | undefined;
  if (emailish?.trim()) {
    const trimmed = emailish.trim();
    if (trimmed.startsWith("mailto:")) {
      // mailto: string — extract the address part before any query string.
      const addr = trimmed.slice("mailto:".length).split("?")[0];
      if (EMAIL_RE.test(addr)) validEmail = addr;
    } else if (EMAIL_RE.test(trimmed)) {
      // Looks like a real address — trust it.
      validEmail = trimmed;
    } else {
      // Redirect prose or other text — try to lift a URL from it.
      const embedded = firstUrl(trimmed);
      if (embedded) urlCandidates.unshift(embedded);
    }
  }

  if (validEmail) {
    return { method: "email", email: validEmail, contactName };
  }

  const applyUrl = urlCandidates.find((u) => /^https?:\/\//.test(u));
  if (applyUrl) {
    return { method: "url", applyUrl, contactName };
  }

  return { method: "none", contactName };
}
