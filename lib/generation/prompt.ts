/**
 * Builds the adaptation prompt: the LLM receives ONLY the candidate's real
 * profile facts + the offer, and must return an ApplicationContent JSON object.
 * The hard rule (FONDATIONS §5) is encoded in the system prompt and enforced
 * afterwards by lib/generation/verify.
 */

import type { CandidateProfile } from "@/lib/profile";
import type { StoredOffer } from "@/lib/aggregation/store";

const SYSTEM = `Tu es un assistant RH expert qui adapte la candidature d'une personne à une offre d'emploi précise, pour passer les filtres ATS (tri automatique des CV).

RÈGLE ABSOLUE — ZÉRO INVENTION :
- Tu utilises UNIQUEMENT les faits fournis dans le profil. Tu ne dois JAMAIS inventer une expérience, un employeur, un diplôme, une date, un résultat chiffré ou une compétence absente du profil.
- Tu peux REFORMULER, RÉORGANISER, PRIORISER et CHOISIR les faits réels pour les rapprocher de l'offre. Tu ne peux pas en AJOUTER de nouveaux.
- Réinjecte les mots-clés EXACTS de l'offre (intitulé du poste, compétences, outils) UNIQUEMENT là où ils correspondent à des faits réels du profil. N'ajoute jamais une compétence que la personne ne possède pas (pas de bourrage de mots-clés).

FORMAT :
- Tout en français.
- Dates au format MM/AAAA quand c'est possible.
- Réponds STRICTEMENT avec un objet JSON valide conforme au schéma ci-dessous, sans texte autour, sans bloc de code markdown.`;

const SCHEMA_HINT = `Schéma JSON attendu :
{
  "cv": {
    "headline": "string (titre/accroche adapté à l'offre, optionnel)",
    "summary": "string (paragraphe de profil adapté, fait-only, optionnel)",
    "contact": { "fullName": "string", "email": "string?", "phone": "string?", "location": "string?", "linkedinUrl": "string?" },
    "experiences": [ { "title": "string", "organisation": "string?", "period": "string?", "location": "string?", "highlights": ["string", ...] } ],
    "formations": [ { "degree": "string", "institution": "string?", "period": "string?" } ],
    "skills": ["string", ...],
    "languages": [ { "name": "string", "level": "string?" } ]
  },
  "letter": {
    "recipientContext": "string? (contexte d'adressage si l'offre ne donne pas de nom)",
    "paragraphs": ["string", ...]  // 3 à 4 paragraphes, lettre de motivation professionnelle concise
  }
}`;

function profileFacts(profile: CandidateProfile): string {
  const lines: string[] = [];
  const c = profile.contact;
  lines.push("CONTACT :");
  lines.push(`  Nom: ${c.fullName}`);
  if (c.email) lines.push(`  Email: ${c.email}`);
  if (c.phone) lines.push(`  Téléphone: ${c.phone}`);
  if (c.location) lines.push(`  Lieu: ${c.location}`);
  if (c.linkedinUrl) lines.push(`  LinkedIn: ${c.linkedinUrl}`);
  if (profile.headline) lines.push(`\nTITRE ACTUEL : ${profile.headline}`);
  if (profile.summaries.length) {
    lines.push("\nRÉSUMÉS (verbatim, sources) :");
    for (const s of profile.summaries) lines.push(`  - ${s.text}`);
  }

  lines.push("\nEXPÉRIENCES (faits réels — ne pas en inventer d'autres) :");
  profile.experiences.forEach((e, i) => {
    lines.push(`  [${i + 1}] ${e.title}${e.organisation ? ` — ${e.organisation}` : ""}${e.period ? ` (${e.period})` : ""}${e.location ? `, ${e.location}` : ""}`);
    for (const h of e.highlights) lines.push(`      • ${h}`);
  });

  lines.push("\nFORMATIONS (faits réels) :");
  profile.formations.forEach((f) => {
    lines.push(`  - ${f.degree}${f.institution ? ` — ${f.institution}` : ""}${f.period ? ` (${f.period})` : ""}${f.field ? ` [${f.field}]` : ""}`);
  });

  if (profile.skills.length) {
    lines.push("\nCOMPÉTENCES (seules celles-ci sont possédées) :");
    lines.push("  " + profile.skills.map((s) => s.name).join(", "));
  }
  if (profile.languages.length) {
    lines.push("\nLANGUES :");
    lines.push("  " + profile.languages.map((l) => `${l.name}${l.level ? ` (${l.level})` : ""}`).join(", "));
  }
  if (profile.publications.length) {
    lines.push("\nPUBLICATIONS :");
    for (const p of profile.publications) lines.push(`  - ${p.text}`);
  }
  return lines.join("\n");
}

function offerText(offer: StoredOffer): string {
  return [
    "OFFRE CIBLE :",
    `  Intitulé: ${offer.title}`,
    offer.company ? `  Entreprise: ${offer.company}` : null,
    offer.location ? `  Lieu: ${offer.location}` : null,
    offer.contractType ? `  Contrat: ${offer.contractType}` : null,
    offer.description ? `\nDESCRIPTION DE L'OFFRE :\n${offer.description}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Build the {system, user} messages for the adaptation call. */
export function buildAdaptationPrompt(
  profile: CandidateProfile,
  offer: StoredOffer,
): { system: string; user: string } {
  const user = [
    "Adapte la candidature suivante à l'offre cible.",
    "",
    profileFacts(profile),
    "",
    offerText(offer),
    "",
    SCHEMA_HINT,
    "",
    "Rappel : zéro invention. Réponds uniquement avec le JSON.",
  ].join("\n");
  return { system: SYSTEM, user };
}
