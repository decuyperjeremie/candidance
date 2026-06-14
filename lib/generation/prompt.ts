/**
 * Builds the adaptation prompt: the LLM receives ONLY the candidate's real
 * profile facts + the offer, and must return an ApplicationContent JSON object.
 * The hard rule (FONDATIONS §5) is encoded in the system prompt and enforced
 * afterwards by lib/generation/verify.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { CandidateProfile } from "@/lib/profile";
import type { StoredOffer } from "@/lib/aggregation/store";

/** The FR writing-style skill that should govern every CV/letter we formulate. */
const STYLE_SKILL_PATH = join(
  process.cwd(),
  ".claude/skills/cv-lettre-motivation-fr/SKILL.md",
);

let cachedStyleGuide: string | null | undefined;

/**
 * Load the writing-style rules from the cv-lettre-motivation-fr skill and inject
 * them into the system prompt, so the SAME guidance applies on every provider.
 * The headless `claude` CLI runs with tools disabled and never auto-loads a
 * skill, so the file's content has to travel inside the prompt itself. The
 * frontmatter is stripped; a missing file just means generation proceeds without
 * the extra style layer (the zero-invention rule still applies).
 */
function loadStyleGuide(): string | null {
  if (cachedStyleGuide !== undefined) return cachedStyleGuide;
  try {
    const raw = readFileSync(STYLE_SKILL_PATH, "utf8");
    const body = raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "").trim();
    cachedStyleGuide = body || null;
  } catch {
    cachedStyleGuide = null;
  }
  return cachedStyleGuide;
}

/** Tie the skill's prose rules to the JSON fields the model must fill. */
const STYLE_FIELD_MAP = `APPLICATION DU GUIDE DE STYLE AUX CHAMPS JSON :
- "cv.summary" = le paragraphe « Profil » : prose continue à la première personne, sans puces.
- "letter.paragraphs" = le corps de la lettre : prose continue, 3 à 4 paragraphes, aucune puce.
- "cv.experiences[].highlights" = des puces courtes (une action ou une réalisation par puce).
- "cv.headline" = un titre sobre aligné sur l'intitulé de l'offre.
- Jamais de tiret long (—) ni de double tiret dans aucun champ : utilise les deux-points, la virgule, les parenthèses ou le tiret court simple.
- Tu ne peux PAS poser de questions ici : n'invente rien, travaille uniquement avec les faits fournis.`;

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

  const styleGuide = loadStyleGuide();
  const system = styleGuide
    ? [
        SYSTEM,
        "GUIDE DE STYLE RÉDACTIONNEL (à appliquer à tous les textes que tu rédiges) :",
        styleGuide,
        STYLE_FIELD_MAP,
      ].join("\n\n")
    : SYSTEM;

  return { system, user };
}
