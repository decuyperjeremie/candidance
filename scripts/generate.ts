/**
 * CLI: generate an adapted CV + cover letter for a stored offer.
 *   npm run generate -- --offer=42
 *
 * Loads `.env` (like scripts/discover.ts), runs the shared generation core,
 * writes the four files under data/applications/offer-<id>/, prints a summary.
 */
import { existsSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

if (existsSync(".env")) {
  for (const line of readFileSync(".env", "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!m) continue;
    if (m[1] in process.env) continue;
    let val = m[2].trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    process.env[m[1]] = val;
  }
}

function argValue(name: string): string | undefined {
  const pref = `--${name}=`;
  const eq = process.argv.find((a) => a.startsWith(pref));
  if (eq) return eq.slice(pref.length);
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

async function main() {
  const offerArg = argValue("offer");
  const offerId = offerArg ? Number(offerArg) : NaN;
  if (!offerId || Number.isNaN(offerId)) {
    console.error("Usage: npm run generate -- --offer=<id>  (id d'une offre stockée)");
    process.exit(1);
  }

  const { generateApplication } = await import("@/lib/generation/generate");
  const { renderFile, APPLICATION_FILES } = await import("@/lib/render");

  console.log(`\n=== Génération de candidature — offre #${offerId} ===\n`);
  const { content, summary } = await generateApplication(offerId);

  const dir = join(process.cwd(), "data", "applications", `offer-${offerId}`);
  mkdirSync(dir, { recursive: true });
  for (const file of APPLICATION_FILES) {
    writeFileSync(join(dir, file), await renderFile(content, file));
  }

  console.log(`Offre     : ${summary.offerTitle}${summary.company ? ` — ${summary.company}` : ""}`);
  console.log(`Provider  : ${summary.provider} (${summary.model})`);
  console.log(`CV        : ${content.cv.experiences.length} expériences · ${content.cv.skills.length} compétences`);
  const v = summary.verification;
  if (v.droppedExperiences.length || v.droppedFormations.length || v.droppedSkills.length || v.flags.length) {
    console.log("\n⚠️  Garde-fou zéro-invention :");
    if (v.droppedExperiences.length) console.log(`   - expériences non tracées retirées : ${v.droppedExperiences.join(" | ")}`);
    if (v.droppedFormations.length) console.log(`   - formations non tracées retirées  : ${v.droppedFormations.join(" | ")}`);
    if (v.droppedSkills.length) console.log(`   - compétences non supportées retirées : ${v.droppedSkills.join(", ")}`);
    for (const f of v.flags) console.log(`   - ⚑ ${f}`);
  } else {
    console.log("✅ Garde-fou zéro-invention : tout le contenu généré est tracé au profil.");
  }
  console.log(`\nFichiers écrits dans : ${dir}`);
  for (const f of APPLICATION_FILES) console.log(`   - ${f}`);
  console.log("");
}

main().catch((err) => {
  console.error("\n❌ Génération échouée :", err instanceof Error ? err.message : err);
  process.exit(1);
});
