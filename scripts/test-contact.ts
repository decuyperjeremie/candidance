/**
 * Quick unit tests for lib/sources/contact.ts — run with: npx tsx scripts/test-contact.ts
 */

import { extractContact } from "@/lib/sources/contact";

type Case = {
  label: string;
  input: Parameters<typeof extractContact>[0];
  expect: { method: string; email?: string; applyUrl?: string };
};

const cases: Case[] = [
  {
    label: "Valid courriel → method=email",
    input: { emailish: "recrutement@example.fr", urls: [] },
    expect: { method: "email", email: "recrutement@example.fr" },
  },
  {
    label: "Redirect-text courriel + urlOrigine → method=url",
    input: {
      emailish: "Pour postuler, utiliser le lien suivant : https://candidat.francetravail.fr/offres/detail/123",
      urls: ["https://www.entreprise.fr/carriere/offre-123"],
    },
    expect: { method: "url", applyUrl: "https://candidat.francetravail.fr/offres/detail/123" },
  },
  {
    label: "Empty contact {} → method=none",
    input: { emailish: undefined, urls: [] },
    expect: { method: "none" },
  },
  {
    label: "mailto: string → method=email",
    input: { emailish: "mailto:rh@acme.com?subject=Candidature", urls: [] },
    expect: { method: "email", email: "rh@acme.com" },
  },
  {
    label: "No email but urlPostulation → method=url",
    input: {
      emailish: undefined,
      urls: ["https://ats.externe.fr/apply?job=42", "https://candidat.francetravail.fr/offres/123"],
    },
    expect: { method: "url", applyUrl: "https://ats.externe.fr/apply?job=42" },
  },
  {
    label: "Redirect prose without URL, no urls → method=none",
    input: { emailish: "Merci d'envoyer votre candidature via notre formulaire interne.", urls: [] },
    expect: { method: "none" },
  },
];

let passed = 0;
let failed = 0;

for (const c of cases) {
  const got = extractContact(c.input);
  const ok =
    got.method === c.expect.method &&
    (c.expect.email === undefined || got.email === c.expect.email) &&
    (c.expect.applyUrl === undefined || got.applyUrl === c.expect.applyUrl);

  if (ok) {
    console.log(`  ✓ ${c.label}`);
    passed++;
  } else {
    console.error(`  ✗ ${c.label}`);
    console.error(`    expected: method=${c.expect.method} email=${c.expect.email} applyUrl=${c.expect.applyUrl}`);
    console.error(`    got:      method=${got.method} email=${got.email} applyUrl=${got.applyUrl}`);
    failed++;
  }
}

console.log(`\n${passed}/${passed + failed} tests passed`);
if (failed > 0) process.exit(1);
